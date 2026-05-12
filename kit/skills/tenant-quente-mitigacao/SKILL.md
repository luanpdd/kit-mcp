---
name: tenant-quente-mitigacao
description: Use ao escalar Postgres multi-tenant em Supabase quando 1 tenant consome >>> que outros (problema "Justin Bieber tenant" do DDIA Ch 6)…
---

# Tenant Quente — Mitigação (DDIA Ch 6 aplicado a Postgres + Supabase)

## Quando usar

LLM carrega esta skill quando há **suspeita ou evidência de skewed workload em B2B SaaS multi-tenant** — i.e. um tenant (ou pequeno conjunto) consome desproporcionalmente recursos vs P50 dos demais. DDIA Ch 6 chama isso de **hot spot**, e o anchor narrativo canônico é o "Justin Bieber tenant" — referência ao caso Twitter onde 3% dos servidores ficaram dedicados a 1 celebrity user (DDIA p.196 nota [13]). Em B2B SaaS, o equivalente é **1 cliente enterprise** (ou anchor tenant) que escala 10× mais rápido que o restante da base.

Trigger phrases:

- "tenant Justin Bieber", "hot tenant", "skewed multi-tenant"
- "1 cliente consumindo a base inteira", "tenant dominante", "anchor tenant"
- "particionamento por tenant", "PARTITION BY HASH/RANGE org_id"
- "scatter-gather Postgres super-admin"
- "rebalancear tenant sem downtime", "mover tenant para schema dedicado"
- "MV per-tenant pesada", "queue priority por tenant"

Esta skill é consumida por `multi-tenant-isolation-auditor` (v1.21) ao detectar tabelas suspeitas de skew, por `omm-auditor` (v1.10) ao avaliar capacidade de escala, e por `b2b-saas-architect` (v1.21) ao desenhar schema de novo cliente enterprise grande.

## Regras absolutas

**REGRA #1 (medir antes de mitigar):** **NUNCA** aplicar mitigação sem coletar baseline 30d das 3 métricas canônicas (REQ TENANT-01). Mitigação prematura = otimização cega. Threshold canônico: WARN >3× P50, CRITICAL >10× P50.

**REGRA #2 (default document-partitioned):** Índices secundários em tabelas particionadas devem ser **document-partitioned (local)** por default. Term-partitioned (global) **só** em query path crítica onde scatter-gather é o gargalo medido.

**REGRA #3 (hash quando uniforme, range quando skewed conhecido):** Particionar por `HASH (org_id)` quando workload é uniforme cross-tenant. Particionar por `RANGE (org_id)` apenas quando hot tenants são **conhecidos a priori** (anchor tenant enterprise onboarded com SLA dedicado).

**REGRA #4 (rebalanceamento manual, nunca automático):** Mover tenant para schema/instância dedicada **NUNCA** automaticamente. Sempre humano-no-loop com janela de manutenção comunicada — DDIA p.204 ("Operations: automatic or manual rebalancing") documenta o risco de cascading failure quando rebalance auto reage a node lento.

**REGRA #5 (cleanup conservador):** Após mover tenant, **NUNCA** dropar schema/dados antigos antes de **7d sem queries** confirmados via `pg_stat_user_tables.last_seq_scan` + `last_idx_scan`. Defesa contra rollback emergencial.

## Patterns canônicos

### REQ TENANT-01 — Detecção do "tenant Justin Bieber"

Três métricas canônicas, todas com baseline 30d e threshold relativo ao P50 da base de tenants ativos:

#### Métrica 1 — Ratio queries/min via `pg_stat_statements`

