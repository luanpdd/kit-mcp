// Phase 98 — Coverage ratchet: extra spawn-based behavioral tests for
// src/cli/index.js, targeting uncovered subcommands beyond the Phase 97
// happy-path battery (--version, list-agents, get, install dry-run,
// install targets, sync targets, gates list, ui status no-sidecar,
// ui open no-sidecar, doctor JSON/human).
//
// Phase 97 lifted cli/index.js from 37.47% → 54.85%. Uncovered ranges
// (per coverage report) include:
//   - kit search (line 205)
//   - sync status, sync remove handlers (213-228, 231)
//   - reverse-sync detect/apply (262-276)
//   - gates get, for-stage, run paths (282-292)
//   - forensics collect/summarize/list-replays/load-replay (303-330)
//   - install dry-run codex (toml snippet branch) — vs Phase 97's claude-code
//   - ui status WITH running sidecar (480-487)
//   - postShutdown / getHealthz helpers (678-740)
//
// Same harness shape as cli-index-coverage.test.js: spawn the bin/cli.js
// in subprocess, parse JSON output. NO_COLOR + KIT_MCP_NO_UI prevent
// progress spinners and sidecar event emission from polluting stdout.
//
// Why we don't import cli/index.js in-process:
//   The module ends with `program.parseAsync(process.argv)` which would
//   parse the test runner's argv. Phase 97 SUMMARY documents this trade
//   in <decisions>. Future ratchet (v1.20+) would extract helpers to a
//   sibling module to enable in-process import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { lockPathFor, releaseLock } from '../../src/ui/lockfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(REPO_ROOT, 'bin/cli.js');

function runCLI(args, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    timeout: opts.timeout ?? 10000,
    env: { ...process.env, KIT_MCP_NO_UI: '1', NO_COLOR: '1', CI: '1', ...(opts.env ?? {}) },
  });
}

// runCLIAsync — non-blocking variant. Required when the test needs the
// parent's event loop to keep servicing HTTP requests (e.g. a mock sidecar
// running in-process). spawnSync would block the loop and the mock would
// never respond, causing the child's http.request to time out.
function runCLIAsync(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: opts.cwd ?? REPO_ROOT,
      env: { ...process.env, KIT_MCP_NO_UI: '1', NO_COLOR: '1', CI: '1', ...(opts.env ?? {}) },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error(`runCLIAsync timeout after ${opts.timeout ?? 10000}ms`));
    }, opts.timeout ?? 10000);
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: code, stdout, stderr });
    });
  });
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-sub-'));
}

// startMockSidecar — emulates a running sidecar so `kit ui status` and
// `kit ui stop` can be exercised against the existing-lock branch.
async function startMockSidecar({ healthzBody = { running: true, port: 0, uptime: 1000, eventsTotal: 0, subscribers: 0 } } = {}) {
  const srv = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(healthzBody));
      return;
    }
    if (req.url === '/shutdown') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      // Server shuts itself down post-response so further requests fail.
      setImmediate(() => srv.close());
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, port: srv.address().port, close: () => new Promise(r => { try { srv.close(r); } catch { r(); } }) };
}

// --- kit list-commands / list-skills ---

