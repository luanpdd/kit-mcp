// OPS-18-01 / OPS-18-02 / OPS-18-03 — shape regression for .planning/RUNBOOK.md,
// .planning/FAILURE-MODES.md, .planning/BENCHMARK.md.
//
// Phase 96.01 (v1.18 — Eat Your Own Dog Food). The 3 docs are entry points for
// maintainers triaging incidents and for future readers asking "is this slow?"
// or "what can break?". They must keep a stable shape so cross-references from
// SUMMARY.md, RUNBOOK quick-triage, and the SLO docs don't bit-rot.
//
// Why "integration", not "unit": the test reaches across the repo into
// .planning/ which is sibling to test/ — same pattern as
// test/integration/ci-coverage-gate.test.js (reads .github/workflows/ci.yml).
// No spawn, no network — but still off the unit-test island of pure src/.
//
// Same dependency-budget trade-off as Phase 95.01 slo-schema.test.js: regex on
// text, not a markdown AST parser. The regex set IS the contract; the docs are
// free to add prose, examples, and tables anywhere as long as the headings and
// cross-refs we assert here remain.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANNING_DIR = path.resolve(__dirname, '../../.planning');

function readDoc(name) {
  const p = path.join(PLANNING_DIR, name);
  if (!existsSync(p)) throw new Error(`expected doc missing: ${p}`);
  return readFileSync(p, 'utf-8');
}

// ---- existence sanity ------------------------------------------------------

test('OPS-18: all three operations docs exist in .planning/', () => {
  for (const name of ['RUNBOOK.md', 'FAILURE-MODES.md', 'BENCHMARK.md']) {
    const p = path.join(PLANNING_DIR, name);
    assert.ok(existsSync(p), `expected .planning/${name} to exist`);
  }
});

// ---- RUNBOOK.md -------------------------------------------------------------

test('OPS-18-01: RUNBOOK.md has Symptom/Diagnosis/Fix structure across multiple scenarios', () => {
  const md = readDoc('RUNBOOK.md');
  // 5 scenarios are required by the phase contract — assert at least 5.
  const symptomCount = (md.match(/^\*\*Symptom\*\*$/gm) || []).length;
  const diagnosisCount = (md.match(/^\*\*Diagnosis\*\*$/gm) || []).length;
  const fixCount = (md.match(/^\*\*Fix\*\*$/gm) || []).length;
  assert.ok(symptomCount >= 5,
    `RUNBOOK must have >=5 "Symptom" sections (got ${symptomCount})`);
  assert.ok(diagnosisCount >= 5,
    `RUNBOOK must have >=5 "Diagnosis" sections (got ${diagnosisCount})`);
  assert.ok(fixCount >= 5,
    `RUNBOOK must have >=5 "Fix" sections (got ${fixCount})`);
});

