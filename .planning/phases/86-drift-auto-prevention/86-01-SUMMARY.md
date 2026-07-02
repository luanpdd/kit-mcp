---
phase: 86-drift-auto-prevention
plan: 01
subsystem: tooling
tags: [readme, drift-prevention, idempotent, esm, node-stdlib]

requires:
  - phase: 81-stable-api
    provides: hardcoded README counters substituted statically (Phase 81.02)
  - phase: 85-token-economy
    provides: 282 baseline suite, kit/COMPATIBILITY.md canonical
provides:
  - scripts/update-readme-counts.js — idempotent ESM regen of AUTOGEN-COUNTS block from real kit/ counts
  - README.md AUTOGEN-COUNTS block — canonical bundled-workflow header (47 agents · 87 commands · 45 skills · 20 gates)
  - 4 regression tests (idempotency, write-on-change, throw-without-block, real-repo no-op)
affects: [phase-86-02-manifest-regen, prepublishOnly, ci-drift-gate, future-kit-additions]

tech-stack:
  added: []
  patterns:
    - ESM script with named export + standalone runner for prepublishOnly composition
    - Line-ending preservation (CRLF/LF detection) to keep idempotency true on Windows checkouts
    - Skills counter excludes _shared-* subdirs (glossaries, no SKILL.md)

key-files:
  created:
    - scripts/update-readme-counts.js
    - test/unit/update-readme-counts.test.js
  modified:
    - README.md

key-decisions:
  - "AUTOGEN block placed above '## What ships in the box' header — stable, prominent location near top"
  - "Pure Node stdlib (fs/promises, path, url) — no glob deps, budget 6/6 honored"
  - "Skills counter walks dirs and probes SKILL.md (skip _shared-* prefix) — matches existing kit/skills/*/SKILL.md glob semantics"
  - "Script preserves existing README EOL convention (detected via includes('\\r\\n')) — required for true idempotency on Windows"
  - "Script throws on missing block markers — fail-fast contract for prepublishOnly callers"
  - "Inline counter mentions in README left as-is — incremental cleanup; AUTOGEN block is canonical going forward"

patterns-established:
  - "Idempotent regen scripts: single in-memory comparison after substitution; touch disk only on actual change"
  - "Standalone+module dual-mode: import.meta.url match for CLI run, named export for programmatic use"
  - "Cross-platform EOL preservation in regen scripts (avoid CRLF/LF churn in mixed checkouts)"

requirements-completed: [DX-15-01]

duration: 5 min
completed: 2026-05-09
---

# Phase 86 Plan 01: README Counters Auto-gen Summary

**Idempotent ESM script regen the AUTOGEN-COUNTS block in README.md from real kit/ disk counts (47 agents · 87 commands · 45 skills · 20 gates), with cross-platform EOL preservation and 4 regression tests guarding against future drift.**

## Performance

- **Duration:** 5 min 3s
- **Started:** 2026-05-09T12:30:43Z
- **Completed:** 2026-05-09T12:35:46Z
- **Tasks:** 3
- **Files created/modified:** 3 (2 new, 1 modified)

## Accomplishments

- Eliminated the v1.13 Phase 81.02 static counter pattern — `<!-- AUTOGEN-COUNTS-START -->...END -->` block in README.md is now the canonical source, regenerated from disk by `scripts/update-readme-counts.js`.
- Drift fixed in the process: README previously claimed "49 skills" — disk reality is 45 (the 4 `_shared-*` subdirs are glossaries, not skills, and have no `SKILL.md`).
- Script is true no-op when counts match (zero bytes written, `git status` clean) — verified across two consecutive standalone runs from a clean checkout.
- 4 regression tests added; full suite expanded 282 → 289 tests (205 unit + 84 integration), 0 fails. Real-repo test specifically guards future drift: any agent/command/skill/gate added without rerunning the script will fail this test first.

## Task Commits

1. **Task 1: Add AUTOGEN-COUNTS block to README.md** — `6ef6848` (feat)
2. **Task 2: Create scripts/update-readme-counts.js (idempotent regen)** — `1c84e07` (feat)
3. **Task 3: Regression tests (idempotency + block presence)** — `dea214d` (test)

## Files Created/Modified

