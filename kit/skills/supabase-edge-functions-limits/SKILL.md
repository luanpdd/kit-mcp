---
name: supabase-edge-functions-limits
description: Use ao planejar limites, falhas e retries em Edge Functions Supabase — runtime caps (256MB / 2s CPU / 150-400s wall clock), platform caps (20MB bundle, 100/500/1000 funcs por plano), status codes canônicos (401/404/405/500/503/504/546 WORKER_LIMIT), recursive call budget ~5k req/min com `RateLimitError` + `retryAfterMs`, client-side error classes `FunctionsHttpError`/`FunctionsRelayError`/`FunctionsFetchError`, idempotency e backoff.
---

# Supabase — Edge Functions Limits, Status Codes & Rate Limits · 2026

## Quando usar

Carrega quando:

- "limites Edge Function", "256MB memory", "wall clock", "CPU time"
- "504 Edge Function timeout", "503 BOOT_ERROR", "546 WORKER_LIMIT"
- "FunctionsHttpError supabase", "client edge function error"
- "RateLimitError edge function", "nested function calls", "recursive function rate limit"
- "idempotency key edge function", "retry edge function"

> Pré-requisito: [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md).
> Cross-ref SRE: [`retry-strategies`](../retry-strategies/SKILL.md) · [`cascading-failures`](../cascading-failures/SKILL.md) · [`load-shedding-graceful-degradation`](../load-shedding-graceful-degradation/SKILL.md).

## Matriz de Limits

### Runtime (per request)

| Recurso | Free | Pro / Team / Enterprise |
|---|---|---|
| **Memory** | 256 MB | 256 MB |
| **CPU time** | 2s | 2s |
| **Wall clock (isolate lifetime)** | 150s | 400s |
| **Request idle timeout** | 150s | 150s |
| **Max log message** | 10.000 chars | 10.000 chars |
| **Log event rate** | 100 / 10s | 100 / 10s |
| **Ephemeral `/tmp`** | 256 MB | 512 MB |

CPU time é **CPU real** (não inclui I/O async). Wall clock conta tudo. Função pode ter 400s wall clock mas estourar com 2.1s CPU.

### Platform

| Recurso | Free | Pro | Team | Enterprise |
|---|---|---|---|---|
| **Max funcs/project** | 100 | 500 | 1000 | unlimited |
| **Max bundle size** | 20 MB | 20 MB | 20 MB | 20 MB |
| **Max secrets/project** | 100 | 100 | 100 | 100 |
| **Max secret size** | 48 KiB | 48 KiB | 48 KiB | 48 KiB |
| **Max secret name** | 256 chars (sem prefix `SUPABASE_`) | idem | idem | idem |

### Restrições gerais

- **Outbound ports** `25` e `587` bloqueados (use Resend/SendGrid HTTP API).
- **HTML serving** só com custom domains (`text/html` reescrito para `text/plain` em domínio padrão).
- **Sem Web Worker API / `node:vm`**.
- **Multithreading** não suportado (Sharp/libvips falham — use `magick-wasm`).
- **Static files** deploy só via Docker (`--use-api` não suporta).

## Status Codes Canônicos

| Code | Nome interno | Causa | Fix |
|---|---|---|---|
| `2xx` | success | Handler retornou OK | — |
| `3xx` | redirect | `Response.redirect()` | — |
| `401` | unauthorized | `verify_jwt=true` + Authorization inválido/ausente | Mandar JWT válido ou `verify_jwt=false` |
| `404` | not found | Função não existe / path errado | Conferir `supabase functions list` |
| `405` | method not allowed | Método fora de GET/POST/PUT/PATCH/DELETE/OPTIONS | Trocar método |
| `500` | `WORKER_ERROR` | Uncaught exception | Wrap em try/catch + log |
| `503` | `BOOT_ERROR` | Função falhou ao carregar (syntax error, import fail) | `supabase functions serve` local + logs |
| `504` | gateway timeout | Excedeu request idle timeout (150s) | Otimizar / mover para background |
| `546` | `WORKER_LIMIT` | Excedeu memory/CPU/wall clock | Reduzir bundle, chunk processing |

