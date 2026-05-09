#!/usr/bin/env node
// DX-15-02: regen kit/file-manifest.json from real kit/ contents (SHA256).
// Idempotent: if file digests + version unchanged, the JSON file is NOT
// rewritten (preserves the previous timestamp → empty git diff).
//
// Schema (matches src/core/manifest-verify.js consumer contract):
//   { version: package.json.version,
//     timestamp: ISO-8601 of last actual content change,
//     files: { "<rel-to-kit/>": "<sha256-hex>", ... } sorted by key }
//
// Excludes: kit/file-manifest.json itself (self-reference would be unstable).
// Walks: kit/** recursively, all files (any extension).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = path.resolve(path.dirname(__filename), '..');
const MANIFEST_BASENAME = 'file-manifest.json';

async function walkRel(rootAbs, prefix = '') {
  const out = [];
  const ents = await readdir(rootAbs, { withFileTypes: true });
  for (const ent of ents) {
    const rel = prefix ? prefix + '/' + ent.name : ent.name;
    if (ent.isDirectory()) {
      const subAbs = path.join(rootAbs, ent.name);
      out.push(...(await walkRel(subAbs, rel)));
    } else if (ent.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

async function sha256(absPath) {
  const buf = await readFile(absPath);
  // Normalize CRLF→LF before hashing so manifest is platform-stable.
  // git checkout converts EOL on Windows but Linux CI checks out LF —
  // hashing raw bytes would diverge across platforms.
  const normalized = Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function regenManifest(repoRoot = REPO_ROOT_DEFAULT) {
  const kitRoot = path.join(repoRoot, 'kit');
  const manifestAbs = path.join(kitRoot, MANIFEST_BASENAME);

  const pkgRaw = await readFile(path.join(repoRoot, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const version = pkg.version;

  // Walk kit/, exclude file-manifest.json
  const allRel = await walkRel(kitRoot);
  const targets = allRel.filter((r) => r !== MANIFEST_BASENAME);
  targets.sort();

  const files = {};
  for (const rel of targets) {
    // Use forward slashes in keys (matches existing manifest, x-platform stable)
    const key = rel.split(path.sep).join('/');
    files[key] = await sha256(path.join(kitRoot, rel));
  }

  // Read existing manifest (if any) to decide if anything changed
  let prevTimestamp = null;
  let unchanged = false;
  try {
    const prevRaw = await readFile(manifestAbs, 'utf8');
    const prev = JSON.parse(prevRaw);
    prevTimestamp = prev.timestamp;
    if (
      prev.version === version &&
      prev.files &&
      typeof prev.files === 'object' &&
      Object.keys(prev.files).length === Object.keys(files).length &&
      Object.keys(files).every((k) => prev.files[k] === files[k])
    ) {
      unchanged = true;
    }
  } catch {
    // No previous file or unparseable — treat as changed
  }

  const timestamp = unchanged ? prevTimestamp : new Date().toISOString();
  const manifest = { version, timestamp, files };

  // Stable JSON: 2-space indent, sorted keys via insertion order above
  const newJson = JSON.stringify(manifest, null, 2) + '\n';

  if (unchanged) {
    // Confirm on-disk byte equality (handles the case where someone hand-edited
    // formatting). If bytes match, true no-op. If not, rewrite to canonical form.
    try {
      const onDisk = await readFile(manifestAbs, 'utf8');
      if (onDisk === newJson) {
        return { changed: false, count: targets.length, manifestPath: manifestAbs };
      }
    } catch {
      /* fall through to write */
    }
  }

  await writeFile(manifestAbs, newJson, 'utf8');
  return { changed: true, count: targets.length, manifestPath: manifestAbs };
}

// Run as script (not import). On Windows, import.meta.url uses forward slashes
// while process.argv[1] uses native backslashes — normalize for the comparison.
const argvUrl = 'file:///' + (process.argv[1] || '').replace(/\\/g, '/');
const isMain =
  import.meta.url === argvUrl ||
  import.meta.url === argvUrl.replace('file:////', 'file:///') ||
  process.argv[1] === __filename;

if (isMain) {
  try {
    const { changed, count } = await regenManifest();
    process.stderr.write(
      (changed ? '[regen-manifest] updated' : '[regen-manifest] no-op') +
        ' — ' +
        count +
        ' files hashed\n'
    );
  } catch (e) {
    process.stderr.write('[regen-manifest] ERROR: ' + e.message + '\n');
    process.exit(1);
  }
}
