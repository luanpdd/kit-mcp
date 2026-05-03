// Project the canonical kit/ into an IDE-specific layout.
//
// Three modes:
//   reference (default): write a stub .md that links back to the canonical file.
//                        Editing the canonical source is reflected immediately.
//   copy:                duplicate the file content. Loses linkage but works without
//                        access to the kit-mcp folder (e.g. shipping a frozen snapshot).
//   symlink:             try OS-level symlink (best-effort; falls back to reference).
//
// All writes are idempotent and create parent dirs.

import path from 'node:path';
import fs from 'node:fs/promises';
import { getTarget } from './registry.js';
import { listKit, DEFAULT_KIT_ROOT } from './kit.js';

const STUB_MARKER = '<!-- kit-mcp:reference -->';

export async function syncTo(targetId, opts = {}) {
  const target      = getTarget(targetId);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot     = path.resolve(opts.kitRoot ?? DEFAULT_KIT_ROOT);
  const mode        = opts.mode ?? 'reference';
  const dryRun      = !!opts.dryRun;

  const kit  = await listKit(kitRoot);
  const ops  = [];

  if (target.rules) {
    const rulesContent = buildAggregatedRules(kit, target, kitRoot);
    if (target.rules.mode === 'single') {
      ops.push({ path: path.join(projectRoot, target.rules.path), content: rulesContent, kind: 'rules' });
    } else {
      // multi-rules: split per agent description as a rule snippet (lightweight)
      for (const a of kit.agents) {
        const out = path.join(projectRoot, target.rules.path, a.name + (target.rules.extension || '.md'));
        ops.push({ path: out, content: renderRuleStub(a, kitRoot, out), kind: 'rules' });
      }
    }
  }

  if (target.agents) {
    for (const a of kit.agents) {
      const out = path.join(projectRoot, target.agents.path, a.name + (target.agents.extension || '.md'));
      ops.push({ path: out, content: renderItem(a, mode, kitRoot, out), kind: 'agent' });
    }
  }

  if (target.commands) {
    for (const c of kit.commands) {
      const out = path.join(projectRoot, target.commands.path, c.name + (target.commands.extension || '.md'));
      ops.push({ path: out, content: renderItem(c, mode, kitRoot, out), kind: 'command' });
    }
  }

  if (target.skills) {
    const allSkills = [...kit.skills, ...kit.skillsExtras];
    for (const s of allSkills) {
      const outDir = path.join(projectRoot, target.skills.path, s.name);
      const out    = path.join(outDir, 'SKILL.md');
      ops.push({ path: out, content: renderItem(s, mode, kitRoot, out, /*isSkill*/ true), kind: 'skill' });
    }
  }

  if (!dryRun) {
    for (const op of ops) {
      await fs.mkdir(path.dirname(op.path), { recursive: true });
      await fs.writeFile(op.path, op.content, 'utf8');
    }
  }

  return { target: targetId, mode, projectRoot, kitRoot, written: ops.map(o => o.path), dryRun };
}

export async function statusOf(targetId, opts = {}) {
  const target      = getTarget(targetId);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const checks = [];
  for (const cap of ['rules', 'agents', 'commands', 'skills']) {
    if (!target[cap]) continue;
    const probe = path.join(projectRoot, target[cap].path);
    let exists = false;
    try { await fs.access(probe); exists = true; } catch {}
    checks.push({ capability: cap, path: target[cap].path, exists });
  }
  return { target: targetId, projectRoot, checks };
}

export async function removeFrom(targetId, opts = {}) {
  const target      = getTarget(targetId);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const removed = [];
  for (const cap of ['agents', 'commands', 'skills']) {
    if (!target[cap]) continue;
    const dir = path.join(projectRoot, target[cap].path);
    try {
      const entries = await fs.readdir(dir);
      for (const e of entries) {
        const full = path.join(dir, e);
        // only remove files we wrote (have STUB_MARKER) or skill subdirs whose SKILL.md has marker
        if (await isStub(full)) {
          await fs.rm(full, { recursive: true, force: true });
          removed.push(full);
        }
      }
    } catch {}
  }
  return { target: targetId, projectRoot, removed };
}

async function isStub(p) {
  try {
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      const inner = path.join(p, 'SKILL.md');
      try {
        const c = await fs.readFile(inner, 'utf8');
        return c.includes(STUB_MARKER);
      } catch { return false; }
    } else {
      const c = await fs.readFile(p, 'utf8');
      return c.includes(STUB_MARKER);
    }
  } catch { return false; }
}

// --- renderers ---

function renderItem(item, mode, kitRoot, outPath, isSkill = false) {
  if (mode === 'copy') return item.content ?? item.skillContent;
  return renderReference(item, kitRoot, outPath, isSkill);
}

function renderReference(item, kitRoot, outPath, isSkill) {
  const sourceAbs = isSkill ? item.absPath : item.absPath;
  const rel = path.relative(path.dirname(outPath), sourceAbs).replace(/\\/g, '/');

  // Always synthesize a frontmatter so downstream parsers (Claude Code, Cursor, etc.)
  // get reliable name+description even when the canonical didn't declare one.
  const fm = item.frontmatterRaw && item.frontmatterRaw.includes('---')
    ? item.frontmatterRaw
    : synthFrontmatter(item);

  const desc = item.description ? `\n> ${item.description}\n` : '';
  // Blank line between frontmatter and the stub marker so YAML parsers don't choke.
  return `${fm}\n${STUB_MARKER}
# ${item.name}

> Canonical source: [\`${rel}\`](${rel})
${desc}
> Generated by kit-mcp at ${new Date().toISOString()}.
> Edit the source file in the kit, not this stub.
`;
}

function synthFrontmatter(item) {
  // Minimal valid frontmatter when canonical didn't have one.
  const desc = (item.description || '').replace(/\r?\n/g, ' ').replace(/"/g, '\\"').slice(0, 500);
  return `---\nname: ${item.name}\ndescription: ${desc}\n---\n`;
}

function renderRuleStub(agent, kitRoot, outPath) {
  const rel = path.relative(path.dirname(outPath), agent.absPath).replace(/\\/g, '/');
  return `${STUB_MARKER}
# ${agent.name}

${agent.description || ''}

See: [\`${rel}\`](${rel})
`;
}

function buildAggregatedRules(kit, target, kitRoot) {
  const lines = [
    STUB_MARKER,
    '',
    '# Personal kit instructions',
    '',
    '> Auto-generated by kit-mcp. Edit the canonical source files under `kit/` —',
    '> running `kit sync ' + (target.label ? '<target>' : '') + '` regenerates this file.',
    '',
    '## Available agents',
    '',
  ];
  for (const a of kit.agents) {
    lines.push(`- **${a.name}** — ${a.description || '(no description)'}`);
  }
  lines.push('', '## Available commands', '');
  for (const c of kit.commands) {
    lines.push(`- **/${c.name}** — ${c.description || '(no description)'}`);
  }
  lines.push('', '## Available skills', '');
  for (const s of [...kit.skills, ...kit.skillsExtras]) {
    lines.push(`- **${s.name}** — ${s.description || '(no description)'}`);
  }
  lines.push('');
  return lines.join('\n');
}
