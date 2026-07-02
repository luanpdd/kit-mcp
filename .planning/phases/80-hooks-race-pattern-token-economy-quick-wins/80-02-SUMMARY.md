---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 02
subsystem: performance
tags: [token-economy, mcp, cli, perf-13-01, slim, summarize]

requires:
  - phase: 79-critical-security-fixes
    provides: clean baseline (4 vulns closed, 120 unit + 67 integration green)
provides:
  - exported summarize() and SUMMARY_MAX_CHARS from src/core/sync.js
  - 80-char description cap applied in slim() for both MCP and CLI surfaces
  - regression test slim-cap.test.js measuring real corpus reduction (44.4%)
affects: [list-agents, list-commands, list-skills, mcp-server, cli, claude-code-context]

tech-stack:
  added: []
  patterns:
    - "shared helper exports for cross-surface consistency (single source of truth for caps)"
    - "real-corpus regression test that bakes acceptance threshold into the suite"

key-files:
  created:
    - test/unit/slim-cap.test.js
  modified:
    - src/core/sync.js
    - src/mcp-server/index.js
    - src/cli/index.js

key-decisions:
  - "Apply cap in BOTH MCP server and CLI slim() — cross-surface divergence would be a UX trap"
  - "Reuse summarize() instead of duplicating the 80-char cap constant (single source of truth)"
  - "Bake the 10% reduction acceptance bar into a real-corpus test, not a synthetic mock"

patterns-established:
  - "Cross-surface consistency: when slim()/serializer functions exist in both mcp-server and cli, they must reuse the same shared helper from src/core/"
  - "Threshold tests: PERF acceptance criteria from audits become real-corpus assertions in the suite, not just a one-off measurement"

requirements-completed: [PERF-13-01]

duration: ~6min
completed: 2026-05-09
---

# Phase 80 Plan 02: Slim Cap Summary

**80-char description cap applied via shared summarize() in MCP and CLI list-* surfaces — 44.4% real-corpus payload reduction (26057 -> 14498 bytes across 179 items), 4.4x above the 10% audit estimate.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-09T04:53:00Z (approximate)
- **Completed:** 2026-05-09T04:59:46Z
- **Tasks:** 4
- **Files modified:** 3 (1 created, 2 modified) plus 1 test file

## Accomplishments

- `summarize()` and `SUMMARY_MAX_CHARS` now exported from `src/core/sync.js` — single source of truth for the description cap.
- `slim()` in `src/mcp-server/index.js` truncates `list-agents`/`list-commands`/`list-skills` descriptions via the shared helper (PERF-13-01).
- `slim()` in `src/cli/index.js` mirrors the change so terminal listings match MCP listings — no cross-surface drift.
- Regression test loads the real kit-mcp corpus via `listKit()`, computes original vs capped byte count, and asserts >=10% reduction. Real run: **44.4%** (26057 -> 14498 bytes across 179 items).
- 6 correctness tests cover empty, short, exactly-80, long, whitespace-collapse, and realistic-agent-description cases.
- Suite total: **130/130 pass** (120 baseline + 3 phase-79/80-01 + 7 new). Zero regression.

## Task Commits

Each task committed atomically (--no-verify per parallel exec spec):

1. **Tarefa 1: Export summarize() and SUMMARY_MAX_CHARS from src/core/sync.js** - `ab4fb2c` (feat)
2. **Tarefa 2: Apply summarize() in slim() of src/mcp-server/index.js** - `6549095` (feat)
3. **Tarefa 3: Apply summarize() in slim() of src/cli/index.js** - `6566f26` (feat)
4. **Tarefa 4: Unit test for cap correctness + payload reduction** - `32a7aaa` (test)

## Files Created/Modified

### Created

- `test/unit/slim-cap.test.js` — 7 tests; 6 correctness + 1 real-corpus reduction measurement.

### Modified

