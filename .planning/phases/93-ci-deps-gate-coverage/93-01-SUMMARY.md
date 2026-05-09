---
phase: 93-ci-deps-gate-coverage
plan: 01
subsystem: infra
tags: [ci, github-actions, deps-budget, coverage, node-experimental-test-coverage]

requires:
  - phase: 92
    provides: "3 deps + 3 optionalDependencies split (open moved to optional, 6/6 budget preserved)"
provides:
  - "ci.yml deps budget gate that sums dependencies + optionalDependencies (closes silent loophole)"
  - "ci.yml line coverage threshold gate (65%) using node --experimental-test-coverage"
  - "9 regression tests in test/integration/ asserting both gates"
  - "Documented coverage baseline = 69.00% with TODO ratchet path to 80%"
affects: [v1.18+, future-phases-touching-runtime-deps, future-phases-touching-test-coverage]

tech-stack:
  added: []  # zero new deps — kit-mcp 6/6 budget preserved (CONTEXT.md mandate)
  patterns:
    - "CI gate text-regex testing: validate workflow YAML semantics via regex on raw .yml file (no YAML parser dep)"
    - "Single-cell matrix gating for target-agnostic CI work: `if: matrix.os == 'ubuntu-latest' && matrix.node == '22' && matrix.target == 'claude-code'`"

key-files:
  created:
    - test/integration/ci-deps-gate.test.js
    - test/integration/ci-coverage-gate.test.js
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Threshold = 65 (not 75 from CONTEXT.md sketch): measured baseline 69.00%, set 4 points below to absorb noise; CONTEXT.md line 60 explicitly authorizes adjustment when baseline < target"
  - "Coverage gated to single matrix cell (Linux+Node22+claude-code) to avoid running 72× across the 3×3×8 smoke matrix; coverage % is target-agnostic"
  - "Tests use text-regex on ci.yml (no YAML parser): `yaml` package would breach the 6-dep budget; same pattern as gates/budget-description.md and existing markdown gate suite"
  - "Parse robust to `ℹ ` info-marker prefix that node:test reporter prepends: `grep '^ℹ all files' | awk -F'|' '{print $2}'`"

patterns-established:
  - "CI workflow regression tests: validate workflow YAML semantics via text-regex on the raw .yml file in test/integration/, isolating the step block before asserting on its bash content"
  - "Coverage threshold ratchet: start at baseline-N (conservative), document TODO with named worst-coverage files, ratchet up phase-by-phase as those files get tests"

requirements-completed: [INFRA-17-01, INFRA-17-02]

duration: 7min 18s
completed: 2026-05-09
---

# Phase 93 Plan 01: CI Deps Gate + Coverage Tooling Summary

**Deps budget gate now sums `dependencies + optionalDependencies` (closes pre-v1.17 loophole that allowed 9 effective deps) and a new line-coverage gate fails CI below 65% via `node --experimental-test-coverage` parsed from the node:test reporter footer.**

## Performance

- **Duração:** 7min 18s
- **Iniciado:** 2026-05-09T15:40:57Z
- **Concluído:** 2026-05-09T15:48:15Z
- **Tarefas:** 3 (1 deps gate + 1 coverage gate + 1 regression tests)
- **Arquivos modificados:** 3 (1 modified + 2 created)

## Realizações

- **INFRA-17-01:** ci.yml deps budget gate now reads BOTH `dependencies` and `optionalDependencies`, sums via `TOTAL=$((DEPS + OPT))`, fails if `TOTAL > 6`. Echo includes breakdown `(deps=N opt=M)` for PR reviewers. Step header tagged with REQ id for grep-ability. Pre-v1.17 the gate counted only `dependencies`, allowing the effective budget to silently grow to `6 + optional` after Phase 92's split.
- **INFRA-17-02:** New ci.yml step runs full unit suite under `node --experimental-test-coverage`, parses the "all files" footer row from the node:test reporter, and fails if line coverage drops below threshold. Gated to a single matrix cell (Linux + Node 22 + claude-code) to avoid 72× duplication across the smoke matrix. Threshold set to 65 (4 points below measured baseline of 69.00%), with documented ratchet plan to 80% in v1.18+ as low-coverage files get tests.
- **9 new regression tests** in test/integration/ — 4 for the deps gate (header tag, reads both keys, sums via TOTAL, current package.json fits), 5 for the coverage gate (header tag, uses --experimental-test-coverage, single-cell gated, parses "all files" + compares LINE_INT, threshold in sane range 50..100). All green on first stable parse-regex iteration.
- **Suite:** unit 250/250 (248 pass + 2 skip + 0 fail) preserved; integration 85 → 94 (+9 new tests); zero regressions.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Tarefa 1: deps budget gate sums deps + optionalDependencies** — `aa51c8d` (feat)
2. **Tarefa 2: coverage threshold gate via node --experimental-test-coverage** — `2f08b31` (feat)
3. **Tarefa 3: regression tests for both gates** — `2609b14` (test)