```sql
-- Pré-requisito: pg_stat_statements habilitado (Supabase: Settings → Database → Extensions)
-- Helper: extrai org_id do parameter da query (assume RLS sempre filtra por org_id literal/parameter)
create or replace function private.extract_org_id_from_query(p_query text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  m text[];
begin
  -- Casa UUID em formato canônico no texto da query (parameter-bound)
  m := regexp_match(p_query, '''([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})''');
  if m is null then
    return null;
  end if;
  return m[1]::uuid;
end;
$$;

-- View canônica: queries/min por org_id sobre janela 24h
create or replace view private.hot_tenant_query_rate as
with per_org as (
  select
    private.extract_org_id_from_query(query) as org_id,
    sum(calls) / nullif(extract(epoch from (now() - stats_reset)) / 60, 0) as queries_per_min
  from pg_stat_statements
  where private.extract_org_id_from_query(query) is not null
  group by 1
),
stats as (
  select
    percentile_cont(0.5) within group (order by queries_per_min) as p50
  from per_org
)
select
  per_org.org_id,
  per_org.queries_per_min,
  stats.p50,
  round((per_org.queries_per_min / nullif(stats.p50, 0))::numeric, 2) as ratio_vs_p50,
  case
    when per_org.queries_per_min > 10 * stats.p50 then 'CRITICAL'
    when per_org.queries_per_min > 3  * stats.p50 then 'WARN'
    else 'OK'
  end as severity
from per_org cross join stats
order by ratio_vs_p50 desc nulls last;
```

#### Métrica 2 — Ratio storage GB via `pg_total_relation_size`

```sql
-- View: storage por tenant agregando tabelas particionadas + tabelas não-particionadas
-- Assume convenção de naming partição: <tabela_base>_<org_id_underscore>
create or replace view private.hot_tenant_storage as
with per_partition as (
  select
    -- Extrai org_id do nome da partição (audit_logs_<uuid_underscore> -> uuid)
    replace(
      regexp_replace(c.relname, '^[a-z_]+_([0-9a-f_]{36})$', '\1'),
      '_', '-'
    )::uuid as org_id,
    pg_total_relation_size(c.oid) as bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'                           -- tabelas regulares
    and c.relname ~ '_[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}$'
),
per_org as (
  select
    org_id,
    sum(bytes) / (1024.0^3) as storage_gb
  from per_partition
  group by 1
),
stats as (
  select percentile_cont(0.5) within group (order by storage_gb) as p50 from per_org
)
select
  per_org.org_id,
  round(per_org.storage_gb::numeric, 3) as storage_gb,
  round(stats.p50::numeric, 3) as p50_gb,
  round((per_org.storage_gb / nullif(stats.p50, 0))::numeric, 2) as ratio_vs_p50,
  case
    when per_org.storage_gb > 10 * stats.p50 then 'CRITICAL'
    when per_org.storage_gb > 3  * stats.p50 then 'WARN'
    else 'OK'
  end as severity
from per_org cross join stats
order by storage_gb desc;
```

#### Métrica 3 — Ratio conn slots via `pg_stat_activity`

```sql
-- Pré-requisito: app seta application_name com org context, ex: 'app:org=<uuid>:edge=lead-create'
-- Convenção canônica documentada em b2b-saas-architecture
create or replace view private.hot_tenant_conn_slots as
with per_org as (
  select
    -- Extrai uuid do application_name após 'org='
    (regexp_match(application_name, 'org=([0-9a-f-]{36})'))[1]::uuid as org_id,
    count(*) as active_slots
  from pg_stat_activity
  where state = 'active'
    and application_name ~ 'org=[0-9a-f-]{36}'
  group by 1
),
stats as (
  select percentile_cont(0.5) within group (order by active_slots) as p50 from per_org
)
select
  per_org.org_id,
  per_org.active_slots,
  stats.p50,
  round((per_org.active_slots::numeric / nullif(stats.p50, 0))::numeric, 2) as ratio_vs_p50,
  case
    when per_org.active_slots > 10 * stats.p50 then 'CRITICAL'
    when per_org.active_slots > 3  * stats.p50 then 'WARN'
    else 'OK'
  end as severity
from per_org cross join stats
order by ratio_vs_p50 desc nulls last;
```

**Hot tenant é confirmado quando ≥ 2 das 3 métricas estão em WARN+ simultaneamente** — uma só métrica sozinha pode ser falso positivo (batch job, importação, migração). Triangulação reduz noise.

