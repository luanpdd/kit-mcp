---
name: cascading-failures
cost_tier: leve
description: Previne cascading failures (cap 22 Google SRE) — entrega patterns de timeout agressivo, retry com jitter, deadline propagation e circuit breaker. Use ao desenhar/auditar serviços com deps externas.
---

# SRE — Addressing Cascading Failures

## Quando usar

LLM carrega esta skill ao analisar serviço com risco de cascade, ou durante incident em progresso onde failure se amplifica. Trigger phrases:

- "cascading failure", "falha em cascata"
- "retry storm", "thundering herd"
- "outage propagando", "serviço caindo um após outro"
- "como prevenir cascade?", "circuit breaker"
- "cap 22 Google SRE"
- "deadline propagation", "load shedding"

## Regras absolutas

- **Cascade tem 5 triggers canônicos:** server overload, resource exhaustion, service unavailability, latency spike sem timeout, retry sem jitter. Memorize-os.
- **Prevenção custa 1×, recuperação custa 100×.** Toda dep crítica DEVE ter timeout + retry com jitter + circuit breaker + deadline propagation. Sem isso, cascade é questão de tempo.
- **Saturation (cap 6 v1.10) é early warning de cascade.** Quando saturation > 80%, ainda há tempo. Quando hit 100%, já está em cascade.
- **Retry SEMPRE com jitter.** Full jitter por default (`delay = random(0, base × 2^attempt)`). Sem jitter = thundering herd garantido.
- **Retry SEMPRE com deadline.** Retry sem timeout amplifica cascade — call de 30s vira 90s vira 270s. Deadline propagation evita work zumbi.
- **Circuit breaker DEFAULT em qualquer dep externa.** Estados closed/open/half-open. Open dispara após N failures consecutivas; half-open permite 1 probe; closed após probe verde.
- **Load shedding > 503 graceful > queue overflow.** Server saturated DEVE retornar 503 com Retry-After ANTES de aceitar request que vai falhar. Aceitar e cair = pior que rejeitar.
- **Slow start em recovery.** Após outage, ramp-up gradual (10% → 25% → 50% → 100%). Full blast em recovery = falha de novo (caches frios, conn pools).

## Patterns canônicos

### Pattern 1: 5 triggers canônicos de cascade (cap 22)

```text
1. SERVER OVERLOAD
   Sintoma: load > capacity → latency p99 sobe 10× → errors 5xx → crashes
   Trigger upstream: traffic spike, outage de cache, batch job rodou em horário ruim
   Detect: Saturation gauge (cap 6) > 80% por > 5 min
   Resposta: load shedding + escalação manual

2. RESOURCE EXHAUSTION
   Tipos: CPU, memory, file descriptors, threads, connection pool
   Sintoma específico:
     CPU 100% → latency sobe; FDs esgotados → "too many open files"
     Memory OOM → process kill; threads → deadlock; conn pool empty → wait
   Detect: monitor por recurso específico; alarmes em 80% de cada
   Resposta: configure limits; circuit breaker; rate limit caller

3. SERVICE UNAVAILABILITY (DEP DOWN)
   Sintoma: dep externa retorna 5xx ou timeout. Sem circuit breaker:
   N clients × M retries × T deadline = explosão de calls
   Detect: error rate de dep > 50% por 1 min; latency dep > p99 normal × 5
   Resposta: circuit breaker abre; fallback (cache, default value, degraded mode)

4. LATENCY SPIKE SEM TIMEOUT
   Sintoma: dep responde lento mas não falha. Caller fica esperando.
   Conn pool de caller esgota; novos requests também ficam pendurados.
   Detect: dep latency p99 > baseline × 5
   Resposta: timeout AGRESSIVO (ex: p99.9 baseline + 50%); circuit breaker

5. RETRY SEM JITTER
   Sintoma: 1000 clients retentam ao mesmo tempo após dep recovery.
   Server recém-recuperado é matado pelo wake-up.
   Detect: traffic spike no momento exato de recovery
   Resposta: full jitter; retry budget global; slow start
```

### Pattern 2: Defesa em camadas (cap 22)

Cada chamada externa precisa de **5 camadas de defesa**:

