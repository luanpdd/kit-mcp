# Technology Stack

**Analysis Date:** 2026-05-09
**Project:** `@luanpdd/kit-mcp` v1.12.1 (MCP server distributing a personal kit of agents/commands/skills with cross-IDE sync)
**Manifest:** `package.json`
**Lockfile:** `package-lock.json` (lockfileVersion 3, 130 resolved packages)

## Languages

**Primary:**
- JavaScript (vanilla ESM) — exclusive language across `src/`, `bin/`, `test/`. No TypeScript, no JSX, no transpilation step.

**Auxiliary:**
- JSON — `package.json`, `package-lock.json`, `kit/registry.json`-style manifests inside `kit/` content.
- Markdown — `kit/` (agents/commands/skills content shipped to consumers), `gates/*.md` with embedded bash blocks executed by `gate-runner`, `CHANGELOG.md`, `README.md`.
- YAML — GitHub Actions workflows (`.github/workflows/{ci,publish}.yml`, `.github/dependabot.yml`).
- HTML — single asset `src/ui/static/index.html` served by the sidecar (no bundler, no client-side framework).

## Runtime

**Engine declared (`package.json` `engines`):**
- `node >=20`

**Engine actually exercised by the codebase:**
- Same — `>=20` is genuinely required, not pessimistic. Concrete reasons:
  - `chokidar@5` (the only direct dep that bumped its own floor) declares `node >=14.16` so it does not constrain.
  - `commander@14` declares `node >=20`.
  - `test/run.mjs:3-4` documents that Node 20 lacks `**/*` globs in `--test`, so the runner walks files manually — this is a Node-20-aware accommodation.
  - `--test-force-exit` and `--test-concurrency=1` flags require Node 20.10+ / 21.4+ / 22+.
- CI matrix in `.github/workflows/ci.yml:107` exercises Node `20`, `22`, `24` on Linux/macOS/Windows.

**Module system:**
- ESM only — `package.json:5` sets `"type": "module"`. Every file in `src/` and `bin/` uses `import`. No CJS interop file. Zero `require(...)` calls in source.
- Node-prefixed builtins are the convention: `import path from 'node:path'`, etc. (60+ occurrences across `src/`).

**Top-level await:**
- Used in `bin/ui.js:46-47` (`await import('../package.json', { with: { type: 'json' } })`) and `bin/ui.js:64` (`await server.start(...)`). JSON import attribute (`with: { type: 'json' }`) is Node 20.10+/22 syntax — aligned with the engine floor.

**Package manager:**
- npm (lockfile is `package-lock.json`, not `pnpm-lock.yaml` / `yarn.lock`).
- Lockfile present and committed.
- CI uses `npm ci || npm install` fallback (`.github/workflows/{ci,publish}.yml`).

**No build step.** Source ships as-is — `prepublishOnly` only runs tests.

## Direct Runtime Dependencies (6)

Resolved from `package-lock.json`. Budget gate at `.github/workflows/ci.yml:46-53` enforces a hard cap of **6 deps** (any seventh dep fails CI and requires an ADR).

