---
phase: 84-mcp-error-sanitization
verified: 2026-05-09T11:25:00Z
status: passed
score: 10/10 must-haves verified
re_verification: null
gaps: []
human_verification: []
---

# Phase 84: MCP Error Sanitization Verification Report

**Phase Goal:** Fechar SEC-14-06 — error envelopes do MCP server vazam stack traces, paths absolutos, ANTHROPIC_API_KEY fragments.
**Verified:** 2026-05-09T11:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                         | Status     | Evidence                                                                                                           |
| --- | --------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | MCP error envelopes never contain absolute filesystem paths                                   | VERIFIED   | `mcp-error-envelope.test.js` (5 tests, all asserting `/[A-Z]:[\\\/]/` no match); spawn test asserts on stdout      |
| 2   | MCP error envelopes never contain serialized e.stack                                          | VERIFIED   | `mcp-error-envelope.test.js` (5x `'stack' in parsed === false`); spawn test asserts `/"stack"\s*:/` zero matches    |
| 3   | reflect() with Anthropic 401 scrubs sk-ant / Bearer / x-api-key from rethrown error           | VERIFIED   | `reflect-redact.test.js` (3 tests, fetch monkey-patched, asserts no raw token in `err.message`)                    |
| 4   | recordReplay strips secrets/paths from JSON before persisting                                 | VERIFIED   | `replays-redact.test.js` (3 tests; reads file from disk, asserts `[REDACTED]`/`[PATH]` markers, no raw secrets)    |
| 5   | Server-side stderr keeps full stack for operator debug                                        | VERIFIED   | spawn test asserts `/at\s+validateReplayId/\|/replays\.js/` on stderr + `/\[mcp-server\] error in handler/`        |
| 6   | redactSecrets used at exactly 3 source call sites (single source of truth)                    | VERIFIED   | `grep -E "^import.*error-redaction" src/` returns 3 (mcp-server, replays, reflect)                                  |
| 7   | NO false positives — "Compare A:B", "Modal: hello", "https://" preserved                      | VERIFIED   | `error-redaction.test.js` 6 negative fixtures + idempotency test                                                    |
| 8   | Suite continues passing (~275 expected)                                                       | VERIFIED   | unit 191 (189 pass + 2 skipped) + integration 84/84 = 275 total, 273 pass, 0 fail                                   |
| 9   | Backward compat: envelope schema `{error: string, code?: string}` — only drops stack          | VERIFIED   | `sanitizeMcpError` returns `{error, code}` shape; Phase 83 mcp-projectroot-guard + manifest-verify tests still green |
| 10  | Phase 82 + 83 invariants preserved (EMANIFESTMISMATCH propagation, projectRoot guard, etc.)   | VERIFIED   | 21/21 pass on `mcp-projectroot-guard + mcp-gates-guard + manifest-verify + gate-runner-tmpdir + replays-path-traversal` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                              | Expected                                              | Exists | Substantive | Connected | Data Flows | Status   | Details                                                              |
| ----------------------------------------------------- | ----------------------------------------------------- | :----: | :---------: | :-------: | :--------: | -------- | -------------------------------------------------------------------- |
| `src/core/error-redaction.js`                         | `redactSecrets` + `sanitizeMcpError` pure helpers    |   ✓    |      ✓      |     ✓     |     ✓      | VERIFIED | 76 lines; 6 regex patterns; idempotent; 3 import sites                |
| `src/mcp-server/index.js` (central catch)             | imports + uses `sanitizeMcpError`                     |   ✓    |      ✓      |     ✓     |     ✓      | VERIFIED | Line 24 import; line 331 stderr log; line 333 sanitizeMcpError call  |
| `src/core/reflect.js` (callClaude error path)         | imports + uses `redactSecrets` on errBody             |   ✓    |      ✓      |     ✓     |     ✓      | VERIFIED | Line 22 import; line 177 `redactSecrets(errBody)` before throw       |
| `src/core/replays.js` (recordReplay)                  | imports + uses `redactSecrets` on serialized JSON     |   ✓    |      ✓      |     ✓     |     ✓      | VERIFIED | Line 17 import; line 79 `redactSecrets(JSON.stringify(record))`     |
| `test/unit/error-redaction.test.js`                   | ≥22 helper-pure unit tests                            |   ✓    |      ✓      |     -     |     -      | VERIFIED | 159 lines, 23 named tests (positive + negative + defensive + idemp.) |
| `test/unit/mcp-error-envelope.test.js`                | 5 envelope integration tests via `_requestHandlers`   |   ✓    |      ✓      |     -     |     -      | VERIFIED | 118 lines, 5 named tests; sdk-internals-changed defensive skip       |
| `test/unit/reflect-redact.test.js`                    | fetch-mock for Anthropic 401, scrub asserted          |   ✓    |      ✓      |     -     |     -      | VERIFIED | 162 lines, 3 named tests (header echo + bare body + Bearer/path)    |
| `test/unit/replays-redact.test.js`                    | recordReplay scrub on persisted JSON                  |   ✓    |      ✓      |     -     |     -      | VERIFIED | 97 lines, 3 named tests (on-disk + reload + in-memory invariant)    |
| `test/integration/mcp-error-stderr-leak.test.js`      | spawn smoke; stack on stderr only                     |   ✓    |      ✓      |     -     |     -      | VERIFIED | 109 lines, 1 named test; spawns bin/mcp.js; <2s wall-clock          |

### Key Link Verification

