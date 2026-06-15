// Content Packs Fase 3 (RFC §5.4/§5.5): lockfile + add/remove + provenance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listKit, BUNDLED_KIT_ROOT } from '../../src/core/kit.js';
import { getTarget } from '../../src/core/registry.js';
import {
  buildLockfile, packProjectedFiles, exclusiveFiles, reverseDependents,
  lockfilePathFor, readLockfile, writeLockfile, explicitPacksFromLockfile,
  listPacks, clearPacksCache,
} from '../../src/core/packs.js';
import { installPacks, addPacks, removePacks } from '../../src/core/pack-ops.js';
import { syncTo } from '../../src/core/sync.js';

process.env.KIT_MCP_NO_UI = '1';

async function tmpProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'kit-packs-'));
}
async function catalog() {
  clearPacksCache();
  return (await listPacks(BUNDLED_KIT_ROOT)).packs;
}

// --- pure helpers ------------------------------------------------------------

test('lockfilePathFor — uses target stateDir', () => {
  const p = lockfilePathFor('claude-code', '/proj');
  assert.ok(p.replace(/\\/g, '/').endsWith('/proj/.claude/.kit-mcp-packs.json'));
  const c = lockfilePathFor('cursor', '/proj');
  assert.ok(c.replace(/\\/g, '/').endsWith('/proj/.cursor/.kit-mcp-packs.json'));
});

test('exclusiveFiles — only files unique to removed packs', () => {
  const lf = { projectedFiles: {
    core: ['a.md'],
    legacy: ['leg1.md', 'shared.md'],
    supabase: ['sup1.md', 'shared.md'],
  } };
  // remove legacy, keep core+supabase → shared.md stays (supabase has it), leg1.md goes
  assert.deepEqual(exclusiveFiles(lf, ['legacy'], ['core', 'supabase']).sort(), ['leg1.md']);
  // remove both legacy+supabase → shared.md now exclusive to the removed set
  assert.deepEqual(exclusiveFiles(lf, ['legacy', 'supabase'], ['core']).sort(), ['leg1.md', 'shared.md', 'sup1.md']);
});

test('reverseDependents — first-party packs have none', async () => {
  const cat = await catalog();
  assert.deepEqual(reverseDependents(['supabase'], Object.keys(cat), cat), []);
});

test('reverseDependents — synthetic third-party dep', () => {
  const cat = { core: { id: 'core' }, base: { id: 'base' }, ext: { id: 'ext', requires: ['base'] } };
  assert.deepEqual(reverseDependents(['base'], ['core', 'base', 'ext'], cat), ['ext']);
});

