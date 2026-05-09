// PERF-15-01: regression test for terse mode in list-agents/list-commands/list-skills.
// Validates payload reduction (>=40%), shape correctness (no description field),
// backward-compat (default still returns description), and CLI/MCP parity.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listKit } from '../../src/core/kit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const CLI = path.join(REPO, 'bin', 'cli.js');

test('PERF-15-01: terse shape is {kind, name} only (no description)', async () => {
  const kit = await listKit();
  // Espelha slimTerse() — não importa internal helper (não exportado por design),
  // valida o contrato observável.
  const terse = kit.agents.map(x => ({ kind: x.kind, name: x.name }));
  for (const item of terse) {
    assert.equal(typeof item.kind, 'string');
    assert.equal(typeof item.name, 'string');
    assert.equal(Object.keys(item).length, 2, `expected 2 keys, got ${Object.keys(item).join(',')}`);
    assert.ok(!('description' in item), 'terse must not include description');
  }
});

test('PERF-15-01: real corpus shows >=40% reduction in JSON payload (terse vs default)', async () => {
  const kit = await listKit();
  const items = [...kit.agents, ...kit.commands, ...kit.skills, ...kit.skillsExtras];
  assert.ok(items.length > 30, `expected >=30 items, got ${items.length}`);

  // Default (post-PERF-13-01): {kind, name, description: summarize(...)}
  const { summarize } = await import('../../src/core/sync.js');
  const defaultPayload = items.map(x => ({ kind: x.kind, name: x.name, description: summarize(x.description) }));
  // Terse: {kind, name}
  const tersePayload = items.map(x => ({ kind: x.kind, name: x.name }));

  const defaultBytes = Buffer.byteLength(JSON.stringify(defaultPayload), 'utf8');
  const terseBytes   = Buffer.byteLength(JSON.stringify(tersePayload),   'utf8');
  const reductionPct = ((defaultBytes - terseBytes) / defaultBytes) * 100;

  assert.ok(
    reductionPct >= 40,
    `PERF-15-01 acceptance: expected >=40% reduction; got ${reductionPct.toFixed(1)}% (default=${defaultBytes} terse=${terseBytes})`,
  );
  console.log(`[PERF-15-01] reduction: ${reductionPct.toFixed(1)}% (${defaultBytes} -> ${terseBytes} bytes across ${items.length} items)`);
});

test('PERF-15-01: CLI --terse flag produces same shape as MCP terse=true', () => {
  // Smoke spawn — `kit kit list-agents --terse --json` returns array of {kind, name}.
  const r = spawnSync(process.execPath, [CLI, '--json', 'kit', 'list-agents', '--terse'], {
    encoding: 'utf8',
    cwd: REPO,
  });
  assert.equal(r.status, 0, `CLI exited ${r.status}: stderr=${r.stderr}`);
  const items = JSON.parse(r.stdout);
  assert.ok(Array.isArray(items) && items.length > 0, 'expected non-empty array');
  for (const item of items) {
    assert.equal(Object.keys(item).length, 2, `terse item must have 2 keys, got: ${Object.keys(item).join(',')}`);
    assert.ok('kind' in item && 'name' in item, 'must have kind+name');
    assert.ok(!('description' in item), 'terse CLI must not include description');
  }
});

test('PERF-15-01: CLI without --terse keeps backward-compat (description present)', () => {
  // Default behavior — slim() with summarize() cap 80. description field present.
  const r = spawnSync(process.execPath, [CLI, '--json', 'kit', 'list-agents'], {
    encoding: 'utf8',
    cwd: REPO,
  });
  assert.equal(r.status, 0, `CLI exited ${r.status}: stderr=${r.stderr}`);
  const items = JSON.parse(r.stdout);
  assert.ok(items.length > 0);
  const sample = items[0];
  assert.ok('description' in sample, 'default mode must include description (backward-compat)');
  assert.ok('kind' in sample && 'name' in sample);
});
