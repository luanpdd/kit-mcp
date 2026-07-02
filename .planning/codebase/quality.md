# Code Quality Audit — kit-mcp v1.12.1

**Analysis Date:** 2026-05-09
**Focus:** quality
**Repo:** `D:\projetos\opensource\mcp`
**Scope:** `src/`, `bin/`, `kit/hooks/`, `test/`, CI, conventions

---

## Executive Snapshot

| Dimension                | Verdict           | Evidence                                                                  |
|--------------------------|-------------------|---------------------------------------------------------------------------|
| Source LOC               | 4,636             | 24 files in `src/` (largest `src/cli/index.js` 697 LOC)                   |
| Test LOC                 | 2,331             | 21 test files (12 unit + 7 integration + `run.mjs`)                       |
| Test/Source ratio        | **0.50**          | Reasonable for content-heavy MCP, but skewed toward `src/ui/`             |
| Type safety              | **None**          | 0 `@ts-check`, 0 JSDoc `@param/@returns/@typedef` in `src/`               |
| Linter                   | **None**          | No `.eslintrc`, no `.prettierrc`, no script in `package.json`             |
| Formatter                | **None**          | No `.prettierrc`; whitespace conventions are author-enforced              |
| `console.*` in `src/`    | **0**             | Strict stderr discipline (CI gate REQ SEC-04)                             |
| TODO/FIXME in `src/`     | **0**             | Clean (or driven by `decisions.md` instead)                               |
| try/catch                | 87 / 36 in `src/` | High `try` count vs `catch` indicates many `try { ... } catch {}` no-ops  |
| Hooks tested             | **0 of 7 files**  | 958 LOC in `kit/hooks/`, no tests anywhere — direct cause of v1.12.1 bug  |

---

## 1. Test Coverage

### Inventory

```
test/unit/             — 13 files (1,235 LOC)
test/integration/      —  7 files (1,049 LOC)
test/fixtures/         — 1 sample-kit hook (2 LOC)
test/run.mjs           — 48 LOC cross-platform runner
```

### Source-to-test mapping

| `src/` module                       | Has test?  | File                                         |
|-------------------------------------|------------|----------------------------------------------|
| `src/core/kit.js` (216)             | yes        | `test/unit/kit.test.js`                      |
| `src/core/sync.js` (290)            | yes        | `test/unit/sync.test.js`                     |
| `src/core/reverse-sync.js` (355)    | yes        | `test/unit/reverse-sync.test.js`             |
| `src/core/registry.js` (112)        | yes        | `test/unit/registry.test.js`                 |
| `src/core/gates.js` (82)            | yes        | `test/unit/gates.test.js`                    |
| `src/core/gate-runner.js` (193)     | **NO**     | only smoke via gates.test                    |
| `src/core/reflect.js` (242)         | **NO**     | no direct tests                              |
| `src/core/failures.js` (153)        | **NO**     | no direct tests                              |
| `src/core/replays.js` (65)          | **NO**     | no direct tests                              |
| `src/core/watch.js` (95)            | **NO**     | no direct tests                              |
| `src/core/ui.js` (167)              | yes        | `test/unit/ui.test.js`                       |
| `src/cli/index.js` (697 — largest!) | partial    | only `cli-roundtrip.test.js` integration     |
| `src/cli/render.js` (187)           | **NO**     | no direct tests                              |
| `src/cli/upgrade-check.js` (135)    | yes        | `test/unit/upgrade-check.test.js`            |
| `src/mcp-server/index.js` (295)     | **NO**     | no protocol-level test                       |
| `src/mcp-server/install.js` (149)   | **NO**     | no direct tests                              |
| `src/ui/server.js` (454)            | yes        | `test/integration/ui-server.test.js`         |
| `src/ui/lockfile.js` (187)          | yes (deep) | `test/unit/ui-lockfile.test.js` (199 LOC)    |
| `src/ui/client.js` (115)            | yes        | `test/integration/ui-client.test.js`         |
| `src/ui/events.js` (65)             | yes (deep) | `test/unit/ui-events.test.js`                |
| `src/ui/wrapper.js` (129)           | yes        | `test/unit/ui-wrapper.test.js`               |
| `src/ui/auto-spawn.js` (108)        | yes        | `test/integration/ui-auto-spawn.test.js`     |
| `src/ui/browser.js` (78)            | yes        | `test/unit/ui-browser.test.js`               |
| `src/ui/port.js` (67)               | yes        | `test/unit/ui-port.test.js`                  |
| `kit/hooks/*.js` (**958 LOC, 7 files**) | **NO** | **zero coverage — see §10**                  |

