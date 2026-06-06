// Phase 172 — path-normalize unit tests.
//
// Invariantes verificadas:
//  - splitConfigDirs respeita ';' no win32 e ':' em POSIX.
//  - splitConfigDirs com env vazio retorna [].
//  - isPathAlive(-1) e isPathAlive(0) → false (PID inválido).
//  - isPathAlive(pid_corrente) → true.
//  - isPathAlive(999_999_999) → false (ESRCH esperado em qualquer plataforma sã).
//  - toPosix converte backslashes para slashes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { splitConfigDirs, isPathAlive, toPosix, joinPosix } from '../../src/core/cost/path-normalize.js';

test('splitConfigDirs respects win32 semicolon separator', () => {
  const out = splitConfigDirs('C:\\a;D:\\b;E:\\c', 'win32');
  assert.deepEqual(out, ['C:\\a', 'D:\\b', 'E:\\c']);
});

test('splitConfigDirs respects POSIX colon separator', () => {
  const out = splitConfigDirs('/home/a:/opt/b:/var/c', 'linux');
  assert.deepEqual(out, ['/home/a', '/opt/b', '/var/c']);
});

test('splitConfigDirs trims entries and drops empties', () => {
  const out = splitConfigDirs(' /a : :/b: ', 'linux');
  assert.deepEqual(out, ['/a', '/b']);
});

test('splitConfigDirs handles undefined/empty input', () => {
  assert.deepEqual(splitConfigDirs(undefined), []);
  assert.deepEqual(splitConfigDirs(''), []);
  assert.deepEqual(splitConfigDirs(null), []);
});

test('isPathAlive returns true for current process', () => {
  assert.equal(isPathAlive(process.pid), true);
});

test('isPathAlive returns false for impossible PID', () => {
  // 999_999_999 deve ESRCH em qualquer SO realista. Nunca true.
  assert.equal(isPathAlive(999_999_999), false);
});

test('isPathAlive returns false for invalid inputs', () => {
  assert.equal(isPathAlive(0), false);
  assert.equal(isPathAlive(-1), false);
  assert.equal(isPathAlive(NaN), false);
  assert.equal(isPathAlive('abc'), false);
});

test('toPosix converts backslashes to forward slashes', () => {
  assert.equal(toPosix('C:\\Users\\dev\\app'), 'C:/Users/dev/app');
  assert.equal(toPosix('/already/posix/path'), '/already/posix/path');
  assert.equal(toPosix(''), '');
  assert.equal(toPosix(undefined), '');
});

test('joinPosix produces posix output even on win32', () => {
  // Não importa a plataforma do runner: o resultado precisa ter '/'.
  const out = joinPosix('a', 'b', 'c.json');
  assert.equal(out.includes('\\'), false);
});
