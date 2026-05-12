#!/usr/bin/env node
// scripts/truncate-descriptions.mjs
// Hotfix for CI claude-code target: truncate description fields > 200 chars
// in kit/agents/*.md and kit/commands/*.md. Claude Code spec enforces a 200
// char ceiling on description; other IDE targets do not.
//
// Strategy:
//   - cap at TARGET (195) chars; prefer sentence boundary if one exists past
//     char 80, else hard-cut + ellipsis
//   - never touch files already under the limit (idempotent)
//   - preserve YAML quoting style; add quotes only if the truncated value
//     contains : or # (YAML-unsafe without quotes)

import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX = 200;
const TARGET = 195;
const DIRS = ['kit/agents', 'kit/commands'];

function truncate(raw) {
  let cut = raw.slice(0, TARGET);
  // Prefer last sentence-like boundary after char 80
  const candidates = [cut.lastIndexOf('. '), cut.lastIndexOf('… '), cut.lastIndexOf('— ')];
  const boundary = Math.max(...candidates);
  if (boundary > 80) cut = raw.slice(0, boundary + 1);
  cut = cut.trim().replace(/[,;:—\s]+$/, '');
  if (!/[.!?…]$/.test(cut)) cut += '…';
  return cut;
}

function quoteYaml(s) {
  if (/[:#]/.test(s) || /^[\s>|@`%&*!?]/.test(s)) {
    return '"' + s.replace(/"/g, '\\"') + '"';
  }
  return s;
}

let fixedCount = 0;

for (const dir of DIRS) {
  const files = await fs.readdir(dir);
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const full = path.join(dir, f);
    let content = await fs.readFile(full, 'utf8');
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const dm = fm[1].match(/^description:\s*(.+)$/m);
    if (!dm) continue;
    let raw = dm[1].trim();
    let quoteChar = '';
    const qm = raw.match(/^(['"])(.*)\1$/);
    if (qm) { quoteChar = qm[1]; raw = qm[2]; }
    if (raw.length <= MAX) continue;
    const cut = truncate(raw);
    let serialized;
    if (quoteChar) {
      serialized = quoteChar + cut.replace(new RegExp(quoteChar, 'g'), '\\' + quoteChar) + quoteChar;
    } else {
      serialized = quoteYaml(cut);
    }
    const newLine = 'description: ' + serialized;
    const oldLine = dm[0];
    content = content.replace(oldLine, newLine);
    await fs.writeFile(full, content, 'utf8');
    process.stdout.write(`FIX ${full} ${raw.length} -> ${cut.length}\n`);
    fixedCount++;
  }
}

process.stdout.write(`\nTOTAL FIXED: ${fixedCount}\n`);
