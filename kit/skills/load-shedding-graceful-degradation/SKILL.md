---
name: load-shedding-graceful-degradation
cost_tier: leve
description: Instrumenta defesas server-side contra overload — load shedding (503+Retry-After), queue bound+drop policy, deadline-aware handlers e graceful degradation. Use ao desenhar handlers saturados.
---

# SRE — Load Shedding & Graceful Degradation

## Quando usar

LLM carrega esta skill ao desenhar/instrumentar handler/serviço user-facing que precisa proteger a si próprio de overload. Trigger phrases:

- "load shedding", "descarte de carga"
- "graceful degradation", "modo degradado"
- "queue management", "drop policy"
- "503 Service Unavailable", "Retry-After"
- "rate limit server-side"
- "deadline-aware handler"

## Regras absolutas

- **Load shedding > queueing > crashing.** Quando saturated, REJEITAR (503) é melhor que enfileirar (queue cresce indefinidamente) que é melhor que crashar (todos falhcos).
- **503 SEMPRE com Retry-After header.** Sem Retry-After, client retenta imediato → storm.
- **Drop policy DEFAULT: drop oldest.** FIFO drop (drop oldest) preserva latency para new requests; LIFO (drop newest) starva early requests. Default: drop oldest.
- **Queue depth deve ter limite.** Unbounded queue = OOM eventual. Bound = drop quando excede; observability sobre drop rate.
- **Degraded mode é DESIGN-TIME, não improviso.** Mode degradado é decidido upfront (cache stale OK, default values OK, simplified algo OK), não na hora do incident.
- **Deadline-aware handler.** Antes de processar, checar se request ainda relevante (deadline > now). Se não, aborta. Não desperdiça compute em request abandonada.
- **Concurrency limit per-handler.** Semaphore com limite. Excede = 503. Protege upstream resources (DB conn pool, memory, CPU).

## Patterns canônicos

### Pattern 1: Saturation-aware load shedder

```ts
// PT-BR: server-side load shedder canônico
class LoadShedder {
  private inFlight = 0
  private readonly maxConcurrent: number
  private readonly cpuThreshold: number
  private readonly queueDepthThreshold: number

  constructor(opts: { maxConcurrent: number; cpuThreshold?: number; queueDepthThreshold?: number }) {
    this.maxConcurrent = opts.maxConcurrent
    this.cpuThreshold = opts.cpuThreshold ?? 90
    this.queueDepthThreshold = opts.queueDepthThreshold ?? 0.95
  }

  async tryAcquire(): Promise<{ ok: true } | { ok: false; reason: string; retryAfterSec: number }> {
    // Check 1: concurrency limit
    if (this.inFlight >= this.maxConcurrent) {
      return { ok: false, reason: 'concurrency_limit', retryAfterSec: 5 }
    }

    // Check 2: CPU saturation (último 30s)
    const cpu = await this.getCpuUsage()
    if (cpu > this.cpuThreshold) {
      return { ok: false, reason: 'cpu_saturation', retryAfterSec: 10 }
    }

    // Check 3: queue depth (downstream like pgmq, redis, kafka)
    const queueRatio = await this.getQueueDepthRatio()
    if (queueRatio > this.queueDepthThreshold) {
      return { ok: false, reason: 'queue_depth', retryAfterSec: 30 }
    }

    this.inFlight++
    return { ok: true }
  }

  release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1)
  }
}

// Uso em handler
const shedder = new LoadShedder({ maxConcurrent: 1000, cpuThreshold: 90 })

Deno.serve(async (req) => {
  const acq = await shedder.tryAcquire()
  if (!acq.ok) {
    return new Response('Service Unavailable', {
      status: 503,
      headers: { 'Retry-After': String(acq.retryAfterSec), 'X-Shed-Reason': acq.reason },
    })
  }
  try {
    return await handleRequest(req)
  } finally {
    shedder.release()
  }
})
```

### Pattern 2: Drop policies para queue

```text
DROP OLDEST (FIFO drop) — RECOMMENDED DEFAULT
==============================================
when queue.size > limit:
  queue.shift()  // remove primeiro elemento
  queue.push(new)
Pros: requests new flowing; latency previsível pra novos
Cons: requests velhos perdidos (já foram esperar muito)
Use case: webhooks, eventos rápidos, anything time-sensitive

DROP NEWEST (LIFO drop)
========================
when queue.size > limit:
  REJECT new request (don't push)
Pros: requests in-flight não interrompidos
Cons: starvation se traffic continua alto; latency cresce
Use case: batch processing onde antiguidade importa (FIFO required)

DROP RANDOM
============
when queue.size > limit:
  randomly drop existing OR new
Pros: fairness statisticamente
Cons: harder to reason about; latency menos previsível
Use case: research/exploratory, raramente production

DROP BY PRIORITY
================
when queue.size > limit:
  drop lowest-priority element
Pros: SLA tiered customers; high-priority preserved
Cons: requires priority taxonomy; complexity
Use case: multi-tenant com tiers (Free/Pro/Enterprise)
```

