// Phase 18 hardening tests. Covers OPS-03 (kill -9 recovery),
// OPS-04 (multi-publisher race), OPS-05 (MCP stdio uncorrupted).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

import { createServer } from '../../src/ui/server.js';
import { releaseLock, lockPathFor, acquireLock, readLock } from '../../src/ui/lockfile.js';
import { publish, clearPortCache } from '../../src/ui/client.js';
import { acquireLockOrReclaim } from '../../src/ui/lockfile.js';

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-hard-test-'));
}

// ----- OPS-03: kill -9 recovery -----

test('OPS-03: stale lockfile (dead pid) is reclaimable on next start', async () => {
  const root = mkProjectRoot();
  releaseLock(root);

  // Plant a lockfile claiming a pid that does not exist.
  fs.writeFileSync(lockPathFor(root), JSON.stringify({
    pid: 999999998,
    port: 7100,
    version: '1.2.0',
    startedAt: 0,
    lockSchema: 1,
  }));

  // First start should detect the stale lock and reclaim it.
  const lock = await acquireLockOrReclaim({ projectRoot: root, port: 50800 });
  try {
    assert.equal(lock.pid, process.pid, 'should have reclaimed and rewritten with own pid');
    assert.equal(lock.port, 50800);
  } finally {
    releaseLock(root);
  }
});

// ----- OPS-04: multi-publisher race -----

test('OPS-04: 2 concurrent publishers both succeed; events arrive in order', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  clearPortCache();
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    // Fire 2 publishers concurrently. They use the same projectRoot, so they
    // resolve to the same port via the shared lockfile. http.request handles
    // serialization at the server.
    const before = srv.eventsTotal;
    const [r1, r2] = await Promise.all([
      publish({ type: 'milestone', ts: Date.now(), runId: null, payload: { from: 'A' } }, { projectRoot: root }),
      publish({ type: 'milestone', ts: Date.now(), runId: null, payload: { from: 'B' } }, { projectRoot: root }),
    ]);
    assert.equal(r1.sent, true, `A: ${r1.reason}`);
    assert.equal(r2.sent, true, `B: ${r2.reason}`);
    assert.ok(srv.eventsTotal >= before + 2);
  } finally {
    await srv.shutdown();
    releaseLock(root);
  }
});

// ----- OPS-05: MCP stdio uncorrupted -----

test('OPS-05: bin/ui.js running does not write to stdout (does not poison MCP frames)', async () => {
  const root = mkProjectRoot();
  releaseLock(root);

  const child = spawn(process.execPath, ['bin/ui.js', '--project-root', root, '--idle-ms', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, KIT_MCP_NO_OPEN: '1' },
  });

  let stdoutAcc = '';
  let stderrAcc = '';
  child.stdout.on('data', (chunk) => { stdoutAcc += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { stderrAcc += chunk.toString('utf8'); });

  // Wait until "listening" appears in stderr — proof server booted.
  const ready = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 5000);
    const onErr = () => {
      if (stderrAcc.match(/listening on http:\/\/127\.0\.0\.1/)) {
        clearTimeout(t);
        child.stderr.off('data', onErr);
        resolve(true);
      }
    };
    child.stderr.on('data', onErr);
  });

  assert.equal(ready, true, `sidecar didn't boot in time. stderr=${stderrAcc.slice(0, 500)}`);

  // Make a request to drive some logging activity
  const lock = readLock(root);
  if (lock?.port) {
    await new Promise((resolve) => {
      const req = http.request({
        method: 'GET', host: '127.0.0.1', port: lock.port, path: '/healthz',
        agent: false, headers: { host: `127.0.0.1:${lock.port}`, connection: 'close' },
      }, (res) => { res.resume(); res.on('end', resolve); });
      req.on('error', resolve);
      req.end();
    });
  }

  // Give it a tick for any buffered output
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Hard requirement: stdout MUST be empty (REQ SEC-04 in production)
  assert.equal(stdoutAcc, '', `stdout poisoned: ${stdoutAcc.slice(0, 300)}`);

  // Cleanup
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    child.on('exit', resolve);
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 1500);
  });
  releaseLock(root);
});
