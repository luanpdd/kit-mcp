---
name: super-admin-platform-pattern
description: Use ao implementar plataforma super-admin em B2B SaaS multi-tenant — cross-tenant view sobre todas orgs, impersonation com TTL 30min + reason obrigatório + banner visual, super_admin:bool em app_metadata via service_role apenas, audit obrigatório (BLOCKER) em toda ação super-admin.
---

# Super-Admin Platform Pattern — B2B SaaS Multi-Tenant

## Quando usar

LLM carrega esta skill ao implementar painel de super-admin (você gerenciando todos tenants). Trigger phrases:

- "super admin platform", "platform admin"
- "cross-tenant view", "list all orgs"
- "impersonation user", "support takeover"
- "super_admin app_metadata"
- "GitHub Enterprise impersonation pattern"

## Regras absolutas

**REGRA #1 (audit obrigatório — BLOCKER):** Toda ação super-admin **DEVE** emitir evento `super_admin_action` em `audit_logs`. Sem audit log = ABORT no agent (REGRA do `super-admin-implementer`). Compliance LGPD exige rastreabilidade.

**REGRA #2 (impersonation TTL 30min):** Sessão de impersonation expira em **30 minutos** automaticamente. Após TTL, sessão revogada (`signOut` automático), super-admin precisa re-iniciar impersonation. Previne sessão zombie.

**REGRA #3 (reason obrigatório):** Impersonation requer campo `reason` text não-vazio (mín 10 chars). Registrado em audit_log para investigação posterior. Sem reason = recusar ação.

**REGRA #4 (banner visual obrigatório):** Quando super-admin está impersonando, UI mostra **banner persistente** (top da viewport) com texto "Você está vendo como <user.email> em <org.name>. Clique para sair." Cor de aviso (amarelo/vermelho), z-index máximo, não fechável.

**REGRA #5 (super_admin via service_role apenas):** `app_metadata.super_admin = true` é setado **EXCLUSIVAMENTE** via `auth.admin.updateUserById()` com `SUPABASE_SERVICE_ROLE_KEY`. Cliente NUNCA consegue mutar. Endpoint de promoção isolado em Edge Function `verify_jwt: false` ou backend admin separado.

**REGRA #6 (delete org requer dupla confirmação):** Deletar uma `organizations` (cascade dropping membros, leads, audit_logs) requer:
1. super-admin clica botão delete
2. Modal pede org.slug exato + reason text + checkbox "Entendo que isso é irreversível"
3. RPC `super_admin_delete_org(p_org_id, p_typed_slug, p_reason)` valida + executa + audit

## Patterns canônicos

### Cross-tenant view — RLS via PERMISSIVE

```sql
-- Policy permissive em organizations: super_admin vê todas
create policy "organizations_super_admin_view"
  on public.organizations
  as permissive
  for select
  to authenticated
  using (private.is_super_admin());

-- Policy normal (já deve existir): owner/admin vê apenas a própria
create policy "organizations_select_member"
  on public.organizations
  for select
  to authenticated
  using (private.is_member_of(id));

-- Mesma lógica para todas tabelas críticas: leads, organization_members, audit_logs, etc.
-- Padronizar via agent multi-tenant-rls-writer (Phase 108) com super_admin_bypass=true
```

### Frontend — listar todos tenants (super-admin only)

```typescript
// SuperAdminDashboard.tsx
import { createClient } from '@/lib/supabase/client'

export function SuperAdminDashboard() {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<Org[]>([])

  useEffect(() => {
    // RLS retorna TODAS orgs porque user é super_admin
    supabase.from('organizations')
      .select('id, name, slug, plan, status, created_at, organization_members(count)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrgs(data || []))
  }, [])

  return (
    <Table>
      {orgs.map(o => (
        <Row key={o.id}>
          <Cell>{o.name}</Cell>
          <Cell>{o.slug}</Cell>
          <Cell>{o.plan}</Cell>
          <Cell>{o.organization_members[0].count}</Cell>
          <Cell>
            <Button onClick={() => startImpersonation(o.id)}>Impersonate</Button>
          </Cell>
        </Row>
      ))}
    </Table>
  )
}
```

### Impersonation — Edge Function com TTL 30min

```typescript
// supabase/functions/super-admin-impersonate/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('unauthorized', { status: 401 })

  // Validar caller é super_admin via JWT app_metadata
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.super_admin) {
    return new Response('forbidden', { status: 403 })
  }

  const { target_user_id, target_org_id, reason } = await req.json()

  // REGRA #3: reason obrigatório (min 10 chars)
  if (!reason || reason.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'reason_required_min_10_chars' }), { status: 400 })
  }

  // Audit ANTES de criar sessão (se falhar audit, falha a ação)
  await supabase.rpc('audit_log', {
    p_event_type: 'super_admin_action',
    p_tenant_id: target_org_id,
    p_target_id: target_user_id,
    p_target_type: 'user',
    p_payload: {
      action: 'impersonation_started',
      reason,
      session_ttl_minutes: 30
    }
  })

  // Criar sessão impersonation via service_role
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service role
  )

  const { data: targetUser } = await admin.auth.admin.getUserById(target_user_id)
  if (!targetUser.user) return new Response('target_not_found', { status: 404 })

  // Gerar magic link com expiry curto (30min)
  const { data: magicLink } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.user.email!,
    options: {
      redirectTo: `${Deno.env.get('APP_URL')}/?impersonating=1&original_admin_id=${user.id}`
    }
  })

  // Cookie marker no client side (banner visual lê isso)
  return new Response(JSON.stringify({
    magic_link: magicLink.properties.action_link,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### Banner visual de impersonation (React)

```typescript
// app/components/ImpersonationBanner.tsx
'use client'

