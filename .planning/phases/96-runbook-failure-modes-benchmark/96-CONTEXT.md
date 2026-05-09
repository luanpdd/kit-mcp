# Phase 96: RUNBOOK + FAILURE-MODES + BENCHMARK - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Depends on:** Phase 94 ✅

<domain>
3 docs operations apply skill `production-readiness-review` + `blameless-postmortems`:

**OPS-18-01 — `.planning/RUNBOOK.md`:** emergency response steps (Symptom → Diagnosis → Fix) para 5 cenários:
1. MCP server boot fail
2. Sidecar UI hang/unresponsive
3. Manifest mismatch em sync
4. npm publish workflow fail
5. Sync corruption (partial write)

**OPS-18-02 — `.planning/FAILURE-MODES.md`:** top-down list de 8-10 failure scenarios em matrix Impact (high/med/low) × Likelihood (high/med/low) × Mitigation.

**OPS-18-03 — `.planning/BENCHMARK.md`:** baseline metrics:
- Cold start time (CLI list-agents --terse)
- Sync wall time (claude-code, ~327 files)
- Memory footprint (process.memoryUsage após list-agents)
- p50/p95 latency (snapshot do MCP server pós-load)
- Tarball size

</domain>

<decisions>
### Restrições
- Stable API v1.0+ preservada (só docs).
- Cross-references com SLOs (Phase 95) e metrics (Phase 94).

### Files

**RUNBOOK.md structure:**
- Header: Emergency Response Guide
- For each scenario: Symptom (how to detect), Diagnosis (commands to run), Fix (steps)
- Cross-ref para SLOs error budget burn

**FAILURE-MODES.md structure:**
- Matrix table 8-10 scenarios
- Columns: scenario, impact, likelihood, current mitigation, follow-up needed
- Cross-ref para RUNBOOK quando aplicável

**BENCHMARK.md structure:**
- Header: Baseline Performance Metrics (medidas em v1.18.0, máquina dev)
- Tabela métrica × valor × source (e.g., `npm run smoke && time ...`)
- Para cada: timestamp + how to reproduce

### Test
- test/integration/ops-docs-shape.test.js — assert 3 files existem + estrutura básica (headings, sections expected).

</decisions>

<deferred>
- Linter para markdown structure
- Auto-update BENCHMARK em CI
</deferred>
