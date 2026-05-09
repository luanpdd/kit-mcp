// kit-mcp server — exposes 5 tools, each with action-based dispatch.
//
//   kit       action: list-agents | list-commands | list-skills | get | search
//   sync      action: targets | status | install | remove
//   gates     action: list | get | for-stage
//   forensics action: collect | summarize | write-learnings | list-replays | record-replay | load-replay
//   install   action: targets | install | dry-run                    (registers this MCP into an IDE)
//
// Transport: stdio (MCP standard).

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { listKit, searchKit, findItem } from '../core/kit.js';
import { listTargets } from '../core/registry.js';
import { syncTo, statusOf, removeFrom } from '../core/sync.js';
import { detectReverse, applyReverse } from '../core/reverse-sync.js';
import { listGates, getGate, gatesForStage } from '../core/gates.js';
import { runGate } from '../core/gate-runner.js';
import { collectFailures, summarizeByAgent, writeLearnings } from '../core/failures.js';
import { reflect } from '../core/reflect.js';
import { recordReplay, listReplays, loadReplay, annotateReplay } from '../core/replays.js';
import { installMcp, listInstallTargets } from './install.js';
import { ensureSidecar } from '../ui/auto-spawn.js';
import { wrapProgressForUi } from '../ui/wrapper.js';

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
];

// --- handlers ---

async function handleKit(args) {
  const kit = await listKit();
  switch (args.action) {
    case 'list-agents':   return kit.agents.map(slim);
    case 'list-commands': return kit.commands.map(slim);
    case 'list-skills':   return [...kit.skills, ...kit.skillsExtras].map(slim);
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
    case 'status':  return statusOf(args.target, { projectRoot: args.projectRoot });
    case 'install':
      return withAutoSpawn(args, 'sync.install', (onProgress) =>
        syncTo(args.target, { projectRoot: args.projectRoot, mode: args.mode, dryRun: args.dryRun, onProgress }));
    case 'remove':  return removeFrom(args.target, { projectRoot: args.projectRoot });
    default: return { error: `Unknown action: ${args.action}` };
  }
}

async function handleReverseSync(args) {
  switch (args.action) {
    case 'detect': return detectReverse(args.target, { projectRoot: args.projectRoot });
    case 'apply':
      return withAutoSpawn(args, 'reverse-sync.apply', (onProgress) =>
        applyReverse(args.target, {
          projectRoot: args.projectRoot,
          strategy: args.strategy, only: args.only, dryRun: args.dryRun,
          onProgress,
        }));
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

const HANDLERS = {
  kit:           handleKit,
  sync:          handleSync,
  'reverse-sync':handleReverseSync,
  gates:         handleGates,
  forensics:     handleForensics,
  install:       handleInstall,
};

function slim(x) {
  // absPath omitted by design — list-* tools are AI-consumed in tight context budgets.
  // Use action=get to fetch the absPath (and content) for a specific item.
  return { kind: x.kind, name: x.name, description: x.description };
}

// --- server bootstrap ---

export async function createServer() {
  const server = new Server(
    { name: 'kit-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const handler = HANDLERS[name];
    if (!handler) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }], isError: true };
    }
    try {
      const result = await handler(args ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: e.message, stack: e.stack }, null, 2) }],
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
