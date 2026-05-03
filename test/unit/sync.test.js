import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncTo, statusOf, removeFrom } from '../../src/core/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/sample-kit');

let TMP;

beforeEach(async () => {
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-sync-test-'));
});

afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

test('syncTo claude-code — writes stubs in reference mode by default', async () => {
  const result = await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  assert.equal(result.target, 'claude-code');
  assert.equal(result.mode, 'reference');
  assert.ok(result.written.length > 0);

  const agent = await fs.readFile(path.join(TMP, '.claude/agents/sample-agent.md'), 'utf8');
  assert.match(agent, /<!-- kit-mcp:reference -->/);
  assert.match(agent, /Canonical source:/);
  // The body must NOT start with the marker — H1 first
  const body = agent.split(/---\r?\n/).slice(2).join('---\n').trim();
  assert.ok(body.startsWith('# sample-agent'), 'stub body must start with H1, not marker');
});

test('syncTo claude-code — copy mode writes full content, no stub markers', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP, mode: 'copy' });
  const agent = await fs.readFile(path.join(TMP, '.claude/agents/sample-agent.md'), 'utf8');
  assert.doesNotMatch(agent, /<!-- kit-mcp:reference -->/);
  assert.match(agent, /You are a sample agent/);
});

test('syncTo claude-code — mirror-tree projects framework + hooks', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  const fwFile = await fs.readFile(path.join(TMP, '.claude/framework/workflows/sample-workflow.md'), 'utf8');
  assert.match(fwFile, /Sample Workflow/);
  const hookFile = await fs.readFile(path.join(TMP, '.claude/hooks/sample-hook.js'), 'utf8');
  assert.match(hookFile, /hook running/);
  const fwMarker = await fs.readFile(path.join(TMP, '.claude/framework/.kit-mcp-managed'), 'utf8');
  assert.match(fwMarker, /Managed by @luanpdd\/kit-mcp/);
});

test('syncTo --dry-run does not write to disk', async () => {
  const result = await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP, dryRun: true });
  assert.equal(result.dryRun, true);
  assert.ok(result.written.length > 0);
  await assert.rejects(fs.access(path.join(TMP, '.claude/agents/sample-agent.md')));
});

test('statusOf — reports framework and hooks capability paths', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  const status = await statusOf('claude-code', { projectRoot: TMP });
  const caps = status.checks.map(c => c.capability);
  assert.ok(caps.includes('framework'));
  assert.ok(caps.includes('hooks'));
  for (const c of status.checks) assert.equal(c.exists, true);
});

test('removeFrom — deletes only stubs (preserves user files)', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  // Add a user-authored file in agents/
  await fs.writeFile(path.join(TMP, '.claude/agents/user-authored.md'), 'I wrote this myself.\n');
  const result = await removeFrom('claude-code', { projectRoot: TMP });
  await assert.rejects(fs.access(path.join(TMP, '.claude/agents/sample-agent.md')));
  // user-authored should still be there
  const userFile = await fs.readFile(path.join(TMP, '.claude/agents/user-authored.md'), 'utf8');
  assert.match(userFile, /I wrote this myself/);
  assert.ok(result.removed.length > 0);
});

test('removeFrom — mirror-tree only removed when marker present', async () => {
  // Create a manual framework dir without the marker
  await fs.mkdir(path.join(TMP, '.claude/framework'), { recursive: true });
  await fs.writeFile(path.join(TMP, '.claude/framework/my-own.md'), 'mine');
  await removeFrom('claude-code', { projectRoot: TMP });
  // Should be preserved
  const myOwn = await fs.readFile(path.join(TMP, '.claude/framework/my-own.md'), 'utf8');
  assert.equal(myOwn, 'mine');
});

test('removeFrom — mirror-tree IS removed when marker present', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  await removeFrom('claude-code', { projectRoot: TMP });
  await assert.rejects(fs.access(path.join(TMP, '.claude/framework')));
  await assert.rejects(fs.access(path.join(TMP, '.claude/hooks')));
});
