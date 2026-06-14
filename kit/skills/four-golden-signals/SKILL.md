---
name: four-golden-signals
cost_tier: leve
description: Instrumenta serviço user-facing com 4 golden signals (Latency+Traffic+Errors+Saturation) via OTel — histogram exponencial, percentis p50/p95/p99, latência success vs error separadas.
---

# SRE — Four Golden Signals

## Quando usar

LLM carrega esta skill ao instrumentar Edge Function/serviço/microservice user-facing. Trigger phrases:

- "golden signals", "4 sinais dourados"
- "latency, traffic, errors, saturation"
- "instrumentar serviço", "métricas mínimas"
- "p99 latency", "percentis vs mean"
- "black-box vs white-box monitoring"
- "Google SRE cap 6"
- "Latency success vs error"

## Regras absolutas

- **4 sinais são universais para serviço user-facing** — Latency + Traffic + Errors + Saturation. Se mede esses 4, captura ~95% da saúde operacional. Outros sinais (CPU, memória, disco I/O) são **causas potenciais**, não sintomas — vão em white-box monitoring secundário.
- **Latency success vs error sempre separadas** — falhas rápidas (HTTP 500 em 5ms) mascaram latência ruim de successes se misturadas. Sempre `histogram(duration_ms, {result: 'success'})` e `histogram(duration_ms, {result: 'error'})` em séries distintas.
- **NUNCA mean para latency** — long tail invisível: mean=50ms mas p99=5000ms é UX ruim para 1% dos usuários (tipicamente os mais valiosos: enterprise tier). SEMPRE histogram com percentis.
- **Histogram com bucketing exponencial** — buckets `[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]` ms ou base 1.5/2. Captura long tail sem cardinality explosion.
- **Errors counter por error.type (não message)** — `error.type` enumerado (5-15 valores: `timeout`, `validation`, `auth`, `rate_limit`, `db`, `provider_down`, ...). `error.message` é alta cardinalidade — não usar como dimension.
- **Saturation é resource-specific** — não existe métrica genérica de saturação. Para HTTP service: connection pool used %. Para DB: tablespace used %. Para queue: queue depth. Para CPU-bound: load average. Identificar O recurso mais escasso ANTES de instrumentar.
- **Black-box monitora UX, white-box monitora internals** — black-box (synthetic prober HTTP) detecta "site offline" mesmo se métricas internas estão verdes (corner case clássico). White-box (golden signals) explica "porquê" quando black-box dispara.
- **Reportar p50, p95, p99, p99.9 — não só p99** — p50 (mediana) é UX típica; p95 é primeiro deslize; p99 é cauda; p99.9 é seu 1 em 1000 que é seu cliente enterprise. Cada percentil conta uma história diferente.

## Patterns canônicos

### Pattern: definição canônica dos 4 signals (tabela)

| Signal | Definição | Tipo de instrument | Granularity recomendada |
|---|---|---|---|
| **Latency** | Tempo de request bem-sucedido vs falho — SEPARADO | Histogram (ms) com bucketing exponencial | Por endpoint × `result` (success/error) |
| **Traffic** | Volume de demanda — requests/s, msgs/s, bytes/s | Counter | Por endpoint × method |
| **Errors** | Taxa de requests que falharam (explícitas: 5xx; implícitas: 200 com payload errado; políticas: > SLO target) | Counter | Por endpoint × `error.type` |
| **Saturation** | "Quão cheio" o serviço está — % do recurso mais escasso | ObservableGauge (%) | Por resource (connection pool, queue, CPU) |

### Pattern: instrumentação canônica em OTel SDK (TypeScript/Deno)

