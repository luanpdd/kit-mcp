// CLI mirror of the MCP tools. Same operations, terminal-friendly.
//
//   kit kit list-agents
//   kit kit get agent planner
//   kit sync targets
//   kit sync install claude-code --mode reference
//   kit gates list
//   kit forensics collect --project-root /path/to/project
//   kit install dry-run claude-code
//
// Default output: human-readable colored panels + summaries.
// `--json` flag (global) restores the v1.0 JSON-to-stdout behavior for
// programmatic consumers.

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listKit, searchKit, findItem } from '../core/kit.js';
import { listTargets } from '../core/registry.js';
import { syncTo, statusOf, removeFrom, summarize } from '../core/sync.js';
import { watchKit, detectExistingTargets } from '../core/watch.js';
import { listGates, getGate, gatesForStage } from '../core/gates.js';
import { runGate } from '../core/gate-runner.js';
import { detectReverse, applyReverse } from '../core/reverse-sync.js';
import { collectFailures, summarizeByAgent, writeLearnings } from '../core/failures.js';
import { reflect } from '../core/reflect.js';
import { listReplays, loadReplay } from '../core/replays.js';
import { installMcp, listInstallTargets } from '../mcp-server/install.js';
import { listLogs, tailLogs, logDir, currentLogPath } from '../core/logger.js';
import * as render from './render.js';
import { c, icons, spinner, progress, select, confirm } from '../core/ui.js';
import { readLock, lockPathFor } from '../ui/lockfile.js';
import { checkUpgrade } from './upgrade-check.js';
// PERF-16-04: ui/server.js, ui/wrapper.js, ui/browser.js are loaded LAZILY
// inside the subcommand handlers that need them. See:
//   - maybeWrapForUi (gated on lockfile presence)
//   - ui.start (createServer + openBrowser)
//   - ui.open  (openBrowser)
// This trims ~700 LOC + transitive deps off the cold-start path of non-UI
// commands like `kit kit list-agents --terse`. lockfile.js stays eager because
// readLock() is called by every withProgress() invocation and is dep-free.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';

// Read package.json version at boot so `--version` is always accurate. Falls
// back to a string if the file lookup fails (e.g. unusual install layout).
function readPkgVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '..', '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

const program = new Command()
  .name('kit')
  .description('Personal kit (agents/commands/skills) — CLI mirror of the kit-mcp server.')
  .version(readPkgVersion())
  .option('--kit-root <path>', 'Override the kit root (default: bundled example kit, or KIT_MCP_KIT_ROOT env)')
  .option('--json', 'Output JSON to stdout (machine-readable, restores pre-1.1 default)')
  .option('--no-ui', 'Suppress sidecar event publishing for this run (default: auto-detect lockfile)');

program.hook('preAction', (thisCommand, actionCommand) => {
  const opts = program.opts();
  if (opts.kitRoot) process.env.KIT_MCP_KIT_ROOT = opts.kitRoot;
});

// `out(value, humanRenderer)` — uses the human renderer unless --json is set.
function out(value, humanRenderer) {
  const opts = program.opts();
  if (opts.json) {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  } else if (typeof humanRenderer === 'function') {
    process.stdout.write(humanRenderer(value));
  } else {
    process.stdout.write(render.renderFallback(value));
  }
}

// withSpinner wraps a short opaque op with a spinner; auto-disabled in --json mode.
async function withSpinner(text, fn) {
  const opts = program.opts();
  if (opts.json) return fn();
  const sp = spinner({ text });
  try {
    const r = await fn();
    sp.succeed();
    return r;
  } catch (e) {
    sp.fail(e.message);
    throw e;
  }
}

// withProgress wraps a long op; passes onProgress callback to the core fn.
// Also auto-detects a running sidecar (via lockfile) and multiplexes events to
// it when present. Opt-out via --no-ui or KIT_MCP_NO_UI=1.
async function withProgress(label, total, fn, { tool, projectRoot } = {}) {
  const opts = program.opts();
  let onProgress;
  let p = null;
  if (opts.json) {
    onProgress = () => {};
  } else {
    p = progress({ total, label });
    let last = '';
    onProgress = ({ current, label }) => { last = label || last; p.tick({ label: last }); };
  }

  // Auto-wrap if a sidecar is running for this projectRoot.
  const wrapper = await maybeWrapForUi(onProgress, { tool, projectRoot });
  try {
    const r = await fn(wrapper);
    if (p) p.finish(label);
    if (wrapper.done) wrapper.done({ ok: true });
    return r;
  } catch (e) {
    if (p) p.finish();
    if (wrapper.error) wrapper.error(e);
    throw e;
  }
}

// maybeWrapForUi — returns the original callback unchanged when no sidecar is up
// or the user opted out. Otherwise returns a wrapped callback with .done/.error.
//
// PERF-16-04: this is async because we lazy-load ../ui/wrapper.js only when a
// sidecar lockfile is detected. Common path (no sidecar) returns synchronously
// via passthroughWrapper without touching wrapper.js or its transitive deps.
async function maybeWrapForUi(onProgress, { tool, projectRoot } = {}) {
  const globalOpts = program.opts();
  // commander stores `--no-ui` as opts.ui === false
  if (globalOpts.ui === false || process.env.KIT_MCP_NO_UI === '1') {
    return passthroughWrapper(onProgress);
  }
  const root = projectRoot || process.cwd();
  if (!readLock(root)) {
    return passthroughWrapper(onProgress);
  }
  // Lazy import — only paid when a sidecar IS up for this project.
  const { wrapProgressForUi } = await import('../ui/wrapper.js');
  return wrapProgressForUi(onProgress, { projectRoot: root, tool: tool ?? null });
}

function passthroughWrapper(onProgress) {
  const cb = (p) => { if (typeof onProgress === 'function') onProgress(p); };
  cb.done = () => {};
  cb.error = () => {};
  cb.emit = () => {};
  return cb;
}

function fail(msg) {
  process.stderr.write(`${c.red(icons.cross)} ${msg}\n`);
  process.exit(1);
}

