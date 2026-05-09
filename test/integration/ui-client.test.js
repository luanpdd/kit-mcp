import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createServer } from '../../src/ui/server.js';
import { releaseLock } from '../../src/ui/lockfile.js';
import { publish, clearPortCache } from '../../src/ui/client.js';

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-test-'));
}

async function withServer(fn) {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  clearPortCache();
  try {
    await fn(srv, root);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
    clearPortCache();
  }
}

// SEC-14-02: Plan 02 propagated token through publish(); test reactivated.
test('publish: succeeds when sidecar is running', async () => {
  await withServer(async (srv, root) => {
    const result = await publish({
      type: 'progress',
      ts: Date.now(),
      runId: null,
      payload: { percent: 33 },
    }, { projectRoot: root });
    assert.equal(result.sent, true);
    assert.equal(result.status, 202);
  });
});

test('publish: returns no_sidecar when no lockfile', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  clearPortCache();
  const r = await publish({
    type: 'progress',
    ts: Date.now(),
    runId: null,
  }, { projectRoot: root });
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'no_sidecar');
});

test('publish: returns no_project_root when missing', async () => {
  const r = await publish({ type: 'progress', ts: Date.now() }, {});
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'no_project_root');
});

test('publish: rejects invalid event without sending', async () => {
  await withServer(async (srv, root) => {
    const r = await publish({ type: 'bogus', ts: Date.now() }, { projectRoot: root });
    assert.equal(r.sent, false);
    assert.match(r.reason, /invalid_event/);
  });
});

test('publish: handles ECONNREFUSED gracefully (stale lockfile)', async () => {
  // Plant a lockfile pointing at a port nothing is listening on.
  const root = mkProjectRoot();
  releaseLock(root);
  const lockPath = path.join(os.tmpdir(), 'kit-mcp-ui-stale-test.lock');
  // Use the real path-for from the lockfile module so we hit the same path the client reads
  const { lockPathFor } = await import('../../src/ui/lockfile.js');
  fs.writeFileSync(lockPathFor(root), JSON.stringify({ pid: process.pid, port: 65530 }));
  clearPortCache();
  try {
    const r = await publish({ type: 'progress', ts: Date.now() }, { projectRoot: root });
    assert.equal(r.sent, false);
    assert.match(r.reason, /^error:/);
  } finally {
    releaseLock(root);
  }
});

// SEC-14-02: Plan 02 propagated token through publish(); test reactivated.
test('publish: events arrive in /state of the running sidecar', async () => {
  await withServer(async (srv, root) => {
    const before = srv.eventsTotal;
    const r1 = await publish({ type: 'milestone', ts: Date.now(), runId: null, payload: { name: 'phase15' } }, { projectRoot: root });
    const r2 = await publish({ type: 'milestone', ts: Date.now(), runId: null, payload: { name: 'tested' } }, { projectRoot: root });
    assert.equal(r1.sent, true);
    assert.equal(r2.sent, true);
    // run.start was emitted on server boot, so count grows by at least 2.
    assert.ok(srv.eventsTotal >= before + 2, `expected eventsTotal to grow by 2, got ${srv.eventsTotal} from ${before}`);
  });
});
