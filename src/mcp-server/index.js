// kit-mcp server — exposes 9 tools, each with action-based dispatch (or none).
//
//   kit              action: list-agents | list-commands | list-skills | get | search
//   sync             action: targets | status | install | remove
//   gates            action: list | get | for-stage
//   forensics        action: collect | summarize | write-learnings | list-replays | record-replay | load-replay
//   install          action: targets | install | dry-run                    (registers this MCP into an IDE)
//   projects         action: list | get | doctor                             (DIR-05 — registro canônico PROJETOS.md)
//   metrics-snapshot (parameterless)                                          (OBS-18 four-golden-signals readout)
//
// Transport: stdio (MCP standard).

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { listKit, searchKit, findItem, BUNDLED_KIT_ROOT } from '../core/kit.js';
import { listTargets } from '../core/registry.js';
import { syncTo, statusOf, removeFrom, summarize } from '../core/sync.js';
import { listPacks, resolvePacks, readLockfile, explicitPacksFromLockfile, packResourceCounts } from '../core/packs.js';
import { addPacks, removePacks } from '../core/pack-ops.js';
import { detectReverse, applyReverse } from '../core/reverse-sync.js';
import { validateProjectRoot } from '../core/path-safety.js';
import { sanitizeMcpError } from '../core/error-redaction.js';
import { listGates, getGate, gatesForStage } from '../core/gates.js';
import { runGate } from '../core/gate-runner.js';
import { collectFailures, summarizeByAgent, writeLearnings } from '../core/failures.js';
// DIR-05 (multi-projeto): parser puro do registro canônico PROJETOS.md.
// A tool `projects` consome o arquivo em runtime (list/get/doctor) — o fs
// (leitura do arquivo + existência de paths no doctor) fica todo no handler.
import { parseProjects, isValidRepoUrl } from '../core/projects.js';
import { reflect } from '../core/reflect.js';
import { recordReplay, listReplays, loadReplay, annotateReplay } from '../core/replays.js';
import { installMcp, listInstallTargets } from './install.js';
import { ensureSidecar } from '../ui/auto-spawn.js';
import { wrapProgressForUi } from '../ui/wrapper.js';
import { incrementInvocation, recordLatency, snapshot as metricsSnapshot, persistSnapshot } from '../core/metrics.js';
import { logEvent } from '../core/logger.js';
import { notify, isNotifyEnabled } from '../core/notify.js';
// Phase 172 (v1.37.0): cost-tracking suite — 5 handlers reuse the M2 aggregators
// (parser → dedup → price pipeline). MCP layer only validates args, calls the
// aggregator, optionally persists, and returns the shape canônico defined in
// 172-SPEC.md. NO new runtime deps (manual typeof/Array.isArray validation).
import { aggregateToday } from '../core/cost/aggregate-today.js';
import { aggregateSession } from '../core/cost/aggregate-session.js';
import { aggregateBlocks } from '../core/cost/aggregate-blocks.js';
import { aggregatePhase } from '../core/cost/aggregate-phase.js';
import { aggregateEstimate } from '../core/cost/aggregate-estimate.js';
import { persistSnapshot as persistCostSnapshot } from '../core/cost/persist-snapshot.js';
// Note: roots.js is imported dynamically inside handlers that need it
// (handleAutoInstall, handleAckRestart) — keeps boot path minimal.

