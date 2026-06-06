// Phase 172 — aggregate-phase unit tests.
//
// Invariantes:
//  - Phase com SPEC.md mtime + STATE.md completed_at + commits → confidence='high'.
//  - Phase com só SPEC.md mtime → confidence='low'.
//  - Phase com 2/3 sinais → confidence='medium'.
//  - Phase inexistente → confidence='unknown' + reason.
//  - Override de janela via opts.phase_window_override (testes determinísticos).
//  - Entries fora da janela são filtradas.
//  - Detecção de rebase recente rebaixa pra 'low'.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { aggregatePhase, resolvePhaseWindow } from '../../src/core/cost/aggregate-phase.js';
import { __resetCache } from '../../src/core/cost/pricing.js';

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

test('phase inexistente → confidence=unknown', () => {
  __resetCache();
  const r = aggregatePhase({
    phase_id: '9999',
    root_dir: os.tmpdir(),
    entries: [],
    skip_git: true,
  });
  assert.equal(r.correlation_confidence, 'unknown');
  assert.equal(r.total_usd, null);
});

test('phase com override de janela filtra entries por timestamp', () => {
  __resetCache();
  const t0 = Date.parse('2026-06-05T00:00:00Z');
  const t1 = Date.parse('2026-06-05T12:00:00Z');
  const t2 = Date.parse('2026-06-06T00:00:00Z');
  const entries = [entry(t0 - 1000, 'before'), entry(t1, 'inside'), entry(t2 + 1000, 'after')];
  const r = aggregatePhase({
    phase_id: '172',
    entries,
    skip_git: true,
    phase_window_override: { started_at: t0, ended_at: t2, slug: 'cost-tracking', confidence: 'high' },
  });
  assert.equal(r.entry_count, 1);
  assert.equal(r.correlation_confidence, 'high');
});

test('phase ativa (ended_at=null) usa now como limite superior', () => {
  __resetCache();
  const t0 = Date.parse('2026-06-05T00:00:00Z');
  const now = Date.parse('2026-06-05T20:00:00Z');
  const entries = [
    entry(t0 + 1000, 'inside'),
    entry(now + 1000, 'future'),
  ];
  const r = aggregatePhase({
    phase_id: '172',
    entries,
    skip_git: true,
    now,
    phase_window_override: { started_at: t0, ended_at: null, slug: 'cost-tracking', confidence: 'medium' },
  });
  assert.equal(r.entry_count, 1);
  assert.equal(r.is_active, true);
  assert.equal(r.ended_at, null);
});

test('resolvePhaseWindow: phase dir com SPEC.md → confidence low (apenas 1 sinal)', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-phase-'));
  try {
    const phaseDir = path.join(tmp, '.planning', 'phases', '500-test-phase');
    await fs.mkdir(phaseDir, { recursive: true });
    await fs.writeFile(path.join(phaseDir, '500-SPEC.md'), '# spec\n');
    const w = resolvePhaseWindow(tmp, '500', { skip_git: true, now: Date.now() });
    assert.equal(w.slug, 'test-phase');
    assert.equal(w.confidence, 'low');
    assert.equal(w.signals.spec_mtime, true);
    assert.equal(w.signals.state_completed_at, false);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('resolvePhaseWindow: SPEC.md + STATE.md completed_at → confidence medium (2 sinais)', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-cost-phase-'));
  try {
    const phaseDir = path.join(tmp, '.planning', 'phases', '501-test');
    await fs.mkdir(phaseDir, { recursive: true });
    await fs.writeFile(path.join(phaseDir, '501-SPEC.md'), '# spec\n');
    const stateFile = path.join(tmp, '.planning', 'STATE.md');
    await fs.writeFile(
      stateFile,
      `---\nphase:501\ncompleted_at: "2026-06-05T18:00:00.000Z"\n---\n# done\n`,
    );
    const w = resolvePhaseWindow(tmp, '501', { skip_git: true, now: Date.now() });
    assert.equal(w.confidence, 'medium');
    assert.equal(w.signals.spec_mtime, true);
    assert.equal(w.signals.state_completed_at, true);
    assert.ok(w.ended_at, 'ended_at deve estar populado');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('aggregatePhase shape canônico presente', () => {
  __resetCache();
  const r = aggregatePhase({
    phase_id: '172',
    entries: [entry(Date.parse('2026-06-05T10:00:00Z'), 'x')],
    skip_git: true,
    phase_window_override: { started_at: 0, ended_at: Date.now() + 1e9, confidence: 'high' },
  });
  for (const k of [
    'phase_id', 'phase_slug', 'started_at', 'ended_at', 'correlation_confidence',
    'total_usd', 'by_model', 'entry_count', 'deduped_count',
    'skipped_entry_count', 'parse_error_count', 'unknown_models',
    'pricing_source', 'pricing_staleness_days',
  ]) {
    assert.ok(k in r, `campo ${k} ausente`);
  }
});