### REQ TENANT-02 — 5 estratégias de mitigação (tabela canônica)

| # | Estratégia | Quando usar | Tradeoff principal | Config / SQL exemplo |
|---|---|---|---|---|
| 1 | **Rate limit por tenant** | Picos imprevisíveis de write/read em hot tenant que prejudicam P95 dos demais | Impacto UX no tenant target — usuário vê HTTP 429; precisa coordenar com customer success | RLS reject + `pg_cron` throttle counter (abaixo) |
| 2 | **Pool conexão isolado (Supavisor multi-pool)** | Conn starvation — hot tenant esgota slots na pool compartilhada | Custo Supavisor multi-pool (Pro+) + complexidade de routing | Supavisor config `[pools.org_<uuid>]` |
| 3 | **Read replica dedicada** | Tenant read-heavy (dashboards, exports) que não precisa de write strong consistency | Custo Supabase Pro+ + lag replicação aceitável (centenas ms) | Supavisor `read.*` routing + `application_name` hint |
| 4 | **Desnormalização (MV per-tenant)** | Query repetitiva pesada (agregações, joins 5+ tabelas) que rodam 100× / hora p/ mesmo tenant | Refresh complexity + staleness window aceitável (5-15min) | `CREATE MATERIALIZED VIEW ... REFRESH CONCURRENTLY` + `pg_cron` |
| 5 | **Request shaping (pgmq priority)** | Picos previsíveis batch (relatório fim-de-mês, importação) — work é assíncrono | Complexidade fila + worker; latency aumenta para hot tenant | `pgmq` priority queue + worker que drena LOW após HIGH |

#### Estratégia 1 — Rate limit por tenant (exemplo)

```sql
-- Tabela counter: bucket por org × minuto
create table private.tenant_rate_limit_buckets (
  org_id uuid not null,
  bucket_minute timestamptz not null,
  request_count int not null default 0,
  primary key (org_id, bucket_minute)
);

-- Função: incrementa counter e retorna se excedeu limite
create or replace function private.check_tenant_rate_limit(
  p_org_id uuid,
  p_limit_per_min int default 1000
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_bucket timestamptz;
begin
  v_bucket := date_trunc('minute', now());
  insert into private.tenant_rate_limit_buckets (org_id, bucket_minute, request_count)
    values (p_org_id, v_bucket, 1)
    on conflict (org_id, bucket_minute)
    do update set request_count = tenant_rate_limit_buckets.request_count + 1
    returning request_count into v_count;
  return v_count <= p_limit_per_min;
end;
$$;

-- Cleanup buckets > 1h (pg_cron)
select cron.schedule('cleanup-rate-limit-buckets', '*/15 * * * *', $$
  delete from private.tenant_rate_limit_buckets
  where bucket_minute < now() - interval '1 hour';
$$);
```

#### Estratégia 4 — MV per-tenant (exemplo agregação leads)

```sql
-- MV agregando métricas pesadas só para hot tenant
-- (Para os demais tenants, query original direto na tabela ainda é rápida)
create materialized view public.lead_metrics_org_<uuid_underscore> as
select
  l.stage,
  count(*) as count,
  count(*) filter (where l.created_at > now() - interval '7 days') as last_7d
from public.leads l
where l.org_id = '<uuid>'
group by l.stage;

create unique index lead_metrics_org_<uuid_underscore>_stage_idx
  on public.lead_metrics_org_<uuid_underscore> (stage);

-- Refresh concurrent a cada 10min
select cron.schedule(
  'refresh-lead-metrics-org-<uuid_underscore>',
  '*/10 * * * *',
  $$ refresh materialized view concurrently public.lead_metrics_org_<uuid_underscore>; $$
);
```

#### Estratégia 5 — Request shaping (pgmq priority)

