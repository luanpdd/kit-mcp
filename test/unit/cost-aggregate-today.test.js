// Phase 172 — aggregate-today unit tests.
//
// Invariantes:
//  - tz=UTC default filtra por ISO 'YYYY-MM-DD' do dia (sem deslocamento).
//  - tz=America/Sao_Paulo (UTC-3) cruza meia-noite corretamente: entry às
//    02:00 UTC de 2026-06-05 conta como 2026-06-04 em SP.
//  - DST boundary: usar epoch absoluto, não horas locais.
//  - Shape canônico: total_usd, by_model, entry_count, deduped_count,
//    skipped_entry_count, parse_error_count, unknown_models,
//    pricing_source, pricing_staleness_days.
//  - Entries duplicadas pelo dedup contam em deduped_count.
//  - Entries com messageId null contam em skipped_entry_count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateToday, ymdInTz } from '../../src/core/cost/aggregate-today.js';
import { __resetCache } from '../../src/core/cost/pricing.js';

function entry(o = {}) {
  return {
    timestamp: '2026-06-05T10:00:00.000Z',
    sessionId: 's1',
    messageId: 'm1',
    requestId: 'r1',
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: 100, output_tokens: 50 },
    ...o,
  };
}

test('aggregateToday tz=UTC filtra apenas entries do dia ISO', () => {
  __resetCache();
  const entries = [
    entry({ timestamp: '2026-06-05T10:00:00.000Z', messageId: 'a', requestId: 'a' }),
    entry({ timestamp: '2026-06-05T23:59:00.000Z', messageId: 'b', requestId: 'b' }),
    entry({ timestamp: '2026-06-04T23:59:00.000Z', messageId: 'c', requestId: 'c' }),
    entry({ timestamp: '2026-06-06T00:00:01.000Z', messageId: 'd', requestId: 'd' }),
  ];
  const r = aggregateToday({ entries, date: '2026-06-05', tz: 'UTC', now: Date.parse('2026-06-05T12:00:00Z') });
  assert.equal(r.entry_count, 2);
  assert.equal(r.date, '2026-06-05');
  assert.equal(r.tz, 'UTC');
});

test('aggregateToday tz=America/Sao_Paulo cruza meia-noite corretamente', () => {
  __resetCache();
  // 2026-06-05T02:00:00Z = 2026-06-04 23:00 em São Paulo (UTC-3).
  const entries = [
    entry({ timestamp: '2026-06-05T02:00:00.000Z', messageId: 'sp1', requestId: 'sp1' }),
    entry({ timestamp: '2026-06-05T03:30:00.000Z', messageId: 'sp2', requestId: 'sp2' }), // 00:30 SP = 2026-06-05
  ];
  const rUtc = aggregateToday({ entries, date: '2026-06-05', tz: 'UTC' });
  assert.equal(rUtc.entry_count, 2);

  const rSp4 = aggregateToday({ entries, date: '2026-06-04', tz: 'America/Sao_Paulo' });
  assert.equal(rSp4.entry_count, 1, 'entry 02:00Z deve estar em 2026-06-04 SP');
  const rSp5 = aggregateToday({ entries, date: '2026-06-05', tz: 'America/Sao_Paulo' });
  assert.equal(rSp5.entry_count, 1, 'entry 03:30Z deve estar em 2026-06-05 SP');
});

test('aggregateToday DST boundary não cria deslocamento fantasma (epoch absoluto)', () => {
  __resetCache();
  // Outono austral 2026: SP NÃO tem mais DST desde 2019, mas usamos
  // America/New_York (DST 2026: termina 1 Nov, começa 8 Mar).
  // 2026-03-08T07:00:00Z = 02:00 EST → vira 03:00 EDT (relógio pula).
  // Garantia: entry 06:00Z (01:00 EST antes do salto) e 08:00Z (04:00 EDT)
  // estão ambas em 2026-03-08 (mesmo dia local).
  const entries = [
    entry({ timestamp: '2026-03-08T06:00:00.000Z', messageId: 'dst1', requestId: 'dst1' }),
    entry({ timestamp: '2026-03-08T08:00:00.000Z', messageId: 'dst2', requestId: 'dst2' }),
  ];
  const r = aggregateToday({ entries, date: '2026-03-08', tz: 'America/New_York' });
  assert.equal(r.entry_count, 2);
});

test('aggregateToday shape canônico contém todos os campos do SPEC', () => {
  __resetCache();
  const r = aggregateToday({ entries: [entry()], date: '2026-06-05', tz: 'UTC' });
  for (const k of [
    'date', 'tz', 'total_usd', 'by_model', 'entry_count', 'deduped_count',
    'skipped_entry_count', 'parse_error_count', 'unknown_models',
    'pricing_source', 'pricing_staleness_days',
  ]) {
    assert.ok(k in r, `campo ${k} ausente`);
  }
});

test('aggregateToday conta dedup + skipped_entry_count', () => {
  __resetCache();
  const ts = '2026-06-05T10:00:00.000Z';
  const entries = [
    entry({ timestamp: ts, messageId: 'dup', requestId: 'dup' }),
    entry({ timestamp: ts, messageId: 'dup', requestId: 'dup' }), // dup
    entry({ timestamp: ts, messageId: null, requestId: 'x' }),     // skip
  ];
  const r = aggregateToday({ entries, date: '2026-06-05', tz: 'UTC' });
  assert.equal(r.entry_count, 1, 'após dedup só sobra 1');
  assert.equal(r.deduped_count, 1);
  assert.equal(r.skipped_entry_count, 1);
});

test('ymdInTz UTC short-circuit', () => {
  assert.equal(ymdInTz(Date.parse('2026-06-05T00:00:00Z'), 'UTC'), '2026-06-05');
  assert.equal(ymdInTz(Date.parse('2026-06-05T23:59:59Z'), 'UTC'), '2026-06-05');
});