**Untested core LOC:** ~1,529 LOC across `gate-runner`, `reflect`, `failures`, `replays`, `watch`, `render`, `mcp-server/index`, `mcp-server/install`. That is roughly **33% of `src/`** with no direct unit tests; integration + smoke catch some, but unit-level invariants are not pinned.

### Test type breakdown

- **Unit (13 files, 1,235 LOC)** — pure module tests, mostly pure data + small fs sandboxes (`fs.mkdtempSync`).
- **Integration (7 files, 1,049 LOC)** — spin up real `http.Server` on the 7100-7199 range, exchange JSON-RPC frames, exercise CLI roundtrips (`mkdir .ci-test; node bin/cli.js sync install ...`).
- **No e2e against a real IDE.** The CI smoke job (`.github/workflows/ci.yml`) runs `node bin/cli.js sync install claude-code --project-root .ci-test` which is the closest thing.
- **Concurrency:** runner enforces `--test-concurrency=1` (`test/run.mjs:45`) — safe but slow; race regressions in production code are not naturally surfaced.

### Mocking strategy

- **No mocking framework** (no `sinon`, `jest`, `nock`, `node:test` mock module).
- Strategy is **real-fs / real-http with sandbox dirs** (`os.tmpdir()` + `fs.mkdtempSync`).
- The single hit on the literal "mock" is `test/integration/ui-static.test.js:106` — and that string appears inside the test *name* describing a UI panel, not as a mocking call.
- This is fine for `lockfile`/`port`/`server`, but it leaves no good way to test:
  - hooks that call out to remote URLs (`check-update.js` hits `registry.npmjs.org`);
  - the `process.exit` ordering bug fixed in v1.12.1;
  - timing/ordering of TCP flush.

---

## 2. Type Safety

**Vanilla ESM JavaScript with zero type discipline.**

- `package.json` has `"type": "module"` and `"engines": {"node": ">=20"}`. No `tsconfig.json`. No `jsconfig.json`.
- **Zero files** with `// @ts-check` (`grep -r "@ts-check" src/` returns nothing).
- **Zero JSDoc tag annotations** (`@param`, `@returns`, `@typedef`) in `src/`. Some files have rich English comments (e.g. `src/ui/server.js:1-17`) but no machine-checkable types.
- **Public API is implicit.** The MCP tool inputs are typed via JSON Schema in `src/mcp-server/index.js:32-100`, which is the *only* enforced type boundary in the project — and the server-side validation simply trusts SDK schema enforcement.
- **CLI args** are parsed by `commander` (typed via library). The sidecar `bin/ui.js` parses its own args by hand (`bin/ui.js:14-25`) using `Number(argv[i+1])` with no validation that the result is finite — `--port abc` produces `NaN`, propagated.

**Risk:** Refactors in `src/core/` or `src/ui/` (large files like `cli/index.js` 697 LOC, `ui/server.js` 454 LOC) cannot be checked by tooling — only by tests, which are uneven (see §1).

---

## 3. Error Handling

### Patterns observed

| Pattern                          | Location                            | Count           |
|----------------------------------|-------------------------------------|-----------------|
| `try { ... } catch { /* noop */ }` (no-op silent swallow) | mostly `src/ui/lockfile.js`, `src/cli/index.js` | several dozen |
| `try { ... } catch (err) { ... process.stderr.write(...); }` | `bin/mcp.js:3-6`, `bin/ui.js:67-73` | rare           |
| `throw new Error(...)` / `throw new TypeError(...)`         | only **14 throws across 11 files** | very low        |
| Returning `null`/`undefined` to signal failure              | `src/ui/lockfile.js:readLock`, `src/ui/client.js:resolvePort` | dominant pattern |
| Result-object `{ sent: false, reason: '...' }`              | `src/ui/client.js:publish`           | for fire-and-forget paths |

### Strengths

