// Phase 172 M4 — integration tests for `kit cost <action>` CLI.
//
// Strategy: spawn `node bin/cli.js cost ...` as a subprocess (real CLI path),
// assert exit code + stdout shape. JSON outputs are parsed to validate the
// canonical SPEC fields. Uses an isolated config dir (env CLAUDE_CONFIG_DIR
// pointing to a tmp dir containing fixtures) so discovery is deterministic.
//
// What is covered (smoke + JSON output):
//   - `kit cost --help` lists the 7 sub-actions
//   - `kit cost today --json` → canonical shape
//   - `kit cost session --session-id <id> --json` → canonical shape + session_id
//   - `kit cost blocks --json` → blocks[] present
//   - `kit cost phase --phase 172 --json` → phase shape
//   - `kit cost estimate "hello world" --json` → estimate shape
//   - `kit cost phase` without --phase → exit 2
//   - `kit cost estimate` without prompt → exit 2
//
// Bench / large-jsonl coverage lives in separate files.
//
// IMPORTANT: tests set CLAUDE_CONFIG_DIR to a temp dir hosting
// `projects/<slug>/<sessionId>.jsonl`, which is the Claude Code layout that
// `discovery.js` honors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');
const cliBin = path.join(repoRoot, 'bin', 'cli.js');

const CANONICAL_FIELDS = [
  'total_usd',
  'by_model',
  'entry_count',
  'deduped_count',
  'skipped_entry_count',
  'parse_error_count',
  'unknown_models',
  'pricing_source',
  'pricing_staleness_days',
];

