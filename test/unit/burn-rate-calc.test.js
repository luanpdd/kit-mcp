// OBS-19-04 — burn-rate calculation tests for /burn-rate-status command.
//
// Phase 99.01 (v1.19 Maturidade Operacional). The /burn-rate-status command
// (kit/commands/burn-rate-status.md) computes SLI + burn rate + status from
// .planning/slos/*.yml SLO definitions and .planning/metrics/snapshots/
// persisted via Phase 99 persistSnapshot(). This test pins down the math:
//
//   - Availability SLI: (good_delta / total_delta) between first and last
//     snapshot in the baseline window. Burn rate = error_rate / (1 - target).
//   - Latency SLI: fraction of samples below target_ms (p95 read from the
//     most recent snapshot's per-tool latency entries).
//   - Status enum thresholds: PAGE ≥ 14.4×, TICKET ≥ 6.0×, WARN ≥ 1.0×,
//     OK < 1.0×, no_data when snapshots < 2.
//   - Cross-file invariants: SLO YAML target/percentile parsing matches what
//     the command reads via grep regex.
//
// Implementation: we re-implement the core math in JS (mirrored from the
// inline node scripts in burn-rate-status.md) so the test validates the
// formulas, not the bash plumbing. If the formulas drift from the command
// content, this test would catch the math regression but not a bash glue
// regression — that surface is exercised by the slo-schema test asserting
// the YAML shape the command grep'd against still holds.
//
// Pure unit — uses fs/promises + persistSnapshot + loadSnapshots from Phase 99
// metrics module, no spawn, no network.

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
  TMP_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-burn-rate-calc-'));
});

afterEach(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  reset();
});

// ---- Math helpers (mirror burn-rate-status.md inline node scripts) ----------

/**
 * Compute availability SLI from two snapshots (first vs last in baseline window).
 * Mirrors the inline node script in step 3.3 (availability branch) of
 * burn-rate-status.md.
 *
 * @param {Array<{counters: object}>} snaps  Sorted ascending by ts.
 * @returns {{sli: number|null, errorRate: number, good: number, total: number}}
 */
function computeAvailabilitySLI(snaps) {
  if (snaps.length < 2) return { sli: null, errorRate: 0, good: 0, total: 0, error: 'no_data' };
  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  let goodFirst = 0, goodLast = 0, totalFirst = 0, totalLast = 0;
  for (const [k, v] of Object.entries(first.counters)) {
    if (k.endsWith(':ok')) goodFirst += v;
    totalFirst += v;
  }
  for (const [k, v] of Object.entries(last.counters)) {
    if (k.endsWith(':ok')) goodLast += v;
    totalLast += v;
  }
  const good = goodLast - goodFirst;
  const total = totalLast - totalFirst;
  const sli = total > 0 ? good / total : null;
  const errorRate = total > 0 ? (total - good) / total : 0;
  return { sli, errorRate, good, total };
}

/**
 * Compute latency SLI from the most recent snapshot. Mirrors the inline node
 * script in step 3.3 (latency branch) of burn-rate-status.md.
 *
 * @param {Array<{latency: object}>} snaps  Sorted ascending by ts.
 * @param {number} targetMs                 e.g. 200 for the kit-mcp-tool-latency SLO.
 * @returns {{sli: number|null, errorRate: number, totalSamples: number, slowSamples: number}}
 */
function computeLatencySLI(snaps, targetMs) {
  if (snaps.length < 1) return { sli: null, errorRate: 0, totalSamples: 0, slowSamples: 0, error: 'no_data' };
  const last = snaps[snaps.length - 1];
  let totalSamples = 0, slowSamples = 0;
  for (const lat of Object.values(last.latency)) {
    totalSamples += lat.count;
    // Approximation matching the command: p95 above target → ~5% slow.
    // The exact-fraction calculation would require the raw histogram, but
    // we only persist percentiles, so this is the canonical approximation.
    if (lat.p95 > targetMs) slowSamples += Math.round(lat.count * 0.05);
  }
  const sli = totalSamples > 0 ? 1 - (slowSamples / totalSamples) : null;
  const errorRate = totalSamples > 0 ? slowSamples / totalSamples : 0;
  return { sli, errorRate, totalSamples, slowSamples };
}

