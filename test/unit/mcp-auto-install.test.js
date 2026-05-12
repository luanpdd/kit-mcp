// Phase 167 + 168 (v1.29) — Coverage for handleAutoInstall and handleAckRestart.
//
// These tests use a temp dir set up as a fake git workspace so
// validateProjectRoot passes. Each test isolates its own dir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { __TEST_HANDLERS } from '../../src/mcp-server/index.js';

const { handleAutoInstall, handleAckRestart } = __TEST_HANDLERS;

async function makeWorkspace(name) {
  const dir = path.join(os.tmpdir(), `kit-mcp-test-${name}-${Date.now()}-${process.pid}`);
  await fs.mkdir(dir, { recursive: true });
  execSync('git init -q', { cwd: dir });
  // Add a fake remote so any path-safety checks pass.
  return dir;
}

async function cleanup(dir) {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* swallow */ }
}

test('auto-install: action=check on uninstalled project reports inSync=false', async () => {
  const dir = await makeWorkspace('check-uninstalled');
  try {
    const r = await handleAutoInstall({ action: 'check', projectRoot: dir });
    assert.equal(r.ok, true);
    assert.equal(r.action, 'check');
    assert.equal(r.inSync, false);
    assert.equal(r.installedVersion, null);
    assert.ok(typeof r.currentVersion === 'string');
    assert.equal(r.restartRecommended, false);
  } finally {
    await cleanup(dir);
  }
});

test('auto-install: action=install writes .claude/.kit-mcp-version + restart marker', async () => {
  const dir = await makeWorkspace('install-fresh');
  try {
    const r = await handleAutoInstall({ action: 'install', projectRoot: dir });
    assert.equal(r.ok, true);
    assert.equal(r.action, 'install');
    assert.equal(r.restartRecommended, true);
    assert.equal(r._kit_action, 'session_restart_recommended');
    assert.ok(r.written > 0, 'should report files written');

    // Version marker present and matches.
    const versionMarker = path.join(dir, '.claude', '.kit-mcp-version');
    const version = (await fs.readFile(versionMarker, 'utf8')).trim();
    assert.equal(version, r.version);

    // Restart marker present with structured JSON.
    const restartMarker = path.join(dir, '.claude', '.kit-mcp-restart-required');
    const payload = JSON.parse(await fs.readFile(restartMarker, 'utf8'));
    assert.equal(payload.version, r.version);
    assert.equal(payload.previousVersion, null);
    assert.ok(payload.writtenAt);
    assert.ok(payload.reason);
  } finally {
    await cleanup(dir);
  }
});

test('auto-install: re-running on in-sync project is a no-op', async () => {
  const dir = await makeWorkspace('install-idempotent');
  try {
    await handleAutoInstall({ action: 'install', projectRoot: dir });
    // Second call should skip.
    const r2 = await handleAutoInstall({ action: 'install', projectRoot: dir });
    assert.equal(r2.ok, true);
    assert.equal(r2.skipped, true);
    assert.equal(r2.reason, 'already in sync');
    assert.equal(r2.restartRecommended, false);
  } finally {
    await cleanup(dir);
  }
});

test('auto-install: force=true re-writes even if in sync', async () => {
  const dir = await makeWorkspace('install-force');
  try {
    await handleAutoInstall({ action: 'install', projectRoot: dir });
    const r2 = await handleAutoInstall({ action: 'install', projectRoot: dir, force: true });
    assert.equal(r2.ok, true);
    assert.equal(r2.skipped, undefined, 'force should bypass skip');
    assert.equal(r2.restartRecommended, true);
  } finally {
    await cleanup(dir);
  }
});

test('auto-install: action=check on installed project reports inSync=true', async () => {
  const dir = await makeWorkspace('check-installed');
  try {
    const inst = await handleAutoInstall({ action: 'install', projectRoot: dir });
    const r = await handleAutoInstall({ action: 'check', projectRoot: dir });
    assert.equal(r.ok, true);
    assert.equal(r.inSync, true);
    assert.equal(r.installedVersion, inst.version);
    assert.equal(r.currentVersion, inst.version);
  } finally {
    await cleanup(dir);
  }
});

test('auto-install: invalid projectRoot returns ok:false', async () => {
  const r = await handleAutoInstall({
    action: 'install',
    projectRoot: '/this/path/does/not/exist/abc123',
  });
  assert.equal(r.ok, false);
  assert.ok(r.reason, 'should include reason');
});

test('ack-restart: removes .kit-mcp-restart-required marker', async () => {
  const dir = await makeWorkspace('ack-with-marker');
  try {
    await handleAutoInstall({ action: 'install', projectRoot: dir });
    const restartMarker = path.join(dir, '.claude', '.kit-mcp-restart-required');
    // Marker is present.
    await fs.access(restartMarker);

    const r = await handleAckRestart({ projectRoot: dir });
    assert.equal(r.ok, true);
    assert.equal(r.acked, true);

    // Marker removed.
    let removed = false;
    try { await fs.access(restartMarker); } catch (e) { removed = e.code === 'ENOENT'; }
    assert.ok(removed, 'restart marker should be deleted');
  } finally {
    await cleanup(dir);
  }
});

test('ack-restart: no marker → acked:false but ok:true (idempotent)', async () => {
  const dir = await makeWorkspace('ack-no-marker');
  try {
    const r = await handleAckRestart({ projectRoot: dir });
    assert.equal(r.ok, true);
    assert.equal(r.acked, false);
    assert.match(r.reason, /no restart marker present|nothing to ack/i);
  } finally {
    await cleanup(dir);
  }
});

test('ack-restart: invalid projectRoot returns ok:false', async () => {
  const r = await handleAckRestart({
    projectRoot: '/this/path/does/not/exist/xyz789',
  });
  assert.equal(r.ok, false);
});
