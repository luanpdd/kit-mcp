---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 03
subsystem: testing
tags: [agent-frontmatter, token-economy, perf-13-02, anti-regression, yaml]

requires:
  - phase: meta-audit
    provides: PERF-13-02 quick win flagged by performance audit (T4)
provides:
  - 11 agent frontmatters cleaned of dead `# hooks:` example block
  - Anti-regression test guarding against reintroduction
  - ~880 tokens recoverable across multi-agent sessions
affects: [token-economy, agent-context-cost, future-frontmatter-changes]

tech-stack:
  added: []
  patterns:
    - "Frontmatter hygiene: dead example blocks must not live as comments — add anti-regression test or delete"
    - "Static-pattern banlist tests: scan kit/agents/ for forbidden YAML and assert empty offender list"

key-files:
  created:
    - test/unit/agents-frontmatter-clean.test.js
  modified:
    - kit/agents/planner.md
    - kit/agents/debugger.md
    - kit/agents/verifier.md
    - kit/agents/codebase-mapper.md
    - kit/agents/executor.md
    - kit/agents/project-researcher.md
    - kit/agents/ui-researcher.md
    - kit/agents/ui-auditor.md
    - kit/agents/roadmapper.md
    - kit/agents/research-synthesizer.md
    - kit/agents/phase-researcher.md

key-decisions:
  - "Treated the 6-line block as pure comment removal — every line started with `#`, never activated, no functional risk"
  - "Anchored regression test on `^# hooks:\\s*$` sentinel + literal eslint command — two independent guards prevent accidental reintroduction even if reformatted"
  - "Pinned >=30 agents floor in test so a future deletion of agents/ directory doesn't silently pass with zero offenders"

patterns-established:
  - "Frontmatter banlist test pattern: extract YAML between `^---` delimiters, regex against forbidden patterns, assert offender array empty with file basenames"
  - "Two-guard banlist: sentinel pattern (`^# hooks:`) + content pattern (eslint command) — catches reformatting attempts"

requirements-completed:
  - PERF-13-02

duration: 4min
completed: 2026-05-09
---

# Phase 80 Plan 03: Dedup Hooks Block Summary

**Removed 66 lines of dead `# hooks:` example block from 11 agent frontmatters and added a 3-test anti-regression guard, recovering ~880 tokens per multi-agent session.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-09T04:56:55Z
- **Completed:** 2026-05-09T05:00:48Z
- **Tasks:** 2
- **Files modified:** 12 (11 agents + 1 new test)

## Accomplishments

- Stripped identical 6-line `# hooks:` block from 11 target agents (66 lines deleted)
- Frontmatter YAML stays valid in every agent (`name`, `description`, `tools`, `color` preserved + delimiters intact)
- Anti-regression test (`agents-frontmatter-clean.test.js`) with 3 guards locked in place; future PRs that reintroduce the block will fail CI
- Zero regression: 133/133 unit + 71/71 integration tests green; kit packaging unchanged

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Tarefa 1: Strip `# hooks:` block from 11 agents** — `6c0c3eb` (chore)
2. **Tarefa 2: Anti-regression test (3 cases)** — `0847a49` (test)

## Arquivos Criados/Modificados

### Criado

- `test/unit/agents-frontmatter-clean.test.js` — PERF-13-02 anti-regression: 3 static guards (banned `^# hooks:` sentinel + banned eslint command + frontmatter delimiter sanity check)

### Modificado (66 lines removed across all 11)

- `kit/agents/planner.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/debugger.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/verifier.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/codebase-mapper.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/executor.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/project-researcher.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/ui-researcher.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/ui-auditor.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/roadmapper.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/research-synthesizer.md` — frontmatter sem bloco `# hooks:` morto (-6)
- `kit/agents/phase-researcher.md` — frontmatter sem bloco `# hooks:` morto (-6)

**Diff total:** −66 linhas (11 × 6) + 86 linhas de test = +20 net mas com guard anti-regression para o futuro.

## Verification Output

### Anti-regression test (3 cases passing)

```
✔ PERF-13-02: no agent has dead `# hooks:` block in frontmatter (31.8ms)
✔ PERF-13-02: no agent has banned eslint --fix command in frontmatter (18.5ms)
✔ PERF-13-02: every agent still has valid frontmatter (--- delimiters intact) (20.9ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

### Static greps (acceptance criteria)

```
$ grep -l "^# hooks:" kit/agents/*.md | wc -l
0

$ grep -l "npx eslint --fix \$FILE" kit/agents/*.md | wc -l
0
```

### Full unit suite

```
ℹ tests 133
ℹ pass 133
ℹ fail 0
```

(Predicted by plan: 120 baseline + 7 P80.02 + 3 P80.01 + 3 P80.03 = 133.) ✓

### Integration suite

```
ℹ tests 71
ℹ pass 71
ℹ fail 0
```

### Packaging smoke

`npm pack --dry-run` continues to enumerate `kit/agents/*.md` correctly — kit listing unaffected by frontmatter trim.

## Decisões Tomadas

- **Pure-comment treatment:** Every line of the block started with `#`, so removal cannot break runtime behavior. No need to check whether any agent had hooks active being removed by mistake — there were none.
- **Two-guard regression test:** A single `^# hooks:` regex would catch obvious reintroductions but miss reformatted variants (e.g. `#hooks:` or indented). Adding a second guard on the literal `npx eslint --fix $FILE` command catches the canonical body even if someone edits the header line. Combined with delimiter sanity check (3rd test), this raises the cost of "accidentally reintroduce" to "intentionally bypass three independent checks".
- **Floor of 30 agents:** Pinning `agentFiles.length >= 30` prevents the test from silently passing if `kit/agents/` is ever emptied. With 30+ agents in the kit, this is comfortable headroom that won't trip on legitimate adds/removes.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Pattern matched identically across all 11 files; Edit tool's exact-match invariant gave atomic correctness without bash regex risk.

## Problemas Encontrados

Nenhum.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Self-Check: PASSED

All 11 modified agents verified clean:
- `kit/agents/planner.md` ✓ (commit 6c0c3eb)
- `kit/agents/debugger.md` ✓ (commit 6c0c3eb)
- `kit/agents/verifier.md` ✓ (commit 6c0c3eb)
- `kit/agents/codebase-mapper.md` ✓ (commit 6c0c3eb)
- `kit/agents/executor.md` ✓ (commit 6c0c3eb)
- `kit/agents/project-researcher.md` ✓ (commit 6c0c3eb)
- `kit/agents/ui-researcher.md` ✓ (commit 6c0c3eb)
- `kit/agents/ui-auditor.md` ✓ (commit 6c0c3eb)
- `kit/agents/roadmapper.md` ✓ (commit 6c0c3eb)
- `kit/agents/research-synthesizer.md` ✓ (commit 6c0c3eb)
- `kit/agents/phase-researcher.md` ✓ (commit 6c0c3eb)
- `test/unit/agents-frontmatter-clean.test.js` ✓ (commit 0847a49)

Both commits present in git history. Static greps return 0. Anti-regression test passes. Suite 133/133 green.

## Prontidão para Próxima Fase

- Phase 80 plans 01, 02, 03, 04 all complete (this plan + 3 parallel)
- Ready for Phase 80 closure / Phase 81 (Drift Cleanup) start
- No blockers; PERF-13-02 closed, anti-regression locked in

---
*Fase: 80-hooks-race-pattern-token-economy-quick-wins*
*Concluída: 2026-05-09*
