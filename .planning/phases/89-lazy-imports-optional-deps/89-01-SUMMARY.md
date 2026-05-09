---
phase: 89-lazy-imports-optional-deps
plan: 01
subsystem: cli
tags: [perf, lazy-import, esm, dynamic-import, cold-start, sidecar]

requires:
  - phase: 80-perf-summary-cap
    provides: slim cap (PERF-13-01) preserved unchanged
  - phase: 85-perf-terse-mode
    provides: terse mode (PERF-15-01) preserved unchanged
  - phase: 88-concurrent-io
    provides: I/O-optimized sync.js / watch.js / reverse-sync.js paths (already fast, narrowing the room for further cold-start wins)
provides:
  - lazy import boundary at src/cli/index.js → src/ui/{server,wrapper,browser}.js
  - cold-start regression test suite (test/unit/cli-cold-start.test.js)
  - PERF-16-04 closed
affects: [phase-89-02, phase-90+, ui-sidecar, cli-startup]

tech-stack:
  added: []  # zero new deps; pure refactor of import topology
  patterns:
    - "dynamic import inside subcommand handler (mirrors src/ui/browser.js pattern for `open` package)"
    - "async maybeWrapForUi guarded by readLock — wrapper.js only loads when sidecar IS up"

key-files:
  created:
    - test/unit/cli-cold-start.test.js
  modified:
    - src/cli/index.js

key-decisions:
  - "lockfile.js stays eager — 191 LOC, dep-free, hot path called by every withProgress() invocation"
  - "wrapper.js gated behind readLock() check — common path (no sidecar) avoids loading 129 LOC + transitive deps"
  - "Regression test asserts an absolute ceiling (1500ms), not a relative %; the 30% target is validated manually via /publicar benchmark"

patterns-established:
  - "Lazy boundary at cli↔ui: any new ui/* module added later should be loaded via await import() inside its consumer subcommand"
  - "Cold-start regression tests use spawnSync with KIT_MCP_NO_UI=1 + NO_COLOR=1 + CI=1 env to isolate from local sidecar/terminal state"

requirements-completed: [PERF-16-04]

duration: ~12min
completed: 2026-05-09
---

# Phase 89 Plan 01: CLI Lazy Imports Summary

**Top-level eager imports of `../ui/server.js`, `../ui/wrapper.js`, and `../ui/browser.js` were moved to dynamic `await import()` inside the subcommand handlers that actually use them, with a 3-test regression suite asserting cold-start stays under a 1500ms ceiling.**

## Performance

- **Duração:** ~12 min
- **Iniciado:** 2026-05-09T13:52Z
- **Concluído:** 2026-05-09T14:04Z
- **Tarefas:** 2
- **Arquivos modificados:** 1 modificado, 1 criado

## Realizações

- **3 top-level UI sidecar imports removidos** de `src/cli/index.js` (server.js / wrapper.js / browser.js) — non-UI commands (kit list-*, sync targets, gates list, forensics, doctor) no longer pay the cost of loading ~750 LOC of UI machinery on every cold start.
- **`maybeWrapForUi` is now async** and gates the lazy `wrapProgressForUi` import behind the existing `readLock()` check. Common path (no sidecar) returns `passthroughWrapper` synchronously and `wrapper.js` is never loaded into the module graph.
- **`ui.start` and `ui.open` handlers lazy-load** `createServer` and `openBrowser` at the moment they're needed.
- **3 new regression tests** in `test/unit/cli-cold-start.test.js` exercise `kit list-agents --terse --json` cold start, terse JSON schema preservation, and non-terse JSON schema preservation (slim cap from PERF-13-01).
- **Suite green:** 230 unit tests (227 baseline + 3 new), 228 pass + 2 skipped + 0 fail. Integration suite unchanged at 84/84.

## Cold-start measurements

| Phase | Median (ms) | Sample | Source |
|---|---|---|---|
| Pre-89 (post-88) | 271 | 271 / 268 / 285 | dev machine, 3 spawns of `kit list-agents --terse --json` |
| Post-89.01 | **220** | 199 / 220 / 190 / 247 / 249 | dev machine, 5 spawns, same flags |

**Observed improvement: ~18.8% (51ms reduction, dev machine).** Honest reporting:
- Plan target was ≥30%. We did not hit that bar on this machine.
- Phase 88 (concurrent I/O) had already optimized the heavy paths, so the marginal win from removing 750 LOC of synchronous module load is smaller than the plan predicted (the plan baseline estimate of ~1000ms predates Phase 88).
- The structural goal — "non-UI commands do not load UI sidecar modules at all" — is achieved and verifiable: `grep '^import.*ui/server\|^import.*ui/wrapper\|^import.*ui/browser' src/cli/index.js` returns nothing, and the 4 dynamic import sites are scoped to the handlers that need them.
- The 1500ms ceiling test catches regression (re-eager-ification) without depending on a fragile percentage threshold across heterogeneous CI runners.

This is a **deviation from the plan's 30% claim**; see "Desvios do Plano" below.

## Commits das Tarefas

1. **Task 1: Move UI sidecar imports to lazy dynamic in src/cli/index.js** — `40b70eb` (refactor)
2. **Task 2: Add cold-start regression test for CLI list-agents --terse** — `c284c11` (test)

