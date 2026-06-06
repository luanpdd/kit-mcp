// Phase 172 — JSONL parser lenient (sem Zod).
//
// Por que lenient como default: arquivos JSONL do Claude Code podem ter
// linhas corrompidas (resume interrompido, disk full mid-write, etc).
// Strict parser perderia 50% silenciosamente porque pararia na 1a linha
// quebrada. Lenient: try/catch por linha + retorno detalhado de erros.
//
// Shape esperado de uma entry (validação manual via typeof/Array.isArray,
// SEM Zod — preserva budget de zero deps):
//   {
//     timestamp: string ISO,
//     sessionId: string,
//     messageId: string | null,
//     requestId: string | null,
//     model: string,
//     usage: {
//       input_tokens: number,
//       output_tokens: number,
//       cache_creation_input_tokens?: number,
//       cache_read_input_tokens?: number,
//     },
//     isSidechain?: boolean,
//     cwd?: string,
//   }
//
// Entries faltando timestamp ou model são consideradas malformed e contam
// como error_count (não como skipped). Skipped é só pro dedup nivel-1
// (messageId/requestId null).
//
// API:
//   parseJsonl(content, opts) -> { entries, ok_count, error_count, errors,
//                                  warning?, source_file? }
//   parseJsonlFile(file, opts) -> { ...acima, source_file, source_mtime }
//
// Modo strict opt-in: opts.mode = 'strict' → throw na 1a linha quebrada.

import fs from 'node:fs';
import { toPosix } from './path-normalize.js';

const WARNING_THRESHOLD = 0.005; // 0.5% conforme SPEC.

/**
 * @typedef {Object} ParserOptions
 * @property {'lenient'|'strict'} [mode='lenient']
 * @property {string} [source_file]   path para incluir nos erros e meta.
 */

/**
 * @typedef {Object} ParserResult
 * @property {object[]} entries
 * @property {number} ok_count
 * @property {number} error_count
 * @property {Array<{line_no: number, snippet: string, reason: string}>} errors
 * @property {string} [warning]
 * @property {string} [source_file]
 * @property {number} [source_mtime]
 */

/**
 * @param {string} content
 * @param {ParserOptions} [opts]
 * @returns {ParserResult}
 */
export function parseJsonl(content, opts = {}) {
  const mode = opts.mode || 'lenient';
  const source_file = opts.source_file ? toPosix(opts.source_file) : undefined;
  const entries = [];
  const errors = [];
  let ok_count = 0;
  let error_count = 0;

  if (typeof content !== 'string' || content.length === 0) {
    return { entries, ok_count: 0, error_count: 0, errors: [], source_file };
  }

  // Suporta CRLF do Windows + LF tradicional.
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const line_no = i + 1;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      const reason = `json_parse_error: ${/** @type {Error} */ (err).message}`;
      if (mode === 'strict') {
        throw new Error(`${source_file || '<inline>'}:${line_no} ${reason}`);
      }
      error_count++;
      errors.push({ line_no, snippet: line.slice(0, 120), reason });
      continue;
    }

    const validation = validateEntry(parsed);
    if (!validation.ok) {
      if (mode === 'strict') {
        throw new Error(`${source_file || '<inline>'}:${line_no} invalid_shape: ${validation.reason}`);
      }
      error_count++;
      errors.push({ line_no, snippet: line.slice(0, 120), reason: `invalid_shape: ${validation.reason}` });
      continue;
    }

    ok_count++;
    entries.push(parsed);
  }

  /** @type {ParserResult} */
  const result = { entries, ok_count, error_count, errors, source_file };
  const total = ok_count + error_count;
  if (total > 0 && error_count / total > WARNING_THRESHOLD) {
    result.warning = `parser_error_ratio_${((error_count / total) * 100).toFixed(2)}pct_above_0.5pct`;
  }
  return result;
}

/**
 * @param {string} file
 * @param {ParserOptions} [opts]
 * @returns {ParserResult}
 */
export function parseJsonlFile(file, opts = {}) {
  const content = fs.readFileSync(file, 'utf8');
  let mtime;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    mtime = undefined;
  }
  const result = parseJsonl(content, { ...opts, source_file: file });
  if (mtime !== undefined) result.source_mtime = mtime;
  return result;
}

/**
 * Validação manual: zero deps, sem Zod. Confere apenas o mínimo que o
 * pipeline downstream precisa (timestamp parseable + model string).
 *
 * @param {any} entry
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateEntry(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, reason: 'entry_not_object' };
  }
  if (typeof entry.timestamp !== 'string' || entry.timestamp.length === 0) {
    return { ok: false, reason: 'timestamp_missing_or_not_string' };
  }
  const tsMs = Date.parse(entry.timestamp);
  if (!Number.isFinite(tsMs)) {
    return { ok: false, reason: 'timestamp_unparseable' };
  }
  if (typeof entry.model !== 'string' || entry.model.length === 0) {
    return { ok: false, reason: 'model_missing_or_not_string' };
  }
  // usage pode estar ausente em algumas entries (ex: linha de meta sem
  // tokens), mas se presente precisa ser objeto.
  if (entry.usage !== undefined && (typeof entry.usage !== 'object' || entry.usage === null || Array.isArray(entry.usage))) {
    return { ok: false, reason: 'usage_not_object' };
  }
  return { ok: true };
}
