# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.18 — Eat Your Own Dog Food (Fases 94-97)

**Milestone:** v1.18 — Eat Your Own Dog Food (kit auto-aplica observability/SRE skills que ele próprio ensina)
**Numeração de fases:** continua de v1.17 (último concluído: Fase 93) → v1.18 começa em **Fase 94**
**Total de fases:** 4 (Fases 94-97)
**Status:** Em andamento
**Criado:** 2026-05-09
**Origem:** 4 P1 carry-over do PRR v1.12.1 (Instrumentation fail axe 2/5) + coverage ratchet 65%→75% identificado em Phase 93. Story narrativa: framework que ENSINA observability/SRE deve PRATICAR.
[Detalhes](./milestones/v1.18-ROADMAP.md)

### Phase 94: Golden Signals MCP Server

**Goal:** Aplicar skill `four-golden-signals` ao próprio MCP server. Counter `tool_invocations_total` + Latency histogram (4 fixed buckets) para cada tool exposed. Implementação minimalista (Map + array, zero deps novas — fala via OpenTelemetry conceptualmente sem instalar SDK pesado).

**Escopo:**
- `src/core/metrics.js` (NOVO) — `Counter` + `Histogram` API simples (Map-based, in-memory).
- `src/mcp-server/index.js` — wrap handler central com `metrics.incrementInvocation(toolName, status)` + `metrics.recordLatency(toolName, ms)`.
- Export via novo MCP tool `metrics-snapshot` retornando counter + histogram percentiles (p50/p95/p99 via fixed buckets).
- Reset via env `KIT_MCP_METRICS_RESET=1`.

**Critérios de sucesso:**
- Cada chamada MCP incrementa counter (tool, status=ok/error).
- Latency p95 calculável via histogram buckets.
- `metrics-snapshot` tool funcional (test integration).
- Zero deps novas (Map + array stdlib).
- Suite continua passing + 4+ regression tests.

### Phase 95: SLO Definitions

**Goal:** Aplicar skill `event-based-slos` ao MCP server. Definir 2 SLOs canônicos em `.planning/slos/` — availability + latency — usando event-based pattern do livro Google SRE.

**Depends on:** Phase 94 (counter alimenta SLI calculation)

**Escopo:**
- `.planning/slos/mcp-tool-availability.yml` (NOVO) — SLI: ratio de invocations success/total. Target: 99.5%. Window: 30d sliding.
- `.planning/slos/mcp-tool-latency.yml` (NOVO) — SLI: p95 latency. Target: ≤200ms. Window: 30d.
- `.planning/slos/README.md` (NOVO) — explica como SLIs são calculados a partir do counter da Phase 94.
- Schema validation test (YAML parsing + frontmatter shape).

**Critérios de sucesso:**
- 2 SLO files YAML válidos.
- README explica derivation.
- Schema test passing.
- Workflows downstream (burn-rate-status command) podem consumir esses SLOs.
- Suite continua passing + 2+ regression tests.

### Phase 96: RUNBOOK + FAILURE-MODES + BENCHMARK

**Goal:** Aplicar skills `blameless-postmortems` e `production-readiness-review` produzindo 3 docs de operations: RUNBOOK (emergency response), FAILURE-MODES (top-down failure list), BENCHMARK (capacity envelope baseline).

**Depends on:** Phase 94

**Escopo:**
- `.planning/RUNBOOK.md` (NOVO) — emergency response steps para 5 cenários (MCP boot fail, sidecar hang, manifest mismatch, npm publish fail, sync corruption).
- `.planning/FAILURE-MODES.md` (NOVO) — top-down list de 8-10 failure scenarios com impact/likelihood/mitigation matrix.
- `.planning/BENCHMARK.md` (NOVO) — baseline measurements (cold start, sync wall time, memory footprint, p50/p95 latency) — provê reference para detecting regressions futuros.

**Critérios de sucesso:**
- 3 docs presentes em `.planning/`.
- RUNBOOK tem ≥5 cenários estruturados (Symptom → Diagnosis → Fix).
- FAILURE-MODES tem ≥8 entries com matrix.
- BENCHMARK tem ≥5 métricas baseline com timestamp.
- Cross-references com SLOs da Phase 95 e metrics da Phase 94.
- Test que valida estrutura básica dos 3 files.

### Phase 97: Coverage Ratchet

**Goal:** Subir coverage threshold de 65% → 75% endereçando os 4 hot files identificados em Phase 93 (cli/index.js 37%, mcp-server/install.js 19%, ui/auto-spawn.js 31%, core/failures.js 17%). Adicionar testes específicos para os hot paths não-cobertos.

**Depends on:** Phase 96 (CI gate update após docs estabilizadas)

**Escopo:**
- `test/unit/cli-index-coverage.test.js` (NOVO) — testes para hot paths de cli/index.js que estão sem cover (subcommands raros).
- `test/unit/install-coverage.test.js` (NOVO) — testes para mcp-server/install.js (instalador IDE-specific).
- `test/unit/auto-spawn-coverage.test.js` (NOVO) — testes para ui/auto-spawn.js (lockfile + spawn behavior).
- `test/unit/failures-coverage.test.js` (NOVO) — testes para core/failures.js (failure recording).
- `.github/workflows/ci.yml` — bump threshold 65 → 75.

**Critérios de sucesso:**
- Cada hot file tem coverage ≥70% (medido).
- Threshold global ≥75% no gate.
- Suite cresce ≥15 testes novos (4 files × ~4 tests cada).
- Suite continua passing.



<details>
<summary>✅ Concluídos</summary>

- v1.0.0 → v1.5.3 — early stabilization + patches
- v1.6.0 → v1.7.0 — Perf+lean
- v1.8.0 — Suíte Supabase
- v1.9.0 — Observabilidade
- v1.10.0 — SRE Engagement
- v1.11.0 — SRE Resilience & Release Engineering
- v1.12 — Legacy Code Mastery & AI-Era Refactoring
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — 2026-05-09 09:24Z. 11 REQs, 33 tests. [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)
- **v1.14.0 — Web/Core Security Hardening (Phases 82-84)** — 2026-05-09 11:46Z. 6 REQs HIGH, 63 tests. [Audit](./milestones/v1.14-MILESTONE-AUDIT.md)
- **v1.15.0 — DX & Token Economy Wave 2 (Phases 85-87)** — 2026-05-09 13:11Z. 5 REQs, 26 tests. [Audit](./milestones/v1.15-MILESTONE-AUDIT.md)
- **v1.16.0 — Performance Runtime Wave (Phases 88-89)** — 2026-05-09 14:17Z. 6 REQs, 18 tests. **Backlog meta-auditoria v1.12.1: 100% ZERADO**. [Audit](./milestones/v1.16-MILESTONE-AUDIT.md)
- **v1.17.0 — Performance Wave 2 + Quick Wins (Phases 90-93)** — 2026-05-09. 9 REQs (PERF-17-01..02, POL-17-01..04, INFRA-17-01..03), 27 tests, 344 baseline. PRR 22→24/30. Origem: meta-auditoria pós-v1.16. [Audit](./milestones/v1.17-MILESTONE-AUDIT.md)

</details>
