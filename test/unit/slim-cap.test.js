// PERF-13-01: regression test for slim() cap.
// Validates correctness of the SUMMARY_MAX_CHARS cap and measures the
// real-world reduction in description payload for the kit-mcp's own corpus.
//
// Note: listKit() is exported from src/core/kit.js (not sync.js as the
// PLAN context suggested). Kept the test importing from the correct module
// so this works in isolation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, SUMMARY_MAX_CHARS } from '../../src/core/sync.js';
import { listKit } from '../../src/core/kit.js';

test('PERF-13-01: summarize cap is exactly 80', () => {
  assert.equal(SUMMARY_MAX_CHARS, 80);
});

test('PERF-13-01: empty description returns empty string', () => {
  assert.equal(summarize(''), '');
  assert.equal(summarize(null), '');
  assert.equal(summarize(undefined), '');
});

test('PERF-13-01: short description returned verbatim (after trim)', () => {
  assert.equal(summarize('short desc'), 'short desc');
  const exactly80 = 'a'.repeat(80);
  assert.equal(summarize(exactly80), exactly80);
  assert.equal(summarize(exactly80).length, 80);
});

test('PERF-13-01: long description truncated to 80 chars with ellipsis', () => {
  const long = 'a'.repeat(200);
  const out = summarize(long);
  assert.equal(out.length, 80, `expected 80 chars, got ${out.length}`);
  assert.ok(out.endsWith('…'), `expected ellipsis suffix, got "${out.slice(-3)}"`);
  assert.equal(out, 'a'.repeat(79) + '…');
});

test('PERF-13-01: whitespace collapsed to single space', () => {
  assert.equal(summarize('foo   bar\n\tbaz'), 'foo bar baz');
  assert.equal(summarize('  leading and trailing  '), 'leading and trailing');
});

test('PERF-13-01: realistic agent description gets capped', () => {
  // Mirror real shape from kit/agents/planner.md frontmatter:
  const realisticDesc = 'Cria planos de fase executáveis com decomposição de tarefas, análise de dependências e verificação orientada a objetivos. Acionado pelo orquestrador /planejar-fase.';
  const out = summarize(realisticDesc);
  assert.ok(out.length <= 80, `expected <=80 chars, got ${out.length}`);
  assert.ok(out.endsWith('…'), `expected ellipsis, got tail "${out.slice(-3)}"`);
});

test('PERF-13-01: real kit-mcp corpus shows >=10% reduction in description bytes', async () => {
  // Load the actual kit-mcp agents/commands/skills and measure how much
  // shorter the capped descriptions are vs. the originals.
  const kit = await listKit();
  const items = [...kit.agents, ...kit.commands, ...kit.skills, ...kit.skillsExtras];
  assert.ok(items.length > 30, `expected >=30 items in corpus, got ${items.length}`);

  let originalBytes = 0;
  let cappedBytes = 0;
  for (const item of items) {
    const orig = item.description || '';
    const capped = summarize(orig);
    originalBytes += Buffer.byteLength(orig, 'utf8');
    cappedBytes += Buffer.byteLength(capped, 'utf8');
  }

  assert.ok(originalBytes > 0, 'corpus has zero description bytes — listKit broken?');
  const reductionPct = ((originalBytes - cappedBytes) / originalBytes) * 100;

  // Audit estimate: >=10%. Real corpus may show much more.
  assert.ok(
    reductionPct >= 10,
    `PERF-13-01 acceptance: expected >=10% reduction; got ${reductionPct.toFixed(1)}% (orig=${originalBytes} capped=${cappedBytes})`,
  );

  // Diagnostic line printed via test reporter (visible in --reporter spec)
  console.log(`[PERF-13-01] reduction: ${reductionPct.toFixed(1)}% (${originalBytes} -> ${cappedBytes} bytes across ${items.length} items)`);
});