```sql
-- 2 filas: high (pequenos clientes) + low (hot tenant batch)
select pgmq.create('exports_high');
select pgmq.create('exports_low');

-- Enqueue: hot tenant vai para low, demais para high
create or replace function public.enqueue_export(p_org_id uuid, p_payload jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_hot boolean;
begin
  -- Lookup hot tenant (refresh por job separado)
  select exists (select 1 from private.hot_tenant_registry where org_id = p_org_id and active)
    into v_is_hot;
  if v_is_hot then
    return (select msg_id from pgmq.send('exports_low', p_payload));
  else
    return (select msg_id from pgmq.send('exports_high', p_payload));
  end if;
end;
$$;

-- Worker: drena high primeiro, low só quando high vazio
-- (implementação Edge Function com Deno cron)
```

### REQ TENANT-03 — Particionamento range vs hash para `tenant_id`

#### Decision tree

```
Tabela > 50k rows/tenant OU > 5M rows total?
├── Não → SEM particionamento (overhead > benefit). Use partial indexes.
└── Sim → particionar
    ├── Workload uniforme cross-tenant (P95 ratio < 2× P50)?
    │   ├── Sim → HASH (org_id) com 16-64 partições fixas
    │   └── Não → continuar abaixo
    └── Hot tenants conhecidos a priori (anchor tenant onboarded com SLA)?
        ├── Sim → RANGE (org_id) com partição manual para cada hot
        └── Não → HASH (default seguro) + monitor com REQ TENANT-01
```

#### Hash partitioning — workload uniforme

```sql
-- Tabela particionada por HASH em 16 partições (typical sweet spot Postgres 16+)
create table public.events (
  id uuid not null,
  org_id uuid not null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  primary key (org_id, id)
) partition by hash (org_id);

-- Cria 16 partições — Postgres distribui via hash modulo 16
do $$
declare
  i int;
begin
  for i in 0..15 loop
    execute format(
      'create table public.events_p%s partition of public.events for values with (modulus 16, remainder %s)',
      lpad(i::text, 2, '0'), i
    );
  end loop;
end $$;

-- Index local em cada partição (document-partitioned — REQ TENANT-04)
create index events_org_created_idx on public.events (org_id, created_at desc);
```

**Por que 16 partições:** sweet spot empírico Postgres 16+ — partição management overhead negligível, paralelização de scans efetiva. Acima de 64 partições, planner começa a sofrer (citação DDIA p.202 — "each partition also has management overhead").

#### Range partitioning — anchor tenant conhecido

```sql
-- Tabela particionada por RANGE — partição dedicada para anchor tenant + default p/ os demais
create table public.audit_logs (
  id uuid not null,
  org_id uuid not null,
  event_type text not null,
  actor_id uuid,
  payload jsonb,
  created_at timestamptz not null default now(),
  primary key (org_id, id)
) partition by range (org_id);

-- Partição dedicada para anchor tenant (uuid conhecido)
create table public.audit_logs_anchor_acme
  partition of public.audit_logs
  for values from ('11111111-1111-1111-1111-111111111111')
                to ('11111111-1111-1111-1111-111111111112');

-- Partição default para todos os demais — rebalancear manualmente quando outro tenant virar hot
create table public.audit_logs_default
  partition of public.audit_logs
  default;

-- Índice local em cada partição
create index audit_logs_anchor_acme_created_idx on public.audit_logs_anchor_acme (created_at desc);
create index audit_logs_default_org_created_idx on public.audit_logs_default (org_id, created_at desc);
```

**Vantagem range para anchor:** isola I/O do anchor tenant. Bloat/vacuum/analyze de outras orgs não bloqueia o anchor. Permite tablespace dedicado em disco SSD separado.

**Risco range:** se outro tenant escalar inesperadamente, partição default fica skewed. Mitigação: REQ TENANT-01 monitor + script de migração para nova partição range.

### REQ TENANT-04 — Índices secundários document-partitioned vs term-partitioned

DDIA p.197-200 distingue duas estratégias para índices secundários em tabelas particionadas. Aplicado a queries cross-tenant em views super-admin (caso canônico em B2B SaaS):