const TOOLS = [
  {
    name: 'kit',
    // Phase 170 (v1.29): description enriched with trigger keywords so MCP
    // hosts route here on relevant intents even in MCP-pure mode (before
    // auto-install made .claude/ native). Keep under 1024 chars (host limit).
    // v1.30.3 (#5): counts are {{PLACEHOLDERS}} — injected live at ListTools
    // time from listKit() so they never drift from the actual catalog.
    description: 'Browse the personal kit: {{AGENTS}} agents, {{COMMANDS}} commands, {{SKILLS}} skills. Call this when the user mentions Supabase (RLS, branching, migrations, Edge Functions, Custom Claims, Postgres Roles, Storage, Realtime, pgvector), multi-tenant SaaS, agentic harness, characterization tests, legacy refactor, observability (SLO, golden signals, error budgets), DDIA topics (consistency, replication lag, schema evolution), SRE (postmortems, toil, PRR), CI/CD (hermetic builds, pipelines), or any workflow that benefits from the canonical patterns. Use action=search to discover, action=get to read the full prompt/skill.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list-agents', 'list-commands', 'list-skills', 'get', 'search'] },
        kind:   { type: 'string', enum: ['agent', 'command', 'skill'], description: 'For action=get' },
        name:   { type: 'string', description: 'For action=get' },
        query:  { type: 'string', description: 'For action=search' },
        terse:  { type: 'boolean', description: 'For action=list-*: omit description, return only {kind, name}. Default false (PERF-15-01).' },
        tier:   { type: 'string', enum: ['core', 'specialized'], description: 'For action=list-agents: filter by tier. core = workflow backbone (~13); specialized = domain-specific (~54). Omit for all.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'sync',
    description: 'Project the kit into an IDE-specific layout (markdown references by default).',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['targets', 'status', 'install', 'remove'] },
        target:      { type: 'string', description: 'IDE id (e.g. claude-code, cursor, codex). Use action=targets to list.' },
        projectRoot: { type: 'string', description: 'Defaults to cwd' },
        mode:        { type: 'string', enum: ['reference', 'copy'], description: 'Default: reference' },
        dryRun:      { type: 'boolean' },
        autoSpawn:   { type: 'boolean', description: 'On action=install: auto-start the sidecar UI (kit ui) if not running and stream progress to it.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'reverse-sync',
    description: 'Detect and apply edits made directly in an IDE back to the canonical kit/.',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['detect', 'apply'] },
        target:      { type: 'string', description: 'IDE id (e.g. claude-code, cursor)' },
        projectRoot: { type: 'string' },
        strategy:    { type: 'string', enum: ['skip', 'overwrite', 'merge', 'rename'], description: 'For action=apply' },
        only:        { type: 'array', items: { type: 'string' }, description: 'For action=apply: limit to these kind/name pairs' },
        dryRun:      { type: 'boolean' },
        autoSpawn:   { type: 'boolean', description: 'On action=apply: auto-start the sidecar UI (kit ui) if not running and stream progress to it.' },
      },
      required: ['action', 'target'],
    },
  },
  {
    name: 'gates',
    description: 'List, fetch, or execute reusable workflow gates (regression, confidence, etc).',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['list', 'get', 'for-stage', 'run'] },
        id:          { type: 'string', description: 'For action=get or action=run' },
        stage:       { type: 'string', enum: ['pre-plan', 'pre-execute', 'pre-verify', 'post-verify', 'any'], description: 'For action=for-stage' },
        projectRoot: { type: 'string', description: 'For action=run' },
        autoSpawn:   { type: 'boolean', description: 'On action=run: auto-start the sidecar UI (kit ui) if not running and stream progress to it.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'forensics',
    description: 'Failure dataset & replays — close the learning loop on failed agent runs.',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['collect', 'summarize', 'write-learnings', 'list-replays', 'record-replay', 'load-replay', 'annotate-replay', 'reflect'] },
        projectRoot: { type: 'string' },
        replayId:    { type: 'string' },
        payload:     { type: 'object', description: 'For action=record-replay: the Task() payload to store.' },
        outcome:     { type: 'object', description: 'For action=annotate-replay' },
        agent:       { type: 'string', description: 'For action=reflect: agent name (e.g. executor)' },
        dryRun:      { type: 'boolean', description: 'For action=reflect: only save the assembled prompt, no API call' },
      },
      required: ['action'],
    },
  },
  {
    name: 'install',
    description: 'Register this kit-mcp server into an IDE\'s MCP config (Claude/Cursor/Codex/Antigravity/Windsurf).',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['targets', 'install', 'dry-run'] },
        target:      { type: 'string', description: 'IDE id. Use action=targets to list.' },
        scope:       { type: 'string', enum: ['user', 'project'], description: 'Default: user' },
        name:        { type: 'string', description: 'Server name in the IDE config. Default: kit' },
        via:         { type: 'string', enum: ['local', 'npx', 'global'], description: 'How the IDE will invoke the server. Default: local (this clone)' },
        pkg:         { type: 'string', description: 'npm package name (only with via=npx). Default: @luanpdd/kit-mcp' },
        force:       { type: 'boolean', description: 'Overwrite existing entry with same name' },
        projectRoot: { type: 'string' },
      },
      required: ['action'],
    },
  },
  {
    // OBS-18 (Phase 94.01): expose four-golden-signals data for the MCP server itself.
    // Read-only (no auth needed beyond the underlying transport): returns counters
    // keyed `${tool}:${status}` and per-tool latency p50/p95/p99/count.
    name: 'metrics-snapshot',
    description: 'Read in-memory golden-signals metrics for this MCP server (counters + latency p50/p95/p99 per tool).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    // Phase 167 (v1.29): auto-sync the kit content into the host project's
    // .claude/ (or equivalent) directory so agents become real subagent_types,
    // skills get native auto-trigger, and commands appear as slash-commands.
    // Idempotent — re-runs are no-ops if .claude/.kit-mcp-version matches the
    // running server's package version. Permission-gated by the host.
    name: 'auto-install',
    description: 'IMPORTANT for first contact: project kit/ into the host\'s native layout (.claude/agents/, skills/, commands/) so {{AGENTS}} agents become real subagent_types in the Agent tool, {{SKILLS}} skills get native auto-trigger via descriptions, and {{COMMANDS}} commands appear as /slash-commands in the IDE. Idempotent — re-running is a no-op if already in sync. Run once per project on first kit-mcp contact; restart the IDE session after to load the new agents/skills/commands. After restart, call ack-restart to clear the marker.',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['install', 'check'], description: 'install: write files. check: read-only drift report. Default: install.' },
        target:      { type: 'string', description: 'IDE id (claude-code, cursor, …). Defaults to claude-code.' },
        projectRoot: { type: 'string', description: 'Override the auto-detected project root. Usually omitted — server reads it from MCP roots capability.' },
        force:       { type: 'boolean', description: 'Re-write even if .kit-mcp-version already matches. Default: false.' },
      },
    },
  },
  {
    // Phase 168 (v1.29): acknowledge the restart-required marker after the
    // user reloads the IDE session. Removes .claude/.kit-mcp-restart-required
    // so doctor stops flagging it.
    name: 'ack-restart',
    description: 'Acknowledge that the IDE session was restarted after kit:auto-install. Removes the .kit-mcp-restart-required marker so kit:doctor stops warning. Called automatically by the harness when it detects the marker after reload, or manually by the user.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
      },
    },
  },
  // Phase 172 (v1.37.0): cost-tracking suite — 5 read-only tools that parse
  // Claude Code JSONL transcripts, dedup, price via embedded LiteLLM snapshot,
  // and aggregate per dimension. Disambiguation: these tools answer "how much
  // USD/tokens did I spend?" — NOT "is my SLO error budget burning?" (that is
  // burn-rate-status / risk-budget). Naming kebab-case for consistency with
  // metrics-snapshot / reverse-sync / ack-restart.
  {
    name: 'cost-today',
    description: 'Custo Claude Code do dia corrente (USD + tokens por modelo) lendo JSONLs de ~/.claude/projects/. tz default UTC (paridade ccusage). Retorna shape canônico: total_usd, by_model, entry_count, deduped_count, skipped_entry_count, parse_error_count, unknown_models, pricing_source, pricing_staleness_days. Triggers: "quanto gastei hoje", "custo do dia", "spent today", "daily cost". Use cost-session para a sessão atual, cost-blocks para janelas de 5h, cost-phase para uma fase do framework.',
    inputSchema: {
      type: 'object',
      properties: {
        config_dirs:     { type: 'array', items: { type: 'string' }, description: 'Override CLAUDE_CONFIG_DIR. Default: discovery automática (CLAUDE_CONFIG_DIR > XDG_CONFIG_HOME/claude > ~/.claude > %APPDATA%/claude no Windows).' },
        tz:              { type: 'string', description: 'IANA timezone (ex: America/Sao_Paulo). Default: UTC (paridade ccusage).' },
        date:            { type: 'string', description: 'Override YYYY-MM-DD do dia alvo (default: hoje no tz).' },
        refresh_pricing: { type: 'boolean', description: 'Opt-in fallback models.dev pra modelos não cobertos pelo snapshot embedded. Default: false.' },
        persist:         { type: 'boolean', description: 'Grava snapshot em .planning/costs/<ts>.json (opt-in). Default: false.' },
        projectRoot:     { type: 'string', description: 'Para persist: raiz do projeto. Default: cwd.' },
      },
    },
  },
  {
    name: 'cost-session',
    description: 'Custo Claude Code de uma sessão específica (ou da sessão ativa auto-deduzida pelo arquivo JSONL mais recente com mtime < 30min). Retorna shape canônico + session_id, started_at, last_activity_at, source_file. Triggers: "custo da sessão", "session cost", "quanto essa conversa gastou", "current session usd". Use cost-today para o dia inteiro.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id:      { type: 'string', description: 'UUID da sessão. Omita para auto-deduzir a sessão ativa.' },
        transcript_path: { type: 'string', description: 'Path do arquivo JSONL (basename sem .jsonl = session_id). Alternativa a session_id.' },
        config_dirs:     { type: 'array', items: { type: 'string' } },
        max_idle_ms:     { type: 'number', description: 'Janela de inatividade para considerar sessão ativa (auto-deduce). Default: 1800000 (30min).' },
        refresh_pricing: { type: 'boolean' },
        persist:         { type: 'boolean' },
        projectRoot:     { type: 'string' },
      },
    },
  },
  {
    name: 'cost-blocks',
    description: 'Custo Claude Code por janelas deslizantes de 5h com gap detection (entries separadas por >5h iniciam novo bloco — pattern ccusage). Retorna blocks[] com started_at, ended_at, total_usd, by_model, entry_count, is_active + shape canônico agregado. Triggers: "custo por bloco", "5h windows", "blocks cost", "ccusage blocks". Use cost-today para dia, cost-session para sessão.',
    inputSchema: {
      type: 'object',
      properties: {
        config_dirs:     { type: 'array', items: { type: 'string' } },
        tz:              { type: 'string' },
        refresh_pricing: { type: 'boolean' },
        persist:         { type: 'boolean' },
        projectRoot:     { type: 'string' },
      },
    },
  },
  {
    name: 'cost-phase',
    description: 'Custo Claude Code correlacionado com uma fase do framework kit-mcp (.planning/phases/<id>-*/). Cruza mtime de SPEC.md + completed_at de STATE.md + git log para inferir janela temporal. Retorna shape canônico + phase_id, phase_slug, correlation_confidence (high/medium/low/unknown). Diferencial vs ccusage: contexto de workflow. Triggers: "custo da fase", "quanto a fase X gastou", "phase cost".',
    inputSchema: {
      type: 'object',
      properties: {
        phase_id:        { type: 'string', description: 'ID numérico ou string da fase (ex: "172").' },
        config_dirs:     { type: 'array', items: { type: 'string' } },
        refresh_pricing: { type: 'boolean' },
        persist:         { type: 'boolean' },
        projectRoot:     { type: 'string', description: 'Raiz onde está .planning/phases/. Default: cwd.' },
      },
      required: ['phase_id'],
    },
  },
  {
    // Phase v1.41 (Content Packs Fase 3): manage the installed pack selection.
    // Read actions (list/info/resolve/doctor) are safe; add/remove re-sync + write
    // the lockfile (they receive explicit ids); store is TTY-only → blocked in MCP.
    name: 'pack',
    description: 'Gerencia Content Packs (subconjuntos instaláveis do kit). action=list catálogo com contagens, info detalha um pack, resolve mostra o fecho de dependências, doctor reporta packs instalados por IDE, add/remove ajustam a seleção e re-sincronizam (escrevem o lockfile .kit-mcp-packs.json). Triggers: "instalar pack", "remover pack", "quais packs", "content pack".',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['list', 'info', 'resolve', 'doctor', 'add', 'remove'] },
        id:          { type: 'string', description: 'For action=info' },
        packs:       { type: 'array', items: { type: 'string' }, description: 'Pack ids for action=resolve|add|remove' },
        target:      { type: 'string', description: 'For add/remove/doctor: pin to one IDE. Default: todos os targets instalados.' },
        cascade:     { type: 'boolean', description: 'For action=remove: também remove packs dependentes (fecho reverso).' },
        projectRoot: { type: 'string', description: 'For add/remove/doctor. Default: cwd.' },
      },
      required: ['action'],
    },
  },
  {
    // DIR-05 (multi-projeto como produto): expõe o registro canônico
    // PROJETOS.md (criado/gerido pelo comando /base) como capability runtime.
    // Read-only — list/get leem e parseiam o arquivo; doctor adiciona checks
    // de existência dos paths locais via fs. Nenhuma action escreve em disco.
    name: 'projects',
    description: 'Consome o registro de projetos (PROJETOS.md na raiz, gerido pelo comando /base) em runtime. action=list retorna projeto principal + projetos conectados com status de completude por projeto; get busca um projeto pelo nome (pasta local, repositório, documentação local); doctor gera relatório de validação — campos obrigatórios, existência das pastas locais no disco e shape https?:// das URLs. Triggers: "registro de projetos", "projetos conectados", "PROJETOS.md", "/base", "projeto principal", "onde fica o projeto X".',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', enum: ['list', 'get', 'doctor'] },
        name:        { type: 'string', description: 'For action=get — nome do projeto como registrado no PROJETOS.md (case-insensitive).' },
        projectRoot: { type: 'string', description: 'Raiz onde está o PROJETOS.md. Default: cwd.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'cost-estimate',
    description: 'Estima custo USD de um prompt ANTES de mandar para Claude. Heurística chars/4 com range ±30% (sem tokenizer real na v1.37.0 — debt em SKILL.md). Retorna estimated_input_tokens, estimated_output_tokens, estimated_usd, estimated_usd_range:[low,high], disclaimer. Triggers: "quanto vai custar", "estimativa de prompt", "estimate cost", "price this prompt".',
    inputSchema: {
      type: 'object',
      properties: {
        text:            { type: 'string', description: 'Texto do prompt a estimar.' },
        model:           { type: 'string', description: 'Modelo alvo. Default: claude-sonnet-4-5.' },
        output_ratio:    { type: 'number', description: 'Multiplicador input → output esperado. Default: 3.' },
        chars_per_token: { type: 'number', description: 'Override heurística. Default: 4.' },
      },
      required: ['text'],
    },
  },
];

