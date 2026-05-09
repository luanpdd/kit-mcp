// SEC-14-04 regression suite — gate-runner tmpdir lifecycle.
//
// Phase 83 Plan 02. Asserts execScript:
//   1. cleans up tmp dir after a passed gate
//   2. cleans up tmp dir even after a failing gate
//   3. uses mkdtemp with kit-gate- prefix (source-grep — guards future regression)
//   4. concurrent runs do not collide on tmp dir naming
//
// We do NOT attempt a live symlink-attack here because:
//   - Windows runners often lack symlink privileges → test would skip on the
//     primary CI matrix.
//   - Linux/macOS race-window timing makes the test flaky.
// The 4 properties below prove the same defense (non-predictable name + robust
// cleanup) without flakiness.
//
// Test isolation: each test redirects os.tmpdir() to a unique dir by overriding
// TMPDIR / TMP / TEMP env vars. os.tmpdir() reads env at call time (verified),
// so the gate-runner's mkdtemp lands inside our isolated dir. This makes the
// "no leftover kit-gate-*" assertion robust even when other test files run
// concurrently and create their own kit-gate-* dirs in the system tmpdir.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import { runGate } from '../../src/core/gate-runner.js';

let TMP_GATES;
let ISOLATED_TMP;
let ORIG_ENV;

beforeEach(async () => {
  TMP_GATES = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-tmpdir-test-'));
  await fs.writeFile(path.join(TMP_GATES, 'shell-pass.md'),
    `---\nid: shell-pass\nstage: pre-verify\nblocking: true\n---\n## Check\n\`\`\`bash\nexit 0\n\`\`\`\n`);
  await fs.writeFile(path.join(TMP_GATES, 'shell-fail.md'),
    `---\nid: shell-fail\nstage: pre-verify\nblocking: true\n---\n## Check\n\`\`\`bash\nexit 42\n\`\`\`\n`);

  // Isolated tmpdir for THIS test — stops collision with parallel test runners
  // that also create kit-gate-* dirs in the system tmpdir.
  ISOLATED_TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-tmpdir-isolated-'));
  ORIG_ENV = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
  process.env.TMPDIR = ISOLATED_TMP;
  process.env.TMP = ISOLATED_TMP;
  process.env.TEMP = ISOLATED_TMP;
});

afterEach(async () => {
  // Restore env BEFORE rm so any cleanup using os.tmpdir() lands in the system tmp.
  for (const k of ['TMPDIR', 'TMP', 'TEMP']) {
    if (ORIG_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ORIG_ENV[k];
  }
  await fs.rm(TMP_GATES, { recursive: true, force: true });
  await fs.rm(ISOLATED_TMP, { recursive: true, force: true });
});

function listKitGateDirs() {
  // Read the ISOLATED tmp — only this test's runs land here.
  return fsSync.readdirSync(ISOLATED_TMP).filter(n => /^kit-gate-/.test(n));
}

test('SEC-14-04: cleanup removes tmp dir after passed gate', async () => {
  const r = await runGate('shell-pass', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} });
  assert.equal(r.verdict, 'passed');
  const leftover = listKitGateDirs();
  assert.deepEqual(leftover, [], `expected no leftover kit-gate dirs in isolated tmp; got=${JSON.stringify(leftover)}`);
});

test('SEC-14-04: cleanup removes tmp dir after failing gate', async () => {
  const r = await runGate('shell-fail', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} });
  assert.equal(r.verdict, 'block');
  assert.equal(r.exitCode, 42);
  const leftover = listKitGateDirs();
  assert.deepEqual(leftover, [], 'cleanup must run even on non-zero exit');
});

test('SEC-14-04: gate-runner source uses mkdtemp, not predictable timestamp+rand naming', async () => {
  const src = await fs.readFile(new URL('../../src/core/gate-runner.js', import.meta.url), 'utf8');
  assert.match(src, /fs\.mkdtemp\(path\.join\(os\.tmpdir\(\),\s*['"]kit-gate-['"]\)\)/, 'must use mkdtemp with kit-gate- prefix');
  // Within the execScript function specifically — comments elsewhere are fine,
  // but actual code in execScript must NOT use Date.now() / Math.random() for naming.
  const execScriptBlock = src.match(/async function execScript[\s\S]*?\n\}\s*\n/)?.[0] ?? '';
  assert.ok(execScriptBlock.length > 0, 'must locate execScript function block');
  assert.doesNotMatch(execScriptBlock, /Date\.now\(\)/, 'execScript must NOT use Date.now() for tmp naming');
  assert.doesNotMatch(execScriptBlock, /Math\.random\(\)/, 'execScript must NOT use Math.random() for tmp naming');
});

test('SEC-14-04: concurrent gate runs do not collide on tmp dir', async () => {
  const [a, b] = await Promise.all([
    runGate('shell-pass', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} }),
    runGate('shell-pass', { gatesRoot: TMP_GATES, yes: true, interactive: false, onLog: () => {} }),
  ]);
  assert.equal(a.verdict, 'passed');
  assert.equal(b.verdict, 'passed');
  const leftover = listKitGateDirs();
  assert.deepEqual(leftover, [], 'both runs must have cleaned up their tmp dirs');
});
