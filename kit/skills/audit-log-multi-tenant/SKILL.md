---
name: audit-log-multi-tenant
description: Use ao implementar audit log append-only — tabela com REVOKE DELETE/UPDATE, retention pg_cron por tiers, legal hold LGPD, sanitização de PII, taxonomia de eventos. Multi-tenant Supabase.
---

# Audit Log Multi-Tenant — Compliance + Forensics

## Quando usar

LLM carrega esta skill ao implementar audit log em B2B SaaS multi-tenant. Trigger phrases:

- "audit log multi-tenant", "audit trail compliance"
- "append-only table Postgres", "REVOKE DELETE UPDATE"
- "retention pg_cron tiers"
- "legal hold LGPD erasure"
- "PII sanitization audit"
- "event taxonomy canônica"

Esta skill é consumida pelo agent `audit-log-implementer` (Phase 109) que materializa migration + retention scheduler.

## Regras absolutas

**REGRA #1 (append-only):** Tabela `audit_logs` é **append-only** via `REVOKE DELETE, UPDATE ON public.audit_logs FROM authenticated`. Apenas service_role pode mutar (via partition swap, raramente). Comprometimento de admin não consegue apagar evidências.

**REGRA #2 (tenant_id obrigatório indexed first):** Toda row em `audit_logs` tem `tenant_id` (= `org_id`) **NOT NULL** + index composite `(tenant_id, created_at desc)` como **primeira** coluna. Sem isso, queries "todos eventos da org X" viram table scan.

**REGRA #3 (legal_hold flag):** Coluna `legal_hold boolean default false`. Quando user da org X faz DSR LGPD de erasure, marcar `legal_hold = true` em todas suas rows pendentes — bloqueia delete pelo retention scheduler até DSR processada.

**REGRA #4 (PII sanitization):** `actor_email` e `target_email` armazenados como **SHA-256 hash** (não raw). Para investigação, forensic mode rehasha email candidato e busca match. PII em log = LGPD violation.

**REGRA #5 (retention 3 tiers):** Default retention via pg_cron:
- **Free tier**: 30 dias
- **Pro tier**: 90 dias
- **Enterprise tier**: 365 dias
- **Sempre respeitando legal_hold = true** (skip rows com legal hold)

**REGRA #6 (event taxonomy mínima — 7 events):** `login`, `member_invited`, `role_changed`, `data_exported`, `member_removed`, `settings_changed`, `super_admin_action`. Custom events permitidos via campo `event_type text` mas estes 7 são obrigatórios em qualquer app B2B.

## Patterns canônicos

### Tabela `audit_logs` — DDL completo

```sql
-- Tabela append-only, particionada por tenant_id (LIST partitioning) se >50k rows/tenant
create table public.audit_logs (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type ~ '^[a-z_]+$'),
  actor_id uuid references auth.users(id) on delete set null,  -- NULL após erasure
  actor_email_hash text,                                        -- SHA-256, REGRA #4
  target_id uuid,                                               -- ID do recurso afetado (lead, member, etc.)
  target_type text,                                             -- 'lead', 'member', 'org', etc.
  target_email_hash text,                                       -- SHA-256 do email se aplicável
  payload jsonb,                                                -- detalhes do evento (campos changed, etc.)
  ip_address inet,                                              -- IP de origem (opcional)
  user_agent text,                                              -- UA (opcional)
  legal_hold boolean not null default false,                    -- REGRA #3
  created_at timestamptz not null default now(),
  primary key (id, tenant_id),                                  -- composite para particionamento
  -- REGRA #2: index composite tenant_id first
  constraint event_type_canonical check (
    event_type in (
      'login', 'member_invited', 'role_changed', 'data_exported',
      'member_removed', 'settings_changed', 'super_admin_action'
    ) or event_type ~ '^custom_[a-z_]+$'  -- custom events com prefix
  )
);

-- Index composite tenant_id first (REGRA #2)
create index audit_logs_tenant_created_idx
  on public.audit_logs (tenant_id, created_at desc);

-- Index para busca por actor (compliance investigation)
create index audit_logs_actor_id_idx
  on public.audit_logs (actor_id, created_at desc) where actor_id is not null;

-- Index para legal hold (rotina retention precisa filtrar)
create index audit_logs_legal_hold_idx
  on public.audit_logs (legal_hold, created_at) where legal_hold = false;

-- REGRA #1: append-only — REVOKE DELETE e UPDATE
alter table public.audit_logs enable row level security;

revoke delete on public.audit_logs from authenticated, anon;
revoke update on public.audit_logs from authenticated, anon;
-- service_role bypassa RLS — partition swap futuro é o único delete legítimo

-- POLICY SELECT: members da org com permission view:audit_logs
create policy "audit_logs_select_with_permission"
  on public.audit_logs
  for select
  to authenticated
  using (
    private.has_permission('view', 'audit_logs', tenant_id)
  );

-- POLICY INSERT: qualquer authenticated pode inserir (helper function escreve via SECURITY DEFINER)
create policy "audit_logs_insert_authenticated"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    tenant_id is not null
    and event_type is not null
  );

-- POLICY super_admin bypass (PERMISSIVE)
create policy "audit_logs_super_admin_bypass"
  on public.audit_logs
  as permissive
  for select
  to authenticated
  using (private.is_super_admin());
```

