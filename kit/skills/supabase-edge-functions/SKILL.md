---
name: supabase-edge-functions
description: Use ao escrever Edge Functions Supabase — Deno + imports versionados npm:/jsr:/node:, env vars 2026 (JSON dict SUPABASE_PUBLISHABLE_KEYS/SUPABASE_SECRET_KEYS), per-function deno.json, config.toml por função (verify_jwt, entrypoint, static_files), file writes APENAS em /tmp ou /s3/<bucket>, EdgeRuntime.waitUntil, CORS via @supabase/supabase-js/cors v2.95+.
---

# Supabase — Edge Functions (Deno) · 2026

## Quando usar

LLM carrega esta skill quando criar, editar ou debugar Supabase Edge Functions. Trigger phrases:

- "criar Edge Function", "Supabase functions"
- "Deno + Supabase", "supabase functions deploy/serve"
- "Edge Function background task", "EdgeRuntime.waitUntil"
- "import npm: jsr: node: em Edge Function"
- "deno.json per function", "config.toml functions"

> **Cross-refs canônicos v1.30:**
> - Auth modes / `@supabase/server` → [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md)
> - Tests / Chrome DevTools debug → [`supabase-edge-functions-testing`](../supabase-edge-functions-testing/SKILL.md)
> - `Supabase.ai.Session`, /s3, WebSockets, Wasm, regional → [`supabase-edge-runtime-builtins`](../supabase-edge-runtime-builtins/SKILL.md)
> - Limits / status codes / `RateLimitError` → [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md)
> - MCP server pattern (mcp-lite) → [`supabase-edge-functions-mcp-server`](../supabase-edge-functions-mcp-server/SKILL.md)
> - Glossário CLI → [`_shared-supabase/glossary.md`](../_shared-supabase/glossary.md)

## Regras absolutas

- **Runtime é Deno**, não Node.js. Use APIs Deno (`Deno.serve`, `Deno.env`, `Deno.writeTextFile`).
- **Imports SEMPRE com `npm:`, `jsr:` ou `node:`** prefix. **NUNCA** bare specifiers — falha em runtime.
- **Versão pinada obrigatória** — `npm:hono@4.6.14`, `npm:@supabase/supabase-js@2.95.0`. Sem version, latest pode quebrar deploy.
- **Env vars 2026 (JSON dict)** — pre-populadas no runtime hospedado:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEYS` — **JSON dict**. `JSON.parse(...)['default']` para chave anon padrão.
  - `SUPABASE_SECRET_KEYS` — **JSON dict** (service role). Idem. Server-side only.
  - `SUPABASE_DB_URL` — Postgres direto.
  - `SUPABASE_JWKS` — JWK Set para verificar JWTs.
  - `SB_REGION`, `SB_EXECUTION_ID`, `DENO_DEPLOYMENT_ID` — runtime metadata.
  - Legacy (ainda funcionam, evitar em código novo): `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Outros secrets:** `supabase secrets set --env-file path/to/.env` (max 100, 48 KiB cada, nome NÃO pode começar com `SUPABASE_`).
- **`Deno.serve`** é o entry point canônico. **Nunca** `addEventListener('fetch')` (deprecated) ou `serve` legado de `deno.land/std`.
- **File writes:** APENAS `/tmp` (ephemeral) ou `/s3/<bucket-name>/...` (persistent S3FS — ver [`supabase-edge-runtime-builtins`](../supabase-edge-runtime-builtins/SKILL.md)). Qualquer outro path é read-only.
- **Background work:** `EdgeRuntime.waitUntil(promise)`. Sem isso, função termina antes da promise.
- **Multi-rota:** prefixar todas as rotas com `/<function-name>` (Hono `basePath('/api')`). Sem prefix, request 404 em produção.
- **CORS (v2.95.0+):** importar `corsHeaders` direto do SDK — `import { corsHeaders } from 'npm:@supabase/supabase-js@2.95.0/cors'`. Mantém-se sincronizado com novos headers do SDK automaticamente.

## Patterns canônicos

### Pattern 1 — Função básica com env vars 2026

```ts
// supabase/functions/hello/index.ts
// PT-BR: imports versionados + JSON dict de secret keys
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  // PT-BR: 'default' é a chave canônica; multi-key permite scoping (ex: 'automations')
  SUPABASE_SECRET_KEYS['default'],
)

Deno.serve(async (req) => {
  const { data, error } = await supabase.from('tasks').select('id, title').limit(10)
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return Response.json(data)
})
```

### Pattern 2 — CORS canônico (v2.95+)

