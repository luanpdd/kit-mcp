# Architecture

**Analysis Date:** 2026-05-09
**Project:** `@luanpdd/kit-mcp` v1.12.1
**Repository root:** `D:\projetos\opensource\mcp`

## Pattern Overview

**Overall:** Three-binary fan-out around a shared `src/core/` business layer, with a fire-and-forget HTTP/SSE sidecar for observability. Pure ESM (`"type": "module"`), Node 20+, single npm package, single test runner. The MCP server (stdio JSON-RPC) and the CLI are *peer entrypoints* that invoke the same `src/core/` functions; the UI sidecar is a *third process* that other entrypoints publish to via localhost HTTP — never imported into them. Kit content (agents/commands/skills/framework/hooks) ships as Markdown bundled inside the package and is projected into 8 IDE layouts by `src/core/sync.js`.

**Key Characteristics:**
- **One business layer, three transports** — `src/core/` is consumed by `bin/mcp.js` (stdio JSON-RPC), `bin/cli.js` (commander/TTY) and indirectly by `bin/ui.js` (which only imports `src/ui/`). The MCP and CLI entrypoints are *thin*: they translate transport semantics into core function calls.
- **Sidecar is decoupled, not embedded** — the UI server lives in a separate Node process spawned on demand. Communication is one-way HTTP POST `/publish` (publishers) and one-way SSE on GET `/events` (browser). Publishers never block on the sidecar (`{sent:false, reason}` returned silently if it's down).
- **Lockfile-as-discovery** — every running sidecar writes `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)[0..16]>.lock` containing `{pid, port, version, startedAt}`. Publishers (CLI, MCP, hooks) read that lockfile to discover the port. This is the *only* coordination channel between processes.
- **Content-as-data** — the kit isn't compiled or bundled; agents/commands/skills are loose `.md` files under `kit/`, indexed at runtime via frontmatter parsing (`src/core/kit.js`).
- **Idempotent projection** — `kit sync` writes one of three flavors per file (reference stub / copy / symlink) and is safe to re-run.
- **Fire-and-forget telemetry** — every "tool" used by Claude Code can also notify the sidecar via the `kit/hooks/sidecar-tool-publisher.js` PostToolUse hook, but a missing/dead sidecar must never break the user's command.

## Three-Binary Topology

```
                                                                              
   ┌─────────────────────┐         ┌──────────────────────┐                  
   │  bin/mcp.js         │         │  bin/cli.js          │                  
   │  (MCP stdio JSON-   │         │  (commander CLI;     │                  
   │   RPC server, host  │         │   imports core/ +    │                  
   │   = Claude/Cursor/  │         │   ui/server for      │                  
   │   Codex…)           │         │   `kit ui start`)    │                  
   └─────────┬───────────┘         └─────────┬────────────┘                  
             │ imports src/core/             │ imports src/core/             
             │ + src/ui/auto-spawn           │ + src/ui/{client,lockfile,    
             │ + src/ui/wrapper              │            wrapper, browser}  
             ▼                               ▼                               
   ┌─────────────────────────────────────────────────────────┐               
   │  src/core/  (business logic — no HTTP, no transport)    │               
   │  kit.js · registry.js · sync.js · reverse-sync.js ·     │               
   │  watch.js · gates.js · gate-runner.js · failures.js ·   │               
   │  reflect.js · replays.js · ui.js (terminal helpers)     │               
   └─────────────────────────────────────────────────────────┘               
                       ▲                          ▲                          
                       │ optional                 │ optional                 
                       │ progress emit            │ progress emit            
                       │                          │                          
                       └────────┬─────────────────┘                          
                                │ HTTP POST /publish                         
                                │ (fire-and-forget, lockfile-discovered)     
                                ▼                                            
   ┌──────────────────────────────────────────────┐                          
   │  bin/ui.js → src/ui/server.js                │   GET /events (SSE)      
   │  HTTP server bound 127.0.0.1, port 7100-7199 │ ────────────► browser    
   │  routes: GET / · /events · /healthz ·        │   (static index.html)    
   │          /state · POST /publish · /shutdown  │                          
   │  ring buffer 200 events · max 32 SSE subs    │                          
   │  lockfile: tmpdir/kit-mcp-ui-<sha1>.lock     │                          
   └──────────────────────────────────────────────┘                          
                       ▲                                                     
                       │ POST /publish                                       
   ┌───────────────────┴─────────────────────────┐                           
   │  kit/hooks/sidecar-tool-publisher.js        │                           
   │  (Claude Code PostToolUse hook — out-of-    │                           
   │   process; reads stdin envelope; resolves   │                           
   │   port via lockfile + tmpdir scan; reports  │                           
   │   tool_invocation events.)                  │                           
   └─────────────────────────────────────────────┘                           
```

**Important:** the MCP server (`bin/mcp.js`) and the UI server (`bin/ui.js`) **never share a process**. The MCP server occupies stdio for JSON-RPC, so introducing any stdout from the UI in the same process would corrupt the MCP transport. This is why `bin/ui.js`'s entire codebase logs only to stderr, with a CI gate enforcing it (`src/ui/server.js` lines 16-17, 53-56).

## Layers

**Entry / transport layer (`bin/`):**
- Purpose: thin shims that bootstrap a transport and call into `src/`
- Location: `bin/mcp.js` (7 lines), `bin/cli.js` (3 lines), `bin/ui.js` (75 lines incl. arg parsing)
- Depends on: `src/mcp-server/index.js`, `src/cli/index.js`, `src/ui/server.js`
- Used by: `package.json#bin` exposes them as `kit-mcp` and `kit` commands

**MCP layer (`src/mcp-server/`):**
- Purpose: register six tools (`kit`, `sync`, `reverse-sync`, `gates`, `forensics`, `install`) in JSON-RPC ListTools/CallTool handlers; dispatch each `action` to a core function
- Location: `src/mcp-server/index.js`, `src/mcp-server/install.js`
- Pattern: every tool takes an `action: <enum>` discriminator; `withAutoSpawn(args, tool, run)` (lines 148-169) wraps long-running actions to optionally spawn a sidecar and emit progress events
- Depends on: `@modelcontextprotocol/sdk`, all of `src/core/`, `src/ui/auto-spawn.js`, `src/ui/wrapper.js`
- Used by: any IDE that registers kit-mcp as an MCP server — Claude Code via `~/.claude.json`, Cursor via `.cursor/mcp.json`, Codex via `~/.codex/config.toml`, etc.

**CLI layer (`src/cli/`):**
- Purpose: human-friendly mirror of every MCP tool, plus operations the MCP doesn't expose (watch mode, doctor, ui sub-commands)
- Location: `src/cli/index.js` (697 lines), `src/cli/render.js` (rendering for human output), `src/cli/upgrade-check.js`
- Pattern: commander-based subcommands. `--json` flag flips between human renderers and machine-readable JSON to stdout. `withSpinner` / `withProgress` wrap operations and auto-detect a running sidecar via `readLock(projectRoot)` to multiplex events to it.
- Depends on: all of `src/core/`, `src/ui/{server, client, lockfile, wrapper, browser}.js`
- Used by: terminal users, CI scripts, `npm scripts`

**UI sidecar layer (`src/ui/`):**
- Purpose: localhost HTTP + SSE event aggregator for live observability of long-running ops; published to from the CLI, MCP server, and Claude Code hook
- Location: `src/ui/server.js` (455 lines — the meat), `client.js`, `auto-spawn.js`, `lockfile.js`, `port.js`, `events.js`, `wrapper.js`, `browser.js`, `static/index.html`
- Module split:
  - **Server-side (only loaded by `bin/ui.js` or `kit ui start`)**: `server.js` (HTTP routing, SSE management, ring buffer, idle shutdown, signal handlers), `lockfile.js` (atomic single-instance lock with stale reclaim), `port.js` (free-port scanner 7100-7199)
  - **Publisher-side (loaded by CLI/MCP)**: `client.js` (POST /publish helper, port cache, fire-and-forget), `wrapper.js` (`wrapProgressForUi` — bolts publishing onto an existing onProgress callback + redacts paths via SEC-05), `events.js` (event schema, `validateEvent`, 7 frozen types)
  - **Spawn helper**: `auto-spawn.js` — child_process.spawn the UI binary detached, poll healthz until ready
- Depends on: only Node built-ins (`http`, `fs`, `crypto`, `os`, `events`, `child_process`)
- Used by: hot path of every CLI/MCP operation; Claude Code hooks via standalone HTTP

**Core business layer (`src/core/`):**
- Purpose: read kit content, project to IDEs, scan for reverse-sync candidates, run/list gates, collect & summarize failures
- Location: `src/core/{kit,registry,sync,reverse-sync,watch,gates,gate-runner,failures,reflect,replays,ui}.js`
- Pattern: each module is a focused namespace (kit = read; registry = static IDE specs; sync = write); functions accept `{projectRoot, kitRoot, mode, dryRun, onProgress}` consistently. `onProgress` is the *only* observability hook — wrapping it for sidecar publishing happens at the call site (CLI/MCP), never inside core. This is the explicit "Stable API of core stays untouched" rule (`src/ui/wrapper.js` lines 1-9).
- Depends on: only Node built-ins + `chokidar` (used only by `watch.js`); content-only modules are dependency-free
- Used by: CLI handlers, MCP tool handlers — both as their *only* business logic

**Kit content (`kit/`):**
- Purpose: the single source of truth for agents/commands/skills/framework/hooks. Bundled inside the published npm package (see `package.json#files`).
- Location: `kit/agents/*.md` (47 agents), `kit/commands/*.md` (~80 commands), `kit/skills/<name>/SKILL.md`, `kit/framework/{bin,references,templates,workflows}/`, `kit/hooks/*.js`, `kit/file-manifest.json`
- Pattern: every file has frontmatter (`---\n key: value \n ---`) + body; frontmatter parsed loosely by `src/core/kit.js` lines 151-187. `kit/file-manifest.json` is a hash manifest (sha-256 per file, version + timestamp) used by the framework's update tooling — currently `version: 1.4.0` and lists 200+ files.
- Resolution order (`src/core/kit.js` lines 25-29):
  1. Explicit `kitRoot` parameter
  2. `KIT_MCP_KIT_ROOT` env var
  3. Bundled `./kit` relative to the installed package
- Used by: `kit.js` (read), `sync.js` (project to IDE), `reverse-sync.js` (compare to detect outside edits)

**Gates content (`gates/`):**
- Purpose: 20 reusable workflow gate specs as Markdown with frontmatter (`id`, `stage`, `blocking`) + a `## Check` shell block
- Location: `gates/*.md`
- Loaded by: `src/core/gates.js`. Resolution: bundled `./gates` (line 23). Cached for 30s (PERF-01-style TTL, line 28-31).
- Executed by: `src/core/gate-runner.js` — confirms with the user before spawning bash; captures stdout/stderr; returns structured verdict.

## Data Flow

**Flow A — `kit sync install <target>` (CLI mode, with sidecar running):**
1. User runs `kit sync install claude-code`
2. `src/cli/index.js` line ~187 calls `withProgress(...)` — sets up commander spinner + `maybeWrapForUi`
3. `maybeWrapForUi` (lines 124-135) checks: opt-out flag? `KIT_MCP_NO_UI=1`? lockfile present? If sidecar is up, it wraps `onProgress` via `wrapProgressForUi` (`src/ui/wrapper.js`)
4. Wrapper emits `run.start` event immediately, then forwards every onProgress call as a `progress` event via `publish()` (HTTP POST to lockfile-discovered port)
5. Core `syncTo()` (`src/core/sync.js` lines 21-104) walks `kit/`, builds a write-plan of `ops`, executes them with `fs.writeFile`/`fs.copyFile`. Each op emits `onProgress({phase, current, total, label})`.
6. Wrapper publishes `run.end` on success or `error` event on throw
7. Sidecar's `bus.emit('event', evt)` dispatches to all connected SSE subscribers; ring buffer keeps the last 200 events for late-joining browsers (`/state` endpoint)

**Flow B — MCP `sync.install` with `autoSpawn: true` (no sidecar yet):**
1. Claude/Cursor calls the MCP tool with `{ action: 'install', target: 'cursor', autoSpawn: true }`
2. `handleSync` → `withAutoSpawn` (`src/mcp-server/index.js` lines 148-169)
3. `ensureSidecar` (`src/ui/auto-spawn.js`):
   - Reads lockfile → exists & healthz OK? Reuse.
   - Otherwise spawns `bin/ui.js --project-root <root>` detached with stdio=`['ignore','ignore','inherit']` (stdout closed so a buggy child can never poison the parent's MCP stdio channel)
   - Polls `lockfile + healthz` every 100 ms up to 5000 ms deadline
4. On success, `wrapProgressForUi(null, ctx)` is bolted in and the sync proceeds as in Flow A
5. Result returned to MCP host includes `_sidecar: { ready, port, spawned, opened }` so the host can deep-link the user to the URL

**Flow C — Claude Code tool invocation (PostToolUse hook):**
1. User invokes any tool in Claude Code (Bash, Edit, Write, etc.)
2. Claude Code spawns `node /abs/path/to/sidecar-tool-publisher.js`, piping a JSON envelope on stdin
3. Hook reads stdin (1500 ms timeout), JSON.parse, extracts `tool_name`, `project_root`, `tool_input`, `duration_ms`, `session_id`
4. Resolves sidecar port: tries lockfile path for the requested `project_root` first (lines 84-95). Falls back to scanning `os.tmpdir()` for any `kit-mcp-ui-*.lock` whose pid is alive (lines 100-117). This was added because `project_root` mismatches (case, trailing slash, parent vs child) used to drop events silently.
5. POST `/publish` with `{type: 'tool_invocation', payload: {tool, sessionId, durationMs, argsSummary, source: {ide, pid, hostname}}}`
6. Hook drains response body and only then `process.exit(0)` — the **race condition fixed in v1.12.1**: previously it called `process.exit` immediately after `req.end()`, before the kernel had flushed the TCP write, so events disappeared. Current code (lines 162-188) waits on `res.on('end', resolve)` AND `res.on('close', resolve)` before resolving the publish promise.

**Flow D — `kit sync watch` (long-lived process):**
1. User runs `kit sync watch claude-code cursor --debounce 300`
2. `src/cli/index.js` lines 203-227 calls `watchKit(['claude-code', 'cursor'], opts)` from `src/core/watch.js`
3. `chokidar.watch(kitRoot)` with `awaitWriteFinish` and `ignoreInitial: true`
4. On any add/change/unlink, debounced trigger (300 ms) calls `syncTo()` for each target, logs to stderr
5. SIGINT closes the chokidar instance gracefully

**State management:**
- **Sidecar process**: in-memory `EventEmitter bus` + `ring buffer` (200 events) + `subscribers Set` + `activeSockets Set` — all in `src/ui/server.js` `createServer()` closure (no module-level state). One process per project.
- **Publisher process (CLI/MCP)**: `portCache` Map (`src/ui/client.js` lines 12-14, 5s TTL) — every successful `publish()` caches the resolved port to avoid re-reading the lockfile on each call. Cache invalidated on 403/404/ECONNREFUSED.
- **Kit listing**: 30-second TTL cache (`src/core/kit.js` lines 35-43) keyed on `kitRoot:mode`. The `mode=stubs` variant only reads the first 4 KB of each file (frontmatter only) — PERF-S1 optimization for `sync install` in reference mode.
- **Gate listing**: 30-second TTL cache (`src/core/gates.js` lines 28-31) — same pattern.
- **Persistent state on disk**: `.planning/` (project workflow state — phases, milestones, postmortems, etc; managed by the framework, not the runtime), `kit/file-manifest.json` (hash manifest used by content-update tooling), `os.tmpdir()/kit-mcp-ui-*.lock` (sidecar single-instance lock).

## Key Abstractions

**TARGETS registry (`src/core/registry.js` lines 16-90):**
- Purpose: declarative table of 8 IDEs and how each one expects rules / agents / commands / skills / hooks / framework / mcp-config
- Pattern: data-driven — adding a new IDE = add an entry to this object. Every code path that handles cross-IDE differences reads from this table.
- Capability fields: `rules`, `agents`, `commands`, `skills`, `framework`, `hooks`, `mcpConfig`. Each has `path` (relative to projectRoot) and `mode` (`single` / `multi` / `multi-dir` / `mirror-tree`).
- Currently configured: `claude-code`, `cursor`, `codex`, `gemini-cli`, `copilot`, `windsurf`, `antigravity`, `trae`. Only `claude-code` exercises *all* capabilities including `framework` (mirror-tree of `.claude/framework/`) and `hooks`.

**Event schema (`src/ui/events.js` lines 7-15):**
- Purpose: closed enum of 7 event types
- Frozen types: `run.start`, `run.end`, `tool_invocation`, `progress`, `milestone`, `error`, `shutdown`
- Validation: `validateEvent()` lines 39-63 — all events must have `{type, ts, runId|null, payload}`; payload max 64 KB (after JSON.stringify); validation rejects unknown types
- Used by: `client.js#publish` (validates before POST), `server.js#handlePublish` (validates before pushing to ring + bus)

**Lockfile (`src/ui/lockfile.js`):**
- Purpose: single-instance enforcement per project
- Path: `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)[:16]>.lock`
- Contents: `{pid, port, version, startedAt, lockSchema}` (always JSON, single-write atomic via `fs.openSync(path, 'wx')` line 61 — O_EXCL fails if exists)
- Stale detection (lines 119-142):
  1. `process.kill(pid, 0)` — ESRCH means dead, EPERM means alive (different user)
  2. Optional `healthzProbe(port)` injected by caller — bounded by 500 ms timeout (PERF-04, lines 103-117)
- Reclaim with retry race protection (lines 148-187, "SEC-01: TOCTOU close"): if the holder is dead, release + retry-acquire; if a third party races into the lock during the retry, surface ELIVE rather than clobber.

**Wrap-progress-for-UI pattern (`src/ui/wrapper.js`):**
- Purpose: bolt sidecar publishing onto any `onProgress` callback without changing core function signatures. Encapsulates path-redaction (`HOME` → `~`, `projectRoot` → `<project>`).
- Why this matters: lets us keep `syncTo`/`applyReverse`/etc. transport-agnostic. The Stable API contract of `src/core/` says core never imports `src/ui/`.
- Path redaction (SEC-05, lines 18-58): handles Windows-style backslash paths, POSIX forward slashes, AND case-insensitive variants. Strings, arrays, and nested objects are all walked.

**Stub vs copy projection (`src/core/sync.js` lines 207-243):**
- `mode=reference` (default): write a tiny `.md` stub containing frontmatter (synthesized if absent) + a relative link back to the canonical kit file. Trade-off: editing the canonical source is reflected in the IDE *immediately* (no re-sync needed), but breaks if kit is later moved.
- `mode=copy`: full content duplication. Trade-off: works without access to the canonical kit (e.g. shipping a frozen snapshot to CI) but loses linkage; subsequent edits in the IDE become reverse-sync candidates.
- Stub identity marker: `<!-- kit-mcp:reference -->` (line 17). `kit sync remove` only deletes files containing this marker — never accidentally removes user-authored agents.

## Entry Points

**`bin/mcp.js` — MCP stdio server:**
- Triggered by: an MCP host (Claude Code, Cursor, Codex, Gemini, Windsurf) launching the configured command from its `mcpServers` config. Three invocation modes (`src/mcp-server/install.js` lines 52-77): `local` (this clone's `bin/mcp.js` via `process.execPath`), `npx` (`npx -y @luanpdd/kit-mcp`), `global` (assumes `npm install -g`).
- Responsibilities: register 6 tools, route `CallTool` requests to handlers, never write to stdout outside JSON-RPC.

**`bin/cli.js` — Commander CLI:**
- Triggered by: terminal user invoking `kit <subcommand>` (or `npm run cli`)
- Responsibilities: mirror every MCP tool as a subcommand; expose extras (`watch`, `doctor`, `ui start/stop/status/open`); render human-friendly output unless `--json`.

**`bin/ui.js` — Sidecar HTTP server:**
- Triggered by: `kit ui start` (foreground) OR `auto-spawn.js` from MCP/CLI when `--auto-spawn` was requested.
- Responsibilities: bind 127.0.0.1, acquire lockfile, serve 5+1 HTTP routes, emit events over SSE, signal-handle graceful shutdown.
- Special discipline: stdout is reserved (closed when spawned by auto-spawn) so the file can never poison MCP stdio.

## Error Handling

**Strategy:** errors propagate as native `Error` objects with a `.code` property used for branching. Sidecar publishing is fire-and-forget — every publisher is wired to *swallow* errors and resolve `{sent:false, reason}`.

**Patterns:**
- **Lockfile contention** — `acquireLock` throws `ELOCKED` on EEXIST; `acquireLockOrReclaim` translates to `ELIVE` (sidecar healthy, refuse to start a second one) or transparently reclaims a stale lock (`src/ui/lockfile.js` lines 148-187).
- **HTTP server 4xx** — `handleRequest` (`src/ui/server.js` lines 363-393) returns canonical `{error: <code>}` JSON: `host_not_allowed` (403), `origin_not_allowed` (403), `too_many_subscribers` (503), `not_found` (404). 5xx caught by the outer try, logs to stderr, sends `{error: 'internal_error'}`.
- **Publisher fire-and-forget** — `client.js#publish` (`src/ui/client.js` lines 44-103) always resolves; never rejects. Network errors (`ECONNREFUSED`/`ECONNRESET`) invalidate the port cache so the next call re-reads the lockfile.
- **MCP tool errors** — `src/mcp-server/index.js` lines 271-286: every `CallToolRequest` is wrapped in try/catch; thrown errors return `{ content: [{type:'text', text: JSON.stringify({error, stack})}], isError: true }` so the MCP host shows them as tool failures rather than transport errors.
- **CLI failures** — `fail(msg)` (line 145) writes `✗ <msg>` to stderr and exits 1.
- **Hook errors** — `kit/hooks/sidecar-tool-publisher.js` lines 78-81: catch-all logs to stderr and exits 0. **Hooks must never block the user's command.**

## Cross-Cutting Concerns

**Logging discipline:**
- Sidecar (`src/ui/server.js` lines 16-18, 53-56): stderr-only; CI gate (`.github/workflows/ci.yml`) blocks any stdout writes
- CLI: stdout for human/JSON output, stderr for spinner ticks and warnings
- MCP: stdout reserved entirely for JSON-RPC; everything else goes to stderr
- Hooks: stderr only, never block

**Security headers (`src/ui/server.js`):**
- Host header validation on every request (lines 60-65, REQ SEC-01) — only accepts `127.0.0.1:<port>` or `localhost:<port>`
- Origin validation on non-GET (lines 69-74, REQ SEC-02) — same-origin only
- CSP on `GET /` (lines 45-51) — `default-src 'self'`, `frame-ancestors 'none'`, no remote scripts
- Body size cap of 64 KB on POST `/publish` (line 95)
- Path redaction in published events (`src/ui/wrapper.js` SEC-05) — `HOME` and `projectRoot` scrubbed before the data leaves the publisher process

**Path safety (`src/core/sync.js` lines 108-114, "SEC-02"):** `walkTree` rejects entries whose normalized rel-path escapes the root or starts with a Windows drive letter — blocks path-traversal via maliciously named files in mode=copy.

**Hardening of stale state:** the doctor command (`src/cli/index.js` lines 472-637) actively scans `os.tmpdir()` for orphan `kit-mcp-ui-*.lock` files whose pids are dead and surfaces them as warnings with a copy-pasteable cleanup snippet.

## Module Coupling Analysis

**Dependency direction (verified by grep on lines 19-35 of `src/cli/index.js` and lines 11-26 of `src/mcp-server/index.js`):**

```
            src/cli ──────────► src/core
            src/cli ──────────► src/ui  (only client-side modules)
            src/cli ──────────► src/mcp-server (one import: install.js — see note)
            src/mcp-server ──► src/core
            src/mcp-server ──► src/ui  (only client-side modules)
            src/ui ──────────► (only Node built-ins)
            src/core ────────► (Node built-ins + chokidar in watch.js)
```

**Cycles:** None detected. The graph is a DAG.

**Cross-imports flagged:**
- `src/cli/index.js:29` → `import { installMcp, listInstallTargets } from '../mcp-server/install.js'`. This is the *only* edge from CLI into MCP. `install.js` is a logical core function (write IDE config) that happens to live under `src/mcp-server/` — it should arguably live in `src/core/` since both the CLI's `kit install write` command and the MCP `install` tool consume it. Not a cycle, just a misplacement.
- `src/cli/index.js:32` → `import { createServer } from '../ui/server.js'`. The CLI imports the *server* (not just the client) so `kit ui start` can run the sidecar in foreground without spawning a child. This is the only place outside `bin/ui.js` that loads the server module — when running the CLI for any other command, the server module is never touched.

**`src/ui/` boundary discipline:** `src/ui/server.js` is *server-side* and large; `src/ui/{client,events,lockfile,wrapper,port,browser,auto-spawn}.js` are *publisher-side or pure utilities*. Importing `server.js` accidentally pulls in HTTP-server lifecycle code; importing `client.js` does not. The CLI imports both (one entry imports server, others import client) but the MCP server imports only `auto-spawn.js` and `wrapper.js` — never `server.js`.

**`src/core/` purity:** No imports of `src/ui/*` from any `src/core/` module (verified by grep). The "Stable API of core" rule holds — core has zero knowledge of HTTP/SSE/lockfiles.

## Single Points of Failure / Risk Hot Spots

- **`src/cli/index.js` is 697 lines and growing** — does CLI bootstrap, sub-command registration for 6 namespaces (kit, sync, reverse-sync, gates, forensics, install) PLUS `ui start/stop/status/open` PLUS the entire `doctor` diagnostic (lines 472-637). Splitting per-namespace into `src/cli/commands/<ns>.js` would significantly reduce blast radius on every PR that touches it.
- **`src/ui/server.js` is 455 lines in a single closure** — lifecycle, routing, event bus, ring buffer, idle timer, signal handling, lockfile. Acceptable for the security surface (everything in one auditable file is a *feature*) but the test surface is large.
- **The hook race condition (v1.12.1 fix)** is a class of bug, not a one-off — any place where a `process.exit()` runs before a TCP write is flushed is suspect. The fix at `kit/hooks/sidecar-tool-publisher.js:178-181` waits on both `'end'` and `'close'`, but the same pattern in `bin/cli.js#postShutdown` (lines 640-657) and `bin/cli.js#getHealthz` (lines 659-681) only waits on `'end'` — would be worth a formal review.
- **Sidecar discovery is `os.tmpdir()`-global** — multiple projects share the same tmpdir; lockfile names disambiguate via `sha1(projectRoot)[:16]`. The tmpdir-scan fallback in the hook (`scanAnyRunningSidecar`) explicitly publishes to *any* live sidecar when projectRoot doesn't match — that's intentional resilience but it does mean tool_invocation events from project A can be received by a sidecar running for project B if project A has no sidecar of its own.
- **`kit/file-manifest.json` is hand-managed** — its hashes drive content-update tooling but there's no obvious CI gate that re-computes them on every kit edit; a stale manifest would cause silent update-detection misses.
- **No transaction boundary in `syncTo()`** — `src/core/sync.js` lines 89-101 writes ops one by one; an interrupted sync leaves a half-projected IDE. Idempotency makes re-running safe, but a partial state isn't surfaced as an error.
- **`fs.copyFile` for mirror-tree** (line 94) doesn't preserve mode bits across all FS targets — irrelevant for the current Markdown content but would matter if `kit/hooks/` started shipping executable scripts on POSIX.

## Extension Points

**Adding an agent / command / skill:**
- Drop a `.md` file into `kit/agents/`, `kit/commands/`, or `kit/skills/<name>/SKILL.md`
- Frontmatter required: `description: <≤200 chars>` (and `name` ideally; auto-synthesized if absent — `src/core/sync.js` line 239)
- Optional: regenerate `kit/file-manifest.json` (no automated gate enforcing it; see SPOF section)
- Re-run `kit sync install <target>` to project to one IDE, or run `kit sync watch --all` to keep everything live

**Adding a new IDE:**
- Edit `src/core/registry.js#TARGETS` — add an entry with the IDE's directory layout
- No code change required; both `sync.js` and `reverse-sync.js` are data-driven against the registry

**Adding a gate:**
- Drop a `.md` in `gates/` with frontmatter `id`, `stage`, `blocking`, and a `## Check` section containing fenced bash blocks
- Auto-discovered by `src/core/gates.js#listGates`

**Adding an MCP tool:**
- Edit `src/mcp-server/index.js` — add an entry to `TOOLS`, write a handler, register in `HANDLERS` map (line 246). Mirror as a CLI subcommand in `src/cli/index.js` for parity.

**Adding a sidecar event type:**
- Edit `src/ui/events.js#EVENT_TYPES` (line 7) — append to the frozen tuple. Validation auto-updates. Browser code in `src/ui/static/index.html` decides whether to render it.

## Notes on Persistent State

| Path | Owner | Lifecycle | Notes |
|------|-------|-----------|-------|
| `kit/` | repo | source-controlled | Bundled inside the published npm package (`package.json#files`). Single source of truth. |
| `gates/` | repo | source-controlled | Bundled too. 20 gates currently. |
| `.planning/` | project (using kit-mcp) | per-project, source-controlled | Framework state — milestones, phases, postmortems, requirements, decisions, codebase analysis (this file). NOT part of the kit-mcp package. |
| `os.tmpdir()/kit-mcp-ui-*.lock` | sidecar process | runtime-only | Atomic single-instance lock per project. Cleaned on graceful shutdown; orphan-scanned by `kit doctor`. |
| `~/.kit-mcp/version-check.json` | upgrade-check | 24h cached | Avoids hitting npm on every `kit ui start`. Created by `src/cli/upgrade-check.js`. |
| `.smoketest-watch/` | dev-only | gitignored, generated | Output target of `kit sync watch` smoke tests during development. |
| `os.tmpdir()/kit-mcp-hook.log` | hook (debug only) | append-only when `KIT_MCP_HOOK_DEBUG=1` | Per-invocation debug trace. |

---

*Architecture analysis: 2026-05-09*
