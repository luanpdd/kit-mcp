---
name: supabase-auth-ssr
description: Use ao bootstrap Next.js v16 + Supabase Auth — @supabase/ssr, getAll/setAll APENAS, NUNCA auth-helpers-nextjs, proxy com getClaims, cache headers e redirects.
---

# Supabase — Auth SSR (Next.js v16+)

## Quando usar

LLM carrega esta skill quando bootstrap ou auditar autenticação Supabase em Next.js v16+ (App Router) com SSR. Trigger phrases:

- "Next.js + Supabase auth"
- "@supabase/ssr"
- "createServerClient", "createBrowserClient"
- "middleware.ts auth", "proxy auth"
- "cookies getAll setAll"
- "Supabase auth Next.js v16"
- "getClaims proteger página SSR", "cache headers setAll"

## Regras absolutas

**WARNING — NEVER use auth-helpers-nextjs.** O pacote `@supabase/auth-helpers-nextjs` está **DEPRECATED** e **quebra em Next.js v16+** (cookies API mudou). **SEMPRE** use `@supabase/ssr`.

**Outras regras:**

- **Padrão exclusivo `getAll`/`setAll`** para cookies — **NUNCA** `get`/`set`/`remove` individuais. Os métodos individuais não funcionam corretamente com middleware/Server Actions em Next.js v16+.
- **Browser client e Server client são distintos:**
  - Browser (`createBrowserClient`) → para Client Components ("use client")
  - Server (`createServerClient`) → para Server Components, Route Handlers, Server Actions
- **Middleware/Proxy (`middleware.ts`) obrigatório** para refresh de sessão SSR. Deve chamar `supabase.auth.getClaims()` em cada request — `getClaims()` valida a assinatura do JWT contra as chaves públicas publicadas e faz o refresh. **NUNCA confie em `getSession()` no servidor** — não revalida o token. `getUser()` continua válido (faz round-trip ao Auth server, garante que a sessão não foi revogada), mas é mais lento; prefira `getClaims()` para proteger páginas.
- **Auth method order** — após `createServerClient` mas **ANTES** de `getClaims()`, NÃO chamar nada que produza response intermediário. Os cookies precisam fluir corretamente.
- **Cache headers no `setAll`** — desde `@supabase/ssr` v0.10.0 o `setAll` recebe um 2º argumento com headers de cache (`Cache-Control`, `Expires`, `Pragma`). No proxy, aplique-os ao response — sem isso, um CDN/ISR pode cachear o `Set-Cookie` e vazar a sessão de um usuário para outro.
- **`NEXT_PUBLIC_*` apenas para a chave pública** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave nova `sb_publishable_...`) ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legada, válida até fim de 2026). **NUNCA** `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` nem `sb_secret_...` — bypassam RLS e seriam expostos ao cliente (anti-pitfall B6).
- **Single serverClient factory + inicializar dentro do request handler** — não criar múltiplos clients em layouts (race condition na refresh de token — B13) nem em escopo de módulo (em Vercel Fluid compute o client é reaproveitado entre requests e vaza sessão de outro usuário).

## Patterns canônicos

### Browser client — Client Components

```ts
// utils/supabase/client.ts — PT-BR: client para Client Components
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```tsx
// PT-BR: uso em Client Component
'use client'
import { createClient } from '@/utils/supabase/client'

export function LogoutButton() {
  const supabase = createClient()
  return <button onClick={() => supabase.auth.signOut()}>Sair</button>
}
```

### Server client — Server Components / Server Actions

```ts
// utils/supabase/server.ts — PT-BR: client para Server Components/Actions/Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // PT-BR: ok ignorar — chamado em Server Component (sem permissão de set)
            // se proxy faz refresh, sessão fica saudável mesmo sem set aqui
          }
        },
      },
    }
  )
}
```

```tsx
// PT-BR: uso em Server Component — getClaims() valida a assinatura do JWT
// localmente e é a forma canônica de proteger páginas no servidor
import { createClient } from '@/utils/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) return <p>Não autenticado</p>
  return <p>Olá, {claims.email}</p>
}
```

### Middleware — refresh de sessão (obrigatório)

```ts
// middleware.ts — PT-BR: proxy obrigatório para refresh de sessão SSR
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          // PT-BR: aplicar cache headers (@supabase/ssr v0.10.0+) — impede
          // CDN/ISR de cachear o Set-Cookie e vazar sessão entre usuários
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // PT-BR: ATENÇÃO — não execute código entre createServerClient e getClaims()
  // (qualquer cookie set/get fora desse path quebra refresh silencioso)
  // getClaims() valida a assinatura do JWT e faz o refresh da sessão
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null

  // PT-BR: redirect para /login se sem user
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // PT-BR: IMPORTANTE — sempre retornar supabaseResponse (cookies precisam fluir)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Login com email/senha (Server Action)