```ts
// PT-BR: 4 golden signals em Edge Function — copiar este shape
import { trace, metrics } from '@opentelemetry/api'

const tracer = trace.getTracer('orders-service')
const meter = metrics.getMeter('orders-service')

// PT-BR: 1. LATENCY — histogram bucketed exponencial
const latencyHistogram = meter.createHistogram('http_request_duration_ms', {
  description: 'Request latency in ms — split by result',
  unit: 'ms',
  advice: { explicitBucketBoundaries: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] }
})

// PT-BR: 2. TRAFFIC — counter de requests recebidos
const trafficCounter = meter.createCounter('http_requests_total', {
  description: 'Total HTTP requests received'
})

// PT-BR: 3. ERRORS — counter por error.type (categoria, não message)
const errorsCounter = meter.createCounter('http_errors_total', {
  description: 'Total HTTP errors by error.type'
})

// PT-BR: 4. SATURATION — gauge do recurso mais escasso
const saturationGauge = meter.createObservableGauge('db_connection_pool_used_pct', {
  description: 'DB connection pool utilization %',
  unit: '%'
})
saturationGauge.addCallback((result) => {
  // PT-BR: callback executado em scrape — lê estado atual do pool
  result.observe(getConnectionPoolUsedPct(), { resource: 'db_pool', service: 'orders' })
})

export async function placeOrder(req: Request) {
  const startMs = performance.now()
  const dims = { endpoint: '/api/v1/orders', method: 'POST' }

  // PT-BR: 2. Traffic — incrementar antes de processar
  trafficCounter.add(1, dims)

  return tracer.startActiveSpan('place_order', async (span) => {
    try {
      const order = await db.insertOrder(req.body)
      // PT-BR: 1. Latency success — só após success confirmar
      const durationMs = performance.now() - startMs
      latencyHistogram.record(durationMs, { ...dims, result: 'success' })
      return order
    } catch (e) {
      // PT-BR: 1. Latency error — separada da success
      const durationMs = performance.now() - startMs
      latencyHistogram.record(durationMs, { ...dims, result: 'error' })
      // PT-BR: 3. Errors — counter por error.type (enum baixa cardinalidade)
      errorsCounter.add(1, { ...dims, error_type: classify(e) })
      throw e
    } finally {
      span.end()
    }
  })
}

// PT-BR: classifier — enum estável de 5-15 valores
function classify(e: unknown): string {
  if (e instanceof TimeoutError) return 'timeout'
  if (e instanceof ValidationError) return 'validation'
  if (e instanceof AuthError) return 'auth'
  if (e instanceof RateLimitError) return 'rate_limit'
  if (e instanceof DbError) return 'db'
  return 'unknown'
}
```

### Pattern: queries SQL para 4 signals em 1 dashboard

```sql
-- PT-BR: dashboard único — 4 golden signals últimos 60 minutos, por minuto
select
  date_trunc('minute', timestamp) as minute,
  -- Traffic
  count(*) as traffic_rpm,
  -- Errors (por error.type)
  count(*) filter (where result_success = false) as errors_total,
  count(*) filter (where error_type = 'timeout') as errors_timeout,
  count(*) filter (where error_type = 'rate_limit') as errors_rate_limit,
  count(*) filter (where error_type = 'db') as errors_db,
  -- Latency p50/p95/p99 — APENAS success
  percentile_cont(0.50) within group (order by duration_ms)
    filter (where result_success = true) as latency_p50_success,
  percentile_cont(0.95) within group (order by duration_ms)
    filter (where result_success = true) as latency_p95_success,
  percentile_cont(0.99) within group (order by duration_ms)
    filter (where result_success = true) as latency_p99_success,
  -- Latency p99 — APENAS error (visibilidade de error path lentidão)
  percentile_cont(0.99) within group (order by duration_ms)
    filter (where result_success = false) as latency_p99_error,
  -- Saturation (gauge max no minuto)
  max(connection_pool_used_pct) as saturation_pool_max
from observability.events
where service = 'orders-api' and timestamp > now() - interval '60 minutes'
group by minute
order by minute desc;
```

### Pattern: black-box probe complementar (synthetic check)

