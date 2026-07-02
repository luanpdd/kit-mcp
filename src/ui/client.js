// src/ui/client.js
// Fire-and-forget publisher. Reads the lockfile to discover the running sidecar's
// port, then POSTs an event to /publish. If the sidecar isn't running (no lockfile,
// ECONNREFUSED, healthz mismatch), publish() resolves silently — publishers MUST NOT
// fail just because the optional UI isn't up.

import http from 'node:http';
import { readLock } from './lockfile.js';
import { validateEvent } from './events.js';

// Cache the resolved sidecar (port + token) across calls in a single process.
// SEC-14-02: token is needed for Authorization on every publish() — read from
// the same lockfile read as port to avoid double I/O.
const sidecarCache = new Map(); // projectRoot -> { port, token } | { port: 0, token: null }
const SIDECAR_CACHE_TTL_MS = 5_000;
const cacheTimestamps = new Map();

function readCachedSidecar(projectRoot) {
  const ts = cacheTimestamps.get(projectRoot);
  if (!ts || Date.now() - ts > SIDECAR_CACHE_TTL_MS) return undefined;
  return sidecarCache.get(projectRoot);
}

function writeCachedSidecar(projectRoot, sidecar) {
  sidecarCache.set(projectRoot, sidecar);
  cacheTimestamps.set(projectRoot, Date.now());
}

// Backward-compat name; clears port + token cache. Tests + callers using
// clearPortCache continue to work without code change.
export function clearPortCache() {
  sidecarCache.clear();
  cacheTimestamps.clear();
}

function resolveSidecar(projectRoot) {
  const cached = readCachedSidecar(projectRoot);
  if (cached !== undefined) return cached;
  const lock = readLock(projectRoot);
  const sidecar = {
    port: lock?.port ?? 0,
    // SEC-14-02: null if missing (lockfile from older sidecar version pre-v1.14).
    // Triggers degraded path: no Authorization header → server 401 → soft-fail.
    token: typeof lock?.token === 'string' ? lock.token : null,
  };
  writeCachedSidecar(projectRoot, sidecar);
  return sidecar;
}

// publish(event, { projectRoot, timeoutMs }): always resolves. Returns
//   { sent: true, status }    on 2xx
//   { sent: false, reason }   in every other case (no sidecar, validation, network)
export async function publish(event, { projectRoot, timeoutMs = 1500 } = {}) {
  if (!projectRoot) return { sent: false, reason: 'no_project_root' };

  const validationErr = validateEvent(event);
  if (validationErr) return { sent: false, reason: `invalid_event: ${validationErr.message}` };

  const { port, token } = resolveSidecar(projectRoot);
  if (!port) return { sent: false, reason: 'no_sidecar' };

  const body = JSON.stringify(event);

  return new Promise((resolve) => {
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/publish',
      agent: false,
      headers: {
        'host': `127.0.0.1:${port}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body, 'utf8'),
        'origin': `http://127.0.0.1:${port}`,
        'connection': 'close',
        // SEC-14-02: attach Bearer token if lockfile has one. If not (older
        // sidecar pre-v1.14), server returns 401 → resolves as { sent: false,
        // reason: 'http_401' } via the soft-fail flow below.
        ...(token ? { 'authorization': `Bearer ${token}` } : {}),
      },
    }, (res) => {
      // Drain — we don't actually care about the body, just the status.
      res.resume();
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ sent: true, status: res.statusCode });
        } else {
          // Stale lockfile or rotated token? Drop cache so next call re-reads.
          // SEC-14-02: invalidate on 401 too — token may have rotated after
          // sidecar restart; cache TTL of 5s would otherwise prolong recovery.
          if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 404) {
            sidecarCache.delete(projectRoot);
            cacheTimestamps.delete(projectRoot);
          }
          resolve({ sent: false, reason: `http_${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      // Most common: ECONNREFUSED (lockfile points at a dead port).
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        sidecarCache.delete(projectRoot);
        cacheTimestamps.delete(projectRoot);
      }
      resolve({ sent: false, reason: `error: ${err.code || err.message}` });
    });

    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch { /* noop */ }
      resolve({ sent: false, reason: 'timeout' });
    });

    req.write(body);
    req.end();
  });
}

// publishMany emits a sequence of events one after another. Used by callers
// that want best-effort guaranteed ordering — http.request is async, so
// firing in parallel doesn't preserve order at the server.
export async function publishMany(events, opts) {
  const results = [];
  for (const evt of events) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await publish(evt, opts));
  }
  return results;
}