// DRIFT-13-03: read version from package.json at module load (NOT inside
// createServer — re-reading on every call adds zero value). Same pattern as
// bin/cli.js:43-51. Both files are 2 levels deep from repo root, so the
// '..', '..' resolution works identically. Falls back to 'unknown' if the
// package.json lookup fails (unusual install layout).
function readPkgVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '..', '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

export const PKG_VERSION = readPkgVersion();

// --- handlers ---

async function handleKit(args) {
  const kit = await listKit();
  // PERF-15-01: terse mode skips description payload entirely. Backward-compat:
  // args.terse undefined/false preserves slim()+summarize() cap-80 behavior.
  const variant = args.terse === true ? slimTerse : slim;
  switch (args.action) {
    case 'list-agents': {
      // #6 (v1.30.4): optional tier filter — core vs specialized. Agents
      // without a `tier` frontmatter field are treated as specialized so a
      // tier=core query never accidentally surfaces an untagged agent.
      let agents = kit.agents;
      if (args.tier === 'core' || args.tier === 'specialized') {
        agents = agents.filter((a) => (a.frontmatter?.tier ?? 'specialized') === args.tier);
      }
      return agents.map(variant);
    }
    case 'list-commands': return kit.commands.map(variant);
    case 'list-skills':   return [...kit.skills, ...kit.skillsExtras].map(variant);
    case 'get': {
      const item = findItem(kit, args.kind, args.name);
      if (!item) return { error: `Not found: ${args.kind}/${args.name}` };
      return { kind: item.kind, name: item.name, absPath: item.absPath, content: item.content ?? item.skillContent };
    }
    case 'search': return searchKit(kit, args.query ?? '');
    default: return { error: `Unknown action: ${args.action}` };
  }
}

// withAutoSpawn — if args.autoSpawn is set, ensure the sidecar is up and wrap
// the user-supplied onProgress so events flow there. Otherwise pass-through.
async function withAutoSpawn(args, tool, run) {
  const projectRoot = args.projectRoot || process.cwd();
  let wrapped = null;
  let sidecarInfo = null;

  if (args.autoSpawn) {
    sidecarInfo = await ensureSidecar({ projectRoot, openBrowserOnSpawn: true });
    if (sidecarInfo?.ready) {
      wrapped = wrapProgressForUi(null, { projectRoot, tool });
    }
  }

  // run(onProgress) — pass our wrapped callback (or undefined to no-op)
  try {
    const result = await run(wrapped);
    if (wrapped?.done) wrapped.done({ ok: true });
    return sidecarInfo ? { ...result, _sidecar: sidecarInfo } : result;
  } catch (err) {
    if (wrapped?.error) wrapped.error(err);
    throw err;
  }
}

