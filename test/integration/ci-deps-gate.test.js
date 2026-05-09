// INFRA-17-01: regression test for the CI deps budget gate.
//
// Pre-v1.17 the gate counted only `package.json#dependencies`, allowing the
// effective budget to silently grow to `6 + optionalDependencies.length` when
// Phase 92 split runtime deps 3/3 across required and optional. INFRA-17-01
// fixes this by summing both.
//
// We can't lint the YAML (no parser in scope — kit-mcp's 6-dep budget keeps
// `yaml` out), so we validate via text-regex on the workflow file. This is the
// same pattern used by gates/budget-description.md and the existing markdown
// gate suite. Anti-regression: if anyone reverts the gate to count only
// `dependencies`, this test fails and forces a conscious choice.

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

test('INFRA-17-01: deps budget gate step exists and is tagged with the REQ id', async () => {
  const yaml = await readCiYaml();
  // The step header is the unambiguous anchor — keep the REQ id in the
  // header so the gate is grep-able by REQ.
  assert.match(
    yaml,
    /name:\s*Audit\s+—\s*runtime deps budget.*INFRA-17-01/i,
    'CI deps budget step must declare REQ INFRA-17-01 in its name',
  );
});

test('INFRA-17-01: deps budget gate counts BOTH dependencies AND optionalDependencies', async () => {
  const yaml = await readCiYaml();
  // Three positive markers — all must appear inside the workflow:
  //   1. read .dependencies count
  //   2. read .optionalDependencies count
  //   3. sum them before comparing to BUDGET
  assert.match(
    yaml,
    /Object\.keys\(require\(['"]\.\/package\.json['"]\)\.dependencies\s*\|\|\s*\{\}\)\.length/,
    'gate must read .dependencies count from package.json',
  );
  assert.match(
    yaml,
    /Object\.keys\(require\(['"]\.\/package\.json['"]\)\.optionalDependencies\s*\|\|\s*\{\}\)\.length/,
    'gate must read .optionalDependencies count from package.json',
  );
  assert.match(
    yaml,
    /TOTAL=\$\(\(DEPS\s*\+\s*OPT\)\)/,
    'gate must sum DEPS + OPT before checking budget',
  );
  // And the comparison uses TOTAL, not just DEPS. Bash test syntax is
  //   [ "$TOTAL" -gt "$BUDGET" ]
  // — bracket separated from operands by whitespace, optional quotes around vars.
  assert.match(
    yaml,
    /\[\s+"?\$TOTAL"?\s+-gt\s+"?\$BUDGET"?\s+\]/,
    'budget comparison must use the summed TOTAL, not just DEPS',
  );
});

test('INFRA-17-01: deps budget gate budget is 6 (3 deps + 3 optional)', async () => {
  const yaml = await readCiYaml();
  // The budget literal must remain 6 unless the team consciously bumps it
  // alongside an ADR. This test catches stealth bumps.
  assert.match(
    yaml,
    /BUDGET=6\b/,
    'deps budget must be exactly 6 — bump requires ADR in .planning/decisions.md',
  );
});

test('INFRA-17-01: package.json deps + optionalDependencies fits the gate', async () => {
  // End-to-end sanity: the very gate we ship must be one that the current
  // package.json passes. If someone adds a 7th runtime dep, this test catches
  // it in unit-time before CI even sees the PR.
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  const depsCount = Object.keys(pkg.dependencies || {}).length;
  const optCount = Object.keys(pkg.optionalDependencies || {}).length;
  const total = depsCount + optCount;
  assert.ok(
    total <= 6,
    `runtime deps total ${total} > 6 budget (deps=${depsCount} opt=${optCount}) — bump BUDGET in ci.yml AND add ADR`,
  );
});
