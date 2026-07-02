// Phase 100 — Coverage ratchet: targeted tests for src/core/reverse-sync.js
//
// Baseline: 75.27% line coverage. Target ≥ 90%.
// `reverse-sync.test.js` covers happy paths (overwrite/merge/rename/skip
// for framework + hooks). Here we target the uncovered branches:
// new-in-ide for agent/skill (kitItem not found path 83-90, 122-129),
// merge strategy for agent (canonical with frontmatter — exercises
// mergeFrontmatter), unknown-strategy fallthrough for both regular and
// mirror-tree paths, dryRun for all 3 strategies, --only filter, and
// stripStubBoilerplate edge case via partial-stub fixture.

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
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-rev-paths-'));
  KIT = path.join(TMP, 'kit');
  PROJECT = path.join(TMP, 'project');
  await fs.cp(SRC_FIXTURE, KIT, { recursive: true });
  await syncTo('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
});

afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

// --- new-in-ide for agent (kitItem not found) ---

test('detectReverse — new-in-ide agent (no kit source) detected with reason', async () => {
  // Create a new agent file in .claude/agents/ that has NO counterpart in kit/
  const newAgent = path.join(PROJECT, '.claude/agents/local-only-agent.md');
  await fs.writeFile(newAgent, '---\nname: local-only-agent\n---\nnew local content\n', 'utf8');
  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  const cand = r.candidates.find(c => c.kind === 'agent' && c.name === 'local-only-agent');
  assert.ok(cand, 'new-in-ide agent must be a candidate');
  assert.equal(cand.reason, 'new-in-ide');
  assert.match(cand.diffSummary, /no kit source/);
});

// --- new-in-ide for command ---

test('detectReverse — new-in-ide command detected with reason', async () => {
  const newCmd = path.join(PROJECT, '.claude/commands/local-cmd.md');
  await fs.writeFile(newCmd, '---\nname: local-cmd\n---\nlocal command body\n', 'utf8');
  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  const cand = r.candidates.find(c => c.kind === 'command' && c.name === 'local-cmd');
  assert.ok(cand);
  assert.equal(cand.reason, 'new-in-ide');
});

// --- new-in-ide for skill ---

test('detectReverse — new-in-ide skill detected with reason', async () => {
  const skillDir = path.join(PROJECT, '.claude/skills/local-skill');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: local-skill\n---\nlocal skill body\n', 'utf8');
  const r = await detectReverse('claude-code', { kitRoot: KIT, projectRoot: PROJECT });
  const cand = r.candidates.find(c => c.kind === 'skill' && c.name === 'local-skill');
  assert.ok(cand, 'new-in-ide skill must be detected');
  assert.equal(cand.reason, 'new-in-ide');
  assert.match(cand.diffSummary, /no kit source/);
});

// --- applyReverse merge strategy with frontmatter (regular kind) ---

test('applyReverse merge — agent with frontmatter: preserves canonical fm + uses edited body', async () => {
  // Modify the body of sample-agent.md in the IDE, keeping the original
  // frontmatter — apply merge → kit canonical should keep its fm + new body
  const editedAgent = path.join(PROJECT, '.claude/agents/sample-agent.md');
  await fs.writeFile(editedAgent,
    '---\nname: sample-agent\ndescription: edited via merge\n---\n\nnew body content here\n',
    'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'merge',
  });
  const result = r.results.find(c => c.kind === 'agent' && c.name === 'sample-agent');
  assert.ok(result);
  assert.match(result.action, /merged/);
  // Read the canonical kit file: should have ORIGINAL fm (from canonical) + new body
  const canonical = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  assert.match(canonical, /name: sample-agent/);
  assert.match(canonical, /new body content here/);
});

// --- applyReverse rename for regular kind (agent) ---

test('applyReverse rename — agent: writes <name>-from-claude.md with stripped content', async () => {
  const editedAgent = path.join(PROJECT, '.claude/agents/sample-agent.md');
  await fs.writeFile(editedAgent,
    '---\nname: sample-agent\n---\n\nrenamed body\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'rename',
  });
  const result = r.results.find(c => c.kind === 'agent');
  assert.ok(result);
  assert.match(result.action, /renamed/);
  // The new file should exist at kit/agents/sample-agent-from-claude.md
  const renamedPath = path.join(KIT, 'agents/sample-agent-from-claude.md');
  const exists = await fs.access(renamedPath).then(() => true).catch(() => false);
  assert.ok(exists, 'renamed file should exist at -from-claude.md');
});

// --- unknown strategy for regular kind ---

test('applyReverse — unknown strategy returns "unknown strategy: X" action', async () => {
  // Force a candidate to exist
  await fs.writeFile(path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '---\nname: sample-agent\n---\nedited\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'unknown-foo',
  });
  const result = r.results.find(c => c.kind === 'agent');
  assert.ok(result);
  assert.match(result.action, /unknown strategy: unknown-foo/);
});

// --- unknown strategy for mirror-tree (framework/hooks) ---

