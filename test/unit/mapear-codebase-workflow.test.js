// Embedded flagship workflow mapear-codebase (DIR-06).
// Covers: kit loader pickup (meta literal), harness-wrap syntax validation,
// fatal anti-pattern lint (same rules the dynamic-workflow-authoring skill
// enforces), Fanout-Synthesize content invariants (4 mappers, 7 canonical
// docs, canonical agent delegation), companion command dispatch, the note in
// the traditional command, and core pack registration.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listKit, findItem, searchKit, clearKitCache } from '../../src/core/kit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const KIT_ROOT = path.join(REPO_ROOT, 'kit');
const WF_PATH = path.join(KIT_ROOT, 'workflows', 'mapear-codebase.workflow.js');
const CMD_PATH = path.join(KIT_ROOT, 'commands', 'mapear-codebase-workflow.md');
const SERIAL_CMD_PATH = path.join(KIT_ROOT, 'commands', 'mapear-codebase.md');
const CORE_PACK_PATH = path.join(KIT_ROOT, 'packs', 'core', 'pack.json');

process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';

test.beforeEach(() => { clearKitCache(); });

// Same wrap the Workflow tool uses to execute the script body (see
// workflow-generator-templates.test.js). Syntax-only check: strip the
// top-level `export const meta` (handled by the harness ESM loader) and
// parse the body as an async function with the injected globals as args.
function tryParseWorkflowSource(src) {
  const stripped = src.replace(/^export\s+const\s+meta\s*=\s*\{[\s\S]*?\n\}\s*\n?/m, '/* meta stripped */\n');
  const wrap = '(async () => {\n' + stripped + '\n})();';
  // eslint-disable-next-line no-new-func
  new Function('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', wrap);
}

