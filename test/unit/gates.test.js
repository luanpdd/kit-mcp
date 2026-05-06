import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { listGates, getGate, gatesForStage, clearGatesCache } from '../../src/core/gates.js';
import { runGate } from '../../src/core/gate-runner.js';

let TMP_GATES;

beforeEach(async () => {
  TMP_GATES = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-gates-test-'));
  await fs.writeFile(path.join(TMP_GATES, 'shell-pass.md'),
    `---\nid: shell-pass\nstage: pre-verify\nblocking: true\n---\n## Check\n\`\`\`bash\nexit 0\n\`\`\`\n`);
  await fs.writeFile(path.join(TMP_GATES, 'shell-fail.md'),
    `---\nid: shell-fail\nstage: pre-verify\nblocking: true\n---\n## Check\n\`\`\`bash\nexit 1\n\`\`\`\n`);
  await fs.writeFile(path.join(TMP_GATES, 'shell-warn.md'),
    `---\nid: shell-warn\nstage: pre-verify\nblocking: false\n---\n## Check\n\`\`\`bash\nexit 1\n\`\`\`\n`);
  await fs.writeFile(path.join(TMP_GATES, 'manual-only.md'),
    `---\nid: manual-only\nstage: post-verify\nblocking: false\ndescription: pure manual check\n---\nNo shell — just describe what to verify.\n`);
});

afterEach(async () => {
  await fs.rm(TMP_GATES, { recursive: true, force: true });
});

test('listGates — sorts by id and respects blocking flag', async () => {
  const gates = await listGates(TMP_GATES);
  const ids = gates.map(g => g.id);
  assert.deepEqual(ids, ['manual-only', 'shell-fail', 'shell-pass', 'shell-warn']);
  assert.equal(gates.find(g => g.id === 'shell-warn').blocking, false);
  assert.equal(gates.find(g => g.id === 'shell-pass').blocking, true);
});

test('getGate — throws on unknown id', async () => {
  await assert.rejects(getGate('nope', TMP_GATES), /Unknown gate/);
});

test('gatesForStage — filters by stage and includes "any"', async () => {
  await fs.writeFile(path.join(TMP_GATES, 'any-stage.md'),
    `---\nid: any-stage\nstage: any\n---\nApplies everywhere.\n`);
  const preVerify = await gatesForStage('pre-verify', TMP_GATES);
  const ids = preVerify.map(g => g.id).sort();
  assert.ok(ids.includes('any-stage'));
  assert.ok(ids.includes('shell-pass'));
});

test('runGate shell-pass — verdict passed', async () => {
  const r = await runGate('shell-pass', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} });
  assert.equal(r.verdict, 'passed');
  assert.equal(r.exitCode, 0);
});

test('runGate shell-fail blocking — verdict block', async () => {
  const r = await runGate('shell-fail', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} });
  assert.equal(r.verdict, 'block');
  assert.equal(r.exitCode, 1);
});

test('runGate shell-warn non-blocking — verdict warn', async () => {
  const r = await runGate('shell-warn', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} });
  assert.equal(r.verdict, 'warn');
});

test('runGate manual-only --no-interactive — verdict manual', async () => {
  const r = await runGate('manual-only', { gatesRoot: TMP_GATES, interactive: false, onLog: () => {} });
  assert.equal(r.verdict, 'manual');
});

// P2: gates cache (mirrors PERF-01 in kit.js).
test('listGates — caches result within TTL', async () => {
  clearGatesCache();
  const a = await listGates(TMP_GATES);
  const b = await listGates(TMP_GATES);
  assert.equal(a, b, 'second call should return cached object reference');
});

test('listGates — clearGatesCache forces re-read', async () => {
  clearGatesCache();
  const a = await listGates(TMP_GATES);
  clearGatesCache();
  const b = await listGates(TMP_GATES);
  assert.notEqual(a, b, 'after clearGatesCache, listGates should produce a fresh object');
});
