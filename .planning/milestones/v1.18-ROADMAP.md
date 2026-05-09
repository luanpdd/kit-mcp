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

### Phase 94: Golden Signals MCP Server ✅ CONCLUÍDA (2026-05-09)

**Goal:** Aplicar skill `four-golden-signals` ao próprio MCP server. Counter `tool_invocations_total` + Latency histogram para cada tool exposed. Implementação minimalista (Map + array, zero deps novas).

**Entregue:**
- ✅ `src/core/metrics.js` (NOVO, 135 linhas) — `incrementInvocation` + `recordLatency` + `snapshot` + `reset`. Map-based counters, FIFO-capped histograms (N=1000), p50/p95/p99 via linear interpolation.
- ✅ `src/mcp-server/index.js` — central catch wrappado com counter + latency observation em 3 paths (success/thrown/unknown-tool). SEC-14-06 + Phase 79.01 + Phase 84.01 invariantes preservadas.
- ✅ Novo MCP tool `metrics-snapshot` (parameterless, read-only) — discoverable via tools/list, retorna `{counters, latency}` JSON.
- ✅ Reset via env `KIT_MCP_METRICS_RESET=1` (boot-time hook).

**Métricas:**
- 359 tests pass (+15 novos: 11 unit + 4 integration), 0 fail, 2 skip preexistentes.
- Zero deps novas (3 deps + 3 optional inalterados).
- Duration ~6.8min, 3 commits atomic + 1 SUMMARY commit.
- SUMMARY: [`94-01-SUMMARY.md`](./phases/94-golden-signals-mcp-server/94-01-SUMMARY.md)

### Phase 95: SLO Definitions ✅ CONCLUÍDA (2026-05-09)

**Goal:** Aplicar skill `event-based-slos` ao MCP server. Definir 2 SLOs canônicos em `.planning/slos/` — availability + latency — usando event-based pattern do livro Google SRE.

**Entregue:**
- ✅ `.planning/slos/mcp-tool-availability.yml` (NOVO) — SLI ratio counters[*:ok]/(ok+error), target 99.5%, 30d sliding window, burn-rate alert thresholds (page 14.4× / ticket 6×).
- ✅ `.planning/slos/mcp-tool-latency.yml` (NOVO) — SLI percentile sobre histograms, p95 target ≤200ms, 30d sliding window, mesmas alert tiers canônicas.
- ✅ `.planning/slos/README.md` (NOVO) — derivation do snapshot da Phase 94, workflow do consumer, sample envelope, future-work table (log-to-disk, multi-window, OTel).
- ✅ `test/unit/slo-schema.test.js` (NOVO, 10 tests) — regex-based regression sobre keys que tooling downstream depende, sem dep js-yaml.

**Métricas:**
- 369 tests pass (+10 novos: 10 unit), 0 fail, 2 skip preexistentes.
- Zero deps novas (3 deps + 3 optional inalterados).
- Duration ~3.8min, 2 commits atomic + 1 SUMMARY commit.
- SUMMARY: [`95-01-SUMMARY.md`](./phases/95-slo-definitions/95-01-SUMMARY.md)

### Phase 96: RUNBOOK + FAILURE-MODES + BENCHMARK ✅ CONCLUÍDA (2026-05-09)

**Goal:** Aplicar skills `blameless-postmortems` e `production-readiness-review` produzindo 3 docs de operations: RUNBOOK (emergency response), FAILURE-MODES (top-down failure list), BENCHMARK (capacity envelope baseline).