```ts
// PT-BR: import corsHeaders do SDK — auto-sync com novos headers em releases futuras
import { corsHeaders } from 'npm:@supabase/supabase-js@2.95.0/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { name } = await req.json()
    return new Response(JSON.stringify({ message: `Hello ${name}!` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

### Pattern 3 — Background task com `waitUntil` + `beforeunload`

```ts
addEventListener('beforeunload', (ev) => {
  // PT-BR: log antes do isolate desligar — registra qual deadline foi atingido
  console.log('Function will shutdown:', (ev as CustomEvent).detail?.reason)
})

addEventListener('unhandledrejection', (ev) => {
  console.log('unhandledrejection', (ev as PromiseRejectionEvent).reason)
  ev.preventDefault()
})

Deno.serve(async (req) => {
  const body = await req.json()
  EdgeRuntime.waitUntil((async () => {
    try {
      await Deno.writeTextFile(`/tmp/audit-${Date.now()}.log`, JSON.stringify(body))
      await fetch('https://example.com/audit', { method: 'POST', body: JSON.stringify(body) })
    } catch (err) {
      console.error('background task failed', err)
    }
  })())
  return new Response('accepted', { status: 202 })
})
```

### Pattern 4 — Per-function `deno.json` (recomendado 2026)

Cada função tem seu próprio `deno.json` para isolamento de dependências:

```
supabase/functions/
├── orders/
│   ├── index.ts
│   └── deno.json          # PT-BR: dependencies isoladas por função
├── shipments/
│   ├── index.ts
│   └── deno.json
└── _shared/
    ├── cors.ts            # legacy — preferir 'npm:@supabase/supabase-js/cors'
    └── supabase-admin.ts
```

```json
// supabase/functions/orders/deno.json
{
  "imports": {
    "hono": "npm:hono@4.6.14",
    "supabase": "npm:@supabase/supabase-js@2.95.0",
    "zod": "npm:zod@3.23.8"
  }
}
```

Após criar `deno.json`, imports usam alias direto: `import { Hono } from 'hono'`. **Não use `import_map.json` global** — é legacy; prefira per-function. CLI 1.207.9+.

### Pattern 5 — Per-function `config.toml`

```toml
# supabase/config.toml
[functions.stripe-webhook]
verify_jwt = false                                          # webhook externo: signature-based

[functions.image-processor]
import_map = "./functions/image-processor/import_map.json"  # apenas se ainda em import_map legacy

[functions.legacy-js]
entrypoint = "./functions/legacy-js/index.js"               # JS puro (CLI 1.215.0+)

[functions.wasm-add]
static_files = ["./functions/wasm-add/add-wasm/pkg/*"]      # bundle Wasm com a função (CLI 2.7.0+)

[edge_runtime]
policy = "per_worker"                                       # mantém isolate alive — required p/ WebSocket + background task local
deno_version = 2
```

`policy = "per_worker"` é OBRIGATÓRIO para testar localmente **background tasks** e **WebSockets** — caso contrário o isolate é terminado após request. Caveat: hot-reload é desativado; restart manual via `supabase functions serve`.

### Pattern 6 — Imports JSR + Node built-in

```ts
import { encodeHex } from 'jsr:@std/encoding@1.0.8/hex'
import { createHash } from 'node:crypto'         // PT-BR: node: prefix obrigatório
import process from 'node:process'
```

### Pattern 7 — Custom NPM registry / private packages

```bash
# Custom registry corporativa
NPM_CONFIG_REGISTRY=https://npm.corp.com/ supabase functions deploy my-fn

# Private package via .npmrc (per-function)
# supabase/functions/my-fn/.npmrc
@myorg:registry=https://npm.registryhost.com
//npm.registryhost.com/:_authToken=VALID_AUTH_TOKEN
```

```ts
import pkg from 'npm:@myorg/private-package@1.0.1'
```

CLI 1.207.9+ para `.npmrc` per-function; CLI 2.2.8+ para `NPM_CONFIG_REGISTRY`.

## Anti-patterns

### A1 — Bare specifier

```ts
// ⚠ Errado — Module not found
import { createClient } from '@supabase/supabase-js'
// ✓ Certo
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
```

### A2 — Tratar `SUPABASE_SECRET_KEYS` como string (regressão 2025 → 2026)

```ts
// ⚠ Errado — em 2026 é JSON dict; passar como string quebra createClient
const supabase = createClient(URL, Deno.env.get('SUPABASE_SECRET_KEYS')!)

