---
phase: 92-quick-wins-polish
plan: 01
subsystem: dx
tags: [dependencies, regen-manifest, jsdoc, dead-imports, sha256, parallel]

# Grafo de dependências
requires:
  - phase: 89-cli-lazy-imports
    provides: lazy `await import('open')` in src/ui/browser.js (graceful fallback already wired)
  - phase: 88
    provides: BATCH_SIZE=16 Promise.all sweet spot (sync.js)
  - phase: 90-verify-manifest-parallel-cache
    provides: BATCH_SIZE=16 + JSDoc style baseline (manifest-verify.js)
provides:
  - open package as optionalDependency (3 deps + 3 opt = budget 6 preserved)
  - regen-manifest.js parallel hashing (~37% speedup, 86ms → 54ms on 328 real files)
  - clean src/cli/index.js imports (no dead getLocalVersion)
  - validateProjectRoot JSDoc with @param + @returns
affects: v1.17 release tarball, prepublishOnly hot path, future dep audits

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - Parallel hashing in batches=16 (matches sync.js + manifest-verify.js)
    - Static text-regex tests as zero-config replacement for eslint rules
    - JSDoc with discriminated-union @returns typing

key-files:
  created:
    - test/unit/dead-imports.test.js
    - test/unit/jsdoc-coverage.test.js
  modified:
    - package.json
    - scripts/regen-manifest.js
    - src/cli/index.js
    - src/core/path-safety.js
    - test/unit/optional-deps.test.js
    - test/unit/regen-manifest.test.js

key-decisions:
  - "POL-17-01: keep `open` as optionalDependency rather than dropping it — graceful fallback in browser.js already produces useful UX (URL printed on stderr)"
  - "POL-17-02: hardcode BATCH_SIZE=16 in regen-manifest.js (no env override) — same rationale as Phase 90.01: prepublish hot path is single-shot, not user-latency"
  - "POL-17-03: keep getLocalVersion exported from upgrade-check.js — only the unused import in src/cli/index.js was dead, the function itself still has callers (checkUpgrade + upgrade-check.test.js)"
  - "POL-17-04: separate dead-imports.test.js and jsdoc-coverage.test.js — different concerns, different failure-mode triage"
  - "Static text-regex tests over eslint plugin: kit-mcp's zero-build/zero-config policy preserved; CI catches regressions equivalently"

patterns-established:
  - "Sequential batches of Promise.all preserve deterministic ordering when target list is sorted upfront (regen-manifest.js + manifest-verify.js)"
  - "Optional-dep loaders return discriminated unions (`{opened:false, reason:'no_module'}`) — callers degrade gracefully without try/catch"
  - "JSDoc on exports: 1-line description + validation chain prose + @param + @returns with discriminated-union types where applicable"

requirements-completed: [POL-17-01, POL-17-02, POL-17-03, POL-17-04]

# Métricas
duration: 7min
completed: 2026-05-09
---

# Phase 92 Plan 01: Quick Wins Polish Summary

**Four-item polish sweep: `open` moved to optionalDependencies, regen-manifest.js parallelized (~37% faster), dead `getLocalVersion` import removed from src/cli/index.js, and validateProjectRoot in path-safety.js gained @param/@returns JSDoc.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-09T15:29:10Z
- **Completed:** 2026-05-09T15:36:24Z
- **Tasks:** 4 (POL-17-01..04, executed atomically)
- **Files modified:** 6 (4 prod, 2 test) + 2 test files created
- **Tests:** 248/250 unit (2 pre-existing skips), 85/85 integration — zero regressions

## Realizações

- **POL-17-01:** Tarball -68KB / cold-start -36ms when downstream uses `npm install --omit=optional`. Graceful fallback already in place (Phase 89 `await import('open')` lazy + try/catch); only the test contract needed updating to reflect the new 3+3 layout.
- **POL-17-02:** prepublishOnly script -32ms median on 328 real kit files (86ms sequential → 54ms parallel ~37% speedup). Output is byte-identical — sorted targets[] + key-indexed assignment defeat any completion-order leak.
- **POL-17-03:** Repo lint-clean for the dead `getLocalVersion` import that Plan 89.01 introduced but never wired up. Three static guards now block re-introduction.
- **POL-17-04:** validateProjectRoot now has a 28-line JSDoc covering origin (SEC-14-03), validation chain, public-contract sentinel, and discriminated-union return shape. Symmetric coverage with error-redaction.js (Phase 84) and manifest-verify.js (Phase 90).

## Commits das Tarefas

Each item committed atomically:

1. **POL-17-01: `open` to optionalDependencies** — `37dc148` (feat)
2. **POL-17-02: parallelize regen-manifest.js hashing** — `6dfd8ec` (perf)
3. **POL-17-03: remove dead getLocalVersion import** — `83ab50a` (chore)
4. **POL-17-04: JSDoc on validateProjectRoot** — `fada87a` (docs)

