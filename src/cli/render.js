// Human-readable renderers for each CLI subcommand. The CLI default switched
// from JSON-to-stdout to these in v1.1; --json restores the old behavior
// (still useful for piping to jq, MCP-like consumers, etc.).
//
// Conventions:
//   - Render functions write to process.stdout (no trailing newline beyond
//     what the formatted output naturally has).
//   - They never throw on missing fields — the result objects come from
//     core/ which already shape them.
//   - Cores happen via src/core/ui.js (which already disables in NO_COLOR
//     or when --no-tty etc.).

import path from 'node:path';
import { c, icons, summary } from '../core/ui.js';

// --- generic helpers ---

function table(rows, headers) {
  if (rows.length === 0) {
    return `${c.dim('(empty)')}\n`;
  }
  const cols = headers.length;
  const widths = new Array(cols).fill(0);
  for (let i = 0; i < cols; i++) widths[i] = Math.max(headers[i].length, ...rows.map(r => String(r[i] ?? '').length));
  const out = [];
  out.push(headers.map((h, i) => c.bold(h.padEnd(widths[i]))).join('  '));
  out.push(headers.map((_, i) => c.dim('─'.repeat(widths[i]))).join('  '));
  for (const r of rows) {
    out.push(r.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  '));
  }
  return out.join('\n') + '\n';
}

// --- kit ---

export function renderKitList(items, kind) {
  if (items.length === 0) {
    return `${c.dim(`No ${kind}s in kit.`)}\n`;
  }
  const rows = items.map(x => [x.name, (x.description ?? '').slice(0, 80)]);
  return table(rows, ['name', 'description']);
}

export function renderKitSearch(results) {
  if (results.length === 0) {
    return `${c.dim('No matches.')}\n`;
  }
  const rows = results.map(x => [x.kind, x.name, (x.description ?? '').slice(0, 70)]);
  return table(rows, ['kind', 'name', 'description']);
}

// --- sync ---

export function renderSyncTargets(targets) {
  const rows = targets.map(t => [
    t.id,
    t.label,
    Object.entries(t.capabilities).filter(([, v]) => v).map(([k]) => k).join(', '),
  ]);
  return table(rows, ['id', 'label', 'capabilities']);
}

export function renderSyncStatus(result) {
  const rows = result.checks.map(c => [c.capability, c.path, c.exists ? '✓' : '—']);
  return `${c.bold(`Status: ${result.target}`)}  ${c.dim(result.projectRoot)}\n` + table(rows, ['cap', 'path', 'present']);
}

export function renderSyncInstall(result) {
  // Tally written paths by capability prefix
  const counts = {};
  for (const p of result.written) {
    const rel = path.relative(result.projectRoot, p).replace(/\\/g, '/');
    // Hide internal markers from the user-facing tally (they're a kit-mcp impl detail)
    if (rel.endsWith('/.kit-mcp-managed')) continue;
    let cap = 'rules';
    if (rel.includes('.claude/agents/'))    cap = 'agents';
    else if (rel.includes('.claude/commands/'))  cap = 'commands';
    else if (rel.includes('.claude/skills/'))    cap = 'skills';
    else if (rel.includes('.claude/framework/')) cap = 'framework';
    else if (rel.includes('.claude/hooks/'))     cap = 'hooks';
    counts[cap] = (counts[cap] ?? 0) + 1;
  }
  const rows = [];
  for (const cap of ['rules', 'agents', 'commands', 'skills', 'framework', 'hooks']) {
    if (counts[cap] !== undefined) rows.push([cap, counts[cap]]);
  }
  const visibleTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  return summary({
    title: `Synced kit → ${result.target}${result.dryRun ? ' (dry-run)' : ''}`,
    rows,
    total: visibleTotal,
    hint: c.dim(result.projectRoot),
  }) + '\n';
}

export function renderSyncRemove(result) {
  return summary({
    title: `Removed kit-mcp stubs from ${result.target}`,
    rows: [['Files removed', result.removed.length]],
    total: result.removed.length,
    hint: c.dim(result.projectRoot),
  }) + '\n';
}

// --- reverse-sync ---

export function renderReverseDetect(result) {
  if (result.candidates.length === 0) {
    return `${c.green(icons.check)} No edits to bring back. Canonical kit and ${result.target} are in sync.\n`;
  }
  const rows = result.candidates.map(x => [x.kind, x.name, x.reason, x.diffSummary ?? '']);
  return `${c.bold(`Candidates: ${result.candidates.length}`)}  ${c.dim(`(${result.target})`)}\n` +
    table(rows, ['kind', 'name', 'reason', 'diff']);
}

export function renderReverseApply(result) {
  const rows = result.results.map(x => [
    x.kind,
    x.name,
    x.action.startsWith('overwrit') || x.action.startsWith('merge') || x.action.startsWith('renamed')
      ? c.green(x.action)
      : x.action.startsWith('skipped') ? c.dim(x.action) : c.yellow(x.action),
  ]);
  return `${c.bold(`Applied (strategy=${result.strategy})`)}\n` + table(rows, ['kind', 'name', 'action']);
}

// --- gates ---

export function renderGatesList(items) {
  const rows = items.map(g => [g.id, g.stage, g.blocking ? c.red('blocking') : c.dim('warn-only'), g.description]);
  return table(rows, ['id', 'stage', 'mode', 'description']);
}

export function renderGateRun(result) {
  const verdictColor = result.verdict === 'passed' ? c.green
                     : result.verdict === 'block'  ? c.red
                     : result.verdict === 'warn'   ? c.yellow
                     : c.dim;
  return `${c.bold(`Gate ${result.id}`)}: ${verdictColor(result.verdict)} ${result.exitCode !== undefined ? c.dim(`(exit ${result.exitCode})`) : ''}\n`;
}

// --- forensics ---

export function renderForensicsCollect(items) {
  if (items.length === 0) return `${c.dim('No failures collected.')}\n`;
  const rows = items.map(x => [x.agent ?? '?', x.kind ?? '?', x.absPath ?? x.path ?? '']);
  return table(rows, ['agent', 'kind', 'path']);
}

export function renderForensicsSummarize(byAgent) {
  const entries = Object.entries(byAgent ?? {});
  if (entries.length === 0) return `${c.dim('No failures.')}\n`;
  const rows = entries.map(([agent, items]) => [agent, Array.isArray(items) ? items.length : '?']);
  return table(rows, ['agent', 'failures']);
}

export function renderListReplays(items) {
  if (!Array.isArray(items) || items.length === 0) return `${c.dim('No replays recorded.')}\n`;
  const rows = items.map(r => [r.id ?? '?', r.agent ?? '?', r.timestamp ?? '?']);
  return table(rows, ['id', 'agent', 'recorded']);
}

// --- install ---

export function renderInstallTargets(targets) {
  const rows = targets.map(t => [t.id, t.label, t.scopes?.join(', ') ?? '?']);
  return table(rows, ['id', 'label', 'scopes']);
}

export function renderInstallResult(result) {
  return summary({
    title: result.dryRun ? `Install preview (${result.target}, scope=${result.scope})` : `Registered kit-mcp → ${result.target} (scope=${result.scope})`,
    rows: [
      ['Path',  result.path ?? '?'],
      ['Name',  result.name ?? 'kit'],
      ['Via',   result.via ?? '?'],
    ].map(([k, v]) => [k, v ?? '—']),
    hint: result.dryRun ? c.dim('No file written (dry-run)') : undefined,
  }) + '\n';
}

// --- generic fallback ---

export function renderFallback(value) {
  // Used when we don't have a custom renderer yet.
  return JSON.stringify(value, null, 2) + '\n';
}
