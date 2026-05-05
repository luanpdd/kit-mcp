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

// ----- baseline: served + DOCTYPE + lang ----------------------------------

test('static UI: index.html is bundled and served (not the fallback)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /text\/html/);
    assert.doesNotMatch(r.body, /UI not yet packaged/, 'fallback placeholder leaked into response');
  });
});

test('static UI: HTML has DOCTYPE and pt-BR lang attribute', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /^<!doctype html>/i);
    assert.match(r.body, /<html lang="pt-BR">/);
  });
});

// ----- 1.3.0 design (Claude Design handoff): structural elements ---------

test('static UI: 1.3 layout — header, toolbar, active region, timeline, empty, footer', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    // Header + brand + connection pill
    assert.match(r.body, /class="header"/);
    assert.match(r.body, /class="brand"/);
    assert.match(r.body, /id="conn"/);
    assert.match(r.body, /id="conn-label"/);
    // Toolbar
    assert.match(r.body, /class="toolbar"/);
    assert.match(r.body, /id="q"/);                         // search input
    assert.match(r.body, /id="filter-btn"/);
    assert.match(r.body, /id="filter-pop"/);
    assert.match(r.body, /id="pause-btn"/);
    assert.match(r.body, /id="tweaks-btn"/);
    // Main regions
    assert.match(r.body, /id="active-region"/);
    assert.match(r.body, /id="timeline"/);
    assert.match(r.body, /id="empty"/);
    // Footer
    assert.match(r.body, /id="evt-count"/);
    assert.match(r.body, /id="src-label"/);
    // Tweaks dialog
    assert.match(r.body, /id="tweaks"/);
  });
});

test('static UI: design tokens — pure-black bg, oklch accent, system fonts', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /--bg:\s*#000000/);
    assert.match(r.body, /--accent-h:\s*130/);          // default green hue
    assert.match(r.body, /oklch\(82% 0\.18 var\(--accent-h\)\)/);
    assert.match(r.body, /-apple-system, "Segoe UI"/);
    assert.match(r.body, /ui-monospace/);
  });
});

test('static UI: tweaks panel exposes accent / density / motion / scenario', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /id="tw-accent"/);
    assert.match(r.body, /id="tw-density"/);
    assert.match(r.body, /id="tw-motion"/);
    assert.match(r.body, /id="tw-scenario"/);
    // Scenarios that mock real source for demo: sync, multi, error, idle
    assert.match(r.body, /data-v="sync"/);
    assert.match(r.body, /data-v="multi"/);
    assert.match(r.body, /data-v="error"/);
    assert.match(r.body, /data-v="idle"/);
  });
});

// ----- humanization (preserved API across versions) ----------------------

test('static UI: humanize dictionaries map types and tools to PT-BR', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    // 7 event types translated
    assert.match(r.body, /TYPE_LABELS/);
    assert.match(r.body, /"run\.start":\s+"INICIADO"/);
    assert.match(r.body, /"run\.end":\s+"FINALIZADO"/);
    assert.match(r.body, /"progress":\s+"EM ANDAMENTO"/);
    assert.match(r.body, /"milestone":\s+"MARCO"/);
    assert.match(r.body, /"error":\s+"ERRO"/);
    assert.match(r.body, /"shutdown":\s+"ENCERRADO"/);
    // Tool labels
    assert.match(r.body, /TOOL_LABELS/);
    assert.match(r.body, /"sync\.install":\s+"Sincronizando kit"/);
    assert.match(r.body, /"reverse\.scan":\s+"Escaneando agentes"/);
    assert.match(r.body, /"gates\.run":\s+"Executando gates"/);
    // Path humanizer present
    assert.match(r.body, /function humanizePath/);
  });
});

test('static UI: declares all 7 event types (TYPE_LABELS keys)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    for (const t of ['run.start', 'run.end', 'tool_invocation', 'progress', 'milestone', 'error', 'shutdown']) {
      const re = new RegExp(`"${t.replace('.', '\\.')}":`);
      assert.match(r.body, re, `missing event type ${t}`);
    }
  });
});

// ----- production wiring: real EventSource + /state hydration -----------

test('static UI: connects to real /events SSE in production boot', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /new EventSource\("\/events"\)/);
    assert.match(r.body, /function connectRealSource/);
    // Must register a listener for each typed event (otherwise typed SSE messages won't fire)
    for (const t of ['run.start', 'run.end', 'tool_invocation', 'progress', 'milestone', 'error', 'shutdown']) {
      assert.ok(r.body.includes(`"${t}"`), `missing event listener for ${t}`);
    }
  });
});

test('static UI: hydrates from /state on page load (1.2.1+)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /async function hydrateFromState/);
    assert.match(r.body, /fetch\("\/state"/);
    assert.match(r.body, /for \(const evt of j\.events\) ingest/);
  });
});

test('static UI: visibilitychange listener reconnects from CLOSED (1.2.1+)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /visibilitychange/);
    assert.match(r.body, /document\.visibilityState !== "visible"/);
    // Must hydrate AND reconnect on visibility — events that arrived while
    // we were dropped should also be rendered.
    assert.match(r.body, /hydrateFromState\(\)\.then\(connectRealSource\)/);
  });
});

test('static UI: shutdown banner appears when SSE delivers a shutdown event', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /function showShutdownBanner/);
    assert.match(r.body, /Sidecar encerrou/);
    assert.match(r.body, /id\s*=\s*"shutdown-banner"/);
  });
});

test('static UI: CSP from server is strict (frame-ancestors none)', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    const csp = r.headers['content-security-policy'];
    assert.ok(csp, 'missing CSP header');
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /default-src 'self'/);
  });
});

// ----- regression: states (idle / running / error) must all be in the design ----

test('static UI: states for empty + running + error designed', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    // Idle / empty state
    assert.match(r.body, /Aguardando o primeiro evento/);
    assert.match(r.body, /class="empty"/);
    assert.match(r.body, /class="empty-viz"/);            // heartbeat bars
    // Running visual: run-card + bar + spinning conic border
    assert.match(r.body, /class="run-card"/);
    assert.match(r.body, /class="rc-bar/);
    assert.match(r.body, /@keyframes spin/);
    // Error state — timeline node + badge use --err token
    assert.match(r.body, /\.tl-row\[data-type="error"\] \.tl-node/);
    assert.match(r.body, /\.tl-row\[data-type="error"\] \.tl-badge/);
    // Multi: stacked active runs
    assert.match(r.body, /\.active-region\[data-count="2"\]/);
    assert.match(r.body, /\.active-region\[data-count="3"\]/);
  });
});

test('static UI: keyboard shortcut "/" focuses search', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /e\.key === "\/"/);
    assert.match(r.body, /els\.q\.focus\(\)/);
  });
});

test('static UI: paused state surfaces in conn pill + src label', async () => {
  await withServer(async (srv) => {
    const r = await fetchHtml(srv.port);
    assert.match(r.body, /state\.paused = !state\.paused/);
    assert.match(r.body, /els\.conn\.dataset\.state = state\.paused \? "off" : "on"/);
    assert.match(r.body, /pausado/);
  });
});
