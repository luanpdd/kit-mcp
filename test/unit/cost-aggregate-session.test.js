// Phase 172 — aggregate-session unit tests.
//
// Invariantes:
//  - session_id explícito → filtra entries com entry.sessionId === id.
//  - transcript_path → deriva session_id de basename sem .jsonl.
//  - entries que não bate session_id são ignoradas.
//  - started_at = min ts, last_activity_at = max ts.
//  - Sem session_id e sem entries via filesystem com mtime > 30min →
//    retorna reason='no_active_session' (testado via opts.entries vazias
//    + bypass de filesystem).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { aggregateSession } from '../../src/core/cost/aggregate-session.js';
import { __resetCache } from '../../src/core/cost/pricing.js';

function entry(o = {}) {
  return {
    timestamp: '2026-06-05T10:00:00.000Z',
    sessionId: 'sess-A',
    messageId: 'm1',
    requestId: 'r1',
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: 100, output_tokens: 50 },
    ...o,
  };
}

test('session_id explícito filtra entries por sessionId', () => {
  __resetCache();
  const entries = [
    entry({ sessionId: 'sess-A', messageId: 'a', requestId: 'a' }),
    entry({ sessionId: 'sess-B', messageId: 'b', requestId: 'b' }),
    entry({ sessionId: 'sess-A', messageId: 'c', requestId: 'c', timestamp: '2026-06-05T11:00:00.000Z' }),
  ];
  const r = aggregateSession({ entries, session_id: 'sess-A' });
  assert.equal(r.session_id, 'sess-A');
  assert.equal(r.entry_count, 2);
  assert.equal(r.started_at, '2026-06-05T10:00:00.000Z');
  assert.equal(r.last_activity_at, '2026-06-05T11:00:00.000Z');
});

test('transcript_path deriva session_id de basename', () => {
  __resetCache();
  const sid = 'session-xyz-123';
  const entries = [entry({ sessionId: sid })];
  const r = aggregateSession({
    entries,
    transcript_path: `/home/user/.claude/projects/p1/${sid}.jsonl`,
  });
  assert.equal(r.session_id, sid);
  assert.equal(r.entry_count, 1);
});

test('session com nenhuma entry matched → reason=session_not_found', () => {
  __resetCache();
  const entries = [entry({ sessionId: 'sess-X' })];
  const r = aggregateSession({ entries, session_id: 'sess-Y' });
  assert.equal(r.reason, 'session_not_found');
  assert.equal(r.entry_count, 0);
  assert.equal(r.total_usd, null);
});

test('aggregateSession shape canônico presente', () => {
  __resetCache();
  const r = aggregateSession({ entries: [entry()], session_id: 'sess-A' });
  for (const k of [
    'session_id', 'started_at', 'last_activity_at', 'total_usd', 'by_model',
    'entry_count', 'deduped_count', 'skipped_entry_count', 'parse_error_count',
    'unknown_models', 'pricing_source', 'pricing_staleness_days',
  ]) {
    assert.ok(k in r, `campo ${k} ausente`);
  }
});

test('auto-deduz: filesystem vazio retorna no_active_session', async () => {
  __resetCache();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-sess-'));
  try {
    // config_dirs vazio (dir existe mas sem .jsonl) → discover acha nada → reason.
    const r = aggregateSession({ config_dirs: [tmp] });
    assert.equal(r.reason, 'no_active_session');
    assert.equal(r.entry_count, 0);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('max_idle_ms respeitado quando deduzindo sessão ativa', async () => {
  __resetCache();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-sess-idle-'));
  try {
    // Cria um arquivo jsonl em projects/ + mtime "antigo".
    const projDir = path.join(tmp, 'projects', 'p1');
    await fs.mkdir(projDir, { recursive: true });
    const file = path.join(projDir, 'old-session.jsonl');
    const line = JSON.stringify(entry({ sessionId: 'old-session' }));
    await fs.writeFile(file, line + '\n');
    // mtime back-date: 2h atrás.
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.utimes(file, past, past);

    // max_idle_ms padrão (30min) → não considera ativo.
    const r1 = aggregateSession({ config_dirs: [tmp] });
    assert.equal(r1.reason, 'no_active_session');

    // max_idle_ms = 3h → considera ativo, encontra sessão.
    const r2 = aggregateSession({ config_dirs: [tmp], max_idle_ms: 3 * 60 * 60 * 1000 });
    assert.equal(r2.session_id, 'old-session');
    assert.equal(r2.entry_count, 1);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
