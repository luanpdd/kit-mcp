---
name: supabase-oauth-server
description: Use ao implementar OAuth 2.1 Server com Supabase como identity provider, incluindo autenticação MCP, PKCE, OIDC, registro de clients e RLS por client_id.
---

# Supabase — OAuth 2.1 Server (Identity Provider & MCP Auth)

## Quando usar

LLM carrega esta skill quando o projeto precisar do **Supabase como identity provider OAuth 2.1 / OIDC** — seja para autenticar agentes de IA via MCP, apps mobile/desktop, developer platforms ou enterprise SSO.

Trigger phrases:

- "OAuth 2.1 server Supabase", "Supabase as identity provider"
- "Sign in with my app", "MCP authentication"
- "OAuth client registration", "authorization endpoint Supabase"
- "OIDC server", "supabase.auth.oauth"
- "Model Context Protocol auth", "agente MCP autenticado"
- "dynamic client registration Supabase"

## Princípio canônico

O Supabase OAuth Server transforma seu projeto Supabase em um **authorization server OAuth 2.1 + OIDC completo**. Em vez de apenas consumir provedores OAuth externos (Google, GitHub), seu app **se torna** o provedor — os usuários fazem login com a sua plataforma.

**Casos de uso principais:**

| Caso | Descrição |
|------|-----------|
| Developer platform | "Login com MinhaPlatforma" para apps de terceiros |
| MCP Server auth | Agentes de IA se autenticam como usuários existentes |
| Apps mobile/desktop | Token-based auth sem secret key exposto |
| Enterprise SSO | Federar autenticação via OIDC para ferramentas internas |

**Padrões suportados:**

- **OAuth 2.1** com PKCE obrigatório (código de autorização + PKCE — fluxo implícito removido na v2.1)
- **OIDC** — ID tokens, endpoint UserInfo, discovery automático
- **Scopes**: `openid`, `email`, `profile`, `phone`
- **Dynamic Client Registration** — clients se registram programaticamente
- **JWKS** — validação de chaves públicas
- **Authorization Code + Refresh Token** flows

## Habilitando o OAuth Server

### Via Dashboard

`Authentication > OAuth Server` → habilitar toggle.

### Via `config.toml` (desenvolvimento local)

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/authorize"       # rota da UI de consentimento no seu app
allow_dynamic_registration = true           # clients se registram via API
```

`authorization_url_path` aponta para a rota do **seu app** que renderiza a UI de consentimento. Supabase redireciona o usuário para lá com `?authorization_id=<uuid>` na URL.

## Endpoints expostos automaticamente

| Endpoint | Função |
|----------|--------|
| `GET /auth/v1/oauth/authorize` | Inicia o fluxo de autorização |
| `POST /auth/v1/oauth/token` | Troca code por tokens / refresh |
| `GET /auth/v1/.well-known/jwks.json` | Chaves públicas para validação de JWT |
| `GET /auth/v1/.well-known/openid-configuration` | Discovery OIDC |
| `GET /auth/v1/.well-known/oauth-authorization-server/auth/v1` | Discovery OAuth — **MCP usa este** |
| `GET /auth/v1/oauth/userinfo` | Dados do usuário autenticado (OIDC) |

O endpoint de **MCP discovery** (`/auth/v1/.well-known/oauth-authorization-server/auth/v1`) é detectado automaticamente por clientes MCP como o Claude Desktop e implementações FastMCP.

## Authorization UI — página de consentimento

Supabase redireciona o browser do usuário para `authorization_url_path?authorization_id=<uuid>`. Você deve criar esta rota no seu app.

```tsx
// app/authorize/page.tsx (Next.js App Router)
import { createClient } from '@/lib/supabase/server'

interface Props {
  searchParams: { authorization_id?: string }
}

export default async function AuthorizePage({ searchParams }: Props) {
  const authorizationId = searchParams.authorization_id
  if (!authorizationId) return <p>Parâmetro inválido.</p>

  // IMPORTANTE: inicializar client DENTRO do request handler
  const supabase = await createClient()

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !data) return <p>Autorização inválida ou expirada.</p>

  const { client, scopes } = data

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-lg shadow">
      <h1 className="text-xl font-bold mb-4">Autorizar acesso</h1>
      <p className="mb-2">
        <strong>{client.name}</strong> está solicitando acesso à sua conta.
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Permissões solicitadas: {scopes.join(', ')}
      </p>

      <ConsentForm authorizationId={authorizationId} />
    </div>
  )
}
```

```tsx
// app/authorize/ConsentForm.tsx — Client Component
'use client'
import { createClient } from '@/lib/supabase/client'

