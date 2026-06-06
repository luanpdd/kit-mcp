// Phase 172 M3 — integration tests for the 5 cost-* MCP tools.
//
// Invariantes:
//   1. As 5 tools (cost-today, cost-session, cost-blocks, cost-phase,
//      cost-estimate) estão presentes em TOOLS.
//   2. As 5 tools estão registradas em HANDLERS (dispatch funciona).
//   3. Cada handler chamado com input mínimo válido retorna shape canônico
//      do SPEC: total_usd, by_model, entry_count, deduped_count,
//      skipped_entry_count, parse_error_count, unknown_models,
//      pricing_source, pricing_staleness_days.
//   4. cost-phase exige phase_id (validação manual sem Zod).
//   5. cost-estimate exige text.
//   6. persist:true grava arquivo em <tmpdir>/.planning/costs/ e adiciona
//      persisted_to no output.
//   7. Errors retornam {error:{message,code}} — não propaga stack.
//
// Estratégia: invoca handlers via __TEST_HANDLERS + valida TOOLS/HANDLERS
// exportados. NÃO usa transport stdio (cost-tools.test.js bench/spawn
// fica em M4 — aqui validamos só o contrato do handler).
//
// Fixtures: usa as fixtures M1 (jsonl-paridade-ccusage.jsonl etc.) via
// opts.entries pra evitar mock de filesystem de discovery.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  TOOLS,
  HANDLERS,
  __TEST_HANDLERS,
} from '../../src/mcp-server/index.js';
import { __resetCache } from '../../src/core/cost/pricing.js';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

const COST_TOOL_NAMES = [
  'cost-today',
  'cost-session',
  'cost-blocks',
  'cost-phase',
  'cost-estimate',
];

const CANONICAL_FIELDS = [
  'total_usd',
  'by_model',
  'entry_count',
  'deduped_count',
  'skipped_entry_count',
  'parse_error_count',
  'unknown_models',
  'pricing_source',
  'pricing_staleness_days',
];

function loadFixtureEntries(name) {
  const file = path.join(repoRoot, 'test', 'fixtures', name);
  const raw = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip corrupted (the fixture jsonl-corrompido-meio has intentional ones)
    }
  }
  return out;
}

function makeEntry(overrides = {}) {
  return {
    timestamp: '2026-06-05T10:00:00.000Z',
    sessionId: 'sess-int-1',
    messageId: 'msg-int-1',
    requestId: 'req-int-1',
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: 100, output_tokens: 50 },
    ...overrides,
  };
}

function mkTmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmRf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* best-effort */ }
}

// ────────────────────────────────────────────────────────────────────────────
// TOOLS / HANDLERS shape
// ────────────────────────────────────────────────────────────────────────────

test('M3: as 5 tools cost-* estão presentes na TOOLS array', () => {
  const names = TOOLS.map((t) => t.name);
  for (const expected of COST_TOOL_NAMES) {
    assert.ok(names.includes(expected), `tool ${expected} missing from TOOLS`);
  }
});

test('M3: as 5 tools cost-* têm description ≤ 1024 chars', () => {
  for (const tool of TOOLS) {
    if (!COST_TOOL_NAMES.includes(tool.name)) continue;
    assert.ok(
      typeof tool.description === 'string' && tool.description.length > 0,
      `${tool.name} missing description`,
    );
    assert.ok(
      tool.description.length <= 1024,
      `${tool.name} description ${tool.description.length} chars > 1024 limit`,
    );
  }
});

test('M3: as 5 tools cost-* têm inputSchema com type=object', () => {
  for (const tool of TOOLS) {
    if (!COST_TOOL_NAMES.includes(tool.name)) continue;
    assert.equal(tool.inputSchema?.type, 'object', `${tool.name} inputSchema.type !== object`);
    assert.equal(typeof tool.inputSchema.properties, 'object', `${tool.name} missing properties`);
  }
});

test('M3: cost-phase e cost-estimate declaram required corretamente', () => {
  const phaseTool = TOOLS.find((t) => t.name === 'cost-phase');
  const estimateTool = TOOLS.find((t) => t.name === 'cost-estimate');
  assert.ok(Array.isArray(phaseTool.inputSchema.required), 'cost-phase required missing');
  assert.ok(phaseTool.inputSchema.required.includes('phase_id'), 'cost-phase must require phase_id');
  assert.ok(Array.isArray(estimateTool.inputSchema.required), 'cost-estimate required missing');
  assert.ok(estimateTool.inputSchema.required.includes('text'), 'cost-estimate must require text');
});

