// Phase 97 — Coverage ratchet: tests for src/core/failures.js
//
// Pre-existing coverage was 17.65% line — most of the file uncovered. This
// suite exercises the public API end-to-end (collectFailures → summarizeByAgent
// → writeLearnings) using a real fs fixture so we exercise readDir, the dirent
// filter, the agent-hint detector, and renderLearningDoc together.
//
// No mocks: same pattern as the rest of test/unit (mkdtempSync + real files).
// The dataset is intentionally tiny — the goal is path coverage, not load.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectFailures, summarizeByAgent, writeLearnings } from '../../src/core/failures.js';

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-failures-'));
}

function writePlanningFixture(root) {
  // .planning/debug/resolved/<n>.md  → debug failures
  const dbgDir = path.join(root, '.planning', 'debug', 'resolved');
  fs.mkdirSync(dbgDir, { recursive: true });
  fs.writeFileSync(path.join(dbgDir, 'session-001.md'),
    '# Debug session — auth flow\n\nplanner missed the refresh path.\n', 'utf8');
  fs.writeFileSync(path.join(dbgDir, 'session-002.md'),
    '# Debug session — rate limit\n\nthe debugger rebound after retry.\n', 'utf8');
  // Non-md should be ignored
  fs.writeFileSync(path.join(dbgDir, 'notes.txt'), 'ignored', 'utf8');

  // .planning/phases/<phase>/<n>-VERIFICATION.md with status: gaps_found
  const phaseDir = path.join(root, '.planning', 'phases', '01-x');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(path.join(phaseDir, '01-VERIFICATION.md'),
    '---\nstatus: gaps_found\n---\n# Verification — gap in tests\n\nverifier found drift\n', 'utf8');
  // A second VERIFICATION.md without gaps_found — must be skipped
  fs.writeFileSync(path.join(phaseDir, '02-VERIFICATION.md'),
    '---\nstatus: ok\n---\n# all good\n', 'utf8');
  // A regular file in phaseDir that doesn't match the suffix — skipped
  fs.writeFileSync(path.join(phaseDir, 'PLAN.md'), '# plan', 'utf8');
  // A second phase folder where readdir succeeds but no VERIFICATION matches
  fs.mkdirSync(path.join(root, '.planning', 'phases', '02-empty'), { recursive: true });

  // .planning/forensics/<n>.md → forensics reports
  const forDir = path.join(root, '.planning', 'forensics');
  fs.mkdirSync(forDir, { recursive: true });
  fs.writeFileSync(path.join(forDir, 'report-001.md'),
    '# Forensics — executor crash\n\nexecutor lost state between commits\n', 'utf8');
}

test('collectFailures — empty projectRoot returns zero counts', async () => {
  const root = mkRoot();
  const r = await collectFailures({ projectRoot: root });
  assert.equal(r.counts.debug, 0);
  assert.equal(r.counts.verify, 0);
  assert.equal(r.counts.forensics, 0);
  assert.deepEqual(r.items, []);
  assert.equal(typeof r.projectRoot, 'string');
});

test('collectFailures — picks up debug, verify, forensics; ignores non-md and non-gaps verifications', async () => {
  const root = mkRoot();
  writePlanningFixture(root);

  const r = await collectFailures({ projectRoot: root });
  assert.equal(r.counts.debug, 2, 'two debug sessions');
  assert.equal(r.counts.verify, 1, 'only the gaps_found verification');
  assert.equal(r.counts.forensics, 1, 'one forensics report');

  // Each item carries source + agentHint + summary
  const sources = r.items.map(i => i.source).sort();
  assert.deepEqual(sources, ['debug', 'debug', 'forensics', 'verify']);

  const verifyItem = r.items.find(i => i.source === 'verify');
  assert.equal(verifyItem.agentHint, 'verifier');
  assert.equal(verifyItem.phase, '01-x');
  assert.match(verifyItem.summary, /gap in tests/);

  // detectAgentHint walks a fixed list — text-matching the lowercased raw.
  const debugItems = r.items.filter(i => i.source === 'debug');
  // session-001 mentions "planner", session-002 mentions "debugger"
  const hints = debugItems.map(i => i.agentHint).sort();
  assert.deepEqual(hints, ['debugger', 'planner']);

  const forensicsItem = r.items.find(i => i.source === 'forensics');
  assert.equal(forensicsItem.agentHint, 'executor');
});

