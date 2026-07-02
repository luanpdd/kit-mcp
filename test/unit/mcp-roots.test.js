// Phase 166 (v1.29) — Coverage for src/mcp-server/roots.js
//
// Tests the roots capability consumer in isolation:
//   - getRootsSupportLevel() defaults to 'unknown'
//   - getPrimaryProjectRoot() falls back to process.cwd() when no roots cached
//   - fetchRoots() handles success path (mock server.request)
//   - fetchRoots() handles unsupported host (mock server.request throws)
//   - getRoots() lazy-fetches on first call
//   - attachRootsCapability registers the notification handler

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {
  attachRootsCapability,
  fetchRoots,
  getRoots,
  getPrimaryProjectRoot,
  getRootsSupportLevel,
  __resetForTests,
} from '../../src/mcp-server/roots.js';

// Cross-platform helper: builds valid file:// URIs that fileURLToPath accepts
// on both POSIX (/tmp/...) and Windows (D:/...). Uses os.tmpdir() as base.
function makeFileURI(suffix) {
  return pathToFileURL(path.join(os.tmpdir(), suffix)).href;
}

function makeFakeServer(opts = {}) {
  const notificationHandlers = new Map();
  return {
    setNotificationHandler(schema, fn) {
      notificationHandlers.set(schema, fn);
    },
    async request(/* request, schema */) {
      if (opts.throws) throw new Error(opts.throws);
      return opts.result ?? { roots: [] };
    },
    _notificationHandlers: notificationHandlers,
  };
}

test('roots: getRootsSupportLevel starts as unknown', () => {
  __resetForTests();
  assert.equal(getRootsSupportLevel(), 'unknown');
});

test('roots: getPrimaryProjectRoot falls back to process.cwd()', () => {
  __resetForTests();
  assert.equal(getPrimaryProjectRoot(), process.cwd());
});

test('roots: fetchRoots success path caches and reports supported', async () => {
  __resetForTests();
  const server = makeFakeServer({
    result: { roots: [
      { uri: makeFileURI('project-a'), name: 'project' },
      { uri: makeFileURI('project-b') },
    ] },
  });
  const got = await fetchRoots(server);
  assert.equal(got.length, 2);
  assert.equal(getRootsSupportLevel(), 'supported');
  assert.ok(got[0].path && got[0].path.length > 0);
  assert.equal(got[0].name, 'project');
});

test('roots: fetchRoots failure path reports unsupported', async () => {
  __resetForTests();
  const server = makeFakeServer({ throws: 'method not found' });
  const got = await fetchRoots(server);
  assert.deepEqual(got, []);
  assert.equal(getRootsSupportLevel(), 'unsupported');
});

test('roots: fetchRoots tolerates malformed responses', async () => {
  __resetForTests();
  const server = makeFakeServer({ result: { roots: null } });
  const got = await fetchRoots(server);
  assert.deepEqual(got, []);
});

test('roots: fetchRoots filters out roots without valid file:// URI', async () => {
  __resetForTests();
  const server = makeFakeServer({
    result: { roots: [
      { uri: makeFileURI('valid-path') },
      { uri: 'http://not-a-file' },
      { uri: 'invalid' },
    ] },
  });
  const got = await fetchRoots(server);
  assert.equal(got.length, 1, 'only the file:// one survives uriToPath filter');
});

test('roots: fetchRoots accepts bare array response (SDK version tolerance)', async () => {
  __resetForTests();
  const server = makeFakeServer({
    result: [{ uri: makeFileURI('bare-array-x') }],
  });
  const got = await fetchRoots(server);
  assert.equal(got.length, 1);
});

test('roots: getRoots returns cache when present', async () => {
  __resetForTests();
  const server = makeFakeServer({ result: { roots: [{ uri: makeFileURI('cache-a') }] } });
  await fetchRoots(server);
  // Now getRoots should NOT re-call server.request — it returns cached.
  let called = 0;
  const noopServer = { request: () => { called++; throw new Error('should not call'); } };
  const got = await getRoots(noopServer);
  assert.equal(got.length, 1);
  assert.equal(called, 0);
});

test('roots: getRoots fetches lazily on first call', async () => {
  __resetForTests();
  let called = 0;
  const server = {
    setNotificationHandler: () => {},
    request: async () => { called++; return { roots: [{ uri: makeFileURI('lazy-root') }] }; },
  };
  const got = await getRoots(server);
  assert.equal(called, 1);
  assert.equal(got.length, 1);
});

test('roots: getPrimaryProjectRoot returns the first cached root path', async () => {
  __resetForTests();
  const server = makeFakeServer({
    result: { roots: [{ uri: makeFileURI('primary-root') }] },
  });
  await fetchRoots(server);
  const primary = getPrimaryProjectRoot();
  assert.ok(primary.includes('primary-root'), `expected 'primary-root' in path, got ${primary}`);
});

test('roots: __resetForTests fallback equals process.cwd() exactly', async () => {
  __resetForTests();
  // No roots fetched yet — should return cwd. Test that EQUAL not just
  // notEqual to make sure the fallback is reliable.
  assert.equal(getPrimaryProjectRoot(), process.cwd());
});

test('roots: attachRootsCapability registers list_changed notification handler', () => {
  __resetForTests();
  const server = makeFakeServer({});
  attachRootsCapability(server);
  // The handler should have been registered with the RootsListChangedNotificationSchema.
  // We can't easily compare schemas without importing them, so we just check
  // that ONE handler was registered.
  assert.equal(server._notificationHandlers.size, 1);
});

test('roots: __resetForTests clears cache and support level', async () => {
  const server = makeFakeServer({ result: { roots: [{ uri: 'file:///x' }] } });
  await fetchRoots(server);
  assert.equal(getRootsSupportLevel(), 'supported');
  __resetForTests();
  assert.equal(getRootsSupportLevel(), 'unknown');
  assert.equal(getPrimaryProjectRoot(), process.cwd());
});
