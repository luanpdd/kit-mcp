---
phase: 41-gates-qa-readme-changelog
plan: 02
subsystem: qa-gates
tags: [bash, gate, sre, postmortem, blameless, pre-conclude]

requires:
  - phase: 36-skills-foundationais
    provides: blameless-postmortems skill (knowledge canônico cap 15 + frase "no postmortem left unreviewed")
  - phase: 37-agents-canonicos-sre
    provides: postmortem-writer agent (consumidor do gate via /postmortem --from-investigation)
  - phase: 38-comandos-orquestrador
    provides: /postmortem command (sugestão emitida pelo gate em FAIL)
  - phase: 40-patches-em-fluxo-framework
    provides: forense.md sre_integration block (chain documentado /forense → /postmortem)
provides:
  - gates/postmortem-template-required.md (blocking pre-conclude gate)
  - Loop fechado v1.9 (Core Analysis Loop diagnostica) → v1.10 (postmortem documenta) enforced
affects: [v1.10 milestone close, /concluir-marco workflow, omm-auditor evolution path]

tech-stack:
  added: []
  patterns:
    - "Bash 3.2-portable gate (sem mapfile/readarray/[[ =~ ]]/declare -A)"
    - "Match por basename <id> entre .planning/investigations/ e .planning/postmortems/"
    - "Status: INCONCLUSIVE como exceção canônica (sem root cause = sem postmortem exigido)"
    - "Suporte a 2 patterns de storage: single-file <id>.md + subdir <id>/STATE.md"

key-files:
  created:
    - gates/postmortem-template-required.md
  modified: []

key-decisions:
  - "Blocking por default (≠ omm-no-regression que é warn-only) — cultura blameless é não-negociável uma vez instituída (cap 15)"
  - "INCONCLUSIVE exception alinhada com Plan 40-01 (lista canônica de quando NÃO sugerir chain /postmortem)"
  - "Match por basename <id> (não path completo) — coopera com handoff postmortem-writer --from-investigation <id> que produz .planning/postmortems/<id>.md exato"
  - "Toggle warn-only via workflow.postmortem_required_warn deferido (gate atual não consulta config — só presença/ausência de pares)"

patterns-established:
  - "Pre-conclude gate canônico — segundo gate desse stage após omm-no-regression"
  - "Cross-refs Markdown ATIVOS para skill + agent + command no bloco Why (descoberta natural cross-artefato)"
  - "Princípio canônico cap 15 citado literalmente — 'No postmortem left unreviewed'"
  - "Mensagem FAIL aponta solução acionável: /postmortem --from-investigation <id>"

requirements-completed: [QA-SRE-02]

duration: 8min
completed: 2026-05-07
---

# Phase 41 Plan 02: Gate postmortem-template-required Summary

**Bash 3.2-portable blocking pre-conclude gate enforcing "no postmortem left unreviewed" (cap 15 Google SRE) by cross-checking .planning/investigations/ vs .planning/postmortems/ via basename match, with Status: INCONCLUSIVE recognized as exception**

## Performance

- **Duração:** ~8 min
- **Iniciado:** 2026-05-07T04:38:00Z
- **Concluído:** 2026-05-07T04:46:00Z
- **Tarefas:** 3 (T1 confirmar precedente + T2 escrever gate + T3 smoke validation)
- **Arquivos modificados:** 1 (criado)

## Realizações

- Gate `gates/postmortem-template-required.md` criado (127 linhas) — frontmatter canônico (4 fields: `id`, `stage: pre-conclude`, `blocking: true`, `description: 174 chars ≤ 200`), bloco `## Check` com bash 3.2-portable (`#!/usr/bin/env bash` + `set -e`, sem `mapfile`/`readarray`/`[[ =~ ]]`/`declare -A`), bloco `## Verdict` (passed/block), bloco `## Why` com cross-refs ATIVOS Markdown (`postmortem-writer` agent + `blameless-postmortems` skill + chain do `forense.md`), bloco `## REQ` (QA-SRE-02), bloco `## Configuração` com toggle `workflow.postmortem_required_warn` documentado (deferido).
- Detecção de 2 patterns de investigation: pattern A `<id>.md` single-file via `find -maxdepth 1 -type f -name "*.md"` + pattern B `<id>/STATE.md` subdir via `find -mindepth 2 -maxdepth 2 -type f -name "STATE.md"`. ID extraction por `${base%.md}` (pattern A) ou `basename "$(dirname "$inv_path")"` (pattern B).
- Detecção `Status: INCONCLUSIVE` como exceção via `grep -qiE "^Status:.*INCONCLUSIVE|^.*Status.*INCONCLUSIVE"` — alinhado com Plan 40-01 que documenta INCONCLUSIVE em lista de "Quando NÃO sugerir chain `/postmortem`".
- Output formato canônico para gate-runner: primeira linha `PASS:`/`FAIL:`/`INFO:`. Mensagem FAIL inclui sugestão acionável (`/postmortem --from-investigation <id>`), cross-ref ao skill+agent canônico, princípio cap 15 citado literalmente.
- Skip gracefully se `.planning/investigations/` ausente OU vazio (projeto sem incidents registrados).
- Princípio canônico cap 15 ("No postmortem left unreviewed") citado literalmente no bloco Why + na mensagem FAIL.
- Smoke validation completa: 4 fixtures rodaram com exit codes corretos (current kit-mcp INFO skip exit 0, missing postmortem FAIL exit 1, paired PASS exit 0, INCONCLUSIVE PASS exit 0).