export function ConsentForm({ authorizationId }: { authorizationId: string }) {
  const supabase = createClient()

  async function handleApprove() {
    const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId)
    if (error) { alert('Erro ao aprovar: ' + error.message); return }
    // data.redirect_uri — redirecionar o browser para esta URL
    window.location.href = data.redirect_uri
  }

  async function handleDeny() {
    const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId)
    if (error) { alert('Erro ao negar: ' + error.message); return }
    window.location.href = data.redirect_uri
  }

  return (
    <div className="flex gap-4">
      <button onClick={handleApprove} className="btn-primary">Autorizar</button>
      <button onClick={handleDeny} className="btn-secondary">Negar</button>
    </div>
  )
}
```

**Fluxo da UI de consentimento:**

1. `getAuthorizationDetails(id)` — busca dados do client e scopes solicitados
2. Renderiza UI para o usuário revisar
3. `approveAuthorization(id)` → retorna `redirect_uri` com `code` → browser navega
4. `denyAuthorization(id)` → retorna `redirect_uri` com `error=access_denied`

## Registro de OAuth Clients

### Via Admin API (server-side com service_role)

```ts
// lib/oauth-clients.ts — executar no backend
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // nunca expor no cliente
)

// Client público (apps mobile/desktop, MCP servers sem secret)
const { data: publicClient, error } = await supabaseAdmin.auth.admin.oauth.createClient({
  name: 'Meu App Mobile',
  redirect_uris: ['myapp://oauth/callback'],
  client_type: 'public',                     // sem client_secret
  token_endpoint_auth_method: 'none',        // PKCE obrigatório
})

console.log(publicClient?.client_id)  // sb_publishable_...

// Client confidencial (server-side apps com secret)
const { data: confidentialClient } = await supabaseAdmin.auth.admin.oauth.createClient({
  name: 'API Server Parceiro',
  redirect_uris: ['https://parceiro.exemplo.com/auth/callback'],
  client_type: 'confidential',
  token_endpoint_auth_method: 'client_secret_basic', // ou 'client_secret_post'
})

console.log(confidentialClient?.client_id)     // identificador
console.log(confidentialClient?.client_secret) // guardar com segurança — exibido UMA VEZ
```

### Client types

| Tipo | `token_endpoint_auth_method` | Uso |
|------|------------------------------|-----|
| `public` | `none` | Mobile, desktop, MCP, SPA |
| `confidential` | `client_secret_basic` (padrão) | Server-side |
| `confidential` | `client_secret_post` | Body params em vez de header |

## Fluxo Authorization Code + PKCE

### Passo 1: Gerar PKCE

```ts
// utils/pkce.ts
function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function generatePKCE() {
  // code_verifier: string aleatório de 43-128 chars
  const codeVerifier = base64urlEncode(crypto.getRandomValues(new Uint8Array(32)))

  // code_challenge: SHA-256(code_verifier) em Base64-URL
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const codeChallenge = base64urlEncode(digest)

  return { codeVerifier, codeChallenge }
}
```

### Passo 2: Iniciar autorização

```ts
const { codeVerifier, codeChallenge } = await generatePKCE()

// Armazenar code_verifier de forma segura (sessão ou localStorage criptografado)
sessionStorage.setItem('oauth_code_verifier', codeVerifier)

const params = new URLSearchParams({
  response_type: 'code',
  client_id: 'meu-client-id',
  redirect_uri: 'https://meuapp.com/auth/callback',
  scope: 'openid email profile',
  state: crypto.randomUUID(),         // CSRF protection
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',      // único método suportado
})

// Redireciona para Supabase
window.location.href = `${SUPABASE_URL}/auth/v1/oauth/authorize?${params}`
```

### Passo 3: Trocar código por tokens (callback)

```ts
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const codeVerifier = sessionStorage.getItem('oauth_code_verifier')!

  const tokenResponse = await fetch(`${SUPABASE_URL}/auth/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'meu-client-id',
      code: code!,
      redirect_uri: 'https://meuapp.com/auth/callback',
      code_verifier: codeVerifier,    // PKCE — valida o challenge original
    }),
  })

  const tokens = await tokenResponse.json()
  // tokens.access_token, tokens.refresh_token, tokens.id_token (se openid scope)
}
```

### Passo 4: Refresh Token

```ts
const refreshResponse = await fetch(`${SUPABASE_URL}/auth/v1/oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: 'meu-client-id',
    refresh_token: storedRefreshToken,
  }),
})
```

## MCP Authentication — Destaque Especial

Este kit-mcp é em si um **servidor MCP** — esta seção é especialmente relevante.

### Por que Supabase + MCP funciona

O protocolo MCP 2025 exige que servidores exponham um endpoint de discovery OAuth compatível com RFC 8414. O Supabase expõe automaticamente:

```
GET https://<project>.supabase.co/auth/v1/.well-known/oauth-authorization-server/auth/v1
```

Clientes MCP (Claude Desktop, FastMCP, SDK oficial) detectam este endpoint e executam o fluxo OAuth 2.1 automaticamente — sem configuração manual de endpoints.

### MCP Server com FastMCP autenticado

```ts
// server.ts — MCP server com autenticação Supabase OAuth
import { FastMCP } from 'fastmcp'
import { createClient } from '@supabase/supabase-js'

