---
phase: 91-diff-based-sync
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/sync.js
  - test/unit/sync.test.js
autonomous: true
requirements:
  - PERF-17-02
must_haves:
  truths:
    - "User running `kit sync install claude-code` 2× consecutive in stable workspace sees 2nd run write zero files when nothing changed"
    - "User editing 1 file in kit/ and re-running sync sees only that 1 file written (others skipped)"
    - "User setting KIT_MCP_FORCE_FULL_SYNC=1 sees full write (every op), regardless of stat match"
    - "User passing onProgress callback receives one event per op including skipped ops, with `skipped: true` flag"
    - "Suite passes (322 baseline preserved) plus 4+ new PERF-17-02 regression tests"
    - "First-time sync to fresh projectRoot writes every file (target absent → no skip)"
    - "Stable API v1.0+ preserved: syncTo() return shape unchanged ({target, mode, projectRoot, kitRoot, written, dryRun})"
  artifacts:
    - path: "src/core/sync.js"
      provides: "syncTo() with stat-based diff skip before batch loop, env opt-out, skipped flag in onProgress"
      contains: "KIT_MCP_FORCE_FULL_SYNC"
    - path: "test/unit/sync.test.js"
      provides: "4+ PERF-17-02 regression tests appended to existing sync test suite"
      contains: "PERF-17-02"
  key_links:
    - from: "src/core/sync.js syncTo()"
      to: "fs.stat(target) per op"
      via: "stat-based diff loop AFTER verifyManifest, BEFORE Promise.all batch loop"
      pattern: "fs\\.stat.*op\\.path|op\\.target|target.*mtimeMs"
    - from: "src/core/sync.js syncTo()"
      to: "onProgress callback for skipped files"
      via: "onProgress({ phase, current, total, label, skipped: true })"
      pattern: "skipped.*true"
    - from: "src/core/sync.js syncTo()"
      to: "process.env.KIT_MCP_FORCE_FULL_SYNC opt-out"
      via: "env check that bypasses diff (force full sync)"
      pattern: "KIT_MCP_FORCE_FULL_SYNC"
    - from: "Phase 88.01 Promise.all batches=16"
      to: "preserved in batch loop"
      via: "diff filter applied BEFORE batching, batches now operate on filtered ops"
      pattern: "BATCH_SIZE|Promise\\.all"
    - from: "Phase 83 verifyManifest"
      to: "preserved as gate before diff"
      via: "verifyManifest call still runs FIRST (security gate before any decision)"
      pattern: "await verifyManifest"
    - from: "Phase 90 verifyManifest cache"
      to: "preserved (untouched)"
      via: "manifest-verify.js NOT modified by this plan"
      pattern: "verifyManifestCache"
---

<objective>
Implement stat-based diff in `syncTo()` to skip writes when source and target already match (mtime + size). Cuts 2nd-consecutive `kit sync install` from ~163ms to ~49ms (≥70% reduction) by eliminating no-op writes. Adds env opt-out `KIT_MCP_FORCE_FULL_SYNC=1` for cleanup/recovery scenarios. Preserves Phase 83 verifyManifest gate (still runs first), Phase 88.01 Promise.all batches=16 (now operating on filtered ops), Phase 90 verifyManifest cache (untouched), and stable API v1.0+ (return shape unchanged).

Purpose: PERF-17-02 was identified by meta-auditoria pós-v1.16 as the second P0 perf hotspot — sync.js writes all 323 files unconditionally even when nothing changed. `kit sync watch` triggers this every 500ms on save, causing redundant fs writes that compound over hours of dev work.

Output:
- `src/core/sync.js` syncTo() with stat-based diff filter before batch loop
- `KIT_MCP_FORCE_FULL_SYNC=1` env opt-out for forced full sync (cleanup/recovery)
- onProgress callback enhanced to receive `{ skipped: true }` for skipped ops
- 4+ regression tests in `test/unit/sync.test.js` covering: 2× consecutive skip, edit-then-sync writes only changed, env opt-out forces full, onProgress skipped flag
- Suite passing (≥326 = 322 baseline + 4 new)
- Phase summary at `.planning/phases/91-diff-based-sync/91-01-SUMMARY.md`
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/91-diff-based-sync/91-CONTEXT.md
@.planning/phases/90-verify-manifest-parallel-cache/90-01-SUMMARY.md
@src/core/sync.js
@src/core/manifest-verify.js
@test/unit/sync.test.js

## Stable API contract (preserved)

