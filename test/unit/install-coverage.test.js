// Phase 97 — Coverage ratchet: tests for src/mcp-server/install.js
//
// Pre-existing coverage: 19.46% line. install.js exercises a small surface
// (~150 LOC) but most paths are unreached: every IDE strategy, every via
// transport (local/npx/global), conflict detection, dry-run vs write, and
// the no-mcpConfig refusal. This suite walks all of them with real files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installMcp, listInstallTargets } from '../../src/mcp-server/install.js';

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-install-'));
}

test('listInstallTargets — returns only IDEs with an mcpConfig integration', () => {
  const ts = listInstallTargets();
  // From registry: claude-code, cursor, codex, windsurf, antigravity have mcpConfig.
  // copilot, trae do NOT.
  const ids = ts.map(t => t.id).sort();
  assert.deepEqual(ids, ['antigravity', 'claude-code', 'codex', 'cursor', 'windsurf']);
  // Guard: every returned target has capabilities.mcpConfig === true
  for (const t of ts) assert.equal(t.capabilities.mcpConfig, true);
});

test('installMcp — refuses targets without mcpConfig in registry (e.g. trae)', async () => {
  const r = await installMcp('trae', { projectRoot: mkRoot() });
  assert.equal(r.ok, false);
  assert.match(r.reason, /no MCP config integration/);
});

