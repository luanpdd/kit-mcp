import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listKit, searchKit, findItem, resolveKitRoot, BUNDLED_KIT_ROOT } from '../../src/core/kit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/sample-kit');

test('resolveKitRoot — explicit arg wins', () => {
  assert.equal(resolveKitRoot('/some/path'), path.resolve('/some/path'));
});

test('resolveKitRoot — env var when no arg', () => {
  const prev = process.env.KIT_MCP_KIT_ROOT;
  process.env.KIT_MCP_KIT_ROOT = '/env/path';
  try {
    assert.equal(resolveKitRoot(), path.resolve('/env/path'));
  } finally {
    if (prev === undefined) delete process.env.KIT_MCP_KIT_ROOT;
    else process.env.KIT_MCP_KIT_ROOT = prev;
  }
});

test('resolveKitRoot — bundled when no arg or env', () => {
  const prev = process.env.KIT_MCP_KIT_ROOT;
  delete process.env.KIT_MCP_KIT_ROOT;
  try {
    assert.equal(resolveKitRoot(), BUNDLED_KIT_ROOT);
  } finally {
    if (prev !== undefined) process.env.KIT_MCP_KIT_ROOT = prev;
  }
});

test('listKit — reads agents/commands/skills from fixture', async () => {
  const kit = await listKit(FIXTURE);
  assert.equal(kit.agents.length, 1);
  assert.equal(kit.agents[0].name, 'sample-agent');
  assert.equal(kit.agents[0].description, 'Sample agent fixture for tests');

  assert.equal(kit.commands.length, 2);
  const sample = kit.commands.find(c => c.name === 'sample-command');
  assert.equal(sample.description, 'Sample command fixture for tests');

  assert.equal(kit.skills.length, 1);
  assert.equal(kit.skills[0].name, 'sample-skill');
});

test('listKit — frontmatter description wins over body fallback', async () => {
  const kit = await listKit(FIXTURE);
  const item = kit.agents[0];
  // Body has "You are a sample agent." but frontmatter has the canonical description
  assert.equal(item.description, 'Sample agent fixture for tests');
});

test('firstNonEmptyLine fallback — skips HTML comments and headings', async () => {
  const kit = await listKit(FIXTURE);
  const noFm = kit.commands.find(c => c.name === 'no-frontmatter-command');
  assert.ok(noFm, 'no-frontmatter-command should be in kit');
  assert.equal(
    noFm.description,
    'The actual description that fallback should pick up after skipping the comment and heading.'
  );
});

test('searchKit — fuzzy matches name and description', async () => {
  const kit = await listKit(FIXTURE);
  const results = searchKit(kit, 'sample');
  assert.ok(results.length >= 3, 'should match at least 3 sample items');
  assert.ok(results.every(r => r.name.includes('sample') || (r.description ?? '').toLowerCase().includes('sample')));
});

test('findItem — returns null for missing, item for present', async () => {
  const kit = await listKit(FIXTURE);
  assert.equal(findItem(kit, 'agent', 'nope'), null);
  const item = findItem(kit, 'agent', 'sample-agent');
  assert.equal(item.name, 'sample-agent');
});

test('findItem — throws on unknown kind', async () => {
  const kit = await listKit(FIXTURE);
  assert.throws(() => findItem(kit, 'invalid-kind', 'x'), /Unknown kind/);
});
