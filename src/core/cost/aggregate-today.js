// Phase 172 — aggregate today.
//
// Pipeline:
//   discover() → parseJsonl por arquivo → anexa __source_file/__source_mtime
//   → concat entries → dedup → priceEntries → filtra por dia em tz.
//
// Por que filtrar DEPOIS de dedup: dedup precisa enxergar a entry "original"
// (talvez de outro arquivo de outro dia) pra escolher tie-break correto.
// Filtrar antes corromperia o cálculo.
//
// tz default 'UTC' (paridade ccusage). Flag --tz override usa
// Intl.DateTimeFormat com timeZone — sem deps extras.
//
// Output: shape canônico do SPEC + `date: 'YYYY-MM-DD'`.

import { discover } from './discovery.js';
import { parseJsonlFile } from './parser.js';
import { dedup } from './dedup.js';
import { priceEntries, loadSnapshot } from './pricing.js';

/**
 * @typedef {Object} TodayOptions
 * @property {string[]} [config_dirs]
 * @property {string}   [tz='UTC']
 * @property {string}   [date]            override YYYY-MM-DD (testes)
 * @property {number}   [now]             override epoch ms (testes)
 * @property {object[]} [entries]         bypass discovery — usar entries dados (testes)
 * @property {Record<string,number>} [source_mtimes]
 * @property {boolean}  [include_parse_errors=false]
 * @property {string}   [snapshot_path]   override snapshot (testes)
 * @property {string}   [meta_path]
 */

/**
 * @param {TodayOptions} [opts]
 * @returns {object}
 */
export function aggregateToday(opts = {}) {
  const tz = opts.tz || 'UTC';
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const targetDate = opts.date || ymdInTz(now, tz);

  /** @type {object[]} */
  let entries = [];
  /** @type {Record<string,number>} */
  const sourceMtimes = opts.source_mtimes ? { ...opts.source_mtimes } : {};
  let parse_error_count = 0;
  /** @type {Array<{file:string, errors:any[]}>} */
  const parse_error_details = [];

  if (Array.isArray(opts.entries)) {
    entries = opts.entries.slice();
  } else {
    const disc = discover({ config_dirs: opts.config_dirs });
    for (const file of disc.jsonl_files) {
      const parsed = parseJsonlFile(file);
      parse_error_count += parsed.error_count;
      if (parsed.errors && parsed.errors.length) {
        parse_error_details.push({ file, errors: parsed.errors });
      }
      if (typeof parsed.source_mtime === 'number') sourceMtimes[file] = parsed.source_mtime;
      for (const e of parsed.entries) {
        e.__source_file = file;
        if (parsed.source_mtime !== undefined) e.__source_mtime = parsed.source_mtime;
      }
      entries.push(...parsed.entries);
    }
  }

  const ddOut = dedup(entries, { sourceMtimes });
  const filtered = ddOut.kept.filter((e) => ymdInTz(Date.parse(e.timestamp), tz) === targetDate);

  const loaded = loadSnapshot({
    snapshot_path: opts.snapshot_path,
    meta_path: opts.meta_path,
    now,
    force: !!(opts.snapshot_path || opts.meta_path),
  });
  const priced = priceEntries(filtered, loaded);

  const out = {
    date: targetDate,
    tz,
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
  if (opts.include_parse_errors) out.parse_error_details = parse_error_details;
  return out;
}

/**
 * Retorna YYYY-MM-DD do epoch ms no timezone fornecido. Usa Intl pra evitar
 * deps extras. UTC short-circuit pra performance.
 *
 * @param {number} epochMs
 * @param {string} tz
 * @returns {string}
 */
export function ymdInTz(epochMs, tz) {
  if (!Number.isFinite(epochMs)) return '0000-00-00';
  if (!tz || tz === 'UTC') return new Date(epochMs).toISOString().slice(0, 10);
  // Intl: pega year/month/day no tz e re-formata.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA → 'YYYY-MM-DD' nativamente.
  return fmt.format(new Date(epochMs));
}
