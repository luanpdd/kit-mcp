// DX-15-01 regression tests for scripts/update-readme-counts.js.
// Plan 86-01 — guards README.md AUTOGEN-COUNTS block against drift.
// DIR-01 — also guards the "Estrutura do kit" ASCII-tree count mentions.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { updateReadmeCounts } from '../../scripts/update-readme-counts.js';

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-readme-counts-'));
  // 3 agents, 2 commands, 2 skills (+1 _shared excluded), 1 gate
  await mkdir(path.join(root, 'kit', 'agents'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'commands'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'skills', 'alpha'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'skills', 'beta'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'skills', '_shared-x'), { recursive: true });
  await mkdir(path.join(root, 'gates'), { recursive: true });
  for (const n of ['a', 'b', 'c']) {
    await writeFile(path.join(root, 'kit', 'agents', n + '.md'), '# ' + n);
  }
  for (const n of ['x', 'y']) {
    await writeFile(path.join(root, 'kit', 'commands', n + '.md'), '# ' + n);
  }
  await writeFile(path.join(root, 'kit', 'skills', 'alpha', 'SKILL.md'), '# alpha');
  await writeFile(path.join(root, 'kit', 'skills', 'beta', 'SKILL.md'), '# beta');
  await writeFile(path.join(root, 'kit', 'skills', '_shared-x', 'glossary.md'), '# x');
  await writeFile(path.join(root, 'gates', 'g1.md'), '# g1');
  return root;
}

// DIR-01: minimal "Estrutura do kit" tree — the three count mentions the
// script also keeps in sync (numbers here are deliberately stale).
function treeBlock({ agents = 0, commands = 0, skills = 0 } = {}) {
  return (
    '```\n' +
    'kit/\n' +
    '├── agents/      ' + agents + ' agents executáveis (…)\n' +
    '├── commands/    ' + commands + ' slash-commands (…)\n' +
    '├── skills/      ' + skills + ' skills consultáveis (…)\n' +
    '```\n'
  );
}

test('updateReadmeCounts: writes block when counts change', async () => {
  const root = await makeFixture();
  try {
    const readme =
      '# Title\n\n' +
      '<!-- AUTOGEN-COUNTS-START -->\n' +
      '**Bundled workflow:** 0 agents · 0 commands · 0 skills · 0 gates\n' +
      '<!-- AUTOGEN-COUNTS-END -->\n\n' +
      treeBlock();
    await writeFile(path.join(root, 'README.md'), readme);

    const r1 = await updateReadmeCounts(root);
    assert.equal(r1.changed, true);
    assert.deepEqual(r1.counts, { agents: 3, commands: 2, skills: 2, gates: 1 });

    const after = await readFile(path.join(root, 'README.md'), 'utf8');
    assert.match(after, /3 agents · 2 commands · 2 skills · 1 gates/);
    // DIR-01: tree mentions rewritten from the same counts
    assert.match(after, /├── agents\/\s+3 agents executáveis/);
    assert.match(after, /├── commands\/\s+2 slash-commands/);
    assert.match(after, /├── skills\/\s+2 skills consultáveis/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('updateReadmeCounts: idempotent — no rewrite when counts already match', async () => {
  const root = await makeFixture();
  try {
    const readme =
      '# Title\n\n' +
      '<!-- AUTOGEN-COUNTS-START -->\n' +
      '**Bundled workflow:** 3 agents · 2 commands · 2 skills · 1 gates\n' +
      '<!-- AUTOGEN-COUNTS-END -->\n\n' +
      treeBlock({ agents: 3, commands: 2, skills: 2 });
    await writeFile(path.join(root, 'README.md'), readme);

    const before = await readFile(path.join(root, 'README.md'), 'utf8');
    const r = await updateReadmeCounts(root);
    const after = await readFile(path.join(root, 'README.md'), 'utf8');

    assert.equal(r.changed, false);
    assert.equal(after, before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('updateReadmeCounts: throws when AUTOGEN block markers absent', async () => {
  const root = await makeFixture();
  try {
    await writeFile(path.join(root, 'README.md'), '# Title\n\nNo block here.\n');
    await assert.rejects(updateReadmeCounts(root), /AUTOGEN-COUNTS block/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('updateReadmeCounts: DIR-01 — throws when a tree count mention is absent', async () => {
  const root = await makeFixture();
  try {
    // AUTOGEN block present, "Estrutura do kit" tree missing entirely.
    const readme =
      '# Title\n\n' +
      '<!-- AUTOGEN-COUNTS-START -->\n' +
      '**Bundled workflow:** 3 agents · 2 commands · 2 skills · 1 gates\n' +
      '<!-- AUTOGEN-COUNTS-END -->\n';
    await writeFile(path.join(root, 'README.md'), readme);
    await assert.rejects(updateReadmeCounts(root), /count mention for agents/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('updateReadmeCounts: DIR-01 — fixes stale tree counts even when AUTOGEN block already matches', async () => {
  const root = await makeFixture();
  try {
    // The exact regression from DIRECTION.md DIR-01: block says 86, tree says 75.
    const readme =
      '# Title\n\n' +
      '<!-- AUTOGEN-COUNTS-START -->\n' +
      '**Bundled workflow:** 3 agents · 2 commands · 2 skills · 1 gates\n' +
      '<!-- AUTOGEN-COUNTS-END -->\n\n' +
      treeBlock({ agents: 75, commands: 94, skills: 100 });
    await writeFile(path.join(root, 'README.md'), readme);

    const r = await updateReadmeCounts(root);
    assert.equal(r.changed, true);

    const after = await readFile(path.join(root, 'README.md'), 'utf8');
    assert.match(after, /├── agents\/\s+3 agents executáveis/);
    assert.match(after, /├── commands\/\s+2 slash-commands/);
    assert.match(after, /├── skills\/\s+2 skills consultáveis/);
    assert.doesNotMatch(after, /75|94|100/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('updateReadmeCounts: real repo — counts match disk and is no-op', async () => {
  // After Task 1 + Task 2 of this plan, the real README.md should already
  // be at the correct counts; running on the live repo is a no-op.
  // If a future commit adds an agent without rerunning the script, this
  // test fails first — guarding against drift.
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');
  const r = await updateReadmeCounts(repoRoot);
  assert.equal(r.changed, false, 'live README is out of sync — Task 1/2 incomplete');
  assert.equal(r.counts.agents, 86);
  assert.equal(r.counts.commands, 98);
  assert.equal(r.counts.skills, 103);
  assert.equal(r.counts.gates, 24);
});