async function handleSync(args) {
  switch (args.action) {
    case 'targets': return listTargets();
    case 'status':
    case 'install':
    case 'remove': {
      // SEC-14-03: MCP message must specify a path inside a git workspace.
      // CLI bypasses this — bin/cli.js trusts whoever invoked it (same trust
      // model as Phase 79.01's gates.run guard). status is read-only but
      // included for defense-in-depth and a single uniform error surface.
      const guard = await validateProjectRoot(args.projectRoot);
      if (!guard.ok) return { error: guard.reason };
      const projectRoot = guard.resolvedPath;
      if (args.action === 'status') return statusOf(args.target, { projectRoot });
      if (args.action === 'install')
        return withAutoSpawn({ ...args, projectRoot }, 'sync.install', (onProgress) =>
          syncTo(args.target, { projectRoot, mode: args.mode, dryRun: args.dryRun, onProgress }));
      // action === 'remove'
      return removeFrom(args.target, { projectRoot });
    }
    default: return { error: `Unknown action: ${args.action}` };
  }
}

async function handleReverseSync(args) {
  switch (args.action) {
    case 'detect':
    case 'apply': {
      // SEC-14-03: same guard as handleSync — reverse-sync apply also writes
      // to disk (kit/<file>) so it must be on the same allowlist as sync.
      const guard = await validateProjectRoot(args.projectRoot);
      if (!guard.ok) return { error: guard.reason };
      const projectRoot = guard.resolvedPath;
      if (args.action === 'detect') return detectReverse(args.target, { projectRoot });
      // action === 'apply'
      return withAutoSpawn({ ...args, projectRoot }, 'reverse-sync.apply', (onProgress) =>
        applyReverse(args.target, {
          projectRoot,
          strategy: args.strategy, only: args.only, dryRun: args.dryRun,
          onProgress,
        }));
    }
    default: return { error: `Unknown action: ${args.action}` };
  }
}

async function handleGates(args) {
  switch (args.action) {
    case 'list':      return listGates();
    case 'get':       return getGate(args.id);
    case 'for-stage': return gatesForStage(args.stage);
    case 'run':
      // SEC-13-01: MCP transport must never execute shell — runGate spawns bash with
      // arbitrary content from gates/*.md (which reverse-sync can rewrite). Even with
      // {yes: true}, this skips the interactive "y/N before exec" promise. The CLI
      // entry point (`kit gates run <id>` via bin/cli.js) preserves the prompt and
      // remains the only path to executing gates.
      return {
        error: 'MCP gates.run requires interactive TTY confirmation; use `kit gates run` from CLI instead.',
      };
    default: return { error: `Unknown action: ${args.action}` };
  }
}

async function handleForensics(args) {
  const projectRoot = args.projectRoot;
  switch (args.action) {
    case 'collect':         return collectFailures({ projectRoot });
    case 'summarize': {
      const failures = await collectFailures({ projectRoot });
      return summarizeByAgent(failures);
    }
    case 'write-learnings': {
      const failures = await collectFailures({ projectRoot });
      return writeLearnings(failures, { projectRoot });
    }
    case 'list-replays':    return listReplays({ projectRoot });
    case 'record-replay':   return recordReplay(args.payload, { projectRoot });
    case 'load-replay':     return loadReplay(args.replayId, { projectRoot });
    case 'annotate-replay': return annotateReplay(args.replayId, args.outcome, { projectRoot });
    case 'reflect': return reflect({
      agent: args.agent, projectRoot, dryRun: args.dryRun,
      apply: false, interactive: false,  // MCP never auto-applies
    });
    default: return { error: `Unknown action: ${args.action}` };
  }
}

async function handleInstall(args) {
  switch (args.action) {
    case 'targets':  return listInstallTargets();
    case 'install':  return installMcp(args.target, { scope: args.scope, name: args.name, via: args.via, pkg: args.pkg, force: args.force, projectRoot: args.projectRoot });
    case 'dry-run':  return installMcp(args.target, { scope: args.scope, name: args.name, via: args.via, pkg: args.pkg, force: args.force, projectRoot: args.projectRoot, dryRun: true });
    default: return { error: `Unknown action: ${args.action}` };
  }
}

// Phase v1.41 (Content Packs Fase 3): pack management tool.
async function handlePack(args = {}) {
  const action = args.action;
  switch (action) {
    case 'list': {
      const [{ packs: catalog }, kit] = await Promise.all([listPacks(), listKit()]);
      const ids = Object.keys(catalog).sort((a, b) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)));
      return ids.map((id) => {
        const p = catalog[id];
        return {
          id, name: p.name, kind: p.kind, removable: p.removable !== false,
          requires: p.requires ?? [], recommends: p.recommends ?? [],
          counts: packResourceCounts(p, kit),
        };
      });
    }
    case 'info': {
      const { packs: catalog } = await listPacks();
      const p = catalog[args.id];
      if (!p) return { error: `Pack não encontrado: ${args.id}` };
      try { return { pack: p, resolved: resolvePacks([args.id], catalog) }; }
      catch (e) { return { error: e.message, code: e.code }; }
    }
    case 'resolve': {
      const { packs: catalog } = await listPacks();
      try { return resolvePacks(Array.isArray(args.packs) ? args.packs : [], catalog); }
      catch (e) { return { error: e.message, code: e.code }; }
    }
    case 'doctor': {
      const projectRoot = args.projectRoot || process.cwd();
      const out = [];
      for (const t of listTargets()) {
        const lf = await readLockfile(t.id, projectRoot);
        if (!lf) continue;
        out.push({
          target: t.id,
          kitMcpVersion: lf.kitMcpVersion,
          inSync: lf.kitMcpVersion === PKG_VERSION,
          packs: Object.entries(lf.packs).map(([id, v]) => ({ id, explicit: v.explicit !== false, version: v.version })),
        });
      }
      return { projectRoot, currentVersion: PKG_VERSION, targets: out };
    }
    case 'add':
    case 'remove': {
      const guard = await validateProjectRoot(args.projectRoot);
      if (!guard.ok) return { error: guard.reason };
      const projectRoot = guard.resolvedPath;
      const targets = args.target ? [args.target] : undefined;
      try {
        if (action === 'add') return await addPacks(args.packs, { projectRoot, targets });
        return await removePacks(args.packs, { projectRoot, targets, cascade: args.cascade });
      } catch (e) { return { error: e.message, code: e.code }; }
    }
    case 'store':
      return { error: 'pack store requer TTY interativo; use `kit pack store` no CLI ou pack add/remove com ids explícitos.' };
    default: return { error: `Unknown action: ${action}` };
  }
}

