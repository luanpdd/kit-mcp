---
name: rbac-permissions-matrix-supabase
cost_tier: leve
description: Use ao modelar RBAC granular em Supabase B2B multi-tenant — define permission strings resource:action, matrix N:M roles↔permissions, 3 roles built-in (owner/admin/member) e regra anti-escalation.
---

# RBAC Permissions Matrix — Supabase B2B Multi-Tenant

## Quando usar

LLM carrega esta skill ao desenhar autorização granular em B2B SaaS multi-tenant. Trigger phrases:

- "RBAC granular", "permission matrix"
- "permission string resource:action", "leads:create", "members:invite"
- "custom roles", "role escalation rule"
- "owner admin member built-in"
- "role permissions table"

## Regras absolutas

**REGRA #1 (permission string format):** Permissions são strings `<resource>:<action>` em snake_case (ex: `leads:create`, `members:invite`, `org_settings:update`). Padrão convergente 2026 (Stripe, Linear, Auth0).

**REGRA #2 (3 roles built-in mínimo):** Toda org tem 3 roles built-in com `is_built_in = true`:
- `owner` — full control (criação org, billing, transfer ownership, delete org)
- `admin` — manage members, settings, all data
- `member` — operações standard (CRUD nos recursos da org)

**REGRA #3 (role escalation rule):** Usuário só pode **criar/atribuir roles ≤ ao próprio role**. Member não pode criar admin. Admin não pode criar owner. Owner pode tudo. Enforced via policy + frontend gate.

**REGRA #4 (custom roles permitidos):** Custom roles via `is_built_in = false` na mesma tabela `roles`. Org-scoped (não globais). Built-in não podem ser deletados (constraint).

**REGRA #5 (NUNCA permission string em frontend hard-coded para enforce):** Permission gate React (skill [`permission-gate-react-pattern`](../permission-gate-react-pattern/SKILL.md)) é UX apenas. Server-side enforcement obrigatório via RLS + `private.has_permission`.

## Patterns canônicos

### Permission catalog — eventos canônicos

```sql
-- Catálogo global (compartilhado entre orgs)
insert into public.permissions (action, resource, description) values
  -- Members
  ('invite',  'members',      'Convidar novos membros via email'),
  ('remove',  'members',      'Remover membros existentes'),
  ('update',  'members',      'Atualizar role/status de membros'),
  ('list',    'members',      'Listar membros da org'),

  -- Org settings
  ('update',  'org_settings', 'Atualizar configurações gerais da org'),
  ('update',  'org_billing',  'Acessar/alterar billing (Stripe)'),

  -- Departments
  ('create',  'departments',  'Criar departamentos'),
  ('update',  'departments',  'Atualizar departamentos'),
  ('delete',  'departments',  'Deletar departamentos'),

  -- Roles + Permissions
  ('create',  'roles',        'Criar custom roles'),
  ('update',  'roles',        'Atualizar role permissions'),
  ('delete',  'roles',        'Deletar custom roles (built-in protegidos)'),

  -- Domain example: leads (CRM)
  ('create',  'leads',        'Criar leads'),
  ('update',  'leads',        'Atualizar leads'),
  ('delete',  'leads',        'Deletar leads'),
  ('export',  'leads',        'Exportar leads (CSV/JSON)'),

  -- Audit
  ('view',    'audit_logs',   'Ver audit logs'),
  ('export',  'audit_logs',   'Exportar audit logs'),

  -- LGPD
  ('process', 'dsr_requests', 'Processar Data Subject Requests'),

on conflict (action, resource) do nothing;
```

### 3 roles built-in com permissions default