| Package | Declared | Resolved | Purpose | Used in |
|---|---|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.0.0` | `1.29.0` | MCP server protocol — `Server`, `StdioServerTransport`, request schemas | `src/mcp-server/index.js:11-13` |
| `@inquirer/prompts` | `^8.4.2` | `8.4.2` | Interactive `select`/`confirm` for CLI doctor + reverse-sync flows | `src/core/ui.js:13` |
| `chokidar` | `^5.0.0` | `5.0.0` | File watcher for `kit watch` (live re-sync on kit changes) | `src/core/watch.js:14,36` |
| `commander` | `^14.0.3` | `14.0.3` | CLI argument parsing for `bin/cli.js` | `src/cli/index.js:15,53` |
| `open` | `^11.0.0` | `11.0.0` | Cross-platform browser launcher for `kit ui open` (lazy-loaded, optional) | `src/ui/browser.js:16` (dynamic `await import('open')` with try/catch) |
| `picocolors` | `^1.1.1` | `1.1.1` | ANSI colors in CLI output (chosen over chalk for size) | `src/core/ui.js:12` |

**No devDependencies declared.** `package.json:50-58` has only `dependencies`. Tests, audits, and the release pipeline rely entirely on Node's built-in test runner (`node --test`) and shell scripts in `.github/workflows/ci.yml`.

## Transitive Dependency Risk

**Total tree:** 130 packages (all marked production — no dev). Duplicate-name scan: **zero duplicates** in the tree.

**Heavy transitive surface comes almost entirely from one parent:** `@modelcontextprotocol/sdk@1.29.0` declares 16 dependencies, including the entire Express 5 ecosystem and Hono — none of which `kit-mcp` imports directly. They are loaded only when the SDK exercises HTTP transport features that `kit-mcp` does not use (it boots only `StdioServerTransport`).

| Transitive | Resolved | Pulled in by | Risk note |
|---|---|---|---|
| `express` | `5.2.1` | `@modelcontextprotocol/sdk`, `express-rate-limit` | Express 5 — Node 18+ only. Not used at runtime by kit-mcp (stdio transport). |
| `express-rate-limit` | `8.4.1` | `@modelcontextprotocol/sdk` | HTTP-transport feature of the SDK. Dead weight for stdio-only consumers. |
| `cors` | `2.8.6` | `@modelcontextprotocol/sdk` | Same — HTTP-only. |
| `body-parser` | `2.2.2` | (transitively via express 5) | Bundled with express 5. |
| `hono` | `4.12.16` | `@modelcontextprotocol/sdk`, `@hono/node-server` | Alternative HTTP framework the SDK can use. |
| `@hono/node-server` | `1.19.14` | `@modelcontextprotocol/sdk` | HTTP-only. |
| `jose` | `6.2.3` | `@modelcontextprotocol/sdk` | OAuth token signing — HTTP-transport auth. |
| `zod` | `4.4.2` | `@modelcontextprotocol/sdk`, `zod-to-json-schema` | Schema validation. SDK accepts `^3.25 || ^4.0`. |
| `zod-to-json-schema` | (present) | `@modelcontextprotocol/sdk` | Schema generation for tool descriptors. |
| `pkce-challenge` | `5.0.1` | `@modelcontextprotocol/sdk` | OAuth PKCE — HTTP-only. |
| `eventsource` | `3.0.7` | `@modelcontextprotocol/sdk` | SSE client for HTTP streaming transport. |
| `path-to-regexp` | `8.4.2` | (express 5) | Express 5's safer rewrite — no ReDoS. |
| `qs` | `6.15.1` | (express 5) | Querystring. SDK pins `6.14.1` via overrides; here resolves to `6.15.1` because the SDK's overrides only apply during its own install. |
| `ws` | (top-level installed but with no consumer) | — | **Smell:** `ws` appears in `node_modules/` with no listed consumer in the lockfile graph; almost certainly an orphan from an older install or hoisted from the SDK's `peerDependenciesMeta`. Worth a clean reinstall to confirm. |
| `ajv` + `ajv-formats` | (present) | `@modelcontextprotocol/sdk` | JSON Schema validator — used by SDK's tool input validation. |

**Transitive supply-chain controls:**
- `npm audit --omit=dev --audit-level=high` runs every push/PR (`.github/workflows/ci.yml:55-68`). Fails CI on any high or critical CVE in production deps.
- Dependabot weekly minor/patch grouping configured (`.github/dependabot.yml`) for both `npm` and `github-actions` ecosystems.

## Dev / Build Dependencies

**None declared.** `devDependencies` is omitted from `package.json` entirely. Everything that other projects would put in `devDependencies` is inlined:

| Concern | How it's done |
|---|---|
| Test runner | Node built-in `node --test` invoked by `test/run.mjs` (zero-dep walker, custom because Node 20 lacks `**/*` globs in `--test`) |
| Test assertions | Node built-in `node:assert` (no chai/expect) |
| Linting | None configured. No ESLint, no Prettier, no Biome. The few `// eslint-disable-next-line` comments in `src/ui/auto-spawn.js:49,52` are aspirational. |
| Type-checking | None. No `tsconfig.json`, no JSDoc-driven TS check. |
| Coverage | Not enforced. No nyc, no c8 config. |
| Bundler | None. Source ships verbatim. |
| Pre-commit hooks | None visible (no husky, no lefthook). |

This is a deliberate posture — keeping `node_modules/` lean and avoiding tooling churn — but it also means there is no static safety net beyond what each gate script enforces.

## Test Pipeline

**Scripts (`package.json:41-49`):**
```
npm test                  → node test/run.mjs test/unit
npm run test:integration  → node test/run.mjs test/integration
npm run test:all          → node test/run.mjs test
npm run smoke             → node bin/cli.js kit list-agents | head -5
prepublishOnly            → unit + integration (blocks publish on red)
```

**Test layout:**
- `test/unit/` — 12 files (`gates`, `kit`, `registry`, `reverse-sync`, `sync`, `ui-browser`, `ui-events`, `ui-lockfile`, `ui-port`, `ui-wrapper`, `ui`, `upgrade-check`).
- `test/integration/` — 7 files (`cli-roundtrip`, `cli-ui`, `ui-auto-spawn`, `ui-client`, `ui-hardening`, `ui-server`, `ui-static`).
- `test/fixtures/sample-kit/` — minimal kit used by tests.
- `test/run.mjs` — zero-dep walker invoking `node --test --test-force-exit --test-concurrency=1` (serialized to avoid port races on the `7100-7199` sidecar range).

## CI / Release Pipeline

**`.github/workflows/ci.yml`** — runs on push to `main` and on every PR. Two jobs:

1. **`audit` (Linux only):**
   - Stdout-discipline gate over `src/ui/` (REQ SEC-04) — fails CI if any `console.log` / `process.stdout.write` lands in sidecar code (would corrupt the MCP JSON-RPC frame channel).
   - Runtime-deps budget gate — counts `Object.keys(dependencies)` and fails if `> 6`.
   - `npm audit --omit=dev --audit-level=high` (REQ v1.6 SEC-04).
   - `npm pack --dry-run --json` validation — explicit allowlist of 10 v1.2 UI files that must be in the tarball (`bin/ui.js`, `src/ui/static/index.html`, etc.).

2. **`smoke` (matrix `[ubuntu, macos, windows] × [node 20, 22, 24]`):**
   - `npm test` + `npm run test:integration`.
   - CLI smoke: `kit list-agents`, `sync targets`, `gates list`, `install dry-run claude-code --via npx`.
   - v1.8 Supabase suite gates — extracts bash blocks from `gates/*.md` and runs them: `budget-description`, `no-personal-uuid`, `agent-no-recursive-dispatch`, `skill-must-include`. (`sync-idempotent` deferred as non-blocking.)
   - End-to-end sync round-trip — `sync install claude-code` → assert `.claude/agents/example-reviewer.md`, `.claude/framework/.kit-mcp-managed`, `CLAUDE.md`, `.claude/hooks/workflow-guard.js` etc. exist → `sync remove` → assert markered files are gone but user-authored files in framework/hooks dirs survive.
   - MCP server boot probe — spawns `node bin/mcp.js < /dev/null`, sleeps 1s, asserts process is alive or exited 0 (catches import-time crashes like the v0.4.0 `DEFAULT_KIT_ROOT` regression).

**`.github/workflows/publish.yml`** — triggered by tag push `v*`:
- Sanity check: `package.json` version must match the tag.
- Smoke test (subset of the matrix smokes).
- `npm publish --access public --provenance` using `NPM_TOKEN` secret.
- Auto-extracts release notes from `CHANGELOG.md` between `## [<version>]` headings (with the v1.5.2-era awk regex bug fix annotated inline) and creates a GitHub Release with `--latest`.
- Permissions: `contents: write` (for the release object) + `id-token: write` (for npm provenance attestation).

**No staging or canary publish channel.** Tag → npm `latest` is one push.

## Distribution / Tarball

**`package.json:13-21` `files` allowlist:** `bin/`, `src/`, `kit/`, `gates/`, `README.md`, `CHANGELOG.md`, `LICENSE`.

**`.npmignore`** (`.npmignore:1-25`) — defensive belt-and-braces against npm-default expansion. Excludes `.planning/`, `.claude/`, `.github/`, `test/`, `node_modules/`, `.npmrc`, `.eslintrc*`, `.prettierrc*`, `*.log`, `.DS_Store`, `.idea/`, `.vscode/`, `.ci-test/`, `.ci-safety/`, `docs/`.

**`npm pack --dry-run --json` measured (2026-05-09):**
- 380 files in tarball.
- Unpacked size: **~3.5 MB** (3495.8 KB).
- Tarball size: **~1.1 MB** (1099.5 KB).
- Top-level entries: `bin/`, `src/`, `kit/`, `gates/`, `CHANGELOG.md`, `LICENSE`, `README.md`, `package.json`.

**Source-only footprint (excluding `node_modules/`):**
- `src/` — 25 files, ~241 KB, ~4660 LOC of vanilla JS.
- `bin/` — 3 files, ~3 KB.
- `kit/` — 328 files, ~3.1 MB (the bulk of the tarball — markdown content for agents/commands/skills is what users are actually paying for).
- `gates/` — 20 files, ~58 KB.

`kit/` is **76 % of the tarball by file count and ~88 % by size** — the JS code is a thin loader/router around shipped markdown content.

## Bin Entrypoints vs Internal Modules

**Declared in `package.json:6-9` `bin`:**
- `kit-mcp` → `bin/mcp.js` — MCP server (stdio transport).
- `kit` → `bin/cli.js` — terminal mirror of the MCP tools.

**Not declared in `bin` but is an entrypoint:**
- `bin/ui.js` — sidecar HTTP server. Spawned indirectly via two paths:
  1. `kit ui start` (subcommand of `bin/cli.js`) — see `src/cli/index.js:639` "Helpers for kit ui".
  2. Auto-spawn from MCP tool handlers when `autoSpawn: true` — `src/ui/auto-spawn.js:19` resolves `path.resolve(HERE, '..', '..', 'bin', 'ui.js')` and `child_process.spawn`s it detached.

  This is intentional — exposing it as a standalone bin would let users start it without lockfile coordination. It is still part of the published tarball (CI gate `.github/workflows/ci.yml:70-99` enforces its presence).

**Bin entrypoints are tiny shims:**
- `bin/mcp.js` (6 lines) — `import { startStdio } from '../src/mcp-server/index.js'` + crash-to-stderr guard.
- `bin/cli.js` (3 lines) — `import '../src/cli/index.js'`.
- `bin/ui.js` (75 lines) — argv parsing + version reading + `createServer().start()` (the only bin with non-trivial logic, because it has `--port`/`--idle-ms` flags).

**Internal layout (`src/`):**

| Subtree | Files | Role |
|---|---|---|
| `src/mcp-server/` | `index.js`, `install.js` | MCP server boot, tool registry, action dispatch |
| `src/cli/` | `index.js`, `render.js`, `upgrade-check.js` | CLI commands, human-readable rendering, upgrade probe |
| `src/core/` | 11 files: `failures`, `gate-runner`, `gates`, `kit`, `reflect`, `registry`, `replays`, `reverse-sync`, `sync`, `ui`, `watch` | Domain logic shared between MCP server and CLI |
| `src/ui/` | 9 files + `static/index.html`: `auto-spawn`, `browser`, `client`, `events`, `lockfile`, `port`, `server`, `wrapper` | Sidecar HTTP server, lockfile-coordinated single-instance enforcement, browser opener, event bus |

**Internal-only (never imported by `bin/`):** everything in `src/core/` and most of `src/ui/`. They are only reachable through one of the three bin entrypoints.

## Platform Requirements

**Development:**
- Node `>=20`.
- npm (lockfile is npm-shaped).
- POSIX-or-Windows shell — tests and CLI smokes work on both (CI runs all three OSes).

**Runtime (consumer install):**
- Node `>=20` (engine field is enforced by npm with default `engine-strict=true` on most installs).
- For sidecar: a free TCP port in the `7100-7199` range on localhost (`src/ui/port.js:5,63`).
- For `kit ui open`: a usable browser. Headless detection in `src/ui/browser.js:26-41` covers `CI`, `KIT_MCP_NO_OPEN`, `TERM=dumb`, Linux without `DISPLAY`/`WAYLAND_DISPLAY` (with WSL exception via `WSL_DISTRO_NAME`/`WSLENV`), and SSH-without-display.

**Production:** Same as runtime — there is no separate "production" deployment target. The package is consumed by IDE-hosted MCP runtimes (Claude Code, Cursor, Codex, etc.) that spawn `kit-mcp` as a subprocess.

## Smells & Observations

1. **`open@11` is a soft dependency in disguise.** `src/ui/browser.js:13-22` dynamically imports it inside try/catch and degrades gracefully. It is in `dependencies` (not `optionalDependencies`), so consumers always pay the install cost even when running headless. Could be moved to `optionalDependencies` to shave a few KB and a transitive (`default-browser`, `is-wsl`, `is-docker`, `run-applescript`, `wsl-utils` are all installed because of it).

2. **Orphan `ws` in `node_modules/`.** The lockfile graph shows no consumer of `ws`; it is the SDK's `devDependency` only. Its presence on disk is likely a stale-install artifact rather than a true graph entry — re-running `npm ci` from a clean state would either remove it or confirm a hidden consumer.

3. **Express 5 + Hono + cors + jose + pkce-challenge are all carried for HTTP-transport features of `@modelcontextprotocol/sdk` that `kit-mcp` never invokes.** The runtime cost is negligible (lazy require), but the install footprint and CVE surface scale with this dead weight. Tracked-but-unfixable upstream — the SDK does not factor its HTTP transport into a separate subpath import.

4. **`devDependencies: {}` is an aesthetic choice with a real downside.** A linter/formatter as a devDep would not affect consumers (npm does not install devDeps for transitive installs) but would let CI catch many of the things the bespoke `audit` job grep-checks for.

5. **`bin/ui.js` is a published bin-entrypoint without a `bin` field entry.** Documented as intentional in `bin/ui.js:2-9` ("usually invoked via `kit ui start`"), but a stray `npx @luanpdd/kit-mcp` user discovering it in the tarball will not be able to launch it as a CLI — they must `node ./node_modules/@luanpdd/kit-mcp/bin/ui.js`. Acceptable, but worth documenting in README if not already.

6. **No top-level `engineStrict` and no `.nvmrc`.** Engine `>=20` is declared but not pinned, so contributors can land code targeting a Node version higher than the floor without obvious local failure. CI matrix includes Node 20, so regressions surface there — but a `.nvmrc` would give faster local feedback.

7. **`prepublishOnly` runs the test suites but not the audit gates.** The runtime-deps budget, stdout discipline, and tarball-allowlist checks live only in `.github/workflows/ci.yml`. A direct `npm publish` from a developer machine bypasses them. Workflow gating (only the publish workflow on tag push has registry credentials) makes this less risky than it sounds, but the single audit-vs-publish split is worth knowing.

8. **`@inquirer/prompts@8` brings ~17 sub-packages** (`@inquirer/{checkbox,confirm,core,editor,expand,figures,input,number,password,rawlist,search,select,type}`, `external-editor`, `chardet`, `iconv-lite`, `mute-stream`, `signal-exit`, `cli-width`). Only `select` and `confirm` are used (`src/core/ui.js:13`). The split-package design of the inquirer ecosystem makes `@inquirer/select` + `@inquirer/confirm` a viable trim — would shave ~12 sub-packages.

---

*Stack analysis: 2026-05-09*
