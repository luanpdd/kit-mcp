---
phase: 86-drift-auto-prevention
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/regen-manifest.js
  - test/unit/regen-manifest.test.js
  - package.json
  - .github/workflows/ci.yml
autonomous: true
requirements:
  - DX-15-02

must_haves:
  truths:
    - "scripts/regen-manifest.js standalone produz output IDÊNTICO ao kit/file-manifest.json existente quando rodado em estado limpo (idempotente)"
    - "package.json prepublishOnly chama ambos scripts (regen-manifest + update-readme-counts) ANTES dos tests"
    - "CI gate detecta drift — se PR esqueceu de rodar localmente, smoke job falha em git diff --exit-code"
    - "verifyManifest (Phase 83) continua aceitando o manifest regenerado (formato compatível)"
    - "Suite continua passando + 2 regression tests novos (idempotência + formato schema + verifier round-trip)"
  artifacts:
    - path: "scripts/regen-manifest.js"
      provides: "Auto-regen do kit/file-manifest.json a partir de SHA256 dos arquivos em kit/"
      min_lines: 70
    - path: "test/unit/regen-manifest.test.js"
      provides: "Regression tests — idempotência + schema + verifier round-trip"
      min_lines: 50
    - path: "package.json"
      provides: "prepublishOnly hook que chama scripts antes dos tests"
      contains: "regen-manifest"
    - path: ".github/workflows/ci.yml"
      provides: "Drift gate — falha CI se prepublishOnly geraria diff nao-commitado"
      contains: "scripts/regen-manifest.js"
  key_links:
    - from: "scripts/regen-manifest.js"
      to: "kit/** (recursive walk)"
      via: "fs.readdir + crypto.createHash sha256"
      pattern: "sha256|crypto"
    - from: "scripts/regen-manifest.js"
      to: "kit/file-manifest.json"
      via: "JSON.stringify with sorted keys + idempotent write"
      pattern: "file-manifest\\.json"
    - from: "package.json:prepublishOnly"
      to: "scripts/regen-manifest.js + scripts/update-readme-counts.js"
      via: "shell chain BEFORE test commands"
      pattern: "regen-manifest.+update-readme-counts.+test/run"
    - from: ".github/workflows/ci.yml smoke job"
      to: "scripts/* + git diff --exit-code"
      via: "post-script gate that fails if regen would have produced changes"
      pattern: "git diff --exit-code"
---

<objective>
Eliminar drift recorrente do kit/file-manifest.json — automatizando regen via prepublishOnly + CI gate que falha hard se PR nao rodou localmente. v1.13/v1.14/v1.15.85 todos regeneraram manualmente; cada esquecimento risca um sync EMANIFESTMISMATCH em producao (Phase 83 verifyManifest bloqueia).

Purpose: O verifier de Phase 83 (src/core/manifest-verify.js) trata mismatch como tampering — bloqueia install. Esquecer de regen e trivialmente comum em PRs que tocam kit/. Solucao: prepublishOnly forca regen + CI compara post-regen com committed state.
Output: scripts/regen-manifest.js standalone idempotente + prepublishOnly hook + CI drift gate + 3 regression tests.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/86-drift-auto-prevention/86-CONTEXT.md

# Existing manifest schema (must reproduce exactly):
#   {
#     "version": "1.13.0",
#     "timestamp": "2026-05-09T12:10:07.238Z",
#     "files": {
#       "<rel-to-kit-root>": "<sha256-hex>",
#       ...sorted alphabetically...
#     }
#   }
#
# rel-to-kit-root means paths inside the manifest are RELATIVE TO kit/ —
# e.g. "agents/planner.md" not "kit/agents/planner.md".
# verifyManifest (src/core/manifest-verify.js:54) does:
#   const abs = path.join(kitRoot, rel);
# so this is the contract.

# Current package.json:files[] determines what ships in npm tarball:
#   bin/, src/, kit/, gates/, README.md, LICENSE
# But manifest only covers kit/** — gates/**, src/**, bin/** are NOT in manifest
# (Phase 83 scope was "kit content tampering"). regen script mirrors this.