// ✓ Certo
const SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
const supabase = createClient(URL, SECRET_KEYS['default'])
```

### A3 — `Deno.writeTextFile` fora de `/tmp` ou `/s3/<bucket>`

```ts
await Deno.writeTextFile('/data/audit.log', data)   // ⚠ EACCES — read-only
await Deno.writeTextFile('./local/x.log', data)     // ⚠ idem
// ✓
await Deno.writeTextFile(`/tmp/audit-${Date.now()}.log`, data)
await Deno.writeTextFile(`/s3/my-bucket/audit.log`, data)  // S3FS_* env vars necessários
```

### A4 — Trabalho pesado inline (cliente espera)

```ts
// ⚠ Errado — bloqueia response até 30s+; client timeout
Deno.serve(async (req) => {
  await processHeavyJob(await req.json())
  return new Response('done')
})

// ✓ Certo — waitUntil libera response
Deno.serve(async (req) => {
  const body = await req.json()
  EdgeRuntime.waitUntil(processHeavyJob(body))
  return new Response('accepted', { status: 202 })
})
```

### A5 — Multi-rota sem `basePath`

```ts
const app = new Hono()                  // ⚠ /users em produção = 404
app.get('/users', handler)
// ✓ basePath com o nome canônico da função
const app = new Hono().basePath('/api')
```

### A6 — Import map global em `supabase/functions/import_map.json`

Legacy, ainda suportado mas **não recomendado**. Cada update em uma função pode quebrar outras (deps acopladas). Prefira `deno.json` per-function.

### A7 — Custom CORS string hard-coded

```ts
// ⚠ Errado — desatualiza quando SDK adiciona novos headers (drift silencioso)
const corsHeaders = { 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }

// ✓ Certo (v2.95.0+) — import sincronizado com releases
import { corsHeaders } from 'npm:@supabase/supabase-js@2.95.0/cors'
```

### A8 — Confundir `Authorization` (JWT) vs `apikey` (API key)

`Authorization: Bearer <user-jwt>` — JWT do usuário Supabase Auth.
`apikey: sb_publishable_... | sb_secret_...` — API key do projeto.

Enviar `sb_publishable_*` como Bearer = 401. Ver [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md).

## Estrutura recomendada

```
supabase/
├── config.toml
└── functions/
    ├── _shared/                     # shared (underscore prefix evita deploy)
    │   ├── supabase-admin.ts
    │   └── supabase-client.ts
    ├── orders/
    │   ├── index.ts
    │   ├── deno.json                # per-function (2026)
    │   └── .npmrc                   # opcional — private NPM
    └── tests/
        ├── orders-test.ts
        └── shipments-test.ts
```

Diretrizes:
- **"Fat functions":** combine endpoints relacionados em uma função (reduz cold start). Multi-rota com Hono/Oak/Express.
- **Hyphens em nomes:** URL-friendly.
- **`_shared/` underscore:** não é deployado, importado relativamente.
- **`tests/` separado:** sufixo `-test.ts`. Ver [`supabase-edge-functions-testing`](../supabase-edge-functions-testing/SKILL.md).

## Limits & quotas (resumo — detalhe em [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md))

| Recurso | Free | Pro/Team |
|---|---|---|
| Memory | 256 MB | 256 MB |
| CPU (per request) | 2s | 2s |
| Wall clock (isolate lifetime) | 150s | 400s |
| Request idle timeout | 150s | 150s |
| Max function size (bundled) | 20 MB | 20 MB |
| Max functions/project | 100 | 500 / 1000 |
| Nested function calls | ~5000/min/chain | ~5000/min/chain |

Outgoing ports `25` e `587` bloqueados (use Resend/SendGrid HTTP API).

## Ver também

- [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md) — `@supabase/server`, withSupabase, 4 auth modes, verify_jwt
- [`supabase-edge-functions-testing`](../supabase-edge-functions-testing/SKILL.md) — Deno test, supabase functions serve, Chrome DevTools
- [`supabase-edge-runtime-builtins`](../supabase-edge-runtime-builtins/SKILL.md) — `Supabase.ai.Session`, /s3 persistent, WebSockets, Wasm, regional
- [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md) — limits, status codes, RateLimitError
- [`supabase-edge-functions-mcp-server`](../supabase-edge-functions-mcp-server/SKILL.md) — mcp-lite pattern
- [`supabase-cron-queues`](../supabase-cron-queues/SKILL.md) — pattern `cron → pgmq → Edge Function`
- [`supabase-auth-ssr`](../supabase-auth-ssr/SKILL.md) — clients SSR
- [`_shared-supabase/glossary.md`](../_shared-supabase/glossary.md) — CLI + termos canônicos
