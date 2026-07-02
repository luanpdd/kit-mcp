---
phase: 96-runbook-failure-modes-benchmark
plan: 01
subsystem: operations
tags: [runbook, failure-modes, benchmark, prr, blameless-postmortems, ops-docs, dog-food]

requires:
  - phase: 94-golden-signals-mcp-server
    provides: src/core/metrics.js + metrics-snapshot MCP tool — used as the source for M4 latency baseline and the SLO degradation check from RUNBOOK
  - phase: 95-slo-definitions
    provides: .planning/slos/mcp-tool-{availability,latency}.yml — RUNBOOK's "is the service degraded?" section reads them, BENCHMARK's M4 sizes the latency target against them
provides:
  - .planning/RUNBOOK.md — emergency-response guide with 5 canonical scenarios (MCP boot fail, sidecar UI hang, manifest mismatch, npm publish fail, sync corruption) in Symptom→Diagnosis→Fix shape
  - .planning/FAILURE-MODES.md — 12-row impact×likelihood matrix with current-mitigation + follow-up + runbook cross-ref, plus risk-tier rollup
  - .planning/BENCHMARK.md — 5 baseline metrics (cold start 232.4ms / sync 391ms steady / RSS 53MB / MCP p95 144.55ms / tarball 1.1MB) measured on v1.17.0 with reproduction commands
  - test/integration/ops-docs-shape.test.js — 11 regex-based shape tests asserting structure + cross-references stay stable
affects: [v1.18 dog-food milestone, /burn-rate-status, future PRR re-scoring, milestone audits, contributor onboarding]

tech-stack:
  added: []  # Zero new deps. Test uses regex-on-text, same trade-off as Phase 95.01 slo-schema.test.js.
  patterns:
    - "Symptom → Diagnosis → Fix as the canonical RUNBOOK scenario shape (skill: blameless-postmortems)"
    - "Failure-mode matrix: Impact × Likelihood × Current mitigation × Follow-up × Runbook (skill: production-readiness-review Operations axis)"
    - "Single-point benchmark with reproduction command per metric — no cross-machine aggregation (millis too noisy at this scale)"
    - "Regex-on-text shape regression for prose docs — same dep-budget trade-off used for SLO YAML in Phase 95.01"
    - "Each ops doc cross-refs at least one sibling — prevents the triad from becoming islands"

key-files:
  created:
    - .planning/RUNBOOK.md
    - .planning/FAILURE-MODES.md
    - .planning/BENCHMARK.md
    - test/integration/ops-docs-shape.test.js
  modified: []

key-decisions:
  - "Single-point baseline in BENCHMARK.md, not aggregated. Milliseconds at the developer-laptop scale are too noisy to average across runners; the trend on the same kind of machine is the signal, absolute portability is not. Refresh policy: per milestone, update inline (versioned headings)."
  - "12 failure modes, not 8. The phase contract said 'at least 8'; we ended at 12 because cataloging fewer would have left obvious-but-mitigated cases (Phase 79 RCE guard, Phase 79.02 path traversal, OS-level antivirus quarantine) implicit. Risk-tier rollup compresses them to 4 visible bands."
  - "Regression budget on every BENCHMARK metric, not just SLO. M2/M3/M5 don't have an SLO (yet) but still document an explicit '2× current' tripwire. Without that, a future regression has no quantitative trigger before it surfaces as a user complaint."
  - "Quick-triage table at the top of RUNBOOK. Maintainers don't read top-to-bottom under stress; mapping user-visible symptoms to scenario numbers shaves the 'which section?' step."
  - "FAILURE-MODES has a 'deliberately not on this list' section. Without it, the catalog implies completeness — the section explicitly carves out hosted-service modes (multi-tenant isolation, DDoS, geo-redundancy) and SLO-budgeted single-error modes."
  - "Test uses regex-on-text, not a markdown AST parser. Same trade-off as Phase 95.01 slo-schema.test.js: adding `remark` or `marked` would burn the 3-deps + 3-optional budget Phase 92.01 fought to maintain. Regex is less strict but catches the contract (heading names, scenario count, cross-ref presence)."
  - "Cross-doc invariant test asserts each ops doc cross-refs at least one sibling. Without it, future edits could silently strip the navigation between RUNBOOK ↔ FAILURE-MODES ↔ BENCHMARK and the triad fragments into islands."

