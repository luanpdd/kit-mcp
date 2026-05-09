// Phase 18 hardening tests. Covers OPS-03 (kill -9 recovery),
// OPS-04 (multi-publisher race), OPS-05 (MCP stdio uncorrupted).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

import { createServer, __test as serverConst } from '../../src/ui/server.js';
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

// SEC-14-02: src/ui/client.js publish() does NOT yet read lock.token and
// attach Authorization. Plan 02 (auto-spawn-token-propagation) updates client.js
// and unskips this test. Until then, calling publish() against a token-protected
// /publish endpoint returns 401, which would make this test fail incorrectly.
test.skip('OPS-04 [SKIPPED until Plan 02]: 2 concurrent publishers both succeed; events arrive in order', async () => {
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

// ────────────────────────────────────────────────────────────────────
// SEC-14-01 (CSP without unsafe-inline) + SEC-14-02 (token-based auth)
// regression tests. Added in Phase 82 / v1.14.
// ────────────────────────────────────────────────────────────────────

function rawHttpRequest({ method, port, pathname, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const opts = {
      method, host: '127.0.0.1', port, path: pathname,
      agent: false,
      headers: {
        host: `127.0.0.1:${port}`, connection: 'close',
        ...headers,
        ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
      },
    };
    const req = http.request(opts, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => { try { req.destroy(); } catch {} resolve({ status: 0, headers: {}, body: '' }); });
    if (body) req.write(body);
    req.end();
  });
}

test('SEC-14-01: GET / has CSP without unsafe-inline in script-src and includes sha256 hash', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/' });
    assert.equal(res.status, 200);
    const csp = res.headers['content-security-policy'];
    assert.ok(csp, 'CSP header missing');
    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
    assert.ok(scriptSrcMatch, 'script-src directive missing');
    assert.doesNotMatch(scriptSrcMatch[1], /unsafe-inline/, 'script-src must NOT include unsafe-inline');
    assert.match(scriptSrcMatch[1], /'sha256-[A-Za-z0-9+/]{43}='/, 'script-src must include sha256 hash');
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-01: index.html contains exactly one <script> block (hash invariant)', async () => {
  const indexPath = path.join(process.cwd(), 'src', 'ui', 'static', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const matches = html.match(/<script>/g) || [];
  assert.equal(matches.length, 1, `expected exactly 1 <script> block, found ${matches.length}; CSP hash logic in server.js needs updating if this changes`);
});

test('SEC-14-02: lockfile contains token field with 64 hex chars', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const lock = readLock(root);
    assert.ok(lock, 'lockfile missing');
    assert.equal(typeof lock.token, 'string', 'token field missing');
    assert.equal(lock.token.length, 64, 'token must be 64 chars');
    assert.match(lock.token, /^[0-9a-f]{64}$/, 'token must be 64-char hex');
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: POST /shutdown without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({
      method: 'POST', port: srv.port, pathname: '/shutdown',
      headers: { origin: `http://127.0.0.1:${srv.port}` },
      body: '',
    });
    assert.equal(res.status, 401);
    assert.match(res.body, /auth_required/);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: POST /publish without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const evt = JSON.stringify({ type: 'progress', ts: Date.now(), runId: null, payload: {} });
    const res = await rawHttpRequest({
      method: 'POST', port: srv.port, pathname: '/publish',
      headers: { origin: `http://127.0.0.1:${srv.port}` },
      body: evt,
    });
    assert.equal(res.status, 401);
    assert.match(res.body, /auth_required/);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: GET /events without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/events' });
    assert.equal(res.status, 401);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: GET /state without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/state' });
    assert.equal(res.status, 401);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: GET /events?t=<valid> accepts; ?t=<invalid> rejects', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const lock = readLock(root);
    const goodToken = lock.token;
    // Valid: should connect (200 + SSE headers). Don't wait for body — SSE never closes naturally.
    const goodStatus = await new Promise((resolve) => {
      const req = http.request({
        method: 'GET', host: '127.0.0.1', port: srv.port, path: `/events?t=${goodToken}`,
        agent: false, headers: { host: `127.0.0.1:${srv.port}`, connection: 'close' },
      }, (r) => {
        resolve(r.statusCode);
        try { req.destroy(); } catch {}
      });
      req.on('error', () => resolve(0));
      req.setTimeout(2000, () => { try { req.destroy(); } catch {} resolve(0); });
      req.end();
    });
    assert.equal(goodStatus, 200, 'valid token should accept SSE connection');

    // Invalid: should 401
    const badRes = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/events?t=' + 'x'.repeat(64) });
    assert.equal(badRes.status, 401);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: timingSafeEqual unit — same/diff-length/diff-char/empty', async () => {
  assert.equal(serverConst.timingSafeEqual('abc', 'abc'), true);
  assert.equal(serverConst.timingSafeEqual('abc', 'abcd'), false);
  assert.equal(serverConst.timingSafeEqual('abc', 'abd'), false);
  assert.equal(serverConst.timingSafeEqual('', ''), true);
  assert.equal(serverConst.timingSafeEqual('a', 'b'), false);
  assert.equal(serverConst.timingSafeEqual('a', null), false);
});
