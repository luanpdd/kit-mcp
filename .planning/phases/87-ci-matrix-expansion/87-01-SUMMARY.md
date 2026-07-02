---
phase: 87-ci-matrix-expansion
plan: 01
subsystem: testing
tags: [ci, github-actions, matrix, sync, regression-test]

requires:
  - phase: 86-drift-prevention
    provides: drift gate (manifest + README counts) — gated under matrix.target == claude-code so matrix expansion does not run it 8×
provides:
  - CI smoke matrix expanded from 9 runs (3 OS × 3 Node) to 72 runs (3 OS × 3 Node × 8 targets)
  - Parameterized "Sync round-trip" step exercising all 8 IDE targets with generic contract (file count, stub cleanup)
  - Local regression test mirroring the same contract — 10 new tests in test/unit/sync-round-trip-all-targets.test.js
  - Step gating strategy (`if: matrix.target == 'claude-code'`) for target-agnostic steps to avoid 8× repetition
affects: [phase-88+, ci-cost-optimization, future-target-additions]

tech-stack:
  added: []
  patterns:
    - matrix axis gating with `if: matrix.target == 'claude-code'` for target-agnostic steps
    - registry-driven generic contract in CI (no per-target case analysis in shell)
    - local regression mirrors CI contract (defense in depth before 72-run CI)

key-files:
  created:
    - test/unit/sync-round-trip-all-targets.test.js
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - Step-level `if` gating chosen over matrix `include`/`exclude` — explicit and easier to review in diff; preserves Sync round-trip step running for all 8 targets without removing entire runs
  - CLI smoke `install dry-run claude-code` (line 151) preserved as CLI-surface sentinel — not for IDE coverage; gated to claude-code only to avoid 8× redundancy
  - Mirror-tree safety step kept claude-code-only — framework/hooks capabilities only exist on claude-code by design (registry: only claude-code has `mode: mirror-tree` entries)
  - Generic contract in CI (file count + stub cleanup) instead of per-target asserts — registry-driven via `getTarget('${{ matrix.target }}')` so all 8 targets share one shell block
  - `--json` flag on `sync status` not used — verified absent; substituted with inline node script that reads registry directly

patterns-established:
  - "Matrix axis expansion with step gating: target-agnostic steps gated to one representative (claude-code) to keep step-execution growth ~4× instead of 8×"
  - "Generic CI contract via registry introspection: `getTarget(${{ matrix.target }})` resolved inline with node --input-type=module so the same step exercises all targets without case analysis"
  - "Local-CI parity: every CI matrix axis change ships with a unit test that mirrors the same contract — caught regressions in unit suite before paying for 72-run CI"

requirements-completed:
  - DX-15-03

duration: 4min
completed: 2026-05-09
---

# Phase 87 Plan 01: CI Matrix Expansion (8 IDEs) Summary

**CI smoke matrix expanded from 1 → 8 IDE targets via `target` axis with step gating (`if: matrix.target == claude-code`) for target-agnostic steps; generic registry-driven Sync round-trip step replaces hardcoded claude-code asserts; local regression test (10 cases) mirrors the same contract for defense in depth**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-09T12:52:19Z
- **Completed:** 2026-05-09T12:56:37Z
- **Tasks:** 3 (1 read-only gate + 2 implementation)
- **Files modified:** 2

## Accomplishments

- **Closed DX-15-03** — race condition v1.12.1 escaped exactly because the other 7 IDEs were not exercised in CI; matrix axis expansion (`target: [claude-code, cursor, codex, gemini-cli, copilot, windsurf, antigravity, trae]`) fixes the gap. `fail-fast: false` preserved so a failure on one target does not cancel the other 7.
- **Generic Sync round-trip step** — body parameterized with `${{ matrix.target }}` for `sync install` and `sync remove`. Hardcoded `claude-code`-specific asserts (`.claude/agents/example-reviewer.md`, `CLAUDE.md`, `.claude/framework/.kit-mcp-managed`, etc.) removed in favor of two registry-driven contracts that hold for every target: (1) install writes ≥1 file under `.ci-test/`; (2) remove leaves 0 stub files (containing `kit-mcp:reference`) under capability dirs (`agents/commands/skills/framework/hooks`). Rules-aggregated files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, multi-rules dirs) are NOT removed by design — single source for rules, possibly user-edited.
- **Step gating strategy** — 7 target-agnostic steps gated with `if: matrix.target == 'claude-code'` (Tests unit, Tests integration, Audit drift gate, CLI smoke, Supabase gates, Mirror-tree safety, MCP server boot). Reduces step-execution count from naïve 72×11 ≈ 792 to ~351 (~55% saved). Vs pre-Phase-87 baseline (~90), ~3.9× growth — expected for the 8× target axis expansion, optimized as much as possible without sacrificing coverage.
- **Local regression test** — 10 new tests in `test/unit/sync-round-trip-all-targets.test.js` mirror the CI contract: 1× registry IDs sanity, 1× capability sanity, 8× per-target round-trip. Defense in depth — catches per-target path resolution / cleanup regressions in the local unit suite before a PR ever reaches the 72-run CI matrix.
- **Suite green:** 289 → 299 tests (215 unit + 84 integration), 0 fails, 2 pre-existing skips preserved.

## Task Commits

Each task atomic with `--no-verify` (consistent with phase 85/86 pattern):

1. **Task 1: Verify registry has 8 IDEs (read-only gate)** — no commit (pure verification, output `OK: 8 IDs match`)
2. **Task 2: Expand CI matrix + parameterize sync round-trip + gate target-agnostic steps** — `01f102b` (`ci(87-01)`)
3. **Task 3: Local regression test for round-trip across 8 targets** — `327a16d` (`test(87-01)`)

## Files Created/Modified