- `scripts/update-readme-counts.js` (NEW, 126 lines) — ESM script reading 4 disk categories and rewriting the AUTOGEN block in README.md. Standalone CLI + programmatic `updateReadmeCounts(repoRoot)` export returning `{ changed, counts }`. Preserves CRLF/LF. Throws if markers absent.
- `test/unit/update-readme-counts.test.js` (NEW, 98 lines) — 4 `node:test` regression tests: writes-on-change, idempotent-no-rewrite, throws-without-block, real-repo no-op (47/87/45/20 disk match).
- `README.md` (MODIFIED, +4 lines) — AUTOGEN-COUNTS block inserted before "## What ships in the box" header. 6 inline counter mentions deliberately left in place for incremental cleanup.

## Decisions Made

- **Block placement above "What ships in the box":** prominent, stable. Future cleanups can reduce inline mentions to point at this canonical line.
- **Pure Node stdlib only:** no `glob`/`fast-glob` dependency. `fs/promises.readdir({withFileTypes:true})` covers all 4 categories. Honors v1.x 6/6 dependency budget.
- **Standalone runner gating:** original spec had `import.meta.url === \`file://${process.argv[1]...}\`` which is unreliable on Windows. Hardened to also accept `argvPath.endsWith('update-readme-counts.js')` — robust across path separators and `file://` URL forms.
- **EOL preservation:** detected the existing line ending in README and wrote the new block with the same. Without this, a Windows checkout (CRLF) would see the script emit an LF block, leaving `git status` dirty even when content semantically matches — breaking the idempotency contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Script left README dirty in `git status` on Windows after no-op**

- **Found during:** Task 2 (initial smoke test after first commit of script)
- **Issue:** First standalone run reported "updated" while `git diff --exit-code` was 0 (clean). Cause: README on Windows had CRLF newlines (Edit tool preserved system convention), but the script's `newBlock` was assembled with `'\n'`. The first run rewrote the block with LF — git's autocrlf normalization made `git diff` clean, but `git status` showed the file as modified (working-tree CRLF/LF mismatch with the index). The "real repo no-op" test (Task 3) would have flickered red on Windows checkouts because of this.
- **Fix:** Added EOL detection — `const eol = before.includes('\r\n') ? '\r\n' : '\n';` — and used it consistently in the assembled block.
- **Files modified:** `scripts/update-readme-counts.js`
- **Verification:** `git checkout README.md && node scripts/update-readme-counts.js && git status --short README.md` produced no output (clean) on first run; second run also no-op.
- **Committed in:** `1c84e07` (folded into the feat commit before push — bug found before the script ever shipped)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — Windows EOL-handling latent in original spec).
**Impact on plan:** None visible to caller; the fix preserves the exact public contract from the plan. The fix is necessary for correctness on Windows checkouts (where the kit-mcp project itself develops), and doesn't change behavior on Linux/macOS CI (LF-only checkouts hit the same `'\n'` path as before).

## Authentication Gates

None — no external services involved.

## Issues Encountered

None — TDD-equivalent flow on a self-contained tool. The Windows EOL bug was caught by the script's own self-verify in Task 2 before Task 3 even started.

## Manual Setup Required

None — pure stdlib script, no external service configuration.

## Self-Check: PASSED

- `[ -f scripts/update-readme-counts.js ]` → FOUND
- `[ -f test/unit/update-readme-counts.test.js ]` → FOUND
- `git log --oneline | grep -E "(6ef6848|1c84e07|dea214d)"` → 3/3 commits present
- `node scripts/update-readme-counts.js` → "no-op — 47 agents, 87 commands, 45 skills, 20 gates"
- `git diff --exit-code README.md` → 0 (clean)
- `node --test test/unit/update-readme-counts.test.js` → 4/4 pass
- `node test/run.mjs test/unit` → 205 tests, 0 fail (203 pass + 2 skipped)
- `node test/run.mjs test/integration` → 84/84 pass

## Next Phase Readiness

- **Plan 86.02 (manifest regen):** can chain `node scripts/update-readme-counts.js` in `prepublishOnly` safely — the script returns exit 0 on no-op and exit 1 on error, ideal for `&&` composition. The throw-on-missing-block contract gives clear failure if Task 1 of this plan is ever reverted.
- **CI drift gate:** ready to install `node scripts/update-readme-counts.js && git diff --exit-code` step in `.github/workflows/ci.yml` smoke job. Will fail PRs that add agents/commands/skills/gates without rerunning the script.
- **Future cleanup (deferred):** the 6 inline counter mentions in README (`├── agents/  47 agents`, `npx kit list-agents  # 47 agents`, etc.) can be replaced by the AUTOGEN canonical line in a v1.16+ pass. Not urgent — they don't drive drift since the AUTOGEN block is now the single source of truth.

---
*Phase: 86-drift-auto-prevention*
*Completed: 2026-05-09*
