---
name: multi-tenant-performance-scaling
description: Use ao escalar Postgres multi-tenant em Supabase — Supavisor transaction mode (porta 6543), partial indexes obrigatórios em colunas de RLS, helper functions STABLE, partitioning por org_id quando…
---

# Multi-Tenant Performance & Scaling — Postgres + Supabase

## Quando usar

LLM carrega esta skill ao escalar app B2B multi-tenant em Supabase para alta carga (>1k req/s, >50k rows/tenant, >100 tenants ativos). Trigger phrases:

- "Supavisor connection pooling", "transaction mode 6543"
- "RLS performance multi-tenant", "helper function STABLE"
- "partitioning por org_id", "particionamento Postgres tenant"
- "materialized view per tenant", "MV per-tenant"
- "scaling multi-tenant Postgres", "connection pool exhaustion"
- "queries lentas multi-tenant"

Esta skill é consumida por `multi-tenant-rls-writer` (Phase 108) ao gerar policies (índices acompanham), por `b2b-saas-architecture` (skill irmã) ao definir schema, e por `multi-tenant-isolation-auditor` ao auditar performance gaps.

## Regras absolutas

**REGRA #1 (connection pooling Vercel):** **SEMPRE** porta **6543** (Supavisor transaction mode) para Vercel Edge/Serverless. Porta 5432 (direct) só para long-running Node.js processes (workers, schedulers). Session mode na porta 6543 foi **deprecado em 2025-02-28** — não usar.

**REGRA #2 (helper functions STABLE):** Funções PG usadas em RLS policies **DEVEM** ser marcadas `STABLE` (não `VOLATILE` que é o default). VOLATILE re-executa por linha — em tabela 100k rows = 100k chamadas extras.

**REGRA #3 (partial indexes obrigatórios):** Cada coluna referenciada por RLS policy precisa de índice. Para multi-tenant, usar **partial indexes** em status='active' — exclui suspended/left que não são consultados em hot path.

**REGRA #4 (partitioning threshold):** Particionar tabela por `org_id` (LIST partitioning) quando **>50k rows/tenant** OU **>100 tenants × 1k rows**. Abaixo disso, índices regulares são mais simples e performáticos.

**REGRA #5 (MV refresh strategy):** Materialized Views per-tenant devem ter `REFRESH MATERIALIZED VIEW CONCURRENTLY` (não bloqueante) + `pg_cron` schedule. Refresh inline em request é anti-pattern.

## Patterns canônicos

### Supavisor — connection string Vercel

```typescript
// .env.local (Vercel) — porta 6543 SEMPRE
DATABASE_URL="postgres://postgres.{project_ref}:{password}@aws-0-{region}.pooler.supabase.com:6543/postgres"

// Para Prisma adicionar pgbouncer flag (Supavisor é compatível com pgbouncer protocol)
DATABASE_URL="postgres://...:6543/postgres?pgbouncer=true&connection_limit=1"

// Para long-running workers (cron jobs, BullMQ) usar 5432 direct connection
WORKER_DATABASE_URL="postgres://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres"
```

**Por que `connection_limit=1` com Prisma:** Supavisor é transaction-pooled — cada connection serverless deve ter `connection_limit=1` para não esgotar o pool no servidor.

### Helper function STABLE — exemplo correto

```sql
-- STABLE — re-executa apenas 1× por query (Postgres pode cachear)
create or replace function private.is_member_of(p_org_id uuid)
returns boolean
language sql
stable                              -- ⭐ CRÍTICO — não VOLATILE
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;
```

**Diferença em produção:**
- VOLATILE em policy SELECT em tabela 100k rows = 100k chamadas a `is_member_of` = ~10s query
- STABLE em mesma policy = 1 chamada cacheada = ~50ms query
- Speedup 200×

### Partial indexes obrigatórios