# verifyManifest also reads "version" — currently "1.13.0" pinned.
# Decision: keep manifest version IN-SYNC with package.json.version on each regen.
# (Phase 85.02 SUMMARY notes "version 1.13.0 preservada" — so prior practice was
# to NOT bump version in manifest. We change that here: manifest.version mirrors
# package.json.version automatically. Justification: manifest IS the kit content
# digest at a published version; pinning to package.json keeps semantics aligned.)
#
# This is a SCHEMA-COMPATIBLE change — verifyManifest reads .files only, never
# checks .version against anything. But regression test below pins the schema
# shape: {version, timestamp, files} — so future schema bumps require an explicit
# test update.

@src/core/manifest-verify.js
@kit/file-manifest.json
</context>

<interfaces>
# scripts/regen-manifest.js public surface:
#
# Default export (run as script): exit 1 on error, 0 on success. Stderr summary.
# Programmatic export: regenManifest(repoRoot) → { changed, count, manifestPath }
#   - walks repoRoot/kit/** recursively, EXCLUDING file-manifest.json itself
#   - sha256-hashes each file
#   - writes repoRoot/kit/file-manifest.json with sorted-key {version, timestamp, files}
#   - changed=false if newly-generated content matches existing file byte-for-byte
#     (modulo timestamp — see below)
#
# IDEMPOTENCE WRINKLE: timestamp changes every run by definition.
# Solution: when comparing for "changed", parse old + new, drop timestamp, compare
# {version, files}. If equal → don't write (preserve old timestamp). If different
# → write new file with fresh timestamp.
# This makes git diff empty when only running on a stable kit/, even if minutes
# elapse between runs — critical for the CI drift gate.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create scripts/regen-manifest.js (idempotent SHA256 manifest regen)</name>
  <files>scripts/regen-manifest.js</files>
  <read_first>
    Re-read src/core/manifest-verify.js carefully — that's the consumer. It expects:
    - JSON file at kit/file-manifest.json
    - top-level .files object (string→hex string map)
    - keys are paths RELATIVE to kit/ (so kit/agents/foo.md → "agents/foo.md")
    - values are sha256 hex (lowercase, 64 chars)

    Read first 20 lines of existing kit/file-manifest.json to confirm schema:
    {"version":"1.13.0","timestamp":"...","files":{"agents/...":"hash",...}}

    Note: "agents/..." not "kit/agents/..." — strip kit/ prefix.
    Note: COMANDOS.md sits AT kit/ root → key "COMANDOS.md" (no subdir).
    Note: README.md sits AT kit/ root → key "README.md".
    Note: settings.json sits AT kit/ root → key "settings.json".
    Note: framework/VERSION (no .ext) → key "framework/VERSION" (yes, included; see line 217 of existing manifest).

    Note: kit/file-manifest.json itself MUST be excluded from the walk (would be self-referential and unstable).

    Need to read package.json to get .version for the manifest's "version" field. Use fs.readFile + JSON.parse.

    Sort keys alphabetically (matches existing manifest convention — agents/* listed before commands/*, COMANDOS.md sits with C* etc.). Looking at existing kit/file-manifest.json line 52: "COMANDOS.md" appears between agents and commands — i.e. JSON keys are sorted by JS String default, where uppercase 'C' (0x43) < lowercase 'c' (0x63). Replicate this sort exactly: keys.sort() (default lexicographic).
  </read_first>
  <action>
    Create scripts/regen-manifest.js as ESM:

    ```javascript
    #!/usr/bin/env node
    // DX-15-02: regen kit/file-manifest.json from real kit/ contents (SHA256).
    // Idempotent: if file digests + version unchanged, the JSON file is NOT
    // rewritten (preserves the previous timestamp → empty git diff).
    //
    // Schema (matches src/core/manifest-verify.js consumer contract):
    //   { version: package.json.version,
    //     timestamp: ISO-8601 of last actual content change,
    //     files: { "<rel-to-kit/>": "<sha256-hex>", ... } sorted by key }
    //
    // Excludes: kit/file-manifest.json itself (self-reference would be unstable).
    // Walks: kit/** recursively, all files (any extension).

    import { readdir, readFile, writeFile } from 'node:fs/promises';
    import path from 'node:path';
    import crypto from 'node:crypto';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const REPO_ROOT_DEFAULT = path.resolve(path.dirname(__filename), '..');
    const MANIFEST_BASENAME = 'file-manifest.json';

    async function walkRel(rootAbs, prefix = '') {
      const out = [];
      const ents = await readdir(rootAbs, { withFileTypes: true });
      for (const ent of ents) {
        const rel = prefix ? prefix + '/' + ent.name : ent.name;
        if (ent.isDirectory()) {
          const subAbs = path.join(rootAbs, ent.name);
          out.push(...(await walkRel(subAbs, rel)));
        } else if (ent.isFile()) {
          out.push(rel);
        }
      }
      return out;
    }

    async function sha256(absPath) {
      const buf = await readFile(absPath);
      return crypto.createHash('sha256').update(buf).digest('hex');
    }

    export async function regenManifest(repoRoot = REPO_ROOT_DEFAULT) {
      const kitRoot = path.join(repoRoot, 'kit');
      const manifestAbs = path.join(kitRoot, MANIFEST_BASENAME);

      const pkgRaw = await readFile(path.join(repoRoot, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgRaw);
      const version = pkg.version;

      // Walk kit/, exclude file-manifest.json
      const allRel = await walkRel(kitRoot);
      const targets = allRel.filter((r) => r !== MANIFEST_BASENAME);
      targets.sort();

      const files = {};
      for (const rel of targets) {
        // Use forward slashes in keys (matches existing manifest, x-platform stable)
        const key = rel.split(path.sep).join('/');
        files[key] = await sha256(path.join(kitRoot, rel));
      }

      // Read existing manifest (if any) to decide if anything changed
      let prevTimestamp = null;
      let unchanged = false;
      try {
        const prevRaw = await readFile(manifestAbs, 'utf8');
        const prev = JSON.parse(prevRaw);
        prevTimestamp = prev.timestamp;
        if (
          prev.version === version &&
          prev.files &&
          typeof prev.files === 'object' &&
          Object.keys(prev.files).length === Object.keys(files).length &&
          Object.keys(files).every((k) => prev.files[k] === files[k])
        ) {
          unchanged = true;
        }
      } catch {
        // No previous file or unparseable — treat as changed
      }

      const timestamp = unchanged ? prevTimestamp : new Date().toISOString();
      const manifest = { version, timestamp, files };

      // Stable JSON: 2-space indent, sorted keys via insertion order above
      const newJson = JSON.stringify(manifest, null, 2) + '\n';

      if (unchanged) {
        // Confirm on-disk byte equality (handles the case where someone hand-edited
        // formatting). If bytes match, true no-op. If not, rewrite to canonical form.
        try {
          const onDisk = await readFile(manifestAbs, 'utf8');
          if (onDisk === newJson) {
            return { changed: false, count: targets.length, manifestPath: manifestAbs };
          }
        } catch { /* fall through to write */ }
      }

      await writeFile(manifestAbs, newJson, 'utf8');
      return { changed: true, count: targets.length, manifestPath: manifestAbs };
    }

    if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
        process.argv[1] === __filename) {
      try {
        const { changed, count } = await regenManifest();
        process.stderr.write(
          (changed ? '[regen-manifest] updated' : '[regen-manifest] no-op') +
          ' — ' + count + ' files hashed\n'
        );
      } catch (e) {
        process.stderr.write('[regen-manifest] ERROR: ' + e.message + '\n');
        process.exit(1);
      }
    }
    ```

    Critical invariants:
    1. Excludes kit/file-manifest.json itself (recursion-stable).
    2. Path keys use forward slashes (`agents/planner.md`) — matches existing manifest, works on Windows + POSIX.
    3. Idempotent — when content unchanged, preserves old timestamp AND writes nothing if bytes match.
    4. version field tracks package.json (currently 1.14.0; will become 1.15.0 after publish bump).
    5. Pure stdlib (`node:fs/promises`, `node:path`, `node:crypto`, `node:url`). Zero new deps.
    6. Standalone exit 1 on any error → prepublishOnly aborts release.

    Test the script after writing:
      `node scripts/regen-manifest.js`
    Expected: stderr `[regen-manifest] updated — N files hashed` on first run (because manifest version goes 1.13.0 → 1.14.0); after committing the new manifest, subsequent runs are `no-op` and `git diff --exit-code kit/file-manifest.json` returns 0.

    Commit the version-aligned manifest as part of Task 1 work; subsequent runs in CI gate (Task 3) are then no-op.
  </action>
  <verify>
    <automated>node scripts/regen-manifest.js 2>&amp;1 | grep -E "files hashed"</automated>
    <automated>node -e "const m=JSON.parse(require('fs').readFileSync('./kit/file-manifest.json','utf8'));if(typeof m.version!=='string')throw 0;if(typeof m.timestamp!=='string')throw 0;if(typeof m.files!=='object')throw 0;if(Object.keys(m.files).length<300)throw new Error(Object.keys(m.files).length);console.log('OK',Object.keys(m.files).length,'files');"</automated>
    <automated>node --input-type=module -e "import {verifyManifest} from './src/core/manifest-verify.js';const r=await verifyManifest('./kit');if(!r.ok)throw new Error(r.reason);console.log('OK verifier accepts');"</automated>
  </verify>
  <acceptance_criteria>
    Standalone run produces stderr line containing `files hashed`. Manifest schema is `{version, timestamp, files}`. verifyManifest('./kit') returns `{ok:true}` against the regenerated manifest (round-trip safe — Phase 83 contract preserved). After commit, second run is no-op (`git diff --exit-code kit/file-manifest.json` returns 0). Version field equals package.json.version (1.14.0 currently).
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests (idempotency + schema + verifier round-trip)</name>
  <files>test/unit/regen-manifest.test.js</files>
  <read_first>
    Use same test style as test/unit/manifest-verify.test.js (node:test, fs/promises, mkdtemp). Tests must isolate fixtures completely — never touch real kit/file-manifest.json. Need to also import verifyManifest to prove round-trip compatibility.
  </read_first>
  <action>
    Create test/unit/regen-manifest.test.js with 3 tests (one above the 2 minimum from CONTEXT.md, gives breathing room):

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
    import { tmpdir } from 'node:os';
    import path from 'node:path';

    import { regenManifest } from '../../scripts/regen-manifest.js';
    import { verifyManifest } from '../../src/core/manifest-verify.js';

    async function makeFixture() {
      const root = await mkdtemp(path.join(tmpdir(), 'kit-regen-manifest-'));
      await mkdir(path.join(root, 'kit', 'agents'), { recursive: true });
      await mkdir(path.join(root, 'kit', 'commands'), { recursive: true });
      await mkdir(path.join(root, 'kit', 'skills', 'alpha'), { recursive: true });
      await writeFile(path.join(root, 'kit', 'agents', 'a.md'), 'content-a');
      await writeFile(path.join(root, 'kit', 'commands', 'b.md'), 'content-b');
      await writeFile(path.join(root, 'kit', 'skills', 'alpha', 'SKILL.md'), 'skill-content');
      await writeFile(path.join(root, 'kit', 'README.md'), 'kit-readme');
      await writeFile(path.join(root, 'package.json'),
        JSON.stringify({ name: 'test', version: '9.9.9' }) + '\n');
      return root;
    }

    test('regenManifest: writes valid {version, timestamp, files} with sorted keys', async () => {
      const root = await makeFixture();
      try {
        const r = await regenManifest(root);
        assert.equal(r.changed, true);
        assert.equal(r.count, 4);

        const raw = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');
        const m = JSON.parse(raw);

        assert.equal(m.version, '9.9.9', 'version mirrors package.json');
        assert.match(m.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'ISO timestamp');
        assert.equal(typeof m.files, 'object');

        const keys = Object.keys(m.files);
        assert.deepEqual(keys, [...keys].sort(), 'keys sorted lexicographically');
        assert.ok(keys.every((k) => /^[0-9a-f]{64}$/.test(m.files[k])), 'all values are sha256 hex');
        assert.ok(keys.includes('agents/a.md'));
        assert.ok(keys.includes('commands/b.md'));
        assert.ok(keys.includes('skills/alpha/SKILL.md'));
        assert.ok(keys.includes('README.md'));
        assert.ok(!keys.includes('file-manifest.json'), 'manifest excludes itself');

        const v = await verifyManifest(path.join(root, 'kit'));
        assert.equal(v.ok, true, 'verifyManifest accepts regenerated manifest');
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    test('regenManifest: idempotent — second call preserves timestamp + bytes', async () => {
      const root = await makeFixture();
      try {
        const r1 = await regenManifest(root);
        assert.equal(r1.changed, true);
        const after1 = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');

        await new Promise((res) => setTimeout(res, 10));

        const r2 = await regenManifest(root);
        assert.equal(r2.changed, false, 'unchanged kit means no rewrite');
        const after2 = await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8');
        assert.equal(after1, after2, 'bytes identical (timestamp preserved)');
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    test('regenManifest: detects content change → updates hash + timestamp', async () => {
      const root = await makeFixture();
      try {
        await regenManifest(root);
        const t1 = JSON.parse(await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8'));
        const hash1 = t1.files['agents/a.md'];

        await new Promise((res) => setTimeout(res, 5));
        await writeFile(path.join(root, 'kit', 'agents', 'a.md'), 'content-a-MODIFIED');

        const r = await regenManifest(root);
        assert.equal(r.changed, true);
        const t2 = JSON.parse(await readFile(path.join(root, 'kit', 'file-manifest.json'), 'utf8'));
        assert.notEqual(t2.files['agents/a.md'], hash1, 'hash changed');
        assert.notEqual(t2.timestamp, t1.timestamp, 'timestamp updated');
        assert.equal(t2.version, '9.9.9');
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
    ```

    Run: `node test/run.mjs test/unit/regen-manifest.test.js`. All 3 must pass.
  </action>
  <verify>
    <automated>node test/run.mjs test/unit/regen-manifest.test.js</automated>
  </verify>
  <acceptance_criteria>
    All 3 tests pass. The verifier round-trip test specifically guards Phase 83 contract: any future schema change in regen-manifest.js that breaks verifyManifest will fail this test before merging. Total Phase 86 unit additions: +4 (Plan 01) + +3 (Plan 02) = +7 tests, 0 fails.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Wire prepublishOnly + CI drift gate</name>
  <files>package.json, .github/workflows/ci.yml</files>
  <read_first>
    Re-read package.json:scripts section. Current prepublishOnly:
      "prepublishOnly": "node test/run.mjs test/unit && node test/run.mjs test/integration"

    The new value MUST run the regen scripts BEFORE the tests, because Phase 83 verifyManifest is exercised by sync.test.js and ui-related integration tests — if manifest is stale post-edit, those tests catch it. Order:
      regen-manifest → update-readme-counts → unit tests → integration tests

    Re-read .github/workflows/ci.yml. The smoke job runs on the matrix (3 OS × 3 Node = 9 runs). The drift gate must be a single shell step inside smoke (after the standard test commands, before "CLI smoke"). Step uses bash shell explicitly — Windows runners need `shell: bash` to use git diff with --exit-code reliably (Git for Windows ships with bash).

    Note ci.yml line 2 is `name: CI` and the existing smoke job structure has steps each with `shell: bash` declared explicitly. Mirror that style.
  </read_first>
  <action>
    **Edit package.json**: Replace the prepublishOnly value.

    Current:
      "prepublishOnly": "node test/run.mjs test/unit && node test/run.mjs test/integration"

    New:
      "prepublishOnly": "node scripts/regen-manifest.js && node scripts/update-readme-counts.js && node test/run.mjs test/unit && node test/run.mjs test/integration"

    Use the Edit tool — preserve all other fields, no formatting drift, no trailing whitespace changes.

    **Edit .github/workflows/ci.yml**: Add a new step in the smoke job AFTER "Tests (integration)" (which has `run: npm run test:integration`, around line 124) and BEFORE "CLI smoke" (around line 126). The step (mind YAML 6-space indent matching surrounding steps):

    ```yaml
          - name: Audit — drift gate (manifest + README counts) (REQ DX-15-02)
            shell: bash
            run: |
              # DX-15-02: prepublishOnly regenerates kit/file-manifest.json + README
              # AUTOGEN counts. If a PR forgot to run them locally, this gate fails
              # before the package would ship stale.
              node scripts/regen-manifest.js
              node scripts/update-readme-counts.js
              if ! git diff --exit-code kit/file-manifest.json README.md; then
                echo "::error::DX-15-02 drift detected — run scripts locally and commit"
                git --no-pager diff --stat kit/file-manifest.json README.md || true
                exit 1
              fi
              echo "OK: manifest + README counts in sync with kit/"
    ```

    Use the Edit tool to insert this block between the existing two steps (after `run: npm run test:integration` line, before `- name: CLI smoke` line). Verify YAML lint passes (no tab characters, 2-space indent inside step, 6 spaces for the dash bullet matching siblings).

    Why this order:
    - Runs AFTER tests so a broken regen script (caught by Plan 01/02 unit tests) doesn't block test execution itself.
    - Runs BEFORE "Sync round-trip" because that step writes to .ci-test/ which would muddy git status.
    - Both scripts run before the diff so a single error message covers both kinds of drift.

    Why git diff --exit-code (not git status):
    - Specific to the 2 files we care about — won't false-flag on unrelated working-tree changes.
    - Returns 1 if differences exist; 0 if clean. Standard CI gate idiom.

    DO NOT change the existing v1.8 Supabase suite gates step or any other step. Single insertion only.

    After editing: run `npm run prepublishOnly` locally to confirm it works end-to-end (regen → counts → unit tests → integration tests). All must pass.
  </action>
  <verify>
    <automated>node -e "const p=JSON.parse(require('fs').readFileSync('./package.json','utf8'));const s=p.scripts.prepublishOnly;if(!s.includes('regen-manifest'))throw 0;if(!s.includes('update-readme-counts'))throw 0;if(!s.startsWith('node scripts/regen-manifest.js'))throw new Error('order');console.log('OK prepublishOnly');"</automated>
    <automated>node -e "const c=require('fs').readFileSync('.github/workflows/ci.yml','utf8');if(!c.includes('drift gate'))throw 0;if(!c.includes('scripts/regen-manifest.js'))throw 0;if(!c.includes('git diff --exit-code kit/file-manifest.json README.md'))throw 0;console.log('OK ci.yml');"</automated>
    <automated>npm run prepublishOnly</automated>
  </verify>
  <acceptance_criteria>
    package.json prepublishOnly starts with `node scripts/regen-manifest.js && node scripts/update-readme-counts.js && ...`. ci.yml smoke job has new "Audit — drift gate" step between integration tests and CLI smoke. `npm run prepublishOnly` runs end-to-end (regen → counts → unit tests → integration tests) with exit 0. After it runs, `git diff --exit-code kit/file-manifest.json README.md` returns 0 (clean — proves the drift gate would pass in CI for this commit).
  </acceptance_criteria>
