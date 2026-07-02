// PERF-13-03: integration test validating that npm pack --dry-run produces
// a tarball without CHANGELOG.md, while preserving all other expected
// contents (bin/, src/, kit/, gates/, README.md, LICENSE, package.json).
//
// Why integration: this test invokes the actual `npm pack` binary so it
// reflects what would land on registry.npmjs.org if we ran `npm publish`
// right now. Anti-regression for v1.13+ — if anyone re-adds CHANGELOG.md
// to files[], this test fails and forces the author to justify it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function npmPackDryRun() {
  // npm pack --dry-run --json produces machine-readable output with the
  // exact list of files that would be in the tarball.
  //
  // Cross-platform note: `npm` is a .cmd shim on Windows; passing it directly
  // to spawnSync without shell:true returns ENOENT. With shell:true + array
  // args we hit DEP0190 (Node 22+ deprecation warning about shell-injection
  // surface). Mitigation: pass a single hardcoded command STRING when on
  // Windows (no user-supplied data, no injection risk), and use the
  // non-shell array path on POSIX.
  let result;
  if (process.platform === 'win32') {
    result = spawnSync('npm pack --dry-run --json', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: true,
    });
  } else {
    result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  }
  if (result.status !== 0) {
    throw new Error(`npm pack failed (exit ${result.status}): ${result.stderr}`);
  }
  // npm prints JSON to stdout — parse the FIRST top-level array.
  const parsed = JSON.parse(result.stdout);
  // Output is array of one object per package (npm pack supports workspaces).
  assert.ok(Array.isArray(parsed) && parsed.length >= 1, 'expected JSON array from npm pack');
  return parsed[0];
}

test('PERF-13-03: tarball does NOT include CHANGELOG.md', () => {
  const pkg = npmPackDryRun();
  const files = pkg.files.map((f) => f.path);
  const offenders = files.filter((p) => /CHANGELOG\.md$/i.test(p));
  assert.deepEqual(
    offenders,
    [],
    `Tarball includes banned files (PERF-13-03 regression): ${offenders.join(', ')}`,
  );
});

test('PERF-13-03: tarball still includes core surfaces (bin/, src/, kit/, gates/)', () => {
  const pkg = npmPackDryRun();
  const files = pkg.files.map((f) => f.path);

  const requiredPrefixes = ['bin/', 'src/', 'kit/', 'gates/'];
  for (const prefix of requiredPrefixes) {
    const matches = files.filter((p) => p.startsWith(prefix));
    assert.ok(
      matches.length > 0,
      `Tarball missing required prefix "${prefix}". Files: ${files.slice(0, 10).join(', ')}...`,
    );
  }
});

test('PERF-13-03: tarball includes README.md, LICENSE, package.json', () => {
  const pkg = npmPackDryRun();
  const files = pkg.files.map((f) => f.path);

  const required = ['README.md', 'LICENSE', 'package.json'];
  for (const rel of required) {
    assert.ok(
      files.includes(rel),
      `Tarball missing required file "${rel}". Files in root: ${files.filter((f) => !f.includes('/')).join(', ')}`,
    );
  }
});

test('PERF-13-03: package.json files[] does not contain CHANGELOG entry', async () => {
  // Defensive: even if npm pack changed semantics, the source of truth
  // (package.json) must not declare CHANGELOG.
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  assert.ok(Array.isArray(pkg.files), 'package.json must declare files[]');
  const offenders = pkg.files.filter((f) => /CHANGELOG/i.test(f));
  assert.deepEqual(
    offenders,
    [],
    `package.json files[] still references CHANGELOG: ${offenders.join(', ')}`,
  );
});

test('PERF-16-05/06: tarball package.json declares optionalDependencies (Phase 89)', async () => {
  // npm pack ships package.json verbatim. Validate the structure that
  // Phase 89.02 introduced — `@inquirer/prompts` and `chokidar` declared
  // under optionalDependencies (not dependencies). Anti-regression: if anyone
  // moves them back to dependencies, this test fails and forces justification.
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  assert.ok(
    pkg.optionalDependencies,
    'package.json must declare optionalDependencies (Phase 89)',
  );
  assert.ok(
    pkg.optionalDependencies['@inquirer/prompts'],
    '@inquirer/prompts must be optional (PERF-16-05)',
  );
  assert.ok(
    pkg.optionalDependencies['chokidar'],
    'chokidar must be optional (PERF-16-06)',
  );
  // Sanity: they must NOT be in dependencies anymore.
  assert.ok(
    !pkg.dependencies?.['@inquirer/prompts'],
    '@inquirer/prompts must not be in dependencies after Phase 89',
  );
  assert.ok(
    !pkg.dependencies?.['chokidar'],
    'chokidar must not be in dependencies after Phase 89',
  );
});
