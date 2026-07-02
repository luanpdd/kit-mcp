// OBS-20-01 (Phase 102.01) — regression tests for auto-persist behavior in
// the metrics-snapshot MCP tool.
//
// Phase 99.01 (v1.19) wired persistSnapshot/loadSnapshots/cleanup so the
// /burn-rate-status command could read rolling snapshots. The gap that this
// phase closes: the persist trigger was MANUAL (someone had to call the
// command, or call persistSnapshot() directly). In production, snapshots dir
// stayed empty until somebody remembered.
//
// Phase 102.01 makes handleMetricsSnapshot in src/mcp-server/index.js
// invoke persistSnapshot() automatically before returning the in-memory
// payload, with a 1-second in-memory throttle so a polling client can't
// hammer disk. Stable API v1.0+ is preserved — handler signature is still
// parameterless, return shape is still { counters, latency }.
//
// Coverage matrix (4 canonical scenarios):
//   1. First call → persist (snapshots dir grows from 0 → 1 file)
//   2. Second call within 1s → reuse (file count unchanged at 1)
//   3. Third call after >1s → persist (file count grows to 2)
//   4. fs error during persist → handler still returns payload (no crash)
//
// Test isolation strategy:
//   - mkdtemp under os.tmpdir() per test, process.chdir() into it so
//     persistSnapshot resolves rootDir to the tmpdir. afterEach restores.
//   - Cache-bust the mcp-server import via `?t=${Date.now()}` query string
//     so the module-level _lastAutoPersistTs resets between tests. Same
//     trick resets metrics.js counters/histograms transitively, since the
//     fresh import re-evaluates both modules.
//   - Test 4 forces persistSnapshot to fail by pre-creating .planning as a
//     REGULAR FILE in the tmpdir. fs.mkdir(.../snapshots, {recursive:true})
//     then throws ENOTDIR cross-platform. Cleaner than monkey-patching the
//     fs module binding (which ESM namespace objects don't allow).
//
// Pure unit — no spawn, no network. The SDK internals are accessed via
// server._requestHandlers.get('tools/call') — same pattern as
// mcp-error-envelope.test.js, mcp-projectroot-guard.test.js, etc.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

let TMP_ROOT;
let ORIGINAL_CWD;

beforeEach(async () => {
  ORIGINAL_CWD = process.cwd();
  TMP_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-auto-snap-'));
  process.chdir(TMP_ROOT);
});

afterEach(async () => {
  process.chdir(ORIGINAL_CWD);
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
});

// Fresh import bypasses the ESM module cache so module-level
// _lastAutoPersistTs (and metrics.js maps transitively) start clean.
async function freshCallTool(name, args) {
  const mod = await import(`../../src/mcp-server/index.js?t=${Date.now()}-${Math.random()}`);
  const server = await mod.createServer();
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
  // Return both the parsed envelope and a re-callable handler so a single
  // test can drive multiple sequential calls against the SAME server (and
  // therefore the SAME _lastAutoPersistTs state).
  return {
    text: result?.content?.[0]?.text ?? '',
    isError: !!result?.isError,
    callAgain: async (n2, a2) => {
      const r2 = await callHandler(
        { method: 'tools/call', params: { name: n2, arguments: a2 } },
        extra,
      );
      return { text: r2?.content?.[0]?.text ?? '', isError: !!r2?.isError };
    },
  };
}

async function listSnapshotFiles() {
  const dir = path.join(process.cwd(), '.planning', 'metrics', 'snapshots');
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
}

test('OBS-20-01 (1): first call to metrics-snapshot persists a snapshot file to disk', async () => {
  const before = await listSnapshotFiles();
  assert.equal(before.length, 0, 'precondition: tmp dir starts with no snapshots');

  const r = await freshCallTool('metrics-snapshot', {});
  if (r.skip) { console.log('skip:', r.skip); return; }

  // Handler must still return the in-memory snapshot envelope unchanged.
  const parsed = JSON.parse(r.text);
  assert.equal(typeof parsed, 'object', 'envelope must be a JSON object');
  assert.ok('counters' in parsed, 'envelope keeps counters key');
  assert.ok('latency' in parsed, 'envelope keeps latency key');
  assert.equal(r.isError, false, 'handler must not flag isError');

  // Side effect: 1 new snapshot file under .planning/metrics/snapshots/
  const after = await listSnapshotFiles();
  assert.equal(after.length, 1,
    `expected exactly 1 persisted snapshot file, got ${after.length}: ${JSON.stringify(after)}`);
  assert.match(after[0], /\.json$/, 'persisted file must be .json');
});

