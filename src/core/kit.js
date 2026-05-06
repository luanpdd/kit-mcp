// Read the canonical kit/ directory and return a structured index.
// Source of truth: kit/agents/*.md, kit/commands/*.md, kit/skills/*/SKILL.md
//
// Frontmatter is parsed loosely (no external dep) — we only need name & description.

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// PERF-02: Frontmatter regexes compiled once at module load (was being recompiled
// on every readMdDir / readSkillsDir entry — 60+ times per listKit call).
const FRONTMATTER_SPLIT_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const FRONTMATTER_RAW_RE   = /^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/;
const YAML_KEY_RE          = /^([A-Za-z0-9_-]+):\s*(.*)$/;

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

// PERF-01: TTL cache for listKit output. Repeated calls within KIT_CACHE_TTL_MS
// return the cached value — sync/reverse-sync/MCP list-* tools used to walk the
// disk on every invocation. Trade-off: callers that edit kit/ inside the same
// process may see stale data for up to 30s. Acceptable for MCP/CLI ergonomics.
const KIT_CACHE_TTL_MS = 30_000;
const kitCache = new Map(); // `${kitRoot}:${mode}` -> { value, ts }

// PERF-S1: when sync runs in mode=reference (default), the body/content of each
// kit file is never used — only frontmatter (name + description). Reading just
// the first STUB_READ_BYTES is enough for any frontmatter we'd ever produce and
// avoids loading 50 KB+ files (planner.md etc) from disk.
const STUB_READ_BYTES = 4096;

export function clearKitCache() { kitCache.clear(); }

export async function listKit(kitRoot, opts = {}) {
  kitRoot = resolveKitRoot(kitRoot);
  const stubsOnly = opts.stubsOnly === true;
  const cacheKey = `${kitRoot}:${stubsOnly ? 'stubs' : 'full'}`;
  const cached = kitCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < KIT_CACHE_TTL_MS) {
    return cached.value;
  }
  const [agents, commands, skills, skillsExtras] = await Promise.all([
    readMdDir(path.join(kitRoot, 'agents'),    'agent',   { stubsOnly }),
    readMdDir(path.join(kitRoot, 'commands'),  'command', { stubsOnly }),
    readSkillsDir(path.join(kitRoot, 'skills'), { stubsOnly }),
    readSkillsDir(path.join(kitRoot, 'skills-extras'), { stubsOnly }).catch(() => []),
  ]);
  const value = { agents, commands, skills, skillsExtras, kitRoot, stubsOnly };
  kitCache.set(cacheKey, { value, ts: Date.now() });
  return value;
}

// Read just enough bytes from the head of the file to capture the frontmatter.
// Returns the partial string. fs.open + fd.read avoids the OS pre-fetching the
// rest of the file (which fs.readFile would force).
async function readHead(absPath, n) {
  const fd = await fs.open(absPath, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fd.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fd.close();
  }
}

async function readMdDir(dir, kind, { stubsOnly = false } = {}) {
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
    const raw = stubsOnly
      ? await readHead(absPath, STUB_READ_BYTES)
      : await fs.readFile(absPath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const item = {
      kind,
      name: e.name.replace(/\.md$/, ''),
      absPath,
      frontmatter,
      frontmatterRaw: matchFrontmatterRaw(raw),
      description: frontmatter?.description ?? firstNonEmptyLine(body),
    };
    if (!stubsOnly) {
      item.body = body;
      item.content = raw;
    }
    out.push(item);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function readSkillsDir(dir, { stubsOnly = false } = {}) {
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
    try {
      raw = stubsOnly
        ? await readHead(skillPath, STUB_READ_BYTES)
        : await fs.readFile(skillPath, 'utf8');
    } catch { continue; }
    const { frontmatter, body } = splitFrontmatter(raw);
    const item = {
      kind: 'skill',
      name: e.name,
      absPath: skillPath,
      dirPath: path.join(dir, e.name),
      frontmatter,
      frontmatterRaw: matchFrontmatterRaw(raw),
      description: frontmatter?.description ?? firstNonEmptyLine(body),
    };
    if (!stubsOnly) {
      item.body = body;
      item.skillContent = raw;
    }
    out.push(item);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// --- minimal YAML-ish frontmatter parser (no deps) ---
// Handles `key: value`, `key: >` multiline, but NOT nested objects/arrays.
// Good enough for our SKILL.md / agent.md headers.

function splitFrontmatter(raw) {
  const m = raw.match(FRONTMATTER_SPLIT_RE);
  if (!m) return { frontmatter: null, body: raw };
  return { frontmatter: parseLooseYaml(m[1]), body: m[2] };
}

function matchFrontmatterRaw(raw) {
  const m = raw.match(FRONTMATTER_RAW_RE);
  return m ? m[1] : '';
}

function parseLooseYaml(text) {
  const out = {};
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(YAML_KEY_RE);
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
    if (!t) continue;                      // blank
    if (t.startsWith('#')) continue;       // markdown heading
    if (t.startsWith('<!--')) continue;    // HTML comment (e.g. STUB_MARKER)
    return t.slice(0, 200);
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
