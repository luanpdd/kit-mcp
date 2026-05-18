---
name: supabase-edge-functions-testing
description: Use ao testar/debugar Edge Functions Supabase localmente — deno test --allow-all, folder tests/<fn>-test.ts, supabase functions serve, Chrome DevTools --inspect-mode, characterization para legadas.
---

# Supabase — Edge Functions Testing & Local Debug · 2026

## Quando usar

Carrega quando:

- "testar Edge Function", "Deno test supabase function"
- "supabase functions serve", "debug Edge Function", "Chrome DevTools deno"
- "Edge Function não reload local", "per_worker policy"
- "characterization test edge function", "snapshot golden output"

> Pré-requisito: [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) (base Deno + env vars).
> Complemento legacy: [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — quando refatorar Edge Function sem testes.
> Pattern API-only: [`legacy-api-only-applications`](../legacy-api-only-applications/SKILL.md) — adapter + fake provider para testes determinísticos.

## Folder structure canônica

```
supabase/
├── config.toml
└── functions/
    ├── _shared/
    │   ├── supabase-admin.ts
    │   └── cors.ts                       # ou import direto do SDK
    ├── orders/
    │   ├── index.ts
    │   └── deno.json
    ├── shipments/
    │   ├── index.ts
    │   └── deno.json
    └── tests/                            # ⭐ canônico
        ├── orders-test.ts                # nome-da-funcao + -test.ts
        ├── shipments-test.ts
        └── fixtures/
            ├── orders-payload-1.json     # fixtures real-world
            └── stripe-webhook-event.json
```

Diretrizes:
- **`tests/` separado em `supabase/functions/`** — não é deployado (CLI bundling ignora).
- **Sufixo `-test.ts`** — convenção Deno test runner.
- **`fixtures/`** — payloads capturados em prod (sanitizados) via `mcp__supabase__get_logs` (ver agente `payload-capture-instrumenter`).

## Pattern 1 — Test básico de Edge Function via HTTP

```ts
// supabase/functions/tests/orders-test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import 'jsr:@std/dotenv@0.225.5/load'   // PT-BR: carrega .env automatically

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

Deno.test('orders — happy path', async () => {
  const { data, error } = await supabase.functions.invoke('orders', {
    body: { customer_id: 'test-1', items: [{ sku: 'A', qty: 2 }] },
  })
  assert(!error, `function returned error: ${error?.message}`)
  assertEquals(data.status, 'pending')
  assert(typeof data.order_id === 'string')
})

Deno.test('orders — validation error', async () => {
  const { error } = await supabase.functions.invoke('orders', { body: {} })
  // PT-BR: invoke retorna FunctionsHttpError quando status >= 400
  assert(error, 'expected validation error')
})
```

## Pattern 2 — Setup local + execução

```bash
# 1. levantar stack local (DB + Storage + Functions runtime)
supabase start

# 2. servir função com hot-reload (default)
supabase functions serve orders --env-file .env.local

# 3. em outro terminal: rodar tests
deno test --allow-all supabase/functions/tests/orders-test.ts

# 4. todos os tests
deno test --allow-all supabase/functions/tests/
```

`.env.local` típico para tests:

```
SUPABASE_URL=http://localhost:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_default_key
SUPABASE_SECRET_KEY=sb_secret_local_default_key
```

`supabase status` mostra as chaves locais.

## Pattern 3 — Test com user JWT (RLS-aware)

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import { assertEquals } from 'jsr:@std/assert@1'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!)

Deno.test('notes — só vê suas próprias notas (RLS)', async () => {
  await supabase.auth.signInWithPassword({ email: 'alice@test.local', password: 'alice-pwd' })
  const { data } = await supabase.functions.invoke('notes')
  assert(Array.isArray(data))
  for (const note of data) assertEquals(note.owner_id, supabase.auth.getUser().data.user!.id)
})
```

## Pattern 4 — Test determinístico para função API-only (adapter pattern)

Para Edge Function que wrappa API externa (OpenAI, Stripe, Resend), injetar fake provider via env. Ver [`legacy-api-only-applications`](../legacy-api-only-applications/SKILL.md) e [`llm-as-dependency`](../skills/llm-as-dependency/SKILL.md).

```ts
// supabase/functions/_shared/openai-adapter.ts
export interface LLMProvider {
  complete(prompt: string): Promise<string>
}

export class OpenAIProvider implements LLMProvider {
  async complete(prompt: string) { /* npm:openai */ }
}

export class FakeLLMProvider implements LLMProvider {
  constructor(private fixture: Record<string, string>) {}
  async complete(prompt: string) { return this.fixture[prompt] ?? 'fake response' }
}

// supabase/functions/chat/index.ts
import { OpenAIProvider, FakeLLMProvider } from '../_shared/openai-adapter.ts'

const provider = Deno.env.get('USE_FAKE_LLM') === '1'
  ? new FakeLLMProvider({ 'hi': 'fake hello' })
  : new OpenAIProvider()
