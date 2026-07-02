---
name: supabase-auth-sessions
cost_tier: leve
description: Guia de sessões Supabase — decide PKCE vs implicit flow, implementa exchangeCodeForSession, configura JWT expiry, session lifetime e refresh token reuse detection. Use ao configurar auth SSR.
---

# Supabase — Sessões e Fluxos de Autenticação

## Quando usar

LLM carrega esta skill quando configurar ou depurar **sessões de autenticação** no Supabase — fluxo de token, tempo de vida, expiração de JWT e detecção de reutilização de refresh token.

Trigger phrases:

- "implicit flow", "PKCE flow", "fluxo PKCE"
- "exchangeCodeForSession", "code exchange Supabase"
- "refresh token Supabase", "session lifetime", "JWT expiry"
- "session timeout", "inactivity timeout Supabase"
- "single session per user", "uma sessão por usuário"
- "refresh token reuse detection", "token reuse interval"
- "flowType pkce", "detectSessionInUrl"
- "access token expirado", "JWT expirado"
- "SupportedStorage", "custom storage adapter"
- "session_id claim", "JWT payload Supabase"

## Regras absolutas

1. **SSR sempre usa PKCE.** Contextos server-side (Next.js App Router, Route Handlers, Edge Middleware) nunca recebem URL fragments — o código de autorização PKCE (`?code=...`) é a única forma de passar tokens ao servidor.
2. **Implicit flow é client-only.** Só funciona em Single Page Applications (SPA) sem SSR. Mesmo em SPAs, PKCE é mais seguro e preferível.
3. **Code exchange no mesmo browser/device.** O code verifier PKCE é armazenado localmente (cookie ou localStorage) no dispositivo que iniciou o fluxo. Trocar o código em outro dispositivo falha.
4. **Expiração do JWT nunca abaixo de 5 minutos.** Valores muito baixos geram carga excessiva no Auth Server e problemas de clock skew.
5. **Refresh token é uso único.** Após ser trocado por um novo par access+refresh, o token antigo é invalidado. Reutilização é detectada como ataque e pode encerrar a sessão.
6. **Validar sessão no servidor com `getClaims()`**, não com `getSession()`.

## O que é uma sessão Supabase

Uma sessão é composta por **dois tokens**:

| Token | Tipo | Duração padrão | Uso |
|-------|------|----------------|-----|
| Access token | JWT assinado | 1 hora (configurável) | Autenticar requisições ao PostgREST, Storage, Edge Functions |
| Refresh token | Opaque string | Configurável (dias/semanas) | Obter novo access token após expirar |

### Claims do JWT (payload)

```json
{
  "sub": "uuid-do-usuario",           // auth.uid() em RLS
  "email": "usuario@exemplo.com",
  "role": "authenticated",            // postgres role
  "aud": "authenticated",
  "iss": "https://<project>.supabase.co/auth/v1",
  "iat": 1716000000,                  // issued at
  "exp": 1716003600,                  // expiration (iat + JWT TTL)
  "session_id": "uuid-da-sessao",     // identificador único da sessão
  "is_anonymous": false,              // true em signInAnonymously
  "user_role": "admin"                // custom claim via auth hook (opcional)
}
```

O campo `session_id` identifica a sessão específica — útil para "single session per user" e auditoria.

### Benefícios vs sessões tradicionais (server-side sessions)

| | JWT + Refresh Token | Sessão server-side (ex: Redis) |
|---|---|---|
| Validação | Criptográfica (sem DB lookup) | Requer lookup no DB/cache a cada request |
| Revogação | Eventual (até expirar) | Imediata (deletar da store) |
| Escalabilidade | Stateless — sem coordenação entre servidores | Requer store compartilhado |
| Segurança offline | JWT pode ser validado sem conectividade | Requer acesso à session store |
| Overhead por request | Mínimo (verificação de assinatura) | Network + DB lookup |

## Implicit Flow vs PKCE Flow

### Implicit Flow (client-only)

```
Usuário clica "Login"
    ↓
Browser redireciona para provider OAuth / Supabase Auth
    ↓
Após auth, provider redireciona para:
https://meuapp.com/callback#access_token=eyJ...&refresh_token=abc...
                              ↑
                         URL Fragment (tudo após #)
    ↓
JavaScript no browser lê o fragment e extrai os tokens
(Servidor NUNCA vê o fragment — não é enviado pelo browser no HTTP request)
```

```ts
// Cliente SPA — flowType 'implicit' (padrão legado)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      flowType: 'implicit',        // padrão para SPAs sem SSR
      detectSessionInUrl: true,    // processa #access_token= automaticamente
    },
  }
)
```

