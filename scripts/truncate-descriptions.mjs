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

// IMPORTANT: the CI gate uses bash ${#var} which counts BYTES, not chars.
// UTF-8 multibyte glyphs (→ … — é ô) inflate, so we cap by BYTE length.
const MAX_BYTES = 200;
const TARGET_BYTES = 195;
const DIRS = ['kit/agents', 'kit/commands'];
const SKILLS_DIR = 'kit/skills';

function byteLen(s) {
  return Buffer.byteLength(s, 'utf8');
}

function truncate(raw) {
  // Shrink by removing tail chars until UTF-8 byte length ≤ TARGET_BYTES.
  // We work in chars but verify by byteLen, so we never split a multi-byte
  // codepoint.
  let cut = raw;
  while (byteLen(cut) > TARGET_BYTES && cut.length > 0) {
    cut = cut.slice(0, -1);
  }
  // Prefer last sentence-like boundary (only if it still fits the budget).
  const candidates = [cut.lastIndexOf('. '), cut.lastIndexOf('… '), cut.lastIndexOf('— ')];
  const boundary = Math.max(...candidates);
  if (boundary > 60) {
    const trimmed = cut.slice(0, boundary + 1);
    if (byteLen(trimmed) <= TARGET_BYTES) cut = trimmed;
  }
  cut = cut.trim().replace(/[,;:—\s]+$/, '');
  if (!/[.!?…]$/.test(cut)) {
    // Add ellipsis only if it still fits; otherwise truncate one more char.
    while (byteLen(cut + '…') > TARGET_BYTES && cut.length > 0) {
      cut = cut.slice(0, -1);
    }
    cut += '…';
  }
  return cut;
}

function quoteYaml(s) {
  if (/[:#]/.test(s) || /^[\s>|@`%&*!?]/.test(s)) {
    return '"' + s.replace(/"/g, '\\"') + '"';
  }
  return s;
}

async function processFile(full) {
  let content = await fs.readFile(full, 'utf8');
  // Accept both LF and CRLF line endings (Windows-checked-out files).
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return false;
  const dm = fm[1].match(/^description:\s*(.+?)\r?$/m);
  if (!dm) return false;
  let raw = dm[1].trim();
  let quoteChar = '';
  const qm = raw.match(/^(['"])(.*)\1$/);
  if (qm) { quoteChar = qm[1]; raw = qm[2]; }
  // The gate uses BYTE length (bash ${#}), so check bytes not chars.
  // We also include surrounding quotes in the count if quoteChar set, since
  // awk in the gate captures the raw line value including quotes.
  const effectiveLen = quoteChar ? byteLen(raw) + 2 : byteLen(raw);
  if (effectiveLen <= MAX_BYTES) return false;
  const cut = truncate(raw);
  let serialized;
  if (quoteChar) {
    serialized = quoteChar + cut.replace(new RegExp(quoteChar, 'g'), '\\' + quoteChar) + quoteChar;
  } else {
    serialized = quoteYaml(cut);
  }
  const newLine = 'description: ' + serialized;
  content = content.replace(dm[0], newLine);
  await fs.writeFile(full, content, 'utf8');
  process.stdout.write(`FIX ${full} ${raw.length} -> ${cut.length}\n`);
  return true;
}

let fixedCount = 0;

// kit/agents/*.md and kit/commands/*.md (flat directories)
for (const dir of DIRS) {
  const files = await fs.readdir(dir);
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    if (await processFile(path.join(dir, f))) fixedCount++;
  }
}

// kit/skills/<name>/SKILL.md (one level of nesting)
try {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const skillPath = path.join(SKILLS_DIR, ent.name, 'SKILL.md');
    try {
      await fs.access(skillPath);
    } catch { continue; }
    if (await processFile(skillPath)) fixedCount++;
  }
} catch { /* no kit/skills dir — skip */ }

process.stdout.write(`\nTOTAL FIXED: ${fixedCount}\n`);
