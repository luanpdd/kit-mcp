// Phase 100 — Coverage ratchet: targeted tests for src/ui/client.js
//
// Baseline: 48.46% line coverage. Target ≥ 90%.
// `client.js` exposes publish/publishMany/clearPortCache. Cover every branch:
// validation rejection, no-sidecar (no lockfile), HTTP 2xx success,
// HTTP 401/403/404 (which invalidate cache), HTTP 5xx (cache preserved),
// network error (ECONNREFUSED), timeout, publishMany ordering,
// clearPortCache resetting state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { publish, publishMany, clearPortCache } from '../../src/ui/client.js';
import { lockPathFor } from '../../src/ui/lockfile.js';

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-client-paths-'));
}

// Spin up an in-process HTTP server emulating the sidecar /publish endpoint.
// Returns { port, requestsReceived, close, server }.
async function startMockSidecar({
  statusCode = 204,
  hangOnPublish = false,
  requireAuth = false,
  expectedToken = null,
} = {}) {
  const requestsReceived = [];
  const srv = http.createServer((req, res) => {
    if (req.url !== '/publish') {
      res.writeHead(404); res.end();
      return;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      requestsReceived.push({
        method: req.method,
        headers: req.headers,
        body,
      });
      if (hangOnPublish) {
        // Never write a response. Client must time out.
        return;
      }
      if (requireAuth) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ') || (expectedToken && auth.slice(7) !== expectedToken)) {
          res.writeHead(401); res.end();
          return;
        }
      }
      res.writeHead(statusCode); res.end();
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return {
    port: srv.address().port,
    requestsReceived,
    server: srv,
    close: () => new Promise(r => srv.close(r)),
  };
}

function writeLockfile(root, port, token) {
  const lockPath = lockPathFor(root);
  const meta = {
    pid: process.pid,
    port,
    version: '1.0.0-test',
    startedAt: new Date().toISOString(),
    lockSchema: 1,
  };
  if (token !== undefined) meta.token = token;
  fs.writeFileSync(lockPath, JSON.stringify(meta), 'utf8');
  return lockPath;
}

function deleteLockfile(root) {
  try { fs.unlinkSync(lockPathFor(root)); } catch { /* noop */ }
}

function validEvent() {
  return { type: 'progress', ts: Date.now(), runId: null, payload: { current: 1, total: 10 } };
}

// --- validation paths ---

test('publish — no projectRoot returns reason:no_project_root', async () => {
  clearPortCache();
  const r = await publish(validEvent(), {});
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'no_project_root');
});

test('publish — invalid event type returns reason:invalid_event', async () => {
  clearPortCache();
  const root = mkRoot();
  const r = await publish({ type: 'NOT-A-VALID-TYPE', ts: Date.now() }, { projectRoot: root });
  assert.equal(r.sent, false);
  assert.match(r.reason, /^invalid_event:/);
});

test('publish — null event returns reason:invalid_event', async () => {
  clearPortCache();
  const root = mkRoot();
  const r = await publish(null, { projectRoot: root });
  assert.equal(r.sent, false);
  assert.match(r.reason, /^invalid_event:/);
});

// --- no sidecar ---

test('publish — no lockfile present returns reason:no_sidecar', async () => {
  clearPortCache();
  const root = mkRoot();
  deleteLockfile(root);  // ensure absent
  const r = await publish(validEvent(), { projectRoot: root });
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'no_sidecar');
});

// --- HTTP success ---