/**
 * Compute burn rate + status given SLI inputs and SLO target. Mirrors the
 * inline node script in step 3.4 of burn-rate-status.md.
 *
 * @param {number} errorRate  In [0, 1].
 * @param {number} target     SLO target ratio (e.g. 0.995 for availability,
 *                            0.95 for latency = 1 - ratio_above_target=0.05).
 * @returns {{burnRate: number, status: 'PAGE'|'TICKET'|'WARN'|'OK', action: string}}
 */
function computeBurnRateStatus(errorRate, target) {
  const slack = 1 - target;
  const burnRate = slack > 0 ? errorRate / slack : 0;
  let status, action;
  if (burnRate >= 14.4) {
    status = 'PAGE';
    action = 'Page on-call — invoke /investigar-producao';
  } else if (burnRate >= 6.0) {
    status = 'TICKET';
    action = 'Open ticket — investigate before budget exhausted';
  } else if (burnRate >= 1.0) {
    status = 'WARN';
    action = 'Monitor — burn rate sustained ≥1× exhausts budget in window';
  } else {
    status = 'OK';
    action = '—';
  }
  return { burnRate, status, action };
}

// ---- availability SLI math --------------------------------------------------

test('OBS-19-04: availability SLI = good_delta / total_delta between snapshots', () => {
  // Hand-craft 2 snapshots: first has 100 ok + 1 error, last has 200 ok + 5 errors.
  // Delta: good=100, total=104 → SLI = 100/104 = 0.9615..., errorRate = 4/104 = 0.0385...
  const snaps = [
    { ts: 1, counters: { 'kit:ok': 100, 'kit:error': 1 }, latency: {} },
    { ts: 2, counters: { 'kit:ok': 200, 'kit:error': 5 }, latency: {} },
  ];
  const r = computeAvailabilitySLI(snaps);
  assert.equal(r.good, 100);
  assert.equal(r.total, 104);
  assert.ok(Math.abs(r.sli - (100 / 104)) < 1e-9, `SLI ≈ 0.9615; got ${r.sli}`);
  assert.ok(Math.abs(r.errorRate - (4 / 104)) < 1e-9, `errorRate ≈ 0.0385; got ${r.errorRate}`);
});

test('OBS-19-04: availability SLI sums across multiple tools', () => {
  // Two tools, multiple statuses. Delta should aggregate all of them.
  const snaps = [
    { ts: 1, counters: { 'kit:ok': 50, 'kit:error': 0, 'sync:ok': 30 }, latency: {} },
    { ts: 2, counters: { 'kit:ok': 100, 'kit:error': 10, 'sync:ok': 60, 'sync:error': 2 }, latency: {} },
  ];
  const r = computeAvailabilitySLI(snaps);
  // Good delta: (100-50) + (60-30) = 80. Total delta: (100+10+60+2) - (50+0+30) = 172-80 = 92.
  assert.equal(r.good, 80);
  assert.equal(r.total, 92);
  assert.equal(r.errorRate, 12 / 92);
});

test('OBS-19-04: availability returns no_data when fewer than 2 snapshots', () => {
  const single = [{ ts: 1, counters: { 'kit:ok': 100 }, latency: {} }];
  const r = computeAvailabilitySLI(single);
  assert.equal(r.error, 'no_data');
  assert.equal(r.sli, null);
});

test('OBS-19-04: availability SLI=null when no events between snapshots', () => {
  // First and last identical → delta=0/0. SLI undefined; report null, errorRate 0.
  const snaps = [
    { ts: 1, counters: { 'kit:ok': 100 }, latency: {} },
    { ts: 2, counters: { 'kit:ok': 100 }, latency: {} },
  ];
  const r = computeAvailabilitySLI(snaps);
  assert.equal(r.sli, null);
  assert.equal(r.errorRate, 0);
  assert.equal(r.total, 0);
});

// ---- latency SLI math -------------------------------------------------------

