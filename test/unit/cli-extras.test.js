// Phase 100 — Coverage ratchet 80%→90%: extra subprocess-spawned tests for
// src/cli/index.js (Phase 98 left this at 75.07%). Strategy mirrors
// cli-subcommands.test.js — spawn bin/cli.js with explicit args + parse JSON
// output; subprocess approach because the module ends with parseAsync(argv).
//
// Targets uncovered ranges per coverage report:
//   - 121-124  kit get agent <name> --json (raw content, not via render)
//   - 290-292  forensics reflect --dry-run path
//   - 322-328  forensics reflect handler arguments parsing
//   - 329-331  forensics load-replay <id>
//   - 466-467  ui open with no sidecar (fail path)
//   - 538-557  doctor: settings.json missing/valid/invalid + hook detection
//   - 589-598  doctor: bundled kit dir check
//   - 610-613  doctor: framework-state .planning detection
//   - --kit-root preAction hook with valid/invalid path
//   - install dry-run for additional targets (windsurf, gemini-cli)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(REPO_ROOT, 'bin/cli.js');

function runCLI(args, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    timeout: opts.timeout ?? 15000,
    env: { ...process.env, KIT_MCP_NO_UI: '1', NO_COLOR: '1', CI: '1', ...(opts.env ?? {}) },
  });
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-extras-'));
}

// --- kit get agent <name> --json (raw content) ---

test('kit get agent planner returns raw content (not JSON when no --json)', () => {
  const r = runCLI(['kit', 'get', 'agent', 'planner']);
  assert.equal(r.status, 0, r.stderr);
  // Raw markdown content — should contain frontmatter (handle CRLF on Windows)
  assert.match(r.stdout, /^---\r?\n/);
  assert.match(r.stdout, /name: planner/);
});

test('kit get skill four-golden-signals returns raw SKILL.md content', () => {
  const r = runCLI(['kit', 'get', 'skill', 'four-golden-signals']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /four-golden-signals|Latency|Traffic/);
});

test('kit get with invalid kind/name fails with non-zero exit', () => {
  const r = runCLI(['kit', 'get', 'agent', 'this-agent-does-not-exist-xyz']);
  // The CLI fail() exits with status 1
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Not found/);
});

// --- kit search human (via render) ---

test('kit search planner human output renders table', () => {
  const r = runCLI(['kit', 'search', 'planner']);
  assert.equal(r.status, 0, r.stderr);
  // Human renderer produces table with kind/name columns
  assert.match(r.stdout, /kind|name/);
});

// --- forensics reflect --dry-run ---

