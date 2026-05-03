# kit-mcp

[![npm version](https://img.shields.io/npm/v/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@luanpdd/kit-mcp.svg)](https://www.npmjs.com/package/@luanpdd/kit-mcp)
[![CI](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Your personal kit of agents, slash-commands and skills — exposed as an **MCP server** that any LLM/IDE can connect to (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae), with a one-shot **sync** that projects the kit into each IDE's native layout.

> One canonical source. N IDEs. Edit once, everywhere updated.

---

## Why this exists

Your `.claude/agents/`, `.claude/commands/`, `.claude/skills/` are powerful but locked to Claude Code. The same definitions also need to live as `AGENTS.md` for Codex, `GEMINI.md` for Gemini, `.cursor/rules/` for Cursor, etc. Maintaining all of those by hand drifts immediately.

**kit-mcp** keeps the canonical source in one place (`kit/`) and projects it into every supported IDE through a single registry. It also exposes the kit through an MCP server so any agent that speaks MCP can browse, search, sync, run gates, and record replays.

Inspired by but distinct from [vinilana/dotcontext](https://github.com/vinilana/dotcontext) — see the design notes at the bottom for what's adapted, what's not, and why.

---

## What's in the box

```
kit-mcp/
├── kit/                        ← canonical source (your personal kit)
│   ├── agents/                  18 .md  — sub-agents (planner, executor, verifier, ...)
│   ├── commands/                59 .md  — slash-commands (/discutir-fase, /executar-fase, ...)
│   ├── skills/                  3 dirs  — skills (paperclip, design-guide, company-creator)
│   ├── skills-extras/           10 dirs — extra skills (release, prcheckloop, para-memory-files, ...)
│   ├── framework/               original framework (workflows, references, templates, hooks)
│   └── COMANDOS.md
│
├── gates/                      ← reusable workflow gates extracted from inline workflow steps
│   ├── regression.md            pre-verify  — run prior-phase tests
│   ├── confidence.md            pre-plan    — gate on discovery confidence
│   ├── dependency-check.md      pre-execute — verify cross-wave key-links
│   ├── verify-phase-goal.md     post-verify — reverse-verify the goal, not tasks
│   └── secrets-scan.md          any         — block common secret patterns
│
├── src/
│   ├── core/                   ← pure runtime (no transport deps)
│   │   ├── registry.js          IDE adapter table — single source of truth
│   │   ├── kit.js               read kit/ canonical, parse frontmatter, search
│   │   ├── sync.js              project the kit into a target IDE (reference | copy)
│   │   ├── gates.js             list/get reusable gates
│   │   ├── failures.js          aggregate debug + verification + forensics → learnings
│   │   └── replays.js           record/load Task() payloads for prompt iteration
│   │
│   ├── mcp-server/
│   │   ├── index.js             MCP server entry — 5 tools with action-dispatch
│   │   └── install.js           write kit-mcp into an IDE's MCP config (JSON or TOML)
│   │
│   └── cli/
│       └── index.js             CLI mirror of the MCP tools
│
├── bin/
│   ├── mcp.js                   shim → starts the MCP stdio server
│   └── cli.js                   shim → runs the CLI
│
├── package.json
└── README.md                    ← you are here
```

**Lines of source code:** ~800. **Runtime dependencies:** 2 (`@modelcontextprotocol/sdk`, `commander`). **Build step:** none — plain ESM Node.js 20+.

---

## Prerequisites

- **Node.js ≥ 20** (uses native ESM, no transpiler)
- An IDE / agent that speaks MCP if you want to use it that way (Claude Code, Cursor, Codex, Gemini CLI, …)
- Optional: a project where you'll sync the kit (any folder)

---

## Quick start

### Easiest (no clone) — via npx

```bash
# 1. Project the kit into your project's IDE folder
npx -y @luanpdd/kit-mcp sync install claude-code --project-root /path/to/your/project

# 2. Register kit-mcp as an MCP server in the IDE (uses npx — portable, no clone)
npx -y @luanpdd/kit-mcp install write claude-code --scope user --via npx
```

Open Claude Code in the project — your agents/commands/skills are visible, and the `kit-mcp` MCP server appears in `/mcp`.

### Global install (for repeated use)

```bash
npm install -g @luanpdd/kit-mcp
kit sync install claude-code --project-root /path/to/your/project
kit install write claude-code --scope user --via global
```

### Local clone (for hacking on the kit itself)

```bash
git clone https://github.com/luanpdd/kit-mcp.git
cd kit-mcp
npm install
node bin/cli.js sync install claude-code --project-root /path/to/your/project
node bin/cli.js install write claude-code --scope user           # via=local default
```

For other IDEs, swap `claude-code` for one of: `cursor`, `codex`, `gemini-cli`, `windsurf`, `antigravity`, `copilot`, `trae`. Run `kit sync targets` for the live list and capability matrix.

---

## CLI reference

The CLI mirrors the MCP tools 1:1. Output is always JSON to stdout.

### `kit kit ...` — browse the canonical kit

```bash
kit kit list-agents               # 18 agents with names + descriptions
kit kit list-commands             # 59 slash-commands
kit kit list-skills               # 13 skills (3 main + 10 extras)
kit kit get agent planner         # full source of one item
kit kit get skill paperclip
kit kit search "verify"           # fuzzy match across all kinds
```

### `kit sync ...` — project into an IDE

```bash
kit sync targets                              # list supported IDEs + capabilities
kit sync status claude-code                   # see which capability paths exist in cwd
kit sync install claude-code                  # write the kit into the cwd as Claude Code expects it
kit sync install cursor --mode copy           # copy mode (no link to canonical)
kit sync install codex --dry-run              # preview without writing
kit sync remove claude-code                   # remove only files generated by kit-mcp (uses STUB_MARKER)
kit sync watch claude-code cursor             # watch kit/ → resync to listed IDEs on every change
kit sync watch --all                          # watch + auto-detect every IDE already present in cwd
```

**Modes:**
- `reference` (default) — writes a stub that links back to `kit/`. Edit canonical → all IDEs see the change.
- `copy` — duplicates content. Use when shipping a frozen snapshot of the kit (e.g. inside a repo that won't have access to your `kit-mcp/` folder).

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
kit install targets                                                # list IDEs that support MCP config
kit install dry-run claude-code --scope user --via npx             # preview the JSON/TOML it would write
kit install write claude-code   --scope user --via npx             # portable: uses `npx @luanpdd/kit-mcp`
kit install write claude-code   --scope project --via local        # local clone: uses ./bin/mcp.js absolute path
kit install write claude-code   --scope user --via global          # assumes `npm install -g @luanpdd/kit-mcp`
kit install write cursor        --scope user --via npx --name kit-dev   # custom server name
kit install write codex         --scope user --via npx             # writes a TOML snippet to ~/.codex/config.toml
kit install write claude-code   --scope user --force               # overwrite existing entry with same name
```

`--via` decides how the IDE will invoke the server:

| Mode | Command in IDE config | When to use |
|---|---|---|
| `npx` (recommended) | `npx -y @luanpdd/kit-mcp` | Portable — works on any machine without clone or global install |
| `local` (default) | `node /abs/path/to/clone/bin/mcp.js` | You're hacking on the kit itself in this clone |
| `global` | `kit-mcp` | After `npm install -g @luanpdd/kit-mcp` — fastest startup |

Default registration with `--via npx` looks like (Claude Code / Cursor / Gemini / Windsurf):

```json
{
  "mcpServers": {
    "kit": {
      "command": "npx",
      "args": ["-y", "@luanpdd/kit-mcp"],
      "env": {}
    }
  }
}
```

For Codex (TOML):

```toml
[mcp_servers.kit]
command = "npx"
args = ["-y", "@luanpdd/kit-mcp"]
```

### `kit gates ...` — reusable workflow gates

```bash
kit gates list                                    # all gates with stage + blocking flag
kit gates get regression                          # full markdown of one gate
kit gates for-stage pre-verify                    # gates that should run before the verify step
kit gates run secrets-scan --project-root .       # interactive: shows the script, asks y/N, runs, returns verdict
kit gates run secrets-scan --project-root . --yes # non-interactive (CI): runs without confirmation
kit gates run confidence  --no-interactive        # manual gates → verdict=manual when not interactive
```

Gates are markdown files with frontmatter. The MCP server returns them as data (never executes); the CLI runs them with explicit user confirmation.

**Gate runner verdicts:**

| Verdict | When |
|---|---|
| `passed` | shell exit=0 |
| `block`  | shell exit≠0 AND `blocking: true` |
| `warn`   | shell exit≠0 AND `blocking: false` |
| `manual` | gate has no `## Check` shell block; user chooses `p/w/b/s` interactively |
| `skipped`| user declined the confirmation prompt |

**Authoring a runnable gate** — wrap the check in a `bash` code-fence under a `## Check` heading:

````markdown
---
id: my-gate
stage: pre-verify
blocking: true
description: ...
---

## Check

```bash
# any bash; cwd will be --project-root
test -f package.json && npm test
```
````

Gates without a `## Check` shell block become "manual" — useful for advisory gates whose verdict is judgment-based.

### `kit reverse-sync ...` — bring IDE edits back to the canonical kit

If you edited an agent/command/skill **directly inside the IDE's folder** (`.claude/agents/foo.md`, `.cursor/agents/bar.md`, `.codex/skills/baz/SKILL.md`...) instead of in `kit/`, this brings those edits back so the canonical absorbs them.

```bash
# What's been edited or added in the IDE that the canonical doesn't have yet?
kit reverse-sync detect claude-code --project-root .

# Apply with one of four strategies:
kit reverse-sync apply claude-code --project-root . --strategy merge --dry-run
kit reverse-sync apply claude-code --project-root . --strategy merge
kit reverse-sync apply claude-code --project-root . --strategy overwrite --only agent/planner
kit reverse-sync apply claude-code --project-root . --strategy rename
```

**Strategies:**

| Strategy | What it does |
|---|---|
| `skip` (default) | List only — touch nothing |
| `merge` | Keep canonical frontmatter (tools, color, hooks…) + take edited body |
| `overwrite` | Replace canonical entirely with the edited content |
| `rename` | Write to `kit/agents/foo-from-claude.md` (preserve both versions) |

**How it knows what was edited:** every stub kit-mcp generates carries the `<!-- kit-mcp:reference -->` marker plus boilerplate. Files with all markers intact are treated as untouched stubs and ignored. Anything else is a candidate.

### `kit forensics ...` — failure dataset, replays & LLM-driven prompt evolution

```bash
# 1. Aggregate failures across debug/, verifications, and forensics reports
kit forensics collect          --project-root /path/to/your/project
kit forensics summarize        --project-root /path/to/your/project
kit forensics write-learnings  --project-root /path/to/your/project
#   → writes .planning/learnings/{agent}.md with recurring failure patterns

# 2. Reflect — feed learnings + current agent into an LLM, propose minimal prompt edits
kit forensics reflect --agent executor --project-root /path/to/your/project --dry-run
#   → assembles the prompt and saves it; no API call (use to inspect)
kit forensics reflect --agent executor --project-root /path/to/your/project
#   → calls Anthropic API, saves proposal, asks "apply? [y/N]"
kit forensics reflect --agent executor --project-root /path/to/your/project --apply
#   → skips the prompt, applies directly (CI / scripts)

# 3. Replays — re-run an agent with the same input, updated prompt
kit forensics list-replays  --project-root /path/to/your/project
kit forensics load-replay <id> --project-root /path/to/your/project
#   record-replay is exposed via MCP only (the orchestrator stores Task() payloads)
```

**`reflect` requires `ANTHROPIC_API_KEY`** in the environment for live calls. Without it, `--dry-run` saves the assembled prompt to `.planning/learnings/{agent}.reflect-prompt.md` so you can paste it into any LLM manually. Default model: `claude-sonnet-4-5-20250929` (override with `KIT_REFLECT_MODEL`). Default `max_tokens: 8000` (override with `KIT_REFLECT_MAX_TOKENS`).

**Safety:** the LLM proposal is always saved to `.planning/learnings/{agent}.proposal.md` first. The canonical `kit/agents/{agent}.md` is only modified after explicit confirmation (or `--apply`). The MCP `forensics.reflect` action **never** auto-applies — application is CLI only.

---

## MCP usage

Once registered (`kit install write <ide>`), your IDE's agent gets 5 MCP tools, all using **action-based dispatch** — one tool, many actions, low context cost.

### Tools

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
// "Show me all my agents"
{ "tool": "kit", "arguments": { "action": "list-agents" } }

// "Project the kit into the project I'm in, as Claude Code"
{ "tool": "sync", "arguments": { "action": "install", "target": "claude-code", "projectRoot": "/abs/path" } }

// "Which gates run before the verify step?"
{ "tool": "gates", "arguments": { "action": "for-stage", "stage": "pre-verify" } }

// "Collect failures from this project and write learnings docs"
{ "tool": "forensics", "arguments": { "action": "write-learnings", "projectRoot": "/abs/path" } }

// "Save this Task() payload as a replay so I can re-run it later with an updated prompt"
{ "tool": "forensics", "arguments": {
    "action": "record-replay",
    "projectRoot": "/abs/path",
    "payload": {
      "agent": "executor", "phase": "03", "plan": "01",
      "subagent_type": "executor", "model": "claude-sonnet-4-6",
      "prompt": "Execute plan ...",
      "files_to_read": [".planning/phases/03-foo/03-01-PLAN.md", "..."],
      "agent_skills": "..."
    }
  } }
```

---

## Harness usage (programmatic)

The `core/` modules are pure functions, no transport coupling. Use them directly from any Node.js script:

```javascript
import { listKit, searchKit }            from './kit-mcp/src/core/kit.js';
import { syncTo, statusOf }              from './kit-mcp/src/core/sync.js';
import { listGates, gatesForStage }      from './kit-mcp/src/core/gates.js';
import { collectFailures, writeLearnings } from './kit-mcp/src/core/failures.js';
import { recordReplay, loadReplay }      from './kit-mcp/src/core/replays.js';

// Browse the kit
const kit = await listKit();
console.log(kit.agents.length, 'agents');
console.log(searchKit(kit, 'verify'));

// Sync to multiple IDEs in parallel
await Promise.all([
  syncTo('claude-code', { projectRoot: '/proj/foo' }),
  syncTo('cursor',      { projectRoot: '/proj/foo' }),
  syncTo('codex',       { projectRoot: '/proj/foo' }),
]);

// Get gates that gate a specific stage
const gates = await gatesForStage('pre-verify');
for (const g of gates) console.log(g.id, g.blocking ? '[BLOCKING]' : '[warn]');

// Close the learning loop
const failures = await collectFailures({ projectRoot: '/proj/foo' });
await writeLearnings(failures, { projectRoot: '/proj/foo' });

// Record + later re-run a Task payload
const { id } = await recordReplay({ agent: 'executor', /* ... */ });
const payload = await loadReplay(id);
// → re-spawn the agent with payload.prompt etc., now reading the updated agent .md
```

This is what dotcontext calls "the harness" — a runtime layer used both by CLI and MCP. Keeping it pure means tests, scripts, and future transports (HTTP, gRPC, CLI v2) can all reuse the same logic.

---

## Adding things

### Add a new agent

```bash
# 1. Drop a new file in kit/agents/
cat > kit/agents/refactor-suggester.md <<'EOF'
---
name: refactor-suggester
description: Scans a directory and suggests safe refactors with diff previews.
tools: Read, Glob, Grep
---
You are a refactoring assistant ...
EOF

# 2. Re-sync
node bin/cli.js sync install claude-code --project-root /your/project

# Done. The agent is visible in Claude Code immediately.
```

### Add a new command or skill

Same pattern — drop into `kit/commands/<name>.md` or `kit/skills/<name>/SKILL.md`, then `kit sync install <ide>`.

### Add a new gate

```bash
cat > gates/bundle-size.md <<'EOF'
---
id: bundle-size
stage: post-verify
blocking: false
description: Warn if the production bundle grew more than 10% versus the previous phase.
---
# Bundle size gate
...
EOF
```

The gate appears in `kit gates list` immediately. To make it run, reference it from your workflow (e.g. `@./.claude/framework/gates/bundle-size.md` in `execute-phase.md`).

### Add a new IDE target

Open [`src/core/registry.js`](src/core/registry.js) and add an entry to `TARGETS`:

```javascript
'my-new-ide': {
  label: 'My New IDE',
  rules:    { path: 'MY_RULES.md',         mode: 'single' },
  agents:   { path: '.myide/agents/',      mode: 'multi', extension: '.md' },
  commands: null,                          // not supported
  skills:   { path: '.myide/skills/',      mode: 'multi-dir' },
  mcpConfig:{ path: '.myide/mcp.json',     strategy: 'merge-mcpServers-json',
              userPath: '~/.myide/mcp.json', userKey: 'mcpServers' },
},
```

That's the entire change. `kit sync install my-new-ide` and `kit install write my-new-ide` work immediately. No new code, no new files.

---

## How the sync stays in sync

When you run `sync install <ide> --mode reference`, kit-mcp writes stubs like:

```markdown
---
name: planner
description: Cria planos de fase executáveis ...
---
<!-- kit-mcp:reference -->
# planner

> Canonical source: [`../../../kit-mcp/kit/agents/planner.md`](../../../kit-mcp/kit/agents/planner.md)
> ...
> Edit the source file in the kit, not this stub.
```

The IDE reads the **frontmatter** (which is preserved verbatim) for the metadata it needs, and the body points back at the canonical file. To update an agent, edit `kit/agents/planner.md` once; running `sync install` again refreshes timestamps but the link is unchanged.

The `STUB_MARKER` (`<!-- kit-mcp:reference -->`) lets `sync remove` clean up only files we wrote, never touching anything you authored manually.

---

## Design notes — what we adapted from dotcontext, what we didn't

**Adapted (because they're load-bearing simplifications):**

1. **Single registry table** — `src/core/registry.js`. Adding an IDE = one entry, not a new adapter file. Capability differences handled by `null`, not `if/else`.
2. **Markdown references over copies** — edit the canonical, all targets see it.
3. **Action-based MCP dispatching** — 5 tools instead of 30+. Small surface, easy to remember, fits in any context window.
4. **CLI ↔ harness ↔ MCP** — `core/` is pure, CLI and MCP are thin transports. Same logic, multiple entry points.

**Adapted from inside dotcontext but reshaped:**

5. **Failure dataset as a learning loop** — `forensics collect/summarize/write-learnings`. Aggregates your existing `debug/resolved/`, failed `*-VERIFICATION.md`, and `forensics/*` into per-agent learning docs you can use to evolve your agent prompts over time. Lighter than dotcontext's full sensors+contracts+policies harness.
6. **Replays** — `forensics record-replay / load-replay`. Captures Task() payloads so you can re-run an agent with the same input but a tweaked prompt — tight feedback loop for iterating on agent definitions.
7. **Gates as named files** — extracted from your inline workflow steps into `gates/*.md`. Each gate declares stage + blocking, has a clear verdict format. Adding a new gate doesn't require editing `execute-phase.md`.

**Not adapted (your kit is more sophisticated already):**

- PREVC (their 5-phase state machine) — your `discutir → pesquisar → planejar → executar → verificar → gap-closure` is more opinionated and proven.
- Roles (planner/architect/dev/qa/reviewer) — your named agents are more specialized.
- Stack detector / AutoFill / Semantic / Generators — `mapear-codebase` + USER-PROFILE.md does more.
- Built-in agents/skills — yours come from `kit/`, the user's source.
- Full harness (sessions, traces, sensors, contracts, policies, datasets) — too much for a personal kit; we kept the lightweight pieces (failures + replays) and dropped the rest.

---

## Roadmap

Concrete next steps if you want to push this further:

- **HTTP transport** — for connecting from cloud IDEs that don't speak stdio MCP.
- **Per-target `mode` overrides** — `kit/.kit-config.json` with `{ "claude-code": "reference", "cursor": "copy" }` so different IDEs can have different sync strategies.

---

## Releasing (maintainers)

The repo auto-publishes to npm via GitHub Actions whenever a version tag (`v*`) is pushed.

### One-time setup

1. **Create the GitHub repo** (if not already):
   ```bash
   gh repo create luanpdd/kit-mcp --public --source . --push
   ```
   Or manually create on github.com and `git remote add origin … && git push -u origin main`.

2. **Generate an npm token** for the bot at https://www.npmjs.com/settings/luanpdd/tokens
   - Type: **Granular Access Token**
   - Description: `kit-mcp ci`
   - Expiration: 1 year
   - Permissions: **Read and write** for `@luanpdd/*` scope
   - **Allow this token to bypass 2FA**: ✅ enabled (required for CI)

3. **Add the token as a GitHub secret**:
   ```bash
   gh secret set NPM_TOKEN
   # paste the npm_xxxxx token when prompted
   ```

### Release flow

```bash
# 1. Bump version, commit, tag — all in one command
npm version patch     # or minor / major

# 2. Push the commit AND the tag
git push --follow-tags

# 3. GitHub Action takes over: runs CLI smoke tests, then `npm publish --provenance`
#    Watch progress: gh run watch
```

The publish workflow refuses to ship if `package.json` version doesn't match the tag — you can't publish a mislabeled release by accident.

The CI workflow runs CLI smoke tests on **Ubuntu / macOS / Windows × Node 20 / 22** on every PR and push to `main`.

### Manual publish (bypass Actions)

```bash
npm publish --access public
# Requires you to be logged in (npm whoami) AND either pass --otp=XXXXXX
# or use a granular token with bypass-2FA in your local ~/.npmrc.
```

## Smoke tests

Verify everything works after install:

```bash
node bin/cli.js kit list-agents | head -20      # should print 18 agent entries
node bin/cli.js sync targets                    # 8 IDEs
node bin/cli.js gates list                      # 5 gates
node bin/cli.js install dry-run claude-code     # JSON preview, no write
node bin/mcp.js < /dev/null & sleep 1; kill %1  # MCP server boots and waits on stdio
```

---

## License

MIT — do whatever you want, no warranty.
