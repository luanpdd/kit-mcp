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
import { applyPackFilter } from './packs.js';
import { verifyManifest } from './manifest-verify.js';

const STUB_MARKER = '<!-- kit-mcp:reference -->';
const STUB_MARKER_JS = '// kit-mcp:reference';
const STUB_MARKER_TOKEN = 'kit-mcp:reference'; // substring shared by markdown + JS markers
const MANAGED_MARKER_FILE = '.kit-mcp-managed';
const MANAGED_MARKER_BODY = '# Managed by @luanpdd/kit-mcp — this directory is overwritten on every `kit sync install`.\n# Do not edit files here directly; edit the canonical source under kit/ and re-run sync.\n# Removing this file disables `kit sync remove` cleanup of this tree.\n';

// PERF-16-01: parallelize file writes in syncTo() via Promise.all batches.
// BATCH_SIZE=16 default — safe under Linux ulimit 1024 fd default and
// macOS/Windows equivalents. Configurable via env (e.g. on slow disks).
// Values outside [1, 256] fall back to 16 (defensive — env vars are strings).
function resolveBatchSize() {
  const raw = process.env.KIT_MCP_SYNC_BATCH_SIZE;
  if (!raw) return 16;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 256) return 16;
  return n;
}

// PERF-17-02: opt-out of stat-based diff skip. Forces full sync (every op writes)
// for cleanup/recovery scenarios where target files may be subtly out of sync
// (manual edits, partial fs corruption) but pass the mtime+size diff heuristic.
function resolveForceFullSync() {
  return process.env.KIT_MCP_FORCE_FULL_SYNC === '1';
}

/**
 * Project the canonical kit/ into an IDE-specific layout (claude-code, cursor, etc.).
 *
 * Workflow:
 *   1. SEC-14-05: verifyManifest(kitRoot) — refuses tampered kits (Phase 83+90).
 *   2. Build ops[] (rules + agents + commands + skills + framework/hooks treeCopy).
 *   3. PERF-17-02: stat-based diff filter — skip treeCopy ops whose target already
 *      matches source (mtime+size). Bypassed via KIT_MCP_FORCE_FULL_SYNC=1.
 *   4. PERF-16-01: Promise.all batches=16 over writeOps (Phase 88.01).
 *
 * onProgress callback receives one event per op (written or skipped); skipped ops
 * carry `skipped: true` for UI granularity.
 *
 * Stable API v1.0+ preserved: return shape unchanged. `written[]` lists all op
 * paths (projected files), not just actually-written — semantics: "what's in the
 * target tree after this call", not "what fs.writeFile ran".
 *
 * @param {string} targetId - registry target id (e.g. 'claude-code', 'cursor').
 * @param {object} [opts]
 * @param {string} [opts.projectRoot=process.cwd()] - destination project root.
 * @param {string} [opts.kitRoot] - canonical kit/ root (auto-resolved if absent).
 * @param {'reference'|'copy'|'symlink'} [opts.mode='reference'] - projection mode.
 * @param {boolean} [opts.dryRun=false] - skip all fs writes; ops still listed.
 * @param {Function} [opts.onProgress] - per-op callback ({phase, current, total, label, skipped?}).
 * @param {object} [opts.kit] - pre-loaded kit (skips listKit re-walk).
 * @param {string|string[]} [opts.packs] - content-pack selection (csv or array).
 *        Absent or 'all' = full kit (back-compat). See src/core/packs.js.
 * @returns {Promise<{target, mode, projectRoot, kitRoot, written, dryRun, packs}>}
 */