function slim(x) {
  // PERF-13-01: cap description at SUMMARY_MAX_CHARS via shared summarize()
  // helper from src/core/sync.js — keeps cross-surface behavior identical
  // (CLI listing == MCP listing). Full text remains in each item's source file.
  return { kind: x.kind, name: x.name, description: summarize(x.description) };
}

// PERF-15-01: terse variant — paridade com mcp-server slimTerse. CLI flag --terse
// controla seleção. Mantém o mesmo shape {kind, name} para programmatic consumers
// que parseiam --json output (consistência cross-surface).
function slimTerse(x) {
  return { kind: x.kind, name: x.name };
}

// --- kit ---
const kit = program.command('kit').description('Browse the canonical kit.');
kit.command('list-agents')
  .option('--terse', 'Omit description; return only {kind, name} (PERF-15-01)')
  .action(async (opts) => {
    const k = await withSpinner('Loading kit...', () => listKit());
    const variant = opts.terse ? slimTerse : slim;
    out(k.agents.map(variant), v => render.renderKitList(v, 'agent'));
  });
kit.command('list-commands')
  .option('--terse', 'Omit description; return only {kind, name} (PERF-15-01)')
  .action(async (opts) => {
    const k = await withSpinner('Loading kit...', () => listKit());
    const variant = opts.terse ? slimTerse : slim;
    out(k.commands.map(variant), v => render.renderKitList(v, 'command'));
  });
kit.command('list-skills')
  .option('--terse', 'Omit description; return only {kind, name} (PERF-15-01)')
  .action(async (opts) => {
    const k = await withSpinner('Loading kit...', () => listKit());
    const variant = opts.terse ? slimTerse : slim;
    out([...k.skills, ...k.skillsExtras].map(variant), v => render.renderKitList(v, 'skill'));
  });
kit.command('get <kind> <name>').action(async (kind, name) => {
  const k = await listKit();
  const item = findItem(k, kind, name);
  if (!item) return fail(`Not found: ${kind}/${name}`);
  // Always raw for `kit get` — it's intended to be cat-like
  process.stdout.write(item.content ?? item.skillContent);
});
kit.command('search <query>').action(async (q) => out(searchKit(await listKit(), q), render.renderKitSearch));

// --- sync ---
const sync = program.command('sync').description('Project the kit into an IDE.');
sync.command('targets').action(async () => {
  const targets = await withSpinner('Loading capability matrix...', async () => listTargets());
  out(targets, render.renderSyncTargets);
});
sync.command('status <target>')
  .option('--project-root <path>')
  .action(async (target, opts) => out(await statusOf(target, { projectRoot: opts.projectRoot }), render.renderSyncStatus));
sync.command('install [target]')
  .option('--project-root <path>')
  .option('--mode <mode>', 'reference | copy', 'reference')
  .option('--dry-run')
  .option('--quiet', 'Suppress per-file progress; keep final summary')
  .action(async (target, opts) => {
    if (!target) target = await pickTarget(listTargets(), 'Which IDE do you want to sync the kit into?');
    // Phase 160 (v1.28): count written vs skipped so the post-sync summary
    // can render "X new/updated, Y unchanged".
    const tally = { written: 0, skipped: 0 };
    const wrapOnProgress = (orig) => (ev) => {
      if (ev?.skipped) tally.skipped += 1;
      else tally.written += 1;
      if (orig) orig(ev);
    };
    const runSync = (onProgress) => syncTo(target, {
      projectRoot: opts.projectRoot,
      mode: opts.mode,
      dryRun: opts.dryRun,
      onProgress: wrapOnProgress(opts.quiet ? null : onProgress),
    });
    const result = opts.quiet
      ? await runSync()
      : await withProgress(`Syncing kit → ${target}`, 300, runSync,
          { tool: 'sync.install', projectRoot: opts.projectRoot });
    result._tally = tally; // surfaced by renderSyncInstall (v1.28)
    out(result, render.renderSyncInstall);
  });
sync.command('remove <target>')
  .option('--project-root <path>')
  .action(async (target, opts) => out(await removeFrom(target, { projectRoot: opts.projectRoot }), render.renderSyncRemove));
sync.command('watch [targets...]')
  .description('Watch kit/ and re-sync to one or more IDEs on every change. Use --all to pick up every IDE that already has files in the project.')
  .option('--project-root <path>')
  .option('--mode <mode>', 'reference | copy', 'reference')
  .option('--debounce <ms>', 'Debounce window in ms', '300')
  .option('--all', 'Auto-detect every IDE target that currently has files in --project-root')
  .action(async (targets, opts) => {
    let list = targets ?? [];
    if (opts.all) {
      const detected = await detectExistingTargets({ projectRoot: opts.projectRoot });
      list = [...new Set([...list, ...detected])];
    }
    if (list.length === 0) return fail('No targets given. Pass <targets...> or --all.');
    const log = (s) => process.stderr.write(`[watch] ${s}\n`);
    const w = await watchKit(list, {
      projectRoot: opts.projectRoot,
      mode: opts.mode,
      debounceMs: parseInt(opts.debounce, 10),
      onLog: log,
    });
    log(`watching kit/ → ${list.join(', ')} (Ctrl+C to stop)`);
    const shutdown = async () => { log('shutting down...'); await w.stop(); process.exit(0); };
    process.on('SIGINT',  shutdown);
    process.on('SIGTERM', shutdown);
  });

// --- reverse-sync ---
const reverse = program.command('reverse-sync').description('Detect and apply edits made directly in an IDE back to the canonical kit/.');
reverse.command('detect <target>')
  .option('--project-root <path>')
  .action(async (target, opts) => out(await detectReverse(target, { projectRoot: opts.projectRoot }), render.renderReverseDetect));