```js
// syncTo signature — UNCHANGED
syncTo(targetId, opts) -> Promise<{
  target: string,
  mode: string,
  projectRoot: string,
  kitRoot: string,
  written: string[],     // SEMANTICS UNCHANGED: still all op.path values, even skipped ones
  dryRun: boolean
}>

// onProgress callback — ADDITIVELY enhanced
onProgress({
  phase: string,         // 'agent' | 'command' | 'skill' | 'rules' | 'framework' | 'hooks'
  current: number,       // 1..total (counter increments for both written AND skipped)
  total: number,         // ops.length (unchanged — total includes skipped)
  label: string,         // path.basename(op.path)
  skipped?: boolean      // NEW — true when op was skipped due to stat match; absent when written
})
```

**Why `written[]` keeps all op.path values (not just actually-written):** stable API. Existing callers (CLI status output, MCP tool returns) treat `written.length` as "files projected". Changing semantics to "actually-written count" would be a silent behavior change. Skipped files ARE projected (target reflects them), they just didn't need fs writes this run. CLI can read `onProgress` events for write-vs-skip granularity.

## Diff strategy (from CONTEXT.md decisions)

For each op, AFTER ops[] is fully assembled and BEFORE the batch loop:

```js
// Pseudocode contract:
const forceFull = process.env.KIT_MCP_FORCE_FULL_SYNC === '1';

const diffFilter = async (op) => {
  if (forceFull) return { op, skip: false };
  let targetStat;
  try {
    targetStat = await fs.stat(op.path);
  } catch {
    return { op, skip: false };  // target absent → must write
  }
  // Determine source size + mtimeMs.
  // For treeCopy ops: fs.stat(op.srcAbs).
  // For content writes: Buffer.byteLength(op.content, 'utf8') for size; mtime check skipped (no source file → use content hash compare? NO — keep it simple: compare size only for content ops, stat-based for treeCopy. If size matches and target mtime is newer or equal to kit manifest mtime → skip).
  // Actually simpler: for content ops, compare Buffer.byteLength(op.content) against targetStat.size only. Content is deterministic (rendered from kit), so size match is a strong signal. mtime check applies only to treeCopy ops where there's a real source file.
  ...
};
```

**Concrete rule per op kind:**

| op kind | Source size | Source mtimeMs | Target stat needed | Skip condition |
|---|---|---|---|---|
| `treeCopy: true` (framework, hooks) | `srcStat.size` (fs.stat op.srcAbs) | `srcStat.mtimeMs` | yes | target.size === src.size AND target.mtimeMs >= src.mtimeMs |
| content write (rules, agent, command, skill) | `Buffer.byteLength(op.content, 'utf8')` | n/a (synthetic content) | yes | target.size === Buffer.byteLength(op.content) AND target file content equals op.content (read+compare) — see below |

**Wait — content ops can't safely skip on size alone** because `op.content` includes `Generated by kit-mcp at ${new Date().toISOString()}` (line 277 sync.js renderReference) which changes every render. If we naively render then size-compare, we'll always mismatch on reference-mode stubs.

