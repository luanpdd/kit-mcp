// INFRA-17-02: regression test for the CI line coverage threshold gate.
//
// Phase 93 added a `node --experimental-test-coverage` step that fails CI
// when line coverage drops below threshold. The step must:
//   1. exist in the smoke job
//   2. be gated to a SINGLE matrix cell (Linux + Node 22 + claude-code) so
//      coverage runs once, not 72× across the os×node×target matrix
//   3. parse the "all files" footer row from the node:test reporter
//   4. compare against a numeric THRESHOLD
//
// We validate via text-regex on the workflow file (same pattern as
// ci-deps-gate.test.js — kit-mcp's 6-dep budget keeps `yaml` out of scope).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CI_YAML_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');

async function readCiYaml() {
  return await readFile(CI_YAML_PATH, 'utf8');
}

test('INFRA-17-02: coverage step exists and is tagged with REQ id', async () => {
  const yaml = await readCiYaml();
  assert.match(
    yaml,
    /name:\s*Audit\s+—\s*line coverage threshold.*INFRA-17-02/i,
    'CI must contain a coverage step tagged with REQ INFRA-17-02',
  );
});

test('INFRA-17-02: coverage step uses node --experimental-test-coverage', async () => {
  const yaml = await readCiYaml();
  // The step must invoke the built-in coverage flag (not c8 / nyc — those would
  // add deps and v1.17's 6-dep budget rules them out).
  assert.match(
    yaml,
    /node\s+--experimental-test-coverage\s+--test\s+test\/unit/,
    'coverage step must run unit tests under node --experimental-test-coverage',
  );
});

test('INFRA-17-02: coverage step is gated to a single matrix cell', async () => {
  const yaml = await readCiYaml();
  // Matrix is os × node × target = 3×3×8 = 72 cells. Coverage % is identical
  // across cells; running 72× would be wasteful and would also slow CI.
  // The if: gate must restrict to ubuntu-latest + node 22 + claude-code.
  //
  // We assert each pin appears in the same `if:` clause at least once — robust
  // to whitespace and ordering of the && chain.
  const stepBlock = extractCoverageStepBlock(yaml);
  assert.match(stepBlock, /if:\s*[^\n]*matrix\.os\s*==\s*'ubuntu-latest'/);
  assert.match(stepBlock, /if:\s*[^\n]*matrix\.node\s*==\s*'22'/);
  assert.match(stepBlock, /if:\s*[^\n]*matrix\.target\s*==\s*'claude-code'/);
});

test('INFRA-17-02: coverage step parses "all files" footer and compares to THRESHOLD', async () => {
  const yaml = await readCiYaml();
  const stepBlock = extractCoverageStepBlock(yaml);
  // Parse markers — these are the load-bearing pieces of the gate.
  // 1. THRESHOLD is set as an integer literal so the gate has a concrete bar
  //    that PR diffs surface (sneaky lowering would require visible edit).
  assert.match(
    stepBlock,
    /THRESHOLD=\d+/,
    'coverage step must declare THRESHOLD as an integer literal',
  );
  // 2. Reads the "all files" line from the coverage report.
  assert.match(
    stepBlock,
    /grep\s+["'][^"']*all files["']/,
    'coverage step must grep "all files" from the coverage report',
  );
  // 3. Compares LINE_INT (the parsed integer) against THRESHOLD. Bash test
  //    syntax: [ "$LINE_INT" -lt "$THRESHOLD" ] — brackets separated from
  //    operands by whitespace, optional quotes around variables.
  assert.match(
    stepBlock,
    /\[\s+"?\$LINE_INT"?\s+-lt\s+"?\$THRESHOLD"?\s+\]/,
    'coverage step must compare $LINE_INT < $THRESHOLD',
  );
});

test('INFRA-17-02: coverage threshold is in a sane range (50..100)', async () => {
  const yaml = await readCiYaml();
  const stepBlock = extractCoverageStepBlock(yaml);
  const m = stepBlock.match(/THRESHOLD=(\d+)/);
  assert.ok(m, 'must declare THRESHOLD');
  const t = Number(m[1]);
  assert.ok(t >= 50 && t <= 100, `THRESHOLD=${t} outside sane range [50..100]`);
});

// --- helpers ---

/**
 * Extract just the "Audit — line coverage threshold" step block from the YAML
 * file. Keeps assertions scoped to that step rather than matching anywhere in
 * the workflow (avoids false positives if other steps coincidentally contain
 * matching tokens).
 */
function extractCoverageStepBlock(yaml) {
  // Block starts at the step header line and ends at the next step header or
  // top-level `jobs:` boundary. Steps in this workflow are separated by
  // blank-line + 6-space `- name:` (inside the `steps:` of the smoke job).
  const startIdx = yaml.search(/-\s+name:\s*Audit\s+—\s*line coverage threshold/);
  assert.ok(startIdx !== -1, 'coverage step header not found in ci.yml');
  const rest = yaml.slice(startIdx);
  // End at next top-level step (a line beginning with optional whitespace +
  // `- name:` after at least one newline) — but skip the very first match
  // which IS the header we just found.
  const nextStepMatch = rest.slice(1).search(/\n\s+-\s+name:/);
  return nextStepMatch === -1 ? rest : rest.slice(0, nextStepMatch + 1);
}
