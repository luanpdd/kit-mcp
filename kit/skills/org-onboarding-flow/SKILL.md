---
name: org-onboarding-flow
cost_tier: leve
description: Cria org + primeiro admin atomicamente (1 transacao SQL) em B2B SaaS Supabase. Setup wizard async, slug imutavel com redirect 301. Use ao implementar fluxo signup de novo tenant.
---

# Org Onboarding Flow — B2B SaaS Multi-Tenant

## Quando usar

LLM carrega esta skill ao implementar onboarding de novo tenant em B2B SaaS Supabase. Trigger phrases:

- "org onboarding", "criar organização", "primeiro admin"
- "setup wizard", "tenant signup", "first user becomes admin"
- "create org transaction", "organization creation atomic"
- "owner role assignment", "org slug strategy"

Esta skill é consumida pelo agent `org-onboarding-implementer` (Phase 107) que materializa migration + Edge Function.

## Regras absolutas

**REGRA #1 (atomicidade):** Criação de `organizations` row + insert em `organization_members` (com role 'owner') **DEVEM** estar na **mesma transação SQL**. Janela entre criar org e adicionar membership = race condition (request paralelo pode ver org sem owner = inconsistente).

**REGRA #2 (primeiro admin = creator):** Usuário que criou a org ganha `role = 'owner'` automaticamente. Sem invite, sem aprovação. Se org tem `owner_id` field, ele = `auth.uid()`.

**REGRA #3 (slug imutável após criação):** Mutação requer `organization_slug_history` entry + redirect 301 (ver skill [`b2b-saas-architecture`](../b2b-saas-architecture/SKILL.md) REGRA #3).

**REGRA #4 (setup wizard async):** Setup wizard (logo, branding, member invites iniciais) **NÃO bloqueia** signup. User pode usar org imediatamente após criação. Wizard é "complete in background" pattern.

**REGRA #5 (slug uniqueness):** Constraint UNIQUE em `organizations.slug` + check `slug ~ '^[a-z0-9-]+$'` + length 2-60. Reservar slugs sistêmicos (`api`, `admin`, `app`, `www`, `dashboard`, `support`, `help`).

## Patterns canônicos

### SQL — criação atômica (RPC function)

```sql
-- RPC chamada pelo frontend após signup
create or replace function public.create_organization(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security invoker  -- usa permissions do user autenticado
set search_path = ''
as $$
declare
  new_org_id uuid;
  owner_role_id uuid;
begin
  -- 1. validar slug não está reservado
  if p_slug = any (array['api', 'admin', 'app', 'www', 'dashboard', 'support', 'help', 'docs', 'blog', 'auth']) then
    raise exception 'slug % is reserved', p_slug;
  end if;

  -- 2. criar organization
  insert into public.organizations (name, slug, owner_id, plan, status)
  values (p_name, p_slug, (select auth.uid()), 'free', 'active')
  returning id into new_org_id;

  -- 3. criar role 'owner' built-in para esta org
  insert into public.roles (org_id, name, description, is_built_in)
  values (new_org_id, 'owner', 'Owner — full control of organization', true)
  returning id into owner_role_id;

  -- 4. criar role 'admin' built-in
  insert into public.roles (org_id, name, description, is_built_in)
  values (new_org_id, 'admin', 'Admin — manage members and settings', true);

  -- 5. criar role 'member' built-in
  insert into public.roles (org_id, name, description, is_built_in)
  values (new_org_id, 'member', 'Member — standard access', true);

  -- 6. criar membership do creator como owner
  insert into public.organization_members (org_id, user_id, role_id, status)
  values (new_org_id, (select auth.uid()), owner_role_id, 'active');

  return new_org_id;
end;
$$;

-- Permitir que authenticated chame esta RPC
grant execute on function public.create_organization(text, text) to authenticated;
```

**Uso no client (TypeScript + @supabase/ssr):**
```typescript
const { data: orgId, error } = await supabase
  .rpc('create_organization', { p_name: 'Acme Corp', p_slug: 'acme' })

if (error) throw error
// Redirect para /orgs/acme/dashboard
```

### Edge Function — setup wizard async

```typescript
// supabase/functions/org-setup-wizard/index.ts
// PT-BR: Edge Function para inicializar dados default da org após criação
// (categorias, templates, sample data, etc.) — NÃO bloqueia signup
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,  // anon — preserva RLS
    { global: { headers: { Authorization: auth } } }
  )

  const { org_id } = await req.json()

  // Validar que user é owner da org via RLS
  const { data: membership } = await supabase
    .from('organization_members')
    .select('id, roles(name)')
    .eq('org_id', org_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
    .single()

  if (!membership || (membership.roles as any).name !== 'owner') {
    return new Response('only owner can run setup wizard', { status: 403 })
  }

  // Inicializar dados default (categorias, etc.)
  await supabase.from('default_categories').insert([...])

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### State machine — signup → org → admin → ready

```
signup_completed
    ↓
