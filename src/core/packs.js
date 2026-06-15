// Content Packs — install a SUBSET of the kit (core + opt-in domain packs).
// See docs/rfc-content-packs.md.
//
// A pack groups agents/commands/skills/workflows declared in kit/packs/<id>/pack.json.
// `core` is required and always included. Domain packs (supabase, multi-tenant, …)
// are opt-in and may declare `requires` (hard deps), `recommends` (soft), `conflicts`,
// and `provides`/`requires: capability:<x>` for stack-adapter substitution.
//
// This module is a SELECTION layer over the glob-discovered kit (src/core/kit.js):
// it never changes discovery. syncTo() applies the filter once, right after listKit().
//
// Design constraints honored:
//   - Resolver is pure/in-process; manifests are data (no eval).
//   - filterKitByPacks returns a NEW kit object (never mutates the listKit cache).
//   - Default (no selection / 'all') = no filtering = full kit (zero breaking change).

import path from 'node:path';
import fs from 'node:fs/promises';
import { resolveKitRoot } from './kit.js';
import { getTarget } from './registry.js';

export const CORE_PACK_ID = 'core';

const PACKS_CACHE_TTL_MS = 30_000;
const packsCache = new Map(); // kitRoot -> { value, ts }

export function clearPacksCache() { packsCache.clear(); }

/**
 * Read all pack manifests under kit/packs/<id>/pack.json.
 * @returns {Promise<{packs: Record<string, object>, kitRoot: string}>}
 */
export async function listPacks(kitRoot) {
  kitRoot = resolveKitRoot(kitRoot);
  const cached = packsCache.get(kitRoot);
  if (cached && Date.now() - cached.ts < PACKS_CACHE_TTL_MS) return cached.value;

  const packsDir = path.join(kitRoot, 'packs');
  let entries;
  try { entries = await fs.readdir(packsDir, { withFileTypes: true }); }
  catch { const v = { packs: {}, kitRoot }; packsCache.set(kitRoot, { value: v, ts: Date.now() }); return v; }

  const packs = {};
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = path.join(packsDir, e.name, 'pack.json');
    let raw;
    try { raw = await fs.readFile(manifestPath, 'utf8'); } catch { continue; }
    let m;
    try { m = JSON.parse(raw); }
    catch (err) {
      const wrapped = new Error(`Invalid pack manifest ${e.name}/pack.json: ${err.message}`);
      wrapped.code = 'EPACKMANIFEST';
      throw wrapped;
    }
    if (!m.id) m.id = e.name;
    packs[m.id] = m;
  }
  const value = { packs, kitRoot };
  packsCache.set(kitRoot, { value, ts: Date.now() });
  return value;
}

/**
 * Resolve a selection of pack ids into the effective set: expands `requires`
 * transitively, always includes `core`, detects cycles, validates conflicts,
 * and reports unmet capabilities + non-installed recommends as warnings.
 *
 * `requires` entries may be a pack id OR "capability:<x>" (satisfied by any
 * effective pack whose `provides` lists that capability).
 *
 * @param {string[]} selected - explicitly selected pack ids.
 * @param {Record<string,object>} catalog - id -> manifest (from listPacks().packs).
 * @returns {{effective: string[], added: string[], warnings: string[]}}
 */