**Metadados do plano:** *(commit final do SUMMARY ao fim deste passo)*

## Arquivos Criados/Modificados

- `.github/workflows/ci.yml` — (a) deps budget gate rewritten to sum dependencies + optionalDependencies; (b) new "Audit — line coverage threshold" step gated to ubuntu+node22+claude-code with THRESHOLD=65 and robust parser for the node:test reporter format.
- `test/integration/ci-deps-gate.test.js` — 4 regression tests asserting deps gate semantics via text-regex on ci.yml.
- `test/integration/ci-coverage-gate.test.js` — 5 regression tests asserting coverage gate semantics, including step-block isolation helper to keep regex matches scoped to the coverage step.

## Decisões Tomadas

- **Threshold = 65, not 75.** CONTEXT.md sketch suggested 75% but explicitly authorized adjustment when baseline failed it (line 60: *"se fail, ajustar para baseline atual (e.g., 70%) com TODO para subir"*). Local probe measured `all files` line coverage at **69.00%**. Set threshold 4 points below baseline to absorb noise from new files added in v1.18+ work and from Node minor version reporter drift. The TODO ratchet path is documented in the ci.yml step comment with named worst-coverage files (cli/index.js 37%, mcp-server/install.js 19%, ui/auto-spawn.js 31%, core/failures.js 17%) — these are the natural targets for the next 4 ratchets to 70/75/80.
- **Coverage gated to one matrix cell.** Smoke matrix is os(3) × node(3) × target(8) = 72 cells. Coverage % is identical across cells for any deterministic codebase, so running 72× is pure waste. Used the same `if: matrix.target == 'claude-code'` idiom that already gates the unit/integration test steps, plus pin to ubuntu-latest + node 22 to single-shot it.
- **Text-regex tests over YAML parsing.** kit-mcp ships with 6 deps total (3 + 3); adding `yaml` would breach the budget the very gate enforces, AND require a budget bump and ADR. The existing `gates/budget-description.md` markdown gate suite already validates structured content via regex — same pattern reused. Tests assert load-bearing tokens (`Object.keys(...)`, `TOTAL=$((DEPS + OPT))`, `[ "$LINE_INT" -lt "$THRESHOLD" ]`) rather than YAML structure, which is exactly what regression-protects the gate semantics.
- **Step-block isolation in coverage tests.** `extractCoverageStepBlock(yaml)` finds the step header and slices to the next `- name:` boundary so assertions can't accidentally match tokens elsewhere in the workflow. Avoids false positives if some other step coincidentally contains `THRESHOLD=` or `all files` literals later.
- **Parser robust to `ℹ ` info-marker prefix.** node:test reporter prepends `ℹ ` (Unicode info character, U+2139) to every coverage line. Initial naive `awk '{print $5}'` proposed in CONTEXT.md would NOT work on this format because the marker shifts field positions. Switched to `grep "^ℹ all files" | awk -F'|' '{print $2}' | tr -d ' %'` which is whitespace-tolerant and version-resilient.

## Desvios do Plano

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CONTEXT.md threshold (75) failed against measured baseline (69.00)**
- **Encontrado durante:** Tarefa 2 (probing coverage output before adding the gate)
- **Problema:** Locally running `node --experimental-test-coverage --test test/unit/*.test.js` reported `all files` line coverage at 69.00%. Setting threshold to 75 per CONTEXT.md draft would have made the very first CI run fail, blocking the milestone.
- **Correção:** Set THRESHOLD=65 (4-point safety margin below 69 baseline). CONTEXT.md line 60 explicitly authorized this adjustment. Documented the ratchet path in the ci.yml step comment with named target files for v1.18+ ratchets.
- **Arquivos modificados:** .github/workflows/ci.yml
- **Verificação:** Local simulation: `LINE_COV=$(grep "^ℹ all files" coverage.txt | head -1 | awk -F'|' '{print $2}' | tr -d ' %')` → `69.00`, `[ 69 -lt 65 ]` → false → PASS.
- **Comitado em:** `2f08b31` (parte do commit da tarefa 2)