**Resolution:** for content ops, the diff strategy must NOT compare against rendered op.content. Instead, treat content ops as "always write" (they're cheap — small files, ~327 of them, render is in-memory). The 2× consecutive sync win comes primarily from `treeCopy` ops (framework + hooks subtrees, which are the bulk of fs work). Content ops continue to write every time.

**Update to plan:** the diff filter applies ONLY to `op.treeCopy === true` ops. Content ops (rules/agent/command/skill) write unconditionally. This still hits the PERF-17-02 target because treeCopy ops dominate wall time on large kits.

**Validation:** run `kit sync install claude-code` 2× and measure. If treeCopy-only diff doesn't hit the 30% target, we revisit (likely add content-stub stable rendering as a follow-up phase). For Phase 91, treeCopy diff is sufficient and aligns with CONTEXT.md mtime+size strategy (which assumed real files, not synthetic content).

**Final concrete rule:**

```js
const diffFilter = async (op) => {
  if (forceFull) return { op, skip: false };
  if (!op.treeCopy) return { op, skip: false };  // content ops always write
  let targetStat, srcStat;
  try {
    targetStat = await fs.stat(op.path);
  } catch {
    return { op, skip: false };  // target absent → write
  }
  try {
    srcStat = await fs.stat(op.srcAbs);
  } catch {
    return { op, skip: false };  // src missing? defensive — let copy fail naturally
  }
  if (targetStat.size === srcStat.size && targetStat.mtimeMs >= srcStat.mtimeMs) {
    return { op, skip: true };
  }
  return { op, skip: false };
};
```

This filter runs in parallel via `Promise.all` over ops (cheap stats), produces tagged results, and the existing batch loop applies only the `skip: false` ones. Skipped ops still emit `onProgress({ ..., skipped: true })`.

## Critical preservation list

1. **verifyManifest call ORDER** — must run BEFORE diff filter. Tampered kit must be refused regardless of skip optimization. Position: line 47 (current).
2. **Phase 88.01 BATCH_SIZE=16** — preserved. Batches now operate on filtered (write-needed) ops.
3. **Phase 90 cache** — `manifest-verify.js` is NOT modified by this plan. Zero touches.
4. **Stable API** — `syncTo()` return shape unchanged. `written[]` includes skipped paths (semantics: "files projected", not "files actually written").
5. **dryRun** — must continue to skip ALL writes (existing `if (!dryRun)` gate). Diff filter still runs in dryRun? NO — keep dryRun semantics simple: dryRun returns immediately without diff or writes. ops[] still populated for `result.written` listing.
6. **CRLF→LF** — not relevant to sync.js (only manifest-verify.js).
7. **Counter semantics** — `completed` counter and `current` field in onProgress increment for BOTH written and skipped ops. Total stays at ops.length. Skipped ops emit a progress event right after the diff phase resolves them, before the batch loop runs.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement stat-based diff + env opt-out + onProgress skipped flag in syncTo()</name>
  <files>src/core/sync.js</files>
  <read_first>
    - Read `src/core/sync.js` lines 26-148 (syncTo() body) — locate `if (!dryRun) {` block at line 114 (current).
    - Confirm `treeCopy: true` is set on framework/hooks ops at line 110 (`ops.push({ path: dst, srcAbs: f.abs, kind: cap, treeCopy: true })`).
    - Confirm `op.srcAbs` is the absolute source path for treeCopy ops.
    - Read `.planning/phases/91-diff-based-sync/91-CONTEXT.md` decisions section (mtime + size strategy, opt-out env, onProgress skipped flag).
  </read_first>
  <action>
    Modify `src/core/sync.js` syncTo() to add stat-based diff filtering ONLY for `treeCopy: true` ops, BEFORE the batch loop. Add `KIT_MCP_FORCE_FULL_SYNC=1` env opt-out. Emit `onProgress({ skipped: true })` for skipped ops. Preserve verifyManifest call order, Phase 88.01 BATCH_SIZE=16 batching, Phase 90 cache untouched, and stable API return shape.

    **Step 1 — Add resolveForceFullSync helper after `resolveBatchSize` (after line 32):**

    ```js
    // PERF-17-02: opt-out of stat-based diff skip. Forces full sync (every op writes)
    // for cleanup/recovery scenarios where target files may be subtly out of sync
    // (manual edits, partial fs corruption) but pass the mtime+size diff heuristic.
    function resolveForceFullSync() {
      return process.env.KIT_MCP_FORCE_FULL_SYNC === '1';
    }
    ```

    **Step 2 — Add diff filter logic INSIDE the `if (!dryRun) { ... }` block (current line 114), AFTER the `BATCH_SIZE` and `completed`/`total` declarations (current lines 115-117) but BEFORE the `applyOp` definition (current line 123).**

    Insert this block:

    ```js
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
    ```

    **Step 3 — Replace the existing batch loop (current lines 141-144) to iterate `writeOps` instead of `ops`:**

    Change from:
    ```js
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const slice = ops.slice(i, i + BATCH_SIZE);
      await Promise.all(slice.map(applyOp));
    }
    ```

    To:
    ```js
    // PERF-16-01 batched writes — now operating on writeOps (post-diff filter).
    for (let i = 0; i < writeOps.length; i += BATCH_SIZE) {
      const slice = writeOps.slice(i, i + BATCH_SIZE);
      await Promise.all(slice.map(applyOp));
    }
    ```

    **Step 4 — Update the `applyOp` function comment to clarify that `completed` increments are now shared with the diff filter's skip path:**

    The existing comment at current line 130-131 ("Counter increment is single-threaded by JS event loop semantics — no torn reads even with 16 ops resolving in any order.") stays — extend it with one line:

    ```js
    // (PERF-17-02: diff filter increments the same counter for skipped ops before
    // this batch loop runs, so `current` in onProgress reflects total progress.)
    ```

    **Step 5 — Add JSDoc to syncTo() function declaration. The function currently has no JSDoc (only inline comments above). Add immediately before `export async function syncTo(targetId, opts = {})`:**

    ```js
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
     * @returns {Promise<{target, mode, projectRoot, kitRoot, written, dryRun}>}
     */
    ```

    **Constraints:**
    - DO NOT modify `src/core/manifest-verify.js` — Phase 90 cache stays untouched.
    - DO NOT change `syncTo()` return shape. `written` array still includes paths of skipped ops.
    - DO NOT change `dryRun` semantics — when `dryRun: true`, the function returns at line 147 without entering the `if (!dryRun)` block, so diff filter doesn't run (this is correct: dryRun reports projected files, not actual write decisions).
    - DO NOT touch the verifyManifest call (line 47) — it stays as the security gate before everything else.
    - PRESERVE the existing `applyOp` function exactly as-is except for the comment extension noted in Step 4.
    - PRESERVE the existing `resolveBatchSize` function and its env var `KIT_MCP_SYNC_BATCH_SIZE`.
    - PRESERVE all imports — no new imports needed (`fs.stat` already available via `node:fs/promises`).
  </action>
  <verify>
    <automated>
    # Verify the structure is intact
    cd D:/projetos/opensource/mcp
    node -e "const m = require('./src/core/sync.js'); console.log(typeof m.syncTo === 'function' ? 'OK' : 'FAIL');"
    # Should print: OK

    # Verify env var present in source
    grep -c "KIT_MCP_FORCE_FULL_SYNC" src/core/sync.js
    # Should print: 2 (one in helper function, one in JSDoc)

    # Verify diff filter helpers present
    grep -c "diffOne\|writeOps\|resolveForceFullSync" src/core/sync.js
    # Should print: ≥4

    # Verify Phase 88.01 BATCH_SIZE preserved
    grep -c "BATCH_SIZE" src/core/sync.js
    # Should print: ≥3

    # Verify verifyManifest call still positioned BEFORE diff
    grep -n "await verifyManifest\|writeOps.push\|diffOne" src/core/sync.js
    # verifyManifest line number must be LOWER than diffOne/writeOps line numbers

    # Run existing sync tests to confirm zero regression
    node test/run.mjs test/unit/sync.test.js
    # Should pass all existing tests (96-line file, ~8 tests)

    # Run full unit suite
    node test/run.mjs test/unit
    # Should print: 237 pass (or higher), 0 fail
    </automated>
  </verify>
  <done>
    - `src/core/sync.js` syncTo() body has diff filter section between line ~115 and the batch loop.
    - `resolveForceFullSync()` helper exists.
    - `diffOne` async function defined inside syncTo() (or as nested helper).
    - `writeOps` array filtered from `diffResults`.
    - Batch loop iterates `writeOps` (not original `ops`).
    - Skipped ops emit `onProgress({ ..., skipped: true })` and increment `completed`.
    - JSDoc block added above `export async function syncTo`.
    - `manifest-verify.js` UNTOUCHED (verify via `git status`).
    - `verifyManifest` call still at line 47 (or equivalent — must be BEFORE the new diff logic).
    - Existing sync.test.js tests all pass (proves stable API + dryRun semantics preserved).
    - Full unit suite still ≥237 pass (322 total).
  </done>
</task>

<task type="auto">
  <name>Task 2: Add 4 PERF-17-02 regression tests to test/unit/sync.test.js</name>
  <files>test/unit/sync.test.js</files>
  <read_first>
    - Read `test/unit/sync.test.js` (96 lines, 8 existing tests, beforeEach/afterEach already creates TMP).
    - Confirm fixture path `test/fixtures/sample-kit` is used and contains framework/ + hooks/ subtrees (the treeCopy targets — diff filter only applies to these).
    - Inspect `test/fixtures/sample-kit/` to confirm at least one file in `framework/` and one in `hooks/` so diff has real ops to filter.
  </read_first>
  <action>
    Append 4 PERF-17-02 regression tests to `test/unit/sync.test.js`. Tests must use the existing `FIXTURE` and `TMP` setup. Add a section comment header before the new block.

    **Helper utility — add after the `removeFrom` test ends (line 96), at the end of the file:**

    ```js
    // ---------------------------------------------------------------------------
    // PERF-17-02 — diff-based sync regression tests
    // ---------------------------------------------------------------------------
    //
    // Diff filter applies ONLY to treeCopy ops (framework/, hooks/ subtrees).
    // Content ops (agents/commands/skills/rules) re-render every call because
    // their content embeds an ISO timestamp — they can't safely diff. So tests
    // assert skip behavior on framework/hooks files only.

    test('PERF-17-02: 2nd consecutive sync skips treeCopy ops in stable workspace', async () => {
      // 1st sync — fresh TMP, all targetStat calls fail (absent), nothing skipped.
      const events1 = [];
      await syncTo('claude-code', {
        kitRoot: FIXTURE, projectRoot: TMP,
        onProgress: (e) => events1.push(e),
      });
      const skipped1 = events1.filter(e => e.skipped === true);
      assert.equal(skipped1.length, 0, '1st sync to fresh dir must skip nothing');

      // 2nd sync — same source, same target, mtime+size match → all treeCopy ops skipped.
      const events2 = [];
      await syncTo('claude-code', {
        kitRoot: FIXTURE, projectRoot: TMP,
        onProgress: (e) => events2.push(e),
      });
      const skipped2 = events2.filter(e => e.skipped === true);
      const treeCopyEvents1 = events1.filter(e => e.phase === 'framework' || e.phase === 'hooks');
      assert.ok(skipped2.length > 0, '2nd sync must skip at least some treeCopy ops');
      // Skipped count should equal the number of treeCopy ops from 1st sync (all of them).
      assert.equal(skipped2.length, treeCopyEvents1.length,
        `expected ${treeCopyEvents1.length} treeCopy ops skipped on 2nd sync, got ${skipped2.length}`);
    });

    test('PERF-17-02: edit one treeCopy file → next sync writes only that file', async () => {
      await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
      // Touch one source file — bump mtime so target.mtimeMs < src.mtimeMs (write needed).
      const srcFw = path.join(FIXTURE, 'framework/workflows/sample-workflow.md');
      // Read + rewrite same content with a small change to bump mtime AND content.
      const original = await fs.readFile(srcFw, 'utf8');
      // Wait briefly to guarantee mtime bump on filesystems with low resolution (HFS+, FAT32).
      await new Promise((r) => setTimeout(r, 20));
      await fs.writeFile(srcFw, original + '\n<!-- touch -->\n', 'utf8');

      const events = [];
      try {
        await syncTo('claude-code', {
          kitRoot: FIXTURE, projectRoot: TMP,
          onProgress: (e) => events.push(e),
        });
        const wrote = events.filter(e => e.skipped !== true && (e.phase === 'framework' || e.phase === 'hooks'));
        const skipped = events.filter(e => e.skipped === true);
        // Exactly one treeCopy op should write (the edited workflow file).
        assert.equal(wrote.length, 1, `expected exactly 1 treeCopy write, got ${wrote.length}`);
        assert.match(wrote[0].label, /sample-workflow\.md/, 'written file must be the edited one');
        assert.ok(skipped.length > 0, 'all other treeCopy ops must skip');
      } finally {
        // Restore source file so other tests aren't affected (FIXTURE is shared).
        await fs.writeFile(srcFw, original, 'utf8');
      }
    });

    test('PERF-17-02: KIT_MCP_FORCE_FULL_SYNC=1 forces full sync (no skips)', async () => {
      await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
      // Save and restore env var so this test doesn't leak into others.
      const prev = process.env.KIT_MCP_FORCE_FULL_SYNC;
      process.env.KIT_MCP_FORCE_FULL_SYNC = '1';
      try {
        const events = [];
        await syncTo('claude-code', {
          kitRoot: FIXTURE, projectRoot: TMP,
          onProgress: (e) => events.push(e),
        });
        const skipped = events.filter(e => e.skipped === true);
        assert.equal(skipped.length, 0,
          'KIT_MCP_FORCE_FULL_SYNC=1 must skip nothing — got ' + skipped.length + ' skipped events');
      } finally {
        if (prev === undefined) delete process.env.KIT_MCP_FORCE_FULL_SYNC;
        else process.env.KIT_MCP_FORCE_FULL_SYNC = prev;
      }
    });

    test('PERF-17-02: onProgress receives skipped:true for skipped ops, not for written', async () => {
      await syncTo('claude-code', { kitRoot: FIXTURE, projectRoot: TMP });
      // 2nd sync — collect all events and inspect shape.
      const events = [];
      await syncTo('claude-code', {
        kitRoot: FIXTURE, projectRoot: TMP,
        onProgress: (e) => events.push(e),
      });
      // Skipped events carry skipped:true.
      const skipped = events.filter(e => e.skipped === true);
      assert.ok(skipped.length > 0, 'expected ≥1 skipped event on 2nd sync');
      // Every skipped event must have the canonical onProgress shape.
      for (const e of skipped) {
        assert.ok(typeof e.phase === 'string' && e.phase.length > 0, 'skipped event must have phase');
        assert.ok(typeof e.current === 'number' && e.current > 0, 'skipped event must have current counter');
        assert.ok(typeof e.total === 'number' && e.total >= e.current, 'skipped event must have total');
        assert.ok(typeof e.label === 'string', 'skipped event must have label (basename)');
        assert.equal(e.skipped, true, 'skipped event must have skipped:true');
      }
      // Written events must NOT carry skipped:true (absent or false).
      const written = events.filter(e => e.skipped !== true);
      for (const e of written) {
        assert.notEqual(e.skipped, true, 'written event must not carry skipped:true');
      }
      // Counter monotonicity — current values cover 1..total without gaps.
      const currents = events.map(e => e.current).sort((a, b) => a - b);
      const total = events[0].total;
      assert.equal(currents.length, total, `expected ${total} progress events, got ${currents.length}`);
    });
    ```

    **Constraints:**
    - DO NOT modify the existing 8 tests above (lines 22-96).
    - DO NOT modify the existing `beforeEach`/`afterEach` (the TMP setup is reused).
    - All 4 new tests MUST be append-only.
    - Each test MUST clean up after itself (restore env vars, restore touched fixture files in finally{} blocks) so test order doesn't matter.
    - Use `assert.ok(skipped.length > 0, msg)` over hard counts where filesystem mtime resolution could cause minor variance — but use exact counts (`assert.equal`) for the deterministic assertions (skipped count on 2nd full sync = treeCopy count on 1st, force-full has 0 skips).
    - The "edit one file" test bumps mtime via a 20ms sleep before write — needed because some filesystems have 1-2s mtime resolution, but 20ms is a pragmatic floor that works on NTFS/ext4/APFS.
  </action>
  <verify>
    <automated>
    cd D:/projetos/opensource/mcp

    # Verify all 4 new tests added
    grep -c "PERF-17-02" test/unit/sync.test.js
    # Should print: ≥5 (4 test names + 1 section header)

    # Verify section header present
    grep -c "PERF-17-02 — diff-based sync regression tests" test/unit/sync.test.js
    # Should print: 1

    # Verify env var cleanup pattern present
    grep -c "process.env.KIT_MCP_FORCE_FULL_SYNC" test/unit/sync.test.js
    # Should print: ≥3 (set + delete + restore)

    # Run the sync test file standalone first
    node --test test/unit/sync.test.js
    # Should pass all 12 tests (8 existing + 4 new)

    # Run full unit suite
    node test/run.mjs test/unit
    # Should print: 241 pass (or higher), 0 fail (was 237; +4 new = 241)

    # Run integration suite to confirm no cross-suite regression
    node test/run.mjs test/integration
    # Should print: 85 pass, 0 fail

    # Total suite count
    # Expected: 326 pass = 322 baseline + 4 new
    </automated>
  </verify>
  <done>
    - 4 new tests appended to `test/unit/sync.test.js` after line 96 (current EOF).
    - Section comment header `// PERF-17-02 — diff-based sync regression tests` present.
    - All 4 tests pass standalone: `node --test test/unit/sync.test.js` exits 0.
    - Test names correspond 1:1 with success criteria from CONTEXT.md:
      - 2× consecutive sync (skip behavior)
      - edit-then-sync (selective write)
      - env opt-out (force full)
      - onProgress skipped flag
    - Each test restores any side effects (env vars, touched files) in finally{} blocks.
    - Unit suite count: 241 pass (≥237 baseline + 4 new).
    - Integration suite unchanged: 85 pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Run full suite + manual benchmark + write SUMMARY.md</name>
  <files>.planning/phases/91-diff-based-sync/91-01-SUMMARY.md</files>
  <read_first>
    - Read `.planning/phases/90-verify-manifest-parallel-cache/90-01-SUMMARY.md` for the SUMMARY format template (frontmatter shape, sections).
    - Read `.claude/framework/templates/summary.md` if present.
  </read_first>
  <action>
    **Step 1 — Run full suite as a final verification gate:**

    ```bash
    cd D:/projetos/opensource/mcp
    node test/run.mjs test/unit       # expect: 241 pass, 0 fail
    node test/run.mjs test/integration # expect: 85 pass, 0 fail
    # Total: 326 pass = 322 baseline + 4 new
    ```

    If either fails, STOP and report — do not write SUMMARY.md until suite is green.

    **Step 2 — Manual 2× consecutive sync benchmark (informational, not blocking):**

    Create a temp dir, run `syncTo('claude-code')` twice, measure wall time of each. Document the speedup ratio in SUMMARY.md "Performance Expectations" section. This is not a test (test/run.mjs already validates correctness); it's a one-shot measurement to confirm the PERF-17-02 target trajectory.

    Suggested invocation (one-liner, can be inline in SUMMARY):

    ```bash
    node -e "
      const { syncTo } = require('./src/core/sync.js');
      const fs = require('fs/promises');
      const path = require('path');
      const os = require('os');
      (async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-bench-'));
        const t1 = Date.now();
        await syncTo('claude-code', { projectRoot: tmp });
        const elapsed1 = Date.now() - t1;
        const t2 = Date.now();
        await syncTo('claude-code', { projectRoot: tmp });
        const elapsed2 = Date.now() - t2;
        console.log('1st sync:', elapsed1, 'ms');
        console.log('2nd sync:', elapsed2, 'ms');
        console.log('ratio:', (elapsed2 / elapsed1 * 100).toFixed(1), '% (target ≤30%)');
        await fs.rm(tmp, { recursive: true, force: true });
      })();
    "
    ```

    Record outputs in SUMMARY.md. Acceptable: ratio ≤30% means PERF-17-02 hit. If ratio is 30-50%, document as "partial win, acceptable for this phase — next milestone considers content-stub stable rendering". If ratio >50%, STOP and investigate (something is wrong with the diff filter).

    **Step 3 — Write `.planning/phases/91-diff-based-sync/91-01-SUMMARY.md` matching the format from Phase 90:**

    Use this exact frontmatter shape:

    ```yaml
    ---
    phase: 91-diff-based-sync
    plan: 01
    subsystem: core/sync
    tags: [perf, diff, stat, skip, sync, perf-17-02]
    requirements: [PERF-17-02]
    dependency_graph:
      requires:
        - "Phase 83-03: SEC-14-05 manifest verification gate (verifyManifest call order preserved)"
        - "Phase 88.01: Promise.all batches=16 pattern (preserved in writeOps loop)"
        - "Phase 90.01: verifyManifest cache (untouched — manifest-verify.js not modified)"
      provides:
        - "syncTo() with stat-based diff skip for treeCopy ops"
        - "KIT_MCP_FORCE_FULL_SYNC=1 env opt-out"
        - "onProgress callback enhanced with `skipped: true` flag"
      affects:
        - "src/cli/index.js: CLI sync command benefits automatically (no API change)"
        - "src/mcp-server/index.js: MCP sync_install tool benefits automatically"
    tech_stack:
      added: []
      patterns:
        - "fs.stat-based diff filter before batch loop (mtime + size heuristic)"
        - "Filter-then-write decomposition (Promise.all over diff stats, then writeOps batches)"
        - "Counter shared across skip-path and write-path for unified onProgress"
    key_files:
      created:
        - ".planning/phases/91-diff-based-sync/91-01-SUMMARY.md"
      modified:
        - "src/core/sync.js (diff filter + env opt-out + JSDoc)"
        - "test/unit/sync.test.js (4 PERF-17-02 regression tests appended)"
    decisions:
      - "Diff filter applies ONLY to treeCopy ops (framework/hooks). Content ops (agents/commands/skills/rules) embed ISO timestamp in renderReference and can't safely diff — they re-render every call. treeCopy ops dominate wall time anyway, capturing the perf win."
      - "written[] return array semantics preserved (lists all op paths, not just actually-written) — stable API contract. Skipped files are still 'projected' to target tree."
      - "Diff filter uses Promise.all over ALL ops (no batch limit) — fs.stat is cheap and stat ulimits are far higher than write ulimits."
      - "mtime+size heuristic over hash-based diff — CONTEXT.md decision, accepts edge case of same-size touch with newer source mtime (correctly handled: mtime>=src.mtimeMs check writes if src is newer)."
      - "KIT_MCP_FORCE_FULL_SYNC=1 placed parallel to KIT_MCP_SKIP_MANIFEST_CHECK / KIT_MCP_VERIFY_NO_CACHE — same env-driven opt-out family for cleanup/recovery scenarios."
    metrics:
      duration: "<actual wall-clock>"
      completed: "<ISO timestamp>"
      tasks_completed: 3
      tests_added: 4
      tests_total: 326 (241 unit + 85 integration)
      tests_baseline: 322
    ---
    ```

    Then write sections matching Phase 90's SUMMARY format:
    1. **Brief overview paragraph** — what was built, link to PERF-17-02
    2. **What Was Built** — 3 subsections (Task 1, Task 2, Task 3) describing each commit
    3. **Verification** — table of grep counts + suite results
    4. **Performance Expectations** — actual benchmark numbers from Step 2 (or "to be measured in CI")
    5. **Decisions Made** — 5 numbered decisions matching the frontmatter
    6. **Deviations from Plan** — note that diff filter scope was reduced to treeCopy-only after `<context>` analysis revealed content ops embed timestamps; if no other deviations: "None other than the documented timestamp-aware scope"
    7. **Stable API Preserved** — bullet list of contracts maintained
    8. **Self-Check: PASSED** — file existence + commit hash list

    Use grep counts as automated proof:
    - `grep -c "KIT_MCP_FORCE_FULL_SYNC" src/core/sync.js` — should be 2
    - `grep -c "diffOne\|writeOps" src/core/sync.js` — should be ≥4
    - `grep -c "PERF-17-02" test/unit/sync.test.js` — should be ≥5
    - `grep -c "skipped: true" test/unit/sync.test.js` — should be ≥1
    - `grep -c "Promise.all" src/core/sync.js` — should be ≥2 (one for diffResults, one for batch loop)

    **Constraints:**
    - SUMMARY.md must EXIST before this plan completes (Self-Check requirement).
    - DO NOT skip the benchmark — even if it's just one machine, one run, document it.
    - DO NOT pad with prose. Phase 90 SUMMARY is ~140 lines; aim for similar density.
    - The Decisions section must include the timestamp-content-ops note explicitly — it's the most likely follow-up question reviewers will have.
  </action>
  <verify>
    <automated>
    cd D:/projetos/opensource/mcp

    # Final suite gate
    node test/run.mjs test/unit
    # Expected: 241 pass, 0 fail

    node test/run.mjs test/integration
    # Expected: 85 pass, 0 fail

    # SUMMARY exists
    test -f .planning/phases/91-diff-based-sync/91-01-SUMMARY.md && echo OK || echo FAIL
    # Expected: OK

    # SUMMARY frontmatter shape
    grep -c "^phase: 91-diff-based-sync" .planning/phases/91-diff-based-sync/91-01-SUMMARY.md
    # Expected: 1

    grep -c "^requirements: \[PERF-17-02\]" .planning/phases/91-diff-based-sync/91-01-SUMMARY.md
    # Expected: 1

    # Source code grep proofs (echo'd in SUMMARY's Verification table)
    grep -c "KIT_MCP_FORCE_FULL_SYNC" src/core/sync.js
    # Expected: 2

    grep -c "PERF-17-02" test/unit/sync.test.js
    # Expected: ≥5

    # manifest-verify.js untouched (Phase 90 preservation gate)
    git diff --stat src/core/manifest-verify.js
    # Expected: empty output (no changes)
    </automated>
  </verify>
  <done>
    - Full suite passes: 241 unit + 85 integration = 326 total (≥322 baseline + 4 new).
    - `manifest-verify.js` confirmed untouched via `git diff --stat` (Phase 90 preservation).
    - Manual benchmark run; numbers recorded in SUMMARY "Performance Expectations" section.
    - `91-01-SUMMARY.md` exists at `.planning/phases/91-diff-based-sync/91-01-SUMMARY.md`.
    - SUMMARY frontmatter has all required fields (phase, plan, subsystem, tags, requirements, dependency_graph, tech_stack, key_files, decisions, metrics).
    - SUMMARY mentions in Decisions section that content ops (agents/commands/skills/rules) are excluded from diff because of ISO timestamp in renderReference (line 277).
    - Self-Check section lists all 3 commits + all 3 modified/created files.
  </done>
</task>

</tasks>

<verification>
After all 3 tasks complete, the following invariants MUST hold (verifier will check these):

1. **Phase 88.01 PRESERVED:** `BATCH_SIZE = resolveBatchSize()` and Promise.all batched writes still present in syncTo(). New diff filter does NOT replace batching — it filters BEFORE batches.

2. **Phase 83 PRESERVED:** `await verifyManifest(kitRoot)` call still positioned BEFORE any diff logic at line 47 (or equivalent). Tampered kit must still throw `EMANIFESTMISMATCH` regardless of diff optimization.

3. **Phase 90 PRESERVED:** `src/core/manifest-verify.js` is byte-for-byte unchanged. `git diff src/core/manifest-verify.js` returns empty.

4. **Stable API PRESERVED:**
   - `syncTo()` signature unchanged.
   - Return shape unchanged: `{ target, mode, projectRoot, kitRoot, written, dryRun }`.
   - `written` array still includes paths of skipped ops (semantics: projected files, not actually-written).
   - `dryRun: true` still skips diff + writes (returns at the `if (!dryRun)` boundary).

5. **PERF-17-02 implemented:**
   - `KIT_MCP_FORCE_FULL_SYNC=1` env opt-out works.
   - Stat-based diff filter for treeCopy ops works.
   - `onProgress` receives `{ skipped: true }` for skipped ops.
   - 4 regression tests pass.

6. **Suite green:** 241 unit + 85 integration = 326 total. Baseline was 322 (Phase 90 final). Delta = +4 (matches tests_added).

7. **Budget 6/6 deps:** No new dependencies. `package.json` untouched.
</verification>

<success_criteria>
1. ✅ `syncTo()` 2nd consecutive call on stable workspace skips all treeCopy ops (verified by Test 1).
2. ✅ Edit on 1 source file → next sync writes only that file (verified by Test 2).
3. ✅ `KIT_MCP_FORCE_FULL_SYNC=1` forces full sync, no skips (verified by Test 3).
4. ✅ `onProgress` callback receives `{ skipped: true }` for skipped ops with full event shape (verified by Test 4).
5. ✅ Full suite 326 pass (322 baseline + 4 new), 0 fail.
6. ✅ Manual benchmark documents 2nd-vs-1st ratio (target ≤30%, acceptable ≤50%).
7. ✅ All 5 preservation invariants from `<verification>` block hold.
8. ✅ `91-01-SUMMARY.md` written with frontmatter + 8 sections matching Phase 90 format.
</success_criteria>

<output>
After completion, create `.planning/phases/91-diff-based-sync/91-01-SUMMARY.md` (Task 3 produces this).
</output>