| Aspecto | Document-partitioned (local) | Term-partitioned (global) |
|---|---|---|
| **Topologia** | 1 índice por partição (default Postgres) | 1 índice global cobrindo todas as partições (não-default Postgres — exige extensão pg_partman ou abordagem manual) |
| **Write cost** | Barato — 1 partição afetada | Caro — N partições do índice afetadas + lock cross-partição |
| **Read cost (single tenant)** | O(log n) na partição alvo | O(log n) no índice global |
| **Read cost (cross-tenant super-admin)** | **scatter-gather** — todas as partições consultadas em paralelo | O(log n) — 1 lookup direto |
| **Aplicação canônica** | RLS queries normais (filter por `org_id` → 1 partição) | Super-admin views que listam todas orgs por critério (ex: "todas as leads created_at > X") |

#### Recomendação default: document-partitioned

```sql
-- Index local em cada partição da tabela events (REQ TENANT-03)
-- Postgres cria automaticamente em cada partição quando criado na tabela parent
create index events_event_type_idx on public.events (event_type);

-- Verificar que cada partição tem o index
select
  pi.indrelid::regclass as partition_name,
  pi.indexrelid::regclass as index_name
from pg_inherits inh
join pg_index pi on pi.indrelid = inh.inhrelid
where inh.inhparent = 'public.events'::regclass;
```

**Query super-admin sobre `event_type` faz scatter-gather** — Postgres pruner não consegue eliminar partições (filter não inclui `org_id`). Custo: tail latency amplification (DDIA p.198) — query é tão lenta quanto a partição mais lenta. Aceitável para super-admin (queries raras, async, não user-facing).

#### Term-partitioned (quando query path é crítico)

Postgres não suporta nativamente índice global em tabela particionada. Opções:

1. **Tabela auxiliar de lookup** — manualmente mantida via trigger:

```sql
-- Lookup table cross-tenant: term → (org_id, event_id)
-- Mantida via trigger nas partições filhas
create table private.events_event_type_global_idx (
  event_type text not null,
  org_id uuid not null,
  event_id uuid not null,
  created_at timestamptz not null,
  primary key (event_type, created_at desc, org_id, event_id)
);

create or replace function private.events_sync_global_idx()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into private.events_event_type_global_idx
      (event_type, org_id, event_id, created_at)
      values (new.event_type, new.org_id, new.id, new.created_at);
  elsif (tg_op = 'DELETE') then
    delete from private.events_event_type_global_idx
      where event_type = old.event_type and event_id = old.id;
  end if;
  return null;
end;
$$;

-- Trigger replicado em cada partição (script bash gera a partir de pg_inherits)
-- Custo: 2× write (tabela + lookup) + lock cross-partição quando lookup é atualizado
```

2. **Aceitar staleness via job batch** — DDIA p.200 nota que DynamoDB GSI tem propagação assíncrona "within a fraction of a second". Mesmo trade-off vale aqui:

```sql
-- Refresh global index via pg_cron a cada 30s
select cron.schedule('refresh-events-global-idx', '*/30 * * * * *', $$
  insert into private.events_event_type_global_idx
    (event_type, org_id, event_id, created_at)
  select event_type, org_id, id, created_at
  from public.events
  where created_at > coalesce((select max(created_at) from private.events_event_type_global_idx), 'epoch')
  on conflict do nothing;
$$);
```

**Recomendação canônica:** começar com document-partitioned. Migrar para term-partitioned **somente** quando query path super-admin específica for medida em > 5s P95 e não-async-tolerant.

### REQ TENANT-05 — Rebalanceamento sem downtime (4 passos)

DDIA p.201-204 documenta que rebalancing tem 3 requisitos não-negociáveis: load fair pós-rebalance, sem downtime durante rebalance, mover só o necessário. Aplicado a Postgres + Supavisor:

#### Passo 1 — Detectar tenant alvo via thresholds (REQ TENANT-01)

Confirmado quando ≥ 2 das 3 métricas em CRITICAL por > 7 dias consecutivos. Decisão: humano (DBA + customer success) revisa antes de prosseguir. **NÃO automatizar.**

