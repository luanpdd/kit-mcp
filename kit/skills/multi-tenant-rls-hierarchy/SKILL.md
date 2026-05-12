---
name: multi-tenant-rls-hierarchy
description: Use ao escrever RLS hierárquica multi-tenant (org→dept→role→permission→super-admin bypass) em Supabase.
---

# Multi-Tenant RLS Hierarchy — Helper Functions + Policies

## Quando usar

LLM carrega esta skill ao escrever RLS para tabelas em app B2B multi-tenant com hierarquia firm→department→leader→collaborator. Trigger phrases:

- "RLS multi-tenant hierárquica", "RLS org dept role"
- "helper function private", "is_member_of", "has_role", "has_permission", "is_super_admin"
- "policy composta com super_admin bypass"
- "department member herda role"
- "PERMISSIVE policy super admin"

Esta skill **estende** [`supabase-rls-policies`](../supabase-rls-policies/SKILL.md) (v1.8) — herda anti-pitfalls básicos (`(select auth.uid())` wrapper, no `user_metadata`, granular policies, indexes) e adiciona hierarquia + super_admin bypass.

## Regras absolutas

**REGRA #1 (helper functions em schema `private`):** Funções PG de RLS **DEVEM** estar em schema `private` — NÃO em `public`. PostgREST não expõe schema `private` automaticamente, então funções não viram endpoints REST acidentalmente.

**REGRA #2 (STABLE marker obrigatório):** Helper functions usadas em policy **DEVEM** ser marcadas `STABLE` (não default `VOLATILE`). VOLATILE re-executa por linha — degradação de até 1000× em tabelas grandes.

**REGRA #3 (security invoker + search_path = ''):** Helper functions **DEVEM** ter `security invoker` (default seguro) + `set search_path = ''` (previne search path injection).

**REGRA #4 (super_admin via PERMISSIVE separada):** Bypass de super_admin **NÃO** é OR dentro da policy normal. É uma policy `as permissive` separada. PostgreSQL combina policies PERMISSIVE com OR — admin policy concedendo acesso = bypass total preservando granularidade.

**REGRA #5 (herança dept→org via coalesce):** `department_members.role_id` NULL = herda do `organization_members.role_id` da mesma `(org, user)`. Resolução via função `private.effective_role_in_dept(p_dept_id, p_user_id)` que retorna `coalesce(dm.role_id, om.role_id)`.

**REGRA #6 (todas anti-pitfalls v1.8 herdadas):** Aplicam-se SEMPRE — `(select auth.uid())` wrapper, NUNCA `user_metadata` em authz, 4 policies granulares (não `for all`), `to authenticated`/`to anon` explícito, indexes nas colunas das policies. Ver [`supabase-rls-policies`](../supabase-rls-policies/SKILL.md).

## Patterns canônicos

### 4 helper functions canônicas — DDL completo

```sql
-- Schema private (não exposto via PostgREST)
create schema if not exists private;

-- 1. is_member_of — checa se user é member ativo de uma org
create or replace function private.is_member_of(p_org_id uuid)
returns boolean
language sql
stable                        -- REGRA #2 — re-execução cacheada
security invoker              -- REGRA #3 — usa permissões do caller
set search_path = ''          -- REGRA #3 — previne injection
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

-- 2. has_role — checa se user tem role específica numa org
create or replace function private.has_role(p_org_id uuid, p_role_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    join public.roles r on r.id = om.role_id
    where om.org_id = p_org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and r.name = p_role_name
  );
$$;

-- 3. has_permission — checa se user tem permission resource:action numa org
create or replace function private.has_permission(p_action text, p_resource text, p_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role_id = om.role_id
    join public.permissions p on p.id = rp.permission_id
    where om.org_id = p_org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and p.action = p_action
      and p.resource = p_resource
  );
$$;

-- 4. is_super_admin — checa flag em JWT app_metadata
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt())->'app_metadata'->>'super_admin')::boolean,
    false
  );
$$;
```

