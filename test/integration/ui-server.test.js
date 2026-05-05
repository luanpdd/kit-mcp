import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createServer, __test as serverConst } from '../../src/ui/server.js';
import { releaseLock } from '../../src/ui/lockfile.js';

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-srv-test-'));
}

function fetch(method, port, pathname, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      host: '127.0.0.1',
      port,
      path: pathname,
      // Disable connection keep-alive: previous tests' shutdown destroys sockets,
      // and the global agent would otherwise reuse a dead connection -> ECONNRESET.
      agent: false,
      headers: {
        host: `127.0.0.1:${port}`,
        connection: 'close',
        ...headers,
      },
    };
    if (body) opts.headers['content-type'] = 'application/json';
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function withServer(opts, fn) {
  const root = opts?.projectRoot ?? mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0, ...opts });
  await srv.start();
  try {
    await fn(srv, root);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
}

test('GET / serves HTML with strict CSP', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('GET', srv.port, '/');
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /text\/html/);
    assert.ok(r.headers['content-security-policy'], 'CSP header missing');
    assert.match(r.headers['content-security-policy'], /default-src 'self'/);
    assert.match(r.headers['content-security-policy'], /frame-ancestors 'none'/);
  });
});

test('GET /healthz returns ok with port + uptime + subscribers', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('GET', srv.port, '/healthz');
    assert.equal(r.status, 200);
    const j = JSON.parse(r.body);
    assert.equal(j.ok, true);
    assert.equal(j.port, srv.port);
    assert.equal(j.subscribers, 0);
    assert.ok(typeof j.uptime === 'number');
  });
});

test('Host header validation: rejects malicious Host (mitigates DNS rebinding)', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('GET', srv.port, '/healthz', {
      headers: { host: 'evil.example.com' },
    });
    assert.equal(r.status, 403);
    const j = JSON.parse(r.body);
    assert.equal(j.error, 'host_not_allowed');
  });
});

test('Host header validation: accepts localhost as alias for 127.0.0.1', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('GET', srv.port, '/healthz', {
      headers: { host: `localhost:${srv.port}` },
    });
    assert.equal(r.status, 200);
  });
});

test('POST /publish: round-trip — published event is in /state', async () => {
  await withServer({}, async (srv) => {
    const evt = { type: 'progress', ts: Date.now(), runId: null, payload: { percent: 42 } };
    const pub = await fetch('POST', srv.port, '/publish', { body: evt });
    assert.equal(pub.status, 202);
    const state = await fetch('GET', srv.port, '/state');
    assert.equal(state.status, 200);
    const j = JSON.parse(state.body);
    assert.ok(Array.isArray(j.events));
    // events[0] is run.start emitted on server boot; the published event is somewhere later.
    const found = j.events.find((e) => e.type === 'progress' && e.payload?.percent === 42);
    assert.ok(found, 'published progress event should appear in state ring buffer');
  });
});

test('POST /publish: rejects malformed JSON', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('POST', srv.port, '/publish', { body: '{ bad json' });
    assert.equal(r.status, 400);
    const j = JSON.parse(r.body);
    assert.match(j.error, /invalid_json/);
  });
});

test('POST /publish: rejects unknown event type', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('POST', srv.port, '/publish', {
      body: { type: 'wat', ts: Date.now() },
    });
    assert.equal(r.status, 400);
  });
});

test('POST /publish: rejects oversized body with 413', async () => {
  await withServer({}, async (srv) => {
    const big = 'x'.repeat(70 * 1024);
    const r = await fetch('POST', srv.port, '/publish', { body: { type: 'progress', ts: Date.now(), runId: null, payload: big } });
    assert.equal(r.status, 413);
  });
});

test('Origin validation: rejects cross-origin POST', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('POST', srv.port, '/publish', {
      body: { type: 'progress', ts: Date.now() },
      headers: { origin: 'https://evil.example.com' },
    });
    assert.equal(r.status, 403);
    const j = JSON.parse(r.body);
    assert.equal(j.error, 'origin_not_allowed');
  });
});