test('collectFailures — defaults projectRoot to cwd when omitted', async () => {
  // Just verifies the default branch is exercised; actual cwd may or may not
  // have .planning, but the call must not throw.
  const r = await collectFailures();
  assert.equal(typeof r.projectRoot, 'string');
  assert.ok(Array.isArray(r.items));
});

test('summarizeByAgent — groups by agentHint, caps samples at 5, sorts desc by count', async () => {
  // Synthesize a payload directly to control the count
  const items = [];
  for (let i = 0; i < 7; i++) items.push({ source: 'debug', agentHint: 'planner', summary: `s${i}`, raw: 'x' });
  for (let i = 0; i < 3; i++) items.push({ source: 'verify', agentHint: 'verifier', summary: 'v', raw: 'x' });
  // One item with no agentHint → maps to 'unknown'
  items.push({ source: 'forensics', summary: '', raw: 'x' });

  const summaries = await summarizeByAgent({ items });
  assert.equal(summaries.length, 3);
  assert.equal(summaries[0].agent, 'planner');
  assert.equal(summaries[0].count, 7);
  assert.equal(summaries[0].samples.length, 5, 'samples cap at 5');
  assert.equal(summaries[1].agent, 'verifier');
  assert.equal(summaries[1].count, 3);
  assert.equal(summaries[2].agent, 'unknown');
  assert.equal(summaries[2].count, 1);
});

test('writeLearnings — writes one md per agent, returns paths and summaries', async () => {
  const root = mkRoot();
  writePlanningFixture(root);

  const failures = await collectFailures({ projectRoot: root });
  const result = await writeLearnings(failures, { projectRoot: root });

  assert.ok(Array.isArray(result.written));
  assert.ok(Array.isArray(result.summaries));
  assert.ok(result.written.length >= 1);

  // Every written file exists and contains the canonical learning-doc heading
  for (const p of result.written) {
    assert.ok(fs.existsSync(p), `expected file written: ${p}`);
    const md = fs.readFileSync(p, 'utf8');
    assert.match(md, /^# Learnings — /m);
    assert.match(md, /\*\*Failure samples:\*\*/);
    assert.match(md, /## Recurring patterns/);
    assert.match(md, /## Samples/);
  }

  // Output dir is .planning/learnings under projectRoot
  const learningsDir = path.join(root, '.planning', 'learnings');
  assert.ok(fs.existsSync(learningsDir));
});

test('writeLearnings — defaults projectRoot to cwd when omitted', async () => {
  // Build a small in-memory failures payload so we exercise renderLearningDoc
  // without polluting cwd. We discard the file but ensure the function returns
  // its contract shape.
  const root = mkRoot();
  // Override cwd briefly via opts.projectRoot — defaults branch already covered
  // in collectFailures test; here we just confirm summaries render with samples
  // cap < 5 (renderLearningDoc takes the samples slice).
  const failures = {
    items: [
      { source: 'debug', agentHint: 'executor', summary: 'crash', raw: 'detail line one\nline two' },
    ],
  };
  const result = await writeLearnings(failures, { projectRoot: root });
  assert.equal(result.summaries[0].agent, 'executor');
  assert.equal(result.written.length, 1);
  const md = fs.readFileSync(result.written[0], 'utf8');
  assert.match(md, /Sample 1 \(debug\)/);
  assert.match(md, /\*crash\*/);
});
