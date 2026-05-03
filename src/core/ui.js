// UI primitives for the CLI: colors, icons, spinner, progress bar,
// interactive select/confirm prompts, and a summary panel.
//
// Design rules:
//   - Respect process.stdout.isTTY: animations only when interactive.
//     In pipes/CI, fall back to linear status text.
//   - Respect NO_COLOR (https://no-color.org) and FORCE_COLOR=1.
//   - Animations write to stderr to keep stdout clean for `--json` mode
//     (the user can still pipe machine-readable output even with spinners).
//   - Zero hidden globals — every primitive is a plain function/class.

import pc from 'picocolors';
import { select as inqSelect, confirm as inqConfirm } from '@inquirer/prompts';

// --- color helpers ---

const NO_COLOR = process.env.NO_COLOR && process.env.NO_COLOR !== '0';
const FORCE    = process.env.FORCE_COLOR === '1';
const COLOR_ON = FORCE || (!NO_COLOR && process.stdout.isTTY);

function id(s) { return String(s); }
export const c = COLOR_ON
  ? {
      green: pc.green, red: pc.red, yellow: pc.yellow, cyan: pc.cyan,
      magenta: pc.magenta, blue: pc.blue, dim: pc.dim, bold: pc.bold,
      gray: pc.gray, underline: pc.underline,
    }
  : {
      green: id, red: id, yellow: id, cyan: id, magenta: id, blue: id,
      dim: id, bold: id, gray: id, underline: id,
    };

export const icons = {
  check:   '✓',
  cross:   '✗',
  warn:    '⚠',
  dot:     '•',
  arrow:   '→',
  spinner: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'],
};

// --- spinner ---

export function spinner({ text = '' } = {}) {
  const tty = process.stderr.isTTY;
  let i = 0;
  let current = text;
  let timer = null;

  function render() {
    process.stderr.write(`\r${c.cyan(icons.spinner[i])} ${current}\x1b[K`);
    i = (i + 1) % icons.spinner.length;
  }

  if (tty) {
    timer = setInterval(render, 80);
    render();
  } else {
    process.stderr.write(`${icons.dot} ${current}\n`);
  }

  function clearLine() {
    if (tty) process.stderr.write('\r\x1b[K');
  }

  return {
    update(t) { current = t; if (!tty) process.stderr.write(`${icons.dot} ${t}\n`); },
    succeed(t) {
      if (timer) clearInterval(timer);
      clearLine();
      process.stderr.write(`${c.green(icons.check)} ${t ?? current}\n`);
    },
    fail(t) {
      if (timer) clearInterval(timer);
      clearLine();
      process.stderr.write(`${c.red(icons.cross)} ${t ?? current}\n`);
    },
    stop() {
      if (timer) clearInterval(timer);
      clearLine();
    },
  };
}

// --- progress bar ---

export function progress({ total, label = '' } = {}) {
  const tty = process.stderr.isTTY;
  const width = 24;
  let current = 0;
  let lastLabel = label;

  function render() {
    const pct = total === 0 ? 100 : Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((width * pct) / 100);
    const bar = '━'.repeat(filled) + c.dim('━'.repeat(width - filled));
    const line = `${c.cyan(bar)} ${pct.toString().padStart(3)}% ${c.dim(`(${current}/${total})`)} ${lastLabel}`;
    process.stderr.write(`\r${line}\x1b[K`);
  }

  function tick({ label } = {}) {
    current++;
    if (label !== undefined) lastLabel = label;
    if (tty) {
      render();
    } else if (current === total || current % Math.max(1, Math.floor(total / 10)) === 0) {
      // Every ~10% in non-TTY mode
      const pct = total === 0 ? 100 : Math.round((current / total) * 100);
      process.stderr.write(`  ${pct}% ${lastLabel}\n`);
    }
  }

  function finish(text) {
    if (tty) {
      process.stderr.write('\r\x1b[K');
    }
    if (text) process.stderr.write(`${c.green(icons.check)} ${text}\n`);
  }

  if (tty) render();
  return { tick, finish };
}

// --- interactive prompts ---

export async function select(opts) {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive prompt unavailable: stdin is not a TTY. Pass the value as a flag instead.');
  }
  return inqSelect(opts);
}

export async function confirm(opts) {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive prompt unavailable: stdin is not a TTY. Pass --yes to skip confirmation.');
  }
  return inqConfirm(opts);
}

// --- summary panel ---

export function summary({ title, rows = [], total, hint }) {
  const lines = [];
  lines.push(`${c.green(icons.check)} ${c.bold(title)}`);
  lines.push('');

  // Compute label column width
  const w = Math.max(...rows.map(r => String(r[0]).length), 0);
  for (const [label, count, status] of rows) {
    const cnt = count > 0 ? c.green(String(count).padStart(4)) : c.dim(String(count).padStart(4));
    const tail = status === 'fail' ? c.red(icons.cross) : c.green(icons.check);
    lines.push(`  ${label.padEnd(w)}  ${cnt}  ${tail}`);
  }

  if (total !== undefined || hint) {
    lines.push('');
    const totalStr = total !== undefined ? `Total: ${c.bold(total)}` : '';
    const hintStr = hint ? c.dim(`· ${hint}`) : '';
    lines.push(`  ${totalStr}${totalStr && hintStr ? ' ' : ''}${hintStr}`);
  }

  return lines.join('\n');
}

// --- helpers exposed for tests ---

export const _internal = { COLOR_ON };
