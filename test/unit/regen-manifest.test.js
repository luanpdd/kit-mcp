// DX-15-02 regression tests for scripts/regen-manifest.js — Plan 86-02.
// Three guards:
//   1. schema shape + verifier round-trip (Phase 83 contract preserved)
//   2. idempotency — same kit content → byte-identical manifest (timestamp pinned)
//   3. content change → hash + timestamp updated
//
// Tests run on temp fixtures only — never touch the real kit/file-manifest.json.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { regenManifest } from '../../scripts/regen-manifest.js';
import { verifyManifest } from '../../src/core/manifest-verify.js';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-regen-manifest-'));
  await mkdir(path.join(root, 'kit', 'agents'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'commands'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'skills', 'alpha'), { recursive: true });
  await writeFile(path.join(root, 'kit', 'agents', 'a.md'), 'content-a');
  await writeFile(path.join(root, 'kit', 'commands', 'b.md'), 'content-b');
  await writeFile(path.join(root, 'kit', 'skills', 'alpha', 'SKILL.md'), 'skill-content');
  await writeFile(path.join(root, 'kit', 'README.md'), 'kit-readme');
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'test', version: '9.9.9' }) + '\n'
  );
  return root;
}

test('regenManifest: writes valid {version, timestamp, files} with sorted keys', async () => {
  const root = await makeFixture();
  try {
    const r = await regenManifest(root);
    assert.equal(r.changed, true);
    assert.equal(r.count, 4);

    const raw = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');
    const m = JSON.parse(raw);

    assert.equal(m.version, '9.9.9', 'version mirrors package.json');
    assert.match(m.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'ISO timestamp');
    assert.equal(typeof m.files, 'object');

    const keys = Object.keys(m.files);
    assert.deepEqual(keys, [...keys].sort(), 'keys sorted lexicographically');
    assert.ok(
      keys.every((k) => /^[0-9a-f]{64}$/.test(m.files[k])),
      'all values are sha256 hex'
    );
    assert.ok(keys.includes('agents/a.md'));
    assert.ok(keys.includes('commands/b.md'));
    assert.ok(keys.includes('skills/alpha/SKILL.md'));
    assert.ok(keys.includes('README.md'));
    assert.ok(!keys.includes('file-manifest.json'), 'manifest excludes itself');

    const v = await verifyManifest(path.join(root, 'kit'));
    assert.equal(v.ok, true, 'verifyManifest accepts regenerated manifest');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regenManifest: idempotent — second call preserves timestamp + bytes', async () => {
  const root = await makeFixture();
  try {
    const r1 = await regenManifest(root);
    assert.equal(r1.changed, true);
    const after1 = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');

    await new Promise((res) => setTimeout(res, 10));

    const r2 = await regenManifest(root);
    assert.equal(r2.changed, false, 'unchanged kit means no rewrite');
    const after2 = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');
    assert.equal(after1, after2, 'bytes identical (timestamp preserved)');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('regenManifest: detects content change → updates hash + timestamp', async () => {
  const root = await makeFixture();
  try {
    await regenManifest(root);
    const t1 = JSON.parse(
      await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8')
    );
    const hash1 = t1.files['agents/a.md'];

    await new Promise((res) => setTimeout(res, 5));
    await writeFile(path.join(root, 'kit', 'agents', 'a.md'), 'content-a-MODIFIED');

    const r = await regenManifest(root);
    assert.equal(r.changed, true);
    const t2 = JSON.parse(
      await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8')
    );
    assert.notEqual(t2.files['agents/a.md'], hash1, 'hash changed');
    assert.notEqual(t2.timestamp, t1.timestamp, 'timestamp updated');
    assert.equal(t2.version, '9.9.9');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('POL-17-02: parallel hashing with >BATCH_SIZE files preserves deterministic order', async () => {
  // Fixture with 50 files spanning multiple BATCH_SIZE=16 windows. Ensures the
  // Promise.all batches don't reorder keys based on completion order — the
  // assignment must follow the sorted `targets` array regardless of parallelism.
  const root = await mkdtemp(path.join(tmpdir(), 'kit-regen-manifest-parallel-'));
  try {
    await mkdir(path.join(root, 'kit', 'a'), { recursive: true });
    await mkdir(path.join(root, 'kit', 'b'), { recursive: true });
    // Generate names with mixed sort order so any "by completion" leak shows up.
    const names = [];
    for (let i = 0; i < 50; i++) {
      // Vary sizes so hashing latencies differ — encourages out-of-order completion.
      const dir = i % 2 === 0 ? 'a' : 'b';
      const sz = (i * 137) % 4096;
      const rel = `${dir}/file-${String(i).padStart(2, '0')}.txt`;
      names.push(rel);
      await writeFile(path.join(root, 'kit', rel), 'x'.repeat(100 + sz));
    }
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 't', version: '1.2.3' }) + '\n'
    );

    const r = await regenManifest(root);
    assert.equal(r.changed, true);
    assert.equal(r.count, 50, 'all 50 files hashed across multiple batches');

    const m = JSON.parse(await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8'));
    const keys = Object.keys(m.files);
    assert.equal(keys.length, 50, 'all 50 keys present');
    assert.deepEqual(keys, [...keys].sort(), 'keys sorted lexicographically (deterministic order despite parallel hashing)');

    // Run again — must be byte-identical (idempotent) even with parallel batches.
    const after1 = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');
    const r2 = await regenManifest(root);
    assert.equal(r2.changed, false, 'second regen detects no change');
    const after2 = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');
    assert.equal(after1, after2, 'parallel regen produces byte-identical output across runs');

    // verifyManifest accepts it (proves hashes match real file contents).
    const v = await verifyManifest(path.join(root, 'kit'));
    assert.equal(v.ok, true, 'verifyManifest accepts parallel-regenerated manifest');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