### Pattern 3: Degraded mode design

```ts
// PT-BR: degraded mode é design-time, não improviso
interface ProductService {
  getProduct(id: string): Promise<Product>
}

// Modo NORMAL — full features
class FullProductService implements ProductService {
  constructor(
    private db: Db,
    private inventoryApi: InventoryApi,
    private reviewsApi: ReviewsApi,
    private personalizer: Personalizer,
  ) {}

  async getProduct(id: string): Promise<Product> {
    const [base, inv, reviews, personalized] = await Promise.all([
      this.db.fetch(id),
      this.inventoryApi.fetch(id),
      this.reviewsApi.fetch(id),
      this.personalizer.fetch(id),
    ])
    return { ...base, inventory: inv, reviews, personalized }
  }
}

// Modo DEGRADED — minimal features when deps down
class DegradedProductService implements ProductService {
  constructor(private db: Db, private cache: Cache) {}

  async getProduct(id: string): Promise<Product> {
    const cached = await this.cache.get(`product:${id}`)
    if (cached) return cached  // stale data is OK in degraded mode

    const base = await this.db.fetch(id)
    return {
      ...base,
      inventory: { available: 'unknown' },  // placeholder
      reviews: [],
      personalized: null,
    }
  }
}

// Selector — switches based on health
class HealthAwareProductService implements ProductService {
  constructor(
    private full: FullProductService,
    private degraded: DegradedProductService,
    private healthCheck: () => boolean,
  ) {}

  async getProduct(id: string): Promise<Product> {
    if (this.healthCheck()) {
      try {
        return await withTimeout(this.full.getProduct(id), 1000)
      } catch (e) {
        // fallback to degraded; log + alert
        return this.degraded.getProduct(id)
      }
    }
    return this.degraded.getProduct(id)
  }
}
```

**Princípio:** degraded mode é EXERCITADO em prod (1% de tráfego sempre passa por ele). Quando precisa virar 100%, é transição testada, não improviso.

### Pattern 4: Deadline-aware handler

```ts
// PT-BR: handler aborta cedo se deadline já estourou
async function deadlineAwareHandler(req: Request): Promise<Response> {
  const deadlineMs = parseDeadlineHeader(req)  // x-deadline-ms ou similar
  if (!deadlineMs) {
    return handleRequest(req)  // sem deadline declarado, comportamento default
  }

  // Check 1: deadline já estourou ANTES de processar
  if (Date.now() > deadlineMs) {
    return new Response('Deadline Exceeded', {
      status: 408,  // Request Timeout
      headers: { 'X-Deadline-Exceeded': 'true' },
    })
  }

  // Check 2: usar AbortSignal pra abortar se deadline estourar durante processing
  const remaining = deadlineMs - Date.now()
  const signal = AbortSignal.timeout(remaining)

  try {
    return await handleRequestWithSignal(req, signal)
  } catch (e) {
    if (signal.aborted) {
      return new Response('Deadline Exceeded', { status: 408 })
    }
    throw e
  }
}

function parseDeadlineHeader(req: Request): number | null {
  const h = req.headers.get('x-deadline-ms')
  if (!h) return null
  return parseInt(h, 10)  // unix ms epoch
}
```

### Pattern 5: Slow start em recovery

```ts
// PT-BR: após service recovery, aceita gradual
class SlowStartLoadBalancer {
  private acceptanceRatio = 0.0
  private startedAt: number | null = null
  private readonly rampDurationMs: number = 5 * 60 * 1000  // 5 min

  recoveryDetected(): void {
    this.acceptanceRatio = 0.1
    this.startedAt = Date.now()
  }

  shouldAccept(): boolean {
    if (this.acceptanceRatio >= 1.0) return true
    if (this.startedAt === null) return true

    const elapsed = Date.now() - this.startedAt
    const progress = Math.min(elapsed / this.rampDurationMs, 1.0)

    // ramp: 10% → 100% over rampDurationMs
    this.acceptanceRatio = 0.1 + (0.9 * progress)

    return Math.random() < this.acceptanceRatio
  }
}

// Em handler
const slowStart = new SlowStartLoadBalancer()

Deno.serve(async (req) => {
  if (!slowStart.shouldAccept()) {
    return new Response('Service Recovering', {
      status: 503,
      headers: { 'Retry-After': '30' },
    })
  }
  return handleRequest(req)
})
```

