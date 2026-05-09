// Regression tests for PERF-16-05 (P5) and PERF-16-06 (P6) — Phase 89.02.
//
// Validates:
//   1. package.json has 4 dependencies + 2 optionalDependencies (budget = 6).
//   2. Total dep budget invariant — guards against accidental drops or additions.
//   3. select()/confirm() throw descriptive error if @inquirer/prompts unavailable.
//   4. watchKit() throws descriptive error if chokidar unavailable.
//
// Why these tests: optional deps are silently NOT installed when a downstream
// project runs `npm install --omit=optional`. We need MCP-server-style runs
// (CI, stdio mode) to keep working, and interactive/watch commands to fail
// with actionable messages. These tests pin both behaviors.
//
// Strategy for "missing dep" simulation: temporarily rename
// `node_modules/<dep>` to `<dep>.bak` so Node's ESM resolver legitimately
// fails to find it (matches the actual `--omit=optional` runtime behavior),
// then spawn a CHILD process to trigger the lazy-load (necessary because the
// parent process may already have the module loaded from a prior import).
// The rename is wrapped in try/finally so the directory is restored even on
// test failure or process kill (best-effort — see t.after cleanup).
//
// Why not Module._resolveFilename monkey-patch: that intercepts only CJS
// require() resolution. ESM `await import()` in Node 20+ goes through the
// ESM loader (esm/resolve.js), bypassing _resolveFilename entirely.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rename, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Helper: rename node_modules/<modName> away, run trigger script, restore.
// Returns child stdout. Throws if child fails non-zero.
async function withMissingModule(modName, triggerScript) {
  // modName can be scoped: '@inquirer/prompts' → node_modules/@inquirer/prompts
  const target = path.join(REPO_ROOT, 'node_modules', ...modName.split('/'));
  const bak = target + '.kit-mcp-test-bak';

  // Sanity: verify the dep is actually present before we try to rename.
  // If it's already gone (e.g., user ran --omit=optional locally), skip.
  try {
    await access(target);
  } catch {
    return { skipped: true, reason: `${modName} not installed locally` };
  }

  let renamed = false;
  try {
    await rename(target, bak);
    renamed = true;

    const child = spawnSync(process.execPath, ['-e', triggerScript], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      timeout: 15000,
    });

    return {
      skipped: false,
      status: child.status,
      stdout: child.stdout || '',
      stderr: child.stderr || '',
    };
  } finally {
    if (renamed) {
      // Best-effort restore — must succeed for next test run.
      try {
        await rename(bak, target);
      } catch (restoreErr) {
        // eslint-disable-next-line no-console
        console.error(
          `[FATAL] failed to restore ${target} from ${bak}: ${restoreErr.message}\n` +
            `MANUAL ACTION: rename "${bak}" back to "${target}"`,
        );
        throw restoreErr;
      }
    }
  }
}

test('PERF-16-05/06: package.json declares 4 dependencies + 2 optionalDependencies', async () => {
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);

  const deps = Object.keys(pkg.dependencies || {});
  const optDeps = Object.keys(pkg.optionalDependencies || {});

  assert.equal(
    deps.length,
    4,
    `expected 4 dependencies, got ${deps.length}: ${deps.join(',')}`,
  );
  assert.equal(
    optDeps.length,
    2,
    `expected 2 optionalDependencies, got ${optDeps.length}: ${optDeps.join(',')}`,
  );

  // Specific entries — protects against accidental swaps.
  assert.ok(deps.includes('@modelcontextprotocol/sdk'), 'sdk must be in dependencies');
  assert.ok(deps.includes('commander'), 'commander must be in dependencies');
  assert.ok(deps.includes('open'), 'open must be in dependencies');
  assert.ok(deps.includes('picocolors'), 'picocolors must be in dependencies');

  assert.ok(
    optDeps.includes('@inquirer/prompts'),
    '@inquirer/prompts must be in optionalDependencies',
  );
  assert.ok(optDeps.includes('chokidar'), 'chokidar must be in optionalDependencies');

  // Sanity: no overlap between dependencies and optionalDependencies.
  const overlap = deps.filter((d) => optDeps.includes(d));
  assert.deepEqual(overlap, [], `dep cannot be in both lists: ${overlap.join(',')}`);
});

test('PERF-16-05/06: total dep budget = 6 (invariant from v1.12.1 audit)', async () => {
  const raw = await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  const total =
    Object.keys(pkg.dependencies || {}).length +
    Object.keys(pkg.optionalDependencies || {}).length;
  assert.equal(
    total,
    6,
    `dep budget violated: total=${total}, expected 6 (4 deps + 2 optional)`,
  );
});

test('PERF-16-05: select() throws descriptive error when @inquirer/prompts unavailable', async (t) => {
  // Spawn a child that pretends to be a TTY and tries to call select().
  // Child will throw the descriptive error from loadInquirer().
  const triggerScript = `
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    import('./src/core/ui.js').then(async (ui) => {
      try {
        await ui.select({ message: 'pick', choices: [{ name: 'a', value: 'a' }] });
        process.stdout.write('UNEXPECTED_SUCCESS');
        process.exit(1);
      } catch (e) {
        process.stdout.write('CAUGHT:' + e.message);
        process.exit(0);
      }
    }).catch((e) => {
      process.stdout.write('IMPORT_FAILED:' + e.message);
      process.exit(2);
    });
  `;

  const result = await withMissingModule('@inquirer/prompts', triggerScript);
  if (result.skipped) {
    t.skip(result.reason);
    return;
  }

  assert.equal(
    result.status,
    0,
    `child should exit 0 (caught error). stdout="${result.stdout}" stderr="${result.stderr.slice(0, 200)}"`,
  );
  assert.match(
    result.stdout,
    /^CAUGHT:/,
    `expected child to catch the loadInquirer error. stdout="${result.stdout}"`,
  );
  assert.match(
    result.stdout,
    /npm i @inquirer\/prompts/,
    'select() must throw with message instructing `npm i @inquirer/prompts`',
  );
});

test('PERF-16-06: watchKit() throws descriptive error when chokidar unavailable', async (t) => {
  const triggerScript = `
    import('./src/core/watch.js').then(async (watch) => {
      try {
        await watch.watchKit(['claude-code'], { projectRoot: process.cwd() });
        process.stdout.write('UNEXPECTED_SUCCESS');
        process.exit(1);
      } catch (e) {
        process.stdout.write('CAUGHT:' + e.message);
        process.exit(0);
      }
    }).catch((e) => {
      process.stdout.write('IMPORT_FAILED:' + e.message);
      process.exit(2);
    });
  `;

  const result = await withMissingModule('chokidar', triggerScript);
  if (result.skipped) {
    t.skip(result.reason);
    return;
  }

  assert.equal(
    result.status,
    0,
    `child should exit 0 (caught error). stdout="${result.stdout}" stderr="${result.stderr.slice(0, 200)}"`,
  );
  assert.match(
    result.stdout,
    /^CAUGHT:/,
    `expected child to catch the loadChokidar error. stdout="${result.stdout}"`,
  );
  assert.match(
    result.stdout,
    /npm i chokidar/,
    'watchKit() must throw with message instructing `npm i chokidar`',
  );
});
