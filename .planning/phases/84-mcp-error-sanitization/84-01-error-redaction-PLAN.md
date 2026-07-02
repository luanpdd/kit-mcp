---
phase: 84-mcp-error-sanitization
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/error-redaction.js          # NEW — helper module
  - src/mcp-server/index.js              # central catch (lines 323-331) — drop e.stack, use sanitizeMcpError
  - src/core/reflect.js                  # callClaude error body redact + (record-replay path) payload scrub at caller
  - test/unit/error-redaction.test.js    # NEW — pure helper unit tests (regex correctness + non-false-positives)
  - test/unit/mcp-error-envelope.test.js # NEW — server._requestHandlers integration: envelope clean
  - test/unit/reflect-redact.test.js     # NEW — fetch mock for Anthropic 401, redact path
  - test/unit/replays-redact.test.js     # NEW — recordReplay scrub on persisted JSON
  - test/integration/mcp-error-stderr-leak.test.js # NEW — spawn bin/mcp.js, assert stack in stderr only
autonomous: true
requirements: [SEC-14-06]

must_haves:
  truths:
    - "MCP error envelopes returned to clients never contain absolute filesystem paths (Windows D:\\ or Unix /home,/Users,/root)."
    - "MCP error envelopes never contain a serialized e.stack."
    - "reflect() failing with Anthropic 401/403/4xx scrubs sk-ant-*, x-api-key:*, Bearer * tokens from the thrown error message."
    - "recordReplay persists payload JSON with secrets redacted (no Bearer tokens, no API keys verbatim on disk)."
    - "Server-side stderr log still contains the full stack trace (operator debug capability preserved)."
    - "Existing 240 baseline test suite (157 unit + integration) continues passing; +5 regression tests minimum (helper unit, envelope integration, reflect mock, replays scrub, spawn stderr leak)."
  artifacts:
    - path: "src/core/error-redaction.js"
      provides: "redactSecrets(text) + sanitizeMcpError(err) — pure helpers"
      exports: ["redactSecrets", "sanitizeMcpError"]
    - path: "test/unit/error-redaction.test.js"
      provides: "Unit coverage of regex patterns + non-false-positive fixtures"
      contains: "redactSecrets"
    - path: "test/unit/mcp-error-envelope.test.js"
      provides: "Integration: trigger handler exception, assert envelope clean"
      contains: "sanitizeMcpError"
    - path: "test/unit/reflect-redact.test.js"
      provides: "fetch mock returns 401 with sk-ant-fake echo, reflect rethrow stripped"
      contains: "sk-ant"
    - path: "test/unit/replays-redact.test.js"
      provides: "recordReplay with Bearer token in payload — file on disk has [REDACTED]"
      contains: "Bearer"
    - path: "test/integration/mcp-error-stderr-leak.test.js"
      provides: "Spawn smoke — stack in stderr, NOT in stdout JSON-RPC response"
      contains: "stderr"
  key_links:
    - from: "src/mcp-server/index.js (catch block lines 323-331)"
      to: "src/core/error-redaction.js (sanitizeMcpError)"
      via: "import { sanitizeMcpError } + replace JSON.stringify({ error: e.message, stack: e.stack }) with sanitizeMcpError(e)"
      pattern: "sanitizeMcpError"
    - from: "src/core/reflect.js (callClaude error path line 170-173)"
      to: "src/core/error-redaction.js (redactSecrets)"
      via: "import { redactSecrets } + errBody = redactSecrets(errBody) before throw"
      pattern: "redactSecrets\\(errBody\\)"
    - from: "src/mcp-server/index.js (handleForensics record-replay dispatch line 270)"
      to: "src/core/error-redaction.js (redactSecrets)"
      via: "redact payload before recordReplay; OR call redactSecrets inside recordReplay itself before JSON.stringify"
      pattern: "redactSecrets"
---

<objective>
Close SEC-14-06 — MCP error envelopes leak absolute paths, e.stack, and potentially API key fragments to clients.
This plan introduces a single shared redaction helper, applies it at the central server catch block,
the Anthropic API error path, and the replay persistence path, with regression tests at three altitudes:
pure helper unit, in-process MCP dispatcher integration, and full spawn smoke for stderr-leak isolation.

Purpose:
- Prevent leakage of filesystem paths (which expose username + project layout) and API key fragments
  from stack traces and unwrapped 4xx error bodies.
- Preserve operator debuggability — server-side stderr stays verbose.
- Establish a single, audited choke point (`error-redaction.js`) for future redaction extensions.

Output:
- 1 new helper module + 4 surgical edits + 5 regression test files.
- Suite goes from ~240 baseline to ~245+ green.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/84-mcp-error-sanitization/84-CONTEXT.md

# Files this plan modifies — the executor must read these in full before editing
@src/mcp-server/index.js
@src/core/reflect.js
@src/core/replays.js