**2. [Rule 1 - Bug] Initial regex assertions in regression tests required quote-immediate-after-bracket but bash uses whitespace separator**
- **Encontrado durante:** Tarefa 3 (running new tests for the first time)
- **Problema:** Wrote `/\["?\$TOTAL"?\s+-gt\s+"?\$BUDGET"?\]/` and analogous for LINE_INT. Bash `[ ... ]` syntax requires whitespace between `[` and operands; my regex required the optional quote to be immediately after `[` (no whitespace). 2 of 9 tests failed.
- **Correção:** Changed to `/\[\s+"?\$TOTAL"?\s+-gt\s+"?\$BUDGET"?\s+\]/` — explicit `\s+` after `[` and before `]`. Both tests now pass.
- **Arquivos modificados:** test/integration/ci-deps-gate.test.js, test/integration/ci-coverage-gate.test.js
- **Verificação:** `node --test test/integration/ci-deps-gate.test.js test/integration/ci-coverage-gate.test.js` → 9/9 pass.
- **Comitado em:** `2609b14` (correção foi parte do mesmo commit antes do push, não regrediu na suíte)

---

**Total de desvios:** 2 corrigidos automaticamente (1× Regra 3 — Blocking, 1× Regra 1 — Bug)
**Impacto no plano:** Ambas correções foram necessárias para correção (não escopo). Threshold ajuste foi explicitamente autorizado pelo CONTEXT.md. Regex bug foi auto-introduzido no mesmo passo da Tarefa 3 e auto-corrigido no mesmo commit (não há "commit ruim" no histórico).

## Problemas Encontrados

**Test isolation flake under `--experimental-test-coverage` (single occurrence, did not reproduce):** During the first dry-run of `node --experimental-test-coverage --test test/unit/*.test.js`, one test failed (`reverse-sync.test.js: applyReverse overwrite — propagates framework edit to canonical`) with a manifest hash mismatch. Reran the full coverage three more times: 0 fails on each. The earlier flake was traced to my own concurrent `npm test` invocations competing for tmp dirs / sample-kit fixture handles on Windows during diagnosis (multiple bash sessions running tests in parallel). CI runs serially in clean Ubuntu containers and the standard suite (`npm test` and `npm run test:integration`) consistently shows 0 fails. **Not a regression introduced by Phase 93.** The PERF-17-01 cache (verifyManifestCache, keyed by kitRoot) was investigated as a possible cause but is innocent — mkdtemp gives unique paths per beforeEach, so cache collisions across tests are impossible.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. As mudanças vivem inteiramente em `.github/workflows/ci.yml` e `test/integration/`. O workflow será executado automaticamente no próximo push para `main` ou abertura de PR.

## Self-Check

Verificações pós-execução:

- `[ -f .github/workflows/ci.yml ]` → **FOUND** (modified)
- `[ -f test/integration/ci-deps-gate.test.js ]` → **FOUND** (created, 4 tests)
- `[ -f test/integration/ci-coverage-gate.test.js ]` → **FOUND** (created, 5 tests)
- `git log --oneline | grep aa51c8d` → **FOUND** (Tarefa 1 commit)
- `git log --oneline | grep 2f08b31` → **FOUND** (Tarefa 2 commit)
- `git log --oneline | grep 2609b14` → **FOUND** (Tarefa 3 commit)
- `npm test` → 250/250 (248 pass + 2 skip + 0 fail), zero regressão
- `npm run test:integration` → 94/94 (85 baseline + 9 novos), zero regressão
- Local simulation of new gates: deps gate prints `Runtime deps: 6 / 6 (deps=3 opt=3)` PASS; coverage gate parses `LINE_COV=69.00`, `LINE_INT=69 ≥ 65` PASS

## Self-Check: PASSED

## Prontidão para Próxima Fase

- **v1.17 milestone is feature-complete.** All 4 phases (90-93) shipped. Next steps: `/auditar-marco v1.17` to audit milestone completion, then `/publicar` to ship as v1.17.0.
- **Coverage ratchet plan documented in ci.yml.** Future phases targeting low-coverage files (cli/index.js, mcp-server/install.js, ui/auto-spawn.js, core/failures.js) should bump the THRESHOLD literal in the same commit they add the tests, so the ratchet is visible in the PR diff.
- **No blockers, no deferred items.** Both REQ INFRA-17-01 and INFRA-17-02 are fully closed.

---
*Phase: 93-ci-deps-gate-coverage*
*Concluída: 2026-05-09*
