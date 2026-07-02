import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES, makeEvent, newRunId, validateEvent, __test } from '../../src/ui/events.js';

test('EVENT_TYPES includes all required types and is frozen', () => {
  assert.ok(EVENT_TYPES.includes('run.start'));
  assert.ok(EVENT_TYPES.includes('run.end'));
  assert.ok(EVENT_TYPES.includes('tool_invocation'));
  assert.ok(EVENT_TYPES.includes('progress'));
  assert.ok(EVENT_TYPES.includes('milestone'));
  assert.ok(EVENT_TYPES.includes('error'));
  assert.ok(EVENT_TYPES.includes('shutdown'));
  assert.ok(Object.isFrozen(EVENT_TYPES));
});

test('newRunId returns 16-char hex unique strings', () => {
  const a = newRunId();
  const b = newRunId();
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.match(b, /^[0-9a-f]{16}$/);
  assert.notEqual(a, b);
});

test('makeEvent stamps ts and runId', () => {
  const evt = makeEvent({ type: 'progress', payload: { percent: 50 } });
  assert.equal(evt.type, 'progress');
  assert.equal(typeof evt.ts, 'number');
  assert.equal(evt.runId, null);
  assert.deepEqual(evt.payload, { percent: 50 });
});

test('makeEvent rejects unknown type', () => {
  assert.throws(() => makeEvent({ type: 'bogus' }), TypeError);
});

test('validateEvent: valid event returns null', () => {
  const evt = makeEvent({ type: 'progress' });
  assert.equal(validateEvent(evt), null);
});

test('validateEvent: rejects non-object', () => {
  assert.ok(validateEvent('hi') instanceof Error);
  assert.ok(validateEvent(null) instanceof Error);
  assert.ok(validateEvent(42) instanceof Error);
});

test('validateEvent: rejects unknown type', () => {
  assert.ok(validateEvent({ type: 'wat', ts: Date.now() }) instanceof Error);
});

test('validateEvent: rejects missing ts', () => {
  assert.ok(validateEvent({ type: 'progress' }) instanceof Error);
});

test('validateEvent: rejects oversized payload', () => {
  const big = 'x'.repeat(__test.MAX_PAYLOAD_BYTES + 100);
  const evt = { type: 'progress', ts: Date.now(), runId: null, payload: big };
  const err = validateEvent(evt);
  assert.ok(err instanceof Error);
  assert.match(err.message, /exceeds/);
});

test('validateEvent: rejects unserializable payload', () => {
  const circular = { type: 'progress', ts: Date.now(), runId: null, payload: {} };
  circular.payload.self = circular.payload;
  const err = validateEvent(circular);
  assert.ok(err instanceof Error);
});
