// Phase 172 — discovery unit tests.
//
// Invariantes verificadas:
//  - CLAUDE_CONFIG_DIR setado → split + scan apenas esses dirs.
//  - Dir inexistente NÃO crashea, vai para warnings.
//  - jsonl_files inclui apenas *.jsonl recursivos.
//  - source_map mapeia file → config_dir descobridor.
//  - Default fallback: ~/.claude quando nada setado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discover } from '../../src/core/cost/discovery.js';

function makeTempClaudeDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-cost-disc-'));
  const projects = path.join(tmp, 'projects', 'app');
  fs.mkdirSync(projects, { recursive: true });
  const file1 = path.join(projects, 'session-a.jsonl');
  const file2 = path.join(projects, 'session-b.jsonl');
  fs.writeFileSync(file1, '{"timestamp":"2026-06-05T10:00:00Z","model":"claude-sonnet-4-5"}\n');
  fs.writeFileSync(file2, '{"timestamp":"2026-06-05T11:00:00Z","model":"claude-sonnet-4-5"}\n');
  fs.writeFileSync(path.join(projects, 'not-jsonl.txt'), 'ignored');
  return { tmp, files: [file1, file2] };
}

test('discover uses explicit config_dirs option, scanning projects/', () => {
  const { tmp, files } = makeTempClaudeDir();
  const out = discover({ config_dirs: [tmp] });
  assert.equal(out.config_dirs.length, 1);
  assert.equal(out.jsonl_files.length, 2);
  for (const f of files) {
    const norm = f.replace(/\\/g, '/');
    assert.ok(out.jsonl_files.includes(norm), `${norm} not in ${out.jsonl_files}`);
    assert.equal(out.source_map[norm], tmp);
  }
});

test('discover does NOT crash on missing dirs and reports them silently', () => {
  const out = discover({
    config_dirs: [path.join(os.tmpdir(), 'kit-cost-noexistemesmo-12345')],
  });
  assert.deepEqual(out.config_dirs, []);
  assert.deepEqual(out.jsonl_files, []);
});

test('discover via env CLAUDE_CONFIG_DIR splits per platform', () => {
  const { tmp } = makeTempClaudeDir();
  const env = { CLAUDE_CONFIG_DIR: tmp };
  const out = discover({ env, homedir: '/nonexistent-home' });
  assert.equal(out.config_dirs.length, 1);
  assert.ok(out.jsonl_files.length >= 2);
});

test('discover default falls back to ~/.claude', () => {
  // Aponta homedir para tmp + cria dir + arquivo, simula default behavior.
  const { tmp } = makeTempClaudeDir();
  const fakeHome = path.dirname(tmp);
  const claudeDir = path.join(fakeHome, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'projects', 'x'), { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, 'projects', 'x', 's.jsonl'),
    '{"timestamp":"2026-06-05T12:00:00Z","model":"claude-sonnet-4-5"}\n',
  );
  const out = discover({ env: {}, homedir: fakeHome });
  assert.ok(out.config_dirs.some((d) => d === claudeDir));
  assert.ok(out.jsonl_files.length >= 1);
});

test('discover finds jsonls recursively under config dir directly when no projects/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-cost-flat-'));
  fs.writeFileSync(
    path.join(tmp, 'top.jsonl'),
    '{"timestamp":"2026-06-05T12:00:00Z","model":"claude-sonnet-4-5"}\n',
  );
  const out = discover({ config_dirs: [tmp] });
  assert.equal(out.jsonl_files.length, 1);
});