export function ImpersonationBanner() {
  const searchParams = useSearchParams()
  const isImpersonating = searchParams.get('impersonating') === '1'
  const adminId = searchParams.get('original_admin_id')

  if (!isImpersonating) return null

  const stopImpersonation = async () => {
    await supabase.auth.signOut()
    window.location.href = `/super-admin?stopped_impersonation=1&original_admin_id=${adminId}`
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-400 text-black px-4 py-2 flex items-center justify-between">
      <span>
        ⚠ Você está vendo como outro usuário (super-admin impersonation).
        Sessão expira em <Countdown to={expiresAt} />.
      </span>
      <Button variant="destructive" size="sm" onClick={stopImpersonation}>
        Parar impersonation
      </Button>
    </div>
  )
}
```

### Promover usuário a super_admin (backend admin script)

```typescript
// scripts/promote-super-admin.ts (NÃO Edge Function — script administrativo)
// Executado manualmente OU via CLI admin tool (NÃO frontend)
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // SECRET — NUNCA em frontend
)

await admin.auth.admin.updateUserById(userId, {
  app_metadata: { super_admin: true }
})
```

### RPC delete org com dupla confirmação

```sql
create or replace function public.super_admin_delete_org(
  p_org_id uuid,
  p_typed_slug text,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_slug text;
begin
  -- Validar caller é super_admin
  if not private.is_super_admin() then
    raise exception 'forbidden_super_admin_only';
  end if;

  -- Validar reason
  if length(trim(p_reason)) < 10 then
    raise exception 'reason_required_min_10_chars';
  end if;

  -- Validar typed_slug bate com slug real (REGRA #6 dupla confirmação)
  select slug into v_org_slug from public.organizations where id = p_org_id;
  if v_org_slug is null then raise exception 'org_not_found'; end if;
  if v_org_slug != p_typed_slug then
    raise exception 'slug_mismatch_confirmation_failed';
  end if;

  -- Audit ANTES (preserva histórico)
  perform private.audit_log(
    'super_admin_action',
    p_org_id,
    null, 'org', null,
    jsonb_build_object('action', 'delete_org', 'slug', v_org_slug, 'reason', p_reason)
  );

  -- Soft delete preferred (status = 'archived'), hard delete se realmente necessário
  update public.organizations set status = 'archived' where id = p_org_id;

  -- Hard delete (se exigido — descomenta abaixo)
  -- delete from public.organizations where id = p_org_id;
  -- (cascade dropa: organization_members, departments, leads, etc.; audit_logs preservado por design)
end;
$$;

grant execute on function public.super_admin_delete_org(uuid, text, text) to authenticated;
```

## Anti-patterns

### Anti-pattern 1: super_admin sem audit log (BLOCKER)

**Errado:**
```sql
-- super_admin policy permite tudo, sem trigger ou helper que registra
```

**Por quê:** ação super-admin sem rastro = você (operador da plataforma) não consegue investigar incident "quem deletou todos os leads da org X em 03/04?". Compliance LGPD violation.

**Certo:** REGRA #1 — toda RPC super-admin chama `private.audit_log` ANTES de operar. Trigger AFTER em tabelas críticas dispara automaticamente para super_admin (gerado pelo `multi-tenant-rls-writer` com `audit_super_admin=true`).

### Anti-pattern 2: Impersonation sem TTL

**Errado:**
```typescript
// Sessão impersonation persiste indefinidamente
await supabase.auth.signInWithPassword({ email: targetUser.email, password: '...' })
```

**Por quê:** super-admin esquece, sessão fica ativa por dias, usuário target cuja "como" foi assumida nem sabe. Ataque interno trivial.

**Certo:** REGRA #2 — magic link com expiry 30min, frontend countdown + auto-logout.

### Anti-pattern 3: super_admin via user_metadata

**Errado:**
```sql
-- Policy lê super_admin de user_metadata
using ((auth.jwt()->'user_metadata'->>'super_admin')::boolean = true)
```

**Por quê:** `user_metadata` é editável pelo client via `supabase.auth.updateUser({ data: { super_admin: true } })`. Privilege escalation imediato — qualquer usuário se torna super-admin.

**Certo:** REGRA #5 — `app_metadata.super_admin` (set apenas via service_role).

### Anti-pattern 4: Delete org sem confirmação dupla

**Errado:**
```typescript
<Button onClick={() => deleteOrg(orgId)}>Delete</Button>
```

**Por quê:** click acidental destrói org com 100k records. Cascade delete = irreversible.

**Certo:** REGRA #6 — modal exige typed slug + reason + checkbox + RPC valida tudo server-side. Soft delete preferred.

## Ver também

- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — Phase 109, audit_logs + event `super_admin_action` (REGRA #1)
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — `private.is_super_admin` + PERMISSIVE policy pattern
- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — JWT minimal `super_admin: bool` em app_metadata (REGRA #5)
- [supabase-edge-fn-writer](../../agents/supabase-edge-fn-writer.md) — agent invocado para Edge Function impersonation
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — termos `super_admin`, `impersonation`, `cross-tenant view`, `platform admin`
- [GitHub Enterprise — Impersonation](https://docs.github.com/en/enterprise-server@latest/admin/user-management/managing-users-in-your-enterprise/impersonating-a-user) — referência external pattern
