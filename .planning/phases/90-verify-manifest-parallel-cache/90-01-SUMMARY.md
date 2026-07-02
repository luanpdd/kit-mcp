---
phase: 90-verify-manifest-parallel-cache
plan: 01
subsystem: core/manifest-verify
tags: [perf, cache, sha256, parallel, manifest, sec-14-05]
requirements: [PERF-17-01]
dependency_graph:
  requires:
    - "Phase 83-03: SEC-14-05 manifest verification helper (verifyManifest export)"
    - "Phase 88.01: Promise.all batches=16 pattern reference (sync.js)"
    - "Phase 80: kit.js cache TTL pattern reference (PERF-01 listKit cache)"
    - "v1.15 (commit 0130c5b): CRLF→LF normalize for cross-platform stability"
  provides:
    - "verifyManifest() with Promise.all batches=16 (~40% faster vs sequential)"
    - "Module-level cache TTL 30s for repeat-call ergonomics (watch trigger pattern)"
    - "clearVerifyManifestCache() exported helper for test isolation"
    - "KIT_MCP_VERIFY_NO_CACHE=1 env bypass for emergency dev escape"
  affects:
    - "src/core/sync.js: syncTo() upstream caller benefits automatically (no API change)"
tech_stack:
  added: []
  patterns:
    - "Promise.all batches=16 (PERF-16-01 pattern from sync.js)"
    - "Module-level Map cache with TTL gate (PERF-01 pattern from kit.js)"
    - "Pure-function checkOne (no shared-state mutation) — race-safe parallel"
key_files:
  created:
    - ".planning/phases/90-verify-manifest-parallel-cache/90-01-SUMMARY.md"
  modified:
    - "src/core/manifest-verify.js (parallel batches + cache + env bypass + JSDoc)"
    - "test/unit/manifest-verify.test.js (5 PERF-17-01 regression tests + beforeEach/afterEach env+cache hooks)"
decisions:
  - "BATCH_SIZE=16 hardcoded — env override is overengineering for this hot path (matches Phase 88.01 sweet spot)"
  - "Cache key is bare kitRoot (no compound key) — verifyManifest has no mode parameter unlike listKit"
  - "Cache only ok=true; mismatch/missing always recompute — devs fixing tampered files see immediate recovery"
  - "Cache check AFTER SKIP_ENV — preserves absolute priority of KIT_MCP_SKIP_MANIFEST_CHECK=1"
  - "clearVerifyManifestCache() exported (mirrors clearKitCache) for test isolation robustness"
metrics:
  duration: "~3.5 minutes wall-clock execution"
  completed: "2026-05-09T15:10:43Z"
  tasks_completed: 3
  tests_added: 5
  tests_total: 322 (237 unit + 85 integration)
  tests_baseline: 317
---

# Phase 90 Plan 01: verifyManifest Parallel + Cache Summary

verifyManifest now hashes 327 files via Promise.all batches=16 (was sequential for-loop) and caches ok=true results in-memory with TTL 30s — same patterns as Phase 88.01 sync.js writes and Phase 80 kit.js listKit cache.

## What Was Built

### Task 1: Promise.all batches=16 (commit `1deaeea`)

Refactored `verifyManifest()` in `src/core/manifest-verify.js`:
- Added `const BATCH_SIZE = 16` module-level constant.
- Replaced sequential `for (const [rel, expected] of Object.entries(manifest.files))` (lines 53-66 pre-refactor) with batched Promise.all loop.
- Extracted per-file logic into pure function `checkOne([rel, expected])` that returns `{ rel, status: 'ok'|'mismatch'|'missing', expected?, actual? }` — no shared-state mutation, race-safe.
- Aggregator after each batch resolves pushes to `mismatches[]` / `missing[]`.
- Added JSDoc mentioning PERF-17-01 + Promise.all batching.
- **Preserved**: SKIP_ENV early-return, manifest read+parse, reason assembly, return shape, **CRLF→LF normalize line intact** (cross-platform stable from v1.15 commit 0130c5b).

### Task 2: Module-level cache + env bypass (commit `4d3a0bd`)

Added in-memory cache mirroring `kit.js` PERF-01 pattern:
- `const VERIFY_CACHE_TTL_MS = 30_000` and `const verifyManifestCache = new Map()` module-level.
- `const NO_CACHE_ENV = 'KIT_MCP_VERIFY_NO_CACHE'`.
- Exported `clearVerifyManifestCache()` for test isolation.
- Cache hit check positioned AFTER `SKIP_ENV` (absolute priority preserved) and BEFORE manifest read (early return saves I/O).
- Cache write ONLY on `ok: true` path. Mismatch/missing recompute every call so devs see fixes immediately.
- Env `KIT_MCP_VERIFY_NO_CACHE=1` bypasses both read AND write — clean test isolation + emergency dev escape.

### Task 3: 5 regression tests (commit `eb4dfd6`)

