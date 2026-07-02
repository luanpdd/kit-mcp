// OBS-18-01 / OBS-18-02 — unit tests for src/core/metrics.js.
//
// Coverage matrix (Phase 94.01):
//   - incrementInvocation: ok/error, multi-tool, defensive (empty tool → no-op).
//   - recordLatency: defensive (NaN, negative, non-string), accumulates.
//   - snapshot: empty case, percentile correctness, separation of tools.
//   - FIFO cap: at HISTOGRAM_CAP+1 samples, oldest dropped, length stays ≤ cap.
//   - reset: clears both counters and histograms.
//
// All tests reset() upfront to isolate from module-level state shared with
// any other test file that has imported metrics.js earlier in the run.
//
// Pure unit — no fs, no spawn, no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  incrementInvocation,
  recordLatency,
  snapshot,
  reset,
  __TEST_HISTOGRAM_CAP,
} from '../../src/core/metrics.js';

test('OBS-18-01: incrementInvocation accumulates ok/error per tool', () => {
  reset();
  incrementInvocation('kit', 'ok');
  incrementInvocation('kit', 'ok');
  incrementInvocation('kit', 'error');
  incrementInvocation('sync', 'ok');

  const s = snapshot();
  assert.equal(s.counters['kit:ok'], 2);
  assert.equal(s.counters['kit:error'], 1);
  assert.equal(s.counters['sync:ok'], 1);
  assert.equal(s.counters['sync:error'], undefined,
    'unobserved status should not appear in snapshot');
});

test('OBS-18-01: incrementInvocation defaults status to "ok"', () => {
  reset();
  incrementInvocation('kit'); // no status
  const s = snapshot();
  assert.equal(s.counters['kit:ok'], 1);
});

test('OBS-18-01: incrementInvocation rejects empty/non-string tool', () => {
  reset();
  incrementInvocation('', 'ok');
  incrementInvocation(null, 'ok');
  incrementInvocation(undefined, 'ok');
  incrementInvocation(42, 'ok');
  const s = snapshot();
  assert.deepEqual(s.counters, {}, 'invalid tools must not pollute counters');
});

test('OBS-18-02: recordLatency observes per-tool samples and snapshot computes percentiles', () => {
  reset();
  // Synthetic dataset: 1..100 ms — easy percentile arithmetic.
  for (let i = 1; i <= 100; i++) recordLatency('kit', i);
  const s = snapshot();
  const lat = s.latency['kit'];
  assert.ok(lat, 'latency entry expected for tool with samples');
  assert.equal(lat.count, 100);
  // p50 of 1..100 with linear interpolation is 50.5 (midpoint between 50 and 51).
  assert.equal(lat.p50, 50.5);
  // p95 of 1..100 → rank 0.95*99=94.05; samples[94]=95, samples[95]=96 → 95.05.
  assert.ok(Math.abs(lat.p95 - 95.05) < 0.001, `p95 ≈ 95.05, got ${lat.p95}`);
  // p99 of 1..100 → rank 0.99*99=98.01; samples[98]=99, samples[99]=100 → 99.01.
  assert.ok(Math.abs(lat.p99 - 99.01) < 0.001, `p99 ≈ 99.01, got ${lat.p99}`);
});

test('OBS-18-02: recordLatency rejects non-finite, negative, non-numeric inputs', () => {
  reset();
  recordLatency('kit', NaN);
  recordLatency('kit', Infinity);
  recordLatency('kit', -5);
  recordLatency('kit', '10');
  recordLatency('kit', null);
  const s = snapshot();
  assert.equal(s.latency['kit'], undefined,
    'no valid sample → no latency entry');
});

test('OBS-18-02: recordLatency rejects empty/non-string tool name', () => {
  reset();
  recordLatency('', 10);
  recordLatency(null, 10);
  recordLatency(undefined, 10);
  const s = snapshot();
  assert.deepEqual(s.latency, {});
});

test('OBS-18-02: recordLatency separates samples per tool', () => {
  reset();
  recordLatency('kit', 10);
  recordLatency('kit', 20);
  recordLatency('sync', 100);
  const s = snapshot();
  assert.equal(s.latency['kit'].count, 2);
  assert.equal(s.latency['sync'].count, 1);
  assert.equal(s.latency['sync'].p50, 100, 'single-sample p50 is the sample itself');
});

test('OBS-18-02: histogram FIFO drops oldest sample at HISTOGRAM_CAP+1', () => {
  reset();
  // Push CAP+50 samples; expect length to stabilize at CAP, with oldest dropped.
  // Distinct values let us assert *which* samples remain.
  const cap = __TEST_HISTOGRAM_CAP;
  for (let i = 0; i < cap + 50; i++) {
    recordLatency('kit', i);
  }
  const s = snapshot();
  assert.equal(s.latency['kit'].count, cap,
    `length must cap at ${cap}, got ${s.latency['kit'].count}`);
  // Oldest 50 samples (0..49) were dropped; smallest remaining is 50.
  // p50 of [50..1049] is 549.5.
  assert.equal(s.latency['kit'].p50, 549.5);
});

test('OBS-18-01/02: snapshot returns plain object copy (not Map references)', () => {
  reset();
  incrementInvocation('kit', 'ok');
  recordLatency('kit', 50);
  const s = snapshot();
  // Mutating the snapshot must not corrupt internal state on subsequent reads.
  s.counters['kit:ok'] = 999;
  s.latency['kit'].p50 = -1;
  const s2 = snapshot();
  assert.equal(s2.counters['kit:ok'], 1, 'internal counters survived snapshot mutation');
  assert.equal(s2.latency['kit'].p50, 50, 'internal histogram survived snapshot mutation');
});

test('OBS-18-01/02: reset clears both counters and histograms', () => {
  incrementInvocation('kit', 'ok');
  recordLatency('kit', 50);
  reset();
  const s = snapshot();
  assert.deepEqual(s.counters, {});
  assert.deepEqual(s.latency, {});
});

test('OBS-18-01/02: snapshot of empty state returns empty objects', () => {
  reset();
  const s = snapshot();
  assert.deepEqual(s, { counters: {}, latency: {} });
});
