// Content Packs Fase 4 (DIR-03): grafo REAL de dependências entre packs.
//
// Estes testes reconstroem o grafo cross-pack a partir do CONTEÚDO dos recursos
// (dispatches `Task(subagent_type=...)` e links markdown relativos) e validam
// que os campos `requires`/`recommends` dos pack.json cobrem esse grafo. É o
// gate que impede o grafo de regredir: um dispatch/link cross-pack novo sem
// declaração correspondente falha aqui.
//
// Semântica (docs/rfc-content-packs.md + src/core/packs.js):
//   - `requires`   = dependência DURA — fecho transitivo em resolvePacks(),
//                    bloqueia remoção via reverseDependents() (EPACKDEPENDED).
//   - `recommends` = dependência MOLE — só warning em resolvePacks(), não puxa
//                    o pack nem bloqueia remoção.
//
// Matriz auditada (varredura dos recursos declarados em cada pack.json —
// agents/commands/skills — em 2026-07-01):
//
//   origem        → destino         HARD (Task dispatch)  SOFT (links .md)  declarado
//   ------------------------------------------------------------------------------
//   core          → legacy          4 (executor×3, auditar-marco)      8    recommends*
//   core          → observability   3 (auditar-marco, concluir-marco,
//                                      verificar-trabalho)            28    recommends*
//   core          → supabase       13 (executor×9, planner×2,
//                                      debugger, depurar)              6    recommends*
//   core          → ui              0 (dispatch dinâmico advisor-auditor)
//                                                                      1    recommends*
//   legacy        → observability   0                                 17    recommends
//   legacy        → supabase        0                                  9    recommends
//   observability → legacy          0                                 10    recommends
//   observability → supabase        0                                 11    recommends
//   supabase      → observability   1 (supabase-cicd-pipeline-implementer
//                                      Step 5 → release-pipeline-auditor,
//                                      handoff obrigatório sem fallback)
//                                                                     72    REQUIRES
//   supabase      → legacy          0                                 21    recommends
//   cost-workflow → (nenhuma aresta de saída)                               —
//   ui            → (só skill do core, implícito)                           —
//
// (*) Por que os dispatches do core NÃO viram `requires`: resolvePacks() injeta
// `core` em TODA resolução (CORE_PACK_ID) — um `requires` no core puxaria todos
// os packs em qualquer seleção e anularia a modularidade inteira. O RFC (§4 e
// §6.1) trata os dispatches do core como soft-deps com fallback graceful
// DOCUMENTADO no próprio conteúdo ("Fallback graceful (Content Packs)" em
// executor.md, planner.md, debugger.md) → viram `recommends`. Para packs de
// DOMÍNIO, dispatch cross-pack é dependência dura (requires) — sem exceção.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listKit, BUNDLED_KIT_ROOT } from '../../src/core/kit.js';
import {
  listPacks,
  resolvePacks,
  matchAny,
  clearPacksCache,
  CORE_PACK_ID,
} from '../../src/core/packs.js';

async function catalog() {
  clearPacksCache();
  const { packs } = await listPacks(BUNDLED_KIT_ROOT);
  return packs;
}

// --- extração do grafo a partir do conteúdo -----------------------------------

// Task(subagent_type="x") | subagent_type='x' | subagent_type=x | subagent_type: x
const DISPATCH_RE = /subagent_type\s*[:=]\s*["']?([a-z0-9][a-z0-9-]*)/g;
// links markdown relativos, resolvidos pela forma do path
const AGENT_LINK_RE = /\]\((?:\.\.\/)+agents\/([a-z0-9-]+)\.md\)/g;
const COMMAND_LINK_RE = /\]\((?:\.\.\/)+commands\/([a-z0-9-]+)\.md\)/g;
const SKILL_LINK_RE = /\]\((?:\.\.\/)+(?:skills\/)?([a-z0-9-]+)\/SKILL\.md\)/g;
// link para irmão do mesmo bucket (agent→agent, command→command)
const SIBLING_LINK_RE = /\]\(\.\/([a-z0-9-]+)\.md\)/g;