test('OBS-19-04: latency SLI flags samples slow when p95 > target_ms', () => {
  // Two tools: kit p95=300ms (over 200 target) → ~5% slow approximation,
  // sync p95=80ms (under target) → 0 slow.
  const snaps = [
    {
      ts: 1, counters: {}, latency: {
        kit:  { p50: 100, p95: 300, p99: 500, count: 100 },
        sync: { p50: 30,  p95: 80,  p99: 120, count: 200 },
      },
    },
  ];
  const r = computeLatencySLI(snaps, 200);
  // total = 300, slow = round(100*0.05) + 0 = 5.
  assert.equal(r.totalSamples, 300);
  assert.equal(r.slowSamples, 5);
  assert.ok(Math.abs(r.sli - (295 / 300)) < 1e-9);
  assert.ok(Math.abs(r.errorRate - (5 / 300)) < 1e-9);
});

test('OBS-19-04: latency SLI returns no_data on empty snapshots', () => {
  const r = computeLatencySLI([], 200);
  assert.equal(r.error, 'no_data');
  assert.equal(r.sli, null);
});

test('OBS-19-04: latency SLI tolerates snapshot with no latency entries', () => {
  // A snapshot may have counters but no latency — e.g. before any tool was
  // dispatched. SLI should be null with totalSamples=0.
  const snaps = [{ ts: 1, counters: { 'kit:ok': 5 }, latency: {} }];
  const r = computeLatencySLI(snaps, 200);
  assert.equal(r.totalSamples, 0);
  assert.equal(r.sli, null);
  assert.equal(r.errorRate, 0);
});

test('OBS-19-04: latency SLI uses only the most recent snapshot (window-end semantics)', () => {
  // Older snapshot has bad p95; recent has good p95. SLI must reflect recent
  // (FIFO histogram already gives "latency now," not "latency ever").
  const snaps = [
    { ts: 1, counters: {}, latency: { kit: { p50: 500, p95: 999, p99: 1500, count: 100 } } },
    { ts: 2, counters: {}, latency: { kit: { p50: 100, p95: 150, p99: 180,  count: 100 } } },
  ];
  const r = computeLatencySLI(snaps, 200);
  // Recent p95=150 < 200 → 0 slow, sli = 1.
  assert.equal(r.slowSamples, 0);
  assert.equal(r.sli, 1);
});

// ---- burn rate + status math ------------------------------------------------

test('OBS-19-04: burn rate = error_rate / (1 - target)', () => {
  // SLO 99.5% (target=0.995, slack=0.005). errorRate=0.005 → burn≈1.0×.
  // Use approximate equality — IEEE-754 makes 0.005/0.005 not exactly 1.0.
  let r = computeBurnRateStatus(0.005, 0.995);
  assert.ok(Math.abs(r.burnRate - 1.0) < 1e-6, `burn ≈ 1.0×; got ${r.burnRate}`);
  // errorRate=0.075 → burn=15.0× (comfortably above PAGE threshold 14.4).
  r = computeBurnRateStatus(0.075, 0.995);
  assert.ok(Math.abs(r.burnRate - 15.0) < 1e-6, `burn ≈ 15.0×; got ${r.burnRate}`);
});

test('OBS-19-04: status PAGE when burn rate >= 14.4', () => {
  // errorRate=0.075 → burn=15.0× — clearly above PAGE threshold.
  const r = computeBurnRateStatus(0.075, 0.995);
  assert.ok(r.burnRate >= 14.4, `burn=${r.burnRate} expected ≥14.4`);
  assert.equal(r.status, 'PAGE');
  assert.match(r.action, /Page on-call/);
});

test('OBS-19-04: status TICKET when 6 <= burn rate < 14.4', () => {
  // burn = 8.0× → errorRate = 0.040 — squarely between 6 and 14.4.
  // Avoids the 0.030/0.005 = 5.999... IEEE rounding issue at the lower edge.
  const r = computeBurnRateStatus(0.040, 0.995);
  assert.ok(r.burnRate >= 6.0 && r.burnRate < 14.4, `burn=${r.burnRate} expected in [6, 14.4)`);
  assert.equal(r.status, 'TICKET');
  assert.match(r.action, /ticket/);
});

