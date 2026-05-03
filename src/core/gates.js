// Gates extracted from inline workflow steps into reusable, named, file-backed checks.
//
// A gate is a markdown file under `gates/` with frontmatter:
//
//   ---
//   id: regression
//   stage: pre-verify       # pre-plan | pre-execute | pre-verify | post-verify | any
//   blocking: true          # true → must pass to advance; false → warn only
//   ---
//   <inline shell or natural-language check description>
//
// Gates are consumed by orchestrator workflows OR by `/saude` to spot-check.
// Running a gate here returns a structured verdict; actually executing the
// shell side is delegated to the orchestrator (we don't want to shell-out
// from the MCP server without confirmation).

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
export const DEFAULT_GATES_ROOT = path.resolve(__dirname, '../../gates');

export async function listGates(gatesRoot = DEFAULT_GATES_ROOT) {
  let entries;
  try { entries = await fs.readdir(gatesRoot, { withFileTypes: true }); }
  catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const abs = path.join(gatesRoot, e.name);
    const raw = await fs.readFile(abs, 'utf8');
    const meta = parseFrontmatter(raw);
    out.push({
      id: meta.id ?? e.name.replace(/\.md$/, ''),
      stage: meta.stage ?? 'any',
      blocking: meta.blocking !== false && meta.blocking !== 'false',
      description: meta.description ?? '',
      absPath: abs,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export async function getGate(id, gatesRoot = DEFAULT_GATES_ROOT) {
  const all = await listGates(gatesRoot);
  const g = all.find(x => x.id === id);
  if (!g) throw new Error(`Unknown gate: ${id}. Available: ${all.map(x => x.id).join(', ')}`);
  const raw = await fs.readFile(g.absPath, 'utf8');
  return { ...g, content: raw };
}

export async function gatesForStage(stage, gatesRoot = DEFAULT_GATES_ROOT) {
  const all = await listGates(gatesRoot);
  return all.filter(g => g.stage === stage || g.stage === 'any');
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) out[mm[1]] = mm[2].trim();
  }
  return out;
}
