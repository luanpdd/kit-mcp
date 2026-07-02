// SEC-14-03 regression: handleSync + handleReverseSync via MCP must validate
// projectRoot against an allowlist heuristic (path absolute + exists + has
// .git/ in self or any ancestor) BEFORE dispatching to sync.js / reverse-sync.js.
//
// Threat model: an attacker controlling the MCP message sends
// `projectRoot=\\evil-host\share` or `projectRoot=%APPDATA%\someplace` to make
// the server write the kit projection (or a reverse-sync overwrite) into a
// disk path it shouldn't. The guard does not aim to perfectly identify "git
// workspaces"; it aims to bounce paths that are obviously not workspaces.
//
// We exercise the guard through the same dispatcher path the SDK uses
// (server._requestHandlers Map). This is a deliberate copy of the pattern
// established in test/unit/mcp-gates-guard.test.js (Phase 79.01) — testing
// validateProjectRoot directly is insufficient because it does not prove the
// wiring in handleSync / handleReverseSync.
//
// CLI is NOT exercised here: the contract is "CLI trusts whoever invoked
// bin/cli.js, MCP transport gets the guard". Test 6 enforces the CLI side of
// that contract by source-grepping src/cli/index.js for an import that must
// not exist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../src/mcp-server/index.js';

// Helper — invoke the MCP `tools/call` handler with a given tool name +
// arguments. Returns { text } with the JSON envelope, or { skip } if the SDK
// internals changed shape (the same defensive skip that mcp-gates-guard uses).
async function callTool(name, args) {
  const server = await createServer();
  const handlers = server._requestHandlers;
  if (!(handlers instanceof Map)) return { skip: 'sdk-internals-changed' };
  const callHandler = handlers.get('tools/call');
  if (typeof callHandler !== 'function') return { skip: 'sdk-internals-changed' };
  const extra = {
    signal: new AbortController().signal,
    sendNotification: async () => {},
    sendRequest: async () => ({}),
    requestId: 1,
    _meta: {},
  };
  const result = await callHandler(
    { method: 'tools/call', params: { name, arguments: args } },
    extra,
  );
  return { text: result?.content?.[0]?.text ?? '' };
}

// Cheap fixture — mkdtemp in os.tmpdir(). Each test makes its own; afterEach
// removes recursively.
async function mkTmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-pr-guard-'));
}

test('SEC-14-03 (1): handleSync rejects UNC fake host with stable error', async () => {
  const r = await callTool('sync', {
    action: 'install',
    target: 'claude-code',
    projectRoot: '\\\\evil-host\\share',
  });
  if (r.skip) { console.log('skip:', r.skip); return; }
  assert.match(r.text, /git workspace/, 'sentinel "git workspace" missing — MCP clients rely on it for refusal detection');
  // syncTo on success returns { ..., written: [...] }; on guard-rejected
  // dispatch the envelope is { error } only — assert no write side-effect leaked.
  let parsed = null;
  try { parsed = JSON.parse(r.text); } catch { /* tolerant */ }
  if (parsed) {
    assert.equal(parsed.written, undefined, 'syncTo must not have run — no `written` field allowed');
    assert.equal(typeof parsed.error, 'string', 'response must be { error: <string> }');
  }
});

test('SEC-14-03 (2): handleSync rejects path without .git in tree', async () => {
  const tmp = await mkTmp();
  try {
    const r = await callTool('sync', {
      action: 'install',
      target: 'claude-code',
      projectRoot: tmp,
    });
    if (r.skip) { console.log('skip:', r.skip); return; }
    assert.match(r.text, /git workspace/, 'tmpdir without .git/ should be rejected with sentinel');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('SEC-14-03 (3): handleSync accepts workspace with .git/ at root', async () => {
  const tmp = await mkTmp();
  try {
    // mkdir .git is enough for the heuristic — we don't need a real git repo.
    // The CONTEXT.md explicitly calls this an "allowlist heuristic".
    await fs.mkdir(path.join(tmp, '.git'), { recursive: true });
    const r = await callTool('sync', {
      action: 'install',
      target: 'claude-code',
      projectRoot: tmp,
    });
    if (r.skip) { console.log('skip:', r.skip); return; }
    // Happy path: the guard must NOT reject. syncTo may or may not succeed
    // (depends on whether kit/ resolution lands in this test environment),
    // but the sentinel "git workspace" must be absent.
    assert.doesNotMatch(r.text, /git workspace/, 'guard rejected a workspace it should have accepted');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('SEC-14-03 (4): handleSync accepts nested dir with .git/ in ancestor (monorepo)', async () => {
  const tmp = await mkTmp();
  try {
    await fs.mkdir(path.join(tmp, '.git'), { recursive: true });
    const nested = path.join(tmp, 'sub', 'sub2');
    await fs.mkdir(nested, { recursive: true });
    const r = await callTool('sync', {
      action: 'install',
      target: 'claude-code',
      projectRoot: nested,
    });
    if (r.skip) { console.log('skip:', r.skip); return; }
    assert.doesNotMatch(r.text, /git workspace/, 'walk-up to ancestor .git/ should accept nested path');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('SEC-14-03 (5): handleReverseSync (detect) also rejects UNC fake host', async () => {
  const r = await callTool('reverse-sync', {
    action: 'detect',
    target: 'claude-code',
    projectRoot: '\\\\evil-host\\share',
  });
  if (r.skip) { console.log('skip:', r.skip); return; }
  assert.match(r.text, /git workspace/, 'reverse-sync.detect must apply the same guard as sync');
  // detectReverse on success returns { candidates: [...] }; reject must scrub it.
  let parsed = null;
  try { parsed = JSON.parse(r.text); } catch { /* tolerant */ }
  if (parsed) {
    assert.equal(parsed.candidates, undefined, 'detectReverse must not have run');
  }
});

test('SEC-14-03 (6): CLI does not import validateProjectRoot (Phase 79.01 contract)', async () => {
  // Phase 79.01 contract — CLI trusts the invoking user; only MCP transport
  // gets the guard. This test is defensive: it prevents a future refactor
  // from accidentally tightening the CLI's behaviour and breaking stable
  // API v1.0+ (kit sync install <target> with no projectRoot must still work).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cliPath = path.resolve(here, '..', '..', 'src', 'cli', 'index.js');
  const content = await fs.readFile(cliPath, 'utf8');
  assert.doesNotMatch(
    content,
    /validateProjectRoot/,
    'src/cli/index.js must not import validateProjectRoot — guard is MCP-only',
  );
});