export async function syncTo(targetId, opts = {}) {
  const target      = getTarget(targetId);
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
  const kitRoot     = resolveKitRoot(opts.kitRoot);
  const mode        = opts.mode ?? 'reference';
  const dryRun      = !!opts.dryRun;
  const onProgress  = opts.onProgress ?? (() => {});

  // SEC-14-05: verify kit integrity before projecting. Refuses tampered kit/.
  // Opt-out via KIT_MCP_SKIP_MANIFEST_CHECK=1 (handled inside verifyManifest).
  // Only runs on install path (syncTo); removeFrom/statusOf/applyReverse don't
  // call this — see plan 83-03 for rationale (apply path is the introduction
  // vector, not the trust point; stale-but-intact kits in dev are skipped).
  const manifestCheck = await verifyManifest(kitRoot);
  if (!manifestCheck.ok) {
    const err = new Error(manifestCheck.reason);
    err.code = 'EMANIFESTMISMATCH';
    throw err;
  }

  // PERF-03: accept a pre-loaded kit to avoid re-walking the disk when callers
  // already have one in hand (CLI sync that follows reverse-sync detect, etc).
  // PERF-S1: in mode=reference (default), read just frontmatter — body/content
  // is never used by stub renderers. Saves I/O on big kit files (planner.md etc).
  const kitFull = opts.kit ?? await listKit(kitRoot, { stubsOnly: mode === 'reference' });

  // Content packs (Phase: docs/rfc-content-packs.md): project a SUBSET of the kit.
  // Filtering once here keeps ops[], buildAggregatedRules and written[] consistent
  // automatically. Absent/'all' selection returns kitFull unchanged (back-compat).
  const packFilter = await applyPackFilter(kitFull, { packs: opts.packs, kitRoot });
  const kit  = packFilter.kit;
  const ops  = [];

  if (target.rules) {
    const rulesContent = buildAggregatedRules(kit, target, kitRoot);
    if (target.rules.mode === 'single') {
      // Preserve any user-authored prologue above the STUB_MARKER so cross-session
      // notes (project paths, conventions, etc.) survive subsequent `kit sync`.
      const outPath = path.join(projectRoot, target.rules.path);
      const merged = await mergePreservedPrologue(outPath, rulesContent);
      ops.push({ path: outPath, content: merged, kind: 'rules' });
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

  if (target.workflows) {
    // Workflows must contain the full executable JS — `reference` mode would
    // break invocation. We always ship the canonical content with a leading
    // provenance header that marks the file as managed (so reverse-sync and
    // removeFrom recognize it).
    for (const w of kit.workflows ?? []) {
      const out = path.join(
        projectRoot,
        target.workflows.path,
        w.fileBase + (target.workflows.extension || '.workflow.js')
      );
      ops.push({ path: out, content: renderWorkflowItem(w, kitRoot, out), kind: 'workflow' });
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
      const op = { path: dst, srcAbs: f.abs, kind: cap, treeCopy: true };
      // Bundle-aware router (RFC §7.4): bake the installed-pack set into the
      // projected kit-router.cjs so it only routes to domains whose pack is
      // installed — without reading the lockfile on every prompt.
      if (cap === 'hooks' && (f.rel === 'kit-router.cjs' || f.rel.endsWith('/kit-router.cjs'))) {
        op.transform = (src) => renderRouterHook(src, packFilter.effective);
      }
      ops.push(op);
    }
  }

  if (!dryRun) {
    const BATCH_SIZE = resolveBatchSize();
    let completed = 0;
    const total = ops.length;

    // PERF-17-02: stat-based diff filter — skip ops whose target already matches source.
    // Only applies to treeCopy ops (framework/hooks subtrees) — content ops (agents,
    // commands, skills, rules) include `Generated by kit-mcp at ${ISO timestamp}` so
    // they re-render every time and can't safely diff. treeCopy ops dominate wall
    // time on large kits (327+ files), so this captures the PERF-17-02 win.
    //
    // Filter logic per op:
    //   - forceFullSync env set     → never skip
    //   - !treeCopy (content op)    → never skip
    //   - target stat fails (absent)→ never skip (must write)
    //   - src stat fails (defensive)→ never skip (let copy fail naturally)
    //   - target.size === src.size AND target.mtimeMs >= src.mtimeMs → SKIP
    //
    // Implementation: Promise.all over ops produces { op, skip } pairs. Skipped ops
    // emit onProgress({ skipped: true }) and increment the same `completed` counter
    // as written ops (so progress UI shows full ops.length total).
    const forceFullSync = resolveForceFullSync();

    const diffOne = async (op) => {
      if (forceFullSync) return { op, skip: false };
      if (op.transform) return { op, skip: false }; // transformed output ≠ source — always write
      if (!op.treeCopy) return { op, skip: false };
      let targetStat;
      try { targetStat = await fs.stat(op.path); }
      catch { return { op, skip: false }; }
      let srcStat;
      try { srcStat = await fs.stat(op.srcAbs); }
      catch { return { op, skip: false }; }
      if (targetStat.size === srcStat.size && targetStat.mtimeMs >= srcStat.mtimeMs) {
        return { op, skip: true };
      }
      return { op, skip: false };
    };

    // Stats are cheap — no batch limit needed (Promise.all over all ops is fine).
    const diffResults = await Promise.all(ops.map(diffOne));
    const writeOps = [];
    for (const { op, skip } of diffResults) {
      if (skip) {
        completed += 1;
        onProgress({ phase: op.kind, current: completed, total, label: path.basename(op.path), skipped: true });
      } else {
        writeOps.push(op);
      }
    }

    // Apply one op (mkdir + write or copy + onProgress).
    // Each op is independent: ops[] is built so writes don't share parent
    // directories that need ordering — mkdir({recursive:true}) is idempotent
    // even when 16 ops race for the same parent dir.
    const applyOp = async (op) => {
      await fs.mkdir(path.dirname(op.path), { recursive: true });
      if (op.transform) {
        const src = await fs.readFile(op.srcAbs, 'utf8');
        await fs.writeFile(op.path, op.transform(src), 'utf8');
      } else if (op.treeCopy) {
        await fs.copyFile(op.srcAbs, op.path);
      } else {
        await fs.writeFile(op.path, op.content, 'utf8');
      }
      // Counter increment is single-threaded by JS event loop semantics —
      // no torn reads even with 16 ops resolving in any order.
      // (PERF-17-02: diff filter increments the same counter for skipped ops before
      // this batch loop runs, so `current` in onProgress reflects total progress.)
      completed += 1;
      onProgress({ phase: op.kind, current: completed, total, label: path.basename(op.path) });
    };

    // PERF-16-01 batched writes — now operating on writeOps (post-diff filter).
    // Sequential batches — within a batch, Promise.all parallelizes writes;
    // between batches, we await to bound max-in-flight at BATCH_SIZE. If any
    // op in a batch rejects, Promise.all rejects on first failure (matches
    // existing behavior — sync.js had no retry logic, so a single fs error
    // already aborted the install).
    for (let i = 0; i < writeOps.length; i += BATCH_SIZE) {
      const slice = writeOps.slice(i, i + BATCH_SIZE);
      await Promise.all(slice.map(applyOp));
    }
  }

  return { target: targetId, mode, projectRoot, kitRoot, written: ops.map(o => o.path), dryRun, packs: packFilter.effective };
}

// SEC-02: walkTree refuses entries whose normalized rel-path escapes the root or
// is absolute, blocking path-traversal via maliciously-named files in mode=copy.
function isSafeRel(rel) {
  if (!rel) return false;
  const norm = path.posix.normalize(rel.replaceAll('\\', '/'));
  if (norm.startsWith('..') || norm.startsWith('/') || /^[A-Za-z]:/.test(norm)) return false;
  if (norm.split('/').some((seg) => seg === '..')) return false;
  return true;
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
      // SEC-02: reject names that would compose into path-traversal.
      if (!isSafeRel(rel)) {
        const err = new Error(`walkTree refuses unsafe path: ${rel}`);
        err.code = 'EUNSAFEPATH';
        throw err;
      }
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
  for (const cap of ['rules', 'agents', 'commands', 'skills', 'workflows', 'framework', 'hooks']) {
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
  for (const cap of ['agents', 'commands', 'skills', 'workflows']) {
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

// Exported for pack-ops.js (selective removePack): reconfirm a projected file is
// still a kit-managed stub before deleting it, so user-edited files are preserved.
export { STUB_MARKER_TOKEN };
export async function isManagedStub(p) { return isStub(p); }

async function isStub(p) {
  try {
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      const inner = path.join(p, 'SKILL.md');
      try {
        const c = await fs.readFile(inner, 'utf8');
        return c.includes(STUB_MARKER_TOKEN);
      } catch { return false; }
    } else {
      const c = await fs.readFile(p, 'utf8');
      return c.includes(STUB_MARKER_TOKEN);
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

  // Body must NOT start with the STUB_MARKER comment — IDE listings (e.g. Claude Desktop)
  // that take the first non-blank body line as the visible description would surface
  // "<!-- kit-mcp:reference -->" instead of the real description. So we open with the
  // H1 + description blockquote, and tuck the marker at the end as a trailing comment.
  const descLine = item.description ? `\n> ${item.description}\n` : '';
  return `${fm}
# ${item.name}
${descLine}
> Canonical source: [\`${rel}\`](${rel})
> Edit the source file in the kit, not this stub.
> Generated by kit-mcp at ${new Date().toISOString()}.

${STUB_MARKER}
`;
}

function synthFrontmatter(item) {
  // Minimal valid frontmatter when canonical didn't have one.
  const desc = (item.description || '').replace(/\r?\n/g, ' ').replace(/"/g, '\\"').slice(0, 500);
  return `---\nname: ${item.name}\ndescription: ${desc}\n---\n`;
}

function renderWorkflowItem(item, kitRoot, outPath) {
  // Workflows are executable JS scripts loaded by Claude Code's Workflow tool.
  // A markdown stub would not execute, so we copy the full content and prepend a
  // managed-file header. Plain `//` comments don't affect Workflow parsing
  // (`export const meta` remains the first statement at runtime).
  const rel = path.relative(path.dirname(outPath), item.absPath).replace(/\\/g, '/');
  const header = `${STUB_MARKER_JS}
// Canonical source: ${rel}
// Edit the source file in the kit, not this stub.
// Generated by kit-mcp at ${new Date().toISOString()}.

`;
  return header + (item.content ?? '');
}

// Bundle-aware router (RFC §7.4): rewrite the `const INSTALLED_PACKS = …;` line
// (tagged `// KIT_MCP_INSTALLED_PACKS`) in kit-router.cjs with the effective pack
// set so the projected hook only routes to installed domains. `effective === null`
// means a full (unfiltered) install → keep `null` so ALL domains stay active.
// Idempotent + defensive: if the sentinel is absent (older hook), copy verbatim.
const ROUTER_PACKS_RE = /const INSTALLED_PACKS = [^;]*; \/\/ KIT_MCP_INSTALLED_PACKS/;
export function renderRouterHook(src, effective) {
  if (!ROUTER_PACKS_RE.test(src)) return src;
  const value = Array.isArray(effective) ? JSON.stringify(effective) : 'null';
  return src.replace(ROUTER_PACKS_RE, `const INSTALLED_PACKS = ${value}; // KIT_MCP_INSTALLED_PACKS`);
}

function renderRuleStub(agent, kitRoot, outPath) {
  const rel = path.relative(path.dirname(outPath), agent.absPath).replace(/\\/g, '/');
  return `${STUB_MARKER}
# ${agent.name}

${agent.description || ''}

See: [\`${rel}\`](${rel})
`;
}

// TOK-02: produce summary-only listings. Full descriptions live in each item's
// own file under kit/ — duplicating them here costs tokens in every Claude
// Code session. Cap each line at ~80 chars; users can `kit get <name>` for the
// full description.
// PERF-13-01: exported so slim() in src/mcp-server/index.js and src/cli/index.js
// can reuse the same cap (single source of truth — no duplicated constants).
export const SUMMARY_MAX_CHARS = 80;
export function summarize(desc) {
  if (!desc) return '';
  const flat = desc.replace(/\s+/g, ' ').trim();
  if (flat.length <= SUMMARY_MAX_CHARS) return flat;
  return flat.slice(0, SUMMARY_MAX_CHARS - 1) + '…';
}

// Preserve any user-authored content that appears BEFORE the STUB_MARKER in the
// existing rules file. Anything from the marker onward is owned by kit-mcp and
// re-rendered every sync. If the file is absent or has no marker, the generated
// content is used verbatim.
async function mergePreservedPrologue(outPath, generated) {
  let existing;
  try { existing = await fs.readFile(outPath, 'utf8'); }
  catch { return generated; }
  const idx = existing.indexOf(STUB_MARKER);
  if (idx <= 0) return generated;
  const prologue = existing.slice(0, idx).replace(/\s+$/, '');
  if (!prologue) return generated;
  return `${prologue}\n\n${generated}`;
}

// v1.41 cost-awareness: compact cost_tier badge for the aggregated CLAUDE.md
// listing (`leve`/`medio`/`pesado`), so the model sees per-resource cost inline.
function costBadge(item) {
  const t = item.frontmatter?.cost_tier;
  return t ? ` \`${t}\`` : '';
}

function buildAggregatedRules(kit, target /* , kitRoot */) {
  const lines = [
    STUB_MARKER,
    '',
    '# Personal kit',
    `> Auto-gen. Edit \`kit/\`; rerun \`kit sync ${target.label ? '<target>' : ''}\`.`,
    '',
    '## Agents',
  ];
  for (const a of kit.agents) {
    lines.push(`- **${a.name}**${costBadge(a)} — ${summarize(a.description) || '(no description)'}`);
  }
  lines.push('', '## Commands');
  for (const c of kit.commands) {
    lines.push(`- **/${c.name}** — ${summarize(c.description) || '(no description)'}`);
  }
  lines.push('', '## Skills');
  for (const s of [...kit.skills, ...kit.skillsExtras]) {
    lines.push(`- **${s.name}**${costBadge(s)} — ${summarize(s.description) || '(no description)'}`);
  }
  // Workflows are only listed if the target supports them AND the kit ships some.
  // Listing them on unsupported targets would advertise capability the user can't reach.
  if (target.workflows && (kit.workflows ?? []).length > 0) {
    lines.push('', '## Workflows (Dynamic Workflows — Claude Code Opus 4.8+)');
    for (const w of kit.workflows) {
      lines.push(`- **${w.name}** — ${summarize(w.description) || '(no description)'}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
