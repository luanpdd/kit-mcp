---
phase: 86-drift-auto-prevention
plan: 02
subsystem: tooling
tags: [manifest, sha256, prepublishOnly, ci, drift-prevention, idempotency]

requires:
  - phase: 83-core-filesystem-hardening
    provides: src/core/manifest-verify.js (consumer contract for {version, timestamp, files})
provides:
  - scripts/regen-manifest.js (idempotent SHA256 manifest regen)
  - kit/file-manifest.json regenerated (327 → 328 entries, version aligned 1.13.0 → 1.14.0)
  - prepublishOnly hook chains regen-manifest + update-readme-counts before tests
  - CI smoke-job drift gate (fails PR if regen scripts produce uncommitted diff)
  - 3 regression tests guarding schema + idempotency + change detection
affects: [v1.15-publish, future-phases-touching-kit, ci-smoke-job]

tech-stack:
  added: []
  patterns:
    - "Idempotent regen: preserve prior timestamp + skip write when content unchanged"
    - "Drift gate: regen + git diff --exit-code on canonical files"
    - "Cross-platform script main detection (Windows backslash normalization)"

key-files:
  created:
    - scripts/regen-manifest.js
    - test/unit/regen-manifest.test.js
  modified:
    - kit/file-manifest.json (regenerated; version 1.13.0 → 1.14.0; +4 missing entries; sort fixed)
    - package.json (prepublishOnly chain)
    - .github/workflows/ci.yml (smoke job drift gate step)

key-decisions:
  - "manifest.version mirrors package.json.version automatically (was pinned 1.13.0 manually); justification: manifest is the kit content digest at a published version, pinning to package.json keeps semantics aligned. Phase 85.02 noted version preservation as a quirk; this plan formalizes the link."
  - "Idempotency wrinkle solved by parsing prior manifest, comparing {version, files} (excluding timestamp), and only writing fresh ISO-8601 timestamp when content actually changed. Same-content reruns produce byte-identical output (zero git diff)."
  - "Default JS String sort puts uppercase keys (COMANDOS.md, COMPATIBILITY.md, README.md) before lowercase (agents/, commands/) — this matches verifyManifest contract (which doesn't care about order) but happens to differ from the prior hand-curated order. Regen produces canonical sort going forward."

patterns-established:
  - "Regen script standalone exit 1 → prepublishOnly aborts release on bad regen"
  - "CI drift gate: scripts run + git diff --exit-code on specific files; specific paths avoid false flags from unrelated working-tree changes"
  - "Cross-platform main detection: argv URL normalized to file:/// + backslash → forward-slash for Windows compatibility"

requirements-completed: [DX-15-02]

duration: 4m 15s
completed: 2026-05-09
---

# Phase 86 Plan 02: Manifest Auto-Regen Summary

**Idempotent SHA256 manifest regenerator script + prepublishOnly chain + CI drift gate that fails any PR shipping a stale `kit/file-manifest.json`, formally fixing recurring drift seen in v1.13/v1.14/v1.15.85.**

## Performance

- **Duration:** 4m 15s
- **Started:** 2026-05-09T12:30:56Z
- **Completed:** 2026-05-09T12:35:11Z
- **Tasks:** 3 (TDD: RED + GREEN + REFACTOR — no refactor needed)
- **Files modified:** 5 (2 created, 3 edited)

## Accomplishments

