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
import chokidar from 'chokidar';
import { syncTo } from './sync.js';
import { listTargets } from './registry.js';
import { DEFAULT_KIT_ROOT } from './kit.js';

export async function watchKit(targets, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot     = path.resolve(opts.kitRoot ?? DEFAULT_KIT_ROOT);
  const mode        = opts.mode ?? 'reference';
  const debounceMs  = Number.isFinite(opts.debounceMs) ? opts.debounceMs : 300;
  const onLog       = opts.onLog ?? (() => {});

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('watchKit: targets[] required (or use detectTargets()).');
  }

  // Initial sync
  for (const t of targets) {
    const r = await syncTo(t, { projectRoot, kitRoot, mode });
    onLog(`✓ initial sync → ${t} (${r.written.length} files)`);
  }

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
