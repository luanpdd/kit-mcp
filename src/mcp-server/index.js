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

import { listKit, searchKit, findItem } from '../core/kit.js';
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

const TOOLS = [
  {
    name: 'kit',
    description: 'Browse the personal kit: agents, commands, skills.',
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
  kit:               handleKit,
  sync:              handleSync,
  'reverse-sync':    handleReverseSync,
  gates:             handleGates,
  forensics:         handleForensics,
  install:           handleInstall,
  'metrics-snapshot': handleMetricsSnapshot,
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
    { capabilities: { tools: {} } }
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
    try {
      const result = await handler(args ?? {});
      recordLatency(name, Date.now() - start);
      incrementInvocation(name, 'ok');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      // OBS-18: still record latency on the error path — half the value of a
      // latency histogram is catching tail-latency-then-fail patterns. Status
      // 'error' covers any thrown exception, including Phase 79.01 gates guard
      // and the validateProjectRoot rejection (Phase 83.01).
      recordLatency(name, Date.now() - start);
      incrementInvocation(name, 'error');
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
}
