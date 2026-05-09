// SEC-14-05 regression tests for verifyManifest helper + syncTo integration.
// Plan 83-03 — guards kit/ projection against tampered manifests.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import { verifyManifest, clearVerifyManifestCache } from '../../src/core/manifest-verify.js';
import { syncTo } from '../../src/core/sync.js';

let TMP_KIT;
let TMP_PROJECT;
let savedSkipEnv;
let savedNoCacheEnv;

beforeEach(async () => {
  TMP_KIT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-kit-'));
  TMP_PROJECT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-proj-'));
  savedSkipEnv = process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
  savedNoCacheEnv = process.env.KIT_MCP_VERIFY_NO_CACHE;
  delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
  delete process.env.KIT_MCP_VERIFY_NO_CACHE;
  clearVerifyManifestCache();
});

afterEach(async () => {
  await fs.rm(TMP_KIT, { recursive: true, force: true });
  await fs.rm(TMP_PROJECT, { recursive: true, force: true });
  if (savedSkipEnv !== undefined) process.env.KIT_MCP_SKIP_MANIFEST_CHECK = savedSkipEnv;
  else delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
  if (savedNoCacheEnv !== undefined) process.env.KIT_MCP_VERIFY_NO_CACHE = savedNoCacheEnv;
  else delete process.env.KIT_MCP_VERIFY_NO_CACHE;
  clearVerifyManifestCache();
});