```ts
// Camada 1: Timeout agressivo
const TIMEOUT_MS = 2000  // p99.9 baseline + 50%

// Camada 2: Retry com jitter + deadline
async function callDep(input: Input, deadline: number): Promise<Output> {
  const startMs = performance.now()
  let attempt = 0
  let lastError: Error | undefined

  while (true) {
    const remaining = deadline - performance.now()
    if (remaining <= 0) throw new DeadlineExceededError(lastError)

    const callTimeoutMs = Math.min(TIMEOUT_MS, remaining)

    try {
      // Camada 3: Circuit breaker
      if (circuitBreaker.isOpen()) throw new CircuitOpenError()

      const result = await withTimeout(
        depClient.call(input),
        callTimeoutMs
      )
      circuitBreaker.recordSuccess()
      return result
    } catch (e) {
      lastError = e as Error
      circuitBreaker.recordFailure()

      // Camada 4: Não retentar erros não-retentáveis
      if (!isRetryable(e)) throw e

      // Camada 5: Retry budget global
      if (!retryBudget.tryAcquire()) throw new RetryBudgetExhaustedError(e)

      attempt++
      if (attempt >= MAX_RETRIES) throw e

      // Full jitter
      const baseMs = 100 * Math.pow(2, attempt - 1)
      const jitterMs = Math.random() * baseMs * 2
      await sleep(Math.min(jitterMs, remaining))
    }
  }
}

function isRetryable(e: any): boolean {
  // 4xx (validation, auth, not_found) → não retry
  // 5xx, timeout, connection reset → retry
  if (e.statusCode >= 400 && e.statusCode < 500) return false
  if (e.statusCode === 429) return true  // rate limited — retry com backoff
  return true
}
```

### Pattern 3: Circuit breaker — estados canônicos

```text
                    ┌────────────────────┐
                    │    CLOSED (normal) │
                    │  request flows OK  │
                    └─────────┬──────────┘
                              │ N consecutive failures
                              ▼
                    ┌────────────────────┐
                    │       OPEN         │
                    │  fail fast for T   │
                    │   no calls to dep  │
                    └─────────┬──────────┘
                              │ T elapsed
                              ▼
                    ┌────────────────────┐
                    │    HALF-OPEN       │
                    │  allow 1-N probes  │
                    └────┬───────────┬───┘
                  success │           │ failure
                          ▼           ▼
                       CLOSED        OPEN

Configuração canônica:
  N (failures-to-open):    5-10 consecutive
  T (open duration):       30-60s
  half-open probe count:   1-5
  failure detection window: 30-60s rolling
```

### Pattern 4: Deadline propagation across hops

```text
Client → Service A (deadline=30s) → Service B (deadline=?) → Service C (deadline=?)

WRONG (cascade amplification):
  A: receives deadline=30s, calls B with timeout=30s
  B: receives no deadline, default 30s, calls C with timeout=30s
  C: takes 30s
  Total: 30s in C, plus parent overhead. Client gone at 30s, A-B-C still working.

RIGHT (deadline propagation):
  A: receives TTL=30s; takes 100ms processing; calls B with TTL=29.9s
  B: receives TTL=29.9s; takes 50ms; calls C with TTL=29.85s
  C: receives TTL=29.85s; works until that limit, no more
  When TTL hits 0, ALL hops fail fast. No zombie work.

Implementação:
  - HTTP: header `Deadline-Ms` ou similar (custom)
  - gRPC: built-in `grpc-timeout` header
  - JS/TS: AbortSignal.timeout(remainingMs)
  - Each hop: deadline = received_deadline - elapsed_local; abort se ≤ 0
```

### Pattern 5: Defesas server-side

Server protege a si próprio (não confia em clientes):

| Defesa | Técnica | Exemplo |
|---|---|---|
| **Rate limit per-client** | Token bucket no proxy/gateway | Kong/Envoy rate limit; 100 req/s/client |
| **Concurrency limit** | Semaphore no handler | Máx 1000 in-flight; reject 503 if cheio |
| **Queue depth limit** | Bound + drop policy | Queue máx 10k msgs; drop oldest > 5k |
| **Resource budget** | Cgroups / container limits | CPU 4 cores, memory 8GB hard cap |
| **Slow start na recovery** | Gradual ramp | Aceita 10% → 25% → 50% → 100% por 5 min |

### Pattern 6: Testing for cascading failures

Antes de prod, exercitar cascade scenarios:

```text
1. Game day exercise
   - Cap 1 dep crítica em 50% errors via fault injection
   - Observar: caller circuit breakers abrem? Latency caller estável?
   - Métrica: zero impacto a clientes (degraded mode kicks in)

2. Load test até saturação
   - Ramp traffic até 1.5× expected peak
   - Confirmar: load shedding ativa antes de crash
   - Métrica: error rate sob 1% mesmo em 1.5× load

3. Chaos engineering
   - Random kill de instâncias (Chaos Monkey)
   - Confirmar: retries com jitter espalham wake-up
   - Métrica: SLO mantido durante 10 kills/hour
```