- `scripts/regen-manifest.js` (~100 lines, ESM, pure stdlib) — walks `kit/**` excluding `file-manifest.json`, SHA256-hashes each file, writes sorted `{version, timestamp, files}` JSON. Idempotent: when content unchanged, preserves prior timestamp AND skips write entirely if bytes match.
- `kit/file-manifest.json` regenerated cleanly: version aligned to package.json (1.14.0), 4 previously missing entries captured (`COMPATIBILITY.md`, `framework/templates/{DEBUG,UAT,UI-SPEC,VALIDATION}.md`), sort order normalized.
- `package.json:prepublishOnly` now: `regen-manifest && update-readme-counts && unit && integration`. Either regen failing aborts publish.
- `.github/workflows/ci.yml` smoke job: new "Audit — drift gate" step between Tests (integration) and CLI smoke. Runs both regen scripts then `git diff --exit-code kit/file-manifest.json README.md` — fails CI hard if a PR forgot to run prepublishOnly locally.
- 3 regression tests in `test/unit/regen-manifest.test.js`: schema + verifier round-trip; idempotency (byte-identical reruns); content change detection (hash + timestamp updated).
- Phase 83 `verifyManifest` contract preserved end-to-end — round-trip test inside fixture suite locks the consumer interface.

## Task Commits

Each task committed atomically (`--no-verify`, per orchestrator instruction):

1. **Task 1 — RED: failing tests for regen-manifest** — `6ae1b36` (test)
2. **Task 1+2 — GREEN: regen-manifest.js + manifest regen** — `0161e00` (feat)
   - Combined because Task 2 was the test file already created in RED step; GREEN here makes both pass.
3. **Task 3 — prepublishOnly + CI drift gate** — `71c4088` (feat)

## Files Created/Modified

- `scripts/regen-manifest.js` — new, idempotent SHA256 regen of kit manifest
- `test/unit/regen-manifest.test.js` — new, 3 regression tests
- `kit/file-manifest.json` — regenerated (1.13.0 → 1.14.0 version, +4 entries, canonical sort)
- `package.json` — prepublishOnly chain extended with both regen scripts
- `.github/workflows/ci.yml` — drift gate step added to smoke job

## Decisions Made

- **manifest.version tracks package.json.version automatically.** Plan 85.02 SUMMARY noted "version 1.13.0 preservada" as a quirk — manual pinning. This plan formalizes the link: manifest IS the kit content digest at a published version, pinning to package.json keeps semantics aligned. Schema-compatible (verifyManifest reads only `.files`); future schema bump requires explicit test update.
- **Idempotency via prior-state comparison.** Naive timestamping makes every run a diff, defeating the CI gate. Solution: parse prior manifest, compare `{version, files}` (excluding timestamp); if equal, preserve old timestamp AND skip write if bytes already match. Same-content reruns produce zero diff — this is what unlocks the CI drift gate.
- **Default JS sort, not hand-curated order.** The prior manifest had quirky placement (`COMANDOS.md` between `agents/` and `commands/`). My script uses `keys.sort()` — JS String default — which puts uppercase keys ahead of lowercase. verifyManifest doesn't care about order (iterates the object), so this is non-breaking. New canonical order locked in via regression test (`assert.deepEqual(keys, [...keys].sort())`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing manifest had drift before this plan ran**
- **Found during:** Task 1 (running regen script standalone for the first time)
- **Issue:** The committed `kit/file-manifest.json` (from Phase 85.02) was already drifting:
  - Sort order broken: `COMANDOS.md` was between `agents/...` and `commands/...` rather than alphabetical-default-first.
  - Missing 4 entries: `COMPATIBILITY.md` (added Phase 85.02 but not in manifest!), `framework/templates/{DEBUG,UAT,UI-SPEC,VALIDATION}.md`.
  - `framework/VERSION` was misplaced under `framework/V*` instead of canonical sort position.
  - `README.md` was at end instead of correctly sorted with uppercase keys.
- **Fix:** Regen script produces canonical sort + complete file walk on first run; replaces drifted manifest in the same commit as the script itself. Confirms verifyManifest still accepts (Phase 83 contract held — verifier never depended on sort order).
- **Files modified:** `kit/file-manifest.json` (327 entries with errors → 328 canonical entries)
- **Verification:** `verifyManifest('./kit')` returns `{ok: true}` post-regen; second standalone run is byte-identical no-op.
- **Committed in:** `0161e00`

This is exactly the failure mode DX-15-02 was meant to catch — and it caught itself on first run. The drift would have remained latent until v1.14 publish (where Phase 83 verifyManifest gate would have blocked any user installing).

