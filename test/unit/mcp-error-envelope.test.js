// SEC-14-06: integration test for the MCP central catch sanitizer.
//
// Goal: prove that the *wired* dispatcher (server._requestHandlers Map),
// not just the redaction helper in isolation, returns sanitized envelopes.
// We exercise the same path the SDK uses at runtime — the same probe
// pattern established in test/unit/mcp-projectroot-guard.test.js
// (Phase 83.01) and test/unit/mcp-gates-guard.test.js (Phase 79.01).
//
// Trigger: forensics action=load-replay with replayId=null.
// Why: validateReplayId in src/core/replays.js throws on null with a
// real Error whose .stack contains an absolute path
// (D:\projetos\opensource\mcp\src\core\replays.js:30 on this Windows
// build). That stack is exactly what we must NOT leak.
//
// CLI not exercised — the central catch is server-side only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../src/mcp-server/index.js';

// Identical helper to mcp-projectroot-guard / mcp-gates-guard so the SDK-
// internals defensive skip and abort signals stay uniform across guards.
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
  return { text: result?.content?.[0]?.text ?? '', isError: !!result?.isError };
}

test('SEC-14-06 (1): unknown tool envelope has no stack field', async () => {
  // Unknown-tool path returns { error: 'Unknown tool: ...' } directly without
  // throwing — sanity baseline that the un-thrown path also lacks a stack.
  const r = await callTool('nonexistent-tool', {});
  if (r.skip) { console.log('skip:', r.skip); return; }
  const parsed = JSON.parse(r.text);
  assert.equal('stack' in parsed, false, 'unknown-tool envelope must not include a stack');
  assert.match(parsed.error, /Unknown tool/);
});

test('SEC-14-06 (2): handler throw produces envelope with no stack and no absolute path', async () => {
  // forensics load-replay with null id → validateReplayId throws.
  // The thrown Error's stack contains the absolute path to replays.js;
  // sanitizeMcpError must strip it.
  const r = await callTool('forensics', { action: 'load-replay', replayId: null });
  if (r.skip) { console.log('skip:', r.skip); return; }
  assert.equal(r.isError, true, 'thrown handler should set isError flag');

  const parsed = JSON.parse(r.text);
  assert.equal(typeof parsed.error, 'string', 'envelope must carry a string error');
  assert.equal(parsed.stack, undefined, 'envelope must NOT include a stack field');
  assert.equal('stack' in parsed, false, 'stack key must not exist at all');

  // No Windows-style absolute path
  assert.doesNotMatch(parsed.error, /[A-Z]:[\\\/]/, `envelope leaks Win path: ${parsed.error}`);
  // No Unix-style absolute home path
  assert.doesNotMatch(parsed.error, /\/(home|Users|root)\//, `envelope leaks Unix path: ${parsed.error}`);
});

test('SEC-14-06 (3): error message preamble preserved (sanitization is surgical)', async () => {
  // Same trigger — verify we did not over-redact and destroy the actual
  // diagnostic content. The validation error reads
  // "invalid replay id: must be a non-empty string" which has no secrets
  // or paths and must round-trip verbatim.
  const r = await callTool('forensics', { action: 'load-replay', replayId: null });
  if (r.skip) { console.log('skip:', r.skip); return; }
  const parsed = JSON.parse(r.text);
  assert.match(parsed.error, /invalid replay id/i, `expected real error message preserved, got: ${parsed.error}`);
});

test('SEC-14-06 (4): envelope carries a code field of type string', async () => {
  // err.code propagation is unit-tested in test/unit/error-redaction.test.js
  // (Phase 83 EMANIFESTMISMATCH case). Here we assert only that the wired
  // dispatcher includes SOME code in the envelope — defaulting to
  // MCP_INTERNAL_ERROR for un-coded errors, which is the most common path.
  const r = await callTool('forensics', { action: 'load-replay', replayId: null });
  if (r.skip) { console.log('skip:', r.skip); return; }
  const parsed = JSON.parse(r.text);
  assert.equal(typeof parsed.code, 'string', 'envelope must include code:string');
  assert.ok(parsed.code.length > 0, 'code must be non-empty');
});

test('SEC-14-06 (5): no stack field across multiple thrown-handler paths', async () => {
  // Run a small sweep of trigger combos that all reach the central catch
  // via different handler bodies, asserting the same invariants on each.
  const triggers = [
    { name: 'forensics', args: { action: 'load-replay', replayId: null } },
    { name: 'forensics', args: { action: 'annotate-replay', replayId: null, outcome: {} } },
    { name: 'forensics', args: { action: 'record-replay', payload: { phase: '../../etc' } } },
  ];

  for (const t of triggers) {
    const r = await callTool(t.name, t.args);
    if (r.skip) { console.log('skip:', r.skip); return; }
    let parsed;
    try { parsed = JSON.parse(r.text); }
    catch { assert.fail(`envelope was not JSON for ${t.name}/${t.args.action}: ${r.text}`); }

    assert.equal('stack' in parsed, false,
      `stack leaked on ${t.name}/${t.args.action}: ${r.text.slice(0, 200)}`);
    assert.doesNotMatch(parsed.error ?? '', /[A-Z]:[\\\/]/,
      `Win path leaked on ${t.name}/${t.args.action}: ${parsed.error}`);
    assert.doesNotMatch(parsed.error ?? '', /\/(home|Users|root)\//,
      `Unix path leaked on ${t.name}/${t.args.action}: ${parsed.error}`);
  }
});
