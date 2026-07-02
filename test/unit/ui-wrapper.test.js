import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { redactPath, wrapProgressForUi } from '../../src/ui/wrapper.js';

const HOME = os.homedir() || '';

test('redactPath: replaces $HOME with ~', () => {
  if (!HOME) return; // CI without HOME — skip rather than fail
  assert.equal(redactPath(HOME + '/code/x.js'), '~/code/x.js');
});

test('redactPath: replaces projectRoot with <project>', () => {
  const root = path.join(os.tmpdir(), 'fakeproj-1234');
  const input = `building ${root}/src/foo.js for ${root}`;
  assert.equal(redactPath(input, root), 'building <project>/src/foo.js for <project>');
});

// SEC-03: Windows-style path with mixed separators / casing should still redact.
test('redactPath: redacts Windows-style backslash paths case-insensitively', () => {
  const root = 'C:\\Users\\Foo\\proj';
  const variants = [
    'C:\\Users\\Foo\\proj\\src\\bar.js',  // exact
    'c:\\users\\foo\\proj\\src\\bar.js',  // lowercase
    'C:/Users/Foo/proj/src/bar.js',       // forward slash
    'C:\\users\\Foo\\proj/src\\bar.js',   // mixed
  ];
  for (const v of variants) {
    const out = redactPath(v, root);
    assert.ok(out.startsWith('<project>'), `expected <project> prefix in: ${v} → ${out}`);
  }
});

test('redactPath: walks objects and arrays', () => {
  const root = '/proj/x';
  const input = {
    a: '/proj/x/file.js',
    arr: ['/proj/x/a', '/proj/x/b'],
    nested: { p: '/proj/x/c.md' },
    n: 42,
    b: true,
    nul: null,
  };
  const out = redactPath(input, root);
  assert.equal(out.a, '<project>/file.js');
  assert.deepEqual(out.arr, ['<project>/a', '<project>/b']);
  assert.equal(out.nested.p, '<project>/c.md');
  assert.equal(out.n, 42);
  assert.equal(out.b, true);
  assert.equal(out.nul, null);
});

test('redactPath: passes through values that are not strings', () => {
  assert.equal(redactPath(42), 42);
  assert.equal(redactPath(null), null);
  assert.equal(redactPath(undefined), undefined);
  assert.equal(redactPath(true), true);
});

test('redactPath: handles regex special chars in projectRoot safely', () => {
  const root = '/p/r.o.j+ect[v1]/';
  const input = `${root}foo.js (${root})`;
  // Should not throw a regex error and should still substitute.
  const out = redactPath(input, root);
  assert.match(out, /<project>foo\.js/);
});

test('wrapProgressForUi: requires projectRoot', () => {
  assert.throws(() => wrapProgressForUi(() => {}, {}), TypeError);
  assert.throws(() => wrapProgressForUi(() => {}, { projectRoot: 5 }), TypeError);
});

test('wrapProgressForUi: returns a function with helpers', () => {
  const fake = () => {};
  const w = wrapProgressForUi(fake, { projectRoot: '/tmp/x', tool: 'sync' });
  assert.equal(typeof w, 'function');
  assert.equal(typeof w.runId, 'string');
  assert.equal(typeof w.emit, 'function');
  assert.equal(typeof w.done, 'function');
  assert.equal(typeof w.error, 'function');
});

test('wrapProgressForUi: calls original callback', () => {
  let received = null;
  const w = wrapProgressForUi((p) => { received = p; }, { projectRoot: '/tmp/x', tool: 'sync' });
  w({ percent: 25, label: 'building' });
  assert.deepEqual(received, { percent: 25, label: 'building' });
});

test('wrapProgressForUi: never throws when called even if originalCb throws', () => {
  const w = wrapProgressForUi(() => { throw new Error('boom'); }, { projectRoot: '/tmp/x' });
  // Should NOT propagate the error. (Failures in user callbacks are their concern.)
  assert.doesNotThrow(() => w({ percent: 50 }));
});

test('wrapProgressForUi: accepts null/undefined originalCb', () => {
  const w = wrapProgressForUi(null, { projectRoot: '/tmp/x' });
  assert.doesNotThrow(() => w({ percent: 0 }));
  const w2 = wrapProgressForUi(undefined, { projectRoot: '/tmp/x' });
  assert.doesNotThrow(() => w2({ percent: 0 }));
});

test('wrapProgressForUi: rejects non-function originalCb', () => {
  assert.throws(() => wrapProgressForUi(42, { projectRoot: '/tmp/x' }), TypeError);
});