**2. [Rule 3 - Blocker] Cross-platform main-script detection on Windows**
- **Found during:** Task 1 (writing the standalone runner block)
- **Issue:** PLAN's example `import.meta.url === 'file://${process.argv[1]}...'` mishandles Windows paths — `process.argv[1]` uses backslashes (e.g. `D:\projetos\opensource\mcp\scripts\regen-manifest.js`) but `import.meta.url` uses forward slashes with `file:///` triple-slash prefix. Plan code only normalizes once.
- **Fix:** Build `argvUrl` from `process.argv[1]` with `.replace(/\\/g, '/')` and `file:///` triple-slash prefix; check both that variant and direct `__filename` comparison. Robust on Windows + POSIX.
- **Files modified:** `scripts/regen-manifest.js` (lines 110-116, isMain detection block)
- **Verification:** `node scripts/regen-manifest.js` on Windows runs the script (stderr output observed). Tests pass on Windows runner.
- **Committed in:** `0161e00`

---

**Total deviations:** 2 auto-fixed (1 Bug, 1 Blocker)
**Plan impact:** Both fixes mandatory for correctness. The pre-existing manifest drift (Deviation 1) is precisely the recurring problem this plan was designed to prevent — its discovery validates the plan's premise. The Windows path normalization (Deviation 2) was a portability gap in PLAN's pseudocode that would have failed on the matrix's `windows-latest` runner. Neither expanded scope.

## Issues Encountered

- **Transient flake during prepublishOnly first run:** Two `ui-port` tests reported `EADDRINUSE` on ports 50100/50200 (sockets from a prior test process lingered briefly on Windows). Re-running prepublishOnly produced full green (197 unit pass + 2 skipped + 84 integration). Confirmed flaky-not-broken by running `node --test test/unit/ui-port.test.js` in isolation: 6/6 pass. Out-of-scope per deviation rules (preexisting flake unrelated to changes); no fix attempted.

## Required Manual Setup

None — pure tooling/CI changes. Next `npm publish` will use the new prepublishOnly chain automatically.

## Next Phase Readiness

- v1.15 publish path is now drift-proof: any PR that touches `kit/` without rerunning `npm run prepublishOnly` (which auto-regens both manifest + README counts) will fail the CI smoke matrix on the drift-gate step before reaching the publish workflow.
- Phase 86 Plan 01 (DX-15-01 README counters auto-gen) ran in parallel; its `update-readme-counts.js` is now wired into the same prepublishOnly chain (single chain handles both regens).
- Phase 86 effectively closes both v1.13/v1.14/v1.15 drift sources structurally — future phases that add agents/commands/skills/gates can edit `kit/` freely; the prepublishOnly hook + CI gate keep manifest + README in lockstep automatically.

## Self-Check: PASSED

Verified files exist:
- FOUND: `scripts/regen-manifest.js`
- FOUND: `test/unit/regen-manifest.test.js`
- FOUND: `kit/file-manifest.json` (328 entries, version 1.14.0, verifyManifest OK)
- FOUND: `package.json` prepublishOnly contains `regen-manifest` + `update-readme-counts` + tests in correct order
- FOUND: `.github/workflows/ci.yml` "Audit — drift gate" step with `git diff --exit-code kit/file-manifest.json README.md`

Verified commits exist:
- FOUND: `6ae1b36` (test RED)
- FOUND: `0161e00` (feat GREEN — script + regen)
- FOUND: `71c4088` (feat — prepublishOnly + CI gate)

End-to-end smoke:
- `node scripts/regen-manifest.js` second run is no-op; `git diff --exit-code` clean
- `verifyManifest('./kit')` returns `{ok: true}`
- 3 new tests pass (regen-manifest.test.js)
- Full prepublishOnly chain green (197 unit + 84 integration)

---
*Fase: 86-drift-auto-prevention*
*Concluída: 2026-05-09*