## Anti-patterns

### ANTI: timeout otimista

```text
ANTI: timeout = p99 baseline. "Maioria das requests fica abaixo".

PROBLEMA: tail latency (1%) sempre estoura. Cada 100 requests, 1
          consome timeout inteiro. Conn pool acumula slow requests.

CERTO: timeout = p99.9 baseline + 50% margem. Aceita que 0.1% será
       cancelado. Tail é problema de dep, não cliente.
```

### ANTI: retry infinito com backoff "razoável"

```text
ANTI: retry até sucesso, com 1s/2s/4s/8s/... exponencial sem cap.

PROBLEMA: durante outage de 30 min, último retry seria após 30 min
          esperando. Conn fica pendurada. Memory leak.

CERTO: max retries = 3-5; max backoff = 30s; deadline global
       (request terminada após T segundos não importa quantos
       retries). Após max, fallback ou error final.
```

### ANTI: circuit breaker per-instance (não compartilhado)

```text
ANTI: cada instância de service A tem seu próprio circuit breaker
      pra dep B. Quando B fica lenta, instância 1 abre circuito,
      mas instâncias 2-100 ainda pingam B até abrirem.

PROBLEMA: 100× mais carga em B doente. B nunca recupera.

CERTO: circuit breaker compartilhado (e.g., via Redis/Memcached para
       state) OR lib que detecta failure rate cross-instance via
       gossip/coordination. Open = cluster all stop.
```

### ANTI: load shedding via reject ao invés de 503 + Retry-After

```text
ANTI: server saturated → drop conn TCP-level (RST).

PROBLEMA: client não sabe que precisa esperar. Retry imediato.
          Mais carga. Retry storm.

CERTO: 503 Service Unavailable + Retry-After: 30 (segundos).
       Client aware retry com delay. Backoff respeitado.
```

### ANTI: graceful degradation só em prod

```text
ANTI: degraded mode só liga durante incident; nunca exercitado.

PROBLEMA: quando precisa, descobre bug no degraded mode. Outage
          piora.

CERTO: degraded mode é PATH PRINCIPAL em alguma fração de tráfego
       (1%) por padrão. Sempre exercitado. Quando dep cai, ramp pra
       100% degraded é tested transition.
```

## Verificação

Antes de aceitar serviço em prod:

1. Toda chamada a dep externa tem timeout < p99.9 baseline + 50%
2. Toda retry tem jitter (full jitter default)
3. Toda chamada respeita deadline propagation
4. Circuit breaker ativo em deps críticas (estados closed/open/half-open)
5. Server-side: rate limit + concurrency limit + queue depth bound
6. Slow start configurado em deploy/recovery
7. Game day exercise rodado nos últimos 90 dias
8. Saturation gauge (cap 6) instrumentado e alertado em 80%

---

## Clock Skew como Failure Mode (v1.22+)

> Além dos triggers canônicos do cap 22 (sem timeout, retry sem jitter, sem circuit breaker), clock skew é failure mode adicional em sistemas distribuídos: nó com relógio adiantado pode marcar lease expirada antes do tempo real, disparando reeleição desnecessária e cascading failure. Padrão de mitigação (fencing token + nunca usar `clock_timestamp()` em lógica de expiração) em [`armadilhas-sistemas-distribuidos`](../armadilhas-sistemas-distribuidos/SKILL.md) (v1.22 — DDIA Ch 8).

## Ver também

- [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — vocabulário cap 22 (cascading failure, retry storm, etc.)
- [`retry-strategies`](../retry-strategies/SKILL.md) (v1.11) — detalhes de jitter + deadline propagation
- [`load-shedding-graceful-degradation`](../load-shedding-graceful-degradation/SKILL.md) (v1.11) — defesas server-side
- [`four-golden-signals`](../four-golden-signals/SKILL.md) (v1.10) — Saturation como early warning de cascade
- [`production-readiness-review`](../production-readiness-review/SKILL.md) (v1.10) — PRR Axe 4 verifica defesas
- [`omm-auditor`](../../agents/omm-auditor.md) (v1.9) — Capacidade 1 (Resilience) consume cascading-failures-auditor
- [`cascading-failures-auditor`](../../agents/cascading-failures-auditor.md) (v1.11) — agent que detecta gaps automaticamente

*Material-fonte: Site Reliability Engineering — Beyer/Jones/Petoff/Murphy (Google/O'Reilly, 2016) — Cap 22: "Addressing Cascading Failures".*
