import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO     = path.resolve(__dirname, '../..');
const FIXTURE  = path.resolve(__dirname, '../fixtures/sample-kit');
const CLI      = path.join(REPO, 'bin/cli.js');

let TMP, KIT, PROJECT;

beforeEach(async () => {
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-cli-rt-'));
  KIT = path.join(TMP, 'kit');
  PROJECT = path.join(TMP, 'project');
  await fs.cp(FIXTURE, KIT, { recursive: true });
});

afterEach(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

function runCli(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, KIT_MCP_KIT_ROOT: KIT, ...(opts.env ?? {}) };
    const child = spawn(process.execPath, [CLI, ...args], { env, cwd: opts.cwd ?? REPO });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('error', reject);
    child.on('exit', code => resolve({ code, stdout, stderr }));
  });
}

test('cli kit list-agents — finds the fixture agent', async () => {
  const r = await runCli(['kit', 'list-agents']);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const out = JSON.parse(r.stdout);
  assert.ok(Array.isArray(out));
  assert.ok(out.find(a => a.name === 'sample-agent'));
});

test('cli sync install — projects all caps incl framework + hooks', async () => {
  const r = await runCli(['sync', 'install', 'claude-code', '--project-root', PROJECT]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  await fs.access(path.join(PROJECT, '.claude/agents/sample-agent.md'));
  await fs.access(path.join(PROJECT, '.claude/commands/sample-command.md'));
  await fs.access(path.join(PROJECT, '.claude/skills/sample-skill/SKILL.md'));
  await fs.access(path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md'));
  await fs.access(path.join(PROJECT, '.claude/framework/.kit-mcp-managed'));
  await fs.access(path.join(PROJECT, '.claude/hooks/sample-hook.js'));
  await fs.access(path.join(PROJECT, '.claude/hooks/.kit-mcp-managed'));
  await fs.access(path.join(PROJECT, 'CLAUDE.md'));
});

test('cli reverse-sync detect — picks up edits across all kinds', async () => {
  await runCli(['sync', 'install', 'claude-code', '--project-root', PROJECT]);
  // Edit one of each kind that the dest supports
  const fwPath = path.join(PROJECT, '.claude/framework/workflows/sample-workflow.md');
  await fs.writeFile(fwPath, '# DIRTY\n');
  const hookPath = path.join(PROJECT, '.claude/hooks/sample-hook.js');
  await fs.writeFile(hookPath, '// DIRTY\n');

  const r = await runCli(['reverse-sync', 'detect', 'claude-code', '--project-root', PROJECT]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  const out = JSON.parse(r.stdout);
  const kinds = out.candidates.map(c => c.kind);
  assert.ok(kinds.includes('framework'));
  assert.ok(kinds.includes('hooks'));
});

test('cli sync remove — cleans stubs and marker-managed dirs only', async () => {
  await runCli(['sync', 'install', 'claude-code', '--project-root', PROJECT]);
  // User-authored file in agents/ should survive
  await fs.writeFile(path.join(PROJECT, '.claude/agents/user.md'), 'mine');
  const r = await runCli(['sync', 'remove', 'claude-code', '--project-root', PROJECT]);
  assert.equal(r.code, 0, `stderr: ${r.stderr}`);
  await assert.rejects(fs.access(path.join(PROJECT, '.claude/agents/sample-agent.md')));
  await assert.rejects(fs.access(path.join(PROJECT, '.claude/framework')));
  await assert.rejects(fs.access(path.join(PROJECT, '.claude/hooks')));
  // user file preserved
  const userFile = await fs.readFile(path.join(PROJECT, '.claude/agents/user.md'), 'utf8');
  assert.equal(userFile, 'mine');
});

test('cli mcp-server boots with /dev/null stdin (smoke)', async () => {
  // Mirrors the CI step that catches DEFAULT_KIT_ROOT-style import-time crashes.
  const child = spawn(process.execPath, [path.join(REPO, 'bin/mcp.js')], {
    env: { ...process.env, KIT_MCP_KIT_ROOT: KIT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', d => stderr += d);
  const exitedEarly = await new Promise(resolve => {
    const t = setTimeout(() => resolve(false), 800);
    child.on('exit', code => { clearTimeout(t); resolve({ code }); });
  });
  if (exitedEarly && exitedEarly.code !== 0) {
    assert.fail(`mcp-server crashed before timeout: exit=${exitedEarly.code}\n${stderr}`);
  }
  child.kill();
});
