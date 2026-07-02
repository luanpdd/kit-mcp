// OBS-18 (Phase 94.01): end-to-end spawn smoke test for the metrics-snapshot tool.
//
// Runtime guarantee: spawn the real bin/mcp.js, invoke a sequence of tools
// (some succeeding, some failing), query metrics-snapshot, and assert that
// the returned envelope reflects the dispatcher instrumentation we wired in
// the central catch.
//
// Why a separate spawn-based test on top of test/unit/metrics.test.js:
//   - The unit suite proves the metrics module's arithmetic in isolation.
//   - This suite proves that the *wired* dispatcher actually calls the
//     instrumentation — same rationale as Phase 84.01's spawn test on top
//     of mcp-error-envelope unit test.
//
// Process isolation: each test spawns a fresh child with KIT_MCP_METRICS_RESET=1
// so module-level metrics state starts empty, regardless of any shared host
// counter accumulated across tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');
const mcpEntry = path.join(repoRoot, 'bin', 'mcp.js');

/**
 * Spawn a fresh MCP server, drive it through `requests`, and return parsed
 * JSON-RPC responses keyed by id. Each request must include `id`. Caller is
 * responsible for crafting the initialize handshake at id=1 — we wait briefly
 * after each write so the SDK can flush its response without buffering.
 */
async function driveServer(requests, { timeoutMs = 8000 } = {}) {
  const child = spawn(process.execPath, [mcpEntry], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, KIT_MCP_METRICS_RESET: '1' },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (b) => { stdout += b.toString(); });
  child.stderr.on('data', (b) => { stderr += b.toString(); });

  for (const req of requests) {
    child.stdin.write(JSON.stringify(req) + '\n');
    // Give the SDK time to flush before piling on the next request.
    await new Promise((r) => setTimeout(r, 200));
  }
  // Final settle window so the last response definitely lands on stdout.
  await new Promise((r) => setTimeout(r, 600));

  child.kill();
  await Promise.race([
    new Promise((r) => child.on('exit', r)),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);

  const byId = new Map();
  for (const line of stdout.split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line);
      if (j && typeof j.id === 'number') byId.set(j.id, j);
    } catch { /* non-JSON noise (e.g. shutdown banner) — ignore */ }
  }
  return { byId, stdout, stderr };
}

function envelopeJson(resp) {
  const text = resp?.result?.content?.[0]?.text ?? '';
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

test('OBS-18: metrics-snapshot reflects ok/error counters across multiple tool calls',
  { timeout: 15000 },
  async () => {
    const requests = [
      // 1) handshake
      {
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } },
      },
      // 2-4) three successful kit calls
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'kit', arguments: { action: 'list-agents', terse: true } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'kit', arguments: { action: 'list-commands', terse: true } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'kit', arguments: { action: 'list-skills', terse: true } } },
      // 5) one failing forensics — null replayId throws (Phase 84.01 trigger)
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'forensics', arguments: { action: 'load-replay', replayId: null } } },
      // 6) one unknown tool — counts as error against the spelled name
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'no-such-tool', arguments: {} } },
      // 7) read snapshot
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'metrics-snapshot', arguments: {} } },
    ];

    const { byId, stdout, stderr } = await driveServer(requests);

    const snap = byId.get(7);
    assert.ok(snap, `no snapshot response. stdout=${stdout.slice(0, 800)} stderr=${stderr.slice(0, 400)}`);
    const env = envelopeJson(snap);
    assert.ok(env, `snapshot envelope not parseable: ${JSON.stringify(snap)}`);

    // Counters: 3 ok kit calls, 1 error forensics, 1 error no-such-tool.
    // The metrics-snapshot tool itself is invoked AFTER the snapshot is built
    // (instrumentation runs around the handler return, and snapshot() is
    // called *inside* the handler). Therefore metrics-snapshot:ok will NOT
    // appear in this snapshot — the increment runs after snapshot() returns.
    assert.equal(env.counters['kit:ok'], 3, `kit:ok=3 expected, got ${env.counters['kit:ok']}`);
    assert.equal(env.counters['forensics:error'], 1, `forensics:error=1 expected`);
    assert.equal(env.counters['no-such-tool:error'], 1, `unknown-tool:error=1 expected`);
    // Defensive: there should be no ok/error split that we did not exercise.
    assert.equal(env.counters['kit:error'], undefined, 'no kit errors expected');
    assert.equal(env.counters['forensics:ok'], undefined, 'no forensics ok expected');
  },
);

