// Phase 97 — Coverage ratchet: tests for src/ui/auto-spawn.js
//
// Pre-existing coverage: 30.97% line. The module spawns the sidecar in a
// detached subprocess and waits for /healthz. Real spawning would launch
// bin/ui.js, leaving an orphan sidecar in os.tmpdir() — so we instead drive
// the function through paths that don't require launching:
//   1. no_project_root early return
//   2. existing-and-healthy lockfile path (we run a tiny test HTTP server on
//      a free port, write a lockfile pointing at it, then assert ensureSidecar
//      returns spawned=false)
//   3. healthzOk against an unreachable port (timeout path)
//   4. __test exports surface
//   5. healthz_timeout path: invalid UI_BIN → spawn returns but child exits;
//      polling times out (~5s). We override POLL_TIMEOUT_MS via env? Not
//      exposed — instead we run with a too-short deadline by stubbing the
//      module via a child Node process (skipped — overkill). Instead, we
//      verify the timeout reason path through a unit-level seam: call
//      ensureSidecar with a project that's never been started AND we mock
//      spawn by having KIT_MCP_NO_UI? Not applicable here. We verify the
//      *fast* paths and the test exports; the slow timeout path is exercised
//      by integration tests in production.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { ensureSidecar, __test } from '../../src/ui/auto-spawn.js';
import { lockPathFor, releaseLock } from '../../src/ui/lockfile.js';

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-autospawn-'));
}

// startMockSidecar — minimal HTTP server that responds 200 to /healthz so
// ensureSidecar can pick it up via the existing-lock path without us having
// to launch the real bin/ui.js.
async function startMockSidecar() {
  const srv = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve, reject) => {
    srv.listen(0, '127.0.0.1', resolve);
    srv.once('error', reject);
  });
  return { srv, port: srv.address().port, close: () => new Promise(r => srv.close(r)) };
}

test('__test exports surface — constants and helpers reachable for tests', () => {
  assert.equal(typeof __test.healthzOk, 'function');
  assert.equal(typeof __test.UI_BIN, 'string');
  assert.match(__test.UI_BIN, /bin[\\/]ui\.js$/);
  assert.equal(__test.POLL_INTERVAL_MS, 100);
  assert.equal(__test.POLL_TIMEOUT_MS, 5000);
});

test('healthzOk — resolves false against an unused port', async () => {
  // A clearly-unused high port. healthzOk should not throw — it must resolve
  // false within the request timeout (800ms inside the helper).
  const ok = await __test.healthzOk(1);  // port 1 → ECONNREFUSED on every OS
  assert.equal(ok, false);
});

test('healthzOk — resolves true when a server returns 200 on /healthz', async () => {
  const mock = await startMockSidecar();
  try {
    const ok = await __test.healthzOk(mock.port);
    assert.equal(ok, true);
  } finally {
    await mock.close();
  }
});

test('healthzOk — resolves false when server responds non-200', async () => {
  const srv = http.createServer((req, res) => { res.writeHead(500); res.end(); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  try {
    const ok = await __test.healthzOk(srv.address().port);
    assert.equal(ok, false);
  } finally {
    await new Promise(r => srv.close(r));
  }
});

test('ensureSidecar — returns ready:false when projectRoot omitted', async () => {
  const r = await ensureSidecar({});
  assert.equal(r.ready, false);
  assert.equal(r.reason, 'no_project_root');
});

test('ensureSidecar — returns ready:false when called without args', async () => {
  const r = await ensureSidecar();
  assert.equal(r.ready, false);
  assert.equal(r.reason, 'no_project_root');
});

test('ensureSidecar — existing-and-healthy lockfile is reused (spawned:false)', async () => {
  const root = mkRoot();
  const mock = await startMockSidecar();
  try {
    // Hand-write a lockfile pointing at the mock server. Bypassing acquireLock
    // because the test isn't running on the lock's process and we just want
    // to drive ensureSidecar's "already running" branch.
    const lockPath = lockPathFor(root);
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: process.pid,
      port: mock.port,
      version: '1.0.0-test',
      startedAt: new Date().toISOString(),
    }), 'utf8');

    const r = await ensureSidecar({ projectRoot: root, openBrowserOnSpawn: false });
    assert.equal(r.ready, true);
    assert.equal(r.spawned, false, 'should not spawn — existing sidecar healthy');
    assert.equal(r.opened, false);
    assert.equal(r.port, mock.port);
  } finally {
    await mock.close();
    releaseLock(root);
  }
});
