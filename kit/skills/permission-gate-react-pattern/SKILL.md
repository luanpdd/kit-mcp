---
name: permission-gate-react-pattern
description: Use ao implementar permission gates React em B2B SaaS multi-tenant — CASL `@casl/ability` 6.8 + `@casl/react` 4.x para gates declarativos `<PermissionGate permission="leads:create">`, hook `usePermission(action, resource)`, anti-pattern explícito permission check só client (server-side enforcement obrigatório via RLS).
---

# Permission Gate — React Pattern (CASL)

## Quando usar

LLM carrega esta skill ao implementar gates de permissão UI em React. Trigger phrases:

- "permission gate React", "PermissionGate component"
- "CASL React permissions", "@casl/ability"
- "usePermission hook", "ability check React"
- "RBAC frontend gate"
- "client-side permission anti-pattern"

## Regras absolutas

**REGRA #1 (UX-only, NUNCA segurança):** Permission gate React é **UX apenas**. Esconde botão para evitar erro 403 visível ao user. **Server-side enforcement obrigatório** via RLS (Phase 108) + `private.has_permission`.

**REGRA #2 (CASL canônico 2026):** `@casl/ability` v6.8+ + `@casl/react` v4.x é a biblioteca canônica para React. Isomorfica (frontend + backend), bundle pequeno (~5KB), API declarativa.

**REGRA #3 (build ability do JWT):** Construir `Ability` instance **uma vez** após login a partir das permissions do user (fetched via RPC). Re-build apenas após role change.

**REGRA #4 (Hook `usePermission` + componente `<PermissionGate>`):** Padrões canônicos:
- `usePermission(action, resource)` para condicionais inline
- `<PermissionGate permission="leads:create">{children}</PermissionGate>` para wrap declarativo

**REGRA #5 (sync com server após role change):** Após `assign_role` RPC, re-fetch permissions + rebuild Ability + update store. Sem isso, UI mostra cached state stale.

## Patterns canônicos

### Setup CASL — definir Ability

```typescript
// lib/abilities/build-ability.ts
import { AbilityBuilder, Ability } from '@casl/ability'

export type Action = 'create' | 'read' | 'update' | 'delete' | 'invite' | 'remove' | 'export' | 'view' | 'process'
export type Subject = 'leads' | 'members' | 'org_settings' | 'audit_logs' | 'departments' | 'roles' | 'permissions' | 'dsr_requests' | 'all'

export type AppAbility = Ability<[Action, Subject]>

interface UserPermissions {
  permissions: Array<{ action: Action; resource: Subject }>
  isSuperAdmin: boolean
}

export function buildAbility({ permissions, isSuperAdmin }: UserPermissions): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(Ability)

  if (isSuperAdmin) {
    can('manage' as any, 'all')
    return build()
  }

  for (const p of permissions) {
    can(p.action, p.resource)
  }

  return build()
}
```

### Buscar permissions do user (RPC)

```sql
-- supabase RPC chamada após login
create or replace function public.get_user_permissions(p_org_id uuid)
returns table(action text, resource text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.action, p.resource
  from public.organization_members om
  join public.role_permissions rp on rp.role_id = om.role_id
  join public.permissions p on p.id = rp.permission_id
  where om.org_id = p_org_id
    and om.user_id = (select auth.uid())
    and om.status = 'active';
$$;

grant execute on function public.get_user_permissions(uuid) to authenticated;
```

### Provider — Ability disponível em toda app

```typescript
// app/providers/AbilityProvider.tsx
'use client'

import { createContext, useEffect, useState } from 'react'
import { AppAbility, buildAbility } from '@/lib/abilities/build-ability'
import { useOrgStore } from '@/lib/stores/org-store'
import { supabase } from '@/lib/supabase'

export const AbilityContext = createContext<AppAbility | null>(null)

export function AbilityProvider({ children }: { children: React.ReactNode }) {
  const [ability, setAbility] = useState<AppAbility | null>(null)
  const activeOrgId = useOrgStore(s => s.activeOrgId)

  useEffect(() => {
    if (!activeOrgId) return

    async function load() {
      // REGRA #3: build ability do server data
      const { data: { user } } = await supabase.auth.getUser()
      const isSuperAdmin = user?.app_metadata.super_admin === true

      const { data: permissions } = await supabase
        .rpc('get_user_permissions', { p_org_id: activeOrgId })

      setAbility(buildAbility({ permissions: permissions || [], isSuperAdmin }))
    }
    load()
  }, [activeOrgId])

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
}

// Hook para acessar ability
import { useContext } from 'react'
export function useAbility() {
  const ability = useContext(AbilityContext)
  if (!ability) throw new Error('useAbility must be inside AbilityProvider')
  return ability
}
```