- `src/core/sync.js` — added `export` to `const SUMMARY_MAX_CHARS` and `function summarize`. Body unchanged. Internal callers in `buildAggregatedRules()` continue working unchanged in ESM (named exports remain locally callable).
- `src/mcp-server/index.js` — extended existing `import { syncTo, statusOf, removeFrom } from '../core/sync.js'` with `summarize`. Modified `slim()` to wrap `x.description` in `summarize()`.
- `src/cli/index.js` — same pattern as mcp-server. CLI smoke test confirmed: 47 agents listed, 0 over 80 chars, sample (`advisor-researcher`) shows length=80 with ellipsis suffix.

## Diff Summary

### `src/core/sync.js` (lines 260-266)
```diff
-const SUMMARY_MAX_CHARS = 80;
-function summarize(desc) {
+// PERF-13-01: exported so slim() in src/mcp-server/index.js and src/cli/index.js
+// can reuse the same cap (single source of truth — no duplicated constants).
+export const SUMMARY_MAX_CHARS = 80;
+export function summarize(desc) {
   if (!desc) return '';
   ...
}
```

### `src/mcp-server/index.js` (line 17 + slim())
```diff
-import { syncTo, statusOf, removeFrom } from '../core/sync.js';
+import { syncTo, statusOf, removeFrom, summarize } from '../core/sync.js';
 ...
 function slim(x) {
   // absPath omitted by design — list-* tools are AI-consumed in tight context budgets.
   // Use action=get to fetch the absPath (and content) for a specific item.
-  return { kind: x.kind, name: x.name, description: x.description };
+  // PERF-13-01 (TOK-02): truncate description via SUMMARY_MAX_CHARS (80) cap shared
+  // with src/core/sync.js — full description lives in each item's file under kit/.
+  return { kind: x.kind, name: x.name, description: summarize(x.description) };
 }
```

### `src/cli/index.js` (line 21 + slim())
```diff
-import { syncTo, statusOf, removeFrom } from '../core/sync.js';
+import { syncTo, statusOf, removeFrom, summarize } from '../core/sync.js';
 ...
 function slim(x) {
-  return { kind: x.kind, name: x.name, description: x.description };
+  // PERF-13-01: cap description at SUMMARY_MAX_CHARS via shared summarize()
+  // helper from src/core/sync.js — keeps cross-surface behavior identical
+  // (CLI listing == MCP listing). Full text remains in each item's source file.
+  return { kind: x.kind, name: x.name, description: summarize(x.description) };
 }
```

## Test Output (Real Corpus Reduction)

```
[PERF-13-01] reduction: 44.4% (26057 -> 14498 bytes across 179 items)
PERF-13-01: real kit-mcp corpus shows >=10% reduction in description bytes (98.66ms)
tests 7
pass 7
fail 0
```

Full unit suite after all 4 tasks:
```
tests 130
pass 130
fail 0
```

## Decisions Made

1. **Cap applied to BOTH surfaces** — the plan called this out explicitly, but it was a deliberate decision against "MCP-only" simplification. CLI listings would otherwise show full descriptions to humans while the MCP listing shows truncated to AI; the divergence would be confusing and a UX trap.
2. **Reuse `summarize()` instead of redefining** — duplicating the 80-char cap constant in two more files would have created 3 sources of truth. The helper export is one extra named export with zero runtime overhead; the value beats inlining.
3. **Real-corpus assertion in the suite** — the 10% reduction estimate from the audit could have been validated via a one-off CLI run. Baking it into a test means future changes that re-bloat descriptions (e.g., an agent author writing a 60-char description that gets capped to 60 instead of saving more bytes) will surface as a regression rather than silently degrade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Corrected `listKit` import path in test file**
- **Found during:** Tarefa 4
- **Issue:** PLAN context (lines 326-327 in slim-cap.test.js code block) imported `listKit` from `'../../src/core/sync.js'`, but `listKit` is exported from `src/core/kit.js`, not `sync.js`. Importing from sync.js would have produced a runtime error and the test would never run.
- **Fix:** Changed test file to import `listKit` from `'../../src/core/kit.js'` while keeping `summarize` and `SUMMARY_MAX_CHARS` imports from `sync.js` (correct module).
- **Files modified:** `test/unit/slim-cap.test.js` (only this newly-created file)
- **Verification:** `grep -E "listKit" src/core/kit.js` confirms export at line 46; new test runs and corpus assertion passes.
- **Committed in:** `32a7aaa` (part of Tarefa 4 commit)

