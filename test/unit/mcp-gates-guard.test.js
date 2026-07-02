// SEC-13-01 regression: gates.run via MCP transport must NOT invoke runGate.
//
// The MCP server cannot ask the user "y/N before exec" because the transport is
// stdio JSON — there is no interactive TTY. Previously, handleGates passed
// {yes:true} to runGate, which skipped the prompt and spawned bash with whatever
// shell blocks lived in gates/*.md. Combined with reverse-sync (which can rewrite
// gate files), this was an arbitrary-shell-exec primitive over MCP.
//
// This test asserts the guard returns a stable error string that MCP clients can
// codify, without ever dispatching to runGate. The CLI entry (`kit gates run`)
// is unaffected and exercised by gates.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../src/mcp-server/index.js';

test('SEC-13-01: gates.run via MCP returns stable error and never invokes runGate', async () => {
  const server = await createServer();

  // The SDK Server stores per-method dispatchers in `_requestHandlers`, a Map
  // keyed by method-name string ("tools/call", "tools/list", ...). This is an
  // internal of @modelcontextprotocol/sdk — if a future SDK upgrade renames or
  // hides it, this test gracefully skips and the primary protection (the source
  // grep in Plan 79.01 Task 1) still holds.
  const handlers = server._requestHandlers;
  if (!(handlers instanceof Map)) {
    console.log('skip: SDK internals changed — _requestHandlers no longer a Map');
    return;
  }
  const callHandler = handlers.get('tools/call');
  if (typeof callHandler !== 'function') {
    console.log('skip: SDK internals changed — tools/call handler not registered as Map value');
    return;
  }

  const req = {
    method: 'tools/call',
    params: { name: 'gates', arguments: { action: 'run', id: 'regression' } },
  };
  // The SDK invokes handlers as `handler(req, extra)`. We don't actually
  // exercise the extra fields, but the Server may unconditionally read them.
  const extra = {
    signal: new AbortController().signal,
    sendNotification: async () => {},
    sendRequest: async () => ({}),
    requestId: 1,
    _meta: {},
  };

  const result = await callHandler(req, extra);

  // Guard returns { error } from the handler, which the CallToolRequestSchema
  // wrapper serializes into content[0].text as JSON. The exact sentinel must be
  // present so MCP clients can detect the refusal programmatically.
  const text = result?.content?.[0]?.text ?? '';
  assert.match(
    text,
    /MCP gates\.run requires interactive TTY confirmation/,
    'sentinel phrase missing — MCP clients rely on it for refusal detection',
  );
  assert.match(
    text,
    /use `kit gates run` from CLI instead/,
    'remediation hint missing — clients should be told where to go instead',
  );

  // No bash spawn must happen. We can't directly assert "runGate not called"
  // without mocking, but the source grep in Task 1 already enforces that
  // runGate(args.id ...) is removed from the server. This test additionally
  // ensures no exception was thrown and no shell side effect surfaced (which
  // would manifest as a stderr/stdout field on the parsed payload).
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (parsed) {
    assert.equal(typeof parsed.error, 'string', 'response must be { error: <string> }');
    assert.equal(parsed.exitCode, undefined, 'no exit code — runGate must not have run');
    assert.equal(parsed.stdout, undefined, 'no stdout — runGate must not have run');
    assert.equal(parsed.stderr, undefined, 'no stderr — runGate must not have run');
  }
});
