---
phase: 79-critical-security-fixes
plan: 01
subsystem: security
tags: [mcp, security, gates, shell-exec, sec-13-01]

requires:
  - phase: roadmap-meta-audit
    provides: identification of CRITICAL gates.run shell-exec primitive over MCP transport
provides:
  - guard in src/mcp-server/index.js handleGates that refuses MCP-driven gates.run
  - stable error message that MCP clients can codify ("MCP gates.run requires interactive TTY confirmation; use `kit gates run` from CLI instead.")
  - regression test test/unit/mcp-gates-guard.test.js (SEC-13-01)
affects: [v1.13 security release notes, MCP client integrators, future v1.14 SDK upgrade plans]

tech-stack:
  added: []
  patterns:
    - "MCP handler refusal pattern: return { error: '<sentinel>' } from action branch; clients parse content[0].text as JSON"
    - "Reflective unit tests on @modelcontextprotocol/sdk Server._requestHandlers Map for transport-free handler probing"

key-files:
  created:
    - test/unit/mcp-gates-guard.test.js
  modified:
    - src/mcp-server/index.js

key-decisions:
  - "Guard is inline early-return in handleGates 'run' branch — no flag scheme (rejected per CONTEXT.md C1 because there is no MCP transport channel that could legitimately set such a flag)"
  - "Preserved import { runGate } from '../core/gate-runner.js' even though now unused at MCP server — module-level removal is dead-weight churn for zero benefit, and CLI integration paths still reference the gate-runner abstraction"
  - "Error returned as { error: '...' } not throw — matches existing pattern in handleKit/handleSync/handleForensics; SDK serializes to content[0].text JSON and clients consume uniformly"
  - "Regression test reflects on Server._requestHandlers (private SDK API) instead of mocking transport — gracefully skips if SDK internals shift, source-grep in Task 1 acceptance is the durable contract"

patterns-established:
  - "MCP-side refusals: when an MCP action wraps a CLI capability that requires TTY confirmation, return descriptive error pointing at the CLI entry point. Clients should detect refusal via the sentinel substring."
  - "Test runner extension contract: test/run.mjs only walks .test.js — new test files must use that extension or they silently never execute"

requirements-completed: [SEC-13-01]

duration: ~2 min
completed: 2026-05-09
---

# Phase 79 Plan 01: MCP gates.run guard — Summary

**Closed CRITICAL `gates.run` arbitrary-shell-exec primitive over MCP transport — handler now returns stable refusal sentinel instead of spawning bash from gate body content; CLI `kit gates run` unaffected.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-09T04:31:32Z (approx — first commit at 01:31:34 -03:00 = 04:31:34Z)
- **Completed:** 2026-05-09T04:33:32Z
- **Tasks:** 2
- **Files modified:** 1
- **Files created:** 1

## Accomplishments

- **MCP transport hardening:** `handleGates` 'run' branch in `src/mcp-server/index.js` now returns `{ error: 'MCP gates.run requires interactive TTY confirmation; use \`kit gates run\` from CLI instead.' }` instead of dispatching to `runGate(args.id, { yes: true, interactive: false })`. The previous code path bypassed the "y/N before exec" promise guarded by `runGate`'s `interactive` flow, and combined with reverse-sync (which can rewrite `gates/*.md` content) constituted an arbitrary-shell-exec primitive any MCP client could trigger.
- **Stable client-facing contract:** the sentinel substring `MCP gates.run requires interactive TTY confirmation` is now part of the kit-mcp v1.13 contract — MCP clients can grep for it programmatically to detect the refusal and route the user to the CLI.
- **Regression test:** `test/unit/mcp-gates-guard.test.js` (SEC-13-01) reflects on `Server._requestHandlers` to invoke the `tools/call` handler directly and asserts the sentinel + that no shell side effects (exitCode/stdout/stderr) appear in the response.
- **CLI surface preserved:** `bin/cli.js` and `src/core/gate-runner.js` were not touched — `kit gates run <id>` continues to prompt y/N and execute as before. Existing `test/unit/gates.test.js` (which exercises `runGate` directly) still passes unchanged.

## Task Commits

Each task was committed atomically (with `--no-verify` per parallel-execution protocol):

1. **Task 1: Add guard in handleGates 'run' that rejects invocation via MCP transport** — `584dc8f` (fix)
2. **Task 2: Validate guard via boot + test + CLI smoke; create regression test** — `e476c09` (test)

## Files Created/Modified

- `src/mcp-server/index.js` (modified) — `case 'run':` branch in `handleGates` replaced with early-return error object. Lines 202-208 → 202-211 (8 insertions, 6 deletions). SEC-13-01 reference inline in comment for future grep-based traceability.
- `test/unit/mcp-gates-guard.test.js` (created) — single test asserting refusal sentinel + absence of shell side effects. 79 lines including comment block explaining SDK-internal reflection rationale.

## Stable Error Contract (for MCP client integrators)

