---
name: retry-strategies
description: Use ao implementar retry — full/equal/decorrelated jitter, exponential backoff cap, retry budget, idempotency keys, when NOT to retry. Cap 22 livro Google SRE.
---

# SRE — Retry Strategies

## Quando usar

LLM carrega esta skill ao escrever código que chama dep externa e precisa lidar com failure transient. Trigger phrases:

- "retry", "exponential backoff"
- "jitter", "thundering herd"
- "retry budget"
- "idempotency key", "safe to retry?"
- "quando NÃO retentar?"
- "retry storm"

## Regras absolutas

- **Retry SEM jitter = retry storm garantido.** Sempre adicione jitter (full por default).
- **Retry SEM deadline = work zumbi.** Cada retry respeita deadline propagation; após deadline aborta.
- **Retry SOMENTE em erros retentáveis.** 5xx, timeout, connection reset = retry. 4xx (validation, auth, not_found) = NÃO retry.
- **Idempotency key OBRIGATÓRIA em retry de write operation.** Sem idempotency, retry pode duplicar (charge double, send email twice, etc.).
- **Retry budget global limita amplificação.** Sem budget, retry total = N clients × M retries × cascading.
- **Max retries ≤ 3-5.** Mais que isso = bug não-transient mascarado.
- **Backoff cap obrigatório.** Sem cap, último retry pode ser horas. `min(base × 2^attempt, cap)`.
- **Não retry em rate limit a menos que respeite Retry-After.** 429 sem header → wait default; com header → respeita.

## Patterns canônicos

### Pattern 1: Tipos de jitter (cap 22)

```ts
// Full jitter — DEFAULT canônico (Google SRE recomenda)
function fullJitter(baseMs: number, attempt: number, capMs = 30000): number {
  const expBase = Math.min(baseMs * Math.pow(2, attempt), capMs)
  return Math.random() * expBase  // [0, expBase)
}

// Equal jitter — variação; metade fixa, metade jitter
function equalJitter(baseMs: number, attempt: number, capMs = 30000): number {
  const expBase = Math.min(baseMs * Math.pow(2, attempt), capMs)
  return expBase / 2 + Math.random() * (expBase / 2)
}

// Decorrelated jitter — para bursty load (AWS recomenda)
function decorrelatedJitter(baseMs: number, lastDelayMs: number, capMs = 30000): number {
  return Math.min(capMs, Math.random() * (lastDelayMs * 3 - baseMs) + baseMs)
}

// Comparação:
//   FULL JITTER: spread máximo, simples, default canônico
//   EQUAL JITTER: spread parcial, predictable mínimo
//   DECORRELATED: spread depende do último; melhor pra long outages
```

### Pattern 2: Retry com deadline propagation

```ts
async function callWithRetry<T>(
  call: () => Promise<T>,
  opts: {
    maxRetries: number
    baseMs: number
    capMs?: number
    deadlineMs: number  // unix ms; retry só se ainda há tempo
    isRetryable?: (e: Error) => boolean
    retryBudget?: RetryBudget
  }
): Promise<T> {
  const startMs = performance.now()
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Check deadline antes de cada attempt
    if (Date.now() > opts.deadlineMs) {
      throw new DeadlineExceededError(lastError)
    }

    try {
      return await call()
    } catch (e) {
      lastError = e as Error

      // Não-retentável → throw imediato
      if (opts.isRetryable && !opts.isRetryable(lastError)) throw lastError

      // Retry budget global
      if (opts.retryBudget && !opts.retryBudget.tryAcquire()) {
        throw new RetryBudgetExhaustedError(lastError)
      }

      // Last attempt — não delay
      if (attempt >= opts.maxRetries) throw lastError

      // Calcula delay com full jitter
      const delayMs = fullJitter(opts.baseMs, attempt, opts.capMs)

      // Não exceder deadline
      const remainingMs = opts.deadlineMs - Date.now()
      if (delayMs >= remainingMs) {
        throw new DeadlineExceededError(lastError)
      }

      await sleep(delayMs)
    }
  }
  throw lastError!
}
```

### Pattern 3: When NOT to retry — decision tree

