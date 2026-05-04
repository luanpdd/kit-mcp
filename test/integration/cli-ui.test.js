import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const BIN = path.resolve('bin/cli.js');

function mkProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-cliui-test-'));
}

function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('kit ui --help lists 4 subcommands', () => {
  const r = runCli(['ui', '--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /start \[options\]/);
  assert.match(r.stdout, /stop \[options\]/);
  assert.match(r.stdout, /status \[options\]/);
  assert.match(r.stdout, /open \[options\]/);
});

test('kit ui status with no sidecar exits 1 with friendly message', () => {
  const root = mkProjectRoot();
  const r = runCli(['ui', 'status', '--project-root', root]);
  assert.equal(r.status, 1, `unexpected exit. stdout=${r.stdout} stderr=${r.stderr}`);
  // Output goes to stdout in human mode
  assert.match(r.stdout + r.stderr, /no sidecar running/);
});

test('kit ui status --json with no sidecar returns structured JSON', () => {
  const root = mkProjectRoot();
  const r = runCli(['--json', 'ui', 'status', '--project-root', root]);
  assert.equal(r.status, 1);
  const j = JSON.parse(r.stdout);
  assert.equal(j.running, false);
  assert.equal(j.reason, 'no_lockfile');
});

test('kit ui open with no sidecar fails with helpful error', () => {
  const root = mkProjectRoot();
  const r = runCli(['ui', 'open', '--project-root', root]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no sidecar running/);
});

test('kit ui stop with no sidecar reports no_sidecar', () => {
  const root = mkProjectRoot();
  const r = runCli(['ui', 'stop', '--project-root', root]);
  // Exit 0 is fine — "nothing to stop" is not an error
  assert.match(r.stdout + r.stderr, /no sidecar running/);
});

test('kit list-agents still works (sanity for stable API)', () => {
  const r = runCli(['kit', 'list-agents']);
  assert.equal(r.status, 0, `stable API regression: ${r.stderr}`);
  assert.match(r.stdout, /advisor-researcher|example-reviewer/);
});

test('kit --version reads from package.json (REL-01 fix)', () => {
  const r = runCli(['--version']);
  assert.equal(r.status, 0);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(r.stdout.trim(), pkg.version);
});

// End-to-end with a sidecar: spawn `kit ui start --no-open --idle-ms 0` in a child,
// then `kit ui status` should see it.
test('e2e: kit ui start spawns sidecar; status sees it; stop ends it', async () => {
  const root = mkProjectRoot();
  const child = spawn(
    process.execPath,
    [BIN, 'ui', 'start', '--no-open', '--project-root', root, '--idle-ms', '0'],
    { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, KIT_MCP_NO_OPEN: '1' } },
  );

  // Wait until child prints listening line (or fails)
  const url = await new Promise((resolve, reject) => {
    let acc = '';
    const t = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('timeout waiting for sidecar to start'));
    }, 5000);
    child.stderr.on('data', (chunk) => {
      acc += chunk.toString('utf8');
      const m = acc.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) {
        clearTimeout(t);
        resolve(m[0]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(t);
      reject(new Error(`sidecar exited early (code=${code}): ${acc}`));
    });
  });

  try {
    // Check status
    const status = runCli(['--json', 'ui', 'status', '--project-root', root]);
    assert.equal(status.status, 0, `status failed: stdout=${status.stdout} stderr=${status.stderr}`);
    const j = JSON.parse(status.stdout);
    assert.equal(j.running, true);
    assert.match(url, new RegExp(`:${j.port}/`));

    // Stop
    const stop = runCli(['ui', 'stop', '--project-root', root]);
    assert.match(stop.stdout + stop.stderr, /stopped|no sidecar/);

    // Wait briefly for child to exit
    await new Promise((resolve) => {
      child.on('exit', resolve);
      setTimeout(() => {
        try { child.kill('SIGTERM'); } catch {}
        resolve();
      }, 2000);
    });
  } finally {
    try { child.kill('SIGTERM'); } catch {}
    try {
      const hash = createHash('sha1').update(root).digest('hex').slice(0, 16);
      fs.unlinkSync(path.join(os.tmpdir(), `kit-mcp-ui-${hash}.lock`));
    } catch {}
  }
});
