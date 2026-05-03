import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncTo } from '../../src/core/sync.js';
import { detectReverse, applyReverse } from '../../src/core/reverse-sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_FIXTURE = path.resolve(__dirname, '../fixtures/sample-kit');

let TMP, KIT, PROJECT;

beforeEach(async () => {
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-rev-test-'));
  KIT = path.join(TMP, 'kit');
  PROJECT = path.join(TMP, 'project');
  // Copy the fixture into a fresh kit dir we can mutate without touching the repo
  await fs.cp(SRC_FIXTURE, KIT, { recursive: true });
  await syncTo('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
});

afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

test('detectReverse — clean install has no candidates', async () => {
  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  assert.equal(r.candidates.length, 0);
});

test('detectReverse — picks up edits in framework files', async () => {
  const fwPath = path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md');
  await fs.writeFile(fwPath, '# EDITED\nNew content\n');
  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  const fw = r.candidates.find(c => c.kind === 'framework' && c.name === 'workflows/sample-workflow.md');
  assert.ok(fw, 'framework edit must be detected');
  assert.equal(fw.reason, 'modified-in-ide');
});

test('detectReverse — picks up edits in hooks files', async () => {
  const hookPath = path.join(PROJECT, '.claude/hooks/sample-hook.js');
  await fs.writeFile(hookPath, "// EDITED\nconsole.log('changed');\n");
  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  const hook = r.candidates.find(c => c.kind === 'hooks' && c.name === 'sample-hook.js');
  assert.ok(hook, 'hooks edit must be detected');
});

test('detectReverse — skips .kit-mcp-managed marker file', async () => {
  // Without modifying the marker, it should never appear
  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  for (const c of r.candidates) {
    assert.ok(!c.name.includes('.kit-mcp-managed'), 'marker file should never be a candidate');
  }
});

test('applyReverse overwrite — propagates framework edit to canonical', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md'), '# OVERWRITTEN\n');
  const r = await applyReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT, strategy: 'overwrite' });
  assert.ok(r.results.some(x => x.action === 'overwritten'));
  const canonical = await fs.readFile(path.join(KIT, 'framework/workflows/sample-workflow.md'), 'utf8');
  assert.match(canonical, /# OVERWRITTEN/);
});

test('applyReverse merge — degenerates to overwrite for mirror-tree files', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'), "// MERGED\n");
  const r = await applyReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT, strategy: 'merge' });
  const hook = r.results.find(c => c.kind === 'hooks');
  assert.match(hook.action, /merged.*overwrite|overwritten/);
  const canonical = await fs.readFile(path.join(KIT, 'hooks/sample-hook.js'), 'utf8');
  assert.match(canonical, /\/\/ MERGED/);
});

test('applyReverse rename — preserves canonical, writes .from-<tag>', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'), "// RENAMED\n");
  const r = await applyReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT, strategy: 'rename' });
  const hook = r.results.find(c => c.kind === 'hooks');
  assert.match(hook.action, /renamed/);
  // Original canonical untouched
  const orig = await fs.readFile(path.join(KIT, 'hooks/sample-hook.js'), 'utf8');
  assert.match(orig, /hook running/);
  // .from-<tag>.js exists with edit
  const renamed = await fs.readFile(path.join(KIT, 'hooks/sample-hook.from-claude.js'), 'utf8');
  assert.match(renamed, /\/\/ RENAMED/);
});

test('applyReverse skip — never writes', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'), "// SKIP\n");
  await applyReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT, strategy: 'skip' });
  const orig = await fs.readFile(path.join(KIT, 'hooks/sample-hook.js'), 'utf8');
  assert.match(orig, /hook running/);  // unchanged
});

test('applyReverse --only filter — only modifies matching candidates', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md'), '# A\n');
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'), "// B\n");
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT,
    strategy: 'overwrite',
    only: ['framework/workflows/sample-workflow.md'],
  });
  // Only framework was applied
  const fw = r.results.find(c => c.kind === 'framework');
  assert.match(fw.action, /overwritten/);
  const hook = r.results.find(c => c.kind === 'hooks');
  assert.match(hook.action, /skipped \(filter\)/);
});
