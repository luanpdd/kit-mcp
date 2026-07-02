// Phase 100 — Coverage ratchet: targeted tests for src/core/reflect.js
//
// Baseline: 56.28% line coverage. Target ≥ 90%.
// `reflect-redact.test.js` covers only the SEC-14-06 401 scrubbing path.
// Here we cover happy path (LLM proposal extraction + apply), dry-run
// (prompt save), validation errors (no agent / no learnings / no agent file),
// LLM error paths (no API key, unparseable response), and apply:true.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { reflect } from '../../src/core/reflect.js';

// Mininal fixture: kit/agents/<agent>.md + .planning/learnings/<agent>.md
async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-reflect-paths-'));
  await mkdir(path.join(root, '.planning', 'learnings'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'agents'), { recursive: true });
  await writeFile(
    path.join(root, '.planning', 'learnings', 'test-agent.md'),
    '# learnings\n\nfailure 1\nfailure 2\n',
    'utf8',
  );
  await writeFile(
    path.join(root, 'kit', 'agents', 'test-agent.md'),
    '---\nname: test-agent\ndescription: Test\n---\n\noriginal body\n',
    'utf8',
  );
  return root;
}

// Build a successful 200 response with a parseable proposal.
function makeSuccessFetch(newAgentBody) {
  return async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      content: [{ text: makeProposalText(newAgentBody) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
    json: async () => ({
      content: [{ text: makeProposalText(newAgentBody) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  });
}

function makeProposalText(newAgentBody) {
  return `### Analysis
Some analysis here.

### Proposed agent

\`\`\`markdown
${newAgentBody}
\`\`\`

### Summary of changes
- bullet 1
`;
}

// --- error paths ---

test('reflect — missing agent arg returns error', async () => {
  const r = await reflect({ projectRoot: tmpdir() });
  assert.match(r.error, /reflect: agent required/);
});

test('reflect — learnings file missing returns error', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-reflect-noL-'));
  try {
    const r = await reflect({
      agent: 'nonexistent-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
    });
    assert.match(r.error, /No learnings found at/);
    assert.match(r.error, /forensics write-learnings/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reflect — agent file missing returns error', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-reflect-noA-'));
  await mkdir(path.join(root, '.planning', 'learnings'), { recursive: true });
  await writeFile(
    path.join(root, '.planning', 'learnings', 'ghost.md'),
    '# learnings\n',
    'utf8',
  );
  try {
    const r = await reflect({
      agent: 'ghost',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),  // kit/agents/ghost.md does NOT exist
    });
    assert.match(r.error, /Agent not found at/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// --- dry-run path ---

test('reflect — dry-run saves prompt without API call', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  // fetch should NEVER be called in dry-run; if it is, this throws
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; throw new Error('fetch should not be called'); };
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      dryRun: true,
      onLog: () => {},
    });
    assert.equal(r.dryRun, true);
    assert.equal(r.agent, 'test-agent');
    assert.match(r.promptPath, /test-agent\.reflect-prompt\.md$/);
    assert.equal(typeof r.promptBytes, 'number');
    assert.ok(r.promptBytes > 0);
    assert.equal(fetchCalled, false, 'fetch must not be called in dry-run');
    // Prompt file written
    await access(r.promptPath);
    const content = await readFile(r.promptPath, 'utf8');
    assert.match(content, /system prompt of an agent/);
    assert.match(content, /failure 1/);  // learnings included
    assert.match(content, /original body/);  // current agent included
  } finally {
    globalThis.fetch = origFetch;
    await rm(root, { recursive: true, force: true });
  }
});

// --- API key missing ---

test('reflect — no ANTHROPIC_API_KEY (non-dry-run) returns error + saves prompt', async () => {
  const root = await makeFixture();
  const origKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      onLog: () => {},
    });
    assert.match(r.error, /ANTHROPIC_API_KEY not set/);
    assert.match(r.promptPath, /reflect-prompt\.md$/);
    await access(r.promptPath);
  } finally {
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

// --- happy path with stubbed fetch ---

test('reflect — successful LLM response writes proposal, returns summary', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-test';
  globalThis.fetch = makeSuccessFetch(
    '---\nname: test-agent\ndescription: Test\n---\n\nUPDATED BODY HERE\n'
  );
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      apply: false,
      interactive: false,
      onLog: () => {},
    });
    assert.equal(r.agent, 'test-agent');
    assert.match(r.proposalPath, /test-agent\.proposal\.md$/);
    assert.equal(r.applied, false);  // apply:false + interactive:false
    assert.match(r.summary, /\d+\s+lines/);
    assert.match(r.summary, /bytes/);
    assert.ok(r.usage);
    // Proposal file written, agent file UNCHANGED
    await access(r.proposalPath);
    const proposal = await readFile(r.proposalPath, 'utf8');
    assert.match(proposal, /UPDATED BODY HERE/);
    const agentFile = await readFile(path.join(root, 'kit/agents/test-agent.md'), 'utf8');
    assert.match(agentFile, /original body/);  // not yet applied
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

// --- apply: true overwrites the agent file ---

test('reflect — apply:true overwrites agent file with proposed content', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-test';
  const newBody = '---\nname: test-agent\ndescription: Test\n---\n\nNEW APPLIED BODY\n';
  globalThis.fetch = makeSuccessFetch(newBody);
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      apply: true,
      onLog: () => {},
    });
    assert.equal(r.applied, true);
    const agentFile = await readFile(path.join(root, 'kit/agents/test-agent.md'), 'utf8');
    assert.match(agentFile, /NEW APPLIED BODY/);
    assert.ok(!agentFile.includes('original body'));
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

// --- unparseable response ---

test('reflect — LLM response without proposal heading returns error + saves raw', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-test';
  // Response has no "### Proposed agent" heading
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ text: 'No structured response — just chatter.' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    }),
  });
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      apply: false,
      interactive: false,
      onLog: () => {},
    });
    assert.match(r.error, /did not contain a parseable proposal/);
    assert.match(r.rawPath, /reflect-raw\.md$/);
    assert.ok(r.usage);
    await access(r.rawPath);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

// --- proposal heading present but no fence ---

test('reflect — proposal heading without fence returns error', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-test';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ text: '### Proposed agent\n\nJust prose, no fenced block.\n' }],
    }),
  });
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      apply: false, interactive: false, onLog: () => {},
    });
    assert.match(r.error, /did not contain a parseable proposal/);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

// --- proposal with empty fence body ---

test('reflect — proposal heading + empty fence body returns error', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-test';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ text: '### Proposed agent\n\n```markdown\n```\n' }],
    }),
  });
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      apply: false, interactive: false, onLog: () => {},
    });
    // block.trim() === '' → extractProposal returns null
    assert.match(r.error, /did not contain a parseable proposal/);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

// --- proposal heading + opening fence but no closing fence ---

test('reflect — opening fence without closing fence returns error', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-key-for-test';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ text: '### Proposed agent\n\n```markdown\nsome content\nbut never closes' }],
    }),
  });
  try {
    const r = await reflect({
      agent: 'test-agent',
      projectRoot: root,
      kitRoot: path.join(root, 'kit'),
      apply: false, interactive: false, onLog: () => {},
    });
    assert.match(r.error, /did not contain a parseable proposal/);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});
