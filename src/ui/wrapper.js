// src/ui/wrapper.js
// Wrap an existing onProgress callback so that calls also publish to the sidecar.
// Used at callsites (CLI handlers, MCP tool handlers) — NEVER imported by core
// (`syncTo`, `applyReverse`). The Stable API of core stays untouched (REQ).
//
// Also exports redactPath: a helper that scrubs the user's $HOME and the project
// root from any string before it leaves this process. Applied uniformly here so
// that path-leak protection is centralized (REQ SEC-05).

import os from 'node:os';
import path from 'node:path';
import { publish } from './client.js';
import { makeEvent, newRunId } from './events.js';

// Convert any value into a payload-safe shape with paths redacted.
// We touch strings only — numbers/booleans/null pass through. Nested objects
// and arrays are walked.
const HOME = os.homedir() || '';

function escapeForReplace(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactPath(value, projectRoot) {
  if (typeof value === 'string') {
    let out = value;
    if (projectRoot) {
      const re = new RegExp(escapeForReplace(projectRoot), 'g');
      out = out.replace(re, '<project>');
    }
    if (HOME) {
      const re = new RegExp(escapeForReplace(HOME), 'g');
      out = out.replace(re, '~');
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactPath(v, projectRoot));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = redactPath(value[k], projectRoot);
    }
    return out;
  }
  return value;
}

// wrapProgressForUi(originalCb, ctx) returns a function with the same signature
// as the existing onProgress callback. Calls originalCb (terminal output) AND
// publishes to the sidecar. The sidecar publish is fire-and-forget; the wrapped
// callback never throws even if the sidecar isn't running.
//
// ctx: { projectRoot, runId?, tool? }
//   - projectRoot — required for redaction + lockfile resolution
//   - runId       — defaults to a fresh runId per wrapper instance
//   - tool        — short label (e.g. 'sync', 'reverse-sync', 'gates') for grouping
export function wrapProgressForUi(originalCb, ctx) {
  if (typeof originalCb !== 'function' && originalCb != null) {
    throw new TypeError('originalCb must be a function or null/undefined');
  }
  if (!ctx || typeof ctx.projectRoot !== 'string') {
    throw new TypeError('wrapProgressForUi requires ctx.projectRoot: string');
  }
  const projectRoot = ctx.projectRoot;
  const runId = ctx.runId ?? newRunId();
  const tool = ctx.tool ?? null;

  // Best-effort fire-and-forget. We deliberately swallow errors — the wrapper
  // must never break the caller because the optional UI isn't up.
  function emit(event) {
    publish(event, { projectRoot }).catch(() => { /* noop */ });
  }

  // Emit a run.start as soon as the wrapper is created. Caller can also emit
  // run.end manually (or use the `done` helper below).
  emit(makeEvent({
    type: 'run.start',
    runId,
    payload: redactPath({ tool, projectRoot, ts: Date.now() }, projectRoot),
  }));

  function wrapped(progress) {
    // Forward to the original callback first — if the user supplied none, skip.
    if (typeof originalCb === 'function') {
      try { originalCb(progress); } catch { /* surface from caller, not us */ }
    }
    // Convert the canonical onProgress shape ({percent, label, kind}) into a
    // sidecar 'progress' event. Pass extra fields through unchanged (redacted).
    const safe = redactPath({ tool, ...progress }, projectRoot);
    emit(makeEvent({ type: 'progress', runId, payload: safe }));
  }

  // Helpers for the caller — not strictly part of the onProgress signature, so
  // we attach them as properties.
  wrapped.runId = runId;
  wrapped.emit = (type, payload) => emit(makeEvent({
    type,
    runId,
    payload: redactPath(payload, projectRoot),
  }));
  wrapped.done = (payload = {}) => emit(makeEvent({
    type: 'run.end',
    runId,
    payload: redactPath({ tool, ...payload }, projectRoot),
  }));
  wrapped.error = (err) => emit(makeEvent({
    type: 'error',
    runId,
    payload: redactPath({
      tool,
      message: err?.message ?? String(err),
      code: err?.code ?? null,
    }, projectRoot),
  }));

  return wrapped;
}
