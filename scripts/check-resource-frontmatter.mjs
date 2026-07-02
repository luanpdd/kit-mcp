#!/usr/bin/env node
// Resource frontmatter gate (Phase: v1.41 — quality gate).
//
// Validates that every agent/skill in kit/ honors the canonical frontmatter
// invariants that the rest of the toolchain (selector UI, cost pre-flight,
// CLAUDE.md aggregation, Claude Code's YAML parser) depends on:
//
//   1. cost_tier ∈ {leve, medio, pesado}                 (agents + skills)
//   2. description ≤ 200 chars AND ≤ 200 bytes (UTF-8)    (agents + skills + commands)
//   3. description has no "…" (U+2026 ellipsis)           (agents + skills + commands)
//   4. unquoted description has no ": " (colon+space)     (agents + skills + commands)
//      → breaks Claude Code's YAML frontmatter parser; the kit convention is "—".
//   5. agents: every declared tool is a known built-in OR an mcp__* pattern.
//
// Pure + dependency-free so it runs in prepublishOnly (no bash needed — works on
// Windows) and is imported by test/unit/resource-frontmatter.test.js.
//
//   node scripts/check-resource-frontmatter.mjs            # report + exit 1 on any violation
//   node scripts/check-resource-frontmatter.mjs --json     # machine-readable

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DESC_MAX = 200;
const VALID_COST_TIERS = new Set(['leve', 'medio', 'pesado']);

// Built-in Claude Code tools an agent may declare. MCP tools (mcp__server__tool
// or mcp__server__*) are external and validated only by the mcp__ prefix shape —
// their existence depends on which MCP servers the host has connected.
const BUILTIN_TOOLS = new Set([
  'Read', 'Write', 'Edit', 'NotebookEdit', 'Bash', 'BashOutput', 'KillShell',
  'Glob', 'Grep', 'Task', 'WebSearch', 'WebFetch', 'AskUserQuestion',
  'TodoWrite', 'SlashCommand', 'ExitPlanMode',
]);

function extractFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