The exact response shape after this fix when calling `tools/call` with `name: 'gates', arguments: { action: 'run', id: '<any>' }`:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"error\": \"MCP gates.run requires interactive TTY confirmation; use `kit gates run` from CLI instead.\"\n}"
    }
  ]
}
```

Clients should:
1. Parse `content[0].text` as JSON.
2. Detect the refusal via `parsed.error?.includes('MCP gates.run requires interactive TTY confirmation')`.
3. Surface the remediation hint (`kit gates run`) to the human user.

## Decisions Made

- **Guard pattern: early-return error vs. flag-gated dispatch.** CONTEXT.md C1 suggested an "interactive flag" scheme, but there is no MCP transport channel that could legitimately set such a flag (any MCP client could lie). The early-return is unconditional and correct.
- **Comment carries SEC-13-01 anchor.** Inline reference makes future audits/grep land directly on the guard.
- **Regression test approach: SDK-internal reflection.** Mocking the entire transport layer would be heavier than the fix itself. Reflecting on `Server._requestHandlers` (a Map keyed by method name) is durable enough for v1.13 and gracefully degrades (logs `skip:` and returns) if a future SDK release renames internals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test file extension corrected from `.mjs` to `.js`**
- **Found during:** Task 2 (creating regression test)
- **Issue:** Plan specified `D:\projetos\opensource\mcp\test\unit\mcp-gates-guard.test.mjs`, but `test/run.mjs` only walks `.test.js` files (line 21: `entry.name.endsWith('.test.js')`). Using `.mjs` would have silently skipped the test entirely — `node test/run.mjs test/unit` would never see the file, defeating the regression purpose.
- **Fix:** Created the file as `mcp-gates-guard.test.js` instead. Test runner picks it up; it executes and passes.
- **Files modified:** `test/unit/mcp-gates-guard.test.js` (created with `.js` extension)
- **Verification:** `grep -l "SEC-13-01" test/unit/*.js` returns the file; test output shows `✔ SEC-13-01: gates.run via MCP returns stable error and never invokes runGate`.
- **Committed in:** `e476c09` (part of Task 2 commit)

**2. [Rule 3 — Blocking] PowerShell-only `< $null` redirect substituted with `< /dev/null` for Bash-tool boot smoke**
- **Found during:** Task 2 (MCP server boot probe)
- **Issue:** Plan's verification step suggested `node bin/mcp.js < $null` (PowerShell) — but the executor's Bash tool runs the command via bash, where `$null` is an empty variable and the redirect fails with `ambiguous redirect`. This was a verification-only issue, not a fix-issue.
- **Fix:** Used `timeout 2 node bin/mcp.js < /dev/null` to satisfy the same intent (close stdin → server exits cleanly on EOF). Boot exited 0 with no import-time errors.
- **Files modified:** none (verification command only)
- **Verification:** `exit=0` from `timeout 2 node bin/mcp.js < /dev/null`
- **Committed in:** N/A (no source change)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues encountered while completing the planned work)
**Impact on plan:** Both deviations preserve the plan's intent exactly; they only reconcile plan text against actual environment constraints (test runner glob; bash-vs-pwsh syntax). No scope expansion. Sentinel string, file location (modulo extension), test substance, and acceptance criteria all match plan as written.

## Issues Encountered

None blocking. Two minor environment frictions documented under "Deviations" above.

## Manual Setup Required

None — no external service configuration involved.

## Next Phase Readiness

- **Plan 79.02 (replayId path traversal):** unblocked, no shared file with this plan, executed in parallel.
- **Plan 79.03 (publish workflow gates):** unblocked, no shared file, executed in parallel.
- **Phase 80 (hooks race regression suite):** the regression-test pattern established here (reflective probing of MCP server handlers, stable sentinel assertion) can be reused for the hooks race regression tests planned for that phase.
- **v1.13 release readiness:** Phase 79 is one of 3 critical-security phases blocking the v1.13 cut. With 79.01 done and parallel executors completing 79.02/79.03, the security gate of v1.13 is closing.

## Verification Summary

```
✓ grep -q "MCP gates.run requires interactive TTY confirmation" src/mcp-server/index.js  → exit 0
✓ grep -c "runGate(args.id" src/mcp-server/index.js                                       → 0
✓ grep -c "case 'run':" src/mcp-server/index.js                                            → 1
✓ grep -q "SEC-13-01" src/mcp-server/index.js                                              → exit 0
✓ node -e "import('./src/mcp-server/index.js').then(()=>console.log('ok'))"                → "ok"
✓ node test/run.mjs test/unit                                                              → 116 pass / 0 fail
✓ node test/run.mjs test/integration                                                       → 67 pass / 0 fail
✓ node bin/cli.js gates list                                                               → exit 0, gates table rendered
✓ timeout 2 node bin/mcp.js < /dev/null                                                    → exit 0 (clean EOF, no import crash)
✓ grep -l "SEC-13-01" test/unit/*.js                                                       → test/unit/mcp-gates-guard.test.js
```

## Self-Check: PASSED

- `src/mcp-server/index.js` — FOUND
- `test/unit/mcp-gates-guard.test.js` — FOUND
- `.planning/phases/79-critical-security-fixes/01-mcp-gates-guard-SUMMARY.md` — FOUND
- Commit `584dc8f` (Task 1) — FOUND in git log
- Commit `e476c09` (Task 2) — FOUND in git log

---
*Phase: 79-critical-security-fixes*
*Concluída: 2026-05-09*