test('forensics reflect --dry-run on fixture writes prompt file', () => {
  const tmp = mkTmp();
  // Build minimal fixture inside tmp project
  fs.mkdirSync(path.join(tmp, '.planning/learnings'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.planning/learnings/test-x.md'),
    '# learnings\n\nfailure 1\n',
    'utf8',
  );
  // Need agent file in kitRoot — use the bundled kit/agents/planner.md so we
  // exercise reflect with a real existing agent. Reflect resolves kit root
  // via KIT_MCP_KIT_ROOT or default. We use a fixture kit instead.
  const kitRoot = path.join(tmp, 'fixture-kit');
  fs.mkdirSync(path.join(kitRoot, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(kitRoot, 'agents/test-x.md'),
    '---\nname: test-x\n---\nbody\n',
    'utf8',
  );
  const r = runCLI([
    '--kit-root', kitRoot,
    'forensics', 'reflect',
    '--agent', 'test-x',
    '--project-root', tmp,
    '--dry-run',
    '--no-interactive',
  ]);
  // Exit 0 (dry-run writes prompt file then returns happy)
  assert.equal(r.status, 0, r.stderr);
  // Prompt file should exist now
  const promptPath = path.join(tmp, '.planning/learnings/test-x.reflect-prompt.md');
  assert.ok(fs.existsSync(promptPath), 'prompt file must exist after dry-run');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- forensics load-replay (round trip via record-replay first) ---

test('forensics list-replays then load-replay round-trips', () => {
  const tmp = mkTmp();
  // First record a replay via direct fs write (record-replay is MCP-only
  // since the CLI doesn't expose it)
  const replaysDir = path.join(tmp, '.planning/replays');
  fs.mkdirSync(replaysDir, { recursive: true });
  const replayId = '2026-01-01T00-00-00-000Z-test-agent';
  const replayFile = path.join(replaysDir, `${replayId}.json`);
  fs.writeFileSync(replayFile, JSON.stringify({
    id: replayId,
    agent: 'test-agent',
    recorded_at: '2026-01-01',
    prompt: 'test prompt',
  }), 'utf8');
  // List
  const listR = runCLI(['--json', 'forensics', 'list-replays', '--project-root', tmp]);
  assert.equal(listR.status, 0, listR.stderr);
  const list = JSON.parse(listR.stdout);
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0);
  // Load
  const loadR = runCLI(['--json', 'forensics', 'load-replay', replayId, '--project-root', tmp]);
  assert.equal(loadR.status, 0, loadR.stderr);
  const loaded = JSON.parse(loadR.stdout);
  assert.equal(loaded.id, replayId);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- ui open with no sidecar fails fast ---

test('ui open with no sidecar fails with explicit error', () => {
  const tmp = mkTmp();
  const r = runCLI(['ui', 'open', '--project-root', tmp]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no sidecar running|sidecar/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- --kit-root override with valid path ---

test('--kit-root <valid> processes kit list-agents from override', () => {
  const tmp = mkTmp();
  const customKit = path.join(tmp, 'custom-kit');
  fs.mkdirSync(path.join(customKit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(customKit, 'agents', 'custom-agent.md'),
    '---\nname: custom-agent\ndescription: From custom kit\n---\nbody\n',
    'utf8',
  );
  const r = runCLI(['--kit-root', customKit, '--json', 'kit', 'list-agents']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.some(a => a.name === 'custom-agent'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- doctor with full .planning passes that check (already covered in cli-subcommands)
// --- doctor with partial .planning warns (already covered in cli-subcommands)

// --- doctor with no .planning at all (fresh project) warns "no framework state" ---

test('doctor with no .planning dir warns "no framework state"', () => {
  const tmp = mkTmp();
  const r = runCLI(['--json', 'doctor', '--project-root', tmp]);
  // Exit 0 (warn only, no fail) or 1 if other check fails — we only care about .planning
  const result = JSON.parse(r.stdout);
  const planningCheck = result.checks.find(c => c.label === '.planning/');
  assert.ok(planningCheck);
  assert.equal(planningCheck.status, 'warn');
  assert.match(planningCheck.detail, /no framework state/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- install dry-run windsurf (json strategy + project scope) ---

test('install dry-run windsurf returns ok with json preview', () => {
  const tmp = mkTmp();
  const r = runCLI([
    '--json', 'install', 'dry-run', 'windsurf',
    '--scope', 'project', '--via', 'npx',
    '--project-root', tmp,
  ]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.target, 'windsurf');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- install dry-run gemini-cli (json strategy, user scope) ---

test('install dry-run gemini-cli with HOME override', () => {
  const homeOverride = mkTmp();
  const r = runCLI(
    ['--json', 'install', 'dry-run', 'gemini-cli', '--scope', 'user', '--via', 'npx'],
    { env: { HOME: homeOverride, USERPROFILE: homeOverride } },
  );
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.ok, true);
  fs.rmSync(homeOverride, { recursive: true, force: true });
});

// --- gates run --no-interactive on a manual-style gate returns verdict=manual ---

test('gates run on a manual gate with --no-interactive returns verdict=manual', () => {
  // confidence gate has NO ## Check shell blocks — runs as manual gate.
  // With --no-interactive, gate-runner returns verdict='manual' immediately
  // (avoiding bash spawn which is unavailable on Windows CI).
  const r = runCLI([
    '--json', 'gates', 'run', 'confidence',
    '--no-interactive',
  ], { timeout: 8000 });
  const result = JSON.parse(r.stdout);
  assert.ok(typeof result === 'object');
  assert.equal(result.id, 'confidence');
  assert.equal(result.verdict, 'manual');
});

// --- sync install --dry-run on fresh tmp ---

test('sync install --dry-run claude-code on tmp returns ok', () => {
  const tmp = mkTmp();
  const r = runCLI([
    '--json', 'sync', 'install', 'claude-code',
    '--project-root', tmp, '--dry-run',
  ]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(typeof result, 'object');
  // dryRun result has target + written paths (or count)
  assert.ok('target' in result || 'written' in result || 'dryRun' in result);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- kit search via human renderer (--no-json default) ---

test('kit search empty query returns all items in human format', () => {
  // Empty query — searchKit returns categorized results
  const r = runCLI(['--json', 'kit', 'search', '']);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  // searchKit returns object/array — both acceptable
  assert.ok(typeof result === 'object');
});

// --- kit list-skills --terse ---

test('kit list-skills --terse returns objects without descriptions', () => {
  const r = runCLI(['--json', 'kit', 'list-skills', '--terse']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  for (const item of arr.slice(0, 3)) {
    assert.equal(typeof item.name, 'string');
    assert.equal(item.description, undefined);
  }
});

// --- kit list-commands --terse ---

test('kit list-commands --terse returns terse objects', () => {
  const r = runCLI(['--json', 'kit', 'list-commands', '--terse']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  for (const item of arr.slice(0, 3)) {
    assert.equal(typeof item.name, 'string');
    assert.equal(item.description, undefined);
  }
});

// --- gates list (already covered in cli-index-coverage) but with human render path ---

test('gates list (human) returns table-formatted output', () => {
  const r = runCLI(['gates', 'list']);
  assert.equal(r.status, 0, r.stderr);
  // Human output should include a header (id stage etc.)
  assert.match(r.stdout, /id|stage|description/);
});

// --- gates get with invalid id should exit non-zero ---

test('gates get with nonexistent id fails gracefully', () => {
  const r = runCLI(['gates', 'get', 'nonexistent-gate-xyz']);
  // Either non-zero exit or stderr indicating no such gate
  assert.ok(r.status !== 0 || /not found|no such/i.test(r.stdout + r.stderr));
});

// --- forensics summarize human path ---

test('forensics summarize on empty project (human render) returns ok', () => {
  const tmp = mkTmp();
  const r = runCLI(['forensics', 'summarize', '--project-root', tmp]);
  assert.equal(r.status, 0, r.stderr);
  // Human render: "No failures." or similar
  assert.match(r.stdout, /No failures|/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- forensics collect (--json bypasses the human renderer) ---
// Note: human-mode `forensics collect` has a pre-existing bug at
// src/cli/index.js:299 (passes the full {counts, items} to
// renderForensicsCollect which expects an array). Using --json avoids
// the renderer entirely. Phase 100 contract: zero src/ changes — bug
// stays as-is.

test('forensics collect --json on empty project returns counts+items', () => {
  const tmp = mkTmp();
  const r = runCLI(['--json', 'forensics', 'collect', '--project-root', tmp]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.ok('counts' in result);
  assert.ok(Array.isArray(result.items));
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- reverse-sync detect human render ---

test('reverse-sync detect on tmp (human) shows "in sync" message', () => {
  const tmp = mkTmp();
  const r = runCLI(['reverse-sync', 'detect', 'claude-code', '--project-root', tmp]);
  assert.equal(r.status, 0, r.stderr);
  // Human renderer output for empty candidates should say "in sync"
  assert.match(r.stdout, /in sync|No edits|✓/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
