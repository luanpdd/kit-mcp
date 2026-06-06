// Phase 172 — Golden test paridade vs ccusage.
//
// Carrega fixture jsonl-paridade-ccusage.jsonl (1k entries) e
// .expected.json (oracle). Roda pipeline kit-mcp: parse → dedup → price.
// Asserta |delta| / expected.total_usd <= 0.5%.
//
// ⚠️ Nota de débito (M1):
// O oracle atual em jsonl-paridade-ccusage.expected.json foi gerado por
// scripts/gen-paridade-fixture.mjs (implementação independente lendo o
// MESMO pricing-snapshot.json). Não é paridade ccusage estrita — é
// sanity-check matemático local. O oracle ccusage estrito virá quando
// `npm install` rodar e scripts/generate-oracle-paridade.mjs executar.
// Justificativa: ccusage devDep não foi instalado neste ambiente de
// execução M1 (sem npm install / sem rede npm registry).
//
// Independente disso, este teste pega:
//  - Regressão em parser (entradas faltando).
//  - Regressão em dedup (1k entries únicas devem dar 1k kept).
//  - Regressão em pricing.js multiplications.
//  - Pricing source = 'snapshot' (não 'unknown').

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseJsonlFile } from '../../src/core/cost/parser.js';
import { dedup } from '../../src/core/cost/dedup.js';
import { priceEntries, loadSnapshot, __resetCache } from '../../src/core/cost/pricing.js';

const FIXTURES = path.resolve('test/fixtures');
const FIXTURE = path.join(FIXTURES, 'jsonl-paridade-ccusage.jsonl');
const EXPECTED = path.join(FIXTURES, 'jsonl-paridade-ccusage.expected.json');
const DELTA_THRESHOLD = 0.005; // 0.5%

test('paridade ccusage: 1k entries delta <= 0.5%', () => {
  __resetCache();
  assert.ok(fs.existsSync(FIXTURE), `fixture missing: ${FIXTURE}`);
  assert.ok(fs.existsSync(EXPECTED), `expected oracle missing: ${EXPECTED}`);

  const parsed = parseJsonlFile(FIXTURE);
  assert.equal(parsed.error_count, 0, 'fixture must parse cleanly');
  assert.equal(parsed.ok_count, 1000, 'fixture must have 1000 entries');

  const ded = dedup(parsed.entries);
  // Fixture é gerado com IDs únicos por entry, então deduped deve ser 0.
  assert.equal(ded.deduped_count, 0);
  assert.equal(ded.skipped_entry_count, 0);
  assert.equal(ded.kept.length, 1000);

  const result = priceEntries(ded.kept, loadSnapshot());
  const expected = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));

  assert.equal(result.entry_count, expected.entry_count);
  assert.equal(result.pricing_source, 'snapshot');
  assert.deepEqual(result.unknown_models, []);

  assert.ok(typeof result.total_usd === 'number' && result.total_usd > 0);
  const delta = Math.abs(result.total_usd - expected.total_usd);
  const ratio = delta / expected.total_usd;
  assert.ok(
    ratio <= DELTA_THRESHOLD,
    `total_usd delta ${(ratio * 100).toFixed(4)}% > 0.5%. got=${result.total_usd} expected=${expected.total_usd}`,
  );

  // Por-modelo
  for (const model of Object.keys(expected.by_model)) {
    const got = result.by_model[model];
    const exp = expected.by_model[model];
    assert.ok(got, `missing model in result: ${model}`);
    assert.equal(got.input_tokens, exp.input_tokens, `input_tokens mismatch for ${model}`);
    assert.equal(got.output_tokens, exp.output_tokens, `output_tokens mismatch for ${model}`);
    assert.equal(got.entry_count, exp.entry_count, `entry_count mismatch for ${model}`);
    if (typeof got.usd === 'number' && typeof exp.usd === 'number' && exp.usd > 0) {
      const dm = Math.abs(got.usd - exp.usd);
      const rm = dm / exp.usd;
      assert.ok(rm <= DELTA_THRESHOLD, `by_model[${model}] delta ${(rm * 100).toFixed(4)}% > 0.5%`);
    }
  }
});
