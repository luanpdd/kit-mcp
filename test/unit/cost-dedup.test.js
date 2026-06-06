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

// =====================================================================
// Mutation-targeted tests (Phase 172 — gap G6).
// =====================================================================

import { __internals } from '../../src/core/cost/dedup.js';

test('mutation: empty-string messageId is rejected (L101 v.length > 0)', () => {
  // Kill mutant: v.length >= 0 would accept empty string; v.length > 0 rejects.
  const r = dedup([entry({ messageId: '' })]);
  assert.equal(r.skipped_entry_count, 1);
  assert.equal(r.kept.length, 0);
});

test('mutation: empty-string requestId is rejected', () => {
  const r = dedup([entry({ requestId: '' })]);
  assert.equal(r.skipped_entry_count, 1);
  assert.equal(r.kept.length, 0);
});

test('mutation: number messageId is rejected (isStrongId type guard)', () => {
  const r = dedup([entry({ messageId: 12345 })]);
  assert.equal(r.skipped_entry_count, 1);
  assert.equal(r.kept.length, 0);
});

test('mutation: __internals.isStrongId matches expected truth table', () => {
  assert.equal(__internals.isStrongId('abc'), true);
  assert.equal(__internals.isStrongId(''), false);
  assert.equal(__internals.isStrongId(null), false);
  assert.equal(__internals.isStrongId(undefined), false);
  assert.equal(__internals.isStrongId(0), false);
  assert.equal(__internals.isStrongId(42), false);
});

test('mutation: __internals exports compositeKey/isStrongId/tokenSum (L181)', () => {
  // Kills ObjectLiteral mutant {} on the export.
  assert.equal(typeof __internals.compositeKey, 'function');
  assert.equal(typeof __internals.isStrongId, 'function');
  assert.equal(typeof __internals.tokenSum, 'function');
});

test('mutation: compositeKey includes model + minute-bucket distinctly (L92 sep + bucket)', () => {
  // Kills StringLiteral L92 "" mutant — separator must yield 4 fields.
  const k = __internals.compositeKey({
    messageId: 'M',
    requestId: 'R',
    model: 'claude-x',
    timestamp: '2026-06-05T10:00:00.000Z',
  });
  const parts = k.split('|');
  assert.equal(parts.length, 4);
  assert.equal(parts[0], 'M');
  assert.equal(parts[1], 'R');
  assert.equal(parts[2], 'claude-x');
  assert.ok(/^\d+$/.test(parts[3]), 'bucket must be a positive integer');
});

test('mutation: compositeKey marks invalid timestamp as "na"', () => {
  const k = __internals.compositeKey({
    messageId: 'M',
    requestId: 'R',
    model: 'm',
    timestamp: 'not-a-date',
  });
  assert.ok(k.endsWith('|na'), `expected bucket="na" got ${k}`);
});

test('mutation: tokenSum equals sum of all 4 token types (L171-174)', () => {
  // Kills L171-174 ConditionalExpression + LogicalOperator + ArithmeticOperator mutants.
  const sum = __internals.tokenSum({
    usage: {
      input_tokens: 1,
      output_tokens: 10,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 1000,
    },
  });
  assert.equal(sum, 1111);
});

test('mutation: tokenSum picks up each token type individually', () => {
  // Each individual contribution catches mutants that drop one term.
  assert.equal(__internals.tokenSum({ usage: { input_tokens: 5 } }), 5);
  assert.equal(__internals.tokenSum({ usage: { output_tokens: 7 } }), 7);
  assert.equal(__internals.tokenSum({ usage: { cache_creation_input_tokens: 9 } }), 9);
  assert.equal(__internals.tokenSum({ usage: { cache_read_input_tokens: 11 } }), 11);
});

test('mutation: tokenSum returns 0 when usage missing', () => {
  assert.equal(__internals.tokenSum({}), 0);
});

test('mutation: tie-break: cache_read_tokens alone increases winner score', () => {
  // Differentiates cache_read in tokenSum (kills replacement of L174).
  const a = entry({ __source_mtime: 1, usage: { cache_read_input_tokens: 1 }, __marker: 'small' });
  const b = entry({ __source_mtime: 1, usage: { cache_read_input_tokens: 999 }, __marker: 'big' });
  const r = dedup([a, b]);
  assert.equal(r.kept[0].__marker, 'big');
});

test('mutation: tie-break: cache_creation_tokens alone determines winner', () => {
  const a = entry({ __source_mtime: 1, usage: { cache_creation_input_tokens: 1 }, __marker: 'small' });
  const b = entry({ __source_mtime: 1, usage: { cache_creation_input_tokens: 999 }, __marker: 'big' });
  const r = dedup([a, b]);
  assert.equal(r.kept[0].__marker, 'big');
});

test('mutation: source_mtime tie-break uses subtraction direction (L135 ma-mb)', () => {
  // mtime 5 vs mtime 1 → "5" must win. If mutated to ma+mb the comparator
  // would still pick highest sum but reversing inputs in a 3-way set would fail.
  const a = entry({ __source_mtime: 1, __marker: 'oldest' });
  const b = entry({ __source_mtime: 5, __marker: 'newest' });
  const c = entry({ __source_mtime: 3, __marker: 'mid' });
  const r = dedup([a, b, c]);
  assert.equal(r.kept[0].__marker, 'newest');
});

