---
phase: 33
plan: 01
title: 4 patches em comandos do framework
status: complete
covers_reqs: [INT-FW-01, INT-FW-02, INT-FW-03, INT-FW-06]
---

# Plan 01: 4 patches em comandos do framework

## Tarefas

| # | Comando | Bloco adicionado | REQ |
|---|---------|------------------|-----|
| 1 | `kit/commands/discutir-fase.md` | `<observability_integration>` com pergunta canônica ODD + seção `<observability>` em CONTEXT.md | INT-FW-01 |
| 2 | `kit/commands/planejar-fase.md` | `<observability_integration>` descrevendo gate plan-checker para 4 perguntas ODD | INT-FW-02 |
| 3 | `kit/commands/verificar-trabalho.md` | `<observability_integration>` invocando incident-investigator em modo validation pós-UAT | INT-FW-03 |
| 4 | `kit/commands/forense.md` | `<observability_integration>` aplicando Core Analysis Loop em vez de inspeção ad hoc | INT-FW-06 |

## Validação

- 4 commands editados, cada um com 1 bloco `<observability_integration>` novo
- REQ-IDs explícitos no bloco
- Cross-refs para skills relevantes (`observability-driven-development`, `core-analysis-loop`)
- Frontmatter (description, allowed-tools) inalterado
