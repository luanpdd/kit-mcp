import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { findFreePort, findFreePortOrThrow, DEFAULT_PORT_RANGE } from '../../src/ui/port.js';

test('DEFAULT_PORT_RANGE is 7100-7199', () => {
  assert.equal(DEFAULT_PORT_RANGE.start, 7100);
  assert.equal(DEFAULT_PORT_RANGE.end, 7199);
});

test('findFreePort returns a port in range when available', async () => {
  const port = await findFreePort({ start: 50000, end: 50010 });
  assert.ok(port !== null, 'expected a port in 50000..50010');
  assert.ok(port >= 50000 && port <= 50010);
});

test('findFreePort skips taken ports', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(50100, '127.0.0.1', resolve));
  try {
    const port = await findFreePort({ start: 50100, end: 50105 });
    assert.notEqual(port, 50100, 'must skip the blocked port');
    assert.ok(port > 50100 && port <= 50105);
  } finally {
    blocker.close();
  }
});

test('findFreePort returns null when range exhausted', async () => {
  // Take a tiny range and block both ports
  const blockers = [];
  for (let p = 50200; p <= 50201; p += 1) {
    const s = net.createServer();
    blockers.push(s);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => s.listen(p, '127.0.0.1', resolve));
  }
  try {
    const port = await findFreePort({ start: 50200, end: 50201 });
    assert.equal(port, null);
  } finally {
    blockers.forEach((s) => s.close());
  }
});

test('findFreePortOrThrow throws with helpful message when exhausted', async () => {
  const blockers = [];
  for (let p = 50300; p <= 50301; p += 1) {
    const s = net.createServer();
    blockers.push(s);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => s.listen(p, '127.0.0.1', resolve));
  }
  try {
    await assert.rejects(
      () => findFreePortOrThrow({ start: 50300, end: 50301 }),
      /No free TCP port in 50300..50301/,
    );
  } finally {
    blockers.forEach((s) => s.close());
  }
});

test('findFreePort rejects invalid range', async () => {
  await assert.rejects(() => findFreePort({ start: 100, end: 50 }), TypeError);
});