reverse.command('apply <target>')
  .option('--project-root <path>')
  .option('--strategy <s>', 'skip | overwrite | merge | rename', 'skip')
  .option('--only <items...>', 'Limit to these kind/name pairs (e.g. agent/planner skill/paperclip framework/workflows/foo.md)')
  .option('--dry-run')
  .action(async (target, opts) => {
    const result = await withProgress(
      `Applying reverse-sync (${opts.strategy})`,
      50,
      (onProgress) => applyReverse(target, { projectRoot: opts.projectRoot, strategy: opts.strategy, only: opts.only, dryRun: opts.dryRun, onProgress }),
      { tool: 'reverse-sync.apply', projectRoot: opts.projectRoot },
    );
    out(result, render.renderReverseApply);
  });

// --- gates ---
const gates = program.command('gates').description('Reusable workflow gates.');
gates.command('list').action(async () => out(await listGates(), render.renderGatesList));
gates.command('get <id>').action(async (id) => process.stdout.write((await getGate(id)).content));
gates.command('for-stage <stage>').action(async (stage) => out(await gatesForStage(stage), render.renderGatesList));
gates.command('run <id>')
  .description('Execute a gate (with confirmation in interactive mode). Returns a structured verdict.')
  .option('--project-root <path>')
  .option('--yes', 'Skip confirmation (CI/non-interactive)')
  .option('--no-interactive', 'Never prompt; manual gates return verdict=manual')
  .action(async (id, opts) => out(await runGate(id, {
    projectRoot: opts.projectRoot,
    yes: opts.yes,
    interactive: opts.interactive !== false,
  }), render.renderGateRun));

// --- forensics ---
const forensics = program.command('forensics').description('Failure dataset & replays.');
forensics.command('collect')
  .option('--project-root <path>')
  .action(async (opts) => out(await collectFailures({ projectRoot: opts.projectRoot }), render.renderForensicsCollect));
forensics.command('summarize')
  .option('--project-root <path>')
  .action(async (opts) => {
    const f = await collectFailures({ projectRoot: opts.projectRoot });
    out(await summarizeByAgent(f), render.renderForensicsSummarize);
  });
forensics.command('write-learnings')
  .option('--project-root <path>')
  .action(async (opts) => {
    const f = await collectFailures({ projectRoot: opts.projectRoot });
    out(await writeLearnings(f, { projectRoot: opts.projectRoot }), render.renderFallback);
  });
forensics.command('list-replays')
  .option('--project-root <path>')
  .action(async (opts) => out(await listReplays({ projectRoot: opts.projectRoot }), render.renderListReplays));
forensics.command('reflect')
  .description('LLM-pass: read learnings + current agent, propose minimal prompt edits, optionally apply.')
  .requiredOption('--agent <name>', 'Agent name (matches kit/agents/<name>.md)')
  .option('--project-root <path>')
  .option('--dry-run', 'Save the assembled prompt without calling the LLM')
  .option('--apply', 'Skip confirmation; apply the proposal directly')
  .option('--no-interactive', 'Save proposal but never prompt to apply')
  .action(async (opts) => out(await reflect({
    agent: opts.agent,
    projectRoot: opts.projectRoot,
    dryRun: opts.dryRun,
    apply: opts.apply,
    interactive: opts.interactive !== false,
  }), render.renderFallback));
forensics.command('load-replay <id>')
  .option('--project-root <path>')
  .action(async (id, opts) => out(await loadReplay(id, { projectRoot: opts.projectRoot }), render.renderFallback));

// --- install (the MCP server itself into an IDE) ---
const install = program.command('install').description('Register kit-mcp into an IDE\'s MCP config.');
install.command('targets').action(async () => out(listInstallTargets(), render.renderInstallTargets));
install.command('dry-run <target>')
  .option('--scope <scope>', 'user | project', 'user')
  .option('--name <name>', 'Server name in IDE config', 'kit')
  .option('--via <via>', 'local | npx | global  (how the IDE will invoke the server)', 'local')
  .option('--pkg <name>', 'npm package name (only with --via npx)', '@luanpdd/kit-mcp')
  .option('--project-root <path>')
  .action(async (target, opts) => out(await installMcp(target, { ...opts, dryRun: true }), render.renderInstallResult));
install.command('write [target]')
  .option('--scope <scope>', 'user | project', 'user')
  .option('--name <name>', 'Server name in IDE config', 'kit')
  .option('--via <via>', 'local | npx | global', 'local')
  .option('--pkg <name>', 'npm package name (only with --via npx)', '@luanpdd/kit-mcp')
  .option('--force')
  .option('--project-root <path>')
  .option('--yes', 'Skip confirmation prompt (CI mode)')
  .action(async (target, opts) => {
    const globalOpts = program.opts();
    if (!target) target = await pickTarget(listInstallTargets(), 'Where do you want to register kit-mcp?');

    // Preview first (dry-run)
    const preview = await installMcp(target, { ...opts, dryRun: true });
    if (!preview.ok) {
      out(preview, render.renderInstallResult);
      process.exit(1);
    }

    // Show the preview unless --json
    if (!globalOpts.json) {
      process.stdout.write(`\n${c.bold('Preview:')} ${c.dim(preview.configPath)}\n\n`);
      if (preview.preview) {
        process.stdout.write(c.dim(JSON.stringify(preview.preview, null, 2)) + '\n');
      } else if (preview.snippet) {
        process.stdout.write(c.dim(preview.snippet) + '\n');
      }
    }

    // Confirm unless --yes or --json (programmatic consumers must pass --yes)
    if (!opts.yes && !globalOpts.json) {
      let proceed;
      try {
        proceed = await confirm({ message: 'Apply these changes?', default: false });
      } catch (e) {
        return fail(`${e.message} (use --yes to skip)`);
      }
      if (!proceed) {
        process.stdout.write(`${c.yellow(icons.warn)} Aborted by user.\n`);
        process.exit(0);
      }
    }

    out(await installMcp(target, opts), render.renderInstallResult);
  });

