---
name: supabase-jwt-signing-keys
description: Use ao configurar JWT signing keys assimétricas (ES256/RS256) no Supabase, verificar JWTs com getClaims(), rotacionar chaves ou entender estrutura e claims do JWT.
---

# Supabase — JWT e Signing Keys

## Quando usar

LLM carrega esta skill quando o projeto precisar configurar ou entender **JWT signing keys** no Supabase — especialmente migração de HS256 para assimétrico, rotação zero-downtime, verificação segura de JWTs no servidor, ou suporte a OIDC/third-party auth.

Trigger phrases:

- "JWT Supabase", "signing keys"
- "getClaims", "JWKS Supabase"
- "rotate JWT secret", "asymmetric keys Supabase"
- "verify JWT Supabase", "RS256 ES256 Supabase"
- "JWT claims", "validar token Supabase no servidor"
- "jwks.json", "rotação de chaves zero-downtime"
- "ID token requer assimétrico"

## Princípio canônico

JWTs são compostos por três partes separadas por `.`:

```
header.payload.signature
```

Cada parte é codificada em Base64-URL:

- **Header** (`typ`, `alg`, `kid`) — tipo e algoritmo de assinatura
- **Payload** — claims (dados do usuário e metadados de sessão)
- **Signature** — garante autenticidade e integridade

**Regra de ouro:** NUNCA confiar no payload de um JWT sem verificar a assinatura. `getClaims()` verifica a assinatura; `getSession()` no servidor não verifica.

## Claims do JWT Supabase

### Claims obrigatórios

| Claim | Tipo | Descrição |
|-------|------|-----------|
| `iss` | string | Issuer — URL do projeto Supabase |
| `aud` | string | Audience — `authenticated` ou `anon` |
| `exp` | number | Unix timestamp de expiração |
| `iat` | number | Unix timestamp de emissão |
| `sub` | string | User UUID (`auth.uid()`) |
| `role` | string | Postgres role: `authenticated` ou `anon` |
| `aal` | string | Authenticator Assurance Level: `aal1`, `aal2` |
| `session_id` | string | UUID da sessão |
| `email` | string | Email do usuário |
| `phone` | string | Telefone do usuário |
| `is_anonymous` | boolean | Usuário anônimo |

### Claims opcionais

| Claim | Tipo | Descrição |
|-------|------|-----------|
| `jti` | string | JWT ID único (para revogação) |
| `nbf` | number | Not Before timestamp |
| `app_metadata` | object | Metadados de admin (service_role setter) |
| `user_metadata` | object | Metadados do usuário (editável pelo user) |
| `amr` | array | Authentication Method References |

### Claim especial `ref`

Presente em tokens `anon` e `service_role` (não em tokens de usuário autenticado):

```json
{ "ref": "xyzabcprojectref", "role": "anon" }
```

### Claim `client_id` (OAuth Server)

Presente apenas em access tokens emitidos via OAuth 2.1 Server — identifica qual client OAuth autorizou o token. Ver skill [supabase-oauth-server](../supabase-oauth-server/SKILL.md).

## Sistema de Signing Keys

### Sistema legado — JWT secret compartilhado (HS256)

O JWT secret legado é um shared secret simétrico:

- **Problema de performance:** validação exige chamada à API Supabase para obter o secret
- **Problema de segurança:** qualquer sistema que conhece o secret pode criar JWTs válidos
- **Problema de rotação:** rotacionar invalida todos os tokens ativos simultaneamente
- **Não suporta OIDC:** ID tokens exigem assimétrico

### Sistema novo — Signing Keys (assimétrico)

Supabase introduziu Signing Keys independentes das API keys:

| Característica | HS256 (legado) | Assimétrico (novo) |
|---------------|---------------|-------------------|
| Performance | Lenta (chamada API) | Rápida (validação local com JWKS) |
| Confiabilidade | Depende da API | Independente |
| Segurança | Secret compartilhado | Private key nunca sai do servidor |
| Rotação | Derruba tokens ativos | Zero-downtime (standby key) |
| OIDC / Third-party | Não suportado | Suportado |
| Algoritmos | HS256 | RS256, ES256, EdDSA (em breve) |

### Algoritmos disponíveis

| Algoritmo | Tipo | Tamanho de chave | Tamanho de assinatura | Recomendação |
|-----------|------|-----------------|----------------------|--------------|
| **ES256** | ECDSA NIST P-256 | 256 bits | ~64 bytes | **Recomendado** |
| RS256 | RSA | 2048 bits | 256 bytes | Compatibilidade |
| EdDSA | Ed25519 | 256 bits | 64 bytes | Em breve |
| HS256 | HMAC SHA-256 | variável | 32 bytes | Não usar em produção |

**Por que ES256 é recomendado:** curvas elípticas oferecem segurança equivalente ao RSA com chaves muito menores → assinaturas mais curtas → JWTs menores → menos bytes em cada request.

