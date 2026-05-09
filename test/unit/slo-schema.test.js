// OBS-18-03 / OBS-18-04 — schema regression tests for .planning/slos/*.yml.
//
// Phase 95.01 (v1.18 — Eat Your Own Dog Food). The SLO files are consumed by
// the /burn-rate-status command and any downstream alerting tooling. They MUST
// keep a stable shape: a top-level `slo:` block with name + service + owner,
// an `sli:` block with type/source, a target, a window, an `error_budget`
// block with alert_thresholds for page + ticket. If a future edit accidentally
// drops a key, alerting downstream silently breaks; this test catches it.
//
// Implementation note: kit-mcp's dep budget is 3 deps + 3 optional (see Phase
// 92.01), and adding `js-yaml` for two trivial schema checks would burn it.
// Instead we read the file as text and assert with multiline regex on the keys
// that tooling depends on. The regex set is the contract — anything beyond
// that (comments, formatting, key order) is free to move.
//
// Pure unit — no fs writes, no spawn, no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLOS_DIR = path.resolve(__dirname, '../../.planning/slos');

function readSlo(name) {
  return readFileSync(path.join(SLOS_DIR, name), 'utf-8');
}

// ---- mcp-tool-availability.yml ----------------------------------------------

test('OBS-18-03: mcp-tool-availability.yml has slo block with name + service + owner', () => {
  const yaml = readSlo('mcp-tool-availability.yml');
  // Keys must appear at the start of a line (top-level or nested under slo:).
  // We assert the canonical 3-key shape rather than any specific value so
  // future tuning of the description/owner doesn't break the test.
  assert.match(yaml, /^slo:/m, 'top-level "slo:" block missing');
  assert.match(yaml, /^\s+name:\s*mcp-tool-availability\b/m, 'slo.name must be mcp-tool-availability');
  assert.match(yaml, /^\s+service:\s*kit-mcp\b/m, 'slo.service must be kit-mcp');
  assert.match(yaml, /^\s+owner:\s*\S+/m, 'slo.owner must be present (skill: SLO without owner = no action)');
});

test('OBS-18-03: mcp-tool-availability.yml has sli block declaring event-based source', () => {
  const yaml = readSlo('mcp-tool-availability.yml');
  assert.match(yaml, /^sli:/m, 'top-level "sli:" block missing');
  assert.match(yaml, /^\s+type:\s*event-based\b/m,
    'sli.type must be event-based (skill rule — never time-based)');
  assert.match(yaml, /event_source:.*src\/core\/metrics\.js/,
    'sli.event_source must point to the Phase 94.01 metrics module');
  assert.match(yaml, /good_events:/, 'sli.good_events expression missing');
  assert.match(yaml, /total_events:/, 'sli.total_events expression missing');
});

test('OBS-18-03: mcp-tool-availability.yml has target 0.995 and 30d sliding window', () => {
  const yaml = readSlo('mcp-tool-availability.yml');
  assert.match(yaml, /^target:\s*0\.995\b/m,
    'target must be 0.995 (99.5%) per CONTEXT.md');
  assert.match(yaml, /^window:\s*30d_sliding\b/m,
    'window must be 30d_sliding (skill rule — never fixed/calendar)');
});

test('OBS-18-03: mcp-tool-availability.yml has error_budget with page + ticket alert thresholds', () => {
  const yaml = readSlo('mcp-tool-availability.yml');
  assert.match(yaml, /^error_budget:/m, 'top-level "error_budget:" block missing');
  // Both severity entries must exist as YAML keys (key followed by colon at
  // start of an indented line). The naive `\bpage:\b` matches nothing because
  // `:` is non-word so the trailing `\b` demands a word char that isn't there.
  assert.match(yaml, /^\s+page:\s*$/m, 'page alert tier missing');
  assert.match(yaml, /^\s+ticket:\s*$/m, 'ticket alert tier missing');
  assert.match(yaml, /burn_rate_multiplier:\s*14\.4\b/,
    'page burn_rate_multiplier must be 14.4 (canonical Google SRE)');
  // `(?!\d)` anchors the literal 6 — without it `6` would also match `60` etc.
  assert.match(yaml, /burn_rate_multiplier:\s*6(?!\d)/,
    'ticket burn_rate_multiplier must be 6 (canonical Google SRE)');
});