// pickTarget — interactive selector for IDE targets, falls back to error in non-TTY/--json
async function pickTarget(targets, message) {
  const globalOpts = program.opts();
  if (globalOpts.json) {
    return fail('--target is required when using --json mode');
  }
  try {
    return await select({
      message,
      choices: targets.map(t => ({
        name: `${t.label.padEnd(22)} ${c.dim(`(${t.id})`)}`,
        value: t.id,
      })),
    });
  } catch (e) {
    return fail(`${e.message} (or pass <target> as argument)`);
  }
}

// --- ui (sidecar process viewer) ---
const ui = program.command('ui').description('Live process viewer in a localhost browser tab.');

ui.command('start')
  .description('Start the sidecar HTTP server in foreground (Ctrl+C to stop). Prints URL on stderr.')
  .option('--project-root <path>', 'Project root for lockfile keying (default: cwd)')
  .option('--port <n>', 'Bind to a specific port (default: auto-pick 7100-7199)')
  .option('--idle-ms <ms>', 'Idle shutdown timeout (default 0 = never; e.g. 1800000 for 30min)')
  .option('--no-open', 'Skip auto-opening the browser')
  .action(async (opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    const port = opts.port ? Number(opts.port) : undefined;
    const idleMs = opts.idleMs !== undefined ? Number(opts.idleMs) : undefined;
    // PERF-16-04: lazy-load the sidecar HTTP server module only when starting it.
    const { createServer } = await import('../ui/server.js');
    const srv = createServer({ projectRoot, idleMs });
    try {
      const { port: actualPort } = await srv.start({ port });
      const url = `http://127.0.0.1:${actualPort}/`;
      process.stderr.write(`${c.cyan(icons.info)} kit-mcp ui listening on ${url}\n`);
      process.stderr.write(`${c.dim(`  project: ${projectRoot}`)}\n`);
      // U4: non-blocking upgrade check. Warns if local install is behind npm latest.
      // Cached for 24h via ~/.kit-mcp/version-check.json so we don't hit npm on every start.
      checkUpgrade().then((info) => {
        if (info?.behind) {
          process.stderr.write(`${c.yellow(icons.warn)} kit-mcp v${info.local} → v${info.latest} disponível\n`);
          process.stderr.write(`${c.dim('   atualize com: npm i -g @luanpdd/kit-mcp@latest')}\n`);
        }
      }).catch(() => { /* offline / silent */ });
      if (opts.open !== false) {
        // PERF-16-04: lazy-load browser-opener (it lazy-loads `open` package itself).
        const { openBrowser } = await import('../ui/browser.js');
        await openBrowser(url);
      }
      // The server's own SIGINT handler will perform shutdown + cleanup.
      // We just stay alive — server is foreground.
    } catch (err) {
      if (err.code === 'ELIVE') {
        process.stderr.write(`${c.yellow(icons.warn)} sidecar already running for this project\n`);
        process.stderr.write(`  pid: ${err.lock?.pid}, port: ${err.lock?.port}\n`);
        process.stderr.write(`  use 'kit ui status' or 'kit ui open' to inspect\n`);
        process.exit(2);
      }
      fail(err.message);
    }
  });

ui.command('stop')
  .description('Stop the sidecar running for this project (POST /shutdown).')
  .option('--project-root <path>')
  .action(async (opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    const lock = readLock(projectRoot);
    if (!lock) return out({ ok: false, reason: 'no_sidecar' }, () => `${icons.warn} no sidecar running for this project\n`);
    try {
      await postShutdown(lock.port, lock.token);
      out({ ok: true, port: lock.port }, () => `${icons.check} sidecar at port ${lock.port} stopped\n`);
    } catch (err) {
      fail(`could not stop sidecar at port ${lock.port}: ${err.message}`);
    }
  });

ui.command('status')
  .description('Show whether a sidecar is running for this project.')
  .option('--project-root <path>')
  .action(async (opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    const lock = readLock(projectRoot);
    if (!lock) {
      out({ running: false, reason: 'no_lockfile' }, () => `${icons.warn} no sidecar running\n`);
      process.exit(1);
    }
    try {
      const health = await getHealthz(lock.port);
      out({ running: true, ...health, lockfile: lockPathFor(projectRoot) }, render.renderUiStatus ?? renderUiStatusFallback);
    } catch (err) {
      out({ running: false, reason: 'unreachable', lockfile: lockPathFor(projectRoot), error: err.message },
          () => `${icons.cross} lockfile present but sidecar unreachable: ${err.message}\n`);
      process.exit(1);
    }
  });

ui.command('open')
  .description('Open the running sidecar in a browser. Fails if no sidecar is up.')
  .option('--project-root <path>')
  .action(async (opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    const lock = readLock(projectRoot);
    if (!lock) return fail('no sidecar running — start one with `kit ui start`');
    const url = `http://127.0.0.1:${lock.port}/`;
    // PERF-16-04: lazy-load browser-opener.
    const { openBrowser } = await import('../ui/browser.js');
    const r = await openBrowser(url, { force: true });
    if (!r.opened) {
      process.stderr.write(`${c.yellow(icons.warn)} could not open browser (${r.reason}); copy the URL above\n`);
      process.exit(1);
    }
  });

// --- doctor (DX diagnostic) ---
program.command('doctor')
  .description('Diagnose kit-mcp setup: version, sidecar, hook, settings.json, lockfile, .planning/.')
  .option('--project-root <path>', 'Project to diagnose (default: cwd)')
  .action(async (opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    const checks = await runDoctorChecks(projectRoot);
    const failed = checks.filter(c => c.status === 'fail').length;
    const warned = checks.filter(c => c.status === 'warn').length;

    if (program.opts().json) {
      out({ checks, failed, warned }, () => '');
      process.exit(failed > 0 ? 1 : 0);
    }

    process.stdout.write(`\n${c.bold('kit-mcp doctor')} — ${projectRoot}\n\n`);
    for (const check of checks) {
      const sym = check.status === 'pass' ? c.green(icons.check)
                : check.status === 'warn' ? c.yellow(icons.warn)
                : c.red(icons.cross);
      process.stdout.write(`${sym}  ${c.bold(check.label)}\n`);
      if (check.detail)  process.stdout.write(`   ${c.dim(check.detail)}\n`);
      if (check.fix)     process.stdout.write(`   ${c.cyan('fix:')} ${check.fix}\n`);
    }
    process.stdout.write('\n');
    if (failed > 0) {
      process.stdout.write(`${c.red(icons.cross)} ${failed} check(s) failed\n`);
      process.exit(1);
    } else if (warned > 0) {
      process.stdout.write(`${c.yellow(icons.warn)} ${warned} warning(s) — kit-mcp is functional\n`);
    } else {
      process.stdout.write(`${c.green(icons.check)} all checks passed\n`);
    }
  });