```ts
// PT-BR: black-box monitoring — chamar serviço como cliente externo
// Roda em CI ou serviço external (uptimerobot, datadog synthetics)
async function blackBoxProbe(): Promise<{ ok: boolean; durationMs: number }> {
  const startMs = Date.now()
  const r = await fetch('https://api.example.com/api/v1/orders/probe', {
    method: 'POST',
    body: JSON.stringify({ probe: true, sku: 'TEST-001' }),
    headers: { 'X-Probe': 'true' }
  })
  const durationMs = Date.now() - startMs
  // PT-BR: validar resposta — não basta status 200
  const body = await r.json()
  const ok = r.status === 200 && body.order_id != null && durationMs < 1000
  return { ok, durationMs }
}

// PT-BR: rodar a cada 30s; alerta se 3 consecutivos falham (debounce contra flake)
```

### Pattern: saturation por tipo de serviço

| Tipo de serviço | Recurso mais escasso | Métrica de saturation |
|---|---|---|
| HTTP API stateless | Connection pool DB | `db_connection_pool_used_pct` |
| API com cache | Memory do cache | `cache_memory_used_pct` |
| Worker async | Queue depth | `queue_depth_messages` |
| Edge Function | Concurrency limit Deno | `concurrent_executions_pct` |
| DB | Tablespace ou WAL | `disk_used_pct`, `wal_lag_bytes` |
| CPU-bound (encoder, ML) | Load average | `cpu_load_avg_5min` |
| Network egress | Bandwidth | `egress_bytes_per_sec_pct` |

## Anti-patterns

### ANTI: mean latency

```text
ANTI: alerta/dashboard com avg(duration_ms) — long tail invisível.

PROBLEMA: mean=50ms mas p99=5000ms = UX ruim invisível; cliente enterprise
          (no p99) sofre sem nunca disparar alerta. Mean é puxado para baixo
          por mass de requests rápidos; sinaliza "tudo ok" enquanto 1% dos
          users espera 5s.

CERTO: histogram com percentile_cont(0.99); alertar em p99 > target.
       Reportar p50/p95/p99/p99.9 para ver formato da distribuição.
```

### ANTI: latência success+error misturadas

```text
ANTI: histogram(duration_ms) sem dimension result.

PROBLEMA: falhas rápidas (HTTP 500 em 5ms quando timeout dispara cedo)
          puxam mean/percentis para baixo; mascaram lentidão real de
          requests bem-sucedidos. Dashboard mostra "p99=80ms" mas
          successes reais são 800ms.

CERTO: dimension {result: 'success'} vs {result: 'error'} SEMPRE separadas
       em séries distintas. SLI/SLO computado APENAS sobre success path.
```

### ANTI: Errors com error.message como dimension

```text
ANTI: errorsCounter.add(1, { error_message: e.message })

PROBLEMA: cada mensagem única é uma série temporal; cardinality explosion
          (1M+ séries em horas se message contém timestamps/IDs/random);
          time-series DB OOMs ou throttles; queries lentas/impossíveis;
          custo de armazenamento explode.

CERTO: enum error.type com 5-15 valores fixos (timeout, validation, auth,
       rate_limit, db, provider_down, unknown); error.message em
       log/span attribute (não métrica) para debug pontual.
```

### ANTI: monitoring causes não symptoms

```text
ANTI: alertar em "CPU > 80% / memory < 10% / threads > N"

PROBLEMA: mistura "what" (sintoma user-facing) com "why" (causa interna);
          falsos positivos (cron job legítimo dispara CPU);
          falsos negativos (sistema lento sem CPU alta — saturação em
          connection pool ou rede); on-call paginado por nada e
          incidents reais passam silenciosos.

CERTO: alertar em SLO burn rate sobre os 4 signals (event-based,
       customer-impacting); usar CPU/memory como debug context em
       white-box monitoring, não como alert source.
```

### ANTI: saturation genérica