// DIR-05: tool `projects` — consome o registro canônico PROJETOS.md em runtime.
// Read-only (mesmo perfil de handlePack action=doctor): projectRoot cai em cwd
// sem o guard SEC-14-03 porque nenhuma action escreve em disco. O parse é 100%
// delegado a src/core/projects.js (puro); aqui fica só o fs.
async function handleProjects(args = {}) {
  const action = args.action;
  const projectRoot = args.projectRoot || process.cwd();
  const fs = await import('node:fs/promises');
  const file = path.join(projectRoot, 'PROJETOS.md');

  let raw = null;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') return { error: `Falha ao ler PROJETOS.md: ${e.message}` };
  }
  if (raw === null) {
    return {
      projectRoot,
      file,
      exists: false,
      error: 'PROJETOS.md não encontrado na raiz — rode /base init para criar o registro canônico.',
    };
  }

  const { principal, conectados, issues } = parseProjects(raw);
  const projetos = [...(principal ? [principal] : []), ...conectados];

  switch (action) {
    case 'list':
      return { projectRoot, file, exists: true, projetos, issues };
    case 'get': {
      if (typeof args.name !== 'string' || args.name.trim() === '') {
        return { error: 'action=get requer name (nome do projeto no registro).' };
      }
      const wanted = args.name.trim().toLowerCase();
      const projeto = projetos.find((p) => p.nome.toLowerCase() === wanted);
      if (!projeto) {
        return { error: `Projeto não encontrado: ${args.name}. Disponíveis: ${projetos.map((p) => p.nome).join(', ') || '(nenhum)'}` };
      }
      return {
        projectRoot,
        file,
        projeto,
        issues: issues.filter((i) => i.projeto === projeto.nome),
      };
    }
    case 'doctor': {
      // Relatório de validação: obrigatórios (do parser) + existência dos
      // paths locais via fs + shape das URLs. Cada check é { campo, tipo,
      // ok, detalhe } para o cliente renderizar tabela por projeto.
      const report = [];
      for (const p of projetos) {
        const checks = [];
        for (const campo of ['pasta_local', 'repositorio', 'documentacao_local']) {
          checks.push({
            campo,
            tipo: 'obrigatorio',
            ok: p.campos[campo] !== null,
            detalhe: p.campos[campo] !== null ? 'preenchido' : 'vazio ou placeholder',
          });
        }
        for (const campo of ['pasta_local', 'documentacao_local']) {
          const valor = p.campos[campo];
          if (valor === null) continue; // já reprovado no check obrigatorio
          let existe = false;
          try { await fs.stat(valor); existe = true; } catch { /* não existe */ }
          checks.push({
            campo,
            tipo: 'path',
            ok: existe,
            detalhe: existe ? 'existe no disco' : `não encontrado no disco: ${valor}`,
          });
        }
        for (const campo of ['repositorio', 'repositorio_documentacao']) {
          const valor = p.campos[campo];
          if (valor === null) continue; // opcional vazio (ou obrigatorio já reprovado)
          const urlOk = isValidRepoUrl(valor);
          checks.push({
            campo,
            tipo: 'url',
            ok: urlOk,
            detalhe: urlOk ? 'shape https?:// válido' : `sem shape https?://: ${valor}`,
          });
        }
        report.push({
          nome: p.nome,
          principal: p.principal,
          completo: p.completo,
          checks,
          ok: p.completo && checks.every((c) => c.ok),
        });
      }
      return {
        projectRoot,
        file,
        exists: true,
        ok: issues.length === 0 && report.length > 0 && report.every((r) => r.ok),
        projetos: report,
        issues,
      };
    }
    default: return { error: `Unknown action: ${action}` };
  }
}

// OBS-18 (Phase 94.01): metrics-snapshot is parameterless and read-only.
// Returns the live snapshot synchronously — no auth, no projectRoot guard
// (no disk reads, no shell). Wraps in an async fn for handler-API uniformity.
//
// OBS-20-01 (Phase 102): auto-persist throttle — clients polling rapidly
// shouldn't create N files per second. 1s is generous vs typical 30s+ polls.
// State is in-memory; resets on server restart. Closes the operational gap
// where snapshots dir was empty until someone manually triggered persist.
let _lastAutoPersistTs = 0;
const AUTO_PERSIST_THROTTLE_MS = 1000;

