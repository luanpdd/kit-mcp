// Stryker mutation testing entrypoint — wraps test/run.mjs with two
// guarantees:
//
// 1. KIT_MCP_SKIP_MANIFEST_CHECK=1 is pre-set. Stryker copies kit/ files
//    into its sandbox via a path that triggers line-ending normalization on
//    Windows, which breaks the manifest hash check. The skip is dev-mode safe
//    because Stryker is dev-only (`npm run test:mutation`); the regular test
//    runner (`npm test`) does NOT use this wrapper and exercises the manifest
//    path through dedicated tests in manifest-verify.test.js.
//
// 2. Optional argv[3] accepts a comma-separated list of explicit test files
//    to scope the run. Used by the v1.20 mutation baseline to keep a single
//    Stryker invocation under a few minutes (full src/core/ scope is deferred
//    to v1.21+ — see .planning/audits/v1.20/MUTATION-BASELINE.md ToDo).
//
// Usage (invoked by stryker.config.json commandRunner.command):
//   node test/run-mutation.mjs test/unit
//   node test/run-mutation.mjs test/unit test/unit/error-redaction.test.js[,...]
//
// Refs:
//   - REQ INFRA-20-02 (Phase 101 — mutation testing baseline)
//   - .planning/audits/v1.20/MUTATION-BASELINE.md

import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';

const dir = process.argv[2];
// argv[3] takes precedence; STRYKER_MUTATE_TEST_FILES env is a fallback so
// stryker.config.json (which can't pass extra argv to commandRunner.command)
// can still scope the run via env injection.
const explicitFiles = process.argv[3] || process.env.STRYKER_MUTATE_TEST_FILES;
if (!dir) {
  console.error('Usage: node test/run-mutation.mjs <dir> [comma,sep,test,files]');
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

let files;
if (explicitFiles) {
  files = explicitFiles
    .split(',')
    .map((f) => path.resolve(f.trim()))
    .filter((f) => fs.existsSync(f));
  if (files.length === 0) {
    console.error(`No valid test files in: ${explicitFiles}`);
    process.exit(2);
  }
} else {
  files = walk(path.resolve(dir));
  if (files.length === 0) {
    console.error(`No *.test.js files under ${dir}`);
    process.exit(2);
  }
}

const r = spawnSync(
  process.execPath,
  ['--test', '--test-force-exit', '--test-concurrency=1', ...files],
  { stdio: 'inherit', env: process.env },
);
process.exit(r.status ?? 1);