patterns-established:
  - "Operations-doc triad in `.planning/`: RUNBOOK (response) + FAILURE-MODES (catalog) + BENCHMARK (baseline). Future projects adopting kit-mcp's framework should expect these three names at the same path."
  - "Regression budgets co-located with metrics. BENCHMARK.md does not just record a number — every metric block carries '2× current is the failure-mode trigger', which FAILURE-MODES.md mode 7/8 reads back."
  - "Cross-references rendered as a single 'References' section at the end of each ops doc — same shape as Phase 95.01 SLO YAML files. Linking the skill, the source phase, and the consumer command in one block."

requirements-completed: [OPS-18-01, OPS-18-02, OPS-18-03]

duration: ~9.4min
completed: 2026-05-09
---

# Phase 96 Plan 01: RUNBOOK + FAILURE-MODES + BENCHMARK — Summary

**Three operations docs (RUNBOOK with 5 Symptom→Diagnosis→Fix scenarios, FAILURE-MODES with 12-row impact×likelihood matrix, BENCHMARK with 5 measured baselines including 232ms cold-start and 144ms MCP p95) plus 11 regex-based shape regression tests — zero new deps.**

## Performance

- **Duration:** ~9.4 min
- **Started:** 2026-05-09T16:31:08Z
- **Completed:** 2026-05-09T16:40:33Z
- **Tasks:** 4
- **Files created:** 4
- **Files modified:** 0
- **Tests added:** 11 (all integration)
- **Total suite:** 380 tests pass (was 369 baseline) + 2 skip preexistente

## Accomplishments

- **`.planning/RUNBOOK.md`** (329 lines) — emergency-response playbook with 5 canonical scenarios (MCP server boot fail, sidecar UI hang/unresponsive, manifest mismatch on sync, npm publish workflow fail, sync corruption / partial write) each in Symptom → Diagnosis → Fix structure. Quick-triage table maps user-visible symptoms to scenario numbers. SLO-check section routes "is the service degraded?" through the Phase 95 SLO files via the `metrics-snapshot` tool. Escalation paths and a cross-references block close the doc.
- **`.planning/FAILURE-MODES.md`** (65 lines) — 12-row matrix sorted by impact × likelihood. Each row has impact / likelihood / current mitigation / follow-up / runbook cross-ref, with the mitigation column pointing at the specific phase that hardened the path (Phase 79 RCE guard, Phase 79.02 path traversal, Phase 83 manifest verify, Phase 84 error redaction, Phase 88+91 sync perf, Phase 89 lazy imports, Phase v1.12.1 sidecar TCP race). Risk-tier rollup compresses the 12 modes to 4 visible bands per the `sre-risk-management` skill. Explicit "deliberately not on this list" section carves out hosted-service modes and SLO-budgeted single-error modes.
- **`.planning/BENCHMARK.md`** (184 lines) — 5 baseline metrics measured on the v1.17.0 reference machine (Windows 11, 2026-05-09): M1 cold-start `kit list-agents --terse` median 232.4 ms (5 runs); M2 sync wall time 503 ms cold / 391 ms steady-state (Phase 91 diff filter); M3 RSS 53 MB / V8 heap 8.5 MB after kit load; M4 MCP tool latency p95 = 144.55 ms / p99 = 146.42 ms (n=30 dispatches via metrics-snapshot); M5 published tarball 1.1 MB packed / 3.6 MB unpacked / 384 files. Each metric carries the exact reproduction command and an explicit regression budget (typically "2× current"). Refresh policy: per milestone, single-point only.
- **`test/integration/ops-docs-shape.test.js`** (164 lines, 11 tests) — guards the shape downstream tooling depends on: existence of all 3 docs, RUNBOOK ≥5 Symptom/Diagnosis/Fix triples + 5 named scenarios + SLO and metrics-snapshot cross-refs, FAILURE-MODES ≥8 numbered matrix rows + Impact/Likelihood/Mitigation columns + skill cross-refs, BENCHMARK ≥5 metric headers + ≥5 reproduction code blocks + date + version + metrics module path + latency SLO link, plus a cross-doc invariant that no ops doc becomes an island.

