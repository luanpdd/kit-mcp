// src/ui/server.js
// Sidecar HTTP + Server-Sent Events server.
//
// Responsibilities:
//   - bind on 127.0.0.1 only (REQ SEC ADR-06)
//   - 5 routes: GET /, GET /events (SSE), GET /healthz, GET /state, POST /publish, POST /shutdown
//   - in-process EventEmitter bus relays POST /publish payloads to SSE subscribers
//   - ring buffer (200 events) for /state hydrate-on-load
//   - cap of 32 simultaneous SSE subscribers
//   - heartbeat every 15s on each open SSE connection
//   - idle shutdown after 30min default (REQ SRV-10)
//   - graceful SIGINT/SIGTERM (REQ SRV-11): emit shutdown event, drain, release lock
//   - Host header validation on every request (REQ SEC-01)
//   - Origin validation on non-GET (REQ SEC-02)
//
// Logging discipline: all log output goes to stderr or to a file. Never stdout.
// (REQ SEC-04, enforced by CI gate in .github/workflows/ci.yml)

import http from 'node:http';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createHash } from 'node:crypto';

import { findFreePortOrThrow } from './port.js';
import { acquireLockOrReclaim, releaseLock } from './lockfile.js';
import { validateEvent, makeEvent, EVENT_TYPES } from './events.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(HERE, 'static');
const HOST = '127.0.0.1';
const HEARTBEAT_INTERVAL_MS = 15_000;
const RING_BUFFER_SIZE = 200;
const MAX_SSE_SUBSCRIBERS = 32;
const DEFAULT_IDLE_MS = 0; // never auto-shutdown by default — pass --idle-ms 1800000 to opt back in

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

// SEC-14-01: CSP without 'unsafe-inline' in script-src. The single inline
// <script> block in index.html is allowed via SHA-256 hash injected at boot.
// 'unsafe-inline' kept ONLY for style-src (the entire <style> block is intentional;
// CSS injection has no script execution vector with connect-src 'self').
function buildCsp(scriptHash) {
  const scriptSrc = scriptHash ? `'self' ${scriptHash}` : "'self'";
  return (
    "default-src 'self'; " +
    "connect-src 'self'; " +
    `script-src ${scriptSrc}; ` +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none'"
  );
}

// Computes the SHA-256 hash of the inline <script> block in the static HTML.
// Returns the CSP-formatted source expression: "'sha256-<base64>='".
// Returns empty string if no <script> block found (graceful — caller falls back to "'self'" alone).
function computeScriptHashFromHtml(html) {
  if (typeof html !== 'string') return '';
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) return '';
  const hash = createHash('sha256').update(m[1], 'utf8').digest('base64');
  return `'sha256-${hash}'`;
}

function logErr(...args) {
  // Strict stderr discipline — never stdout (collides with MCP JSON-RPC if running in same process).
  process.stderr.write(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n');
}

// SEC-14-02: per-process auth token. Set during start() from acquireLock result.
// Cleared on shutdown(). Never logged in full.
let authToken = null;

// requireAuth: returns true if request has a valid token via either:
//   - Authorization: Bearer <token>      (preferred for fetch from same-origin browser)
//   - ?t=<token> query param             (required for EventSource — browser API can't set headers)
// Caller is responsible for sending 401 when this returns false.
function requireAuth(req, url) {
  if (!authToken) return false; // server didn't init token — fail closed
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const provided = auth.slice('Bearer '.length).trim();
    if (timingSafeEqual(provided, authToken)) return true;
  }
  const qp = url?.searchParams?.get('t');
  if (typeof qp === 'string' && timingSafeEqual(qp, authToken)) return true;
  return false;
}

// Constant-time string comparison to prevent timing-leak side channel.
// Walks the longer of the two strings even when lengths differ to keep timing flat.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// Validate Host header against allowed hostnames (REQ SEC-01).
// Allow 127.0.0.1 and localhost on whatever port we're on.
function isHostAllowed(req, port) {
  const host = req.headers.host;
  if (!host) return false;
  const expected = [`127.0.0.1:${port}`, `localhost:${port}`];
  return expected.includes(host);
}

// Validate Origin header for non-GET requests (REQ SEC-02).
// Same-origin (no Origin header on same-page fetch) or matching scheme+host+port.
function isOriginAllowed(req, port) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin fetch may omit Origin
  const expected = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  return expected.includes(origin);
}

