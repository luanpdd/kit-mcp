// Regression tests for PERF-16-03: detectReverse() runs its 5 scans
// (agents, commands, skills, framework, hooks) in parallel via Promise.all.
//
// reverse-sync.test.js exercises each scan in isolation (one edit per test).
// These tests cover the *interaction* between concurrent scans — multiple
// simultaneous edits, ordering tolerance, and partial-state handling — to
// guard against regressions where parallel scheduling silently drops work or
// leaks state between scans.
//
// Imports and setup intentionally mirror reverse-sync.test.js so cross-file
// behavior stays comparable.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncTo } from '../../src/core/sync.js';
import { detectReverse, applyReverse } from '../../src/core/reverse-sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_FIXTURE = path.resolve(__dirname, '../fixtures/sample-kit');

let TMP, KIT, PROJECT;

beforeEach(async () => {
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-rev-par-'));
  KIT = path.join(TMP, 'kit');
  PROJECT = path.join(TMP, 'project');
  await fs.cp(SRC_FIXTURE, KIT, { recursive: true });
  await syncTo('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
});

afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

test('detectReverse — parallel scans pick up edits across all 5 categories in one call', async () => {
  // Edit one file per category. If parallel scans race on the shared
  // candidates[] (e.g. a torn push), one of these would be missing.
  await fs.writeFile(
    path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '# EDITED agent\nbody1\n',
  );
  await fs.writeFile(
    path.join(PROJECT, '.claude/commands/sample-command.md'),
    '# EDITED command\nbody2\n',
  );
  await fs.writeFile(
    path.join(PROJECT, '.claude/skills/sample-skill/SKILL.md'),
    '# EDITED skill\nbody3\n',
  );
  await fs.writeFile(
    path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md'),
    '# EDITED framework\nbody4\n',
  );
  await fs.writeFile(
    path.join(PROJECT, '.claude/hooks/sample-hook.js'),
    "// EDITED hook\nbody5\n",
  );

  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });

  // Each category MUST be present in candidates (parallel scans didn't drop any).
  const kinds = r.candidates.map(c => c.kind).sort();
  assert.ok(kinds.includes('agent'),     `missing 'agent' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('command'),   `missing 'command' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('skill'),     `missing 'skill' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('framework'), `missing 'framework' in ${JSON.stringify(kinds)}`);
  assert.ok(kinds.includes('hooks'),     `missing 'hooks' in ${JSON.stringify(kinds)}`);

  // All edits classify as modified (not new-in-ide).
  for (const c of r.candidates) {
    assert.equal(c.reason, 'modified-in-ide', `${c.kind}/${c.name} has wrong reason: ${c.reason}`);
  }

  // No duplicates and no drops — exactly 5 candidates (one per category edited).
  assert.equal(
    r.candidates.length,
    5,
    `expected exactly 5 candidates (1 per category), got ${r.candidates.length}: ${JSON.stringify(kinds)}`,
  );
});

test('detectReverse → applyReverse — parallel ordering does not break apply pipeline', async () => {
  // Edit one mirror-tree file (hooks) and one capability file (agent). These
  // hit different code paths inside applyOne, so we get coverage of both.
  await fs.writeFile(
    path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '# A1\n',
  );
  await fs.writeFile(
    path.join(PROJECT, '.claude/hooks/sample-hook.js'),
    '// H1\n',
  );

  const r = await applyReverse('claude-code', {
    kitRoot: KIT,
    projectRoot: PROJECT,
    strategy: 'overwrite',
  });

  // Both apply independently regardless of which came first in candidates[].
  const agentResult = r.results.find(x => x.kind === 'agent');
  const hookResult  = r.results.find(x => x.kind === 'hooks');
  assert.ok(agentResult, 'agent result missing');
  assert.ok(hookResult,  'hooks result missing');
  assert.match(agentResult.action, /overwritten/);
  assert.match(hookResult.action,  /overwritten/);

  // Canonical files in the kit are updated.
  const agentCanonical = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  const hookCanonical  = await fs.readFile(path.join(KIT, 'hooks/sample-hook.js'), 'utf8');
  assert.match(agentCanonical, /A1/);
  assert.match(hookCanonical,  /H1/);
});

test('detectReverse — handles missing project capability dirs gracefully (parallel scans)', async () => {
  // A target with one capability dir removed and another edited. The removed
  // dir's scan early-returns (scanCapability catches readdir ENOENT). The
  // sibling scans must still complete — i.e. parallel scheduling must not
  // amplify a "no-op" into a crash, and a fast-finishing empty scan must not
  // block its peers.
  await fs.rm(path.join(PROJECT, '.claude/agents'), { recursive: true, force: true });
  await fs.writeFile(path.join(PROJECT, '.claude/hooks/sample-hook.js'), '// edit\n');

  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });

  // No agent candidates (dir removed).
  assert.equal(
    r.candidates.filter(c => c.kind === 'agent').length,
    0,
    'agent dir removed — no agent candidates expected',
  );

  // Hooks edit still detected (parallel scan did not crash on the empty sibling).
  assert.ok(
    r.candidates.some(c => c.kind === 'hooks'),
    'hooks scan must still complete even if agents scan returned empty',
  );
});
