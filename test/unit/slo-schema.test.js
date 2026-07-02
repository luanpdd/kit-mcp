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

// ---- Phase 103 OBS-20-02 — dual-window alert_thresholds invariants ---------
//
// Plan 103-01 wires /burn-rate-status to read alert_thresholds.page (fast /
// page-tier) AND alert_thresholds.ticket (slow / ticket-tier) blocks from each
// SLO YAML. The command computes fastBurn + slowBurn independently and applies
// the canonical dual-window logic from kit/skills/burn-rate-alerting/SKILL.md
// (PAGE both / TICKET slow only / WARN fast spike / OK / no_data).
//
// These tests pin down the YAML shape the command depends on. If a future SLO
// file omits page or ticket blocks, the command would silently fall back to
// defensive defaults (14.4 / 6) — these tests force the omission to be a
// deliberate choice expressed in code rather than a quiet drift.

/**
 * Parse a YAML duration ("1h", "30m", "6h", "5m") to milliseconds. Mirrors
 * the to_ms() bash helper in burn-rate-status.md so the assertions exercise
 * the exact unit conversion the command does.
 */
function durationToMs(s) {
  const match = String(s).trim().match(/^([0-9]+)([hmsd])$/);
  if (!match) return null;
  const [, n, unit] = match;
  const num = parseInt(n, 10);
  switch (unit) {
    case 'h': return num * 3_600_000;
    case 'm': return num * 60_000;
    case 's': return num * 1_000;
    case 'd': return num * 86_400_000;
    default: return null;
  }
}

/**
 * Extract page or ticket alert_thresholds block fields from YAML text.
 * Lightweight regex parser mirroring the awk state machine in
 * burn-rate-status.md step 3.2. Returns { lookahead, baseline, multiplier }
 * or nulls when fields are absent.
 */
function extractAlertBlock(yaml, severity) {
  // Find the start of `alert_thresholds:` and slice out its block. The block
  // begins after the keyword line and continues until the next top-level key
  // (a key starting at column 0). Inside the block, page and ticket are
  // sibling keys at one indent level deeper.
  const arStart = yaml.search(/^\s+alert_thresholds:/m);
  if (arStart < 0) return { lookahead: null, baseline: null, multiplier: null };
  // Truncate at the next top-level YAML key (column-0 letter then `:`).
  const after = yaml.slice(arStart);
  const endMatch = after.slice(1).search(/^[a-z][a-z_]*:/m);
  const block = endMatch < 0 ? after : after.slice(0, endMatch + 1);

  // Slice the severity sub-block. Locate `<severity>:` keyword line, then
  // capture lines until the next sibling key (same indent as `<severity>:`)
  // or the end of the block.
  const lines = block.split(/\r?\n/);
  const sevLineIdx = lines.findIndex(l => new RegExp(`^\\s+${severity}:\\s*$`).test(l));
  if (sevLineIdx < 0) return { lookahead: null, baseline: null, multiplier: null };
  const sevIndent = lines[sevLineIdx].match(/^\s*/)[0].length;
  const sevContent = [];
  for (let i = sevLineIdx + 1; i < lines.length; i++) {
    const indent = lines[i].match(/^(\s*)\S/);
    if (indent && indent[1].length <= sevIndent && lines[i].trim().length > 0) break; // sibling key reached
    sevContent.push(lines[i]);
  }
  const sev = sevContent.join('\n');
  const grab = (k) => {
    const m = sev.match(new RegExp(`^\\s+${k}:\\s*([^\\s#]+)`, 'm'));
    return m ? m[1] : null;
  };
  return {
    lookahead: grab('lookahead'),
    baseline: grab('baseline'),
    multiplier: grab('burn_rate_multiplier'),
  };
}

test('OBS-20-02: every SLO YAML declares alert_thresholds.page block with lookahead/baseline/burn_rate_multiplier', () => {
  // The /burn-rate-status command reads each SLO file and pulls FAST_LOOKAHEAD,
  // FAST_BASELINE, FAST_MULTIPLIER from alert_thresholds.page. If any SLO
  // omits the page block or any of its three required fields, the command
  // falls through to defensive defaults — silent drift we want to forbid.
  for (const f of ['mcp-tool-availability.yml', 'mcp-tool-latency.yml']) {
    const yaml = readSlo(f);
    const page = extractAlertBlock(yaml, 'page');
    assert.ok(page.lookahead, `${f}: alert_thresholds.page.lookahead missing`);
    assert.ok(page.baseline, `${f}: alert_thresholds.page.baseline missing`);
    assert.ok(page.multiplier, `${f}: alert_thresholds.page.burn_rate_multiplier missing`);
  }
});

