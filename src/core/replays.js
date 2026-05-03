// Replays — capture Task() payloads so an agent can be re-run with the same
// inputs but an updated prompt. Tight feedback loop for iterating on agent
// definitions without re-running the whole workflow.
//
// Storage: .planning/replays/{phase}-{plan?}-{timestamp}-{agent}.json
//
// Payload shape:
//   {
//     id, agent, phase?, plan?, timestamp,
//     subagent_type, model, isolation,
//     prompt, files_to_read, agent_skills,
//     outcome?: { status, notes }
//   }

import path from 'node:path';
import fs from 'node:fs/promises';

const REPLAY_DIR_REL = path.join('.planning', 'replays');

export async function recordReplay(payload, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const dir = path.join(projectRoot, REPLAY_DIR_REL);
  await fs.mkdir(dir, { recursive: true });

  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = [payload.phase, payload.plan, payload.agent].filter(Boolean).join('-') || 'unknown';
  const id   = `${ts}-${slug}`;
  const file = path.join(dir, `${id}.json`);

  const record = { id, recorded_at: new Date().toISOString(), ...payload };
  await fs.writeFile(file, JSON.stringify(record, null, 2), 'utf8');
  return { id, file, record };
}

export async function listReplays(opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const dir = path.join(projectRoot, REPLAY_DIR_REL);
  let entries;
  try { entries = await fs.readdir(dir); } catch { return []; }
  const items = [];
  for (const e of entries) {
    if (!e.endsWith('.json')) continue;
    try {
      const r = JSON.parse(await fs.readFile(path.join(dir, e), 'utf8'));
      items.push({ id: r.id, agent: r.agent, phase: r.phase, plan: r.plan, recorded_at: r.recorded_at });
    } catch {}
  }
  return items.sort((a, b) => (b.recorded_at ?? '').localeCompare(a.recorded_at ?? ''));
}

export async function loadReplay(id, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const file = path.join(projectRoot, REPLAY_DIR_REL, `${id}.json`);
  const raw  = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

export async function annotateReplay(id, outcome, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const file = path.join(projectRoot, REPLAY_DIR_REL, `${id}.json`);
  const r = JSON.parse(await fs.readFile(file, 'utf8'));
  r.outcome = { ...(r.outcome ?? {}), ...outcome, annotated_at: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify(r, null, 2), 'utf8');
  return r;
}
