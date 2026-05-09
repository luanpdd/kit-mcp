// SEC-14-05 regression tests for verifyManifest helper + syncTo integration.
// Plan 83-03 — guards kit/ projection against tampered manifests.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import { verifyManifest } from '../../src/core/manifest-verify.js';
import { syncTo } from '../../src/core/sync.js';

let TMP_KIT;
let TMP_PROJECT;
let savedSkipEnv;

beforeEach(async () => {
  TMP_KIT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-kit-'));
  TMP_PROJECT = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-manifest-test-proj-'));
  savedSkipEnv = process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
  delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
});

afterEach(async () => {
  await fs.rm(TMP_KIT, { recursive: true, force: true });
  await fs.rm(TMP_PROJECT, { recursive: true, force: true });
  if (savedSkipEnv !== undefined) process.env.KIT_MCP_SKIP_MANIFEST_CHECK = savedSkipEnv;
  else delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
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
