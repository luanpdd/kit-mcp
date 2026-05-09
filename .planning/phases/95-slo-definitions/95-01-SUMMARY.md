---
phase: 95-slo-definitions
plan: 01
subsystem: observability
tags: [slo, sli, error-budget, event-based, burn-rate, yaml, dog-food]

requires:
  - phase: 94-golden-signals-mcp-server
    provides: src/core/metrics.js (counters Map + per-tool latency histogram) + metrics-snapshot MCP tool
provides:
  - .planning/slos/mcp-tool-availability.yml — event-based ratio SLI (target 99.5%, 30d sliding)
  - .planning/slos/mcp-tool-latency.yml — percentile SLI (p95 ≤ 200ms, 30d sliding)
  - .planning/slos/README.md — SLI derivation from Phase 94.01 metrics + consumer workflow
  - test/unit/slo-schema.test.js — 10 schema regression tests
affects: [v1.18 dog-food milestone, /burn-rate-status command, future log-to-disk persistence phase, OTel migration]

tech-stack:
  added: []  # Zero new deps — kept the 3+3 budget. Schema test uses regex on file text (no js-yaml).
  patterns:
    - "Event-based SLI on counters[*:ok] / (ok+error) — never time-based aggregation"
    - "Percentile SLI from in-memory histograms read on-demand by snapshot"
    - "Schema regression via regex-on-text — preserves dep budget at the cost of strict YAML parsing"
    - "Burn-rate alert thresholds in YAML (page 14.4× / ticket 6×) — canonical Google SRE multipliers"

key-files:
  created:
    - .planning/slos/mcp-tool-availability.yml
    - .planning/slos/mcp-tool-latency.yml
    - .planning/slos/README.md
    - test/unit/slo-schema.test.js
  modified: []

key-decisions:
  - "p95 instead of p99 for latency SLO — with FIFO cap N=1000, p99 has only 10 samples of resolution; p95 has 50 (less outlier-dominated). Move to p99 once log-to-disk lands in v1.19+."
  - "Target 99.5% availability — kit-mcp is 'free-tier production' on the risk continuum (sre-risk-management). 99.5% leaves 3.6h monthly budget, enough to absorb a typo'd tool name without paging the maintainer."
  - "Owner = kit-mcp-maintainers@github.com — skill mandates explicit owner. Single-repo single-human today; placeholder makes the contract visible."
  - "Burn-rate multipliers verbatim from Google SRE (14.4× / 6×) — adopted as-is until measured kit-mcp volume justifies tuning."
  - "Schema test via regex-on-text instead of adding js-yaml — preserves the 3-deps budget Phase 92.01 fought for. Trade-off: regex is less strict than YAML AST validation, but it catches the keys downstream tooling actually depends on."
  - "Single SLO covering all tools, not per-tool — toolkit is small (sync, mapeamento, gates.run, forensics, install, metrics-snapshot). Per-tool budgets would be too thin to be meaningful. Split when a single tool dominates volume."

patterns-established:
  - "SLO YAML structure: top-level slo / sli / target / window / error_budget blocks. Burn-rate multipliers under error_budget.alert_thresholds.{page,ticket}."
  - "References block at the bottom of every SLO YAML — cross-links the skill, the source phase, and the consumer command. Future SLOs added under .planning/slos/ should follow this shape."
  - "Schema regression for every YAML config — regex tests over the file text, asserting the keys consumers depend on. Pattern: read file → assert.match() per contract key → fail loudly if shape drifts."

requirements-completed: [OBS-18-03, OBS-18-04]

duration: ~3.8min
completed: 2026-05-09
---

# Phase 95 Plan 01: SLO Definitions — Summary

**Two event-based SLOs (availability ratio + p95 latency) wired to the Phase 94.01 in-memory metrics module via YAML files in `.planning/slos/`, with 10 regex-based schema regression tests — zero new deps.**

## Performance

- **Duration:** ~3.8 min
- **Started:** 2026-05-09T16:22:26Z
- **Completed:** 2026-05-09T16:26:15Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 0
- **Tests added:** 10 (all unit)
- **Total suite:** 369 tests pass (was 359 baseline) + 2 skip preexistente

## Accomplishments

- `mcp-tool-availability.yml` — event-based ratio SLI built on `src/core/metrics.js` counters. Target 99.5%, 30d sliding window, error budget 0.5% monthly, burn-rate alert thresholds (page 14.4× / ticket 6×).
- `mcp-tool-latency.yml` — percentile SLI on the per-tool histograms shipped by Phase 94.01. p95 target 200ms, 30d sliding window, error budget 5% above target, same canonical burn-rate multipliers.
- `README.md` — explains how the SLI is derived from a `metrics-snapshot` JSON envelope, shows the workflow (`KIT_MCP_METRICS_RESET=1` → drive requests → read snapshot → compare against target), documents future-work items (log-to-disk, multi-window burn-rate, OTel exporter).
- `test/unit/slo-schema.test.js` (10 tests) — guards the YAML shape downstream tooling depends on: slo block (name/service/owner), sli block (event-based vs percentile + source pointer to `src/core/metrics.js`), target/target_ms + window, error_budget alert tiers with canonical multipliers, plus cross-file invariants (both reference the metrics module, both use 30d sliding).

## Commits

Each task committed atomically:

1. **Task 1: 2 SLO YAML files + README** — `f3157d4` (feat)
2. **Task 2: 10 schema regression tests** — `2bf339c` (test)

## Files Created/Modified

