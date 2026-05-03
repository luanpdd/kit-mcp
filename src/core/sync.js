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
import { listKit, resolveKitRoot } from './kit.js';

const STUB_MARKER = '<!-- kit-mcp:reference -->';
const MANAGED_MARKER_FILE = '.kit-mcp-managed';
const MANAGED_MARKER_BODY = '# Managed by @luanpdd/kit-mcp — this directory is overwritten on every `kit sync install`.\n# Do not edit files here directly; edit the canonical source under kit/ and re-run sync.\n# Removing this file disables `kit sync remove` cleanup of this tree.\n';

export async function syncTo(targetId, opts = {}) {
  const target      = getTarget(targetId);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot     = resolveKitRoot(opts.kitRoot);
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

  // Mirror-tree capabilities (framework, hooks) — copy a whole subtree of kit/<source>
  // into target.<cap>.path, preserving relative structure. Dropped a marker file at the
  // root so `kit sync remove` can clean up the tree safely.
  for (const cap of ['framework', 'hooks']) {
    const spec = target[cap];
    if (!spec || spec.mode !== 'mirror-tree') continue;
    const srcRoot = path.join(kitRoot, spec.source);
    const dstRoot = path.join(projectRoot, spec.path);
    const files = await walkTree(srcRoot);
    if (files.length === 0) continue;
    ops.push({ path: path.join(dstRoot, MANAGED_MARKER_FILE), content: MANAGED_MARKER_BODY, kind: cap });
    for (const f of files) {
      const dst = path.join(dstRoot, f.rel);
      ops.push({ path: dst, srcAbs: f.abs, kind: cap, treeCopy: true });
    }
  }

  if (!dryRun) {
    for (const op of ops) {
      await fs.mkdir(path.dirname(op.path), { recursive: true });
      if (op.treeCopy) {
        await fs.copyFile(op.srcAbs, op.path);
      } else {
        await fs.writeFile(op.path, op.content, 'utf8');
      }
    }
  }

  return { target: targetId, mode, projectRoot, kitRoot, written: ops.map(o => o.path), dryRun };
}

async function walkTree(dir) {
  const out = [];
  async function visit(current, relPrefix) {
    let entries;
    try { entries = await fs.readdir(current, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const abs = path.join(current, e.name);
      const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await visit(abs, rel);
      } else if (e.isFile()) {
        out.push({ abs, rel });
      }
    }
  }
  await visit(dir, '');
  return out;
}

export async function statusOf(targetId, opts = {}) {
  const target      = getTarget(targetId);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const checks = [];
  for (const cap of ['rules', 'agents', 'commands', 'skills', 'framework', 'hooks']) {
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
  // Mirror-tree capabilities: only remove if our marker is present (we manage the whole subtree).
  for (const cap of ['framework', 'hooks']) {
    const spec = target[cap];
    if (!spec || spec.mode !== 'mirror-tree') continue;
    const dir = path.join(projectRoot, spec.path);
    const marker = path.join(dir, MANAGED_MARKER_FILE);
    try {
      await fs.access(marker);
      await fs.rm(dir, { recursive: true, force: true });
      removed.push(dir);
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