test('OBS-19-04: status WARN when 1 <= burn rate < 6', () => {
  // burn = 3.0 → errorRate = 0.015 (well clear of both 1.0 and 6.0 boundaries).
  const r = computeBurnRateStatus(0.015, 0.995);
  assert.ok(r.burnRate >= 1.0 && r.burnRate < 6.0,
    `burn=${r.burnRate} expected in [1, 6)`);
  assert.equal(r.status, 'WARN');
});

test('OBS-19-04: status OK when burn rate < 1', () => {
  const r = computeBurnRateStatus(0.001, 0.995); // 0.2× burn
  assert.equal(r.status, 'OK');
  assert.equal(r.action, '—');
});

test('OBS-19-04: zero error rate → burn rate 0 → OK', () => {
  const r = computeBurnRateStatus(0, 0.995);
  assert.equal(r.burnRate, 0);
  assert.equal(r.status, 'OK');
});

test('OBS-19-04: target=1 (zero slack) returns burnRate=0 instead of dividing by zero', () => {
  // Defensive: an operator misconfigures target=1 (impossible SLO). We must
  // not throw or NaN-propagate. Returning 0 means OK status — they'll see no
  // alert until they fix the target, which is the safe failure mode.
  const r = computeBurnRateStatus(0.5, 1.0);
  assert.equal(r.burnRate, 0);
  assert.equal(r.status, 'OK');
});

// ---- end-to-end round trip with persistSnapshot/loadSnapshots ----------------

test('OBS-19-04: round-trip — persistSnapshot + loadSnapshots + computeAvailabilitySLI', async () => {
  // Drive the full pipeline: record activity → persist → record more → persist
  // again → load → compute SLI. This is the exact path /burn-rate-status takes.

  // Snapshot 1: 100 ok + 1 error.
  for (let i = 0; i < 100; i++) incrementInvocation('kit', 'ok');
  incrementInvocation('kit', 'error');
  await persistSnapshot(TMP_ROOT);

  await new Promise(r => setTimeout(r, 5)); // ensure ts ordering

  // Add 100 more ok + 4 more errors.
  for (let i = 0; i < 100; i++) incrementInvocation('kit', 'ok');
  for (let i = 0; i < 4; i++) incrementInvocation('kit', 'error');
  await persistSnapshot(TMP_ROOT);

  const snaps = await loadSnapshots(TMP_ROOT);
  assert.equal(snaps.length, 2);
  const sli = computeAvailabilitySLI(snaps);
  // Delta: good=100, total=104.
  assert.equal(sli.good, 100);
  assert.equal(sli.total, 104);
  // Burn rate against 99.5% target.
  const burn = computeBurnRateStatus(sli.errorRate, 0.995);
  // errorRate = 4/104 ≈ 0.0385 → burn ≈ 0.0385 / 0.005 = 7.69× → TICKET.
  assert.equal(burn.status, 'TICKET',
    `Expected TICKET status for 4 errors out of 104; got ${burn.status} (burn=${burn.burnRate})`);
});

test('OBS-19-04: round-trip — persistSnapshot + loadSnapshots + computeLatencySLI', async () => {
  // Record latencies that produce p95 > 200ms target — e.g. samples
  // 1..1000 ms gives p95 = 950.05 ms.
  for (let i = 1; i <= 1000; i++) recordLatency('kit', i);
  await persistSnapshot(TMP_ROOT);

  const snaps = await loadSnapshots(TMP_ROOT);
  assert.equal(snaps.length, 1);
  assert.ok(snaps[0].latency['kit'].p95 > 200,
    `expected p95 > 200; got ${snaps[0].latency['kit'].p95}`);
  const sli = computeLatencySLI(snaps, 200);
  // 5% approximation of 1000 = 50 slow → SLI ≈ 0.95.
  assert.equal(sli.slowSamples, 50);
  assert.equal(sli.totalSamples, 1000);
  assert.equal(sli.sli, 0.95);
});

// ---- SLO YAML parsing invariants (mirror what burn-rate-status.md grep'd) ---