- `src/ui/server.js:53-56` `logErr()` enforces stderr-only logging.
- `src/ui/client.js:44-103` returns explicit `{ sent: false, reason }` so callers can decide; this is the right shape for fire-and-forget semantics.
- `src/ui/events.js:39-63` `validateEvent()` returns `Error` instead of throwing — chosen so `POST /publish` can 400 cleanly.

### Weaknesses

- 87 `try` openings vs only 36 `catch (err)` bindings (51 anonymous catches). Many silent-swallow blocks like `try { ... } catch {}` and `try { ... } catch { /* noop */ }` exist in:
  - `src/ui/lockfile.js` (8 try / 6 catch)
  - `src/cli/index.js` (17 try / 12 catch)
  - `src/core/sync.js` (6 try / 0 named catch)
- Silent-catch is appropriate for fire-and-forget I/O, but masks bugs in higher-level code paths. **No central error-classification module**; each file decides what to swallow.
- `bin/cli.js:1-2` is a 2-line shim with no top-level `try`/`process.on('unhandledRejection')`. If `src/cli/index.js` throws synchronously at import time, the user sees a raw stack.

---

## 4. Logging

- **No logger library.** Pure `process.stderr.write(...)` calls (43 occurrences across 4 files in `src/`: `cli/index.js:27`, `ui/browser.js:5`, `ui/server.js:1`, `core/ui.js:10`).
- **Strict no-stdout policy in `src/ui/`** — enforced by **CI gate** (`.github/workflows/ci.yml:18-38`). This is excellent: stdout is reserved for MCP JSON-RPC frames and CLI output; sidecar logs would otherwise corrupt the channel. CI greps `console.log\|process.stdout.write` under `src/ui/` and fails.
- **Structured logging:** none. No JSON log lines, no levels, no correlation IDs. Each call site stringifies ad-hoc:
  - `src/ui/server.js:55` does `args.map(a => typeof a === 'string' ? a : JSON.stringify(a))` — single JSON-ish blob, but no schema.
- **Hooks log to file when `KIT_MCP_HOOK_DEBUG=1`** (`kit/hooks/sidecar-tool-publisher.js:119-125`) — appended to `os.tmpdir()/kit-mcp-hook.log`. This is the only file-based logging in the repo.

**Verdict:** logging is *disciplined* (channel separation respected) but *primitive* (no levels, no structure). Acceptable for a CLI/sidecar tool; would not scale if the project grew a long-running daemon component.

---

## 5. Linting & Formatting

- **No ESLint config** at the project root (only `node_modules/*/.eslintrc` from dependencies).
- **No Prettier config** at the project root (`node_modules/zod-to-json-schema/.prettierrc.json` is the only hit).
- **No `lint`, `format`, or `check` scripts** in `package.json:41-49` — only `start`, `cli`, `smoke`, `test`, `test:integration`, `test:all`, `prepublishOnly`.
- **CI does not lint.** `.github/workflows/ci.yml` audits stdout discipline + dep budget + npm-audit + npm-pack-shape, but never runs ESLint.

This is consistent with the project's "vanilla, minimal-dep" philosophy (runtime dep budget = 6, enforced in CI), but it means **style is enforced socially / by review, not mechanically.** Reading 4,636 LOC, the style is internally consistent (camelCase, 2-space indent, single quotes, trailing comma rare, top-of-file file-purpose comments) — but a single PR could drift it.

---

## 6. Code Smells

### File size

| File                                       | LOC  | Smell?            |
|--------------------------------------------|------|-------------------|
| `src/cli/index.js`                         | **697** | borderline — 5 commands inline; could split per command         |
| `src/ui/server.js`                         | 454  | acceptable — single SRP (HTTP + SSE)                              |
| `src/core/reverse-sync.js`                 | 355  | acceptable — single concern                                       |
| `src/mcp-server/index.js`                  | 295  | acceptable — tool registry + dispatch                             |
| `src/core/sync.js`                         | 290  | acceptable                                                        |
| Everything else `< 250`                    |      | OK                                                                |

`src/cli/index.js` is the only file in the >500-LOC danger zone, and it's pure CLI glue. Function length within is small (most subcommand handlers are < 30 lines).

### Magic numbers

Tracked via constants where it counts:

