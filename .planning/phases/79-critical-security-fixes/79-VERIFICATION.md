---
status: passed
phase: 79
phase_name: Critical Security Fixes
verified_at: 2026-05-09T15:30:00Z
score: 12/12 must-haves verified
---

# Phase 79: Critical Security Fixes — Verification Report

**Phase Goal:** Fechar 4 vulnerabilidades CRITICAL/HIGH identificadas pela auditoria de segurança — bypass de gates.run via MCP, replayId path traversal, e dois gaps no publish workflow (`npm ci || npm install` fallback + skip de tests/audit antes de `npm publish`).

**Verified:** 2026-05-09T15:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (per ROADMAP success criteria)

| #   | Truth                                                                                       | Status     | Evidence                                                                                                  |
| --- | ------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Tentar `gates.run` via MCP retorna erro descritivo sem executar shell                       | ✓ VERIFIED | `src/mcp-server/index.js:202-211` — early-return error; `runGate(args.id` removed (0 matches)             |
| 2   | `loadReplay('../etc/passwd')` retorna erro "invalid replay id" sem ler o arquivo            | ✓ VERIFIED | `src/core/replays.js:92` validateReplayId before path.join; test `loadReplay rejects traversal id` passes |
| 3   | `npm ci` em CI/publish falha hard se lockfile divergir (sem fallback silencioso)            | ✓ VERIFIED | `npm ci \|\| npm install` removed from both workflows (0 matches); strict `run: npm ci` in both           |
| 4   | Publish workflow só publica se `npm test` + `npm audit` passarem                            | ✓ VERIFIED | publish.yml has Tests (unit) [55] → Tests (integration) [59] → Audit [63] → Publish [77]                  |
| 5   | Suite de testes existente continua passando (zero regressão funcional)                      | ✓ VERIFIED | 120/120 unit tests pass; 67/67 integration tests pass                                                     |

**Score:** 5/5 truths verified

---

## Requirements Coverage (REQ IDs)

### SEC-13-01: gates.run via MCP guard — PASS

**Source plan:** `01-mcp-gates-guard-PLAN.md` (frontmatter `requirements: [SEC-13-01]`)

| Verification                                                  | Result | Evidence                                                                                                          |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `MCP gates.run requires interactive TTY confirmation` present | ✓ PASS | `src/mcp-server/index.js:209` — exact sentinel string                                                             |
| `runGate(args.id` removed                                      | ✓ PASS | `grep -c "runGate(args.id" src/mcp-server/index.js` → 0                                                           |
| `case 'run':` branch still exists                              | ✓ PASS | `src/mcp-server/index.js:202` — branch present, body replaced with early-return                                   |
| SEC-13-01 inline comment                                       | ✓ PASS | `src/mcp-server/index.js:203` — `// SEC-13-01: MCP transport must never execute shell …`                          |
| Module imports cleanly                                          | ✓ PASS | `node -e "import('./src/mcp-server/index.js').then(()=>console.log('ok'))"` → `mcp-server-import:ok`              |
| Regression test exists                                          | ✓ PASS | `test/unit/mcp-gates-guard.test.js` — 79 LOC, reflects on `Server._requestHandlers`, asserts sentinel + no exec   |
| Test runs as part of suite                                     | ✓ PASS | `node test/run.mjs test/unit` includes `✔ SEC-13-01: gates.run via MCP returns stable error and never invokes runGate` |
| Guard activates BEFORE any runGate reference                   | ✓ PASS | Line 208-210 returns `{ error: '...' }` synchronously; control never reaches any runGate call (none exist)         |

**Status: ✓ SATISFIED**

---

### SEC-13-02: replayId path traversal — PASS

**Source plan:** `02-replay-id-validation-PLAN.md` (frontmatter `requirements: [SEC-13-02]`)

