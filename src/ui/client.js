// src/ui/client.js
// Fire-and-forget publisher. Reads the lockfile to discover the running sidecar's
// port, then POSTs an event to /publish. If the sidecar isn't running (no lockfile,
// ECONNREFUSED, healthz mismatch), publish() resolves silently — publishers MUST NOT
// fail just because the optional UI isn't up.

import http from 'node:http';
import { readLock } from './lockfile.js';
import { validateEvent } from './events.js';

// Cache the resolved port across calls in a single process.
const portCache = new Map(); // projectRoot -> port (or 0 = no sidecar)
const PORT_CACHE_TTL_MS = 5_000;
const cacheTimestamps = new Map();

function readCachedPort(projectRoot) {
  const ts = cacheTimestamps.get(projectRoot);
  if (!ts || Date.now() - ts > PORT_CACHE_TTL_MS) return undefined;
  return portCache.get(projectRoot);
}

function writeCachedPort(projectRoot, port) {
  portCache.set(projectRoot, port);
  cacheTimestamps.set(projectRoot, Date.now());
}

export function clearPortCache() {
  portCache.clear();
  cacheTimestamps.clear();
}

function resolvePort(projectRoot) {
  const cached = readCachedPort(projectRoot);
  if (cached !== undefined) return cached;
  const lock = readLock(projectRoot);
  const port = lock?.port ?? 0;
  writeCachedPort(projectRoot, port);
  return port;
}

// publish(event, { projectRoot, timeoutMs }): always resolves. Returns
//   { sent: true, status }    on 2xx
//   { sent: false, reason }   in every other case (no sidecar, validation, network)
export async function publish(event, { projectRoot, timeoutMs = 1500 } = {}) {
  if (!projectRoot) return { sent: false, reason: 'no_project_root' };

  const validationErr = validateEvent(event);
  if (validationErr) return { sent: false, reason: `invalid_event: ${validationErr.message}` };

  const port = resolvePort(projectRoot);
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
      },
    }, (res) => {
      // Drain — we don't actually care about the body, just the status.
      res.resume();
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ sent: true, status: res.statusCode });
        } else {
          // Stale lockfile? Drop the cache so the next call re-reads.
          if (res.statusCode === 403 || res.statusCode === 404) {
            portCache.delete(projectRoot);
            cacheTimestamps.delete(projectRoot);
          }
          resolve({ sent: false, reason: `http_${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      // Most common: ECONNREFUSED (lockfile points at a dead port).
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        portCache.delete(projectRoot);
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
