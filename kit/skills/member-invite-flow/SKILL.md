---
name: member-invite-flow
description: Use ao implementar invite de membros em B2B SaaS multi-tenant Supabase — token SHA-256 (raw enviado por email, hash no banco), TTL 7d single-use, state machine 5 estados, email-locked obrigatório…
---

# Member Invite Flow — B2B SaaS Multi-Tenant

## Quando usar

LLM carrega esta skill ao implementar invite de membros. Trigger phrases:

- "member invite", "convidar membro", "invite token"
- "invite state machine", "pending accepted expired"
- "email-locked invite", "invite acceptance flow"
- "bulk invite members"
- "transfer ownership invite"

## Regras absolutas

**REGRA #1 (token SHA-256, hash no banco):** Token é `crypto.randomBytes(32).toString('hex')` — 64 hex chars. **Hash SHA-256 armazenado no banco**, raw enviado por email. Se DB vazar, atacante não tem tokens válidos.

**REGRA #2 (single-use + TTL 7d):** Token expira em 7 dias OR primeiro accept (single-use). State machine impede uso múltiplo.

**REGRA #3 (email-locked):** Aceitar invite requer user **logado com email destino**. Link compartilhável sem email-lock = qualquer um aceita. Validação no Edge Function ou RPC.

**REGRA #4 (idempotência via FOR UPDATE):** RPC accept_invite usa `SELECT ... FOR UPDATE` para race protection. 2 requests simultâneos: primeiro processa, segundo retorna `already_accepted`.

**REGRA #5 (state machine 5 estados):** `pending → accepted | rejected | cancelled | expired`. Transições enforced via trigger ou check constraint.

**REGRA #6 (audit log obrigatório):** Cada criação/accept/reject/cancel/expire emite evento em `audit_logs` (Phase 109).

## Patterns canônicos

### Tabela `org_invites`

```sql
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invited_by_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null check (invited_email ~ '^.+@.+\..+$'),
  role_id uuid not null references public.roles(id) on delete restrict,
  token_hash text not null unique,              -- REGRA #1
  state text not null default 'pending'
    check (state in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),  -- REGRA #2
  accepted_by_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index org_invites_org_state_idx on public.org_invites (org_id, state);
create index org_invites_email_state_idx on public.org_invites (invited_email, state);
create unique index org_invites_pending_unique
  on public.org_invites (org_id, invited_email)
  where state = 'pending';  -- previne 2 invites pending pro mesmo email mesma org

alter table public.org_invites enable row level security;

-- RLS: members com permission members:invite veem invites da org
create policy "org_invites_select_member" on public.org_invites
  for select to authenticated
  using (private.has_permission('invite', 'members', org_id));

create policy "org_invites_insert_with_permission" on public.org_invites
  for insert to authenticated
  with check (private.has_permission('invite', 'members', org_id));

-- super_admin bypass
create policy "org_invites_super_admin" on public.org_invites
  as permissive for all to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
```

### RPC `create_invite` — gera token + hash + envia email

```sql
create or replace function public.create_invite(
  p_org_id uuid,
  p_email text,
  p_role_name text
)
returns text  -- retorna o token RAW (única vez! enviar por email)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role_id uuid;
  v_token text;
  v_token_hash text;
begin
  -- 1. Resolver role_id
  select id into v_role_id
  from public.roles
  where org_id = p_org_id and name = p_role_name;

  if v_role_id is null then
    raise exception 'role % not found in org', p_role_name;
  end if;

  -- 2. Gerar token raw (32 bytes = 64 hex chars)
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  -- 3. Insert (RLS check: caller tem permission members:invite)
  insert into public.org_invites (org_id, invited_by_id, invited_email, role_id, token_hash)
  values (p_org_id, (select auth.uid()), p_email, v_role_id, v_token_hash);

  -- 4. Audit log
  perform private.audit_log(
    'member_invited',
    p_org_id,
    null, 'member', p_email,
    jsonb_build_object('role', p_role_name)
  );

  -- 5. Retornar token RAW (chamador envia por email — único momento que existe)
  return v_token;
end;
$$;

grant execute on function public.create_invite(uuid, text, text) to authenticated;
```

### RPC `accept_invite` — idempotente via FOR UPDATE

