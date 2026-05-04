// Cross-platform test runner: walks a directory for *.test.js files and
// invokes `node --test` with explicit paths. Necessary because Node 20
// doesn't support the **/* glob pattern in --test (added in Node 21+),
// and bash globstar isn't enabled on every CI shell. Zero dependencies.
//
// Usage: node test/run.mjs <dir>

import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node test/run.mjs <dir>');
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

// --test-force-exit guarantees the runner exits even if some test forgot to
// release a handle (added in Node 20.10/21.4/22+). Required for the integration
// tests in test/integration/ui-server.test.js — http.Server keep-alive sockets
// can otherwise stall process exit by a few seconds, which CI interprets as a hang.
const r = spawnSync(
  process.execPath,
  ['--test', '--test-force-exit', ...files],
  { stdio: 'inherit' },
);
process.exit(r.status ?? 1);
