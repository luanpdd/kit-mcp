// Gate runner — execute a gate with explicit user confirmation.
//
// Two modes:
//   - shell: gate body has a ## Check section with one or more fenced code
//     blocks → present what will run, ask y/N, execute via bash
//   - manual: gate body has no executable check → present the body, ask the
//     user to pick passed | warn | block
//
// Returns a structured verdict: { id, verdict, blocking, exitCode?, stdout?, stderr? }
//
// Safety:
//   - Never runs without confirmation in interactive mode
//   - In non-interactive (--yes), runs only the extracted ## Check shell blocks
//   - Always logs the exact command and the cwd before executing
//   - Captures stdout/stderr for the orchestrator to decide what to do next

import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, stderr } from 'node:process';
import { getGate } from './gates.js';

export async function runGate(id, opts = {}) {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const yes         = !!opts.yes;
  const onLog       = opts.onLog ?? ((s) => stderr.write(s + '\n'));
  const interactive = opts.interactive !== false && !yes;

  const gate = await getGate(id, opts.gatesRoot);
  const parsed = parseGateBody(gate.content);

  onLog('');
  onLog(`Gate: ${gate.id}  [stage=${gate.stage}, blocking=${gate.blocking}]`);
  if (gate.description) onLog(`Description: ${gate.description}`);
  onLog('');

  if (parsed.shellBlocks.length > 0) {
    return runShellGate(gate, parsed, { projectRoot, yes, interactive, onLog });
  }
  return runManualGate(gate, parsed, { projectRoot, interactive, onLog });
}

// --- shell-mode gates ---

async function runShellGate(gate, parsed, { projectRoot, yes, interactive, onLog }) {
  const script = parsed.shellBlocks.join('\n\n');

  onLog(`Will execute (cwd=${projectRoot}):`);
  onLog('─────');
  onLog(script);
  onLog('─────');

  let proceed = yes;
  if (interactive && !yes) {
    proceed = await ask('execute? [y/N] ');
  }
  if (!proceed) {
    return { id: gate.id, verdict: 'skipped', blocking: gate.blocking, reason: 'user declined or non-interactive without --yes' };
  }

  const { exitCode, stdout, stderr: errOut } = await execScript(script, projectRoot);
  const verdict = mapVerdict(exitCode, gate);
  onLog(`exit=${exitCode}  →  verdict=${verdict}`);

  return {
    id: gate.id,
    verdict,
    blocking: gate.blocking,
    exitCode,
    stdout: trim(stdout),
    stderr: trim(errOut),
  };
}

// --- manual-mode gates ---

async function runManualGate(gate, parsed, { projectRoot, interactive, onLog }) {
  onLog('This gate has no executable check. Body:');
  onLog('─────');
  onLog(parsed.body.trim());
  onLog('─────');

  if (!interactive) {
    return { id: gate.id, verdict: 'manual', blocking: gate.blocking, reason: 'manual gate; no auto-decision in non-interactive mode' };
  }

  const choice = await askChoice('verdict? [p]assed / [w]arn / [b]lock / [s]kip: ', {
    p: 'passed', w: 'warn', b: 'block', s: 'skipped',
  });

  return { id: gate.id, verdict: choice, blocking: gate.blocking };
}

// --- parsing ---

function parseGateBody(content) {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const checkSection = extractSection(body, 'Check');
  const shellBlocks = extractCodeBlocks(checkSection || '');
  return { body, checkSection, shellBlocks };
}

function extractSection(body, heading) {
  // Line-by-line: find `## Heading`, capture everything until the next `## ` or EOF.
  // Plain regex with `\Z` doesn't exist in JS, and `(?=^##|$)` is awkward — easier this way.
  const lines = body.split(/\r?\n/);
  const startRe = new RegExp(`^##\\s+${heading}\\s*$`, 'i');
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) { start = i + 1; break; }
  }
  if (start === -1) return null;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

function extractCodeBlocks(text) {
  const out = [];
  const re = /```(?:bash|sh|shell)?\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const code = m[1].trim();
    if (code) out.push(code);
  }
  return out;
}

// --- exec ---

async function execScript(script, cwd) {
  // SEC-14-04: use mkdtemp for crypto-safe random directory naming, write the
  // script INSIDE it, then cleanup recursive. Predictable timestamp+rand-suffix
  // filenames are unsafe in multi-user /tmp — attacker can pre-create a symlink
  // at the predicted path before fs.writeFile, and `spawn(bash, [tmp])` would
  // execute the symlink target. mkdtemp uses the OS-level mkdtemp(3) syscall
  // (POSIX) / equivalent (Windows) which atomically creates a directory with
  // a random suffix and returns the actual path. The new dir gets 0700 from
  // process umask on POSIX (umask 022 → 0700; default Node runtime). Even if
  // umask is permissive, the script file inside is written with mode 0o700.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-'));
  const tmp = path.join(dir, 'gate.sh');
  await fs.writeFile(tmp, script, { encoding: 'utf8', mode: 0o700 });
  try {
    const child = spawn('bash', [tmp], { cwd, env: process.env });
    const stdout = [], stderrOut = [];
    child.stdout.on('data', (b) => stdout.push(b));
    child.stderr.on('data', (b) => stderrOut.push(b));
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', (e) => reject(new Error(`failed to spawn bash: ${e.message}. Install Git Bash or WSL on Windows.`)));
      child.on('close', resolve);
    });
    return {
      exitCode: exitCode ?? -1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderrOut).toString('utf8'),
    };
  } finally {
    // Recursive cleanup — even if spawn errored above, the dir gets removed.
    // force:true swallows ENOENT (e.g. if script self-deleted). recursive:true
    // walks the dir; even if the gate body wrote temp files inside cwd, cwd is
    // separate from `dir` so we won't blast user files.
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// --- verdict mapping ---

function mapVerdict(exitCode, gate) {
  if (exitCode === 0) return 'passed';
  return gate.blocking ? 'block' : 'warn';
}

// --- prompts ---

async function ask(question) {
  const rl = createInterface({ input, output });
  try {
    const a = (await rl.question(question)).trim().toLowerCase();
    return a === 'y' || a === 'yes';
  } finally {
    rl.close();
  }
}

async function askChoice(question, mapping) {
  const rl = createInterface({ input, output });
  try {
    while (true) {
      const a = (await rl.question(question)).trim().toLowerCase();
      if (mapping[a]) return mapping[a];
      output.write(`unknown choice "${a}". try one of: ${Object.keys(mapping).join(', ')}\n`);
    }
  } finally {
    rl.close();
  }
}

function trim(s) {
  if (!s) return s;
  return s.length > 4000 ? s.slice(0, 4000) + `\n…(truncated, ${s.length} bytes total)` : s;
}
