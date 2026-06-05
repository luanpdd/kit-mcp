// Phase 172 — aggregate-blocks unit tests (5h windows + gap detection).
//
// Invariantes:
//  - 3 entries em 5h → 1 bloco.
//  - Gap > 5h entre entries → bloco novo (mesmo dentro da janela floor).
//  - block_start_ts é múltiplo de 5h em epoch ms (UTC absoluto).
//  - DST boundary: entries em fuso com salto de relógio NÃO geram bloco
//    fantasma — epoch ms é absoluto.
//  - is_active=true só quando now está dentro do bloco.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateBlocks } from '../../src/core/cost/aggregate-blocks.js';
import { __resetCache } from '../../src/core/cost/pricing.js';

const FIVE_H = 5 * 60 * 60 * 1000;

function entry(ts, suffix) {
  return {
    timestamp: typeof ts === 'string' ? ts : new Date(ts).toISOString(),
    sessionId: 's',
    messageId: 'm-' + suffix,
    requestId: 'r-' + suffix,
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

test('3 entries em janela de 5h → 1 bloco', () => {
  __resetCache();
  const base = Date.parse('2026-06-05T00:00:00.000Z');
  const entries = [
    entry(base + 0, '1'),
    entry(base + 60 * 60 * 1000, '2'),       // +1h
    entry(base + 4 * 60 * 60 * 1000, '3'),   // +4h
  ];
  const r = aggregateBlocks({ entries, now: base + FIVE_H });
  assert.equal(r.blocks.length, 1);
  assert.equal(r.blocks[0].entry_count, 3);
});

test('gap > 5h entre entries cria bloco novo', () => {
  __resetCache();
  const base = Date.parse('2026-06-05T00:00:00.000Z');
  const entries = [
    entry(base + 0, '1'),
    entry(base + FIVE_H + 60 * 1000, '2'), // 5h01min depois → gap > 5h
    entry(base + FIVE_H + 2 * 60 * 1000, '3'),
  ];
  const r = aggregateBlocks({ entries, now: base + 12 * 60 * 60 * 1000 });
  assert.equal(r.blocks.length, 2);
  assert.equal(r.blocks[1].gap_before, true);
});

test('block_start_ts é floor da HORA UTC da 1a entry (ccusage-compatible)', () => {
  __resetCache();
  const ts = Date.parse('2026-06-05T07:30:00.000Z');
  const entries = [entry(ts, 'a')];
  const r = aggregateBlocks({ entries, now: ts + 60_000 });
  assert.equal(r.blocks.length, 1);
  // 07:30 UTC → floor 1h = 07:00 UTC (não 5h epoch — esse desalinha desde 1970).
  assert.equal(new Date(r.blocks[0].block_start_ts).toISOString(), '2026-06-05T07:00:00.000Z');
});

test('DST boundary não duplica bloco — usamos epoch absoluto', () => {
  __resetCache();
  // 2026-03-08T07:00:00Z marca salto DST em America/New_York.
  // Mas aggregateBlocks NÃO consulta tz local; usa epoch ms. Garantia:
  // 4 entries espaçadas 1h ao redor do salto continuam em 1-2 blocos
  // (5h window), nunca em 3+ blocos só por causa do tz.
  const base = Date.parse('2026-03-08T05:00:00.000Z');
  const entries = [
    entry(base, 'a'),
    entry(base + 60 * 60 * 1000, 'b'),
    entry(base + 2 * 60 * 60 * 1000, 'c'),
    entry(base + 3 * 60 * 60 * 1000, 'd'),
  ];
  const r = aggregateBlocks({ entries, now: base + 4 * 60 * 60 * 1000 });
  assert.equal(r.blocks.length, 1, '4 entries em 3h dentro do mesmo bloco UTC');
  assert.equal(r.blocks[0].entry_count, 4);
});

test('is_active=true quando now dentro do bloco', () => {
  __resetCache();
  const base = Date.parse('2026-06-05T00:00:00.000Z');
  const entries = [entry(base, 'a'), entry(base + 60_000, 'b')];
  const rActive = aggregateBlocks({ entries, now: base + 60_000 });
  assert.equal(rActive.blocks[0].is_active, true);
  // 6h depois — fora da janela do bloco.
  const rOld = aggregateBlocks({ entries, now: base + 6 * 60 * 60 * 1000 });
  assert.equal(rOld.blocks[0].is_active, false);
});

test('aggregateBlocks shape canônico contém todos os campos do SPEC', () => {
  __resetCache();
  const r = aggregateBlocks({
    entries: [entry(Date.parse('2026-06-05T10:00:00Z'), 'x')],
    now: Date.parse('2026-06-05T11:00:00Z'),
  });
  for (const k of [
    'blocks', 'total_usd', 'by_model', 'entry_count', 'deduped_count',
    'skipped_entry_count', 'parse_error_count', 'unknown_models',
    'pricing_source', 'pricing_staleness_days',
  ]) {
    assert.ok(k in r, `campo ${k} ausente`);
  }
});
