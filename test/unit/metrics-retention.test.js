// OBS-19-01 / OBS-19-02 / OBS-19-03 — unit tests for persistSnapshot / loadSnapshots / cleanup.
//
// Phase 99.01 (v1.19 Maturidade Operacional). Tests the disk-persistence layer
// added on top of the in-memory metrics from Phase 94.01.
//
// Coverage matrix:
//   - persistSnapshot: creates dir, writes JSON, returns {file, snap}, snap has ts.
//   - persistSnapshot: snap.counters/latency match snapshot() at write time.
//   - loadSnapshots: returns [] when dir absent (first run, never persisted).
//   - loadSnapshots: filters by windowMs using in-file ts (not filename, not mtime).
//   - loadSnapshots: returns ascending sort by ts so consumers don't re-sort.
//   - loadSnapshots: skips malformed JSON without aborting the load.
//   - cleanupOldSnapshots: persistSnapshot prunes files with mtime > retentionMs.
//   - Round-trip: persist → load returns the same shape (ts + counters + latency).
//   - Defensive: empty snapshot persists cleanly (counters {}, latency {}).
//
// Each test uses an isolated tmp dir under os.tmpdir() so we don't pollute the
// real .planning/metrics/snapshots/ during test runs.
//
// Pure unit — uses fs/promises, no spawn, no network.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
  incrementInvocation,
  recordLatency,
  reset,
  persistSnapshot,
  loadSnapshots,
  __TEST_SNAPSHOT_DIR_REL,
} from '../../src/core/metrics.js';

let TMP_ROOT;

beforeEach(async () => {
  reset();
  TMP_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-metrics-retention-'));
});

afterEach(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  reset();
});

// ---- persistSnapshot --------------------------------------------------------

test('OBS-19-01: persistSnapshot creates the snapshots directory under .planning/metrics/', async () => {
  incrementInvocation('kit', 'ok');
  const { file } = await persistSnapshot(TMP_ROOT);
  // The file path must live under the canonical relative dir — locks the
  // contract that .gitignore + downstream tooling depends on.
  const expectedDir = path.join(TMP_ROOT, __TEST_SNAPSHOT_DIR_REL);
  assert.equal(path.dirname(file), expectedDir,
    `file dir ${path.dirname(file)} !== ${expectedDir}`);
  // Directory must exist and contain the file.
  const stat = await fs.stat(file);
  assert.ok(stat.isFile(), 'persisted snapshot must be a regular file');
});

test('OBS-19-01: persistSnapshot writes JSON with ts + counters + latency', async () => {
  incrementInvocation('kit', 'ok');
  incrementInvocation('kit', 'error');
  recordLatency('kit', 50);
  recordLatency('kit', 150);
  const { file, snap } = await persistSnapshot(TMP_ROOT);
  // Returned snap shape: ts must be a finite epoch ms number, counters/latency
  // mirror what snapshot() returned at the call site.
  assert.ok(Number.isFinite(snap.ts), 'snap.ts must be a finite epoch ms');
  assert.equal(snap.counters['kit:ok'], 1);
  assert.equal(snap.counters['kit:error'], 1);
  assert.equal(snap.latency['kit'].count, 2);
  // On-disk content must round-trip via JSON.parse to the same shape.
  const raw = await fs.readFile(file, 'utf-8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.ts, snap.ts);
  assert.deepEqual(parsed.counters, snap.counters);
  assert.deepEqual(parsed.latency, snap.latency);
});

test('OBS-19-01: persistSnapshot filename uses filesystem-safe ISO encoding', async () => {
  // Windows forbids `:` in filenames; the encoding replaces both `:` and `.`
  // with `-`. Without this, mkdir/writeFile fails on win32 runners.
  const { file } = await persistSnapshot(TMP_ROOT);
  const base = path.basename(file);
  assert.match(base, /^[\d\-T]+Z\.json$/, `filename must be ISO-safe; got ${base}`);
  assert.doesNotMatch(base, /:/, 'filename must not contain colons (Windows-incompatible)');
  // Period is allowed before .json extension only — basename ends with `.json`
  // so any other `.` would be illegal.
  const stem = base.replace(/\.json$/, '');
  assert.doesNotMatch(stem, /\./, 'filename stem must not contain `.`');
});

test('OBS-19-01: persistSnapshot persists empty state cleanly', async () => {
  // No invocations recorded — snap.counters and snap.latency are {} and the
  // file should still write without throwing. Catches a regression where a
  // future change might guard `if (Object.keys(counters).length === 0) return`.
  const { file, snap } = await persistSnapshot(TMP_ROOT);
  assert.deepEqual(snap.counters, {});
  assert.deepEqual(snap.latency, {});
  const raw = await fs.readFile(file, 'utf-8');
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed.counters, {});
  assert.deepEqual(parsed.latency, {});
});

