// Phase 172 — parser unit tests.
//
// Invariantes:
//  - Linha quebrada NÃO derruba linhas posteriores (lenient).
//  - error_count + ok_count == total não-vazias.
//  - errors[] tem line_no + snippet + reason.
//  - Warning emitido se error_ratio > 0.5%.
//  - Modo strict joga exceção na 1a corrompida.
//  - Entry sem timestamp/model conta como error (não silenciosa).
//  - CRLF handling.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseJsonl, parseJsonlFile } from '../../src/core/cost/parser.js';

const FIXTURES = path.resolve('test/fixtures');

test('lenient mode: corrupted middle lines do NOT drop later valid lines', () => {
  const content = fs.readFileSync(path.join(FIXTURES, 'jsonl-corrompido-meio.jsonl'), 'utf8');
  const r = parseJsonl(content);
  assert.equal(r.ok_count, 6); // 3 antes + 3 depois.
  assert.ok(r.error_count >= 1); // pelo menos 1 linha corrompida detectada.
  assert.ok(r.errors.length >= 1);
  assert.ok(r.errors[0].line_no >= 1);
  assert.ok(r.errors[0].snippet.length > 0);
  assert.ok(r.errors[0].reason.startsWith('json_parse_error') || r.errors[0].reason.startsWith('invalid_shape'));
});

test('lenient mode: emits warning above 0.5% error ratio', () => {
  // 1 ok + 1 erro = 50% error.
  const content = '{"timestamp":"2026-06-05T10:00:00Z","model":"claude-sonnet-4-5"}\n{ BROKEN\n';
  const r = parseJsonl(content);
  assert.equal(r.ok_count, 1);
  assert.equal(r.error_count, 1);
  assert.ok(r.warning && r.warning.includes('parser_error_ratio'));
});

test('lenient mode: no warning when error rate below threshold', () => {
  const lines = [];
  for (let i = 0; i < 1000; i++) {
    lines.push(`{"timestamp":"2026-06-05T10:00:00Z","model":"claude-sonnet-4-5","messageId":"m${i}","requestId":"r${i}"}`);
  }
  const r = parseJsonl(lines.join('\n'));
  assert.equal(r.ok_count, 1000);
  assert.equal(r.error_count, 0);
  assert.equal(r.warning, undefined);
});

test('strict mode: throws on first broken line', () => {
  const content = '{"timestamp":"2026-06-05T10:00:00Z","model":"x"}\n{ BROKEN\n';
  assert.throws(() => parseJsonl(content, { mode: 'strict' }));
});

test('lenient mode: missing timestamp counts as error (invalid_shape)', () => {
  const content = '{"model":"claude-sonnet-4-5"}\n';
  const r = parseJsonl(content);
  assert.equal(r.ok_count, 0);
  assert.equal(r.error_count, 1);
  assert.ok(r.errors[0].reason.includes('invalid_shape'));
});

test('lenient mode: missing model counts as error', () => {
  const content = '{"timestamp":"2026-06-05T10:00:00Z"}\n';
  const r = parseJsonl(content);
  assert.equal(r.ok_count, 0);
  assert.equal(r.error_count, 1);
});

test('lenient mode: handles CRLF line endings', () => {
  const content = '{"timestamp":"2026-06-05T10:00:00Z","model":"claude-sonnet-4-5"}\r\n{"timestamp":"2026-06-05T10:01:00Z","model":"claude-opus-4-1"}\r\n';
  const r = parseJsonl(content);
  assert.equal(r.ok_count, 2);
  assert.equal(r.error_count, 0);
});

test('lenient mode: empty content returns empty result', () => {
  const r = parseJsonl('');
  assert.equal(r.ok_count, 0);
  assert.equal(r.error_count, 0);
  assert.deepEqual(r.entries, []);
});

test('parseJsonlFile populates source_file and mtime', () => {
  const tmp = path.join(os.tmpdir(), `kit-parser-${Date.now()}.jsonl`);
  fs.writeFileSync(tmp, '{"timestamp":"2026-06-05T10:00:00Z","model":"claude-sonnet-4-5"}\n');
  const r = parseJsonlFile(tmp);
  assert.equal(r.ok_count, 1);
  assert.ok(r.source_file && r.source_file.includes('kit-parser-'));
  assert.ok(typeof r.source_mtime === 'number');
});