| Verification                                                                  | Result | Evidence                                                                                                                          |
| ----------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `function validateReplayId` defined                                            | ✓ PASS | `src/core/replays.js:29`                                                                                                          |
| `function assertPathInside` defined                                            | ✓ PASS | `src/core/replays.js:42`                                                                                                          |
| Regex literal `/^[A-Za-z0-9_.-]+$/` present                                    | ✓ PASS | `src/core/replays.js:27` — `const REPLAY_ID_RE = /^[A-Za-z0-9_.-]+$/;`                                                            |
| validateReplayId called in 3+ entry points                                    | ✓ PASS | 5 occurrences total: definition (line 29) + recordReplay (lines 61, 66) + loadReplay (line 92) + annotateReplay (line 102)        |
| path.resolve + prefix assertion via assertPathInside                           | ✓ PASS | Called at `recordReplay:68`, `loadReplay:96`, `annotateReplay:106` — uses `startsWith(base + path.sep)`                           |
| SEC-13-02 inline comment                                                      | ✓ PASS | `src/core/replays.js:20-26` (block comment) + line 58 (per-component validation)                                                  |
| Throws BEFORE any I/O                                                         | ✓ PASS | All `validateReplayId(id)` calls precede `fs.readFile`/`fs.writeFile` in each function                                            |
| Regression test exists with ≥3 traversal cases                                 | ✓ PASS | `test/unit/replays-path-traversal.test.js` — covers `../etc/passwd`, `..`, `foo/bar`, `foo\bar`, `''` (5 vectors in loadReplay)   |
| Test runs as part of suite                                                    | ✓ PASS | 4 SEC-13-02 tests visible in `node test/run.mjs test/unit` output (loadReplay, annotateReplay, recordReplay, valid round-trip)    |
| Module exports preserved                                                      | ✓ PASS | `loadReplay:function recordReplay:function annotateReplay:function`                                                               |

**Status: ✓ SATISFIED**

---

### SEC-13-03: npm ci strict (no fallback) — PASS

**Source plan:** `03-ci-publish-hardening-PLAN.md` (frontmatter `requirements: [SEC-13-03, SEC-13-04]`)

| Verification                                                                       | Result | Evidence                                                                                              |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `npm ci \|\| npm install` removed from publish.yml                                  | ✓ PASS | `grep -c "npm ci \|\| npm install" .github/workflows/publish.yml` → 0                                  |
| `npm ci \|\| npm install` removed from ci.yml                                       | ✓ PASS | `grep -c "npm ci \|\| npm install" .github/workflows/ci.yml` → 0                                       |
| Strict `run: npm ci` in publish.yml                                                | ✓ PASS | `.github/workflows/publish.yml:37` — `run: npm ci` (1 match for `^run: npm ci$`)                       |
| Strict `run: npm ci` in ci.yml smoke job                                            | ✓ PASS | `.github/workflows/ci.yml:118` — `run: npm ci` (1 match for `^run: npm ci$`)                           |
| SEC-13-03 inline comment in publish.yml                                            | ✓ PASS | `.github/workflows/publish.yml:36`                                                                     |
| SEC-13-03 inline comment in ci.yml                                                 | ✓ PASS | `.github/workflows/ci.yml:117`                                                                         |
| Line 73 of ci.yml (`npm install --no-audit --no-fund --silent`) preserved          | ✓ PASS | Match found at `ci.yml:73` — pack setup not touched (matches plan intent)                             |

**Status: ✓ SATISFIED**

---

### SEC-13-04: publish gates (test + audit before publish) — PASS

**Source plan:** `03-ci-publish-hardening-PLAN.md` (frontmatter `requirements: [SEC-13-03, SEC-13-04]`)

| Verification                                                | Result | Evidence                                                                                                                |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `name: Tests (unit)` step exists                            | ✓ PASS | `.github/workflows/publish.yml:55`                                                                                      |
| `name: Tests (integration)` step exists                     | ✓ PASS | `.github/workflows/publish.yml:59`                                                                                      |
| `npm audit --omit=dev --audit-level=high` step exists       | ✓ PASS | `.github/workflows/publish.yml:68`                                                                                      |
| `name: Publish to npm` step still exists                    | ✓ PASS | `.github/workflows/publish.yml:77`                                                                                      |
| Topological order: Tests → Audit → Publish                  | ✓ PASS | awk check: `u=55 i=59 a=63 p=77 => ORDER OK`                                                                            |
| SEC-13-04 inline comment present 3 times                    | ✓ PASS | `publish.yml:56` (Tests unit) + `publish.yml:60` (Tests integration) + `publish.yml:64` (Audit)                         |
| Audit pattern matches ci.yml (set +e + STATUS check)        | ✓ PASS | `publish.yml:67-75` — identical pattern to `ci.yml:60-68`                                                                |

