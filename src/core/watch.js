// Watch the canonical kit/ and re-sync to one or more IDE targets on every change.
//
// Usage from CLI: `kit sync watch <target...> [--all]`
// Usage from code: `await watchKit(['claude-code', 'cursor'], opts) → { stop }`
//
// Behavior:
//   - Initial full sync to each target on start
//   - Debounced re-sync (default 300ms) on add/change/unlink under kit/
//   - Per-event log to opts.onLog (defaults to no-op so callers control output)
//   - Returns { stop } to cleanly tear down the watcher

import path from 'node:path';
import fs from 'node:fs/promises';
import { syncTo } from './sync.js';
import { listTargets } from './registry.js';
import { resolveKitRoot, clearKitCache } from './kit.js';

// PERF-16-06: chokidar é optionalDependency. Carregamos lazy dentro de watchKit()
// para que (a) `kit sync install` (que NÃO usa watch) não pague o custo de boot,
// e (b) `npm install --omit=optional` produza CLI core funcional (apenas
// `kit sync watch` falha com mensagem descritiva).
let _chokidarModule = null;
async function loadChokidar() {
  if (_chokidarModule) return _chokidarModule;
  try {
    const mod = await import('chokidar');
    _chokidarModule = mod.default || mod;
    return _chokidarModule;
  } catch (err) {
    throw new Error(
      'kit sync watch requires chokidar. Install with `npm i chokidar` or use `kit sync install <target>` for one-shot syncing instead.'
    );
  }
}

export async function watchKit(targets, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot     = resolveKitRoot(opts.kitRoot);
  const mode        = opts.mode ?? 'reference';
  // PERF-16-02: bump default 300 → 500ms to coalesce IDE save-bursts (typical
  // IDE auto-save fires 5-10 events in < 500ms during a single user save).
  const debounceMs  = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 500;
  const onLog       = opts.onLog ?? (() => {});

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('watchKit: targets[] required (or use detectTargets()).');
  }

  // Initial sync
  for (const t of targets) {
    const r = await syncTo(t, { projectRoot, kitRoot, mode });
    onLog(`✓ initial sync → ${t} (${r.written.length} files)`);
  }

  const chokidar = await loadChokidar();
  const watcher = chokidar.watch(kitRoot, {
    ignored: (p) => /(^|[/\\])\.[^/\\]/.test(p),  // ignore dotfiles/dotdirs
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  let pending = null;
  const trigger = (label, p) => {
    onLog(`${label} ${path.relative(kitRoot, p)}`);
    if (pending) clearTimeout(pending);
    pending = setTimeout(async () => {
      pending = null;
      // PERF-16-02: invalidate kitCache (TTL 30s in kit.js PERF-01) BEFORE
      // re-sync — otherwise listKit() inside syncTo can return the pre-edit
      // cached value if the burst happened within the TTL window. Coalescing
      // the edit-burst via debounce means clearKitCache fires AT MOST ONCE
      // per 500ms window, regardless of how many save events came in.
      clearKitCache();
      for (const t of targets) {
        try {
          const r = await syncTo(t, { projectRoot, kitRoot, mode });
          onLog(`↻ resynced → ${t} (${r.written.length} files)`);
        } catch (e) {
          onLog(`✗ resync → ${t}: ${e.message}`);
        }
      }
    }, debounceMs);
  };

  watcher.on('add',    (p) => trigger('+', p));
  watcher.on('change', (p) => trigger('~', p));
  watcher.on('unlink', (p) => trigger('-', p));
  watcher.on('error',  (e) => onLog(`! watcher error: ${e.message}`));

  return {
    stop: async () => {
      if (pending) { clearTimeout(pending); pending = null; }
      await watcher.close();
      onLog('watcher stopped');
    },
  };
}

// Detect which targets currently have any files projected into projectRoot.
// Used by `--all` so the user doesn't have to re-list IDEs they already synced to.
export async function detectExistingTargets(opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const all = listTargets();
  const existing = [];
  for (const t of all) {
    // We just check if at least one of the capability directories/files exists.
    const probes = [];
    const reg = (await import('./registry.js')).getTarget(t.id);
    if (reg.rules)    probes.push(path.join(projectRoot, reg.rules.path));
    if (reg.agents)   probes.push(path.join(projectRoot, reg.agents.path));
    if (reg.commands) probes.push(path.join(projectRoot, reg.commands.path));
    if (reg.skills)   probes.push(path.join(projectRoot, reg.skills.path));
    let found = false;
    for (const p of probes) {
      try { await fs.access(p); found = true; break; } catch {}
    }
    if (found) existing.push(t.id);
  }
  return existing;
}
