// src/ui/port.js
// Find a free TCP port within a bounded range.
// Pure utility: no module-level state, no logging.

import net from 'node:net';

export const DEFAULT_PORT_RANGE = Object.freeze({ start: 7100, end: 7199 });

// Probes a single port: resolves to true if free (could bind+close), false if taken.
function probePort(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;
    const finish = (free) => {
      if (settled) return;
      settled = true;
      server.removeAllListeners();
      try { server.close(); } catch { /* ignore */ }
      resolve(free);
    };
    server.once('error', () => finish(false));
    server.once('listening', () => finish(true));
    try {
      server.listen(port, host);
    } catch {
      finish(false);
    }
  });
}

// findFreePort scans [start..end] inclusive on host (default 127.0.0.1) and
// returns the first port where a transient bind succeeds. Returns null if none.
//
// Race note: between probe-close and the caller's bind, the port can be
// reclaimed by another process. The lockfile + healthz probe in upper layers
// covers this — port.js is best-effort discovery, not exclusive reservation.
export async function findFreePort({
  start = DEFAULT_PORT_RANGE.start,
  end = DEFAULT_PORT_RANGE.end,
  host = '127.0.0.1',
} = {}) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    throw new TypeError(`invalid port range: ${start}..${end}`);
  }
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await probePort(port, host)) {
      return port;
    }
  }
  return null;
}

// findFreePortOrThrow is the eager variant — surfaces an error message that
// includes the exhausted range, so callers don't have to format it.
export async function findFreePortOrThrow(opts = {}) {
  const port = await findFreePort(opts);
  if (port === null) {
    const start = opts.start ?? DEFAULT_PORT_RANGE.start;
    const end = opts.end ?? DEFAULT_PORT_RANGE.end;
    throw new Error(
      `No free TCP port in ${start}..${end} (host ${opts.host ?? '127.0.0.1'}). ` +
      `Run \`kit ui status\` to inspect a running sidecar, or kill whatever is using these ports.`,
    );
  }
  return port;
}