**Limitações do implicit flow:**
- Tokens ficam expostos no histórico do browser e logs de servidor (se fragment vazar)
- Não há `code_verifier` — ataque de interceptação é possível
- Não funciona em SSR (servidor não recebe o fragment)

### PKCE Flow (recomendado para SSR e SPAs modernos)

```
Usuário clica "Login"
    ↓
Cliente gera code_verifier (string aleatória) e code_challenge (hash SHA-256 do verifier)
    ↓
Armazena code_verifier localmente (cookie ou localStorage)
    ↓
Browser redireciona para provider OAuth com code_challenge
    ↓
Após auth, provider redireciona para:
https://meuapp.com/auth/callback?code=xyz123
                                  ↑
                           Query param (visível ao servidor)
    ↓
Route handler /auth/callback recebe o code
    ↓
exchangeCodeForSession(code) envia code + code_verifier ao Supabase
    ↓
Supabase verifica: hash(code_verifier) == code_challenge (enviado no início)?
    ↓ sim
Emite access_token + refresh_token e cria sessão
```

```ts
// lib/supabase/client.ts — configurar PKCE no browser client
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: 'pkce',           // obrigatório para SSR
        detectSessionInUrl: true,   // processa ?code= automaticamente
      },
    }
  )
}
```

### Route handler de troca de código PKCE

```ts
// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')      // código PKCE da URL
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`)
  }

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

  // Código PKCE é válido por 5 minutos e uso único
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Falha no code exchange:', error.message)
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`)
  }

  // Tratar proxy reverso em produção
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
```

**Propriedades do código PKCE:**
- Válido por **5 minutos** após emissão
- **Uso único** — após `exchangeCodeForSession`, fica invalidado
- Vinculado ao **browser/device** que iniciou o fluxo (via `code_verifier` armazenado localmente)
- Trocar em outro dispositivo sempre falha — o `code_verifier` não está lá

## Custom Storage Adapter

Para ambientes sem `localStorage` (React Native, Electron, ambientes headless):

```ts
import { createClient, SupportedStorage } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'  // exemplo React Native

// Implementar SupportedStorage — interface do Supabase para storage customizado
const ExpoSecureStoreAdapter: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key)
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value)
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key)
  },
}

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      flowType: 'pkce',
      storage: ExpoSecureStoreAdapter,     // storage seguro nativo
      detectSessionInUrl: false,           // sem deep links automáticos
    },
  }
)
```

## Lifetime de Sessão — Configurações (Pro+)

Acessível em `Authentication > Sessions` no Dashboard (plano Pro ou superior).

### Time-box da sessão

Limita o tempo máximo de vida de uma sessão independentemente de atividade:

```
Time-box: 24h (exemplo)
→ Usuário que logar às 08:00 terá sessão encerrada às 08:00 do dia seguinte
  mesmo se estiver ativamente usando o app
```

Configuração típica por caso de uso:

| Caso de uso | Time-box recomendado |
|-------------|---------------------|
| App bancário / fintech | 8–24 horas |
| App corporativo interno | 8–12 horas |
| App de conteúdo / mídia | 30–90 dias |
| E-commerce | 30 dias |

### Inactivity timeout

Encerra sessão após período de inatividade (sem refresh token usado):

```
Inactivity timeout: 2h
→ Usuário que fechar o app e não voltar em 2h precisa fazer login novamente
```

**Nota:** o refresh automático do Supabase Client conta como atividade — configure com valor maior que o intervalo de refresh.

### Single session per user

Força que cada usuário tenha no máximo uma sessão ativa:

```
Single session: habilitado
→ Login no dispositivo B automaticamente invalida sessão do dispositivo A
```

**Implementação via `session_id`:** ao habilitar, o Supabase rastreia `session_id` no JWT e invalida sessões anteriores ao emitir nova.

## Expiração do JWT — Configurações

Configurável em `Authentication > JWT` no Dashboard:

```
JWT expiry: 3600 (1 hora) — padrão recomendado
```

### Recomendações de expiração

| Cenário | JWT TTL | Notas |
|---------|---------|-------|
| Padrão / maioria dos apps | 3600s (1h) | Bom equilíbrio segurança/performance |
| App de alta segurança | 300s (5min) | Mínimo prático — abaixo causa clock skew |
| App de baixa sensibilidade | 7200s (2h) | Reduz carga no Auth Server |
| **Nunca usar** | < 300s | Clock skew + sobrecarga de refresh |