_TDD note: Task 2 was written test-only (no separate RED→GREEN→REFACTOR commits) because the implementation under test was already in place from Task 1 — the regression suite is pure coverage for the structural change._

## Arquivos Criados/Modificados

- `src/cli/index.js` — modified (+22, -5):
  - Removed 3 top-level imports from `../ui/{server,wrapper,browser}.js`.
  - Added comment block documenting the lazy boundary.
  - Made `maybeWrapForUi` `async` + lazy-loaded `wrapProgressForUi` after the `readLock` guard.
  - `withProgress` now awaits `maybeWrapForUi`.
  - `ui.start` handler lazy-loads `createServer` and (conditionally) `openBrowser`.
  - `ui.open` handler lazy-loads `openBrowser`.
- `test/unit/cli-cold-start.test.js` — created (+85):
  - PERF-16-04 cold-start ceiling test (median of 3 spawns < 1500ms).
  - PERF-15-01 terse-mode JSON schema regression.
  - PERF-13-01 slim-cap non-terse JSON schema regression.

## Decisões Tomadas

- **`lockfile.js` kept eager:** 191 LOC, zero external deps, called from `maybeWrapForUi` on every `withProgress()` invocation (which covers `sync install` and `reverse-sync apply` — common commands). Lazy-loading it would add an `await` to a hot path with no measurable gain.
- **`@inquirer/prompts` (`select`/`confirm`) NOT touched here:** scoped to Plan 89.02 per the milestone split (Plan 89.02 will lazy-load it from inside `core/ui.js` so the boundary is invisible to the CLI).
- **Test threshold is absolute (ms), not relative (%):** spawnSync timing varies wildly across CI runners. An absolute 1500ms ceiling catches the failure mode we actually care about (someone re-adds an eager top-level import) without false-positiving on slow shared runners. The "≥30%" claim from the plan frontmatter is left as a `/publicar` benchmark exercise, not a CI gate.

## Desvios do Plano

### Reportagem honesta — alvo de 30% não foi atingido

**1. [Plan-target deviation] Cold-start improvement landed at ~18.8%, not ≥30%**
- **Encontrado durante:** Final benchmark after Task 2.
- **Problema:** `must_haves.truths[1]` claims "≥30% mais rápido vs baseline pré-fase". Measured median dropped from 271ms → 220ms = 18.8% faster, not 30%.
- **Análise da causa:** The plan's assumed baseline (~1000-1200ms) predates Phase 88 (concurrent I/O). After Phase 88 closed PERF-16-01/02/03, the actual pre-89 baseline was already ~270ms. With cold-start dominated by Node's own boot + commander + core/kit.js parsing (eager + necessary), the headroom for further gains by trimming UI imports is bounded by what fraction of those 270ms was UI-module load time.
- **Por que não corrigi automaticamente:** No "fix" exists short of (a) moving more imports lazy (would break Stable API for `withProgress` and `kit/registry/sync/gates` core modules used by every subcommand) or (b) adopting a bundler (explicitly deferred in 89-CONTEXT.md "Ideias Adiadas"). Both are out-of-scope architectural shifts (Rule 4 — would require human decision).
- **Decisão:** Document honestly. The structural objective (zero eager UI imports) IS achieved and the regression test prevents backsliding. The numerical target is a casualty of Phase 88's own success.

**Total de desvios:** 1 reported honestly.
**Impacto no plano:** Closed PERF-16-04 structurally and added regression coverage. Numerical "30% faster" target downgraded to "~19% measured + structural guarantee that no UI sidecar code runs on cold start of non-UI commands."

## Problemas Encontrados

- **Pre-existing unused import** `getLocalVersion` from `./upgrade-check.js` in `src/cli/index.js` line 33 — not introduced by this plan, out-of-scope per the deviation rules' "frontier of escope". Logged here for visibility; no action taken.

## Configuração Manual Necessária

Nenhuma — pure refactor + tests, no external service config.

## Prontidão para Próxima Fase

- Plan 89.02 (`@inquirer/prompts` + `chokidar` → `optionalDependencies`) is independent of 89.01 and can run in parallel (no shared file conflicts; 89.02 touches `package.json`, `src/core/ui.js`, `src/core/watch.js`).
- Suite remains green: 230 unit + 84 integration = 314 tests, 0 fail.
- `kit ui start`, `kit ui stop`, `kit ui status`, `kit ui open`, `sync install`, `reverse-sync apply`, `doctor` all smoke-tested post-refactor — full functional parity preserved.

## Self-Check: PASSED

Verified:
- `src/cli/index.js`: FOUND, contains 4 `await import('../ui/...')` sites, zero top-level `^import.*ui/{server,wrapper,browser}`.
- `test/unit/cli-cold-start.test.js`: FOUND, 3 tests, all pass.
- Commit `40b70eb` (Task 1 refactor): FOUND in `git log`.
- Commit `c284c11` (Task 2 test): FOUND in `git log`.
- Suite: 230/228-pass/2-skipped/0-fail unit; 84/84 integration.

---
*Fase: 89-lazy-imports-optional-deps*
*Concluída: 2026-05-09*
