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

// =====================================================================
// Mutation-targeted tests (Phase 172 — gap G6).
// =====================================================================

function loadedFor(lookupEntries) {
  return { snapshot: {}, meta: {}, staleness_days: 0, lookup: new Map(lookupEntries) };
}

test('mutation: priceEntry null entry returns usd:null + unknown source (L118)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntry(null, s);
  assert.equal(r.usd, null);
  assert.equal(r.pricing_source, 'unknown');
  assert.equal(r.tier_used, 'standard');
});

test('mutation: priceEntry non-object entry (string) returns usd:null', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntry('not-an-entry', s);
  assert.equal(r.usd, null);
  assert.equal(r.pricing_source, 'unknown');
});

test('mutation: priceEntry undefined entry returns usd:null', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntry(undefined, s);
  assert.equal(r.usd, null);
});

test('mutation: resolveModel non-string returns null (L92 typeof guard)', () => {
  const lookup = new Map([['m', { input_cost_per_token: 1 }]]);
  assert.equal(resolveModel(null, lookup), null);
  assert.equal(resolveModel(undefined, lookup), null);
  assert.equal(resolveModel(123, lookup), null);
  assert.equal(resolveModel('', lookup), null);
});

test('mutation: resolveModel strips "anthropic." prefix variant (L97 regex)', () => {
  // Kills L97 Regex /^anthropic[/.]/i mutants. Snapshot key is `m`; query is `anthropic.m`.
  const lookup = new Map([['claude-sonnet-x', { input_cost_per_token: 0.001 }]]);
  const hit = resolveModel('anthropic.claude-sonnet-x', lookup);
  assert.ok(hit, 'expected anthropic. prefix to be stripped');
});

test('mutation: resolveModel strips "anthropic/" prefix variant', () => {
  const lookup = new Map([['claude-foo', { input_cost_per_token: 0.001 }]]);
  assert.ok(resolveModel('anthropic/claude-foo', lookup));
});

test('mutation: resolveModel strips "bedrock/" prefix (L97 second regex)', () => {
  const lookup = new Map([['claude-bar', { input_cost_per_token: 0.001 }]]);
  assert.ok(resolveModel('bedrock/claude-bar', lookup));
});

test('mutation: resolveModel partial match via endsWith with slash separator (L103)', () => {
  // Key in snapshot is "vendor/some/path/claude-zzz", query is "claude-zzz".
  // The k.endsWith('/' + norm) branch is required.
  const lookup = new Map([['some-vendor/claude-zzz-x', { input_cost_per_token: 0.5 }]]);
  const hit = resolveModel('claude-zzz-x', lookup);
  assert.ok(hit, 'expected partial endsWith match to succeed');
});

test('mutation: resolveModel returns null when no match (kills L107 default branch swaps)', () => {
  const lookup = new Map([['only-this-model', { input_cost_per_token: 1 }]]);
  assert.equal(resolveModel('totally-different', lookup), null);
});

test('mutation: buildLookup creates lowercase aliases with stripped prefix (L80-81)', () => {
  __resetCache();
  const s = loadSnapshot();
  // Original snapshot has keys like "anthropic.claude-sonnet-4-6"; lookup
  // should contain the stripped + lowercased alias too.
  assert.ok(s.lookup.has('anthropic.claude-sonnet-4-6'));
  assert.ok(s.lookup.has('claude-sonnet-4-6'),
    'expected alias claude-sonnet-4-6 from stripping anthropic. prefix');
});

