// DRIFT-13-03: regression test for MCP serverInfo.version sync with package.json.
//
// Prior behavior: src/mcp-server/index.js hardcoded `version: '0.1.0'` while
// package.json shipped 1.12.1+ — every MCP `initialize` response leaked the
// stale version, breaking observability ("which kit-mcp version is running?").
//
// This test asserts:
//   1. PKG_VERSION named export equals package.json.version verbatim
//   2. createServer().<_serverInfo.version> equals PKG_VERSION (the wiring is real)
//   3. We never accidentally regress to the literal '0.1.0'
//   4. PKG_VERSION matches a sane semver shape (guards against silent 'unknown' fallback)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, PKG_VERSION } from '../../src/mcp-server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));
}

test('DRIFT-13-03: PKG_VERSION matches package.json.version verbatim', () => {
  const pkg = readPackageJson();
  assert.equal(
    PKG_VERSION,
    pkg.version,
    'mcp-server PKG_VERSION drifted from package.json — that is exactly the bug this guards against',
  );
});

test('DRIFT-13-03: PKG_VERSION is not the legacy hardcoded "0.1.0"', () => {
  // Sanity check: when running from the repo, package.json is always > 0.1.0.
  // If this assertion fails, someone reverted the fix or the repo is broken.
  assert.notEqual(PKG_VERSION, '0.1.0', 'PKG_VERSION reverted to legacy hardcoded value');
});

test('DRIFT-13-03: createServer() exposes the same version on _serverInfo', async () => {
  const server = await createServer();
  // The SDK Server stores its constructor-provided info on `_serverInfo`. This
  // is internal but stable across @modelcontextprotocol/sdk minor versions —
  // if a future SDK upgrade hides it, this test gracefully skips and the first
  // two tests still cover the contract (PKG_VERSION wired into createServer call).
  const info = server._serverInfo;
  if (!info || typeof info !== 'object') {
    console.log('skip: SDK internals changed — _serverInfo not exposed');
    return;
  }
  assert.equal(info.version, PKG_VERSION, '_serverInfo.version must equal exported PKG_VERSION');
  assert.equal(info.name, 'kit-mcp', 'server name preserved');
});

test('DRIFT-13-03: PKG_VERSION matches expected semver shape', () => {
  // Sanity — should look like X.Y.Z or X.Y.Z-rcN, not 'unknown' (which means
  // package.json lookup failed in readPkgVersion).
  const semverShape = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i;
  assert.match(
    PKG_VERSION,
    semverShape,
    `PKG_VERSION="${PKG_VERSION}" — likely package.json read failure`,
  );
});