```ts
// app/login/actions.ts
'use server'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}
```

## Anti-patterns

### Anti-pattern 1: Importar de `@supabase/auth-helpers-nextjs`

**Errado:**
```ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
```

**Por quê:** `@supabase/auth-helpers-nextjs` está **DEPRECATED**. Quebra em Next.js v16+ (cookies API mudou). Não recebe mais updates de segurança.

**Certo:**
```ts
import { createServerClient, createBrowserClient } from '@supabase/ssr'
```

### Anti-pattern 2: `cookies: { get, set, remove }` (individual)

**Errado:**
```ts
{
  cookies: {
    get(name: string) { return cookieStore.get(name) },
    set(name: string, value: string) { cookieStore.set(name, value) },
    remove(name: string) { cookieStore.remove(name) },
  }
}
```

**Por quê:** cookie methods individuais quebram em middleware quando há múltiplos cookies sendo set/get em uma única request. `getAll`/`setAll` são chamados em batch e preservam ordem.

**Certo:** ver pattern "Server client" e "Middleware" acima.

### Anti-pattern 3: `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`

**Errado:**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**Por quê:** `NEXT_PUBLIC_*` é **público** no client bundle. `service_role` bypassa RLS — vazamento = banco totalmente exposto.

**Certo:**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...   # ok público
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...         # privado — sem NEXT_PUBLIC_
```

Use `service_role` apenas em código server-side que NUNCA é embarcado no bundle client (Route Handlers, Server Actions com `'use server'`, Edge Functions).

### Anti-pattern 4: Múltiplos serverClient em layouts (race condition)

**Errado:**
```tsx
// app/layout.tsx
const supabase1 = await createClient()
const { user } = await supabase1.auth.getUser()
// ...
// app/(dashboard)/layout.tsx
const supabase2 = await createClient()   // ⚠ outro client na mesma request
const { user } = await supabase2.auth.getUser()
```

**Por quê:** múltiplos `createServerClient` na mesma request podem corromper cookies de refresh de token. Issue [supabase/ssr#68](https://github.com/supabase/ssr/issues/68) — race condition documentada.

**Certo:** middleware faz o refresh **uma vez por request**. Layouts apenas leem os claims via `getClaims()`:
```tsx
// app/layout.tsx — middleware já fez o refresh
const supabase = await createClient()
const { data } = await supabase.auth.getClaims()
```

### Anti-pattern 5: Confiar em `getSession()` no servidor

**Errado:**
```ts
// middleware.ts ou Server Component
const { data: { session } } = await supabase.auth.getSession()
if (!session) redirect('/login')   // ⚠ inseguro no servidor
```

**Por quê:** `getSession()` lê a sessão direto dos cookies — que podem ser forjados — e **não revalida** o token. No servidor, use `getClaims()` (valida a assinatura do JWT contra as chaves públicas do projeto) ou `getUser()` (round-trip ao Auth server). `getSession()` é aceitável apenas no cliente.

**Certo:**
```ts
const { data } = await supabase.auth.getClaims()
if (!data?.claims) redirect('/login')
```

### Anti-pattern 6: Cliente Supabase em escopo de módulo (vazamento em Fluid compute)

**Errado:**
```ts
// ⚠ escopo de módulo — reaproveitado entre requests
const supabase = createServerClient(/* ... */)
export async function handler(req) { /* usa supabase compartilhado */ }
```

**Por quê:** em Vercel Fluid compute (e instâncias serverless reaproveitadas) o client persiste entre requests de usuários diferentes — a sessão de um vaza para outro.

**Certo:** crie o client **dentro** do request handler, sempre via a factory `createClient()`.

## Ver também

- [supabase-auth-methods](../supabase-auth-methods/SKILL.md) — métodos de sign-in/sign-up (password, magic link, OTP, anonymous, Web3)
- [supabase-social-oauth](../supabase-social-oauth/SKILL.md) — social login + rota callback PKCE `/auth/callback`
- [supabase-auth-sessions](../supabase-auth-sessions/SKILL.md) — fluxos implicit vs PKCE, refresh tokens
- [supabase-jwt-signing-keys](../supabase-jwt-signing-keys/SKILL.md) — `getClaims()`, JWKS e signing keys assimétricas
- [supabase-auth-hardening](../supabase-auth-hardening/SKILL.md) — redirect URLs, custom SMTP, rate limits, CAPTCHA
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — RLS aplicado quando user autenticado consulta tabelas
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — Edge Functions usando service_role server-side
- [supabase-realtime](../supabase-realtime/SKILL.md) — Realtime exige usuário autenticado para canais privados
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN + comandos CLI
