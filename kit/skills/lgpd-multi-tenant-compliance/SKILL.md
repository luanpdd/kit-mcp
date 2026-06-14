---
name: lgpd-multi-tenant-compliance
cost_tier: leve
description: Gera SQL LGPD multi-tenant (consent_records, DSR 9 direitos Art. 18, deadline 15 dias, erasure via anonymization, cron D-3). Use ao implementar compliance Lei 13.709/2018 per-tenant em Supabase.
---

# LGPD Multi-Tenant Compliance — Lei 13.709/2018

## Quando usar

LLM carrega esta skill ao implementar compliance LGPD em B2B SaaS Brasil. Trigger phrases:

- "LGPD compliance", "Lei 13.709"
- "DSR data subject request"
- "consent management granular"
- "erasure anonymization LGPD"
- "cross-border data transfer Brazil"
- "ANPD adequacy decision"

## Regras absolutas

**REGRA #1 (DSR SLA 15 dias — Art. 19):** Toda DSR (Data Subject Request) deve ser processada em **15 dias corridos** (Art. 19 LGPD). Tabela `data_subject_requests` com `deadline_at = created_at + 15 days`. Pg_cron D-3 alerta requests próximas do prazo.

**REGRA #2 (consent default opt-out — Art. 8 §5):** Consentimento LGPD deve ser **livre, informado, inequívoco**. Default opt-in é **ilegal** (Art. 8 §5). UI deve apresentar checkboxes desmarcados por default. Multa: até R$50M ou 2% faturamento.

**REGRA #3 (consent granular):** Consentimento separado por **finalidade** — analytics ≠ marketing ≠ third-party-share ≠ profiling. User pode aceitar uma e rejeitar outra. Consent bundling (uma checkbox para tudo) é vedado.

**REGRA #4 (erasure via anonymization):** Direito à eliminação (Art. 18 VI) implementado via **anonymization**: preservar UUID (chave opaca), apagar PII (`name → NULL`, `email → SHA-256 hash`, `phone → NULL`). Hard delete destrói audit trail necessário para outras compliance obrigations.

**REGRA #5 (cross-border config):** Para apps com clientes brasileiros, Vercel deploy region `gru1` (São Paulo) + Supabase project region `sa-east-1` mantêm dados em repouso no Brasil. Adequacy decision Brasil-UE estabelecida em janeiro/2026 permite EU regions sem SCCs adicionais.

**REGRA #6 (per-tenant — não global):** Cada org tem sua própria política de retention/consent. App é controlador de dados em alguns casos, operador em outros (Art. 5). Per-tenant implementação respeita esta diversidade.

## Patterns canônicos

### Tabela `consent_records`

```sql
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null
    check (purpose in (
      'analytics',           -- analytics próprio (PostHog, Mixpanel)
      'marketing_email',     -- envio email marketing
      'marketing_whatsapp',  -- envio WhatsApp marketing
      'third_party_share',   -- compartilhamento com parceiros
      'profiling',           -- perfilamento comportamental
      'cookies_optional'     -- cookies não-essenciais
    ) or purpose like 'custom\_%'),
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text not null default 'app_settings'
    check (source in ('app_settings', 'cookie_banner', 'signup_form', 'api')),
  ip_address inet,
  user_agent text,
  unique (org_id, user_id, purpose, granted_at)  -- histórico audited
);

create index consent_records_org_user_purpose_idx
  on public.consent_records (org_id, user_id, purpose, granted_at desc);

alter table public.consent_records enable row level security;

create policy "consent_records_select_own" on public.consent_records
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "consent_records_insert_own" on public.consent_records
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "consent_records_admin_view" on public.consent_records
  for select to authenticated
  using (private.has_permission('process', 'dsr_requests', org_id));
```

### Helper `current_consent`

```sql
create or replace function private.current_consent(p_org_id uuid, p_user_id uuid, p_purpose text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select granted from public.consent_records
     where org_id = p_org_id and user_id = p_user_id and purpose = p_purpose
     order by granted_at desc limit 1),
    false  -- REGRA #2: default opt-out se não houver registro
  );
$$;
```

