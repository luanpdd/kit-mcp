// SEC-13-02: regression tests for replayId path traversal hardening.
// Covers all 3 callers of validated id (loadReplay, annotateReplay, recordReplay)
// + a happy-path "valid id continues to work" assertion to prove zero
// regression on the legitimate API surface.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadReplay, annotateReplay, recordReplay } from '../../src/core/replays.js';

async function tmpProject() {
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-replay-test-'));
  await mkdir(path.join(root, '.planning', 'replays'), { recursive: true });
  return root;
}

test('SEC-13-02: loadReplay rejects traversal id', async () => {
  const root = await tmpProject();
  try {
    await assert.rejects(
      loadReplay('../etc/passwd', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('..', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('foo/bar', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('foo\\bar', { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      loadReplay('', { projectRoot: root }),
      /invalid replay id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-02: annotateReplay rejects traversal id', async () => {
  const root = await tmpProject();
  try {
    await assert.rejects(
      annotateReplay('../etc/passwd', { status: 'pwned' }, { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      annotateReplay('..', { status: 'pwned' }, { projectRoot: root }),
      /invalid replay id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-02: recordReplay rejects malicious slug components', async () => {
  const root = await tmpProject();
  try {
    await assert.rejects(
      recordReplay({ phase: '../../../etc', plan: '01', agent: 'pwn' }, { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      recordReplay({ phase: '79', plan: '..', agent: 'planner' }, { projectRoot: root }),
      /invalid replay id/,
    );
    await assert.rejects(
      recordReplay({ phase: '79', plan: '01', agent: 'pwn/payload' }, { projectRoot: root }),
      /invalid replay id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-13-02: valid replayId continues to work', async () => {
  const root = await tmpProject();
  try {
    // record a replay first (valid components)
    const rec = await recordReplay(
      { phase: '79', plan: '01', agent: 'planner', prompt: 'test' },
      { projectRoot: root }
    );
    assert.ok(rec.id);
    assert.ok(rec.file);

    // load with the returned id
    const loaded = await loadReplay(rec.id, { projectRoot: root });
    assert.equal(loaded.id, rec.id);
    assert.equal(loaded.phase, '79');

    // annotate with the same id
    const annotated = await annotateReplay(
      rec.id,
      { status: 'success', notes: 'ok' },
      { projectRoot: root }
    );
    assert.equal(annotated.outcome.status, 'success');
    assert.ok(annotated.outcome.annotated_at);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
