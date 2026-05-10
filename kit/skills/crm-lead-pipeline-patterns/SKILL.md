---
name: crm-lead-pipeline-patterns
description: Use ao implementar CRM lead pipeline em B2B SaaS Supabase — 6 stages canônicos lead→qualified→proposal→negotiation→won|lost, trigger PG BEFORE UPDATE valida transições (CHECK constraint não basta), ownership transfer com notification+audit, lead dedup via unique(org_id, phone)+(org_id, email), integração WhatsApp lookup contact_phone.
---

# CRM Lead Pipeline — Patterns Canônicos

## Quando usar

LLM carrega esta skill ao implementar CRM lead pipeline em B2B multi-tenant. Trigger phrases:

- "CRM lead pipeline", "sales pipeline stages"
- "lead state machine Postgres", "transition validation"
- "ownership transfer lead", "lead assignment"
- "lead dedup phone email"
- "integração WhatsApp CRM lead"

## Regras absolutas

**REGRA #1 (6 stages canônicos):** Pipeline tem 6 stages: `lead → qualified → proposal → negotiation → won | lost`. Custom stages permitidos via prefix `custom_*` mas estes 6 são obrigatórios.

**REGRA #2 (trigger PG > CHECK constraint):** Validar transições via **trigger BEFORE UPDATE** com `RAISE EXCEPTION`, não apenas CHECK constraint. CHECK valida valor, mas não valida **transição** (lead → won direto = bug, deve passar por qualified+proposal+negotiation).

**REGRA #3 (ownership transfer com audit):** Mudança em `leads.owner_id` SEMPRE dispara: (a) notificação ao novo owner, (b) entry em audit_logs com `previous_owner_id, new_owner_id, reason`. Trigger AFTER UPDATE.

**REGRA #4 (dedup unique constraints):** `unique(org_id, contact_phone)` + `unique(org_id, contact_email)` em `leads`. Insert duplicado falha — app code precisa fazer lookup ANTES.

**REGRA #5 (lookup ANTES de criar via WhatsApp):** Webhook handler WhatsApp inbound: `SELECT id FROM leads WHERE org_id=$1 AND contact_phone=$2`. Se existe, append message à conversa do lead. Se não existe, criar lead novo com `source='whatsapp_inbound'`.

## Patterns canônicos

### Tabela `leads`

```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  dept_id uuid references public.departments(id) on delete set null,

  -- Contato
  contact_name text not null,
  contact_email text,
  contact_phone text,
  contact_company text,

  -- Pipeline
  stage text not null default 'lead'
    check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')
           or stage like 'custom\_%'),
  source text,  -- 'whatsapp_inbound', 'website_form', 'manual', etc.

  -- Ownership
  owner_id uuid references auth.users(id) on delete set null,

  -- Dados financeiros
  expected_value numeric(12, 2),
  expected_close_date date,
  closed_at timestamptz,
  closed_reason text,

  -- Metadata
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- REGRA #4: dedup
  unique (org_id, contact_phone),
  unique (org_id, contact_email)
);

create index leads_org_stage_idx on public.leads (org_id, stage);
create index leads_org_owner_idx on public.leads (org_id, owner_id) where owner_id is not null;
create index leads_org_dept_idx on public.leads (org_id, dept_id) where dept_id is not null;

-- RLS: aplicar pattern multi-tenant-rls-hierarchy
alter table public.leads enable row level security;

create policy "leads_select_member" on public.leads
  for select to authenticated
  using (private.is_member_of(org_id));

create policy "leads_insert_with_permission" on public.leads
  for insert to authenticated
  with check (private.has_permission('create', 'leads', org_id));

create policy "leads_update_with_permission_or_owner" on public.leads
  for update to authenticated
  using (
    private.has_permission('update', 'leads', org_id)
    or owner_id = (select auth.uid())
  )
  with check (
    private.has_permission('update', 'leads', org_id)
    or owner_id = (select auth.uid())
  );

create policy "leads_delete_admin" on public.leads
  for delete to authenticated
  using (private.has_role(org_id, 'admin') or private.has_role(org_id, 'owner'));

create policy "leads_super_admin_bypass" on public.leads
  as permissive for all to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
```

### Trigger validação de transição (REGRA #2)

```sql
-- Tabela de transições permitidas (data-driven)
create table public.lead_stage_transitions (
  from_stage text not null,
  to_stage text not null,
  primary key (from_stage, to_stage)
);

-- Insert transições canônicas
insert into public.lead_stage_transitions (from_stage, to_stage) values
  ('lead', 'qualified'),
  ('lead', 'lost'),
  ('qualified', 'proposal'),
  ('qualified', 'lost'),
  ('proposal', 'negotiation'),
  ('proposal', 'lost'),
  ('negotiation', 'won'),
  ('negotiation', 'lost'),
  ('negotiation', 'proposal'),  -- back-step permitido
  ('won', 'closed'),
  ('lost', 'lead'),  -- reativar lost
  -- self-transition (no-op) sempre permitida
  ('lead', 'lead'), ('qualified', 'qualified'), ('proposal', 'proposal'),
  ('negotiation', 'negotiation'), ('won', 'won'), ('lost', 'lost')
on conflict do nothing;

-- Trigger BEFORE UPDATE valida transição
create or replace function private.validate_lead_stage_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.stage = old.stage then
    return new;  -- no-op
  end if;

  -- Custom stages: aceitar qualquer transição (admin responsibility)
  if new.stage like 'custom\_%' or old.stage like 'custom\_%' then
    return new;
  end if;

  -- Validar transição na tabela
  if not exists (
    select 1 from public.lead_stage_transitions
    where from_stage = old.stage and to_stage = new.stage
  ) then
    raise exception 'invalid_lead_transition: % → % not allowed', old.stage, new.stage;
  end if;

  -- Auto-popular closed_at em won/lost
  if new.stage in ('won', 'lost') and new.closed_at is null then
    new.closed_at := now();
  end if;

  return new;
end;
$$;

create trigger validate_lead_stage_transition_trigger
  before update of stage on public.leads
  for each row execute function private.validate_lead_stage_transition();
```