```sql
-- Index parcial em organization_members (status='active' é hot path)
create index organization_members_user_org_active_idx
  on public.organization_members (user_id, org_id)
  where status = 'active';

-- Composite index em roles (lookup por nome dentro da org)
create index roles_org_name_idx
  on public.roles (org_id, name);

-- Composite index em permissions (lookup por action+resource)
create index permissions_action_resource_idx
  on public.permissions (action, resource);

-- Composite index em role_permissions (lookup por role)
create index role_permissions_role_idx
  on public.role_permissions (role_id);

-- Index em departments (lookup por org)
create index departments_org_idx
  on public.departments (org_id);

-- Index em audit_logs (sempre filtrar por tenant_id primeiro)
create index audit_logs_tenant_created_idx
  on public.audit_logs (tenant_id, created_at desc);
```

**Sem esses indexes, RLS força sequential scan a cada query** — degradação cresce linear com tamanho da tabela.

### Partitioning por org_id (LIST partitioning)

Aplicar quando **uma tabela** atinge >50k rows/tenant ou >5M total. Exemplo `audit_logs`:

```sql
-- Tabela particionada por LIST de org_id
create table public.audit_logs (
  id uuid not null,
  tenant_id uuid not null,
  event_type text not null,
  actor_id uuid,
  payload jsonb,
  created_at timestamptz not null default now(),
  primary key (id, tenant_id)
) partition by list (tenant_id);

-- Função que cria partição automaticamente para nova org
create or replace function private.create_audit_partition(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  partition_name text;
begin
  partition_name := 'audit_logs_' || replace(p_org_id::text, '-', '_');
  execute format(
    'create table if not exists public.%I partition of public.audit_logs for values in (%L)',
    partition_name, p_org_id
  );
end;
$$;

-- Trigger em organizations: cria partição ao criar org
create or replace function private.on_org_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.create_audit_partition(new.id);
  return new;
end;
$$;

create trigger create_audit_partition_on_org_create
  after insert on public.organizations
  for each row execute function private.on_org_created();
```

**Quando NÃO particionar:**
- <50k rows/tenant (overhead > benefit)
- Queries cross-tenant frequentes (super-admin views) — partitioning torna isso lento
- <100 tenants total (overhead > benefit)

### Materialized Views per-tenant

```sql
-- MV agregando métricas por org (lead count, member count, etc.)
create materialized view public.org_metrics as
select
  o.id as org_id,
  o.name,
  count(distinct om.user_id) filter (where om.status = 'active') as active_members,
  count(distinct d.id) as departments_count,
  max(om.joined_at) as last_member_joined
from public.organizations o
left join public.organization_members om on om.org_id = o.id
left join public.departments d on d.org_id = o.id
group by o.id, o.name;

create unique index org_metrics_org_id_idx on public.org_metrics (org_id);

-- Refresh CONCURRENT via pg_cron (não bloqueante)
select cron.schedule(
  'refresh-org-metrics',
  '*/15 * * * *',  -- a cada 15min
  $$ refresh materialized view concurrently public.org_metrics; $$
);

-- RLS sobre a MV (mesma policy de organizations)
alter materialized view public.org_metrics enable row level security;

create policy "org_metrics_select_member"
  on public.org_metrics
  for select
  to authenticated
  using (private.is_member_of(org_id));
```

**REFRESH CONCURRENTLY exige unique index** na MV (linha `unique index ... on public.org_metrics (org_id)` acima).

### Diagnóstico de performance — queries canônicas

```sql
-- Top 10 queries lentas com RLS
select
  query,
  calls,
  mean_exec_time,
  total_exec_time
from pg_stat_statements
where query ilike '%organization_members%'
order by mean_exec_time desc
limit 10;

-- Tabelas sem index nas colunas de RLS
select
  c.relname as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as size
from pg_class c
where c.relrowsecurity = true
  and c.relkind = 'r'
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.oid
  );

-- Connection pool usage (Supavisor)
-- Verificar via Supabase Dashboard → Settings → Database → Connection Pooling
```

## Anti-patterns

