---
phase: 88-concurrent-io
plan: 01
subsystem: core/sync
tags: [perf, concurrency, io, refactor]
requires:
  - "kit/file-manifest.json (Phase 83 verifyManifest gate)"
  - "src/core/registry.js (target descriptors)"
  - "src/core/kit.js (listKit + resolveKitRoot)"
provides:
  - "syncTo() ≥30% wall-time reduction via Promise.all batches"
  - "KIT_MCP_SYNC_BATCH_SIZE env var (default 16, fallback safe outside [1,256])"
  - "Race-condition safety regression tests"
affects:
  - "src/core/sync.js (write loop refactored)"
  - "test/unit/sync-concurrent.test.js (new file)"
tech-stack:
  added: []
  patterns:
    - "for(i+=BATCH_SIZE) { await Promise.all(slice.map(applyOp)) } — bounded parallelism"
    - "Shared monotonic counter incremented from event-loop-serialized JS — no Atomics needed"
key-files:
  created:
    - "test/unit/sync-concurrent.test.js"
  modified:
    - "src/core/sync.js"
decisions:
  - "BATCH_SIZE=16 default — safe under Linux ulimit 1024 fd; configurable via env"
  - "Counter shared across batched ops (not per-op index) — UX consistency for onProgress"
  - "No retry/circuit-breaker — preserves existing behavior (single fs error already aborted install)"
  - "verifyManifest gate position UNCHANGED — runs before any write (no TOCTOU regression)"
metrics:
  duration: ~30min
  completed: "2026-05-09"
  tests_added: 6
  speedup_median_pct: 50.5
---

# Phase 88 Plan 01: syncTo() Promise.all Batches Summary

`syncTo()` now writes files in parallel batches of 16 (configurable via `KIT_MCP_SYNC_BATCH_SIZE`), delivering 50%+ wall-time reduction in real workspaces while preserving every Phase 79–83 guard, the Stable API contract, and onProgress semantics.

## What was built

**1. `src/core/sync.js` — write loop refactored.** Module-level helper `resolveBatchSize()` reads `process.env.KIT_MCP_SYNC_BATCH_SIZE`, parses with `Number.parseInt`, and falls back to `16` for missing, non-numeric, or out-of-range `[1, 256]` values. The `if (!dryRun)` block now batches via:

```js
for (let i = 0; i < ops.length; i += BATCH_SIZE) {
  const slice = ops.slice(i, i + BATCH_SIZE);
  await Promise.all(slice.map(applyOp));
}
```

`applyOp` is closure-scoped over a shared `completed` counter that increments after each `mkdir + write|copy + onProgress` triplet. Single-threaded JS event-loop semantics make `completed += 1` atomic without locks.

**2. `test/unit/sync-concurrent.test.js` — 6 new regression tests.**
- **Correctness:** All 9 sample-kit fixture files written, monotonic onProgress 1→9, stable `total`.
- **Race condition:** 2× concurrent `syncTo` to distinct projectRoots produce byte-equal stub content (after stripping ISO-timestamp line) — no torn writes.
- **Env validation (×4):** `BATCH_SIZE=4` honored; non-numeric, `999`, and `0` all fall back to default 16; sync still completes in every case.

## Wall-time benchmarks

Captured via `process.hrtime.bigint()` measurements on the dev machine (Windows 11, NVMe SSD), Node v24.

**Sample-kit fixture (9 files), 10 runs:**
| Mode                         | Median   | Mean     |
|------------------------------|----------|----------|
| Sequential (`BATCH_SIZE=1`)  | 21.68ms  | 23.81ms  |
| Batched (default 16)         | 10.54ms  | 10.55ms  |
| **Speedup**                  | **51.4%**| **55.7%**|

**Real `kit/` workspace (~321 files), 5 runs:**
| Mode                         | Median    | Mean     |
|------------------------------|-----------|----------|
| Sequential (`BATCH_SIZE=1`)  | 675.72ms  | 665.81ms |
| Batched (default 16)         | 334.22ms  | 340.11ms |
| **Speedup**                  | **50.5%** | **48.9%**|

**≥30% target met (50.5% on real kit).** Speedup scales with file count — bottleneck is wall-clock-on-disk-I/O, paralleled bounded by BATCH_SIZE.

