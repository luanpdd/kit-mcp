// Workflow generator suite — added in v1.35.0.
// Covers presence + correctness of the 3 new artifacts (agent, command, skill),
// frontmatter shape, and content invariants that the agent's prompt depends on.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listKit, findItem, clearKitCache } from '../../src/core/kit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const KIT_ROOT = path.join(REPO_ROOT, 'kit');

process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';

test.beforeEach(() => { clearKitCache(); });

test('agent workflow-generator exists with expected frontmatter', async () => {
  const kit = await listKit(KIT_ROOT);
  const agent = findItem(kit, 'agent', 'workflow-generator');
  assert.ok(agent, 'workflow-generator agent must be present');
  assert.match(agent.description, /Dynamic Workflows/i);
  assert.match(agent.description, /Classify pattern/i);
  assert.ok(agent.description.length <= 200, `description must fit budget-description gate (got ${agent.description.length})`);
});

test('agent workflow-generator declares Task + AskUserQuestion tools', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'agents/workflow-generator.md'), 'utf8');
  const toolsLine = raw.match(/^tools:\s*(.+)$/m)?.[1] ?? '';
  for (const required of ['Read', 'Write', 'Bash', 'AskUserQuestion', 'Task']) {
    assert.ok(toolsLine.includes(required), `tools must include ${required}`);
  }
});

test('agent workflow-generator body documents all 4 layers', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'agents/workflow-generator.md'), 'utf8');
  for (const layer of ['Layer 0', 'Layer 1', 'Layer 2', 'Layer 3', 'Layer 4']) {
    assert.match(raw, new RegExp(layer), `${layer} must be documented in agent body`);
  }
  for (const phase of ['Classify', 'Specify', 'Compose', 'Materialize', 'Deliver']) {
    assert.match(raw, new RegExp(phase), `phase ${phase} must be documented`);
  }
});

test('agent workflow-generator body lists all 6 canonical patterns by name', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'agents/workflow-generator.md'), 'utf8');
  const patterns = [
    'Classify-And-Act',
    'Fanout-And-Synthesize',
    'Adversarial-Verification',
    'Generate-And-Filter',
    'Tournament',
    'Loop-Until-Done',
  ];
  for (const p of patterns) {
    assert.match(raw, new RegExp(p), `pattern ${p} must appear in agent body (layer 0 spec)`);
  }
});

test('agent workflow-generator forbids writes to canonical kit/ in body', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'agents/workflow-generator.md'), 'utf8');
  assert.match(raw, /Nunca|NUNCA|recuse|locais ao projeto/i, 'agent body must explicitly forbid writes to canonical kit/');
});

test('command criar-workflow exists with argument-hint', async () => {
  const kit = await listKit(KIT_ROOT);
  const cmd = findItem(kit, 'command', 'criar-workflow');
  assert.ok(cmd, '/criar-workflow command must be present');
  assert.ok(cmd.description.length <= 200, `description must fit budget-description gate (got ${cmd.description.length})`);
  const raw = await fs.readFile(path.join(KIT_ROOT, 'commands/criar-workflow.md'), 'utf8');
  assert.match(raw, /^argument-hint:/m, 'must declare argument-hint frontmatter');
});

test('command criar-workflow dispatches to workflow-generator via Task', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'commands/criar-workflow.md'), 'utf8');
  assert.match(raw, /Task\s*\(/, 'must call Task()');
  assert.match(raw, /subagent_type\s*=\s*"workflow-generator"/, 'must dispatch to workflow-generator agent');
});

test('command criar-workflow allowed-tools includes Task + AskUserQuestion + Write', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'commands/criar-workflow.md'), 'utf8');
  const allowed = raw.match(/allowed-tools:\s*\n([\s\S]*?)(?:\n[a-zA-Z-]+:|\n---)/)?.[1] ?? '';
  for (const required of ['Read', 'Write', 'Bash', 'AskUserQuestion', 'Task']) {
    assert.match(allowed, new RegExp(`-\\s*${required}\\b`), `allowed-tools must include ${required}`);
  }
});