## Commits das Tarefas

Commit atômico único (gate é file único — 3 tarefas convergem em 1 deliverable):

1. **T1+T2+T3: Criar e validar gates/postmortem-template-required.md** — `4e481a6` (feat) — 1 arquivo, 127 insertions

**Observação:** plan tem 3 tarefas conceituais (T1 confirmar precedente, T2 escrever gate, T3 smoke validation), mas apenas 1 deliverable de arquivo (gate único). T1 foi validação preparatória (read-only — não gera commit), T3 foi shell smoke validation (não gera commit). Padrão consistente com outros gates do milestone (omm-no-regression, obs-skills-frontmatter — single-file commits).

## Arquivos Criados/Modificados

- `gates/postmortem-template-required.md` (NEW, 127 linhas) — bash 3.2-portable blocking pre-conclude gate. Cross-checa `.planning/investigations/` vs `.planning/postmortems/` via match por basename `<id>`. Reconhece `Status: INCONCLUSIVE` como exceção. Skip gracefully se `.planning/investigations/` ausente. Output `PASS:`/`FAIL:`/`INFO:` para gate-runner. Cobre QA-SRE-02.

## Decisões Tomadas

1. **Blocking por default** — diferente do `omm-no-regression` (warn-only por design — score evolutivo de 5 capacidades), este gate é blocking porque "no postmortem left unreviewed" é regra absoluta cap 15 livro Google SRE. Rebaixar para warn = aceitar blame culture (anti-pattern explícito documentado em `kit/skills/blameless-postmortems/SKILL.md`).

2. **INCONCLUSIVE exception canônica** — alinhado com Plan 40-01 (`kit/commands/forense.md` bloco `<sre_integration>`) que documenta lista explícita de "Quando NÃO sugerir chain `/postmortem`": (a) forense INCONCLUSIVE em todas as hipóteses, (b) falha trivial sem impacto a usuário, (c) investigação cancelada antes do Core Analysis Loop fechar. Gate aplica subset detectável programaticamente — apenas (a) via grep `Status: INCONCLUSIVE`. Casos (b)+(c) não são auto-detectáveis e dependem de juízo humano.

3. **Match por basename `<id>`** — não path completo. Decisão validada por leitura de `kit/agents/postmortem-writer.md` Step 0 que confirma handoff `--from-investigation <id>` produz output em `.planning/postmortems/<id>.md` (default path). ID compartilhado entre `incident-investigator` (v1.9) e `postmortem-writer` (v1.10).

4. **Toggle warn-only deferido** — `workflow.postmortem_required_warn` documentado mas não implementado no gate atual. Gate puro (presença/ausência de pares investigation↔postmortem). Toggle será implementado se adoption inicial requerer mode opt-in.

5. **2 patterns de storage suportados** — Phase 37 ou usuários podem armazenar investigations como single-file `<id>.md` OU subdir `<id>/STATE.md`. Decisão tomada porque `incident-investigator` v1.9 não impõe storage canônico — ambos patterns são válidos. Gate suporta ambos via `find -maxdepth 1` (single-file) + `find -mindepth 2 -maxdepth 2 -name STATE.md` (subdir).

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

**Total de desvios:** 0
**Impacto no plano:** Plano 41-02 é editorial single-file gate puramente aditivo. Especificação detalhada do PLAN.md (incluindo conteúdo literal do gate, smoke validation exata) eliminou ambiguidade. Zero pivots necessários. Smoke validation 4/4 PASS confirma especificação correta.

## Problemas Encontrados

Nenhum.

**Working tree note:** No momento da execução, working tree continha 4 outros arquivos não-trackeados (`gates/golden-signals-coverage.md`, `gates/prr-checklist-coverage.md`, `.planning/phases/40-patches-em-fluxo-framework/40-01-forense-postmortem-chain-SUMMARY.md`, e modificações em `.planning/STATE.md`) — outputs de executores paralelos rodando em workflow `/autonomo`. Commit isolou apenas `gates/postmortem-template-required.md` para preservar atomicidade do plano.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

Toggle opt-in `workflow.postmortem_required_warn` documentado no gate mas não consumido pelo bash check atual (deferido — gate puro lê só presença/ausência de pares).

## Prontidão para Próxima Fase

- Phase 41 Plan 02 concluído — Plan 41-03 (gate prr-checklist-coverage) ready para execução paralela.
- Loop fechado SRE v1.9 → v1.10 enforced: `/forense` (v1.9) → `incident-investigator` produz `.planning/investigations/<id>.md` → `/postmortem --from-investigation <id>` (v1.10) produz `.planning/postmortems/<id>.md` → gate `postmortem-template-required` enforça correspondência antes de `/concluir-marco` arquivar milestone.
- Pre-conclude gate stack agora tem 2 gates: `omm-no-regression` (v1.9 — warn-only) + `postmortem-template-required` (v1.10 — blocking). Próximo seria `prr-checklist-coverage` (v1.10 — Phase 41 Plan 03 — production readiness review coverage).

---
*Fase: 41-gates-qa-readme-changelog*
*Concluída: 2026-05-07*