```

```bash
USE_FAKE_LLM=1 supabase functions serve chat
deno test --allow-all supabase/functions/tests/chat-test.ts
```

## Pattern 5 — Characterization test (Edge Function legada)

Captura comportamento atual como golden snapshot **antes** de refatorar. Ver [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md).

```ts
import { assertEquals } from 'jsr:@std/assert@1'
import payloads from './fixtures/orders-payloads.json' with { type: 'json' }

Deno.test('orders — characterization (5 equivalence classes)', async (t) => {
  for (const { name, input, expected_status } of payloads) {
    await t.step(name, async () => {
      const res = await fetch('http://localhost:54321/functions/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_PUBLISHABLE_KEY')! },
        body: JSON.stringify(input),
      })
      assertEquals(res.status, expected_status)
      const body = await res.json()
      await assertSnapshot(t, body)   // jsr:@std/testing/snapshot
    })
  }
})
```

5 grupos canônicos: happy path · validation error · auth error · rate limit · downstream timeout.

## Pattern 6 — Local debug com Chrome DevTools

```bash
# Serve em inspect mode — pausa na primeira linha
supabase functions serve orders --inspect-mode brk
```

No Chrome:
1. Navegar para `chrome://inspect`
2. Clicar **Configure...** ao lado de "Discover network targets"
3. Adicionar `127.0.0.1:8083` → **Done**
4. Aguardar target aparecer; clicar **Open dedicated DevTools for Node**
5. Mandar request: `curl http://localhost:54321/functions/v1/orders -d '{}'`
6. DevTools pausa na primeira linha → **Sources** → `file:///home/deno/functions/orders/index.ts`
7. Set breakpoints, step through.

Modos: `brk` (pausa primeira linha) ou `wait` (aguarda debugger antes de qualquer execução).

## Pattern 7 — Background task / WebSocket local

```toml
# supabase/config.toml
[edge_runtime]
policy = "per_worker"        # mantém isolate alive entre requests
```

Sem `per_worker`, isolate termina após request — `EdgeRuntime.waitUntil` é cortado, WebSocket fecha. Caveat: hot-reload **desativado**; restart manual:

```bash
# Ctrl+C e relançar
supabase functions serve orders
```

## Pattern 8 — Test de erro client-side

```ts
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from 'npm:@supabase/supabase-js@2.95.0'

Deno.test('orders — error classification', async () => {
  const { error } = await supabase.functions.invoke('orders', { body: { bad: true } })
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json()
    assertEquals(body.code, 'VALIDATION')
  } else if (error instanceof FunctionsRelayError) {
    // gateway↔supabase issue
  } else if (error instanceof FunctionsFetchError) {
    // função inalcançável (down)
  }
})
```

## Logging gotchas durante debug

```ts
// ⚠ Errado — Headers não é enumerable em JSON.stringify
console.log(`Headers: ${JSON.stringify(req.headers)}`)   // sempre "{}"

// ✓ Certo
console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers), null, 2))
```

Limites runtime hospedado:
- Custom log message: até **10.000 chars**
- Log event threshold: **100 events / 10s**

Em prod, logs aparecem em [Functions > seu nome > Logs] no Dashboard. Em dev, no terminal do `supabase functions serve`.

## Anti-patterns

### AT1 — Test direto contra prod
Sempre `supabase start` local + `SUPABASE_URL=http://localhost:54321`. Test em prod = dados reais sujos + custo.

### AT2 — Mockar Supabase client inteiro
Prefira `supabase start` (DB real, schema real). Mocks divergem de produção e mascaram bugs de migration (ver feedback do projeto v1.20+).

### AT3 — Hot-reload com `per_worker`
Quando necessário (WebSocket/background), aceite restart manual. Não tente forçar hot-reload com `per_worker` — comportamento indefinido.

### AT4 — Esquecer `--env-file`
Sem `--env-file`, env vars custom não chegam na função (apenas as Supabase pre-populadas). 401 em produção mas verde local.

### AT5 — Test que escreve sem cleanup
Use `beforeEach`/`afterEach` ou `Deno.test` com setup/teardown via `t.step`. Estado entre testes corrompe assertions.

## Ver também

- [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) — base
- [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md) — autenticar tests com user JWT
- [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md) — status codes esperados
- [`supabase-pgtap-testing`](../supabase-pgtap-testing/SKILL.md) — tests de DB/RLS (complementar)
- [`legacy-characterization-tests`](../legacy-characterization-tests/SKILL.md) — pré-refactor
- [`legacy-api-only-applications`](../legacy-api-only-applications/SKILL.md) — adapter + fake provider
- [`pre-refactor-characterization`](../pre-refactor-characterization/SKILL.md) — payload capture
- [`ai-prompt-characterization`](../ai-prompt-characterization/SKILL.md) — Edge Functions com LLM
