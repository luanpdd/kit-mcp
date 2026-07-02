// PERF-13-02: anti-regression test for dead `# hooks:` block in agent
// frontmatters. The block was historical example code (commented out)
// that never activated. If anyone reintroduces it, this test fails and
// forces them to either (a) activate it properly via a non-frontmatter
// mechanism, or (b) not commit it at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(REPO_ROOT, 'kit', 'agents');

// The 6 specific lines we're banning (the dead block from PERF-13-02).
// We match `^# hooks:` as a sentinel — if anyone wants to add legitimate
// `# hooks:` documentation in the body of an agent (not in the
// frontmatter), they should use a different prefix or put it under a
// properly-fenced code block.
const BANNED_FRONTMATTER_PATTERN = /^# hooks:\s*$/m;

async function listAgents() {
  const entries = await readdir(AGENTS_DIR);
  return entries.filter((e) => e.endsWith('.md')).map((e) => path.join(AGENTS_DIR, e));
}

function extractFrontmatter(content) {
  // Frontmatter is between the first two `---` lines, anchored at line start.
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : null;
}

test('PERF-13-02: no agent has dead `# hooks:` block in frontmatter', async () => {
  const agentFiles = await listAgents();
  assert.ok(agentFiles.length >= 30, `expected >=30 agents, got ${agentFiles.length}`);

  const offenders = [];
  for (const file of agentFiles) {
    const content = await readFile(file, 'utf8');
    const fm = extractFrontmatter(content);
    assert.ok(fm !== null, `${path.basename(file)}: no frontmatter delimiters found`);
    if (BANNED_FRONTMATTER_PATTERN.test(fm)) {
      offenders.push(path.basename(file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Agents with dead "# hooks:" block in frontmatter (PERF-13-02 regression): ${offenders.join(', ')}`,
  );
});

test('PERF-13-02: no agent has banned eslint --fix command in frontmatter', async () => {
  // Specific second guard: the exact dead command should never appear in
  // any frontmatter, even if reformatted to a different shape.
  const agentFiles = await listAgents();
  const offenders = [];
  for (const file of agentFiles) {
    const content = await readFile(file, 'utf8');
    const fm = extractFrontmatter(content);
    if (!fm) continue;
    if (fm.includes('npx eslint --fix $FILE')) {
      offenders.push(path.basename(file));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Agents with dead eslint command in frontmatter: ${offenders.join(', ')}`,
  );
});

test('PERF-13-02: every agent still has valid frontmatter (--- delimiters intact)', async () => {
  const agentFiles = await listAgents();
  for (const file of agentFiles) {
    const content = await readFile(file, 'utf8');
    const fm = extractFrontmatter(content);
    assert.ok(fm !== null, `${path.basename(file)}: missing frontmatter`);
    // Sanity: every agent must declare `name:` and `description:` in fm
    assert.ok(/^name:\s*\S/m.test(fm), `${path.basename(file)}: missing name field`);
    assert.ok(/^description:\s*\S/m.test(fm), `${path.basename(file)}: missing description field`);
  }
});