export function resolvePacks(selected, catalog) {
  const warnings = [];
  const effective = new Set();
  const explicit = new Set([CORE_PACK_ID, ...(selected ?? [])]);

  const visiting = new Set();
  const visit = (id, trail) => {
    if (effective.has(id)) return;
    if (visiting.has(id)) {
      const err = new Error(`Pack dependency cycle: ${[...trail, id].join(' -> ')}`);
      err.code = 'EPACKCYCLE';
      throw err;
    }
    const pack = catalog[id];
    if (!pack) {
      const err = new Error(`Unknown pack: ${id}`);
      err.code = 'EPACKUNKNOWN';
      throw err;
    }
    visiting.add(id);
    for (const req of pack.requires ?? []) {
      if (typeof req === 'string' && req.startsWith('capability:')) continue; // resolved after closure
      visit(req, [...trail, id]);
    }
    visiting.delete(id);
    effective.add(id);
  };

  for (const id of explicit) visit(id, []);

  // Capability requirements: satisfied by any effective pack's `provides`.
  const provided = new Set();
  for (const id of effective) for (const cap of catalog[id]?.provides ?? []) provided.add(cap);
  for (const id of effective) {
    for (const req of catalog[id]?.requires ?? []) {
      if (typeof req === 'string' && req.startsWith('capability:') && !provided.has(req)) {
        warnings.push(`Pack "${id}" requer ${req} mas nenhum pack instalado o fornece.`);
      }
    }
  }

  // Conflicts: no two effective packs may conflict.
  for (const id of effective) {
    for (const con of catalog[id]?.conflicts ?? []) {
      if (effective.has(con)) {
        const err = new Error(`Pack conflict: "${id}" conflita com "${con}"`);
        err.code = 'EPACKCONFLICT';
        throw err;
      }
    }
  }

  // Recommends not installed -> soft warning.
  for (const id of effective) {
    for (const rec of catalog[id]?.recommends ?? []) {
      if (!effective.has(rec)) warnings.push(`Pack "${id}" recomenda "${rec}" (não selecionado).`);
    }
  }

  const effectiveArr = [...effective].sort();
  const added = effectiveArr.filter(id => !explicit.has(id));
  return { effective: effectiveArr, added, warnings };
}

// --- pattern matching (explicit names + simple `*` globs + `!` exclusions) ----