**2. [Rule 3 - Blocker] Replaced non-ASCII glyphs (>=, ≤) with ASCII (>=, <=) in test code**
- **Found during:** Tarefa 4
- **Issue:** PLAN code block contained `≥10`, `≤80` Unicode glyphs in assertion messages and docstrings. While Node would parse these fine, the file is also written/read on Windows (current host) where non-BMP glyphs occasionally cause mojibake in editor save round-trips. The actual `…` ellipsis suffix produced by `summarize()` is part of the runtime contract and was preserved verbatim; only the comment/message glyphs were normalized.
- **Fix:** `≥` -> `>=`, `≤` -> `<=` in inline comments and assertion messages. Ellipsis `…` left untouched in test assertions because it's the literal output of `summarize()`.
- **Files modified:** `test/unit/slim-cap.test.js`
- **Verification:** Test runs identically; assertion `out.endsWith('…')` continues to validate the exact runtime suffix.
- **Committed in:** `32a7aaa`

---

**Total deviations:** 2 auto-fixed (both Rule 3 blockers — test file would not have functioned without them)
**Plan impact:** No scope expansion. The plan-as-written had two minor errors in the test code block (wrong import + non-ASCII source). Behavior of the cap and acceptance bar (>=10%) unchanged. Real measurement (44.4%) far exceeds the bar regardless.

## Issues Encountered

None during planned work — both deviations above were caught and fixed pre-flight before commit. Suite went from 120/120 (baseline) to 130/130 with zero red intermediates.

## Manual Setup Required

None — all changes are pure code with no external service config.

## Next Phase Readiness

- Phase 80 plan 03 (dedup hooks block T4 — strip commented `# hooks:` from 11 agents) and plan 04 (drop CHANGELOG.md from npm tarball T11) are independent of this plan and unblocked.
- Phase 80 plans 05-10 (the 6 hooks race pattern fixes) are independent of token economy changes; they can run in parallel with the remaining token-economy plans.
- All requirements completed: PERF-13-01 closed.

## Self-Check: PASSED

Files:
- FOUND: `test/unit/slim-cap.test.js`
- FOUND: `.planning/phases/80-hooks-race-pattern-token-economy-quick-wins/80-02-SUMMARY.md`

Commits (all 4 task commits located via `git log --all`):
- FOUND: `ab4fb2c` — feat(80-02): export summarize and SUMMARY_MAX_CHARS from sync.js
- FOUND: `6549095` — feat(80-02): apply summarize cap in MCP slim() (PERF-13-01)
- FOUND: `6566f26` — feat(80-02): apply summarize cap in CLI slim() (PERF-13-01)
- FOUND: `32a7aaa` — test(80-02): add PERF-13-01 regression test for slim() cap

Verification gates (all passed):
- `grep -E "^export function summarize" src/core/sync.js` -> 1 match
- `grep -E "summarize\(x\.description\)" src/mcp-server/index.js src/cli/index.js` -> 2 matches
- `node --test test/unit/slim-cap.test.js` -> exit 0; 7/7 pass
- Reduction line printed: `[PERF-13-01] reduction: 44.4% (26057 -> 14498 bytes across 179 items)`
- `node test/run.mjs test/unit` -> 130/130 pass; zero regression

---
*Fase: 80-hooks-race-pattern-token-economy-quick-wins*
*Concluída: 2026-05-09*
