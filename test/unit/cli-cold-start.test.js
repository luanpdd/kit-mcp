// PERF-16-04 (Phase 89.01) regression test — keep CLI cold start fast for
// non-UI commands after the UI sidecar imports were moved from top-level eager
// to dynamic await import() inside the handlers that actually use them.
//
// Baseline pre-Phase 89 (measured 2026-05-09 on dev machine, 3 runs median):
//   ~270-285ms for `kit kit list-agents --terse --json`
//
// The plan's original baseline estimate (~1000ms) predates Phase 88 I/O wins —
// after Phase 88 sync.js batched and cache invalidation tightened, the CLI was
// already fast. Phase 89.01 still trims the UI server (547 LOC) + wrapper
// (129 LOC) + browser (78 LOC) modules off of the kit*/sync*/gates*/forensics*
// hot paths.
//
// CI margin: this test is timing-based and may flake on slow runners (cold disk,
// shared CI runners, low-core boxes). We assert vs an absolute ceiling (1500ms)
// to catch ONLY full regressions where the lazy imports are accidentally
// re-eager-ified. The "≥30% faster" claim is validated manually via benchmark
// during /publicar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(REPO_ROOT, 'bin/cli.js');

function runCLI(args, timeoutMs = 5000) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env, KIT_MCP_NO_UI: '1', NO_COLOR: '1', CI: '1' },
  });
  const dt = Date.now() - t0;
  if (r.status !== 0) {
    throw new Error(`CLI exit ${r.status}: ${r.stderr?.slice(0, 500)}`);
  }
  return { stdout: r.stdout, stderr: r.stderr, dt };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

test('PERF-16-04: kit list-agents --terse cold start within absolute ceiling', () => {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    runs.push(runCLI(['--json', 'kit', 'list-agents', '--terse']).dt);
  }
  const med = median(runs);
  // Absolute ceiling — catches accidental re-eager-ification of UI imports.
  // Pre-Phase 89 baseline (post-Phase 88): ~270-285ms typical.
  // Ceiling 1500ms allows for slow CI (shared runners, cold disk) without
  // false positives. Anything ≥1500ms median is a real regression.
  assert.ok(
    med < 1500,
    `cold start regression: median ${med}ms across 3 runs (ceiling 1500ms). runs=${runs.join(',')}`,
  );
});

test('PERF-16-04: kit list-agents --terse output is valid JSON with {kind, name}', () => {
  const { stdout } = runCLI(['--json', 'kit', 'list-agents', '--terse']);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed), 'list-agents --terse --json must return an array');
  assert.ok(parsed.length > 0, 'kit must have at least one agent');
  for (const item of parsed) {
    assert.equal(typeof item.kind, 'string', 'each item has kind');
    assert.equal(typeof item.name, 'string', 'each item has name');
    assert.equal(item.description, undefined, 'terse mode omits description (PERF-15-01)');
  }
});

test('PERF-16-04: kit list-agents (non-terse) still includes capped description', () => {
  const { stdout } = runCLI(['--json', 'kit', 'list-agents']);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed) && parsed.length > 0);
  // Non-terse mode includes description (slim cap from PERF-13-01 preserved).
  const first = parsed[0];
  assert.equal(typeof first.description, 'string', 'non-terse mode includes description');
});
