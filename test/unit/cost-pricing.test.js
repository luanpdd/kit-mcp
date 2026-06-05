// Phase 172 — pricing unit tests.
//
// Invariantes (SPEC):
//  - Modelo conhecido → usd > 0, pricing_source 'snapshot'.
//  - Modelo desconhecido → usd:null, NUNCA 0; entra em unknown_models[].
//  - by_model agregado correto.
//  - Pricing mixed (1 conhecido + 1 desconhecido) → pricing_source='mixed'.
//  - Tier > 200k aplicado (long_context multiplier).
//  - staleness > 30d → emite pricing_warning.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSnapshot, priceEntry, priceEntries, resolveModel, __resetCache } from '../../src/core/cost/pricing.js';

function fakeEntry(o) {
  return {
    timestamp: '2026-06-05T10:00:00.000Z',
    sessionId: 's',
    messageId: 'm',
    requestId: 'r',
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: 1000, output_tokens: 500 },
    ...o,
  };
}

test('loadSnapshot returns snapshot + meta + staleness_days', () => {
  __resetCache();
  const s = loadSnapshot();
  assert.ok(typeof s.snapshot === 'object');
  assert.ok(s.meta.fetched_at);
  assert.ok(typeof s.staleness_days === 'number');
  assert.ok(s.lookup instanceof Map);
  assert.ok(s.lookup.size > 0);
});

test('priceEntry known model returns positive usd + snapshot source', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntry(fakeEntry({ model: 'claude-sonnet-4-5' }), s);
  assert.equal(r.pricing_source, 'snapshot');
  assert.ok(typeof r.usd === 'number' && r.usd > 0);
});

test('priceEntry unknown model returns usd:null (NOT 0)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntry(fakeEntry({ model: 'claude-3-unknown-future-99999' }), s);
  assert.equal(r.usd, null);
  assert.equal(r.pricing_source, 'unknown');
});

test('priceEntries aggregates by_model with token counts', () => {
  __resetCache();
  const s = loadSnapshot();
  const entries = [
    fakeEntry({ model: 'claude-sonnet-4-5', usage: { input_tokens: 100, output_tokens: 50 } }),
    fakeEntry({ model: 'claude-sonnet-4-5', usage: { input_tokens: 200, output_tokens: 80 } }),
  ];
  const r = priceEntries(entries, s);
  assert.equal(r.entry_count, 2);
  assert.equal(r.by_model['claude-sonnet-4-5'].input_tokens, 300);
  assert.equal(r.by_model['claude-sonnet-4-5'].output_tokens, 130);
  assert.equal(r.by_model['claude-sonnet-4-5'].entry_count, 2);
  assert.ok(r.by_model['claude-sonnet-4-5'].usd > 0);
});

test('priceEntries mixed unknown+known sets pricing_source="mixed"', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries(
    [
      fakeEntry({ model: 'claude-sonnet-4-5' }),
      fakeEntry({ model: 'claude-mystery-9000' }),
    ],
    s,
  );
  assert.equal(r.pricing_source, 'mixed');
  assert.ok(r.unknown_models.includes('claude-mystery-9000'));
  assert.equal(r.by_model['claude-mystery-9000'].usd, null);
});

test('priceEntries all-unknown → total_usd:null + pricing_source:"unknown"', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries(
    [fakeEntry({ model: 'claude-x-y-z' }), fakeEntry({ model: 'claude-a-b-c' })],
    s,
  );
  assert.equal(r.total_usd, null);
  assert.equal(r.pricing_source, 'unknown');
});

test('priceEntries with staleness > 30d emits warning', () => {
  __resetCache();
  // forge a stale snapshot in-memory.
  const s = loadSnapshot();
  const stale = { ...s, staleness_days: 60 };
  const r = priceEntries([fakeEntry({})], stale);
  assert.ok(r.pricing_warning && r.pricing_warning.includes('stale'));
});

test('resolveModel handles bedrock/vertex prefix variants', () => {
  __resetCache();
  const s = loadSnapshot();
  // claude-sonnet-4-5 deve resolver mesmo se vier como "anthropic/claude-sonnet-4-5".
  const cfg = resolveModel('anthropic/claude-sonnet-4-5', s.lookup);
  assert.ok(cfg, 'expected fallback lookup via stripped prefix');
});

test('priceEntry > 200k tokens triggers long-context tier when configured', () => {
  __resetCache();
  // Forge snapshot inline para garantir tier breakpoint.
  const lookup = new Map([
    ['claude-test-tier', {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      input_cost_per_token_above_200k_tokens: 0.000002,
      output_cost_per_token_above_200k_tokens: 0.000004,
    }],
  ]);
  const loaded = { snapshot: {}, meta: {}, staleness_days: 0, lookup };
  const r = priceEntry({
    model: 'claude-test-tier',
    usage: { input_tokens: 250_000, output_tokens: 1000 },
  }, loaded);
  // input: 200k * 1e-6 + 50k * 2e-6 = 0.2 + 0.1 = 0.3
  // output: 1000 * 4e-6 = 0.004
  // total: 0.304
  assert.ok(r.usd > 0.3, `expected long-context tier to bump cost, got ${r.usd}`);
  assert.notEqual(r.tier_used, 'standard');
});

test('fixture jsonl-modelo-desconhecido produces usd:null per spec', async () => {
  __resetCache();
  const { parseJsonlFile } = await import('../../src/core/cost/parser.js');
  const path = await import('node:path');
  const FIXTURE = path.resolve('test/fixtures/jsonl-modelo-desconhecido.jsonl');
  const parsed = parseJsonlFile(FIXTURE);
  const r = priceEntries(parsed.entries, loadSnapshot());
  assert.ok(r.unknown_models.length >= 2);
  assert.equal(r.by_model['claude-3-unknown-future-20300101'].usd, null);
  assert.equal(r.by_model['claude-mystery-model'].usd, null);
  // known one must have usd > 0
  assert.ok(r.by_model['claude-sonnet-4-5'].usd > 0);
});