```sql
create or replace function public.accept_invite(p_token text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token_hash text;
  v_invite record;
  v_user_email text;
begin
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- REGRA #4: FOR UPDATE para race protection
  select * into v_invite
  from public.org_invites
  where token_hash = v_token_hash
  for update;

  if v_invite is null then
    raise exception 'invite_not_found';
  end if;

  -- Idempotência: se já aceito por este user, retorna sucesso (não erro)
  if v_invite.state = 'accepted' then
    if v_invite.accepted_by_id = (select auth.uid()) then
      return jsonb_build_object('status', 'already_accepted', 'org_id', v_invite.org_id);
    else
      raise exception 'invite_already_used';
    end if;
  end if;

  -- Estado != pending → erro
  if v_invite.state != 'pending' then
    raise exception 'invite_state_invalid: %', v_invite.state;
  end if;

  -- Expirado?
  if v_invite.expires_at < now() then
    update public.org_invites set state = 'expired' where id = v_invite.id;
    raise exception 'invite_expired';
  end if;

  -- REGRA #3: email-locked — user logado deve match
  select email into v_user_email from auth.users where id = (select auth.uid());
  if lower(v_user_email) != lower(v_invite.invited_email) then
    raise exception 'invite_email_mismatch';
  end if;

  -- Aceitar: criar membership + atualizar invite
  insert into public.organization_members (org_id, user_id, role_id, status)
  values (v_invite.org_id, (select auth.uid()), v_invite.role_id, 'active')
  on conflict (org_id, user_id) do update
  set role_id = excluded.role_id, status = 'active';

  update public.org_invites
  set state = 'accepted',
      accepted_by_id = (select auth.uid()),
      accepted_at = now()
  where id = v_invite.id;

  -- Audit
  perform private.audit_log(
    'member_invited',  -- mesmo evento, payload distingue
    v_invite.org_id,
    (select auth.uid()), 'member', v_user_email,
    jsonb_build_object('action', 'accepted', 'invite_id', v_invite.id)
  );

  return jsonb_build_object('status', 'accepted', 'org_id', v_invite.org_id);
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;
```

### Bulk invite — N invites em batch

```typescript
// Frontend
async function bulkInvite(orgId: string, invites: { email: string; role: string }[]) {
  const results = await Promise.allSettled(
    invites.map(i =>
      supabase.rpc('create_invite', {
        p_org_id: orgId,
        p_email: i.email,
        p_role_name: i.role
      })
    )
  )

  return results.map((r, i) => ({
    email: invites[i].email,
    status: r.status === 'fulfilled' ? 'invited' : 'error',
    error: r.status === 'rejected' ? r.reason.message : null,
    token: r.status === 'fulfilled' ? r.value.data : null
  }))

  // Frontend envia email para cada invite com token retornado
}
```

### Cron expiração — pg_cron diário

```sql
select cron.schedule(
  'expire-pending-invites',
  '0 1 * * *',
  $$
    update public.org_invites
    set state = 'expired'
    where state = 'pending' and expires_at < now();
  $$
);
```

## Anti-patterns

### Anti-pattern 1: Token raw armazenado no banco

**Errado:**
```sql
insert into public.org_invites (token, ...) values (v_token, ...);  -- raw!
```

**Por quê:** vazamento de DB = todos tokens válidos. Atacante aceita invites pendentes para ganhar acesso.

**Certo:** hash SHA-256 (REGRA #1). Raw enviado uma vez por email.

### Anti-pattern 2: Link compartilhável sem email-lock

**Errado:**
```typescript
// URL: https://app.com/invite/<token>
// Quem clicar primeiro aceita (sem checar email)
```

**Por quê:** se Alice encaminha email para Bob (acidentalmente ou maliciosamente), Bob aceita. Bob nunca foi convidado.

**Certo:** REGRA #3 — accept exige user autenticado com email = invited_email.

### Anti-pattern 3: Sem FOR UPDATE em accept (race)

**Errado:**
```sql
select state from public.org_invites where token_hash = $1;  -- sem lock
-- ... process ...
update public.org_invites set state = 'accepted' where id = $1;
```

**Por quê:** 2 requests simultâneos: ambos leem `state = 'pending'`, ambos processam, criam 2 memberships duplicadas.

**Certo:** REGRA #4 — FOR UPDATE bloqueia row, segundo request espera + relê estado atualizado.

### Anti-pattern 4: Bulk invite sem limit

**Errado:**
```typescript
// User cola 10000 emails de spam
await bulkInvite(orgId, hugeList)
```

**Por quê:** envio massivo de emails = listas de spam, IP do mailing service blacklisted, emails legítimos param de chegar.

**Certo:** rate limit no Edge Function (max 50 invites/hora por org) + check de domínio email (block free providers se necessário).

## Ver também

- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — schema `organization_members` + `roles`
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — `private.has_permission` usado em RLS
- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — events `member_invited` (Phase 109)
- [org-onboarding-flow](../org-onboarding-flow/SKILL.md) — fluxo signup que precede invites
- [rbac-permissions-matrix-supabase](../rbac-permissions-matrix-supabase/SKILL.md) — permission `invite:members`
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — termos `invitation token`, `invite state machine`, `email-locked`
