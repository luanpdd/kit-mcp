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
