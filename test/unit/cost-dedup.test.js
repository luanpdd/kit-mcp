// Phase 172 — dedup unit tests (gap G6).
//
// Invariantes:
//  - Entry com messageId null → skipped_entry_count++, NÃO kept.
//  - Entry com requestId null → mesmo.
//  - 2 entries com mesma chave forte e mesmo minuteBucket → 1 kept + 1 deduped.
//  - 2 entries com mesma chave forte mas minutos diferentes → 2 kept.
//  - Tie-break: source mtime maior ganha; sidechain perde de não-sidechain.
//  - Entries de 2 modelos diferentes nunca colidem.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedup } from '../../src/core/cost/dedup.js';

function entry(o) {
  return {
    timestamp: '2026-06-05T10:00:00.000Z',
    sessionId: 's',
    messageId: 'm',
    requestId: 'r',
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: 100, output_tokens: 50 },
    ...o,
  };
}

test('skips entries with null messageId', () => {
  const r = dedup([
    entry({ messageId: null }),
    entry({ requestId: null }),
    entry({}),
  ]);
  assert.equal(r.skipped_entry_count, 2);
  assert.equal(r.kept.length, 1);
});

test('skips entries with undefined IDs', () => {
  const e = entry({});
  delete e.messageId;
  const r = dedup([e]);
  assert.equal(r.skipped_entry_count, 1);
});

test('two entries with same composite key in same minute bucket: 1 kept + 1 deduped', () => {
  const r = dedup([
    entry({ timestamp: '2026-06-05T10:00:00.000Z' }),
    entry({ timestamp: '2026-06-05T10:00:30.000Z' }), // mesmo minuteBucket.
  ]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.deduped_count, 1);
  assert.equal(r.skipped_entry_count, 0);
});

test('two entries with same IDs but different minutes: both kept', () => {
  const r = dedup([
    entry({ timestamp: '2026-06-05T10:00:00.000Z' }),
    entry({ timestamp: '2026-06-05T10:05:00.000Z' }), // bucket diferente.
  ]);
  assert.equal(r.kept.length, 2);
  assert.equal(r.deduped_count, 0);
});

test('two entries same IDs but different models: both kept', () => {
  const r = dedup([
    entry({ model: 'claude-sonnet-4-5' }),
    entry({ model: 'claude-opus-4-1' }),
  ]);
  assert.equal(r.kept.length, 2);
});

test('tie-break: newer source_mtime wins', () => {
  const a = entry({ __source_mtime: 1000, __marker: 'old' });
  const b = entry({ __source_mtime: 2000, __marker: 'new' });
  const r = dedup([a, b]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'new');
});

test('tie-break: non-sidechain beats sidechain when mtimes equal', () => {
  const a = entry({ __source_mtime: 1000, isSidechain: true, __marker: 'side' });
  const b = entry({ __source_mtime: 1000, isSidechain: false, __marker: 'main' });
  const r = dedup([a, b]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'main');
});

test('tie-break: more tokens wins when mtime + sidechain equal', () => {
  const a = entry({ __source_mtime: 1000, usage: { input_tokens: 100, output_tokens: 50 }, __marker: 'small' });
  const b = entry({ __source_mtime: 1000, usage: { input_tokens: 1000, output_tokens: 500 }, __marker: 'big' });
  const r = dedup([a, b]);
  assert.equal(r.kept[0].__marker, 'big');
});

test('empty input returns clean shape', () => {
  const r = dedup([]);
  assert.equal(r.kept.length, 0);
  assert.equal(r.deduped_count, 0);
  assert.equal(r.skipped_entry_count, 0);
});

test('non-array input returns clean shape (defensive)', () => {
  const r = dedup(null);
  assert.equal(r.kept.length, 0);
});
