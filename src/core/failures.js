// Failure dataset — closes the learning loop.
//
// Aggregates resolved debug sessions (`.planning/debug/resolved/*.md`),
// failed verifications (`.planning/phases/*/[0-9]*-VERIFICATION.md` with status: gaps_found),
// and forensics reports into a structured dataset that can be queried to find
// recurring failure patterns per agent.
//
// Output is written to `.planning/learnings/{agent}.md` so future agent edits
// have evidence-based input.

import path from 'node:path';
import fs from 'node:fs/promises';

export async function collectFailures(opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const planning    = path.join(projectRoot, '.planning');

  const [debugFailures, verifyFailures, forensicsReports] = await Promise.all([
    readDebugSessions(path.join(planning, 'debug', 'resolved')),
    readFailedVerifications(path.join(planning, 'phases')),
    readForensics(path.join(planning, 'forensics')),
  ]);

  return {
    projectRoot,
    counts: {
      debug:     debugFailures.length,
      verify:    verifyFailures.length,
      forensics: forensicsReports.length,
    },
    items: [...debugFailures, ...verifyFailures, ...forensicsReports],
  };
}

export async function summarizeByAgent(failures) {
  const byAgent = {};
  for (const item of failures.items) {
    const agent = item.agentHint ?? 'unknown';
    byAgent[agent] ??= { agent, count: 0, samples: [] };
    byAgent[agent].count++;
    if (byAgent[agent].samples.length < 5) byAgent[agent].samples.push(item);
  }
  return Object.values(byAgent).sort((a, b) => b.count - a.count);
}

export async function writeLearnings(failures, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const outDir = path.join(projectRoot, '.planning', 'learnings');
  await fs.mkdir(outDir, { recursive: true });

  const summaries = await summarizeByAgent(failures);
  const written = [];
  for (const s of summaries) {
    const out = path.join(outDir, `${s.agent}.md`);
    const md  = renderLearningDoc(s);
    await fs.writeFile(out, md, 'utf8');
    written.push(out);
  }
  return { written, summaries };
}

// --- readers ---

async function readDebugSessions(dir) {
  return readDir(dir, raw => ({
    source: 'debug',
    agentHint: detectAgentHint(raw),
    summary: firstHeading(raw),
    raw: raw.slice(0, 2000),
  }));
}

async function readFailedVerifications(phasesDir) {
  let out = [];
  let phases;
  try { phases = await fs.readdir(phasesDir, { withFileTypes: true }); }
  catch { return out; }
  for (const p of phases) {
    if (!p.isDirectory()) continue;
    const phaseDir = path.join(phasesDir, p.name);
    let files;
    try { files = await fs.readdir(phaseDir); } catch { continue; }
    for (const f of files) {
      if (!/-VERIFICATION\.md$/.test(f)) continue;
      const raw = await fs.readFile(path.join(phaseDir, f), 'utf8');
      if (!/^status:\s*gaps_found/m.test(raw)) continue;
      out.push({
        source: 'verify',
        agentHint: 'verifier',
        phase: p.name,
        summary: firstHeading(raw),
        raw: raw.slice(0, 2000),
      });
    }
  }
  return out;
}

async function readForensics(dir) {
  return readDir(dir, raw => ({
    source: 'forensics',
    agentHint: detectAgentHint(raw),
    summary: firstHeading(raw),
    raw: raw.slice(0, 2000),
  }));
}

async function readDir(dir, mapper) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const raw = await fs.readFile(path.join(dir, e.name), 'utf8');
    out.push({ file: e.name, ...mapper(raw) });
  }
  return out;
}

function detectAgentHint(raw) {
  for (const a of ['executor', 'verifier', 'planner', 'debugger', 'phase-researcher',
                   'plan-checker', 'integration-checker', 'nyquist-auditor', 'ui-checker']) {
    if (raw.toLowerCase().includes(a)) return a;
  }
  return 'unknown';
}

function firstHeading(raw) {
  const m = raw.match(/^#+\s*(.+)$/m);
  return m ? m[1].trim() : '';
}

function renderLearningDoc(s) {
  return `# Learnings — ${s.agent}

**Failure samples:** ${s.count}
**Generated:** ${new Date().toISOString()}

## Recurring patterns

> Review the samples below and edit \`kit/agents/${s.agent}.md\` to address recurring causes.

## Samples

${s.samples.map((x, i) => `### Sample ${i + 1} (${x.source})
${x.summary ? `*${x.summary}*\n` : ''}
\`\`\`
${x.raw.slice(0, 800)}
\`\`\`
`).join('\n---\n\n')}
`;
}