test('OBS-18: metrics-snapshot reports per-tool latency p50/p95/p99 with positive count',
  { timeout: 15000 },
  async () => {
    // Drive 5 successful kit calls so the histogram has enough samples to
    // produce stable percentiles. We assert *shape* not magnitude — wall-clock
    // varies wildly across CI runners, so concrete ms values would be flaky.
    const requests = [
      {
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } },
      },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'kit', arguments: { action: 'list-agents', terse: true } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'kit', arguments: { action: 'list-commands', terse: true } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'kit', arguments: { action: 'list-skills', terse: true } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'kit', arguments: { action: 'list-agents' } } },
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'kit', arguments: { action: 'search', query: 'agent' } } },
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'metrics-snapshot', arguments: {} } },
    ];

    const { byId, stdout, stderr } = await driveServer(requests);

    const snap = byId.get(7);
    assert.ok(snap, `no snapshot. stdout=${stdout.slice(0, 800)} stderr=${stderr.slice(0, 400)}`);
    const env = envelopeJson(snap);
    assert.ok(env, 'snapshot envelope must parse');

    const kitLat = env.latency['kit'];
    assert.ok(kitLat, `expected latency entry for kit, got: ${JSON.stringify(env.latency)}`);
    assert.equal(kitLat.count, 5, `5 samples expected, got ${kitLat.count}`);
    // Percentiles must be non-negative numbers; p50 ≤ p95 ≤ p99.
    assert.equal(typeof kitLat.p50, 'number');
    assert.equal(typeof kitLat.p95, 'number');
    assert.equal(typeof kitLat.p99, 'number');
    assert.ok(kitLat.p50 >= 0, `p50 must be >= 0, got ${kitLat.p50}`);
    assert.ok(kitLat.p95 >= kitLat.p50, `p95 (${kitLat.p95}) must be >= p50 (${kitLat.p50})`);
    assert.ok(kitLat.p99 >= kitLat.p95, `p99 (${kitLat.p99}) must be >= p95 (${kitLat.p95})`);
  },
);

test('OBS-18: metrics-snapshot returns empty when no tools have been invoked',
  { timeout: 15000 },
  async () => {
    // KIT_MCP_METRICS_RESET=1 ensures a clean slate; first action is the
    // snapshot itself. Counters and latency must both be empty (the snapshot
    // call's own increment fires *after* snapshot() runs).
    const requests = [
      {
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } },
      },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'metrics-snapshot', arguments: {} } },
    ];

    const { byId, stdout, stderr } = await driveServer(requests);
    const snap = byId.get(2);
    assert.ok(snap, `no snapshot. stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 400)}`);
    const env = envelopeJson(snap);
    assert.ok(env, 'snapshot envelope must parse');

    assert.deepEqual(env, { counters: {}, latency: {} },
      `expected fully empty snapshot, got: ${JSON.stringify(env)}`);
  },
);

test('OBS-18: metrics-snapshot tool advertised in tools/list response',
  { timeout: 15000 },
  async () => {
    // Sanity: the new tool descriptor must be visible to MCP clients via
    // ListToolsRequestSchema. Without this, no LLM agent can ever call it.
    const requests = [
      {
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } },
      },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    ];

    const { byId, stdout, stderr } = await driveServer(requests);
    const list = byId.get(2);
    assert.ok(list, `no tools/list response. stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 400)}`);
    const tools = list.result?.tools ?? [];
    const metricsTool = tools.find((t) => t.name === 'metrics-snapshot');
    assert.ok(metricsTool, `metrics-snapshot not in tools list. names=${tools.map((t) => t.name).join(',')}`);
    assert.match(metricsTool.description, /metrics|signals|latency/i,
      'description should hint at metrics readout');
  },
);
