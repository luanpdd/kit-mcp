---
phase: 86-drift-auto-prevention
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/update-readme-counts.js
  - test/unit/update-readme-counts.test.js
  - README.md
autonomous: true
requirements:
  - DX-15-01

must_haves:
  truths:
    - "scripts/update-readme-counts.js standalone roda sem erro e produz contagens reais (47 agents, 87 commands, 45 skills, 20 gates)"
    - "README.md tem bloco AUTOGEN-COUNTS delimitado e populado com contagens corretas"
    - "Script é idempotente — segunda execução em estado limpo produz zero diff"
    - "Suite continua passando + 2 regression tests novos verificam idempotência e presença do bloco"
  artifacts:
    - path: "scripts/update-readme-counts.js"
      provides: "Auto-regen do bloco AUTOGEN-COUNTS no README a partir de contagens reais do kit/"
      min_lines: 60
    - path: "test/unit/update-readme-counts.test.js"
      provides: "Regression tests — idempotência + presença do bloco delimitado"
      min_lines: 40
    - path: "README.md"
      provides: "Bloco AUTOGEN-COUNTS populado substituindo 6 linhas com contadores estáticos"
      contains: "<!-- AUTOGEN-COUNTS-START -->"
  key_links:
    - from: "scripts/update-readme-counts.js"
      to: "kit/agents/*.md, kit/commands/*.md, kit/skills/**/SKILL.md, gates/*.md"
      via: "fs.readdir + glob por categoria"
      pattern: "kit/agents|kit/commands|kit/skills|gates"
    - from: "scripts/update-readme-counts.js"
      to: "README.md"
      via: "fs.readFile + regex AUTOGEN-COUNTS-START/END + fs.writeFile (write only if changed)"
      pattern: "AUTOGEN-COUNTS-(START|END)"
---

<objective>
Eliminar drift recorrente dos contadores de agents/commands/skills/gates no README — substituindo as 6 linhas estáticas por bloco AUTOGEN delimitado regenerado por script idempotente. Sintoma observado: README atual diz "49 skills" mas disco tem 45 (drift real).

Purpose: Cada nova fase que adiciona/remove kit content torna o README stale. Solução estática (Phase 81.02) não escala — automatizar via prepublishOnly no Plan 02.
Output: `scripts/update-readme-counts.js` standalone idempotente + bloco AUTOGEN-COUNTS no README + 2 regression tests.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/86-drift-auto-prevention/86-CONTEXT.md

# Numbers on disk (source of truth for the script's expected output):
#   kit/agents/*.md       → 47
#   kit/commands/*.md     → 87
#   kit/skills/*/SKILL.md → 45  (README currently lies, says 49 — drift!)
#   gates/*.md            → 20

# Static counter lines currently in README.md (target for replacement):
#   line 31:  ├── agents/                 47 agents (planner, executor, verifier, debugger,
#   line 178: npx -y @luanpdd/kit-mcp kit list-agents     # 47 agents
#   line 179: npx -y @luanpdd/kit-mcp kit list-commands   # 87 commands
#   line 242: kit kit list-agents               # 47 agents (bundled workflow)
#   line 243: kit kit list-commands             # 87 commands (bundled workflow)
#   line 244: kit kit list-skills               # 49 skills (bundled workflow)  ← DRIFT
#   line 632: node bin/cli.js gates list                        # 20 gates

# Strategy: introduce ONE canonical AUTOGEN-COUNTS block somewhere stable
# (top of "What ships in the box" section, before the file tree). Leave
# the existing tree/CLI example lines BUT they become subordinate references
# — the canonical truth is the AUTOGEN block. Tests assert block presence;
# we don't need to rip every inline mention immediately (incremental).
#
# The block looks like:
#   <!-- AUTOGEN-COUNTS-START -->
#   **Bundled workflow:** 47 agents · 87 commands · 45 skills · 20 gates
#   <!-- AUTOGEN-COUNTS-END -->

