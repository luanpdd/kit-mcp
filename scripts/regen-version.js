#!/usr/bin/env node
// DIR-01: single-source release hygiene — propagate package.json.version (the
// single source of truth) to every derived version file:
//   - kit/framework/VERSION            (raw semver + trailing newline)
//   - kit/packs/*/pack.json            (.version field)
//
// Idempotent: targets already in sync are NOT rewritten (preserves an empty git
// diff — same contract as scripts/regen-pack-registry.js). Each file's existing
// EOL convention (CRLF on Windows checkouts) is preserved — same hardening as
// scripts/update-readme-counts.js.
//
//   node scripts/regen-version.js           # sync derived files
//   node scripts/regen-version.js --check   # exit 1 with drift report; writes nothing
//
// Wired in package.json:
//   - "version" lifecycle hook: regen + git add (runs on `npm version <bump>`)
//   - "prepublishOnly": `--check` gate — publish is blocked while drift exists.

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = path.resolve(path.dirname(__filename), '..');
const CHECK_ONLY = process.argv.includes('--check');

const SEMVER_SHAPE = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i;

function eolOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

async function readIfExists(fileAbs) {
  try {
    return await fs.readFile(fileAbs, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * Inspect every derived version target and report its current state.
 * Pure read — never writes. Returns:
 *   { version, targets: [{ file, abs, found, inSync, desired }] }
 * where `file` is repo-relative (POSIX separators), `found` is the version
 * currently in the file (null when the file is missing) and `desired` is the
 * exact byte content a sync would write.
 */
export async function collectVersionTargets(repoRoot = REPO_ROOT_DEFAULT) {
  const pkgRaw = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8');
  const version = JSON.parse(pkgRaw).version;
  if (typeof version !== 'string' || !SEMVER_SHAPE.test(version)) {
    throw new Error('package.json version is not a valid semver: ' + JSON.stringify(version));
  }

  const targets = [];

  // 1. kit/framework/VERSION — raw semver, one line.
  const versionAbs = path.join(repoRoot, 'kit', 'framework', 'VERSION');
  const versionRaw = await readIfExists(versionAbs);
  const versionEol = versionRaw === null ? '\n' : eolOf(versionRaw);
  const versionFound = versionRaw === null ? null : versionRaw.trim();
  targets.push({
    file: 'kit/framework/VERSION',
    abs: versionAbs,
    found: versionFound,
    inSync: versionFound === version,
    desired: version + versionEol,
  });

  // 2. kit/packs/*/pack.json — .version field. Formatting is preserved by
  //    re-serializing with the same shape used across the repo
  //    (JSON.stringify(obj, null, 2) + '\n'), keeping the file's EOL.
  const packsRoot = path.join(repoRoot, 'kit', 'packs');
  let packDirs = [];
  try {
    packDirs = (await fs.readdir(packsRoot, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (e) {
    if (!e || e.code !== 'ENOENT') throw e;
  }
  for (const dir of packDirs) {
    const abs = path.join(packsRoot, dir, 'pack.json');
    const raw = await readIfExists(abs);
    if (raw === null) continue; // not a pack dir
    const parsed = JSON.parse(raw);
    const found = parsed.version ?? null;
    parsed.version = version;
    const desired = (JSON.stringify(parsed, null, 2) + '\n').replace(/\n/g, eolOf(raw));
    targets.push({
      file: 'kit/packs/' + dir + '/pack.json',
      abs,
      found,
      inSync: found === version,
      desired,
    });
  }

  return { version, targets };
}

/**
 * Sync every drifted target to package.json.version.
 * check=true: report only — never writes.
 * Returns { version, changed: [file...], drift: [{ file, found, expected }] }
 * where `drift` reflects the state BEFORE any write.
 */
export async function regenVersion(repoRoot = REPO_ROOT_DEFAULT, { check = false } = {}) {
  const { version, targets } = await collectVersionTargets(repoRoot);
  const drifted = targets.filter((t) => !t.inSync);
  const drift = drifted.map((t) => ({ file: t.file, found: t.found, expected: version }));
  const changed = [];
  if (!check) {
    for (const t of drifted) {
      await fs.writeFile(t.abs, t.desired, 'utf8');
      changed.push(t.file);
    }
  }
  return { version, changed, drift };
}

// Standalone entrypoint (same isMain detection as scripts/regen-pack-registry.js).
const argvUrl = 'file:///' + (process.argv[1] || '').replace(/\\/g, '/');
const isMain =
  import.meta.url === argvUrl ||
  import.meta.url === argvUrl.replace('file:////', 'file:///') ||
  process.argv[1] === __filename;

if (isMain) {
  try {
    const { version, changed, drift } = await regenVersion(REPO_ROOT_DEFAULT, { check: CHECK_ONLY });
    if (CHECK_ONLY && drift.length > 0) {
      process.stderr.write('[regen-version] DRIFT — package.json is at ' + version + ':\n');
      for (const d of drift) {
        process.stderr.write('  ' + d.file + ' — found ' + (d.found ?? '(missing)') + ', expected ' + d.expected + '\n');
      }
      process.stderr.write('[regen-version] run `node scripts/regen-version.js` and commit\n');
      process.exit(1);
    }
    const label = CHECK_ONLY
      ? '[regen-version] in sync'
      : changed.length > 0
        ? '[regen-version] updated ' + changed.length + ' file(s): ' + changed.join(', ')
        : '[regen-version] no-op';
    process.stderr.write(label + ' — version ' + version + '\n');
  } catch (e) {
    process.stderr.write('[regen-version] ERROR: ' + e.message + '\n');
    process.exit(1);
  }
}
