---
name: member-management-react-shadcn
description: Use ao implementar painel UI de gestão de membros em React + shadcn/ui — data-table TanStack, dialog de invite, dropdown de role, 9 componentes shadcn canônicos, PermissionGate por ação.
---

# Member Management — React + shadcn/ui

## Quando usar

LLM carrega esta skill ao implementar painel UI de member management. Trigger phrases:

- "member management UI", "painel de membros React"
- "data table TanStack shadcn", "members list with filters"
- "invite member dialog", "role assignment dropdown"
- "shadcn member admin"

## Regras absolutas

**REGRA #1 (composição canônica de 9 componentes shadcn):** Painel canônico usa: `data-table` (TanStack v8), `dialog`, `select`, `badge`, `dropdown-menu`, `avatar`, `command` (search palette), `form`, `toast`. Adicionar mais componentes só com justificativa.

**REGRA #2 (PermissionGate em todo botão de ação):** Cada ação (invite, remove, role change) vem wrapped em `<PermissionGate>` com permission relevante. Member sem permission não vê botão.

**REGRA #3 (server-side filters via Supabase, não client):** Filtros (role, status, search) executados via Supabase query (`.eq`, `.ilike`), não em client-side. Performance + RLS preservada.

**REGRA #4 (optimistic UI com rollback):** Operações de role change/remove fazem optimistic update + rollback em error. Toast de feedback via shadcn `toast` em ambos casos.

## Patterns canônicos

### Members DataTable

```typescript
// app/orgs/[slug]/members/MembersTable.tsx
'use client'

import { useState, useMemo } from 'react'
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender
} from '@tanstack/react-table'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'
import { useMembers } from '@/lib/hooks/use-members'
import { ChangeRoleDialog } from './ChangeRoleDialog'
import { RemoveMemberConfirm } from './RemoveMemberConfirm'

interface Member {
  id: string
  user: { id: string; email: string; name: string; avatar_url?: string }
  role: { id: string; name: string }
  status: 'active' | 'suspended' | 'left'
  joined_at: string
}

const columns: ColumnDef<Member>[] = [
  {
    id: 'avatar',
    cell: ({ row }) => (
      <Avatar>
        <AvatarImage src={row.original.user.avatar_url} />
        <AvatarFallback>{row.original.user.name?.[0] || '?'}</AvatarFallback>
      </Avatar>
    )
  },
  {
    accessorKey: 'user.name',
    header: 'Nome',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.user.name}</div>
        <div className="text-sm text-muted-foreground">{row.original.user.email}</div>
      </div>
    )
  },
  {
    accessorKey: 'role.name',
    header: 'Role',
    cell: ({ row }) => (
      <Badge variant={row.original.role.name === 'owner' ? 'default' : 'secondary'}>
        {row.original.role.name}
      </Badge>
    )
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'active' ? 'default' : 'destructive'}>
        {row.original.status}
      </Badge>
    )
  },
  {
    accessorKey: 'joined_at',
    header: 'Entrou em',
    cell: ({ row }) => new Date(row.original.joined_at).toLocaleDateString('pt-BR')
  },
  {
    id: 'actions',
    cell: ({ row }) => <MemberActions member={row.original} />
  }
]

function MemberActions({ member }: { member: Member }) {
  const [changeRoleOpen, setChangeRoleOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <PermissionGate permission="update:members">
            <DropdownMenuItem onClick={() => setChangeRoleOpen(true)}>Alterar role</DropdownMenuItem>
          </PermissionGate>
          <PermissionGate permission="remove:members">
            <DropdownMenuItem onClick={() => setRemoveOpen(true)} className="text-destructive">
              Remover
            </DropdownMenuItem>
          </PermissionGate>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangeRoleDialog member={member} open={changeRoleOpen} onOpenChange={setChangeRoleOpen} />
      <RemoveMemberConfirm member={member} open={removeOpen} onOpenChange={setRemoveOpen} />
    </>
  )
}

export function MembersTable() {
  const { data: members } = useMembers()
  const table = useReactTable({
    data: members || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(hg => (
          <TableRow key={hg.id}>
            {hg.headers.map(h => (
              <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Invite Dialog (REGRA #1: Dialog + Form)

```typescript
// app/orgs/[slug]/members/InviteMemberDialog.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase'
import { useOrgStore } from '@/lib/stores/org-store'
import { useAssignableRoles } from '@/lib/hooks/use-assignable-roles'

export function InviteMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast()
  const orgId = useOrgStore(s => s.activeOrgId)
  const { data: roles } = useAssignableRoles(orgId!)

  const form = useForm({ defaultValues: { email: '', roleName: 'member' } })

  async function onSubmit({ email, roleName }: { email: string; roleName: string }) {
    const { data: token, error } = await supabase.rpc('create_invite', {
      p_org_id: orgId!,
      p_email: email,
      p_role_name: roleName
    })

    if (error) {
      toast({ title: 'Erro ao criar invite', description: error.message, variant: 'destructive' })
      return
    }

    // Enviar email via Edge Function
    await supabase.functions.invoke('send-invite-email', {
      body: { email, token, base_url: window.location.origin }
    })

    toast({ title: 'Invite enviado', description: `Email de convite enviado a ${email}` })
    onOpenChange(false)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="email" rules={{ required: 'Email obrigatório', pattern: /^.+@.+\..+$/ }} render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="roleName" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles?.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit">Enviar convite</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### Optimistic UI com rollback (REGRA #4)

```typescript
async function removeMember(member: Member) {
  // Optimistic
  const prev = queryClient.getQueryData(['members', orgId])
  queryClient.setQueryData(['members', orgId], (old: Member[]) =>
    old.filter(m => m.id !== member.id)
  )

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', member.id)

  if (error) {
    // Rollback
    queryClient.setQueryData(['members', orgId], prev)
    toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' })
  } else {
    toast({ title: 'Membro removido' })
  }
}
```

## Anti-patterns

### Anti-pattern 1: Filtros em client-side em lista grande

**Errado:**
```typescript
const filtered = members.filter(m => m.role === 'admin')  // 10000 members buscados
```

**Por quê:** REGRA #3 — performance terrível, bandwidth wasted, RLS preservada mas overhead.

**Certo:** server-side via Supabase: `.eq('roles.name', 'admin')`.

### Anti-pattern 2: Botão remove sem PermissionGate

**Errado:**
```typescript
<Button onClick={removeMember}>Remover</Button>
// Sem PermissionGate — qualquer member vê
```

**Por quê:** REGRA #2 — UX confusa, click resulta em 403 visível.

**Certo:** `<PermissionGate permission="remove:members">{<Button ...>}</PermissionGate>`.

### Anti-pattern 3: Sem optimistic UI em ações comuns

**Errado:**
```typescript
await api.removeMember(id)  // user espera 500ms+
refetch()  // mais 500ms
// Lista demora a atualizar = UX lenta
```

**Por quê:** REGRA #4 — cada ação parece lenta, frustração.

**Certo:** optimistic update imediato + rollback em error + toast.

## Ver também

- [org-switcher-react-pattern](../org-switcher-react-pattern/SKILL.md) — sibling, useOrgStore
- [permission-gate-react-pattern](../permission-gate-react-pattern/SKILL.md) — sibling, PermissionGate component usado aqui
- [member-invite-flow](../member-invite-flow/SKILL.md) — Phase 110, RPC create_invite
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — `shadcn/ui`, `permission gate`
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [TanStack Table v8](https://tanstack.com/table/latest)