// Phase 167 (v1.29): auto-install handler.
// Bridges MCP → host-native integration by writing kit/ files into .claude/
// (or whatever the target IDE expects). Idempotent via .kit-mcp-version marker.
// Phase 168 hooks add the restart_recommended signal to the result.
async function handleAutoInstall(args) {
  const action = args.action || 'install';
  const target = args.target || 'claude-code';
  const force = !!args.force;

  // Resolve projectRoot: explicit arg > cwd fallback. (Future v1.30 will add
  // MCP `roots` capability consumer for a tighter projectRoot signal — for now
  // we use cwd to keep the boot path race-free with the SDK init handshake.)
  let projectRoot = args.projectRoot;
  const _rootsSource = projectRoot ? 'explicit' : 'cwd';
  if (!projectRoot) projectRoot = process.cwd();

  // SEC-14-03: validate project root (allowlist-of-1 — must be a real dir).
  const guard = await validateProjectRoot(projectRoot);
  if (!guard.ok) {
    return { ok: false, reason: guard.reason, projectRoot, rootsSource: _rootsSource };
  }
  projectRoot = guard.resolvedPath;

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const markerPath = path.join(projectRoot, '.claude', '.kit-mcp-version');

  // Read current marker if present.
  let currentVersion = null;
  try {
    currentVersion = (await fs.readFile(markerPath, 'utf8')).trim();
  } catch { /* not installed yet */ }

  const targetVersion = PKG_VERSION;
  const inSync = currentVersion === targetVersion;

  // Phase 167 — action=check: read-only drift report.
  if (action === 'check') {
    return {
      ok: true,
      action: 'check',
      target,
      projectRoot,
      rootsSource: _rootsSource,
      installedVersion: currentVersion,
      currentVersion: targetVersion,
      inSync,
      restartRecommended: false,
    };
  }

  // action=install: skip if in sync and not forced.
  if (inSync && !force) {
    return {
      ok: true,
      action: 'install',
      target,
      projectRoot,
      rootsSource: _rootsSource,
      version: targetVersion,
      skipped: true,
      reason: 'already in sync',
      restartRecommended: false,
    };
  }

  // Content packs (RFC §5.4): auto-install ONLY READS the lockfile — it must
  // never overwrite the user's selection on a hot re-sync. If a lockfile exists
  // for this target, re-project the same pack selection (so a kit upgrade keeps
  // the chosen subset and picks up new resources within those packs).
  let lockedPacks; // undefined ⇒ full kit (no lockfile = back-compat default)
  try {
    const lf = await readLockfile(target, projectRoot);
    if (lf) {
      const explicit = explicitPacksFromLockfile(lf);
      const { packs: catalog } = await listPacks();
      lockedPacks = resolvePacks(explicit ?? [], catalog).effective;
    }
  } catch { /* malformed lockfile ⇒ fall back to full kit */ }

  // Run the sync.
  let syncResult;
  try {
    syncResult = await syncTo(target, { projectRoot, mode: 'reference', dryRun: false, packs: lockedPacks });
  } catch (e) {
    return {
      ok: false,
      action: 'install',
      target,
      projectRoot,
      rootsSource: _rootsSource,
      reason: `sync_failed: ${e.message}`,
    };
  }

  // Write/update marker file (.claude/.kit-mcp-version).
  try {
    await fs.mkdir(path.dirname(markerPath), { recursive: true });
    await fs.writeFile(markerPath, targetVersion + '\n', 'utf8');
  } catch (e) {
    // Marker is best-effort — sync already succeeded. Just warn.
    process.stderr.write(`[kit-mcp] auto-install marker write failed: ${e.message}\n`);
  }

  // v1.30.2/v1.30.4: register kit-mcp UserPromptSubmit hooks in
  // .claude/settings.local.json. Idempotent — only adds hooks not already
  // present. Without this step the hooks ship but never fire (user would have
  // to edit settings.json manually per-project).
  //   - kit-router: detects domain keywords → injects delegation directive.
  //   - kit-attribution-reminder: injects the 1-line attribution directive.
  try {
    const settingsPath = path.join(projectRoot, '.claude', 'settings.local.json');
    const HOOKS = ['kit-router', 'kit-attribution-reminder'];
    let settings = {};
    try {
      const raw = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(raw);
    } catch { /* file may not exist yet */ }
    settings.hooks = settings.hooks || {};
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || [];
    let changed = false;
    for (const hookName of HOOKS) {
      const hookCmd = `node ${path.join(projectRoot, '.claude', 'hooks', hookName + '.cjs').replace(/\\/g, '/')}`;
      const already = settings.hooks.UserPromptSubmit.some((entry) =>
        Array.isArray(entry?.hooks) &&
        entry.hooks.some((h) => typeof h?.command === 'string' && h.command.includes(hookName)));
      if (!already) {
        settings.hooks.UserPromptSubmit.push({
          matcher: '*',
          hooks: [{ type: 'command', command: hookCmd }],
        });
        changed = true;
      }
    }
    if (changed) {
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    }
  } catch (e) {
    process.stderr.write(`[kit-mcp] hook registration failed (non-fatal): ${e.message}\n`);
  }

  // Phase 168 (v1.29): write .kit-mcp-restart-required so doctor/host can detect
  // pending restart even if the user closes/reopens kit-mcp without restarting IDE.
  try {
    const restartMarker = path.join(projectRoot, '.claude', '.kit-mcp-restart-required');
    const payload = JSON.stringify({
      version: targetVersion,
      previousVersion: currentVersion,
      writtenAt: new Date().toISOString(),
      reason: currentVersion
        ? `Kit updated ${currentVersion} → ${targetVersion}`
        : 'Initial kit install',
    }, null, 2);
    await fs.writeFile(restartMarker, payload + '\n', 'utf8');
  } catch (e) {
    process.stderr.write(`[kit-mcp] restart marker write failed: ${e.message}\n`);
  }

  return {
    ok: true,
    action: 'install',
    target,
    projectRoot,
    rootsSource: _rootsSource,
    version: targetVersion,
    previousVersion: currentVersion,
    written: (syncResult.written || []).length,
    restartRecommended: true,
    _kit_action: 'session_restart_recommended',
    _kit_reason: currentVersion
      ? `Kit updated from ${currentVersion} to ${targetVersion} — restart the IDE session so agents/skills/commands reload.`
      : `Kit installed (v${targetVersion}) into ${path.join('.claude', '')} — restart the IDE session for native subagent_type + slash-command + skill auto-trigger integration.`,
  };
}

// Phase 168 (v1.29): acknowledge that the IDE was restarted after a kit:auto-install.
// Removes the .kit-mcp-restart-required marker. Read by kit:doctor (Phase 171)
// to stop flagging "pending restart".
async function handleAckRestart(args) {
  let projectRoot = args.projectRoot || process.cwd();

  const guard = await validateProjectRoot(projectRoot);
  if (!guard.ok) return { ok: false, reason: guard.reason, projectRoot };
  projectRoot = guard.resolvedPath;

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const restartMarker = path.join(projectRoot, '.claude', '.kit-mcp-restart-required');

  let acked = false;
  try {
    await fs.unlink(restartMarker);
    acked = true;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      return { ok: false, reason: `unlink_failed: ${e.message}`, projectRoot };
    }
    // ENOENT — nothing to ack, already clean. Not an error.
  }

  return {
    ok: true,
    projectRoot,
    acked,
    reason: acked ? 'restart marker removed' : 'no restart marker present (nothing to ack)',
  };
}

async function handleMetricsSnapshot() {
  const payload = metricsSnapshot();
  const now = Date.now();
  if (now - _lastAutoPersistTs >= AUTO_PERSIST_THROTTLE_MS) {
    try {
      await persistSnapshot();
      _lastAutoPersistTs = now;
    } catch (err) {
      // OBS-20-01: graceful — log to stderr, do NOT fail the handler.
      // In-memory snapshot still returned normally so the client tool call
      // contract is preserved even when fs is read-only or quota-exhausted.
      process.stderr.write(`[kit-mcp] auto-snapshot persist failed: ${err.message}\n`);
    }
  }
  return payload;
}

// Phase 172 (v1.37.0): cost-tracking handlers.
//
// Padrão uniforme:
//   1. Validação manual (typeof / Array.isArray) — sem Zod (budget de deps).
//   2. Chama o aggregator de M2 (puro, testável).
//   3. Se args.persist === true, grava em .planning/costs/<ts>.json (opt-in).
//   4. try/catch envelopa erros num shape {error:{message,code}} — NUNCA
//      propaga stack para o cliente MCP (defesa em profundidade vs SEC-13).
//
// projectRoot fallback é cwd (mesmo padrão de handleAutoInstall). Persist é
// best-effort: falha graceful retorna {persist_warning} sem derrubar a tool.

function _costError(err, code = 'cost_handler_failed') {
  const msg = err && typeof err.message === 'string' ? err.message : String(err);
  return { error: { message: msg, code } };
}

async function _maybePersistCost(args, toolName, snap) {
  if (args && args.persist === true) {
    const rootDir = args.projectRoot || process.cwd();
    try {
      const { file, warning } = await persistCostSnapshot(rootDir, snap, { tool: toolName });
      if (file) return { ...snap, persisted_to: file };
      if (warning) return { ...snap, persist_warning: warning };
    } catch (err) {
      return { ...snap, persist_warning: `persist_threw:${err && err.message ? err.message : 'unknown'}` };
    }
  }
  return snap;
}

async function handleCostToday(args = {}) {
  try {
    if (args.tz !== undefined && typeof args.tz !== 'string') {
      return _costError(new Error('tz must be string'), 'invalid_arg');
    }
    if (args.config_dirs !== undefined && !Array.isArray(args.config_dirs)) {
      return _costError(new Error('config_dirs must be array of strings'), 'invalid_arg');
    }
    const snap = aggregateToday({
      config_dirs: args.config_dirs,
      tz: args.tz,
      date: args.date,
      now: args.now,
      entries: args.entries,
      source_mtimes: args.source_mtimes,
      snapshot_path: args.snapshot_path,
      meta_path: args.meta_path,
    });
    return await _maybePersistCost(args, 'cost-today', snap);
  } catch (err) {
    return _costError(err);
  }
}

