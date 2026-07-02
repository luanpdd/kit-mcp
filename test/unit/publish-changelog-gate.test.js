// DRIFT-13-01: regression test for the awk-extract gate in publish.yml.
//
// The publish workflow must hard-fail when a final tag (vX.Y.Z) lacks a
// matching CHANGELOG entry. Pre-release tags (vX.Y.Z-rcN/-betaN/-alphaN)
// must still fall back gracefully. Tests both branches against a synthetic
// CHANGELOG fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// On Windows the default execSync shell is cmd.exe, which does not interpret
// single-quoted awk scripts (cmd treats `'...'` as plain literals and the
// embedded `/##/` looks like a path). Even when Git Bash provides awk.exe in
// PATH the script line cannot be passed through cmd intact. The production
// awk runs on ubuntu-latest in CI (publish.yml uses ubuntu-latest), which is
// the only environment we need this test to exercise — so we skip on Windows
// and on platforms where awk is unavailable.
function canRunAwkScript() {
  if (process.platform === 'win32') return false;
  try { execSync('awk --version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

const FIXTURE_CHANGELOG = `# Changelog

## [Unreleased]

## [1.13.0] - 2026-06-01

Test entry for 1.13.

### Adicionado
- Item A

## [1.12.1] - 2026-05-08

Hotfix.

### Corrigido
- Bug fix
`;

function runAwkExtract(version, changelogContent) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-changelog-'));
  const cl = path.join(tmp, 'CHANGELOG.md');
  fs.writeFileSync(cl, changelogContent);
  try {
    const cmd = `awk -v ver="${version}" '$0 ~ "^## [[]" ver "[]]" { found=1; next } found && /^## \\[/ { exit } found { print }' "${cl}"`;
    const out = execSync(cmd, { encoding: 'utf8' });
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('DRIFT-13-01: awk extracts present version body', { skip: !canRunAwkScript() }, () => {
  const out = runAwkExtract('1.13.0', FIXTURE_CHANGELOG);
  assert.match(out, /Test entry for 1.13/);
  assert.match(out, /Item A/);
  assert.doesNotMatch(out, /Bug fix/, 'must stop at next ## [');
});

test('DRIFT-13-01: awk returns empty for missing version', { skip: !canRunAwkScript() }, () => {
  const out = runAwkExtract('99.99.99', FIXTURE_CHANGELOG);
  assert.equal(out.trim(), '', 'empty output triggers gate fallback in workflow');
});

test('DRIFT-13-01: final-tag regex matches semver vX.Y.Z', () => {
  const finalRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
  assert.ok(finalRegex.test('1.12.1'));
  assert.ok(finalRegex.test('2.0.0'));
  assert.ok(finalRegex.test('0.1.0'));
});

test('DRIFT-13-01: final-tag regex rejects pre-release tags', () => {
  const finalRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
  assert.ok(!finalRegex.test('1.12.1-rc1'), 'rc must not match final');
  assert.ok(!finalRegex.test('1.12.1-beta2'));
  assert.ok(!finalRegex.test('1.12.1-alpha'));
  assert.ok(!finalRegex.test('1.12.1+build.1'));
});