</task>

</tasks>

<verification>
After all 3 tasks:

```bash
# Manual smoke
node scripts/regen-manifest.js          # stderr: "no-op — N files hashed" (after first commit)
git diff --exit-code kit/file-manifest.json   # exit 0

# Full prepublishOnly chain
npm run prepublishOnly                  # regen → counts → unit → integration; all pass

# CI drift gate (replicates what CI does)
node scripts/regen-manifest.js && node scripts/update-readme-counts.js && \
  git diff --exit-code kit/file-manifest.json README.md
```

Round-trip with verifier:
```bash
node --input-type=module -e \
  "import {verifyManifest} from './src/core/manifest-verify.js'; \
   const r = await verifyManifest('./kit'); \
   if (!r.ok) { console.error(r.reason); process.exit(1); } \
   console.log('OK');"
```
</verification>

<success_criteria>
- scripts/regen-manifest.js exists, ESM, zero new deps, ~120 lines
- kit/file-manifest.json regenerated with version aligned to package.json (1.14.0)
- verifyManifest('./kit') returns ok:true (Phase 83 contract preserved)
- prepublishOnly chain: regen → counts → unit tests → integration tests; exit 0 end-to-end
- CI smoke job has drift gate step that fails if any PR ships stale manifest or README counts
- 3 regression tests pass; total Phase 86 additions: +7 tests
- No new runtime deps (budget 6/6 mantido)
</success_criteria>

<output>
After completion, create `.planning/phases/86-drift-auto-prevention/86-02-SUMMARY.md`
</output>