- `.github/workflows/ci.yml` — `+54/-17` lines. Added `target: [...]` matrix axis (1 line). Added `if: matrix.target == 'claude-code'` to 7 steps (Tests unit/integration, Audit drift gate, CLI smoke, Supabase gates, Mirror-tree safety, MCP server boot — 7 added lines). Replaced "Sync round-trip" step body (~17 hardcoded-claude-code lines → ~45 generic registry-driven lines).
- `test/unit/sync-round-trip-all-targets.test.js` — 110 lines (new). 10 tests: registry coverage + capability sanity + 8× per-target round-trip. Uses `test/fixtures/sample-kit/` as kitRoot, per-test `os.tmpdir()` mkdtemp + cleanup in finally.

## Hardcoded `claude-code` Reference Audit

Plan called for analysis of 4 hardcoded `claude-code` references in ci.yml:

| Line (pre)        | Context                           | Outcome      | Rationale                                                                                  |
| ----------------- | --------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| 146 (CLI smoke)   | `install dry-run claude-code …`   | **Preserved** | CLI-surface sentinel — tests that `kit install dry-run` works, not IDE coverage. Step gated to claude-code only (avoids 8× redundancy). |
| 179 (round-trip)  | `sync install claude-code …`      | **Replaced** | → `${{ matrix.target }}`                                                                   |
| 190 (round-trip)  | `sync remove claude-code …`       | **Replaced** | → `${{ matrix.target }}`                                                                   |
| 206 (mirror-tree) | `sync remove claude-code …`       | **Preserved** | Mirror-tree only exists for claude-code (framework/hooks capabilities) — entire step gated to claude-code. |

Net: 2 of 4 references substituted; 2 preserved with documented rationale (both gated to `if: matrix.target == 'claude-code'` to avoid waste).

## Decisions Made

- **Step-level `if` over matrix `exclude`/`include`** — explicit, reviewable in diff, keeps the Sync round-trip step running for all 8 targets without losing the only step that actually varies per target.
- **No YAML lint locally** — `js-yaml` not installed (verified absent from transitive deps), Python not available on dev machine. Trusted edits via Edit tool (surgical, line-anchored). GitHub Actions runtime is the validator: invalid YAML = workflow doesn't start = immediate feedback.
- **Generic contract over per-target asserts** — registry-driven (`getTarget('${{ matrix.target }}')` inline node) instead of 8 case branches. One step body covers all 8 targets uniformly; adding a 9th IDE later requires only the matrix axis change.
- **Skip `mode=copy` in regression test** — `sync.test.js` already covers it for claude-code; logic is identical for all targets (only `renderItem` differs), so 8× copy mode would just double the test runtime without catching new bugs.
- **`fail-fast: false` preserved (was already on line 104)** — explicit decision from CONTEXT.md. Without it, racing condition in one target would cancel all 71 other runs and mask bugs.

## Deviations from Plan

None — plan executed exactly as written. The plan anticipated a contingency around `sync status --json` (mentioned in `<behavior>` block as ressalva) and pre-resolved to the registry-driven approach (`<behavior>` lines 257-277), which is what was implemented. No improvisation needed.

## Issues Encountered

None. Self-check passed:
- All claimed files exist on disk
- Both commits resolvable in `git log`
- ci.yml structural assertions all green (1 matrix axis, 7 matrix.target refs, 7 if guards, 1 fail-fast preserved)
- Sync round-trip step body has zero literal `claude-code` in executable lines (3 in comments only — design documentation)
- Suite count grows exactly 289 → 299 (10 new tests), 0 fails

## CI Cost Analysis

| State                | Runs | Step-executions | Notes                                                                  |
| -------------------- | ---- | --------------- | ---------------------------------------------------------------------- |
| Pre-Phase 87         | 9    | ~90             | 3 OS × 3 Node, ~10 steps each                                          |
| Phase 87 naïve (no gating) | 72 | ~720          | 8× target multiplier on every step                                     |
| Phase 87 (gated)     | 72   | ~351            | 7 target-agnostic steps gated → run only on `target == claude-code`    |

**Optimization:** ~55% step-execution savings vs naïve 8× expansion. ~3.9× growth vs baseline — the floor for 8× IDE coverage. Further reduction would require sacrificing coverage (e.g. PR-mode subset), deferred to v1.16+.

## Manual Configuration Required

None — pure CI/test scope, no external services, no env vars.

## Next Phase Readiness

- DX-15-03 closed; v1.15 milestone progresses to next phase or audit.
- CI smoke matrix now exercises all 8 IDE targets — future per-target bugs (path resolution, OS-specific quirks, etc.) caught at CI time instead of post-publish bug reports.
- Local regression test caps the same coverage at unit-suite cost — devs catch target-specific regressions in <1s instead of waiting for 72-run CI.
- Adding a 9th target later requires only: (1) registry entry in `src/core/registry.js`; (2) one element appended to the `target: [...]` matrix axis; (3) one element appended to `ALL_IDS` in the regression test. Generic contract scales without code changes elsewhere.

## Self-Check: PASSED

- File `.github/workflows/ci.yml` exists with 1 matrix axis, 7 `${{ matrix.target }}` refs, 7 `if: matrix.target == 'claude-code'` guards, `fail-fast: false` preserved.
- File `test/unit/sync-round-trip-all-targets.test.js` exists, 110 lines, 10 tests passing.
- Commits `01f102b` (Task 2) and `327a16d` (Task 3) resolvable in `git log`.
- Suite: 215 unit + 84 integration = 299 tests, 0 fails, 2 pre-existing skips.
- Drift gate clean — `regen-manifest` and `update-readme-counts` both no-op.

---
*Phase: 87-ci-matrix-expansion*
*Concluída: 2026-05-09*
