// SEC-14-06 — central redaction helpers shared by mcp-server, reflect, and replays.
//
// Pure module: no I/O, no globals other than the constant regex set.
//
// Why a single choke point: the threat model is "leakage of API keys, Bearer
// tokens, and absolute filesystem paths through MCP error envelopes / persisted
// replays". Scattering redaction across each call site invites drift. One file,
// one regex set, three import sites — and a single grep proves coverage.
//
// Order rationale (PATTERNS array):
//   1. sk-ant-* before sk-* — Anthropic prefix is more specific. (In practice
//      the openai pattern's [A-Za-z0-9] character class would NOT swallow
//      "sk-ant-" because of the dash, but ordering keeps intent legible.)
//   2. x-api-key header before Bearer — both are distinct shapes; order is
//      arbitrary but stable.
//   3. Path patterns last — broadest character class, matched after specific
//      secrets so a secret that contains slash-like characters has been
//      stripped already.
//
// Non-false-positive contract (verified by test/unit/error-redaction.test.js):
//   - "Compare A:B" stays unchanged          (no `\` or `/` after `:`)
//   - "Modal: hello"  stays unchanged        (no `\` or `/` after `:`)
//   - "Visit https://example.com/path" stays (lowercase scheme, no Drive: pattern)
//   - "Bearer x"      stays unchanged        (1 char, below 20 minimum)
//   - "sk-foo"        stays unchanged        (3 chars after sk-, below 20 minimum)
//   - "see /etc/passwd" stays unchanged      (etc not in {home,Users,root} allowlist)
//
// Idempotency: redactSecrets(redactSecrets(x)) === redactSecrets(x). The
// substitution strings ('[REDACTED:*]', '[PATH]', etc.) contain no characters
// that match any of the patterns themselves.

const PATTERNS = [
  { re: /sk-ant-[A-Za-z0-9_\-]{20,}/g,        sub: '[REDACTED:anthropic_key]' },
  { re: /sk-[A-Za-z0-9]{20,}/g,                sub: '[REDACTED:openai_key]' },
  { re: /x-api-key\s*:\s*[^\s,;'"]+/gi,        sub: 'x-api-key: [REDACTED]' },
  { re: /Bearer\s+[A-Za-z0-9._\-]{20,}/gi,     sub: 'Bearer [REDACTED]' },
  { re: /[A-Z]:[\\\/][^\s'"`<>]+/g,            sub: '[PATH]' },
  { re: /\/(home|Users|root)\/[^\s'"`<>]+/g,   sub: '[PATH]' },
];

/**
 * Strip secrets and absolute filesystem paths from a string. Defensive: coerces
 * non-string inputs via String(value); null/undefined return ''.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function redactSecrets(text) {
  if (text == null) return '';
  let s = String(text);
  for (const { re, sub } of PATTERNS) {
    s = s.replace(re, sub);
  }
  return s;
}

/**
 * Build the public MCP error envelope for an arbitrary thrown value. The
 * server-side stderr keeps the full trace for operator debugging; the
 * JSON-RPC client receives only `{error, code}` — no trace field is emitted.
 *
 * Preserves err.code when present (Phase 83.03 added `EMANIFESTMISMATCH`;
 * downstream callers can keep dispatching on that code).
 *
 * @param {unknown} err
 * @returns {{ error: string, code: string }}
 */
export function sanitizeMcpError(err) {
  const msg = err && typeof err === 'object' && 'message' in err
    ? err.message
    : err;
  return {
    error: redactSecrets(msg ?? 'unknown error'),
    code:  (err && typeof err === 'object' && err.code) ? err.code : 'MCP_INTERNAL_ERROR',
  };
}
