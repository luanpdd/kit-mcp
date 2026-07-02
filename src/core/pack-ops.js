// Content-pack orchestration (RFC docs/rfc-content-packs.md §5.5 / §10 Fase 3).
//
// High-level operations that COMBINE projection (syncTo) with the lockfile and
// selective removal. Kept separate from packs.js (pure resolver/primitives) and
// sync.js (projection) so the lockfile-writing entry points are explicit and the
// hot paths (syncTo/auto-install/watch) stay read-only re: the lockfile.
//
//   installPacks  — `sync install --packs` / `init`: project a selection + write lockfile.
//   addPacks      — `pack add <id…>`: union with existing selection, re-sync, write lockfile.
//   removePacks   — `pack remove <id…>`: delete exclusive files, re-sync remainder, write lockfile.
//
// add/remove iterate over every installed target (detectExistingTargets) unless
// a target is pinned, so a pack never goes ghost in one IDE.

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getTarget, listTargets } from './registry.js';
import { listKit, resolveKitRoot } from './kit.js';
import { syncTo, isManagedStub } from './sync.js';
import { detectExistingTargets } from './watch.js';
import fs from 'node:fs/promises';
import {
  listPacks, resolvePacks, buildLockfile, readLockfile, writeLockfile,
  lockfilePathFor, explicitPacksFromLockfile, exclusiveFiles, reverseDependents,
  packProjectedFiles, CORE_PACK_ID,
} from './packs.js';

function readPkgVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(path.resolve(here, '..', '..', 'package.json'), 'utf8')).version;
  } catch { return 'unknown'; }
}
export const PKG_VERSION = readPkgVersion();

// Synthesize a lockfile representing "all packs, explicit" — used to backfill a
// project that has files but no lockfile (RFC §10 Fase 2 backfill) before the
// first add/remove so selective ops have a provenance baseline.
function synthesizeAllPacksLockfile(catalog, kit, target) {
  const ids = Object.keys(catalog);
  return buildLockfile({ explicit: ids, effective: ids, catalog, kit, target, kitMcpVersion: PKG_VERSION });
}

/**
 * Project a pack selection into a target AND write the lockfile.
 * Used by `sync install --packs` and `init`.
 * @returns {Promise<{sync, lockfile, effective, added, warnings}>}
 */
export async function installPacks(targetId, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot = resolveKitRoot(opts.kitRoot);
  const mode = opts.mode ?? 'reference';
  const explicit = normalizeIds(opts.packs);
  const target = getTarget(targetId);
  const { packs: catalog } = await listPacks(kitRoot);
  const { effective, added, warnings } = resolvePacks(explicit ?? [], catalog);

  const sync = await syncTo(targetId, { projectRoot, kitRoot, mode, packs: effective, onProgress: opts.onProgress });
  const kit = await listKit(kitRoot);
  const lock = buildLockfile({ explicit: explicit ?? effective, effective, catalog, kit, target, kitMcpVersion: PKG_VERSION });
  const lockfile = await writeLockfile(targetId, projectRoot, lock);
  return { sync, lockfile, effective, added, warnings };
}

/**
 * Add packs to the current selection across the installed targets (or a pinned
 * target). Re-syncs each so the new pack's files appear, then rewrites the lockfile.
 * @returns {Promise<{results: Array, warnings: string[]}>}
 */
export async function addPacks(packIds, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot = resolveKitRoot(opts.kitRoot);
  const mode = opts.mode ?? 'reference';
  const ids = normalizeIds(packIds) ?? [];
  if (ids.length === 0) throw Object.assign(new Error('Nenhum pack informado para adicionar.'), { code: 'EPACKNOOP' });

  const { packs: catalog } = await listPacks(kitRoot);
  for (const id of ids) if (!catalog[id]) throw Object.assign(new Error(`Pack desconhecido: ${id}`), { code: 'EPACKUNKNOWN' });

  const kit = await listKit(kitRoot);
  const targets = await resolveTargets(opts.targets, projectRoot);
  const results = [];
  const warnings = [];
  for (const targetId of targets) {
    const target = getTarget(targetId);
    let lockfile = await readLockfile(targetId, projectRoot);
    const prevExplicit = lockfile ? explicitPacksFromLockfile(lockfile) : Object.keys(catalog); // no lock ⇒ all
    const newExplicit = [...new Set([...prevExplicit, ...ids])];
    const { effective, added, warnings: w } = resolvePacks(newExplicit, catalog);
    warnings.push(...w.map((m) => `[${targetId}] ${m}`));
    const sync = await syncTo(targetId, { projectRoot, kitRoot, mode, packs: effective, onProgress: opts.onProgress });
    const lock = buildLockfile({ explicit: newExplicit, effective, catalog, kit, target, kitMcpVersion: PKG_VERSION });
    const lockfilePath = await writeLockfile(targetId, projectRoot, lock);
    results.push({ target: targetId, added: ids, effective, autoIncluded: added, written: (sync.written || []).length, lockfile: lockfilePath });
  }
  return { results, warnings };
}

/**
 * Remove packs from the current selection across installed targets. Deletes only
 * files projected EXCLUSIVELY by the removed packs (reconfirming the kit-managed
 * stub marker before each delete), re-syncs the remainder (refreshes aggregated
 * rules + router), then rewrites the lockfile.
 * @returns {Promise<{results: Array}>}
 */