### Hook `usePermission` (REGRA #4)

```typescript
// lib/hooks/use-permission.ts
import { useAbility } from '@/app/providers/AbilityProvider'
import { Action, Subject } from '@/lib/abilities/build-ability'

export function usePermission(action: Action, resource: Subject): boolean {
  const ability = useAbility()
  return ability.can(action, resource)
}

// Usage:
function LeadsPage() {
  const canCreateLead = usePermission('create', 'leads')
  return (
    <div>
      <h1>Leads</h1>
      {canCreateLead && <Button onClick={openCreateModal}>+ Novo Lead</Button>}
    </div>
  )
}
```

### Componente `<PermissionGate>` (REGRA #4)

```typescript
// components/PermissionGate.tsx
import { useAbility } from '@/app/providers/AbilityProvider'
import type { Action, Subject } from '@/lib/abilities/build-ability'

interface Props {
  permission: `${Action}:${Subject}`
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGate({ permission, fallback = null, children }: Props) {
  const ability = useAbility()
  const [action, subject] = permission.split(':') as [Action, Subject]

  if (ability.can(action, subject)) {
    return <>{children}</>
  }
  return <>{fallback}</>
}

// Usage:
<PermissionGate permission="leads:create">
  <Button onClick={openCreateModal}>+ Novo Lead</Button>
</PermissionGate>

<PermissionGate
  permission="org_settings:update"
  fallback={<p>Você não tem permissão para alterar configurações.</p>}
>
  <SettingsForm />
</PermissionGate>
```

### Refresh ability após role change (REGRA #5)

```typescript
// Em algum lugar após mudança de role (admin UI)
async function changeRole(targetUserId: string, newRoleId: string) {
  await supabase.rpc('assign_role', { ... })
  await supabase.auth.refreshSession()  // JWT (cross-ref org-switcher)

  // REGRA #5: re-fetch + rebuild ability
  // Trigger AbilityProvider re-fetch via mudança em activeOrgId timestamp
  // (use store version increment)
  useOrgStore.getState().bumpVersion()
}
```

## Anti-patterns

### Anti-pattern 1: Permission check SÓ frontend (sem RLS)

**Errado:**
```typescript
{ ability.can('delete', 'leads') && <DeleteButton onClick={() => api.delete(`/leads/${id}`)} /> }
// Mas API endpoint não checa permission server-side
```

**Por quê:** REGRA #1 — atacante chama `curl -X DELETE /leads/...` direto, ignora gate React. Frontend gate é segurança teatro.

**Certo:** RLS no Supabase com `private.has_permission` (Phase 108) + frontend gate como UX redundância.

### Anti-pattern 2: Hard-coded role check em vez de permission

**Errado:**
```typescript
{ user.role === 'admin' && <Button>Convidar</Button> }
```

**Por quê:** custom roles quebram. Custom role com permission `members:invite` deveria mostrar botão, mas não passa no check `=== 'admin'`. Acopla UI a role names.

**Certo:** `usePermission('invite', 'members')` — funciona com qualquer role que tenha a permission.

### Anti-pattern 3: Re-fetch permissions a cada render

**Errado:**
```typescript
function MyComponent() {
  const [perms, setPerms] = useState([])
  useEffect(() => {
    supabase.rpc('get_user_permissions', { ... }).then(setPerms)
  })  // sem deps array — re-fetch infinito
}
```

**Por quê:** N requests/min para Supabase, performance terrível.

**Certo:** REGRA #3 — build Ability uma vez no Provider, consume via `useAbility()` hook.

### Anti-pattern 4: Esquecer fallback em PermissionGate

**Errado:**
```typescript
<PermissionGate permission="org_settings:update">
  <SettingsForm />
</PermissionGate>
// User sem permission vê página vazia, sem feedback
```

**Por quê:** UX confusa — user não entende por que página é em branco.

**Certo:** sempre passar `fallback` com mensagem clara ("Você não tem permissão...").

## Ver também

- [org-switcher-react-pattern](../org-switcher-react-pattern/SKILL.md) — sibling, OrgProvider + zustand store
- [member-management-react-shadcn](../member-management-react-shadcn/SKILL.md) — sibling, usa PermissionGate
- [rbac-permissions-matrix-supabase](../rbac-permissions-matrix-supabase/SKILL.md) — Phase 108, modelagem permissions
- [multi-tenant-rls-hierarchy](../multi-tenant-rls-hierarchy/SKILL.md) — Phase 108, server-side RLS enforcement
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — `permission gate`, `CASL`, `JWT stale`
- [CASL Documentation](https://casl.js.org/)
