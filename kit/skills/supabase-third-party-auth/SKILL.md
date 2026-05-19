---
name: supabase-third-party-auth
description: Use ao integrar Clerk, Firebase, Auth0, AWS Cognito ou WorkOS como provedor de autenticação primário junto ao Supabase, via opção accessToken no createClient.
---

# Supabase — Third-Party Auth (Clerk, Firebase, Auth0, Cognito, WorkOS)

## Quando usar

LLM carrega esta skill quando o projeto usar um **provedor de autenticação externo** (Clerk, Firebase Auth, Auth0, AWS Cognito, WorkOS) e precisar integrar com o banco de dados Supabase mantendo RLS funcional.

Trigger phrases:

- "Clerk Supabase", "Firebase auth Supabase"
- "Auth0 Supabase", "AWS Cognito Supabase"
- "WorkOS Supabase", "third-party auth"
- "accessToken option Supabase client"
- "JWT externo Supabase", "outro provedor de auth com RLS"
- "integrar Clerk com banco Supabase"

## Princípio canônico

O Supabase Third-Party Auth permite que JWTs emitidos por provedores externos sejam aceitos pelo PostgREST — assim, RLS policies continuam funcionando com `auth.uid()` e `auth.jwt()` sem duplicar usuários no `auth.users` do Supabase.

**Como funciona:**

1. O provedor externo emite um JWT assinado com chaves assimétricas (RS256/ES256)
2. Você configura a integração no Supabase apontando para o OIDC Issuer Discovery URL do provedor
3. Supabase valida o JWT contra as chaves públicas do provedor (cache de ~30min)
4. PostgREST aceita o token e `auth.uid()` retorna o `sub` do JWT do provedor
5. RLS policies funcionam normalmente

**Quando usar third-party auth vs Supabase Auth nativo:**

| Cenário | Recomendação |
|---------|--------------|
| Já usa Clerk/Auth0 em produção e quer adicionar Supabase como banco | Third-party auth |
| App novo sem auth definida | Supabase Auth nativo |
| Precisa de features avançadas de MFA/SSO do provedor externo | Third-party auth |
| Quer unificar auth + banco na mesma plataforma | Supabase Auth nativo |

**Limitação importante:** não é possível desabilitar o Supabase Auth ao usar third-party auth — ambos coexistem.

## Limitações e requisitos

1. **JWT DEVE ser assimétrico com header `kid`** — HS256 e PS256 não são suportados
2. **Chaves do provedor em cache por ~30min** — rotação de chaves pode causar janela de falha
3. **Claim `role: 'authenticated'` obrigatório** — todos os usuários precisam deste claim no JWT; sem ele, o PostgREST trata como `anon`
4. **Supabase Auth não pode ser desabilitado** — third-party e nativo coexistem sempre
5. **Self-hosting exige RLS RESTRICTIVE por `iss`/`aud`** — sem isso, qualquer JWT assimétrico seria aceito

## Setup — Habilitar a integração

### Via Dashboard

`Authentication > Third-Party Auth` → Adicionar provedor → Selecionar tipo → Preencher campos.

### Via `config.toml` (desenvolvimento local)

```toml
# Clerk
[auth.third_party.clerk]
enabled = true
domain = "meu-tenant.clerk.accounts.dev"

# Firebase
[auth.third_party.firebase]
enabled = true
project_id = "meu-projeto-firebase"

# Auth0
[auth.third_party.auth0]
enabled = true
tenant = "meu-tenant.us.auth0.com"

# AWS Cognito
[auth.third_party.aws_cognito]
enabled = true
user_pool_id = "us-east-1_XXXXXXXX"
user_pool_region = "us-east-1"

# WorkOS
[auth.third_party.workos]
enabled = true
issuer = "https://api.workos.com"
```

## Client Setup — Opção `accessToken`

**Regra canônica:** usar a opção `accessToken` async no `createClient` — NÃO injetar o JWT via header `Authorization` custom.

```ts
// lib/supabase/client.ts — Clerk como exemplo
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/nextjs'

export function createClerkSupabaseClient() {
  const { getToken } = useAuth()

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,  // sb_publishable_... ou anon key
    {
      accessToken: async () => {
        // Retorna o JWT do Clerk — Supabase usa para autenticar requests
        return getToken()
      },
    }
  )
}
```

```ts
// Server Component / Route Handler (Next.js App Router com Clerk)
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export async function createServerClient() {
  const { getToken } = await auth()

  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => {
        return getToken()
      },
    }
  )
}
```

## Por provedor — Configuração específica

### Clerk

Clerk inclui automaticamente `role: 'authenticated'` via claim `role`.

```toml
[auth.third_party.clerk]
enabled = true
domain = "meu-tenant.clerk.accounts.dev"
# domain é o issuer — obtido em Clerk Dashboard > Domains
```

```ts
// Clerk — client com accessToken
import { useAuth } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'

function useSupabaseClient() {
  const { getToken } = useAuth()

  return createClient(URL, PUBLISHABLE_KEY, {
    accessToken: async () => getToken(),  // JWT do Clerk
  })
}
```