#### Passo 2 — Dump do tenant para schema isolado

```bash
# Pré-requisito: app está em modo read-only para o hot tenant durante 30min de janela de manutenção
# (controlado por feature flag — coordenado com customer success)

# Dump apenas tabelas do tenant (assumindo convenção partition naming)
pg_dump \
  --schema=public \
  --table='*tenant_<uuid_underscore>*' \
  --table='public.events_<uuid_underscore>' \
  --table='public.audit_logs_<uuid_underscore>' \
  --no-owner \
  --no-acl \
  --file=/tmp/tenant_<uuid>_dump.sql \
  postgresql://postgres:<password>@db.<source_project_ref>.supabase.co:5432/postgres

# Restaurar em nova instância Supabase dedicada (criada previamente)
psql \
  postgresql://postgres:<password>@db.<dedicated_project_ref>.supabase.co:5432/postgres \
  < /tmp/tenant_<uuid>_dump.sql

# Validar row count match
psql <source> -c "select count(*) from public.events where org_id = '<uuid>';"
psql <dedicated> -c "select count(*) from public.events;"
```

#### Passo 3 — Supavisor redirect via routing config

```toml
# supavisor.toml (ou config UI Supabase Dashboard)
# Routing rule: requests com header X-Org-Id=<uuid> vão para instância dedicada
[[routes]]
match.header = "X-Org-Id"
match.value = "<uuid>"
target = "dedicated_<uuid>"
priority = 100

[pools.dedicated_<uuid>]
host = "db.<dedicated_project_ref>.supabase.co"
port = 5432
database = "postgres"
mode = "transaction"
pool_size = 50

# Default route para os demais tenants (instância original)
[[routes]]
match.default = true
target = "shared"
priority = 1
```

```typescript
// App: setar header X-Org-Id em toda request
// Supabase JS client custom header (versão >= 2.x)
const supabase = createClient(url, anon_key, {
  global: {
    headers: { 'X-Org-Id': activeOrgId }
  }
})
```

**Após reload Supavisor (zero downtime — connections drain gracefully), tráfego do tenant alvo vai para instância dedicada. Demais tenants seguem na instância original.**

#### Passo 4 — Cleanup conservador (após 7d sem queries)

```sql
-- Verificar que nenhuma query tocou as partições antigas nos últimos 7d
select
  schemaname, relname,
  last_seq_scan,
  last_idx_scan,
  greatest(coalesce(last_seq_scan, 'epoch'::timestamptz),
           coalesce(last_idx_scan, 'epoch'::timestamptz)) as last_access
from pg_stat_user_tables
where relname like '%<uuid_underscore>%'
order by last_access;
-- Esperado: last_access < now() - interval '7 days' para todas

-- Apenas após confirmação manual humana, dropar
begin;
  drop table if exists public.events_<uuid_underscore> cascade;
  drop table if exists public.audit_logs_<uuid_underscore> cascade;
  -- ... outras tabelas particionadas do tenant
commit;
```

**Por que 7d:** janela de defesa contra rollback emergencial. Se a instância dedicada falhar por bug não detectado em customer testing, voltar tráfego para instância original em < 5min via reverter Supavisor config — só funciona se dados antigos ainda existem.

## Anti-patterns

### Anti-pattern 1: Mitigar antes de medir (sem baseline 30d)

**Errado:** "Cliente reclamou de lentidão — vamos criar MV per-tenant para ele agora."

**Por quê:** sem baseline 30d das 3 métricas (REQ TENANT-01), não dá pra distinguir hot tenant real de pico transitório (importação CSV grande, batch fim-de-mês). Mitigação prematura adiciona MV refresh overhead permanente para uma situação possivelmente pontual.

**Certo:** coletar 30d de baseline, identificar via REQ TENANT-01, confirmar com ≥ 2 das 3 métricas em WARN+ por > 7d. Só então aplicar mitigação.

### Anti-pattern 2: Particionar tabela com poucos rows

