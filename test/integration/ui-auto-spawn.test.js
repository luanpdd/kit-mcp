import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureSidecar } from '../../src/ui/auto-spawn.js';
import { readLock, releaseLock, lockPathFor } from '../../src/ui/lockfile.js';
import { createServer } from '../../src/ui/server.js';

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-as-test-'));
}

function cleanLock(root) {
  try { releaseLock(root); } catch { /* noop */ }
}

test('ensureSidecar: returns no_project_root when missing', async () => {
  const r = await ensureSidecar({});
  assert.equal(r.ready, false);
  assert.equal(r.reason, 'no_project_root');
});

test('ensureSidecar: returns existing port when sidecar already running', async () => {
  const root = mkProjectRoot();
  cleanLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const r = await ensureSidecar({ projectRoot: root, openBrowserOnSpawn: false });
    assert.equal(r.ready, true);
    assert.equal(r.spawned, false);
    assert.equal(r.opened, false);
    assert.equal(r.port, srv.port);
  } finally {
    await srv.shutdown();
    cleanLock(root);
  }
});

test('ensureSidecar: spawns a new process when no sidecar present (openBrowser disabled)', async () => {
  // We disable the browser launch via env to keep CI quiet.
  const root = mkProjectRoot();
  cleanLock(root);
  process.env.KIT_MCP_NO_OPEN = '1';
  try {
    const r = await ensureSidecar({ projectRoot: root, openBrowserOnSpawn: false });
    assert.equal(r.ready, true, `not ready: ${r.reason}`);
    assert.equal(r.spawned, true);
    assert.ok(r.port >= 7100 && r.port <= 7199, `unexpected port: ${r.port}`);
    // Lockfile should now exist
    const lock = readLock(root);
    assert.ok(lock, 'expected lockfile after spawn');
    assert.equal(lock.port, r.port);
  } finally {
    // Clean up: try to stop the spawned sidecar
    const lock = readLock(root);
    if (lock?.pid) {
      try { process.kill(lock.pid, 'SIGTERM'); } catch { /* noop */ }
    }
    // Give it a moment to die
    await new Promise((resolve) => setTimeout(resolve, 200));
    cleanLock(root);
    delete process.env.KIT_MCP_NO_OPEN;
  }
});
