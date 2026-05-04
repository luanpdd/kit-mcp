import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createServer } from '../../src/ui/server.js';
import { releaseLock } from '../../src/ui/lockfile.js';

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-static-test-'));
}

function fetchHtml(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'GET',
      host: '127.0.0.1',
      port,
      path: '/',
      agent: false,
      headers: { host: `127.0.0.1:${port}`, connection: 'close' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function withServer(fn) {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    await fn(srv);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
}

test('static UI: index.html is bundled and served (not the fallback)', async () => {
  // Phase 14 ships the real index.html — test it's the real one, not the
  // placeholder that server.js falls back to when the file is absent.
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /text\/html/);
    assert.doesNotMatch(r.body, /UI not yet packaged/, 'fallback placeholder leaked into response');
  });
});

test('static UI: HTML has DOCTYPE and lang attribute', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /^<!doctype html>/i);
    assert.match(r.body, /<html lang="en">/);
  });
});

test('static UI: contains required structural elements', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    // Headers, status indicator, toolbar, list, empty state, banner, footer
    assert.match(r.body, /id="conn"/);
    assert.match(r.body, /id="events"/);
    assert.match(r.body, /id="empty"/);
    assert.match(r.body, /id="shutdown-banner"/);
    assert.match(r.body, /id="search"/);
    assert.match(r.body, /id="type-filters"/);
    assert.match(r.body, /id="pause-btn"/);
    assert.match(r.body, /id="autoscroll-btn"/);
  });
});

test('static UI: declares all 7 event types in client-side EVENT_TYPES', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    for (const t of ['run.start', 'run.end', 'tool_invocation', 'progress', 'milestone', 'error', 'shutdown']) {
      assert.match(r.body, new RegExp(`'${t.replace('.', '\\.')}'`), `missing event type ${t}`);
    }
  });
});

test('static UI: dark mode is automatic via prefers-color-scheme', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /@media \(prefers-color-scheme: dark\)/);
  });
});

test('static UI: connects to /events and hydrates from /state', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /new EventSource\('\/events'\)/);
    assert.match(r.body, /fetch\('\/state'/);
  });
});

test('static UI: served with strict CSP header (frame-ancestors none)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    const csp = r.headers['content-security-policy'];
    assert.ok(csp, 'missing CSP header');
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /default-src 'self'/);
  });
});

test('static UI: pauses on demand, then flushes buffered events', async () => {
  // Indirect smoke: the page-side pause button toggles aria-pressed and stashes events.
  // We can't drive the DOM here (no JSDOM dep), but we can assert the JS is syntactically present.
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /pausedBuffer/);
    assert.match(r.body, /flushPaused/);
    assert.match(r.body, /aria-pressed/);
  });
});

test('static UI: includes shutdown banner copy in PT-BR', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /Sidecar encerrou/);
    assert.match(r.body, /Recarregue/);
  });
});