**Errado:**
```sql
-- 5 tenants, 200 rows/tenant
create table public.events (...) partition by hash (org_id);
```

**Por quê:** overhead de partition pruning + planner trabalho > benefit. Cada query passa por partition routing, dump/restore mais lento, manutenção complexa. Premature optimization clássica — DDIA p.202 nota que "each partition also has management overhead".

**Certo:** começar com tabela regular + index `(org_id, created_at desc)`. Particionar quando atingir threshold real (> 50k rows/tenant OU > 5M total).

### Anti-pattern 3: Term-partitioned como default

**Errado:** criar lookup table global (term-partitioned) já no MVP "para evitar scatter-gather no futuro".

**Por quê:** writes ficam 2× mais caros desde dia 1. Cross-partition lock complica. DDIA p.200 documenta que mesmo DynamoDB GSI (term-partitioned built-in) tem trade-off de propagation delay assíncrono. Você está pagando custo agora para benefício hipotético futuro.

**Certo:** document-partitioned como default. Migrar para term-partitioned **somente** quando query path super-admin medir > 5s P95 e for user-facing crítico.

### Anti-pattern 4: Rebalancing automático

**Errado:** script bash que detecta hot tenant via REQ TENANT-01 e automaticamente roda passos 2-3 do REQ TENANT-05.

**Por quê:** DDIA p.204 documenta cascading failure clássica — node lento detectado como dead → rebalance automático → carga extra no resto do cluster → mais nodes ficam lentos → mais rebalance → cascade. Em B2B SaaS, equivalente: importação CSV grande detectada como hot → rebalance triggered → aplicação volta-volta no meio de transação user-facing → erros 500 em produção.

**Certo:** detecção automática gera **alerta** (Slack/PagerDuty). Decisão de rebalance é humana (DBA + customer success), executada em janela de manutenção pré-comunicada.

### Anti-pattern 5: Cleanup imediato após move (sem 7d)

**Errado:**
```sql
-- Logo após Supavisor reroute (REQ TENANT-05 passo 3)
drop schema tenant_<uuid> cascade;
```

**Por quê:** se instância dedicada tiver bug não detectado (RLS quebrada, schema diverge, performance pior), você não consegue rollback. Customer fica fora do ar até nova restore from backup (RTO horas).

**Certo:** 7d de monitoring ativo (`pg_stat_user_tables.last_seq_scan`/`last_idx_scan` confirmados zero) antes do drop. Custo: 7d de storage duplicado (negligível vs custo de outage).

## Ver também

- [`../_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) — glossário compartilhado da Suíte DDIA Foundations v1.22 (define `hot spot`, `scatter-gather`, `consistent hashing`, `key range partitioning`, etc.)
- [`../multi-tenant-performance-scaling/SKILL.md`](../multi-tenant-performance-scaling/SKILL.md) — Supavisor pooling, partial indexes, helper functions STABLE (skill irmã v1.21 — base de scaling antes de mitigação de hot tenant)
- [`../supabase-postgres-style/SKILL.md`](../supabase-postgres-style/SKILL.md) — style guide SQL canônico (snake_case, schema-qualified, `private.*` para helpers)
- [`../multi-tenant-rls-hierarchy/SKILL.md`](../multi-tenant-rls-hierarchy/SKILL.md) — RLS hierarchical policies que coexistem com partições (RLS aplicada na tabela parent propaga para todas as partições)
- [`../super-admin-platform-pattern/SKILL.md`](../super-admin-platform-pattern/SKILL.md) — cross-tenant views super-admin (caso canônico para REQ TENANT-04 term-partitioned trade-off)
- DDIA Ch 6 (Designing Data-Intensive Applications, Martin Kleppmann) — Partitioning. Justin Bieber tenant: p.196 nota [13]. Hash vs range: p.194-196. Secondary indexes: p.197-200. Rebalancing: p.201-204.
- [Postgres Declarative Partitioning Docs](https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE)
- [Supavisor Multi-Pool Docs](https://supabase.com/docs/guides/database/connecting-to-postgres#supavisor)
