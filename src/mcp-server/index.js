// kit-mcp server — exposes 7 tools, each with action-based dispatch (or none).
//
//   kit              action: list-agents | list-commands | list-skills | get | search
//   sync             action: targets | status | install | remove
//   gates            action: list | get | for-stage
//   forensics        action: collect | summarize | write-learnings | list-replays | record-replay | load-replay
//   install          action: targets | install | dry-run                    (registers this MCP into an IDE)
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
import { detectReverse, applyReverse } from '../core/reverse-sync.js';
import { validateProjectRoot } from '../core/path-safety.js';
import { sanitizeMcpError } from '../core/error-redaction.js';
import { listGates, getGate, gatesForStage } from '../core/gates.js';
import { runGate } from '../core/gate-runner.js';
import { collectFailures, summarizeByAgent, writeLearnings } from '../core/failures.js';
import { reflect } from '../core/reflect.js';
import { recordReplay, listReplays, loadReplay, annotateReplay } from '../core/replays.js';
import { installMcp, listInstallTargets } from './install.js';
import { ensureSidecar } from '../ui/auto-spawn.js';
import { wrapProgressForUi } from '../ui/wrapper.js';
import { incrementInvocation, recordLatency, snapshot as metricsSnapshot, persistSnapshot } from '../core/metrics.js';
import { logEvent } from '../core/logger.js';
import { notify, isNotifyEnabled } from '../core/notify.js';
// Note: roots.js is imported dynamically inside handlers that need it
// (handleAutoInstall, handleAckRestart) — keeps boot path minimal.

const TOOLS = [
  {
    name: 'kit',
    // Phase 170 (v1.29): description enriched with trigger keywords so MCP
    // hosts route here on relevant intents even in MCP-pure mode (before
    // auto-install made .claude/ native). Keep under 1024 chars (host limit).
    description: 'Browse the personal kit: 66 agents, 89 commands, 76 skills. Call this when the user mentions Supabase (RLS, branching, migrations, Edge Functions, Custom Claims, Postgres Roles, Storage, Realtime, pgvector), multi-tenant SaaS, agentic harness, characterization tests, legacy refactor, observability (SLO, golden signals, error budgets), DDIA topics (consistency, replication lag, schema evolution), SRE (postmortems, toil, PRR), CI/CD (hermetic builds, pipelines), or any workflow that benefits from the canonical patterns. Use action=search to discover, action=get to read the full prompt/skill.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list-agents', 'list-commands', 'list-skills', 'get', 'search'] },
        kind:   { type: 'string', enum: ['agent', 'command', 'skill'], description: 'For action=get' },
        name:   { type: 'string', description: 'For action=get' },
        query:  { type: 'string', description: 'For action=search' },
        terse:  { type: 'boolean', description: 'For action=list-*: omit description, return only {kind, name}. Default false (PERF-15-01).' },
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
    description: 'Register this kit-mcp server into an IDE\'s MCP config (Claude/Cursor/Codex/Gemini/Windsurf).',
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
    description: 'IMPORTANT for first contact: project kit/ into the host\'s native layout (.claude/agents/, skills/, commands/) so 66 agents become real subagent_types in the Agent tool, 76 skills get native auto-trigger via descriptions, and 89 commands appear as /slash-commands in the IDE. Idempotent — re-running is a no-op if already in sync. Run once per project on first kit-mcp contact; restart the IDE session after to load the new agents/skills/commands. After restart, call ack-restart to clear the marker.',
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
    case 'list-agents':   return kit.agents.map(variant);
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

  // Run the sync.
  let syncResult;
  try {
    syncResult = await syncTo(target, { projectRoot, mode: 'reference', dryRun: false });
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

const HANDLERS = {
  kit:                handleKit,
  sync:               handleSync,
  'reverse-sync':     handleReverseSync,
  gates:              handleGates,
  forensics:          handleForensics,
  install:            handleInstall,
  'metrics-snapshot': handleMetricsSnapshot,
  'auto-install':     handleAutoInstall,
  'ack-restart':      handleAckRestart,
};

// Phase 167+168 test affordances — exported for unit coverage.
// Production callers should go through the MCP dispatch (HANDLERS map).
export const __TEST_HANDLERS = {
  handleAutoInstall,
  handleAckRestart,
};

function slim(x) {
  // absPath omitted by design — list-* tools are AI-consumed in tight context budgets.
  // Use action=get to fetch the absPath (and content) for a specific item.
  // PERF-13-01 (TOK-02): truncate description via SUMMARY_MAX_CHARS (80) cap shared
  // with src/core/sync.js — full description lives in each item's file under kit/.
  return { kind: x.kind, name: x.name, description: summarize(x.description) };
}

// PERF-15-01: terse variant — omits description entirely. Used when MCP client
// only needs name discovery (e.g. populating UI lists, validating slug references).
// Default action=list-* still returns description capped via slim()/summarize().
function slimTerse(x) {
  return { kind: x.kind, name: x.name };
}

// --- server bootstrap ---

export async function createServer() {
  const server = new Server(
    { name: 'kit-mcp', version: PKG_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const handler = HANDLERS[name];
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
