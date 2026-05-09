# VALIDATION.md — kit-mcp v1.12.1 Nyquist Coverage Audit

**Auditor:** nyquist-auditor
**Date:** 2026-05-09
**Scope:** Repository at `D:\projetos\opensource\mcp` (no traditional "phase" — adapted to release-robustness audit of npm-distributed MCP server)
**Mode:** PROPOSE (no tests written; gap inventory + prioritized backlog)

---

## 1. Existing test inventory

**21 test files · 182 test cases · runner: `node:test` via `test/run.mjs`**

### Unit (`test/unit/` — 14 files, 110 tests)

| File | Module under test | Tests |
|------|-------------------|-------|
| `sync.test.js` | `src/core/sync.js` — stub generation, mode flip, removeFrom | 8 |
| `reverse-sync.test.js` | `src/core/reverse-sync.js` — detect/apply, frontmatter merge | 9 |
| `registry.test.js` | `src/core/registry.js` — 8 IDE targets shape | 4 |
| `kit.test.js` | `src/core/kit.js` — listKit, resolveKitRoot | 14 |
| `gates.test.js` | `src/core/gates.js` + `gate-runner.js` — partial: list/get/parse, NO interactive run | 9 |
| `ui.test.js` + 7 ui-* | `src/ui/*` + `src/core/ui.js` — sidecar SSE/lockfile/port/wrapper | 66 |
| `upgrade-check.test.js` | `src/cli/upgrade-check.js` | 8 |

### Integration (`test/integration/` — 7 files, 67 tests)

| File | Coverage | Tests |
|------|----------|-------|
| `cli-roundtrip.test.js` | bin/cli.js — install/list/remove for **claude-code only** | 9 |
| `cli-ui.test.js` | bin/cli.js ui subcommands | 8 |
| `ui-server.test.js`, `ui-static.test.js`, `ui-client.test.js`, `ui-auto-spawn.test.js`, `ui-hardening.test.js` | UI sidecar HTTP/SSE end-to-end + CSP/security | 50 |

### CI matrix (`.github/workflows/ci.yml`)
- **smoke** — `node ∈ {20, 22, 24} × os ∈ {ubuntu, macos, windows}` = 9 cells
- Roundtrip smoke: **claude-code only** (lines 163-179) — 7 other IDEs untested in CI
- MCP server boot smoke: stdin EOF check, no protocol assertions

---

## 2. Critical GAPS — modules with **zero direct tests**

| Path | LOC | Risk |
|------|-----|------|
| `kit/hooks/sidecar-tool-publisher.js` | 189 | **CRITICAL** — v1.12.1 race condition fix shipped without regression test; lockfile scan + liveness check + HTTP publish is concurrent code |
| `kit/hooks/post-apply-migration.js` | 192 | HIGH — writes to `supabase/migrations/` + Obsidian vault + `git add` (3 side effects, no path-escape validation) |
| `kit/hooks/workflow-guard.js` | 95 | MEDIUM — advisory only, but injects context into Claude based on filtered patterns |
| `kit/hooks/prompt-guard.js` | 130+ | MEDIUM — injection-pattern matcher; false negatives = security blind spot |
| `kit/hooks/check-update.js` | 50+ | LOW — background fetch, soft-fail by design |
| `kit/hooks/context-monitor.js` | 100+ | LOW — read-only telemetry |
| `kit/hooks/statusline.js` | ~200 | LOW — display-only |
| `src/core/reflect.js` | 250+ | MEDIUM — calls Anthropic API, overwrites `kit/agents/*.md` |
| `src/core/failures.js` | 200+ | MEDIUM — aggregates filesystem state, feeds reflect |
| `src/core/replays.js` | 100+ | LOW — append-only JSON store |
| `src/core/watch.js` | 100+ | MEDIUM — chokidar watcher, debounce timing-sensitive |
| `src/core/gate-runner.js` | 194 | **HIGH** — spawns `bash` with arbitrary script extracted from markdown; no path/script sanitization tested |

### Cross-cutting gaps
1. **CI roundtrip — 7/8 IDEs untested** (cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae). Registry shape is asserted, but no installer roundtrip per IDE.
2. **CHANGELOG drift** — entries for v1.11/v1.12/v1.12.1 missing. No automated check.
3. **Reverse-sync path-escape** — `applyOne` writes to `c.kitPath` derived from filesystem walk; no test that a maliciously-named IDE file (e.g. `../../../etc/passwd.md`) is rejected.

---

## 3. Proposed prioritized tests (10)