```sql
-- Para cada nova org (idealmente em RPC create_organization), criar built-in roles
-- com permissions atribuídas.

-- OWNER — todas permissions
insert into public.role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from public.roles r
cross join public.permissions p
where r.org_id = '<org_id>'
  and r.name = 'owner';

-- ADMIN — tudo exceto org_billing + delete org
insert into public.role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from public.roles r
cross join public.permissions p
where r.org_id = '<org_id>'
  and r.name = 'admin'
  and not (p.action = 'update' and p.resource = 'org_billing');

-- MEMBER — operações CRUD em domínio (sem members management)
insert into public.role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from public.roles r
cross join public.permissions p
where r.org_id = '<org_id>'
  and r.name = 'member'
  and p.resource in ('leads', 'departments')
  and p.action in ('create', 'update', 'list');
```

### Role escalation rule — enforcement via RPC + RLS

```sql
-- Função que retorna o "rank" de uma role (owner=3, admin=2, member=1, custom=0)
create or replace function private.role_rank(p_role_name text)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select case p_role_name
    when 'owner' then 3
    when 'admin' then 2
    when 'member' then 1
    else 0  -- custom roles têm rank 0 (não comparáveis)
  end;
$$;

-- RPC que assign role a um membro — só permite role ≤ ao próprio
create or replace function public.assign_role(
  p_org_id uuid,
  p_target_user_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_role_name text;
  target_role_name text;
begin
  -- 1. Buscar role do caller na org
  select r.name into caller_role_name
  from public.organization_members om
  join public.roles r on r.id = om.role_id
  where om.org_id = p_org_id
    and om.user_id = (select auth.uid())
    and om.status = 'active';

  if caller_role_name is null then
    raise exception 'caller is not member of org';
  end if;

  -- 2. Buscar role alvo
  select r.name into target_role_name
  from public.roles r
  where r.id = p_role_id and r.org_id = p_org_id;

  if target_role_name is null then
    raise exception 'role does not exist in org';
  end if;

  -- 3. REGRA #3: caller role rank >= target role rank
  if private.role_rank(caller_role_name) < private.role_rank(target_role_name) then
    raise exception
      'role escalation forbidden: caller is %, cannot assign %',
      caller_role_name, target_role_name;
  end if;

  -- 4. Assign
  update public.organization_members
  set role_id = p_role_id
  where org_id = p_org_id and user_id = p_target_user_id;
end;
$$;

grant execute on function public.assign_role(uuid, uuid, uuid) to authenticated;
```

### Frontend — listar roles que user pode atribuir

```typescript
// Buscar roles que current user pode atribuir (rank ≤ próprio)
const { data: assignableRoles } = await supabase
  .from('roles')
  .select('id, name, description')
  .eq('org_id', orgId)
  // RPC retorna apenas roles que caller pode atribuir
  .rpc('list_assignable_roles', { p_org_id: orgId })
```

### RLS policy usando `private.has_permission`

```sql
-- Tabela leads — INSERT requer permission leads:create
create policy "leads_insert_with_permission"
  on public.leads
  for insert
  to authenticated
  with check (
    private.has_permission('create', 'leads', org_id)
  );

-- Tabela members management — UPDATE role requer permission members:update
create policy "members_update_role_with_permission"
  on public.organization_members
  for update
  to authenticated
  using (
    private.has_permission('update', 'members', org_id)
  )
  with check (
    private.has_permission('update', 'members', org_id)
  );
```

## Mecanismo de delivery dos claims (v1.25 update)

Os patterns acima usam **helper function PG STABLE** (`private.has_permission(action, resource, org_id)`) que faz JOIN em `role_permissions` table dentro de cada policy evaluation. Funciona bem para casos multi-tenant complexos (role depende de org context) mas adiciona JOIN custoso em policies hot.

A partir de **v1.25**, kit-mcp adiciona alternativa moderna via **Custom Access Token Auth Hook** (skill [`supabase-custom-claims-rbac`](../supabase-custom-claims-rbac/SKILL.md)) que injeta `user_role` direto no JWT — RLS policies leem o claim via `authorize(permission)` sem JOIN.

**Comparação canônica (v1.25):**

