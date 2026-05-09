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
import { redactSecrets } from './error-redaction.js';

const REPLAY_DIR_REL = path.join('.planning', 'replays');

// SEC-13-02: replayId path traversal guard. The MCP forensics tool exposes
// load-replay/annotate-replay/record-replay actions; without sanitization,
// a malicious replayId like '../../../etc/passwd' would read/write files
// outside .planning/replays/.
//
// Strategy: allowlist regex (no slashes, no '..', no NUL) + post-resolve assertion
// that the final path stays inside REPLAY_DIR_REL.
const REPLAY_ID_RE = /^[A-Za-z0-9_.-]+$/;

function validateReplayId(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('invalid replay id: must be a non-empty string');
  }
  if (id === '.' || id === '..' || id.includes('..')) {
    throw new Error('invalid replay id: traversal sequences not allowed');
  }
  if (!REPLAY_ID_RE.test(id)) {
    throw new Error(`invalid replay id: only [A-Za-z0-9_.-] allowed, got ${JSON.stringify(id)}`);
  }
  return id;
}

function assertPathInside(filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  // Ensure resolved is base or a child of base (handle trailing-sep edge case).
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('invalid replay id: resolved path escapes replay directory');
  }
  return resolved;
}

export async function recordReplay(payload, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const dir = path.join(projectRoot, REPLAY_DIR_REL);
  await fs.mkdir(dir, { recursive: true });

  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  // SEC-13-02: validate each slug component independently before concat
  const slugParts = [payload.phase, payload.plan, payload.agent].filter(Boolean);
  for (const part of slugParts) {
    validateReplayId(String(part));
  }
  const slug = slugParts.join('-') || 'unknown';
  const id   = `${ts}-${slug}`;
  // Re-validate the full id (defense in depth — ts is well-formed but cheap to check)
  validateReplayId(id);
  const file = path.join(dir, `${id}.json`);
  assertPathInside(file, dir);

  const record = { id, recorded_at: new Date().toISOString(), ...payload };
  // SEC-14-06: scrub the serialized form before writing. We redact AFTER
  // JSON.stringify (rather than deep-mapping the payload tree) so the regex
  // walks the entire structure including nested args/headers/env, and so
  // the in-memory `record` returned to the caller stays unmutated. Only the
  // on-disk artifact is scrubbed; readers of the file via loadReplay see
  // the redacted form, which is the desired outcome — secrets must not be
  // re-loaded into memory either.
  const json = redactSecrets(JSON.stringify(record, null, 2));
  await fs.writeFile(file, json, 'utf8');
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
  validateReplayId(id);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const dir = path.join(projectRoot, REPLAY_DIR_REL);
  const file = path.join(dir, `${id}.json`);
  assertPathInside(file, dir);
  const raw  = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

export async function annotateReplay(id, outcome, opts = {}) {
  validateReplayId(id);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const dir = path.join(projectRoot, REPLAY_DIR_REL);
  const file = path.join(dir, `${id}.json`);
  assertPathInside(file, dir);
  const r = JSON.parse(await fs.readFile(file, 'utf8'));
  r.outcome = { ...(r.outcome ?? {}), ...outcome, annotated_at: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify(r, null, 2), 'utf8');
  return r;
}