const FATAL_PATTERNS = [
  { name: 'no top-level import', re: /^\s*import\s/m, hint: 'Workflow hooks são globais — sem imports' },
  { name: 'no export default', re: /^\s*export\s+default\s/m, hint: 'body roda direto em async context' },
  { name: 'no Date.now()', re: /Date\.now\s*\(/, hint: 'banido — quebra resume cache' },
  { name: 'no Math.random()', re: /Math\.random\s*\(/, hint: 'banido — idem; varie por índice' },
  { name: 'no argless new Date()', re: /new\s+Date\s*\(\s*\)/, hint: 'banido — passe ts via args' },
  { name: 'no require()', re: /\brequire\s*\(/, hint: 'sem CommonJS no body' },
  { name: 'no agent({name:...})', re: /agent\s*\(\s*\{[^)]*\b(name|description|systemPrompt|tools)\s*:/, hint: 'agent(prompt, opts), não agent({name, ...})' },
];

// --- kit loader ---------------------------------------------------------------

test('listKit — picks up mapear-codebase workflow with meta literal fields', async () => {
  const kit = await listKit(KIT_ROOT);
  const wf = kit.workflows.find(w => w.name === 'mapear-codebase');
  assert.ok(wf, 'mapear-codebase workflow must be present in kit/workflows/');
  assert.equal(wf.kind, 'workflow');
  assert.equal(wf.fileBase, 'mapear-codebase');
  assert.match(wf.description, /4 mappers/);
  assert.match(wf.description, /synthesizer/i);
  assert.ok(wf.meta?.whenToUse, 'meta.whenToUse must parse');
  assert.match(wf.meta.whenToUse, /mapear-codebase/);
});

test('searchKit + findItem — mapear-codebase workflow is addressable', async () => {
  const kit = await listKit(KIT_ROOT);
  const found = searchKit(kit, 'mapear-codebase');
  assert.ok(found.some(x => x.kind === 'workflow' && x.name === 'mapear-codebase'));
  const item = findItem(kit, 'workflow', 'mapear-codebase');
  assert.ok(item);
  assert.equal(item.name, 'mapear-codebase');
});

// --- syntax + API rules (dynamic-workflow-authoring skill) ---------------------

test('workflow source — parses under the harness wrap (node syntax check)', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  assert.doesNotThrow(() => tryParseWorkflowSource(src));
});

test('workflow source — contains no fatal anti-patterns', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  for (const ap of FATAL_PATTERNS) {
    assert.ok(!ap.re.test(src), `contains anti-pattern "${ap.name}": ${ap.hint}`);
  }
});

test('workflow source — meta is a pure literal (no template/call/spread)', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  const metaBlock = src.match(/export\s+const\s+meta\s*=\s*\{[\s\S]*?\n\}/m)?.[0] ?? '';
  assert.ok(metaBlock, 'meta block must exist');
  // Strip single-quoted string CONTENTS first — parens/backticks inside prose
  // are fine; only the structure around the strings must stay literal.
  const structure = metaBlock.replace(/'[^']*'/g, "''");
  assert.ok(!/`/.test(structure), 'meta must not use template literals');
  assert.ok(!/\.\.\./.test(structure), 'meta must not use spreads');
  assert.ok(!/\w+\s*\(/.test(structure), 'meta must not contain function calls');
});

test('workflow source — every agent() call is schema-structured', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  const agentCalls = (src.match(/\bagent\s*\(/g) ?? []).length;
  assert.ok(agentCalls >= 3, `expected >=3 agent() calls (prepare + fanout + synthesize), got ${agentCalls}`);
  for (const schemaRef of ['PREPARE_SCHEMA', 'MAPPER_SCHEMA', 'SYNTHESIS_SCHEMA']) {
    assert.match(src, new RegExp(`schema:\\s*${schemaRef}`), `agent() must pass ${schemaRef}`);
  }
  // every declared schema must list required fields (anti-pitfall 4 of the skill)
  const schemaDecls = (src.match(/_SCHEMA\s*=\s*\{/g) ?? []).length;
  const requiredDecls = (src.match(/required:\s*\[/g) ?? []).length;
  assert.ok(requiredDecls >= schemaDecls, 'every schema literal must declare required: [...]');
});

// --- Fanout-Synthesize invariants ----------------------------------------------

test('workflow — fans out 4 mappers via pipeline() delegating to codebase-mapper', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  assert.match(src, /pipeline\s*\(\s*MAPPERS/, 'fanout must use pipeline() (skill default over parallel)');
  assert.match(src, /agentType:\s*'codebase-mapper'/, 'mappers must delegate to the canonical codebase-mapper agent');
  for (const focus of ['tech', 'arch', 'quality', 'concerns']) {
    assert.match(src, new RegExp(`focus:\\s*'${focus}'`), `mapper focus "${focus}" must be declared`);
  }
});

test('workflow — covers the 7 canonical docs of .planning/codebase/', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  const docs = ['STACK.md', 'INTEGRATIONS.md', 'ARCHITECTURE.md', 'STRUCTURE.md', 'CONVENTIONS.md', 'TESTING.md', 'CONCERNS.md'];
  for (const doc of docs) {
    assert.ok(src.includes(doc), `workflow must produce ${doc}`);
  }
  assert.match(src, /\.planning\/codebase/, 'default outputDir must be .planning/codebase');
});

test('workflow — declares Prepare/Fanout/Synthesize phases in meta and body', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  for (const p of ['Prepare', 'Fanout', 'Synthesize']) {
    assert.match(src, new RegExp(`title:\\s*'${p}'`), `phase ${p} must be in meta.phases`);
    assert.match(src, new RegExp(`phase\\('${p}'\\)`), `phase('${p}') must be called in body`);
  }
});

test('workflow — logs silent caps (abort + partial mapper failure) and never commits', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  assert.match(src, /log\(/, 'must log() decisions (skill anti-pitfall 1)');
  assert.match(src, /aborted:\s*true/, 'trivial codebase must return an explicit aborted result');
  assert.match(src, /sem confirmacao/, 'partial mapper failure must be logged');
  assert.match(src, /NAO faca commit/, 'agents must be told not to commit (orchestrator owns git)');
});

test('workflow — synthesizer runs secret scan and reports files only (never values)', async () => {
  const src = await fs.readFile(WF_PATH, 'utf8');
  assert.match(src, /secretsSuspected/, 'synthesis schema must expose secretsSuspected');
  assert.match(src, /BEGIN\.\*PRIVATE KEY/, 'secret scan regex must match the canonical map-codebase pattern');
  assert.match(src, /NUNCA cite o valor/, 'prompt must forbid echoing secret values');
});

// --- companion command + note ---------------------------------------------------

test('command mapear-codebase-workflow — exists with budget-compliant description', async () => {
  const kit = await listKit(KIT_ROOT);
  const cmd = findItem(kit, 'command', 'mapear-codebase-workflow');
  assert.ok(cmd, '/mapear-codebase-workflow command must be present');
  assert.ok(cmd.description.length <= 200, `description must fit budget gate (got ${cmd.description.length})`);
  const raw = await fs.readFile(CMD_PATH, 'utf8');
  assert.match(raw, /^argument-hint:/m, 'must declare argument-hint frontmatter');
});

test('command mapear-codebase-workflow — dispatches Workflow(name: "mapear-codebase")', async () => {
  const raw = await fs.readFile(CMD_PATH, 'utf8');
  assert.match(raw, /Workflow\s*\(/, 'must call Workflow()');
  assert.match(raw, /name:\s*"mapear-codebase"/, 'must dispatch to the embedded workflow by name');
  const allowed = raw.match(/allowed-tools:\s*\n([\s\S]*?)\n---/)?.[1] ?? '';
  assert.match(allowed, /-\s*Workflow\b/, 'allowed-tools must include Workflow');
});

test('command mapear-codebase — carries the note pointing at the embedded variant', async () => {
  const raw = await fs.readFile(SERIAL_CMD_PATH, 'utf8');
  assert.match(raw, /mapear-codebase-workflow/, 'traditional command must mention the -workflow variant');
  assert.match(raw, /mapear-codebase\.workflow\.js/, 'traditional command must point at the embedded script');
});

// --- registration ----------------------------------------------------------------

test('core pack — registers the workflow and the companion command', async () => {
  const pack = JSON.parse(await fs.readFile(CORE_PACK_PATH, 'utf8'));
  assert.ok(pack.resources.workflows.includes('mapear-codebase'), 'core pack must list the workflow');
  assert.ok(pack.resources.commands.includes('mapear-codebase-workflow'), 'core pack must list the companion command');
  assert.ok(pack.resources.commands.includes('mapear-codebase'), 'core pack must keep the traditional command');
});