async function handleCostSession(args = {}) {
  try {
    if (args.session_id !== undefined && typeof args.session_id !== 'string') {
      return _costError(new Error('session_id must be string'), 'invalid_arg');
    }
    if (args.transcript_path !== undefined && typeof args.transcript_path !== 'string') {
      return _costError(new Error('transcript_path must be string'), 'invalid_arg');
    }
    if (args.config_dirs !== undefined && !Array.isArray(args.config_dirs)) {
      return _costError(new Error('config_dirs must be array of strings'), 'invalid_arg');
    }
    const snap = aggregateSession({
      session_id: args.session_id,
      transcript_path: args.transcript_path,
      config_dirs: args.config_dirs,
      max_idle_ms: args.max_idle_ms,
      now: args.now,
      entries: args.entries,
      source_mtimes: args.source_mtimes,
      snapshot_path: args.snapshot_path,
      meta_path: args.meta_path,
    });
    return await _maybePersistCost(args, 'cost-session', snap);
  } catch (err) {
    return _costError(err);
  }
}

async function handleCostBlocks(args = {}) {
  try {
    if (args.config_dirs !== undefined && !Array.isArray(args.config_dirs)) {
      return _costError(new Error('config_dirs must be array of strings'), 'invalid_arg');
    }
    const snap = aggregateBlocks({
      config_dirs: args.config_dirs,
      now: args.now,
      block_ms: args.block_ms,
      entries: args.entries,
      source_mtimes: args.source_mtimes,
      snapshot_path: args.snapshot_path,
      meta_path: args.meta_path,
    });
    return await _maybePersistCost(args, 'cost-blocks', snap);
  } catch (err) {
    return _costError(err);
  }
}

async function handleCostPhase(args = {}) {
  try {
    if (args.phase_id === undefined || args.phase_id === null || args.phase_id === '') {
      return _costError(new Error('phase_id is required'), 'invalid_arg');
    }
    if (args.config_dirs !== undefined && !Array.isArray(args.config_dirs)) {
      return _costError(new Error('config_dirs must be array of strings'), 'invalid_arg');
    }
    const rootDir = args.projectRoot || args.root_dir || process.cwd();
    const snap = aggregatePhase({
      phase_id: args.phase_id,
      root_dir: rootDir,
      config_dirs: args.config_dirs,
      now: args.now,
      entries: args.entries,
      source_mtimes: args.source_mtimes,
      skip_git: args.skip_git,
      phase_window_override: args.phase_window_override,
      snapshot_path: args.snapshot_path,
      meta_path: args.meta_path,
    });
    return await _maybePersistCost(args, 'cost-phase', snap);
  } catch (err) {
    return _costError(err);
  }
}

async function handleCostEstimate(args = {}) {
  try {
    if (typeof args.text !== 'string') {
      return _costError(new Error('text must be a string'), 'invalid_arg');
    }
    if (args.model !== undefined && typeof args.model !== 'string') {
      return _costError(new Error('model must be a string'), 'invalid_arg');
    }
    const snap = aggregateEstimate({
      text: args.text,
      model: args.model,
      output_ratio: args.output_ratio,
      chars_per_token: args.chars_per_token,
      now: args.now,
      snapshot_path: args.snapshot_path,
      meta_path: args.meta_path,
    });
    // cost-estimate é puro (não há disco a persistir); ignora `persist`.
    return snap;
  } catch (err) {
    return _costError(err);
  }
}

const HANDLERS = {
  kit:                handleKit,
  sync:               handleSync,
  'reverse-sync':     handleReverseSync,
  gates:              handleGates,
  forensics:          handleForensics,
  install:            handleInstall,
  pack:               handlePack,
  projects:           handleProjects,
  'metrics-snapshot': handleMetricsSnapshot,
  'auto-install':     handleAutoInstall,
  'ack-restart':      handleAckRestart,
  // Phase 172 — cost-tracking (5 read-only tools).
  'cost-today':       handleCostToday,
  'cost-session':     handleCostSession,
  'cost-blocks':      handleCostBlocks,
  'cost-phase':       handleCostPhase,
  'cost-estimate':    handleCostEstimate,
};

// Phase 167+168 test affordances — exported for unit coverage.
// Production callers should go through the MCP dispatch (HANDLERS map).
export const __TEST_HANDLERS = {
  handleAutoInstall,
  handleAckRestart,
  // DIR-05 — tool projects exposta para cobertura unit sem transport stdio.
  handleProjects,
  // Phase 172 — cost handlers exposed for direct unit/integration coverage
  // without spinning the stdio transport.
  handleCostToday,
  handleCostSession,
  handleCostBlocks,
  handleCostPhase,
  handleCostEstimate,
};

// Phase 172 — exposed for integration tests to assert TOOLS/HANDLERS shape
// without re-parsing the source. Keeps the TOOLS array as the single source of
// truth (no duplicated list in tests).
export { TOOLS, HANDLERS };

function slim(x) {
  // absPath omitted by design — list-* tools are AI-consumed in tight context budgets.
  // Use action=get to fetch the absPath (and content) for a specific item.
  // PERF-13-01 (TOK-02): truncate description via SUMMARY_MAX_CHARS (80) cap shared
  // with src/core/sync.js — full description lives in each item's file under kit/.
  // #6 (v1.30.4): include `tier` when present (agents only) so clients can group.
  const out = { kind: x.kind, name: x.name };
  if (x.frontmatter?.tier) out.tier = x.frontmatter.tier;
  // v1.41: cost-awareness — leve/medio/pesado, so AI clients can budget before invoking.
  if (x.frontmatter?.cost_tier) out.cost_tier = x.frontmatter.cost_tier;
  out.description = summarize(x.description);
  return out;
}

// PERF-15-01: terse variant — omits description entirely. Used when MCP client
// only needs name discovery (e.g. populating UI lists, validating slug references).
// Default action=list-* still returns description capped via slim()/summarize().
function slimTerse(x) {
  const out = { kind: x.kind, name: x.name };
  if (x.frontmatter?.tier) out.tier = x.frontmatter.tier;
  return out;
}

// --- server bootstrap ---

