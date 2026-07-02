// Regression suite for workflow-generator templates — added in v1.36.0.
//
// Background: v1.35 shipped a workflow-generator agent that did NOT include
// concrete templates inline, only "rules". Real users hit 3 bugs in production:
//   - generated `import {...} from 'kit-mcp/workflow'` (no such module)
//   - wrapped body in `export default async function ...`
//   - called `agent({name, systemPrompt, schema})` instead of `agent(prompt, opts)`
//
// v1.36 fix: agent body now ships 6 working templates (one per canonical pattern)
// + a Layer 3.5 validation step. These tests extract each template from the agent
// body and assert it parses under the same harness wrap the Workflow tool uses,
// AND does not contain any of the fatal anti-patterns. If a future edit breaks
// a template, CI fails before npm publish.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_PATH = path.resolve(__dirname, '../../kit/agents/workflow-generator.md');
const SKILL_PATH = path.resolve(__dirname, '../../kit/skills/dynamic-workflow-authoring/SKILL.md');

// Extract all ```js code blocks from a markdown file, keeping the source for
// error messages so a failing template points at its position.
async function extractJsBlocks(mdPath) {
  const raw = await fs.readFile(mdPath, 'utf8');
  const blocks = [];
  const re = /```js\r?\n([\s\S]*?)```/g;
  let m;
  let blockIdx = 0;
  while ((m = re.exec(raw))) {
    blockIdx++;
    const code = m[1];
    // Locate which template this block belongs to by walking back to the
    // nearest "#### Template ..." heading.
    const before = raw.slice(0, m.index);
    const headingMatch = before.match(/####\s+Template\s+([A-Za-z-]+(?:\s+\(.+?\))?)[\s\S]*$/);
    const templateName = headingMatch?.[1]?.trim() ?? `block-${blockIdx}`;
    blocks.push({ index: blockIdx, templateName, code });
  }
  return blocks;
}

// Apply the same wrap the Workflow tool uses to execute the script body. We
// don't actually run the script — we just check that it parses as valid JS
// when wrapped in an async IIFE with the harness globals as function args.
function tryParseWorkflowSource(src) {
  // Strip the `export const meta = { ... }` block — top-level export is illegal
  // inside a Function body, but the harness handles it via a real ESM loader.
  // For syntax-only checks, replace it with a placeholder comment.
  const stripped = src.replace(/^export\s+const\s+meta\s*=\s*\{[\s\S]*?\n\}\s*\n?/m, '/* meta stripped */\n');
  const wrap = '(async () => {\n' + stripped + '\n})();';
  // eslint-disable-next-line no-new-func
  new Function('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', wrap);
}

const FATAL_PATTERNS = [
  { name: 'no top-level import', re: /^\s*import\s/m, hint: 'Workflow hooks são globais — sem imports' },
  { name: 'no export default',  re: /^\s*export\s+default\s/m, hint: 'body roda direto em async context' },
  { name: 'no Date.now()',       re: /Date\.now\s*\(/,         hint: 'banido — quebra resume cache' },
  { name: 'no Math.random()',    re: /Math\.random\s*\(/,      hint: 'banido — idem; varie por índice' },
  { name: 'no argless new Date()', re: /new\s+Date\s*\(\s*\)/, hint: 'banido — passe ts via args' },
  { name: 'no agent({name:...})', re: /agent\s*\(\s*\{[^)]*\bname\s*:/, hint: 'agent(prompt, opts), não agent({name, ...})' },
];

test('agent body — extracted templates parse under harness wrap', async () => {
  const blocks = await extractJsBlocks(AGENT_PATH);
  assert.ok(blocks.length >= 6, `expected >=6 code blocks (one per pattern + slash stub), got ${blocks.length}`);
  for (const b of blocks) {
    // Skip the slash-command yaml stub if it slipped in as ```js (it shouldn't)
    if (b.code.startsWith('---')) continue;
    // Skip the Layer 3.5 Bash validation snippet (it's a node -e harness, not a workflow body)
    if (b.code.includes('process.exit') && b.code.includes('FAIL')) continue;
    try {
      tryParseWorkflowSource(b.code);
    } catch (err) {
      assert.fail(`template "${b.templateName}" (block #${b.index}) failed to parse: ${err.message}\n--- code ---\n${b.code.slice(0, 600)}...`);
    }
  }
});

test('agent body — no template contains fatal anti-patterns', async () => {
  const blocks = await extractJsBlocks(AGENT_PATH);
  for (const b of blocks) {
    if (b.code.startsWith('---')) continue;
    if (b.code.includes('process.exit') && b.code.includes('FAIL')) continue;
    // Layer 3.5 validation snippet has `Date.now` etc INSIDE strings/regex as the
    // patterns it detects — those are intentional. We only check actual JS code blocks
    // that lack the validation hallmark `process.exit`.
    for (const ap of FATAL_PATTERNS) {
      assert.ok(
        !ap.re.test(b.code),
        `template "${b.templateName}" contains anti-pattern "${ap.name}": ${ap.hint}\n--- code ---\n${b.code.slice(0, 400)}...`
      );
    }
  }
});

test('agent body — every template has a meta literal block', async () => {
  const blocks = await extractJsBlocks(AGENT_PATH);
  const workflowTemplates = blocks.filter(b =>
    !b.code.startsWith('---') && !(b.code.includes('process.exit') && b.code.includes('FAIL'))
  );
  for (const b of workflowTemplates) {
    assert.match(
      b.code,
      /export\s+const\s+meta\s*=\s*\{/,
      `template "${b.templateName}" must declare \`export const meta = {...}\``
    );
  }
});

test('agent body — every template documents the user-generated header', async () => {
  const blocks = await extractJsBlocks(AGENT_PATH);
  const workflowTemplates = blocks.filter(b =>
    !b.code.startsWith('---') && !(b.code.includes('process.exit') && b.code.includes('FAIL'))
  );
  for (const b of workflowTemplates) {
    assert.match(
      b.code,
      /^\/\/ kit-mcp:user-generated/m,
      `template "${b.templateName}" must start with // kit-mcp:user-generated header`
    );
  }
});

test('agent body — agent() calls use string-first signature, never object-first', async () => {
  const blocks = await extractJsBlocks(AGENT_PATH);
  for (const b of blocks) {
    if (b.code.startsWith('---')) continue;
    if (b.code.includes('process.exit') && b.code.includes('FAIL')) continue;
    // Match agent( followed by optional whitespace and { + a key like name:/description:
    // — this is the Task() API misuse.
    const wrongShape = /agent\s*\(\s*\{[^)]*\b(name|description|systemPrompt|tools)\s*:/;
    assert.ok(
      !wrongShape.test(b.code),
      `template "${b.templateName}" calls agent() with object-form (Task API confusion)\n--- snippet ---\n${b.code.slice(0, 300)}`
    );
  }
});

test('agent body — explicitly documents the 3 anti-patterns by name', async () => {
  const raw = await fs.readFile(AGENT_PATH, 'utf8');
  for (const phrase of ['import', 'export default', 'agent({']) {
    assert.ok(
      raw.includes(phrase),
      `agent body must explicitly call out the anti-pattern "${phrase}"`
    );
  }
  // The "ANTI-PATTERNS DETECTADOS EM PRODUÇÃO" block must exist
  assert.match(raw, /ANTI-PATTERNS DETECTADOS EM PRODUÇÃO/, 'agent body must have the dedicated anti-patterns block at top');
});

test('agent body — Layer 3.5 validation step exists and runs the syntax wrap', async () => {
  const raw = await fs.readFile(AGENT_PATH, 'utf8');
  assert.match(raw, /Layer 3\.5/, 'must have Layer 3.5 validation section');
  assert.match(raw, /new Function\(['"`]agent['"`]/, 'must use new Function() wrap trick');
  assert.match(raw, /process\.exit\(1\)/, 'must have explicit FAIL exits');
});

test('skill — anti-patterns section calls out all 3 fatal cases', async () => {
  const raw = await fs.readFile(SKILL_PATH, 'utf8');
  assert.match(raw, /FATAL anti-patterns observados em produção/i,
    'skill must have the FATAL anti-patterns section at top');
  assert.match(raw, /NUNCA `import`/, 'skill must call out the import anti-pattern');
  assert.match(raw, /NUNCA `export default`/, 'skill must call out the export default anti-pattern');
  assert.match(raw, /NUNCA `agent\(\{\.\.\.\}\)`/, 'skill must call out the agent({...}) anti-pattern');
});

test('skill — documents exact assignatures of injected globals', async () => {
  const raw = await fs.readFile(SKILL_PATH, 'utf8');
  // The "Assinaturas EXATAS dos globais injetados" block must enumerate each hook
  assert.match(raw, /Assinaturas EXATAS dos globais injetados/i);
  for (const hook of ['agent', 'pipeline', 'parallel', 'phase', 'log', 'workflow', 'budget']) {
    assert.match(raw, new RegExp(`\\b${hook}\\b`), `skill must document the ${hook} global`);
  }
});
