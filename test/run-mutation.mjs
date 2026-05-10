// Stryker mutation testing entrypoint — wraps test/run.mjs with the
// KIT_MCP_SKIP_MANIFEST_CHECK=1 env var pre-set. Stryker copies kit/ files
// into its sandbox via a path that triggers line-ending normalization on
// Windows, which breaks the manifest hash check. The skip is dev-mode safe
// because Stryker is dev-only (`npm run test:mutation`); the regular test
// runner (`npm test`) does NOT use this wrapper and exercises the manifest
// path through dedicated tests in manifest-verify.test.js.
//
// Usage (invoked by stryker.config.json commandRunner.command):
//   node test/run-mutation.mjs test/unit
//
// Refs:
//   - REQ INFRA-20-02 (Phase 101 — mutation testing baseline)
//   - .planning/audits/v1.20/MUTATION-BASELINE.md

import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node test/run-mutation.mjs <dir>');
  process.exit(2);
}

function walk(d) {
  const out = [];
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const files = walk(path.resolve(dir));
if (files.length === 0) {
  console.error(`No *.test.js files under ${dir}`);
  process.exit(2);
}

const r = spawnSync(
  process.execPath,
  ['--test', '--test-force-exit', '--test-concurrency=1', ...files],
  { stdio: 'inherit', env: process.env },
);
process.exit(r.status ?? 1);
