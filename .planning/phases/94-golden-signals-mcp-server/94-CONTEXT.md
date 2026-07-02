# Phase 94: Golden Signals MCP Server - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

Aplicar skill `four-golden-signals` ao próprio MCP server. Counter `tool_invocations_total` + Latency histogram (4 fixed buckets) para cada tool. Implementação minimalista zero-deps.

**OBS-18-01:** Counter API simples (Map<string, number>) + helper `incrementInvocation(tool, status)`.
**OBS-18-02:** Histogram API com buckets [50, 100, 250, 500, ∞] ms + helper `recordLatency(tool, ms)`.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada. Métricas são opt-in via novo MCP tool.
- Zero deps novas — Map + array stdlib only.
- Phase 79.01 gates guard preservado.
- Phase 84.01 sanitizeMcpError preservado em error path.
- Budget 6/6 deps mantido.

### Diretrizes

**`src/core/metrics.js` (NEW):**
- Module-level state: `counters = new Map()`, `histograms = new Map()`.
- `incrementInvocation(tool, status='ok'|'error')` — Map key = `${tool}:${status}`, value = count.
- `recordLatency(tool, ms)` — push para array histograms.get(tool); cap em N=1000 entries (FIFO drop) para bound memory.
- `snapshot()` — retorna `{counters: {...}, latencyP50, latencyP95, latencyP99 }` por tool. Calcula percentiles via sort (acceptable para N≤1000).
- `reset()` — clear ambas Maps. Triggered via env `KIT_MCP_METRICS_RESET=1` em boot.

**`src/mcp-server/index.js`:**
- Wrap central catch. Após success ou erro, chamar `incrementInvocation` + `recordLatency`.
- Status `error` para qualquer exception (incluindo guards de Phase 79.01).
- Tool name extraído do request payload.

**Novo MCP tool `metrics-snapshot`:**
- Retorna `metrics.snapshot()` JSON.
- No args.
- Sem auth (read-only).

**Test pattern:**
- Spawn MCP server, invoke 5 tools, query metrics-snapshot, assert counters bate.
- Latency histogram com inputs sintéticos.
- Reset env var test.

</decisions>

<code_context>
## Insights do Código Existente

- `src/mcp-server/index.js` central catch já existe (Phase 84.01).
- Helper pattern: `src/core/error-redaction.js` é referência de quality (JSDoc, exports, tests).
- Phase 80.02 PERF-13-01 slim cap pattern reusável.

</code_context>

<specifics>
## Ideias Específicas

- N=1000 cap em histograms — bound memory mas N≥100 dá percentile decente.
- Buckets fixos [50, 100, 250, 500, ∞] alinham com SRE practical thresholds.
- Sem export OTel/Prometheus — fora do escopo (kit-mcp é dev tool).

</specifics>

<deferred>
## Ideias Adiadas

- OTel SDK integration — overengineering para dev tool.
- Persistent metrics (file/socket) — em-memória OK.
- Distributed tracing — single-process MCP server, scope mínimo.

</deferred>