// packs (ids) que declaram `name` no bucket dado
function ownersOf(name, bucket, cat) {
  return Object.values(cat)
    .filter((p) => matchAny(name, p.resources?.[bucket] ?? []))
    .map((p) => p.id);
}

// recursos do kit que pertencem ao pack, por bucket (resolve globs do manifesto)
function membersOf(pack, kit) {
  return {
    agents: kit.agents.filter((it) => matchAny(it.name, pack.resources?.agents ?? [])),
    commands: kit.commands.filter((it) => matchAny(it.name, pack.resources?.commands ?? [])),
    skills: [...kit.skills, ...kit.skillsExtras].filter((it) => matchAny(it.name, pack.resources?.skills ?? [])),
  };
}

// Todas as arestas de saída de um pack: { kind: 'hard'|'soft', dstPacks, evidence }.
// hard = dispatch Task(subagent_type) para agent de outro pack;
// soft = link markdown para agent/command/skill de outro pack.
function outgoingEdges(pack, kit, cat) {
  const edges = [];
  const push = (kind, name, bucket, evidence) => {
    const dstPacks = ownersOf(name, bucket, cat).filter((id) => id !== pack.id);
    if (dstPacks.length === 0) return; // recurso próprio, inexistente ou nome genérico
    edges.push({ kind, target: `${bucket}/${name}`, dstPacks, evidence });
  };
  const members = membersOf(pack, kit);
  for (const [bucket, items] of Object.entries(members)) {
    for (const item of items) {
      const text = item.content ?? '';
      const at = `${bucket}/${item.name}`;
      for (const m of text.matchAll(DISPATCH_RE)) push('hard', m[1], 'agents', `${at} → Task(${m[1]})`);
      for (const m of text.matchAll(AGENT_LINK_RE)) push('soft', m[1], 'agents', `${at} → link agents/${m[1]}`);
      for (const m of text.matchAll(COMMAND_LINK_RE)) push('soft', m[1], 'commands', `${at} → link commands/${m[1]}`);
      for (const m of text.matchAll(SKILL_LINK_RE)) push('soft', m[1], 'skills', `${at} → link skills/${m[1]}`);
      if (bucket === 'agents' || bucket === 'commands') {
        for (const m of text.matchAll(SIBLING_LINK_RE)) push('soft', m[1], bucket, `${at} → link ./${m[1]}.md`);
      }
    }
  }
  return edges;
}

// fecho de requires do pack (resolvePacks já injeta core)
function requiresClosure(id, cat) {
  return new Set(resolvePacks([id], cat).effective);
}

// --- gates ---------------------------------------------------------------------

test('pack graph — dispatch cross-pack de pack de DOMÍNIO está no fecho de requires', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const violations = [];
  for (const pack of Object.values(cat)) {
    if (pack.id === CORE_PACK_ID) continue; // core é soft-dep por design (ver header)
    const closure = requiresClosure(pack.id, cat);
    for (const e of outgoingEdges(pack, kit, cat)) {
      if (e.kind !== 'hard') continue;
      if (!e.dstPacks.some((d) => closure.has(d))) {
        violations.push(`${pack.id}: ${e.evidence} → pack(s) ${e.dstPacks.join('/')} fora do fecho de requires`);
      }
    }
  }
  assert.deepEqual(violations, [], `dispatches cross-pack sem requires:\n${violations.join('\n')}`);
});

test('pack graph — dispatch cross-pack do CORE está coberto por recommends (soft-dep com fallback)', async () => {
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const core = cat[CORE_PACK_ID];
  const allowed = new Set([...requiresClosure(CORE_PACK_ID, cat), ...(core.recommends ?? [])]);
  const violations = [];
  for (const e of outgoingEdges(core, kit, cat)) {
    if (e.kind !== 'hard') continue;
    if (!e.dstPacks.some((d) => allowed.has(d))) {
      violations.push(`core: ${e.evidence} → pack(s) ${e.dstPacks.join('/')} nem em requires nem em recommends`);
    }
  }
  assert.deepEqual(violations, [], `dispatches do core não declarados:\n${violations.join('\n')}`);
});