// ---- loadSnapshots ----------------------------------------------------------

test('OBS-19-02: loadSnapshots returns [] when snapshots directory is absent', async () => {
  // First-run scenario — `.planning/metrics/snapshots/` has not been created
  // yet because nobody has called persistSnapshot. Must NOT throw ENOENT.
  const out = await loadSnapshots(TMP_ROOT);
  assert.deepEqual(out, []);
});

test('OBS-19-02: loadSnapshots round-trips persisted snapshots', async () => {
  // Persist three snapshots with distinct counter values; load them back and
  // assert the round-trip. With the in-file ts being authoritative this also
  // verifies the JSON shape consumers will see.
  incrementInvocation('alpha', 'ok');
  await persistSnapshot(TMP_ROOT);
  // Brief sleep to avoid identical ts (Date.now() resolution is 1ms but the
  // filesystem-safe filename encoding stays unique across same-ms collisions
  // because we re-derive from ts on each call).
  await new Promise(r => setTimeout(r, 5));
  incrementInvocation('beta', 'ok');
  await persistSnapshot(TMP_ROOT);
  await new Promise(r => setTimeout(r, 5));
  incrementInvocation('gamma', 'ok');
  await persistSnapshot(TMP_ROOT);

  const loaded = await loadSnapshots(TMP_ROOT);
  assert.equal(loaded.length, 3, 'must load all 3 persisted snapshots');
  // Sort is ascending by ts.
  assert.ok(loaded[0].ts < loaded[1].ts, 'loaded[0].ts must be < loaded[1].ts');
  assert.ok(loaded[1].ts < loaded[2].ts, 'loaded[1].ts must be < loaded[2].ts');
  // Each snapshot reflects the cumulative counters at the moment it was written.
  assert.equal(loaded[0].counters['alpha:ok'], 1);
  assert.equal(loaded[0].counters['beta:ok'], undefined);
  assert.equal(loaded[1].counters['alpha:ok'], 1);
  assert.equal(loaded[1].counters['beta:ok'], 1);
  assert.equal(loaded[2].counters['gamma:ok'], 1);
});

test('OBS-19-02: loadSnapshots filters by windowMs using in-file ts (not mtime)', async () => {
  // Hand-craft 2 snapshot files: one with ts in the past beyond the window,
  // one within the window. mtime is the same (just-written), so this proves
  // the filter is by in-file ts, not by mtime.
  const dir = path.join(TMP_ROOT, __TEST_SNAPSHOT_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  const oldTs = Date.now() - (2 * 86400 * 1000); // 2 days ago
  const newTs = Date.now() - (1 * 60 * 1000);    // 1 minute ago
  await fs.writeFile(path.join(dir, 'old.json'),
    JSON.stringify({ ts: oldTs, counters: { 'old:ok': 1 }, latency: {} }));
  await fs.writeFile(path.join(dir, 'new.json'),
    JSON.stringify({ ts: newTs, counters: { 'new:ok': 1 }, latency: {} }));

  // Window = 1 hour — should include only the "new" snapshot.
  const oneHour = 60 * 60 * 1000;
  const loaded = await loadSnapshots(TMP_ROOT, oneHour);
  assert.equal(loaded.length, 1, 'window=1h must exclude the 2-day-old snapshot');
  assert.equal(loaded[0].counters['new:ok'], 1);
  assert.equal(loaded[0].counters['old:ok'], undefined);
});

test('OBS-19-02: loadSnapshots skips malformed JSON without aborting', async () => {
  // A corrupt file in the snapshots dir must not break the burn-rate read
  // path — degraded mode is "fewer data points," not "command crashes."
  const dir = path.join(TMP_ROOT, __TEST_SNAPSHOT_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'corrupt.json'), '{ this is not json');
  const ts = Date.now();
  await fs.writeFile(path.join(dir, 'good.json'),
    JSON.stringify({ ts, counters: { 'kit:ok': 5 }, latency: {} }));
  const loaded = await loadSnapshots(TMP_ROOT);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].counters['kit:ok'], 5);
});

