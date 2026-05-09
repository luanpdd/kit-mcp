// SEC-14-06: regression test for src/core/reflect.js — Anthropic API error
// rethrow path must scrub sk-ant-* / x-api-key / Bearer / paths before
// propagating to caller.
//
// Strategy: monkey-patch globalThis.fetch with a stub that returns a 401
// whose body echoes a fake sk-ant-* key (which is exactly what the
// CONTEXT.md observed: real Anthropic 401 responses can include the
// supplied x-api-key in the error body). reflect() should rethrow with
// the secret stripped.
//
// We don't use a real Anthropic credential — the whole point is to
// exercise the error path safely.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { reflect } from '../../src/core/reflect.js';

async function makeFixture() {
  // reflect() needs both a learnings file and an agent .md file before it
  // gets to the API call. Build a minimal fixture so the only failure
  // point is the (mocked) fetch.
  const root = await mkdtemp(path.join(tmpdir(), 'kit-mcp-reflect-test-'));
  await mkdir(path.join(root, '.planning', 'learnings'), { recursive: true });
  await mkdir(path.join(root, 'kit', 'agents'), { recursive: true });
  await writeFile(
    path.join(root, '.planning', 'learnings', 'test-agent.md'),
    '# learnings\n\nfailure 1\n',
    'utf8'
  );
  await writeFile(
    path.join(root, 'kit', 'agents', 'test-agent.md'),
    '---\nname: test-agent\n---\n\nbody\n',
    'utf8'
  );
  return root;
}

test('SEC-14-06: reflect() rethrows Anthropic 401 with sk-ant scrubbed', async () => {
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'sk-ant-fakekey1234567890abcdef';

  // Body 1: header-shaped echo. The x-api-key regex consumes the value
  // (including the sk-ant prefix) as a whole, so the marker is the generic
  // 'x-api-key: [REDACTED]' rather than '[REDACTED:anthropic_key]'. Both
  // achieve the security goal — the raw token is scrubbed.
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => 'Invalid x-api-key: sk-ant-leakedfromserver1234567890 — unauthorized',
  });

  try {
    await assert.rejects(
      reflect({
        agent: 'test-agent',
        projectRoot: root,
        kitRoot: path.join(root, 'kit'),
      }),
      (err) => {
        // 1. Preamble preserved
        assert.match(err.message, /Anthropic API 401:/, `preamble missing: ${err.message}`);
        // 2. No raw sk-ant-* prefix anywhere
        assert.doesNotMatch(err.message, /sk-ant-[A-Za-z0-9]/, `sk-ant- leaked: ${err.message}`);
        // 3. The specific echoed token gone
        assert.doesNotMatch(err.message, /sk-ant-leakedfromserver/, `leaked token survived: ${err.message}`);
        // 4. Some redaction marker present (header-shape redaction wins by
        //    pattern ordering — x-api-key matches before sk-ant)
        assert.match(err.message, /\[REDACTED\]/, `redaction marker missing: ${err.message}`);
        return true;
      },
    );
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-14-06: reflect() rethrows Anthropic 401 with bare sk-ant in body scrubbed', async () => {
  // Body shape variant: the leaked sk-ant-* appears OUTSIDE an x-api-key:
  // header context, so the sk-ant pattern (priority 1) matches it specifically
  // and emits the [REDACTED:anthropic_key] marker.
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'sk-ant-fakekey1234567890abcdef';

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => 'authentication_error: token sk-ant-leakedraw1234567890abcdef rejected',
  });

  try {
    await assert.rejects(
      reflect({
        agent: 'test-agent',
        projectRoot: root,
        kitRoot: path.join(root, 'kit'),
      }),
      (err) => {
        assert.doesNotMatch(err.message, /sk-ant-leakedraw/, `sk-ant raw token leaked: ${err.message}`);
        assert.match(err.message, /\[REDACTED:anthropic_key\]/,
          `anthropic_key marker missing: ${err.message}`);
        return true;
      },
    );
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});

test('SEC-14-06: reflect() rethrows Anthropic 401 with Bearer + path scrubbed', async () => {
  // Belt-and-suspenders: a hypothetical 401 that includes a Bearer token AND
  // a leaked filesystem path (e.g., from an internal Anthropic stack frame)
  // — both must be redacted in a single pass.
  const root = await makeFixture();
  const origFetch = globalThis.fetch;
  const origKey = process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = 'sk-ant-anykey1234567890abcdef';

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () =>
      'Bad auth header: Bearer abcdef0123456789abcdef0123456789 (file: /Users/op/srv/handler.js)',
  });

  try {
    await assert.rejects(
      reflect({
        agent: 'test-agent',
        projectRoot: root,
        kitRoot: path.join(root, 'kit'),
      }),
      (err) => {
        assert.doesNotMatch(err.message, /Bearer abcdef/, `Bearer token leaked: ${err.message}`);
        assert.doesNotMatch(err.message, /\/Users\/op\//, `Unix path leaked: ${err.message}`);
        assert.match(err.message, /Bearer \[REDACTED\]/, `Bearer redaction marker missing: ${err.message}`);
        assert.match(err.message, /\[PATH\]/, `path redaction marker missing: ${err.message}`);
        return true;
      },
    );
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    await rm(root, { recursive: true, force: true });
  }
});