RPC create_organization (atomic)
    ↓
org_created + first_admin_created  (mesma transação)
    ↓
[redirect /orgs/<slug>/dashboard]    ← user já pode usar
    ↓
[background: setup_wizard Edge Function]
    ↓
wizard_completed
```

User vê o dashboard imediatamente. Wizard roda em background fire-and-forget (`EdgeRuntime.waitUntil` ou client-side promise sem await).

### Slug history — suporte a redirect 301

```sql
-- Trigger registra mudança de slug (ver b2b-saas-architecture)
-- App side (Next.js middleware):

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function middleware(req: NextRequest) {
  const slug = req.nextUrl.pathname.split('/')[2] // /orgs/[slug]/...

  if (!slug) return NextResponse.next()

  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()

  if (org) return NextResponse.next() // slug atual existe

  // Procurar em slug_history (slug antigo)
  const { data: oldSlug } = await supabase
    .from('organization_slug_history')
    .select('new_slug')
    .eq('old_slug', slug)
    .order('changed_at', { ascending: false })
    .maybeSingle()

  if (oldSlug) {
    const newPath = req.nextUrl.pathname.replace(`/orgs/${slug}/`, `/orgs/${oldSlug.new_slug}/`)
    return NextResponse.redirect(new URL(newPath, req.url), 301)
  }

  return NextResponse.next() // 404 será servido pela page
}

export const config = {
  matcher: '/orgs/:slug/:path*'
}
```

## Anti-patterns

### Anti-pattern 1: Criar org sem owner (race window)

**Errado:**
```typescript
// 2 requests separados — janela de race
const { data: org } = await supabase.from('organizations').insert({ ... }).select().single()
await supabase.from('organization_members').insert({ org_id: org.id, user_id: ..., role_id: ... })
```

**Por quê:** entre os 2 requests, query paralela pode ler org sem owner (`select * from organizations` retorna a row, mas `organization_members` ainda não tem). Trigger ou outra Edge Function pode disparar e ver inconsistência.

**Certo:** RPC `create_organization` faz ambos em transação SQL única.

### Anti-pattern 2: Setup wizard bloqueia signup

**Errado:**
```typescript
// User espera 30s+ para wizard completar antes de ver dashboard
const { data: org } = await supabase.rpc('create_organization', { ... })
await supabase.functions.invoke('org-setup-wizard', { body: { org_id: org.id } }) // BLOCKING!
router.push(`/orgs/${slug}/dashboard`)
```

**Por quê:** UX terrível — first impression é "app é lento". Conversion cai (study Stripe: cada 1s atraso = 7% drop em signup completion).

**Certo:** dashboard renderiza imediatamente; wizard roda em background com indicador subtle ("preparando seu workspace..." que some quando termina).

### Anti-pattern 3: Slug pode mudar sem trail

**Errado:**
```sql
update organizations set slug = 'new-acme' where id = '...';
-- Sem entry em organization_slug_history
```

**Por quê:** ver Anti-pattern 2 em [`b2b-saas-architecture`](../b2b-saas-architecture/SKILL.md). Bookmarks/webhooks/OAuth callbacks quebram silenciosamente.

**Certo:** trigger `track_org_slug_change` automático + middleware redirect 301.

### Anti-pattern 4: Slugs sistêmicos não-reservados

**Errado:**
```sql
-- User cria org com slug = 'admin' → URL /orgs/admin/dashboard conflita com /admin/* da plataforma
```

**Por quê:** roteamento ambíguo, conflito com Vercel preview deployments (`*-vercel.app`), conflito com cookies/CORS.

**Certo:** allowlist em RPC `create_organization` ou check constraint na coluna `slug`.

## Ver também

- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — schema canônico de `organizations`, `organization_members`, `organization_slug_history`
- [member-invite-flow](../member-invite-flow/SKILL.md) — Phase 110, fluxo de invite após onboarding
- [super-admin-platform-pattern](../super-admin-platform-pattern/SKILL.md) — Phase 111, super-admin pode criar orgs em nome de outros (impersonation)
- [supabase-migration-writer](../../agents/supabase-migration-writer.md) — agent invocado por `org-onboarding-implementer` para escrever migration
- [supabase-edge-fn-writer](../../agents/supabase-edge-fn-writer.md) — agent invocado para escrever Edge Function setup wizard
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — middleware Next.js v16 que faz redirect 301 do slug history
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — termos `tenant`, `org_id`, `first admin`, `bulk invite`