export async function createServer() {
  const server = new Server(
    { name: 'kit-mcp', version: PKG_VERSION },
    { capabilities: { tools: {} } },
  );

  // v1.30.3 (#5): inject live catalog counts into tool descriptions so the
  // {{AGENTS}}/{{COMMANDS}}/{{SKILLS}} placeholders never drift from reality.
  // Falls back to the placeholder-as-literal if listKit() fails (defensive —
  // a broken kit dir must not break tool discovery).
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    let counts = null;
    try {
      const kit = await listKit(BUNDLED_KIT_ROOT);
      counts = {
        AGENTS: String(kit.agents.length),
        COMMANDS: String(kit.commands.length),
        SKILLS: String(kit.skills.length + kit.skillsExtras.length),
      };
    } catch { /* leave placeholders untouched */ }
    if (!counts) return { tools: TOOLS };
    const tools = TOOLS.map((t) => ({
      ...t,
      description: t.description.replace(
        /\{\{(AGENTS|COMMANDS|SKILLS)\}\}/g,
        (_, key) => counts[key],
      ),
    }));
    return { tools };
  });

  // v1.30.1: open browser tab on FIRST kit-mcp tool invocation (not on boot —
  // would spam tabs on IDE start). Provides visual feedback that kit-mcp is
  // actively being used. Escape hatch: KIT_MCP_NO_UI=1 (same as auto-spawn) or
  // KIT_MCP_NO_BROWSER=1 (sidecar runs but no browser open).
  let kitFirstToolBrowserOpened = false;
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const handler = HANDLERS[name];

    // v1.30.1: first-tool browser open — fire-and-forget; never blocks handler.
    // Suppressed in same conditions as boot-time sidecar (test/CI/no-ui).
    if (!kitFirstToolBrowserOpened) {
      kitFirstToolBrowserOpened = true;
      const noUi = process.env.KIT_MCP_NO_UI === '1' || process.env.KIT_MCP_NO_UI === 'true';
      const noBrowser = process.env.KIT_MCP_NO_BROWSER === '1' || process.env.KIT_MCP_NO_BROWSER === 'true';
      const isTestRun = (process.execArgv || []).some(
        (a) => a === '--test' || a === '--experimental-test-coverage',
      ) || process.env.NODE_TEST_CONTEXT !== undefined;
      const isCi = process.env.CI === 'true' || process.env.CI === '1';
      if (!noUi && !noBrowser && !isTestRun && !isCi) {
        const projectRoot = args?.projectRoot || process.cwd();
        ensureSidecar({ projectRoot, openBrowserOnSpawn: true }).catch(() => {});
      }
    }

    if (!handler) {
      // OBS-18 (Phase 94.01): unknown-tool path counts as an error against
      // the unknown name itself — useful signal if a client is mis-spelling
      // a tool name in production. No latency observation (handler never ran).
      incrementInvocation(name || 'unknown', 'error');
      return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }], isError: true };
    }
    // OBS-18 (Phase 94.01): timestamp the dispatch boundary. The four-golden-signals
    // skill cares about the *user-facing* latency, which for the MCP server is the
    // time from request receipt (we are inside the SDK callback) to the JSON envelope
    // being ready. Date.now() is sub-millisecond-cheap and aligns with the bucket
    // granularity we report (50/100/250/500ms thresholds in CONTEXT.md).
    const start = Date.now();
    const argsSize = args ? JSON.stringify(args).length : 0;
    try {
      const result = await handler(args ?? {});
      const duration = Date.now() - start;
      recordLatency(name, duration);
      incrementInvocation(name, 'ok');
      // Phase 158 (v1.28): JSONL log per tool call → ~/.kit-mcp/logs/*.log.
      // Fire-and-forget; never blocks the handler.
      try {
        const ev = {
          tool: name,
          action: args?.action,
          args_size: argsSize,
          result_size: result ? JSON.stringify(result).length : 0,
          duration_ms: duration,
          status: 'ok',
        };
        // Phase 163 (v1.28): when KIT_MCP_INSPECT=1, also capture raw args/result
        // so `kit inspect` can render full request/response live. Off by default
        // because payloads can be large and may contain user paths.
        if (process.env.KIT_MCP_INSPECT === '1' || process.env.KIT_MCP_INSPECT === 'true') {
          ev.args = args ?? null;
          ev.result = result ?? null;
        }
        logEvent(ev);
      } catch { /* swallow */ }
      // Phase 164 (v1.28): opt-in OS notification on success path.
      if (isNotifyEnabled()) {
        try { notify({ title: `kit-mcp ${name}`, body: `${args?.action ?? ''} ok (${duration}ms)` }); } catch { /* swallow */ }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      // OBS-18: still record latency on the error path — half the value of a
      // latency histogram is catching tail-latency-then-fail patterns. Status
      // 'error' covers any thrown exception, including Phase 79.01 gates guard
      // and the validateProjectRoot rejection (Phase 83.01).
      const duration = Date.now() - start;
      recordLatency(name, duration);
      incrementInvocation(name, 'error');
      try {
        logEvent({
          tool: name,
          action: args?.action,
          args_size: argsSize,
          duration_ms: duration,
          status: 'error',
          error_type: e?.code || e?.name || 'Error',
        });
      } catch { /* swallow */ }
      if (isNotifyEnabled()) {
        try { notify({ title: `kit-mcp ${name} (error)`, body: e?.code || e?.name || 'Error' }); } catch { /* swallow */ }
      }
      // SEC-14-06: full stack stays in stderr for operator debug; client envelope is sanitized.
      // sanitizeMcpError redacts secrets/paths from e.message, preserves e.code (Phase 83
      // EMANIFESTMISMATCH invariant), and emits NO stack field.
      console.error('[mcp-server] error in handler:', e?.stack ?? e);
      return {
        content: [{ type: 'text', text: JSON.stringify(sanitizeMcpError(e), null, 2) }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startStdio() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);


  // SRE-20-02 (Phase 105): pre-warm the kit cache to push MCP dispatch p95
  // below 100ms. Without this, the very first tools/call against `kit` pays
  // the full disk read (~144ms baseline on the v1.17 reference machine; ~96ms
  // on faster hardware). Fire-and-forget: failure here is non-fatal — the
  // next dispatch will lazily populate via the same listKit code path.
  // This shifts the cold-path work from the first user-visible request to
  // the boot path, where it's invisible behind IDE startup. See skill
  // production-readiness-review (Performance axe) for the rationale.
  listKit(BUNDLED_KIT_ROOT).catch(() => {});

  // Phase 157 (v1.28): sidecar UI auto-spawn ON by default. Resolves the
  // "kit-mcp has no terminal feedback" pain — operators can now see live
  // tool calls in a browser without needing to set autoSpawn: true per tool.
  // Escape hatch: KIT_MCP_NO_UI=1 (CI, headless, opt-out). Fire-and-forget:
  // sidecar failure must never block the MCP transport (spec requires clean
  // stdout). Errors are swallowed silently — kit doctor will surface them.
  //
  // Skip when running under node --test (or coverage) to avoid leaking detached
  // child processes that hold the event loop and cause non-zero exits. Same
  // for CI=true (GitHub Actions, etc.) — sidecar is interactive and meaningless
  // there. End users running locally still get the default-on behavior.
  const isTestRun = (process.execArgv || []).some(
    (a) => a === '--test' || a === '--experimental-test-coverage',
  ) || process.env.NODE_TEST_CONTEXT !== undefined;
  const noUi = process.env.KIT_MCP_NO_UI === '1' || process.env.KIT_MCP_NO_UI === 'true';
  const isCi = process.env.CI === 'true' || process.env.CI === '1';
  if (!noUi && !isTestRun && !isCi) {
    const projectRoot = process.cwd();
    ensureSidecar({ projectRoot, openBrowserOnSpawn: false }).catch(() => {});
  }
}