async function runDoctorChecks(projectRoot) {
  const checks = [];

  // 1. Version + upgrade availability
  const upgrade = await checkUpgrade();
  if (!upgrade) {
    checks.push({ label: 'version', status: 'fail',
      detail: 'could not read local package.json',
      fix: 'reinstall via `npm i -g @luanpdd/kit-mcp@latest`' });
  } else if (upgrade.latest === null) {
    checks.push({ label: 'version', status: 'warn',
      detail: `local v${upgrade.local} (offline — could not check npm)` });
  } else if (upgrade.behind) {
    checks.push({ label: 'version', status: 'warn',
      detail: `local v${upgrade.local}, latest v${upgrade.latest}`,
      fix: 'npm i -g @luanpdd/kit-mcp@latest' });
  } else {
    checks.push({ label: 'version', status: 'pass',
      detail: `v${upgrade.local} (latest)` });
  }

  // 2. Sidecar lockfile + healthz
  const lock = readLock(projectRoot);
  if (!lock) {
    checks.push({ label: 'sidecar', status: 'warn',
      detail: 'not running for this project',
      fix: 'kit ui start (or omit if you don\'t need the live viewer)' });
  } else {
    try {
      await getHealthz(lock.port);
      checks.push({ label: 'sidecar', status: 'pass',
        detail: `running on port ${lock.port} (pid ${lock.pid})` });
    } catch (err) {
      checks.push({ label: 'sidecar', status: 'fail',
        detail: `lockfile says port ${lock.port} but unreachable: ${err.message}`,
        fix: 'kit ui stop && kit ui start' });
    }
  }

  // 3. ~/.claude/settings.json — exists + valid JSON + hooks present?
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = null;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    checks.push({ label: 'settings.json', status: 'pass',
      detail: settingsPath });
  } catch (err) {
    if (err.code === 'ENOENT') {
      checks.push({ label: 'settings.json', status: 'warn',
        detail: 'not found (expected for fresh Claude Code)',
        fix: 'will be created automatically by Claude Code' });
    } else {
      checks.push({ label: 'settings.json', status: 'fail',
        detail: `invalid JSON at ${settingsPath}: ${err.message}`,
        fix: 'edit the file or restore from .claude/settings.json.bak' });
    }
  }

  // 4. Hook installed?
  if (settings) {
    const hooks = settings.hooks?.PostToolUse;
    const hasHook = Array.isArray(hooks) && hooks.some((h) =>
      Array.isArray(h.hooks) && h.hooks.some((cmd) =>
        typeof cmd.command === 'string' && cmd.command.includes('sidecar-tool-publisher')));
    if (hasHook) {
      checks.push({ label: 'observability hook', status: 'pass',
        detail: 'sidecar-tool-publisher registered as PostToolUse' });
    } else {
      checks.push({ label: 'observability hook', status: 'warn',
        detail: 'sidecar-tool-publisher not registered',
        fix: 'see kit/hooks/sidecar-tool-publisher.js for installation snippet' });
    }
  }

  // 5. Bundled kit dirs exist
  const here = path.dirname(fileURLToPath(import.meta.url));
  const kitRoot = path.resolve(here, '..', '..', 'kit');
  const expected = ['agents', 'commands', 'skills'];
  const missing = expected.filter((d) => {
    try { return !fs.statSync(path.join(kitRoot, d)).isDirectory(); }
    catch { return true; }
  });
  if (missing.length === 0) {
    checks.push({ label: 'bundled kit', status: 'pass',
      detail: `agents/, commands/, skills/ found in ${kitRoot}` });
  } else {
    checks.push({ label: 'bundled kit', status: 'fail',
      detail: `missing: ${missing.join(', ')} in ${kitRoot}`,
      fix: 'reinstall via `npm i -g @luanpdd/kit-mcp@latest`' });
  }

  // 6. .planning/ in projectRoot — only warn if absent (not all projects use the framework)
  const planningDir = path.join(projectRoot, '.planning');
  if (fs.existsSync(planningDir)) {
    const stateOk = fs.existsSync(path.join(planningDir, 'STATE.md'));
    const roadmapOk = fs.existsSync(path.join(planningDir, 'ROADMAP.md'));
    if (stateOk && roadmapOk) {
      checks.push({ label: '.planning/', status: 'pass',
        detail: 'STATE.md + ROADMAP.md present' });
    } else {
      checks.push({ label: '.planning/', status: 'warn',
        detail: `present but missing ${[!stateOk && 'STATE.md', !roadmapOk && 'ROADMAP.md'].filter(Boolean).join(', ')}`,
        fix: 'run `kit saude` to repair, or `/novo-marco` if mid-cycle' });
    }
  } else {
    checks.push({ label: '.planning/', status: 'warn',
      detail: 'no framework state in this project',
      fix: 'run `/novo-projeto` to bootstrap, or skip if not using the framework' });
  }

  // 7. Stale lockfile cleanup hint
  try {
    const tmpdir = os.tmpdir();
    const orphans = fs.readdirSync(tmpdir).filter(n => /^kit-mcp-ui-[0-9a-f]{16}\.lock$/.test(n));
    const stale = [];
    for (const name of orphans) {
      try {
        const lock = JSON.parse(fs.readFileSync(path.join(tmpdir, name), 'utf8'));
        try { process.kill(lock.pid, 0); } catch (err) {
          if (err.code === 'ESRCH') stale.push(name);
        }
      } catch { /* skip unreadable */ }
    }
    if (stale.length > 0) {
      checks.push({ label: 'orphan lockfiles', status: 'warn',
        detail: `${stale.length} stale lockfile(s) in ${tmpdir}`,
        fix: stale.map(n => `rm "${path.join(tmpdir, n)}"`).join(' && ') });
    }
  } catch { /* tmpdir scan is best-effort */ }

  // 8. (v1.28) log dir writable — required for kit logs
  try {
    const dir = logDir();
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.doctor-probe-${process.pid}`);
    fs.writeFileSync(probe, '', 'utf8');
    fs.unlinkSync(probe);
    const files = listLogs();
    checks.push({ label: 'log dir', status: 'pass',
      detail: `${dir} writable (${files.length} log file${files.length === 1 ? '' : 's'})` });
  } catch (err) {
    checks.push({ label: 'log dir', status: 'fail',
      detail: `${logDir()} not writable: ${err.message}`,
      fix: 'check permissions or set KIT_MCP_LOG_DIR to a writable path' });
  }

  // 9. (v1.28) sidecar auto-spawn config — informational
  const noUi = process.env.KIT_MCP_NO_UI === '1' || process.env.KIT_MCP_NO_UI === 'true';
  checks.push({ label: 'sidecar auto-spawn', status: noUi ? 'warn' : 'pass',
    detail: noUi
      ? 'KIT_MCP_NO_UI=1 — sidecar will NOT auto-start on MCP boot'
      : 'enabled (default) — sidecar starts when MCP server boots',
    fix: noUi ? 'unset KIT_MCP_NO_UI if you want live tool-call visibility' : undefined });

  return checks;
}

// Helpers for kit ui (live in cli/ — stdout/console allowed here)
// SEC-14-02: /shutdown now requires Authorization Bearer <token>. Caller must
// pass the per-process token read from the lockfile (lock.token from readLock).
async function postShutdown(port, token) {
  return new Promise((resolve, reject) => {
    const headers = {
      host: `127.0.0.1:${port}`,
      origin: `http://127.0.0.1:${port}`,
      'content-length': 0,
      connection: 'close',
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/shutdown',
      agent: false,
      headers,
    }, (res) => {
      res.resume();
      res.on('end', () => res.statusCode < 400 ? resolve() : reject(new Error(`http_${res.statusCode}`)));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => { try { req.destroy(); } catch {} ; reject(new Error('timeout')); });
    req.end();
  });
}