| From                                                | To                                              | Via                                    | Status | Details                                                            |
| --------------------------------------------------- | ----------------------------------------------- | -------------------------------------- | ------ | ------------------------------------------------------------------ |
| `src/mcp-server/index.js` (line 327 catch)          | `src/core/error-redaction.js (sanitizeMcpError)` | named import + envelope build          | WIRED  | Line 24 import; line 333 call inside `JSON.stringify(...)`         |
| `src/core/reflect.js` (line 171 401 path)           | `src/core/error-redaction.js (redactSecrets)`   | named import + interpolation in throw  | WIRED  | Line 22 import; line 177 `${redactSecrets(errBody)}` before throw  |
| `src/core/replays.js` (line 71 recordReplay)        | `src/core/error-redaction.js (redactSecrets)`   | named import + post-stringify scrub    | WIRED  | Line 17 import; line 79 `redactSecrets(JSON.stringify(record))`   |

### Behavioral Spot-Checks

| Behavior                                                                               | Command                                                                                  | Result                              | Status |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- | ------ |
| Helper module loads + redacts                                                          | `node --test test/unit/error-redaction.test.js`                                          | 23/23 pass                          | PASS   |
| Central catch returns sanitized envelope on thrown handler                             | `node --test test/unit/mcp-error-envelope.test.js`                                       | 5/5 pass                            | PASS   |
| Anthropic 401 rethrow scrubs secrets                                                   | `node --test test/unit/reflect-redact.test.js`                                           | 3/3 pass                            | PASS   |
| recordReplay persists scrubbed JSON to disk                                            | `node --test test/unit/replays-redact.test.js`                                           | 3/3 pass                            | PASS   |
| Spawn smoke: real bin/mcp.js, stack on stderr only                                     | `node --test test/integration/mcp-error-stderr-leak.test.js`                             | 1/1 pass (1.5s wall-clock)          | PASS   |
| Phase 79+83 invariants                                                                 | `node --test test/unit/{mcp-projectroot-guard,mcp-gates-guard,manifest-verify,gate-runner-tmpdir,replays-path-traversal}.test.js` | 21/21 pass | PASS   |
| Full suite                                                                             | `node test/run.mjs test/unit && node test/run.mjs test/integration`                      | 275 total (273 pass, 2 skipped, 0 fail) | PASS   |

### Requirements Coverage

| Requirement | Source Plan                          | Description                                                                                | Status    | Evidence                                                                              |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------- |
| SEC-14-06   | `84-01-error-redaction-PLAN.md`      | MCP error envelope leak (stack traces / paths / API key fragments) closed end-to-end       | SATISFIED | All 5 truths VERIFIED; 35 regression tests; 3-call-site choke point grep-verifiable   |

### Anti-Patterns Found

| File                                  | Line | Pattern                                                                  | Severity | Impact                                                                                                                                  |
| ------------------------------------- | ---: | ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/mcp-server/index.js`             |  331 | `console.error('[mcp-server] error in handler:', e?.stack ?? e)`         | INFO     | Stack still logged, but ONLY to stderr (operator-debug log). This is the explicit Phase 84 design — not a leak. Verified by spawn test. |

No blocking anti-patterns. The single `console.error` with `e?.stack` is the deliberate operator-side observability preserve required by truth #5.

Negative-grep checks (verification step 4 in PLAN):
- `grep -nE "stack: e\.stack|stack: err\.stack" src/mcp-server/index.js` → **0 matches** (leak line gone)
- `grep -nE "Anthropic API \$\{res\.status\}: \$\{errBody\}" src/core/reflect.js` → **0 matches** (unredacted form gone)
- `grep -n "stack" src/core/error-redaction.js` → **0 matches** (helper never references stack token)
- `grep -E "^import.*error-redaction" src/` → **3 matches** (exactly 3 call sites)

### Human Verification Required

None. All 10 truths verified programmatically; spot-checks PASS on every behavioral trigger.

### Gaps Summary

No gaps. The phase achieves SEC-14-06 closure end-to-end with:

1. **Helper choke point** — `src/core/error-redaction.js` exports `redactSecrets` (6-pattern regex) + `sanitizeMcpError` (envelope builder). 76-line pure module, idempotent, defensive against null/undefined/non-string input.
2. **Three surgical call sites** verified by `grep`:
   - `src/mcp-server/index.js:24,333` — central catch sanitizes envelope; `console.error` keeps stack on stderr.
   - `src/core/reflect.js:22,177` — Anthropic API error path scrubs `errBody` before rethrow (protects CLI callers and provides defense-in-depth for MCP transport).
   - `src/core/replays.js:17,79` — `recordReplay` redacts post-`JSON.stringify` so the in-memory `record` returned to caller stays unmutated, and only the on-disk artifact is scrubbed.
3. **35 regression tests across three altitudes** (helper-pure unit / in-process MCP dispatcher / spawn smoke):
   - 23 helper unit tests (7 positive + 6 negative no-false-positive + 4 defensive + 1 idempotency + 5 sanitizeMcpError shape including Phase 83 EMANIFESTMISMATCH propagation).
   - 5 in-process envelope tests via `server._requestHandlers` Map probe (same pattern as Phase 83.01 mcp-projectroot-guard).
   - 3 reflect-redact fetch-mock tests (header-shape echo + bare-body sk-ant + Bearer/path combo).
   - 3 replays-redact tests (on-disk file content + reload-from-disk redaction visible + in-memory record unmutated).
   - 1 spawn smoke test asserting stderr contains stack while stdout JSON-RPC envelope does not.
4. **Phase 79 + 83 invariants confirmed green** — 21/21 on the cross-phase guard suite.
5. **Suite total 275 (273 pass, 2 skipped, 0 fail)**, exactly matching the +5 net new file claim in the SUMMARY (240 baseline → 275 final, +35 net new tests across +5 new test files).

**SEC-14-06 closed.** No follow-up phase needed for this REQ.

---

_Verified: 2026-05-09T11:25:00Z_
_Verifier: Claude (verifier)_
