// Read the canonical kit/ directory and return a structured index.
// Source of truth: kit/agents/*.md, kit/commands/*.md, kit/skills/*/SKILL.md
//
// Frontmatter is parsed loosely (no external dep) — we only need name & description.

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Resolution order for the kit root (re-evaluated on each call so env-var
// overrides set after module load — e.g. by the CLI preAction hook — work):
//   1. explicit `kitRoot` opt passed by caller
//   2. KIT_MCP_KIT_ROOT env var (per-session override)
//   3. ./kit relative to this package (the bundled example kit)
export const BUNDLED_KIT_ROOT = path.resolve(__dirname, '../../kit');
export function resolveKitRoot(kitRoot) {
  if (kitRoot) return path.resolve(kitRoot);
  if (process.env.KIT_MCP_KIT_ROOT) return path.resolve(process.env.KIT_MCP_KIT_ROOT);
  return BUNDLED_KIT_ROOT;
}

export async function listKit(kitRoot) {
  kitRoot = resolveKitRoot(kitRoot);
  const [agents, commands, skills, skillsExtras] = await Promise.all([
    readMdDir(path.join(kitRoot, 'agents'),    'agent'),
    readMdDir(path.join(kitRoot, 'commands'),  'command'),
    readSkillsDir(path.join(kitRoot, 'skills')),
    readSkillsDir(path.join(kitRoot, 'skills-extras')).catch(() => []),
  ]);
  return { agents, commands, skills, skillsExtras, kitRoot };
}

async function readMdDir(dir, kind) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const absPath = path.join(dir, e.name);
    const raw = await fs.readFile(absPath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    out.push({
      kind,
      name: e.name.replace(/\.md$/, ''),
      absPath,
      frontmatter,
      frontmatterRaw: matchFrontmatterRaw(raw),
      body,
      content: raw,
      description: frontmatter?.description ?? firstNonEmptyLine(body),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function readSkillsDir(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillPath = path.join(dir, e.name, 'SKILL.md');
    let raw;
    try { raw = await fs.readFile(skillPath, 'utf8'); }
    catch { continue; }
    const { frontmatter, body } = splitFrontmatter(raw);
    out.push({
      kind: 'skill',
      name: e.name,
      absPath: skillPath,
      dirPath: path.join(dir, e.name),
      frontmatter,
      frontmatterRaw: matchFrontmatterRaw(raw),
      body,
      skillContent: raw,
      description: frontmatter?.description ?? firstNonEmptyLine(body),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// --- minimal YAML-ish frontmatter parser (no deps) ---
// Handles `key: value`, `key: >` multiline, but NOT nested objects/arrays.
// Good enough for our SKILL.md / agent.md headers.

function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: raw };
  return { frontmatter: parseLooseYaml(m[1]), body: m[2] };
}

function matchFrontmatterRaw(raw) {
  const m = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
  return m ? m[1] : '';
}

function parseLooseYaml(text) {
  const out = {};
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    let val = m[2];
    if (val === '>' || val === '|') {
      // Multiline: collect indented lines
      const collected = [];
      i++;
      while (i < lines.length && /^\s+/.test(lines[i])) {
        collected.push(lines[i].replace(/^\s+/, ''));
        i++;
      }
      out[key] = collected.join(' ').trim();
      continue;
    }
    out[key] = val.trim().replace(/^["']|["']$/g, '');
    i++;
  }
  return out;
}

function firstNonEmptyLine(body) {
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith('#')) return t.slice(0, 200);
  }
  return '';
}

// --- search helpers ---

export function searchKit(kit, query) {
  const q = query.toLowerCase();
  const all = [...kit.agents, ...kit.commands, ...kit.skills, ...kit.skillsExtras];
  return all.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.description ?? '').toLowerCase().includes(q)
  ).map(({ kind, name, description, absPath }) => ({ kind, name, description, absPath }));
}

export function findItem(kit, kind, name) {
  const buckets = { agent: kit.agents, command: kit.commands, skill: [...kit.skills, ...kit.skillsExtras] };
  const b = buckets[kind];
  if (!b) throw new Error(`Unknown kind: ${kind}`);
  return b.find(x => x.name === name) ?? null;
}
