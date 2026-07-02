// src/ui/events.js
// Schema and helpers for sidecar event payloads.
// Pure module: no I/O, no module-level state. Safe to import from any context.

import { randomBytes } from 'node:crypto';

export const EVENT_TYPES = Object.freeze([
  'run.start',
  'run.end',
  'tool_invocation',
  'progress',
  'milestone',
  'error',
  'shutdown',
]);

export const EVENT_TYPE_SET = new Set(EVENT_TYPES);

const MAX_PAYLOAD_BYTES = 64 * 1024;

export function newRunId() {
  return randomBytes(8).toString('hex');
}

export function makeEvent({ type, runId, payload, ts }) {
  if (!EVENT_TYPE_SET.has(type)) {
    throw new TypeError(`Unknown event type: ${type}. Valid: ${EVENT_TYPES.join(', ')}`);
  }
  return {
    type,
    ts: typeof ts === 'number' ? ts : Date.now(),
    runId: runId ?? null,
    payload: payload ?? null,
  };
}

// validateEvent returns null on success, or an Error explaining the rejection.
// Used by the server's POST /publish endpoint. Never throws.
export function validateEvent(value) {
  if (value === null || typeof value !== 'object') {
    return new Error('event must be an object');
  }
  if (!EVENT_TYPE_SET.has(value.type)) {
    return new Error(`event.type must be one of ${EVENT_TYPES.join(', ')}`);
  }
  if (typeof value.ts !== 'number' || !Number.isFinite(value.ts)) {
    return new Error('event.ts must be a finite number (epoch ms)');
  }
  if (value.runId !== null && value.runId !== undefined && typeof value.runId !== 'string') {
    return new Error('event.runId must be string or null');
  }
  // payload may be anything serializable; cap raw size
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (err) {
    return new Error(`event not serializable: ${err.message}`);
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    return new Error(`event exceeds ${MAX_PAYLOAD_BYTES} bytes (got ${Buffer.byteLength(serialized, 'utf8')})`);
  }
  return null;
}

export const __test = { MAX_PAYLOAD_BYTES };