test('installMcp — merge-mcpServers-json: scope=project, via=local, dry-run returns preview', async () => {
  const root = mkRoot();
  const r = await installMcp('claude-code', {
    scope: 'project',
    projectRoot: root,
    via: 'local',
    dryRun: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.dryRun, true);
  assert.equal(r.target, 'claude-code');
  assert.match(r.configPath, /\.mcp\.json$/);
  assert.ok(r.preview);
  assert.ok(r.preview.mcpServers);
  assert.ok(r.preview.mcpServers.kit);
  // via=local → command is process.execPath, args include bin/mcp.js
  assert.equal(r.preview.mcpServers.kit.command, process.execPath);
  assert.match(r.preview.mcpServers.kit.args[0], /bin[\\/]mcp\.js$/);
  // No file should be written in dryRun
  assert.equal(fs.existsSync(r.configPath), false);
});

test('installMcp — merge-mcpServers-json: actually writes the file when not dry-run', async () => {
  const root = mkRoot();
  const r = await installMcp('claude-code', {
    scope: 'project',
    projectRoot: root,
    via: 'npx',
    name: 'kit',
  });
  assert.equal(r.ok, true);
  assert.equal(r.target, 'claude-code');
  assert.ok(fs.existsSync(r.configPath));
  const written = JSON.parse(fs.readFileSync(r.configPath, 'utf8'));
  assert.ok(written.mcpServers);
  assert.equal(written.mcpServers.kit.command, 'npx');
  assert.deepEqual(written.mcpServers.kit.args, ['-y', '@luanpdd/kit-mcp']);
  // env defaults to empty object
  assert.deepEqual(written.mcpServers.kit.env, {});
});

test('installMcp — merge-mcpServers-json: via=global produces command kit-mcp with no args', async () => {
  const root = mkRoot();
  const r = await installMcp('cursor', {
    scope: 'project',
    projectRoot: root,
    via: 'global',
    dryRun: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.preview.mcpServers.kit.command, 'kit-mcp');
  assert.deepEqual(r.preview.mcpServers.kit.args, []);
});

test('installMcp — merge-mcpServers-json: via=npx with custom --pkg', async () => {
  const root = mkRoot();
  const r = await installMcp('cursor', {
    scope: 'project',
    projectRoot: root,
    via: 'npx',
    pkg: '@my-org/kit',
    dryRun: true,
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.preview.mcpServers.kit.args, ['-y', '@my-org/kit']);
});

test('installMcp — merge: existing entry blocks without --force, succeeds with --force', async () => {
  const root = mkRoot();
  // Seed a config with an existing "kit" entry
  const cfgPath = path.join(root, '.mcp.json');
  fs.writeFileSync(cfgPath, JSON.stringify({
    mcpServers: { kit: { command: 'old', args: [] }, other: { command: 'x', args: [] } },
  }, null, 2), 'utf8');

  const blocked = await installMcp('claude-code', { scope: 'project', projectRoot: root });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /already exists/);
  assert.match(blocked.reason, /--force/);

  const forced = await installMcp('claude-code', { scope: 'project', projectRoot: root, force: true });
  assert.equal(forced.ok, true);
  const written = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  // Forced override preserves the unrelated entry
  assert.ok(written.mcpServers.other);
  // And replaces the kit entry with our generated one
  assert.notEqual(written.mcpServers.kit.command, 'old');
});

test('installMcp — merge: --name <other> avoids the conflict path entirely', async () => {
  const root = mkRoot();
  fs.writeFileSync(path.join(root, '.mcp.json'),
    JSON.stringify({ mcpServers: { kit: { command: 'x', args: [] } } }, null, 2), 'utf8');
  const r = await installMcp('claude-code', {
    scope: 'project',
    projectRoot: root,
    name: 'kit-dev',
  });
  assert.equal(r.ok, true);
  const written = JSON.parse(fs.readFileSync(r.configPath, 'utf8'));
  assert.ok(written.mcpServers.kit, 'original kept');
  assert.ok(written.mcpServers['kit-dev'], 'new entry added');
});

test('installMcp — merge: corrupt existing JSON returns parse error', async () => {
  const root = mkRoot();
  fs.writeFileSync(path.join(root, '.mcp.json'), '{ not valid json', 'utf8');
  const r = await installMcp('claude-code', { scope: 'project', projectRoot: root });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Failed to parse/);
});

test('installMcp — append-toml-snippet (codex): dry-run returns snippet with command and args', async () => {
  const root = mkRoot();
  const r = await installMcp('codex', {
    scope: 'project',
    projectRoot: root,
    via: 'local',
    name: 'kit',
    dryRun: true,
  });
  // codex has no project-level path, so configPath falls back to userPath even
  // when scope=project. The dry-run still returns ok=true with the snippet.
  assert.equal(r.ok, true);
  assert.equal(r.dryRun, true);
  assert.match(r.snippet, /\[mcp_servers\.kit\]/);
  assert.match(r.snippet, /command =/);
  assert.match(r.snippet, /args =/);
});

test('installMcp — append-toml-snippet: env block included only when env is non-empty', async () => {
  const root = mkRoot();

  // No env → no env line
  const r1 = await installMcp('codex', {
    scope: 'project', projectRoot: root, dryRun: true,
  });
  assert.doesNotMatch(r1.snippet, /^env =/m);

  // With env → env line present
  const r2 = await installMcp('codex', {
    scope: 'project', projectRoot: root, dryRun: true,
    env: { KIT_MCP_KIT_ROOT: '/tmp/foo' },
  });
  assert.match(r2.snippet, /env = \{ KIT_MCP_KIT_ROOT = "\/tmp\/foo" \}/);
});

test('installMcp — append-toml: writes when not dry-run, refuses duplicate section', async () => {
  // Force a project-scoped path by using a target with both userPath and a
  // project-scoped path. codex has no project path, so write to userPath via
  // a custom HOME pointed at our tmp root.
  const root = mkRoot();
  const fakeHome = path.join(root, 'home');
  fs.mkdirSync(fakeHome, { recursive: true });
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  try {
    const r1 = await installMcp('codex', { scope: 'user' });
    assert.equal(r1.ok, true);
    const cfgPath = r1.configPath;
    assert.ok(fs.existsSync(cfgPath), 'wrote toml file');
    const txt1 = fs.readFileSync(cfgPath, 'utf8');
    assert.match(txt1, /\[mcp_servers\.kit\]/);

    // Second call with same name → refused
    const r2 = await installMcp('codex', { scope: 'user' });
    assert.equal(r2.ok, false);
    assert.match(r2.reason, /already exists/);

    // Different name → appended
    const r3 = await installMcp('codex', { scope: 'user', name: 'kit-dev' });
    assert.equal(r3.ok, true);
    const txt3 = fs.readFileSync(cfgPath, 'utf8');
    assert.match(txt3, /\[mcp_servers\.kit\]/);
    assert.match(txt3, /\[mcp_servers\.kit-dev\]/);
  } finally {
    if (origHome !== undefined) process.env.HOME = origHome; else delete process.env.HOME;
    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile; else delete process.env.USERPROFILE;
  }
});
