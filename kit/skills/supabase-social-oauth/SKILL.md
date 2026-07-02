---
name: supabase-social-oauth
cost_tier: leve
description: Implementa login social OAuth no Supabase — signInWithOAuth com PKCE callback, signInWithIdToken, Google One Tap, FedCM, Apple, LinkedIn OIDC e providers customizados.
---

# Supabase — Social Login / OAuth

## Quando usar

LLM carrega esta skill quando implementar **login social com providers OAuth** no Supabase — qualquer fluxo de terceiro que redireciona o usuário para autenticação externa.

Trigger phrases:

- "login with Google", "signInWithOAuth", "OAuth Supabase"
- "OAuth callback Supabase", "exchangeCodeForSession", "callback route"
- "signInWithIdToken", "ID token Supabase"
- "Google One Tap", "FedCM", "use_fedcm_for_prompt"
- "Sign in with Apple", "Apple login Supabase"
- "GitHub login", "Facebook login", "LinkedIn login"
- "custom OAuth provider", "OIDC provider Supabase"
- "provider_token", "provider_refresh_token"
- "nonce OAuth", "nonce Google Apple"

## Regras absolutas

1. **SSR sempre usa PKCE.** `signInWithOAuth` em contexto server-side ou Next.js App Router exige `flowType: 'pkce'` no client e rota `/auth/callback` com `exchangeCodeForSession(code)`.
2. **`redirectTo` deve estar na allowlist** de Redirect URLs no Dashboard (`Authentication > URL Configuration`). Requisição com `redirectTo` fora da allowlist é rejeitada silenciosamente e redireciona para URL padrão.
3. **Nunca armazenar `provider_token`/`provider_refresh_token` em tabela pública** sem cifragem — são tokens de acesso do provider (Google, GitHub etc.) com escopo potencialmente amplo.
4. **Nome do Apple só vem no primeiro sign-in.** Salvar imediatamente via `updateUser({ data: { full_name } })`. Requisições subsequentes retornam campo vazio.
5. **Secret key da Apple rotaciona a cada 6 meses.** Configurar alarme de expiração; após expirar, todos os logins com Apple falham.
6. **`@supabase/ssr` sempre, `@supabase/auth-helpers-nextjs` nunca.** O pacote `auth-helpers-nextjs` está deprecated.
7. **Validar sessão no servidor com `getClaims()`**, nunca com `getSession()`.

## `signInWithOAuth` — fluxo PKCE (SSR / Next.js)

### Estrutura necessária

Dois arquivos obrigatórios:

1. **Função de login** (Client Component) — inicia o fluxo OAuth
2. **Route handler `/auth/callback`** — finaliza o fluxo trocando o `code` por uma sessão

### 1. Função de login (Client Component)

```ts
// components/LoginComGoogle.tsx
'use client'
import { createBrowserClient } from '@supabase/ssr'

function LoginComGoogle() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!  // sb_publishable_...
  )

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        // Parâmetros extras para o provider:
        queryParams: {
          access_type: 'offline',  // necessário para refresh token do Google
          prompt: 'consent',       // força exibição da tela de consentimento
        },
        scopes: 'email profile',   // escopos OAuth solicitados
      },
    })
  }

  return <button onClick={handleLogin}>Entrar com Google</button>
}
```

### 2. Route handler `/auth/callback`

```ts
// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Tratar proxy reverso em produção (Vercel, Nginx, etc.)
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

## Configuração de providers no Dashboard

### URL de callback obrigatória

Registre no console do provider (Google Cloud, GitHub Apps etc.) a seguinte URL de callback:

```
# Produção
https://<seu-project-ref>.supabase.co/auth/v1/callback