### Trigger ownership transfer (REGRA #3)

```sql
create or replace function private.audit_lead_ownership_change()
returns trigger
language plpgsql
security definer  -- precisa escrever em audit_logs mesmo sem permission do user
set search_path = ''
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    -- Audit log
    perform private.audit_log(
      'custom_lead_ownership_transfer',
      new.org_id,
      new.id, 'lead', null,
      jsonb_build_object(
        'previous_owner_id', old.owner_id,
        'new_owner_id', new.owner_id,
        'lead_stage', new.stage,
        'lead_value', new.expected_value
      )
    );

    -- TODO: notificar novo owner (delegar para Edge Function de notification)
    -- perform net.http_post('<edge_fn_url>', ...);
  end if;
  return new;
end;
$$;

create trigger audit_lead_ownership_change_trigger
  after update of owner_id on public.leads
  for each row execute function private.audit_lead_ownership_change();
```

### Lookup contact → lead (integração WhatsApp — REGRA #5)

```typescript
// supabase/functions/whatsapp-webhook/index.ts (cross-ref Phase 112)
import { createClient } from 'jsr:@supabase/supabase-js@2'

async function handleInboundWhatsApp(orgId: string, contactPhone: string, contactName: string, content: string) {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // REGRA #5: lookup ANTES de criar
  const { data: existingLead } = await admin
    .from('leads')
    .select('id, owner_id, stage')
    .eq('org_id', orgId)
    .eq('contact_phone', contactPhone)
    .maybeSingle()

  if (existingLead) {
    // Append message à conversa existente do lead (não criar novo)
    return existingLead
  }

  // Criar lead novo
  const { data: newLead } = await admin
    .from('leads')
    .insert({
      org_id: orgId,
      contact_phone: contactPhone,
      contact_name: contactName,
      source: 'whatsapp_inbound',
      stage: 'lead',
      metadata: { first_message: content, channel: 'whatsapp' }
    })
    .select()
    .single()

  return newLead
}
```

### Frontend kanban — drag&drop entre stages

```typescript
// LeadsKanban.tsx (sketch para Phase 115)
async function moveLead(leadId: string, toStage: string) {
  const { error } = await supabase
    .from('leads')
    .update({ stage: toStage })
    .eq('id', leadId)

  if (error?.message.includes('invalid_lead_transition')) {
    toast.error('Transição inválida — siga ordem do funil')
  }
}
```

## Anti-patterns

### Anti-pattern 1: Apenas CHECK constraint (sem trigger)

**Errado:**
```sql
stage text check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'))
-- Update lead diretamente lead → won (sem passar pelos intermediários)
```

**Por quê:** CHECK valida valor final, não transição. Lead pula etapas → métricas erradas (conversion rate por stage), forecasting quebrado.

**Certo:** REGRA #2 — trigger BEFORE UPDATE valida `lead_stage_transitions`.

### Anti-pattern 2: Ownership transfer sem notification

**Errado:**
```sql
update leads set owner_id = '<new_owner>' where id = '<lead>';
-- Owner antigo não sabe que perdeu lead, novo não sabe que ganhou
```

**Por quê:** transferência silenciosa = lead "esquecido", ninguém follow up, SLA perdido.

**Certo:** REGRA #3 — trigger AFTER UPDATE dispara notification (Slack, email, in-app) via Edge Function.

### Anti-pattern 3: Lead duplicate sem dedup

**Errado:**
```sql
-- Sem unique constraints
-- WhatsApp inbound + website form mesmo phone = 2 leads
```

**Por quê:** vendedor liga 2× mesmo contato, dashboard com count errado, embaraçoso para client.

**Certo:** REGRA #4 — `unique(org_id, contact_phone)` + lookup before insert (REGRA #5).

### Anti-pattern 4: Hard delete lead com pipeline activities órfãs

**Errado:**
```sql
delete from public.leads where id = '<lead_id>';
-- pipeline_activities (FK lead_id) ficam órfãs ou cascade deleta histórico
```

**Por quê:** atividades históricas perdidas = audit trail compromised + analytics afetada.

**Certo:** soft delete (`status = 'archived'`) ou FK CASCADE com cuidado + audit log antes.

## Prevenção de Lost Update em Stage Transition (v1.22+)

> A trigger `validate_lead_stage_transition` deve usar `SELECT ... FOR UPDATE` em rows lidas para prevenir lost update quando 2 reps tentam mover o mesmo lead simultaneamente. Padrão completo em [`postgres-isolamento-concorrencia`](../postgres-isolamento-concorrencia/SKILL.md) (v1.22 — DDIA Ch 7).

Exemplo aplicado:

```sql
CREATE OR REPLACE FUNCTION validate_lead_stage_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Lock row para prevenir lost update
  PERFORM 1 FROM leads WHERE id = NEW.id FOR UPDATE;
  -- ... validação ...
END;
$$ LANGUAGE plpgsql;
```

## Ver também

- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — schema base
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — RLS policies
- [evolution-go-whatsapp-integration](../evolution-go-whatsapp-integration/SKILL.md) — Phase 112, integração inbound
- [whatsapp-conversation-state-machine](../whatsapp-conversation-state-machine/SKILL.md) — Phase 112, conversa.action_taken → lead
- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — Phase 109, eventos `custom_lead_*`
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — `lead`, `stages canônicos`, `ownership transfer`, `lead dedup`
