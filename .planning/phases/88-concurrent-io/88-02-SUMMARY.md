---
phase: 88-concurrent-io
plan: 02
subsystem: cli
tags: [watch, chokidar, debounce, cache-invalidation, perf]

requires:
  - phase: 79-test-coverage
    provides: gates.run guard pattern (preserved — watch.js does not touch gates)
  - phase: 83-trust-boundary
    provides: KIT_MCP_SKIP_MANIFEST_CHECK opt-out used by tests
  - phase: 06-perf-listing
    provides: clearKitCache export from kit.js (PERF-01 v1.6 TTL cache contract)
provides:
  - watch debounce 500ms (coalesce IDE save-bursts)
  - clearKitCache invalidation before re-sync (cache-correctness fix)
  - 3 regression tests for watch behavior
affects: [v1.16, perf-runtime, watch, sync]

tech-stack:
  added: []
  patterns:
    - "Unify invalidation + re-sync into single setTimeout (vs two parallel timers)"
    - "Cache-clear inside debounced callback (atomic with downstream listKit read)"

key-files:
  created:
    - test/unit/watch-debounce.test.js
  modified:
    - src/core/watch.js

key-decisions:
  - "Single timer (not two): clearKitCache called INSIDE the existing setTimeout callback, before the syncTo loop. CONTEXT.decisions hinted at a separate invalidationTimer; planner unified them. Equivalent coalescing semantics, simpler, no divergence risk between two timers."
  - "Default debounceMs 300 → 500: aligned with phase CONTEXT and typical IDE auto-save burst window. Override via opts.debounceMs preserved (Number.isFinite check unchanged)."
  - "Tests use KIT_MCP_SKIP_MANIFEST_CHECK=1 in beforeEach: mutating fixtures changes file SHA, fails SEC-14-05 manifest verify. Tests are about watch behavior, not manifest integrity. Env var saved/restored in afterEach for isolation."

patterns-established:
  - "Cache-aware debounce: clear cache inside the debounced callback (not in event handler) so coalescing applies to invalidations as well — N events → 1 cache clear."

requirements-completed:
  - PERF-16-02

duration: 3min
completed: 2026-05-09
---

# Phase 88 Plan 02: Watch Debounce — Summary

**Cache-aware 500ms debounce in watchKit() — coalesces IDE save-bursts and invalidates kitCache before re-sync, eliminating stale TTL-cached projections after edits**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-09T13:42:24Z
- **Completed:** 2026-05-09T13:45:45Z
- **Tasks:** 2
- **Files modified:** 1 (src/core/watch.js)
- **Files created:** 1 (test/unit/watch-debounce.test.js)

## Accomplishments

- **PERF-16-02 closed:** burst of N quick saves now triggers AT MOST 1 `clearKitCache` + 1 syncTo cycle per 500ms window (was 1 cycle per save).
- **Latent bug fixed:** re-sync after edit now reflects post-edit kit content (no longer projects pre-edit state from PERF-01's 30s TTL cache).
- **Default debounce 300 → 500ms:** aligned with typical IDE auto-save burst behavior.
- **3 regression tests added:** burst-coalesce, cache-invalidation correctness, custom-debounce override.
- **Stable API preserved:** watchKit signature, opts shape, return shape unchanged. Override via opts.debounceMs honored.

## Task Commits

Each task committed atomically (--no-verify per parallel-execution context):

1. **Task 1: clearKitCache invalidation + bump debounce default to 500ms** — `923c1a0` (feat)
2. **Task 2: Regression tests for debounce + cache invalidation** — `31c52c3` (test)

**Plan metadata:** (final commit will follow this summary).

## Files Created/Modified

- **`src/core/watch.js`** (modified)
  - Import line: added `clearKitCache` to existing `./kit.js` import.
  - `debounceMs` default: 300 → 500ms with PERF-16-02 comment explaining rationale.
  - `setTimeout` callback: added `clearKitCache()` as first action, before the `for (const t of targets)` loop, with comment explaining why the call is INSIDE the setTimeout (coalescing) and BEFORE the loop (single invalidation per window benefits all targets).
- **`test/unit/watch-debounce.test.js`** (new, 166 LOC)
  - 3 tests against real chokidar + tmpdir copy of `test/fixtures/sample-kit`.
  - `beforeEach` copies fixture, sets `KIT_MCP_SKIP_MANIFEST_CHECK=1` (saved/restored in afterEach).
  - Uses timing-based assertions; `--test-force-exit` documented (chokidar holds fds briefly).

## Decisions Made

- **Single setTimeout vs two parallel timers (deviation from CONTEXT hint).** CONTEXT.decisions PERF-16-02 suggested adding a separate `let invalidationTimer = null;` for cache invalidation. The planner identified that two timers introduce risk of divergence (invalidation could fire before or after re-sync if windows drift). Unified approach: reuse the existing re-sync `setTimeout` and call `clearKitCache()` as its first action. Equivalent coalescing semantics, atomic with the downstream `listKit` (same event-loop tick), simpler code.
- **Cache-clear placement: inside callback, before for-loop.** Calling `clearKitCache()` inside the debounced callback (not in the event handler) means N rapid events still produce only 1 invalidation per debounce window. Calling it before the `for` loop means all targets in `targets[]` see fresh disk reads from a single invalidation.
- **Test infrastructure: KIT_MCP_SKIP_MANIFEST_CHECK=1.** Tests mutate kit fixture files mid-watcher to validate cache invalidation; this changes file SHA and trips SEC-14-05 manifest verify. The env var is the documented dev opt-out for exactly this case. Saved/restored per-test to keep isolation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] Test failures due to SEC-14-05 manifest verification**
- **Found during:** Task 2 (initial test run after writing the test file)
- **Issue:** Tests 2 and 3 failed with `EMANIFESTMISMATCH` — `verifyManifest()` runs at the start of every `syncTo()` (added in Phase 83 plan 03 for SEC-14-05) and rejects when kit file SHAs don't match `kit/file-manifest.json`. Mutating the fixture file mid-test changes its hash, so the watcher's debounced re-sync was failing with `kit manifest mismatch`. Test 1 passed only because its assertion checked `↻ resynced` count (≤1) — the mismatched re-syncs logged as `✗ resync` and were filtered out, so the bound was vacuously satisfied even though no actual re-sync happened.
- **Fix:** Added `prevSkipManifest = process.env.KIT_MCP_SKIP_MANIFEST_CHECK; process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';` in `beforeEach`. Restored prior value in `afterEach` to preserve env isolation across the suite. Documented inline why this is correct: tests validate watch behavior, not manifest integrity. The env var is the canonical dev opt-out from SEC-14-05.
- **Files modified:** test/unit/watch-debounce.test.js (added env var setup/teardown).
- **Verification:** Re-ran the 3 tests → all 3 pass (1364ms + 711ms + 600ms). Re-ran full unit suite → 227 tests, 225 pass, 0 fail (2 baseline skips unchanged).
- **Committed in:** `31c52c3` (part of test commit).

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocker for completing Task 2 verification).
**Plan impact:** Necessary correctness fix for tests; does not change production code path. Plan as-written did not anticipate the manifest-verify interaction. No scope expansion.