**Por que não abaixo de 5 minutos:**
1. **Clock skew:** servidores com relógio desincronizado (±30s é comum) rejeitam JWTs válidos
2. **Carga no Auth Server:** refresh a cada 5min × milhares de usuários = sobrecarga massiva
3. **Latência de rede:** em redes lentas, o refresh pode falhar na janela de expiração

## Refresh Token Reuse Detection

### Funcionamento

O Supabase implementa detecção de reutilização para prevenir ataques de replay:

```
Usuário A tem refresh_token: "abc123" (válido)
    ↓
Ataque ou bug: "abc123" é usado duas vezes quase simultaneamente
    ↓
Supabase: primeira troca → emite novo par (access: "jwt2", refresh: "def456")
           segunda troca → detecta reutilização!
    ↓
Comportamento: ENCERRA a sessão atual E invalida todos os tokens desta sessão
(o atacante com o token roubado também perde acesso)
```

### Intervalo de reutilização (reuse interval)

```
Reuse interval: 10 segundos (padrão)
```

O intervalo de 10s existe para tratar race conditions legítimas (cliente em tab dupla, retry de rede). Dentro do intervalo, a mesma troca é aceita. Após o intervalo, qualquer reuso é tratado como ataque.

```ts
// Configurar listener para detecção de reuso (client-side)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token renovado com sucesso:', session?.expires_at)
  }

  if (event === 'SIGNED_OUT') {
    // Pode ter sido encerramento por reuse detection — redirecionar para login
    console.warn('Sessão encerrada — possível reutilização de refresh token')
    window.location.href = '/login?reason=session_terminated'
  }
})
```

### Rotação de refresh token

Cada uso do refresh token gera um novo par — o token antigo é imediatamente invalidado:

```
Refresh token: [abc123]
    ↓ usuario.auth.refreshSession() ou auto-refresh
Novo par emitido: access_token: [novoJWT], refresh_token: [def456]
Antigo invalidado: [abc123] ← inválido a partir daqui
```

**Consequência:** não armazene refresh tokens em cache de longa duração (Redis, banco) sem invalidação adequada — o valor muda a cada refresh.

## Refresh manual e escuta de estado

```ts
// Renovar sessão manualmente (raramente necessário — SDK faz auto-refresh)
const { data, error } = await supabase.auth.refreshSession()

// Escutar mudanças de estado de auth (login, logout, refresh, recovery)
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    console.log('Evento:', event)
    // Eventos possíveis:
    // 'INITIAL_SESSION'    — sessão inicial ao carregar o app
    // 'SIGNED_IN'          — login bem-sucedido
    // 'SIGNED_OUT'         — logout
    // 'TOKEN_REFRESHED'    — access token renovado
    // 'USER_UPDATED'       — updateUser chamado
    // 'PASSWORD_RECOVERY'  — link de recovery clicado
  }
)

// Cancelar subscription quando o componente desmontar
subscription.unsubscribe()
```

## Validar sessão no servidor (`getClaims`)

```ts
// app/dashboard/page.tsx — Server Component
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
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

  // getClaims() valida a assinatura JWT criptograficamente
  const { data: { claims }, error } = await supabase.auth.getClaims()

  if (error || !claims) {
    redirect('/login')
  }

  // Claims disponíveis sem round-trip ao banco:
  const userId = claims.sub             // auth.uid()
  const sessionId = claims.session_id   // identificador único da sessão
  const isAnonymous = claims.is_anonymous

  return <Dashboard userId={userId} />
}
```

## Debug de problemas comuns

### Sessão não persiste após refresh da página (SPA)

```ts
// Verificar se detectSessionInUrl está habilitado E se o storage está configurado
const supabase = createBrowserClient(URL, KEY, {
  auth: {
    detectSessionInUrl: true,    // processa tokens da URL
    persistSession: true,        // persiste em localStorage (padrão true)
    autoRefreshToken: true,      // renova automaticamente (padrão true)
  },
})

// Debug: verificar sessão atual
const { data: { session } } = await supabase.auth.getSession()
console.log('Sessão local:', session)

const { data: { claims } } = await supabase.auth.getClaims()
console.log('Claims validados:', claims)
```

### Code exchange falha ("Code verifier not found")

```
Erro: "Code verifier not found in storage"
```

Causas possíveis:
1. O fluxo foi iniciado em um browser/dispositivo e o callback veio em outro
2. `localStorage` foi limpo entre o início do fluxo e o callback
3. Cookies bloqueados (modo privado, extensões de browser)
4. Timeout: o código PKCE expirou (> 5 minutos entre redirect e callback)

