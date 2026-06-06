// Phase 172 M4 — statusline.
//
// Reads a JSON object from stdin emitted by Claude Code statusline contract:
//
//   {
//     sessionId: string,
//     transcriptPath: string,         // absolute path to <sessionId>.jsonl
//     cwd?: string,
//     model?: { id: string, displayName: string },
//     ...                             // forward-compat fields ignored
//   }
//
// Writes ONE line to stdout. Default format `compact`:
//
//   $0.42 sess | $1.20 day | $0.18 5h
//
// Env override `KIT_MCP_STATUSLINE_FORMAT=verbose|json`.
//
// Caching: per-sessionId at `os.tmpdir()/kit-mcp-statusline-<sessionId>.json`.
// Cache is invalidated when:
//   - JSONL mtime advanced since cache.mtime, OR
//   - cache writer PID is no longer alive (so a stale Claude Code process does
//     not poison newer ones).
//
// PID liveness uses `process.kill(pid, 0)` with cross-platform try/catch:
//   - EPERM  → process exists but we lack permission (Windows kernel) → alive
//   - ESRCH  → no such process → dead
//   - other  → defensive dead (alive=false)
//
// Failure modes:
//   - stdin malformed JSON  → emit empty string + log to stderr
//   - aggregator throws     → emit empty string + log to stderr
//   - cache fs errors       → graceful, fall through to recompute
//
// Performance target (Gate C2): P50 < 200ms cold OR < 50ms warm.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { aggregateSession } from '../core/cost/aggregate-session.js';
import { aggregateToday } from '../core/cost/aggregate-today.js';
import { aggregateBlocks } from '../core/cost/aggregate-blocks.js';

const FORMAT_DEFAULT = 'compact';
const SUPPORTED_FORMATS = new Set(['compact', 'verbose', 'json']);

/**
 * Read full stdin into a string. Resolves with '' if stdin is a TTY (no piped
 * input) — caller should treat as "no input" and bail gracefully.
 *
 * @returns {Promise<string>}
 */
export function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

/**
 * Cross-platform PID liveness probe. See module header for behavior.
 *
 * @param {number} pid
 * @returns {boolean}
 */
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'EPERM') return true; // Windows / sandbox
    if (err && err.code === 'ESRCH') return false;
    return false;
  }
}

/**
 * Cache file path for a given sessionId.
 *
 * @param {string} sessionId
 * @returns {string}
 */
export function cachePathFor(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(os.tmpdir(), `kit-mcp-statusline-${safe}.json`);
}

/**
 * Try to load + validate cache. Returns the cached output string if and only
 * if (a) PID alive, (b) transcript mtime did not advance.
 *
 * @param {string} sessionId
 * @param {string|null} transcriptPath
 * @param {string} format
 * @returns {string|null}
 */
export function tryReadCache(sessionId, transcriptPath, format) {
  const file = cachePathFor(sessionId);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  let obj;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  if (obj.format !== format) return null;
  if (typeof obj.pid === 'number' && !isPidAlive(obj.pid)) {
    // Stale writer — invalidate.
    return null;
  }
  if (transcriptPath) {
    try {
      const m = fs.statSync(transcriptPath).mtimeMs;
      if (typeof obj.mtime !== 'number' || m > obj.mtime + 0.5) {
        return null;
      }
    } catch {
      // transcript disappeared — invalidate.
      return null;
    }
  }
  if (typeof obj.output !== 'string') return null;
  return obj.output;
}

/**
 * Best-effort cache write. Never throws.
 *
 * @param {string} sessionId
 * @param {string|null} transcriptPath
 * @param {string} format
 * @param {string} output
 */
export function tryWriteCache(sessionId, transcriptPath, format, output) {
  const file = cachePathFor(sessionId);
  let mtime = 0;
  if (transcriptPath) {
    try { mtime = fs.statSync(transcriptPath).mtimeMs; } catch {}
  }
  const payload = {
    output,
    format,
    sessionId: String(sessionId || ''),
    transcript: transcriptPath || null,
    mtime,
    pid: process.pid,
    written_at: Date.now(),
  };
  try {
    fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
  } catch {
    // graceful
  }
}

/**
 * Format USD as `$X.XX`. Null safe.
 *
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtUsd(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '$0.00';
  return `$${Number(n).toFixed(2)}`;
}

/**
 * Render the 3 numbers in the requested format.
 *
 * @param {object} fields { session_usd, day_usd, block_usd, model?, session_id?, unknown_models?, pricing_staleness_days? }
 * @param {string} format
 * @returns {string}
 */
export function render(fields, format) {
  const session = fmtUsd(fields.session_usd);
  const day = fmtUsd(fields.day_usd);
  const block = fmtUsd(fields.block_usd);
  if (format === 'json') {
    return JSON.stringify({
      session_usd: fields.session_usd,
      day_usd: fields.day_usd,
      block_usd: fields.block_usd,
      session_id: fields.session_id || null,
      model: fields.model || null,
      unknown_models: fields.unknown_models || [],
      pricing_staleness_days: fields.pricing_staleness_days ?? null,
    });
  }
  if (format === 'verbose') {
    const parts = [
      `sess ${session}`,
      `day ${day}`,
      `5h-block ${block}`,
    ];
    if (fields.model) parts.push(`model ${fields.model}`);
    return parts.join(' | ');
  }
  // compact (default).
  return `${session} sess | ${day} day | ${block} 5h`;
}