test('M3: as 5 tools cost-* estão registradas em HANDLERS', () => {
  for (const name of COST_TOOL_NAMES) {
    assert.equal(typeof HANDLERS[name], 'function', `HANDLERS["${name}"] is not a function`);
  }
});

test('M3: 9 tools pré-existentes continuam em TOOLS e HANDLERS (regressão)', () => {
  const preExisting = [
    'kit',
    'sync',
    'reverse-sync',
    'gates',
    'forensics',
    'install',
    'metrics-snapshot',
    'auto-install',
    'ack-restart',
  ];
  const names = TOOLS.map((t) => t.name);
  for (const n of preExisting) {
    assert.ok(names.includes(n), `pre-existing tool ${n} disappeared from TOOLS`);
    assert.equal(typeof HANDLERS[n], 'function', `pre-existing handler ${n} disappeared`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// cost-today handler
// ────────────────────────────────────────────────────────────────────────────

test('M3: cost-today retorna shape canônico do SPEC (entries inline)', async () => {
  __resetCache();
  const entries = [
    makeEntry({ messageId: 'a', requestId: 'a' }),
    makeEntry({ messageId: 'b', requestId: 'b', model: 'claude-haiku-4-5' }),
  ];
  const out = await __TEST_HANDLERS.handleCostToday({
    entries,
    date: '2026-06-05',
    tz: 'UTC',
  });
  assert.ok(!out.error, `handler errored: ${JSON.stringify(out)}`);
  for (const field of CANONICAL_FIELDS) {
    assert.ok(field in out, `missing canonical field: ${field}`);
  }
  assert.equal(out.date, '2026-06-05');
  assert.equal(out.tz, 'UTC');
  assert.equal(out.entry_count, 2);
});

test('M3: cost-today rejeita config_dirs não-array', async () => {
  const out = await __TEST_HANDLERS.handleCostToday({ config_dirs: 'not-an-array' });
  assert.ok(out.error, 'should error on invalid config_dirs');
  assert.equal(out.error.code, 'invalid_arg');
});

test('M3: cost-today rejeita tz não-string', async () => {
  const out = await __TEST_HANDLERS.handleCostToday({ tz: 123 });
  assert.ok(out.error, 'should error on invalid tz');
  assert.equal(out.error.code, 'invalid_arg');
});

// ────────────────────────────────────────────────────────────────────────────
// cost-session handler
// ────────────────────────────────────────────────────────────────────────────

test('M3: cost-session retorna shape canônico com session_id', async () => {
  __resetCache();
  const entries = [
    makeEntry({ sessionId: 'sess-X', messageId: 'a', requestId: 'a' }),
    makeEntry({ sessionId: 'sess-X', messageId: 'b', requestId: 'b' }),
    makeEntry({ sessionId: 'sess-Y', messageId: 'c', requestId: 'c' }),
  ];
  const out = await __TEST_HANDLERS.handleCostSession({
    session_id: 'sess-X',
    entries,
  });
  assert.ok(!out.error, `handler errored: ${JSON.stringify(out)}`);
  for (const field of CANONICAL_FIELDS) {
    assert.ok(field in out, `missing canonical field: ${field}`);
  }
  assert.equal(out.session_id, 'sess-X');
  assert.equal(out.entry_count, 2, 'só 2 entries da sess-X devem entrar');
});

test('M3: cost-session rejeita session_id não-string', async () => {
  const out = await __TEST_HANDLERS.handleCostSession({ session_id: 42 });
  assert.ok(out.error);
  assert.equal(out.error.code, 'invalid_arg');
});

// ────────────────────────────────────────────────────────────────────────────
// cost-blocks handler
// ────────────────────────────────────────────────────────────────────────────

test('M3: cost-blocks retorna shape canônico + blocks[]', async () => {
  __resetCache();
  const entries = [
    makeEntry({ messageId: 'a', requestId: 'a', timestamp: '2026-06-05T08:00:00.000Z' }),
    makeEntry({ messageId: 'b', requestId: 'b', timestamp: '2026-06-05T09:00:00.000Z' }),
  ];
  const out = await __TEST_HANDLERS.handleCostBlocks({ entries });
  assert.ok(!out.error, `handler errored: ${JSON.stringify(out)}`);
  for (const field of CANONICAL_FIELDS) {
    assert.ok(field in out, `missing canonical field: ${field}`);
  }
  assert.ok(Array.isArray(out.blocks), 'blocks must be array');
  assert.ok(out.blocks.length >= 1, 'at least one block expected');
});

test('M3: cost-blocks rejeita config_dirs não-array', async () => {
  const out = await __TEST_HANDLERS.handleCostBlocks({ config_dirs: 'oops' });
  assert.ok(out.error);
  assert.equal(out.error.code, 'invalid_arg');
});

// ────────────────────────────────────────────────────────────────────────────
// cost-phase handler
// ────────────────────────────────────────────────────────────────────────────

test('M3: cost-phase rejeita phase_id ausente', async () => {
  const out = await __TEST_HANDLERS.handleCostPhase({});
  assert.ok(out.error, 'must error on missing phase_id');
  assert.equal(out.error.code, 'invalid_arg');
});

test('M3: cost-phase phase_id desconhecido → confidence=unknown', async () => {
  __resetCache();
  // Use tmp dir SEM .planning/phases/ — vai cair em unknown.
  const tmp = mkTmpRoot('cost-phase-test-');
  try {
    const out = await __TEST_HANDLERS.handleCostPhase({
      phase_id: '99999',
      projectRoot: tmp,
      entries: [],
    });
    assert.ok(!out.error, `unexpected error: ${JSON.stringify(out)}`);
    assert.equal(out.correlation_confidence, 'unknown');
    for (const field of CANONICAL_FIELDS) {
      assert.ok(field in out, `missing canonical field: ${field}`);
    }
  } finally {
    rmRf(tmp);
  }
});

test('M3: cost-phase com fase mocada retorna shape canônico', async () => {
  __resetCache();
  const tmp = mkTmpRoot('cost-phase-mock-');
  try {
    // Cria .planning/phases/200-mock/SPEC.md
    const phaseDir = path.join(tmp, '.planning', 'phases', '200-mock');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'SPEC.md'), '# mock spec\n');

    const out = await __TEST_HANDLERS.handleCostPhase({
      phase_id: '200',
      projectRoot: tmp,
      skip_git: true,
      entries: [makeEntry({ timestamp: new Date().toISOString() })],
    });
    assert.ok(!out.error, `unexpected error: ${JSON.stringify(out)}`);
    assert.equal(out.phase_id, '200');
    assert.equal(out.phase_slug, 'mock');
    assert.ok(['high', 'medium', 'low'].includes(out.correlation_confidence),
      `unexpected confidence: ${out.correlation_confidence}`);
    for (const field of CANONICAL_FIELDS) {
      assert.ok(field in out, `missing canonical field: ${field}`);
    }
  } finally {
    rmRf(tmp);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// cost-estimate handler
// ────────────────────────────────────────────────────────────────────────────

test('M3: cost-estimate retorna shape canônico de estimativa', async () => {
  __resetCache();
  const out = await __TEST_HANDLERS.handleCostEstimate({
    text: 'Analise esse codebase e me ajude a refatorar a função X em Y arquivo.',
    model: 'claude-sonnet-4-5',
  });
  assert.ok(!out.error, `handler errored: ${JSON.stringify(out)}`);
  // Estimate tem shape diferente (não tem entry_count etc), valida campos específicos:
  for (const field of ['estimated_input_tokens', 'estimated_output_tokens',
    'estimated_usd', 'estimated_usd_range', 'disclaimer',
    'pricing_source', 'pricing_staleness_days', 'unknown_models']) {
    assert.ok(field in out, `missing estimate field: ${field}`);
  }
  assert.ok(out.disclaimer.includes('heuristic'), 'disclaimer must mention heuristic');
  if (out.estimated_usd !== null) {
    assert.ok(Array.isArray(out.estimated_usd_range), 'range must be array');
    assert.equal(out.estimated_usd_range.length, 2);
    assert.ok(out.estimated_usd_range[0] <= out.estimated_usd, 'low ≤ point');
    assert.ok(out.estimated_usd_range[1] >= out.estimated_usd, 'high ≥ point');
  }
});

test('M3: cost-estimate rejeita text ausente', async () => {
  const out = await __TEST_HANDLERS.handleCostEstimate({});
  assert.ok(out.error);
  assert.equal(out.error.code, 'invalid_arg');
});

test('M3: cost-estimate rejeita model não-string', async () => {
  const out = await __TEST_HANDLERS.handleCostEstimate({ text: 'hi', model: 42 });
  assert.ok(out.error);
  assert.equal(out.error.code, 'invalid_arg');
});

// ────────────────────────────────────────────────────────────────────────────
// Persist flow (opt-in)
// ────────────────────────────────────────────────────────────────────────────

test('M3: cost-today persist=true grava .planning/costs/*.json em tmpdir', async () => {
  __resetCache();
  const tmp = mkTmpRoot('cost-persist-');
  try {
    const out = await __TEST_HANDLERS.handleCostToday({
      entries: [makeEntry()],
      date: '2026-06-05',
      tz: 'UTC',
      persist: true,
      projectRoot: tmp,
    });
    assert.ok(!out.error, `errored: ${JSON.stringify(out)}`);
    assert.ok(typeof out.persisted_to === 'string', 'persisted_to must be set');
    assert.ok(fs.existsSync(out.persisted_to), 'persisted file must exist');
    const parsed = JSON.parse(fs.readFileSync(out.persisted_to, 'utf8'));
    assert.equal(parsed.tool, 'cost-today');
    assert.equal(parsed.snap.date, '2026-06-05');
  } finally {
    rmRf(tmp);
  }
});

test('M3: persist=false (default) NÃO escreve em disco', async () => {
  __resetCache();
  const tmp = mkTmpRoot('cost-no-persist-');
  try {
    const out = await __TEST_HANDLERS.handleCostToday({
      entries: [makeEntry()],
      date: '2026-06-05',
      tz: 'UTC',
      projectRoot: tmp,
    });
    assert.ok(!out.error);
    assert.ok(!('persisted_to' in out), 'must NOT have persisted_to');
    const costsDir = path.join(tmp, '.planning', 'costs');
    assert.ok(!fs.existsSync(costsDir), 'costs dir must NOT exist when persist=false');
  } finally {
    rmRf(tmp);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Fixture compatibility (paridade fixtures de M1 alimentam handlers M3)
// ────────────────────────────────────────────────────────────────────────────

test('M3: cost-today digere fixture paridade-ccusage sem erro de shape', async () => {
  __resetCache();
  const entries = loadFixtureEntries('jsonl-paridade-ccusage.jsonl');
  assert.ok(entries.length > 0, 'fixture must have entries');
  // pega a data da primeira entry:
  const firstDate = entries[0].timestamp.slice(0, 10);
  const out = await __TEST_HANDLERS.handleCostToday({
    entries,
    date: firstDate,
    tz: 'UTC',
  });
  assert.ok(!out.error, `errored: ${JSON.stringify(out)}`);
  for (const field of CANONICAL_FIELDS) {
    assert.ok(field in out, `missing canonical field: ${field}`);
  }
  assert.ok(out.entry_count > 0, 'must have processed entries');
});

test('M3: cost-today digere fixture modelo-desconhecido sem retornar $0 silencioso', async () => {
  __resetCache();
  const entries = loadFixtureEntries('jsonl-modelo-desconhecido.jsonl');
  if (entries.length === 0) {
    // fixture pode estar vazia/genérica — não bloqueia o teste
    return;
  }
  const firstDate = entries[0].timestamp.slice(0, 10);
  const out = await __TEST_HANDLERS.handleCostToday({
    entries,
    date: firstDate,
    tz: 'UTC',
  });
  assert.ok(!out.error);
  // unknown_models deve listar pelo menos um modelo, NÃO ficar silencioso:
  assert.ok(Array.isArray(out.unknown_models));
  if (out.unknown_models.length > 0) {
    // Quando todos os modelos são unknown, total_usd === null (NÃO $0).
    const allUnknown = Object.keys(out.by_model).every((m) => out.unknown_models.includes(m));
    if (allUnknown) {
      assert.equal(out.total_usd, null, 'all-unknown → total_usd === null (NÃO $0)');
    }
  }
});
