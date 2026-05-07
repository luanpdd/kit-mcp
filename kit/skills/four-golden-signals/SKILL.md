---
name: four-golden-signals
description: Use ao instrumentar serviço user-facing — Latency + Traffic + Errors + Saturation, percentis (não mean), histogram exponencial, latência success vs error separadas.
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
