// POL-17-03 regression — Phase 92.01.
//
// Static guard: ensures `getLocalVersion` is no longer imported in src/cli/index.js
// (originally pulled in by Plan 89.01 but never referenced from the CLI surface).
// `getLocalVersion` itself stays exported from src/cli/upgrade-check.js — it's
// used internally by checkUpgrade() and consumed by test/unit/upgrade-check.test.js.
//
// Why a static text test instead of trusting `node --check`:
//   - ESM imports of unused names are syntactically legal; Node won't flag them.
//   - eslint no-unused-vars / no-unused-imports would catch this, but the kit-mcp
//     repo intentionally has no eslint config (zero-build, zero-config policy).
//     A plain regex test in CI is the smallest equivalent guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

test('POL-17-03: src/cli/index.js does not import getLocalVersion', async () => {
  const src = await readFile(
    path.join(REPO_ROOT, 'src', 'cli', 'index.js'),
    'utf8'
  );
  // Match any import line that pulls getLocalVersion in (named import or alias).
  // Grep variants to cover edge cases:
  //   import { getLocalVersion } from ...
  //   import { foo, getLocalVersion } from ...
  //   import { getLocalVersion as v } from ...
  const importLine = /^import\s+\{[^}]*\bgetLocalVersion\b[^}]*\}\s+from/m;
  assert.equal(
    importLine.test(src),
    false,
    'src/cli/index.js must not import getLocalVersion (Plan 89.01 dead import — POL-17-03)'
  );
});

test('POL-17-03: src/cli/index.js does not reference getLocalVersion at all', async () => {
  // Tighter check: also forbid bare-name references (e.g., re-exports, dynamic
  // imports). Catches cases where someone removes the import line but leaves a
  // trailing reference.
  const src = await readFile(
    path.join(REPO_ROOT, 'src', 'cli', 'index.js'),
    'utf8'
  );
  assert.equal(
    /\bgetLocalVersion\b/.test(src),
    false,
    'src/cli/index.js must contain zero textual references to getLocalVersion'
  );
});

test('POL-17-03: getLocalVersion is still exported from src/cli/upgrade-check.js', async () => {
  // Negative guard — make sure POL-17-03 cleanup didn't accidentally delete the
  // upstream function. checkUpgrade() depends on it; test/unit/upgrade-check.test.js
  // imports it directly.
  const src = await readFile(
    path.join(REPO_ROOT, 'src', 'cli', 'upgrade-check.js'),
    'utf8'
  );
  assert.match(
    src,
    /export\s+async\s+function\s+getLocalVersion\b/,
    'getLocalVersion must remain exported from upgrade-check.js'
  );
});