# Established test pattern reused by the new envelope test
@test/unit/mcp-projectroot-guard.test.js

<interfaces>
## Code site reference (verified 2026-05-09)

The CONTEXT.md hint "linhas 281-285" is **stale**. Actual locations confirmed by grep:

### src/mcp-server/index.js — central catch block (lines 323-331)

```js
    try {
      const result = await handler(args ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: e.message, stack: e.stack }, null, 2) }],
        isError: true,
      };
    }
```

This is the ONE catch block in the file. There is no per-handler catch — handleSync, handleReverseSync,
handleGates, handleForensics, handleInstall all let exceptions propagate to this central try/catch.
That means **fixing this single block sanitizes ALL handlers** — no scattered fix-up needed.

### src/core/reflect.js — Anthropic error path (lines 170-173)

```js
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errBody}`);
  }
```

`errBody` is whatever the Anthropic API returned. In some 401 responses Anthropic
echoes the supplied x-api-key value in the error body (rare but observed).

### src/core/replays.js — recordReplay persistence (line 71)

```js
  const record = { id, recorded_at: new Date().toISOString(), ...payload };
  await fs.writeFile(file, JSON.stringify(record, null, 2), 'utf8');
```

Payload is spread verbatim. If a caller passed `{ args: { headers: { Authorization: 'Bearer ...' } } }`,
the token lands on disk in `.planning/replays/*.json`.

### Helper signatures to be created

```js
// src/core/error-redaction.js
export function redactSecrets(text: string | unknown): string;
//   - Coerces non-string to String(text) defensively (e.message could be Symbol etc.)
//   - Returns input unchanged if already free of matchable patterns (cheap path)
//   - Apply regex set in order:
//       1) /sk-ant-[A-Za-z0-9_\-]{20,}/g                  → '[REDACTED:anthropic_key]'
//       2) /sk-[A-Za-z0-9]{20,}/g                          → '[REDACTED:openai_key]'
//       3) /x-api-key\s*:\s*[^\s,;'"]+/gi                  → 'x-api-key: [REDACTED]'
//       4) /Bearer\s+[A-Za-z0-9._\-]{20,}/gi               → 'Bearer [REDACTED]'
//       5) /[A-Z]:[\\\/][^\s'"`<>]+/g                      → '[PATH]'   (Windows abs)
//       6) /\/(home|Users|root)\/[^\s'"`<>]+/g             → '[PATH]'   (Unix abs)

export function sanitizeMcpError(err: unknown): { error: string; code: string };
//   - error: redactSecrets(String(err?.message ?? err ?? 'unknown error'))
//   - code:  err?.code ?? 'MCP_INTERNAL_ERROR'
//   - NEVER includes stack
//   - Preserves err.code (Phase 83 added 'EMANIFESTMISMATCH' — must propagate)
```

### Non-false-positive constraints (regex correctness)

The Windows path regex `/[A-Z]:[\\\/][^\s'"`<>]+/g` MUST NOT match:
- "Compare A:B" — "A:" not followed by `\` or `/`, so `:[\\\/]` guards it. ✓
- "Modal: hello" — "M" is matched by `[A-Z]`, "o" follows but ":" not after, no match.
  Actually pattern requires "[A-Z]:[\\\/]" sequence — "Modal:" lacks "[\\\/]" after `:`. ✓
- "URL https://..." — `s` after `://` is fine because regex requires uppercase letter
  immediately followed by `:`, then slash. "https://" starts with lowercase `h`. ✓

Test must include these as explicit negative fixtures.

The Bearer regex requires {20,} chars — won't match "Bearer foo" in casual text. ✓

The sk-ant regex requires 20+ chars — won't match incidentally. ✓
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/core/error-redaction.js helper + pure unit tests</name>
  <read_first>
    - src/core/path-safety.js (for module style precedent — Phase 83.01 sibling helper)
    - test/unit/replays-path-traversal.test.js (test style precedent — pure unit assertions)
    - .planning/phases/84-mcp-error-sanitization/84-CONTEXT.md (regex specification authoritative)
  </read_first>
  <files>
    - src/core/error-redaction.js (NEW)
    - test/unit/error-redaction.test.js (NEW)
  </files>
  <action>
    Step A — Write `src/core/error-redaction.js` exporting two pure functions:

    ```js
    // SEC-14-06 — central redaction helpers shared by mcp-server, reflect, and replays.
    // Pure module: no I/O, no globals other than constant regex set.

    const PATTERNS = [
      { re: /sk-ant-[A-Za-z0-9_\-]{20,}/g,        sub: '[REDACTED:anthropic_key]' },
      { re: /sk-[A-Za-z0-9]{20,}/g,                sub: '[REDACTED:openai_key]' },
      { re: /x-api-key\s*:\s*[^\s,;'"]+/gi,        sub: 'x-api-key: [REDACTED]' },
      { re: /Bearer\s+[A-Za-z0-9._\-]{20,}/gi,     sub: 'Bearer [REDACTED]' },
      { re: /[A-Z]:[\\\/][^\s'"`<>]+/g,            sub: '[PATH]' },
      { re: /\/(home|Users|root)\/[^\s'"`<>]+/g,   sub: '[PATH]' },
    ];

    export function redactSecrets(text) {
      if (text == null) return '';
      let s = String(text);
      for (const { re, sub } of PATTERNS) {
        s = s.replace(re, sub);
      }
      return s;
    }

    export function sanitizeMcpError(err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? err.message
        : err;
      return {
        error: redactSecrets(msg ?? 'unknown error'),
        code:  (err && typeof err === 'object' && err.code) ? err.code : 'MCP_INTERNAL_ERROR',
      };
    }
    ```

    Order rationale:
    - `sk-ant-*` BEFORE `sk-*` so the more specific Anthropic prefix takes precedence (otherwise the
      `sk-[A-Za-z0-9]{20,}` rule would match `sk-ant-` and label it as openai by accident — note that
      `-` is NOT in `[A-Za-z0-9]`, so `sk-` followed by `ant-...` would actually NOT match the openai
      regex because `ant-` contains `-`. But ordering is still safer/clearer for future readers.)
    - Path patterns last because they're broadest character class.

    Step B — Write `test/unit/error-redaction.test.js` covering:

    1. `redactSecrets('foo sk-ant-abc123def456ghi789jkl012 bar')` → '[REDACTED:anthropic_key]' inline
    2. `redactSecrets('Authorization: Bearer abcdef0123456789abcdef0123456789')` → 'Bearer [REDACTED]'
    3. `redactSecrets('x-api-key: sk-1234567890123456789012345')` → 'x-api-key: [REDACTED]' (whole header value gone)
    4. `redactSecrets('Error reading D:\\Users\\victim\\.ssh\\id_rsa')` → 'Error reading [PATH]'
    5. `redactSecrets('failed at /home/alice/project/file.js:33')` → 'failed at [PATH]'
    6. `redactSecrets('failed at /Users/bob/code/app.js')` → 'failed at [PATH]'
    7. `redactSecrets('failed at /root/config')` → 'failed at [PATH]'

    NEGATIVE cases (no false positives) — must remain UNCHANGED:
    8. `redactSecrets('Compare A:B in the diff')` → 'Compare A:B in the diff' (no `\` or `/` after `:`)
    9. `redactSecrets('Modal: hello world')`     → 'Modal: hello world'    (single colon, no slash)
    10. `redactSecrets('Visit https://example.com/path')` → 'Visit https://example.com/path'
        (lowercase scheme, no Drive: pattern)
    11. `redactSecrets('Bearer x')`              → 'Bearer x'  (only 1 char after Bearer, below 20)
    12. `redactSecrets('sk-foo')`                → 'sk-foo'    (only 3 chars after sk-, below 20)
    13. `redactSecrets('see /etc/passwd')`       → 'see /etc/passwd'  (NOT in {home,Users,root})

    DEFENSIVE cases:
    14. `redactSecrets(null)` → ''
    15. `redactSecrets(undefined)` → ''
    16. `redactSecrets(42)` → '42'
    17. `redactSecrets({ toString: () => 'a' })` → 'a'

    For sanitizeMcpError:
    18. `sanitizeMcpError(new Error('boom at D:\\foo'))` → `{ error: 'boom at [PATH]', code: 'MCP_INTERNAL_ERROR' }`
    19. `sanitizeMcpError(Object.assign(new Error('manifest mismatch'), { code: 'EMANIFESTMISMATCH' }))`
        → preserves code field (Phase 83 invariant)
    20. `sanitizeMcpError('plain string')` → `{ error: 'plain string', code: 'MCP_INTERNAL_ERROR' }`
    21. `sanitizeMcpError(null)` → `{ error: 'unknown error', code: 'MCP_INTERNAL_ERROR' }`
    22. `sanitizeMcpError({ message: 'x', stack: 'STACK_LEAK_HERE' })` — assert returned object
        has NO `stack` property at all (`assert.equal('stack' in result, false)`).

    NO file system, NO process spawn — strictly pure assertions on string output.
  </action>
  <acceptance_criteria>
    - File `src/core/error-redaction.js` exists with two named exports `redactSecrets` and `sanitizeMcpError`.
    - File `test/unit/error-redaction.test.js` exists with at minimum 22 assertions covering positive,
      negative (no false-positives), defensive, and code-preservation cases.
    - `node test/run.mjs test/unit/error-redaction.test.js` passes 100%.
    - `grep -c "stack" src/core/error-redaction.js` returns 0 (helper never references stack).
    - `redactSecrets` mutates nothing in input — re-running it on the same input yields the same output (idempotent).
  </acceptance_criteria>
  <verify>
    <automated>node test/run.mjs test/unit/error-redaction.test.js</automated>
  </verify>
  <done>
    Helper module in place, fully unit-tested in isolation with positive AND non-false-positive coverage.
    Subsequent tasks can `import { redactSecrets, sanitizeMcpError } from '../core/error-redaction.js'`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply sanitizeMcpError to MCP server central catch block + envelope integration test</name>
  <read_first>
    - src/mcp-server/index.js (lines 1-50 imports, 315-335 the catch block)
    - test/unit/mcp-projectroot-guard.test.js (lines 1-100 — the `_requestHandlers` Map dispatcher pattern is reused verbatim)
    - test/unit/mcp-gates-guard.test.js (Phase 79.01 precedent for the same pattern)
  </read_first>
  <files>
    - src/mcp-server/index.js (edit imports + replace catch block lines 326-330)
    - test/unit/mcp-error-envelope.test.js (NEW)
  </files>
  <action>
    Step A — Edit `src/mcp-server/index.js`:

    1. Add to imports (alongside existing `validateProjectRoot` import on line 23):
       ```js
       import { sanitizeMcpError } from '../core/error-redaction.js';
       ```

    2. Replace the catch block (currently lines 326-330):
       ```js
       } catch (e) {
         return {
           content: [{ type: 'text', text: JSON.stringify({ error: e.message, stack: e.stack }, null, 2) }],
           isError: true,
         };
       }
       ```
       with:
       ```js
       } catch (e) {
         // SEC-14-06: full stack stays in stderr for operator debug; client envelope is sanitized.
         console.error('[mcp-server] error in handler:', e?.stack ?? e);
         return {
           content: [{ type: 'text', text: JSON.stringify(sanitizeMcpError(e), null, 2) }],
           isError: true,
         };
       }
       ```

    Note: there is exactly ONE catch in this file (line 326). The catch on line 187 is in `wrapProgressForUi`
    and re-throws — it does NOT serialize, so it is unaffected.

    Step B — Write `test/unit/mcp-error-envelope.test.js` modeled on `test/unit/mcp-projectroot-guard.test.js`:

    The envelope test exercises the `_requestHandlers.get('tools/call')` path that the SDK actually
    uses, so we know the wiring (not just helper) sanitizes. We force a handler to throw by sending a
    tool call that hits a syncTo / reverse-sync code path with a deliberately path-poisoned message
    that bypasses the projectRoot guard but still fails downstream. Simpler: use an UNKNOWN action
    in a handler that throws on unknown action — `handleKit` returns `{ error }` for unknown action
    (no throw), but `handleForensics` returns `{ error }` too. Cleanest: trigger via a real exception
    by calling `replays`/forensics with a malformed payload (e.g., load-replay with a non-string id
    triggers `validateReplayId` to throw 'invalid replay id: must be a non-empty string').

    Tests:

    1. **SEC-14-06 (1): unknown tool returns sanitized envelope without stack**
       - call `tools/call` with `name: 'nonexistent-tool'`
       - Existing line 320-322 returns `{ error: 'Unknown tool: nonexistent-tool' }` (no throw, no stack
         to begin with). Just assert envelope has no `stack` field. Cheap sanity baseline.

    2. **SEC-14-06 (2): handler throw produces envelope with no stack and no absolute paths**
       - Call `tools/call` with `name: 'forensics', arguments: { action: 'load-replay', replayId: null }`.
       - This triggers `validateReplayId` (replays.js:30) to throw `'invalid replay id: must be a non-empty string'`.
       - The thrown Error has a stack containing path like `D:\projetos\opensource\mcp\src\core\replays.js:30`.
       - Parse `r.text` as JSON.
       - Assert `parsed.error` is a string AND does NOT match `/[A-Z]:[\\\/]/`.
       - Assert `parsed.stack === undefined` (zero stack field at all).
       - Assert `parsed.code` is present (will be 'MCP_INTERNAL_ERROR' since the validation Error has
         no code field).

    3. **SEC-14-06 (3): error message itself preserved (non-secret, non-path content)**
       - Same call as test 2.
       - Assert `parsed.error` includes substring `'invalid replay id'` — sanitization must not
         destroy the actual error message, only redact secrets/paths.

    4. **SEC-14-06 (4): err.code propagates to envelope (Phase 83 invariant)**
       - Need an exception path that throws an Error with .code set. Phase 83.03 introduced
         `EMANIFESTMISMATCH` in sync.js. Trigger by:
         - `mkdtemp` a fake dir with a poisoned file-manifest.json (set up via fs)
         - call `tools/call` with `name: 'sync', arguments: { action: 'install', target: 'claude-code', projectRoot: <dir> }`
         - The projectRoot guard from Phase 83.01 will reject because no `.git/` — wrong path.
       - Simpler approach: introspect by mocking — instead, write a NEW exported function in
         test scope (no — that requires source change). Instead use a SIMPLER trigger:
         - Send a `gates` action that throws a coded error. Look at `runGate` in gate-runner.js
           (Phase 83.02). If it throws on missing scriptPath, code may be 'ENOENT'.
         - `tools/call` with `name: 'gates', arguments: { action: 'run', name: 'nonexistent-gate' }`
         - `gates.run` from Phase 79.01 in MCP returns 'gate not found' as `{ error }` (no throw).
         - Skip approach.
       - **Pragmatic fallback**: assert via direct `sanitizeMcpError` call (already in Task 1) that
         code propagates; in this integration test only assert that envelope HAS a `code` field
         (any non-undefined string). The propagation path is covered by Task 1 unit tests.
       - Rewrite test 4: **assert envelope has `code` field of type string**, period.

    5. **SEC-14-06 (5): no `stack` field anywhere in envelope across multiple thrown handlers**
       - Run a small parameterized loop: 3 different tool/action combos that throw. For each,
         assert `'stack' in parsed === false` and `!/[A-Z]:[\\\/]/.test(parsed.error)`.

    Use the same `callTool` helper, the same `sdk-internals-changed` skip pattern, the same
    `_requestHandlers` Map probe.
  </action>
  <acceptance_criteria>
    - `src/mcp-server/index.js` imports `sanitizeMcpError` from `../core/error-redaction.js`.
    - `grep -n "stack: e\.stack" src/mcp-server/index.js` returns 0 matches (the leak line is gone).
    - `grep -n "console.error\(.*\[mcp-server\] error in handler" src/mcp-server/index.js` returns 1 match
      (server-side log line is in place).
    - `grep -n "sanitizeMcpError(e)" src/mcp-server/index.js` returns 1 match.
    - `test/unit/mcp-error-envelope.test.js` exists with at minimum 5 named tests as described.
    - `node test/run.mjs test/unit/mcp-error-envelope.test.js` passes 100%.
    - `node test/run.mjs test/unit` overall passes — Phase 83 tests (mcp-projectroot-guard, mcp-gates-guard,
      manifest-verify, gate-runner-tmpdir) continue green; envelope shape change does NOT break them.
  </acceptance_criteria>
  <verify>
    <automated>node test/run.mjs test/unit/mcp-error-envelope.test.js && node test/run.mjs test/unit/mcp-projectroot-guard.test.js && node test/run.mjs test/unit/mcp-gates-guard.test.js</automated>
  </verify>
  <done>
    All MCP exceptions caught at the central handler return sanitized envelopes with no stack, no
    absolute paths. Phase 83 regression tests still green (envelope shape change is backward-compatible —
    we still return `{ error: <string> }`, just no longer with a `stack` sibling).
  </done>
</task>

<task type="auto">
  <name>Task 3: Apply redactSecrets to reflect.js Anthropic error path + recordReplay payload</name>
  <read_first>
    - src/core/reflect.js (full file, especially lines 156-179 — callClaude)
    - src/core/replays.js (full file, especially lines 52-73 — recordReplay)
  </read_first>
  <files>
    - src/core/reflect.js (edit lines 170-173 + import)
    - src/core/replays.js (edit lines 52-73 + import)
    - test/unit/reflect-redact.test.js (NEW)
    - test/unit/replays-redact.test.js (NEW)
  </files>
  <action>
    Step A — Edit `src/core/reflect.js`:

    1. Add to imports near existing imports (line 17-21):
       ```js
       import { redactSecrets } from './error-redaction.js';
       ```

    2. Replace the throw block (lines 170-173):
       ```js
       if (!res.ok) {
         const errBody = await res.text();
         throw new Error(`Anthropic API ${res.status}: ${errBody}`);
       }
       ```
       with:
       ```js
       if (!res.ok) {
         const errBody = await res.text();
         // SEC-14-06: Anthropic error responses can echo the supplied API key
         // (rare but observed). Strip before propagating to caller.
         throw new Error(`Anthropic API ${res.status}: ${redactSecrets(errBody)}`);
       }
       ```

    Step B — Edit `src/core/replays.js`:

    1. Add to imports near top (after line 16 fs import):
       ```js
       import { redactSecrets } from './error-redaction.js';
       ```

    2. Modify `recordReplay` to apply redactSecrets to the serialized JSON. The cleanest spot is to
       redact the JSON string AFTER stringification (so it walks the entire structure), not the
       payload tree (which would require a deep map). Replace lines 70-72:
       ```js
       const record = { id, recorded_at: new Date().toISOString(), ...payload };
       await fs.writeFile(file, JSON.stringify(record, null, 2), 'utf8');
       return { id, file, record };
       ```
       with:
       ```js
       const record = { id, recorded_at: new Date().toISOString(), ...payload };
       // SEC-14-06: scrub serialized form to strip API keys / Bearer tokens / paths a caller
       // may have inadvertently included (e.g., args.headers.Authorization, args.cwd).
       // Note: returns the in-memory `record` un-scrubbed for the caller (caller already has it);
       // ONLY the on-disk persistent copy is scrubbed.
       const json = redactSecrets(JSON.stringify(record, null, 2));
       await fs.writeFile(file, json, 'utf8');
       return { id, file, record };
       ```

       Rationale: redacting after JSON.stringify means the caller's in-memory `record` is unaffected
       (avoiding subtle bugs in callers who still depend on payload integrity downstream). Only the
       persisted artifact is scrubbed. Reading via `loadReplay` will see [REDACTED] markers — that's
       correct: we don't want secrets re-loaded into memory either.

    Step C — Write `test/unit/reflect-redact.test.js`:

    Strategy: the simplest way to exercise the rethrow path without a real Anthropic credential is to
    monkey-patch `globalThis.fetch` for the duration of the test. The test file:

    1. Imports `reflect` from `../../src/core/reflect.js`.
    2. Sets up a tmp project with `.planning/learnings/test-agent.md` and `kit/agents/test-agent.md`
       so reflect doesn't bail at the file-read step.
    3. Sets `process.env.ANTHROPIC_API_KEY = 'sk-ant-fakekey1234567890abcdef'` and saves the original.
    4. Replaces `globalThis.fetch` with a stub that returns:
       ```js
       Promise.resolve({
         ok: false,
         status: 401,
         text: async () => 'Invalid x-api-key: sk-ant-leakedfromserver1234567890 — unauthorized',
       });
       ```
    5. Awaits `reflect({ agent: 'test-agent', projectRoot: <tmp>, kitRoot: <tmp>/kit })` and asserts
       it throws with `error.message`:
       - DOES include `'Anthropic API 401:'` (preamble preserved)
       - DOES NOT include `'sk-ant-'`
       - DOES NOT include `'sk-ant-leakedfromserver'`
       - DOES include `'[REDACTED:anthropic_key]'` substring
    6. Restores `globalThis.fetch` and `process.env.ANTHROPIC_API_KEY` in `finally`.

    Negative case:
    - Same setup but stub returns `ok: true` with valid response — assert reflect proceeds normally
      (no false-positive redaction in success path). Optional but cheap.

    Step D — Write `test/unit/replays-redact.test.js`:

    1. Import `recordReplay` and `loadReplay` from `../../src/core/replays.js`.
    2. mkdtemp tmp dir, create `.planning/replays/` inside.
    3. Call:
       ```js
       const r = await recordReplay({
         phase: '84',
         plan: '01',
         agent: 'executor',
         args: {
           headers: { Authorization: 'Bearer abcdef0123456789abcdef0123456789' },
           cwd: 'D:\\Users\\victim\\projects\\app',
           env: { ANTHROPIC_API_KEY: 'sk-ant-realkey1234567890abcdef' },
         },
       }, { projectRoot: tmp });
       ```
    4. Read the file at `r.file` directly via `fs.readFile`.
    5. Assert file contents do NOT contain `'Bearer abcdef'`, `'sk-ant-realkey'`, or `'D:\\Users\\victim'`.
    6. Assert file contents DO contain `'[REDACTED]'` and `'[PATH]'` markers.
    7. (Bonus) Assert `loadReplay(r.id, { projectRoot: tmp })` returns the redacted form (since it
       parses the on-disk artifact).
    8. Cleanup tmp dir.
  </action>
  <acceptance_criteria>
    - `grep -n "redactSecrets" src/core/reflect.js` returns ≥2 matches (import + usage).
    - `grep -n "redactSecrets" src/core/replays.js` returns ≥2 matches (import + usage).
    - `node test/run.mjs test/unit/reflect-redact.test.js` passes (≥2 assertions: scrub + preamble preserved).
    - `node test/run.mjs test/unit/replays-redact.test.js` passes (≥3 assertions: Bearer scrubbed,
      sk-ant scrubbed, path scrubbed).
    - `node test/run.mjs test/unit/replays-path-traversal.test.js` (Phase 79/SEC-13-02 regression)
      continues green — this plan's edits do NOT change validateReplayId logic.
  </acceptance_criteria>
  <verify>
    <automated>node test/run.mjs test/unit/reflect-redact.test.js && node test/run.mjs test/unit/replays-redact.test.js && node test/run.mjs test/unit/replays-path-traversal.test.js</automated>
  </verify>
  <done>
    Both leak vectors (Anthropic error rethrow + replay JSON persistence) are scrubbed.
    No regression on existing replays test (path traversal guard untouched).
  </done>
</task>

<task type="auto">
  <name>Task 4: End-to-end spawn smoke test — stack in stderr, NEVER in stdout JSON-RPC response</name>
  <read_first>
    - bin/mcp.js (entry point — confirm shape)
    - test/integration/ (existing integration test pattern; if no dir exists, create it)
    - test/unit/mcp-error-envelope.test.js (the in-process counterpart from Task 2)
  </read_first>
  <files>
    - test/integration/mcp-error-stderr-leak.test.js (NEW)
  </files>
  <action>
    The CONTEXT.md explicitly requested a spawn-based test asserting stack appears in stderr but not
    in the JSON-RPC stdout response. Task 2 covers in-process correctness fast; this task covers the
    runtime guarantee that stderr logging actually fires (some bundlers/transformers can break it).

    Steps:

    1. Check if `test/integration/` directory exists — if not, create the file there anyway (Node's
       test runner discovers by glob from `test/run.mjs`; verify by reading `test/run.mjs` first).
       If `test/run.mjs test/integration` is not wired, place file in `test/unit/mcp-error-spawn.test.js`
       instead and document the choice in a comment at top.

    2. The test:
       ```js
       import { test } from 'node:test';
       import assert from 'node:assert/strict';
       import { spawn } from 'node:child_process';
       import { fileURLToPath } from 'node:url';
       import path from 'node:path';

       const __filename = fileURLToPath(import.meta.url);
       const repoRoot = path.resolve(path.dirname(__filename), '..', '..');
       const mcpEntry = path.join(repoRoot, 'bin', 'mcp.js');

       test('SEC-14-06 spawn: error envelope on stdout has no stack/path; stack lives only in stderr', async () => {
         const child = spawn(process.execPath, [mcpEntry], {
           stdio: ['pipe', 'pipe', 'pipe'],
           env: { ...process.env },
         });

         let stdout = '';
         let stderr = '';
         child.stdout.on('data', (b) => { stdout += b.toString(); });
         child.stderr.on('data', (b) => { stderr += b.toString(); });

         // First the MCP handshake — initialize
         child.stdin.write(JSON.stringify({
           jsonrpc: '2.0', id: 1, method: 'initialize',
           params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } },
         }) + '\n');

         // Wait briefly for init response — poll stdout
         await new Promise((r) => setTimeout(r, 500));

         // Send a request that we know throws inside a handler — load-replay with null id
         child.stdin.write(JSON.stringify({
           jsonrpc: '2.0', id: 2, method: 'tools/call',
           params: { name: 'forensics', arguments: { action: 'load-replay', replayId: null } },
         }) + '\n');

         // Wait for response
         await new Promise((r) => setTimeout(r, 1000));

         child.kill();
         await new Promise((r) => child.on('exit', r));

         // Find the response line for id=2
         const lines = stdout.split('\n').filter(Boolean);
         const resp2 = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } })
                            .find((j) => j && j.id === 2);
         assert.ok(resp2, `no JSON-RPC response with id=2 found in stdout. stdout=${stdout.slice(0, 500)}`);

         const envelope = resp2.result?.content?.[0]?.text ?? '';
         // 1. envelope must NOT contain "stack" field key (raw JSON substring check is strong enough)
         assert.ok(!/"stack"\s*:/.test(envelope), `envelope leaks "stack" key: ${envelope}`);
         // 2. envelope must NOT contain absolute Windows path
         assert.ok(!/[A-Z]:[\\\/]/.test(envelope), `envelope leaks Windows path: ${envelope}`);
         // 3. envelope must NOT contain Unix absolute path under /home, /Users, /root
         assert.ok(!/\/(home|Users|root)\//.test(envelope), `envelope leaks Unix path: ${envelope}`);
         // 4. envelope SHOULD contain the actual error message preamble (sanity)
         assert.ok(/invalid replay id/i.test(envelope), `envelope missing real error message: ${envelope}`);

         // 5. STDERR should contain the stack with the real path — confirms server-side log fired
         assert.ok(/at\s+validateReplayId/.test(stderr) || /replays\.js/.test(stderr),
           `stderr missing stack trace — server-side debug log not firing. stderr=${stderr.slice(0, 500)}`);
         // 6. STDERR has the "[mcp-server] error in handler" preamble we added in Task 2
         assert.ok(/\[mcp-server\] error in handler/.test(stderr),
           `stderr missing the operator-debug preamble. stderr=${stderr.slice(0, 500)}`);
       });
       ```

    3. Defensive timeout: wrap test in `test('...', { timeout: 10000 }, async () => { ... })`.

    4. Cross-platform sanity: paths on Linux won't match `[A-Z]:[\\\/]/` so that assertion is
       trivially satisfied. The unix path assertion `/\/(home|Users|root)\//` only matches if
       the absolute path of the repo includes one of those — on Windows the assertion is trivially
       satisfied (no /home in D:\\projetos). Keep both — they cover their respective platforms.

    5. Add file to `test/run.mjs` discovery if needed: read `test/run.mjs` first to confirm whether
       `test/integration/*.test.js` is auto-discovered. If `test/run.mjs` only globs `test/unit/`,
       drop the file at `test/unit/mcp-error-spawn.test.js` instead. Document the decision in a
       header comment.
  </action>
  <acceptance_criteria>
    - Test file exists at `test/integration/mcp-error-stderr-leak.test.js` (or `test/unit/mcp-error-spawn.test.js`
      if test runner only globs unit/).
    - `node test/run.mjs <path-to-this-test>` passes.
    - The test explicitly asserts (a) no `"stack":` key in stdout response, (b) no abs path in stdout,
      (c) actual error msg preserved, (d) stack present in stderr, (e) operator-debug preamble in stderr.
    - Test runs in <5s wall-clock on local dev box.
    - Full suite `node test/run.mjs test/unit` continues green; new test added to total count
      (158+ unit tests, +integration if separately wired).
  </acceptance_criteria>
  <verify>
    <automated>node test/run.mjs test/integration/mcp-error-stderr-leak.test.js 2>/dev/null || node test/run.mjs test/unit/mcp-error-spawn.test.js</automated>
  </verify>
  <done>
    Runtime guarantee in place: a real spawned MCP server (not just in-process dispatcher) confirms
    stack lives in stderr only and clients never see it on stdout. Closes the SEC-14-06 loop end-to-end.
  </done>
</task>

</tasks>

<verification>
After all 4 tasks:

1. Full suite must pass: `node test/run.mjs test/unit` — expect ≥162 unit tests (157 baseline + 5+ new files).
2. Phase 83 invariants preserved:
   - `node test/run.mjs test/unit/mcp-projectroot-guard.test.js` green (envelope shape change harmless — `error` field still string)
   - `node test/run.mjs test/unit/mcp-gates-guard.test.js` green
   - `node test/run.mjs test/unit/manifest-verify.test.js` green (EMANIFESTMISMATCH propagation: Task 1 covers code preservation in helper unit; Task 2 covers it via integration if a manifest-mismatch path can be triggered, otherwise via Task 1 alone)
   - `node test/run.mjs test/unit/gate-runner-tmpdir.test.js` green
3. Phase 79 invariants preserved:
   - `node test/run.mjs test/unit/replays-path-traversal.test.js` green (validateReplayId untouched)
4. Source-grep negative checks (run as final sanity):
   - `grep -n "stack: e\.stack\|stack: err\.stack" src/mcp-server/index.js` returns 0
   - `grep -n "Anthropic API.*\${errBody}" src/core/reflect.js` returns 0 (the unredacted form)
   - `grep -rn "JSON\.stringify.*payload" src/core/replays.js` — only the redacted-form line remains
5. Helper choke point: `grep -n "redactSecrets\|sanitizeMcpError" src/` confirms helper is used at exactly 3 call sites:
   - `src/mcp-server/index.js` — sanitizeMcpError
   - `src/core/reflect.js` — redactSecrets
   - `src/core/replays.js` — redactSecrets
</verification>

<success_criteria>
SEC-14-06 closed end-to-end:

- ✅ MCP error envelope never contains absolute path: regex `/[A-Z]:[\\\\\\/]/` returns 0 matches
  in any test envelope (asserted in Tasks 2 and 4).
- ✅ MCP error envelope never contains `e.stack` serialized: `'stack' in parsed === false` (Task 2),
  `/"stack"\s*:/` regex matches 0 (Task 4).
- ✅ reflect() with Anthropic 401 returns error without `sk-ant-...`: asserted by fetch-mock unit test (Task 3).
- ✅ recordReplay strips secrets from JSON before persisting: file-on-disk does not contain
  Bearer/api key/path verbatim (Task 3).
- ✅ Stack continues in stderr server-side: spawn test asserts stack lines AND `[mcp-server] error in handler`
  preamble in stderr (Task 4).
- ✅ Suite continues passing + ≥5 new test files (4-5 named regression test categories per CONTEXT.md target).
- ✅ Phase 83 regression tests (mcp-projectroot-guard, mcp-gates-guard, manifest-verify, gate-runner-tmpdir,
  replays-path-traversal) continue green.
- ✅ Helper file `src/core/error-redaction.js` is the SOLE choke point for redaction (3 call sites).
- ✅ False-positive resistance: explicit unit fixtures cover "Compare A:B", "Modal: hello", "Bearer x" (short),
  short `sk-` strings — none get over-redacted (Task 1).
</success_criteria>

<output>
After completion, create `.planning/phases/84-mcp-error-sanitization/84-01-error-redaction-SUMMARY.md`
documenting:
- Helper module exports + regex set rationale (including non-false-positive fixtures verified)
- Three call sites edited with line refs (mcp-server/index.js central catch, reflect.js callClaude rethrow,
  replays.js recordReplay JSON serialization)
- Test count delta (baseline 157 → final N) and breakdown by file
- Cross-reference to Phase 83 invariants confirmed still green
- Pitfalls hit during implementation (e.g., correct ordering of sk-ant vs sk- regex, in-memory vs on-disk
  scrub trade-off in recordReplay) for future-reader benefit
</output>
</content>
</invoke>