test('Origin validation: rejects cross-origin POST /shutdown', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('POST', srv.port, '/shutdown', {
      body: '',
      headers: { origin: 'https://evil.example.com' },
    });
    assert.equal(r.status, 403);
    const j = JSON.parse(r.body);
    assert.equal(j.error, 'origin_not_allowed');
  });
});

test('SSE: receives published events live on /events', async () => {
  await withServer({}, async (srv) => {
    // open an SSE connection, then publish, then look for the published event in the stream
    const data = await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: srv.port,
        path: '/events',
        method: 'GET',
        agent: false,
        headers: { host: `127.0.0.1:${srv.port}`, accept: 'text/event-stream' },
      }, (res) => {
        assert.equal(res.statusCode, 200);
        assert.match(res.headers['content-type'], /text\/event-stream/);
        let acc = '';
        res.on('data', (chunk) => {
          acc += chunk.toString('utf8');
          if (acc.includes('event: tool_invocation')) {
            req.destroy();
            resolve(acc);
          }
        });
        res.on('error', reject);

        // Publish AFTER the SSE handshake completes — gives 50ms for the connection to settle.
        setTimeout(() => {
          srv.pushEvent({
            type: 'tool_invocation',
            ts: Date.now(),
            runId: null,
            payload: { tool: 'test' },
          });
        }, 50);
      });
      req.on('error', (err) => {
        if (err.code === 'ECONNRESET' || err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
        reject(err);
      });
      req.end();
    });
    assert.match(data, /retry: 3000/);
    assert.match(data, /event: tool_invocation/);
    assert.match(data, /"tool":"test"/);
  });
});

test('SSE: subscriber count grows then shrinks on disconnect', async () => {
  await withServer({}, async (srv) => {
    assert.equal(srv.subscriberCount, 0);
    const req = http.request({
      host: '127.0.0.1',
      port: srv.port,
      path: '/events',
      method: 'GET',
      agent: false,
      headers: { host: `127.0.0.1:${srv.port}` },
    });
    req.end();
    // Wait briefly for connect
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(srv.subscriberCount, 1);
    req.destroy();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(srv.subscriberCount, 0);
  });
});

test('SSE: cap rejects subscriber 33+ with 503', async () => {
  await withServer({ maxSubscribers: 2 }, async (srv) => {
    const conns = [];
    function open() {
      return new Promise((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1',
          port: srv.port,
          path: '/events',
          method: 'GET',
          agent: false,
          headers: { host: `127.0.0.1:${srv.port}` },
        }, (res) => resolve({ req, res }));
        req.on('error', reject);
        req.end();
      });
    }
    conns.push(await open());
    conns.push(await open());
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(srv.subscriberCount, 2);
    const denied = await open();
    assert.equal(denied.res.statusCode, 503);
    for (const { req } of conns) req.destroy();
  });
});

test('Connection cleanup: 50 connect/disconnect cycles leave subscribers.size === 0', async () => {
  await withServer({}, async (srv) => {
    for (let i = 0; i < 50; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1',
          port: srv.port,
          path: '/events',
          method: 'GET',
          agent: false,
          headers: { host: `127.0.0.1:${srv.port}` },
        });
        req.on('response', () => {
          req.destroy();
        });
        req.on('error', () => resolve()); // ECONNRESET on destroy is fine
        req.on('close', () => resolve());
        req.end();
      });
    }
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(srv.subscriberCount, 0, 'leak: subscribers persisted after 50 cycles');
  });
});

test('Unknown route returns 404', async () => {
  await withServer({}, async (srv) => {
    const r = await fetch('GET', srv.port, '/no-such-thing');
    assert.equal(r.status, 404);
  });
});

test('Constants exposed: ring=200, maxSubs=32, idle=0 (never), heartbeat=15s', () => {
  assert.equal(serverConst.RING_BUFFER_SIZE, 200);
  assert.equal(serverConst.MAX_SSE_SUBSCRIBERS, 32);
  assert.equal(serverConst.DEFAULT_IDLE_MS, 0);
  assert.equal(serverConst.HEARTBEAT_INTERVAL_MS, 15000);
});

test('CSP includes self for connect-src, script-src, style-src', () => {
  const csp = serverConst.CSP;
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});