| | Helper function STABLE (v1.21) | Custom Claim via Auth Hook (v1.25) |
|---|---|---|
| Performance | JOIN em role_permissions por query | Zero-JOIN — claim no JWT |
| Multi-tenant context | ✅ `has_permission('update', 'members', org_id)` — context-aware | ❌ Claim é per-user, não per-org-context |
| Mudança em real-time | ✅ Imediata (UPDATE em role_permissions reflete) | ⚠ Eventually consistent (TTL refresh 1h) |
| Type safety | String permission `'update:members'` | Enum `app_permission` |
| Setup complexity | Média (helper function + RLS) | Alta (auth hook + auth_admin grants + jwt-decode cliente) |

**Recomendação canônica v1.25 para B2B multi-tenant:**

**Combine ambos:**
- **Custom claim** para role global (`super_admin`, `org_owner`) — zero-JOIN, fácil consulta cliente
- **Helper function STABLE** para context-aware (`has_permission(action, resource, org_id)`) — quando role muda por org

Exemplo de policy combinada:

```sql
create policy "members_select" on public.members for select
to authenticated
using (
  -- claim no JWT (zero-JOIN, fast path)
  (SELECT authorize('members:read'))
  -- OU helper function PG (context-aware, slow path)
  or private.has_permission('read', 'members', org_id)
);
```

Pattern detalhado em [`supabase-custom-claims-rbac`](../supabase-custom-claims-rbac/SKILL.md) (v1.25) section "Cross-suite integration".

## Anti-patterns

### Anti-pattern 1: Permission string sem padrão

**Errado:**
```sql
-- Mistura formats
'canCreateLeads', 'leads.create', 'CREATE_LEAD', 'leads:write'
```

**Por quê:** inconsistência confunde devs (qual é a forma certa?), quebra autocomplete, dificulta migração.

**Certo:** sempre `<resource>:<action>` em snake_case (REGRA #1). Pode usar enum em TypeScript:
```typescript
type Permission = `${Resource}:${Action}`
```

### Anti-pattern 2: Hard-coded role check em vez de permission

**Errado:**
```typescript
// Permission gate frontend
{ user.role === 'admin' && <Button>Convidar</Button> }
```

**Por quê:** custom roles quebram (custom role com permission `members:invite` não passa no check). Acopla UI a roles built-in.

**Certo:**
```typescript
{ usePermission('invite', 'members') && <Button>Convidar</Button> }
```

E server-side: RLS com `private.has_permission`.

### Anti-pattern 3: Built-in role pode ser deletada

**Errado:**
```sql
-- Sem proteção
delete from public.roles where name = 'owner' and org_id = '...';
-- Org fica sem owner, ninguém consegue fazer nada
```

**Por quê:** org sem owner é unrecoverable sem service_role intervention. Compromete recovery.

**Certo:** policy DELETE em `roles` que rejeita built-in:
```sql
create policy "roles_delete_custom_only"
  on public.roles
  for delete
  to authenticated
  using (
    not is_built_in
    and private.has_permission('delete', 'roles', org_id)
  );
```

### Anti-pattern 4: Frontend permission gate sem server-side enforce

**Errado:**
```typescript
// Esconder botão UI = "segurança"
{ usePermission('delete', 'leads') && <DeleteButton /> }
// Mas API endpoint /leads/{id} aceita DELETE sem checar permission
```

**Por quê:** atacante chama API direto via curl — ignora gate frontend. Permission gate React é **UX**, não segurança.

**Certo:** REGRA #5. Server-side via RLS + `private.has_permission` é enforcement real.

## Ver também

- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — `private.has_permission` é a função canônica usada em policies
- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — schema das tabelas `roles`, `permissions`, `role_permissions`
- [permission-gate-react-pattern](../permission-gate-react-pattern/SKILL.md) — Phase 115, permission gate UX em React
- [super-admin-platform-pattern](../super-admin-platform-pattern/SKILL.md) — Phase 111, super_admin bypassa RBAC normal
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — termos `RBAC`, `permission matrix`, `role escalation rule`