- **`.planning/slos/mcp-tool-availability.yml`** (new, 4.2 KB) — full SLO definition with header rationale (why event-based, why 99.5%, why ≤200ms is rejected as too tight for kit-mcp, references block).
- **`.planning/slos/mcp-tool-latency.yml`** (new, 3.1 KB) — percentile SLO with rationale on p95 vs p99 choice given 1000-sample cap.
- **`.planning/slos/README.md`** (new, 4.9 KB) — SLI derivation workflow, sample snapshot envelope, future-work table, references to skills and phases.
- **`test/unit/slo-schema.test.js`** (new, 10 tests) — regex-based schema regression. Reads YAML as text, asserts on the keys consumers depend on. No js-yaml dependency.

## Decisions Made

1. **p95 instead of p99 for latency.** With FIFO cap N=1000, p99 has only 10 samples of resolution per tool — one outlier dominates. p95 has 50 samples, which is enough headroom that a single slow `sync` of a large kit doesn't trip the SLO. Move to p99 once log-to-disk lands in v1.19+ and we have weeks of history per tool.
2. **Target 99.5% availability, not 99.9%.** kit-mcp sits in the "free-tier production" band of the risk continuum (`sre-risk-management` skill). 99.5% leaves 3.6h of monthly budget, which is plenty to absorb a typo'd tool name being counted as `unknown-tool-name:error` (Phase 94.01 decision 4) without paging the maintainer.
3. **Owner = `kit-mcp-maintainers@github.com`.** The skill is explicit — SLO without owner means alerts fire into the void. Single-repo single-human today, but the contract is visible and replaceable.
4. **Burn-rate multipliers verbatim from Google SRE / Honeycomb (14.4× page / 6× ticket).** No measured kit-mcp volume yet to tune against. Adopt the canonical recommendation; revisit when the snapshot shows real usage.
5. **Schema test via regex-on-text, not js-yaml AST.** Adding `js-yaml` for two trivial schema checks would burn the 3-deps budget Phase 92.01 fought to maintain. Regex is less strict than AST parsing — it doesn't catch every malformed YAML — but it catches the keys downstream tooling depends on, which is the actual contract. Same trade-off the project made for the dead-imports + jsdoc-coverage gates (text-regex over plugin-AST).
6. **Single SLO covering all tools, not per-tool.** The toolkit is small (sync / mapeamento / gates.run / forensics / install / metrics-snapshot — 6 entries). Per-tool error budgets would be too thin to be meaningful and would multiply the alert configuration without adding signal. Split when a single tool grows enough volume to dominate the aggregate.

## Deviations from Plan

**None — plan executed exactly as specified in the auto-generated CONTEXT.md.**

Two minor refinements within the spec, neither rising to a deviation:

- **Owner field added to both SLOs.** The CONTEXT.md YAML scaffold did not include `owner:`, but the `event-based-slos` skill is explicit that an owner is mandatory ("SLO sem owner = sem ação = sem valor"). Adding it is following the skill, not deviating from the plan.
- **`alert_thresholds` block restructured.** CONTEXT.md showed `alert_threshold: { page: 14.4, ticket: 6 }`. The final YAML structures each tier as a sub-object with `burn_rate_multiplier`, `lookahead`, `baseline`, `severity`, `condition` — matching the canonical pattern from the `burn-rate-alerting` skill so the `/burn-rate-status` command can consume the file without remapping. The numeric multipliers (14.4 / 6) are preserved as documented.

## Test-time bug encountered (and fixed before commit)

The first run of `slo-schema.test.js` failed two assertions due to a regex slip: `\bpage:\b` matches nothing because `:` is non-word, so the trailing `\b` requires a word character that isn't there. Fixed in-place before the Task 2 commit by switching to `^\s+page:\s*$` (line-start indent + key + line-end) and pinning the literal `6` with `(?!\d)` so it doesn't accidentally match `60`. Final test file shows only the corrected regexes; the bug never made it into a commit.

This counts as the executor catching its own mistake during the verify step (planned RED→GREEN cadence — the test failed, we fixed the test, it passed). Not a deviation.

## Issues Encountered

**None.** No bugs in the SLO files surfaced; the test was the only thing that needed a fix, and it was caught and resolved within the same task.

## Manual Setup Required

**None** — purely additive YAML + test files. No external services, no env vars beyond the existing `KIT_MCP_METRICS_RESET=1` from Phase 94.01.

## Self-Check: PASSED

Verified:

- `.planning/slos/mcp-tool-availability.yml` exists, 4.2 KB, contains `slo:` / `sli:` / `target: 0.995` / `window: 30d_sliding` / `error_budget:` blocks.
- `.planning/slos/mcp-tool-latency.yml` exists, 3.1 KB, contains `slo:` / `sli:` / `target_ms: 200` / `window: 30d_sliding` / `error_budget:` blocks.
- `.planning/slos/README.md` exists, 4.9 KB, links to skill + Phase 94.01 + `/burn-rate-status` command.
- `test/unit/slo-schema.test.js` exists, 10 tests, all pass.
- Full unit suite: 269/269 pass + 2 skip (was 259/259 + 2 — +10 new).
- Full integration suite: 98/98 pass (unchanged).
- Total: 369 tests pass + 2 skip (was 359 + 2 baseline).
- Commits `f3157d4` and `2bf339c` exist on `main`.
- No new dependency in `package.json`.

## Next Phase Readiness

- **Phase 96** (RUNBOOK + FAILURE-MODES + BENCHMARK) can now cross-reference these SLOs in its operations docs — RUNBOOK can point at the SLO files for "is the service degraded" decisions.
- The `/burn-rate-status` command (already shipped in v1.10) has its first concrete SLO files to read; a future plan can wire it to actually consume the snapshot from `metrics-snapshot`.
- The dog-food milestone v1.18 is now 2/4 fases concluídas (Phase 94 + Phase 95).

---
*Phase: 95-slo-definitions*
*Concluída: 2026-05-09*
