// reflect — feed an agent's recent failures back to an LLM and ask for
// minimal prompt edits. Closes the learning loop opened by `forensics`.
//
// Inputs:
//   - kit/agents/{agent}.md          (current agent prompt)
//   - .planning/learnings/{agent}.md (failure samples written by `forensics write-learnings`)
//
// Output:
//   - .planning/learnings/{agent}.proposal.md  (proposed new full content)
//   - kit/agents/{agent}.md is overwritten only when `apply: true` (or user confirms in interactive mode)
//
// LLM:
//   - Uses Anthropic API via fetch (no new dependency)
//   - Requires ANTHROPIC_API_KEY env var to actually call the API
//   - With --dry-run, prints the assembled prompt and exits without calling

import path from 'node:path';
import fs from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, stderr } from 'node:process';
import { resolveKitRoot } from './kit.js';
import { redactSecrets } from './error-redaction.js';

const DEFAULT_MODEL      = process.env.KIT_REFLECT_MODEL ?? 'claude-sonnet-4-5-20250929';
const DEFAULT_MAX_TOKENS = parseInt(process.env.KIT_REFLECT_MAX_TOKENS ?? '8000', 10);

export async function reflect(opts = {}) {
  const agent = opts.agent;
  if (!agent) return { error: 'reflect: agent required' };

  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot     = resolveKitRoot(opts.kitRoot);
  const dryRun      = !!opts.dryRun;
  const apply       = !!opts.apply;
  const interactive = opts.interactive !== false && !apply;
  const onLog       = opts.onLog ?? ((s) => stderr.write(s + '\n'));

  const learningsPath = path.join(projectRoot, '.planning', 'learnings', `${agent}.md`);
  const agentPath     = path.join(kitRoot, 'agents', `${agent}.md`);

  let learnings;
  try { learnings = await fs.readFile(learningsPath, 'utf8'); }
  catch {
    return { error: `No learnings found at ${learningsPath}. Run \`kit forensics write-learnings --project-root ${projectRoot}\` first.` };
  }

  let currentAgent;
  try { currentAgent = await fs.readFile(agentPath, 'utf8'); }
  catch { return { error: `Agent not found at ${agentPath}` }; }

  const prompt = buildReflectPrompt(agent, currentAgent, learnings);

  if (dryRun) {
    const promptPath = await savePrompt(prompt, projectRoot, agent);
    onLog(`prompt saved → ${promptPath} (dry-run, no API call)`);
    return {
      agent, dryRun: true, promptPath,
      promptBytes: prompt.length,
      model: DEFAULT_MODEL,
      learningsPath, agentPath,
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const promptPath = await savePrompt(prompt, projectRoot, agent);
    return {
      error: 'ANTHROPIC_API_KEY not set. Either set it, or run with --dry-run to inspect the prompt.',
      promptPath,
    };
  }

  onLog(`calling Anthropic (${DEFAULT_MODEL})...`);
  const { text, usage } = await callClaude(prompt);

  const proposed = extractProposal(text);
  if (!proposed) {
    const rawPath = await saveRaw(text, projectRoot, agent);
    return { error: 'LLM response did not contain a parseable proposal. See raw output.', rawPath, usage };
  }

  const proposalPath = path.join(projectRoot, '.planning', 'learnings', `${agent}.proposal.md`);
  await fs.mkdir(path.dirname(proposalPath), { recursive: true });
  await fs.writeFile(proposalPath, proposed, 'utf8');
  onLog(`proposal saved → ${proposalPath}`);

  const summary = summarizeChange(currentAgent, proposed);
  onLog(`change: ${summary}`);

  // Apply decision
  let applied = false;
  if (apply) {
    await fs.writeFile(agentPath, proposed, 'utf8');
    applied = true;
    onLog(`✓ applied → ${agentPath}`);
  } else if (interactive) {
    const ok = await ask('apply this proposal to the agent? [y/N] ');
    if (ok) {
      await fs.writeFile(agentPath, proposed, 'utf8');
      applied = true;
      onLog(`✓ applied → ${agentPath}`);
    } else {
      onLog('not applied. Review the proposal and re-run with --apply when ready.');
    }
  } else {
    onLog('not applied (non-interactive without --apply).');
  }

  return { agent, proposalPath, summary, applied, model: DEFAULT_MODEL, usage };
}

// --- prompt building ---

function buildReflectPrompt(agent, currentAgent, learnings) {
  return `You are reviewing the system prompt of an agent named "${agent}".

## Current agent prompt

\`\`\`markdown
${currentAgent}
\`\`\`

## Recent failures attributed to this agent

${learnings}

---

## Your task

Propose **minimal, surgical edits** to the agent prompt that would reduce these failure patterns.

Constraints:
- Preserve YAML frontmatter (name, description, tools, color, hooks) exactly.
- Do not rewrite the agent — just adjust phrasing, add a clarifying note, or insert specific guidance for the recurring failure modes you see.
- Be conservative: a smaller diff is better. If the failures don't suggest a clear prompt-level fix, say so honestly and propose no change.
- Output format below is mandatory — anything else will fail to parse.

## Output format

### Analysis
3-5 sentences on what patterns you see and why a prompt edit could help (or not).

### Proposed agent

\`\`\`markdown
{full new content of the agent .md file, including frontmatter}
\`\`\`

### Summary of changes
- {bullet 1}
- {bullet 2}
`;
}

// --- LLM call ---

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    // SEC-14-06: Anthropic error responses can echo the supplied API key
    // (rare but observed in 401s). Strip secrets/paths before propagating
    // to caller — the central MCP catch will sanitize again, but doing it
    // here means CLI callers (which bypass the MCP catch) are also protected.
    throw new Error(`Anthropic API ${res.status}: ${redactSecrets(errBody)}`);
  }
  const j = await res.json();
  return {
    text: (j.content ?? []).map(c => c.text ?? '').join(''),
    usage: j.usage,
  };
}