**Status: ✓ SATISFIED**

---

## Critérios de Sucesso do ROADMAP

| #   | Critério                                                                                  | Status   | Evidence                                                                                              |
| --- | ----------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Tentar `gates.run` via MCP retorna erro descritivo sem executar shell                     | ✓ PASS   | Sentinel string at `src/mcp-server/index.js:209`; runGate dispatch removed; regression test passes    |
| 2   | `loadReplay('../etc/passwd')` retorna erro "invalid replay id" sem ler o arquivo          | ✓ PASS   | `validateReplayId` called at `src/core/replays.js:92` before `fs.readFile`; regression test passes    |
| 3   | `npm ci` em CI/publish falha hard se lockfile divergir (sem fallback silencioso)          | ✓ PASS   | Both workflows have strict `run: npm ci`; `\|\| npm install` removed (grep returns 0 matches in both)  |
| 4   | Publish workflow só publica se `npm test` + `npm audit` passarem                          | ✓ PASS   | Order verified by awk: `Tests(unit)[55] < Tests(integration)[59] < Audit[63] < Publish[77]`           |
| 5   | Suite de testes existente continua passando (zero regressão funcional)                    | ✓ PASS   | unit: 120/120 pass; integration: 67/67 pass                                                            |

**All 5 ROADMAP criteria PASS.**

---

## Required Artifacts

| Artifact                                          | Expected                                                | Status   | Details                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `src/mcp-server/index.js`                         | handleGates guard with sentinel string                  | ✓ PASS   | 298 LOC, contains sentinel + SEC-13-01 comment + early-return at lines 202-211               |
| `src/core/replays.js`                             | validateReplayId + assertPathInside + 3 callers guarded | ✓ PASS   | 112 LOC, 2 helpers + 5 validateReplayId calls (def + 4 use sites)                              |
| `.github/workflows/publish.yml`                   | strict npm ci + 3 new gates                             | ✓ PASS   | strict `npm ci` at line 37; Tests (unit/integration) + Audit inserted between Smoke + Publish  |
| `.github/workflows/ci.yml`                        | strict npm ci in smoke job                              | ✓ PASS   | strict `npm ci` at line 118; line 73 (pack setup) intact                                       |
| `test/unit/mcp-gates-guard.test.js`               | regression test for SEC-13-01                           | ✓ PASS   | 79 LOC, runs as part of `node test/run.mjs test/unit`, assertion passes                        |
| `test/unit/replays-path-traversal.test.js`        | regression tests for SEC-13-02 (≥3 traversal cases)     | ✓ PASS   | 110 LOC, 4 tests covering loadReplay/annotateReplay/recordReplay + happy-path round-trip       |

---

## Key Link Verification

| From                                              | To                                              | Via                                              | Status   | Details                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| `src/mcp-server/index.js handleGates 'run'`       | early return with error object                  | guard inline antes de chamar runGate             | ✓ WIRED  | Lines 202-211: branch returns `{ error: '...' }` immediately; no runGate dispatch (0 matches)            |
| loadReplay/annotateReplay/recordReplay            | validateReplayId helper                          | throw early antes de path.join + readFile/writeFile | ✓ WIRED  | All 3 functions call validateReplayId(id) BEFORE fs operations (lines 92, 102) and BEFORE concat (lines 60-66) |
| publish.yml step Install                          | lockfile drift error                             | remoção do `\|\| npm install` fallback             | ✓ WIRED  | `run: npm ci` is now the sole behavior; failure on lockfile drift no longer silently masked              |
| publish.yml steps test+audit                      | publish.yml step Publish                         | ordem: test → integration → audit → publish     | ✓ WIRED  | awk verification confirms strict topological order in YAML                                                |

---

## Anti-Patterns Found

None — clean implementation. No TODO/FIXME/PLACEHOLDER markers in modified files. No empty implementations or stubs.

---

## Stable API Checks