### Helper function — emit audit event

```sql
-- SECURITY DEFINER porque precisa hash email mesmo se user não tiver INSERT direto
create or replace function private.audit_log(
  p_event_type text,
  p_tenant_id uuid,
  p_target_id uuid default null,
  p_target_type text default null,
  p_target_email text default null,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
begin
  v_actor_id := (select auth.uid());
  select email into v_actor_email from auth.users where id = v_actor_id;

  insert into public.audit_logs (
    tenant_id,
    event_type,
    actor_id,
    actor_email_hash,
    target_id,
    target_type,
    target_email_hash,
    payload
  )
  values (
    p_tenant_id,
    p_event_type,
    v_actor_id,
    case when v_actor_email is not null then encode(digest(v_actor_email, 'sha256'), 'hex') end,
    p_target_id,
    p_target_type,
    case when p_target_email is not null then encode(digest(p_target_email, 'sha256'), 'hex') end,
    p_payload
  );
end;
$$;

-- Permitir authenticated chamar
grant execute on function private.audit_log(text, uuid, uuid, text, text, jsonb) to authenticated;
```

### Retention via pg_cron — 3 tiers

```sql
-- Schedule diário 03:00 UTC — apaga rows velhas respeitando legal_hold
select cron.schedule(
  'audit-log-retention',
  '0 3 * * *',
  $$
    -- Free tier orgs: 30 dias
    delete from public.audit_logs al
    using public.organizations o
    where al.tenant_id = o.id
      and o.plan = 'free'
      and al.created_at < now() - interval '30 days'
      and al.legal_hold = false;

    -- Pro tier orgs: 90 dias
    delete from public.audit_logs al
    using public.organizations o
    where al.tenant_id = o.id
      and o.plan = 'pro'
      and al.created_at < now() - interval '90 days'
      and al.legal_hold = false;

    -- Enterprise tier orgs: 365 dias
    delete from public.audit_logs al
    using public.organizations o
    where al.tenant_id = o.id
      and o.plan = 'enterprise'
      and al.created_at < now() - interval '365 days'
      and al.legal_hold = false;
  $$
);
```

**Nota:** o DELETE acima é executado pelo pg_cron com role `postgres` (bypassa RLS). NÃO é `authenticated` — REGRA #1 não é violada.

### Emit eventos canônicos — exemplos

```sql
-- Login (após auth callback)
select private.audit_log(
  p_event_type := 'login',
  p_tenant_id := <org_id>,
  p_payload := jsonb_build_object('ip', '<ip>', 'user_agent', '<ua>')
);

-- Member invited
select private.audit_log(
  p_event_type := 'member_invited',
  p_tenant_id := <org_id>,
  p_target_id := <invited_user_id>,
  p_target_email := <invited_email>,
  p_payload := jsonb_build_object('role', 'admin', 'invited_by', '<actor_email_hash>')
);

-- Role changed
select private.audit_log(
  p_event_type := 'role_changed',
  p_tenant_id := <org_id>,
  p_target_id := <member_user_id>,
  p_payload := jsonb_build_object('from_role', 'member', 'to_role', 'admin')
);

-- super_admin action (chamado pelo trigger gerado por multi-tenant-rls-writer)
select private.audit_log(
  p_event_type := 'super_admin_action',
  p_tenant_id := <target_org_id>,
  p_payload := jsonb_build_object('table', 'leads', 'op', 'DELETE', 'reason', 'cleanup')
);
```