function send(res, status, headers, body) {
  res.writeHead(status, { ...headers });
  if (body !== undefined) res.end(body);
  else res.end();
}

function sendJson(res, status, obj) {
  send(res, status, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(obj));
}

// Serialize an event into a single SSE message (with id for Last-Event-ID hint).
function formatSseMessage(event, seq) {
  const payload = JSON.stringify(event);
  // SSE spec: \r\n is fine but \n is canonical; payload can contain \n which we must split.
  const dataLines = payload.split('\n').map((line) => `data: ${line}`).join('\n');
  return `id: ${seq}\nevent: ${event.type}\n${dataLines}\n\n`;
}

// Read a request body up to maxBytes. Resolves with Buffer; rejects on overflow.
function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > maxBytes) {
        aborted = true;
        // Don't destroy the request — let the caller send a 413 response first.
        // We just stop accumulating; further chunks (and 'end') are ignored.
        const err = new Error(`Request body exceeds ${maxBytes} bytes`);
        err.code = 'EBODYTOOBIG';
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.once('end', () => {
      if (aborted) return;
      resolve(Buffer.concat(chunks));
    });
    req.once('error', (err) => {
      if (aborted) return;
      reject(err);
    });
  });
}

let _cachedIndex = null; // { html, scriptHash }
function loadStaticIndex() {
  // src/ui/static/index.html — written in Phase 14. We tolerate it missing in
  // unit tests by serving a placeholder so the server module is testable in isolation.
  if (_cachedIndex) return _cachedIndex;
  let html;
  try {
    html = readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8');
  } catch {
    html = `<!doctype html><meta charset="utf-8"><title>kit-mcp sidecar</title>
<body><pre>UI not yet packaged. Run \`kit ui\` after Phase 14 is shipped.</pre></body>`;
  }
  // SEC-14-01: hash inline <script> for CSP whitelist. Cache per-process.
  const scriptHash = computeScriptHashFromHtml(html);
  _cachedIndex = { html, scriptHash };
  return _cachedIndex;
}