## Task Commits

Each task committed atomically:

1. **Task 1: RUNBOOK.md** — `7653eb3` (feat)
2. **Task 2: FAILURE-MODES.md** — `74b40b7` (feat)
3. **Task 3: BENCHMARK.md** — `b5c2823` (feat)
4. **Task 4: ops-docs-shape integration test** — `840c6d6` (test)

## Files Created/Modified

- **`.planning/RUNBOOK.md`** (new, 329 lines, ~15 KB) — Symptom/Diagnosis/Fix for 5 scenarios + quick-triage table + SLO-check routing + escalation paths + references.
- **`.planning/FAILURE-MODES.md`** (new, 65 lines, ~7 KB) — 12-row matrix + risk-tier rollup + scope carve-out + cross-references.
- **`.planning/BENCHMARK.md`** (new, 184 lines, ~7 KB) — 5 measured metrics with reproduction commands + summary table + refresh policy + cross-references.
- **`test/integration/ops-docs-shape.test.js`** (new, 164 lines, 11 tests) — regex-on-text shape regression. Reads each doc as text, asserts on the contract keys.

## Decisions Made

1. **Single-point benchmark, not aggregated.** Milliseconds at the developer-laptop scale are too noisy to average across runners (CI vs local, Windows vs WSL, cold disk vs warm). The signal is the *trend on the same kind of machine* — versioned inline in BENCHMARK.md as the doc is refreshed each milestone. Cross-runner aggregation would add complexity without improving the regression-detection signal.
2. **12 failure modes, not 8.** The phase contract said "at least 8"; cataloging fewer would have left obvious-but-mitigated cases (Phase 79 RCE guard, Phase 79.02 path traversal, OS-level antivirus quarantine, disk-full) implicit. The risk-tier rollup compresses the 12 to 4 visible bands so the catalog reads as digestible despite the row count.
3. **Regression budget on every BENCHMARK metric, not just SLO-backed ones.** M2/M3/M5 don't have an SLO yet, but each carries a "2× current" tripwire. Without that, a future regression has no quantitative trigger before it surfaces as a user complaint — defeating the point of having a baseline.
4. **Quick-triage table at the top of RUNBOOK.** Maintainers don't read top-to-bottom under stress; the table maps user-visible symptoms to scenario numbers, shaving the "which section?" step. Same shape Google SRE chapter 13 (Emergency Response) recommends.
5. **FAILURE-MODES has a "deliberately not on this list" section.** Without it, the catalog implies completeness. The carve-out makes the scope explicit (out-of-scope hosted-service modes, existence-proofs the SDK owns, SLO-budgeted single-error modes) so a future reader knows the absence of "DDoS protection" is intentional, not an oversight.
6. **Test uses regex-on-text, not a markdown AST parser.** Same trade-off as Phase 95.01 `slo-schema.test.js` — adding `remark` or `marked` would burn the 3-deps + 3-optional budget Phase 92.01 fought to maintain. Regex is less strict than AST, but catches the contract keys (heading names, scenario count, cross-ref presence) that downstream tooling depends on.
7. **Cross-doc invariant test asserts each ops doc cross-refs at least one sibling.** Without it, future edits could silently strip the navigation between RUNBOOK ↔ FAILURE-MODES ↔ BENCHMARK and the triad fragments into islands. The explicit assertion makes the navigation contract enforceable.

## Deviations from Plan

**None — plan executed exactly as specified in `96-CONTEXT.md`.**

Two minor refinements within the spec, neither rising to a deviation:

- **12 failure modes instead of 8–10.** CONTEXT specified "8-10 entries"; final count is 12. Adding rows is a strict superset of the contract — the matrix grew because cataloging fewer would have left mitigated-but-non-trivial cases implicit (mode 11 antivirus quarantine, mode 12 disk full, mode 9 npm publish workflow). Test asserts `>= 8` so the count can move up over time without breaking.
- **BENCHMARK headline numbers are bolded in the summary table.** The CONTEXT didn't specify formatting; the executor added `**bold**` to the four most regression-relevant rows (cold-start median, sync steady state, MCP p95, RSS) so a future reader skimming the summary sees the budget candidates immediately. Pure presentation; no contract impact.