test('OPS-18-01: RUNBOOK.md covers the 5 canonical scenarios', () => {
  const md = readDoc('RUNBOOK.md');
  // Each scenario has a numbered H2 (## 1. / ## 2. / ...). Assert headings
  // by the keywords from the phase CONTEXT.md so a rename doesn't silently
  // drop a scenario.
  assert.match(md, /^##\s+1\.\s+MCP server boot fail/m, 'scenario 1 missing or renamed');
  assert.match(md, /^##\s+2\.\s+Sidecar UI hang/m, 'scenario 2 missing or renamed');
  assert.match(md, /^##\s+3\.\s+Manifest mismatch/m, 'scenario 3 missing or renamed');
  assert.match(md, /^##\s+4\.\s+npm publish workflow fail/m, 'scenario 4 missing or renamed');
  assert.match(md, /^##\s+5\.\s+Sync corruption/m, 'scenario 5 missing or renamed');
});

test('OPS-18-01: RUNBOOK.md cross-refs SLOs and the metrics-snapshot tool', () => {
  const md = readDoc('RUNBOOK.md');
  // "is the service degraded" question routes through the SLO files; the
  // RUNBOOK must point at them or the operator never finds the SLI.
  assert.match(md, /SLO/, 'RUNBOOK must mention SLO (degradation check)');
  assert.match(md, /\.planning\/slos\//,
    'RUNBOOK must link to .planning/slos/ (cross-ref to Phase 95)');
  assert.match(md, /metrics-snapshot/,
    'RUNBOOK must mention the metrics-snapshot MCP tool (cross-ref to Phase 94)');
});

// ---- FAILURE-MODES.md -------------------------------------------------------

test('OPS-18-02: FAILURE-MODES.md has a matrix with at least 8 entries', () => {
  const md = readDoc('FAILURE-MODES.md');
  // Matrix rows are pipe-delimited table lines that start with "| <number> |".
  // The header and separator do NOT match (header has " # " not " 1 ").
  const dataRows = md.match(/^\|\s*\d+\s*\|/gm) || [];
  assert.ok(dataRows.length >= 8,
    `FAILURE-MODES must have >=8 numbered matrix rows (got ${dataRows.length})`);
});

test('OPS-18-02: FAILURE-MODES.md matrix carries impact + likelihood columns', () => {
  const md = readDoc('FAILURE-MODES.md');
  // The header row carries the column names; assert the canonical schema.
  assert.match(md, /\|\s*Impact\s*\|/, 'matrix must have Impact column');
  assert.match(md, /\|\s*Likelihood\s*\|/, 'matrix must have Likelihood column');
  assert.match(md, /\|\s*Current mitigation\s*\|/, 'matrix must have Current mitigation column');
});

test('OPS-18-02: FAILURE-MODES.md cross-refs RUNBOOK + skills', () => {
  const md = readDoc('FAILURE-MODES.md');
  // Cross-refs are part of the contract: RUNBOOK is the response, this catalog
  // is the cause. Skill links anchor the methodology.
  assert.match(md, /RUNBOOK/, 'FAILURE-MODES must cross-ref RUNBOOK');
  assert.match(md, /production-readiness-review/,
    'FAILURE-MODES must reference production-readiness-review skill');
  assert.match(md, /blameless-postmortems/,
    'FAILURE-MODES must reference blameless-postmortems skill');
});

// ---- BENCHMARK.md -----------------------------------------------------------

test('OPS-18-03: BENCHMARK.md has at least 5 baseline metrics with reproduction commands', () => {
  const md = readDoc('BENCHMARK.md');
  // Each metric is an H3 like "### M1 — ..." through "### M5 — ...".
  const metricHeaders = md.match(/^###\s+M\d+\s+[—-]\s+/gm) || [];
  assert.ok(metricHeaders.length >= 5,
    `BENCHMARK must have >=5 baseline metrics (got ${metricHeaders.length})`);
  // Reproducibility is the whole point — each metric block has a code fence.
  // Assert at least 5 fenced code blocks (one per metric reproduction).
  const codeFences = md.match(/^```/gm) || [];
  assert.ok(codeFences.length >= 10,
    `BENCHMARK must have >=10 code fence markers (i.e. >=5 fenced blocks) — got ${codeFences.length}`);
});

test('OPS-18-03: BENCHMARK.md carries timestamp + version on the reference machine', () => {
  const md = readDoc('BENCHMARK.md');
  // Date format YYYY-MM-DD (we use the doc's "Last refreshed" + reference machine).
  assert.match(md, /\b20\d{2}-\d{2}-\d{2}\b/, 'BENCHMARK must include an ISO-ish date');
  // The reference machine block must declare the kit-mcp version it measured.
  assert.match(md, /kit-mcp\s+version[\s\S]*?1\.\d+\.\d+/i,
    'BENCHMARK must declare the kit-mcp version it measured');
});

test('OPS-18-03: BENCHMARK.md cross-refs the metrics-snapshot path and the latency SLO', () => {
  const md = readDoc('BENCHMARK.md');
  // The latency probe explicitly relies on the metrics module + snapshot tool.
  assert.match(md, /src\/core\/metrics\.js/,
    'BENCHMARK must point at src/core/metrics.js (M4 source)');
  assert.match(md, /metrics-snapshot/,
    'BENCHMARK must mention the metrics-snapshot tool (M4 reproduction)');
  // The latency SLO target (200ms p95) is sized against this baseline; the
  // cross-ref protects against either side drifting silently.
  assert.match(md, /mcp-tool-latency\.yml/,
    'BENCHMARK must cross-ref slos/mcp-tool-latency.yml');
});

// ---- cross-doc invariants ---------------------------------------------------

test('OPS-18: each ops doc cross-references at least one of the others', () => {
  // The triad RUNBOOK + FAILURE-MODES + BENCHMARK is meant to be navigated
  // hand-to-hand. If any doc becomes an island, the triage path breaks.
  const runbook = readDoc('RUNBOOK.md');
  const failure = readDoc('FAILURE-MODES.md');
  const bench = readDoc('BENCHMARK.md');

  assert.ok(runbook.includes('FAILURE-MODES.md') || runbook.includes('BENCHMARK.md'),
    'RUNBOOK must cross-ref FAILURE-MODES or BENCHMARK');
  assert.ok(failure.includes('RUNBOOK.md') && failure.includes('BENCHMARK.md'),
    'FAILURE-MODES must cross-ref both RUNBOOK and BENCHMARK');
  assert.ok(bench.includes('FAILURE-MODES.md') || bench.includes('slos'),
    'BENCHMARK must cross-ref FAILURE-MODES or the SLOs');
});
