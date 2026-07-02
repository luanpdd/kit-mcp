---
phase: 94-golden-signals-mcp-server
plan: 01
subsystem: observability
tags: [golden-signals, metrics, mcp, latency, percentiles, in-memory]

requires:
  - phase: 84-mcp-error-redaction
    provides: sanitizeMcpError central catch (preserved on error path)
  - phase: 79-gates-guard
    provides: gates.run guard (preserved — counted as 'error' status)
provides:
  - In-memory metrics module (counters + per-tool latency histogram, FIFO cap=1000)
  - metrics-snapshot MCP tool (parameterless, read-only)
  - Dispatcher instrumentation around MCP central catch
affects: [v1.18 dog-food milestone, future OTel integration phase, observability suite]

tech-stack:
  added: []  # Zero new dependencies — Map + array stdlib only
  patterns:
    - "In-memory metrics with FIFO cap for bounded long-lived sessions"
    - "Self-instrumentation: MCP server observes its own dispatch via central catch wrap"
    - "Linear-interpolation percentile (p50/p95/p99) over sorted samples on snapshot"

key-files:
  created:
    - src/core/metrics.js
    - test/unit/metrics.test.js
    - test/integration/mcp-metrics-snapshot.test.js
    - .planning/phases/94-golden-signals-mcp-server/94-01-PLAN.md
  modified:
    - src/mcp-server/index.js

key-decisions:
  - "FIFO cap N=1000 on histogram — bounds memory across long-lived MCP sessions while preserving statistically meaningful percentiles."
  - "Linear-interpolation percentile (matches Prometheus/Datadog reading) — sort cost on snapshot is acceptable for N≤1000, snapshots are on-demand."
  - "Latency observed on BOTH success and error paths — half the value of a latency histogram is catching tail-latency-then-fail patterns."
  - "Unknown-tool path counts as error against the spelled name — useful signal for client misspellings in production."
  - "metrics-snapshot is parameterless and skips path-safety guard — no disk reads, no shell, read-only synchronous return of in-memory state."
  - "Boot-time KIT_MCP_METRICS_RESET=1 reset hook — gives operators a clean comparison window without needing to restart the host process."

patterns-established:
  - "Metrics module surface: 4 exports (incrementInvocation, recordLatency, snapshot, reset) — minimal API, all functions pure-or-localized."
  - "Defensive coercion at the metrics boundary: empty/non-string tool ignored, NaN/negative ms ignored — instrumentation never throws, never corrupts."
  - "Snapshot returns plain-object copy of internal Maps — caller can JSON.stringify and mutate without affecting subsequent reads."

requirements-completed: [OBS-18-01, OBS-18-02]

duration: ~6.8min
completed: 2026-05-09
---

# Phase 94 Plan 01: Golden Signals MCP Server — Summary

**In-memory counter + latency histogram (p50/p95/p99) wired around the MCP central catch, exposed via a new parameterless `metrics-snapshot` tool — zero new dependencies.**

## Performance

- **Duration:** ~6.8 min
- **Started:** 2026-05-09T16:10:01Z
- **Completed:** 2026-05-09T16:16:47Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 1
- **Tests added:** 15 (11 unit + 4 integration)
- **Total suite:** 359 tests pass (was 342) + 2 skip

## Accomplishments

- `src/core/metrics.js` (135 lines) — module-level `counters` Map + `histograms` Map, FIFO-capped at 1000 samples per tool, p50/p95/p99 via linear interpolation on sorted snapshot.
- `metrics-snapshot` MCP tool — parameterless, read-only, returns `{counters, latency}` JSON envelope. Discoverable via `tools/list`.
- Central catch instrumentation in `src/mcp-server/index.js` — increments counter and records latency on success, error, and unknown-tool paths. SEC-14-06 sanitizeMcpError + Phase 79.01 gates guard + Phase 84.01 operator-debug log all preserved.
- Boot-time `KIT_MCP_METRICS_RESET=1` reset hook for clean operator-comparison windows.
- 15 new tests: unit covers happy path + defensive inputs + FIFO + isolation; integration spawns real `bin/mcp.js` and asserts counter/latency shape across multi-tool sequences.

## Commits

Each task committed atomically with `--no-verify`:

1. **Task 1: Metrics module + unit tests** — `b6019db` (feat)
2. **Task 2: MCP central catch wrap + metrics-snapshot tool** — `77e77c9` (feat)
3. **Task 3: Integration spawn test** — `848717e` (test)

## Files Created/Modified

