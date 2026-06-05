// Phase 172 — pricing module.
//
// Carrega snapshot embedded em pricing-snapshot.json e calcula custo por
// entry/agregado. Suporta:
//   - tiered pricing > 200k tokens (LiteLLM expõe input_cost_per_token_above_200k_tokens)
//   - cache_creation + cache_read tokens com cost separado
//   - modelo desconhecido → usd: null + push em unknown_models[]
//     (SPEC: NUNCA retornar $0 silencioso para modelo desconhecido)
//
// API:
//   loadSnapshot(opts?)       — carrega snapshot + meta. Cacheável.
//   priceEntry(entry, snapshot) — calcula USD de 1 entry.
//   priceEntries(entries, snapshot, opts) — agrega → shape canônico SPEC.
//
// Naming dos modelos:
//   Claude Code grava `claude-sonnet-4-5` ou `claude-3-5-sonnet-20241022`.
//   LiteLLM tem várias variantes (bedrock prefix, vertex prefix, etc).
//   Estratégia de lookup:
//     1. Match exato.
//     2. Match com prefixos removidos (`anthropic/`, `anthropic.`, `bedrock/`).
//     3. Match parcial — keys que terminam com o nome do modelo.
//   Tudo case-insensitive.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SNAPSHOT_PATH = path.join(__dirname, 'pricing-snapshot.json');
const DEFAULT_META_PATH = path.join(__dirname, 'pricing-snapshot.meta.json');

const TIER_BREAKPOINT = 200_000; // tokens.

/** @type {{ snapshot: object, meta: object, staleness_days: number, lookup: Map<string,object> } | null} */
let _cached = null;

/**
 * @param {{ snapshot_path?: string, meta_path?: string, now?: number, force?: boolean }} [opts]
 * @returns {{ snapshot: object, meta: object, staleness_days: number, lookup: Map<string,object> }}
 */
export function loadSnapshot(opts = {}) {
  if (_cached && !opts.force && !opts.snapshot_path && !opts.meta_path) return _cached;
  const snapshotPath = opts.snapshot_path || DEFAULT_SNAPSHOT_PATH;
  const metaPath = opts.meta_path || DEFAULT_META_PATH;
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    meta = { fetched_at: null, model_count: Object.keys(snapshot).length };
  }
  const now = opts.now || Date.now();
  const fetched = meta.fetched_at ? Date.parse(meta.fetched_at) : NaN;
  const staleness_days = Number.isFinite(fetched)
    ? Math.max(0, Math.floor((now - fetched) / (24 * 60 * 60 * 1000)))
    : -1;
  const lookup = buildLookup(snapshot);
  const out = { snapshot, meta, staleness_days, lookup };
  if (!opts.snapshot_path && !opts.meta_path) _cached = out;
  return out;
}

/**
 * Reset cache (testes).
 */
export function __resetCache() {
  _cached = null;
}

/**
 * @param {object} snapshot
 * @returns {Map<string,object>}
 */
