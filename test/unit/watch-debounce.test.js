// Regression tests for PERF-16-02 (Phase 88.02).
//
// Validate watchKit() behavior:
//   1. Default debounceMs = 500 coalesces IDE save-bursts into a single resync.
//   2. clearKitCache invalidation makes re-sync reflect post-edit kit content
//      (no stale TTL cache from kit.js PERF-01).
//   3. Custom opts.debounceMs override is honored (Stable API preserved).
//
// Tests use real chokidar + real fs writes against a tmpdir copy of the
// sample-kit fixture. node:test does not have fake-timers, so we rely on
// timing-based assertions with generous margins to avoid flakes.
//
// chokidar's awaitWriteFinish=100ms (set in watch.js) compounds with our
// debounce. Total wait per assertion accounts for: write + 100ms stability +
// debounceMs + epsilon. We use ≥800ms windows in tests using the 500ms default.
//
// CI-SKIP: Windows + Node 24 aborts inside libuv (src\win\fs-event.c line 72,
// `!_wcsnicmp(filename, dir, dirlen)` assertion) when chokidar's recursive
// watcher races with tmpdir cleanup. Kills the whole test process — not a
// JS-level failure we can try/catch. Not a regression of this kit; reproduces
// on main. Other OS/Node combos exercise the same code paths, so coverage
// is preserved.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { watchKit } from '../../src/core/watch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_KIT_SRC = path.resolve(__dirname, '../fixtures/sample-kit');

const SKIP_REASON = 'libuv fs-event.c assertion fatal on win32 + Node 24 — see file header';
const SKIP_THIS_PLATFORM =
  process.platform === 'win32' && process.versions.node.startsWith('24.');

let TMP, KIT, PROJECT;
let prevSkipManifest;

beforeEach(async () => {
  TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-mcp-watch-'));
  KIT = path.join(TMP, 'kit');
  PROJECT = path.join(TMP, 'project');
  // Copy fixture so we can mutate without polluting the repo.
  await fs.cp(SAMPLE_KIT_SRC, KIT, { recursive: true });
  // SEC-14-05 manifest verify (Phase 83) hashes kit files; mutating fixtures
  // mid-test would fail manifest verification. These tests validate watch
  // behavior, not manifest integrity — bypass via documented dev opt-out.
  prevSkipManifest = process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
  process.env.KIT_MCP_SKIP_MANIFEST_CHECK = '1';
});

afterEach(async () => {
  if (prevSkipManifest === undefined) {
    delete process.env.KIT_MCP_SKIP_MANIFEST_CHECK;
  } else {
    process.env.KIT_MCP_SKIP_MANIFEST_CHECK = prevSkipManifest;
  }
  await fs.rm(TMP, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('watchKit — default debounce coalesces fast burst of writes into single resync', { skip: SKIP_THIS_PLATFORM && SKIP_REASON }, async () => {
  const logs = [];
  const onLog = (m) => logs.push({ t: Date.now(), msg: m });

  const handle = await watchKit(['claude-code'], {
    kitRoot: KIT,
    projectRoot: PROJECT,
    onLog,
    // debounceMs omitted → uses new default 500
  });

  // Wait for initial sync to complete + watcher to settle.
  await sleep(150);
  logs.length = 0; // clear initial-sync logs

  // BURST: 10 quick writes within < 500ms window.
  const burstStart = Date.now();
  for (let i = 0; i < 10; i++) {
    await fs.writeFile(
      path.join(KIT, 'agents/sample-agent.md'),
      `---\nname: sample-agent\ndescription: edit ${i}\n---\nbody ${i}\n`
    );
    await sleep(20); // 10 writes × 20ms = 200ms total < 500ms debounce
  }

  // Wait for debounce window + a margin (chokidar stability 100ms + 500ms debounce + epsilon).
  await sleep(800);

  await handle.stop();

  // ASSERTION: at most ONE "↻ resynced" message (debounce coalesced).
  const resyncs = logs.filter((l) => l.msg.includes('↻ resynced'));
  assert.ok(
    resyncs.length <= 1,
    `expected ≤1 resync, got ${resyncs.length}: ${resyncs.map((r) => r.msg).join(' | ')}`
  );

  // ASSERTION: the resync (if any) happened ≥400ms after burst start (debounce honored).
  if (resyncs.length === 1) {
    const dt = resyncs[0].t - burstStart;
    assert.ok(
      dt >= 400,
      `resync fired ${dt}ms after burst start; expected ≥400ms (500ms debounce − some jitter)`
    );
  }
});

test('watchKit — re-sync reflects post-edit kit content (clearKitCache invalidation)', { skip: SKIP_THIS_PLATFORM && SKIP_REASON }, async () => {
  const logs = [];
  const handle = await watchKit(['claude-code'], {
    kitRoot: KIT,
    projectRoot: PROJECT,
    debounceMs: 100, // tight debounce for fast test
    onLog: (m) => logs.push(m),
  });
  await sleep(50); // initial sync settle

  // Edit kit/agents/sample-agent.md with DISTINCTIVE content.
  // sample-agent.md fixture already exists and was projected during initial sync;
  // our edit changes the description that the projected stub should reflect after re-sync.
  const distinctive =
    `---\nname: sample-agent\ndescription: distinctive marker xyz123\n---\nbody after edit\n`;
  await fs.writeFile(path.join(KIT, 'agents/sample-agent.md'), distinctive);

  // Wait for chokidar awaitWriteFinish (100ms) + debounce (100ms) + sync I/O.
  await sleep(600);

  await handle.stop();

  // ASSERTION: projected file in PROJECT contains the distinctive marker.
  // Without clearKitCache invalidation, listKit() inside syncTo would return the
  // pre-edit value from the TTL cache (30s window) and the projected stub would
  // carry the original description ("Sample agent fixture for tests"), not xyz123.
  const projected = await fs.readFile(
    path.join(PROJECT, '.claude/agents/sample-agent.md'),
    'utf8'
  );
  assert.match(
    projected,
    /distinctive marker xyz123/,
    'projected stub should reflect post-edit kit description (cache invalidation works)'
  );
});

test('watchKit — opts.debounceMs override changes coalesce window', { skip: SKIP_THIS_PLATFORM && SKIP_REASON }, async () => {
  const logs = [];
  const handle = await watchKit(['claude-code'], {
    kitRoot: KIT,
    projectRoot: PROJECT,
    debounceMs: 50, // EXPLICIT override — should NOT use new 500 default
    onLog: (m) => logs.push(m),
  });
  await sleep(50); // initial sync
  logs.length = 0;

  // Single write.
  await fs.writeFile(
    path.join(KIT, 'agents/sample-agent.md'),
    `---\nname: sample-agent\ndescription: t3\n---\nbody t3\n`
  );

  // Wait short — with 50ms debounce + chokidar 100ms stability, resync should fire well within 500ms.
  await sleep(500);

  await handle.stop();

  const resync = logs.find((m) => m.includes('↻ resynced'));
  assert.ok(
    resync,
    `expected resync within 500ms with debounceMs=50; logs=${JSON.stringify(logs)}`
  );
});