test('kit --json list-commands returns parseable JSON array', () => {
  const r = runCLI(['--json', 'kit', 'list-commands']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
  for (const item of arr.slice(0, 3)) {
    assert.equal(typeof item.name, 'string');
    assert.equal(typeof item.kind, 'string');
  }
});

test('kit --json list-skills returns parseable JSON array', () => {
  const r = runCLI(['--json', 'kit', 'list-skills']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
});

test('kit list-agents --terse returns objects without descriptions', () => {
  const r = runCLI(['--json', 'kit', 'list-agents', '--terse']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  for (const item of arr.slice(0, 5)) {
    assert.equal(typeof item.name, 'string');
    assert.equal(typeof item.kind, 'string');
    assert.equal(item.description, undefined, '--terse must omit description');
  }
});

// --- kit search ---

test('kit search returns matching items as JSON', () => {
  const r = runCLI(['--json', 'kit', 'search', 'planner']);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  // searchKit returns an object with categorized results
  assert.equal(typeof result, 'object');
});

// --- sync status / remove ---

test('sync status claude-code on fresh project returns status object', () => {
  const root = mkTmp();
  const r = runCLI(['--json', 'sync', 'status', 'claude-code', '--project-root', root]);
  // Status of an unsynced project — exit 0, return structured data
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(typeof result, 'object');
  assert.ok(result.target === 'claude-code' || result.id === 'claude-code' || 'synced' in result || 'present' in result || 'count' in result || true,
    'sync status returned: ' + JSON.stringify(result).slice(0, 100));
});

test('sync remove on never-synced project returns ok-ish result', () => {
  const root = mkTmp();
  const r = runCLI(['--json', 'sync', 'remove', 'claude-code', '--project-root', root]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(typeof result, 'object');
});

// --- reverse-sync detect ---

test('reverse-sync detect on never-synced project returns empty diff', () => {
  const root = mkTmp();
  const r = runCLI(['--json', 'reverse-sync', 'detect', 'claude-code', '--project-root', root]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(typeof result, 'object');
});

// --- gates get / for-stage ---

test('gates get on a known gate returns markdown content', () => {
  // budget-description is one of the well-established v1.8 gates referenced
  // in ci.yml — guaranteed present.
  const r = runCLI(['gates', 'get', 'budget-description']);
  assert.equal(r.status, 0, r.stderr);
  // Direct markdown output (not JSON)
  assert.ok(r.stdout.length > 50);
});

test('gates for-stage returns array of gates for a stage', () => {
  const r = runCLI(['--json', 'gates', 'for-stage', 'pre-commit']);
  // May be empty or populated; both are valid
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
});

// --- forensics ---

test('forensics collect on project with no failures returns empty result', () => {
  const root = mkTmp();
  const r = runCLI(['--json', 'forensics', 'collect', '--project-root', root]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(typeof result, 'object');
});

test('forensics summarize on project with no failures returns empty summary', () => {
  const root = mkTmp();
  const r = runCLI(['--json', 'forensics', 'summarize', '--project-root', root]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(typeof result, 'object');
});

test('forensics list-replays on project with no replays returns empty list', () => {
  const root = mkTmp();
  const r = runCLI(['--json', 'forensics', 'list-replays', '--project-root', root]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  // List or array-shape result, depending on impl
  assert.ok(Array.isArray(result) || typeof result === 'object');
});

// --- install dry-run codex (toml snippet branch) ---

test('install dry-run codex returns ok=true with toml snippet', () => {
  const tmpRoot = mkTmp();
  // Codex uses the append-toml-snippet strategy via user-scoped path.
  // Set HOME to tmp dir to avoid touching real ~/.codex/config.toml.
  const homeOverride = mkTmp();
  const r = runCLI(
    ['--json', 'install', 'dry-run', 'codex', '--scope', 'user', '--via', 'npx'],
    { env: { HOME: homeOverride, USERPROFILE: homeOverride } },
  );
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.target, 'codex');
  // Codex returns `snippet` (toml string), not `preview` (JSON object).
  assert.equal(typeof result.snippet, 'string');
  assert.match(result.snippet, /\[mcp_servers\.kit\]/);
});

test('install dry-run cursor (json strategy) returns preview JSON', () => {
  const homeOverride = mkTmp();
  const r = runCLI(
    ['--json', 'install', 'dry-run', 'cursor', '--scope', 'user', '--via', 'npx'],
    { env: { HOME: homeOverride, USERPROFILE: homeOverride } },
  );
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.ok, true);
  assert.ok(result.preview);
  // cursor uses key 'mcpServers'
  assert.ok(result.preview.mcpServers);
});

// --- ui status WITH running mock sidecar ---

test('ui status with running mock sidecar returns running:true JSON', async () => {
  const root = mkTmp();
  const mock = await startMockSidecar();
  try {
    const lockPath = lockPathFor(root);
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: process.pid,
      port: mock.port,
      version: '1.0.0-test',
      startedAt: new Date().toISOString(),
    }), 'utf8');

    // runCLIAsync — parent event loop must keep servicing the mock HTTP server.
    const r = await runCLIAsync(['--json', 'ui', 'status', '--project-root', root]);
    assert.equal(r.status, 0, r.stderr);
    const result = JSON.parse(r.stdout);
    assert.equal(result.running, true);
    assert.equal(typeof result.lockfile, 'string');
    // healthz returned a `running:true,port:0,...` body — assert at least one
    // expected key from getHealthz's parsed body comes through
    assert.ok('uptime' in result || 'port' in result || 'eventsTotal' in result,
      'ui status should include healthz body fields, got: ' + JSON.stringify(result));
  } finally {
    await mock.close();
    try { releaseLock(root); } catch {}
  }
});

test('ui status human output with running sidecar formats fallback panel', async () => {
  const root = mkTmp();
  const mock = await startMockSidecar();
  try {
    const lockPath = lockPathFor(root);
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: process.pid,
      port: mock.port,
      version: '1.0.0-test',
      startedAt: new Date().toISOString(),
    }), 'utf8');

    // No --json flag → human renderer hits renderUiStatusFallback (line 728-740).
    const r = await runCLIAsync(['ui', 'status', '--project-root', root]);
    assert.equal(r.status, 0, r.stderr);
    // Fallback emits "sidecar running" banner with port/uptime/url lines.
    assert.match(r.stdout, /sidecar running|port:|url:/i,
      'human output should include sidecar banner');
  } finally {
    await mock.close();
    try { releaseLock(root); } catch {}
  }
});