// Return the RAW value text on the `description:` line (NOT the folded/joined
// form) so we can inspect quoting and the literal ": " sequence. Multi-line
// folded descriptions (`description: >`) are joined for the length check.
function parseFrontmatterFields(fm) {
  const lines = fm.split(/\r?\n/);
  const fields = { description: null, descriptionRaw: null, cost_tier: null, tools: [], hasTools: false };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dm = line.match(/^description:\s?(.*)$/);
    if (dm && fields.descriptionRaw === null) {
      let raw = dm[1];
      if (raw === '>' || raw === '|' || raw === '>-' || raw === '|-') {
        // Folded/literal block scalar — collect indented continuation lines.
        const collected = [];
        let j = i + 1;
        while (j < lines.length && /^\s+/.test(lines[j])) { collected.push(lines[j].trim()); j++; }
        fields.descriptionRaw = collected.join(' ');
        fields.description = fields.descriptionRaw;
      } else {
        fields.descriptionRaw = raw;
        // Strip surrounding quotes for the length/ellipsis checks (but keep raw
        // for the ": " quoting rule).
        fields.description = raw.replace(/^["']/, '').replace(/["']$/, '');
      }
      continue;
    }
    const cm = line.match(/^cost_tier:\s*(.*)$/);
    if (cm) { fields.cost_tier = cm[1].trim().replace(/^["']|["']$/g, ''); continue; }
    const tm = line.match(/^tools:\s?(.*)$/);
    if (tm) {
      fields.hasTools = true;
      const inline = tm[1].trim();
      if (inline) {
        for (const t of inline.split(',')) { const v = t.trim(); if (v) fields.tools.push(v); }
      } else {
        // YAML list form: subsequent `  - Tool` lines.
        let j = i + 1;
        while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
          fields.tools.push(lines[j].replace(/^\s*-\s+/, '').trim());
          j++;
        }
      }
    }
  }
  return fields;
}

function byteLength(s) { return Buffer.byteLength(s, 'utf8'); }

function isQuoted(raw) {
  const t = raw.trim();
  return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"));
}

function checkDescription(rel, fields, violations) {
  if (fields.descriptionRaw === null) {
    violations.push({ file: rel, rule: 'description-missing', detail: 'sem description: no frontmatter' });
    return;
  }
  const desc = fields.description ?? '';
  const chars = [...desc].length;
  const bytes = byteLength(desc);
  if (chars > DESC_MAX) {
    violations.push({ file: rel, rule: 'description-too-long-chars', detail: `${chars} chars (max ${DESC_MAX})` });
  }
  if (bytes > DESC_MAX) {
    violations.push({ file: rel, rule: 'description-too-long-bytes', detail: `${bytes} bytes (max ${DESC_MAX})` });
  }
  if (desc.includes('…')) {
    violations.push({ file: rel, rule: 'description-ellipsis', detail: 'contém "…" (use texto completo)' });
  }
  if (!isQuoted(fields.descriptionRaw) && /:\s/.test(fields.descriptionRaw)) {
    violations.push({ file: rel, rule: 'description-colon-space', detail: 'contém ": " em description não-aspada (quebra o parser YAML; use "—")' });
  }
}

function checkCostTier(rel, fields, violations) {
  if (fields.cost_tier === null) {
    violations.push({ file: rel, rule: 'cost_tier-missing', detail: 'sem cost_tier: no frontmatter' });
  } else if (!VALID_COST_TIERS.has(fields.cost_tier)) {
    violations.push({ file: rel, rule: 'cost_tier-invalid', detail: `cost_tier="${fields.cost_tier}" (válidos: leve|medio|pesado)` });
  }
}

function checkTools(rel, fields, violations) {
  if (!fields.hasTools) return; // tools is optional (agent inherits all)
  for (const t of fields.tools) {
    if (t.startsWith('mcp__')) continue; // external MCP tool — shape-validated only
    if (!BUILTIN_TOOLS.has(t)) {
      violations.push({ file: rel, rule: 'tool-unknown', detail: `tool desconhecida "${t}" (não é built-in nem mcp__*)` });
    }
  }
}

export async function checkResourceFrontmatter(kitRoot = path.join(REPO_ROOT, 'kit')) {
  const violations = [];

  // Agents — all rules (incl. cost_tier + tools).
  const agentsDir = path.join(kitRoot, 'agents');
  for (const name of (await safeReaddir(agentsDir)).filter((n) => n.endsWith('.md'))) {
    const rel = `agents/${name}`;
    const fm = extractFrontmatter(await fs.readFile(path.join(agentsDir, name), 'utf8'));
    if (!fm) { violations.push({ file: rel, rule: 'frontmatter-missing', detail: 'sem delimitadores ---' }); continue; }
    const fields = parseFrontmatterFields(fm);
    checkDescription(rel, fields, violations);
    checkCostTier(rel, fields, violations);
    checkTools(rel, fields, violations);
  }

  // Skills — description + cost_tier (no tools field).
  const skillsDir = path.join(kitRoot, 'skills');
  for (const dir of await safeReaddir(skillsDir)) {
    const skillFile = path.join(skillsDir, dir, 'SKILL.md');
    let raw;
    try { raw = await fs.readFile(skillFile, 'utf8'); } catch { continue; }
    const rel = `skills/${dir}/SKILL.md`;
    const fm = extractFrontmatter(raw);
    if (!fm) { violations.push({ file: rel, rule: 'frontmatter-missing', detail: 'sem delimitadores ---' }); continue; }
    const fields = parseFrontmatterFields(fm);
    checkDescription(rel, fields, violations);
    checkCostTier(rel, fields, violations);
  }

  // Commands — description rules only (no cost_tier / tools requirement).
  const commandsDir = path.join(kitRoot, 'commands');
  for (const name of (await safeReaddir(commandsDir)).filter((n) => n.endsWith('.md'))) {
    const rel = `commands/${name}`;
    const fm = extractFrontmatter(await fs.readFile(path.join(commandsDir, name), 'utf8'));
    if (!fm) continue; // some commands are pure routers; description optional
    const fields = parseFrontmatterFields(fm);
    if (fields.descriptionRaw !== null) checkDescription(rel, fields, violations);
  }

  return { ok: violations.length === 0, violations };
}

async function safeReaddir(dir) {
  try { return await fs.readdir(dir); } catch { return []; }
}

const argvUrl = 'file:///' + (process.argv[1] || '').replace(/\\/g, '/');
const isMain =
  import.meta.url === argvUrl ||
  import.meta.url === argvUrl.replace('file:////', 'file:///') ||
  process.argv[1] === __filename;

if (isMain) {
  const { ok, violations } = await checkResourceFrontmatter();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ ok, violations }, null, 2) + '\n');
  } else if (ok) {
    process.stderr.write('[check-resource-frontmatter] OK — todos os agents/skills/commands válidos\n');
  } else {
    process.stderr.write(`[check-resource-frontmatter] ${violations.length} violação(ões):\n`);
    for (const v of violations) process.stderr.write(`  ${v.file} — [${v.rule}] ${v.detail}\n`);
  }
  process.exit(ok ? 0 : 1);
}