**Indexes obrigatórios** (de [`multi-tenant-performance-scaling`](../multi-tenant-performance-scaling/SKILL.md)):

```sql
-- Partial index — REGRA #3 da skill performance
create index if not exists organization_members_user_org_active_idx
  on public.organization_members (user_id, org_id)
  where status = 'active';

create index if not exists role_permissions_role_idx
  on public.role_permissions (role_id);

create index if not exists permissions_action_resource_idx
  on public.permissions (action, resource);
```

### Policy hierárquica composta — exemplo `leads`

```sql
-- Tabela leads multi-tenant
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  dept_id uuid references public.departments(id) on delete set null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','won','lost')),
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, contact_email),
  unique (org_id, contact_phone)
);

alter table public.leads enable row level security;

-- POLICY 1: SELECT — member da org pode ler todos leads da org
create policy "leads_select_member"
  on public.leads
  for select
  to authenticated
  using (private.is_member_of(org_id));

-- POLICY 2: INSERT — member com permission leads:create
create policy "leads_insert_with_permission"
  on public.leads
  for insert
  to authenticated
  with check (
    private.has_permission('create', 'leads', org_id)
  );

-- POLICY 3: UPDATE — member com permission leads:update OU é owner do lead
create policy "leads_update_with_permission_or_owner"
  on public.leads
  for update
  to authenticated
  using (
    private.has_permission('update', 'leads', org_id)
    or owner_id = (select auth.uid())
  )
  with check (
    private.has_permission('update', 'leads', org_id)
    or owner_id = (select auth.uid())
  );

-- POLICY 4: DELETE — apenas admin/owner role
create policy "leads_delete_admin_owner"
  on public.leads
  for delete
  to authenticated
  using (
    private.has_role(org_id, 'admin') or private.has_role(org_id, 'owner')
  );

-- POLICY 5 (PERMISSIVE — REGRA #4): super_admin bypass para todas operações
create policy "leads_super_admin_bypass"
  on public.leads
  as permissive   -- combinação OR com policies normais
  for all          -- super_admin pode tudo
  to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());

-- Index obrigatório nas colunas filtradas
create index leads_org_dept_idx on public.leads (org_id, dept_id);
create index leads_owner_idx on public.leads (owner_id) where owner_id is not null;
```

### Herança dept→org — função `effective_role_in_dept`

```sql
-- 5. effective_role_in_dept — retorna role do user no contexto do dept
-- (NULL em department_members.role_id = herda do organization_members)
create or replace function private.effective_role_in_dept(p_dept_id uuid, p_user_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(dm.role_id, om.role_id)
  from public.departments d
  join public.organization_members om on om.org_id = d.org_id and om.user_id = p_user_id
  left join public.department_members dm on dm.dept_id = p_dept_id and dm.user_id = p_user_id
  where d.id = p_dept_id;
$$;

-- Helper: has_role no contexto de um dept (resolve herança)
create or replace function private.has_role_in_dept(p_dept_id uuid, p_role_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.roles r
    where r.id = private.effective_role_in_dept(p_dept_id, (select auth.uid()))
      and r.name = p_role_name
  );
$$;
```

### Validar isolation via query — useful em testing

```sql
-- Listar tabelas com `org_id` mas SEM RLS habilitada (red flag)
select c.relname
from pg_class c
join pg_attribute a on a.attrelid = c.oid
where a.attname = 'org_id'
  and c.relkind = 'r'
  and c.relrowsecurity = false;

-- Listar policies que referenciam helper functions canônicas
select policyname, tablename, qual
from pg_policies
where qual like '%private.is_member_of%'
   or qual like '%private.has_permission%'
   or qual like '%private.is_super_admin%';
```

## Anti-patterns

### Anti-pattern 1: Helper functions em `public` (expostos via PostgREST)

**Errado:**
```sql
create function public.is_member_of(p_org_id uuid) returns boolean ...
```

