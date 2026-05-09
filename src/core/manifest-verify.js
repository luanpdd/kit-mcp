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

// PERF-17-01: parallelize SHA256 hashing in batches of 16. Same pattern
// as Phase 88.01 sync.js. Hardcoded — env override is overengineering
// for verifyManifest (single hot path, not user-facing latency budget).
const BATCH_SIZE = 16;

const SKIP_ENV = 'KIT_MCP_SKIP_MANIFEST_CHECK';

/**
 * SEC-14-05: verify kit/file-manifest.json against actual file contents.
 * PERF-17-01: hashes in Promise.all batches of 16 (was sequential pre-v1.17).
 * Called by syncTo() in install path before any write — refuses to project a tampered kit.
 * @param {string} kitRoot - absolute path to kit/ directory.
 * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, mismatches?: Array, missing?: string[]}>}
 */
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

  const entries = Object.entries(manifest.files);

  // Per-file check — returns { rel, status: 'ok'|'mismatch'|'missing', expected?, actual? }.
  // Pure function (no side effects on shared arrays) so Promise.all in batches
  // is safe — caller aggregates after each batch resolves.
  const checkOne = async ([rel, expected]) => {
    const abs = path.join(kitRoot, rel);
    let buf;
    try {
      buf = await fs.readFile(abs);
    } catch {
      return { rel, status: 'missing' };
    }
    // Normalize CRLF→LF before hashing so manifest is platform-stable.
    // git checkout converts EOL on Windows but Linux CI checks out LF —
    // hashing raw bytes would diverge across platforms. (PRESERVED from v1.15)
    const normalized = Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary');
    const actual = crypto.createHash('sha256').update(normalized).digest('hex');
    if (actual !== expected) {
      return { rel, status: 'mismatch', expected, actual };
    }
    return { rel, status: 'ok' };
  };

  // Sequential batches — within a batch, Promise.all parallelizes hashing;
  // between batches, await bounds max-in-flight at BATCH_SIZE (defensive
  // against fd ulimit on large kits). Order of completion within a batch
  // doesn't matter — aggregator below is order-independent.
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const slice = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(slice.map(checkOne));
    for (const r of results) {
      if (r.status === 'mismatch') {
        mismatches.push({ path: r.rel, expected: r.expected.slice(0, 16), actual: r.actual.slice(0, 16) });
      } else if (r.status === 'missing') {
        missing.push(r.rel);
      }
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