test('pack graph — todo link markdown cross-pack está coberto por requires ∪ recommends', async () => {
  // é o gate de coesão do DIR-03: instalar um pack não pode deixar cross-links
  // órfãos NÃO DECLARADOS — todo link para outro pack é no mínimo um recommends.
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  const violations = [];
  for (const pack of Object.values(cat)) {
    const allowed = new Set([...requiresClosure(pack.id, cat), ...(pack.recommends ?? [])]);
    for (const e of outgoingEdges(pack, kit, cat)) {
      if (e.kind !== 'soft') continue;
      if (!e.dstPacks.some((d) => allowed.has(d))) {
        violations.push(`${pack.id}: ${e.evidence} → pack(s) ${e.dstPacks.join('/')} não declarado(s)`);
      }
    }
  }
  assert.deepEqual(violations, [], `cross-links órfãos não declarados:\n${violations.join('\n')}`);
});

test('pack graph — requires declarados são justificados por dispatch real (anti-mentira)', async () => {
  // impede o caminho inverso da regressão: declarar hard dep que o conteúdo não
  // sustenta (inflaria instalações). Se um requires novo for legítimo sem
  // dispatch, atualize a matriz no header deste arquivo junto.
  const cat = await catalog();
  const kit = await listKit(BUNDLED_KIT_ROOT);
  for (const pack of Object.values(cat)) {
    const hardDsts = new Set(
      outgoingEdges(pack, kit, cat)
        .filter((e) => e.kind === 'hard')
        .flatMap((e) => e.dstPacks),
    );
    for (const req of pack.requires ?? []) {
      if (typeof req === 'string' && req.startsWith('capability:')) continue;
      assert.ok(
        hardDsts.has(req),
        `pack "${pack.id}" declara requires "${req}" sem nenhum dispatch Task(subagent_type) que o justifique`,
      );
    }
  }
});

test('pack graph — requires/recommends referenciam packs existentes', async () => {
  const cat = await catalog();
  for (const pack of Object.values(cat)) {
    for (const req of pack.requires ?? []) {
      if (typeof req === 'string' && req.startsWith('capability:')) continue;
      assert.ok(cat[req], `pack "${pack.id}" requires pack inexistente "${req}"`);
    }
    for (const rec of pack.recommends ?? []) {
      assert.ok(cat[rec], `pack "${pack.id}" recommends pack inexistente "${rec}"`);
    }
  }
});

test('pack graph — o grafo declarado bate com a matriz auditada (snapshot)', async () => {
  // Congela a forma do grafo first-party. Mudou o conteúdo? Os gates acima
  // apontam o gap; este snapshot obriga a decisão consciente (matriz no header).
  const cat = await catalog();
  const declared = {};
  for (const [id, p] of Object.entries(cat)) {
    declared[id] = { requires: [...(p.requires ?? [])].sort(), recommends: [...(p.recommends ?? [])].sort() };
  }
  assert.deepEqual(declared, {
    core: { requires: [], recommends: ['legacy', 'observability', 'supabase', 'ui'] },
    'cost-workflow': { requires: [], recommends: [] },
    legacy: { requires: [], recommends: ['observability', 'supabase'] },
    observability: { requires: [], recommends: ['legacy', 'supabase'] },
    supabase: { requires: ['observability'], recommends: ['legacy'] },
    ui: { requires: [], recommends: [] },
  });
});

test('pack graph — instalar só supabase puxa observability (fecho transitivo do hard dep)', async () => {
  const cat = await catalog();
  const r = resolvePacks(['supabase'], cat);
  assert.deepEqual(r.effective.sort(), ['core', 'observability', 'supabase']);
  assert.deepEqual(r.added, ['observability'], 'observability entra por dependência, não por seleção');
});
