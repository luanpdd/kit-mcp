#!/usr/bin/env node
// Regenerate kit/packs/registry.json — the aggregated "store catalog" of all
// local content packs (docs/rfc-content-packs.md §5.1). Derived data only:
//   { schemaVersion, packs: { <id>: { name, version, description, kind,
//       removable, requires, recommends, conflicts, provides, counts } } }
//
// counts are resolved against the live kit (listKit) so the store/menu can show
// "20 agents · 35 skills" without re-resolving globs at read time.
//
// Idempotent: if the produced JSON is byte-identical to the existing file, it is
// NOT rewritten (preserves an empty git diff). No timestamp field (would break
// idempotency). Must run BEFORE regen-manifest.js (registry.json is hashed there).
//
//   node scripts/regen-pack-registry.js
//   node scripts/regen-pack-registry.js --check   # fail if out of date / coverage gap

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { listKit } from '../src/core/kit.js';
import { listPacks, packResourceCounts, buildSelector, matchAny } from '../src/core/packs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const KIT_ROOT = path.join(REPO_ROOT, 'kit');
const REGISTRY_PATH = path.join(KIT_ROOT, 'packs', 'registry.json');
const CHECK_ONLY = process.argv.includes('--check');

function sortedIds(catalog) {
  return Object.keys(catalog).sort((a, b) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)));
}

export async function buildRegistry() {
  const [{ packs: catalog }, kit] = await Promise.all([listPacks(KIT_ROOT), listKit(KIT_ROOT)]);
  const ids = sortedIds(catalog);
  const packs = {};
  for (const id of ids) {
    const p = catalog[id];
    packs[id] = {
      name: p.name,
      version: p.version,
      description: p.description,
      kind: p.kind,
      removable: p.removable !== false,
      requires: p.requires ?? [],
      recommends: p.recommends ?? [],
      conflicts: p.conflicts ?? [],
      provides: p.provides ?? [],
      counts: packResourceCounts(p, kit),
    };
  }

  // Coverage check: union of all pack members must equal the full kit.
  const coverage = checkCoverage(catalog, kit);
  return { registry: { schemaVersion: 1, packs }, coverage };
}

function checkCoverage(catalog, kit) {
  const ids = Object.keys(catalog);
  const gaps = [];
  const buckets = {
    agents: kit.agents.map((x) => x.name),
    commands: kit.commands.map((x) => x.name),
    skills: [...kit.skills, ...kit.skillsExtras].map((x) => x.name),
    workflows: (kit.workflows ?? []).map((x) => x.fileBase),
  };
  for (const bucket of Object.keys(buckets)) {
    for (const name of buckets[bucket]) {
      const owners = ids.filter((id) => {
        const sel = buildSelector([id], { [id]: catalog[id] });
        const patterns = bucket === 'skills' ? sel.skills : sel[bucket];
        return matchAny(name, patterns);
      });
      if (owners.length === 0) gaps.push(`${bucket}/${name} — órfão (nenhum pack)`);
    }
  }
  return { ok: gaps.length === 0, gaps };
}

export async function regenPackRegistry() {
  const { registry, coverage } = await buildRegistry();
  if (!coverage.ok) {
    const err = new Error(`Pack coverage gap:\n  ${coverage.gaps.join('\n  ')}`);
    err.code = 'EPACKCOVERAGE';
    throw err;
  }
  const json = JSON.stringify(registry, null, 2) + '\n';
  let existing = null;
  try { existing = await fs.readFile(REGISTRY_PATH, 'utf8'); } catch {}
  if (existing === json) return { changed: false, count: Object.keys(registry.packs).length };
  if (CHECK_ONLY) {
    const err = new Error('registry.json out of date — run `node scripts/regen-pack-registry.js`');
    err.code = 'EPACKREGISTRYSTALE';
    throw err;
  }
  await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await fs.writeFile(REGISTRY_PATH, json, 'utf8');
  return { changed: true, count: Object.keys(registry.packs).length };
}

const argvUrl = 'file:///' + (process.argv[1] || '').replace(/\\/g, '/');
const isMain =
  import.meta.url === argvUrl ||
  import.meta.url === argvUrl.replace('file:////', 'file:///') ||
  process.argv[1] === __filename;

if (isMain) {
  try {
    if (CHECK_ONLY) {
      const { coverage } = await buildRegistry();
      if (!coverage.ok) throw Object.assign(new Error(`Pack coverage gap:\n  ${coverage.gaps.join('\n  ')}`), { code: 'EPACKCOVERAGE' });
    }
    const { changed, count } = await regenPackRegistry();
    process.stderr.write((changed ? '[regen-pack-registry] updated' : '[regen-pack-registry] no-op') + ` — ${count} packs\n`);
  } catch (e) {
    process.stderr.write('[regen-pack-registry] ERROR: ' + e.message + '\n');
    process.exit(1);
  }
}
