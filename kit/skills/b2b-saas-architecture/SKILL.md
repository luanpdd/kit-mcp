---
name: b2b-saas-architecture
cost_tier: leve
description: Define schema canônico multi-tenant (org→dept→role→permission) + JWT minimal + 5 anti-patterns RLS. Use ao desenhar app B2B SaaS com Supabase. Base para agents RLS, onboarding e RBAC.
---

# B2B SaaS Multi-Tenant — Arquitetura Canônica

## Quando usar

LLM carrega esta skill ao desenhar arquitetura de app B2B SaaS multi-tenant em Supabase. Trigger phrases:

- "B2B SaaS multi-tenant", "arquitetura multi-tenant", "isolation strategy"
- "single schema vs schema-per-tenant"
- "schema canônico organizations", "departments table", "members"
- "JWT claims multi-tenant", "app_metadata orgs"
- "slug org imutável", "tenant routing"

Esta skill define o **schema canônico** que `multi-tenant-rls-writer` (Phase 108), `org-onboarding-implementer` (Phase 107), `super-admin-implementer` (Phase 111), `audit-log-implementer` (Phase 109), e demais agents da suíte v1.21 consomem como entrada.

## Regras absolutas

**REGRA #1 (estratégia default):** **Single Schema + `org_id` + RLS** é o caminho canônico para 90% dos B2B SaaS. Schema-per-tenant é justificado apenas em compliance extremo (saúde/jurídico com auditoria isolacional). Database-per-tenant é inviável economicamente fora de contratos enterprise.

**REGRA #2 (JWT minimal):** **APENAS** `super_admin: bool` em `app_metadata`. Lista de orgs no JWT é anti-pattern — bloat linear no token + stale de 1h após mudança de role. O banco (helper functions PG) é fonte de verdade.

**REGRA #3 (slug imutável):** `organizations.slug` é **append-only** após criação. Mutação requer tabela `slug_history` + redirect 301 em rotas afetadas. Quebra silenciosa de bookmarks/webhooks/OAuth callbacks é o pior bug que cliente B2B encontra.

**REGRA #4 (super_admin via service_role):** `app_metadata.super_admin = true` é setado **APENAS** via `auth.admin.updateUserById()` (service role). Cliente NUNCA consegue mutá-lo (≠ `user_metadata` que é editável).

**REGRA #5 (FKs com CASCADE explícito):** Todas as FKs têm `ON DELETE` explícito (CASCADE para entidades dependentes da org, RESTRICT para evitar deleção acidental). Sem default — força decisão consciente.

## Patterns canônicos

### Estratégia de isolation — tabela comparativa

| Estratégia | Isolation | Custo ops | Compliance | Quando usar |
|---|---|---|---|---|
| **Single Schema + `org_id` + RLS** ⭐ | Lógico (RLS) | Baixo | Padrão B2B SaaS | **DEFAULT 90% dos casos** — Stripe, Linear, Vercel, Notion |
| Schema-per-tenant | Físico (PG schemas) | Médio (N migrations) | Compliance auditável | Saúde/jurídico/governo com requisito explícito de isolamento |
| Database-per-tenant | Físico (DB separadas) | Alto (N projects Supabase) | Compliance extremo | Apenas contratos enterprise com SLA de isolamento físico |

**Recomendação:** comece sempre com Single Schema. Migração para schema-per-tenant é viável (script de fan-out por org_id). Migração reversa não é.

### Schema canônico — 7 tabelas (DDL completo)

```sql
-- Ordem de criação respeita dependências FK

-- 1. organizations (root tenant)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null check (slug ~ '^[a-z0-9-]+$' and length(slug) between 2 and 60),
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. departments (sub-tenant opcional)
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.departments(id) on delete set null,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- 3. roles (org-scoped, custom roles permitidos)
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (name ~ '^[a-z_]+$'),
  description text,
  is_built_in boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

-- 4. permissions (catálogo global)
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action ~ '^[a-z_]+$'),
  resource text not null check (resource ~ '^[a-z_]+$'),
  description text,
  created_at timestamptz not null default now(),
  unique (action, resource)
);

-- 5. role_permissions (M:N — roles ganham permissions)
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- 6. organization_members (user ↔ org com role)
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended', 'left')),
  joined_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- 7. department_members (user ↔ dept com role override opcional)
create table public.department_members (
  id uuid primary key default gen_random_uuid(),
  dept_id uuid not null references public.departments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null, -- NULL herda do organization_members
  is_leader boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (dept_id, user_id)
);

-- Slug history (suporte a redirect 301 quando slug é mutado)
create table public.organization_slug_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  old_slug text not null,
  new_slug text not null,
  changed_at timestamptz not null default now(),
  unique (old_slug)
);
```

### JWT claims minimal — Custom Access Token Hook

```sql
-- Hook chamado pelo Supabase Auth a cada token emit
-- Injeta apenas super_admin no app_metadata
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  is_super boolean;
begin
  -- Buscar super_admin do app_metadata atual
  select coalesce((raw_app_meta_data->>'super_admin')::boolean, false)
  into is_super
  from auth.users
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata', '{}'::jsonb));
  claims := jsonb_set(claims, '{app_metadata,super_admin}', to_jsonb(is_super));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Registrar como hook em supabase/config.toml:
-- [auth.hook.custom_access_token]
-- enabled = true
-- uri = "pg-functions://postgres/public/custom_access_token_hook"
```