function patternToRegExp(p) {
  const escaped = p.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${escaped}$`);
}

export function matchAny(name, patterns) {
  if (!patterns || patterns.length === 0) return false;
  let included = false;
  let excluded = false;
  for (const p of patterns) {
    if (p.startsWith('!')) { if (patternToRegExp(p.slice(1)).test(name)) excluded = true; }
    else if (patternToRegExp(p).test(name)) included = true;
  }
  return included && !excluded;
}

/**
 * Build a selector (pattern lists per bucket) from the effective pack set.
 * @returns {{agents:string[], commands:string[], skills:string[], workflows:string[], hooks:string[]}}
 */
export function buildSelector(effective, catalog) {
  const sel = { agents: [], commands: [], skills: [], workflows: [], hooks: [] };
  for (const id of effective) {
    const r = catalog[id]?.resources ?? {};
    for (const bucket of Object.keys(sel)) {
      for (const pat of r[bucket] ?? []) sel[bucket].push(pat);
    }
  }
  return sel;
}

/**
 * Return a NEW kit with agents/commands/skills/workflows filtered to the selector.
 * skillsExtras share the skills patterns. Workflows match on fileBase.
 * Does not mutate the input (and thus not the listKit cache).
 */
export function filterKitByPacks(kit, selector) {
  return {
    ...kit,
    agents:       kit.agents.filter(it => matchAny(it.name, selector.agents)),
    commands:     kit.commands.filter(it => matchAny(it.name, selector.commands)),
    skills:       kit.skills.filter(it => matchAny(it.name, selector.skills)),
    skillsExtras: kit.skillsExtras.filter(it => matchAny(it.name, selector.skills)),
    workflows:    (kit.workflows ?? []).filter(w => matchAny(w.fileBase, selector.workflows)),
  };
}

function normalizePacks(packs) {
  if (packs == null) return null;
  const arr = Array.isArray(packs)
    ? packs
    : String(packs).split(',');
  const ids = arr.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) return null;
  if (ids.includes('all')) return null; // 'all' => no filtering
  return ids;
}

/**
 * High-level entrypoint used by syncTo: given a requested pack selection, return
 * the (possibly filtered) kit plus resolution metadata. When `packs` is absent
 * or 'all', returns the kit unchanged (full install — zero breaking change).
 *
 * @param {object} kit - the kit from listKit().
 * @param {object} [opts]
 * @param {string|string[]} [opts.packs] - selection (csv string or array); 'all'/absent = full.
 * @param {string} [opts.kitRoot]
 * @returns {Promise<{kit: object, effective: string[]|null, warnings: string[]}>}
 */
export async function applyPackFilter(kit, opts = {}) {
  const ids = normalizePacks(opts.packs);
  if (!ids) return { kit, effective: null, warnings: [] };

  const { packs: catalog } = await listPacks(opts.kitRoot);
  if (Object.keys(catalog).length === 0) {
    return { kit, effective: null, warnings: ['Nenhum manifesto de pack encontrado (kit/packs/); instalando o kit inteiro.'] };
  }
  const { effective, warnings } = resolvePacks(ids, catalog);
  const selector = buildSelector(effective, catalog);
  return { kit: filterKitByPacks(kit, selector), effective, warnings };
}

/**
 * Per-pack resource counts (the pack's OWN members, against the live kit).
 * Used by `kit pack list`. Does not expand deps.
 */
export function packResourceCounts(pack, kit) {
  const sel = buildSelector([pack.id], { [pack.id]: pack });
  return {
    agents:    kit.agents.filter(it => matchAny(it.name, sel.agents)).length,
    commands:  kit.commands.filter(it => matchAny(it.name, sel.commands)).length,
    skills:    [...kit.skills, ...kit.skillsExtras].filter(it => matchAny(it.name, sel.skills)).length,
    workflows: (kit.workflows ?? []).filter(w => matchAny(w.fileBase, sel.workflows)).length,
  };
}

// =============================================================================
// Content-pack lockfile + provenance (RFC docs/rfc-content-packs.md §5.4/§5.5)
// =============================================================================
//
// The lockfile records, PER TARGET, which packs are installed (and whether the
// user picked them explicitly vs they were pulled in as a dependency) plus the
// provenance map "pack → projected files". It lives in the target's stateDir
// (.claude/, .cursor/, …) next to the existing .kit-mcp-version marker.
//
// HARD RULE (RFC §5.4): the lockfile is written ONLY at points that know the
// pack selection — `kit pack add/remove`, `sync install --packs`, `init`. The
// hot paths (syncTo, auto-install, watch) ONLY READ it. Those orchestration
// entry points live in src/core/pack-ops.js; this module owns the primitives.

export const LOCKFILE_BASENAME = '.kit-mcp-packs.json';
export const LOCKFILE_SCHEMA_VERSION = 1;

/** Absolute path of the lockfile for a target inside a project. */
export function lockfilePathFor(targetId, projectRoot) {
  const target = getTarget(targetId);
  const stateDir = target.stateDir ?? '.kit-mcp';
  return path.join(path.resolve(projectRoot ?? process.cwd()), stateDir, LOCKFILE_BASENAME);
}

/** Read + parse the lockfile for a target. Returns null if absent/unreadable. */
export async function readLockfile(targetId, projectRoot) {
  const p = lockfilePathFor(targetId, projectRoot);
  let raw;
  try { raw = await fs.readFile(p, 'utf8'); } catch { return null; }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.packs) return null;
    return data;
  } catch { return null; }
}

/** Write the lockfile for a target (creates the stateDir). */
export async function writeLockfile(targetId, projectRoot, lockData) {
  const p = lockfilePathFor(targetId, projectRoot);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(lockData, null, 2) + '\n', 'utf8');
  return p;
}

/** The explicitly-selected pack ids recorded in a lockfile (core always wins). */
export function explicitPacksFromLockfile(lockfile) {
  if (!lockfile?.packs) return null;
  const explicit = Object.entries(lockfile.packs)
    .filter(([, v]) => v && v.explicit !== false)
    .map(([id]) => id);
  return explicit.length ? explicit : Object.keys(lockfile.packs);
}

// Mirror of syncTo()'s path conventions (src/core/sync.js). Returns the project-
// root-relative POSIX paths a single pack projects into a target — agents,
// commands, skills (dir/SKILL.md), workflows. Rules/framework/hooks are NOT
// per-pack (aggregated or always-core), so they are excluded from provenance.
// A round-trip test asserts these stay ⊆ syncTo's written[] (drift guard).
export function packProjectedFiles(pack, kit, target) {
  const sel = buildSelector([pack.id], { [pack.id]: pack });
  const files = [];
  const rel = (...segs) => segs.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
  if (target.agents) {
    const ext = target.agents.extension || '.md';
    for (const a of kit.agents) if (matchAny(a.name, sel.agents)) files.push(rel(target.agents.path, a.name + ext));
  }
  if (target.commands) {
    const ext = target.commands.extension || '.md';
    for (const c of kit.commands) if (matchAny(c.name, sel.commands)) files.push(rel(target.commands.path, c.name + ext));
  }
  if (target.skills) {
    for (const s of [...kit.skills, ...kit.skillsExtras]) if (matchAny(s.name, sel.skills)) files.push(rel(target.skills.path, s.name, 'SKILL.md'));
  }
  if (target.workflows) {
    const ext = target.workflows.extension || '.workflow.js';
    for (const w of (kit.workflows ?? [])) if (matchAny(w.fileBase, sel.workflows)) files.push(rel(target.workflows.path, w.fileBase + ext));
  }
  return files;
}

/**
 * Build the lockfile object for a target after resolving a selection.
 * @param {object} p
 * @param {string[]} p.explicit  - pack ids the user explicitly chose.
 * @param {string[]} p.effective - resolved set (incl. deps + core).
 * @param {Record<string,object>} p.catalog
 * @param {object} p.kit
 * @param {object} p.target      - registry target spec.
 * @param {string} p.kitMcpVersion
 */
export function buildLockfile({ explicit, effective, catalog, kit, target, kitMcpVersion }) {
  const explicitSet = new Set(explicit ?? []);
  const packs = {};
  const projectedFiles = {};
  for (const id of effective) {
    const pack = catalog[id];
    packs[id] = { version: pack?.version ?? kitMcpVersion, explicit: explicitSet.has(id) || id === CORE_PACK_ID };
    if (pack) projectedFiles[id] = packProjectedFiles(pack, kit, target);
  }
  return { schemaVersion: LOCKFILE_SCHEMA_VERSION, kitMcpVersion, packs, projectedFiles };
}

/**
 * Files projected EXCLUSIVELY by the removed packs — i.e. present in a removed
 * pack's projectedFiles but in NO remaining pack's projectedFiles. These are the
 * files safe to delete on `pack remove` (a file shared with a still-installed
 * pack stays). Operates purely on a lockfile's `projectedFiles` provenance.
 */
export function exclusiveFiles(lockfile, removedIds, remainingIds) {
  const pf = lockfile?.projectedFiles ?? {};
  const keep = new Set();
  for (const id of remainingIds) for (const f of pf[id] ?? []) keep.add(f);
  const out = new Set();
  for (const id of removedIds) for (const f of pf[id] ?? []) if (!keep.has(f)) out.add(f);
  return [...out];
}

/**
 * Reverse dependency closure: which installed packs (hard `requires`) would be
 * orphaned if `removedIds` go away. First-party packs declare no requires, so
 * this is empty in practice — but it guards future third-party packs.
 */
export function reverseDependents(removedIds, installedIds, catalog) {
  const removedSet = new Set(removedIds);
  const dependents = [];
  for (const id of installedIds) {
    if (removedSet.has(id)) continue;
    const reqs = (catalog[id]?.requires ?? []).filter((r) => typeof r === 'string' && !r.startsWith('capability:'));
    if (reqs.some((r) => removedSet.has(r))) dependents.push(id);
  }
  return dependents;
}
