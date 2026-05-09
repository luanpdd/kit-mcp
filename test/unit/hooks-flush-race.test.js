// SEC-13-05: regression test for hook flush-before-exit fix.
// Pattern v1.12.1 (sidecar-tool-publisher) addressed TCP I/O. The 6 hooks
// touched in Phase 80 use stdout/stderr only — fix is process.stdout.write
// with callback before process.exit. This test validates that the JSON
// payload arrives complete and not truncated, even for a payload that
// exceeds typical pipe buffer sizes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_HOOK = path.join(REPO_ROOT, 'kit', 'hooks', 'workflow-guard.js');

// Production deploy: hooks live in .claude/hooks/ inside a user project, with
// NO parent package.json declaring "type":"module". The hook source uses CJS
// (require). To mirror that environment, we copy the hook into the temp
// project root (where there is no package.json type:module) before spawning.
// Spawning kit/hooks/workflow-guard.js directly fails because kit-mcp's own
// package.json declares "type":"module".
async function tmpProject() {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-hook-flush-test-'));
  await mkdir(path.join(root, '.planning'), { recursive: true });
  await mkdir(path.join(root, '.claude', 'hooks'), { recursive: true });
  await writeFile(
    path.join(root, '.planning', 'config.json'),
    JSON.stringify({ hooks: { workflow_guard: true } }),
    'utf8',
  );
  // Copy the actual hook source under test into the deployed location.
  const hookCopy = path.join(root, '.claude', 'hooks', 'workflow-guard.js');
  await copyFile(SOURCE_HOOK, hookCopy);
  return { root, hookPath: hookCopy };
}

function runHook(hookPath, envelope) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(envelope));
  });
}

test('SEC-13-05: workflow-guard flushes JSON payload before exit', async () => {
  const { root, hookPath } = await tmpProject();
  try {
    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: path.join(root, 'src', 'foo.ts'), content: 'x'.repeat(50) },
      cwd: root,
      session_id: 'flush-test-1',
    };

    // Run 3 times to detect flakiness (race conditions are intermittent)
    for (let i = 0; i < 3; i++) {
      const { code, stdout, stderr } = await runHook(hookPath, envelope);
      assert.equal(code, 0, `iteration ${i}: expected exit 0, got ${code}; stderr: ${stderr.slice(0, 200)}`);
      assert.ok(stdout.startsWith('{"hookSpecificOutput":'), `iteration ${i}: stdout did not start with expected JSON prefix; got: ${stdout.slice(0, 80)}`);
      assert.ok(stdout.trim().endsWith('}'), `iteration ${i}: stdout did not end with closing brace; got tail: ${stdout.slice(-80)}`);
      // Validate JSON parses cleanly
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
      assert.ok(typeof parsed.hookSpecificOutput.additionalContext === 'string');
      assert.ok(parsed.hookSpecificOutput.additionalContext.length > 100);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-05: workflow-guard handles large file_path without truncation', async () => {
  const { root, hookPath } = await tmpProject();
  try {
    // Build a file_path that, when interpolated into the warning message,
    // pushes the JSON payload above 4KB (typical pipe buffer threshold).
    const longSegment = 'a'.repeat(200);
    const longPath = path.join(root, longSegment, longSegment, longSegment, longSegment, longSegment, 'file.ts');
    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: longPath, content: 'x' },
      cwd: root,
      session_id: 'flush-test-large',
    };

    const { code, stdout, stderr } = await runHook(hookPath, envelope);
    assert.equal(code, 0, `expected exit 0, got ${code}; stderr: ${stderr.slice(0, 200)}`);
    // Must be valid JSON — proves no truncation
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-05: hooks flush-before-exit pattern documented in all 6 hooks', async () => {
  // Static check: every Phase 80 hook MUST declare its category in a
  // top-of-file comment. Prevents silent regression where someone adds
  // a new write+exit path without categorizing.
  const fs = await import('node:fs/promises');
  const targets = [
    'kit/hooks/workflow-guard.js',
    'kit/hooks/prompt-guard.js',
    'kit/hooks/context-monitor.js',
    'kit/hooks/post-apply-migration.js',
    'kit/hooks/statusline.js',
    'kit/hooks/check-update.js',
  ];
  for (const rel of targets) {
    const content = await fs.readFile(path.join(REPO_ROOT, rel), 'utf8');
    const match = content.match(/^\/\/ SEC-13-05: flush-before-exit category = ([ABCE])/m);
    assert.ok(match, `${rel}: missing SEC-13-05 category comment`);
    assert.ok(['A', 'B', 'C', 'E'].includes(match[1]), `${rel}: invalid category ${match[1]}`);
  }
});