```text
ANTI: copiar pattern de saturation de outro serviço sem identificar o
      gargalo real.

PROBLEMA: mede CPU em serviço onde gargalo é connection pool; mede memory
          em serviço CPU-bound; saturation alerta nunca dispara antes do
          incident; quando incident acontece, dashboard mostra "saturação
          OK" e ninguém sabe explicar por quê.

CERTO: identificar EXPLICITAMENTE o recurso mais escasso (DB pool? queue
       depth? Deno concurrency? tablespace?) ANTES de instrumentar (ver
       Pattern: saturation por tipo de serviço). Cada serviço tem 1 ou 2
       gargalos reais — instrumentar esses, não copiar template.
```

### ANTI: black-box only (sem white-box)

```text
ANTI: só prober externo (synthetic check), sem instrumentação interna.

PROBLEMA: sabe que "site offline" mas não sabe porquê; debug requer SSH
          em prod / log dive sem instrumentation; MTTR cresce horas;
          incidents repetem porque root cause nunca foi capturada.

CERTO: black-box detecta UX impact (cliente real não consegue) + white-box
       (4 signals) explica root cause. Os dois juntos: black-box dispara,
       white-box mostra qual signal degradou (latency? errors? saturation?)
       e em qual endpoint.
```

## Verificação

Antes de marcar instrumentação como production-ready, validar:

1. **Os 4 signals presentes** — Latency (histogram), Traffic (counter), Errors (counter por error.type), Saturation (gauge resource-specific)
2. **Latency separada** — `result: 'success'` e `result: 'error'` em séries distintas
3. **Histogram com bucketing exponencial** — não fixed buckets lineares
4. **error.type é enum (5-15 valores)** — não `error.message` como dimension
5. **Saturation tem o recurso certo identificado** — connection pool? queue depth? concurrency? CPU load?
6. **Black-box probe complementar** — synthetic check do happy path principal a cada 30s
7. **Dashboard de 4 signals** existe e é o **primeiro** lugar de debug em incident

## Saturation as cascading failure trigger (v1.11)

**Saturation > threshold é early warning de cascading failure** (cap 22). Quando ainda há tempo para load shedding manter SLO; quando hit 100%, já está em cascade. Threshold tuning canônico:

| Recurso | Warning | Critical | Ação automática |
|---|---|---|---|
| **CPU load** | > 70% | > 90% | Load shed; scale up |
| **Memory used** | > 80% | > 95% | Load shed; OOM protection |
| **Queue depth (pgmq)** | > 70% capacity | > 90% capacity | Drop oldest; scale consumers |
| **Connection pool (DB)** | > 70% used | > 90% used | Throttle slow queries; scale pool |
| **Concurrency limit** | > 80% inflight | > 95% inflight | Reject new (503 + Retry-After) |
| **File descriptors** | > 70% ulimit | > 90% ulimit | Close idle conns; scale up |

**Resposta canônica:** quando saturation > Critical, server-side ativa load shedding (skill `load-shedding-graceful-degradation` v1.11) — retorna 503 + Retry-After ANTES de aceitar request que vai falhar. Coopera com caller-side defesas (skill `retry-strategies` v1.11 — full jitter respeita Retry-After).

Cross-ref: `cascading-failures` (v1.11) detalha 5 triggers; `cascading-failures-auditor` (v1.11) detecta gaps em código.

## Ver também

- [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — termos canônicos golden signals, black-box, white-box, percentile
- [`opentelemetry-standard`](../opentelemetry-standard/SKILL.md) (v1.9) — OTel SDK base, exporter, OTLP
- [`structured-events`](../structured-events/SKILL.md) (v1.9) — wide events que alimentam SLI de Errors
- [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — SLO sobre Errors+Latency forma SLI canônico
- [`burn-rate-alerting`](../burn-rate-alerting/SKILL.md) (v1.9) — alertar em SLO burn-rate, não em CPU
- [`production-readiness-review`](../production-readiness-review/SKILL.md) — PRR axis "Instrumentation" exige 4 signals

---

*Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016) — Cap 6: "Monitoring Distributed Systems" (Four Golden Signals).*