### Tabela `data_subject_requests`

```sql
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_email text not null,
  request_type text not null
    check (request_type in (
      'confirmation',     -- Art. 18 I — confirmação da existência de tratamento
      'access',           -- Art. 18 II — acesso aos dados
      'correction',       -- Art. 18 III — correção
      'anonymization',    -- Art. 18 IV — anonimização/bloqueio/eliminação parcial
      'portability',      -- Art. 18 V — portabilidade
      'erasure',          -- Art. 18 VI — eliminação completa
      'sharing_info',     -- Art. 18 VII — informação sobre compartilhamento
      'consent_revoke',   -- Art. 18 IX — revogação consentimento
      'automated_review'  -- Art. 18 — revisão decisão automatizada
    )),
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected', 'expired')),
  deadline_at timestamptz not null default (now() + interval '15 days'),  -- REGRA #1 Art. 19
  completed_at timestamptz,
  rejected_reason text,
  result jsonb,                                                            -- payload de resposta (export, etc.)
  created_at timestamptz not null default now()
);

create index dsr_org_status_deadline_idx on public.data_subject_requests (org_id, status, deadline_at);

alter table public.data_subject_requests enable row level security;

-- Apenas users com permission process:dsr_requests
create policy "dsr_select_with_permission" on public.data_subject_requests
  for select to authenticated
  using (private.has_permission('process', 'dsr_requests', org_id));

-- Insert: qualquer authenticated pode criar request para si próprio
create policy "dsr_insert_self" on public.data_subject_requests
  for insert to authenticated
  with check (
    requester_user_id = (select auth.uid())
    or requester_email = (select email from auth.users where id = (select auth.uid()))
  );

create policy "dsr_super_admin" on public.data_subject_requests
  as permissive for all to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
```

### Cron alert D-3 (3 dias antes do prazo)

```sql
select cron.schedule(
  'dsr-deadline-alert-d3',
  '0 9 * * *',  -- diário 9:00 UTC
  $$
    -- Notificar admin (via Edge Function notification) sobre DSRs próximas do prazo
    insert into public.notifications (org_id, type, payload)
    select
      org_id,
      'dsr_deadline_warning',
      jsonb_build_object(
        'request_id', id,
        'days_remaining', extract(day from deadline_at - now()),
        'request_type', request_type
      )
    from public.data_subject_requests
    where status in ('pending', 'in_progress')
      and deadline_at < now() + interval '3 days'
      and deadline_at >= now()
      and id not in (
        select (payload->>'request_id')::uuid from public.notifications
        where type = 'dsr_deadline_warning'
          and created_at > now() - interval '24 hours'
      );
  $$
);
```

### Erasure via anonymization (REGRA #4)

```sql
-- RPC chamada quando admin processa DSR de erasure
create or replace function public.process_erasure_request(p_dsr_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dsr record;
  v_user_id uuid;
begin
  -- Validar permission
  select * into v_dsr from public.data_subject_requests where id = p_dsr_id;
  if v_dsr is null then raise exception 'dsr_not_found'; end if;
  if not private.has_permission('process', 'dsr_requests', v_dsr.org_id) then
    raise exception 'forbidden';
  end if;

  v_user_id := v_dsr.requester_user_id;
  if v_user_id is null then
    raise exception 'erasure_requires_user_id';
  end if;

  -- Anonymize across all tenant tables (preservar UUID)
  -- 1. organization_members
  update public.organization_members
  set status = 'left'
  where user_id = v_user_id and org_id = v_dsr.org_id;

  -- 2. leads (owner_id e contact data)
  update public.leads
  set
    owner_id = null,                                        -- preserva FK opcional
    contact_email = encode(digest(coalesce(contact_email, ''), 'sha256'), 'hex'),
    contact_phone = null,
    contact_name = '[anonymized]'
  where org_id = v_dsr.org_id
    and (owner_id = v_user_id);  -- leads owned por este user

  -- 3. audit_logs — preservar (REGRA #4: não destruir trail), apenas anonimizar
  update public.audit_logs
  set
    actor_id = null,
    actor_email_hash = '[anonymized]',
    payload = payload - 'actor_email' - 'ip_address'
  where actor_id = v_user_id and tenant_id = v_dsr.org_id;

  -- 4. (em audit_logs com legal_hold = true não anonimizar — preservar evidence)
  -- (já filtrado pelo update acima — apenas tocá-lo após legal hold ser liberado)

  -- 5. Marcar DSR como completed
  update public.data_subject_requests
  set status = 'completed', completed_at = now(), result = jsonb_build_object('anonymized', true)
  where id = p_dsr_id;

  -- 6. Audit
  perform private.audit_log(
    'data_exported',
    v_dsr.org_id,
    v_user_id, 'user', v_dsr.requester_email,
    jsonb_build_object('action', 'erasure_completed', 'dsr_id', p_dsr_id)
  );
end;
$$;

grant execute on function public.process_erasure_request(uuid) to authenticated;
```