test('skill dynamic-workflow-authoring exists with budget-compliant description', async () => {
  const kit = await listKit(KIT_ROOT);
  const skill = kit.skills.find(s => s.name === 'dynamic-workflow-authoring');
  assert.ok(skill, 'skill must be present');
  assert.ok(skill.description.length <= 200, `description must fit budget gate (got ${skill.description.length})`);
  assert.match(skill.description, /pattern/i);
});

test('skill dynamic-workflow-authoring documents API hard rules', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'skills/dynamic-workflow-authoring/SKILL.md'), 'utf8');
  // The skill is the source of truth that the agent consults — these are the
  // rules the generator MUST enforce in every .workflow.js it produces.
  assert.match(raw, /meta.*literal|literal.*meta/i, 'must document meta-literal rule');
  assert.match(raw, /Date\.now|Math\.random/i, 'must document Date.now/Math.random ban');
  assert.match(raw, /pipeline\(\).*default|default.*pipeline/i, 'must document pipeline-as-default rule');
  assert.match(raw, /schema/i, 'must document schema requirement');
  assert.match(raw, /budget/i, 'must document budget ceiling');
});

test('skill dynamic-workflow-authoring lists all 6 patterns with use-cases', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'skills/dynamic-workflow-authoring/SKILL.md'), 'utf8');
  const patterns = [
    'Classify-And-Act',
    'Fanout-And-Synthesize',
    'Adversarial-Verification',
    'Generate-And-Filter',
    'Tournament',
    'Loop-Until-Done',
  ];
  for (const p of patterns) {
    const headingRe = new RegExp(`###?\\s.*${p}`);
    assert.match(raw, headingRe, `pattern ${p} must have a heading in the skill body`);
  }
});

test('skill dynamic-workflow-authoring shows API code samples per pattern', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'skills/dynamic-workflow-authoring/SKILL.md'), 'utf8');
  // Each pattern section must include at least one code fence so the generator
  // can quote the canonical shape into the .workflow.js it produces.
  const codeFences = (raw.match(/```js/g) ?? []).length;
  assert.ok(codeFences >= 6, `skill must include >=6 js code samples (one per pattern), got ${codeFences}`);
});

test('skill dynamic-workflow-authoring maps kit agents to reuse cases', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'skills/dynamic-workflow-authoring/SKILL.md'), 'utf8');
  assert.match(raw, /agentType/i, 'must document opts.agentType for reusing canonical agents');
  // At least these canonical agents must be mentioned by name (representative sample)
  for (const agentName of ['observability-coverage-auditor', 'incident-investigator', 'schema-checker']) {
    assert.match(raw, new RegExp(agentName), `must mention ${agentName} in reuse table`);
  }
});

test('cross-reference: agent links to skill and example workflow', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'agents/workflow-generator.md'), 'utf8');
  assert.match(raw, /dynamic-workflow-authoring/, 'agent must reference the authoring skill');
  assert.match(raw, /auditar-observabilidade-cobertura\.workflow\.js/, 'agent must reference the canonical example workflow');
});

test('cross-reference: command links to agent', async () => {
  const raw = await fs.readFile(path.join(KIT_ROOT, 'commands/criar-workflow.md'), 'utf8');
  assert.match(raw, /workflow-generator/, 'command must link to the agent it dispatches to');
});

test('searchKit finds all 3 new artifacts by keyword', async () => {
  const kit = await listKit(KIT_ROOT);
  const { searchKit } = await import('../../src/core/kit.js');
  const results = searchKit(kit, 'workflow');
  const names = new Set(results.map(r => r.name));
  assert.ok(names.has('workflow-generator'), 'agent must be searchable');
  assert.ok(names.has('criar-workflow'), 'command must be searchable');
  assert.ok(names.has('dynamic-workflow-authoring'), 'skill must be searchable');
});
