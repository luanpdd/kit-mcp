// SEC-14-05: verify kit/file-manifest.json against actual file contents.
// Called by syncTo() in install path, before any write — refuses to project
// a tampered kit. Opt-out via KIT_MCP_SKIP_MANIFEST_CHECK=1 (warn on stderr).
//
// Manifest format (kit/file-manifest.json):
//   { version, timestamp, files: { "<rel-to-kitRoot>": "<sha256-hex>", ... } }
//
// Returns:
//   { ok: true } when all listed files exist + match.
//   { ok: true, skipped: true } when KIT_MCP_SKIP_MANIFEST_CHECK=1.
//   { ok: false, reason, mismatches, missing } otherwise.

import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const SKIP_ENV = 'KIT_MCP_SKIP_MANIFEST_CHECK';

export async function verifyManifest(kitRoot) {
  if (process.env[SKIP_ENV] === '1') {
    process.stderr.write(
      '[kit-mcp] WARNING: ' + SKIP_ENV + '=1 set — skipping kit/file-manifest.json verification (dev mode).\n'
    );
    return { ok: true, skipped: true };
  }

  const manifestPath = path.join(kitRoot, 'file-manifest.json');
  let manifest;
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      reason: 'kit manifest unreadable at ' + manifestPath + ': ' + e.message,
      mismatches: [],
      missing: [],
    };
  }

  if (!manifest.files || typeof manifest.files !== 'object') {
    return {
      ok: false,
      reason: "kit manifest malformed at " + manifestPath + ": missing 'files' object",
      mismatches: [],
      missing: [],
    };
  }

  const mismatches = [];
  const missing = [];

  for (const [rel, expected] of Object.entries(manifest.files)) {
    const abs = path.join(kitRoot, rel);
    let buf;
    try {
      buf = await fs.readFile(abs);
    } catch {
      missing.push(rel);
      continue;
    }
    // Normalize CRLF→LF before hashing so manifest is platform-stable.
    // git checkout converts EOL on Windows but Linux CI checks out LF —
    // hashing raw bytes would diverge across platforms.
    const normalized = Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary');
    const actual = crypto.createHash('sha256').update(normalized).digest('hex');
    if (actual !== expected) {
      mismatches.push({ path: rel, expected: expected.slice(0, 16), actual: actual.slice(0, 16) });
    }
  }

  if (mismatches.length === 0 && missing.length === 0) {
    return { ok: true };
  }

  // Build a concise reason — first 3 mismatches, plus counts.
  const sample = mismatches
    .slice(0, 3)
    .map((m) => m.path + ' (expected ' + m.expected + ', got ' + m.actual + ')')
    .join('; ');
  const missingSample = missing.slice(0, 3).join(', ');
  const reasonParts = [];
  if (mismatches.length > 0) {
    reasonParts.push(
      mismatches.length +
        ' file(s) tampered: ' +
        sample +
        (mismatches.length > 3 ? ', +' + (mismatches.length - 3) + ' more' : '')
    );
  }
  if (missing.length > 0) {
    reasonParts.push(
      missing.length +
        ' file(s) missing: ' +
        missingSample +
        (missing.length > 3 ? ', +' + (missing.length - 3) + ' more' : '')
    );
  }
  reasonParts.push('set ' + SKIP_ENV + '=1 to bypass (dev only)');

  return {
    ok: false,
    reason: 'kit manifest mismatch — ' + reasonParts.join('; '),
    mismatches,
    missing,
  };
}