### Set super_admin via service_role apenas

```typescript
// Edge Function ou backend admin com service_role key
import { createClient } from 'jsr:@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service role — nunca expor ao client
)

// Promover usuário a super_admin
await admin.auth.admin.updateUserById(userId, {
  app_metadata: { super_admin: true }
})

// IMPORTANTE: usar updateUserById com app_metadata (não user_metadata)
```

### Slug com redirect trail

```sql
-- Trigger que registra mudança de slug em organization_slug_history
create or replace function public.track_org_slug_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.slug is distinct from new.slug then
    insert into public.organization_slug_history (org_id, old_slug, new_slug)
    values (new.id, old.slug, new.slug);
  end if;
  return new;
end;
$$;

create trigger track_org_slug_change_trigger
  after update of slug on public.organizations
  for each row execute function public.track_org_slug_change();
```

App side (Next.js middleware): se `slug` em URL não existe em `organizations`, consulta `organization_slug_history.old_slug` → 301 para `/orgs/{new_slug}/`.

## Anti-patterns

### Anti-pattern 1: Lista de orgs no JWT (claims bloat + stale)

**Errado:**
```sql
-- Hook injeta lista de orgs do user no JWT
-- claims.app_metadata.orgs = [{id, role}, {id, role}, ...]
```

**Por quê:**
- JWT tem limite ~4KB — usuário em 50 orgs estoura
- JWT cacheado por 1h — mudança de role demora até 1h pra propagar
- Cada Edge Function paga overhead de parsing de claims grandes

**Certo:** JWT só com `super_admin: bool`. Helper functions PG (`private.is_member_of`, `private.has_role`) consultam o banco — fonte de verdade sem stale.

### Anti-pattern 2: Slug mutável sem redirect trail

**Errado:**
```sql
update public.organizations set slug = 'new-name' where id = '...';
-- Sem entry em organization_slug_history
```

**Por quê:** bookmarks externos, webhooks Stripe/Slack, OAuth callbacks, Twitter cards, sitemaps — todos quebram silenciosamente. Cliente B2B descobre semanas depois quando recebe email "seu link parou de funcionar".

**Certo:** trigger `track_org_slug_change` automático + middleware redirect 301 em rotas com slug.

### Anti-pattern 3: Schema-per-tenant sem justificativa de compliance

**Errado:**
```sql
-- Pra cada nova org, criar schema próprio
create schema "org_acme";
create table org_acme.members (...);
-- ...repetir migration por org
```

**Por quê:** N migrations por nova org, provisioning lento, queries cross-tenant impossíveis sem UNION manual, monitoring complexo. Sem ganho real para SaaS comum (RLS bem feita já isola).

**Certo:** Single Schema + `org_id` + RLS. Schema-per-tenant só quando regulatório exige.

### Anti-pattern 4: `user_metadata` para super_admin

**Errado:**
```sql
-- Policy lê super_admin de user_metadata
using ((auth.jwt()->'user_metadata'->>'super_admin')::boolean = true)
```

**Por quê:** `user_metadata` é editável pelo cliente via `auth.updateUser({ data: { super_admin: true } })`. Privilege escalation imediato — qualquer usuário se torna super_admin. Documentado em [Supabase Splinter 0015](https://supabase.github.io/splinter/0015_rls_references_user_metadata/).

**Certo:** `app_metadata.super_admin` (set apenas via service_role).

### Anti-pattern 5: FKs sem CASCADE/RESTRICT explícito

**Errado:**
```sql
references public.organizations(id)  -- default ON DELETE NO ACTION
```

**Por quê:** decisão importante (deletar org com 100k rows? bloquear?) fica implícita. NO ACTION pode falhar deleção sem mensagem clara. Comportamento varia por engine.

**Certo:**
```sql
references public.organizations(id) on delete cascade   -- entidade dependente
references auth.users(id) on delete restrict            -- prevenir orfão
references public.roles(id) on delete set null          -- preservar histórico
```

## Ver também

- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — anti-patterns RLS herdados (`(select auth.uid())` wrapper, no `user_metadata` em authz)
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — padrões PG functions (security invoker, search_path = '')
- [supabase-postgres-style](../supabase-postgres-style/SKILL.md) — naming snake_case, lowercase reserved
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — 4 helper functions PG canônicas + policies hierárquicas (Phase 108)
- [multi-tenant-performance-scaling](../multi-tenant-performance-scaling/SKILL.md) — Supavisor pooling + partitioning por `org_id` + MVs per-tenant (skill irmã)
- [rbac-permissions-matrix-supabase](../rbac-permissions-matrix-supabase/SKILL.md) — modelagem permissions action × resource × scope (Phase 108)
- [_shared-supabase/glossary.md](../_shared-supabase/glossary.md) — termos canônicos `app_metadata`, `service_role`
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — termos novos `tenant`, `org_id`, `super_admin`, `RBAC`
- [Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — fonte external canônica
- [Custom Access Token Hook — Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