export function createServer({
  projectRoot,
  version = null,
  idleMs = DEFAULT_IDLE_MS,
  maxSubscribers = MAX_SSE_SUBSCRIBERS,
  ringSize = RING_BUFFER_SIZE,
  staticHtml,
} = {}) {
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
    throw new TypeError('createServer requires projectRoot: string');
  }

  const bus = new EventEmitter();
  bus.setMaxListeners(maxSubscribers + 4);

  // Ring buffer for hydrate-on-load
  const ring = [];
  let nextSeq = 1;
  function pushEvent(evt) {
    evt._seq = nextSeq++;
    ring.push(evt);
    if (ring.length > ringSize) ring.shift();
    bus.emit('event', evt);
  }

  const subscribers = new Set();
  const activeSockets = new Set();
  let server = null;
  let listeningPort = 0;
  let lockMeta = null;
  let idleTimer = null;
  let lastEventTs = Date.now();
  let shuttingDown = false;
  let signalHandlers = null;
  const startedAt = Date.now();

  function resetIdleTimer() {
    if (idleMs <= 0) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // Only auto-shutdown if no subscribers AND no recent events
      if (subscribers.size === 0) {
        logErr('[kit-mcp ui] idle shutdown after', Math.round(idleMs / 1000), 's');
        // eslint-disable-next-line no-use-before-define
        shutdown('idle').catch((err) => logErr('idle shutdown error:', err.message));
      } else {
        // Subscribers connected — push idle timer forward
        resetIdleTimer();
      }
    }, idleMs);
    // Don't keep event loop alive just for the idle timer
    if (typeof idleTimer.unref === 'function') idleTimer.unref();
  }

  async function shutdown(reason = 'sigterm') {
    if (shuttingDown) return;
    shuttingDown = true;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }

    // Notify subscribers
    const final = makeEvent({ type: 'shutdown', payload: { reason } });
    pushEvent(final);

    // Drain SSE
    for (const sub of subscribers) {
      try { sub.res.end(); } catch { /* noop */ }
    }
    subscribers.clear();

    // Stop accepting new connections AND destroy lingering sockets so close() resolves quickly.
    if (server) {
      for (const sock of activeSockets) {
        try { sock.destroy(); } catch { /* noop */ }
      }
      activeSockets.clear();
      await new Promise((resolve) => server.close(() => resolve()));
      server = null;
    }

    // Detach signal handlers so test harnesses don't accumulate listeners.
    if (signalHandlers) {
      try { process.removeListener('SIGINT', signalHandlers.sigint); } catch { /* noop */ }
      try { process.removeListener('SIGTERM', signalHandlers.sigterm); } catch { /* noop */ }
      signalHandlers = null;
    }

    // Release lockfile
    if (lockMeta) {
      try { releaseLock(projectRoot); } catch { /* noop */ }
      lockMeta = null;
    }
    authToken = null; // SEC-14-02: clear so a re-start gets a fresh one
  }

  function handleEvents(req, res, url) {
    if (!requireAuth(req, url)) {
      sendJson(res, 401, { error: 'auth_required' });
      return;
    }
    if (subscribers.size >= maxSubscribers) {
      sendJson(res, 503, { error: 'too_many_subscribers', max: maxSubscribers });
      return;
    }

    res.writeHead(200, SSE_HEADERS);
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    // Optional retry hint for the browser EventSource (3s)
    res.write('retry: 3000\n\n');

    const sub = { req, res };
    subscribers.add(sub);

    const onEvent = (evt) => {
      try {
        res.write(formatSseMessage(evt, evt._seq ?? 0));
      } catch {
        cleanup();
      }
    };
    bus.on('event', onEvent);

    const heartbeat = setInterval(() => {
      try { res.write(`: ping ${Date.now()}\n\n`); } catch { cleanup(); }
    }, HEARTBEAT_INTERVAL_MS);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    function cleanup() {
      if (!subscribers.has(sub)) return;
      subscribers.delete(sub);
      clearInterval(heartbeat);
      bus.off('event', onEvent);
      try { res.end(); } catch { /* noop */ }
    }

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
  }

  async function handlePublish(req, res, url) {
    if (!requireAuth(req, url)) {
      sendJson(res, 401, { error: 'auth_required' });
      return;
    }
    if (!isOriginAllowed(req, listeningPort)) {
      sendJson(res, 403, { error: 'origin_not_allowed' });
      return;
    }
    let body;
    try {
      body = await readBody(req, 64 * 1024);
    } catch (err) {
      const status = err.code === 'EBODYTOOBIG' ? 413 : 400;
      sendJson(res, status, { error: err.message });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch (err) {
      sendJson(res, 400, { error: `invalid_json: ${err.message}` });
      return;
    }
    const validationErr = validateEvent(parsed);
    if (validationErr) {
      sendJson(res, 400, { error: validationErr.message });
      return;
    }
    pushEvent(parsed);
    lastEventTs = Date.now();
    resetIdleTimer();
    sendJson(res, 202, { ok: true, seq: parsed._seq });
  }

  function handleHealthz(res) {
    sendJson(res, 200, {
      ok: true,
      version,
      uptime: Date.now() - startedAt,
      port: listeningPort,
      subscribers: subscribers.size,
      eventsTotal: nextSeq - 1,
    });
  }

  // PERF-05: optional pagination via ?offset=N&limit=M. No query → ring inteiro
  // (back-compat preservada). Out-of-range values clamp to bounds rather than 4xx.
  function handleState(req, res, url) {
    if (!requireAuth(req, url)) {
      sendJson(res, 401, { error: 'auth_required' });
      return;
    }
    let events = ring;
    const offsetRaw = url?.searchParams?.get('offset');
    const limitRaw  = url?.searchParams?.get('limit');
    if (offsetRaw !== null && offsetRaw !== undefined) {
      const offset = Math.max(0, Number.parseInt(offsetRaw, 10) || 0);
      const limit  = limitRaw !== null && limitRaw !== undefined
        ? Math.max(0, Number.parseInt(limitRaw, 10) || 0)
        : ring.length - offset;
      events = ring.slice(offset, offset + limit);
    } else if (limitRaw !== null && limitRaw !== undefined) {
      const limit = Math.max(0, Number.parseInt(limitRaw, 10) || 0);
      events = ring.slice(0, limit);
    } else {
      events = ring.slice();
    }
    sendJson(res, 200, {
      version,
      port: listeningPort,
      eventsTotal: nextSeq - 1,
      ringSize: ring.length,
      events,
    });
  }

  async function handleShutdownRequest(req, res, url) {
    if (!requireAuth(req, url)) {
      sendJson(res, 401, { error: 'auth_required' });
      return;
    }
    if (!isOriginAllowed(req, listeningPort)) {
      sendJson(res, 403, { error: 'origin_not_allowed' });
      return;
    }
    sendJson(res, 200, { ok: true, draining: true });
    setImmediate(() => {
      shutdown('explicit').catch((err) => logErr('shutdown error:', err.message));
    });
  }

  function handleIndex(res) {
    let html, scriptHash;
    if (typeof staticHtml === 'string') {
      html = staticHtml;
      scriptHash = computeScriptHashFromHtml(staticHtml);
    } else {
      ({ html, scriptHash } = loadStaticIndex());
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': buildCsp(scriptHash),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    res.end(html);
  }

  async function handleRequest(req, res) {
    if (!isHostAllowed(req, listeningPort)) {
      sendJson(res, 403, { error: 'host_not_allowed', expected: ['127.0.0.1', 'localhost'] });
      return;
    }
    const url = new URL(req.url, `http://${HOST}:${listeningPort}`);
    const route = `${req.method} ${url.pathname}`;

    try {
      switch (route) {
        case 'GET /':
        case 'GET /index.html':
          return handleIndex(res);
        case 'GET /events':
          return handleEvents(req, res, url);
        case 'GET /healthz':
          return handleHealthz(res);
        case 'GET /state':
          return handleState(req, res, url);
        case 'POST /publish':
          return handlePublish(req, res, url);
        case 'POST /shutdown':
          return handleShutdownRequest(req, res, url);
        default:
          return sendJson(res, 404, { error: 'not_found', route });
      }
    } catch (err) {
      logErr('handler error:', err.message);
      try { sendJson(res, 500, { error: 'internal_error' }); } catch { /* noop */ }
    }
  }

  async function start({ port } = {}) {
    listeningPort = port ?? (await findFreePortOrThrow());
    lockMeta = await acquireLockOrReclaim({
      projectRoot,
      port: listeningPort,
      version,
      startedAt,
    });
    // SEC-14-02: copy per-process token from lockfile into closure for requireAuth.
    authToken = lockMeta.token;
    if (typeof authToken !== 'string' || authToken.length !== 64) {
      throw new Error('SEC-14-02: lockMeta.token missing or malformed; refusing to start');
    }
    server = http.createServer(handleRequest);
    server.on('connection', (sock) => {
      activeSockets.add(sock);
      sock.on('close', () => activeSockets.delete(sock));
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(listeningPort, HOST, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    resetIdleTimer();

    // Graceful shutdown handlers (REQ SRV-11). Stored so we can detach in shutdown().
    const sigint = () => {
      logErr('[kit-mcp ui] received SIGINT, shutting down');
      shutdown('SIGINT').catch((err) => logErr('shutdown error:', err.message));
    };
    const sigterm = () => {
      logErr('[kit-mcp ui] received SIGTERM, shutting down');
      shutdown('SIGTERM').catch((err) => logErr('shutdown error:', err.message));
    };
    signalHandlers = { sigint, sigterm };
    process.on('SIGINT', sigint);
    process.on('SIGTERM', sigterm);

    // run.start event
    pushEvent(makeEvent({ type: 'run.start', payload: { server: 'sidecar', version, port: listeningPort } }));

    return { port: listeningPort, lockMeta };
  }

  return {
    start,
    shutdown,
    pushEvent, // for tests
    get url() { return `http://${HOST}:${listeningPort}/`; },
    get port() { return listeningPort; },
    get subscriberCount() { return subscribers.size; },
    get eventsTotal() { return nextSeq - 1; },
  };
}

export const __test = {
  RING_BUFFER_SIZE,
  MAX_SSE_SUBSCRIBERS,
  DEFAULT_IDLE_MS,
  HEARTBEAT_INTERVAL_MS,
  // SEC-14-01: CSP is now built dynamically with sha256 hash of inline <script>.
  // The constant CSP no longer exists; tests should use buildCsp(scriptHash).
  buildCsp,
  computeScriptHashFromHtml,
  EVENT_TYPES,
  // SEC-14-02: timingSafeEqual exposed for unit tests; requireAuth depends on
  // closure state (authToken) so end-to-end HTTP tests verify behavior.
  timingSafeEqual,
};
