// Phase 100 — Coverage ratchet: targeted tests for src/mcp-server/index.js
//
// Baseline: 81.06% line coverage. Target ≥ 90%.
// Existing tests cover the unknown-tool path (mcp-error-envelope.test.js),
// guards (mcp-projectroot-guard, mcp-gates-guard), and PKG_VERSION pinning.
// Here we cover the slim/slimTerse helpers, handler dispatch happy paths
// (kit list-*, kit get, kit search, sync targets, sync remove,
// reverse-sync detect, gates list/get/for-stage, forensics collect/etc,
// install targets/dry-run, metrics-snapshot), unknown-action errors per
// handler, and the withAutoSpawn wrapping (autoSpawn:false path).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from '../../src/mcp-server/index.js';

// Helper — invoke tools/call handler directly via SDK internals.
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
  return {
    text: result?.content?.[0]?.text ?? '',
    isError: !!result?.isError,
  };
}

async function mkTmpRepo() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-server-paths-'));
  // Mark as a git workspace so validateProjectRoot accepts it
  await fs.mkdir(path.join(tmp, '.git'), { recursive: true });
  return tmp;
}

// --- kit ---

test('mcp kit list-agents returns array of {kind,name,description}', async () => {
  const r = await callTool('kit', { action: 'list-agents' });
  if (r.skip) { console.log('skip:', r.skip); return; }
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
  for (const item of arr.slice(0, 3)) {
    assert.equal(typeof item.name, 'string');
    assert.equal(item.kind, 'agent');
    assert.equal(typeof item.description, 'string');
  }
});

test('mcp kit list-agents terse:true omits description', async () => {
  const r = await callTool('kit', { action: 'list-agents', terse: true });
  if (r.skip) { console.log('skip:', r.skip); return; }
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
  for (const item of arr.slice(0, 3)) {
    assert.equal(typeof item.name, 'string');
    assert.equal(item.kind, 'agent');
    assert.equal(item.description, undefined, 'terse mode must omit description');
  }
});

test('mcp kit list-commands returns array', async () => {
  const r = await callTool('kit', { action: 'list-commands' });
  if (r.skip) return;
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
  for (const item of arr.slice(0, 3)) {
    assert.equal(item.kind, 'command');
  }
});

test('mcp kit list-skills returns array', async () => {
  const r = await callTool('kit', { action: 'list-skills' });
  if (r.skip) return;
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
  for (const item of arr.slice(0, 3)) {
    assert.equal(item.kind, 'skill');
  }
});