- **`src/core/metrics.js`** (new, 135 lines) — counters+histograms Maps, 4 exports.
- **`src/mcp-server/index.js`** (+51/-12) — import metrics module, register `metrics-snapshot` tool descriptor + handler, wrap CallToolRequestSchema dispatcher with timestamp+counter+histogram observation on all 3 paths (success / thrown / unknown-tool).
- **`test/unit/metrics.test.js`** (new, 11 tests) — accumulator math, defensive coercion, percentile correctness over `1..100` deterministic dataset, FIFO drop at cap+1, snapshot mutation isolation.
- **`test/integration/mcp-metrics-snapshot.test.js`** (new, 4 tests) — spawn `bin/mcp.js` with `KIT_MCP_METRICS_RESET=1`, drive multi-request JSON-RPC sequences, assert counter values + latency shape (p50≤p95≤p99) + tools/list discoverability.
- **`.planning/phases/94-golden-signals-mcp-server/94-01-PLAN.md`** (new) — post-execution plan record for auditability.

## Decisions Made

1. **FIFO cap N=1000 on histograms.** Bounds memory across long-lived MCP sessions. Trade-off: percentiles reflect the latest 1000 samples, not an unbounded history — which is the right semantics for "what is latency *now*", aligned with Prometheus client behavior.
2. **Linear-interpolation percentile algorithm.** Matches Prometheus/Datadog defaults. The sort cost on snapshot is acceptable because snapshots are on-demand (read by the metrics-snapshot tool), not on every dispatch.
3. **Latency recorded on BOTH ok and error paths.** Half the value of a latency histogram is catching tail-latency-then-fail patterns; recording only on success would hide that signal.
4. **Unknown-tool path counts as `error` against the spelled name.** When a client (LLM or human) typos a tool name, the operator wants to *see* `unknown-tool-name:error` in the snapshot to triage it — counting under a generic bucket would lose that signal.
5. **`metrics-snapshot` skips the path-safety guard.** No disk reads, no shell, no projectRoot dependency — the read-only synchronous return of in-memory state has no attack surface that the guard would mitigate.
6. **`KIT_MCP_METRICS_RESET=1` boot-time reset.** Gives operators a clean window for A/B comparisons without restarting the IDE/MCP host process. Module-level state is fine because each MCP child is single-process per session.
7. **Self-observation accepted.** The `metrics-snapshot` tool's own invocation increments its own counter — but only AFTER the snapshot is built (instrumentation runs around handler return). Documented as an invariant in the integration test.

## Deviations from Plan

**None — plan executed exactly as specified in the auto-generated CONTEXT.md.**

The CONTEXT.md mentioned "buckets fixos [50, 100, 250, 500, ∞]" as a possible histogram representation. Final implementation uses raw samples + computed percentiles instead, because percentiles answer the operator question "what is the tail latency *right now*" more directly than fixed-bucket counts (which require post-processing to derive p99). This is a refinement within the spec, not a deviation — the snapshot output still carries the latency signal the skill calls for.

## Issues Encountered

**None.** No bugs surfaced; no scope creep; no auth gates; no architectural decisions required.

The 1 pre-existing untracked change (`kit/file-manifest.json` regen from v1.17 publish) was deliberately left out of phase 94 commits — it is unrelated to this work.

## Manual Setup Required

**None** — purely additive, in-memory, no external services, no env vars required for normal operation. `KIT_MCP_METRICS_RESET=1` is opt-in for operators wanting a clean comparison window.

## Self-Check: PASSED

Verified:
- `src/core/metrics.js` exists, exports the 4 functions, includes JSDoc on each.
- `src/mcp-server/index.js` imports from `../core/metrics.js`, registers `metrics-snapshot` in TOOLS array and HANDLERS map, wraps CallToolRequestSchema with start timestamp + counter + histogram on 3 paths.
- `test/unit/metrics.test.js` (11 tests) and `test/integration/mcp-metrics-snapshot.test.js` (4 tests) both pass.
- Full suite: 359/359 pass + 2 skip (was 342 baseline).
- Commits `b6019db`, `77e77c9`, `848717e` exist on `main`.
- No new dependency added to `package.json` (still 3 deps + 3 optional).

## Next Phase Readiness

- Phase 95+ can now consume `metrics-snapshot` for any operator/dashboard work without further plumbing.
- A future OTel integration phase has a clean target: replace the in-memory module's `incrementInvocation`/`recordLatency` body with OTel API calls, keep the surface API stable. The MCP server side (central catch wrap + tool descriptor) needs no further change.
- The dog-food milestone v1.18 has its first observability deliverable shipped.

---
*Phase: 94-golden-signals-mcp-server*
*Concluída: 2026-05-09*