| Behavior                                                          | Command                                              | Result                                                            | Status   |
| ----------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| CLI `kit gates run` surface preserved (CLI gates list still works) | `node bin/cli.js gates list`                          | exit 0; full table rendered (id, stage, mode, description columns) | ✓ PASS   |
| MCP server boots without import errors                            | `timeout 3 node bin/mcp.js < /dev/null`               | exit 0 (clean EOF on stdin close, no import-time crash)            | ✓ PASS   |
| MCP server module imports cleanly                                 | `node -e "import('./src/mcp-server/index.js').then(...)"` | `mcp-server-import:ok`                                            | ✓ PASS   |
| Replays module exports preserved                                  | `node -e "import('./src/core/replays.js').then(...)"`   | `loadReplay:function recordReplay:function annotateReplay:function` | ✓ PASS   |

---

## Suite Regression

| Suite                                  | Command                                | Result        | Status   |
| -------------------------------------- | -------------------------------------- | ------------- | -------- |
| Unit tests (includes new SEC-13 tests) | `node test/run.mjs test/unit`           | `tests 120 / pass 120 / fail 0` (duration 2.97s) | ✓ PASS   |
| Integration tests                      | `node test/run.mjs test/integration`    | `tests 67 / pass 67 / fail 0` (duration 8.51s)  | ✓ PASS   |

**SEC-13 tests in suite output:**
```
✔ SEC-13-01: gates.run via MCP returns stable error and never invokes runGate (7.8156ms)
✔ SEC-13-02: loadReplay rejects traversal id (11.1145ms)
✔ SEC-13-02: annotateReplay rejects traversal id (4.199ms)
✔ SEC-13-02: recordReplay rejects malicious slug components (8.4703ms)
✔ SEC-13-02: valid replayId continues to work (10.6755ms)
```

5 SEC-13 regression tests, all passing.

---

## Git Trail (Phase 79 Commits)

All expected commits present in `git log`:

| SHA        | Subject                                                                  | Type   |
| ---------- | ------------------------------------------------------------------------ | ------ |
| `584dc8f`  | fix(79-01): block runGate via MCP transport (SEC-13-01)                  | fix    |
| `e476c09`  | test(79-01): regression test for SEC-13-01 MCP gates.run guard           | test   |
| `d19d6ac`  | fix(79-02): SEC-13-02 replayId path traversal hardening                  | fix    |
| `e905a96`  | test(79-02): SEC-13-02 path traversal regression tests                   | test   |
| `b909e4c`  | fix(79-03): strict npm ci in publish + ci workflows (SEC-13-03)          | fix    |
| `b91fb8d`  | fix(79-03): add test + audit gates before npm publish (SEC-13-04)        | fix    |
| `39ad30f`  | docs(79-01): complete mcp-gates-guard plan                               | docs   |
| `ea256d6`  | docs(79-02): complete replay-id-validation plan                          | docs   |
| `559be52`  | docs(79-03): complete CI + Publish workflow hardening plan               | docs   |

3 fix + 2 test + 3 docs commits, atomic per task. Order matches parallel execution timeline (Wave 1: all 3 plans run concurrent, separate commits per task).

---

## Summary Verdict

**Status: PASSED**

All 4 REQ IDs (SEC-13-01, SEC-13-02, SEC-13-03, SEC-13-04) satisfied with code-level evidence. All 5 ROADMAP success criteria verified. Stable API preserved (CLI + MCP boot). Zero regression: 120/120 unit + 67/67 integration tests pass. Phase goal — closing the 4 CRITICAL/HIGH vulnerabilities identified by the meta-audit — fully achieved.

**Notes:**
- The audit gate in publish.yml is intentionally armed but currently fails baseline (1 HIGH `fast-uri` CVE via `@modelcontextprotocol/sdk@1.29.0` transitive). This is by design per Plan 79.03 acceptance criteria §3.4 and is escalated to v1.14 dep bump (concerns.md TOP-1). The gate existing is the success condition; closing the gate is subsequent work.
- Test extension was changed from `.mjs` (planned) to `.js` (executed) for both regression tests because `test/run.mjs` only walks `*.test.js`. Documented as auto-fix in Plan 79.01 SUMMARY (Deviation 1) and Plan 79.02 SUMMARY (decision note). Functional impact: zero — ESM works in `.js` because `package.json` sets `"type": "module"`.

---

_Verified: 2026-05-09T15:30:00Z_
_Verifier: Claude (verifier)_
