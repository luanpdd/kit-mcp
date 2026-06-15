// Bundle-aware kit-router (RFC §7.4): syncTo bakes the installed-pack set into
// the projected kit-router.cjs so it only routes to installed domains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { syncTo, renderRouterHook } from '../../src/core/sync.js';
import { BUNDLED_KIT_ROOT } from '../../src/core/kit.js';

const SENTINEL = 'const INSTALLED_PACKS = null; // KIT_MCP_INSTALLED_PACKS';

// --- renderRouterHook (pure) -------------------------------------------------

test('renderRouterHook — injects effective packs array', () => {
  const out = renderRouterHook(SENTINEL, ['core', 'legacy']);
  assert.match(out, /const INSTALLED_PACKS = \["core","legacy"\]; \/\/ KIT_MCP_INSTALLED_PACKS/);
});

test('renderRouterHook — null effective keeps full kit (all domains)', () => {
  assert.equal(renderRouterHook(SENTINEL, null), SENTINEL);
});

test('renderRouterHook — missing sentinel copied verbatim', () => {
  const src = 'const DOMAINS = [];\n';
  assert.equal(renderRouterHook(src, ['core']), src);
});

// --- integration: projected router actually filters ---------------------------

function runRouter(routerPath, prompt) {
  const r = spawnSync(process.execPath, [routerPath], { input: JSON.stringify({ prompt }), encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '' };
}

test('projected router — subset install filters out uninstalled domains', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-router-'));
  try {
    await syncTo('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, mode: 'reference', packs: ['core', 'legacy'] });
    const routerPath = path.join(tmp, '.claude', 'hooks', 'kit-router.cjs');
    const content = await fs.readFile(routerPath, 'utf8');
    assert.match(content, /const INSTALLED_PACKS = \["core","legacy"\]/);

    // supabase domain not installed → no routing directive emitted.
    const sup = runRouter(routerPath, 'preciso de rls no supabase');
    assert.equal(sup.stdout.trim(), '', 'supabase prompt must not route (pack absent)');

    // legacy domain installed → directive emitted.
    const leg = runRouter(routerPath, 'preciso refatorar codigo legado sem testes');
    assert.match(leg.stdout, /Legacy \/ refactor/, 'legacy prompt routes');

    // core (phases) always available.
    const core = runRouter(routerPath, 'vamos planejar fase nova');
    assert.match(core.stdout, /Workflow de fases/, 'core phase domain routes');
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('projected router — full install keeps all domains', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-router-full-'));
  try {
    await syncTo('claude-code', { projectRoot: tmp, kitRoot: BUNDLED_KIT_ROOT, mode: 'reference' });
    const routerPath = path.join(tmp, '.claude', 'hooks', 'kit-router.cjs');
    const content = await fs.readFile(routerPath, 'utf8');
    assert.match(content, /const INSTALLED_PACKS = null;/);
    const sup = runRouter(routerPath, 'preciso de rls no supabase');
    assert.match(sup.stdout, /Supabase/, 'full install routes supabase');
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