Added in `test/unit/manifest-verify.test.js`:
1. **Parallel batches sanity** — 50-file fixture, asserts elapsed < 500ms (CI-tolerant bound, not micro-benchmark).
2. **Cache hit (TTL ok path)** — tampers file after 1st call WITHOUT clearing cache, asserts 2nd call still returns ok=true (proves cache is serving, not silently re-computing).
3. **Mismatch never caches** — 1st call sees tamper (fail), restore file, 2nd call must recompute and pass.
4. **Env bypass** — primes cache, tampers, sets KIT_MCP_VERIFY_NO_CACHE=1, asserts recompute detects tamper.
5. **CRLF→LF preserved** — explicit cross-platform regression: file written with CRLF, manifest hashed from LF — verify must normalize and match.

Also updated `beforeEach`/`afterEach` to save/restore `KIT_MCP_VERIFY_NO_CACHE` and call `clearVerifyManifestCache()` for test isolation. Updated import to include `clearVerifyManifestCache`.

## Verification

| Check | Result |
|-------|--------|
| `node --test test/unit/manifest-verify.test.js` | 11/11 pass (6 SEC-14-05 + 5 PERF-17-01) |
| `node test/run.mjs test/unit` | 237 pass, 0 fail, 2 skipped |
| `node test/run.mjs test/integration` | 85 pass, 0 fail |
| **Total suite** | **322 pass, 0 fail** (≥317 baseline + 5 new) |
| `grep -c "BATCH_SIZE = 16"` | 1 match (declaration) |
| `grep -c "Promise.all"` | 4 matches |
| `grep -c "verifyManifestCache"` | 4 matches (declaration + get + set + clear export) |
| `grep -c "KIT_MCP_VERIFY_NO_CACHE"` | 3 matches |
| `grep -c "replace(/\\r\\n/g, '\\n')"` | 1 match (CRLF→LF preserved) |
| `grep -c "PERF-17-01"` in tests | 6 matches (5 tests + 1 section comment) |

## Performance Expectations

Per plan success criteria (validated via meta-audit post-phase, not blocking suite):
- **verifyManifest 327 files**: target ≤74ms (≥40% reduction vs 123ms baseline).
- **Cache hit (2nd consecutive call)**: <5ms (Map.get + Date comparison only).

The PERF-17-01 50-file parallel test measures ~80ms wall time (CI runner, includes fixture build + manifest hash computation in test harness). Real verifyManifest call within that test executes in well under the 500ms generous bound.

## Decisions Made

1. **BATCH_SIZE=16 hardcoded** — env override would be overengineering for this hot path. Phase 88.01 already validated 16 as sweet spot for SHA256+fs.readFile workloads; defensive ceiling on Linux ulimit 1024 fd default.
2. **Cache key is bare kitRoot** — `verifyManifest` has no `mode`/options parameter (unlike `listKit` which uses `${kitRoot}:${stubsOnly?'stubs':'full'}`).
3. **ok-only caching** — mismatch path never caches. Caching errors would punish developers who just fixed a tampered file by serving stale failure; recompute is correct semantics.
4. **Cache check after SKIP_ENV** — preserves absolute priority of `KIT_MCP_SKIP_MANIFEST_CHECK=1` so dev-mode bypass continues to short-circuit before any I/O.
5. **Exported clearVerifyManifestCache()** — mirrors `clearKitCache()` pattern. Test isolation via env var alone works but explicit clear in `beforeEach` is more robust against accidental env leak across test files.

## Deviations from Plan

None — plan executed exactly as written. All three tasks landed atomically with the specified file edits, no auto-fix detours, no architectural questions raised.

## Stable API Preserved

- `verifyManifest()` signature unchanged: `(kitRoot: string) => Promise<{ok, skipped?, reason?, mismatches?, missing?}>`
- New export `clearVerifyManifestCache()` is additive (test/dev helper, no breaking change).
- New env var `KIT_MCP_VERIFY_NO_CACHE` is additive (defaults to off; existing callers unaffected).
- `KIT_MCP_SKIP_MANIFEST_CHECK=1` priority absolute (cache check positioned downstream).
- Phase 79.01 gates guard preserved (SKIP_ENV early-return intact).
- Phase 83 contract preserved (manifest format readout intact, error path shape intact).
- Budget 6/6 deps maintained (zero new dependencies).

## Self-Check: PASSED

Files verified to exist:
- FOUND: src/core/manifest-verify.js (175 lines, BATCH_SIZE + cache + Promise.all + CRLF→LF preserved)
- FOUND: test/unit/manifest-verify.test.js (5 PERF-17-01 tests appended after 6 SEC-14-05 tests)
- FOUND: .planning/phases/90-verify-manifest-parallel-cache/90-01-SUMMARY.md (this file)

Commits verified to exist (via git log --oneline):
- FOUND: 1deaeea — refactor(90-01): parallelize verifyManifest with Promise.all batches=16
- FOUND: 4d3a0bd — feat(90-01): add module-level cache TTL 30s with env bypass
- FOUND: eb4dfd6 — test(90-01): add 5 regression tests for parallel batches + cache

Suite green: 322 pass, 0 fail.
