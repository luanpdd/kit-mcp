---
name: org-switcher-react-pattern
cost_tier: leve
description: Use ao implementar org switcher React B2B multi-tenant — URL /orgs/[slug]/ (Next.js App Router middleware ou React Router v6), zustand v5 persist, RLS validado, refresh JWT apos assign_role.
---

# Org Switcher — React Pattern Multi-Tenant

## Quando usar

LLM carrega esta skill ao implementar org switcher em React (Next.js v16 App Router OU Vite SPA + React Router v6). Trigger phrases:

- "org switcher React", "tenant switcher"
- "URL based org context", "/orgs/[slug]"
- "Next.js middleware multi-tenant"
- "zustand org store persist"
- "JWT stale role change refresh"

## Regras absolutas

**REGRA #1 (URL-based active org):** Active org vive na **URL** (`/orgs/[slug]/...`), não em cookie/localStorage isolado. Bookmark, share, deep-link funcionam. SSR/middleware lê slug → resolve org_id ANTES de servir página.

**REGRA #2 (zustand v5 persist global org context):** Estado global do org ativo (`active_org_id`, `active_role`, `available_orgs`) em `zustand` v5 com `persist` middleware. NÃO Context API (re-renders desnecessários) NÃO Redux (overhead).

**REGRA #3 (validação middleware/loader):** Antes de renderizar `/orgs/[slug]/...`, validar:
- Slug existe em `organizations` (ou redirect 301 via `organization_slug_history`)
- User é member da org (RLS valida no fetch, mas middleware fail-fast melhora UX)

**REGRA #4 (JWT stale após role change):** Após `assign_role()` RPC, chamar `supabase.auth.refreshSession()` imediatamente. JWT antigo válido por 1h — RLS já enforce server-side, mas refresh evita UX confuso.

**REGRA #5 (anti-pattern subdomain sem Wildcard):** `acme.app.com` requer Vercel Pro+ Wildcard Domains. Para MVP, sempre `/orgs/acme/...` (path-based). Migrate para subdomain só com white-label requirement real.

## Patterns canônicos

### Next.js v16 App Router — middleware

```typescript
// middleware.ts (na raiz do projeto)
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  const pathname = url.pathname

  // Match /orgs/[slug]/...
  const orgsMatch = pathname.match(/^\/orgs\/([a-z0-9-]+)(\/.*)?$/)
  if (!orgsMatch) return NextResponse.next()

  const [, slug] = orgsMatch
  let response = NextResponse.next()

  // Supabase SSR client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        }
      }
    }
  )

  // REGRA #3: validar slug existe
  const { data: org } = await supabase
    .from('organizations')
    .select('id, slug, status')
    .eq('slug', slug)
    .maybeSingle()

  if (!org) {
    // Tentar slug history (redirect 301)
    const { data: oldSlug } = await supabase
      .from('organization_slug_history')
      .select('new_slug')
      .eq('old_slug', slug)
      .order('changed_at', { ascending: false })
      .maybeSingle()

    if (oldSlug) {
      const newPath = pathname.replace(`/orgs/${slug}`, `/orgs/${oldSlug.new_slug}`)
      return NextResponse.redirect(new URL(newPath, req.url), 301)
    }

    return NextResponse.rewrite(new URL('/404', req.url))
  }

  if (org.status !== 'active') {
    return NextResponse.rewrite(new URL('/orgs/suspended', req.url))
  }

  // REGRA #3: validar user é member
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?redirect=' + encodeURIComponent(pathname), req.url))
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id, status, roles(name)')
    .eq('org_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || membership.status !== 'active') {
    // User não é member — redirect ao próprio dashboard
    return NextResponse.rewrite(new URL('/orgs/no-access', req.url))
  }

  // Pass org_id + role para Server Components via header
  response.headers.set('x-org-id', org.id)
  response.headers.set('x-org-slug', slug)
  response.headers.set('x-active-role', (membership.roles as any).name)

  return response
}

export const config = {
  matcher: '/orgs/:slug/:path*'
}
```

### Vite SPA — React Router v6 + useParams

```typescript
// app/Router.tsx
import { Routes, Route, useParams, Navigate } from 'react-router-dom'
import { OrgProvider } from './OrgProvider'

function OrgRoutes() {
  const { slug } = useParams<{ slug: string }>()
  if (!slug) return <Navigate to="/orgs" />

  return (
    <OrgProvider slug={slug}>
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        {/* ... */}
      </Routes>
    </OrgProvider>
  )
}

export function Router() {
  return (
    <Routes>
      <Route path="/orgs/:slug/*" element={<OrgRoutes />} />
      {/* fallback */}
    </Routes>
  )
}

// OrgProvider.tsx — load org + validate via Supabase
import { createContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const OrgContext = createContext<{ org: Org | null; role: string | null }>({ org: null, role: null })

export function OrgProvider({ slug, children }) {
  const [state, setState] = useState({ org: null, role: null, loading: true })

  useEffect(() => {
    async function load() {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, slug, status, organization_members!inner(roles(name))')
        .eq('slug', slug)
        .single()

      if (!org) {
        setState({ org: null, role: null, loading: false })
        return
      }

      setState({
        org,
        role: org.organization_members[0].roles.name,
        loading: false
      })
    }
    load()
  }, [slug])

  if (state.loading) return <Spinner />
  if (!state.org) return <NotFound />

  return <OrgContext.Provider value={state}>{children}</OrgContext.Provider>
}
```