test('OBS-20-02: every SLO YAML declares alert_thresholds.ticket block with lookahead/baseline/burn_rate_multiplier', () => {
  // Same constraint for the slow / ticket-tier block. The command reads
  // SLOW_LOOKAHEAD, SLOW_BASELINE, SLOW_MULTIPLIER from here.
  for (const f of ['mcp-tool-availability.yml', 'mcp-tool-latency.yml']) {
    const yaml = readSlo(f);
    const ticket = extractAlertBlock(yaml, 'ticket');
    assert.ok(ticket.lookahead, `${f}: alert_thresholds.ticket.lookahead missing`);
    assert.ok(ticket.baseline, `${f}: alert_thresholds.ticket.baseline missing`);
    assert.ok(ticket.multiplier, `${f}: alert_thresholds.ticket.burn_rate_multiplier missing`);
  }
});

test('OBS-20-02: page lookahead < ticket lookahead (fast vs slow ordering invariant)', () => {
  // Skill burn-rate-alerting names the page tier "short-term" and the ticket
  // tier "long-term". The order is semantic — confusing them flips alert
  // routing (page-worthy alerts go to ticket queue and vice versa). This test
  // catches that.
  for (const f of ['mcp-tool-availability.yml', 'mcp-tool-latency.yml']) {
    const yaml = readSlo(f);
    const page = extractAlertBlock(yaml, 'page');
    const ticket = extractAlertBlock(yaml, 'ticket');
    const pageMs = durationToMs(page.lookahead);
    const ticketMs = durationToMs(ticket.lookahead);
    assert.ok(pageMs !== null, `${f}: page.lookahead "${page.lookahead}" unparseable`);
    assert.ok(ticketMs !== null, `${f}: ticket.lookahead "${ticket.lookahead}" unparseable`);
    assert.ok(pageMs < ticketMs,
      `${f}: page.lookahead (${page.lookahead}, ${pageMs}ms) must be < ticket.lookahead (${ticket.lookahead}, ${ticketMs}ms)`);
  }
});

test('OBS-20-02: page baseline < ticket baseline (fast vs slow baseline ordering)', () => {
  // Same ordering constraint applies to baseline windows. Page baseline (5m
  // canonical) catches sudden spikes; ticket baseline (30m canonical) smooths
  // out short bursts and surfaces sustained erosion.
  for (const f of ['mcp-tool-availability.yml', 'mcp-tool-latency.yml']) {
    const yaml = readSlo(f);
    const page = extractAlertBlock(yaml, 'page');
    const ticket = extractAlertBlock(yaml, 'ticket');
    const pageMs = durationToMs(page.baseline);
    const ticketMs = durationToMs(ticket.baseline);
    assert.ok(pageMs !== null, `${f}: page.baseline "${page.baseline}" unparseable`);
    assert.ok(ticketMs !== null, `${f}: ticket.baseline "${ticket.baseline}" unparseable`);
    assert.ok(pageMs < ticketMs,
      `${f}: page.baseline (${page.baseline}, ${pageMs}ms) must be < ticket.baseline (${ticket.baseline}, ${ticketMs}ms)`);
  }
});

test('OBS-20-02: standard multipliers are 14.4 (page) / 6 (ticket) per skill burn-rate-alerting canonical', () => {
  // The skill carries the 14.4 / 6 numbers verbatim from the Honeycomb /
  // Google SRE recommendation. Until a future phase tunes them against
  // measured volume, both kit-mcp SLOs must keep the canonical values. If a
  // future tuning phase changes them per-SLO, this test forces the change to
  // be deliberate (edit the test) rather than silent drift.
  for (const f of ['mcp-tool-availability.yml', 'mcp-tool-latency.yml']) {
    const yaml = readSlo(f);
    const page = extractAlertBlock(yaml, 'page');
    const ticket = extractAlertBlock(yaml, 'ticket');
    assert.equal(parseFloat(page.multiplier), 14.4,
      `${f}: page.burn_rate_multiplier must be 14.4 (canonical Google SRE; got ${page.multiplier})`);
    assert.equal(parseFloat(ticket.multiplier), 6,
      `${f}: ticket.burn_rate_multiplier must be 6 (canonical Google SRE; got ${ticket.multiplier})`);
  }
});
