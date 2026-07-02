#!/usr/bin/env node
// hook-version: 1.14.0
// kit-mcp · Sidecar Tool Publisher (PostToolUse)
//
// Publishes every Claude Code tool invocation to the kit-mcp sidecar so the
// localhost UI shows real-time activity from this IDE — including edits,
// reads, bash, agent spawns, MCP calls. Closes the gap where the sidecar
// previously only saw `kit sync`/`reverse-sync`/`gates` operations.
//
// Pipeline: PostToolUse hook → reads stdin envelope → discovers sidecar
// lockfile (per project_root) → POST /publish → fire-and-forget.
//
// SOFT failure: any error logs to stderr and exits 0. Never blocks the user.
//
// Module format: ESM (package.json "type": "module"). Stays compatible whether
// run from inside the kit-mcp repo or from a user project.
//
// Enable via `~/.claude/settings.json` (or per-project `.claude/settings.json`):
//   {
//     "hooks": {
//       "PostToolUse": [{
//         "matcher": "*",
//         "hooks": [{
//           "type": "command",
//           "command": "node /abs/path/to/sidecar-tool-publisher.js"
//         }]
//       }]
//     }
//   }

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import process from 'node:process';

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 1500);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = input ? JSON.parse(input) : {};
    const toolName = data.tool_name || data.toolName || 'unknown';
    const projectRoot = data.project_root || data.cwd || process.cwd();

    debugLog({ phase: 'received', toolName, projectRoot, cwd: process.cwd(), keys: Object.keys(data) });

    // Try requested projectRoot first; if no lockfile found, scan all
    // kit-mcp-ui-*.lock files in tmpdir and pick one that healthz-responds.
    // This makes the hook resilient to projectRoot mismatch (case, separators,
    // trailing slash, parent-of-project edits, etc).
    let sidecar = readSidecarLock(projectRoot);
    if (!sidecar) sidecar = scanAnyRunningSidecar();
    if (!sidecar) {
      debugLog({ phase: 'no_sidecar', projectRoot });
      process.exit(0);
    }
    const { port, token } = sidecar;

    const payload = {
      tool: toolName,
      sessionId: data.session_id || data.sessionId || null,
      durationMs: typeof data.duration_ms === 'number' ? data.duration_ms : null,
      argsSummary: summarizeArgs(data.tool_input),
      source: detectSource(),
    };

    const event = {
      type: 'tool_invocation',
      ts: Date.now(),
      runId: null,
      payload,
    };

    publish(port, token, event).then(() => process.exit(0));
  } catch (err) {
    process.stderr.write(`[sidecar-tool-publisher] ${err.message}\n`);
    process.exit(0);
  }
});

function readSidecarLock(projectRoot) {
  // Mirror src/ui/lockfile.js#lockPathFor (sha1(projectRoot).slice(0,16))
  try {
    const hash = crypto.createHash('sha1').update(projectRoot).digest('hex').slice(0, 16);
    const lockPath = path.join(os.tmpdir(), `kit-mcp-ui-${hash}.lock`);
    const raw = fs.readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(raw);
    if (typeof lock.port !== 'number') return null;
    return {
      port: lock.port,
      // SEC-14-02 (kit-mcp v1.14+): null for sidecars from v1.13 and earlier.
      token: typeof lock.token === 'string' && /^[0-9a-f]{64}$/.test(lock.token) ? lock.token : null,
    };
  } catch {
    return null;
  }
}

// Scan os.tmpdir() for any kit-mcp-ui-*.lock and return the first { port, token }
// of a live sidecar. Used as a fallback when projectRoot doesn't match any
// known lockfile (case variants, separator differences, parent-dir edits, etc).
function scanAnyRunningSidecar() {
  try {
    const dir = os.tmpdir();
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (!/^kit-mcp-ui-[0-9a-f]{16}\.lock$/.test(name)) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, name), 'utf8');
        const lock = JSON.parse(raw);
        if (typeof lock.port === 'number' && typeof lock.pid === 'number') {
          try {
            process.kill(lock.pid, 0);
            // SEC-14-02: return token from same lockfile so cross-project
            // publishing can authenticate. If token missing (older sidecar),
            // returns null → publish degrades to 401 silent-fail.
            return {
              port: lock.port,
              token: typeof lock.token === 'string' && /^[0-9a-f]{64}$/.test(lock.token) ? lock.token : null,
            };
          } catch { /* dead */ }
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* tmpdir unreadable */ }
  return null;
}

function debugLog(obj) {
  if (process.env.KIT_MCP_HOOK_DEBUG !== '1') return;
  try {
    const line = JSON.stringify({ ts: Date.now(), ...obj }) + '\n';
    fs.appendFileSync(path.join(os.tmpdir(), 'kit-mcp-hook.log'), line);
  } catch { /* noop */ }
}

function summarizeArgs(args) {
  if (!args || typeof args !== 'object') return null;
  const out = {};
  if (typeof args.command === 'string')       out.command   = truncate(args.command, 120);
  if (typeof args.file_path === 'string')     out.file_path = truncate(args.file_path, 200);
  if (typeof args.pattern === 'string')       out.pattern   = truncate(args.pattern, 80);
  if (typeof args.url === 'string')           out.url       = truncate(args.url, 120);
  if (typeof args.description === 'string')   out.description = truncate(args.description, 80);
  if (Array.isArray(args.actions))            out.action_count = args.actions.length;
  return Object.keys(out).length ? out : null;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function detectSource() {
  const ide = detectIde();
  const pid = process.ppid || process.pid;
  const id = `${ide}:${pid}`;
  return {
    id,
    ide,
    pid,
    hostname: os.hostname(),
  };
}

function detectIde() {
  if (process.env.CLAUDE_CODE_VERSION || process.env.CLAUDECODE) return 'claude-code';
  if (process.env.CURSOR_TRACE_ID) return 'cursor';
  if (process.env.TERM_PROGRAM === 'vscode') return 'vscode';
  if (process.env.JETBRAINS_IDE) return 'jetbrains';
  return 'unknown';
}

function publish(port, token, event) {
  return new Promise((resolve) => {
    const body = JSON.stringify(event);
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/publish',
      agent: false,
      headers: {
        host: `127.0.0.1:${port}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body, 'utf8'),
        origin: `http://127.0.0.1:${port}`,
        connection: 'close',
        // SEC-14-02: token is null for sidecars from v1.13 and earlier; in that
        // case we omit the header and the server returns 401, which the hook
        // silent-fails on (matching pre-existing soft-fail discipline). A
        // shipped hook v1.14 talking to a still-running sidecar v1.13 just
        // loses the event — acceptable trade-off.
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      // Drain response body to ensure server has fully processed before resolve.
      // v1.12.1 fix: await BOTH 'end' and 'close' to avoid premature exit before
      // sidecar publishes via SSE. Preserve that pattern here.
      res.resume();
      res.on('end', resolve);
      res.on('close', resolve);
    });
    req.on('error', () => resolve());
    req.setTimeout(800, () => { try { req.destroy(); } catch (_) { /* noop */ } resolve(); });
    req.write(body);
    req.end();
  });
}