// Helper: build a minimal valid kit fixture with a fresh manifest.
async function buildFixtureKit(kitRoot, files = { 'agents/foo.md': '# foo\n', 'commands/bar.md': '# bar\n' }) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(kitRoot, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }
  const manifest = { version: 'test', timestamp: new Date().toISOString(), files: {} };
  for (const [rel, content] of Object.entries(files)) {
    manifest.files[rel] = crypto.createHash('sha256').update(Buffer.from(content)).digest('hex');
  }
  await fs.writeFile(path.join(kitRoot, 'file-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

test('SEC-14-05: verifyManifest accepts intact kit', async () => {
  await buildFixtureKit(TMP_KIT);
  const r = await verifyManifest(TMP_KIT);
  assert.equal(r.ok, true);
});

test('SEC-14-05: verifyManifest detects tampered file', async () => {
  await buildFixtureKit(TMP_KIT);
  // Tamper without updating manifest
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');
  const r = await verifyManifest(TMP_KIT);
  assert.equal(r.ok, false);
  assert.match(r.reason, /kit manifest mismatch/);
  assert.match(r.reason, /agents\/foo\.md/);
});

test('SEC-14-05: verifyManifest detects missing file', async () => {
  await buildFixtureKit(TMP_KIT);
  await fs.rm(path.join(TMP_KIT, 'agents/foo.md'));
  const r = await verifyManifest(TMP_KIT);
  assert.equal(r.ok, false);
  assert.match(r.reason, /missing/);
  assert.match(r.reason, /agents\/foo\.md/);
});

test('SEC-14-05: KIT_MCP_SKIP_MANIFEST_CHECK=1 bypasses with stderr warn', async () => {
  await buildFixtureKit(TMP_KIT);
  // Tamper so verification would normally fail
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');

  process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';

  // Capture stderr
  const origWrite = process.stderr.write.bind(process.stderr);
  const captured = [];
  process.stderr.write = (chunk) => {
    captured.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    return true;
  };

  let r;
  try {
    r = await verifyManifest(TMP_KIT);
  } finally {
    process.stderr.write = origWrite;
  }

  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.ok(
    captured.some((s) => /WARNING/.test(s) && /KIT_MCP_SKIP_MANIFEST_CHECK/.test(s)),
    'expected stderr WARNING about skip env var, got: ' + JSON.stringify(captured)
  );
});

test('SEC-14-05 E2E: syncTo passes when kit manifest is intact', async () => {
  // Build a fixture sufficient for the registry's claude-code target requirements.
  // The target reads agents/, commands/, skills/ — minimal frontmatter so listKit
  // doesn't reject the entries.
  await buildFixtureKit(TMP_KIT, {
    'agents/foo.md': '---\nname: foo\ndescription: Test agent\n---\n# foo\n',
    'commands/bar.md': '---\ndescription: Test command\n---\n# bar\n',
    'skills/baz/SKILL.md': '---\nname: baz\ndescription: Test skill\n---\n# baz\n',
  });
  const r = await syncTo('claude-code', { kitRoot: TMP_KIT, projectRoot: TMP_PROJECT });
  assert.ok(r.written.length > 0, 'syncTo should have written files; got ' + JSON.stringify(r));
});

test('SEC-14-05 E2E: syncTo throws EMANIFESTMISMATCH when kit is tampered', async () => {
  await buildFixtureKit(TMP_KIT, {
    'agents/foo.md': '---\nname: foo\ndescription: Test agent\n---\n# foo\n',
    'commands/bar.md': '---\ndescription: Test command\n---\n# bar\n',
    'skills/baz/SKILL.md': '---\nname: baz\ndescription: Test skill\n---\n# baz\n',
  });
  // Tamper after manifest is built
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# evil\n', 'utf8');

  await assert.rejects(
    () => syncTo('claude-code', { kitRoot: TMP_KIT, projectRoot: TMP_PROJECT }),
    (err) => {
      assert.equal(err.code, 'EMANIFESTMISMATCH');
      assert.match(err.message, /kit manifest mismatch/);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// PERF-17-01 — Phase 90.01: Promise.all batches=16 + cache TTL 30s.
// ---------------------------------------------------------------------------

test('PERF-17-01: verifyManifest hashes 50 files via parallel batches', async () => {
  const files = {};
  for (let i = 0; i < 50; i++) {
    files[`agents/file-${i}.md`] = `# file ${i}\nconteudo ${i}\n`;
  }
  await buildFixtureKit(TMP_KIT, files);

  const t0 = Date.now();
  const r = await verifyManifest(TMP_KIT);
  const elapsed = Date.now() - t0;

  assert.equal(r.ok, true, 'expected ok=true with 50 intact files');
  // Generous bound — CI is slow. We're checking parallelization happened,
  // not measuring exact ms. Sequential 50 files would be > 200ms on slow disk;
  // batched=16 should easily fit under 500ms even on the worst CI runner.
  assert.ok(elapsed < 500, `expected < 500ms for 50 parallel files, got ${elapsed}ms`);
});

test('PERF-17-01: 2nd consecutive call hits cache (TTL 30s, ok path)', async () => {
  await buildFixtureKit(TMP_KIT);

  // 1st call — full compute, primes cache
  const r1 = await verifyManifest(TMP_KIT);
  assert.equal(r1.ok, true);

  // Tamper a file — but DO NOT call clearVerifyManifestCache.
  // Cache should still serve stale ok=true result (TTL not expired).
  // This proves the cache is actually serving (not silently re-computing).
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');

  const r2 = await verifyManifest(TMP_KIT);
  assert.equal(r2.ok, true, 'cache should serve stale ok=true within TTL');
});

test('PERF-17-01: mismatch path is never cached (always recomputes)', async () => {
  await buildFixtureKit(TMP_KIT);
  // Tamper before first call
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');

  // 1st call — mismatch, MUST NOT cache
  const r1 = await verifyManifest(TMP_KIT);
  assert.equal(r1.ok, false);

  // Fix the tamper — restore original content
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# foo\n', 'utf8');

  // 2nd call — must recompute (not serve cached r1). Should now be ok.
  const r2 = await verifyManifest(TMP_KIT);
  assert.equal(r2.ok, true, 'mismatch must not cache; 2nd call after fix should recompute and pass');
});

test('PERF-17-01: KIT_MCP_VERIFY_NO_CACHE=1 forces recompute (read+write bypass)', async () => {
  await buildFixtureKit(TMP_KIT);

  // 1st call — primes cache
  const r1 = await verifyManifest(TMP_KIT);
  assert.equal(r1.ok, true);

  // Tamper file. Then set bypass env.
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), '# tampered\n', 'utf8');
  process.env.KIT_MCP_VERIFY_NO_CACHE = '1';

  // 2nd call with bypass — must recompute and detect tamper.
  const r2 = await verifyManifest(TMP_KIT);
  assert.equal(r2.ok, false, 'env bypass must skip cache and detect tamper');
  assert.match(r2.reason, /tampered/);
});

test('PERF-17-01: CRLF→LF normalize preserved (cross-platform stable)', async () => {
  // Manually build kit with CRLF content + LF-hashed manifest
  const lfContent = '# foo\nlinha 2\n';
  const crlfContent = '# foo\r\nlinha 2\r\n';
  const manifest = {
    version: 'test',
    timestamp: new Date().toISOString(),
    files: {
      'agents/foo.md': crypto.createHash('sha256').update(Buffer.from(lfContent)).digest('hex'),
    },
  };
  await fs.mkdir(path.join(TMP_KIT, 'agents'), { recursive: true });
  // Write file with CRLF — verify must normalize back to LF before hashing
  await fs.writeFile(path.join(TMP_KIT, 'agents/foo.md'), crlfContent, 'utf8');
  await fs.writeFile(path.join(TMP_KIT, 'file-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const r = await verifyManifest(TMP_KIT);
  assert.equal(r.ok, true, 'CRLF file must hash equal to LF manifest after normalize');
});