async function getHealthz(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'GET',
      host: '127.0.0.1',
      port,
      path: '/healthz',
      agent: false,
      headers: { host: `127.0.0.1:${port}`, connection: 'close' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`http_${res.statusCode}`));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => { try { req.destroy(); } catch {} ; reject(new Error('timeout')); });
    req.end();
  });
}

function renderUiStatusFallback(v) {
  if (!v.running) return `${icons.warn} not running\n`;
  return [
    `${icons.check} sidecar running`,
    `  port:        ${v.port}`,
    `  pid (sdcr):  ${v.lockfile ? readLock(process.cwd())?.pid : '?'}`,
    `  uptime:      ${Math.round((v.uptime || 0) / 1000)}s`,
    `  events:      ${v.eventsTotal}`,
    `  subscribers: ${v.subscribers}`,
    `  url:         http://127.0.0.1:${v.port}/`,
    '',
  ].join('\n');
}

// --- status (Phase 162, v1.28: live metrics snapshot + log file path) ---
program.command('status')
  .description('Show MCP server metrics (p50/p95/p99/error rate) + log file path.')
  .option('--project-root <path>', 'Default: cwd')
  .action(async (opts) => {
    const { snapshot, loadSnapshots } = await import('../core/metrics.js');
    const projectRoot = opts.projectRoot || process.cwd();
    const live = snapshot(); // current-process metrics (only useful when called from inside the MCP process)
    const persisted = await loadSnapshots(projectRoot, 60 * 60 * 1000).catch(() => []); // last hour

    if (program.opts().json) {
      out({ live, persistedCount: persisted.length, latest: persisted[persisted.length - 1] || null, logPath: currentLogPath() }, () => '');
      return;
    }

    process.stdout.write(`\n${c.bold('kit-mcp status')}\n\n`);

    // Sidecar
    const lock = readLock(projectRoot);
    process.stdout.write(`${c.bold('sidecar:')}  ${lock ? c.green(`running on port ${lock.port}`) : c.dim('not running')}\n`);

    // Log file
    const files = listLogs();
    process.stdout.write(`${c.bold('log:')}      ${currentLogPath()}\n`);
    process.stdout.write(`           ${c.dim(`${files.length} file(s) in ${logDir()}`)}\n`);

    // Latency from latest persisted snapshot (last hour window)
    const latest = persisted[persisted.length - 1];
    const lat = latest?.latency || live.latency || {};
    const tools = Object.keys(lat);
    process.stdout.write(`\n${c.bold('latency (last hour, or current process):')}\n`);
    if (tools.length === 0) {
      process.stdout.write(`  ${c.dim('no samples yet')}\n`);
    } else {
      const w = Math.max(...tools.map((t) => t.length));
      for (const t of tools) {
        const s = lat[t];
        process.stdout.write(`  ${t.padEnd(w)}  p50 ${c.cyan(s.p50 + 'ms').padEnd(20)} p95 ${c.cyan(s.p95 + 'ms').padEnd(20)} p99 ${c.cyan(s.p99 + 'ms').padEnd(20)} n=${s.count}\n`);
      }
    }

    // Error rate from counters
    const counters = latest?.counters || live.counters || {};
    let okTotal = 0, errTotal = 0;
    for (const [k, v] of Object.entries(counters)) {
      if (k.endsWith(':ok')) okTotal += v;
      if (k.endsWith(':error')) errTotal += v;
    }
    const total = okTotal + errTotal;
    const rate = total === 0 ? 0 : (errTotal / total) * 100;
    process.stdout.write(`\n${c.bold('errors:')}   ${errTotal}/${total} (${rate.toFixed(2)}%)\n\n`);
  });

