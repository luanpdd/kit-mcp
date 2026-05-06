import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __test, getLocalVersion } from '../../src/cli/upgrade-check.js';

const { compareVersions, PACKAGE_NAME, CHECK_TTL_MS } = __test;

test('compareVersions — equal returns 0', () => {
  assert.equal(compareVersions('1.5.3', '1.5.3'), 0);
});

test('compareVersions — major bump', () => {
  assert.equal(compareVersions('1.5.3', '2.0.0'), -1);
  assert.equal(compareVersions('2.0.0', '1.5.3'), 1);
});

test('compareVersions — minor bump', () => {
  assert.equal(compareVersions('1.5.3', '1.6.0'), -1);
  assert.equal(compareVersions('1.6.0', '1.5.3'), 1);
});

test('compareVersions — patch bump', () => {
  assert.equal(compareVersions('1.5.3', '1.5.4'), -1);
  assert.equal(compareVersions('1.5.4', '1.5.3'), 1);
});

test('compareVersions — handles missing components as 0', () => {
  assert.equal(compareVersions('1.5', '1.5.0'), 0);
  assert.equal(compareVersions('2', '2.0.0'), 0);
});

test('PACKAGE_NAME points at the right scoped package', () => {
  assert.equal(PACKAGE_NAME, '@luanpdd/kit-mcp');
});

test('CHECK_TTL_MS is 24 hours', () => {
  assert.equal(CHECK_TTL_MS, 24 * 60 * 60 * 1000);
});

test('getLocalVersion returns a version-shaped string', async () => {
  const v = await getLocalVersion();
  assert.ok(v, 'should resolve to a version');
  assert.match(v, /^\d+\.\d+\.\d+/, `expected semver-like, got ${v}`);
});