// ---- mcp-tool-latency.yml ---------------------------------------------------

test('OBS-18-04: mcp-tool-latency.yml has slo block with name + service + owner', () => {
  const yaml = readSlo('mcp-tool-latency.yml');
  assert.match(yaml, /^slo:/m, 'top-level "slo:" block missing');
  assert.match(yaml, /^\s+name:\s*mcp-tool-latency\b/m, 'slo.name must be mcp-tool-latency');
  assert.match(yaml, /^\s+service:\s*kit-mcp\b/m, 'slo.service must be kit-mcp');
  assert.match(yaml, /^\s+owner:\s*\S+/m, 'slo.owner must be present');
});

test('OBS-18-04: mcp-tool-latency.yml has sli block declaring percentile=95 over histograms', () => {
  const yaml = readSlo('mcp-tool-latency.yml');
  assert.match(yaml, /^sli:/m, 'top-level "sli:" block missing');
  assert.match(yaml, /^\s+type:\s*percentile\b/m, 'sli.type must be percentile');
  assert.match(yaml, /source:.*src\/core\/metrics\.js/,
    'sli.source must point to the Phase 94.01 metrics module');
  assert.match(yaml, /percentile:\s*95\b/,
    'sli.percentile must be 95 (CONTEXT.md — p99 deferred until log-to-disk in v1.19+)');
});

test('OBS-18-04: mcp-tool-latency.yml has target_ms 200 and 30d sliding window', () => {
  const yaml = readSlo('mcp-tool-latency.yml');
  assert.match(yaml, /^target_ms:\s*200\b/m,
    'target_ms must be 200 per CONTEXT.md');
  assert.match(yaml, /^window:\s*30d_sliding\b/m,
    'window must be 30d_sliding (skill rule)');
});

test('OBS-18-04: mcp-tool-latency.yml has error_budget with page + ticket alert thresholds', () => {
  const yaml = readSlo('mcp-tool-latency.yml');
  assert.match(yaml, /^error_budget:/m, 'top-level "error_budget:" block missing');
  assert.match(yaml, /^\s+page:\s*$/m, 'page alert tier missing');
  assert.match(yaml, /^\s+ticket:\s*$/m, 'ticket alert tier missing');
  // Latency SLO uses the same canonical multipliers as the availability SLO
  // until measured kit-mcp volume justifies tuning (see comment in the YAML).
  assert.match(yaml, /burn_rate_multiplier:\s*14\.4\b/);
  assert.match(yaml, /burn_rate_multiplier:\s*6(?!\d)/);
});

// ---- cross-file invariants --------------------------------------------------

test('OBS-18-03/04: both SLO files reference src/core/metrics.js (Phase 94.01)', () => {
  // The whole point of v1.18 dog-food is wiring SLOs to the metrics module
  // shipped by Phase 94.01. If a future edit untethers an SLO from its source,
  // the consumer (/burn-rate-status) would have no SLI to read.
  const avail = readSlo('mcp-tool-availability.yml');
  const lat = readSlo('mcp-tool-latency.yml');
  assert.match(avail, /src\/core\/metrics\.js/,
    'availability SLO must reference src/core/metrics.js');
  assert.match(lat, /src\/core\/metrics\.js/,
    'latency SLO must reference src/core/metrics.js');
});

test('OBS-18-03/04: both SLO files have a 30d sliding window (skill rule)', () => {
  // The event-based-slos skill is explicit: fixed/calendar windows are a
  // behavioral hazard. This test would fire if someone edits a SLO to use
  // a 30d_fixed or month/quarter window.
  const avail = readSlo('mcp-tool-availability.yml');
  const lat = readSlo('mcp-tool-latency.yml');
  assert.match(avail, /^window:\s*30d_sliding\b/m);
  assert.match(lat, /^window:\s*30d_sliding\b/m);
});
