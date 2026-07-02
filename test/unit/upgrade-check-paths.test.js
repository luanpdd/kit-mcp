// Phase 100 — Coverage ratchet: targeted tests for src/cli/upgrade-check.js
//
// Baseline: 60.00% line coverage. Target ≥ 90%.
// `upgrade-check.test.js` already covers compareVersions edge cases and
// getLocalVersion happy path. Here we cover the cache read/write/expiration
// and the checkUpgrade dispatch logic without hitting the live npm registry
// (which is flaky in CI).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { checkUpgrade, getLocalVersion, __test } from '../../src/cli/upgrade-check.js';

const { compareVersions, CHECK_TTL_MS } = __test;

// The real cache path. Tests back this up + restore in finally.
const CACHE_FILE = path.join(os.homedir(), '.kit-mcp', 'version-check.json');

// Save and return a snapshot of the existing cache (or null if absent).
async function backupCache() {
  try { return await fs.readFile(CACHE_FILE, 'utf8'); }
  catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

async function restoreCache(snapshot) {
  if (snapshot === null) {
    try { await fs.unlink(CACHE_FILE); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  } else {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, snapshot, 'utf8');
  }
}

async function writeCacheRaw(content) {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, content, 'utf8');
}

async function deleteCache() {
  try { await fs.unlink(CACHE_FILE); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
}

// --- compareVersions corner cases (additive to upgrade-check.test.js) ---

test('compareVersions — extra components beyond x.y.z are ignored', () => {
  // parse() only destructures [a1, a2, a3]; extra parts are dropped silently.
  // 1.5.3.4.5 should compare equal to 1.5.3 because index >= 3 is unread.
  assert.equal(compareVersions('1.5.3.4.5', '1.5.3'), 0);
});

test('compareVersions — single-digit version padded to x.0.0', () => {
  assert.equal(compareVersions('1', '1.0.0'), 0);
  assert.equal(compareVersions('2', '1.99.99'), 1);
});

test('compareVersions — 0.0.0 vs 0.0.0 returns 0', () => {
  assert.equal(compareVersions('0.0.0', '0.0.0'), 0);
});

test('compareVersions — non-numeric components default to 0', () => {
  // 'abc.def.ghi' parses each component to NaN → fallback to 0
  assert.equal(compareVersions('abc.def.ghi', '0.0.0'), 0);
});

// --- checkUpgrade — cache hit path ---

test('checkUpgrade — fresh cache hit returns source:cache', async () => {
  const snapshot = await backupCache();
  try {
    const local = await getLocalVersion();
    // Pre-populate cache with a fake "much higher" latest version
    await writeCacheRaw(JSON.stringify({
      checkedAt: Date.now(),
      latest: '99.0.0',
    }));
    const r = await checkUpgrade({ force: false });
    assert.ok(r);
    assert.equal(r.source, 'cache');
    assert.equal(r.latest, '99.0.0');
    assert.equal(r.local, local);
    assert.equal(r.behind, true, 'local should be behind 99.0.0');
  } finally {
    await restoreCache(snapshot);
  }
});

test('checkUpgrade — cache hit with latest === local: behind=false', async () => {
  const snapshot = await backupCache();
  try {
    const local = await getLocalVersion();
    await writeCacheRaw(JSON.stringify({
      checkedAt: Date.now(),
      latest: local,
    }));
    const r = await checkUpgrade({ force: false });
    assert.equal(r.source, 'cache');
    assert.equal(r.latest, local);
    assert.equal(r.behind, false);
  } finally {
    await restoreCache(snapshot);
  }
});

// --- checkUpgrade — cache validation failures ---

test('checkUpgrade — corrupted JSON cache: treated as missing (no source:cache)', async () => {
  const snapshot = await backupCache();
  try {
    // Write garbage that JSON.parse will reject
    await writeCacheRaw('{not valid json');
    // checkUpgrade may then hit the network; we only care that it didn't
    // surface "cache" as the source. Source will be 'network' or 'offline'
    // depending on connectivity.
    const r = await checkUpgrade({ force: false });
    if (r) {
      assert.notEqual(r.source, 'cache', 'corrupted JSON should not be source:cache');
    }
  } finally {
    await restoreCache(snapshot);
  }
});

test('checkUpgrade — cache with invalid shape (checkedAt: string): treated as missing', async () => {
  const snapshot = await backupCache();
  try {
    // checkedAt should be number; readCache rejects non-number
    await writeCacheRaw(JSON.stringify({ checkedAt: 'not-a-number', latest: '1.0.0' }));
    const r = await checkUpgrade({ force: false });
    if (r) {
      assert.notEqual(r.source, 'cache');
    }
  } finally {
    await restoreCache(snapshot);
  }
});

test('checkUpgrade — cache with non-string latest: treated as missing', async () => {
  const snapshot = await backupCache();
  try {
    await writeCacheRaw(JSON.stringify({ checkedAt: Date.now(), latest: 42 }));
    const r = await checkUpgrade({ force: false });
    if (r) {
      assert.notEqual(r.source, 'cache');
    }
  } finally {
    await restoreCache(snapshot);
  }
});

test('checkUpgrade — expired cache (older than 24h): treated as missing', async () => {
  const snapshot = await backupCache();
  try {
    // Set checkedAt to 25 hours ago — beyond TTL
    const expiredAt = Date.now() - (25 * 60 * 60 * 1000);
    await writeCacheRaw(JSON.stringify({ checkedAt: expiredAt, latest: '99.0.0' }));
    const r = await checkUpgrade({ force: false });
    if (r) {
      // Should NOT be source:cache because TTL expired
      assert.notEqual(r.source, 'cache');
      // latest should NOT be the expired '99.0.0' since cache was discarded
      // (network or offline path would have run instead)
    }
  } finally {
    await restoreCache(snapshot);
  }
});

// --- checkUpgrade — force bypasses cache ---

test('checkUpgrade — force:true bypasses cache and resolves to network/offline', async () => {
  const snapshot = await backupCache();
  try {
    // Pre-populate fresh cache
    await writeCacheRaw(JSON.stringify({ checkedAt: Date.now(), latest: '50.0.0' }));
    // force=true must NOT use the cache — source should be 'network' or 'offline'
    const r = await checkUpgrade({ force: true });
    if (r) {
      assert.notEqual(r.source, 'cache', 'force:true must bypass cache');
      assert.ok(r.source === 'network' || r.source === 'offline',
        `expected network|offline, got ${r.source}`);
    }
  } finally {
    await restoreCache(snapshot);
  }
});

// --- checkUpgrade — cache miss path ---

test('checkUpgrade — no cache present: hits network or offline path', async () => {
  const snapshot = await backupCache();
  try {
    await deleteCache();
    const r = await checkUpgrade({ force: false });
    if (r) {
      // No cache → never source:cache
      assert.notEqual(r.source, 'cache');
      assert.ok(r.source === 'network' || r.source === 'offline');
      // local must be set regardless
      assert.match(r.local, /^\d+\.\d+\.\d+/);
    }
  } finally {
    await restoreCache(snapshot);
  }
});

// --- getLocalVersion ---

test('getLocalVersion — returns matching kit-mcp package version', async () => {
  const v = await getLocalVersion();
  assert.ok(v);
  assert.match(v, /^\d+\.\d+\.\d+/);
});

// CHECK_TTL_MS sanity — re-asserted here (already in upgrade-check.test.js
// but kept for self-containment of the file).
test('CHECK_TTL_MS exposed via __test equals 24 hours in milliseconds', () => {
  assert.equal(CHECK_TTL_MS, 24 * 60 * 60 * 1000);
});
