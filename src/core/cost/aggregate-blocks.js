// Phase 172 — aggregate blocks (5h windows + gap detection).
//
// Algoritmo (espelha ccusage `blocks`):
//   - Ordena entries por timestamp asc.
//   - Inicia bloco com `start = floor(entry.ts / 5h) * 5h` (UTC absoluto).
//   - Bloco termina quando:
//       (a) entry seguinte ultrapassa start + 5h, OU
//       (b) gap > 5h entre entry atual e próxima entry (gap-detection).
//   - Bloco é `is_active` se contém entries com ts dentro dos últimos 5h
//     em relação a `now` (sessão ativa que ainda pode receber tokens).
//
// DST resilience: trabalhamos com epoch ms absoluto, NUNCA com horas locais
// ou Date.getHours(). O relógio recuar 1h em outubro NÃO duplica bloco.
//
// Output:
//   {
//     blocks: [{ block_start_ts, block_end_ts, started_at, ended_at,
//                total_usd, by_model, entry_count, is_active, ... }],
//     ... shape canônico agregado de todos os blocks ...
//   }

import { discover } from './discovery.js';
import { parseJsonlFile } from './parser.js';
import { dedup } from './dedup.js';
import { priceEntries, loadSnapshot } from './pricing.js';

const BLOCK_MS = 5 * 60 * 60 * 1000; // 5h.
const HOUR_MS = 60 * 60 * 1000;

/**
 * @typedef {Object} BlocksOptions
 * @property {string[]} [config_dirs]
 * @property {number}   [now]
 * @property {number}   [block_ms=18000000]   janela (testes)
 * @property {object[]} [entries]
 * @property {Record<string,number>} [source_mtimes]
 * @property {string}   [snapshot_path]
 * @property {string}   [meta_path]
 */

/**
 * @param {BlocksOptions} [opts]
 * @returns {object}
 */
export function aggregateBlocks(opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const blockMs = typeof opts.block_ms === 'number' && opts.block_ms > 0 ? opts.block_ms : BLOCK_MS;

  /** @type {object[]} */
  let entries = [];
  /** @type {Record<string,number>} */
  const sourceMtimes = opts.source_mtimes ? { ...opts.source_mtimes } : {};
  let parse_error_count = 0;

  if (Array.isArray(opts.entries)) {
    entries = opts.entries.slice();
  } else {
    const disc = discover({ config_dirs: opts.config_dirs });
    for (const file of disc.jsonl_files) {
      const parsed = parseJsonlFile(file);
      parse_error_count += parsed.error_count;
      if (typeof parsed.source_mtime === 'number') sourceMtimes[file] = parsed.source_mtime;
      for (const e of parsed.entries) {
        e.__source_file = file;
        if (parsed.source_mtime !== undefined) e.__source_mtime = parsed.source_mtime;
      }
      entries.push(...parsed.entries);
    }
  }

  const ddOut = dedup(entries, { sourceMtimes });

  // Ordena por timestamp asc.
  const sorted = ddOut.kept
    .map((e) => ({ e, t: Date.parse(e.timestamp) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);

  const loaded = loadSnapshot({
    snapshot_path: opts.snapshot_path,
    meta_path: opts.meta_path,
    now,
    force: !!(opts.snapshot_path || opts.meta_path),
  });

  /** @type {Array<{ block_start_ts:number, items:Array<{e:any, t:number}>, gap_before:boolean }>} */
  const groups = [];
  let cur = null;
  let prevT = null;
  // ccusage-compatible: block starts no floor da HORA UTC da 1a entry do
  // bloco (não floor de 5h epoch — esse desalinha desde 1970-01-01). 5h
  // window então roda a partir desse hour-floor.
  for (const { e, t } of sorted) {
    const gapDetected = prevT !== null && t - prevT > blockMs;
    const shouldStartNew = !cur || gapDetected || t >= cur.block_start_ts + blockMs;
    if (shouldStartNew) {
      cur = {
        block_start_ts: Math.floor(t / HOUR_MS) * HOUR_MS,
        items: [],
        gap_before: gapDetected,
      };
      groups.push(cur);
    }
    cur.items.push({ e, t });
    prevT = t;
  }

  // Precifica cada bloco isoladamente.
  const blocks = groups.map((g) => {
    const priced = priceEntries(g.items.map((x) => x.e), loaded);
    const start = g.block_start_ts;
    const end = start + blockMs;
    // last entry ts no bloco.
    const lastT = g.items.length ? g.items[g.items.length - 1].t : start;
    const firstT = g.items.length ? g.items[0].t : start;
    const is_active = now >= start && now < end && now - lastT <= blockMs;
    return {
      block_start_ts: start,
      block_end_ts: end,
      started_at: new Date(start).toISOString(),
      ended_at: new Date(end).toISOString(),
      first_entry_ts: firstT,
      last_entry_ts: lastT,
      is_active,
      gap_before: g.gap_before,
      total_usd: priced.total_usd,
      by_model: priced.by_model,
      entry_count: priced.entry_count,
      unknown_models: priced.unknown_models,
      pricing_source: priced.pricing_source,
    };
  });

  // Agregado total (todas as entries depois do dedup).
  const totalPriced = priceEntries(sorted.map((x) => x.e), loaded);

  const out = {
    blocks,
    block_ms: blockMs,
    total_usd: totalPriced.total_usd,
    by_model: totalPriced.by_model,
    entry_count: totalPriced.entry_count,
    deduped_count: ddOut.deduped_count,
    skipped_entry_count: ddOut.skipped_entry_count,
    parse_error_count,
    unknown_models: totalPriced.unknown_models,
    pricing_source: totalPriced.pricing_source,
    pricing_staleness_days: totalPriced.pricing_staleness_days,
  };
  if (totalPriced.pricing_warning) out.pricing_warning = totalPriced.pricing_warning;
  return out;
}