### Query forensics — investigar incident

```sql
-- "Quem deletou todos os leads da org X em 2026-04-15?"
select
  al.created_at,
  al.event_type,
  al.actor_email_hash,  -- hash, mas pode rehasher candidates
  al.payload
from public.audit_logs al
where al.tenant_id = '<org_id>'
  and al.created_at::date = '2026-04-15'
  and al.event_type in ('super_admin_action', 'data_exported')
  and al.payload->>'table' = 'leads'
order by al.created_at;

-- Match actor por email (forensics) — calcular hash do email candidato
select * from public.audit_logs
where actor_email_hash = encode(digest('admin@acme.com', 'sha256'), 'hex')
  and tenant_id = '<org_id>'
order by created_at desc
limit 100;
```

## Anti-patterns

### Anti-pattern 1: Tabela audit_logs sem REVOKE

**Errado:**
```sql
create table public.audit_logs (...);
alter table public.audit_logs enable row level security;
-- Sem REVOKE — admin pode delete via UPDATE policy
```

**Por quê:** atacante ou admin compromised pode `DELETE FROM audit_logs WHERE event_type = 'super_admin_action'` e apagar evidências de acesso indevido.

**Certo:** `REVOKE DELETE, UPDATE ON public.audit_logs FROM authenticated, anon;`

### Anti-pattern 2: actor_email/target_email em raw

**Errado:**
```sql
create table public.audit_logs (
  ...
  actor_email text,    -- raw email
  target_email text    -- raw email
);
```

**Por quê:** PII em audit log = LGPD violation. DSR de erasure de user X torna-se complexo (precisa anonimizar todas as rows com email do user).

**Certo:** SHA-256 hash. Para forensics, rehasher email candidato e buscar match.

### Anti-pattern 3: Retention sem respeitar legal_hold

**Errado:**
```sql
delete from public.audit_logs where created_at < now() - interval '30 days';
-- Sem filter legal_hold
```

**Por quê:** apaga evidências necessárias para responder DSR LGPD em curso. Legal violation.

**Certo:** `... and legal_hold = false`. Quando DSR processada, marcar `legal_hold = false` permite next retention run.

### Anti-pattern 4: tenant_id ausente ou nullable

**Errado:**
```sql
tenant_id uuid -- nullable
```

**Por quê:** queries "todos eventos da org X" precisam filtrar por tenant_id. NULL quebra filter (`tenant_id = $1` exclui NULLs). Index composite (tenant_id, created_at) menos eficaz com NULLs.

**Certo:** `tenant_id uuid not null references public.organizations(id) on delete cascade`. NOT NULL + FK garante consistência.

### Anti-pattern 5: Single audit_logs sem partitioning para org grande

**Errado:**
```sql
-- Org enterprise com 10M events/ano em tabela única
```

**Por quê:** vacuum lento, queries lentas, retention DELETE bloqueia outras escritas.

**Certo:** LIST partitioning por `tenant_id` (ver [`multi-tenant-performance-scaling`](../multi-tenant-performance-scaling/SKILL.md)). Cada org = partição própria. Retention vira `DROP TABLE <partition>` (instantâneo).

## Semântica Event Sourcing + Log Compaction (v1.22+)

> A tabela `audit_log` append-only mapeia diretamente para padrão **event sourcing** (DDIA Ch 11) — eventos são source-of-truth, projeções (denormalizações via trigger ou MVs) derivam estado atual. Padrão completo em [`streams-eventos-cdc`](../streams-eventos-cdc/SKILL.md) (v1.22).

**Log compaction:** após retention TTL (30d/90d/365d), considerar snapshot periódico do estado dos aggregates antes de purgar — permite replay parcial sem perder histórico de longo prazo importante (legal hold).

## Ver também

- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — pg_cron pattern usado para retention scheduler (cross-suite)
- [multi-tenant-performance-scaling](../multi-tenant-performance-scaling/SKILL.md) — partitioning por org_id (REGRA #5)
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — `private.is_super_admin` + super_admin trigger pattern
- [lgpd-multi-tenant-compliance](../lgpd-multi-tenant-compliance/SKILL.md) — Phase 114, integração com legal_hold
- [super-admin-platform-pattern](../super-admin-platform-pattern/SKILL.md) — Phase 111, `super_admin_action` event obrigatório
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — termos `audit log`, `event taxonomy`, `legal hold`, `PII sanitization`
