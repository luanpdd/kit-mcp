// Phase 172 — aggregate-estimate unit tests.
//
// Invariantes:
//  - estimated_input_tokens ≈ ceil(text.length / chars_per_token).
//  - estimated_output_tokens = input * output_ratio (default 3).
//  - estimated_usd_range = [usd*0.7, usd*1.3].
//  - disclaimer string presente.
//  - Modelo desconhecido → estimated_usd=null, pricing_source='unknown',
//    unknown_models=[model].
//  - chars_per_token customizado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEstimate } from '../../src/core/cost/aggregate-estimate.js';
import { __resetCache } from '../../src/core/cost/pricing.js';

test('chars/4 heurística sobre input', () => {
  __resetCache();
  const text = 'a'.repeat(400); // 400 chars → 100 tokens
  const r = aggregateEstimate({ text, model: 'claude-sonnet-4-5' });
  assert.equal(r.estimated_input_tokens, 100);
  // output_ratio default 3 → 300 tokens
  assert.equal(r.estimated_output_tokens, 300);
  assert.ok(r.disclaimer.includes('chars_div_4'));
  assert.ok(r.disclaimer.includes('30pct'));
});

test('range ±30% sobre estimated_usd', () => {
  __resetCache();
  const r = aggregateEstimate({ text: 'hello world', model: 'claude-sonnet-4-5' });
  assert.ok(typeof r.estimated_usd === 'number' && r.estimated_usd > 0);
  const [low, high] = r.estimated_usd_range;
  assert.ok(Math.abs(low / r.estimated_usd - 0.7) < 1e-9);
  assert.ok(Math.abs(high / r.estimated_usd - 1.3) < 1e-9);
});

test('modelo desconhecido → estimated_usd=null + unknown_models', () => {
  __resetCache();
  const r = aggregateEstimate({ text: 'hi', model: 'claude-3-unknown-future-99999' });
  assert.equal(r.estimated_usd, null);
  assert.equal(r.pricing_source, 'unknown');
  assert.deepEqual(r.unknown_models, ['claude-3-unknown-future-99999']);
  assert.equal(r.estimated_usd_range, null);
});

test('chars_per_token customizado é respeitado', () => {
  __resetCache();
  const text = 'x'.repeat(60);
  const r = aggregateEstimate({ text, model: 'claude-sonnet-4-5', chars_per_token: 3 });
  assert.equal(r.estimated_input_tokens, 20);
});

test('output_ratio customizado é respeitado', () => {
  __resetCache();
  const text = 'a'.repeat(40);
  const r = aggregateEstimate({ text, model: 'claude-sonnet-4-5', output_ratio: 1 });
  assert.equal(r.estimated_input_tokens, 10);
  assert.equal(r.estimated_output_tokens, 10);
});

test('text vazio joga erro de input', () => {
  __resetCache();
  assert.throws(() => aggregateEstimate({}), /text \(string\) is required/);
});
