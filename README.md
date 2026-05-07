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

**Lines of source code:** ~1300. **Runtime dependencies:** 5 (`@modelcontextprotocol/sdk`, `commander`, `chokidar`, `picocolors`, `@inquirer/prompts`). **Build step:** none — plain ESM Node.js 20+.

### About the bundled workflow

The bundled `kit/` is an opinionated **brownfield planning workflow** in Portuguese — milestones, phases, requirements, planning, execution with atomic commits and checkpoints, retrospective auditing. Installing `@luanpdd/kit-mcp` and syncing into your IDE gives you all 60+ slash-commands, 24+ agents, plus the framework templates that they delegate into.

If that's not what you want, point `--kit-root` at your own folder and ignore everything under `kit/` — the infrastructure (registry, sync, gates, forensics, MCP server) works the same regardless of what kit you load.

### Observability suite (v1.9)

A complete observability layer derived from *Observability Engineering* (Charity Majors, Liz Fong-Jones, George Miranda — O'Reilly, 2022) ships in the kit. It integrates deeply with the Supabase suite (v1.8) — every Supabase agent now consults observability skills, and the new `incident-investigator` agent uses `mcp__supabase__get_logs` / `execute_sql` / `get_advisors` to apply the **Core Analysis Loop** on real incidents.

**11 skills** in `kit/skills/`:
- `_shared-observability/glossary.md` — canonical bilingual vocabulary (PT-BR↔EN)
- `structured-events`, `distributed-tracing`, `opentelemetry-standard`, `core-analysis-loop` — foundationals
- `observability-driven-development` — the 4 pre-PR questions ("Does it do what I expected? Compare to previous version? Are users using? Anomalies emerge?")
- `event-based-slos`, `burn-rate-alerting` — SLO definition + predictive burn alerts
- `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model` — scale + culture

**5 agents** in `kit/agents/`:
- `observability-instrumenter` — generates OTel + canonical attribute patches
- `incident-investigator` — Core Analysis Loop with persistent state in `.planning/investigations/`
- `slo-engineer` — generates `SLO.md` + SQL migrations to materialize SLI events
- `burn-rate-forecaster` — calculates burn rate, ETA exhaustion, alert config
- `omm-auditor` — scores 5 OMM capabilities (resilience, code quality, complexity, release cadence, user behavior)

**6 commands**:
- `/observabilidade <subcommand>` — single orchestrator (analog to `/supabase`) — dispatches to the 5 agents above with PT/EN synonyms
- `/instrumentar-fase` — generates `INSTRUMENTATION.md` per plan after `/planejar-fase`
- `/investigar-producao` — guided Core Analysis Loop with persistent state
- `/definir-slo` — creates SLO definition + SQL materialized view
- `/burn-rate-status` — table `[SLO | budget burned | ETA | action]`, also runnable in `/loop`
- `/auditar-observabilidade` — generates OMM-REPORT.md scored

**Quick start example:**
```bash
# Define an SLO for a critical journey
/observabilidade slo "checkout"

# Investigate a production incident with Core Analysis Loop
/observabilidade investigar "checkout SLO burn rate = 8 às 14:32"

# Score project against Observability Maturity Model
/observabilidade omm
```

### SRE Engagement suite (v1.10)

A production engineering layer derived from *Site Reliability Engineering: How Google Runs Production Systems* (Beyer, Jones, Petoff, Murphy — Google/O'Reilly, 2016) ships in the kit. It composes with the Supabase suite (v1.8) and the Observability suite (v1.9) into a coherent production engineering stack — Supabase agents now suggest PRR before launch, every Edge Function template includes the **4 golden signals**, and `incident-investigator` outputs feed directly into blameless postmortems via `/postmortem --from-investigation <id>`.

**6 skills** in `kit/skills/`:
- `_shared-sre/glossary.md` — canonical bilingual vocabulary (PT-BR↔EN) — SLI/SLO/SLA, error budget, burn rate, toil, postmortem, blameless, PRR, golden signals, risk continuum, MTTR/MTBF
- `sre-risk-management` — risk continuum (cap 3), 99.99% wisdom ("as reliable as needs to be, no more"), error budget as explicit risk × innovation balance
- `four-golden-signals` — Latency + Traffic + Errors + Saturation (cap 6), histograms with exponential bucketing, success vs error latency separated, percentiles vs mean (long tail)
- `eliminating-toil` — canonical toil definition (manual + repetitive + automatable + tactical + no enduring value + scales linearly), ≤ 50% rule (cap 5), automation patterns
- `blameless-postmortems` — canonical 9-section template (cap 15), "no postmortem left unreviewed", blame culture as anti-pattern, Wheel of Misfortune
- `production-readiness-review` — PRR checklist (cap 32) — 6 axes (System architecture, Instrumentation, Emergency response, Capacity planning, Change management, Performance), 3 engagement models

**4 agents** in `kit/agents/`:
- `golden-signals-instrumenter` — specialization of `observability-instrumenter` (v1.9); generates OTel patches with the 4 golden signals (Latency=histogram, Traffic=counter, Errors=counter by `error.type`, Saturation=gauge)
- `toil-auditor` — analyzes git log + shell scripts + manual commands in README/runbooks; produces `TOIL-AUDIT.md` with P0/P1/P2 priority + estimated effort
- `postmortem-writer` — natural continuation of `incident-investigator` (v1.9); reads `.planning/investigations/<id>.md` and produces blameless postmortem (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC)
- `prr-conductor` — conducts Production Readiness Review for service/feature; reads schema (Supabase MCP), Edge Functions, `.planning/slos/`, audit logs; produces `PRR-REPORT.md` scored across the 6 axes

**6 commands**:
- `/sre <subcommand>` — single orchestrator (analog to `/supabase` v1.8 and `/observabilidade` v1.9) — dispatches to the 4 agents with PT/EN synonyms
- `/golden-signals` — invokes `golden-signals-instrumenter` for service/Edge Function/phase; generates `GOLDEN-SIGNALS.md` with OTel-ready instrumentation
- `/auditar-toil` — invokes `toil-auditor`; generates `.planning/TOIL-AUDIT.md`
- `/postmortem` — invokes `postmortem-writer`; supports `--from-investigation <id>` (continue from v1.9 investigation) or `--incident "<description>"` (standalone)
- `/prr` — invokes `prr-conductor`; supports `--service <name>` or `--feature <description>`; generates `PRR-REPORT.md`
- `/risk-budget` — displays current error budget vs risk continuum, citing SLOs from v1.9 (`.planning/slos/`); applies `sre-risk-management` skill

**3 audit gates** in `gates/`:
- `golden-signals-coverage` (blocking, pre-verify) — verifies code in `supabase/functions/**`, `src/**`, `lib/**` covers the 4 golden signals (skips gracefully on content-only phases)
- `postmortem-template-required` (blocking, pre-conclude) — blocks `/concluir-marco` if any `.planning/investigations/<id>.md` lacks a corresponding `.planning/postmortems/<id>.md` (`Status: INCONCLUSIVE` is the only exception)
- `prr-checklist-coverage` (blocking, pre-verify) — verifies every `PRR-REPORT.md` in `.planning/prr/**/*.md` covers the 6 canonical axes; "skipping an axe = invalid approval"

**Lifecycle integration:**
- `/forense` — after Core Analysis Loop closes with VALIDATED root cause, suggests chain `/postmortem --from-investigation <id>` (Phase 40 / INT-FW-V2-01)
- `/concluir-marco` — opt-in gate `workflow.complete_milestone_prr_gate=true` requires `PRR-REPORT.md` with status `passed` for production-bound features before archive (Phase 40 / INT-FW-V2-02)
- `/auditar-marco` — auto-invokes `/auditar-toil` when `workflow.audit_milestone_toil=true` (default); result feeds OMM Capacidade 3 scoring via `omm-auditor` (Phase 40 / INT-FW-V2-03)

**Quick start example — end-to-end SRE workflow:**
```bash
# Before launching a new feature in production — PRR
/sre prr --feature "checkout v2"

# While instrumenting service — apply 4 golden signals
/sre golden-signals supabase/functions/orders/index.ts

# Audit team toil quarterly
/sre toil

# When SLO burn alert fires — investigate (v1.9 deep loop), then postmortem (v1.10)
/investigar-producao "checkout SLO burn rate = 8 às 14:32"
/sre postmortem --from-investigation checkout-2026-05-07
# Or for framework-level failures:
/forense "framework workflow X falhou em produção"
/sre postmortem --incident "framework workflow X failed (see .planning/forensics/report-*)"

# Risk dashboard against SLO budgets
/sre risk-budget
```

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

The CLI mirrors the MCP tools 1:1. **By default the CLI prints colored, human-readable tables and summary panels.** Add `--json` to restore raw JSON-to-stdout (machine-readable, the default in v1.0). The global `--kit-root` flag overrides the kit source for any subcommand.

```bash
kit list-agents              # human: colored table, name + description
kit list-agents --json       # machine: JSON array

kit sync install claude-code # human: progress bar + summary panel
kit sync install claude-code --json  # machine: full result object
```

In non-TTY mode (pipes, CI), animations degrade to linear status lines automatically. `NO_COLOR=1` disables colors entirely; `FORCE_COLOR=1` forces them on even in pipes.

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

| IDE | rules → | agents → | commands → | skills → | framework → | hooks → |
|---|---|---|---|---|---|---|
| Claude Code | `CLAUDE.md` | `.claude/agents/*.md` | `.claude/commands/*.md` | `.claude/skills/*/` | `.claude/framework/**` | `.claude/hooks/**` |
| Cursor | `.cursor/rules/*.mdc` | `.cursor/agents/*.md` | — | — | — | — |
| Codex | `AGENTS.md` | — | — | `.codex/skills/*/` | — | — |
| Gemini CLI | `GEMINI.md` | — | — | `.gemini/skills/*/` | — | — |
| Copilot | `.github/copilot-instructions.md` | `.github/agents/*.agent` | — | `.github/skills/*/` | — | — |
| Windsurf | `.windsurf/rules/*.md` | `.windsurf/agents/*.md` | — | `.windsurf/skills/*/` | — | — |
| Antigravity | `.agents/rules/*.md` | `.agents/agents/*.md` | — | `.agents/workflows/*/` | — | — |
| Trae | `.trae/rules/*.md` | `.trae/agents/*.md` | — | — | — | — |

A capability marked `—` is not supported by that IDE. Adding a new IDE = one entry in [`src/core/registry.js`](src/core/registry.js).

**About `framework` and `hooks`:** these are *mirror-tree* capabilities — the entire `kit/framework/` and `kit/hooks/` subtrees are copied verbatim into `.claude/framework/` and `.claude/hooks/`. They're needed by the bundled workflow because slash-commands like `/novo-marco` reference framework files via paths like `@./.claude/framework/workflows/new-milestone.md`. A `.kit-mcp-managed` marker is written at the root of each managed tree so `kit sync remove` can clean up safely without touching directories you authored yourself.

### `kit install ...` — register kit-mcp into an IDE's MCP config

```bash
kit install targets                                           # list IDEs that support MCP config
kit install dry-run claude-code --scope user --via npx        # preview the JSON/TOML
kit install write claude-code   --scope user --via npx        # portable: uses `npx @luanpdd/kit-mcp`
kit install write claude-code   --scope project --via local   # local clone: uses ./bin/mcp.js absolute path
kit install write claude-code   --scope user --via global     # assumes `npm install -g @luanpdd/kit-mcp`
kit install write                                             # no target: opens an interactive selector (TTY)
kit install write claude-code --yes                           # CI: skip the confirm prompt
```

Since v1.1, `install write` always **previews** the JSON/TOML it's about to write and asks you to confirm. Pass `--yes` (CI mode) or `--json` to bypass the prompt. Without a target argument in TTY mode, you get an arrow-key selector listing all 8 IDEs.

`--via` decides how the IDE will invoke the server:

| Mode | Command in IDE config | When to use |
|---|---|---|
| `npx` (recommended) | `npx -y @luanpdd/kit-mcp` | Portable — works on any machine |
| `local` | `node /abs/path/to/clone/bin/mcp.js` | You're hacking on kit-mcp itself |
| `global` | `kit-mcp` | After `npm install -g @luanpdd/kit-mcp` — fastest startup |

### `kit reverse-sync ...` — bring IDE edits back to the canonical kit

If you edited an agent/command/skill/framework/hook **directly inside the IDE's folder** (`.claude/agents/foo.md`, `.claude/framework/workflows/bar.md`, `.claude/hooks/baz.js`, …) instead of in your kit, this brings those edits back so the canonical absorbs them.

```bash
kit reverse-sync detect claude-code --project-root .
kit reverse-sync apply  claude-code --project-root . --strategy merge --dry-run
kit reverse-sync apply  claude-code --project-root . --strategy merge
kit reverse-sync apply  claude-code --project-root . --strategy overwrite --only agent/foo
kit reverse-sync apply  claude-code --project-root . --strategy overwrite --only framework/workflows/new-milestone.md
```

**Strategies:** `skip` (list-only), `merge` (canonical frontmatter + edited body — for agents/commands/skills), `overwrite`, `rename` (preserve both as `-from-{ide}.md`).

**Mirror-tree caps (`framework`, `hooks`):** files have no frontmatter, so `merge` degenerates to `overwrite` (with a note). The `.kit-mcp-managed` marker is automatically excluded from candidates. Filter individual files with `--only framework/<rel>` or `--only hooks/<file>`.

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

### `kit ui ...` — live process viewer (sidecar) — _new in 1.2_

A tiny localhost web app that streams what kit-mcp is doing while your IDE drives it. Strictly opt-in: ignore it and v1.1 behavior is unchanged.

```bash
# In one terminal — keeps running until Ctrl+C
kit ui start

# In another terminal (or via Claude Code / Cursor) — runs as before, but events
# are now also broadcast to the sidecar window
kit sync install claude-code

# Tools too: pass autoSpawn:true on the MCP side, or just `kit ui start` first
kit ui status
kit ui stop
```

What you get:

- A single browser tab at `http://127.0.0.1:7100` (or the next free port up to 7199)
- Live event stream over Server-Sent Events — `tool_invocation`, `progress`, `error`, `milestone`, `run.start`, `run.end`
- Filters by event type and substring; pause/resume; auto-scroll; dark mode tracks the OS
- The sidecar shuts itself down after 30 minutes of idle; `--idle-ms 0` disables that

**Auto-spawn from MCP tools.** Pass `autoSpawn: true` in the inputSchema of `sync` (action=install), `reverse-sync` (action=apply), or `gates` (action=run). The MCP server will spawn `bin/ui.js` detached, wait for it to come online, open your default browser, and stream that tool's progress. Trivial tools (`kit list-*`, `forensics`, `install`) deliberately don't accept `autoSpawn` — the overhead isn't worth it.

**Opt-out always available.** From the CLI: pass `--no-ui` or set `KIT_MCP_NO_UI=1`. The sidecar is never started behind your back; it's only used when a lockfile is already present (someone ran `kit ui start` or `autoSpawn: true`).

**Security model.** Sidecar binds to `127.0.0.1` literally — never `0.0.0.0`, never `localhost` (which resolves to `::1` on Windows). Every route validates the `Host` header to mitigate DNS rebinding. CSP is strict (`default-src 'self'; …; frame-ancestors 'none'`). Paths in payloads are scrubbed (`$HOME → ~`, `<projectRoot> → <project>`) so screenshots don't leak directory structure. No persistence, no TLS, no auth — single-user dev workstation only. Full threat model in [`docs/sidecar-security.md`](docs/sidecar-security.md).

**First-run quirks.** Windows Defender / macOS firewall may prompt the first time `kit ui start` binds. Approving "Private networks" is enough — the server doesn't accept anything from outside loopback regardless. On WSL, `kit ui start` opens the URL in the Windows host browser via `wslview`. In CI / SSH / `TERM=dumb`, browser launch is suppressed and the URL is printed to stderr instead.

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

## Tests

Built on `node:test` (zero dependencies). Two suites:

```bash
npm test                # unit — kit parser, sync (all modes), reverse-sync, gates, registry
npm run test:integration  # integration — spawns bin/cli.js end-to-end on a temp project
npm run test:all          # both
```

Plus the original quick smokes:

```bash
node bin/cli.js kit list-agents | head -5         # 19 bundled agents
node bin/cli.js sync targets                      # 8 IDEs
node bin/cli.js gates list                        # 5 gates
node bin/cli.js install dry-run claude-code --via npx
```

CI runs unit + integration + smoke + MCP boot on Ubuntu / macOS / Windows × Node 20 / 22 on every push and PR.

---

## License

MIT — see [LICENSE](LICENSE).

Copyright © 2026 luanpdd.
