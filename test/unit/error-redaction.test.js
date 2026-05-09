// SEC-14-06 unit tests for src/core/error-redaction.js — pure helper.
//
// Coverage matrix:
//   - 7 positive redactions (sk-ant, sk- generic, x-api-key, Bearer, Win path,
//     Unix path under /home, /Users, /root)
//   - 6 NEGATIVE cases proving no-false-positives ("Compare A:B", "Modal:",
//     "https://...", "Bearer x", "sk-foo", "/etc/passwd")
//   - 4 defensive cases (null, undefined, number, object-with-toString)
//   - 5 sanitizeMcpError shape assertions (incl. Phase 83 EMANIFESTMISMATCH
//     code preservation + zero-stack invariant)
//
// Total: 22 named assertions. Pure unit — no fs, no spawn, no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets, sanitizeMcpError } from '../../src/core/error-redaction.js';

// --- redactSecrets: positive matches ---

test('SEC-14-06: redactSecrets strips sk-ant-* anthropic key', () => {
  const out = redactSecrets('foo sk-ant-abc123def456ghi789jkl012 bar');
  assert.equal(out, 'foo [REDACTED:anthropic_key] bar');
  assert.ok(!out.includes('sk-ant-'), 'no sk-ant- prefix should remain');
});

test('SEC-14-06: redactSecrets strips Bearer token (>=20 chars)', () => {
  const out = redactSecrets('Authorization: Bearer abcdef0123456789abcdef0123456789');
  assert.equal(out, 'Authorization: Bearer [REDACTED]');
});

test('SEC-14-06: redactSecrets strips x-api-key header value', () => {
  // Must redact whole header value — even if value happens to look like an sk- key
  const out = redactSecrets('x-api-key: sk-1234567890123456789012345');
  assert.equal(out, 'x-api-key: [REDACTED]');
  assert.ok(!out.includes('sk-12345'), 'header value must be entirely scrubbed');
});

test('SEC-14-06: redactSecrets strips Windows absolute path', () => {
  const out = redactSecrets('Error reading D:\\Users\\victim\\.ssh\\id_rsa');
  assert.equal(out, 'Error reading [PATH]');
});

test('SEC-14-06: redactSecrets strips Unix /home/* path', () => {
  const out = redactSecrets('failed at /home/alice/project/file.js:33');
  assert.equal(out, 'failed at [PATH]');
});

test('SEC-14-06: redactSecrets strips Unix /Users/* path (macOS)', () => {
  const out = redactSecrets('failed at /Users/bob/code/app.js');
  assert.equal(out, 'failed at [PATH]');
});

test('SEC-14-06: redactSecrets strips Unix /root/* path', () => {
  const out = redactSecrets('failed at /root/config');
  assert.equal(out, 'failed at [PATH]');
});

// --- redactSecrets: NEGATIVE cases (must NOT match) ---

test('SEC-14-06: redactSecrets does NOT touch "Compare A:B" (no slash after colon)', () => {
  // The Windows-path regex requires `[A-Z]:[\\\/]` — the `:` must be followed
  // by either `\` or `/`. "A:B" lacks that, so no match.
  const input = 'Compare A:B in the diff';
  assert.equal(redactSecrets(input), input);
});

test('SEC-14-06: redactSecrets does NOT touch "Modal: hello" (single colon, no slash)', () => {
  const input = 'Modal: hello world';
  assert.equal(redactSecrets(input), input);
});

test('SEC-14-06: redactSecrets does NOT touch lowercase HTTPS URL', () => {
  // "https://" starts lowercase — the [A-Z] character class fails on `h`.
  const input = 'Visit https://example.com/path';
  assert.equal(redactSecrets(input), input);
});

test('SEC-14-06: redactSecrets does NOT touch "Bearer x" (below 20-char minimum)', () => {
  const input = 'Bearer x';
  assert.equal(redactSecrets(input), input);
});

test('SEC-14-06: redactSecrets does NOT touch "sk-foo" (below 20-char minimum)', () => {
  const input = 'sk-foo';
  assert.equal(redactSecrets(input), input);
});

test('SEC-14-06: redactSecrets does NOT touch /etc/passwd (etc not in allowlist)', () => {
  // Allowlist is {home, Users, root} — /etc/* is NOT covered. Reasoning: the
  // threat model is "leak the user's home dir / project layout", not arbitrary
  // system paths that already could not exist on a different machine.
  const input = 'see /etc/passwd';
  assert.equal(redactSecrets(input), input);
});

// --- redactSecrets: defensive coercion ---

test('SEC-14-06: redactSecrets(null) returns empty string', () => {
  assert.equal(redactSecrets(null), '');
});

test('SEC-14-06: redactSecrets(undefined) returns empty string', () => {
  assert.equal(redactSecrets(undefined), '');
});

test('SEC-14-06: redactSecrets(42) coerces number to "42"', () => {
  assert.equal(redactSecrets(42), '42');
});

test('SEC-14-06: redactSecrets coerces object via String()', () => {
  assert.equal(redactSecrets({ toString: () => 'a' }), 'a');
});

// --- redactSecrets: idempotency invariant ---

test('SEC-14-06: redactSecrets is idempotent (running twice == once)', () => {
  const input = 'Bearer abcdef0123456789abcdef0123456789 at D:\\victim\\file';
  const once = redactSecrets(input);
  const twice = redactSecrets(once);
  assert.equal(twice, once, 'second pass must be a no-op');
});

// --- sanitizeMcpError ---

test('SEC-14-06: sanitizeMcpError redacts message + omits stack', () => {
  const err = new Error('boom at D:\\foo');
  const out = sanitizeMcpError(err);
  assert.equal(out.error, 'boom at [PATH]');
  assert.equal(out.code, 'MCP_INTERNAL_ERROR');
  assert.equal('stack' in out, false, 'stack field MUST NOT exist on envelope');
});

test('SEC-14-06: sanitizeMcpError preserves err.code (Phase 83 EMANIFESTMISMATCH invariant)', () => {
  const err = Object.assign(new Error('manifest mismatch'), { code: 'EMANIFESTMISMATCH' });
  const out = sanitizeMcpError(err);
  assert.equal(out.code, 'EMANIFESTMISMATCH');
  assert.equal(out.error, 'manifest mismatch');
});

test('SEC-14-06: sanitizeMcpError handles plain string', () => {
  const out = sanitizeMcpError('plain string');
  assert.equal(out.error, 'plain string');
  assert.equal(out.code, 'MCP_INTERNAL_ERROR');
});

test('SEC-14-06: sanitizeMcpError handles null', () => {
  const out = sanitizeMcpError(null);
  assert.equal(out.error, 'unknown error');
  assert.equal(out.code, 'MCP_INTERNAL_ERROR');
});

test('SEC-14-06: sanitizeMcpError NEVER copies stack field even when explicitly present', () => {
  // Even if a caller hands us a plain object {message, stack}, we MUST NOT
  // copy the stack to the output envelope. This is the core SEC-14-06 invariant.
  const fakeErr = { message: 'x', stack: 'STACK_LEAK_HERE' };
  const out = sanitizeMcpError(fakeErr);
  assert.equal('stack' in out, false, 'stack must not be a key on the result');
  assert.equal(out.error, 'x');
});