test('OBS-19-02: loadSnapshots ignores files without ts (defensive against shape drift)', async () => {
  // If a future schema adds/renames fields, only entries that still have a
  // finite ts should appear. Without this guard, downstream code that does
  // `loaded[0].ts - loaded[1].ts` would NaN-propagate silently.
  const dir = path.join(TMP_ROOT, __TEST_SNAPSHOT_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'noTs.json'),
    JSON.stringify({ counters: { 'kit:ok': 1 }, latency: {} }));
  await fs.writeFile(path.join(dir, 'badTs.json'),
    JSON.stringify({ ts: 'not-a-number', counters: {}, latency: {} }));
  await fs.writeFile(path.join(dir, 'ok.json'),
    JSON.stringify({ ts: Date.now(), counters: { 'ok:ok': 1 }, latency: {} }));
  const loaded = await loadSnapshots(TMP_ROOT);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].counters['ok:ok'], 1);
});

test('OBS-19-02: loadSnapshots returns ascending order even if filenames are out-of-order alphabetically', async () => {
  // Filename sort != ts sort because the ISO-safe encoding still embeds the
  // timestamp but our helper avoids parsing it. A file written later with an
  // earlier-named filename (impossible in practice but defensive) must come
  // first by ts.
  const dir = path.join(TMP_ROOT, __TEST_SNAPSHOT_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  // "z-snap" alphabetically last but ts earliest.
  await fs.writeFile(path.join(dir, 'z-snap.json'),
    JSON.stringify({ ts: 1000, counters: {}, latency: {} }));
  await fs.writeFile(path.join(dir, 'a-snap.json'),
    JSON.stringify({ ts: 2000, counters: {}, latency: {} }));
  await fs.writeFile(path.join(dir, 'm-snap.json'),
    JSON.stringify({ ts: 3000, counters: {}, latency: {} }));
  const loaded = await loadSnapshots(TMP_ROOT, Date.now() + 86400 * 1000); // huge window
  assert.deepEqual(loaded.map(s => s.ts), [1000, 2000, 3000]);
});

// ---- cleanupOldSnapshots (via persistSnapshot) ------------------------------

test('OBS-19-03: persistSnapshot cleans up files older than retentionMs', async () => {
  // Seed an "old" snapshot file with mtime in the distant past, then call
  // persistSnapshot with a tiny retention window. Cleanup must remove the
  // old file while preserving the just-written one.
  const dir = path.join(TMP_ROOT, __TEST_SNAPSHOT_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  const oldFile = path.join(dir, 'ancient.json');
  await fs.writeFile(oldFile, JSON.stringify({ ts: 0, counters: {}, latency: {} }));
  // Set mtime to 2 days ago so cleanup fires.
  const past = (Date.now() / 1000) - (2 * 86400);
  await fs.utimes(oldFile, past, past);

  // Retention = 1 day — the 2-day-old file must be unlinked.
  await persistSnapshot(TMP_ROOT, { retentionMs: 86400 * 1000 });

  const remaining = await fs.readdir(dir);
  assert.ok(!remaining.includes('ancient.json'),
    `ancient.json must be cleaned up; got remaining=${JSON.stringify(remaining)}`);
  // The just-written snapshot must still be present.
  assert.equal(remaining.length, 1, 'only the freshly-written snapshot should remain');
  assert.match(remaining[0], /\.json$/);
});

test('OBS-19-03: persistSnapshot preserves files within retentionMs', async () => {
  // Inverse of the previous test — files newer than retentionMs must NOT be
  // unlinked. Without this, a too-aggressive cleanup would erase the data
  // /burn-rate-status needs to read.
  const dir = path.join(TMP_ROOT, __TEST_SNAPSHOT_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  const recentFile = path.join(dir, 'recent.json');
  await fs.writeFile(recentFile, JSON.stringify({ ts: Date.now() - 60000, counters: {}, latency: {} }));
  // Touch to "1 hour ago" — well within a 1d retention.
  const oneHourAgo = (Date.now() / 1000) - 3600;
  await fs.utimes(recentFile, oneHourAgo, oneHourAgo);

  await persistSnapshot(TMP_ROOT, { retentionMs: 86400 * 1000 });

  const remaining = await fs.readdir(dir);
  assert.ok(remaining.includes('recent.json'),
    `recent.json must survive cleanup; got=${JSON.stringify(remaining)}`);
  assert.equal(remaining.length, 2, 'old + new snapshot both present');
});