test('mutation: tier-200k math: stdInputCount = TIER_BREAKPOINT - cacheRead - cacheCreate (L144)', () => {
  // With cacheRead=50k, cacheCreate=50k, input=200k:
  //   stdInputCount = max(0, 200_000 - 50_000 - 50_000) = 100_000
  //   longInputCount = max(0, 200_000 - 100_000) = 100_000
  //   inputUsd = 100_000 * 1e-6 + 100_000 * 2e-6 = 0.1 + 0.2 = 0.3
  //   cacheUsd = 50_000 * 1e-7 + 50_000 * 5e-8 = 0.005 + 0.0025 = 0.0075
  //   output = 1000 * 4e-6 = 0.004
  //   total ≈ 0.3115
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      input_cost_per_token_above_200k_tokens: 0.000002,
      output_cost_per_token_above_200k_tokens: 0.000004,
      cache_read_input_token_cost: 0.0000001,
      cache_creation_input_token_cost: 0.00000005,
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: {
      input_tokens: 200_000,
      output_tokens: 1000,
      cache_creation_input_tokens: 50_000,
      cache_read_input_tokens: 50_000,
    },
  }, loaded);
  // 0.3 (input) + 0.004 (output) + 0.0075 (cache) = 0.3115
  assert.ok(Math.abs(r.usd - 0.3115) < 0.0001,
    `tier math: expected ~0.3115 got ${r.usd}`);
  assert.equal(r.tier_used, 'mixed');
});

test('mutation: tier_used="long_context" when only long-tier tokens (no std portion)', () => {
  // cacheRead = 200_000, cacheCreate = 0, input = 100_000:
  //   totalInput = 100k + 200k = 300k > 200k → tier branch taken.
  //   stdInputCount = max(0, 200_000 - 200_000 - 0) = 0
  //   longInputCount = max(0, 100_000 - 0) = 100_000
  //   tier_used: longInputCount > 0 && stdInputCount > 0 → false → 'long_context'
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      input_cost_per_token_above_200k_tokens: 0.000002,
      output_cost_per_token_above_200k_tokens: 0.000004,
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: { input_tokens: 100_000, output_tokens: 1000, cache_read_input_tokens: 200_000 },
  }, loaded);
  assert.equal(r.tier_used, 'long_context');
});

test('mutation: tier_used="standard" when totalInput <= 200k (L143 equality strict >)', () => {
  // input=200_000 exactly → NOT strictly > breakpoint → standard tier.
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      input_cost_per_token_above_200k_tokens: 0.000002,
      output_cost_per_token_above_200k_tokens: 0.000004,
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: { input_tokens: 200_000, output_tokens: 1000 },
  }, loaded);
  assert.equal(r.tier_used, 'standard',
    'totalInput === 200k must be standard tier (strict >)');
  // 200_000 * 1e-6 + 1000 * 2e-6 = 0.2 + 0.002 = 0.202
  assert.ok(Math.abs(r.usd - 0.202) < 0.0001, `expected 0.202 got ${r.usd}`);
});

test('mutation: cache_creation cost separate from cache_read cost (L153 +)', () => {
  // cacheCreate=10 @ cost 1e-3 = 0.01; cacheRead=20 @ cost 1e-4 = 0.002. total cache = 0.012.
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0,
      output_cost_per_token: 0,
      cache_creation_input_token_cost: 0.001,
      cache_read_input_token_cost: 0.0001,
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: { cache_creation_input_tokens: 10, cache_read_input_tokens: 20 },
  }, loaded);
  assert.ok(Math.abs(r.usd - 0.012) < 1e-9, `expected 0.012 got ${r.usd}`);
});

test('mutation: total = input + output + cache USD (L154 sum, not subtraction)', () => {
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0.001,
      output_cost_per_token: 0.002,
      cache_read_input_token_cost: 0.0001,
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 10 },
  }, loaded);
  // 0.01 + 0.02 + 0.001 = 0.031
  assert.ok(Math.abs(r.usd - 0.031) < 1e-9, `expected 0.031 got ${r.usd}`);
});

test('mutation: priceEntries accumulates cache_creation_tokens across entries (L211)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries(
    [
      fakeEntry({ usage: { input_tokens: 1, cache_creation_input_tokens: 100 } }),
      fakeEntry({ usage: { input_tokens: 1, cache_creation_input_tokens: 200 } }),
    ],
    s,
  );
  assert.equal(r.by_model['claude-sonnet-4-5'].cache_creation_tokens, 300);
});