- `src/ui/server.js:30-36` — `HEARTBEAT_INTERVAL_MS = 15_000`, `RING_BUFFER_SIZE = 200`, `MAX_SSE_SUBSCRIBERS = 32`, `DEFAULT_IDLE_MS = 0` — well named.
- `src/ui/events.js:19` — `MAX_PAYLOAD_BYTES = 64 * 1024` — named.
- `src/ui/client.js:13` — `PORT_CACHE_TTL_MS = 5_000` — named.
- `src/ui/server.js:95` — `readBody(req, maxBytes = 64 * 1024)` — duplicated, should reuse `MAX_PAYLOAD_BYTES`.
- `kit/hooks/sidecar-tool-publisher.js:39,184` — `1500` and `800` ms timeouts as inline literals; **not extracted to constants**, easy to drift.
- `src/ui/client.js:44` — `timeoutMs = 1500` default; same value lives in 4 places (`hook 1500`, `client 1500`, server `2000`, port-scan implicit).

### Defensive programming

- `bin/ui.js:14-25` parses `--port` and `--idle-ms` with `Number(...)`; **no validation** that the value is a finite integer. `kit ui start --port abc` would set `args.port = NaN` and silently auto-pick instead.
- `kit/hooks/sidecar-tool-publisher.js:127-137` `summarizeArgs()` filters by type and truncates strings — good.
- `src/ui/server.js:60-65` `isHostAllowed()` and `:69-74` `isOriginAllowed()` are well-formed allow-lists. CSP at `src/ui/server.js:45-51`.
- **MCP input validation** is delegated entirely to the SDK's schema enforcement (`src/mcp-server/index.js:32-100`). Valid as long as the SDK validates — and it does. No belt-and-suspenders re-check inside handlers.

### Comments

537 single-line/block comments across 24 source files = **~11.6%** comment density. Spread is healthy:
- High in `src/ui/server.js` (44), `src/core/sync.js` (35), `src/core/reverse-sync.js` (32), `src/cli/index.js` (49) — all of these warrant it (HTTP server invariants, sync lifecycle, etc.).
- Each file opens with a header block describing its responsibilities — see `src/ui/events.js:1-3`, `src/ui/server.js:1-17`. Excellent practice.
- Zero `TODO|FIXME|HACK|XXX` markers (`grep -rn "TODO\|FIXME\|HACK\|XXX" src/` returns 0). Open work lives in `.planning/decisions.md` instead — appropriate for the framework conventions.

---

## 7. Defensive Programming in Entry Points

### `bin/mcp.js` (6 LOC)

Top-level catch on `startStdio()` — good. Logs to stderr, exits 1.

### `bin/ui.js` (74 LOC)

- Hand-rolled arg parser (no validation of numeric inputs — see §6).
- Error path at `:67-73` distinguishes `ELIVE` (code 2) from generic startup error (code 1) — good signaling.
- Reads `package.json` via dynamic import with `with: { type: 'json' }` and try/catch fallback (`bin/ui.js:44-50`).

### `bin/cli.js` (2 LOC)

`import '../src/cli/index.js';` — just a shim. Relies on `commander` for arg validation. **No process-level error guards** — if `index.js` synchronously throws on import, the user gets an unfiltered stack.

### MCP server input

JSON-Schema-validated by the SDK (`src/mcp-server/index.js:28-200`). No further string sanitation in handlers — appropriate, since IDs / names from the schema are constrained `enum`s and `string`s.

### Hook stdin handling

`kit/hooks/sidecar-tool-publisher.js:38-82`:
- 1.5s `setTimeout` to short-circuit if stdin never closes — good.
- `try { JSON.parse(input) } catch (err) { stderr; exit 0 }` — good (soft-fail philosophy is correct for hooks).
- **Never validates the shape of `data.tool_name`, `data.project_root`, or `data.tool_input`** before publishing — relies on the sidecar's `validateEvent()` to reject malformed payloads. Acceptable because validation lives downstream.

---

## 8. Reaction to Incident v1.12.1 (Race Condition)

### What broke

Commit `56b327f` ("fix(sidecar): hook race condition — process.exit before TCP flush dropped events"):

> publish() was fire-and-forget; process.exit(0) called immediately after killed the TCP socket before kernel flushed the POST body to the sidecar. … publish() now returns Promise that resolves on response.end / response.close / req.error / setTimeout.

