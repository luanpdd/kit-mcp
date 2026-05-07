---
phase: 38-comandos-orquestrador-sre
plan: 02
subsystem: kit-commands
tags: [sre, toil, audit, command-wrapper, agent-dispatch, eliminating-toil]

requires:
  - phase: 36-skills-sre
    provides: skill eliminating-toil (6 critérios canônicos, regra ≤ 50%, L0-L4)
  - phase: 37-agentes-core-sre
    provides: agent toil-auditor (AGCORE-SRE-02 — Plan 02)
provides:
  - kit/commands/auditar-toil.md — wrapper command para invocar toil-auditor com 4 flags opcionais
  - cobertura completa do REQ CMD-SRE-02
affects: [phase 39 INT-OBS-02 (omm-auditor consume audit), phase 40 INT-FW-V2-03 (auditar-marco gate), phase 41 docs]

tech-stack:
  added: []
  patterns:
    - "Wrapper-puro: comando NÃO duplica análise do agent; apenas parseia args + dispatch + output forwarding"
    - "Graceful degradation: validação pré-requisitos não-bloqueante (git ausente OK; runbooks ausente OK)"
    - "Cross-refs Markdown ativos para integração v1.10 — Phase 39/40 milestones"

key-files:
  created:
    - kit/commands/auditar-toil.md
  modified: []

key-decisions:
  - "Wrapper puro (sem post-processing) — agent já formata output transparentemente"
  - "Output canônico em .planning/TOIL-AUDIT.md (não dentro de fase específica) — re-audit periódico cada milestone"
  - "Pré-requisito git é não-bloqueante — graceful degradation para repos sem histórico ou novos"
  - "Smoke test inline via kit sync install claude-code valida descoberta no destino"

patterns-established:
  - "Comando wrapper SRE: precedente instrumentar-fase (v1.9) replicado para family /auditar-toil, /postmortem, /prr, /risk-budget, /sre"
  - "Frontmatter com Task tool habilitado: essencial para wrappers que dispatch para agentes"
  - "Validação inline pós-criação: anchors canônicos + Task literal + palavras-chave + sync test"

requirements-completed: [CMD-SRE-02]

duration: 11 min
completed: 2026-05-07
---

# Phase 38 Plan 02: Comando /auditar-toil — Summary

**Wrapper command kit/commands/auditar-toil.md (146-char description, 5.8 KB / 129 linhas) que dispatch para toil-auditor via Task(subagent_type=...) com 4 flags opcionais e graceful degradation sem git history, gera .planning/TOIL-AUDIT.md priorizado P0/P1/P2.**

## Performance

- **Duração:** ~11 min
- **Iniciado:** 2026-05-07T06:50Z (estimado)
- **Concluído:** 2026-05-07T07:01Z (estimado)
- **Tarefas:** 3 (T1 frontmatter+objective+context, T2 process, T3 success_criteria+smoke)
- **Arquivos modificados:** 1 (kit/commands/auditar-toil.md — criado)

## Realizações

- Comando wrapper kit/commands/auditar-toil.md criado com frontmatter válido (Task tool habilitado, description 146/200 chars)
- 4 âncoras canônicas instaladas com count=1 cada: `<objective>`, `<context>`, `<process>`, `<success_criteria>`
- Process bloco com 4 steps numerados: parse → validar → dispatch → pós-output + integração OMM
- Cross-refs Markdown ativos para `[toil-auditor](../agents/toil-auditor.md)` + `[eliminating-toil](../skills/eliminating-toil/SKILL.md)`
- Step 3 dispatch literal `Task(subagent_type="toil-auditor")` com prompt enumerado em 6 etapas + 6 critérios canônicos do livro Google SRE
- Step 4 sugere cross-refs para `/auditar-marco` (Phase 40 INT-FW-V2-03) e `/observabilidade omm` (Phase 39 INT-OBS-02 — Capacidade 3)
- Smoke validação inline ALL_PASS: TOIL-AUDIT.md ≥ 3 (7x), P0/P1/P2 ≥ 3 (4x), toil ≥ 10 (24x), eliminating-toil ≥ 1 (2x)
- Smoke `kit sync install claude-code` → SYNC_OK (74 commands no destino, arquivo `.claude/commands/auditar-toil.md` descoberto)

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (parallel executor protocol):

1. **T1: Frontmatter + objective + context** — `878a5e8` (feat)
2. **T2: Process — parse + validate + dispatch + post-output** — `ee4c8da` (feat)
3. **T3: Success criteria + smoke validated** — `2d0ef6d` (feat)

## Arquivos Criados/Modificados

- `kit/commands/auditar-toil.md` (criado, 5.8 KB, 129 linhas) — comando wrapper que invoca `toil-auditor` para gerar `.planning/TOIL-AUDIT.md` priorizado P0/P1/P2

## Decisões Tomadas

- **Wrapper puro (sem post-processing)** — comando NÃO duplica scan/análise do agent. Minimiza superfície de manutenção; agent já formata output canônico (Step 5 do toil-auditor.md).
- **Output em `.planning/TOIL-AUDIT.md`** (não dentro de fase específica) — toil é re-audit periódico, não artefato de fase. Path canônico permite cross-tool consumption (omm-auditor, auditar-marco).
- **Pré-requisito git não-bloqueante** — agent funciona com scripts/runbooks apenas se git ausente. Graceful degradation evita falsos negativos para repos novos ou submodules.
- **Smoke validation inline em 3 níveis** — (a) bash counts validam anchors/keywords; (b) `kit sync install claude-code` valida descoberta no IDE destino; (c) commits atomicos com `--no-verify` evitam conflitos com hooks pre-commit do parallel executor.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

## Problemas Encontrados

**Smoke test path correction:** A primeira tentativa do smoke usou `bin/kit-mcp.js` (não existe) e `npx kit-mcp sync claude-code` (comando `claude-code` desconhecido). Identifiquei a estrutura correta lendo `package.json` (`bin: { kit: "bin/cli.js" }`) e o subcommand correto (`sync install claude-code`, não `sync claude-code`). Validação final passou com `node ./bin/cli.js sync install claude-code --project-root "$TMP"` retornando SYNC_OK + 74 commands. Não é desvio do plano — apenas adaptação do snippet bash do plan que assumia `npx kit-mcp` mas estamos rodando localmente.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- Plan 02 completo. Phase 38 tem mais planos pendentes (03 postmortem, 04 prr, 05 risk-budget, 06 sre orquestrador) — alguns já em progresso conforme `git log` mostra commits 38-04/38-05/38-06.
- CMD-SRE-02 totalmente coberto. Phase 39 INT-OBS-02 (omm-auditor consume) e Phase 40 INT-FW-V2-03 (auditar-marco gate) podem agora referenciar este comando como pronto.
- Pronto para `/executar-fase 38` continuar com próximo plano sem `/clear`, ou para validation gate `/verificar-trabalho 38` após todos os 6 plans concluírem.

---
*Fase: 38-comandos-orquestrador-sre*
*Concluída: 2026-05-07*