**Por quê:** PostgREST expõe automaticamente `/rpc/is_member_of?p_org_id=...`. Endpoint vira público acessível, atacante pode probe quem é member de qual org.

**Certo:** schema `private` (PostgREST ignora por default).

### Anti-pattern 2: super_admin bypass via OR na policy normal

**Errado:**
```sql
create policy "leads_select" on public.leads
  for select
  to authenticated
  using (
    private.is_member_of(org_id)
    or private.is_super_admin()  -- bypass embutido
  );
```

**Por quê:** funciona mas mistura semânticas. Mais difícil de auditar (qual é a "policy normal" vs "bypass"?). Mistura severidade — quando você desativar super_admin para teste, precisa editar todas as policies.

**Certo:** policy `as permissive` separada para super_admin (REGRA #4). PostgreSQL faz OR entre policies PERMISSIVE.

### Anti-pattern 3: Helper function VOLATILE (default)

**Errado:**
```sql
create function private.is_member_of(p_org_id uuid)
returns boolean
language sql
-- sem STABLE — default VOLATILE
as $$ ... $$;
```

**Por quê:** ver [`multi-tenant-performance-scaling`](../multi-tenant-performance-scaling/SKILL.md) Anti-pattern 1. Re-execução por linha = degradação 200×.

**Certo:** marcar `STABLE` (REGRA #2).

### Anti-pattern 4: department_members sem coalesce — herança quebrada

**Errado:**
```sql
-- Policy lê role direto de department_members, ignorando NULL
using (
  exists (
    select 1 from public.department_members dm
    join public.roles r on r.id = dm.role_id
    where dm.user_id = (select auth.uid()) and r.name = 'admin'
  )
)
```

**Por quê:** se `dm.role_id IS NULL`, JOIN não casa, role efetiva não é resolvida → user adicionado ao dept sem role explícita não tem permissão (deveria herdar do org_members).

**Certo:** usar `private.effective_role_in_dept` que faz coalesce.

### Anti-pattern 5: super_admin sem audit log

**Errado:**
```sql
-- super_admin policy permite ler/modificar tudo sem registrar quem foi
create policy "super_admin_bypass" on public.leads as permissive for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
-- Mas... onde está o audit?
```

**Por quê:** super_admin sem audit = ninguém consegue investigar incident "quem deletou todos os leads da org X em 03/04?". Compliance LGPD exige audit de acesso a dados.

**Certo:** policy super_admin OK, mas **toda operação super_admin** deve emitir evento `super_admin_action` em `audit_log` (Phase 109). Trigger AFTER INSERT/UPDATE/DELETE em tabelas críticas que checa `private.is_super_admin()` e registra.

## Invariantes Linearizáveis Cross-Tenant (v1.22+)

> Para uniqueness constraints cross-org (slug global, license key) e padrões `SELECT FOR UPDATE` em writes cross-tenant, ver skill [`escolha-modelo-consistencia`](../escolha-modelo-consistencia/SKILL.md) (v1.22 — DDIA Ch 9). Resumo: deixe `UNIQUE` constraint Postgres disparar via `INSERT ... ON CONFLICT DO NOTHING RETURNING` em vez de UPDATE+SELECT em nível de app (race window).

## Ver também

- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — anti-patterns base v1.8 herdados (REGRA #6)
- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — schema canônico que esta skill cobre com RLS
- [multi-tenant-performance-scaling](../multi-tenant-performance-scaling/SKILL.md) — STABLE marker + partial indexes (REGRA #2)
- [rbac-permissions-matrix-supabase](../rbac-permissions-matrix-supabase/SKILL.md) — modelagem permissions consumed por `private.has_permission`
- [super-admin-platform-pattern](../super-admin-platform-pattern/SKILL.md) — Phase 111, super_admin operations
- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — Phase 109, audit `super_admin_action` (Anti-pattern 5)
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — termos `RBAC`, `permission matrix`, `role escalation rule`