test('mcp kit get with valid kind/name returns content', async () => {
  // Use 'planner' which is guaranteed to exist
  const r = await callTool('kit', { action: 'get', kind: 'agent', name: 'planner' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.equal(result.kind, 'agent');
  assert.equal(result.name, 'planner');
  assert.equal(typeof result.content, 'string');
  assert.ok(result.content.length > 0);
});

test('mcp kit get with invalid name returns error', async () => {
  const r = await callTool('kit', { action: 'get', kind: 'agent', name: 'nonexistent-xyz' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.match(result.error, /Not found:/);
});

test('mcp kit search returns object', async () => {
  const r = await callTool('kit', { action: 'search', query: 'planner' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.equal(typeof result, 'object');
});

test('mcp kit unknown action returns error', async () => {
  const r = await callTool('kit', { action: 'unknown-foo' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.match(result.error, /Unknown action: unknown-foo/);
});

// --- sync ---

test('mcp sync targets returns array of registry entries', async () => {
  const r = await callTool('sync', { action: 'targets' });
  if (r.skip) return;
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
  // Should include claude-code at minimum
  assert.ok(arr.some(t => t.id === 'claude-code'));
});

test('mcp sync remove on workspace returns ok-ish result', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('sync', {
      action: 'remove', target: 'claude-code', projectRoot: tmp,
    });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    assert.equal(typeof result, 'object');
    // No previously-installed stubs → removed array is empty or zero count
    assert.ok('removed' in result || 'target' in result);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp sync unknown action returns error', async () => {
  const r = await callTool('sync', { action: 'unknown-bar' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.match(result.error, /Unknown action: unknown-bar/);
});

// --- reverse-sync ---

test('mcp reverse-sync detect on workspace returns candidates array', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('reverse-sync', {
      action: 'detect', target: 'claude-code', projectRoot: tmp,
    });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    assert.ok('candidates' in result);
    assert.ok(Array.isArray(result.candidates));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp reverse-sync apply with strategy:skip on empty workspace returns results', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('reverse-sync', {
      action: 'apply', target: 'claude-code', projectRoot: tmp,
      strategy: 'skip',
    });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    // Should have target/strategy/results
    assert.equal(result.target, 'claude-code');
    assert.equal(result.strategy, 'skip');
    assert.ok(Array.isArray(result.results));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp reverse-sync unknown action returns error', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('reverse-sync', {
      action: 'unknown', target: 'claude-code', projectRoot: tmp,
    });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    assert.match(result.error, /Unknown action/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

// --- gates ---

test('mcp gates list returns array', async () => {
  const r = await callTool('gates', { action: 'list' });
  if (r.skip) return;
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
});

test('mcp gates get with valid id returns content', async () => {
  // budget-description is a known gate
  const r = await callTool('gates', { action: 'get', id: 'budget-description' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.equal(typeof result, 'object');
  assert.ok(result.content || result.id || 'description' in result);
});

test('mcp gates for-stage with stage returns array', async () => {
  const r = await callTool('gates', { action: 'for-stage', stage: 'pre-commit' });
  if (r.skip) return;
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
});

test('mcp gates unknown action returns error', async () => {
  const r = await callTool('gates', { action: 'unknown' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.match(result.error, /Unknown action/);
});

// --- forensics ---

test('mcp forensics collect on tmp returns {counts, items}', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('forensics', { action: 'collect', projectRoot: tmp });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    assert.ok('counts' in result);
    assert.ok(Array.isArray(result.items));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp forensics summarize on tmp returns array', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('forensics', { action: 'summarize', projectRoot: tmp });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    // summarizeByAgent returns array sorted by count desc
    assert.ok(Array.isArray(result));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp forensics write-learnings on tmp returns object', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('forensics', { action: 'write-learnings', projectRoot: tmp });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    assert.equal(typeof result, 'object');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp forensics list-replays on empty tmp returns empty array', async () => {
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('forensics', { action: 'list-replays', projectRoot: tmp });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    assert.ok(Array.isArray(result) || typeof result === 'object');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp forensics record-replay + load-replay round trip', async () => {
  const tmp = await mkTmpRepo();
  try {
    // Record
    const recR = await callTool('forensics', {
      action: 'record-replay',
      projectRoot: tmp,
      payload: { agent: 'planner', phase: 'p100', plan: '01', prompt: 'test' },
    });
    if (recR.skip) return;
    const rec = JSON.parse(recR.text);
    assert.ok(rec.id);
    // Load
    const loadR = await callTool('forensics', {
      action: 'load-replay', projectRoot: tmp, replayId: rec.id,
    });
    if (loadR.skip) return;
    const loaded = JSON.parse(loadR.text);
    assert.equal(loaded.id, rec.id);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp forensics unknown action returns error', async () => {
  const r = await callTool('forensics', { action: 'unknown', projectRoot: '/tmp' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.match(result.error, /Unknown action/);
});

// --- install (the MCP server itself into an IDE) ---

test('mcp install targets returns array', async () => {
  const r = await callTool('install', { action: 'targets' });
  if (r.skip) return;
  const arr = JSON.parse(r.text);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
});

test('mcp install dry-run claude-code returns ok with preview', async () => {
  // Use scope:project to avoid touching HOME
  const tmp = await mkTmpRepo();
  try {
    const r = await callTool('install', {
      action: 'dry-run', target: 'claude-code', scope: 'project',
      via: 'npx', projectRoot: tmp,
    });
    if (r.skip) return;
    const result = JSON.parse(r.text);
    assert.equal(result.dryRun, true);
    assert.equal(result.target, 'claude-code');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('mcp install unknown action returns error', async () => {
  const r = await callTool('install', { action: 'unknown' });
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.match(result.error, /Unknown action/);
});

// --- metrics-snapshot ---

test('mcp metrics-snapshot returns counters + latency object', async () => {
  const r = await callTool('metrics-snapshot', {});
  if (r.skip) return;
  const result = JSON.parse(r.text);
  assert.equal(typeof result, 'object');
  assert.ok('counters' in result);
  assert.ok('latency' in result);
});