**Entregue:**
- ✅ `.planning/RUNBOOK.md` (NOVO, 329 linhas) — 5 cenários estruturados em Symptom → Diagnosis → Fix (MCP boot fail, sidecar UI hang, manifest mismatch, npm publish fail, sync corruption); quick-triage table; SLO-check section routes "is the service degraded?" pelas Phase 95 SLOs; escalation paths.
- ✅ `.planning/FAILURE-MODES.md` (NOVO, 65 linhas) — 12-row matrix Impact × Likelihood × Current mitigation × Follow-up × Runbook (não 8-10 do CONTEXT — cataloging fewer leaves mitigated cases implicit); risk-tier rollup compresses to 4 bands per `sre-risk-management` skill; "deliberately not on this list" section carves out hosted-service modes.
- ✅ `.planning/BENCHMARK.md` (NOVO, 184 linhas) — 5 métricas measured em v1.17.0 (2026-05-09): M1 cold-start 232.4 ms median 5 runs / M2 sync 503ms cold → 391ms steady-state / M3 RSS 53MB heap 8.5MB / M4 MCP p95 144.55ms p99 146.42ms n=30 / M5 tarball 1.1MB packed 384 files. Cada metric com reproduction command + regression budget ("2× current").
- ✅ `test/integration/ops-docs-shape.test.js` (NOVO, 11 tests) — regex-on-text shape regression (3 docs exist + RUNBOOK 5 scenarios + FAILURE-MODES 8+ matrix rows + BENCHMARK 5+ metrics + cross-doc invariant). Mesmo trade-off Phase 95.01 (sem markdown AST dep).

**Métricas:**
- 380 tests pass (+11 novos: 11 integration), 0 fail, 2 skip preexistentes.
- Zero deps novas (3 deps + 3 optional inalterados).
- Duration ~9.4min, 4 commits atomic + 1 SUMMARY commit.
- SUMMARY: [`96-01-SUMMARY.md`](./phases/96-runbook-failure-modes-benchmark/96-01-SUMMARY.md)

### Phase 97: Coverage Ratchet ✅ CONCLUÍDA (2026-05-09)

**Goal:** Subir coverage threshold de 65% → 75% endereçando os 4 hot files identificados em Phase 93 (cli/index.js 37%, mcp-server/install.js 19%, ui/auto-spawn.js 31%, core/failures.js 17%). Adicionar testes específicos para os hot paths não-cobertos.

**Entregue:**
- ✅ `test/unit/failures-coverage.test.js` (NOVO, 6 tests) — `collectFailures` end-to-end (debug/verify/forensics readers, agent-hint detector), `summarizeByAgent` (samples cap, sort), `writeLearnings` (renders learning doc + cwd default). **failures.js 17.65% → 99.35% (+82 pp)**.
- ✅ `test/unit/install-coverage.test.js` (NOVO, 12 tests) — both strategies (merge-mcpServers-json + append-toml-snippet), via= modes (local/npx/global), --pkg, dryRun vs write, --force conflict, --name avoidance, corrupt JSON parse, codex toml userPath. **install.js 19.46% → 95.97% (+76 pp)**.
- ✅ `test/unit/auto-spawn-coverage.test.js` (NOVO, 7 tests) — `__test` exports, `healthzOk` happy/sad via real loopback HTTP server, `ensureSidecar` no-projectRoot + existing-and-healthy lockfile (mock sidecar). **auto-spawn.js 30.97% → 56.64% (+26 pp)**.
- ✅ `test/unit/cli-index-coverage.test.js` (NOVO, 13 tests) — spawnSync behavioral coverage para --version/--help, kit subcommands, sync/install targets, gates list, ui status/open no-sidecar paths, doctor JSON+human output. **cli/index.js 37.47% → 55.26% (+18 pp)** via subprocess v8 coverage merge.
- ✅ `.github/workflows/ci.yml` — THRESHOLD bumped 65 → 75 (REQ INFRA-18-01), threshold history block + ratchet plan to 80% in v1.19+.

**Métricas:**
- 418 tests pass (+38 novos: 38 unit), 0 fail, 2 skip preexistentes.
- Zero deps novas (3 deps + 3 optional inalterados).
- Coverage final: line 77.89% (+7.94 pp), branch 78.30%, funcs 71.07%.
- Duration ~22min, 5 commits atomic + 1 SUMMARY commit.
- SUMMARY: [`97-01-SUMMARY.md`](./phases/97-coverage-ratchet/97-01-SUMMARY.md)



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