### Zustand v5 store (REGRA #2)

```typescript
// lib/stores/org-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OrgStore {
  activeOrgId: string | null
  activeOrgSlug: string | null
  activeRole: string | null
  availableOrgs: { id: string; slug: string; name: string }[]
  setActiveOrg: (orgId: string, slug: string, role: string) => void
  setAvailableOrgs: (orgs: any[]) => void
  clear: () => void
}

export const useOrgStore = create<OrgStore>()(
  persist(
    (set) => ({
      activeOrgId: null,
      activeOrgSlug: null,
      activeRole: null,
      availableOrgs: [],
      setActiveOrg: (orgId, slug, role) => set({ activeOrgId: orgId, activeOrgSlug: slug, activeRole: role }),
      setAvailableOrgs: (orgs) => set({ availableOrgs: orgs }),
      clear: () => set({ activeOrgId: null, activeOrgSlug: null, activeRole: null, availableOrgs: [] })
    }),
    {
      name: 'org-store',  // localStorage key
      version: 1
    }
  )
)
```

### Org switcher UI — shadcn Command palette

```typescript
// components/OrgSwitcher.tsx
'use client'

import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useOrgStore } from '@/lib/stores/org-store'
import { useRouter } from 'next/navigation'

export function OrgSwitcher() {
  const router = useRouter()
  const { activeOrgSlug, availableOrgs } = useOrgStore()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">{activeOrgSlug || 'Select org'}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Buscar organização..." />
          <CommandEmpty>Nenhuma organização encontrada.</CommandEmpty>
          <CommandList>
            {availableOrgs.map(org => (
              <CommandItem
                key={org.id}
                onSelect={() => router.push(`/orgs/${org.slug}/dashboard`)}
              >
                {org.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

### JWT stale após role change (REGRA #4)

```typescript
// Após assign_role RPC
async function changeUserRole(orgId: string, userId: string, roleId: string) {
  const { error } = await supabase.rpc('assign_role', {
    p_org_id: orgId,
    p_target_user_id: userId,
    p_role_id: roleId
  })

  if (error) throw error

  // REGRA #4: refresh JWT imediatamente — UX consistent com novo role
  await supabase.auth.refreshSession()
  // RLS server-side enforce de qualquer forma — refresh é UX
}
```

## Anti-patterns

### Anti-pattern 1: Active org em cookie/localStorage isolado

**Errado:**
```typescript
localStorage.setItem('active_org', orgId)
// URL não muda, deep-link não funciona
```

**Por quê:** REGRA #1 — bookmark `/dashboard` não preserva qual org. Share link manda ao dashboard mas com org diferente.

**Certo:** URL `/orgs/[slug]/dashboard` + zustand sync.

### Anti-pattern 2: Context API para org global

**Errado:**
```typescript
const OrgContext = createContext({ ... })
// Em cada consume → re-render Tree inteira
```

**Por quê:** Context API re-renderiza todos consumers em qualquer mudança. Zustand re-renderiza apenas componentes que selecionam o slice mudado.

**Certo:** REGRA #2 — `useOrgStore` com selectors granulares.

### Anti-pattern 3: Subdomain sem Wildcard Domains setup

**Errado:**
```
acme.app.com → ❌ certificate error
```

**Por quê:** REGRA #5 — Vercel free tier não suporta wildcard. Cada subdomain precisa cert manual.

**Certo:** path-based `/orgs/acme/...` para MVP. Subdomain só com Vercel Pro + Wildcard Domain configurado.

### Anti-pattern 4: Middleware sem fail-fast em slug inválido

**Errado:**
```typescript
// Middleware não valida slug, deixa página renderizar
// Página faz fetch, retorna empty → confusing UX
```

**Por quê:** REGRA #3 — fail fast no middleware. User vê 404 imediato em vez de "loading... empty page".

**Certo:** middleware valida slug existe + user é member ANTES de servir página.

## Ver também

- [permission-gate-react-pattern](../permission-gate-react-pattern/SKILL.md) — Phase 115 sibling
- [member-management-react-shadcn](../member-management-react-shadcn/SKILL.md) — Phase 115 sibling
- [b2b-saas-architecture](../b2b-saas-architecture/SKILL.md) — slug imutável + redirect trail
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — `@supabase/ssr` middleware pattern
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — `org switcher`, `JWT stale`
- [Next.js 16 Multi-Tenant Architecture](https://nextjs.org/docs/app/guides/multi-tenant)
- [Vercel Multi-Tenant Guide](https://vercel.com/guides/nextjs-multi-tenant-application)