export async function removePacks(packIds, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot = resolveKitRoot(opts.kitRoot);
  const mode = opts.mode ?? 'reference';
  const cascade = !!opts.cascade;
  const ids = normalizeIds(packIds) ?? [];
  if (ids.length === 0) throw Object.assign(new Error('Nenhum pack informado para remover.'), { code: 'EPACKNOOP' });

  const { packs: catalog } = await listPacks(kitRoot);
  for (const id of ids) {
    if (id === CORE_PACK_ID || catalog[id]?.removable === false) {
      throw Object.assign(new Error(`Pack "${id}" não é removível (core/fixo).`), { code: 'EPACKNOTREMOVABLE' });
    }
    if (!catalog[id]) throw Object.assign(new Error(`Pack desconhecido: ${id}`), { code: 'EPACKUNKNOWN' });
  }

  const kit = await listKit(kitRoot);
  const targets = await resolveTargets(opts.targets, projectRoot);
  const results = [];
  for (const targetId of targets) {
    const target = getTarget(targetId);
    let lockfile = await readLockfile(targetId, projectRoot);
    if (!lockfile) lockfile = synthesizeAllPacksLockfile(catalog, kit, target); // backfill

    const installed = Object.keys(lockfile.packs);
    const removableHere = ids.filter((id) => installed.includes(id));
    if (removableHere.length === 0) { results.push({ target: targetId, skipped: 'pack(s) não instalados neste target' }); continue; }

    // Reverse-dep guard (first-party: supabase requires observability; also 3rd-party).
    const dependents = reverseDependents(removableHere, installed, catalog);
    if (dependents.length && !cascade) {
      throw Object.assign(
        new Error(`Não é possível remover ${removableHere.join(', ')}: requerido(s) por ${dependents.join(', ')}. Use --cascade.`),
        { code: 'EPACKDEPENDED', dependents },
      );
    }
    const removedIds = cascade ? [...new Set([...removableHere, ...dependents])] : removableHere;
    const remainingIds = installed.filter((id) => !removedIds.includes(id));
    if (!remainingIds.includes(CORE_PACK_ID)) remainingIds.push(CORE_PACK_ID);

    // Delete files exclusive to the removed packs, reconfirming the stub marker.
    const exclusive = exclusiveFiles(lockfile, removedIds, remainingIds);
    const deleted = [];
    const preserved = [];
    const failed = [];
    for (const relFile of exclusive) {
      const abs = path.join(projectRoot, relFile);
      // Skills are projected as <name>/SKILL.md — remove the whole skill DIR so we
      // don't leave an empty folder behind (matches removeFrom in sync.js). The
      // stub check still reads the SKILL.md marker via the file path.
      const isSkill = relFile.endsWith('/SKILL.md') || relFile.endsWith('\\SKILL.md');
      const removeTarget = isSkill ? path.dirname(abs) : abs;
      if (await isManagedStub(abs)) {
        try {
          await fs.rm(removeTarget, { recursive: true, force: true });
          deleted.push(relFile);
        } catch (e) {
          // Don't report a file as deleted if rm actually failed (e.g. EPERM/EBUSY
          // on a file locked by the IDE on Windows) — that would mislead the user.
          failed.push(relFile);
        }
      } else {
        preserved.push(relFile);
      }
    }

    // Re-sync the remainder so aggregated rules (CLAUDE.md) + router regenerate
    // without the removed domains. Won't recreate the files we just deleted.
    const remainingExplicit = (explicitPacksFromLockfile(lockfile) || installed).filter((id) => remainingIds.includes(id));
    const { effective } = resolvePacks(remainingExplicit, catalog);
    const sync = await syncTo(targetId, { projectRoot, kitRoot, mode, packs: effective, onProgress: opts.onProgress });

    const lock = buildLockfile({ explicit: remainingExplicit, effective, catalog, kit, target, kitMcpVersion: PKG_VERSION });
    const lockfilePath = await writeLockfile(targetId, projectRoot, lock);
    results.push({ target: targetId, removed: removedIds, deleted, preserved, failed, remaining: effective, written: (sync.written || []).length, lockfile: lockfilePath });
  }
  return { results };
}

// --- helpers -----------------------------------------------------------------

function normalizeIds(ids) {
  if (ids == null) return null;
  const arr = Array.isArray(ids) ? ids : String(ids).split(',');
  const out = arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  return out.length ? out : null;
}

// Which targets to operate on: explicit list, else every target with a lockfile,
// else every target that has projected files (detectExistingTargets), else fail.
async function resolveTargets(explicitTargets, projectRoot) {
  if (explicitTargets && explicitTargets.length) return explicitTargets;
  const withLock = [];
  for (const t of listTargets()) {
    try { await fs.access(lockfilePathFor(t.id, projectRoot)); withLock.push(t.id); } catch {}
  }
  if (withLock.length) return withLock;
  const detected = await detectExistingTargets({ projectRoot });
  if (detected.length) return detected;
  throw Object.assign(new Error('Nenhum target instalado neste projeto. Rode `kit sync install <ide>` ou `kit init` primeiro.'), { code: 'EPACKNOTARGET' });
}
