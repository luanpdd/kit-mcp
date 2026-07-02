// POL-17-04 regression — Phase 92.01.
//
// Static guard: every export of src/core/path-safety.js must have a JSDoc block
// with at least @param + @returns. Mirrors the contract already met by
// src/core/error-redaction.js (Phase 84) and src/core/manifest-verify.js (Phase 90).
//
// Why a separate test file (and not extending dead-imports.test.js):
//   - Different concern. dead-imports guards against accidental imports of
//     unused names; this guards against undocumented exports. Mixing them in
//     one file blurs failure-mode triage on CI red.
//   - Future POL items will likely add more docs-coverage assertions; this is
//     the natural seam to grow.
//
// What "JSDoc with @param + @returns" looks like:
//   /**
//    * One-line description.
//    * @param {Type} name - description
//    * @returns {Promise<T>} description
//    */
//   export async function ...
//
// Tolerance: we accept any JSDoc opener (`/**`) preceding the export within ~30
// lines (allows for multi-line descriptions, multiple @param blocks, examples).
// Strictness: must include literal `@param` and `@returns` tokens.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Returns array of { name, blockText } for every export found in `src` whose
// JSDoc block is the contiguous /** ... */ comment preceding the `export`
// keyword. Returns no entry for exports without an attached JSDoc.
function extractJsdocBlocks(src) {
  // Match `/** ... */` followed by optional whitespace/newlines, then `export`
  // and the function/const/class identifier. Multiline; non-greedy on the body.
  const re = /\/\*\*([\s\S]*?)\*\/\s*export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ name: m[2], blockText: m[1] });
  }
  return out;
}

test('POL-17-04: src/core/path-safety.js exports have @param + @returns JSDoc', async () => {
  const src = await readFile(
    path.join(REPO_ROOT, 'src', 'core', 'path-safety.js'),
    'utf8'
  );

  // Static expectation — keep this small. If new exports are added to
  // path-safety.js, this list must be updated alongside their JSDoc.
  const expectedExports = ['validateProjectRoot'];

  const blocks = extractJsdocBlocks(src);
  const documented = new Map(blocks.map((b) => [b.name, b.blockText]));

  for (const name of expectedExports) {
    const block = documented.get(name);
    assert.ok(
      block,
      `export '${name}' must have a JSDoc block (POL-17-04)`
    );
    assert.match(
      block,
      /@param\b/,
      `JSDoc for '${name}' must include @param tag`
    );
    assert.match(
      block,
      /@returns\b/,
      `JSDoc for '${name}' must include @returns tag`
    );
  }
});

test('POL-17-04: src/core/error-redaction.js retains its @param + @returns JSDoc (regression baseline)', async () => {
  // Reference contract — error-redaction.js was the JSDoc style template for
  // POL-17-04. Pin the same checks against it so we notice if someone strips
  // the docs from there too.
  const src = await readFile(
    path.join(REPO_ROOT, 'src', 'core', 'error-redaction.js'),
    'utf8'
  );
  const blocks = extractJsdocBlocks(src);
  const documented = new Map(blocks.map((b) => [b.name, b.blockText]));

  for (const name of ['redactSecrets', 'sanitizeMcpError']) {
    const block = documented.get(name);
    assert.ok(block, `export '${name}' must have a JSDoc block`);
    assert.match(block, /@param\b/, `JSDoc for '${name}' must include @param tag`);
    assert.match(block, /@returns\b/, `JSDoc for '${name}' must include @returns tag`);
  }
});
