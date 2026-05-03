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
import { listKit, searchKit, findItem } from '../core/kit.js';
import { listTargets } from '../core/registry.js';
import { syncTo, statusOf, removeFrom } from '../core/sync.js';
import { watchKit, detectExistingTargets } from '../core/watch.js';
import { listGates, getGate, gatesForStage } from '../core/gates.js';
import { runGate } from '../core/gate-runner.js';
import { detectReverse, applyReverse } from '../core/reverse-sync.js';
import { collectFailures, summarizeByAgent, writeLearnings } from '../core/failures.js';
import { reflect } from '../core/reflect.js';
import { listReplays, loadReplay } from '../core/replays.js';
import { installMcp, listInstallTargets } from '../mcp-server/install.js';
import * as render from './render.js';
import { c, icons, spinner, progress, select, confirm } from '../core/ui.js';

const program = new Command()
  .name('kit')
  .description('Personal kit (agents/commands/skills) — CLI mirror of the kit-mcp server.')
  .version('1.0.0')
  .option('--kit-root <path>', 'Override the kit root (default: bundled example kit, or KIT_MCP_KIT_ROOT env)')
  .option('--json', 'Output JSON to stdout (machine-readable, restores pre-1.1 default)');

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
async function withProgress(label, total, fn) {
  const opts = program.opts();
  if (opts.json) return fn(() => {});
  const p = progress({ total, label });
  let last = '';
  const onProgress = ({ current, label }) => { last = label || last; p.tick({ label: last }); };
  try {
    const r = await fn(onProgress);
    p.finish(label);
    return r;
  } catch (e) {
    p.finish();
    throw e;
  }
}

function fail(msg) {
  process.stderr.write(`${c.red(icons.cross)} ${msg}\n`);
  process.exit(1);
}

function slim(x) {
  return { kind: x.kind, name: x.name, description: x.description, absPath: x.absPath };
}

// --- kit ---
const kit = program.command('kit').description('Browse the canonical kit.');
kit.command('list-agents').action(async () => {
  const k = await withSpinner('Loading kit...', () => listKit());
  out(k.agents.map(slim), v => render.renderKitList(v, 'agent'));
});
kit.command('list-commands').action(async () => {
  const k = await withSpinner('Loading kit...', () => listKit());
  out(k.commands.map(slim), v => render.renderKitList(v, 'command'));
});
kit.command('list-skills').action(async () => {
  const k = await withSpinner('Loading kit...', () => listKit());
  out([...k.skills, ...k.skillsExtras].map(slim), v => render.renderKitList(v, 'skill'));
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
  .action(async (target, opts) => {
    if (!target) target = await pickTarget(listTargets(), 'Which IDE do you want to sync the kit into?');
    const result = await withProgress(
      `Syncing kit → ${target}`,
      300,
      (onProgress) => syncTo(target, { projectRoot: opts.projectRoot, mode: opts.mode, dryRun: opts.dryRun, onProgress }),
    );
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

program.parseAsync(process.argv);