The bug lived in **`kit/hooks/sidecar-tool-publisher.js`** — the PostToolUse hook running on every tool invocation. Symptom: hook spawns, parses stdin, sidecar `eventsTotal` stays flat. Silent data loss.

### Coverage parity check

| Element                                     | Tested?   |
|---------------------------------------------|-----------|
| `src/ui/client.js:publish()` (server-side analog with same flush concern) | yes (`test/integration/ui-client.test.js`) — but **no test asserts ordering of `process.exit` vs `req.end()`** |
| `kit/hooks/sidecar-tool-publisher.js`       | **NO** — no test file references this hook by name; no fixture wraps it |
| `kit/hooks/*.js` (all 7 files, 958 LOC)     | **NO** — only `test/fixtures/sample-kit/hooks/sample-hook.js` (2 LOC stub) is referenced, and never executed |
| The fix commit (`56b327f`)                  | **No regression test added.** `git show 56b327f --stat` shows 1 file changed, +28 -22 LOC, **zero test files touched.** |

### Diagnosis

The hook is the **hottest** code path in the entire project: it runs on every Claude Code tool invocation across every IDE that wires it in. Yet:

1. Hooks have **zero unit tests.**
2. The fix introduced no regression test — relying on manual "verified eventsTotal monotonic increase" per the commit message.
3. The integration tests in `test/integration/ui-client.test.js` exercise `src/ui/client.js`'s `publish()` (which has the same fire-and-forget shape and was likely the conceptual ancestor of the hook code), but **no test exercises the `publish().then(() => process.exit(0))` pattern** — there is no test that spins up a sidecar, fires a hook process, kills it after publish resolves, and asserts that the sidecar received the event.

The race condition's root cause is **direct evidence that hot-path code is shipped without tests.** The bug shipped in `hook-version 1.6.0` and lived undetected until manual smoke testing caught it. Without a test, the same class of bug (close-before-drain on any hook calling out) can recur in `kit/hooks/check-update.js`, `kit/hooks/post-apply-migration.js`, etc.

---

## 9. Strengths Worth Keeping

- Clean separation of concerns (`src/core/` data, `src/cli/` glue, `src/mcp-server/` protocol, `src/ui/` sidecar).
- Strong CI invariants: stdout discipline, runtime-deps budget (6/6), `npm audit --omit=dev`, `npm pack` shape check.
- Cross-platform test runner (`test/run.mjs`) with `--test-force-exit` and `--test-concurrency=1` to dodge port races.
- Every source file has a header comment explaining its role.
- Security-conscious sidecar: 127.0.0.1 binding, Host header allow-list, Origin check, CSP, request body cap, payload size cap, max SSE subscribers cap.

---

## 10. Top 5 Quality-Gap Risks (ranked by impact)

### 1. Hooks have ZERO test coverage (highest impact)

**958 LOC** across `kit/hooks/{check-update,context-monitor,post-apply-migration,prompt-guard,sidecar-tool-publisher,statusline,workflow-guard}.js` with zero tests. Hooks run on **every tool invocation** in every consuming IDE. The v1.12.1 race condition is the **direct, observable consequence** of this gap — and it's the second hook bug pattern recently (lockfile-mismatch handling at `sidecar-tool-publisher.js:84-117` was added defensively, suggesting earlier silent failures). **Fix path:** create `test/unit/hooks/` with a harness that spawns each hook script as a child process, feeds stdin, asserts exit code + sidecar reception via a fake HTTP server.

### 2. No regression test for the v1.12.1 race itself

Even after the fix, there is **no test that the fix stays fixed.** `process.exit` ordering is invisible to all current tests. If a future refactor reverts to fire-and-forget (e.g. someone "optimizes" `publish().then(...)` to `publish(); process.exit(0)`), CI would not catch it. **Fix path:** add an integration test that runs `node kit/hooks/sidecar-tool-publisher.js` as a child, pipes a synthetic envelope through stdin, and asserts the test sidecar received the `tool_invocation` event before child-process exit. Marginal cost, high regression value.

### 3. No type discipline (no `@ts-check`, no JSDoc types)