## Configurar Signing Keys (ES256)

### Via Dashboard

`Project Settings > Auth > Signing Keys` → `Add new key` → selecionar ES256 → `Add key`.

A nova key é criada com status **Standby**.

### Migração do JWT secret legado

```
Dashboard: Project Settings > Auth > Signing Keys > Import legacy secret
```

Isso cria uma signing key a partir do JWT secret atual — garante compatibilidade durante migração.

### Ciclo de vida de uma signing key

```
Standby → In Use → Previously Used → Revoked
```

| Status | Significado | Ação possível |
|--------|-------------|---------------|
| **Standby** | Criada mas não assina tokens | Promover para In Use |
| **In Use** | Assina todos os novos tokens | Rotacionar (passa para Previously Used) |
| **Previously Used** | Valida tokens antigos; não assina novos | Revogar (invalida tokens assinados por ela) |
| **Revoked** | Não valida nem assina | — |

**Espera obrigatória:** aguardar ~5 minutos entre mudanças de estado (propagação para edge nodes).

### Rotação zero-downtime (passo a passo)

```
1. Criar nova key ES256 (status: Standby)
2. Aguardar 5min (propagação)
3. Promover nova key para In Use
   └── Key anterior passa para Previously Used automaticamente
4. Aguardar expiração natural dos tokens antigos (padrão: 1h)
5. Revogar a Previously Used key (opcional — só após confirmar que todos os tokens expiraram)
```

**Quando NÃO revogar imediatamente:** se houver tokens com TTL longo (ex: tokens de sessão de 7 dias), aguardar o TTL antes de revogar a key anterior — caso contrário, sessões ativas são invalidadas.

## Discovery JWKS

Endpoint público com as chaves públicas de todas as keys **In Use** e **Previously Used**:

```
GET https://<project>.supabase.co/auth/v1/.well-known/jwks.json
```

Exemplo de resposta:

```json
{
  "keys": [
    {
      "kty": "EC",
      "kid": "key-id-123",
      "alg": "ES256",
      "use": "sig",
      "crv": "P-256",
      "x": "base64url-x",
      "y": "base64url-y"
    }
  ]
}
```

### Cache de JWKS

| Camada | TTL de cache |
|--------|-------------|
| Supabase Edge (CDN) | ~10 minutos |
| Client `@supabase/supabase-js` | ~10 minutos |
| **Total** | **~20 minutos** |

**Implicação para revogação urgente:** após revogar uma key, tokens assinados por ela podem continuar sendo aceitos por até ~20 minutos (cache JWKS). Para revogação imediata, force invalidação de sessão via admin API.

## Verificar JWTs

### Método canônico — `getClaims()` (Supabase JWTs)

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

  // getClaims() valida assinatura contra JWKS — seguro para uso no servidor
  const { data: { claims }, error } = await supabase.auth.getClaims()

  if (error || !claims) {
    return new Response('Não autorizado', { status: 401 })
  }

  // claims.sub = user UUID, claims.email, claims.role, claims.user_role (custom), etc.
  console.log('User ID:', claims.sub)
  console.log('Email:', claims.email)
  console.log('Role customizado:', claims.user_role)

  return Response.json({ userId: claims.sub })
}
```

**Por que `getClaims()` e não `getSession()`:**

| Método | Valida assinatura | Seguro no servidor |
|--------|------------------|-------------------|
| `getClaims()` | Sim — contra JWKS | Sim |
| `getSession()` | Não — apenas decodifica | Não (confia no cookie sem verificar) |

### Verificação manual com `jose` (terceiros)

Para verificar JWTs do Supabase em sistemas fora do SDK (backend Node.js, microserviços):

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

async function verifySupabaseJWT(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    audience: 'authenticated',
  })

  return payload  // claims verificados e tipados
}

// Uso em middleware Express / Fastify / Hono
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' })
  }

  try {
    const claims = await verifySupabaseJWT(authHeader.slice(7))
    req.user = claims
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
})
```

### Verificação com shared secret (desencorajado)

```ts
// NÃO recomendado em produção — apenas para desenvolvimento/testes
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
const { payload } = await jwtVerify(token, secret)
```

**Por que desencorajado:** shared secret exige que qualquer serviço que valide o JWT tenha acesso ao secret — superfície de ataque maior; rotação invalida todos os tokens ativos.

## Mintar JWT próprio (avançado)

Para casos que exigem emitir JWTs customizados com as chaves do Supabase:

```bash
# Gerar nova signing key ES256 local (para testes)
supabase gen signing-key --algorithm ES256

# Importar chave privada existente
supabase gen signing-key --import <caminho-para-chave>

# Gerar bearer JWT de teste
supabase gen bearer-jwt \
  --key-id <kid> \
  --subject <user-uuid> \
  --role authenticated \
  --expiry 3600
```

## JWTs de terceiros — NÃO usar `getClaims()`