const server = new FastMCP({
  name: 'meu-mcp-server',
  version: '1.0.0',
  // FastMCP detecta o discovery automático do Supabase
  oauth: {
    issuer: process.env.SUPABASE_URL + '/auth/v1',
    clientId: process.env.MCP_OAUTH_CLIENT_ID!,
    scopes: ['openid', 'email', 'profile'],
  },
})

server.addTool({
  name: 'get-my-data',
  description: 'Retorna dados do usuário autenticado',
  execute: async (args, context) => {
    // context.accessToken — JWT do usuário autenticado via OAuth
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,  // usar sb_publishable_... em novos projetos
      { global: { headers: { Authorization: `Bearer ${context.accessToken}` } } }
    )

    const { data, error } = await supabase.from('my_table').select('*')
    return data
  },
})

server.start({ transportType: 'stdio' })
```

### Registrar o client MCP no Supabase

```ts
// scripts/register-mcp-client.ts
const { data } = await supabaseAdmin.auth.admin.oauth.createClient({
  name: 'MCP Server - Produção',
  redirect_uris: ['http://localhost:3333/callback'],  // FastMCP local server
  client_type: 'public',            // sem secret — PKCE protege
  token_endpoint_auth_method: 'none',
})

console.log('MCP_OAUTH_CLIENT_ID=' + data?.client_id)
```

### Dynamic Client Registration (DCR)

Com `allow_dynamic_registration = true`, clientes MCP se registram automaticamente:

```bash
# Clientes chamam este endpoint automaticamente (RFC 7591)
POST https://<project>.supabase.co/auth/v1/oauth/clients
Content-Type: application/json

{
  "client_name": "Claude Desktop",
  "redirect_uris": ["http://localhost:63856/callback"],
  "token_endpoint_auth_method": "none"
}
```

## Access Token Claims

O access token JWT gerado pelo OAuth Server contém o claim especial `client_id`:

```json
{
  "sub": "user-uuid",
  "role": "authenticated",
  "client_id": "meu-client-id",   // identifica QUAL client OAuth emitiu o token
  "email": "user@exemplo.com",
  "iat": 1700000000,
  "exp": 1700003600
}
```

Use `client_id` em políticas RLS para controlar acesso por client OAuth.

## OIDC — ID Tokens

Ao incluir o scope `openid`, o token endpoint retorna um `id_token` além do `access_token`.

**Requisito crítico:** ID tokens **exigem** algoritmo assimétrico (RS256 ou ES256). Configure signing keys assimétricas — veja skill [supabase-jwt-signing-keys](../supabase-jwt-signing-keys/SKILL.md).

```ts
// Decodificar ID token (client-side)
import { jwtDecode } from 'jwt-decode'

const idTokenClaims = jwtDecode(tokens.id_token)
// { sub, email, name, picture, phone, iat, exp, aud, iss }
```

## Token Security + RLS por client_id

Scopes controlam **quais dados OIDC** são retornados (email, profile, phone). Scopes **NÃO** controlam acesso ao banco de dados — isso é responsabilidade do RLS.

Use o claim `client_id` em políticas para separar acesso por client OAuth:

```sql
-- Conceder acesso apenas a um client OAuth específico
create policy "Apenas client parceiro pode ler dados_parceiro" on public.dados_parceiro
  for select to authenticated
  using (
    (auth.jwt() ->> 'client_id') = 'client-id-do-parceiro'
  );

-- Restringir dados sensíveis de qualquer client OAuth
create policy "Dados financeiros apenas via sessão direta" on public.dados_financeiros
  for select to authenticated
  using (
    -- NULL client_id = sessão direta (não OAuth); presença = token OAuth
    (auth.jwt() ->> 'client_id') IS NULL
  );

-- Separar políticas: sessão direta vs qualquer client OAuth
create policy "Acesso direto ou client autorizado" on public.perfil_publico
  for select to authenticated
  using (
    (auth.jwt() ->> 'client_id') IS NULL                     -- sessão direta
    OR (auth.jwt() ->> 'client_id') = 'client-aprovado'      -- client OAuth específico
  );