test('mutation: priceEntries accumulates cache_read_tokens across entries (L212)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries(
    [
      fakeEntry({ usage: { input_tokens: 1, cache_read_input_tokens: 50 } }),
      fakeEntry({ usage: { input_tokens: 1, cache_read_input_tokens: 70 } }),
    ],
    s,
  );
  assert.equal(r.by_model['claude-sonnet-4-5'].cache_read_tokens, 120);
});

test('mutation: priceEntries entry without model key uses "<unknown>" bucket (L197)', () => {
  __resetCache();
  const s = loadSnapshot();
  // Entry missing model AND usage entirely. e?.model optional chain returns undefined → '<unknown>'.
  const r = priceEntries([{ messageId: 'm', requestId: 'r', timestamp: '2026-06-05T10:00:00Z' }], s);
  assert.equal(r.entry_count, 1);
  assert.ok(r.by_model['<unknown>']);
  assert.equal(r.by_model['<unknown>'].usd, null);
});

test('mutation: priceEntries null entry handled (L208 e?.usage optional chain)', () => {
  __resetCache();
  const s = loadSnapshot();
  // null entry → e?.model is undefined → '<unknown>'; e?.usage is undefined → {}
  const r = priceEntries([null, null], s);
  assert.equal(r.entry_count, 2);
  assert.ok(r.by_model['<unknown>']);
  assert.equal(r.by_model['<unknown>'].input_tokens, 0);
});

test('mutation: priceEntries non-array input returns total_usd:null + entry_count:0 (L184)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries('not-an-array', s);
  assert.equal(r.total_usd, null);
  assert.equal(r.entry_count, 0);
  assert.deepEqual(r.by_model, {});
  assert.deepEqual(r.unknown_models, []);
  assert.equal(r.pricing_source, 'unknown');
});

test('mutation: by_model.usd is incremented (not overwritten/subtracted) (L222-223)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r1 = priceEntries(
    [fakeEntry({ usage: { input_tokens: 100, output_tokens: 50 } })],
    s,
  );
  const r2 = priceEntries(
    [
      fakeEntry({ usage: { input_tokens: 100, output_tokens: 50 } }),
      fakeEntry({ usage: { input_tokens: 100, output_tokens: 50 } }),
    ],
    s,
  );
  // 2 entries must cost 2× of 1.
  assert.ok(Math.abs(r2.by_model['claude-sonnet-4-5'].usd - 2 * r1.by_model['claude-sonnet-4-5'].usd) < 1e-9,
    'by_model.usd must be accumulated additively');
  assert.ok(Math.abs(r2.total_usd - 2 * r1.total_usd) < 1e-9,
    'total_usd must be accumulated additively');
});

test('mutation: pricing_source="snapshot" when all known (no unknown)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries([fakeEntry({ model: 'claude-sonnet-4-5' })], s);
  assert.equal(r.pricing_source, 'snapshot');
});

test('mutation: pricing_source="unknown" when ALL unknown — distinct from "mixed" (L229)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries(
    [fakeEntry({ model: 'no-such-model-1' }), fakeEntry({ model: 'no-such-model-2' })],
    s,
  );
  assert.equal(r.pricing_source, 'unknown');
  assert.notEqual(r.pricing_source, 'mixed');
});

test('mutation: unknown_models sorted alphabetically (L236 Array.from + sort)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries(
    [
      fakeEntry({ model: 'zzz-unknown' }),
      fakeEntry({ model: 'aaa-unknown' }),
      fakeEntry({ model: 'mmm-unknown' }),
    ],
    s,
  );
  assert.deepEqual(r.unknown_models, ['aaa-unknown', 'mmm-unknown', 'zzz-unknown']);
});

test('mutation: staleness 30 exactly does NOT emit warning (L240 strict >)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries([fakeEntry({})], { ...s, staleness_days: 30 });
  assert.equal(r.pricing_warning, undefined);
});

test('mutation: staleness 31 emits warning (just above threshold)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries([fakeEntry({})], { ...s, staleness_days: 31 });
  assert.ok(r.pricing_warning && r.pricing_warning.includes('31'));
});

