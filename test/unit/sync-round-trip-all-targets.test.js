// Phase 87-01 / DX-15-03 — local regression for the same contract that the
// CI smoke job's "Sync round-trip" step exercises across the matrix axis.
// Defense in depth: catches per-target path resolution / cleanup regressions
// in the unit suite before a PR ever reaches the (slower, costlier) 72-run CI.
//
// Coverage (9 tests):
//   1× registry has every expected ID
//   1× every target exposes >=1 capability
//   7× per-target round-trip (install writes >=1 file; remove leaves 0 stubs
//      under capability dirs — rules-aggregated stays by design)
//
// Skips mode=copy: sync.test.js already covers it for claude-code; logic is
// the same for all targets (only renderItem differs), and 8× would just
// double the runtime without catching new bugs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS, getTarget } from '../../src/core/registry.js';
import { syncTo, removeFrom } from '../../src/core/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_KIT = path.resolve(__dirname, '../fixtures/sample-kit');

const ALL_IDS = ['claude-code', 'cursor', 'codex', 'copilot', 'windsurf', 'antigravity', 'trae'];

async function withTmpDir(fn) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-rt-'));
  try { return await fn(tmp); }
  finally { await fs.rm(tmp, { recursive: true, force: true }); }
}

async function walkFiles(dir) {
  const out = [];
  async function visit(d) {
    let entries;
    try { entries = await fs.readdir(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await visit(p);
      else if (e.isFile()) out.push(p);
    }
  }
  await visit(dir);
  return out;
}

async function countStubs(dir) {
  const files = await walkFiles(dir);
  let count = 0;
  for (const f of files) {
    try {
      const c = await fs.readFile(f, 'utf8');
      if (c.includes('kit-mcp:reference')) count++;
    } catch {}
  }
  return count;
}

test('all 7 targets — registry has every expected ID', () => {
  const ids = Object.keys(TARGETS).sort();
  assert.deepEqual(
    ids,
    [...ALL_IDS].sort(),
    `registry IDs mismatch: got ${ids.join(',')}, expected ${[...ALL_IDS].sort().join(',')}`,
  );
});

test('all 7 targets — getTarget succeeds and exposes >=1 capability', () => {
  for (const id of ALL_IDS) {
    const t = getTarget(id);
    const caps = ['rules', 'agents', 'commands', 'skills', 'framework', 'hooks'];
    const present = caps.filter((c) => !!t[c]);
    assert.ok(present.length >= 1, `target ${id} has zero capabilities`);
  }
});

for (const id of ALL_IDS) {
  test(`sync round-trip — ${id}: install writes >=1 file, remove cleans agent/command/skill stubs`, async () => {
    await withTmpDir(async (tmp) => {
      // Install
      const installResult = await syncTo(id, { projectRoot: tmp, kitRoot: SAMPLE_KIT, mode: 'reference' });
      assert.equal(installResult.target, id);
      const filesAfterInstall = await walkFiles(tmp);
      assert.ok(filesAfterInstall.length >= 1, `${id}: sync install wrote 0 files`);

      // Remove
      const removeResult = await removeFrom(id, { projectRoot: tmp });
      assert.equal(removeResult.target, id);

      // Post-remove: ZERO stubs in capability dirs (rules aggregated may stay — by design)
      const target = getTarget(id);
      let stubsInCaps = 0;
      for (const cap of ['agents', 'commands', 'skills', 'framework', 'hooks']) {
        if (!target[cap]) continue;
        const capDir = path.join(tmp, target[cap].path);
        stubsInCaps += await countStubs(capDir);
      }
      assert.equal(
        stubsInCaps,
        0,
        `${id}: sync remove left ${stubsInCaps} stub file(s) under agents/commands/skills/framework/hooks`,
      );
    });
  });
}