```

## Custom Access Token Hook por client_id

Use o Auth Hook para personalizar `audience` ou claims com base no `client_id`:

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  client_id text;
begin
  claims := event->'claims';
  client_id := claims ->> 'client_id';

  -- Adicionar audience específica por client
  if client_id = 'parceiro-externo-id' then
    claims := jsonb_set(claims, '{aud}', '"parceiro-externo"');
    claims := jsonb_set(claims, '{custom_plan}', '"enterprise"');
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;
```

## Gerenciar Grants do Usuário

```ts
// Listar todos os clients OAuth com acesso concedido pelo usuário
const { data: grants } = await supabase.auth.oauth.getUserGrants()
// [{ client_id, client_name, scopes, granted_at }]

// Revogar acesso de um client específico
const { error } = await supabase.auth.oauth.revokeGrant('client-id-para-revogar')
```

## Regras absolutas

1. **PKCE obrigatório** — OAuth 2.1 remove fluxo implícito; todo client usa `code_challenge_method: 'S256'`
2. **Signing keys assimétricas (RS256/ES256)** — ID tokens **falham** com HS256; configure antes de habilitar OIDC
3. **Redirect URIs com match exato** — sem wildcards em produção; cada URI deve ser cadastrada explicitamente
4. **Nunca expor `service_role` key no cliente** — registro de clients via Admin API é sempre server-side
5. **Inicializar client Supabase DENTRO do request handler** — nunca em escopo de módulo (vazamento entre requests em Vercel Fluid compute / Edge Functions com conexões reutilizadas)
6. **RLS com `client_id` controla acesso ao banco** — scopes controlam apenas dados OIDC (email, profile); RLS é a única barreira real para dados do banco
7. **Separar clients por ambiente** — client de dev ≠ client de produção; redirect URIs não podem cruzar ambientes

## Anti-patterns

### Anti-pattern 1: Usar HS256 para ID tokens

**Errado:**
```toml
[auth]
jwt_secret = "meu-secret-compartilhado"  # HS256 — ID tokens FALHAM
```

**Por quê:** a especificação OIDC exige algoritmo assimétrico para ID tokens — HS256 é shared secret e não permite validação por terceiros sem expor o secret. Supabase rejeita ID token com HS256.

**Certo:** configurar signing key assimétrica (ES256 recomendado) antes de habilitar o OAuth Server com scope `openid`.

### Anti-pattern 2: Redirect URI com wildcard em produção

**Errado:**
```ts
await supabaseAdmin.auth.admin.oauth.createClient({
  redirect_uris: ['https://*.meuapp.com/callback'],  // wildcard — BLOQUEADO
})
```

**Por quê:** wildcards em redirect URIs são vetores de open redirect — atacante pode redirecionar o code para domínio controlado.

**Certo:** listar cada URI explicitamente; para previews Vercel, use allowlist na configuração de auth, não wildcards no client OAuth.

### Anti-pattern 3: Client Supabase em escopo de módulo

**Errado:**
```ts
// lib/supabase.ts — ERRADO para Edge Functions / Vercel
const supabase = createClient(URL, KEY)  // escopo de módulo — vaza entre requests

export default supabase
```

**Por quê:** em ambientes serverless com conexões reutilizadas (Vercel Fluid compute, Edge Functions), o client é compartilhado entre requests de usuários diferentes — vazamento de sessão.

**Certo:** sempre `const supabase = await createClient()` dentro do request handler ou Server Component.

### Anti-pattern 4: Achar que scopes restringem o banco

**Errado:**
```ts
// developer pensa que scope: 'email' significa "client só acessa emails"
await supabaseAdmin.auth.admin.oauth.createClient({
  // ...
})
// E não cria nenhuma RLS policy — ERRO: client acessa TODO o banco
```

**Por quê:** scopes em OAuth controlam apenas quais claims OIDC (email, phone, profile) o `id_token`/`userinfo` retorna. O `access_token` tem role `authenticated` e acessa o banco segundo as RLS policies — não tem restrição automática por scope.

**Certo:** sempre escrever RLS policies usando `(auth.jwt() ->> 'client_id')` para controlar quais clients acessam quais tabelas.

## Ver também

- [supabase-jwt-signing-keys](../supabase-jwt-signing-keys/SKILL.md) — configurar ES256/RS256 antes de habilitar OIDC
- [supabase-auth-hooks](../supabase-auth-hooks/SKILL.md) — Custom Access Token Hook para claims por client_id
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — patterns RLS com claim client_id
- [supabase-edge-functions-mcp-server](../supabase-edge-functions-mcp-server/SKILL.md) — MCP server em Edge Functions
- [supabase-oauth-server-implementer](../../agents/supabase-oauth-server-implementer.md) — agente que materializa setup completo
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — @supabase/ssr e getClaims() no servidor