### Cross-border config (REGRA #5)

```typescript
// next.config.js (Vercel)
module.exports = {
  // Edge Functions só rodam em São Paulo
  experimental: {
    serverActions: {
      allowedOrigins: ['*.vercel.app']
    }
  },
  // Force region para Edge runtime
  runtime: 'edge',
  regions: ['gru1']  // São Paulo
}

// Supabase project criado em sa-east-1 (São Paulo) — escolher na criação
```

## Anti-patterns

### Anti-pattern 1: Hard delete em erasure flow

**Errado:**
```sql
delete from auth.users where id = '<user>' cascade;
-- audit_logs cascade deletado, evidence destroyed
```

**Por quê:** destrói audit trail necessário para outras obrigações compliance (investigação fraudulenta, anti-money-laundering, registros fiscais 5 anos).

**Certo:** REGRA #4 — anonymization. UUID preservado, PII apagada.

### Anti-pattern 2: Consent default opt-in

**Errado:**
```html
<input type="checkbox" name="marketing" checked>  <!-- pre-marked -->
<label>Aceito receber emails de marketing</label>
```

**Por quê:** Art. 8 §5 LGPD: consentimento deve ser livre, informado, inequívoco. Pre-checked = bundle implícito = ilegal.

**Certo:** REGRA #2 — checkbox unchecked, user precisa clicar explicitamente.

### Anti-pattern 3: Consent bundling

**Errado:**
```html
<input type="checkbox" name="all_consents">
<label>Aceito termos, privacy policy, marketing, analytics e third-party share</label>
```

**Por quê:** REGRA #3 — consentimentos devem ser separados por finalidade. User não pode "aceitar tudo" via 1 checkbox.

**Certo:** N checkboxes individuais para cada `consent_records.purpose`.

### Anti-pattern 4: DSR sem deadline tracking

**Errado:**
```sql
-- Tabela sem deadline_at
-- Admin esquece request, prazo 15 dias passa, ANPD multa
```

**Por quê:** Art. 19 prazo legal — descumprimento = multa.

**Certo:** REGRA #1 — `deadline_at` automático + pg_cron alert D-3.

### Anti-pattern 5: PII em audit_logs raw

**Errado:**
```sql
insert into audit_logs (actor_email, payload) values ('user@email.com', '{"phone":"+5511999"}');
```

**Por quê:** quando user solicita erasure, audit_logs também precisa anonimizar. Mas hash = não há referência à PII original.

**Certo:** já desde início, hash actor_email + sanitize payload (cross-ref Phase 109 audit-log-multi-tenant REGRA #4).

## Ver também

- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — Phase 109, PII sanitization + legal_hold flag
- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — schema base
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — pg_cron pattern para alert D-3
- [super-admin-platform-pattern](../super-admin-platform-pattern/SKILL.md) — Phase 111, super_admin process DSR
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — `LGPD`, `DSR`, `9 direitos LGPD`, `anonymization`, `consent grain`, `adequacy decision`
- [LGPD — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — International Data Transfers](https://www.gov.br/anpd/)