## Arquivos Criados/Modificados

**Created:**
- `test/unit/dead-imports.test.js` — 3 static guards (no import line, no textual reference, upstream export intact) for POL-17-03.
- `test/unit/jsdoc-coverage.test.js` — Parses `/** ... */` blocks attached to exports; pins @param+@returns presence on validateProjectRoot AND on error-redaction.js exports (regression baseline).

**Modified:**
- `package.json` — Move `open` from dependencies to optionalDependencies. Layout: 3 deps + 3 opt = 6 total (invariant preserved).
- `scripts/regen-manifest.js` — Replace sequential `await sha256(...)` loop with BATCH_SIZE=16 Promise.all batches. Determinism: sorted targets[] + key-indexed assignment.
- `src/cli/index.js` — Remove `getLocalVersion` from named import (was unused since Plan 89.01).
- `src/core/path-safety.js` — Add 28-line JSDoc above validateProjectRoot covering @param shape and discriminated `{ok, ...}` return.
- `test/unit/optional-deps.test.js` — Update budget assertions to 3+3, add POL-17-01 test for openBrowser graceful fallback (`{opened:false, reason:'no_module'}`).
- `test/unit/regen-manifest.test.js` — Add POL-17-02 test: 50-file fixture spanning 4 batch windows, asserts deterministic key order + idempotent byte-identical reruns.

## Decisões Tomadas

- **POL-17-01 — keep `open` optional, don't drop it.** The fallback in `openBrowser()` (Phase 89) already produces a useful UX path: URL printed on stderr, the user copy-pastes. Removing the dep entirely would lose the auto-launch UX for users who DO have `open` installed. Optional is the right knob.
- **POL-17-02 — hardcode BATCH_SIZE=16.** Same rationale as Phase 90.01 manifest-verify.js: this is a prepublish hot path, single-shot, not in any user-latency budget. Env override would be overengineering. Sweet spot from Phase 88.01 (sync.js) holds here too.
- **POL-17-03 — only remove the import, keep the export.** `getLocalVersion` is still used internally by `checkUpgrade()` in upgrade-check.js, and directly by upgrade-check.test.js. Plan 89.01 introduced the dead CLI import but never the dead export. Surgical fix.
- **POL-17-04 — separate test file rather than extend dead-imports.test.js.** Different concerns (undocumented exports vs accidentally-imported names), different failure modes, different growth trajectories. Future POL items will likely add more docs-coverage assertions; jsdoc-coverage.test.js is the natural seam.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. CONTEXT.md was unambiguous and the four POL items were independent: no cross-item conflicts surfaced, no rule-1 bugs needed inline correction, no rule-3 environmental fixes required.

The closest thing to a deviation was that `package.json` started at `4 deps + 2 opt` (current state), not `3 deps + 3 opt` as the budget invariant implied. CONTEXT.md `<decisions>` correctly described the post-Phase-92 layout (3+3) — POL-17-01 is exactly the work to flip from 4+2 to 3+3. So this was on-plan, not a deviation.

## Problemas Encontrados

Nenhum — no test failures, no lint issues, no resolved bugs encountered. Smoke tests (`node bin/cli.js --version` and `kit list-agents --terse`) both passed at every step.

## Configuração Manual Necessária

Nenhuma — todas as mudanças são de superfície interna (package.json, scripts/, src/, test/). Nenhuma variable ambiente nova, nenhum dashboard external, nenhuma migração.

## Prontidão para Próxima Fase

- v1.17 milestone now has Phase 90 + 91 + 92 completed (3/4 plans done; Phase 93 = CI deps gate + coverage tooling pending).
- Test baseline: 248 unit pass + 85 integration pass = 333/335 (2 pre-existent skips). +9 new tests vs Phase 91 baseline (241 unit pass).
- Tarball reduction (-68KB) + prepublishOnly speedup (-32ms) compound on top of Phase 90/91 wins.
- Recommend next: `/executar-fase 93` for CI deps gate + coverage tooling, then `/concluir-marco` to ship v1.17.0.

## Self-Check

Verificação automática dos arquivos e commits afirmados:

- `test/unit/dead-imports.test.js` — FOUND
- `test/unit/jsdoc-coverage.test.js` — FOUND
- `package.json` modified — FOUND (3 deps + 3 opt)
- `scripts/regen-manifest.js` modified — FOUND (BATCH_SIZE + Promise.all)
- `src/cli/index.js` modified — FOUND (getLocalVersion removed)
- `src/core/path-safety.js` modified — FOUND (JSDoc added)
- Commits `37dc148`, `6dfd8ec`, `83ab50a`, `fada87a` — all FOUND in `git log --oneline`

## Self-Check: PASSED

---
*Fase: 92-quick-wins-polish*
*Concluída: 2026-05-09*
