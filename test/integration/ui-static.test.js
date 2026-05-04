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

test('static UI: humanizer maps technical event types to PT-BR labels (1.2.3)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    // Dictionaries present
    assert.match(r.body, /EVENT_TYPE_LABEL/);
    assert.match(r.body, /'run\.start':\s*'Iniciado'/);
    assert.match(r.body, /'run\.end':\s*'Finalizado'/);
    assert.match(r.body, /'progress':\s*'Em andamento'/);
    assert.match(r.body, /'error':\s*'Erro'/);
    // Tool name humanizer
    assert.match(r.body, /TOOL_LABEL/);
    assert.match(r.body, /'sync\.install':\s*'Sincronizando kit'/);
    // Path humanizer
    assert.match(r.body, /humanizePath/);
    assert.match(r.body, /agente\s\$\{m\[1\]\}/);
    // Wired into render functions
    assert.match(r.body, /humanizeEventType\(evt\.type\)/);
    assert.match(r.body, /humanizeTool\(run\.tool\)/);
    assert.match(r.body, /humanizeStatus\(run\.status\)/);
    // Connection labels translated
    assert.match(r.body, /CONN_LABEL/);
    assert.match(r.body, /OPEN:\s+'CONECTADO'/);
    assert.match(r.body, /CLOSED:\s+'DESCONECTADO'/);
  });
});

test('static UI: PT-BR copy in toolbar + footer (1.2.3)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /placeholder="filtrar/);
    assert.match(r.body, /pausar/);
    assert.match(r.body, /rolagem auto/);
    assert.match(r.body, /limpar tela/);
    assert.match(r.body, /Em execução agora/);
    assert.match(r.body, /eventos:/);
    assert.match(r.body, /fonte: ao vivo/);
  });
});

test('static UI: eventLabel reads payload.name (1.2.1 fix)', async () => {
  // Regression guard for the cosmetic bug where milestone events with
  // `payload.name` rendered as bare "milestone" instead of the supplied label.
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /typeof p\.name === 'string'/);
  });
});

test('static UI: active runs panel renders cards with progress bar (1.2.2)', async () => {
  // The "Active runs" zone is what makes the sidecar feel like a process
  // viewer rather than just a chronological log. It must:
  //   - exist in the markup
  //   - have a count chip
  //   - render via upsertActiveRun keyed by runId
  //   - show a progress bar that reflects `payload.percent`
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    // Markup
    assert.match(r.body, /id="active-runs"/);
    assert.match(r.body, /id="active-runs-list"/);
    assert.match(r.body, /id="active-runs-count"/);
    // Logic
    assert.match(r.body, /upsertActiveRun/);
    assert.match(r.body, /renderActiveRuns/);
    assert.match(r.body, /activeRuns\s*=\s*new Map\(\)/);
    // Progress bar driven by percent
    assert.match(r.body, /run\.percent\s*=\s*clampPercent/);
    assert.match(r.body, /\.run-bar/);
    // Per-second elapsed tick keeps cards live
    assert.match(r.body, /setInterval\(\(\) => \{[\s\S]*activeRuns\.size === 0/);
  });
});

test('static UI: visibilitychange listener reconnects from CLOSED (1.2.1 fix)', async () => {
  // Regression guard for SSE staying in CLOSED when Chrome throttles a
  // background tab. We can't drive the DOM from this test without JSDOM,
  // so we assert the listener and the reconnect logic are present.
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /visibilitychange/);
    assert.match(r.body, /document\.visibilityState !== 'visible'/);
    // The handler must call hydrate + connect, not just connect, so that
    // events that arrived while we were dropped get rendered too.
    assert.match(r.body, /hydrateFromState\(\)\.then\(connect\)/);
  });
});