### Diagnosticar 546 (resource limit)

```bash
# Ver qual limite foi atingido
mcp__supabase__get_logs --service edge-function
```

Tipicamente em logs:
```
ERROR: WORKER_LIMIT: out of memory (256 MB)
ERROR: WORKER_LIMIT: CPU time limit exceeded (2s)
ERROR: WORKER_LIMIT: wall clock exceeded (400s)
```

## Client-side Error Classes

```ts
import {
  FunctionsHttpError,    // 4xx/5xx da função (status code do handler)
  FunctionsRelayError,   // problema gateway↔Supabase (raro)
  FunctionsFetchError,   // função inalcançável (network)
} from 'npm:@supabase/supabase-js@2.95.0'

const { data, error } = await supabase.functions.invoke('orders', { body })

if (error instanceof FunctionsHttpError) {
  const body = await error.context.json()
  // Trate por status — body.code (seu enum) + retry decision
} else if (error instanceof FunctionsRelayError) {
  // Quase sempre transiente — retry com backoff
} else if (error instanceof FunctionsFetchError) {
  // Função down / DNS / cliente offline
}
```

## Nested Function Calls — Rate Limit

Quando uma Edge Function chama outra Edge Function via `fetch()` ou `supabase.functions.invoke()`, a Supabase aplica rate limit ao **chain** completo:

- **Budget**: ~**5.000 requisições/minuto/chain** (regiões mais movimentadas têm budget maior).
- **Conta**: direct recursion, function chaining, circular calls, fan-out.
- **Não conta**: inbound requests, chamadas para APIs externas (Stripe, OpenAI).

### `RateLimitError` + `retryAfterMs`

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const SECRET = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SECRET['default'])

Deno.serve(async (req) => {
  try {
    const { data, error } = await supabase.functions.invoke('downstream', { body: {} })
    if (error) throw error
    return Response.json(data)
  } catch (err) {
    if (err instanceof Deno.errors.RateLimitError) {
      const retryAfterSec = Math.ceil(err.retryAfterMs / 1000)
      return new Response(JSON.stringify({ error: 'service temporarily unavailable' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfterSec.toString(),
        },
      })
    }
    throw err
  }
})
```

### Retry interno (com `retryAfterMs`)

```ts
async function invokeWithRetry(fn: string, body: object, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body })
      if (error) throw error
      return data
    } catch (err) {
      if (err instanceof Deno.errors.RateLimitError && attempt < maxRetries - 1) {
        // PT-BR: usar valor sugerido pelo runtime — evita thundering herd
        await new Promise((r) => setTimeout(r, err.retryAfterMs))
        continue
      }
      throw err
    }
  }
}
```

## Padrões para evitar rate limit

### P1 — Batch em vez de N invocações

```ts
// ⚠ Errado — N requests, estoura budget
for (const item of items) {
  await supabase.functions.invoke('process-item', { body: item })
}

// ✓ Certo — 1 request
await supabase.functions.invoke('process-items', { body: { items } })
```

### P2 — Limite de profundidade em recursão

```ts
Deno.serve(async (req) => {
  const { depth = 0, data } = await req.json()
  if (depth >= 5) return Response.json({ result: data })   // parar
  const next = process(data)
  const { data: result } = await supabase.functions.invoke('me', {
    body: { depth: depth + 1, data: next },
  })
  return Response.json(result)
})
```

### P3 — Shared library (sem HTTP overhead)

Funções que compartilham lógica não devem chamar uma à outra via HTTP. Use `_shared/`:

```ts
// supabase/functions/_shared/transform.ts
export function validate(d) { /* ... */ }
export function transform(d) { /* ... */ }
export async function save(d) { /* ... */ }