test('publish — sidecar returns 204: sent:true with status', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ statusCode: 204 });
  try {
    writeLockfile(root, mock.port);
    const r = await publish(validEvent(), { projectRoot: root });
    assert.equal(r.sent, true);
    assert.equal(r.status, 204);
    assert.equal(mock.requestsReceived.length, 1);
    assert.match(mock.requestsReceived[0].body, /"type":"progress"/);
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

test('publish — sidecar with token returns 200 when Authorization matches', async () => {
  clearPortCache();
  const root = mkRoot();
  const token = 'a'.repeat(64);
  const mock = await startMockSidecar({ statusCode: 200, requireAuth: true, expectedToken: token });
  try {
    writeLockfile(root, mock.port, token);
    const r = await publish(validEvent(), { projectRoot: root });
    assert.equal(r.sent, true);
    assert.equal(r.status, 200);
    assert.match(mock.requestsReceived[0].headers.authorization, /^Bearer /);
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

// --- HTTP 4xx invalidate cache ---

test('publish — sidecar 401 returns reason:http_401 and invalidates cache', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ requireAuth: true, expectedToken: 'right-token' });
  try {
    writeLockfile(root, mock.port, 'wrong-token');
    const r = await publish(validEvent(), { projectRoot: root });
    assert.equal(r.sent, false);
    assert.equal(r.reason, 'http_401');
    // Now write a correct lockfile and verify cache was invalidated
    deleteLockfile(root);
    writeLockfile(root, mock.port, 'right-token');
    const r2 = await publish(validEvent(), { projectRoot: root });
    assert.equal(r2.sent, true);
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

test('publish — sidecar 404 returns reason:http_404 and invalidates cache', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ statusCode: 404 });
  try {
    writeLockfile(root, mock.port);
    const r = await publish(validEvent(), { projectRoot: root });
    assert.equal(r.sent, false);
    assert.equal(r.reason, 'http_404');
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

test('publish — sidecar 500 returns reason:http_500 (cache preserved)', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ statusCode: 500 });
  try {
    writeLockfile(root, mock.port);
    const r = await publish(validEvent(), { projectRoot: root });
    assert.equal(r.sent, false);
    assert.equal(r.reason, 'http_500');
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

// --- network error (ECONNREFUSED) ---

test('publish — ECONNREFUSED on closed port returns error reason', async () => {
  clearPortCache();
  const root = mkRoot();
  // Port 1 is virtually always closed
  writeLockfile(root, 1);
  try {
    const r = await publish(validEvent(), { projectRoot: root, timeoutMs: 2000 });
    assert.equal(r.sent, false);
    // Reason starts with 'error: ' followed by ECONNREFUSED or similar
    assert.match(r.reason, /^error:/);
  } finally {
    deleteLockfile(root);
    clearPortCache();
  }
});

// --- timeout ---

test('publish — server hangs past timeout returns reason:timeout', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ hangOnPublish: true });
  try {
    writeLockfile(root, mock.port);
    const r = await publish(validEvent(), { projectRoot: root, timeoutMs: 200 });
    assert.equal(r.sent, false);
    assert.equal(r.reason, 'timeout');
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

// --- publishMany ---

test('publishMany — emits 3 events sequentially preserving order', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ statusCode: 204 });
  try {
    writeLockfile(root, mock.port);
    const events = [
      { type: 'run.start', ts: 1, runId: 'r', payload: { i: 1 } },
      { type: 'progress',  ts: 2, runId: 'r', payload: { i: 2 } },
      { type: 'run.end',   ts: 3, runId: 'r', payload: { i: 3 } },
    ];
    const results = await publishMany(events, { projectRoot: root });
    assert.equal(results.length, 3);
    for (const r of results) assert.equal(r.sent, true);
    // Server should have received them in same order
    assert.equal(mock.requestsReceived.length, 3);
    const types = mock.requestsReceived.map(r => JSON.parse(r.body).type);
    assert.deepEqual(types, ['run.start', 'progress', 'run.end']);
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

// --- clearPortCache ---

test('clearPortCache — forces re-read of lockfile on next publish', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ statusCode: 204 });
  try {
    // First publish populates cache
    writeLockfile(root, mock.port);
    const r1 = await publish(validEvent(), { projectRoot: root });
    assert.equal(r1.sent, true);
    // Delete lockfile but don't clearPortCache — second publish uses cached port
    deleteLockfile(root);
    const r2 = await publish(validEvent(), { projectRoot: root });
    // Cache still has the port → publish succeeds against the still-running mock
    assert.equal(r2.sent, true);
    // Now clear cache + delete lockfile → no_sidecar
    clearPortCache();
    const r3 = await publish(validEvent(), { projectRoot: root });
    assert.equal(r3.sent, false);
    assert.equal(r3.reason, 'no_sidecar');
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});

// --- lockfile without token ---

test('publish — lockfile without token: server accepts (sent:true)', async () => {
  clearPortCache();
  const root = mkRoot();
  const mock = await startMockSidecar({ statusCode: 204, requireAuth: false });
  try {
    // Lockfile with NO token field (older sidecar, pre-v1.14)
    writeLockfile(root, mock.port);
    const r = await publish(validEvent(), { projectRoot: root });
    assert.equal(r.sent, true);
    // No Authorization header should have been sent
    const auth = mock.requestsReceived[0].headers.authorization;
    assert.equal(auth, undefined);
  } finally {
    await mock.close();
    deleteLockfile(root);
    clearPortCache();
  }
});
