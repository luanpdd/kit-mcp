// Phase 172 M4 — statusline large-JSONL sanity.
//
// Goal: statusline still produces a sensible output (and stays under the
// cold budget) when the active session transcript has ~10k entries.
//
// Why 10k and not 50k: 50k slows CI by minutes for marginal coverage —
// 10k already stresses the parser + dedup + pricing pipeline enough to
// catch O(n²) regressions while keeping CI under a few seconds.
//
// We exercise `compute()` directly (in-process) to isolate the algorithmic
// cost from subprocess startup. The bench file already covers the
// subprocess cold path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { compute } from '../../src/cli/statusline.js';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');
const fixturesDir = path.join(repoRoot, 'test', 'fixtures');

const SESSION_ID = 'sess-statusline-10k';
const LARGE_FIXTURE = path.join(fixturesDir, 'jsonl-statusline-10k.jsonl');
const TARGET_ENTRIES = 10_000;
const BUDGET_MS_IN_PROCESS = 2000; // in-process compute; subprocess budget is checked in bench.

function ensureFixture() {
  if (fs.existsSync(LARGE_FIXTURE)) {
    const lines = fs.readFileSync(LARGE_FIXTURE, 'utf8').split('\n').filter(Boolean);
    if (lines.length >= TARGET_ENTRIES) return;
  }
  fs.mkdirSync(fixturesDir, { recursive: true });
  // Mix of two models to exercise by_model aggregation. Timestamps spread over
  // ~2.7h (10_000 seconds) so today + active 5h block both have entries.
  // Sync write (writeFileSync) avoids racing with subsequent tests that read
  // the fixture immediately after.
  const now = Date.now();
  const parts = [];
  for (let i = 0; i < TARGET_ENTRIES; i++) {
    const tsMs = now - (TARGET_ENTRIES - i) * 1000; // 1 entry per second, oldest first.
    const model = i % 5 === 0 ? 'claude-opus-4-5' : 'claude-sonnet-4-5';
    parts.push(JSON.stringify({
      timestamp: new Date(tsMs).toISOString(),
      sessionId: SESSION_ID,
      messageId: `msg-10k-${i}`,
      requestId: `req-10k-${i}`,
      model,
      usage: {
        input_tokens: 50 + (i % 17),
        output_tokens: 30 + (i % 13),
        cache_creation_input_tokens: i % 100 === 0 ? 200 : 0,
        cache_read_input_tokens: i % 50 === 0 ? 80 : 0,
      },
    }));
  }
  fs.writeFileSync(LARGE_FIXTURE, parts.join('\n') + '\n');
}

function mkTmpConfigDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-cost-10k-'));
  const projects = path.join(tmp, 'projects', 'sample');
  fs.mkdirSync(projects, { recursive: true });
  const dest = path.join(projects, `${SESSION_ID}.jsonl`);
  fs.copyFileSync(LARGE_FIXTURE, dest);
  return { configDir: tmp, jsonl: dest };
}

function rmRf(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

test('M4 large-jsonl: 10k entries produces a finite statusline output', () => {
  ensureFixture();
  const { configDir, jsonl } = mkTmpConfigDir();
  try {
    const prevDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = configDir;
    try {
      const t0 = performance.now();
      const { output, fields } = compute({
        sessionId: SESSION_ID,
        transcriptPath: jsonl,
        model: { id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5' },
      }, { format: 'compact' });
      const t1 = performance.now();
      const elapsed = t1 - t0;
      process.stderr.write(`[large-jsonl] 10k entries compute=${elapsed.toFixed(0)}ms\n`);

      assert.equal(typeof output, 'string');
      assert.match(output, /sess/);
      assert.match(output, /day/);
      assert.match(output, /5h/);

      // Values are finite numbers (not NaN).
      assert.ok(Number.isFinite(fields.session_usd), 'session_usd finite');
      assert.ok(Number.isFinite(fields.day_usd), 'day_usd finite');
      assert.ok(Number.isFinite(fields.block_usd), 'block_usd finite');

      // session_usd > 0 because the 10k entries map to SESSION_ID.
      assert.ok(fields.session_usd > 0, `session_usd should be > 0 for 10k known-model entries, got ${fields.session_usd}`);

      // Sanity: in-process under 2s on dev hardware. CI skip flag mirrors bench file.
      if (process.env.CI_SKIP_BENCH !== '1') {
        assert.ok(elapsed < BUDGET_MS_IN_PROCESS, `compute took ${elapsed.toFixed(0)}ms > ${BUDGET_MS_IN_PROCESS}ms`);
      }
    } finally {
      if (prevDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = prevDir;
    }
  } finally { rmRf(configDir); }
});

test('M4 large-jsonl: fixture file exists with >= 10k entries (sanity)', () => {
  ensureFixture();
  const lines = fs.readFileSync(LARGE_FIXTURE, 'utf8').split('\n').filter(Boolean);
  assert.ok(lines.length >= TARGET_ENTRIES, `fixture has ${lines.length} lines; expected >= ${TARGET_ENTRIES}`);
});