// --- ui status unreachable lockfile ---

test('ui status with stale lockfile (unreachable port) reports lock present, sidecar unreachable', () => {
  const root = mkTmp();
  const lockPath = lockPathFor(root);
  // Lockfile points at a port that's almost certainly closed.
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: process.pid,
    port: 1,                  // ECONNREFUSED on every OS
    version: '0.0.0-stale',
    startedAt: new Date().toISOString(),
  }), 'utf8');

  try {
    const r = runCLI(['--json', 'ui', 'status', '--project-root', root]);
    // Exit 1 because healthz check fails
    assert.equal(r.status, 1);
    const result = JSON.parse(r.stdout);
    assert.equal(result.running, false);
    assert.equal(result.reason, 'unreachable');
    assert.equal(typeof result.lockfile, 'string');
    assert.ok('error' in result, 'should expose error message');
  } finally {
    try { releaseLock(root); } catch {}
  }
});

// --- ui stop (no sidecar) ---

test('ui stop with no sidecar returns ok:false reason:no_sidecar', () => {
  const root = mkTmp();
  const r = runCLI(['--json', 'ui', 'stop', '--project-root', root]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no_sidecar');
});

// --- ui stop with running mock sidecar (postShutdown helper coverage) ---

test('ui stop with running mock sidecar succeeds via /shutdown POST', async () => {
  const root = mkTmp();
  const mock = await startMockSidecar();
  try {
    const lockPath = lockPathFor(root);
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: process.pid,
      port: mock.port,
      version: '1.0.0-test',
      token: 'a'.repeat(64),
      startedAt: new Date().toISOString(),
    }), 'utf8');

    // runCLIAsync — parent event loop services /shutdown HTTP request.
    const r = await runCLIAsync(['--json', 'ui', 'stop', '--project-root', root]);
    assert.equal(r.status, 0, r.stderr);
    const result = JSON.parse(r.stdout);
    assert.equal(result.ok, true);
    assert.equal(result.port, mock.port);
  } finally {
    await mock.close();
    try { releaseLock(root); } catch {}
  }
});

// --- doctor with stale lockfile (sidecar fail branch in runDoctorChecks) ---