| # | Name | File destination | Validates (1 sentence) | Complexity |
|---|------|------------------|------------------------|:---:|
| 1 | `sidecar-publisher race — concurrent stdin close + TCP flush does not drop event` | `test/integration/sidecar-publisher.test.js` | Spawns hook with stdin pipe + spy HTTP server; asserts payload arrives even when child exits within 5ms of `req.end()` (regression for v1.12.1 fix). | **L** |
| 2 | `sidecar-publisher — projectRoot path-mismatch falls back to liveness scan` | `test/integration/sidecar-publisher.test.js` | Writes 2 lockfiles (one stale PID, one live), sends hook envelope with mismatched cwd, asserts publish hits the live port only. | M |
| 3 | `gate-runner — script with shell metacharacters and quotes executes literally` | `test/unit/gate-runner-exec.test.js` | Markdown gate body contains `$(rm -rf /tmp)` and `; cat /etc/passwd`; runs `runGate({ yes: true })`; asserts captured stdout shows the literal string, no injection side-effect on cwd. | **L** |
| 4 | `gate-runner — non-blocking gate exit≠0 maps to warn, not block` | `test/unit/gate-runner-exec.test.js` | Already covered indirectly in `gates.test.js` parse path; this asserts `exitCode → verdict` matrix end-to-end including the temp `.sh` file is unlinked even on spawn error. | S |
| 5 | `reverse-sync — IDE file with path-escape characters does NOT write outside kitRoot` | `test/unit/reverse-sync-path-escape.test.js` | Plants `.claude/agents/..%2F..%2Fetc%2Fpasswd.md` (and a `<dotdot>` variant) in PROJECT; runs `applyReverse('overwrite')`; asserts nothing written above kitRoot, candidate marked rejected. | **L** |
| 6 | `cli-roundtrip — install + remove cycle is clean for ALL 8 IDEs` | `test/integration/cli-roundtrip-all-ides.test.js` | Parametrized over `Object.keys(TARGETS)`; for each: `sync install <ide>` → assert files present per registry spec → `sync remove <ide>` → assert only marker-stamped files removed (closes the "claude-code-only CI smoke" gap). | M |
| 7 | `post-apply-migration — migration name with `../` is sanitized before fs.writeFile` | `test/unit/post-apply-migration.test.js` | Sends envelope `{ tool_input: { name: '../../evil', query: 'SELECT 1' } }`; asserts mirrored file lands at `supabase/migrations/<ts>______evil.sql` (regex strip), never above projectRoot. | M |
| 8 | `workflow-guard — config disabled or missing → exits 0 without writing stdout` | `test/unit/workflow-guard.test.js` | Spawns hook with no `.planning/config.json`, then with `{ hooks: { workflow_guard: false } }`; asserts stdout is empty in both (false-positive guard against accidental advisory emission). | S |
| 9 | `prompt-guard — injection patterns detected on canonical attack strings` | `test/unit/prompt-guard.test.js` | Table-driven: 12 strings (`ignore previous instructions`, `[SYSTEM]`, `<<SYS>>`, etc.); for each, asserts hook stderr contains a flag and patterns regex matches; ensures the security blind-spot is covered if a pattern is removed. | S |
| 10 | `CHANGELOG — every git tag `v*` after v1.0 has a section in CHANGELOG.md` | `test/unit/changelog-drift.test.js` | Walks `git tag --list 'v*'`, parses CHANGELOG.md `## [x.y.z]` headers, asserts every tag (excluding pre-1.0) has a corresponding section (would have caught v1.11/v1.12/v1.12.1 absence). | S |

---

## 4. Coverage map (proposed → resolves)

| Gap | Resolved by tests |
|-----|-------------------|
| Hooks race conditions (v1.12.1 regression) | #1, #2 |
| Gate runner shell-injection bypass | #3, #4 |
| Reverse-sync path traversal | #5 |
| 7-of-8 IDEs uncovered in CI | #6 |
| Migration hook path traversal | #7 |
| Hook advisory false-positives | #8 |
| Prompt-injection blind spots | #9 |
| CHANGELOG drift | #10 |

---

## 5. Out of scope (explicit non-goals)

- **`kit/hooks/statusline.js`** — display-only, no side effects beyond stdout; defer.
- **`kit/hooks/context-monitor.js`** — read-only telemetry; defer.
- **`src/core/reflect.js`** — requires Anthropic API key + costs tokens; would need recorded fixture (test::request mock); separate workstream.
- **`src/core/replays.js`** — append-only JSON; trivial coverage; low ROI.
- **`src/core/watch.js`** — covered transitively via integration tests; race-test is L complexity for low risk; defer.
- **MCP protocol conformance** — current smoke (boot + EOF) is sufficient until a real protocol regression appears.

---

## 6. Status

**Coverage verdict:** PARTIAL — 21 test files give green-bar on syncing/UI/registry, but 8 of 12 critical-or-high modules have zero direct tests. The v1.12.1 hotfix shipped without regression coverage, which is precisely the failure mode this audit highlights.

**Next action:** prioritize tests #1, #3, #5 (CRITICAL/HIGH risk + dangerous code paths) for the next maintenance fase. Tests #6, #10 should be wired to CI to prevent recurrence of the same gap classes.
