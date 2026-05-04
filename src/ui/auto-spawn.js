// src/ui/auto-spawn.js
// Spawn the sidecar in a detached subprocess and wait until it's healthy.
// Used by MCP tool handlers when the caller passes `autoSpawn: true` and no
// sidecar lockfile is present for the project.
//
// Discipline: stderr/file logging only. Audit gate enforced.

import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readLock } from './lockfile.js';
import { openBrowser } from './browser.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// src/ui → src → repo root → bin/ui.js
const UI_BIN = path.resolve(HERE, '..', '..', 'bin', 'ui.js');

const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 5000;

// healthzOk returns true if GET /healthz on this port responds 200 within 1s.
function healthzOk(port) {
  return new Promise((resolve) => {
    const req = http.request({
      method: 'GET',
      host: '127.0.0.1',
      port,
      path: '/healthz',
      agent: false,
      headers: { host: `127.0.0.1:${port}`, connection: 'close' },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => { try { req.destroy(); } catch { /* noop */ } resolve(false); });
    req.end();
  });
}

async function waitForHealth(projectRoot, deadline) {
  // Poll for lockfile + healthz until deadline.
  while (Date.now() < deadline) {
    const lock = readLock(projectRoot);
    if (lock?.port) {
      // eslint-disable-next-line no-await-in-loop
      if (await healthzOk(lock.port)) return lock;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}

// ensureSidecar({projectRoot, openBrowser?}): if a sidecar is already running
// for this projectRoot, returns immediately with its lock metadata. Otherwise
// spawns bin/ui.js detached and waits for it to come online, then optionally
// opens the browser. Resolves to:
//   { ready: true, port, spawned: bool, opened: bool }   on success
//   { ready: false, reason }                             on timeout/spawn-fail
export async function ensureSidecar({ projectRoot, openBrowserOnSpawn = true } = {}) {
  if (!projectRoot) return { ready: false, reason: 'no_project_root' };

  // Already running?
  const existing = readLock(projectRoot);
  if (existing?.port) {
    if (await healthzOk(existing.port)) {
      return { ready: true, port: existing.port, spawned: false, opened: false };
    }
    // Stale lockfile — let the spawn step reclaim it.
  }

  // Spawn detached. Inherits stderr only — stdout is closed so a buggy child
  // can never poison parent's stdout (e.g. when the parent is the MCP server
  // running on stdio).
  let child;
  try {
    child = spawn(process.execPath, [UI_BIN, '--project-root', projectRoot], {
      detached: true,
      stdio: ['ignore', 'ignore', 'inherit'],
      windowsHide: true,
    });
    child.unref();
  } catch (err) {
    return { ready: false, reason: `spawn_failed: ${err.message}` };
  }

  // Wait for it to come online.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  const lock = await waitForHealth(projectRoot, deadline);
  if (!lock) {
    return { ready: false, reason: 'healthz_timeout' };
  }

  let opened = false;
  if (openBrowserOnSpawn) {
    const url = `http://127.0.0.1:${lock.port}/`;
    const r = await openBrowser(url);
    opened = r.opened === true;
  }

  return { ready: true, port: lock.port, spawned: true, opened };
}

export const __test = { healthzOk, UI_BIN, POLL_INTERVAL_MS, POLL_TIMEOUT_MS };