// supabase/functions/process/index.ts
import { validate, transform, save } from '../_shared/transform.ts'
// invocação direta — zero HTTP, zero rate limit
```

### P4 — Queue para workload alto

Cargas > 5k/min devem ir para `pgmq` + worker, não recursive Edge Function. Ver [`supabase-cron-queues`](../supabase-cron-queues/SKILL.md).

## Idempotency keys

Para writes (POST/PATCH/PUT) em Edge Function chamada externamente, exija header `Idempotency-Key`:

```ts
Deno.serve(async (req) => {
  if (req.method === 'POST') {
    const idempKey = req.headers.get('Idempotency-Key') ?? crypto.randomUUID()
    const SECRET = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SECRET['default'])

    // PT-BR: insert com chave única; se já existe, retorna o registro existente
    const { data, error } = await supabase
      .from('orders')
      .upsert({ idempotency_key: idempKey, /* ... */ }, { onConflict: 'idempotency_key' })
      .select()
      .single()
    return Response.json(data)
  }
})
```

Cross-ref: [`retry-strategies`](../retry-strategies/SKILL.md) — full/equal/decorrelated jitter quando aplicável.

## Error handling padrão

```ts
Deno.serve(async (req) => {
  try {
    const result = await processRequest(req)
    return Response.json(result)
  } catch (error) {
    console.error('function error:', error)   // visível em Logs tab
    // PT-BR: error.type enum fechado (NÃO error.message — cardinalidade)
    const code = classifyError(error)
    const status =
      code === 'validation' ? 400 :
      code === 'auth' ? 401 :
      code === 'not_found' ? 404 :
      code === 'rate_limit' ? 429 :
      code === 'timeout' ? 504 :
      500
    return Response.json({ code, message: error.message }, { status })
  }
})

function classifyError(e: unknown): string {
  if (e instanceof ValidationError) return 'validation'
  if (e instanceof AuthError) return 'auth'
  if (e instanceof NotFoundError) return 'not_found'
  if (e instanceof Deno.errors.RateLimitError) return 'rate_limit'
  if (e instanceof TimeoutError) return 'timeout'
  return 'unknown'
}
```

## Quando otimizar

| Sintoma | Fix prioritário |
|---|---|
| 504 frequente | Mover trabalho para `EdgeRuntime.waitUntil` ou pgmq |
| 546 OOM (memory) | Stream em vez de buffer in-memory; chunk processing |
| 546 CPU exceeded | Profiler local (`deno test --inspect`); mover para Wasm |
| 546 wall clock | Background tasks; reduzir async chains |
| 503 BOOT_ERROR | Bundle muito grande; lazy-load imports pesados (`await import('npm:openai@4')`) |
| 503 em deploys novos | Erro de import/syntax; `supabase functions serve` antes do deploy |

## Anti-patterns

### AL1 — `error.message` como dimension em métricas
Cardinality explode. Use enum fechado (5-15 valores) em `error.type`.

### AL2 — Retry sem `retryAfterMs`
Backoff manual com `1000ms` ignora hint do runtime. Sempre `setTimeout(_, err.retryAfterMs)` para RateLimitError.

### AL3 — Fan-out síncrono massive
`Promise.all(items.map(invoke))` com 1000 items satura budget. Limite concorrência (`p-limit`) ou batch server-side.

### AL4 — Polling em loop dentro da função
Wall clock estoura. Use webhook + database trigger (`pg_net.http_post`) ou WebSocket.

### AL5 — Bundle > 20 MB
Deploy falha. Lazy-load: `const { OpenAI } = await import('npm:openai@4')` evita carregar tudo no boot.

## Ver também

- [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) — base
- [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md) — 401/403 detalhes
- [`supabase-edge-runtime-builtins`](../supabase-edge-runtime-builtins/SKILL.md) — `/tmp` 512MB paid
- [`supabase-cron-queues`](../supabase-cron-queues/SKILL.md) — pgmq quando recursive estoura
- [`retry-strategies`](../retry-strategies/SKILL.md) — full/equal/decorrelated jitter
- [`cascading-failures`](../cascading-failures/SKILL.md) — timeout/jitter/deadline/circuit breaker
- [`load-shedding-graceful-degradation`](../load-shedding-graceful-degradation/SKILL.md) — drop com 503 quando saturated
- [`four-golden-signals`](../four-golden-signals/SKILL.md) — saturation metric canônico