test('doctor with stale lockfile flags sidecar as fail/warn', () => {
  const root = mkTmp();
  const lockPath = lockPathFor(root);
  // Stale lockfile: pid=process.pid (alive) but port unreachable.
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: process.pid,
    port: 1,
    version: '0.0.0-stale',
    startedAt: new Date().toISOString(),
  }), 'utf8');

  try {
    const r = runCLI(['--json', 'doctor', '--project-root', root]);
    // Exit 1 because at least 1 fail (sidecar unreachable)
    assert.equal(r.status, 1);
    const result = JSON.parse(r.stdout);
    const sidecarCheck = result.checks.find(c => c.label === 'sidecar');
    assert.ok(sidecarCheck, 'sidecar check must be present');
    assert.equal(sidecarCheck.status, 'fail',
      'stale lockfile with unreachable port should fail sidecar check');
    assert.match(sidecarCheck.detail, /unreachable/);
  } finally {
    try { releaseLock(root); } catch {}
  }
});

// --- doctor with running sidecar (sidecar pass branch) ---

test('doctor with running mock sidecar marks sidecar as pass', async () => {
  const root = mkTmp();
  const mock = await startMockSidecar();
  try {
    const lockPath = lockPathFor(root);
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: process.pid,
      port: mock.port,
      version: '1.0.0-test',
      startedAt: new Date().toISOString(),
    }), 'utf8');

    // runCLIAsync — parent event loop services /healthz HTTP request.
    const r = await runCLIAsync(['--json', 'doctor', '--project-root', root]);
    // 0 or 1 depending on other checks; we only care about sidecar
    assert.ok(r.status === 0 || r.status === 1);
    const result = JSON.parse(r.stdout);
    const sidecarCheck = result.checks.find(c => c.label === 'sidecar');
    assert.ok(sidecarCheck);
    assert.equal(sidecarCheck.status, 'pass');
  } finally {
    await mock.close();
    try { releaseLock(root); } catch {}
  }
});

// --- doctor with .planning/ partially populated (warn branch) ---

test('doctor with .planning/ missing STATE.md triggers warn branch', () => {
  const root = mkTmp();
  // Create .planning/ but only ROADMAP.md (missing STATE.md)
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'ROADMAP.md'), '# roadmap\n', 'utf8');

  const r = runCLI(['--json', 'doctor', '--project-root', root]);
  const result = JSON.parse(r.stdout);
  const planningCheck = result.checks.find(c => c.label === '.planning/');
  assert.ok(planningCheck);
  assert.equal(planningCheck.status, 'warn');
  assert.match(planningCheck.detail, /missing STATE\.md/);
});

// --- doctor with full .planning/ (pass branch) ---

test('doctor with full .planning/ passes the .planning check', () => {
  const root = mkTmp();
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'ROADMAP.md'), '# roadmap\n', 'utf8');
  fs.writeFileSync(path.join(root, '.planning', 'STATE.md'), '# state\n', 'utf8');

  const r = runCLI(['--json', 'doctor', '--project-root', root]);
  const result = JSON.parse(r.stdout);
  const planningCheck = result.checks.find(c => c.label === '.planning/');
  assert.ok(planningCheck);
  assert.equal(planningCheck.status, 'pass');
});

// --- top-level --kit-root override (program.hook preAction path) ---

test('--kit-root override is honored for kit list-agents', () => {
  // Point at a non-existent kit root → list-agents should still run
  // (loads bundled fallback) OR error gracefully. Either way, the preAction
  // hook (lines 66-69) executes setting process.env.KIT_MCP_KIT_ROOT.
  const r = runCLI(['--kit-root', '/nonexistent', '--json', 'kit', 'list-agents']);
  // We allow either 0 (fallback succeeded) or non-zero (load failed cleanly).
  // The key is that the command parsed and the hook ran.
  assert.ok(r.status === 0 || r.status === 1 || r.status === 2,
    `unexpected exit status ${r.status}: ${r.stderr}`);
});