```text
Erro recebido. Retry?

1. HTTP status 4xx (excluding 408, 429)?
   → NÃO retry. Validation/auth/not_found.
   400, 401, 403, 404, 422 → throw imediato.

2. HTTP status 408 (Request Timeout)?
   → SIM retry. Servidor pediu (request expirou no servidor).

3. HTTP status 429 (Too Many Requests)?
   → SIM retry, COM Retry-After header se presente.
   Sem Retry-After → backoff default + retry budget.

4. HTTP status 5xx?
   → SIM retry. Server error transient.

5. Network error (connection reset, DNS failure)?
   → SIM retry. Network transient.

6. Timeout local (AbortSignal.timeout estourou)?
   → SIM retry, mas check deadline global.

7. Custom error (validation interna, business rule)?
   → NÃO retry. Bug; retry não resolve.

8. OperationCancelled (deadline upstream)?
   → NÃO retry. Caller já desistiu.
```

```ts
function isRetryable(e: any): boolean {
  // 4xx geralmente não retry
  if (e.statusCode >= 400 && e.statusCode < 500) {
    if (e.statusCode === 408) return true
    if (e.statusCode === 429) return true
    return false
  }

  // 5xx retry
  if (e.statusCode >= 500 && e.statusCode < 600) return true

  // Network errors
  if (e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'EAI_AGAIN') return true

  // Aborts não retry (caller desistiu)
  if (e.name === 'AbortError' || e instanceof DeadlineExceededError) return false

  // Default: não retry
  return false
}
```

### Pattern 4: Idempotency key em writes

```ts
// PT-BR: idempotency key permite retry seguro de writes
import { randomUUID } from 'crypto'

interface CreateOrderInput {
  customerId: string
  items: OrderItem[]
  idempotencyKey?: string  // gerado se não fornecido
}

async function createOrderSafe(client: PaymentClient, input: CreateOrderInput): Promise<Order> {
  const key = input.idempotencyKey ?? randomUUID()

  return callWithRetry(
    () => client.createOrder({ ...input, idempotencyKey: key }),  // ← SAME KEY em retry
    {
      maxRetries: 3,
      baseMs: 500,
      capMs: 30000,
      deadlineMs: Date.now() + 30000,
      isRetryable,
    }
  )
}

// Server-side
async function createOrderHandler(input: CreateOrderInput): Promise<Order> {
  // Check se já processamos esta key
  const existing = await db.findByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing  // retorna mesmo result; safe to retry

  // Process; record com idempotency_key (UNIQUE constraint)
  return await db.transaction(async (tx) => {
    const order = await tx.orders.insert({
      ...input,
      idempotency_key: input.idempotencyKey,  // UNIQUE constraint catches duplicate
      created_at: new Date(),
    })
    return order
  })
}
```

**Anti-corruption:** idempotency keys SEMPRE em writes. Stripe, AWS S3, todos suportam. Se sua API não suporta, adicione (1 column UNIQUE).

### Pattern 5: Retry budget (cap 22)

```ts
// PT-BR: retry budget global limita amplificação
class RetryBudget {
  private tokens: number
  private readonly maxTokens: number
  private readonly refillRate: number  // tokens per second
  private lastRefillMs: number

  constructor(opts: { maxTokens: number; refillPerSec: number }) {
    this.tokens = opts.maxTokens
    this.maxTokens = opts.maxTokens
    this.refillRate = opts.refillPerSec
    this.lastRefillMs = Date.now()
  }

  tryAcquire(): boolean {
    this.refill()
    if (this.tokens < 1) return false
    this.tokens--
    return true
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefillMs) / 1000
    const refill = elapsed * this.refillRate
    this.tokens = Math.min(this.maxTokens, this.tokens + refill)
    this.lastRefillMs = now
  }
}

// Configuração canônica:
// - maxTokens = 10% da capacidade normal de calls/sec
// - refillPerSec = mesmo
// Se sua dep aguenta 1000 RPS, retry budget = 100 RPS de retries.
// Excede = circuit breaker abre OR caller falha rápido.

const retryBudget = new RetryBudget({ maxTokens: 100, refillPerSec: 100 })
```

### Pattern 6: Configuração canônica por tipo de call

| Tipo de call | Max retries | Base | Cap | Jitter |
|---|---|---|---|---|
| **Read DB query** | 3 | 50ms | 1000ms | full |
| **Write DB transaction** | 3 (com idempotency key) | 100ms | 5000ms | full |
| **HTTP API third-party** | 3 | 500ms | 30000ms | full |
| **Webhook delivery** | 5 | 1000ms | 60000ms | decorrelated |
| **Background job** | 5+ | 5000ms | 600000ms (10min) | decorrelated |
| **Real-time message** | 0-1 | — | — | — (deadline tight) |