**RLS com Clerk:** `auth.uid()` retorna o Clerk user ID (string `user_xxx`).

```sql
-- Policy usando ID do Clerk
create policy "Usuário vê seus dados" on public.perfis
  for select to authenticated
  using (auth.uid()::text = clerk_user_id);
```

### Firebase Auth

Firebase JWT **não inclui** `role: 'authenticated'` por padrão — **todos os usuários precisam** deste claim via:

**Opção A — Blocking Functions (onCreate):**
```js
// functions/index.js
const { beforeUserCreated } = require('firebase-functions/v2/identity')

exports.beforecreated = beforeUserCreated((event) => {
  return {
    customClaims: { role: 'authenticated' },
  }
})
```

**Opção B — Custom claim em usuários existentes (Admin SDK):**
```ts
// scripts/migrate-firebase-users.ts
import admin from 'firebase-admin'

const users = await admin.auth().listUsers()
for (const user of users.users) {
  await admin.auth().setCustomUserClaims(user.uid, { role: 'authenticated' })
}
```

```toml
[auth.third_party.firebase]
enabled = true
project_id = "meu-projeto-firebase"
```

**Self-hosting com Firebase — RLS RESTRICTIVE obrigatório:**

```sql
-- Sem isto, qualquer JWT Firebase seria aceito (incluindo de outros projetos)
create policy "Apenas usuários deste projeto Firebase" on public.dados
  as restrictive for all to authenticated
  using (
    auth.jwt() ->> 'iss' = 'https://securetoken.google.com/meu-projeto-firebase'
    AND auth.jwt() ->> 'aud' = 'meu-projeto-firebase'
  );
```

### Auth0

Auth0 JWT vem em **dois sabores** — usar o **ID token** (não o access token):

- Access token do Auth0: audience é a API Auth0, não validado pelo Supabase
- **ID token do Auth0**: contém claims de usuário, validado como JWT OIDC

O claim `role` precisa ser adicionado via Auth0 Action:

```js
// Auth0 Action — onExecutePostLogin
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim('role', 'authenticated')
  // Adicionar outros claims customizados se necessário
  api.idToken.setCustomClaim('org_id', event.organization?.id)
}
```

```toml
[auth.third_party.auth0]
enabled = true
tenant = "meu-tenant.us.auth0.com"
# Auth0 OIDC Discovery: https://meu-tenant.us.auth0.com/.well-known/openid-configuration
```

```ts
// Client com Auth0 — usar getIdTokenClaims para obter o ID token
import { useAuth0 } from '@auth0/auth0-react'

function useSupabaseClient() {
  const { getIdTokenClaims } = useAuth0()

  return createClient(URL, PUBLISHABLE_KEY, {
    accessToken: async () => {
      const claims = await getIdTokenClaims()
      return claims?.__raw ?? null   // __raw = ID token JWT string
    },
  })
}
```

**HS256 e PS256 não são suportados** pelo Supabase — configurar Auth0 para usar RS256.

### AWS Cognito

Cognito requer custom claim `role: 'authenticated'` via **Pre-Token Generation Lambda**:

```python
# Lambda — pre_token_generation_v2
def handler(event, context):
    event['response']['claimsAndScopeOverrideDetails'] = {
        'idTokenGeneration': {
            'claimsToAddOrOverride': {
                'role': 'authenticated'
            }
        }
    }
    return event
```

```toml
[auth.third_party.aws_cognito]
enabled = true
user_pool_id = "us-east-1_XXXXXXXX"
user_pool_region = "us-east-1"
```

```ts
// Client com Cognito (usando AWS Amplify)
import { fetchAuthSession } from 'aws-amplify/auth'

function createCognitoSupabaseClient() {
  return createClient(URL, PUBLISHABLE_KEY, {
    accessToken: async () => {
      const session = await fetchAuthSession()
      // Usar ID token (inclui custom claims configurados na Lambda)
      return session.tokens?.idToken?.toString() ?? null
    },
  })
}
```

```sql
-- RLS com Cognito — auth.uid() retorna o sub do usuário Cognito
create policy "Usuário vê seus dados" on public.dados
  for select to authenticated
  using (
    auth.uid()::text = cognito_user_sub
    AND auth.jwt() ->> 'iss' LIKE '%cognito-idp.%'
  );
```

### WorkOS

WorkOS usa JWT Template para configurar o claim `role`:

```toml
[auth.third_party.workos]
enabled = true
issuer = "https://api.workos.com"
```

No WorkOS Dashboard: `JWT Templates` → criar template com claim:

```json
{
  "role": "authenticated",
  "org_id": "{{organization.id}}",
  "email": "{{user.email}}"
}
```

```ts
// Client com WorkOS
import { useAuth } from '@workos-inc/authkit-nextjs'

function createWorkOSSupabaseClient() {
  const { getAccessToken } = useAuth()

  return createClient(URL, PUBLISHABLE_KEY, {
    accessToken: async () => {
      return getAccessToken()
    },
  })
}
```