### Pattern 6: Tiered shedding (feature flags)

Diferentes features têm diferentes priority:

```ts
// PT-BR: critical features sempre servidas; nice-to-have desligadas em load
async function handleRequest(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname
  const cpuLoad = await getCpuLoad()

  // Path 1: critical (login, checkout) — sempre servido
  if (CRITICAL_PATHS.includes(path)) {
    return handleCritical(req)
  }

  // Path 2: important (browse, search) — degraded mode acima de 70%
  if (IMPORTANT_PATHS.includes(path)) {
    if (cpuLoad > 70) {
      return handleDegraded(req)  // sem personalization, sem ML ranking
    }
    return handleNormal(req)
  }

  // Path 3: nice-to-have (recommendations, A/B experiments) — desligado acima de 80%
  if (cpuLoad > 80) {
    return new Response(null, { status: 204 })  // No Content; UI handle
  }
  return handleNiceToHave(req)
}
```

## Anti-patterns

### ANTI: queue unbounded

```text
ANTI: queue cresce ilimitadamente; "vamos processar quando puder".

PROBLEMA: memory exhaustion eventual. OOM kill. Queue lost. Pior caso
          que rejeitar early.

CERTO: bound + drop policy. Tamanho cap baseado em SLA latency
       (queue_size_max / throughput < SLA_max_latency).
```

### ANTI: 503 sem Retry-After

```text
ANTI: server saturated → status 503 + body "try again later".

PROBLEMA: client não sabe quanto esperar. Retenta imediato. Storm.

CERTO: 503 + Retry-After: <segundos>. Client respeita header.
       Backoff distribuído.
```

### ANTI: degraded mode improvisado em incident

```text
ANTI: durante outage, "vamos cortar feature X temporariamente". 
      No code path para isso; engineering ad-hoc.

PROBLEMA: bug introduzido sob pressão. Outage piora.

CERTO: degraded mode é design-time. Path implementado e testado em
       dev/staging. Switch via feature flag. 1% do tráfego sempre
       exercita o path.
```

### ANTI: handler ignora deadline

```text
ANTI: handler processa request por 30s. Client desistiu em 5s.
      29 segundos de work zumbi.

PROBLEMA: recursos consumidos por work morto. Throughput cai.

CERTO: deadline-aware handler. Check at entry. AbortSignal durante
       processing. Aborta cedo.
```

### ANTI: rate limit só client-side

```text
ANTI: SDK do client tem rate limit. Server confia.

PROBLEMA: cliente bug ignora rate limit. Cliente malicioso ignora.
          Outros bypassam SDK.

CERTO: rate limit server-side em proxy/gateway (Kong, Envoy, AWS API
       Gateway). Per-API-key, per-IP, global. Hard limit.
```

## Verificação

1. Load shedder ativo em handlers user-facing
2. Drop policy explícita em queues (não default infinity)
3. 503 retorna sempre com Retry-After
4. Deadline-aware handler em chamadas externas
5. Degraded mode implementado E exercitado (não só design)
6. Slow start em recovery configurado
7. Concurrency limit per-handler
8. Saturation metrics (cap 6 v1.10) instrumentadas

---

## Ver também

- [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — vocabulário (load shedding, drop policy, etc.)
- [`cascading-failures`](../cascading-failures/SKILL.md) (v1.11) — pattern paralelo (caller-side defenses)
- [`retry-strategies`](../retry-strategies/SKILL.md) (v1.11) — caller-side retry coopera com server-side shed
- [`four-golden-signals`](../four-golden-signals/SKILL.md) (v1.10) — Saturation gauge dispara load shed
- [`load-shedding-instrumenter`](../../agents/load-shedding-instrumenter.md) (v1.11) — agent que aplica patches
- [`supabase-edge-fn-writer`](../../agents/supabase-edge-fn-writer.md) (v1.8 + patch v1.11) — Edge Functions ganham load shed built-in

*Material-fonte: Site Reliability Engineering — Beyer/Jones/Petoff/Murphy (Google/O'Reilly, 2016) — Cap 22 (subsections sobre load shedding e graceful degradation).*