## Preservation audit (must-haves verified)

| Guard / contract                                           | Status   | Verified by                                          |
|------------------------------------------------------------|----------|------------------------------------------------------|
| `verifyManifest()` runs BEFORE any write (Phase 83)        | preserved| Position unchanged in `sync.js` (line ~36, before `listKit`) — no TOCTOU |
| `STUB_MARKER`, `MANAGED_MARKER_FILE`, `MANAGED_MARKER_BODY`| preserved| Module-level consts untouched                        |
| `summarize()`, `SUMMARY_MAX_CHARS` exports                 | preserved| Used by mcp-server + cli — exports byte-identical    |
| `statusOf()`, `removeFrom()`, `walkTree()`, `isStub()`     | preserved| No edits applied                                     |
| `dryRun: true` skips writes                                | preserved| `if (!dryRun)` block guards entire batched loop      |
| `onProgress` per-op invocation                             | preserved| Test asserts `calls.length === ops.length` + monotonic counter |
| `result.written` ordering matches ops[] build order        | preserved| `ops.map(o => o.path)` unchanged at return           |
| Stable API v1.0+ signature                                 | preserved| `syncTo(targetId, opts)` shape identical             |

## Test count delta

| Suite                    | Baseline (post-v1.15) | After 88-01 | Delta |
|--------------------------|-----------------------|-------------|-------|
| Unit (active)            | 215                   | 221         | +6    |
| Unit (skipped)           | 2                     | 2           | 0     |
| Integration              | 84                    | 84          | 0     |
| **Total active**         | **299**               | **305**     | **+6**|

Plan target was ≥302; achieved 305 (+3 over target — Test 3 became 4 sub-tests instead of 3). Zero regression in pre-existing tests.

## Counter atomicity rationale

The shared `completed` counter is mutated from N concurrent `applyOp` invocations within `Promise.all`. JavaScript's single-threaded event loop guarantees `completed += 1` reads-then-writes without preemption — only one microtask runs at a time, so no torn reads occur. This is the same pattern Node uses internally for stream emit counters. No `Atomics`, no `mutex`, no race.

If the runtime ever moved to Worker-thread parallelism for fs ops (it hasn't), this would need revision; for now it's safe.

## Decisions Made

1. **BATCH_SIZE=16 default.** Safe under Linux ulimit (1024), macOS (256 default), Windows. Configurable for users on slow disks (`=4`) or fast NVMe with many files (`=32`/`=64`).
2. **No new dependency.** `p-limit` and similar would add bytes + maintenance for an 8-line problem. Budget held at 6/6.
3. **Shared counter, not per-batch index.** Per-index would cause progress to jump backwards (`16 → 1 → 2 → ...`). Shared monotonic counter matches existing UX.
4. **Fail-fast on first reject (`Promise.all` default).** Preserves prior behavior — sync.js had no retry; a single `EACCES`/`ENOSPC` already aborted the install. Adding retry would change semantics outside scope.
5. **Env validation via fallback, not throw.** Misconfigured env vars in CI/CD would brick `kit sync` with cryptic errors; silent fallback to 16 + same observable behavior is more forgiving.

## Deviations from Plan

None — plan executed exactly as written. Only minor adjustment: plan said "8 files in fixture" but probe confirmed 9 (CLAUDE.md from rules capability included). Test 1 expected list updated accordingly.

## Self-Check: PASSED

- `src/core/sync.js`: FOUND, contains `resolveBatchSize`, `BATCH_SIZE`, `Promise.all`, `applyOp`, `for (let i = 0; i < ops.length; i += BATCH_SIZE)`.
- `test/unit/sync-concurrent.test.js`: FOUND, 141 LOC, 6 tests passing.
- Commit `c89454e`: FOUND (`feat(88-01): syncTo() Promise.all batches for parallel I/O`).
- Commit `9392e76`: FOUND (`test(88-01): regression tests for syncTo() batching`).
- `verifyManifest` call position: line 36 of `sync.js`, BEFORE `listKit` and BEFORE the batched write loop — gate preserved.
- Suite: 221 unit (+6) + 84 integration = 305 active, 0 regression.
- Real benchmark: 50.5% median speedup on ~321-file kit (≥30% target met with margin).