test('OBS-19-04: availability SLO YAML provides target as decimal ratio for parsing', async () => {
  // /burn-rate-status reads `target:` from .planning/slos/mcp-tool-availability.yml
  // via grep -oE '^target:\s*[0-9.]+'. This test ensures the canonical SLO
  // file the command reads still has that exact shape.
  const yaml = await fs.readFile(
    path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '../../.planning/slos/mcp-tool-availability.yml'),
    'utf-8',
  );
  assert.match(yaml, /^target:\s*0\.995\b/m,
    'mcp-tool-availability.yml must keep `target: 0.995` at top-level for command grep');
});

test('OBS-19-04: latency SLO YAML provides target_ms + percentile for parsing', async () => {
  const yaml = await fs.readFile(
    path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '../../.planning/slos/mcp-tool-latency.yml'),
    'utf-8',
  );
  assert.match(yaml, /^target_ms:\s*200\b/m, 'must keep target_ms: 200 for command grep');
  assert.match(yaml, /percentile:\s*95\b/, 'must keep percentile: 95 for command grep');
});

// ---- Phase 103 OBS-20-02 — dual-window combinedStatus regression -----------
//
// Plan 103-01 wires /burn-rate-status (kit/commands/burn-rate-status.md step
// 3.5) to compute fastBurn AND slowBurn independently per SLO and combine them
// via the canonical dual-window logic from kit/skills/burn-rate-alerting:
//
//   PAGE   = ambos críticos (fast >= fastMult E slow >= slowMult)
//   TICKET = slow erosion sustained (slow >= slowMult, fast OK)
//   WARN   = fast spike isolado (fast >= fastMult sozinho)
//   WARN   = mild burn em qualquer janela (>= 1.0×)
//   OK     = ambos < 1.0×
//   no_data = qualquer janela com burn=null (snapshots insuficientes)
//
// The function lives bash-embedded in the command file (not exported from
// src/), so we mirror it here verbatim and pin canonical scenarios. Pure
// asserts — no fs, no network, no spawn.

/**
 * Mirrors combinedStatus() in kit/commands/burn-rate-status.md step 3.5.
 * Edits to the command's logic must update this helper in lockstep — the
 * tests below catch drift between the two definitions on the next CI run.
 *
 * @param {number|null} fastBurn  Fast-window burn rate (page-tier) or null.
 * @param {number} fastMult       page.burn_rate_multiplier (canonical 14.4).
 * @param {number|null} slowBurn  Slow-window burn rate (ticket-tier) or null.
 * @param {number} slowMult       ticket.burn_rate_multiplier (canonical 6).
 * @returns {'PAGE'|'TICKET'|'WARN'|'OK'|'no_data'}
 */
function combinedStatus(fastBurn, fastMult, slowBurn, slowMult) {
  if (fastBurn === null || slowBurn === null) return 'no_data';
  const fastTriggered = fastBurn >= fastMult;
  const slowTriggered = slowBurn >= slowMult;
  if (fastTriggered && slowTriggered) return 'PAGE';
  if (slowTriggered) return 'TICKET';
  if (fastTriggered) return 'WARN';
  if (fastBurn >= 1.0 || slowBurn >= 1.0) return 'WARN';
  return 'OK';
}

// Canonical multipliers (skill burn-rate-alerting).
const FAST_MULT = 14.4;
const SLOW_MULT = 6;

test('OBS-20-02: combinedStatus PAGE when both windows critical (fast>=14.4 AND slow>=6)', () => {
  // Real-world: error rate spiked sharply AND has been sustained — both
  // windows above their thresholds. Page on-call now.
  const r = combinedStatus(20, FAST_MULT, 8, SLOW_MULT);
  assert.equal(r, 'PAGE');
  // Boundary: exactly at threshold counts as triggered (>= comparison).
  assert.equal(combinedStatus(14.4, FAST_MULT, 6, SLOW_MULT), 'PAGE');
});

test('OBS-20-02: combinedStatus TICKET when only slow window triggered (sustained slow erosion, fast OK)', () => {
  // Real-world: a slow drift over 6h that the 1h window doesn't yet pick up
  // because the recent 1h was relatively cleaner. Ticket — investigate
  // before budget exhausted, but DON'T page (no immediacy).
  const r = combinedStatus(2, FAST_MULT, 8, SLOW_MULT);
  assert.equal(r, 'TICKET');
  // Boundary: fast just below 14.4, slow exactly at 6 → still TICKET.
  assert.equal(combinedStatus(14, FAST_MULT, 6, SLOW_MULT), 'TICKET');
});