// --- init (Phase 161, v1.28: guided onboarding — install + sync + doctor) ---
program.command('init')
  .description('Onboard: register kit-mcp into an IDE, sync the kit, run doctor.')
  .option('--ide <id>', 'Skip the IDE picker (e.g. claude-code, cursor, codex)')
  .option('--project-root <path>', 'Default: cwd')
  .option('--non-interactive', 'Fail fast if --ide is missing instead of prompting')
  .option('--mode <mode>', 'sync mode: reference | copy', 'reference')
  .action(async (opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    const targets = listInstallTargets();
    const targetIds = targets.map(t => t.id);

    let ide = opts.ide;
    if (!ide) {
      if (opts.nonInteractive) {
        process.stderr.write(`${c.red(icons.cross)} --non-interactive requires --ide=<${targetIds.join('|')}>\n`);
        process.exit(2);
      }
      ide = await pickTarget(targets, 'Which IDE should kit-mcp register with?');
    }
    if (!targetIds.includes(ide)) {
      process.stderr.write(`${c.red(icons.cross)} unknown IDE "${ide}" — valid: ${targetIds.join(', ')}\n`);
      process.exit(2);
    }

    process.stdout.write(`\n${c.bold('kit init')} → ${ide}\n\n`);

    // 1. Register MCP server in IDE config
    process.stdout.write(`${c.cyan('1/3')} registering MCP server...\n`);
    try {
      const r = await installMcp(ide, { projectRoot });
      process.stdout.write(`     ${c.green(icons.check)} ${r.path || 'config updated'}\n`);
    } catch (e) {
      process.stdout.write(`     ${c.red(icons.cross)} ${e.message}\n`);
      process.exit(1);
    }

    // 2. Sync kit content
    process.stdout.write(`\n${c.cyan('2/3')} syncing kit content...\n`);
    const tally = { written: 0, skipped: 0 };
    try {
      const r = await syncTo(ide, {
        projectRoot,
        mode: opts.mode,
        onProgress: (ev) => { if (ev?.skipped) tally.skipped += 1; else tally.written += 1; },
      });
      const total = (r.written || []).length;
      process.stdout.write(`     ${c.green(icons.check)} ${total} files (${tally.written} new/updated, ${tally.skipped} unchanged)\n`);
    } catch (e) {
      process.stdout.write(`     ${c.red(icons.cross)} ${e.message}\n`);
      process.exit(1);
    }

    // 3. Doctor
    process.stdout.write(`\n${c.cyan('3/3')} running diagnostic...\n`);
    const checks = await runDoctorChecks(projectRoot);
    const failed = checks.filter(c => c.status === 'fail').length;
    const warned = checks.filter(c => c.status === 'warn').length;
    const passed = checks.length - failed - warned;
    process.stdout.write(`     ${failed === 0 ? c.green(icons.check) : c.red(icons.cross)} `
      + `${passed} pass · ${warned} warn · ${failed} fail\n`);

    // 4. Final confirmation
    try {
      const kit = await listKit();
      process.stdout.write(`\n${c.green(icons.check)} ${c.bold(ide)} now sees `
        + `${c.cyan(kit.skills.length)} skills, `
        + `${c.cyan(kit.agents.length)} agents, `
        + `${c.cyan(kit.commands.length)} commands\n\n`);
    } catch { /* non-fatal */ }

    if (failed > 0) {
      process.stdout.write(`${c.yellow(icons.warn)} doctor reported failures — run ${c.cyan('kit doctor')} for details\n`);
      process.exit(1);
    }
  });

// --- replay (Phase 165, v1.28: inspect recorded agent Task() payloads) ---
const replay = program.command('replay').description('List or inspect recorded agent replays.');

replay.command('list')
  .description('List replays in <project-root>/.planning/replays/')
  .option('--project-root <path>', 'Default: cwd')
  .action(async (opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    const items = await listReplays({ projectRoot });
    if (program.opts().json) {
      out(items, () => '');
      return;
    }
    if (items.length === 0) {
      process.stderr.write(`${c.yellow(icons.warn)} no replays at ${path.join(projectRoot, '.planning', 'replays')}\n`);
      return;
    }
    process.stdout.write(`\n${c.bold(items.length + ' replay(s)')}\n\n`);
    for (const r of items) {
      process.stdout.write(`  ${c.cyan(r.id)}\n`);
      process.stdout.write(`    agent: ${c.bold(r.agent || '?')}  phase: ${r.phase || '?'}  plan: ${r.plan || '?'}\n`);
      process.stdout.write(`    ${c.dim(r.recorded_at || '?')}\n\n`);
    }
  });

replay.command('show <id>')
  .description('Show the full recorded payload for a replay id.')
  .option('--project-root <path>', 'Default: cwd')
  .action(async (id, opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    try {
      const r = await loadReplay(id, { projectRoot });
      if (program.opts().json) {
        out(r, () => '');
        return;
      }
      process.stdout.write(`\n${c.bold(r.id)}\n`);
      process.stdout.write(`${c.dim('recorded:')} ${r.recorded_at}\n`);
      process.stdout.write(`${c.dim('agent:')}    ${c.bold(r.agent || '?')}\n`);
      process.stdout.write(`${c.dim('phase:')}    ${r.phase || '?'}\n`);
      process.stdout.write(`${c.dim('plan:')}     ${r.plan || '?'}\n`);
      if (r.outcome) {
        process.stdout.write(`${c.dim('outcome:')}  ${JSON.stringify(r.outcome)}\n`);
      }
      process.stdout.write(`\n${c.bold('payload:')}\n`);
      const { id: _id, recorded_at: _rec, agent: _a, phase: _p, plan: _pl, outcome: _o, ...rest } = r;
      process.stdout.write(JSON.stringify(rest, null, 2) + '\n');
    } catch (e) {
      process.stderr.write(`${c.red(icons.cross)} replay "${id}" not found: ${e.message}\n`);
      process.exit(1);
    }
  });