### Anti-pattern 1: Helper function VOLATILE (default)

**Errado:**
```sql
create function private.is_member_of(p_org_id uuid)
returns boolean
language sql
-- sem STABLE — default é VOLATILE
as $$ select exists(...); $$;
```

**Por quê:** PG re-executa a função para CADA linha avaliada pela policy. Em tabela 100k rows, isso é 100k chamadas — cada uma com query interna ao banco. Latência cresce linearmente com tamanho da tabela.

**Certo:** marcar `STABLE` (acima). PG executa 1× por query e cacheia o resultado para o restante das linhas.

### Anti-pattern 2: Conexão direta porta 5432 em Vercel

**Errado:**
```typescript
// Vercel Edge Function usando porta 5432 direct
DATABASE_URL="postgres://...:5432/postgres"
```

**Por quê:** cada invocação Edge cria conexão direta ao Postgres. 100 req/s × 5 segundos = 500 conexões abertas simultaneamente. Postgres tem limite ~100 conns padrão — esgota → "too many connections" → 500 errors em produção.

**Certo:** porta 6543 Supavisor transaction mode. Pool gerenciado por Supabase, conns recicladas após cada transaction.

### Anti-pattern 3: Particionar tabela com poucos rows

**Errado:**
```sql
-- App ainda em pre-launch, 5 tenants, 200 rows total
create table public.events (...) partition by list (org_id);
```

**Por quê:** overhead de partition pruning + management > benefit. Cada query passa por partition routing, manutenção é complexa, dump/restore mais lento. Premature optimization clássica.

**Certo:** começar com tabela regular + indexes. Particionar quando atingir threshold real (>50k rows/tenant).

### Anti-pattern 4: MV refresh inline em request

**Errado:**
```typescript
// Edge Function ao servir dashboard
await supabase.rpc('refresh_org_metrics')  // 30s+ blocking!
const metrics = await supabase.from('org_metrics').select()
```

**Por quê:** REFRESH MATERIALIZED VIEW (sem CONCURRENTLY) bloqueia a tabela. CONCURRENTLY não bloqueia mas leva tempo. Em request síncrono, user espera 30s.

**Certo:** REFRESH CONCURRENTLY agendado por pg_cron. Request lê snapshot atual da MV (instantâneo).

### Anti-pattern 5: Index full table quando partial cobre 90%

**Errado:**
```sql
-- Index full sobre uma tabela onde 90% rows são status='left'
create index members_user_idx on organization_members (user_id);
```

**Por quê:** index inclui rows inativas (status in ('suspended', 'left')) que não são consultadas em hot path. Tamanho do index 10× maior que necessário, refresh 10× mais lento.

**Certo:**
```sql
create index members_user_active_idx
  on organization_members (user_id, org_id)
  where status = 'active';
```

Apenas rows ativas no index. Tamanho 10× menor, query plan idêntico em hot path.

## Detecção e Mitigação de Tenant Quente (v1.22+)

> Para detectar e mitigar o "tenant Justin Bieber" (1 tenant >>> outros), ver skill [`tenant-quente-mitigacao`](../tenant-quente-mitigacao/SKILL.md) (v1.22 — DDIA Ch 6). Cobre 3 métricas canônicas (queries/min, storage GB, conexões), 5 estratégias de mitigação (rate limit, pool isolado, replica dedicada, MV, request shaping), particionamento range vs hash para tenant_id, e rebalanceamento sem downtime.

## Ver também

- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — schema canônico que esta skill performance-otimiza (skill irmã)
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — helper functions PG (Phase 108) consumem REGRA #2 (STABLE)
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — `(select auth.uid())` wrapper já cobre 1 dimensão de performance (esta skill cobre as outras)
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — padrões PG functions (security invoker, search_path)
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — pg_cron usado em MV refresh schedule
- [Supabase Supavisor 1M Connections](https://supabase.com/blog/supavisor-1-million)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Postgres LIST Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE)