test('packProjectedFiles ⊆ syncTo written[] (drift guard)', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const target = getTarget('claude-code');
  const tmp = await tmpProject();
  try {
    const r = await syncTo('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, mode: 'reference', packs: ['core', 'legacy'] });
    const writtenRel = new Set(r.written.map((p) => path.relative(tmp, p).replace(/\\/g, '/')));
    for (const id of ['core', 'legacy']) {
      for (const f of packProjectedFiles(cat[id], kit, target)) {
        assert.ok(writtenRel.has(f), `projectedFiles[${id}] entry "${f}" not in syncTo written[]`);
      }
    }
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

// --- integration: install → add → remove -------------------------------------

test('installPacks writes lockfile + projects only the selection', async () => {
  const tmp = await tmpProject();
  try {
    const r = await installPacks('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, packs: 'core,legacy' });
    assert.deepEqual(r.effective.sort(), ['core', 'legacy']);
    const lf = await readLockfile('claude-code', tmp);
    assert.ok(lf, 'lockfile written');
    assert.deepEqual(Object.keys(lf.packs).sort(), ['core', 'legacy']);
    assert.ok(lf.projectedFiles.legacy.length > 0);
    // legacy agent present, supabase agent absent
    await fs.access(path.join(tmp, '.claude', 'agents', 'legacy-characterizer.md'));
    await assert.rejects(fs.access(path.join(tmp, '.claude', 'agents', 'supabase-rls-writer.md')));
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('addPacks expands selection + re-syncs', async () => {
  const tmp = await tmpProject();
  try {
    await installPacks('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, packs: 'core,legacy' });
    const r = await addPacks(['observability'], { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT });
    assert.equal(r.results.length, 1);
    assert.ok(r.results[0].effective.includes('observability'));
    await fs.access(path.join(tmp, '.claude', 'agents', 'golden-signals-instrumenter.md'));
    const lf = await readLockfile('claude-code', tmp);
    assert.deepEqual(Object.keys(lf.packs).sort(), ['core', 'legacy', 'observability']);
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('removePacks deletes exclusive files, preserves shared + remaining', async () => {
  const tmp = await tmpProject();
  try {
    await installPacks('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, packs: 'core,legacy,observability' });
    const r = await removePacks(['legacy'], { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT });
    assert.equal(r.results[0].deleted.length > 0, true);
    // legacy-exclusive agent gone; observability + core remain
    await assert.rejects(fs.access(path.join(tmp, '.claude', 'agents', 'legacy-characterizer.md')));
    await fs.access(path.join(tmp, '.claude', 'agents', 'golden-signals-instrumenter.md'));
    await fs.access(path.join(tmp, '.claude', 'agents', 'planner.md'));
    const lf = await readLockfile('claude-code', tmp);
    assert.deepEqual(Object.keys(lf.packs).sort(), ['core', 'observability']);
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('removePacks — multi-rules target deletes per-agent rule stubs too (no orphans)', async () => {
  // cursor uses rules.mode='multi' → one rule stub per agent at .cursor/rules/<a>.mdc.
  const tmp = await tmpProject();
  try {
    await installPacks('cursor', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, packs: 'core,legacy' });
    const ruleStub = path.join(tmp, '.cursor', 'rules', 'legacy-characterizer.mdc');
    const agentStub = path.join(tmp, '.cursor', 'agents', 'legacy-characterizer.md');
    await fs.access(ruleStub);  // present after install
    await fs.access(agentStub);
    await removePacks(['legacy'], { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT });
    // both the agent file AND its sibling rule stub must be gone
    await assert.rejects(fs.access(agentStub), 'agent stub deleted');
    await assert.rejects(fs.access(ruleStub), 'orphan rule stub deleted');
    // a remaining pack's rule stub stays
    await fs.access(path.join(tmp, '.cursor', 'rules', 'planner.mdc'));
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('removePacks — skill removal leaves no empty dir', async () => {
  const tmp = await tmpProject();
  try {
    await installPacks('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, packs: 'core,legacy' });
    // pick a legacy-exclusive skill dir
    const skillDir = path.join(tmp, '.claude', 'skills', 'legacy-characterization-tests');
    await fs.access(skillDir);
    await removePacks(['legacy'], { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT });
    await assert.rejects(fs.access(skillDir), 'empty skill dir removed (not just SKILL.md)');
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('removePacks refuses core', async () => {
  const tmp = await tmpProject();
  try {
    await installPacks('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, packs: 'core,legacy' });
    await assert.rejects(() => removePacks(['core'], { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT }), /não é removível/);
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('removePacks preserves user-edited (non-stub) files', async () => {
  const tmp = await tmpProject();
  try {
    await installPacks('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, packs: 'core,legacy' });
    const edited = path.join(tmp, '.claude', 'agents', 'legacy-characterizer.md');
    await fs.writeFile(edited, '# my own edits, no stub marker\n', 'utf8');
    const r = await removePacks(['legacy'], { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT });
    assert.ok(r.results[0].preserved.some((f) => f.endsWith('legacy-characterizer.md')), 'edited file preserved');
    await fs.access(edited); // still there
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('writeLockfile/readLockfile round-trip + explicitPacksFromLockfile', async () => {
  const tmp = await tmpProject();
  try {
    const cat = await catalog();
    const kit = await listKit(BUNDLED_KIT_ROOT);
    const target = getTarget('claude-code');
    const lock = buildLockfile({ explicit: ['legacy'], effective: ['core', 'legacy'], catalog: cat, kit, target, kitMcpVersion: '9.9.9' });
    await writeLockfile('claude-code', tmp, lock);
    const back = await readLockfile('claude-code', tmp);
    assert.equal(back.kitMcpVersion, '9.9.9');
    assert.equal(back.packs.core.explicit, true); // core always explicit
    assert.equal(back.packs.legacy.explicit, true);
    assert.deepEqual(explicitPacksFromLockfile(back).sort(), ['core', 'legacy']);
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
