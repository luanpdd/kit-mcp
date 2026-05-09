// src/ui/lockfile.js
// Single-instance lockfile per projectRoot, located in os.tmpdir().
//
// Atomic create via fs.openSync(path, 'wx') (O_EXCL semantics — fails if file exists).
// Stale detection in two layers:
//   1. process.kill(pid, 0) — ESRCH/EPERM means the holder is gone
//   2. optional HTTP healthz probe (injected by caller; keeps this module pure of net)

import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export const LOCK_VERSION = 1;

export function lockPathFor(projectRoot) {
  if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
    throw new TypeError('projectRoot must be a non-empty string');
  }
  const hash = createHash('sha1').update(projectRoot).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), `kit-mcp-ui-${hash}.lock`);
}

// readLock returns parsed lockfile content, or null if the file doesn't exist
// or is unreadable/unparseable. Never throws.
export function readLock(projectRoot) {
  const file = lockPathFor(projectRoot);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.pid === 'number') {
      return { ...parsed, _path: file };
    }
    return null;
  } catch {
    return null;
  }
}

// acquireLock attempts to create the lockfile atomically. On success returns
// the lock metadata. On EEXIST, throws an Error tagged with .code = 'ELOCKED'
// — the caller is expected to call probeStale + maybe retry.
export function acquireLock({ projectRoot, port, version, startedAt }) {
  const file = lockPathFor(projectRoot);
  const meta = {
    pid: process.pid,
    port,
    version: version ?? null,
    startedAt: startedAt ?? Date.now(),
    lockSchema: LOCK_VERSION,
    // SEC-14-02: per-process auth token. 32 random bytes hex-encoded = 64 chars.
    // Required by /publish, /shutdown, /events, /state. Lifetime = process lifetime;
    // not logged, not telemetered. See docs/sidecar-security.md.
    token: randomBytes(32).toString('hex'),
  };
  let fd;
  try {
    fd = fs.openSync(file, 'wx');
  } catch (err) {
    if (err.code === 'EEXIST') {
      const lockErr = new Error(`Lockfile already exists: ${file}`);
      lockErr.code = 'ELOCKED';
      lockErr.path = file;
      throw lockErr;
    }
    throw err;
  }
  try {
    fs.writeSync(fd, JSON.stringify(meta, null, 2));
  } finally {
    fs.closeSync(fd);
  }
  return { ...meta, _path: file };
}

export function releaseLock(projectRoot) {
  const file = lockPathFor(projectRoot);
  try {
    fs.unlinkSync(file);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

// probeStale checks if the lockfile holder is still alive.
// Uses two strategies in order:
//   1. process.kill(pid, 0) — synchronous, no network. ESRCH = dead, EPERM = different user (rare on dev box, treat as alive to be safe).
//   2. healthzProbe(port) — optional async function injected by caller. Should return truthy if the holder responds OK.
//
// Returns:
//   { stale: false, reason: 'pid_alive' }       — process exists
//   { stale: false, reason: 'healthz_ok' }      — process exists AND healthz responded
//   { stale: true,  reason: 'pid_gone' }        — pid is ESRCH
//   { stale: true,  reason: 'healthz_failed' }  — pid alive but no healthz response (used when healthzProbe provided)
// PERF-04: budget for healthz probe inside acquireLockOrReclaim. A misbehaving
// sidecar that accepts the connection but never responds shouldn't block startup
// of a fresh sidecar — we treat slow-as-dead and reclaim.
const HEALTHZ_PROBE_TIMEOUT_MS = 500;

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(fallback); }
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
    Promise.resolve(promise).then(
      (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } },
      () => { if (!settled) { settled = true; clearTimeout(timer); resolve(fallback); } },
    );
  });
}

export async function probeStale(lock, { healthzProbe, probeTimeoutMs } = {}) {
  if (!lock || typeof lock.pid !== 'number') {
    return { stale: true, reason: 'invalid_lock' };
  }
  let pidAlive = false;
  try {
    process.kill(lock.pid, 0);
    pidAlive = true;
  } catch (err) {
    if (err.code === 'ESRCH') {
      return { stale: true, reason: 'pid_gone' };
    }
    // EPERM: pid exists but is owned by another user. Treat as alive (safe default).
    pidAlive = true;
  }
  if (!healthzProbe) {
    return { stale: false, reason: 'pid_alive' };
  }
  // PERF-04: bound the probe so a hung sidecar can't stall startup forever.
  const ms = probeTimeoutMs ?? HEALTHZ_PROBE_TIMEOUT_MS;
  const ok = await withTimeout(healthzProbe(lock.port), ms, false);
  if (ok) return { stale: false, reason: 'healthz_ok' };
  return { stale: true, reason: 'healthz_failed' };
}

// Convenience: take + retry once if stale lock is detected.
// SEC-01: re-prove staleness after releaseLock and before the retry acquire to
// close the TOCTOU window where a competing process could have raced into the
// lockfile between our probe and our retry.
export async function acquireLockOrReclaim(opts) {
  try {
    return acquireLock(opts);
  } catch (err) {
    if (err.code !== 'ELOCKED') throw err;
    const existing = readLock(opts.projectRoot);
    const probe = await probeStale(existing, { healthzProbe: opts.healthzProbe, probeTimeoutMs: opts.probeTimeoutMs });
    if (probe.stale) {
      releaseLock(opts.projectRoot);
      // SEC-01: second prove. If something raced into the lock between our
      // releaseLock and our retry-acquire, surface ELIVE instead of clobbering.
      try {
        return acquireLock(opts);
      } catch (retryErr) {
        if (retryErr.code !== 'ELOCKED') throw retryErr;
        const racer = readLock(opts.projectRoot);
        const racerProbe = await probeStale(racer, { healthzProbe: opts.healthzProbe, probeTimeoutMs: opts.probeTimeoutMs });
        if (racerProbe.stale) {
          // Genuinely dead again — third try. If THIS fails too, give up.
          releaseLock(opts.projectRoot);
          return acquireLock(opts);
        }
        const liveErr = new Error(
          `Sidecar reclaimed by another process during retry (pid=${racer?.pid}, port=${racer?.port}). ` +
          `Use \`kit ui status\` to inspect.`,
        );
        liveErr.code = 'ELIVE';
        liveErr.lock = racer;
        throw liveErr;
      }
    }
    const liveErr = new Error(
      `Sidecar already running for this project (pid=${existing?.pid}, port=${existing?.port}). ` +
      `Use \`kit ui status\` to inspect or \`kit ui stop\` to shut it down.`,
    );
    liveErr.code = 'ELIVE';
    liveErr.lock = existing;
    throw liveErr;
  }
}