Para JWTs emitidos por provedores externos (Clerk, Firebase, Auth0), usar a biblioteca de verificação do próprio provedor:

```ts
// Clerk — verificação de JWT externo
import { verifyToken } from '@clerk/nextjs/server'

const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })

// Auth0 — verificação de JWT externo
import { jwtVerify, createRemoteJWKSet } from 'jose'

const auth0JWKS = createRemoteJWKSet(
  new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
)
const { payload } = await jwtVerify(token, auth0JWKS)
```

`getClaims()` do Supabase só valida JWTs emitidos pelo próprio Supabase. Para third-party auth, a validação acontece internamente no PostgREST ao usar a opção `accessToken` no client.

## Regras absolutas

1. **Usar `getClaims()` para verificar JWTs do Supabase no servidor** — valida assinatura contra JWKS; `getSession()` apenas decodifica sem verificar
2. **Preferir ES256 a HS256** — assimétrico, assinaturas menores, suporte a OIDC e rotação zero-downtime
3. **JWKS cache é ~20min total** — não assumir que revogação de key é imediata; para revogação urgente, invalidar sessões via admin API
4. **Nunca vazar shared secret em variáveis públicas** — `NEXT_PUBLIC_SUPABASE_JWT_SECRET`, `VITE_JWT_SECRET`, `PUBLIC_JWT_SECRET` são erros críticos de segurança
5. **Aguardar ~5min entre mudanças de estado de key** — propagação para edge nodes; mudar status imediatamente pode causar falhas de validação
6. **ID tokens OIDC exigem assimétrico** — ES256 ou RS256; HS256 causa falha na emissão de ID tokens

## Anti-patterns

### Anti-pattern 1: Confiar em `getSession()` no servidor

**Errado:**
```ts
// Server Component — INSEGURO
const { data: { session } } = await supabase.auth.getSession()
if (!session) redirect('/login')
// ⚠ getSession() lê o cookie mas NÃO valida a assinatura JWT
```

**Por quê:** `getSession()` no servidor apenas decodifica o JWT do cookie sem verificar a assinatura. Um JWT forjado ou manipulado passaria pela verificação.

**Certo:**
```ts
const { data: { claims }, error } = await supabase.auth.getClaims()
if (error || !claims) redirect('/login')
// getClaims() valida assinatura contra JWKS — seguro
```

### Anti-pattern 2: HS256 em produção

**Errado:**
```toml
# config.toml — shared secret apenas
[auth]
jwt_secret = "super-secret-jwt-secret-de-producao"
# Sem signing key assimétrica configurada
```

**Por quê:** HS256 compartilhado não suporta OIDC, não permite rotação zero-downtime, e qualquer vazamento do secret compromete todos os tokens históricos.

**Certo:** migrar para ES256 via Dashboard (Project Settings > Auth > Signing Keys > Import legacy secret, depois Add ES256 key e rotacionar).

### Anti-pattern 3: Cache de JWKS muito longo sem invalidação

**Errado:**
```ts
// Cachear JWKS por 24h em Redis
const cachedJWKS = await redis.get('jwks')
if (!cachedJWKS) {
  const keys = await fetch(JWKS_URL).then(r => r.json())
  await redis.set('jwks', JSON.stringify(keys), 'EX', 86400) // 24h — MUITO LONGO
}
```

**Por quê:** se uma key for comprometida e revogada, tokens assinados por ela continuarão sendo aceitos durante 24h — janela de comprometimento enorme.

**Certo:** cache de JWKS por no máximo 15-30 minutos; implementar invalidação forçada ao detectar falha de validação (key não encontrada no cache → refetch imediato).

### Anti-pattern 4: Shared secret em variável de ambiente pública

**Errado:**
```env
# .env.local — CRÍTICO: qualquer bundle JS client vai expor isso
NEXT_PUBLIC_SUPABASE_JWT_SECRET=meu-secret-jwt-supersecreto
```

**Por quê:** variáveis `NEXT_PUBLIC_` são embutidas no bundle JavaScript enviado ao browser — qualquer usuário pode inspecionar o DevTools e obter o JWT secret, podendo criar tokens arbitrários.

**Certo:** JWT secret (se ainda usado) fica apenas em variáveis server-side sem prefixo `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_`. Melhor ainda: migrar para signing keys assimétricas.

## Ver também

- [supabase-auth-sessions](../supabase-auth-sessions/SKILL.md) — gestão de sessões, refresh e TTL
- [supabase-oauth-server](../supabase-oauth-server/SKILL.md) — OAuth 2.1 Server que exige signing keys assimétricas para OIDC
- [supabase-third-party-auth](../supabase-third-party-auth/SKILL.md) — third-party auth que exige JWT assimétrico do provedor
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) — custom claims via Auth Hook (user_role no JWT)
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — uso de getClaims() com @supabase/ssr em Next.js