test('mutation: tie-break uses sourceMtimes when entry has __source_file but no inline mtime', () => {
  // Kills L158 ConditionalExpression + LogicalOperator + EqualityOperator mutants.
  const a = entry({ __source_file: 'a.jsonl', __marker: 'a-file' });
  const b = entry({ __source_file: 'b.jsonl', __marker: 'b-file' });
  const r = dedup([a, b], { sourceMtimes: { 'a.jsonl': 100, 'b.jsonl': 999 } });
  assert.equal(r.kept[0].__marker, 'b-file');
});

test('mutation: tie-break: timestamp earlier wins when everything else equal (L148 tsB-tsA)', () => {
  // Kills L146-148 timestamp tie-break mutants. Earlier timestamp = winner.
  // BOTH must be in same minute bucket → 10:00 and 10:00:30.
  const a = entry({ timestamp: '2026-06-05T10:00:00.000Z', __marker: 'earlier' });
  const b = entry({ timestamp: '2026-06-05T10:00:30.000Z', __marker: 'later' });
  const r = dedup([a, b]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'earlier');
});

test('mutation: 3-way tie-break is transitive (L115 cmp > 0 strict)', () => {
  // Kills L115 cmp >= 0 mutant. With strict >, equal cmp keeps `best` (first); with >=, would flip.
  const a = entry({ __source_mtime: 5, __marker: 'A' });
  const b = entry({ __source_mtime: 5, __marker: 'B' });
  // All equal except marker; first must remain.
  const r = dedup([a, b]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'A');
});

test('mutation: opts.sourceMtimes presence does not affect entries with __source_mtime', () => {
  // Kills L38 conditional expression mutants (true/false/&&).
  const a = entry({ __source_mtime: 100, __marker: 'A' });
  const b = entry({ __source_mtime: 200, __marker: 'B' });
  const withOpts = dedup([a, b], { sourceMtimes: { foo: 9999 } });
  const withoutOpts = dedup([a, b]);
  assert.equal(withOpts.kept[0].__marker, 'B');
  assert.equal(withoutOpts.kept[0].__marker, 'B');
});

test('mutation: two entries pass through when buckets differ — buckets count = 2', () => {
  // Verifies buckets field reflects unique composite keys (kills ObjectLiteral mutants).
  const r = dedup([
    entry({ timestamp: '2026-06-05T10:00:00.000Z' }),
    entry({ timestamp: '2026-06-05T10:05:00.000Z' }),
  ]);
  assert.equal(r.buckets, 2);
});

test('mutation: 3-way sidechain priority — ALL sidechain loses to ONE non-sidechain (L139 sb-sa)', () => {
  // Kills L139 ArithmeticOperator sb+sa mutant. Three entries: two sidechain, one main.
  const a = entry({ __source_mtime: 100, isSidechain: true, __marker: 'side1' });
  const b = entry({ __source_mtime: 100, isSidechain: true, __marker: 'side2' });
  const c = entry({ __source_mtime: 100, isSidechain: false, __marker: 'main' });
  const r = dedup([a, b, c]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'main');
});

test('mutation: token tie-break direction: more tokens > fewer (L143 ta-tb sign)', () => {
  // 3 entries with strictly ascending tokens; biggest must win.
  // Kills L143 ta+tb mutant — sign of subtraction matters in a 3-way comparison.
  const a = entry({ __source_mtime: 100, usage: { input_tokens: 10 }, __marker: 'small' });
  const b = entry({ __source_mtime: 100, usage: { input_tokens: 1000 }, __marker: 'big' });
  const c = entry({ __source_mtime: 100, usage: { input_tokens: 100 }, __marker: 'mid' });
  const r = dedup([a, b, c]);
  assert.equal(r.kept[0].__marker, 'big');
});

test('mutation: dedup keeps strict ordering when 3 entries all equal except timestamp', () => {
  // Earliest timestamp wins; 3-way ensures direction is correct.
  const a = entry({ timestamp: '2026-06-05T10:00:30.000Z', __marker: 'mid' });
  const b = entry({ timestamp: '2026-06-05T10:00:00.000Z', __marker: 'earliest' });
  const c = entry({ timestamp: '2026-06-05T10:00:59.000Z', __marker: 'latest' });
  const r = dedup([a, b, c]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'earliest');
});

test('mutation: source_file unknown to sourceMtimes map falls back to 0', () => {
  // Kills L158 mutants — when entry has __source_file but map has no key,
  // mtime defaults to 0 (not undefined). Entries with __source_mtime should still win.
  const a = entry({ __source_file: 'missing.jsonl', __marker: 'missing-file' });
  const b = entry({ __source_mtime: 1, __marker: 'inline-mtime' });
  const r = dedup([a, b], { sourceMtimes: {} });
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'inline-mtime');
});

test('mutation: dedup with single-entry bucket preserves entry continue path (L65)', () => {
  // Two singleton buckets — neither triggers pickWinner. Kills L28 conditional + L30 block mutants.
  const r = dedup([
    entry({ messageId: 'A' }),
    entry({ messageId: 'B' }),
  ]);
  assert.equal(r.kept.length, 2);
  assert.equal(r.deduped_count, 0);
  assert.equal(r.buckets, 2);
});

test('mutation: single-entry group bypasses pickWinner (L65 block stays)', () => {
  // Kills L65 BlockStatement {} mutant — single-entry path must still push.
  const r = dedup([entry({ __marker: 'solo' })]);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].__marker, 'solo');
});