## Issues Encountered

**None.** No bugs in the docs surfaced during integration-test runs; the test passed on first execution. No failed builds, no auth gates, no auto-fixed issues. The benchmark probes (M1 / M2 / M3 / M4 / M5) all returned data on first invocation.

One minor smoothing: the ad-hoc memory-probe script (`.tmp-bench-mem.mjs`) initially imported a non-existent `./src/core/kit-loader.js`; the executor caught the typo before it ran and switched to the actual module path (`./src/core/kit.js`'s `listKit` + `BUNDLED_KIT_ROOT`). Tmp script was deleted before the final commit per the standard "no untracked artifacts" hygiene.

## Manual Setup Required

**None** — purely additive markdown + test files. No external services, no env vars beyond the existing `KIT_MCP_METRICS_RESET=1` from Phase 94.01 (referenced in BENCHMARK.md's M4 reproduction).

## Self-Check: PASSED

Verified:

- `.planning/RUNBOOK.md` exists, 329 lines, ~15 KB. Contains 5 numbered scenarios in Symptom/Diagnosis/Fix shape; cross-refs `.planning/slos/`, `metrics-snapshot`, `FAILURE-MODES.md`, `BENCHMARK.md`.
- `.planning/FAILURE-MODES.md` exists, 65 lines, ~7 KB. Contains a 12-row numbered matrix with Impact/Likelihood/Current mitigation/Follow-up/Runbook columns; risk-tier rollup; scope carve-out; cross-refs to RUNBOOK + BENCHMARK + 4 skills + 4 source files + 2 phase summaries.
- `.planning/BENCHMARK.md` exists, 184 lines, ~7 KB. Contains 5 metric blocks (M1–M5) each with reproduction command and regression budget; reference-machine block declares `kit-mcp version 1.17.0` and date `2026-05-09`; cross-refs `src/core/metrics.js`, `metrics-snapshot`, `slos/mcp-tool-latency.yml`, `FAILURE-MODES.md`.
- `test/integration/ops-docs-shape.test.js` exists, 164 lines, 11 tests, all pass.
- Full integration suite: **109/109 pass** (was 98/98 — **+11 new**), 0 fail.
- Full unit suite: 269/269 pass + 2 skip (unchanged from Phase 95).
- Total: **380 tests pass + 2 skip** (was 369 + 2 baseline).
- Commits `7653eb3`, `74b40b7`, `b5c2823`, `840c6d6` exist on `main` branch.
- No new dependency in `package.json` (3 deps + 3 optional unchanged).
- Tmp benchmark scripts (`.tmp-bench-mem.mjs`, `.tmp-bench-mcp-lat.mjs`, `/tmp/sync-bench`) cleaned up — no untracked artifacts beyond the pre-existing ones from prior sessions (`.planning/STATE.md`, `kit/file-manifest.json`).

## Next Phase Readiness

- **Phase 97** (Coverage Ratchet 65→75%) can now proceed. The 4 hot files identified by Phase 93.01 (`src/cli/index.js` 37%, `src/mcp-server/install.js` 19%, `src/ui/auto-spawn.js` 31%, `src/core/failures.js` 17%) are the targets; the BENCHMARK.md cold-start budget protects against the new tests inflating M1.
- **`/burn-rate-status`** command (already shipped in v1.10) now has its full triage trail: SLO files (Phase 95) + RUNBOOK SLO-check section + FAILURE-MODES mode budget. A future plan can wire it to actually consume the snapshot from `metrics-snapshot`.
- **Milestone audit for v1.18** can now produce a complete PRR scorecard — all 6 PRR axes (System / Instrumentation / Operations / Security / Capacity / Risk) have artifacts. The v1.17.0 → v1.18 PRR delta should be measurable: Operations axis was previously empty, now has the canonical triad.
- **The dog-food milestone v1.18 is now 3/4 phases complete** (Phase 94 Golden Signals + Phase 95 SLOs + Phase 96 Ops Triad). Phase 97 closes the milestone.

---
*Phase: 96-runbook-failure-modes-benchmark*
*Concluída: 2026-05-09*
