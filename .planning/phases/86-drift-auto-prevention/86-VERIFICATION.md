---
phase: 86-drift-auto-prevention
verified: 2026-05-09T13:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 86: Drift Auto-Prevention Verification Report

**Phase Goal:** Eliminar 2 fontes de drift recorrente (README counters + manifest) via prepublishOnly hook automação.

**Verified:** 2026-05-09T13:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                  | Status     | Evidence                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `scripts/update-readme-counts.js` standalone runs and produces real counts; idempotent (zero diff)     | ✓ VERIFIED | Stderr: `[update-readme-counts] no-op — 47 agents, 87 commands, 45 skills, 20 gates`; `git diff --exit-code README.md` exit 0     |
| 2   | `scripts/regen-manifest.js` standalone runs; idempotent on stable kit/                                 | ✓ VERIFIED | Stderr: `[regen-manifest] no-op — 328 files hashed`; `git diff --exit-code kit/file-manifest.json` exit 0                         |
| 3   | README.md has `<!-- AUTOGEN-COUNTS-START -->...<!-- AUTOGEN-COUNTS-END -->` block populated correctly  | ✓ VERIFIED | Lines 26-28: `**Bundled workflow:** 47 agents · 87 commands · 45 skills · 20 gates`; exactly 1 START + 1 END marker               |
| 4   | `package.json:prepublishOnly` chains regen-manifest → update-readme-counts → unit → integration        | ✓ VERIFIED | Line 47: `"prepublishOnly": "node scripts/regen-manifest.js && node scripts/update-readme-counts.js && node test/run.mjs ..."`    |
| 5   | `.github/workflows/ci.yml` has "Audit — drift gate" step using `git diff --exit-code`                  | ✓ VERIFIED | Lines 126-139 in smoke job; runs both regen scripts then `git diff --exit-code kit/file-manifest.json README.md` with `exit 1`    |
| 6   | `npm run prepublishOnly` exits 0 end-to-end                                                            | ✓ VERIFIED | Captured `EXIT_CODE=0`; full chain executed (regen → counts → 205 unit + 84 integration)                                          |
| 7   | `verifyManifest('./kit')` returns `{ok:true}` post-regen (Phase 83 contract preserved)                 | ✓ VERIFIED | Direct invocation: `verifyManifest result: {"ok":true}` via ESM round-trip script                                                 |
| 8   | Suite continues passing (~289 tests, 0 fails)                                                          | ✓ VERIFIED | 205 unit (203 pass + 2 skipped) + 84 integration = **289 tests, 0 fails** in prepublishOnly run                                   |
| 9   | Phase 83 `verifyManifest` contract preserved                                                           | ✓ VERIFIED | Schema unchanged: `{version, timestamp, files}`; all 328 keys are valid 64-char SHA256 hex; manifest excludes itself              |
| 10  | Stable API v1.0+ preserved (scripts are internal tooling, no exposed surface change)                   | ✓ VERIFIED | New files in `scripts/` (not exported via `package.json:files` or main); no changes to `bin/`, `src/cli.js`, or public exports    |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                        | Expected                                          | Status     | Details                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/update-readme-counts.js`               | ESM, ~60-126 lines, idempotent regen of AUTOGEN   | ✓ VERIFIED | 126 lines, ESM (`import` syntax), pure stdlib (`fs/promises`, `path`, `url`); EOL preservation hardening (CRLF/LF) for Windows idempotency               |
| `scripts/regen-manifest.js`                     | ESM, ~70-128 lines, idempotent SHA256 manifest    | ✓ VERIFIED | 128 lines, ESM, pure stdlib (`fs/promises`, `path`, `crypto`, `url`); preserves prior timestamp on no-op; cross-platform main detection                  |
| `test/unit/update-readme-counts.test.js`        | 4 regression tests (idempotency, throw, real-repo)| ✓ VERIFIED | 99 lines, 4 tests all passing: writes-on-change, idempotent, throws-on-missing-block, real-repo no-op (47/87/45/20 disk verification)                    |
| `test/unit/regen-manifest.test.js`              | 3 regression tests (schema, idempotency, change)  | ✓ VERIFIED | 109 lines, 3 tests all passing: schema+sorted+verifier-roundtrip, idempotent-bytes, content-change-detected                                              |
| `README.md` (modified)                          | AUTOGEN-COUNTS block populated                    | ✓ VERIFIED | Lines 26-28 contain exactly 1 START marker + 1 END marker + counts line; AUTOGEN block placed before "## What ships in the box" header                   |
| `package.json` (modified)                       | prepublishOnly chains both scripts before tests   | ✓ VERIFIED | Line 47: order `regen-manifest → update-readme-counts → unit → integration` (matches plan spec)                                                          |
| `.github/workflows/ci.yml` (modified)           | drift gate step in smoke job                      | ✓ VERIFIED | Lines 126-139, after "Tests (integration)" and before "CLI smoke"; `shell: bash`; `git diff --exit-code` with `exit 1` on fail                           |
| `kit/file-manifest.json` (regenerated)          | Schema {version, timestamp, files}; 328 entries   | ✓ VERIFIED | version=1.14.0 (mirrors package.json), timestamp ISO-8601, 328 keys all SHA256 hex; canonical sort; excludes self; includes COMPATIBILITY.md             |

### Key Link Verification

| From                                            | To                                                    | Via                                              | Status   | Details                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `scripts/update-readme-counts.js`               | `kit/agents/*`, `kit/commands/*`, `kit/skills/*/SKILL.md`, `gates/*` | `fs.readdir + dirent walk` (line 30-49)         | ✓ WIRED  | `countMdIn` for agents/commands/gates; `countSkillsIn` walks subdirs probing SKILL.md, excludes `_shared-*` |
| `scripts/update-readme-counts.js`               | `README.md`                                           | `fs.readFile + indexOf(START/END) + writeFile`   | ✓ WIRED  | Lines 58-95: read, locate markers, build new block, write only if changed (idempotency)            |
| `scripts/regen-manifest.js`                     | `kit/**` (recursive walk)                             | `walkRel` + `crypto.createHash('sha256')`       | ✓ WIRED  | Lines 23-41: recursive walk excluding manifest itself; SHA256 of each file content                 |
| `scripts/regen-manifest.js`                     | `kit/file-manifest.json`                              | `JSON.stringify(sorted) + idempotent write`     | ✓ WIRED  | Lines 84-103: stable JSON output; preserves prior timestamp + skips write when bytes match         |
| `scripts/regen-manifest.js`                     | `package.json` (version field)                        | `readFile + JSON.parse → manifest.version`      | ✓ WIRED  | Lines 47-49: reads `pkg.version`, used in manifest output (verified 1.14.0 alignment)              |
| `package.json:prepublishOnly`                   | both regen scripts + tests                            | shell `&&` chain                                 | ✓ WIRED  | Order verified: regen-manifest → update-readme-counts → unit → integration                         |
| `.github/workflows/ci.yml smoke job`            | both scripts + `git diff --exit-code`                 | bash step post-integration-tests                 | ✓ WIRED  | Step lines 126-139; runs scripts then diffs both files; explicit `exit 1` on diff detection        |
| `scripts/regen-manifest.js` output              | `src/core/manifest-verify.js` consumer                | `{version, timestamp, files}` schema             | ✓ WIRED  | `verifyManifest('./kit')` returns `{ok:true}` against regenerated manifest (round-trip safe)       |

### Data-Flow Trace (Level 4)

| Artifact                                | Data Variable          | Source                                              | Produces Real Data | Status     |
| --------------------------------------- | ---------------------- | --------------------------------------------------- | ------------------ | ---------- |
| `scripts/update-readme-counts.js`       | `counts` object        | Live `fs.readdir` of kit/agents, kit/commands, etc. | Yes (47/87/45/20)  | ✓ FLOWING  |
| `scripts/regen-manifest.js`             | `files` map            | Live SHA256 hashing of kit/** files                 | Yes (328 entries)  | ✓ FLOWING  |
| `scripts/regen-manifest.js`             | `version`              | `package.json.version` (1.14.0)                     | Yes                | ✓ FLOWING  |
| `kit/file-manifest.json` (output)       | `files` object         | regen-manifest output                               | Yes (328 SHA256)   | ✓ FLOWING  |
| `README.md` AUTOGEN block               | counts line            | update-readme-counts output                         | Yes (47/87/45/20)  | ✓ FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                | Command                                                                                                | Result                                                                          | Status |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------ |
| update-readme-counts standalone runs and is no-op       | `node scripts/update-readme-counts.js`                                                                | `[update-readme-counts] no-op — 47 agents, 87 commands, 45 skills, 20 gates`    | ✓ PASS |
| regen-manifest standalone runs and is no-op             | `node scripts/regen-manifest.js`                                                                      | `[regen-manifest] no-op — 328 files hashed`                                     | ✓ PASS |
| Idempotency: zero git diff after running both scripts   | `git diff --exit-code kit/file-manifest.json README.md`                                                | EXIT_CODE=0                                                                     | ✓ PASS |
| Phase 83 verifyManifest accepts regenerated manifest    | `node --input-type=module -e "import {verifyManifest} ...; console.log(await verifyManifest('./kit'))"` | `{"ok":true}`                                                                   | ✓ PASS |
| Both new test files pass (7 tests)                      | `node --test test/unit/update-readme-counts.test.js test/unit/regen-manifest.test.js`                  | 7/7 pass, 0 fails                                                               | ✓ PASS |
| Full prepublishOnly chain exits 0                        | `npm run prepublishOnly`                                                                              | EXIT_CODE=0; 205 unit (203 pass + 2 skipped) + 84 integration; 0 fails          | ✓ PASS |
| Disk counts match README claim                           | direct stdlib count of kit/agents, kit/commands, kit/skills, gates                                    | agents=47, commands=87, skills=45, gates=20                                     | ✓ PASS |
| Manifest excludes itself                                 | inspect manifest keys for `file-manifest.json`                                                        | not present (correct — recursion-stable)                                        | ✓ PASS |
| Manifest version mirrors package.json                    | compare `manifest.version` vs `package.version`                                                       | both 1.14.0                                                                     | ✓ PASS |
| All manifest values are valid SHA256 hex                 | regex check `^[0-9a-f]{64}$` over all 328 values                                                       | all match                                                                       | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan         | Description                                                              | Status      | Evidence                                                                                                                                                            |
| ----------- | ------------------- | ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DX-15-01    | 86-01-readme-counts | Auto-regen README AUTOGEN-COUNTS block from real kit/ disk counts        | ✓ SATISFIED | scripts/update-readme-counts.js (126 LOC), 4 regression tests pass, README block present + populated, prepublishOnly chain integration confirmed                    |
| DX-15-02    | 86-02-manifest-regen| Auto-regen kit/file-manifest.json via SHA256 + CI drift gate enforcement | ✓ SATISFIED | scripts/regen-manifest.js (128 LOC), 3 regression tests pass, manifest regenerated to v1.14.0 (328 entries), CI drift gate step in ci.yml smoke job, prepublishOnly chain confirmed |

No orphaned requirements (both DX-15-01 and DX-15-02 mapped to plans and all evidence found).

### Anti-Patterns Found

| File                                       | Line | Pattern                            | Severity | Impact                                                                                  |
| ------------------------------------------ | ---- | ---------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| —                                          | —    | (no anti-patterns detected)        | —        | scripts/, test files, README, package.json, ci.yml all clean of TODO/FIXME/placeholder  |

### Human Verification Required

None — all 10 must-haves verified programmatically:
- Standalone script outputs captured
- Exit codes captured
- File content verified by direct grep/read
- Round-trip with Phase 83 verifier confirmed
- Test counts captured from prepublishOnly run

### Gaps Summary

No gaps. Phase 86 fully achieves its goal:

1. **Drift source 1 (README counters) eliminated** — `<!-- AUTOGEN-COUNTS-START/END -->` block in README.md is regenerated idempotently by `scripts/update-readme-counts.js`. Real-repo regression test (in update-readme-counts.test.js) guards against future drift.

2. **Drift source 2 (kit/file-manifest.json) eliminated** — `scripts/regen-manifest.js` produces canonical SHA256 manifest at v1.14.0 (328 entries, including 4 previously missing entries: COMPATIBILITY.md + 3 framework templates). Phase 83 `verifyManifest` contract preserved (`{ok:true}` round-trip).

3. **Automation enforced at 2 layers:**
   - **prepublishOnly hook** chains regen-manifest → update-readme-counts → unit → integration (any regen failure aborts publish; any test failure blocks publish).
   - **CI drift gate** in smoke job runs both scripts then `git diff --exit-code` — fails any PR that touched kit/ without rerunning prepublishOnly locally.

4. **Stable API preserved** — scripts/ is internal tooling not exposed via package.json:files or bin entry points.

5. **Suite health** — 289 tests pass (205 unit + 84 integration), 0 fails. Adds 7 new regression tests (4 for DX-15-01, 3 for DX-15-02) over the 282 baseline from Phase 85.

Both auto-fixed deviations documented in summaries are validated:
- **Plan 01 EOL preservation fix** — verified via `git diff --exit-code README.md` returning 0 on Windows after script run.
- **Plan 02 pre-existing manifest drift caught** — exactly the failure mode the plan was designed to prevent; canonical manifest now committed (328 entries, sorted, version-aligned).
- **Plan 02 cross-platform main detection** — Windows path normalization (backslash → forward slash, file:/// triple-slash) verified via successful standalone runs and tests on this Windows checkout.

---

_Verified: 2026-05-09T13:30:00Z_
_Verifier: Claude (verifier)_
