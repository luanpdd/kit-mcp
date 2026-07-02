# Phase 95: SLO Definitions - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Depends on:** Phase 94 ✅

<domain>
**OBS-18-03:** `.planning/slos/mcp-tool-availability.yml` — SLI ratio success/total. Target 99.5%. Window 30d sliding.
**OBS-18-04:** `.planning/slos/mcp-tool-latency.yml` — SLI p95 latency. Target ≤200ms. Window 30d.

Apply skill `event-based-slos` (decouple what/why; canonical event-based pattern do livro Google SRE).

</domain>

<decisions>
### Restrições
- Stable API v1.0+ preservada — só adiciona docs.
- Zero deps novas.
- Phase 94 metrics alimentam SLI calculation.

### Files

**`.planning/slos/mcp-tool-availability.yml`:**
```yaml
slo:
  name: mcp-tool-availability
  service: kit-mcp
  description: "Ratio of successful MCP tool invocations across all exposed tools."
sli:
  type: event-based
  event_source: src/core/metrics.js (counters)
  good_events: counters[*:ok] sum
  total_events: counters[*:ok] + counters[*:error] sum
  ratio: good_events / total_events
target: 0.995  # 99.5%
window: 30d sliding
error_budget:
  monthly: 0.5%  # = 30d * 0.005 events
  alert_threshold:
    page: 14.4 (2% budget burned in 1h — fast burn)
    ticket: 6 (10% in 6h — slow burn)
data_retention:
  in_memory: histograms FIFO N=1000 per tool
  long_term: not yet (P3 v1.19+ roadmap — log-to-disk via metrics-snapshot tool)
```

**`.planning/slos/mcp-tool-latency.yml`:**
```yaml
slo:
  name: mcp-tool-latency
  service: kit-mcp
  description: "p95 latency of MCP tool invocations."
sli:
  type: percentile
  source: src/core/metrics.js (histograms)
  percentile: 95
target_ms: 200
window: 30d sliding
```

**`.planning/slos/README.md`:**
- Overview de event-based SLOs.
- Como `metrics-snapshot` tool alimenta SLI.
- Workflow: `kit metrics-snapshot` → calculate SLI → compare vs target.
- Future: `/burn-rate-status` command já existe e pode consumir esses SLOs.

### Test
- Schema test: YAML parse + required fields presentes.

</decisions>

<deferred>
- Long-term metrics retention (log-to-disk) — v1.19+.
- Multi-window burn-rate alert calculation — v1.19+ (já tem skill).
</deferred>