```ts
// Solução: usar cookie como storage em vez de localStorage (mais resiliente)
const supabase = createBrowserClient(URL, KEY, {
  auth: {
    flowType: 'pkce',
    storage: {
      // Implementar com cookies que persistem cross-tab
      getItem: (key) => document.cookie.match(`${key}=([^;]*)`)?.[1] ?? null,
      setItem: (key, value) => {
        document.cookie = `${key}=${value}; path=/; SameSite=Lax; Secure`
      },
      removeItem: (key) => {
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      },
    },
  },
})
```

## Anti-patterns

### 1. Implicit flow em contexto SSR

**Errado:**
```ts
// pages/api/auth.ts ou app/api/auth/route.ts (servidor)
// Usa flowType 'implicit' — fragmento nunca chega ao servidor
const supabase = createClient(URL, KEY, {
  auth: { flowType: 'implicit' },
})
// Resultado: getSession() sempre retorna null no servidor
```

**Por quê:** o URL fragment (`#access_token=...`) nunca é enviado pelo browser ao servidor — é uma feature de segurança do protocolo HTTP. O servidor literalmente não tem acesso.

**Certo:** usar `flowType: 'pkce'` com rota `/auth/callback` que chama `exchangeCodeForSession(code)`.

### 2. JWT com expiração muito curta

**Errado:**
```
JWT expiry: 60 (1 minuto)
```

**Por quê:**
- Clock skew de 30s entre servidores → token de 60s pode ser considerado expirado com apenas 30s de uso efetivo
- Em 1000 usuários simultâneos com refresh a cada minuto → 1000 req/min no Auth Server só para refresh
- Qualquer latência de rede > 30s durante refresh resulta em logout inesperado do usuário

**Certo:** mínimo 300s (5min); padrão recomendado 3600s (1h).

### 3. Assumir refresh token reutilizável múltiplas vezes

**Errado:**
```ts
// Salvar refresh token e reutilizar várias vezes
const savedRefreshToken = session.refresh_token
localStorage.setItem('refresh', savedRefreshToken)

// Mais tarde, tentar usar o mesmo token em múltiplos requests
const { data } = await supabase.auth.refreshSession({
  refresh_token: localStorage.getItem('refresh')!,
})
// Segunda chamada com o mesmo token → detecção de reuso → sessão encerrada!
```

**Por quê:** refresh token é uso único. Após a primeira troca, o token é invalidado e um novo é emitido. Reutilizar o token antigo aciona a detecção de reuso e encerra TODA a sessão.

**Certo:** sempre use o refresh token mais recente retornado pelo SDK. Não armazene refresh tokens externamente — deixe o SDK gerenciar o ciclo de vida.

### 4. `getSession()` para validação no servidor

**Errado:**
```ts
// Route Handler — NÃO valida criptograficamente
const { data: { session } } = await supabase.auth.getSession()
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
// Um cookie forjado passa nessa verificação!
```

**Por quê:** `getSession()` lê o JWT dos cookies sem validar a assinatura. Um atacante pode forjar um cookie com qualquer `user_id` e passar na verificação.

**Certo:**
```ts
const { data: { claims }, error } = await supabase.auth.getClaims()
if (error || !claims) return Response.json({ error: 'Unauthorized' }, { status: 401 })
// getClaims() valida a assinatura criptográfica — impossível forjar
```

### 5. Code exchange fora do mesmo browser/device

**Errado:**
```
Fluxo: Usuário inicia login no Chrome do Desktop
       Link de callback é enviado por email e o usuário abre no celular
       Celular tenta exchangeCodeForSession(code)
       → FALHA: "Code verifier not found"
```

**Por quê:** o `code_verifier` PKCE é gerado e armazenado localmente no device que iniciou o fluxo. O celular não tem o verifier — a troca sempre falha.

**Certo:** garantir que o callback URL seja aberto no MESMO browser/device. Para magic links enviados por email, o usuário deve clicar no mesmo dispositivo que iniciou a ação. Não há workaround seguro para cross-device PKCE.

## Ver também

- [supabase-auth-methods](../supabase-auth-methods/SKILL.md) — métodos de auth do usuário final (senha, OTP, anônimo)
- [supabase-social-oauth](../supabase-social-oauth/SKILL.md) — login social com Google, GitHub, Apple etc.
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — setup completo do cliente SSR com `@supabase/ssr` no Next.js
- [supabase-jwt-signing-keys](../supabase-jwt-signing-keys/SKILL.md) — rotação de chaves JWT, `getClaims()` vs `getSession()`
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) — custom claims no JWT via Auth Hook
- [supabase-edge-functions-auth](../supabase-edge-functions-auth/SKILL.md) — validação de JWT em Edge Functions
