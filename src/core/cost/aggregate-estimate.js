// Phase 172 — aggregate estimate (heurística chars/4 + ±30%).
//
// SPEC decisão #5: sem tokenizer real (tiktoken/anthropic-tokenizer) na
// v1.37.0. Usamos chars/4 + disclaimer + range ±30%. PT-BR diverge mais
// que EN, mas v1.37.0 documenta o limite e v1.38.0 traz tokenizer real.
//
// Default ratio output:input = 1:3 (curiosamente, o INVERSO da heurística
// comum LLM: o user pergunta curto e o LLM responde longo). SPEC declara
// "ratio configurável, default 1:3 input:output" — interpretamos como
// "input * 0.33 = output" (output menor que input pra prompts informativos)
// OU "output ≈ input * 3" (resposta longa). Ficamos com input:output = 1:3
// no sentido `output = input * 3` (resposta 3x maior que pergunta) pois é
// o pior caso (mais USD) → user nunca subestima. Override via opts.
//
// Range: estimate ± 30% → low = est * 0.7, high = est * 1.3.

import { loadSnapshot, resolveModel } from './pricing.js';

const CHARS_PER_TOKEN = 4;
const DEFAULT_OUTPUT_RATIO = 3; // output_tokens ≈ input_tokens * 3
const RANGE_PCT = 0.3;
const DEFAULT_MODEL = 'claude-sonnet-4-5';

/**
 * @typedef {Object} EstimateOptions
 * @property {string}  text
 * @property {string}  [model]
 * @property {number}  [output_ratio]
 * @property {number}  [chars_per_token]
 * @property {string}  [snapshot_path]
 * @property {string}  [meta_path]
 * @property {number}  [now]
 */

/**
 * @param {EstimateOptions} opts
 * @returns {object}
 */
export function aggregateEstimate(opts) {
  if (!opts || typeof opts.text !== 'string') {
    throw new Error('aggregateEstimate: opts.text (string) is required');
  }
  const text = opts.text;
  const model = opts.model || DEFAULT_MODEL;
  const charsPerToken = opts.chars_per_token || CHARS_PER_TOKEN;
  const outputRatio = typeof opts.output_ratio === 'number' ? opts.output_ratio : DEFAULT_OUTPUT_RATIO;

  const inputTokens = Math.max(1, Math.ceil(text.length / charsPerToken));
  const outputTokens = Math.max(1, Math.ceil(inputTokens * outputRatio));

  const loaded = loadSnapshot({
    snapshot_path: opts.snapshot_path,
    meta_path: opts.meta_path,
    now: opts.now,
    force: !!(opts.snapshot_path || opts.meta_path),
  });
  const cfg = resolveModel(model, loaded.lookup);

  let estimated_usd = null;
  let low_usd = null;
  let high_usd = null;
  let pricing_source = 'unknown';
  if (cfg) {
    const inputCost = numOr0(cfg.input_cost_per_token);
    const outputCost = numOr0(cfg.output_cost_per_token);
    estimated_usd = inputTokens * inputCost + outputTokens * outputCost;
    low_usd = estimated_usd * (1 - RANGE_PCT);
    high_usd = estimated_usd * (1 + RANGE_PCT);
    pricing_source = 'snapshot';
  }

  return {
    model,
    text_length: text.length,
    chars_per_token: charsPerToken,
    output_ratio: outputRatio,
    estimated_input_tokens: inputTokens,
    estimated_output_tokens: outputTokens,
    estimated_usd,
    estimated_usd_range: estimated_usd === null ? null : [low_usd, high_usd],
    disclaimer: `heuristic_chars_div_${charsPerToken}_±${Math.round(RANGE_PCT * 100)}pct`,
    pricing_source,
    pricing_staleness_days: loaded.staleness_days,
    unknown_models: cfg ? [] : [model],
  };
}

function numOr0(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
