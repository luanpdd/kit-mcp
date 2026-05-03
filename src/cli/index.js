// CLI mirror of the MCP tools. Same operations, terminal-friendly.
//
//   kit kit list-agents
//   kit kit get agent planner
//   kit sync targets
//   kit sync install claude-code --mode reference
//   kit gates list
//   kit forensics collect --project-root /path/to/project
//   kit install dry-run claude-code

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

const program = new Command()
  .name('kit')
  .description('Personal kit (agents/commands/skills) — CLI mirror of the kit-mcp server.')
  .version('0.1.0');

// --- kit ---
const kit = program.command('kit').description('Browse the canonical kit.');
kit.command('list-agents').action(async () => print((await listKit()).agents.map(slim)));
kit.command('list-commands').action(async () => print((await listKit()).commands.map(slim)));
kit.command('list-skills').action(async () => {
  const k = await listKit();
  print([...k.skills, ...k.skillsExtras].map(slim));
});
kit.command('get <kind> <name>').action(async (kind, name) => {
  const k = await listKit();
  const item = findItem(k, kind, name);
  if (!item) return fail(`Not found: ${kind}/${name}`);
  process.stdout.write(item.content ?? item.skillContent);
});
kit.command('search <query>').action(async (q) => print(searchKit(await listKit(), q)));

// --- sync ---
const sync = program.command('sync').description('Project the kit into an IDE.');
sync.command('targets').action(async () => print(listTargets()));
sync.command('status <target>')
  .option('--project-root <path>')
  .action(async (target, opts) => print(await statusOf(target, { projectRoot: opts.projectRoot })));
sync.command('install <target>')
  .option('--project-root <path>')
  .option('--mode <mode>', 'reference | copy', 'reference')
  .option('--dry-run')
  .action(async (target, opts) => print(await syncTo(target, { projectRoot: opts.projectRoot, mode: opts.mode, dryRun: opts.dryRun })));
sync.command('remove <target>')
  .option('--project-root <path>')
  .action(async (target, opts) => print(await removeFrom(target, { projectRoot: opts.projectRoot })));
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
  .action(async (target, opts) => print(await detectReverse(target, { projectRoot: opts.projectRoot })));
reverse.command('apply <target>')
  .option('--project-root <path>')
  .option('--strategy <s>', 'skip | overwrite | merge | rename', 'skip')
  .option('--only <items...>', 'Limit to these kind/name pairs (e.g. agent/planner skill/paperclip)')
  .option('--dry-run')
  .action(async (target, opts) => print(await applyReverse(target, { projectRoot: opts.projectRoot, strategy: opts.strategy, only: opts.only, dryRun: opts.dryRun })));

// --- gates ---
const gates = program.command('gates').description('Reusable workflow gates.');
gates.command('list').action(async () => print(await listGates()));
gates.command('get <id>').action(async (id) => process.stdout.write((await getGate(id)).content));
gates.command('for-stage <stage>').action(async (stage) => print(await gatesForStage(stage)));
gates.command('run <id>')
  .description('Execute a gate (with confirmation in interactive mode). Returns a structured verdict.')
  .option('--project-root <path>')
  .option('--yes', 'Skip confirmation (CI/non-interactive)')
  .option('--no-interactive', 'Never prompt; manual gates return verdict=manual')
  .action(async (id, opts) => print(await runGate(id, {
    projectRoot: opts.projectRoot,
    yes: opts.yes,
    interactive: opts.interactive !== false,
  })));

// --- forensics ---
const forensics = program.command('forensics').description('Failure dataset & replays.');
forensics.command('collect')
  .option('--project-root <path>')
  .action(async (opts) => print(await collectFailures({ projectRoot: opts.projectRoot })));
forensics.command('summarize')
  .option('--project-root <path>')
  .action(async (opts) => {
    const f = await collectFailures({ projectRoot: opts.projectRoot });
    print(await summarizeByAgent(f));
  });
forensics.command('write-learnings')
  .option('--project-root <path>')
  .action(async (opts) => {
    const f = await collectFailures({ projectRoot: opts.projectRoot });
    print(await writeLearnings(f, { projectRoot: opts.projectRoot }));
  });
forensics.command('list-replays')
  .option('--project-root <path>')
  .action(async (opts) => print(await listReplays({ projectRoot: opts.projectRoot })));
forensics.command('reflect')
  .description('LLM-pass: read learnings + current agent, propose minimal prompt edits, optionally apply.')
  .requiredOption('--agent <name>', 'Agent name (matches kit/agents/<name>.md)')
  .option('--project-root <path>')
  .option('--dry-run', 'Save the assembled prompt without calling the LLM')
  .option('--apply', 'Skip confirmation; apply the proposal directly')
  .option('--no-interactive', 'Save proposal but never prompt to apply')
  .action(async (opts) => print(await reflect({
    agent: opts.agent,
    projectRoot: opts.projectRoot,
    dryRun: opts.dryRun,
    apply: opts.apply,
    interactive: opts.interactive !== false,
  })));
forensics.command('load-replay <id>')
  .option('--project-root <path>')
  .action(async (id, opts) => print(await loadReplay(id, { projectRoot: opts.projectRoot })));

// --- install (the MCP server itself into an IDE) ---
const install = program.command('install').description('Register kit-mcp into an IDE\'s MCP config.');
install.command('targets').action(async () => print(listInstallTargets()));
install.command('dry-run <target>')
  .option('--scope <scope>', 'user | project', 'user')
  .option('--name <name>', 'Server name in IDE config', 'kit')
  .option('--via <via>', 'local | npx | global  (how the IDE will invoke the server)', 'local')
  .option('--pkg <name>', 'npm package name (only with --via npx)', '@luanpdd/kit-mcp')
  .option('--project-root <path>')
  .action(async (target, opts) => print(await installMcp(target, { ...opts, dryRun: true })));
install.command('write <target>')
  .option('--scope <scope>', 'user | project', 'user')
  .option('--name <name>', 'Server name in IDE config', 'kit')
  .option('--via <via>', 'local | npx | global', 'local')
  .option('--pkg <name>', 'npm package name (only with --via npx)', '@luanpdd/kit-mcp')
  .option('--force')
  .option('--project-root <path>')
  .action(async (target, opts) => print(await installMcp(target, opts)));

// --- helpers ---
function print(x) { process.stdout.write(JSON.stringify(x, null, 2) + '\n'); }
function fail(msg) { process.stderr.write(msg + '\n'); process.exit(1); }
function slim(x) { return { kind: x.kind, name: x.name, description: x.description, absPath: x.absPath }; }

program.parseAsync(process.argv);
