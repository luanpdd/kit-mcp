// DIR-01 regression tests for scripts/regen-version.js — single-source release
// hygiene. Guards package.json.version → kit/framework/VERSION +
// kit/packs/*/pack.json (.version) propagation against drift.
// Fixture style follows test/unit/update-readme-counts.test.js (tmpdir repos).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { collectVersionTargets, regenVersion } from '../../scripts/regen-version.js';

const PACK_BASE = {
  schemaVersion: 1,
  publisher: 'test',
  kind: 'domain',
  removable: true,
  requires: [],
  recommends: [],
  conflicts: [],
  provides: [],
  resources: { agents: [], commands: [], skills: [], workflows: [], hooks: [] },
};

async function makeFixture({ pkgVersion = '9.9.9', fileVersion = '1.0.0', eol = '\n' } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-regen-version-'));
  await mkdir(path.join(root, 'kit', 'framework'), { recursive: true });
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: pkgVersion }, null, 2) + '\n'
  );
  await writeFile(path.join(root, 'kit', 'framework', 'VERSION'), fileVersion + eol);
  for (const id of ['alpha', 'beta']) {
    await mkdir(path.join(root, 'kit', 'packs', id), { recursive: true });
    const json =
      JSON.stringify({ ...PACK_BASE, id, name: 'Pack ' + id, version: fileVersion }, null, 2) +
      '\n';
    await writeFile(path.join(root, 'kit', 'packs', id, 'pack.json'), json.replace(/\n/g, eol));
  }
  // Non-pack dir (no pack.json) must be ignored, mirroring kit/packs/registry.json siblings.
  await mkdir(path.join(root, 'kit', 'packs', 'not-a-pack'), { recursive: true });
  return root;
}

test('regenVersion: propagates package.json.version to VERSION + every pack.json', async () => {
  const root = await makeFixture();
  try {
    const r = await regenVersion(root);
    assert.equal(r.version, '9.9.9');
    assert.deepEqual(r.changed, [
      'kit/framework/VERSION',
      'kit/packs/alpha/pack.json',
      'kit/packs/beta/pack.json',
    ]);
    assert.equal(r.drift.length, 3);

    const versionFile = await readFile(path.join(root, 'kit', 'framework', 'VERSION'), 'utf8');
    assert.equal(versionFile, '9.9.9\n');
    for (const id of ['alpha', 'beta']) {
      const parsed = JSON.parse(
        await readFile(path.join(root, 'kit', 'packs', id, 'pack.json'), 'utf8')
      );
      assert.equal(parsed.version, '9.9.9');
      assert.equal(parsed.id, id, 'other fields preserved');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regenVersion: idempotent — second run is a byte-level no-op', async () => {
  const root = await makeFixture();
  try {
    await regenVersion(root);
    const files = [
      path.join(root, 'kit', 'framework', 'VERSION'),
      path.join(root, 'kit', 'packs', 'alpha', 'pack.json'),
      path.join(root, 'kit', 'packs', 'beta', 'pack.json'),
    ];
    const before = await Promise.all(files.map((f) => readFile(f, 'utf8')));
    const mtimesBefore = await Promise.all(files.map(async (f) => (await stat(f)).mtimeMs));

    const r2 = await regenVersion(root);
    assert.deepEqual(r2.changed, [], 'synced repo must not be rewritten');
    assert.deepEqual(r2.drift, []);

    const after = await Promise.all(files.map((f) => readFile(f, 'utf8')));
    const mtimesAfter = await Promise.all(files.map(async (f) => (await stat(f)).mtimeMs));
    assert.deepEqual(after, before);
    assert.deepEqual(mtimesAfter, mtimesBefore, 'no rewrite means untouched mtimes');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regenVersion: check mode reports drift without writing anything', async () => {
  const root = await makeFixture();
  try {
    const r = await regenVersion(root, { check: true });
    assert.deepEqual(r.changed, [], 'check mode never writes');
    assert.deepEqual(r.drift, [
      { file: 'kit/framework/VERSION', found: '1.0.0', expected: '9.9.9' },
      { file: 'kit/packs/alpha/pack.json', found: '1.0.0', expected: '9.9.9' },
      { file: 'kit/packs/beta/pack.json', found: '1.0.0', expected: '9.9.9' },
    ]);

    // Files untouched on disk
    const versionFile = await readFile(path.join(root, 'kit', 'framework', 'VERSION'), 'utf8');
    assert.equal(versionFile, '1.0.0\n');
    const alpha = JSON.parse(
      await readFile(path.join(root, 'kit', 'packs', 'alpha', 'pack.json'), 'utf8')
    );
    assert.equal(alpha.version, '1.0.0');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regenVersion: check mode on a synced repo reports zero drift', async () => {
  const root = await makeFixture({ pkgVersion: '2.0.0', fileVersion: '2.0.0' });
  try {
    const r = await regenVersion(root, { check: true });
    assert.deepEqual(r.drift, []);
    assert.deepEqual(r.changed, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regenVersion: preserves CRLF convention of existing files (Windows checkouts)', async () => {
  const root = await makeFixture({ eol: '\r\n' });
  try {
    await regenVersion(root);
    const versionFile = await readFile(path.join(root, 'kit', 'framework', 'VERSION'), 'utf8');
    assert.equal(versionFile, '9.9.9\r\n');
    const alphaRaw = await readFile(
      path.join(root, 'kit', 'packs', 'alpha', 'pack.json'),
      'utf8'
    );
    assert.ok(alphaRaw.includes('\r\n'), 'pack.json keeps CRLF');
    assert.equal(JSON.parse(alphaRaw).version, '9.9.9');

    // And stays idempotent under CRLF (the bug update-readme-counts.js:73 guards against).
    const r2 = await regenVersion(root);
    assert.deepEqual(r2.changed, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regenVersion: rejects a non-semver package.json version', async () => {
  const root = await makeFixture({ pkgVersion: 'not-a-version' });
  try {
    await assert.rejects(regenVersion(root), /not a valid semver/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('collectVersionTargets: exposes found/inSync per target, ignores non-pack dirs', async () => {
  const root = await makeFixture();
  try {
    const { version, targets } = await collectVersionTargets(root);
    assert.equal(version, '9.9.9');
    assert.deepEqual(
      targets.map((t) => t.file),
      ['kit/framework/VERSION', 'kit/packs/alpha/pack.json', 'kit/packs/beta/pack.json'],
      'not-a-pack (no pack.json) must not appear'
    );
    for (const t of targets) {
      assert.equal(t.found, '1.0.0');
      assert.equal(t.inSync, false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regen-version: real repo — VERSION + all pack.json in sync with package.json', async () => {
  // Live drift guard (same pattern as update-readme-counts real-repo test).
  // If a release bumps package.json without running `node scripts/regen-version.js`
  // (the npm `version` lifecycle hook does it automatically), this fails first.
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');
  const r = await regenVersion(repoRoot, { check: true });
  assert.deepEqual(
    r.drift,
    [],
    'derived version files drifted — run `node scripts/regen-version.js` and commit'
  );
});
