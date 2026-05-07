---
phase: 38-comandos-orquestrador-sre
plan: 03
subsystem: kit-commands-sre
tags: [sre, postmortem, blameless, command, wrapper, slash-command]

# Grafo de dependências
requires:
  - phase: 37-agentes-core-sre
    provides: postmortem-writer agent (AGCORE-SRE-03) — target do dispatch
  - phase: 36-skills-sre-foundation
    provides: blameless-postmortems skill — knowledge base canônica do template
  - phase: v1.9
    provides: incident-investigator agent — alimenta modo --from-investigation
provides:
  - Slash-command /postmortem wrapper que invoca postmortem-writer
  - 2 modos mutuamente exclusivos: --from-investigation <id> + --incident "<descrição>"
  - Idempotency guard contra sobrescrita de postmortems existentes
  - Cross-refs ativos para skill blameless-postmortems + agent incident-investigator (v1.9)
  - Próximos passos sugerem chain para /prr, /observabilidade omm, /adicionar-tarefa
affects: [38-06-sre-orquestrador, 40-INT-FW-V2-01-forense-chain, /forense]

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - "Wrapper command com Task() dispatch — minimiza superfície duplicada"
    - "2 modos mutuamente exclusivos com AskUserQuestion fallback"
    - "Idempotency via [ -f $OUTPUT_PATH ] check antes de dispatch"

key-files:
  created:
    - kit/commands/postmortem.md
  modified: []

key-decisions:
  - "Wrapper puro: comando NÃO duplica template do agent — só parse/validate/dispatch"
  - "Modo A (--from-investigation) é preferido por reaproveitar Core Analysis Loop trail v1.9"
  - "Idempotência via fail-fast (não sobrescreve sem --output explícito) — anti-pattern: silent overwrite"

patterns-established:
  - "Mutual exclusivity: ambos passados → ERROR; nenhum passado → AskUserQuestion sugerido"
  - "ID derivation: Modo A herda investigation_id; Modo B gera postmortem-DATE-SLUG auto"
  - "Cross-ref Markdown literal para skill + agent target + ancestor agent (v1.9)"

requirements-completed:
  - CMD-SRE-03

# Métricas
duration: ~8min
completed: 2026-05-07
---

# Phase 38 Plan 03: Comando /postmortem — Resumo

**Wrapper /postmortem invoca postmortem-writer com 2 modos mutuamente exclusivos (--from-investigation v1.9 trail OU --incident standalone) gerando postmortem blameless 9 seções em .planning/postmortems/<id>.md**

## Performance

- **Duração:** ~8 min
- **Iniciado:** 2026-05-07
- **Concluído:** 2026-05-07
- **Tarefas:** 3
- **Arquivos modificados:** 1 (criado)
- **Tamanho:** 8.1 KB / 179 linhas

## Realizações

- Comando `/postmortem` criado em `kit/commands/postmortem.md`
- 2 modos mutuamente exclusivos documentados (--from-investigation E --incident)
- Frontmatter válido: name=postmortem, description=159 chars (≤200), allowed-tools inclui Task + AskUserQuestion
- 4 âncoras canônicas (objective, context, process, success_criteria) cada count=1
- Process com 5 steps numerados: parse, validate, list, dispatch, output
- Cross-refs ativos para postmortem-writer + skill blameless-postmortems + incident-investigator (v1.9)
- Idempotência: não sobrescreve postmortem existente sem --output explícito
- Smoke `kit sync install claude-code` cria `.claude/commands/postmortem.md` corretamente

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Tarefa 38-03-T1: Frontmatter + objective + context com 2 modos** — `5ca1016` (feat)
2. **Tarefa 38-03-T2: Process com 5 steps — parse, validar, dispatch** — `e43b0dc` (feat)
3. **Tarefa 38-03-T3: Success criteria + smoke validation** — `e640c97` (feat)

## Arquivos Criados/Modificados

- `kit/commands/postmortem.md` — comando wrapper que dispatch para `postmortem-writer` com 2 modos mutuamente exclusivos; gera postmortem blameless 9 seções em `.planning/postmortems/<id>.md`

## Decisões Tomadas

- **Wrapper puro vs duplicação de template:** Mantido como wrapper minimalista — comando só parseia/valida/dispatcha; template canônico de 9 seções vive no agent `postmortem-writer` (Phase 37 Plan 03). Reduz superfície de manutenção.
- **Modo A preferido sobre Modo B:** Quando investigation file existe, Modo A reaproveita Core Analysis Loop trail v1.9 sem retrabalho; Modo B é fallback para casos standalone (incident menor, near-miss, retrospectivas).
- **Idempotência fail-fast:** Não sobrescreve postmortem existente — força user a passar --output novo path OU rm explícito. Evita silent overwrite de postmortems já reviewed.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

## Problemas Encontrados

- **Smoke sync command mismatch:** O plano referencia `npx kit-mcp sync claude-code` mas a CLI atual é `kit sync install claude-code` (subcomando). Resolvido invocando `node bin/cli.js sync install claude-code --project-root <tmp>` — confirmado que o arquivo é sincronizado para `.claude/commands/postmortem.md`.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. Comando descobre-se automaticamente após próximo `kit sync install <target>`.

## Validações Smoke (T3)

| Verificação | Esperado | Atual | Status |
|---|---|---|---|
| `description` length | ≤ 200 chars | 159 chars | OK |
| `<objective>` count | 1 | 1 | OK |
| `<context>` count | 1 | 1 | OK |
| `<process>` count | 1 | 1 | OK |
| `<success_criteria>` count | 1 | 1 | OK |
| `subagent_type="postmortem-writer"` | ≥ 1 | 1 | OK |
| `--from-investigation` | ≥ 3 | 8 | OK |
| `--incident` | ≥ 3 | 10 | OK |
| `blameless` (case-insensitive) | ≥ 3 | 4 | OK |
| `9 seções\|9 perguntas\|9 questões` | ≥ 2 | 6 | OK |
| `SMART\|UTC` | ≥ 2 | 3 | OK |
| `incident-investigator` | ≥ 1 | 1 | OK |
| `v1.9` | ≥ 1 | 3 | OK |
| `kit sync install claude-code` | sync OK | sync OK | OK |

## Prontidão para Próxima Fase

- Comando `/postmortem` pronto para Phase 38 Plan 06 (orquestrador `/sre`) referenciar como subcomando.
- Phase 40 INT-FW-V2-01 vai modificar `/forense` para sugerir chain `/postmortem` automaticamente após Core Analysis Loop fechar — comando wrapper está pronto para ser invocado.
- Sem bloqueios.

---
*Fase: 38-comandos-orquestrador-sre*
*Plano: 03 — postmortem*
*Concluída: 2026-05-07*