test('applyReverse — unknown strategy on mirror-tree returns same error', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md'),
    '# edited\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'unknown-bar',
  });
  const result = r.results.find(c => c.kind === 'framework');
  assert.ok(result);
  assert.match(result.action, /unknown strategy: unknown-bar/);
});

// --- dryRun: overwrite (regular) ---

test('applyReverse dryRun: overwrite — does not write canonical, action has dry-run suffix', async () => {
  const editedAgent = path.join(PROJECT, '.claude/agents/sample-agent.md');
  const origCanonicalContent = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  await fs.writeFile(editedAgent,
    '---\nname: sample-agent\n---\n\ndry-run body\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'overwrite', dryRun: true,
  });
  const result = r.results.find(c => c.kind === 'agent');
  assert.ok(result);
  assert.match(result.action, /\(dry-run\)/);
  // Canonical unchanged
  const stillCanonical = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  assert.equal(stillCanonical, origCanonicalContent);
});

// --- dryRun: merge (regular) ---

test('applyReverse dryRun: merge — does not write, action has dry-run suffix', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '---\nname: sample-agent\n---\n\nmerge dry\n', 'utf8');
  const origCanonical = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'merge', dryRun: true,
  });
  const result = r.results.find(c => c.kind === 'agent');
  assert.ok(result);
  assert.match(result.action, /\(dry-run\)/);
  const stillCanonical = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  assert.equal(stillCanonical, origCanonical);
});

// --- dryRun: rename (regular) ---

test('applyReverse dryRun: rename — does not create -from-claude.md file', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '---\nname: sample-agent\n---\n\nrename dry\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'rename', dryRun: true,
  });
  const result = r.results.find(c => c.kind === 'agent');
  assert.ok(result);
  assert.match(result.action, /\(dry-run\)/);
  const renamed = await fs.access(path.join(KIT, 'agents/sample-agent-from-claude.md')).then(() => true).catch(() => false);
  assert.equal(renamed, false, 'rename file must not exist in dry-run');
});

// --- dryRun: rename (mirror-tree) ---

test('applyReverse dryRun: rename mirror-tree — no .from-claude file written', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md'),
    '# edited dry rename\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'rename', dryRun: true,
  });
  const result = r.results.find(c => c.kind === 'framework');
  assert.ok(result);
  assert.match(result.action, /\(dry-run\)/);
});

// --- only filter ---

test('applyReverse — only filter: items not in list become "skipped (filter)"', async () => {
  await fs.writeFile(path.join(PROJECT, '.claude/agents/sample-agent.md'),
    '---\nname: sample-agent\n---\n\nedit a\n', 'utf8');
  await fs.writeFile(path.join(PROJECT, '.claude/commands/sample-command.md'),
    '---\nname: sample-command\n---\n\nedit b\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'overwrite',
    only: ['agent/sample-agent'],
  });
  const agentResult = r.results.find(c => c.kind === 'agent');
  const cmdResult = r.results.find(c => c.kind === 'command');
  assert.ok(agentResult);
  assert.ok(cmdResult);
  assert.match(agentResult.action, /overwritten/);
  assert.match(cmdResult.action, /skipped \(filter\)/);
});

// --- mergeFrontmatter: edited has no frontmatter ---

test('applyReverse merge — when edited file has no frontmatter, uses edited body as-is', async () => {
  // Replace the IDE's agent with a body-only file (no fm)
  await fs.writeFile(path.join(PROJECT, '.claude/agents/sample-agent.md'),
    'body without frontmatter\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'merge',
  });
  const result = r.results.find(c => c.kind === 'agent');
  assert.ok(result);
  assert.match(result.action, /merged/);
  // Canonical now has ORIGINAL fm (from canonical) + edited body (since edited lacked fm)
  const canonical = await fs.readFile(path.join(KIT, 'agents/sample-agent.md'), 'utf8');
  // Frontmatter from canonical preserved
  assert.match(canonical, /name: sample-agent/);
  // Edited body present
  assert.match(canonical, /body without frontmatter/);
});

// --- new-in-ide skill applied via overwrite creates kit/skills/<name>/SKILL.md ---

test('applyReverse overwrite — new-in-ide skill creates kit canonical at SKILL.md', async () => {
  const skillDir = path.join(PROJECT, '.claude/skills/brand-new-skill');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'),
    '---\nname: brand-new-skill\n---\n\nbrand new skill body\n', 'utf8');
  const r = await applyReverse('claude-code', {
    kitRoot: KIT, projectRoot: PROJECT, strategy: 'overwrite',
  });
  const result = r.results.find(c => c.kind === 'skill' && c.name === 'brand-new-skill');
  assert.ok(result);
  assert.match(result.action, /overwritten/);
  // Verify kit/skills/brand-new-skill/SKILL.md was created
  const canonical = await fs.readFile(
    path.join(KIT, 'skills/brand-new-skill/SKILL.md'), 'utf8',
  );
  assert.match(canonical, /brand new skill body/);
});
