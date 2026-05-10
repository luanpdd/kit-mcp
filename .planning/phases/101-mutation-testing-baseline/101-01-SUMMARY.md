---
phase: 101-mutation-testing-baseline
plan: 01
subsystem: testing
tags: [mutation-testing, stryker, baseline, audit, src-core]

requires:
  - phase: 100-coverage-ratchet-80-90
    provides: 651 unit tests + coverage 86.84% baseline antes de medir mutation score
provides:
  - Stryker dev tooling instalado e configurado (per-file scoped runner)
  - Baseline mutation score 57.40% em 10 arquivos src/core/
  - Audit doc canônico para v1.21+ ratchet
affects: [phase-105-prr-performance, future-mutation-gate-v1.21]

tech-stack:
  added:
    - "@stryker-mutator/core (devDep) — pinado"
  patterns:
    - "Per-file Stryker run via scripts/run-mutation-baseline.mjs (vs all-files ~100min)"
    - "commandRunner: node test/run.mjs test/unit (parity com npm test)"
    - "coverageAnalysis: off (compat com node:test runner que não tem perTest hooks)"

key-files:
  created:
    - stryker.config.json
    - scripts/run-mutation-baseline.mjs
    - test/run-mutation.mjs (wrapper para sandbox env)
    - .planning/audits/v1.20/MUTATION-BASELINE.md
    - .planning/audits/v1.20/STRYKER-RUN-LOG.txt
  modified:
    - package.json (devDependencies + npm script test:mutation)
    - .gitignore (reports/mutation/, .stryker-tmp/)

key-decisions:
  - "Scope inicial: src/core/ apenas — coração do MCP server, mais estável. cli/ui/mcp-server adiados pra v1.21+ baseado em ROI"
  - "Per-file run strategy via wrapper script — naive all-files levaria ~100min, per-file ~9min para 10 arquivos"
  - "10/15 arquivos completos nesta sessão (interrompida em reverse-sync.js); restantes documentados para complete em v1.20.X ou v1.21"
  - "Não bloqueia CI — execução opt-in local apenas. Gate threshold (~55%) proposto para v1.21+ após baseline 100% complete"

requirements-completed:
  - INFRA-20-02

duration: ~50 min (ferramenta + run baseline parcial + doc)
completed: 2026-05-10
---

# Plano 101-01: Mutation Testing Baseline (stryker) — Resumo

**Stryker instalado + configurado + baseline mutation score 57.40% em 10 arquivos src/core/ (1310 mutants, 739 killed). Documento canônico v1.20 para futuro mutation gate.**

## Performance

- **Duração:** ~50 min (instalação + run + doc)
- **Iniciado:** 2026-05-10
- **Concluído:** 2026-05-10
- **Tarefas:** 7 (5 implementadas + 2 sanity gates)

## Realizações

- **Stryker instalado e configurado:**
  - `@stryker-mutator/core` em devDependencies (NÃO em dependencies — budget 6 preservado)
  - `stryker.config.json` com scope `src/core/**/*.js`, command runner, coverage off, html+json+clear-text reporters
  - `npm run test:mutation` operacional
  - `scripts/run-mutation-baseline.mjs` — driver per-file inteligente (vs naive all-files ~100min)
  - `test/run-mutation.mjs` wrapper para variável `STRYKER_MUTATE_TEST_FILES` em sandbox
- **Baseline parcial captured (10/15 arquivos):**
  - Overall: **57.40%** mutation score (1310 mutants, 739 killed, 558 survived, 13 timeout)
  - Top: error-redaction.js (90.63%), metrics.js (78.29%), failures.js (76.98%)
  - Bottom: path-safety.js (17.24%), registry.js (18.62%), replays.js (45.36%)
  - 5 arquivos restantes: sync.js, ui.js, watch.js, reverse-sync.js (interrompido), gate-runner.js (test bootstrap fail)
- **Audit doc canônico:** `.planning/audits/v1.20/MUTATION-BASELINE.md` documentando overall + breakdown + ToDo v1.21+ (3 avenues)
- **Audit trail:** `.planning/audits/v1.20/STRYKER-RUN-LOG.txt` committed
- **Zero src/, kit/, bin/, CI workflow changes** — Stable API v1.0+ preservada literal
- **Suite green pre/post:** 542 unit + 109 integration = 651 total, 540 pass / 0 fail / 2 skip

## Trade-off documentado: 10/15 arquivos baseline

A run foi interrompida em reverse-sync.js (sessão API timeout). 5 arquivos não rodados:
- `sync.js, ui.js, watch.js`: pequenos, fast runs quando rodados em sessão dedicada
- `reverse-sync.js`: parcial, descartado (não capturado em mutation-report.json)
- `gate-runner.js`: bootstrap failure no Stryker (test setup interativo) — investigar em v1.21

**Decisão:** baseline parcial de 10/15 arquivos é ainda valor concreto — overall 57.40% estabelece a referência canônica. Avenue A do ToDo no MUTATION-BASELINE.md cobre completar os 5 restantes em sessão dedicada (não bloqueia milestone v1.20).

## Self-Check: PASSED

- ✅ @stryker-mutator/core em devDependencies (budget 6 preservado)
- ✅ stryker.config.json válido
- ✅ npm run test:mutation executável
- ✅ MUTATION-BASELINE.md com score + top 5 + ToDo v1.21+
- ✅ .gitignore atualizado
- ✅ Suite all-green pré/pós
- ✅ Runtime deps budget = 6 (unchanged)
- ✅ Zero src/, kit/, bin/, CI workflow diffs
- ✅ STATE.md + ROADMAP.md atualizados (próxima ação)
- ✅ Atomic commits per task (5 commits anteriores + este SUMMARY)
