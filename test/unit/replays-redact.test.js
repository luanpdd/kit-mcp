// SEC-14-06: regression test for src/core/replays.js — recordReplay must scrub
// secrets/paths from the on-disk JSON before persisting.
//
// Threat: a caller (deliberately or by accident) passes an args object
// containing Authorization: Bearer ..., x-api-key headers, ANTHROPIC_API_KEY
// in env, or a cwd that reveals the user's home directory. Without scrubbing,
// these end up verbatim in .planning/replays/*.json — a file the user might
// later commit, share, or upload to a debug bug-report.
//
// Contract: the on-disk artifact has [REDACTED]/[PATH] markers; the in-memory
// `record` returned to the caller is NOT mutated (it's already in the caller's
// memory, scrubbing it would fight rather than help).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordReplay, loadReplay } from '../../src/core/replays.js';

async function tmpProject() {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-replays-redact-test-'));
  await mkdir(path.join(root, '.planning', 'replays'), { recursive: true });
  return root;
}

test('SEC-14-06: recordReplay scrubs Bearer / sk-ant / Win path from persisted JSON', async () => {
  const root = await tmpProject();
  try {
    const r = await recordReplay({
      phase: '84',
      plan: '01',
      agent: 'executor',
      args: {
        headers: { Authorization: 'Bearer abcdef0123456789abcdef0123456789' },
        cwd: 'D:\\Users\\victim\\projects\\app',
        env: { ANTHROPIC_API_KEY: 'sk-ant-realkey1234567890abcdef' },
      },
    }, { projectRoot: root });

    // Read the file directly — bypass loadReplay to confirm what's on disk.
    const onDisk = await readFile(r.file, 'utf8');

    // Negative: secrets NOT in the file
    assert.doesNotMatch(onDisk, /Bearer abcdef/, 'Bearer token survived to disk');
    assert.doesNotMatch(onDisk, /sk-ant-realkey/, 'sk-ant key survived to disk');
    assert.doesNotMatch(onDisk, /D:\\Users\\victim/, 'Win path survived to disk');

    // Positive: redaction markers present
    assert.match(onDisk, /Bearer \[REDACTED\]/, 'Bearer redaction marker missing on disk');
    assert.match(onDisk, /\[REDACTED:anthropic_key\]/, 'anthropic_key redaction marker missing on disk');
    assert.match(onDisk, /\[PATH\]/, 'path redaction marker missing on disk');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-14-06: loadReplay sees the redacted form (secrets not re-loaded)', async () => {
  const root = await tmpProject();
  try {
    const r = await recordReplay({
      phase: '84',
      plan: '01',
      agent: 'executor',
      args: { headers: { Authorization: 'Bearer cafebabedeadbeef0123456789abcdef' } },
    }, { projectRoot: root });

    const reloaded = await loadReplay(r.id, { projectRoot: root });
    const reloadedJson = JSON.stringify(reloaded);
    assert.doesNotMatch(reloadedJson, /Bearer cafebabe/, 'Bearer reloaded into memory — must stay redacted');
    assert.match(reloadedJson, /Bearer \[REDACTED\]/, 'redaction marker missing after reload');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-14-06: in-memory record returned by recordReplay is NOT mutated', async () => {
  // Trade-off documented in src/core/replays.js: only the on-disk copy is
  // scrubbed. The caller already had the secrets in memory (they passed them
  // in); scrubbing the returned record would fight rather than help, and could
  // break callers that immediately use the record for something else.
  const root = await tmpProject();
  try {
    const r = await recordReplay({
      phase: '84',
      plan: '01',
      agent: 'executor',
      args: { secret: 'sk-ant-original1234567890abcdef' },
    }, { projectRoot: root });

    // The returned record retains the original — proves we did not deep-mutate.
    assert.equal(r.record.args.secret, 'sk-ant-original1234567890abcdef',
      'in-memory record must not be mutated by redaction');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