## Verificar JWT no servidor com getClaims()

Ao usar `@supabase/ssr` no servidor, use `getClaims()` para validar o JWT do provedor externo:

```ts
// app/api/dados/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookies().getAll() } }
  )

  // getClaims() valida assinatura contra JWKS do provedor
  const { data: { claims }, error } = await supabase.auth.getClaims()
  if (error || !claims) return new Response('Não autorizado', { status: 401 })

  // claims.sub = user ID do provedor, claims.email, etc.
  return Response.json({ userId: claims.sub })
}
```

## Regras absolutas

1. **JWT do provedor deve ser assimétrico com header `kid`** — HS256 e PS256 não são suportados; verificar configuração do provedor antes de integrar
2. **Todos os usuários precisam do claim `role: 'authenticated'`** — sem ele, PostgREST trata como `anon` e RLS policies para `authenticated` não se aplicam
3. **Usar a opção `accessToken` do client, NÃO header Authorization custom** — a opção `accessToken` é o mecanismo oficial; header custom não funciona com `@supabase/ssr`
4. **Self-hosting exige RLS RESTRICTIVE por `iss`/`aud`** — sem isolamento por issuer, qualquer JWT assimétrico válido de outro projeto seria aceito
5. **Nunca usar `getSession()` no servidor** — usar `getClaims()` que valida a assinatura; `getSession()` apenas decodifica sem validar
6. **Nunca usar `auth-helpers-nextjs`** — usar `@supabase/ssr` exclusivamente

## Anti-patterns

### Anti-pattern 1: JWT HS256 do provedor

**Errado:**
```
Auth0 configurado com algoritmo HS256 → token enviado ao Supabase → erro de validação
```

**Por quê:** Supabase Third-Party Auth valida JWTs contra a JWKS pública do provedor (assimétrico). HS256 usa shared secret — não há JWKS público, validação falha.

**Certo:** configurar o provedor para emitir tokens RS256 ou ES256; em Auth0, verificar `Applications > Advanced Settings > JSON Web Token > Algorithm = RS256`.

### Anti-pattern 2: Esquecer o claim `role: 'authenticated'`

**Errado:**
```ts
// Firebase — usuário criado sem custom claim
await admin.auth().createUser({ email: 'user@exemplo.com' })
// JWT gerado: { sub: '...', email: '...', iat: ..., exp: ... }
// FALTA: role: 'authenticated' → PostgREST trata como anon!
```

**Por quê:** sem `role: 'authenticated'`, as RLS policies para o role `authenticated` não são avaliadas — usuário vê apenas o que políticas `anon` permitem (geralmente nada).

**Certo:** configurar blocking function (Firebase), Action (Auth0), Lambda (Cognito) ou JWT Template (WorkOS) para incluir `role: 'authenticated'` em todos os tokens.

### Anti-pattern 3: Header Authorization custom em vez de `accessToken`

**Errado:**
```ts
const supabase = createClient(URL, KEY, {
  global: {
    headers: {
      Authorization: `Bearer ${clerkToken}`,  // ERRADO — não funciona com ssr
    }
  }
})
```

**Por quê:** injetar `Authorization` global quebra o refresh automático de token e não funciona com `@supabase/ssr` (que gerencia headers por request). A opção `accessToken` é chamada em cada request, garantindo tokens frescos.

**Certo:** sempre usar a opção `accessToken: async () => getToken()` no `createClient`.

### Anti-pattern 4: Self-hosting sem RLS RESTRICTIVE por iss/aud

**Errado:**
```sql
-- Self-hosting sem isolamento de issuer
-- Qualquer JWT RS256 de qualquer projeto Firebase seria aceito!
create policy "Usuários podem ver seus dados" on public.dados
  for select to authenticated
  using (auth.uid() = user_id);
```

**Por quê:** em self-hosting, Supabase pode ser configurado para aceitar JWTs de múltiplos issuers. Sem filtrar por `iss`/`aud`, token de outro projeto do mesmo provedor seria válido.

**Certo:** adicionar policy RESTRICTIVE verificando `iss` e `aud`:

```sql
create policy "Apenas Firebase deste projeto" on public.dados
  as restrictive for all to authenticated
  using (
    auth.jwt() ->> 'iss' = 'https://securetoken.google.com/meu-projeto'
    AND auth.jwt() ->> 'aud' = 'meu-projeto'
  );
```

## Ver também

- [supabase-oauth-server](../supabase-oauth-server/SKILL.md) — Supabase como identity provider (direção oposta)
- [supabase-jwt-signing-keys](../supabase-jwt-signing-keys/SKILL.md) — algoritmos assimétricos e JWKS
- [supabase-enterprise-sso-saml](../supabase-enterprise-sso-saml/SKILL.md) — SSO SAML enterprise nativo do Supabase
- [supabase-auth-methods](../supabase-auth-methods/SKILL.md) — panorama de todos os métodos de auth
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — @supabase/ssr, getClaims(), cookies
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — RLS com auth.uid() e auth.jwt() claims