test('mutation: staleness < 0 (unknown) does NOT emit warning (L240 staleness >= 0)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries([fakeEntry({})], { ...s, staleness_days: -1 });
  assert.equal(r.pricing_warning, undefined);
  assert.equal(r.pricing_staleness_days, -1);
});

test('mutation: pricing_staleness_days reflects forwarded value', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntries([fakeEntry({})], { ...s, staleness_days: 5 });
  assert.equal(r.pricing_staleness_days, 5);
});

test('mutation: loadSnapshot computes day-staleness via 24*60*60*1000 conversion (L55)', async () => {
  __resetCache();
  // Use the real meta path; override `now` 5 days after fetched_at.
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const fs = await import('node:fs');
  const meta = JSON.parse(
    fs.readFileSync('src/core/cost/pricing-snapshot.meta.json', 'utf8'),
  );
  const fetched = Date.parse(meta.fetched_at);
  const s = loadSnapshot({ now: fetched + FIVE_DAYS_MS, force: true });
  assert.equal(s.staleness_days, 5);
});

test('mutation: loadSnapshot staleness_days never negative (L55 Math.max 0)', async () => {
  __resetCache();
  // now BEFORE fetched_at → raw delta negative → Math.max(0, …) clamps to 0.
  const fs = await import('node:fs');
  const meta = JSON.parse(
    fs.readFileSync('src/core/cost/pricing-snapshot.meta.json', 'utf8'),
  );
  const fetched = Date.parse(meta.fetched_at);
  const s = loadSnapshot({ now: fetched - 1000, force: true });
  assert.equal(s.staleness_days, 0);
});

test('mutation: loadSnapshot cache short-circuits on second call (L42)', () => {
  __resetCache();
  const a = loadSnapshot();
  const b = loadSnapshot();
  assert.equal(a, b, 'cached object must be returned by reference');
});

test('mutation: __resetCache forces fresh load', () => {
  __resetCache();
  const a = loadSnapshot();
  __resetCache();
  const b = loadSnapshot();
  assert.notEqual(a, b, 'after __resetCache, second loadSnapshot returns fresh object');
});

test('mutation: loadSnapshot opts.force bypasses cache (L42 force flag)', () => {
  __resetCache();
  const a = loadSnapshot();
  const b = loadSnapshot({ force: true });
  assert.notEqual(a, b);
});

test('mutation: loadSnapshot opts.snapshot_path bypasses cache and is not cached', () => {
  __resetCache();
  const a = loadSnapshot();
  // Reuse the default path — still triggers bypass branch because snapshot_path is set.
  const b = loadSnapshot({ snapshot_path: 'src/core/cost/pricing-snapshot.json' });
  assert.notEqual(a, b, 'snapshot_path bypasses cache');
  // And subsequent default call still returns original cache.
  const c = loadSnapshot();
  assert.equal(a, c);
});

test('mutation: loadSnapshot missing meta file falls back to placeholder (L48-50)', () => {
  __resetCache();
  const s = loadSnapshot({
    snapshot_path: 'src/core/cost/pricing-snapshot.json',
    meta_path: '/nonexistent/path/to/meta.json',
  });
  assert.ok(s.meta);
  // fetched_at null → staleness_days = -1.
  assert.equal(s.meta.fetched_at, null);
  assert.equal(s.staleness_days, -1);
  // model_count fallback uses Object.keys(snapshot).length > 0
  assert.ok(s.meta.model_count > 0);
});

test('mutation: priceEntry with cache_creation tokens uses cfg.cache_creation_input_token_cost (L135)', () => {
  // Kills numOr0 swap mutants for cache_creation.
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0,
      output_cost_per_token: 0,
      cache_creation_input_token_cost: 0.5,
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: { cache_creation_input_tokens: 4 },
  }, loaded);
  assert.equal(r.usd, 2.0);
});

