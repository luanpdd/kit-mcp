// src/ui/lockfile.js
// Single-instance lockfile per projectRoot, located in os.tmpdir().
//
// Atomic create via fs.openSync(path, 'wx') (O_EXCL semantics — fails if file exists).
// Stale detection in two layers:
//   1. process.kill(pid, 0) — ESRCH/EPERM means the holder is gone
//   2. optional HTTP healthz probe (injected by caller; keeps this module pure of net)

import { createHash } from 'node:crypto';
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
export async function probeStale(lock, { healthzProbe } = {}) {
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
  try {
    const ok = await healthzProbe(lock.port);
    if (ok) return { stale: false, reason: 'healthz_ok' };
    return { stale: true, reason: 'healthz_failed' };
  } catch {
    return { stale: true, reason: 'healthz_failed' };
  }
}

// Convenience: take + retry once if stale lock is detected.
export async function acquireLockOrReclaim(opts) {
  try {
    return acquireLock(opts);
  } catch (err) {
    if (err.code !== 'ELOCKED') throw err;
    const existing = readLock(opts.projectRoot);
    const probe = await probeStale(existing, { healthzProbe: opts.healthzProbe });
    if (probe.stale) {
      releaseLock(opts.projectRoot);
      return acquireLock(opts);
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