# Desenvolvimento local
http://localhost:54321/auth/v1/callback
```

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials
2. Criar OAuth 2.0 Client ID (Web application)
3. Authorized redirect URIs: adicionar URL de callback do Supabase
4. Dashboard Supabase: `Authentication > Sign in / Sign up > Google` — inserir Client ID e Client Secret

```ts
// Escopos comuns do Google
scopes: 'email profile'                 // padrão
scopes: 'email profile openid'          // + token de identidade
scopes: 'email profile https://www.googleapis.com/auth/calendar.readonly'  // + Google Calendar
```

### GitHub

1. GitHub > Settings > Developer Settings > OAuth Apps > New OAuth App
2. Authorization callback URL: URL de callback do Supabase
3. Dashboard Supabase: `Authentication > Sign in / Sign up > GitHub` — inserir Client ID e Client Secret

```ts
await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${location.origin}/auth/callback`,
    scopes: 'read:user user:email',  // escopos mínimos para login
  },
})
```

### Facebook

1. [Meta for Developers](https://developers.facebook.com/) > Create App > Consumer
2. Facebook Login > Settings > Valid OAuth Redirect URIs: URL de callback do Supabase
3. Dashboard Supabase: `Authentication > Sign in / Sign up > Facebook`

### Apple

```ts
await supabase.auth.signInWithOAuth({
  provider: 'apple',
  options: {
    redirectTo: `${location.origin}/auth/callback`,
  },
})
```

**Caveats críticos do Apple:**

- **Rotação da secret key a cada 6 meses** — configure um alarme/reminder. A secret key é um JWT gerado com a chave privada do Apple Developer. Após expirar, TODOS os logins com Apple falham.
- **Nome completo só vem no PRIMEIRO sign-in** — salve imediatamente:

```ts
// No callback após exchangeCodeForSession, verifique se é o primeiro login
const { data: { claims } } = await supabase.auth.getClaims()
const { data: { user } } = await supabase.auth.getUser()

// Apple retorna full_name apenas no primeiro login (identities[0].identity_data)
const identity = user?.identities?.find(i => i.provider === 'apple')
if (identity?.identity_data?.full_name) {
  await supabase.auth.updateUser({
    data: { full_name: identity.identity_data.full_name },
  })
}
```

### LinkedIn (OIDC)

LinkedIn usa o provider `linkedin_oidc` (não `linkedin`):

```ts
await supabase.auth.signInWithOAuth({
  provider: 'linkedin_oidc',  // ATENÇÃO: não 'linkedin'
  options: {
    redirectTo: `${location.origin}/auth/callback`,
    scopes: 'openid profile email',
  },
})
```

## `signInWithIdToken` — login nativo com Google / Apple

Quando o app já possui um ID token do provider (ex: Google Sign-In nativo em iOS/Android, ou após Google One Tap), use `signInWithIdToken` diretamente — sem redirecionamento.

```ts
// Google ID token (obtido do SDK do Google)
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: idTokenDoGoogle,   // JWT emitido pelo Google
  nonce: nonceRaw,          // IMPORTANTE: valor cru (antes do hash)
})

// Apple ID token (obtido do Sign in with Apple SDK)
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: idTokenDaApple,
  nonce: nonceRaw,
})
```

### Geração de nonce (obrigatória para Google/Apple)

O nonce previne ataques de replay. Enviar o hash SHA-256 para o provider, e o valor cru para o Supabase:

```ts
// Gerar nonce criptograficamente seguro
function generateNonce(): { raw: string; hashed: string } {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const raw = btoa(String.fromCharCode(...array))

  // Hash SHA-256 para o provider (Google/Apple recebe o hash)
  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    const hashed = btoa(String.fromCharCode(...new Uint8Array(hash)))
    return { raw, hashed }
  }) as any
}

// Uso
const { raw: nonceRaw, hashed: nonceHashed } = await generateNonce()

// Passe nonceHashed para o SDK do Google/Apple
// Passe nonceRaw para o Supabase no signInWithIdToken
```

## Google One Tap (FedCM)

```ts
// Exemplo completo com Google One Tap + FedCM
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// Inicializar Google Identity Services
function initializeGoogleOneTap() {
  const { raw: nonceRaw, hashed: nonceHashed } = /* generateNonce() */ {}

  window.google.accounts.id.initialize({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    nonce: nonceHashed,               // hash SHA-256 para o Google
    use_fedcm_for_prompt: true,       // habilita FedCM (Privacy Sandbox)
    callback: async ({ credential }) => {
      // credential = ID token do Google
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
        nonce: nonceRaw,              // valor cru para o Supabase
      })

      if (!error) {
        // Login bem-sucedido — redirecionar ou atualizar UI
        window.location.href = '/dashboard'
      }
    },
  })

  window.google.accounts.id.prompt()  // exibe o prompt do One Tap
}
```

**Pré-requisito:** adicionar domínio nas origens JavaScript autorizadas no Google Cloud Console.

## Provider Tokens (acesso a APIs do provider)

```ts
// provider_token e provider_refresh_token ficam na sessão, NÃO no banco
const { data: { session } } = await supabase.auth.getSession()

const providerToken = session?.provider_token          // access token do Google/GitHub
const providerRefreshToken = session?.provider_refresh_token  // refresh token (se solicitado)

// Usar provider_token para chamar API do Google diretamente
const response = await fetch('https://www.googleapis.com/drive/v3/files', {
  headers: { Authorization: `Bearer ${providerToken}` },
})
```

**Aviso importante:** `provider_token`/`provider_refresh_token` são armazenados na sessão local (cookie), mas **não são persistidos no banco de dados** pelo Supabase. Se precisar do refresh token após o usuário fechar o browser:

1. Salve `provider_refresh_token` em tabela protegida (com RLS e campo cifrado)
2. Para Google: passe `queryParams: { access_type: 'offline', prompt: 'consent' }` no `signInWithOAuth` para garantir que o refresh token seja emitido

```ts
// Salvar provider_refresh_token no banco (se necessário)
if (session?.provider_refresh_token) {
  await supabase.from('oauth_tokens').upsert({
    user_id: session.user.id,
    provider: 'google',
    refresh_token: session.provider_refresh_token,  // considerar cifrar este valor
    updated_at: new Date().toISOString(),
  })
}
```

## Custom OAuth / OIDC Providers

Para providers não suportados nativamente (Okta, Auth0 como IdP, Keycloak etc.):

```ts
// Providers customizados usam prefixo 'custom:'
await supabase.auth.signInWithOAuth({
  provider: 'custom:meu-provider',
  options: { redirectTo: `${location.origin}/auth/callback` },
})
```

**Configuração via Management API (server-side com service_role):**

```ts
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!  // sb_secret_... apenas no servidor
)

// Criar provider OAuth2 customizado
await adminClient.auth.admin.customProviders.createProvider({
  type: 'oauth2',
  provider_id: 'meu-provider',          // será 'custom:meu-provider' no signInWithOAuth
  authorization_endpoint: 'https://auth.meuidentityprovider.com/oauth/authorize',
  token_endpoint: 'https://auth.meuidentityprovider.com/oauth/token',
  client_id: process.env.CUSTOM_OAUTH_CLIENT_ID!,
  client_secret: process.env.CUSTOM_OAUTH_CLIENT_SECRET!,
  // PKCE habilitado por padrão em custom providers
})

// Criar provider OIDC (OpenID Connect)
await adminClient.auth.admin.customProviders.createProvider({
  type: 'oidc',
  provider_id: 'meu-oidc',
  issuer_url: 'https://accounts.meuidentityprovider.com',
  client_id: process.env.OIDC_CLIENT_ID!,
  client_secret: process.env.OIDC_CLIENT_SECRET!,
})
```

## Anti-patterns

### 1. Implicit flow no servidor (SSR)

**Errado:**
```ts
// Server Component ou Route Handler
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: '/dashboard' },  // sem rota /auth/callback
})
// O código de autorização retorna como fragment (#access_token=...) — servidor nunca o vê
```

**Por quê:** em fluxo implícito, tokens chegam no URL fragment (`#`). Navegadores não enviam fragmentos ao servidor — é uma feature de segurança do HTTP. O servidor nunca processa o token.

**Certo:** sempre use PKCE com rota `/auth/callback` que chama `exchangeCodeForSession(code)`.

### 2. Falta da rota `/auth/callback`

**Errado:**
```ts
// Apenas define o signInWithOAuth sem criar o route handler
await supabase.auth.signInWithOAuth({ provider: 'github' })
// Sem app/auth/callback/route.ts — usuário fica preso em loop de redirect
```

**Por quê:** sem a rota callback, o código de autorização nunca é trocado por sessão. O Supabase redireciona de volta ao app com `?code=...`, mas nenhum handler processa o código.

**Certo:** criar `app/auth/callback/route.ts` com `exchangeCodeForSession(code)` antes de implementar qualquer OAuth.

### 3. `redirectTo` fora da allowlist

**Errado:**
```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'https://meuapp.com/pagina-especial' },
  // 'https://meuapp.com/pagina-especial' não está na allowlist
})
```

**Por quê:** o Supabase ignora silenciosamente `redirectTo` fora da allowlist e redireciona para a URL padrão do projeto. O usuário aterrissa na página errada — confuso e difícil de debugar.

**Certo:** adicionar TODAS as URLs de destino em `Authentication > URL Configuration > Redirect URLs` no Dashboard.

### 4. Assumir que Apple retorna nome sempre

**Errado:**
```ts
// No callback após login com Apple
const { data: { user } } = await supabase.auth.getUser()
const fullName = user.user_metadata.full_name  // retorna undefined no segundo login
await db.updateUserName(user.id, fullName)     // salva undefined — dado perdido
```

**Por quê:** Apple envia `full_name` apenas no PRIMEIRO login. Nas requisições subsequentes, o campo fica vazio.

**Certo:** salvar o nome imediatamente no primeiro login e verificar se já existe antes de sobrescrever com vazio.

### 5. Armazenar provider_token em campo público sem proteção

**Errado:**
```sql
-- Coluna pública sem RLS — qualquer usuário autenticado pode ler
alter table public.usuarios add column google_token text;
```

**Por quê:** `provider_token` é um access token OAuth com escopo potencialmente amplo (ex: acesso ao Google Drive). Vazar esse token expõe a conta Google do usuário.

**Certo:** se precisar persistir, use coluna com RLS `using (auth.uid() = user_id)` e considere cifrar o valor com `pgsodium` ou vault do Supabase.

### 6. Não tratar `x-forwarded-host` na rota callback

**Errado:**
```ts
// Na rota callback — funciona em desenvolvimento mas quebra em produção atrás de proxy
return NextResponse.redirect(`${origin}${next}`)
```

**Por quê:** em produção atrás de proxy reverso (Vercel, Nginx, Cloudflare), `origin` pode ser o IP interno do container, não o domínio público.

**Certo:** verificar `x-forwarded-host` header:
```ts
const forwardedHost = request.headers.get('x-forwarded-host')
const isLocalEnv = process.env.NODE_ENV === 'development'
const redirectBase = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)
return NextResponse.redirect(`${redirectBase}${next}`)
```

## Ver também

- [supabase-auth-methods](../supabase-auth-methods/SKILL.md) — fluxos de auth de usuário final (senha, OTP, anônimo, Web3)
- [supabase-auth-sessions](../supabase-auth-sessions/SKILL.md) — PKCE vs implicit flow, lifetime, refresh token reuse
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — configuração completa do cliente SSR com `@supabase/ssr`
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) — RBAC via Custom Access Token Auth Hook
- [supabase-rls-defense-in-depth](../supabase-rls-defense-in-depth/SKILL.md) — camadas de segurança complementares ao OAuth
- [supabase-jwt-signing-keys](../supabase-jwt-signing-keys/SKILL.md) — rotação e validação de chaves JWT
- [supabase-edge-functions-auth](../supabase-edge-functions-auth/SKILL.md) — validação de JWT em Edge Functions