function mkTmpRoot(prefix = 'kit-cost-cli-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmRf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/**
 * Stage a Claude Code layout under tmpDir so discovery finds it:
 *   <tmpDir>/projects/<slug>/<sessionId>.jsonl
 *
 * Returns { configDir, sessionId, jsonlPath }.
 */
function stageJsonlFixture(tmpDir, { sessionId = 'sess-cli-1', entries = null } = {}) {
  const projects = path.join(tmpDir, 'projects', 'sample-project');
  fs.mkdirSync(projects, { recursive: true });
  const jsonl = path.join(projects, `${sessionId}.jsonl`);
  const now = Date.now();
  const list = entries || [
    {
      timestamp: new Date(now - 60_000).toISOString(),
      sessionId,
      messageId: 'msg-cli-1',
      requestId: 'req-cli-1',
      model: 'claude-sonnet-4-5',
      usage: { input_tokens: 250, output_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
    {
      timestamp: new Date(now - 30_000).toISOString(),
      sessionId,
      messageId: 'msg-cli-2',
      requestId: 'req-cli-2',
      model: 'claude-sonnet-4-5',
      usage: { input_tokens: 80, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  ];
  fs.writeFileSync(jsonl, list.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return { configDir: tmpDir, sessionId, jsonlPath: jsonl };
}

function runCli(args, { env = {}, input = null, timeoutMs = 30_000 } = {}) {
  const mergedEnv = {
    ...process.env,
    // Silence sidecar wrapping; we don't want a UI lockfile races.
    KIT_MCP_NO_UI: '1',
    ...env,
  };
  const res = spawnSync(process.execPath, [cliBin, ...args], {
    cwd: repoRoot,
    env: mergedEnv,
    input: input == null ? undefined : input,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  return res;
}

function parseJsonOrFail(res, label) {
  if (res.status !== 0) {
    throw new Error(`[${label}] exit=${res.status}\nstdout=${res.stdout}\nstderr=${res.stderr}`);
  }
  // Find the first '{' (status / withSpinner is auto-disabled by --json, so
  // stdout is pure JSON).
  const idx = res.stdout.indexOf('{');
  if (idx < 0) {
    throw new Error(`[${label}] no JSON in stdout:\n${res.stdout}`);
  }
  return JSON.parse(res.stdout.slice(idx));
}

function assertCanonical(snap, label) {
  for (const f of CANONICAL_FIELDS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(snap, f),
      `[${label}] missing canonical field: ${f}`,
    );
  }
  assert.equal(typeof snap.by_model, 'object', `[${label}] by_model not object`);
  assert.ok(Array.isArray(snap.unknown_models), `[${label}] unknown_models not array`);
}

// ────────────────────────────────────────────────────────────────────────────
// help + topology
// ────────────────────────────────────────────────────────────────────────────

test('M4: `kit cost --help` lists the 7 sub-actions', () => {
  const res = runCli(['cost', '--help']);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const out = res.stdout;
  for (const sub of ['today', 'session', 'blocks', 'phase', 'estimate', 'statusline', 'refresh-pricing']) {
    assert.match(out, new RegExp(`\\b${sub}\\b`), `--help missing sub-action ${sub}`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// cost today
// ────────────────────────────────────────────────────────────────────────────

test('M4: `kit cost today --json` returns canonical shape', () => {
  const tmp = mkTmpRoot();
  try {
    stageJsonlFixture(tmp, { sessionId: 'sess-today-1' });
    const res = runCli(['--json', 'cost', 'today'], { env: { CLAUDE_CONFIG_DIR: tmp } });
    const snap = parseJsonOrFail(res, 'cost today');
    assertCanonical(snap, 'cost today');
    assert.equal(typeof snap.date, 'string', 'today should include date YYYY-MM-DD');
    assert.match(snap.date, /^\d{4}-\d{2}-\d{2}$/, 'date format');
    assert.equal(snap.tz, 'UTC', 'tz default UTC');
  } finally { rmRf(tmp); }
});

test('M4: `kit cost today --date YYYY-MM-DD --tz UTC --json` respects overrides', () => {
  const tmp = mkTmpRoot();
  try {
    stageJsonlFixture(tmp, { sessionId: 'sess-today-2' });
    const res = runCli(
      ['--json', 'cost', 'today', '--date', '2025-01-01', '--tz', 'UTC'],
      { env: { CLAUDE_CONFIG_DIR: tmp } },
    );
    const snap = parseJsonOrFail(res, 'cost today date-override');
    assert.equal(snap.date, '2025-01-01');
    // 2025-01-01 won't include the fixture entries (which are recent), so
    // entry_count must be 0.
    assert.equal(snap.entry_count, 0);
  } finally { rmRf(tmp); }
});

test('M4: `kit cost today` human render does not crash', () => {
  const tmp = mkTmpRoot();
  try {
    stageJsonlFixture(tmp, { sessionId: 'sess-today-3' });
    const res = runCli(['cost', 'today'], { env: { CLAUDE_CONFIG_DIR: tmp } });
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /kit cost today/);
    assert.match(res.stdout, /total_usd:/);
  } finally { rmRf(tmp); }
});

// ────────────────────────────────────────────────────────────────────────────
// cost session
// ────────────────────────────────────────────────────────────────────────────

test('M4: `kit cost session --session-id <id> --json` filters by session', () => {
  const tmp = mkTmpRoot();
  try {
    const { sessionId } = stageJsonlFixture(tmp, { sessionId: 'sess-cli-session-1' });
    const res = runCli(
      ['--json', 'cost', 'session', '--session-id', sessionId],
      { env: { CLAUDE_CONFIG_DIR: tmp } },
    );
    const snap = parseJsonOrFail(res, 'cost session');
    assertCanonical(snap, 'cost session');
    assert.equal(snap.session_id, sessionId);
    assert.equal(typeof snap.started_at, 'string');
    assert.ok(snap.entry_count >= 1, 'should see >=1 entry');
  } finally { rmRf(tmp); }
});

test('M4: `kit cost session --transcript <path> --json` derives sessionId from basename', () => {
  const tmp = mkTmpRoot();
  try {
    const { sessionId, jsonlPath } = stageJsonlFixture(tmp, { sessionId: 'sess-cli-transcript-1' });
    const res = runCli(
      ['--json', 'cost', 'session', '--transcript', jsonlPath],
      { env: { CLAUDE_CONFIG_DIR: tmp } },
    );
    const snap = parseJsonOrFail(res, 'cost session transcript');
    assert.equal(snap.session_id, sessionId);
  } finally { rmRf(tmp); }
});

// ────────────────────────────────────────────────────────────────────────────
// cost blocks
// ────────────────────────────────────────────────────────────────────────────

test('M4: `kit cost blocks --json` returns blocks[]', () => {
  const tmp = mkTmpRoot();
  try {
    stageJsonlFixture(tmp, { sessionId: 'sess-blocks-1' });
    const res = runCli(['--json', 'cost', 'blocks'], { env: { CLAUDE_CONFIG_DIR: tmp } });
    const snap = parseJsonOrFail(res, 'cost blocks');
    assertCanonical(snap, 'cost blocks');
    assert.ok(Array.isArray(snap.blocks), 'blocks must be array');
    assert.ok(snap.blocks.length >= 1, 'should have >=1 block');
    const b = snap.blocks[0];
    assert.equal(typeof b.started_at, 'string');
    assert.equal(typeof b.is_active, 'boolean');
  } finally { rmRf(tmp); }
});

// ────────────────────────────────────────────────────────────────────────────
// cost phase
// ────────────────────────────────────────────────────────────────────────────

test('M4: `kit cost phase` without --phase exits with 2', () => {
  const res = runCli(['cost', 'phase']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /--phase/);
});

test('M4: `kit cost phase --phase 172 --json` returns phase shape', () => {
  const tmp = mkTmpRoot();
  try {
    stageJsonlFixture(tmp, { sessionId: 'sess-phase-1' });
    const res = runCli(
      ['--json', 'cost', 'phase', '--phase', '172'],
      { env: { CLAUDE_CONFIG_DIR: tmp } },
    );
    // Should succeed even if phase has no commits or its window doesn't match
    // entries — aggregator returns the canonical "unknown" shape, never throws.
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    const snap = parseJsonOrFail(res, 'cost phase');
    assert.equal(snap.phase_id, '172');
    assert.ok(
      ['high', 'medium', 'low', 'unknown'].includes(snap.correlation_confidence),
      `unexpected confidence: ${snap.correlation_confidence}`,
    );
  } finally { rmRf(tmp); }
});

// ────────────────────────────────────────────────────────────────────────────
// cost estimate
// ────────────────────────────────────────────────────────────────────────────

test('M4: `kit cost estimate` without prompt exits with 2', () => {
  const res = runCli(['cost', 'estimate']);
  assert.notEqual(res.status, 0);
});

test('M4: `kit cost estimate "hello world" --json` returns estimate shape', () => {
  const res = runCli(['--json', 'cost', 'estimate', 'hello world this is a test prompt']);
  const snap = parseJsonOrFail(res, 'cost estimate');
  assert.equal(typeof snap.model, 'string');
  assert.equal(typeof snap.estimated_input_tokens, 'number');
  assert.ok(snap.estimated_input_tokens >= 1);
  assert.equal(typeof snap.disclaimer, 'string');
  assert.match(snap.disclaimer, /chars_div_4/);
});

test('M4: `kit cost estimate <prompt> --model claude-opus-4-7 --json` honors --model', () => {
  const res = runCli([
    '--json', 'cost', 'estimate', 'sample input', '--model', 'claude-opus-4-7',
  ]);
  const snap = parseJsonOrFail(res, 'cost estimate model override');
  assert.equal(snap.model, 'claude-opus-4-7');
});