### Pattern 7: Observability de retry

Métricas a instrumentar:

```ts
// Counter de retries por (dep, attempt)
metrics.counter('retries_total', { dep: 'stripe', attempt: '1' })  // attempt 1, 2, 3

// Counter de outcomes finais
metrics.counter('retry_outcomes_total', { dep: 'stripe', outcome: 'success_after_retry' })
metrics.counter('retry_outcomes_total', { dep: 'stripe', outcome: 'exhausted_max' })
metrics.counter('retry_outcomes_total', { dep: 'stripe', outcome: 'budget_exhausted' })
metrics.counter('retry_outcomes_total', { dep: 'stripe', outcome: 'deadline_exceeded' })

// Histogram de delay total adicionado por retry
metrics.histogram('retry_delay_added_ms', delayMs, { dep: 'stripe' })
```

Alertas:
- `rate(retries_total) > 10% × rate(requests_total)` → dep degradada; investigate
- `retry_outcomes{outcome="budget_exhausted"} > 0` → sistema sob storm; load shedding pode ajudar
- `histogram retry_delay_added_ms > p99 baseline × 5` → delays inflados; deps lentas

## Anti-patterns

### ANTI: retry sem jitter

```text
ANTI: setTimeout(call, 1000 * 2^attempt) — fixed exponential.

PROBLEMA: 1000 clients sincroniza retries. Storm na recovery.

CERTO: Math.random() * 1000 * 2^attempt — full jitter.
```

### ANTI: retry em 4xx

```text
ANTI: catch (e) { return retry(call) } sem checar status.

PROBLEMA: 400/422/404 retentado infinitamente. Bug não corrige sozinho.

CERTO: isRetryable(e) check antes de retry. 4xx (excluding 408, 429)
       throw imediato.
```

### ANTI: retry sem deadline

```text
ANTI: retry com max=5, base=1s. Worst case: 1+2+4+8+16=31s de delays.
      Plus call time. Cliente já desistiu.

PROBLEMA: work zumbi. Recursos consumidos sem benefit.

CERTO: deadline propagation. Cada attempt checa Date.now() vs deadline.
       Aborta cedo.
```

### ANTI: idempotency key per-attempt

```text
ANTI: retry gera NEW idempotency key cada attempt.

PROBLEMA: cada attempt vira write distinta. Charge double, email
          duplicado.

CERTO: idempotency key gerada UMA vez por call lógica. Mesma key
       em todos os attempts.
```

### ANTI: max retries muito alto

```text
ANTI: maxRetries = 20.

PROBLEMA: bug não-transient mascarado. Erro real demora pra aparecer.
          Logs de retry inundam observability.

CERTO: max 3-5. Mais que isso = error real, não transient. Falha
       rápido + alert > retry esperançoso.
```

## Verificação

1. Toda retry tem jitter (full por default)
2. Toda retry respeita deadline propagation
3. isRetryable() check em cada attempt
4. Idempotency key em writes
5. Retry budget global ativo
6. Max retries ≤ 5
7. Backoff cap ≤ 60s para user-facing
8. Métricas instrumentadas (counter retries, outcome, histogram delay)

---

## Ver também

- [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — vocabulário (jitter types, retry storm, etc.)
- [`cascading-failures`](../cascading-failures/SKILL.md) (v1.11) — retry sem jitter é trigger principal de cascade
- [`load-shedding-graceful-degradation`](../load-shedding-graceful-degradation/SKILL.md) (v1.11) — server-side coopera (503 + Retry-After)
- [`four-golden-signals`](../four-golden-signals/SKILL.md) (v1.10) — métricas de retry instrumentadas seguindo padrão
- [`supabase-edge-fn-writer`](../../agents/supabase-edge-fn-writer.md) (v1.8 + patch v1.11) — Edge Functions ganham retry-with-jitter built-in
- [`cascading-failures-auditor`](../../agents/cascading-failures-auditor.md) (v1.11) — agent detecta retry sem jitter

*Material-fonte: Site Reliability Engineering — Beyer/Jones/Petoff/Murphy (Google/O'Reilly, 2016) — Cap 22 (subsections sobre retry, jitter, deadline propagation).*
