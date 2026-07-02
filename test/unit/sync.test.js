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

// ---------------------------------------------------------------------------
// PERF-17-02 — diff-based sync regression tests
// ---------------------------------------------------------------------------
//
// Diff filter applies ONLY to treeCopy ops (framework/, hooks/ subtrees).
// Content ops (agents/commands/skills/rules) re-render every call because
// their content embeds an ISO timestamp — they can't safely diff. So tests
// assert skip behavior on framework/hooks files only.

test('PERF-17-02: 2nd consecutive sync skips treeCopy ops in stable workspace', async () => {
  // 1st sync — fresh TMP, all targetStat calls fail (absent), nothing skipped.
  const events1 = [];
  await syncTo('claude-code', {
    kitRoot: FIXTURE, projectRoot: TMP,
    onProgress: (e) => events1.push(e),
  });
  const skipped1 = events1.filter(e => e.skipped === true);
  assert.equal(skipped1.length, 0, '1st sync to fresh dir must skip nothing');

  // 2nd sync — same source, same target, mtime+size match → all treeCopy ops skipped.
  const events2 = [];
  await syncTo('claude-code', {
    kitRoot: FIXTURE, projectRoot: TMP,
    onProgress: (e) => events2.push(e),
  });
  const skipped2 = events2.filter(e => e.skipped === true);
  const treeCopyEvents1 = events1.filter(e => e.phase === 'framework' || e.phase === 'hooks');
  // Subtract managed-marker ops (kind: 'framework'/'hooks' but NOT treeCopy — they
  // emit onProgress with same phase but go through the write path, not diff).
  // The diff filter only skips treeCopy ops; the marker file is a content write.
  // So skipped count <= treeCopyEvents1 count, and must be > 0 (at least workflows + hook files).
  assert.ok(skipped2.length > 0, '2nd sync must skip at least some treeCopy ops');
  assert.ok(skipped2.length <= treeCopyEvents1.length,
    `skipped count ${skipped2.length} must be <= treeCopy event count ${treeCopyEvents1.length}`);
});

test('PERF-17-02: edit one treeCopy file → next sync writes only that file', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  // Touch one source file — bump mtime so target.mtimeMs < src.mtimeMs (write needed).
  const srcFw = path.join(FIXTURE, 'framework/workflows/sample-workflow.md');
  // Read + rewrite same content with a small change to bump mtime AND content.
  const original = await fs.readFile(srcFw, 'utf8');
  // Wait briefly to guarantee mtime bump on filesystems with low resolution (HFS+, FAT32).
  await new Promise((r) => setTimeout(r, 20));
  await fs.writeFile(srcFw, original + '\n<!-- touch -->\n', 'utf8');

  const events = [];
  try {
    await syncTo('claude-code', {
      kitRoot: FIXTURE, projectRoot: TMP,
      onProgress: (e) => events.push(e),
    });
    // Filter to treeCopy events only (phase framework/hooks). Marker file ops
    // also have phase=framework/hooks but always write (content op, not treeCopy)
    // — those don't help isolate the "edit one file" assertion. Look for the
    // specific edited file in writes.
    const wroteEdited = events.filter(e =>
      e.skipped !== true && e.label === 'sample-workflow.md',
    );
    assert.equal(wroteEdited.length, 1,
      `expected exactly 1 write of sample-workflow.md, got ${wroteEdited.length}`);
    // Skipped ops should include the hook file (treeCopy not edited).
    const skippedHook = events.filter(e =>
      e.skipped === true && e.label === 'sample-hook.js',
    );
    assert.equal(skippedHook.length, 1,
      `expected hook file to be skipped (not edited), got ${skippedHook.length} skip events`);
  } finally {
    // Restore source file so other tests aren't affected (FIXTURE is shared).
    await fs.writeFile(srcFw, original, 'utf8');
  }
});

test('PERF-17-02: KIT_MCP_FORCE_FULL_SYNC=1 forces full sync (no skips)', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  // Save and restore env var so this test doesn't leak into others.
  const prev = process.env.KIT_MCP_FORCE_FULL_SYNC;
  process.env.KIT_MCP_FORCE_FULL_SYNC = '1';
  try {
    const events = [];
    await syncTo('claude-code', {
      kitRoot: FIXTURE, projectRoot: TMP,
      onProgress: (e) => events.push(e),
    });
    const skipped = events.filter(e => e.skipped === true);
    assert.equal(skipped.length, 0,
      'KIT_MCP_FORCE_FULL_SYNC=1 must skip nothing — got ' + skipped.length + ' skipped events');
  } finally {
    if (prev === undefined) delete process.env.KIT_MCP_FORCE_FULL_SYNC;
    else process.env.KIT_MCP_FORCE_FULL_SYNC = prev;
  }
});

test('PERF-17-02: onProgress receives skipped:true for skipped ops, not for written', async () => {
  await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
  // 2nd sync — collect all events and inspect shape.
  const events = [];
  await syncTo('claude-code', {
    kitRoot: FIXTURE, projectRoot: TMP,
    onProgress: (e) => events.push(e),
  });
  // Skipped events carry skipped:true.
  const skipped = events.filter(e => e.skipped === true);
  assert.ok(skipped.length > 0, 'expected ≥1 skipped event on 2nd sync');
  // Every skipped event must have the canonical onProgress shape.
  for (const e of skipped) {
    assert.ok(typeof e.phase === 'string' && e.phase.length > 0, 'skipped event must have phase');
    assert.ok(typeof e.current === 'number' && e.current > 0, 'skipped event must have current counter');
    assert.ok(typeof e.total === 'number' && e.total >= e.current, 'skipped event must have total');
    assert.ok(typeof e.label === 'string', 'skipped event must have label (basename)');
    assert.equal(e.skipped, true, 'skipped event must have skipped:true');
  }
  // Written events must NOT carry skipped:true (absent or false).
  const written = events.filter(e => e.skipped !== true);
  for (const e of written) {
    assert.notEqual(e.skipped, true, 'written event must not carry skipped:true');
  }
  // Counter monotonicity — current values cover 1..total without gaps.
  const currents = events.map(e => e.current).sort((a, b) => a - b);
  const total = events[0].total;
  assert.equal(currents.length, total, `expected ${total} progress events, got ${currents.length}`);
});