// --- parsing ---

function extractProposal(text) {
  // Find "Proposed agent" heading then the next ```markdown / ```md / ``` block.
  const lines = text.split(/\r?\n/);
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,4}\s+Proposed agent\s*$/i.test(lines[i])) { headingIdx = i; break; }
  }
  if (headingIdx === -1) return null;

  // Find opening fence after the heading
  let openIdx = -1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^```/.test(lines[i])) { openIdx = i; break; }
  }
  if (openIdx === -1) return null;

  // Find closing fence
  let closeIdx = -1;
  for (let i = openIdx + 1; i < lines.length; i++) {
    if (/^```\s*$/.test(lines[i])) { closeIdx = i; break; }
  }
  if (closeIdx === -1) return null;

  const block = lines.slice(openIdx + 1, closeIdx).join('\n').trim();
  return block ? block + '\n' : null;
}

function summarizeChange(before, after) {
  const bL = before.split(/\r?\n/).length;
  const aL = after.split(/\r?\n/).length;
  const dL = aL - bL;
  const dB = after.length - before.length;
  return `${aL} lines (${dL >= 0 ? '+' : ''}${dL}); ${before.length}→${after.length} bytes (${dB >= 0 ? '+' : ''}${dB})`;
}

// --- helpers ---

async function savePrompt(prompt, projectRoot, agent) {
  const out = path.join(projectRoot, '.planning', 'learnings', `${agent}.reflect-prompt.md`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, prompt, 'utf8');
  return out;
}

async function saveRaw(text, projectRoot, agent) {
  const out = path.join(projectRoot, '.planning', 'learnings', `${agent}.reflect-raw.md`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, text, 'utf8');
  return out;
}

async function ask(q) {
  const rl = createInterface({ input, output });
  try {
    const a = (await rl.question(q)).trim().toLowerCase();
    return a === 'y' || a === 'yes';
  } finally {
    rl.close();
  }
}
