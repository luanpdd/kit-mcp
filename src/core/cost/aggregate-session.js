// Phase 172 — aggregate session.
//
// Modos de input:
//   1. session_id explícito → filtra entries por entry.sessionId == session_id.
//   2. transcript_path explícito → deriva session_id de basename(file, '.jsonl').
//   3. Auto-deduz: arquivo JSONL mais recente cujo mtime < 30 min (sessão ativa).
//
// Naming: Claude Code grava `<sessionId>.jsonl` em
// `<config_dir>/projects/<slug>/<sessionId>.jsonl`. O basename SEM extensão
// é o sessionId — bate com `entry.sessionId` no JSONL.
//
// Edge: arquivo cujo mtime > 30 min em modo auto NÃO conta como ativo
// (default). Override via `max_idle_ms`.

import path from 'node:path';
import fs from 'node:fs';
import { discover } from './discovery.js';
import { parseJsonlFile } from './parser.js';
import { dedup } from './dedup.js';
import { priceEntries, loadSnapshot } from './pricing.js';
import { toPosix } from './path-normalize.js';

const DEFAULT_MAX_IDLE_MS = 30 * 60 * 1000; // 30 min.

/**
 * @typedef {Object} SessionOptions
 * @property {string}   [session_id]
 * @property {string}   [transcript_path]
 * @property {string[]} [config_dirs]
 * @property {number}   [max_idle_ms]
 * @property {number}   [now]
 * @property {object[]} [entries]
 * @property {Record<string,number>} [source_mtimes]
 * @property {string}   [snapshot_path]
 * @property {string}   [meta_path]
 */

/**
 * @param {SessionOptions} [opts]
 * @returns {object}
 */
export function aggregateSession(opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const maxIdle = typeof opts.max_idle_ms === 'number' ? opts.max_idle_ms : DEFAULT_MAX_IDLE_MS;

  /** @type {string|null} */
  let sessionId = opts.session_id || null;

  if (!sessionId && opts.transcript_path) {
    sessionId = sessionIdFromPath(opts.transcript_path);
  }

  /** @type {object[]} */
  let entries = [];
  /** @type {Record<string,number>} */
  const sourceMtimes = opts.source_mtimes ? { ...opts.source_mtimes } : {};
  let parse_error_count = 0;
  /** @type {string|null} */
  let resolved_source_file = null;

  if (Array.isArray(opts.entries)) {
    entries = opts.entries.slice();
  } else {
    const disc = discover({ config_dirs: opts.config_dirs });
    let files = disc.jsonl_files.slice();

    // Auto-deduz sessão ativa quando session_id ausente.
    if (!sessionId) {
      const ranked = rankByMtime(files);
      const fresh = ranked.find((f) => now - f.mtime <= maxIdle);
      if (!fresh) {
        // Nenhum arquivo dentro da janela "ativa" — sessão indeterminada.
        return emptyResult(null, 'no_active_session', now);
      }
      sessionId = sessionIdFromPath(fresh.file);
      resolved_source_file = fresh.file;
      files = [fresh.file];
    }

    for (const file of files) {
      // Skip arquivos cujo basename não bate com sessionId (otimização +
      // garante que entries vindas de outro arquivo não vazem).
      const baseId = sessionIdFromPath(file);
      if (baseId !== sessionId) continue;
      const parsed = parseJsonlFile(file);
      parse_error_count += parsed.error_count;
      if (typeof parsed.source_mtime === 'number') sourceMtimes[file] = parsed.source_mtime;
      for (const e of parsed.entries) {
        e.__source_file = file;
        if (parsed.source_mtime !== undefined) e.__source_mtime = parsed.source_mtime;
      }
      entries.push(...parsed.entries);
      resolved_source_file = file;
    }
  }

  // Filtra por sessionId (cobre o caso `entries` passado direto).
  const matched = entries.filter((e) => e && e.sessionId === sessionId);
  if (matched.length === 0) {
    return emptyResult(sessionId, 'session_not_found', now, { source_file: resolved_source_file });
  }

  const ddOut = dedup(matched, { sourceMtimes });

  const loaded = loadSnapshot({
    snapshot_path: opts.snapshot_path,
    meta_path: opts.meta_path,
    now,
    force: !!(opts.snapshot_path || opts.meta_path),
  });
  const priced = priceEntries(ddOut.kept, loaded);

  // Started / last activity = min/max timestamp.
  let started = Infinity;
  let last = -Infinity;
  for (const e of ddOut.kept) {
    const t = Date.parse(e.timestamp);
    if (Number.isFinite(t)) {
      if (t < started) started = t;
      if (t > last) last = t;
    }
  }

  const out = {
    session_id: sessionId,
    started_at: Number.isFinite(started) ? new Date(started).toISOString() : null,
    last_activity_at: Number.isFinite(last) ? new Date(last).toISOString() : null,
    source_file: resolved_source_file,
    total_usd: priced.total_usd,
    by_model: priced.by_model,
    entry_count: priced.entry_count,
    deduped_count: ddOut.deduped_count,
    skipped_entry_count: ddOut.skipped_entry_count,
    parse_error_count,
    unknown_models: priced.unknown_models,
    pricing_source: priced.pricing_source,
    pricing_staleness_days: priced.pricing_staleness_days,
  };
  if (priced.pricing_warning) out.pricing_warning = priced.pricing_warning;
  return out;
}

/**
 * @param {string} file
 * @returns {string}
 */
function sessionIdFromPath(file) {
  const norm = toPosix(file);
  const base = path.posix.basename(norm);
  return base.endsWith('.jsonl') ? base.slice(0, -'.jsonl'.length) : base;
}

/**
 * Ordena por mtime desc (mais recente primeiro).
 *
 * @param {string[]} files
 * @returns {Array<{file:string, mtime:number}>}
 */
function rankByMtime(files) {
  const ranked = [];
  for (const f of files) {
    try {
      const m = fs.statSync(f).mtimeMs;
      ranked.push({ file: f, mtime: m });
    } catch {
      // ignore missing
    }
  }
  ranked.sort((a, b) => b.mtime - a.mtime);
  return ranked;
}

/**
 * @param {string|null} sessionId
 * @param {string} reason
 * @param {number} now
 * @param {object} [extras]
 */
function emptyResult(sessionId, reason, now, extras = {}) {
  return {
    session_id: sessionId,
    started_at: null,
    last_activity_at: null,
    source_file: extras.source_file || null,
    reason,
    total_usd: null,
    by_model: {},
    entry_count: 0,
    deduped_count: 0,
    skipped_entry_count: 0,
    parse_error_count: 0,
    unknown_models: [],
    pricing_source: 'unknown',
    pricing_staleness_days: -1,
  };
}