function buildLookup(snapshot) {
  /** @type {Map<string,object>} */
  const map = new Map();
  for (const [key, value] of Object.entries(snapshot)) {
    map.set(key.toLowerCase(), value);
    // Aliases — variantes de prefixo + versionless.
    const stripped = key.replace(/^anthropic[/.]/i, '').replace(/^bedrock\//i, '');
    if (stripped !== key) map.set(stripped.toLowerCase(), value);
  }
  return map;
}

/**
 * @param {string} model
 * @param {Map<string,object>} lookup
 * @returns {object|null}
 */
export function resolveModel(model, lookup) {
  if (typeof model !== 'string' || !model) return null;
  const norm = model.toLowerCase();
  const hit = lookup.get(norm);
  if (hit) return hit;
  // Tentar stripping prefix.
  const stripped = norm.replace(/^anthropic[/.]/i, '').replace(/^bedrock\//i, '');
  const hit2 = lookup.get(stripped);
  if (hit2) return hit2;
  // Match parcial: chave do snapshot que termina com norm (cobre prefixes
  // bedrock e ARN-style).
  for (const [k, v] of lookup) {
    if (k.endsWith(norm) || k.endsWith('/' + norm) || norm.endsWith(k)) {
      return v;
    }
  }
  return null;
}

/**
 * Calcula USD para uma entry, considerando tiered pricing > 200k.
 *
 * @param {any} entry
 * @param {{ snapshot: object, lookup: Map<string,object> }} loaded
 * @returns {{ usd: number|null, pricing_source: 'snapshot'|'unknown', tier_used: 'standard'|'long_context'|'mixed' }}
 */
export function priceEntry(entry, loaded) {
  if (!entry || typeof entry !== 'object') {
    return { usd: null, pricing_source: 'unknown', tier_used: 'standard' };
  }
  const model = entry.model;
  const cfg = resolveModel(model, loaded.lookup);
  if (!cfg) return { usd: null, pricing_source: 'unknown', tier_used: 'standard' };

  const u = entry.usage || {};
  const input = numOr0(u.input_tokens);
  const output = numOr0(u.output_tokens);
  const cacheCreate = numOr0(u.cache_creation_input_tokens);
  const cacheRead = numOr0(u.cache_read_input_tokens);

  const inputStd = numOr0(cfg.input_cost_per_token);
  const outputStd = numOr0(cfg.output_cost_per_token);
  const inputLong = numOr0(cfg.input_cost_per_token_above_200k_tokens) || inputStd;
  const outputLong = numOr0(cfg.output_cost_per_token_above_200k_tokens) || outputStd;
  const cacheCreateCost = numOr0(cfg.cache_creation_input_token_cost);
  const cacheReadCost = numOr0(cfg.cache_read_input_token_cost);

  // Tier split: tokens acima de 200k cobram tier long. ccusage espelha isso.
  const totalInput = input + cacheRead + cacheCreate;
  let inputUsd;
  let outputUsd;
  let tier_used = /** @type {'standard'|'long_context'|'mixed'} */ ('standard');
  if (totalInput > TIER_BREAKPOINT && (cfg.input_cost_per_token_above_200k_tokens || cfg.output_cost_per_token_above_200k_tokens)) {
    const stdInputCount = Math.max(0, TIER_BREAKPOINT - cacheRead - cacheCreate);
    const longInputCount = Math.max(0, input - stdInputCount);
    inputUsd = stdInputCount * inputStd + longInputCount * inputLong;
    outputUsd = output * (totalInput > TIER_BREAKPOINT ? outputLong : outputStd);
    tier_used = longInputCount > 0 && stdInputCount > 0 ? 'mixed' : 'long_context';
  } else {
    inputUsd = input * inputStd;
    outputUsd = output * outputStd;
  }
  const cacheUsd = cacheCreate * cacheCreateCost + cacheRead * cacheReadCost;
  const usd = inputUsd + outputUsd + cacheUsd;
  return { usd, pricing_source: 'snapshot', tier_used };
}

/**
 * Agrega N entries no shape canônico do SPEC.
 *
 * @param {object[]} entries
 * @param {{ snapshot?: object, lookup?: Map<string,object>, staleness_days?: number, meta?: object }} [loadedOrOpts]
 * @returns {{
 *   total_usd: number|null,
 *   by_model: Record<string, {usd:number|null, input_tokens:number, output_tokens:number, cache_creation_tokens:number, cache_read_tokens:number, entry_count:number}>,
 *   entry_count: number,
 *   unknown_models: string[],
 *   pricing_source: 'snapshot'|'mixed'|'unknown',
 *   pricing_staleness_days: number,
 *   pricing_warning?: string,
 * }}
 */
export function priceEntries(entries, loadedOrOpts) {
  const loaded = loadedOrOpts && loadedOrOpts.lookup ? loadedOrOpts : loadSnapshot();
  const staleness = typeof loaded.staleness_days === 'number' ? loaded.staleness_days : -1;
  /** @type {Record<string,{usd:number|null, input_tokens:number, output_tokens:number, cache_creation_tokens:number, cache_read_tokens:number, entry_count:number}>} */
  const by_model = {};
  const unknown_set = new Set();
  let any_unknown = false;
  let any_known = false;
  let total_usd = 0;
  let total_count = 0;

  if (!Array.isArray(entries)) {
    return {
      total_usd: null,
      by_model: {},
      entry_count: 0,
      unknown_models: [],
      pricing_source: 'unknown',
      pricing_staleness_days: staleness,
    };
  }

  for (const e of entries) {
    total_count++;
    const model = e?.model || '<unknown>';
    if (!by_model[model]) {
      by_model[model] = {
        usd: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_tokens: 0,
        cache_read_tokens: 0,
        entry_count: 0,
      };
    }
    const u = e?.usage || {};
    by_model[model].input_tokens += numOr0(u.input_tokens);
    by_model[model].output_tokens += numOr0(u.output_tokens);
    by_model[model].cache_creation_tokens += numOr0(u.cache_creation_input_tokens);
    by_model[model].cache_read_tokens += numOr0(u.cache_read_input_tokens);
    by_model[model].entry_count++;

    const priced = priceEntry(e, loaded);
    if (priced.usd === null) {
      any_unknown = true;
      unknown_set.add(model);
      by_model[model].usd = null;
    } else {
      any_known = true;
      if (by_model[model].usd !== null) by_model[model].usd += priced.usd;
      total_usd += priced.usd;
    }
  }

  let pricing_source = /** @type {'snapshot'|'mixed'|'unknown'} */ ('snapshot');
  if (any_unknown && any_known) pricing_source = 'mixed';
  else if (any_unknown && !any_known) pricing_source = 'unknown';

  /** @type {ReturnType<typeof priceEntries>} */
  const result = {
    total_usd: any_known ? total_usd : null,
    by_model,
    entry_count: total_count,
    unknown_models: Array.from(unknown_set).sort(),
    pricing_source,
    pricing_staleness_days: staleness,
  };
  if (staleness >= 0 && staleness > 30) {
    result.pricing_warning = `pricing_snapshot_stale_${staleness}_days`;
  }
  return result;
}

function numOr0(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