4,636 LOC of vanilla JS with no type checker. The largest file (`src/cli/index.js` 697 LOC) wires together 17+ imports from `src/core/`, `src/ui/`, `src/mcp-server/` — refactor pressure is highest exactly where there's no safety net. **Fix path:** add `// @ts-check` + JSDoc `@typedef` to `src/ui/events.js` (smallest, most-imported), then `src/ui/lockfile.js`, then `src/core/sync.js`. Incremental adoption; no build-system change required (Node 20 understands JSDoc types via tsserver). Estimated ROI: catches `null`/`undefined` mismatches at the seam between `lockfile.readLock()` (returns `Lock | null`) and `client.resolvePort()` (assumes shape).

### 4. No linter/formatter — style is reviewer-enforced

Zero `.eslintrc`, zero `.prettierrc`, zero `lint` script, zero CI lint step. With 7 hook files + 24 source files + 21 test files + ~80 `kit/{agents,commands,skills}/*.md` files, social enforcement scales poorly. **Fix path:** add ESLint flat config (one file, zero deps if `eslint` is a devDependency — outside the **runtime** deps budget of 6). Two rules pay for themselves immediately: `no-unused-vars` and `no-floating-promises` (the latter would have flagged the v1.12.1 fire-and-forget bug). Note: dep budget gate (`.github/workflows/ci.yml:42-53`) reads `dependencies` only, so adding to `devDependencies` is unblocked.

### 5. Missing `parseInt`/`Number()` validation in `bin/ui.js`

`bin/ui.js:14-25` parses `--port` and `--idle-ms` via `Number(argv[i+1])` with no `Number.isFinite` guard. `kit ui start --port abc` produces `NaN`, propagates to `findFreePortOrThrow`, falls back to auto-pick — silent and confusing. Compare to `src/ui/events.js:46` which uses `Number.isFinite(value.ts)` correctly. **Fix path:** 4-line guard in `parseArgs`, plus a unit test.

### Bonus (#6, lower impact but trivial): CHANGELOG drift

`CHANGELOG.md` at line 9 jumps from `## [1.10.0] - 2026-05-07` straight to `## [1.8.1] - 2026-05-06` — there are **no entries** for v1.11.0, v1.12.0, or v1.12.1, despite all three being in `git log` and `package.json` showing `1.12.1`. The v1.12.1 publish workflow extracts release notes from CHANGELOG by version pattern (`.github/workflows/publish.yml:60-79`) — this means recent GitHub Releases were created with **fallback "Release v1.12.1." notes only**, not the proper changelog body. **Fix path:** backfill three entries; add a CI gate to `.github/workflows/ci.yml` that fails when `package.json` version is missing from `CHANGELOG.md`.

---

## Summary (≤ 250 words)

kit-mcp v1.12.1 is **disciplined-but-untyped vanilla ESM**. 4,636 source LOC against 2,331 test LOC = 0.50 ratio, but coverage is **uneven**: `src/ui/` and `src/core/{kit,sync,reverse-sync}` are well-covered, while `src/core/{reflect,failures,replays,watch,gate-runner}` (~1,000 LOC) and the 295-LOC `src/mcp-server/index.js` lack direct unit tests. **Hooks (`kit/hooks/`, 958 LOC, 7 files) have zero tests.** This is the single biggest gap.

Type safety is **absent**: no `@ts-check`, no JSDoc tags, no `tsconfig`. Logging is **disciplined** (stderr-only in `src/ui/`, enforced by a CI gate) but **primitive** (no logger, no levels). Error handling is split between explicit result objects (`{sent, reason}` in `src/ui/client.js`) and silent `try{}catch{}` swallow (51 anonymous catches across `src/`). No linter, no formatter, no CI lint step — style is socially enforced. Defensive programming is solid at MCP/HTTP boundaries (JSON Schema, host/origin allow-lists, body caps) but weak in `bin/ui.js` (no `Number.isFinite` guard).

The **v1.12.1 race condition** is the canonical evidence: a fire-and-forget `process.exit(0)` killed the TCP socket before flush. The fix shipped without a regression test — the hot path remains tested only by humans. Top 5 quality gaps, by impact: (1) hooks have no tests; (2) no regression test for v1.12.1; (3) no type discipline on 4.6k LOC; (4) no linter/formatter; (5) missing input validation in `bin/ui.js`. CHANGELOG also drifted (1.11/1.12.x missing).

**Path:** `D:\projetos\opensource\mcp\.planning\codebase\quality.md`

---

*Quality audit: 2026-05-09*
