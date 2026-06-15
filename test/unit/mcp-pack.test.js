// MCP `pack` tool + auto-install lockfile preservation (Content Packs Fase 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { HANDLERS, __TEST_HANDLERS } from '../../src/mcp-server/index.js';
import { installPacks } from '../../src/core/pack-ops.js';
import { readLockfile } from '../../src/core/packs.js';

const handlePack = HANDLERS.pack;
const { handleAutoInstall } = __TEST_HANDLERS;

async function makeWorkspace(name) {
  const dir = path.join(os.tmpdir(), `kit-mcp-pack-${name}-${Date.now()}-${process.pid}`);
  await fs.mkdir(dir, { recursive: true });
  execSync('git init -q', { cwd: dir });
  return dir;
}

test('pack tool — action=list returns catalog with core first', async () => {
  const r = await handlePack({ action: 'list' });
  assert.ok(Array.isArray(r));
  assert.equal(r[0].id, 'core');
  assert.ok(r.some((p) => p.id === 'supabase'));
});

test('pack tool — action=resolve expands selection', async () => {
  const r = await handlePack({ action: 'resolve', packs: ['legacy'] });
  assert.deepEqual(r.effective.sort(), ['core', 'legacy']);
});

test('pack tool — action=info unknown pack returns error', async () => {
  const r = await handlePack({ action: 'info', id: 'nope' });
  assert.ok(r.error);
});

test('pack tool — store is blocked in MCP', async () => {
  const r = await handlePack({ action: 'store' });
  assert.match(r.error, /TTY/);
});

test('pack tool — doctor reports installed lockfiles', async () => {
  const dir = await makeWorkspace('doctor');
  try {
    await installPacks('claude-code', { projectRoot: dir, packs: 'core,legacy' });
    const r = await handlePack({ action: 'doctor', projectRoot: dir });
    const cc = r.targets.find((t) => t.target === 'claude-code');
    assert.ok(cc);
    assert.deepEqual(cc.packs.map((p) => p.id).sort(), ['core', 'legacy']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('auto-install — preserves the lockfile pack selection on re-sync', async () => {
  const dir = await makeWorkspace('autoinstall-lock');
  try {
    await installPacks('claude-code', { projectRoot: dir, packs: 'core,legacy' });
    // Force a re-sync via auto-install — must respect the locked subset.
    const r = await handleAutoInstall({ action: 'install', force: true, projectRoot: dir });
    assert.equal(r.ok, true);
    // legacy stays, supabase never appears (lockfile said core,legacy only)
    await fs.access(path.join(dir, '.claude', 'agents', 'legacy-characterizer.md'));
    await assert.rejects(fs.access(path.join(dir, '.claude', 'agents', 'supabase-rls-writer.md')));
    // Lockfile untouched by auto-install (hard rule: read-only).
    const lf = await readLockfile('claude-code', dir);
    assert.deepEqual(Object.keys(lf.packs).sort(), ['core', 'legacy']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