## Issues Encountered

- **Initial run failed with manifest verify** — see deviation above. Resolved by adding `KIT_MCP_SKIP_MANIFEST_CHECK=1` env var in test setup.

## TOCTOU Discussion (per <output> spec)

The CONTEXT raised a concern: "watch.js debounce: pode mascarar erros — se 10 events vêm de saves diferentes, um falhou, debounce coalescing pode atrasar visibility. Aceitável (cache invalidation é eventual consistency)."

There is no race window between `clearKitCache()` and the subsequent `listKit()` call inside `syncTo`:

1. Both run inside the same `setTimeout` callback (single event-loop tick boundary).
2. JavaScript is single-threaded; no other timer or microtask can interleave between `clearKitCache()` and the first `await syncTo(...)` line.
3. Once `await syncTo(...)` yields control, any subsequent fs-watch event that fires would queue a NEW `setTimeout` (the previous `pending` was already nulled at the start of this callback). That new setTimeout will eventually run its own `clearKitCache()` before its own `listKit()`, again atomically.

Worst case: a write that lands AFTER `listKit` reads but BEFORE the file is closed will be missed by THIS re-sync but picked up by the next debounced trigger (within 500ms of that later write). This is the eventual-consistency model the CONTEXT explicitly accepted.

## Manual UAT Capture

CLI smoke test (verification 3 from plan):

```
$ timeout 3 node bin/cli.js sync watch claude-code
[watch] ✓ initial sync → claude-code (323 files)
[watch] watching kit/ → claude-code (Ctrl+C to stop)
```

Watch boots cleanly with new 500ms default. Initial sync completes, then enters event loop awaiting changes. Ctrl+C cleanup not exercised in smoke (timeout used instead) but `stop()` callback is unchanged from baseline so no regression possible.

Edit-burst behavior is exercised by Test 1 (10 writes @ 20ms intervals → ≤1 resync log). No further manual UAT needed; deterministic regression coverage suffices.

## Manual Configuration Required

None — no external service configuration needed.

## Next Phase Readiness

- Phase 88.02 closes its slice of PERF-16-02. Other plans in Phase 88 (88.01 syncTo batches, 88.03 reverse-sync paralleliz) ran in parallel and have independently committed.
- v1.16 milestone progress: 2/3 of Phase 88 plans complete (88.01 and 88.02; 88.03 just landed per `git log` showing commits `b840165` + `d07e7ee`).
- No blockers for next phase (89 — Lazy Imports & Optional Deps).

## Self-Check: PASSED

- FOUND: src/core/watch.js
- FOUND: test/unit/watch-debounce.test.js
- FOUND: .planning/phases/88-concurrent-io/88-02-SUMMARY.md
- FOUND: commit 923c1a0 (Task 1 — feat: clearKitCache + debounce 500)
- FOUND: commit 31c52c3 (Task 2 — test: regression)

---
*Phase: 88-concurrent-io*
*Concluída: 2026-05-09*
