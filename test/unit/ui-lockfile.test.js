import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  lockPathFor,
  acquireLock,
  acquireLockOrReclaim,
  readLock,
  releaseLock,
  probeStale,
} from '../../src/ui/lockfile.js';

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-test-'));
}

test('lockPathFor produces a deterministic path in os.tmpdir()', () => {
  const root = mkProjectRoot();
  const p1 = lockPathFor(root);
  const p2 = lockPathFor(root);
  assert.equal(p1, p2);
  assert.ok(p1.startsWith(os.tmpdir()));
  assert.match(path.basename(p1), /^kit-mcp-ui-[0-9a-f]{16}\.lock$/);
});

test('different projectRoots yield different lockfiles', () => {
  const a = mkProjectRoot();
  const b = mkProjectRoot();
  assert.notEqual(lockPathFor(a), lockPathFor(b));
});

test('acquireLock writes JSON with pid+port', () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const lock = acquireLock({ projectRoot: root, port: 7100, version: '1.2.0' });
  try {
    assert.equal(lock.pid, process.pid);
    assert.equal(lock.port, 7100);
    const onDisk = JSON.parse(fs.readFileSync(lock._path, 'utf8'));
    assert.equal(onDisk.pid, process.pid);
    assert.equal(onDisk.port, 7100);
    assert.equal(onDisk.version, '1.2.0');
  } finally {
    releaseLock(root);
  }
});

test('acquireLock fails with ELOCKED on second call', () => {
  const root = mkProjectRoot();
  releaseLock(root);
  acquireLock({ projectRoot: root, port: 7100 });
  try {
    assert.throws(
      () => acquireLock({ projectRoot: root, port: 7101 }),
      (err) => err.code === 'ELOCKED',
    );
  } finally {
    releaseLock(root);
  }
});

test('readLock returns null when no lock', () => {
  const root = mkProjectRoot();
  releaseLock(root);
  assert.equal(readLock(root), null);
});

test('readLock returns parsed metadata', () => {
  const root = mkProjectRoot();
  releaseLock(root);
  acquireLock({ projectRoot: root, port: 7100 });
  try {
    const lock = readLock(root);
    assert.equal(lock.pid, process.pid);
    assert.equal(lock.port, 7100);
  } finally {
    releaseLock(root);
  }
});

test('readLock returns null on malformed JSON', () => {
  const root = mkProjectRoot();
  const file = lockPathFor(root);
  fs.writeFileSync(file, '{ malformed');
  try {
    assert.equal(readLock(root), null);
  } finally {
    fs.unlinkSync(file);
  }
});

test('probeStale: pid_alive when current process holds lock', async () => {
  const lock = { pid: process.pid, port: 7100 };
  const result = await probeStale(lock);
  assert.equal(result.stale, false);
  assert.equal(result.reason, 'pid_alive');
});

test('probeStale: pid_gone when pid does not exist', async () => {
  // Use a clearly nonexistent PID. process.kill(huge_pid, 0) should ESRCH.
  const lock = { pid: 999999999, port: 7100 };
  const result = await probeStale(lock);
  assert.equal(result.stale, true);
  assert.equal(result.reason, 'pid_gone');
});

test('probeStale: invalid_lock when shape is wrong', async () => {
  assert.equal((await probeStale(null)).reason, 'invalid_lock');
  assert.equal((await probeStale({})).reason, 'invalid_lock');
});

test('probeStale: healthz_ok when probe returns true', async () => {
  const lock = { pid: process.pid, port: 7100 };
  const result = await probeStale(lock, { healthzProbe: async () => true });
  assert.equal(result.stale, false);
  assert.equal(result.reason, 'healthz_ok');
});

test('probeStale: healthz_failed when probe returns false', async () => {
  const lock = { pid: process.pid, port: 7100 };
  const result = await probeStale(lock, { healthzProbe: async () => false });
  assert.equal(result.stale, true);
  assert.equal(result.reason, 'healthz_failed');
});

test('probeStale: healthz_failed when probe throws', async () => {
  const lock = { pid: process.pid, port: 7100 };
  const result = await probeStale(lock, {
    healthzProbe: async () => { throw new Error('connection refused'); },
  });
  assert.equal(result.stale, true);
  assert.equal(result.reason, 'healthz_failed');
});

test('acquireLockOrReclaim: succeeds first try', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const lock = await acquireLockOrReclaim({ projectRoot: root, port: 7100 });
  try {
    assert.equal(lock.pid, process.pid);
  } finally {
    releaseLock(root);
  }
});

test('acquireLockOrReclaim: reclaims a stale lock', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  // Manually plant a lock claiming a dead PID
  const file = lockPathFor(root);
  fs.writeFileSync(file, JSON.stringify({ pid: 999999998, port: 7100, startedAt: 0 }));
  try {
    const lock = await acquireLockOrReclaim({ projectRoot: root, port: 7100 });
    assert.equal(lock.pid, process.pid, 'should have reclaimed and rewritten');
  } finally {
    releaseLock(root);
  }
});

test('acquireLockOrReclaim: refuses to reclaim a live lock', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  acquireLock({ projectRoot: root, port: 7100 }); // live lock owned by current pid
  try {
    await assert.rejects(
      () => acquireLockOrReclaim({ projectRoot: root, port: 7101 }),
      (err) => err.code === 'ELIVE',
    );
  } finally {
    releaseLock(root);
  }
});

test('releaseLock returns false when nothing to remove', () => {
  const root = mkProjectRoot();
  assert.equal(releaseLock(root), false);
});

// PERF-04: probeStale enforces a per-call timeout on healthzProbe.
test('probeStale: healthzProbe timeout treats slow holder as stale', async () => {
  const slowProbe = () => new Promise((resolve) => setTimeout(() => resolve(true), 5000));
  const lock = { pid: process.pid, port: 7100 }; // pid is alive (us)
  const t0 = Date.now();
  const result = await probeStale(lock, { healthzProbe: slowProbe, probeTimeoutMs: 50 });
  const elapsed = Date.now() - t0;
  assert.equal(result.stale, true);
  assert.equal(result.reason, 'healthz_failed');
  assert.ok(elapsed < 500, `expected <500ms, took ${elapsed}ms`);
});

test('probeStale: healthzProbe under timeout returns ok', async () => {
  const fastProbe = () => Promise.resolve(true);
  const lock = { pid: process.pid, port: 7100 };
  const result = await probeStale(lock, { healthzProbe: fastProbe, probeTimeoutMs: 500 });
  assert.equal(result.stale, false);
  assert.equal(result.reason, 'healthz_ok');
});
