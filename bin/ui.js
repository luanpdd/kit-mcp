#!/usr/bin/env node
// bin/ui.js — entry point for the sidecar HTTP server.
//
// Used both directly (when the user runs `kit ui start`) and as the spawn target
// when `--auto-spawn` is enabled on an MCP tool.
//
// Logging discipline: all output goes to stderr. stdout is reserved so that
// callers can pipe `node bin/ui.js | jq` without UI server chatter contaminating
// data streams (and so that this file can never poison an MCP stdio channel).

import process from 'node:process';
import { createServer } from '../src/ui/server.js';

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), port: undefined, idleMs: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--project-root' && argv[i + 1]) { args.projectRoot = argv[i + 1]; i += 1; }
    else if (a === '--port' && argv[i + 1]) { args.port = Number(argv[i + 1]); i += 1; }
    else if (a === '--idle-ms' && argv[i + 1]) { args.idleMs = Number(argv[i + 1]); i += 1; }
    else if (a === '--version') { args.printVersion = true; }
    else if (a === '--help' || a === '-h') { args.help = true; }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  process.stderr.write([
    'kit-mcp sidecar entry — usually invoked via `kit ui start`',
    '',
    'Usage: node bin/ui.js [options]',
    '  --project-root <path>   project root for lockfile keying (default: cwd)',
    '  --port <n>              bind to a specific port (default: auto-pick 7100-7199)',
    '  --idle-ms <ms>          idle shutdown timeout (default: 0 = never; pass e.g. 1800000 for 30min)',
    '  --version               print version and exit',
    '  --help                  this text',
    '',
  ].join('\n'));
  process.exit(0);
}

let pkgVersion = null;
try {
  const { default: pkg } = await import('../package.json', { with: { type: 'json' } });
  pkgVersion = pkg.version;
} catch {
  // ok — version may not be available in some packaged contexts
}

if (args.printVersion) {
  process.stderr.write(`${pkgVersion ?? 'unknown'}\n`);
  process.exit(0);
}

const server = createServer({
  projectRoot: args.projectRoot,
  version: pkgVersion,
  idleMs: args.idleMs,
});

try {
  const { port } = await server.start({ port: args.port });
  process.stderr.write(`[kit-mcp ui] listening on http://127.0.0.1:${port}/\n`);
  process.stderr.write(`[kit-mcp ui] project: ${args.projectRoot}\n`);
} catch (err) {
  if (err.code === 'ELIVE') {
    process.stderr.write(`[kit-mcp ui] sidecar already running for this project (pid=${err.lock?.pid}, port=${err.lock?.port})\n`);
    process.exit(2);
  }
  process.stderr.write(`[kit-mcp ui] failed to start: ${err.message}\n`);
  process.exit(1);
}