test('mutation: priceEntry falls back to inputStd when input_cost_per_token_above_200k absent (L133)', () => {
  // Long tier missing → inputLong = inputStd. Above-200k still uses inputStd.
  // But tier branch only fires when at least ONE long cost is set, so use output:
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      output_cost_per_token_above_200k_tokens: 0.000004,
      // input long absent → inputLong = inputStd (0.000001)
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: { input_tokens: 300_000, output_tokens: 1000 },
  }, loaded);
  // stdInputCount = 200_000; longInputCount = 100_000
  // inputUsd = 200_000 * 1e-6 + 100_000 * 1e-6 = 0.3
  // outputUsd = 1000 * 4e-6 = 0.004
  assert.ok(Math.abs(r.usd - 0.304) < 1e-9, `expected 0.304 got ${r.usd}`);
});

test('mutation: buildLookup creates alias for prefixed keys (L80-81)', () => {
  // Use a synthetic snapshot to isolate alias behavior from collision with
  // existing plain keys in the real snapshot.
  __resetCache();
  // Test via the real snapshot lookup: alias must exist for a prefixed key.
  const s = loadSnapshot();
  // bedrock/ prefix variant: pricing snapshot has "anthropic.claude-sonnet-4-6"
  // → buildLookup must set alias "claude-sonnet-4-6". Both keys exist.
  assert.ok(s.lookup.has('anthropic.claude-sonnet-4-6'),
    'expected original key present');
  // Stripped alias must be present and point to a non-null model config.
  const stripped = s.lookup.get('claude-sonnet-4-6');
  assert.ok(stripped && typeof stripped === 'object',
    'expected stripped alias to point to a model config');
  assert.ok(typeof stripped.input_cost_per_token === 'number');
});

test('mutation: resolveModel uppercased input still resolves (case-insensitive)', () => {
  // Kills MethodExpression L81 stripped.toUpperCase() mutant — alias uses
  // .toLowerCase(); querying with uppercase must still hit it.
  __resetCache();
  const s = loadSnapshot();
  const cfg = resolveModel('CLAUDE-SONNET-4-5', s.lookup);
  assert.ok(cfg, 'uppercase model name should resolve case-insensitively');
});

test('mutation: priceEntry no model field returns unknown (L121-123)', () => {
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntry({ usage: { input_tokens: 1 } }, s);
  assert.equal(r.usd, null);
  assert.equal(r.pricing_source, 'unknown');
});

test('mutation: tier branch requires totalInput > 200k AND configured long cost (L143 second clause)', () => {
  // If model has NO long-tier cost configured, even > 200k stays standard.
  const loaded = loadedFor([
    ['t', {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      // NO above_200k fields → tier branch must not fire.
    }],
  ]);
  const r = priceEntry({
    model: 't',
    usage: { input_tokens: 300_000, output_tokens: 1000 },
  }, loaded);
  assert.equal(r.tier_used, 'standard');
  // 300_000 * 1e-6 + 1000 * 2e-6 = 0.3 + 0.002 = 0.302
  assert.ok(Math.abs(r.usd - 0.302) < 1e-9, `expected 0.302 got ${r.usd}`);
});

test('mutation: priceEntries forwarded loaded without lookup falls back to loadSnapshot (L174)', () => {
  __resetCache();
  // Pass an object with NO lookup field — implementation must fall through to loadSnapshot().
  const r = priceEntries(
    [fakeEntry({ model: 'claude-sonnet-4-5' })],
    { staleness_days: 999 }, // no .lookup → falls back
  );
  // total_usd must be > 0 (snapshot loaded fresh, real pricing applied).
  assert.ok(r.total_usd > 0);
  // staleness_days comes from the fresh load, not the bogus 999.
  assert.notEqual(r.pricing_staleness_days, 999);
});

test('mutation: numOr0 rejects non-finite (NaN, Infinity) and strings (L247)', () => {
  // Indirect: pass NaN as input_tokens → must be treated as 0.
  __resetCache();
  const s = loadSnapshot();
  const r = priceEntry({
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: NaN, output_tokens: Infinity, cache_read_input_tokens: '999' },
  }, s);
  // All three should be 0 → total usd = 0.
  assert.equal(r.usd, 0);
  assert.equal(r.pricing_source, 'snapshot');
});