/**
 * Resolve the active 5h block USD from `aggregateBlocks` output.
 *
 * @param {object} blocks
 * @returns {number|null}
 */
function pickActiveBlockUsd(blocks) {
  if (!blocks || !Array.isArray(blocks.blocks)) return null;
  for (const b of blocks.blocks) {
    if (b && b.is_active) {
      return typeof b.total_usd === 'number' ? b.total_usd : null;
    }
  }
  // No active block right now — return 0 (not null) so the statusline shows $0.00.
  return 0;
}

/**
 * Compute statusline payload from a parsed Claude Code input object.
 *
 * @param {object} input
 * @returns {{output:string, fields:object}}
 */
export function compute(input, opts = {}) {
  const sessionId = input && typeof input.sessionId === 'string' ? input.sessionId : '';
  const transcript = input && typeof input.transcriptPath === 'string' ? input.transcriptPath : null;
  const modelId = input && input.model && typeof input.model.id === 'string' ? input.model.id : null;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const format = resolveFormat(opts.format);

  const sessionArgs = {
    session_id: sessionId || undefined,
    transcript_path: transcript || undefined,
    now,
  };
  const todayArgs = { now };
  const blocksArgs = { now };
  if (Array.isArray(opts.config_dirs)) {
    sessionArgs.config_dirs = opts.config_dirs;
    todayArgs.config_dirs = opts.config_dirs;
    blocksArgs.config_dirs = opts.config_dirs;
  }
  if (opts.snapshot_path) {
    sessionArgs.snapshot_path = opts.snapshot_path;
    todayArgs.snapshot_path = opts.snapshot_path;
    blocksArgs.snapshot_path = opts.snapshot_path;
  }
  if (opts.meta_path) {
    sessionArgs.meta_path = opts.meta_path;
    todayArgs.meta_path = opts.meta_path;
    blocksArgs.meta_path = opts.meta_path;
  }

  let session = null;
  let today = null;
  let blocks = null;
  try { session = aggregateSession(sessionArgs); } catch {}
  try { today = aggregateToday(todayArgs); } catch {}
  try { blocks = aggregateBlocks(blocksArgs); } catch {}

  const fields = {
    session_id: sessionId || (session && session.session_id) || null,
    model: modelId,
    session_usd: session ? (typeof session.total_usd === 'number' ? session.total_usd : 0) : 0,
    day_usd: today ? (typeof today.total_usd === 'number' ? today.total_usd : 0) : 0,
    block_usd: pickActiveBlockUsd(blocks),
    unknown_models: dedupConcat(session?.unknown_models, today?.unknown_models, blocks?.unknown_models),
    pricing_staleness_days: today?.pricing_staleness_days ?? blocks?.pricing_staleness_days ?? session?.pricing_staleness_days ?? null,
  };
  const output = render(fields, format);
  return { output, fields, format };
}

/**
 * Main entrypoint — used by the CLI subcommand. Reads stdin, computes,
 * caches, writes ONE line to stdout. Never throws — emits '' + stderr on
 * error, then exits 0 (statusline must not crash Claude Code).
 *
 * @returns {Promise<void>}
 */
export async function runStatusline({ stdinText, opts = {} } = {}) {
  const text = typeof stdinText === 'string' ? stdinText : await readStdin();
  let input = null;
  try {
    input = text ? JSON.parse(text) : null;
  } catch {
    process.stderr.write('kit cost statusline: stdin not valid JSON\n');
    process.stdout.write('\n');
    return;
  }
  if (!input || typeof input !== 'object') {
    process.stderr.write('kit cost statusline: expected JSON object on stdin\n');
    process.stdout.write('\n');
    return;
  }
  const format = resolveFormat(opts.format);
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : 'unknown';
  const transcript = typeof input.transcriptPath === 'string' ? input.transcriptPath : null;

  // Cache lookup (skip when opts.no_cache).
  if (!opts.no_cache) {
    const cached = tryReadCache(sessionId, transcript, format);
    if (cached !== null) {
      process.stdout.write(cached + '\n');
      return;
    }
  }

  let result;
  try {
    result = compute(input, { ...opts, format });
  } catch (err) {
    process.stderr.write(`kit cost statusline: compute failed: ${err && err.message ? err.message : err}\n`);
    process.stdout.write('\n');
    return;
  }

  if (!opts.no_cache) tryWriteCache(sessionId, transcript, format, result.output);
  process.stdout.write(result.output + '\n');
}

/**
 * @param {string|undefined} optFormat
 * @returns {string}
 */
function resolveFormat(optFormat) {
  const envFmt = process.env.KIT_MCP_STATUSLINE_FORMAT;
  const candidate = optFormat || envFmt || FORMAT_DEFAULT;
  return SUPPORTED_FORMATS.has(candidate) ? candidate : FORMAT_DEFAULT;
}

function dedupConcat(...arrs) {
  const out = new Set();
  for (const a of arrs) {
    if (Array.isArray(a)) for (const x of a) if (x) out.add(x);
  }
  return [...out];
}