test('OBS-20-01 (2): second call within 1s reuses (does NOT create a new file)', async () => {
  const r1 = await freshCallTool('metrics-snapshot', {});
  if (r1.skip) { console.log('skip:', r1.skip); return; }

  const afterFirst = await listSnapshotFiles();
  assert.equal(afterFirst.length, 1, 'first call must persist 1 file');

  // Immediate second call — well within the 1s throttle window.
  // Use callAgain so we hit the SAME server and SAME module-level state
  // (recreating the server would reset _lastAutoPersistTs, defeating the
  // throttle test).
  const r2 = await r1.callAgain('metrics-snapshot', {});
  const parsed2 = JSON.parse(r2.text);
  assert.ok('counters' in parsed2, 'second call still returns proper envelope');
  assert.equal(r2.isError, false, 'second call must not flag isError');

  // Throttle invariant: file count unchanged.
  const afterSecond = await listSnapshotFiles();
  assert.equal(afterSecond.length, 1,
    `throttle violated — expected 1 file (reuse), got ${afterSecond.length}: ${JSON.stringify(afterSecond)}`);
});

test('OBS-20-01 (3): third call after >1s persists a new file', async () => {
  const r1 = await freshCallTool('metrics-snapshot', {});
  if (r1.skip) { console.log('skip:', r1.skip); return; }

  const afterFirst = await listSnapshotFiles();
  assert.equal(afterFirst.length, 1, 'first call persists 1 file');

  // Wait > AUTO_PERSIST_THROTTLE_MS (1000ms). 1100ms gives ~10% headroom
  // against scheduler jitter on slow CI runners.
  await new Promise(resolve => setTimeout(resolve, 1100));

  const r2 = await r1.callAgain('metrics-snapshot', {});
  assert.equal(r2.isError, false, 'eventual call must not flag isError');
  const parsed2 = JSON.parse(r2.text);
  assert.ok('counters' in parsed2, 'envelope shape unchanged');

  const afterSecond = await listSnapshotFiles();
  assert.equal(afterSecond.length, 2,
    `expected 2 files after throttle expiry, got ${afterSecond.length}: ${JSON.stringify(afterSecond)}`);
});

test('OBS-20-01 (4): fs error during persist does NOT crash the handler', async () => {
  // Force persistSnapshot to fail by pre-creating .planning as a REGULAR FILE.
  // fs.mkdir(<tmp>/.planning/metrics/snapshots, { recursive: true }) then
  // throws ENOTDIR — the persist branch in handleMetricsSnapshot must catch
  // this, write to stderr, and let the handler return the in-memory payload.
  const blockerPath = path.join(process.cwd(), '.planning');
  await fs.writeFile(blockerPath, 'this is a regular file, not a dir');

  const r = await freshCallTool('metrics-snapshot', {});
  if (r.skip) { console.log('skip:', r.skip); return; }

  // PRIMARY ASSERTION: handler did NOT crash. isError stays false; the
  // central catch in createServer would have flagged isError=true if the
  // persistSnapshot exception had propagated up.
  assert.equal(r.isError, false,
    `handler must absorb fs error; isError leaked: ${r.text}`);

  // Envelope is valid JSON with the expected shape.
  const parsed = JSON.parse(r.text);
  assert.equal(typeof parsed, 'object', 'envelope must be a JSON object');
  assert.ok('counters' in parsed, 'envelope keeps counters key on fs error');
  assert.ok('latency' in parsed, 'envelope keeps latency key on fs error');

  // No file was persisted because mkdir failed (the dir under our blocker
  // file cannot exist). This confirms the failure path actually fired.
  // (We can't read .planning as a directory — we wrote a regular file there.)
  let dirContents;
  try {
    dirContents = await fs.readdir(path.join(process.cwd(), '.planning', 'metrics', 'snapshots'));
  } catch {
    dirContents = null; // ENOENT/ENOTDIR → no snapshot dir
  }
  assert.equal(dirContents, null,
    `expected no snapshots dir (mkdir blocked), but found: ${JSON.stringify(dirContents)}`);
});