@src/core/manifest-verify.js
</context>

<interfaces>
# Existing helper to mimic style (simple async + return shape):

# scripts/update-readme-counts.js public interface (for Plan 02 to import optionally):
#
# Default export when run as script: process.exitCode = 1 on error, 0 on success.
# Programmatic export (named): updateReadmeCounts(repoRoot) → { changed: boolean, counts: {...} }
#   - reads {repoRoot}/kit/agents/*.md, {repoRoot}/kit/commands/*.md, etc.
#   - reads {repoRoot}/README.md
#   - if no AUTOGEN-COUNTS-START block found → throws Error("README.md missing AUTOGEN-COUNTS block")
#   - if counts already match → returns { changed: false, counts }
#   - else writes README.md with replaced block → returns { changed: true, counts }
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add AUTOGEN-COUNTS block to README.md</name>
  <files>README.md</files>
  <read_first>
    Open README.md. Locate "## What ships in the box" header (around line 26). Right BEFORE that header (so the block sits in a stable, prominent location), insert the AUTOGEN block. Do NOT remove any existing inline counter mentions — the script's job is to keep the AUTOGEN block in sync; inline mentions can be cleaned up incrementally in future passes.
  </read_first>
  <action>
    Edit README.md — insert these 4 lines exactly before line containing "## What ships in the box":

    <!-- AUTOGEN-COUNTS-START -->
    **Bundled workflow:** 47 agents · 87 commands · 45 skills · 20 gates
    <!-- AUTOGEN-COUNTS-END -->

    Followed by one blank line. Pre-populate with the current real counts (45 not 49, as that's what's on disk).

    Do NOT modify any other line in README.md. The 6 inline counter mentions stay as-is for this plan — the AUTOGEN block is the canonical source going forward.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const c=fs.readFileSync('README.md','utf8');if(!c.includes('&lt;!-- AUTOGEN-COUNTS-START --&gt;'))throw new Error('start marker missing');if(!c.includes('&lt;!-- AUTOGEN-COUNTS-END --&gt;'))throw new Error('end marker missing');if(!c.includes('47 agents · 87 commands · 45 skills · 20 gates'))throw new Error('counts line missing or wrong');console.log('OK');"</automated>
  </verify>
  <acceptance_criteria>
    README.md contains exactly one occurrence of `&lt;!-- AUTOGEN-COUNTS-START --&gt;` and one of `&lt;!-- AUTOGEN-COUNTS-END --&gt;`. Between them: a single content line with the 4 counts in the format above. No other content lines in README changed (`git diff README.md` shows only the inserted 4 lines + 1 blank).
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create scripts/update-readme-counts.js (idempotent regen)</name>
  <files>scripts/update-readme-counts.js</files>
  <read_first>
    Confirm scripts/ does not exist yet (mkdir at write time). Review src/core/manifest-verify.js for style — pure async fns, fs/promises, named exports. Confirm package.json `"type": "module"` so the new script is ESM.

    The script needs to read these directories and count `*.md` files (skills count is one-per-subfolder via SKILL.md):
    - kit/agents/*.md → 47
    - kit/commands/*.md → 87
    - kit/skills/*/SKILL.md → 45
    - gates/*.md → 20

    Use only Node stdlib: `node:fs/promises` (readdir with `withFileTypes:true` for skills), `node:path`, `node:url` for `fileURLToPath`. NO glob deps (budget 6/6 hard cap — see ci.yml).
  </read_first>
  <action>
    Create scripts/update-readme-counts.js as ESM. Structure:

    ```javascript
    #!/usr/bin/env node
    // DX-15-01: regen the AUTOGEN-COUNTS block in README.md from real kit/ counts.
    // Idempotent: if counts already match, the file is NOT rewritten (no-op = zero diff).
    // Run standalone (`node scripts/update-readme-counts.js`) or import { updateReadmeCounts }.
    //
    // Counted categories:
    //   - kit/agents/*.md
    //   - kit/commands/*.md
    //   - kit/skills/*/SKILL.md  (one count per subdir that contains SKILL.md)
    //   - gates/*.md
    //
    // Block format in README.md (single line of content):
    //   <!-- AUTOGEN-COUNTS-START -->
    //   **Bundled workflow:** {N} agents · {N} commands · {N} skills · {N} gates
    //   <!-- AUTOGEN-COUNTS-END -->
    //
    // Throws if the block markers are absent — README must already contain them
    // (Task 1 of this plan establishes the block once).

    import { readdir, readFile, writeFile } from 'node:fs/promises';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const REPO_ROOT_DEFAULT = path.resolve(path.dirname(__filename), '..');

    const START = '<!-- AUTOGEN-COUNTS-START -->';
    const END = '<!-- AUTOGEN-COUNTS-END -->';

    async function countMdIn(dirAbs) {
      const ents = await readdir(dirAbs, { withFileTypes: true });
      return ents.filter((e) => e.isFile() && e.name.endsWith('.md')).length;
    }

    async function countSkillsIn(skillsRootAbs) {
      const ents = await readdir(skillsRootAbs, { withFileTypes: true });
      let n = 0;
      for (const ent of ents) {
        if (!ent.isDirectory()) continue;
        if (ent.name.startsWith('_')) continue; // _shared-* are glossaries, not skills
        try {
          const stat = await readFile(path.join(skillsRootAbs, ent.name, 'SKILL.md'));
          if (stat) n++;
        } catch { /* not a skill */ }
      }
      return n;
    }

    export async function updateReadmeCounts(repoRoot = REPO_ROOT_DEFAULT) {
      const agents = await countMdIn(path.join(repoRoot, 'kit', 'agents'));
      const commands = await countMdIn(path.join(repoRoot, 'kit', 'commands'));
      const skills = await countSkillsIn(path.join(repoRoot, 'kit', 'skills'));
      const gates = await countMdIn(path.join(repoRoot, 'gates'));
      const counts = { agents, commands, skills, gates };

      const readmePath = path.join(repoRoot, 'README.md');
      const before = await readFile(readmePath, 'utf8');

      const startIdx = before.indexOf(START);
      const endIdx = before.indexOf(END);
      if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        throw new Error(
          'README.md missing AUTOGEN-COUNTS block — add ' + START + ' and ' + END + ' first.'
        );
      }

      const newBlock =
        START + '\n' +
        '**Bundled workflow:** ' + agents + ' agents · ' + commands +
        ' commands · ' + skills + ' skills · ' + gates + ' gates\n' +
        END;

      const after =
        before.slice(0, startIdx) + newBlock + before.slice(endIdx + END.length);

      if (after === before) {
        return { changed: false, counts };
      }
      await writeFile(readmePath, after, 'utf8');
      return { changed: true, counts };
    }

    // Run standalone: emit a single-line summary on stderr; exit 0 on success.
    if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
        process.argv[1] === __filename) {
      try {
        const { changed, counts } = await updateReadmeCounts();
        process.stderr.write(
          (changed ? '[update-readme-counts] updated' : '[update-readme-counts] no-op') +
          ' — ' + counts.agents + ' agents, ' + counts.commands + ' commands, ' +
          counts.skills + ' skills, ' + counts.gates + ' gates\n'
        );
      } catch (e) {
        process.stderr.write('[update-readme-counts] ERROR: ' + e.message + '\n');
        process.exit(1);
      }
    }
    ```

    Key invariants documented in code:
    1. Idempotent — second call without kit changes returns `{changed:false}` and does NOT touch the file (so `git diff` is empty).
    2. Skills counter excludes `_shared-*` subdirs (those are glossaries, mentioned by COMPATIBILITY in v1.15.85.02 work as `_shared-legacy/`, `_shared-observability/`, `_shared-sre/`, `_shared-supabase/` — 4 dirs, would inflate count by 4 if included).
    3. Throws if block markers absent (caller must run Task 1 first; CI gate in Plan 02 validates this).
    4. Pure ESM, zero new deps. Works with `package.json` "type":"module".
    5. Standalone exit code: 1 on any error (file missing, markers missing, write fail). prepublishOnly aborts release on failure.

    Test the script manually after writing:
      `node scripts/update-readme-counts.js`
    Expected stderr: `[update-readme-counts] no-op — 47 agents, 87 commands, 45 skills, 20 gates`
    (no-op because Task 1 already wrote the correct counts).
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node scripts/update-readme-counts.js 2>&amp;1 | grep -E "47 agents, 87 commands, 45 skills, 20 gates" &amp;&amp; git diff --exit-code README.md</automated>
  </verify>
  <acceptance_criteria>
    Standalone run produces stderr line containing `47 agents, 87 commands, 45 skills, 20 gates`. After running, `git diff --exit-code README.md` returns 0 (idempotent — no rewrite when counts already match). Second run is also no-op. If any kit/agents/foo.md is added before run, README.md is regenerated and `git diff` shows the count bump.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Regression tests (idempotency + block presence)</name>
  <files>test/unit/update-readme-counts.test.js</files>
  <read_first>
    Examine test/unit/manifest-verify.test.js for `node:test` style used in this repo (describe/it via node:test, fs/promises for fixtures, mkdtemp for isolation). Tests are ESM (.test.js loaded by `node test/run.mjs`).

    The test creates an isolated tmp dir mirroring repoRoot structure (kit/agents, kit/commands, kit/skills, gates, README.md), runs updateReadmeCounts(tmpRoot), and asserts on result + file state.
  </read_first>
  <action>
    Create test/unit/update-readme-counts.test.js with 4 tests (over the 2 minimum stated in CONTEXT.md, gives breathing room):

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
    import { tmpdir } from 'node:os';
    import path from 'node:path';

    import { updateReadmeCounts } from '../../scripts/update-readme-counts.js';

    async function makeFixture() {
      const root = await mkdtemp(path.join(tmpdir(), 'kit-readme-counts-'));
      // 3 agents, 2 commands, 2 skills, 1 gate
      await mkdir(path.join(root, 'kit', 'agents'), { recursive: true });
      await mkdir(path.join(root, 'kit', 'commands'), { recursive: true });
      await mkdir(path.join(root, 'kit', 'skills', 'alpha'), { recursive: true });
      await mkdir(path.join(root, 'kit', 'skills', 'beta'), { recursive: true });
      await mkdir(path.join(root, 'kit', 'skills', '_shared-x'), { recursive: true }); // excluded
      await mkdir(path.join(root, 'gates'), { recursive: true });
      for (const n of ['a', 'b', 'c']) {
        await writeFile(path.join(root, 'kit', 'agents', n + '.md'), '# ' + n);
      }
      for (const n of ['x', 'y']) {
        await writeFile(path.join(root, 'kit', 'commands', n + '.md'), '# ' + n);
      }
      await writeFile(path.join(root, 'kit', 'skills', 'alpha', 'SKILL.md'), '# alpha');
      await writeFile(path.join(root, 'kit', 'skills', 'beta', 'SKILL.md'), '# beta');
      await writeFile(path.join(root, 'kit', 'skills', '_shared-x', 'glossary.md'), '# x');
      await writeFile(path.join(root, 'gates', 'g1.md'), '# g1');
      return root;
    }

    test('updateReadmeCounts: writes block when counts change', async () => {
      const root = await makeFixture();
      try {
        const readme =
          '# Title\n\n' +
          '<!-- AUTOGEN-COUNTS-START -->\n' +
          '**Bundled workflow:** 0 agents · 0 commands · 0 skills · 0 gates\n' +
          '<!-- AUTOGEN-COUNTS-END -->\n';
        await writeFile(path.join(root, 'README.md'), readme);

        const r1 = await updateReadmeCounts(root);
        assert.equal(r1.changed, true);
        assert.deepEqual(r1.counts, { agents: 3, commands: 2, skills: 2, gates: 1 });

        const after = await readFile(path.join(root, 'README.md'), 'utf8');
        assert.match(after, /3 agents · 2 commands · 2 skills · 1 gates/);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    test('updateReadmeCounts: idempotent — no rewrite when counts already match', async () => {
      const root = await makeFixture();
      try {
        const readme =
          '# Title\n\n' +
          '<!-- AUTOGEN-COUNTS-START -->\n' +
          '**Bundled workflow:** 3 agents · 2 commands · 2 skills · 1 gates\n' +
          '<!-- AUTOGEN-COUNTS-END -->\n';
        await writeFile(path.join(root, 'README.md'), readme);

        const before = await readFile(path.join(root, 'README.md'), 'utf8');
        const r = await updateReadmeCounts(root);
        const after = await readFile(path.join(root, 'README.md'), 'utf8');

        assert.equal(r.changed, false);
        assert.equal(after, before);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    test('updateReadmeCounts: throws when AUTOGEN block markers absent', async () => {
      const root = await makeFixture();
      try {
        await writeFile(path.join(root, 'README.md'), '# Title\n\nNo block here.\n');
        await assert.rejects(updateReadmeCounts(root), /AUTOGEN-COUNTS block/);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    test('updateReadmeCounts: real repo — counts match disk and is no-op', async () => {
      // After Task 1 + Task 2 of this plan, the real README.md should already
      // be at the correct counts; running on the live repo is a no-op.
      const repoRoot = path.resolve(import.meta.dirname, '..', '..');
      const r = await updateReadmeCounts(repoRoot);
      assert.equal(r.changed, false, 'live README is out of sync — Task 1/2 incomplete');
      assert.equal(r.counts.agents, 47);
      assert.equal(r.counts.commands, 87);
      assert.equal(r.counts.skills, 45);
      assert.equal(r.counts.gates, 20);
    });
    ```

    Run: `node test/run.mjs test/unit/update-readme-counts.test.js`. All 4 must pass.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp &amp;&amp; node test/run.mjs test/unit/update-readme-counts.test.js</automated>
  </verify>
  <acceptance_criteria>
    All 4 tests pass. Total suite (`npm test`) increases from 198 → 202 unit tests, 0 fails. The "real repo no-op" test specifically guards against future drift between the AUTOGEN block in README.md and disk reality — if a future commit adds an agent without rerunning the script, this test fails first.
  </acceptance_criteria>
</task>

</tasks>

<verification>
After all 3 tasks:

```bash
# Manual smoke
node scripts/update-readme-counts.js  # stderr: "no-op — 47 agents, 87 commands, 45 skills, 20 gates"
git diff --exit-code README.md         # exit 0

# Test suite — must include 4 new tests, total > 200 unit tests, 0 fails
npm test
npm run test:integration
```

Block in README.md:
```bash
grep -c "AUTOGEN-COUNTS-START" README.md  # 1
grep -c "AUTOGEN-COUNTS-END" README.md    # 1
grep "Bundled workflow:" README.md         # 1 line, real counts
```
</verification>

<success_criteria>
- scripts/update-readme-counts.js exists, ESM, zero new deps, 60-120 lines
- README.md has AUTOGEN-COUNTS block with current real counts (47/87/45/20)
- Standalone script run is no-op (`git diff --exit-code` succeeds)
- 4 regression tests pass; suite total > 200 unit tests, 0 fails
- Plan 02 can chain `node scripts/update-readme-counts.js` in prepublishOnly safely
</success_criteria>

<output>
After completion, create `.planning/phases/86-drift-auto-prevention/86-01-SUMMARY.md`
</output>
