# kit-mcp

[![npm version](https://img.shields.io/npm/v/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![CI](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An opinionated **brownfield planning workflow** (in PT-BR) — agents, slash-commands, framework — shipped as an **MCP server**, with one-shot **sync** that projects the kit into every supported IDE's native layout — Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae.

> **One canonical source. N IDEs. Edit once, everywhere updated.**
>
> Install and inherit the bundled workflow, or point `--kit-root` at your own folder to replace it entirely.

---

## Why this exists

`.claude/agents/`, `.claude/commands/`, `.claude/skills/` are powerful but locked to Claude Code. The same definitions also need to live as `AGENTS.md` for Codex, `GEMINI.md` for Gemini, `.cursor/rules/` for Cursor, etc. Maintaining all of those by hand drifts immediately.

**kit-mcp** keeps your canonical source in one place and projects it into every supported IDE through a single registry. It also exposes the kit through an MCP server so any agent that speaks MCP can browse, search, sync, run gates, and record replays.

Inspired by [vinilana/dotcontext](https://github.com/vinilana/dotcontext) — see the design notes at the bottom for what's adapted, what's not, and why.

---

## What ships in the box

```
kit-mcp/
├── kit/                        ← bundled brownfield workflow (PT-BR)
│   ├── agents/                 19 agents (planner, executor, verifier, debugger,
│   │                                      ui-auditor, codebase-mapper, …)
│   ├── commands/               60 slash-commands (/novo-marco, /planejar-fase,
│   │                                              /executar-fase, /publicar, …)
│   ├── framework/              workflows + templates + bin libs the agents use
│   ├── hooks/                  workflow guards, prompt guards, statusline
│   ├── skills/example-skill/   single example skill (replace with your own)
│   └── README.md               file-format guide
│
├── gates/                      ← reusable workflow gates (regression, confidence, dep-check, …)
│
├── src/
│   ├── core/                   pure runtime — registry, kit, sync, reverse-sync, gates,
│   │                                          gate-runner, watch, failures, replays, reflect
│   ├── mcp-server/             MCP server entry + install command
│   └── cli/                    CLI mirror of the MCP tools
│
├── bin/
│   ├── mcp.js                  shim → starts the MCP stdio server
│   └── cli.js                  shim → runs the CLI
│
├── LICENSE                     MIT
├── CHANGELOG.md
├── package.json
└── README.md                   ← you are here
```

**Lines of source code:** ~1100. **Runtime dependencies:** 3 (`@modelcontextprotocol/sdk`, `commander`, `chokidar`). **Build step:** none — plain ESM Node.js 20+.

### About the bundled workflow

The bundled `kit/` is an opinionated **brownfield planning workflow** in Portuguese — milestones, phases, requirements, planning, execution with atomic commits and checkpoints, retrospective auditing. Installing `@luanpdd/kit-mcp` and syncing into your IDE gives you all 60 slash-commands, 19 agents, plus the framework templates that they delegate into.

If that's not what you want, point `--kit-root` at your own folder and ignore everything under `kit/` — the infrastructure (registry, sync, gates, forensics, MCP server) works the same regardless of what kit you load.

---

## Prerequisites

- **Node.js ≥ 20** (uses native ESM, no transpiler)
- An IDE / agent that speaks MCP if you want to use it that way (Claude Code, Cursor, Codex, Gemini CLI, …)
- Optional: a project where you'll sync the kit (any folder)

---

## Quick start

### 1. Use the bundled workflow as-is (recommended)

```bash
# Browse what's bundled
npx -y @luanpdd/kit-mcp kit list-agents     # 19 agents
npx -y @luanpdd/kit-mcp kit list-commands   # 60 commands
npx -y @luanpdd/kit-mcp sync targets        # supported IDEs

# Install into your project for Claude Code
npx -y @luanpdd/kit-mcp sync install claude-code --project-root .
```

After that, open the project in Claude Code and the slash-commands (`/novo-marco`, `/planejar-fase`, `/executar-fase`, `/publicar`, …) and agents are immediately available.

### 2. Replace the bundled workflow with your own kit

Point kit-mcp at your own `kit/` folder via `--kit-root` or the `KIT_MCP_KIT_ROOT` env var:

```bash
# Option A: per-command flag
npx -y @luanpdd/kit-mcp --kit-root ~/my-kit kit list-agents
npx -y @luanpdd/kit-mcp --kit-root ~/my-kit sync install claude-code --project-root .

# Option B: env var (sticky for the session)
export KIT_MCP_KIT_ROOT=~/my-kit
npx -y @luanpdd/kit-mcp sync install claude-code --project-root .
```

Your `~/my-kit/` follows the same layout as the bundled kit:

```
my-kit/
├── agents/<name>.md            YAML frontmatter + Markdown body
├── commands/<name>.md          YAML frontmatter + Markdown body
└── skills/<name>/SKILL.md      YAML frontmatter + Markdown body
                  references/   optional reference docs
```

See [`kit/README.md`](kit/README.md) for the file format.

### 3. Register kit-mcp into an IDE (so agents inside the IDE can call the MCP tools)

```bash
# Portable — works on any machine, no clone needed
npx -y @luanpdd/kit-mcp install write claude-code --scope user --via npx
```

For other IDEs, swap `claude-code` for `cursor`, `codex`, `gemini-cli`, `windsurf`, `antigravity`, `copilot`, or `trae`. Run `kit sync targets` for the live capability matrix.

---

## CLI reference

The CLI mirrors the MCP tools 1:1. Output is always JSON to stdout. The global `--kit-root` flag overrides the kit source for any subcommand.

### `kit kit ...` — browse the kit

```bash
kit kit list-agents               # 19 agents (bundled workflow)
kit kit list-commands             # 60 commands (bundled workflow)
kit kit list-skills               # 1 skill (example only — bring your own)
kit kit get agent planner
kit kit search "milestone"        # fuzzy match across all kinds
```

### `kit sync ...` — project into an IDE

```bash
kit sync targets                              # list supported IDEs + capabilities
kit sync status claude-code                   # see which capability paths exist in cwd
kit sync install claude-code                  # write the kit into the cwd as Claude Code expects
kit sync install cursor --mode copy           # copy mode (no link to canonical)
kit sync install codex --dry-run              # preview without writing
kit sync remove claude-code                   # remove only files generated by kit-mcp (uses STUB_MARKER)
kit sync watch claude-code cursor             # watch kit/ → resync to listed IDEs on every change
kit sync watch --all                          # watch + auto-detect every IDE already present in cwd
```

**Modes:**
- `reference` (default) — writes a stub that links back to `kit/`. Edit canonical → all IDEs see the change.
- `copy` — duplicates content. Use when shipping a frozen snapshot of the kit.

**Per-IDE projection** — what each target receives:

| IDE | rules → | agents → | commands → | skills → |
|---|---|---|---|---|
| Claude Code | `CLAUDE.md` | `.claude/agents/*.md` | `.claude/commands/*.md` | `.claude/skills/*/` |
| Cursor | `.cursor/rules/*.mdc` | `.cursor/agents/*.md` | — | — |
| Codex | `AGENTS.md` | — | — | `.codex/skills/*/` |
| Gemini CLI | `GEMINI.md` | — | — | `.gemini/skills/*/` |
| Copilot | `.github/copilot-instructions.md` | `.github/agents/*.agent` | — | `.github/skills/*/` |
| Windsurf | `.windsurf/rules/*.md` | `.windsurf/agents/*.md` | — | `.windsurf/skills/*/` |
| Antigravity | `.agents/rules/*.md` | `.agents/agents/*.md` | — | `.agents/workflows/*/` |
| Trae | `.trae/rules/*.md` | `.trae/agents/*.md` | — | — |

A capability marked `—` is not supported by that IDE. Adding a new IDE = one entry in [`src/core/registry.js`](src/core/registry.js).

### `kit install ...` — register kit-mcp into an IDE's MCP config

```bash
kit install targets                                           # list IDEs that support MCP config
kit install dry-run claude-code --scope user --via npx        # preview the JSON/TOML
kit install write claude-code   --scope user --via npx        # portable: uses `npx @luanpdd/kit-mcp`
kit install write claude-code   --scope project --via local   # local clone: uses ./bin/mcp.js absolute path
kit install write claude-code   --scope user --via global     # assumes `npm install -g @luanpdd/kit-mcp`
```

`--via` decides how the IDE will invoke the server:

| Mode | Command in IDE config | When to use |
|---|---|---|
| `npx` (recommended) | `npx -y @luanpdd/kit-mcp` | Portable — works on any machine |
| `local` | `node /abs/path/to/clone/bin/mcp.js` | You're hacking on kit-mcp itself |
| `global` | `kit-mcp` | After `npm install -g @luanpdd/kit-mcp` — fastest startup |

### `kit reverse-sync ...` — bring IDE edits back to the canonical kit

If you edited an agent/command/skill **directly inside the IDE's folder** (`.claude/agents/foo.md`, `.cursor/agents/bar.md`, …) instead of in your kit, this brings those edits back so the canonical absorbs them.

```bash
kit reverse-sync detect claude-code --project-root .
kit reverse-sync apply  claude-code --project-root . --strategy merge --dry-run
kit reverse-sync apply  claude-code --project-root . --strategy merge
kit reverse-sync apply  claude-code --project-root . --strategy overwrite --only agent/foo
```

**Strategies:** `skip` (list-only), `merge` (canonical frontmatter + edited body), `overwrite`, `rename` (preserve both as `-from-{ide}.md`).

### `kit gates ...` — reusable workflow gates

```bash
kit gates list                                    # all gates with stage + blocking flag
kit gates get regression                          # full markdown of one gate
kit gates for-stage pre-verify                    # gates that run before the verify step
kit gates run secrets-scan --project-root .       # interactive: shows the script, asks y/N, runs
kit gates run secrets-scan --project-root . --yes # non-interactive (CI)
kit gates run confidence  --no-interactive        # manual gates → verdict=manual when not interactive
```

**Verdicts:** `passed` (exit 0), `block` (exit≠0 + blocking), `warn` (exit≠0 + non-blocking), `manual` (no shell), `skipped` (declined).

Author runnable gates with a `bash` code-fence under `## Check`:

````markdown
---
id: my-gate
stage: pre-verify
blocking: true
description: ...
---
## Check
```bash
test -f package.json && npm test
```
````

### `kit forensics ...` — failure dataset, replays & LLM-driven prompt evolution

```bash
# Aggregate failures across debug/, verifications, forensics
kit forensics collect          --project-root .
kit forensics summarize        --project-root .
kit forensics write-learnings  --project-root .

# LLM pass: read learnings + current agent, propose minimal prompt edits
kit forensics reflect --agent <name> --project-root . --dry-run
kit forensics reflect --agent <name> --project-root .
kit forensics reflect --agent <name> --project-root . --apply

# Replays
kit forensics list-replays  --project-root .
kit forensics load-replay <id> --project-root .
```

`reflect` requires `ANTHROPIC_API_KEY` (override model with `KIT_REFLECT_MODEL`, max tokens with `KIT_REFLECT_MAX_TOKENS`). Without the key, `--dry-run` saves the assembled prompt for manual paste.

The proposal is always saved to `.planning/learnings/{agent}.proposal.md` first; the canonical is only modified after explicit confirmation (or `--apply`). MCP `forensics.reflect` never auto-applies.

---

## MCP usage

Once registered (`kit install write <ide> --via npx`), the IDE's agent gets 6 MCP tools, all using **action-based dispatch** — one tool, many actions, low context cost.

| Tool | Actions |
|---|---|
| `kit` | `list-agents`, `list-commands`, `list-skills`, `get`, `search` |
| `sync` | `targets`, `status`, `install`, `remove` |
| `reverse-sync` | `detect`, `apply` |
| `gates` | `list`, `get`, `for-stage` |
| `forensics` | `collect`, `summarize`, `write-learnings`, `reflect`, `list-replays`, `record-replay`, `load-replay`, `annotate-replay` |
| `install` | `targets`, `install`, `dry-run` |

### Example calls (from inside an MCP client)

```jsonc
{ "tool": "kit",          "arguments": { "action": "list-agents" } }
{ "tool": "sync",         "arguments": { "action": "install", "target": "claude-code", "projectRoot": "/abs" } }
{ "tool": "gates",        "arguments": { "action": "for-stage", "stage": "pre-verify" } }
{ "tool": "forensics",    "arguments": { "action": "write-learnings", "projectRoot": "/abs" } }
{ "tool": "reverse-sync", "arguments": { "action": "detect", "target": "claude-code", "projectRoot": "/abs" } }
```

---

## Harness usage (programmatic)

The `core/` modules are pure functions, no transport coupling:

```javascript
import { listKit, searchKit }            from '@luanpdd/kit-mcp/src/core/kit.js';
import { syncTo, statusOf }              from '@luanpdd/kit-mcp/src/core/sync.js';
import { listGates, gatesForStage }      from '@luanpdd/kit-mcp/src/core/gates.js';
import { runGate }                       from '@luanpdd/kit-mcp/src/core/gate-runner.js';
import { detectReverse, applyReverse }   from '@luanpdd/kit-mcp/src/core/reverse-sync.js';
import { watchKit }                      from '@luanpdd/kit-mcp/src/core/watch.js';
import { collectFailures, writeLearnings } from '@luanpdd/kit-mcp/src/core/failures.js';
import { reflect }                       from '@luanpdd/kit-mcp/src/core/reflect.js';

// Browse the kit
const kit = await listKit('/path/to/kit');
console.log(kit.agents.length, 'agents');

// Sync to multiple IDEs in parallel
await Promise.all([
  syncTo('claude-code', { projectRoot: '/proj/foo', kitRoot: '/path/to/kit' }),
  syncTo('cursor',      { projectRoot: '/proj/foo', kitRoot: '/path/to/kit' }),
  syncTo('codex',       { projectRoot: '/proj/foo', kitRoot: '/path/to/kit' }),
]);

// Watch and resync
const w = await watchKit(['claude-code'], { projectRoot: '/proj/foo' });
// ... later: await w.stop();
```

This is what dotcontext calls "the harness" — a runtime layer used both by CLI and MCP.

---

## Adding things

### Add a new agent / command / skill

Drop a file (or folder, for skills) into your `kit/`:

```bash
# kit/agents/refactor-suggester.md
cat > kit/agents/refactor-suggester.md <<'EOF'
---
name: refactor-suggester
description: Scans a directory and suggests safe refactors with diff previews.
tools: Read, Glob, Grep
---
You are a refactoring assistant ...
EOF

# Re-sync (or use `kit sync watch` for automatic)
kit sync install claude-code --project-root /your/project
```

### Add a new gate

```bash
cat > gates/bundle-size.md <<'EOF'
---
id: bundle-size
stage: post-verify
blocking: false
description: Warn if the production bundle grew more than 10% versus the previous phase.
---
## Check
```bash
# your script here; cwd will be --project-root
EOF
```

The gate appears in `kit gates list` immediately and is runnable with `kit gates run bundle-size`.

### Add a new IDE target

Open [`src/core/registry.js`](src/core/registry.js) and add an entry to `TARGETS`:

```javascript
'my-new-ide': {
  label: 'My New IDE',
  rules:    { path: 'MY_RULES.md',         mode: 'single' },
  agents:   { path: '.myide/agents/',      mode: 'multi', extension: '.md' },
  commands: null,
  skills:   { path: '.myide/skills/',      mode: 'multi-dir' },
  mcpConfig:{ path: '.myide/mcp.json',     strategy: 'merge-mcpServers-json',
              userPath: '~/.myide/mcp.json', userKey: 'mcpServers' },
},
```

That's the entire change. `kit sync install my-new-ide` and `kit install write my-new-ide` work immediately.

---

## How the sync stays in sync

When you run `sync install <ide> --mode reference`, kit-mcp writes stubs like:

```markdown
---
name: example-reviewer
description: ...
---

<!-- kit-mcp:reference -->
# example-reviewer

> Canonical source: [`../../kit/agents/example-reviewer.md`](../../kit/agents/example-reviewer.md)
> Edit the source file in the kit, not this stub.
```

The IDE reads the **frontmatter** (preserved verbatim) for the metadata it needs, and the body points back at the canonical file. Edit `kit/agents/example-reviewer.md` once; running `sync install` again refreshes timestamps but the link is unchanged.

The `STUB_MARKER` (`<!-- kit-mcp:reference -->`) lets `sync remove` clean up only files we wrote, never touching anything you authored manually. It also lets `reverse-sync detect` recognize stubs vs user-edited content.

---

## Releasing (maintainers)

The repo auto-publishes to npm via GitHub Actions whenever a version tag (`v*`) is pushed.

### One-time setup

1. **Create the GitHub repo** (if not already):
   ```bash
   gh repo create luanpdd/kit-mcp --public --source . --push
   ```

2. **Generate an npm token** at https://www.npmjs.com/settings/luanpdd/tokens
   - Type: **Granular Access Token**
   - Permissions: **Read and write** for `@luanpdd/*` scope
   - **Allow this token to bypass 2FA**: ✅ enabled (required for CI)

3. **Add the token as a GitHub secret**:
   ```bash
   gh secret set NPM_TOKEN
   # paste the npm_xxxxx token when prompted
   ```

### Release flow

```bash
npm version patch     # or minor / major — bumps + commits + tags
git push --follow-tags
# GitHub Action runs CLI smoke tests, then `npm publish --provenance`
```

The publish workflow refuses to ship if `package.json` version doesn't match the tag.

The CI workflow runs CLI smoke tests on **Ubuntu / macOS / Windows × Node 20 / 22** on every PR and push to `main`.

---

## Design notes — what we adapted from dotcontext, what we didn't

**Adapted (load-bearing simplifications):**

1. **Single registry table** — `src/core/registry.js`. Adding an IDE = one entry, not a new adapter file. Capability differences handled by `null`, not `if/else`.
2. **Markdown references over copies** — edit the canonical, all targets see it.
3. **Action-based MCP dispatching** — 6 tools instead of 30+. Small surface, easy to remember.
4. **CLI ↔ harness ↔ MCP** — `core/` is pure, CLI and MCP are thin transports.

**Adapted but reshaped:**

5. **Failure dataset** — `forensics collect/summarize/write-learnings` aggregates `debug/resolved/`, failed `*-VERIFICATION.md`, `forensics/*` into per-agent learning docs.
6. **Reflect (LLM pass)** — `forensics reflect` feeds learnings + current agent into an LLM and proposes minimal prompt edits.
7. **Replays** — `forensics record-replay / load-replay` for tight prompt iteration.
8. **Gates as named files** — extracted into `gates/*.md` with explicit verdict format. Runnable with `gates run`.

**Not adapted (over-engineered for a personal kit):**

- PREVC state machine, role assignments, sensors/contracts/policies/datasets — too much for personal use.
- Built-in agents/skills hardcoded — yours come from your `kit/`.

---

## Roadmap (open ideas)

- HTTP transport for IDEs that don't speak stdio MCP.
- `forensics reflect` with diff visual instead of full content.
- `kit gates run --all` aggregating verdicts of every gate at a stage.
- Dependabot config to keep `chokidar` and `@modelcontextprotocol/sdk` current.
- `kit sync watch` exposed via MCP (long-running tool challenge).

PRs welcome.

---

## Smoke tests

```bash
node bin/cli.js kit list-agents | head -5         # 19 bundled agents
node bin/cli.js sync targets                      # 8 IDEs
node bin/cli.js gates list                        # 5 gates
node bin/cli.js install dry-run claude-code --via npx
node bin/mcp.js < /dev/null & sleep 1; kill %1    # MCP server boots and waits on stdio
```

---

## License

MIT — see [LICENSE](LICENSE).

Copyright © 2026 luanpdd.