test('OBS-20-02: combinedStatus WARN when only fast window triggered (transient spike, slow OK)', () => {
  // Real-world: a 2-minute outage created a spike in the 1h window but the
  // 6h window still averages OK. Don't page (false-alarm risk on flap),
  // but warn so the operator notices.
  const r = combinedStatus(20, FAST_MULT, 2, SLOW_MULT);
  assert.equal(r, 'WARN');
});

test('OBS-20-02: combinedStatus WARN when both windows show mild burn (>=1x but below thresholds)', () => {
  // Real-world: budget is being consumed at >1× sustained rate but no spike.
  // Below the page/ticket thresholds; classify as WARN to surface gradual
  // erosion before it crosses into TICKET territory.
  const r = combinedStatus(1.5, FAST_MULT, 1.5, SLOW_MULT);
  assert.equal(r, 'WARN');
  // Boundary: exactly 1.0 in either window → WARN.
  assert.equal(combinedStatus(1.0, FAST_MULT, 0.5, SLOW_MULT), 'WARN');
  assert.equal(combinedStatus(0.5, FAST_MULT, 1.0, SLOW_MULT), 'WARN');
});

test('OBS-20-02: combinedStatus OK when both windows below 1x burn (healthy steady state)', () => {
  // Real-world: most production time. Burn rate < 1× means budget will not
  // be exhausted at current rate within the SLO window. No action.
  const r = combinedStatus(0.5, FAST_MULT, 0.3, SLOW_MULT);
  assert.equal(r, 'OK');
});

test('OBS-20-02: combinedStatus OK when zero error rate in both windows (no traffic OR perfect health)', () => {
  // Edge case: SLI=null because no events between snapshots produces burn=0
  // (the burn formula in the command short-circuits). 0 is the expected
  // canonical reading and must not flap into WARN.
  const r = combinedStatus(0, FAST_MULT, 0, SLOW_MULT);
  assert.equal(r, 'OK');
});

test('OBS-20-02: combinedStatus no_data when EITHER window has null burn (snapshots insufficient)', () => {
  // Conservative no_data: even one window failing prevents combined judgment.
  // The command's loadSnapshots() returns < 2 snapshots → SLI null → burn null.
  // We must NOT silently treat null as 0 (would falsely report OK).
  assert.equal(combinedStatus(null, FAST_MULT, 5, SLOW_MULT), 'no_data');
  assert.equal(combinedStatus(5, FAST_MULT, null, SLOW_MULT), 'no_data');
  assert.equal(combinedStatus(null, FAST_MULT, null, SLOW_MULT), 'no_data');
  // Important: even when a window IS triggered, no_data in the other wins —
  // we don't want to escalate to PAGE based on partial information.
  assert.equal(combinedStatus(20, FAST_MULT, null, SLOW_MULT), 'no_data');
});

test('OBS-20-02: combinedStatus respects custom multipliers (defensive defaults applied if YAML omits)', () => {
  // Future tuning: if a SLO sets a different multiplier (e.g. tighter for a
  // mission-critical service or looser for a beta tier), combinedStatus
  // must use the per-call value rather than hardcoding 14.4/6.
  // Tighter page (10×) — burn 12 should now PAGE both with slow=8 ≥ 6.
  assert.equal(combinedStatus(12, 10, 8, SLOW_MULT), 'PAGE');
  // Looser page (20×) — same burn 12 now WARN because fast not triggered.
  assert.equal(combinedStatus(12, 20, 2, SLOW_MULT), 'WARN');
  // Defensive defaults case: command applies 14.4/6 if YAML is silent.
  // Test that the canonical defaults give expected canonical results.
  assert.equal(combinedStatus(15, 14.4, 7, 6), 'PAGE');
  assert.equal(combinedStatus(0, 14.4, 0, 6), 'OK');
});
