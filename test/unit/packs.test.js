import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listKit, BUNDLED_KIT_ROOT } from '../../src/core/kit.js';
import {
  listPacks,
  resolvePacks,
  matchAny,
  buildSelector,
  filterKitByPacks,
  applyPackFilter,
  packResourceCounts,
  clearPacksCache,
  CORE_PACK_ID,
} from '../../src/core/packs.js';

async function catalog() {
  clearPacksCache();
  const { packs } = await listPacks(BUNDLED_KIT_ROOT);
  return packs;
}

// --- matchAny ----------------------------------------------------------------

test('matchAny — exact name', () => {
  assert.equal(matchAny('planner', ['planner']), true);
  assert.equal(matchAny('planner', ['executor']), false);
});

test('matchAny — glob prefix', () => {
  assert.equal(matchAny('supabase-rls-writer', ['supabase-*']), true);
  assert.equal(matchAny('legacy-characterizer', ['supabase-*']), false);
});

test('matchAny — exclusion overrides include', () => {
  assert.equal(matchAny('supabase-edge-fn-tester', ['supabase-*', '!supabase-edge-fn-tester']), false);
  assert.equal(matchAny('supabase-rls-writer', ['supabase-*', '!supabase-edge-fn-tester']), true);
});

test('matchAny — empty patterns never match', () => {
  assert.equal(matchAny('anything', []), false);
  assert.equal(matchAny('anything', undefined), false);
});

// --- self-containment invariant (no inter-pack deps) -------------------------

test('packs — NO first-party pack declares requires (self-contained)', async () => {
  const cat = await catalog();
  for (const [id, p] of Object.entries(cat)) {
    assert.deepEqual(p.requires ?? [], [], `pack "${id}" não deve ter requires (deve ser autossuficiente)`);
  }
});

test('resolvePacks — core always included', async () => {
  const cat = await catalog();
  const r = resolvePacks([], cat);
  assert.ok(r.effective.includes(CORE_PACK_ID));
});

test('resolvePacks — selecting a domain pack pulls only it + core (no extra deps)', async () => {
  const cat = await catalog();
  const r = resolvePacks(['supabase'], cat);
  assert.deepEqual(r.effective.sort(), ['core', 'supabase']);
  assert.deepEqual(r.added, []); // nada auto-incluído por dependência
});

test('resolvePacks — legacy does not pull supabase', async () => {
  const cat = await catalog();
  const r = resolvePacks(['legacy'], cat);
  assert.ok(!r.effective.includes('supabase'));
});

test('resolvePacks — unknown pack errors', async () => {
  const cat = await catalog();
  assert.throws(() => resolvePacks(['does-not-exist'], cat), /Unknown pack/);
});

// resolver still supports requires/cycle/conflict for future third-party packs
test('resolvePacks — cycle detection (synthetic)', () => {
  const cat = {
    core: { id: 'core', requires: [] },
    a: { id: 'a', requires: ['b'] },
    b: { id: 'b', requires: ['a'] },
  };
  assert.throws(() => resolvePacks(['a'], cat), /cycle/i);
});

test('resolvePacks — conflict detection (synthetic)', () => {
  const cat = {
    core: { id: 'core', requires: [] },
    a: { id: 'a', requires: [], conflicts: ['b'] },
    b: { id: 'b', requires: [] },
  };
  assert.throws(() => resolvePacks(['a', 'b'], cat), /conflict/i);
});

// --- filterKitByPacks --------------------------------------------------------

test('filterKitByPacks — core selection excludes supabase agents', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const sel = buildSelector(['core'], cat);
  const filtered = filterKitByPacks(kit, sel);
  assert.ok(filtered.agents.some((a) => a.name === 'planner'), 'core mantém planner');
  assert.ok(!filtered.agents.some((a) => a.name === 'supabase-rls-writer'), 'core não tem supabase');
});

test('filterKitByPacks — supabase pack is the whole Supabase world (incl. ex-multi-tenant + ex-ddia)', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const sel = buildSelector(['core', 'supabase'], cat);
  const f = filterKitByPacks(kit, sel);
  // raw supabase materializers
  assert.ok(f.agents.some((a) => a.name === 'supabase-rls-hardener'));
  assert.ok(f.skills.some((s) => s.name === 'supabase-migrations'));
  // merged B2B multi-tenant
  assert.ok(f.agents.some((a) => a.name === 'multi-tenant-rls-writer'));
  assert.ok(f.skills.some((s) => s.name === 'b2b-saas-architecture'));
  // merged distributed-data ("ddia")
  assert.ok(f.agents.some((a) => a.name === 'auditor-consistencia-isolamento'));
  assert.ok(f.skills.some((s) => s.name === 'tenant-quente-mitigacao'));
});

test('filterKitByPacks — does not mutate input kit', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const before = kit.agents.length;
  filterKitByPacks(kit, buildSelector(['core'], cat));
  assert.equal(kit.agents.length, before, 'kit original intacto (cache não mutado)');
});

// --- applyPackFilter (back-compat) -------------------------------------------

test('applyPackFilter — no selection returns full kit unchanged', async () => {
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const r = await applyPackFilter(kit, { kitRoot: BUNDLED_KIT_ROOT });
  assert.equal(r.kit, kit, 'mesma referência = sem filtro');
  assert.equal(r.effective, null);
});

test("applyPackFilter — 'all' returns full kit unchanged", async () => {
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const r = await applyPackFilter(kit, { packs: 'all', kitRoot: BUNDLED_KIT_ROOT });
  assert.equal(r.kit, kit);
});

test('applyPackFilter — csv string selection filters', async () => {
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const r = await applyPackFilter(kit, { packs: 'core,legacy', kitRoot: BUNDLED_KIT_ROOT });
  assert.ok(r.effective.includes('legacy'));
  assert.ok(!r.kit.agents.some((a) => a.name === 'supabase-rls-writer'));
  assert.ok(r.kit.agents.some((a) => a.name === 'legacy-characterizer'));
});

// --- coverage gate (union of packs == full kit) ------------------------------

test('pack coverage — every kit resource belongs to at least one pack', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const allIds = Object.keys(cat);
  const sel = buildSelector(allIds, cat);
  const orphans = [];
  for (const a of kit.agents) if (!matchAny(a.name, sel.agents)) orphans.push(`agent/${a.name}`);
  for (const cmd of kit.commands) if (!matchAny(cmd.name, sel.commands)) orphans.push(`command/${cmd.name}`);
  for (const s of [...kit.skills, ...kit.skillsExtras]) if (!matchAny(s.name, sel.skills)) orphans.push(`skill/${s.name}`);
  for (const w of kit.workflows ?? []) if (!matchAny(w.fileBase, sel.workflows)) orphans.push(`workflow/${w.fileBase}`);
  assert.deepEqual(orphans, [], `recursos órfãos (em pack nenhum): ${orphans.join(', ')}`);
});

test('packResourceCounts — core 16 agents, supabase 33 agents', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  assert.equal(packResourceCounts(cat.core, kit).agents, 16);
  assert.equal(packResourceCounts(cat.supabase, kit).agents, 33);
});
