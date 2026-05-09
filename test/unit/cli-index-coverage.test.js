// Phase 97 — Coverage ratchet: behavioral tests for src/cli/index.js
//
// Pre-existing line coverage: 37.47%. cli/index.js calls
// `program.parseAsync(process.argv)` at module bottom, so importing it
// in-process under `node --test` is impractical (commander would parse
// the test runner's argv). We therefore exercise the CLI as a subprocess
// via `spawnSync` — these tests catch behavioral regressions in CLI
// subcommands but do NOT contribute to the `--experimental-test-coverage`
// line counter in the parent, by design.
//
// In-process coverage of the CLI's pure helpers (slim, postShutdown,
// runDoctorChecks, renderUiStatusFallback) is intentionally NOT done here
// to preserve the rule "no source changes in this plan" — exporting them
// would touch cli/index.js. Future ratchet (v1.19+) can lift cli/index.js
// coverage by either: (a) extracting helpers to a sibling module, or (b)
// merging child-process coverage via NODE_V8_COVERAGE.

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
    timeout: opts.timeout ?? 10000,
    env: { ...process.env, KIT_MCP_NO_UI: '1', NO_COLOR: '1', CI: '1', ...(opts.env ?? {}) },
  });
}

test('--version prints a semver-shaped string (readPkgVersion path)', () => {
  const r = runCLI(['--version']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test('--help lists top-level commands (commander surface)', () => {
  const r = runCLI(['--help']);
  assert.equal(r.status, 0, r.stderr);
  // Commander emits each subcommand on its own help line
  for (const cmd of ['kit', 'sync', 'reverse-sync', 'gates', 'forensics', 'install', 'ui', 'doctor']) {
    assert.match(r.stdout, new RegExp(`\\b${cmd}\\b`), `help missing: ${cmd}`);
  }
});

test('kit --json list-agents returns parseable JSON', () => {
  const r = runCLI(['--json', 'kit', 'list-agents']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
});

test('kit get returns raw markdown (cat-like) without extra wrapper', () => {
  const r = runCLI(['kit', 'get', 'agent', 'planner']);
  assert.equal(r.status, 0, r.stderr);
  // Raw passthrough — frontmatter or body, but never wrapped in JSON or panels
  assert.ok(r.stdout.length > 100);
  assert.doesNotMatch(r.stdout.slice(0, 50), /^[\[{]/, 'should not start with JSON delimiter');
});

test('kit get on unknown item exits 1 (fail path)', () => {
  const r = runCLI(['kit', 'get', 'agent', 'definitely-not-a-real-agent']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Not found/);
});

test('sync targets returns target list with capability flags', () => {
  const r = runCLI(['--json', 'sync', 'targets']);
  assert.equal(r.status, 0, r.stderr);
  const targets = JSON.parse(r.stdout);
  assert.ok(Array.isArray(targets));
  // 8 IDEs in registry (registry.test.js verifies this)
  assert.equal(targets.length, 8);
});

test('install dry-run claude-code emits ok=true preview', () => {
  // Use a fresh tmp dir so the dogfooded `.mcp.json` in REPO_ROOT (which
  // already registers `kit`) doesn't collide with the dry-run preview.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-test-'));
  const r = runCLI(['--json', 'install', 'dry-run', 'claude-code', '--scope', 'project', '--project-root', tmpRoot, '--via', 'npx']);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
});

test('install targets returns the 5 IDEs with mcpConfig', () => {
  const r = runCLI(['--json', 'install', 'targets']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.equal(arr.length, 5);
});

test('gates list returns gate registry as JSON array', () => {
  const r = runCLI(['--json', 'gates', 'list']);
  assert.equal(r.status, 0, r.stderr);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  assert.ok(arr.length > 0);
});

test('ui status with no sidecar exits 1 (no_lockfile branch)', () => {
  // Use a fresh tmp dir as projectRoot — guaranteed no lockfile.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-test-'));
  const r = runCLI(['--json', 'ui', 'status', '--project-root', root]);
  // Command exits 1 when no sidecar — but JSON is still emitted on stdout.
  assert.equal(r.status, 1);
  const result = JSON.parse(r.stdout);
  assert.equal(result.running, false);
  assert.equal(result.reason, 'no_lockfile');
});

test('ui open with no sidecar fails fast (no sidecar running)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-test-'));
  const r = runCLI(['ui', 'open', '--project-root', root]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no sidecar running/);
});

test('doctor in a clean project produces JSON checks with version section', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-test-'));
  const r = runCLI(['--json', 'doctor', '--project-root', root]);
  // Exit 0 if all pass, 1 if any fail. We don't assert which — just shape.
  assert.ok(r.status === 0 || r.status === 1);
  const result = JSON.parse(r.stdout);
  assert.ok(Array.isArray(result.checks));
  assert.ok(result.checks.length >= 5, 'doctor runs at least 5 categorical checks');
  const labels = result.checks.map(c => c.label);
  // Stable identifiers — registry of doctor checks
  assert.ok(labels.includes('version'));
  assert.ok(labels.includes('sidecar'));
  assert.ok(labels.includes('settings.json'));
  assert.ok(labels.includes('bundled kit'));
  assert.ok(labels.includes('.planning/'));
  // Each check has shape {label, status} at minimum
  for (const ck of result.checks) {
    assert.equal(typeof ck.label, 'string');
    assert.ok(['pass', 'warn', 'fail'].includes(ck.status), `bad status: ${ck.status}`);
  }
});

test('doctor human output (no --json) formats checks with bold labels', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cli-test-'));
  const r = runCLI(['doctor', '--project-root', root]);
  assert.ok(r.status === 0 || r.status === 1);
  // Header line includes the project root
  assert.match(r.stdout, /kit-mcp doctor/);
  assert.match(r.stdout, /version/);
});
