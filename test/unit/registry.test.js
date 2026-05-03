import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTargets, getTarget, TARGETS } from '../../src/core/registry.js';

test('TARGETS — has 8 IDEs', () => {
  const ids = Object.keys(TARGETS);
  assert.equal(ids.length, 8);
  for (const required of ['claude-code', 'cursor', 'codex', 'gemini-cli', 'copilot', 'windsurf', 'antigravity', 'trae']) {
    assert.ok(ids.includes(required), `missing target: ${required}`);
  }
});

test('listTargets — returns capability flags including framework and hooks', () => {
  const list = listTargets();
  const claude = list.find(t => t.id === 'claude-code');
  assert.equal(claude.label, 'Claude Code');
  assert.equal(claude.capabilities.framework, true);
  assert.equal(claude.capabilities.hooks, true);
  assert.equal(claude.capabilities.agents, true);
  assert.equal(claude.capabilities.commands, true);

  const cursor = list.find(t => t.id === 'cursor');
  assert.equal(cursor.capabilities.framework, false);
  assert.equal(cursor.capabilities.hooks, false);
  assert.equal(cursor.capabilities.commands, false);
});

test('getTarget — returns target, throws on unknown', () => {
  const t = getTarget('claude-code');
  assert.equal(t.label, 'Claude Code');
  assert.throws(() => getTarget('not-real'), /Unknown target/);
});

test('claude-code mirror-tree spec is well-formed', () => {
  const t = getTarget('claude-code');
  assert.equal(t.framework.mode, 'mirror-tree');
  assert.equal(t.framework.source, 'framework');
  assert.match(t.framework.path, /\.claude\/framework/);
  assert.equal(t.hooks.mode, 'mirror-tree');
  assert.equal(t.hooks.source, 'hooks');
});
