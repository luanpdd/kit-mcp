// SEC-14-06: end-to-end spawn smoke test.
//
// Runtime guarantee: spawn the real bin/mcp.js, send a JSON-RPC
// tools/call that we know throws inside a handler, and assert that
//   - the stack appears on stderr (operator debug log fires)
//   - the JSON-RPC response on stdout has NO "stack" key, NO absolute
//     filesystem paths, AND the actual error message is preserved.
//
// Why this duplicates the in-process test/unit/mcp-error-envelope.test.js:
// the in-process probe exercises the JS-level dispatcher only. Some
// bundlers / Node-Worker setups can break console.error stderr routing
// at the runtime level — this test asserts the real stdio.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');
const mcpEntry = path.join(repoRoot, 'bin', 'mcp.js');

test('SEC-14-06 spawn: error envelope on stdout has no stack/path; stack lives only in stderr',
  { timeout: 10000 },
  async () => {
    const child = spawn(process.execPath, [mcpEntry], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => { stdout += b.toString(); });
    child.stderr.on('data', (b) => { stderr += b.toString(); });

    // 1. MCP handshake — initialize
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '0.0.0' },
      },
    }) + '\n');

    // Brief pause for the server to respond to initialize
    await new Promise((r) => setTimeout(r, 500));

    // 2. Trigger a thrown handler — load-replay with null id throws
    //    "invalid replay id: must be a non-empty string" from validateReplayId.
    //    The thrown Error's stack contains the absolute path to replays.js,
    //    which is exactly what the central catch must NOT leak.
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'forensics', arguments: { action: 'load-replay', replayId: null } },
    }) + '\n');

    // Wait for response
    await new Promise((r) => setTimeout(r, 1000));

    child.kill();
    await new Promise((r) => child.on('exit', r));

    // Find the JSON-RPC response with id=2
    const lines = stdout.split('\n').filter(Boolean);
    const resp2 = lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .find((j) => j && j.id === 2);
    assert.ok(resp2, `no JSON-RPC response with id=2 in stdout. stdout=${stdout.slice(0, 500)}`);

    // The handler returned isError:true; the SDK wraps that as result.content[0].text.
    const envelopeText = resp2.result?.content?.[0]?.text ?? '';
    assert.ok(envelopeText, `response missing result.content[0].text: ${JSON.stringify(resp2)}`);

    // 3. Envelope MUST NOT have a "stack" field
    assert.doesNotMatch(envelopeText, /"stack"\s*:/,
      `envelope leaks "stack" key on stdout: ${envelopeText}`);

    // 4. Envelope MUST NOT contain absolute Windows path
    assert.doesNotMatch(envelopeText, /[A-Z]:[\\\/]/,
      `envelope leaks Windows path on stdout: ${envelopeText}`);

    // 5. Envelope MUST NOT contain Unix absolute path under /home, /Users, /root
    assert.doesNotMatch(envelopeText, /\/(home|Users|root)\//,
      `envelope leaks Unix path on stdout: ${envelopeText}`);

    // 6. Envelope SHOULD contain the actual error message preamble (sanity —
    //    over-redaction would strip the diagnostic content too)
    assert.match(envelopeText, /invalid replay id/i,
      `envelope missing real error message on stdout: ${envelopeText}`);

    // 7. STDERR must contain a stack reference — confirms server-side
    //    operator-debug logging actually fires through bin/mcp.js → SDK →
    //    central catch.
    //    Match either the validateReplayId frame or the replays.js path
    //    (cross-platform: on Windows the path is `\src\core\replays.js`,
    //    on Unix `/src/core/replays.js`).
    assert.ok(
      /at\s+validateReplayId/.test(stderr) || /replays\.js/.test(stderr),
      `stderr missing stack trace — server-side debug log not firing. stderr=${stderr.slice(0, 500)}`,
    );

    // 8. STDERR must contain the operator-debug preamble we added to the
    //    central catch in Task 2.
    assert.match(stderr, /\[mcp-server\] error in handler/,
      `stderr missing the operator-debug preamble. stderr=${stderr.slice(0, 500)}`);
  },
);