replay.command('diff <id>')
  .description('Compare a replay payload against its most recent re-record (if any).')
  .option('--project-root <path>', 'Default: cwd')
  .action(async (id, opts) => {
    const projectRoot = opts.projectRoot || process.cwd();
    try {
      const target = await loadReplay(id, { projectRoot });
      const all = await listReplays({ projectRoot });
      // Find newest replay with same agent that isn't the target itself.
      const candidate = all.find((r) => r.id !== id && r.agent === target.agent);
      if (!candidate) {
        process.stdout.write(`${c.yellow(icons.warn)} no peer replay for agent "${target.agent}" — nothing to diff\n`);
        return;
      }
      const newer = await loadReplay(candidate.id, { projectRoot });
      const a = JSON.stringify(target, null, 2).split('\n');
      const b = JSON.stringify(newer, null, 2).split('\n');
      process.stdout.write(`\n${c.bold(`diff ${id}  ↔  ${candidate.id}`)}\n\n`);
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i++) {
        if (a[i] !== b[i]) {
          if (a[i] !== undefined) process.stdout.write(c.red('-') + ' ' + a[i] + '\n');
          if (b[i] !== undefined) process.stdout.write(c.green('+') + ' ' + b[i] + '\n');
        }
      }
    } catch (e) {
      process.stderr.write(`${c.red(icons.cross)} ${e.message}\n`);
      process.exit(1);
    }
  });

// --- inspect (Phase 163, v1.28: live TUI mirror of MCP request/response) ---
program.command('inspect')
  .description('Live request/response mirror — pretty-print MCP tool calls as they happen.')
  .option('--tail <n>', 'show last N events (default 20)', '20')
  .action(async (opts) => {
    const lines = parseInt(opts.tail, 10) || 20;
    if (process.env.KIT_MCP_INSPECT !== '1' && process.env.KIT_MCP_INSPECT !== 'true') {
      process.stderr.write(`${c.yellow(icons.warn)} verbose payload capture is OFF\n`);
      process.stderr.write(`${c.dim('set KIT_MCP_INSPECT=1 in the env where kit-mcp runs to capture args/result')}\n`);
      process.stderr.write(`${c.dim('(events are still tailed; just without payloads)')}\n\n`);
    }

    const render = (raw) => {
      try {
        const ev = JSON.parse(raw);
        const t = ev.ts ? ev.ts.replace('T', ' ').replace('Z', '') : '?';
        const status = ev.status === 'ok' ? c.green('●') : c.red('●');
        const tool = c.bold(ev.tool || '?');
        const action = ev.action ? c.cyan(ev.action) : '';
        const dur = ev.duration_ms !== undefined ? c.dim(`(${ev.duration_ms}ms)`) : '';
        process.stdout.write(`\n${status} ${c.dim(t)}  ${tool} ${action} ${dur}\n`);
        if (ev.args !== undefined) {
          process.stdout.write(`  ${c.dim('req:')}  ${JSON.stringify(ev.args)}\n`);
        }
        if (ev.result !== undefined && ev.result !== null) {
          const pretty = JSON.stringify(ev.result);
          process.stdout.write(`  ${c.dim('res:')}  ${pretty.length > 200 ? pretty.slice(0, 200) + '…' : pretty}\n`);
        }
        if (ev.error_type) {
          process.stdout.write(`  ${c.red('err:')}  ${ev.error_type}\n`);
        }
      } catch {
        process.stdout.write(raw + '\n');
      }
    };

    const t = tailLogs({ lines, follow: true, onLine: render });
    process.stdout.write(`${c.dim(`-- inspecting ${currentLogPath()} (Ctrl-C to stop) --`)}\n`);
    process.on('SIGINT', () => { t.stop(); process.exit(0); });
    await new Promise(() => {});
  });

// --- logs (Phase 158, v1.28: tail kit-mcp tool-call log) ---
program.command('logs')
  .description('Tail JSONL logs of MCP tool invocations (~/.kit-mcp/logs/).')
  .option('--tail <n>', 'show last N lines (default 50)', '50')
  .option('--follow', 'keep streaming new events as they arrive')
  .option('--path', 'print the current log file path and exit')
  .action(async (opts) => {
    if (opts.path) {
      process.stdout.write(`${currentLogPath()}\n`);
      return;
    }
    const lines = parseInt(opts.tail, 10) || 50;
    const files = listLogs();
    if (files.length === 0) {
      process.stderr.write(`${c.yellow(icons.warn)} no logs yet at ${logDir()}\n`);
      process.stderr.write(`${c.dim('logs are appended when the MCP server handles a tool call')}\n`);
      process.exit(0);
    }
    const isJson = program.opts().json;
    const render = (raw) => {
      if (isJson) { process.stdout.write(raw + '\n'); return; }
      try {
        const ev = JSON.parse(raw);
        const t = ev.ts ? ev.ts.replace('T', ' ').replace('Z', '') : '?';
        const status = ev.status === 'ok' ? c.green(icons.check) : c.red(icons.cross);
        const tool = c.bold(ev.tool || '?');
        const action = ev.action ? c.dim(`[${ev.action}]`) : '';
        const dur = ev.duration_ms !== undefined ? c.cyan(`${ev.duration_ms}ms`) : '';
        const err = ev.error_type ? c.red(` (${ev.error_type})`) : '';
        process.stdout.write(`${c.dim(t)}  ${status} ${tool} ${action} ${dur}${err}\n`);
      } catch {
        process.stdout.write(raw + '\n');
      }
    };

    const t = tailLogs({ lines, follow: !!opts.follow, onLine: render });
    if (opts.follow) {
      process.stdout.write(`${c.dim(`-- following ${currentLogPath()} (Ctrl-C to stop) --`)}\n`);
      process.on('SIGINT', () => { t.stop(); process.exit(0); });
      // keep process alive
      await new Promise(() => {});
    }
  });

program.parseAsync(process.argv);
