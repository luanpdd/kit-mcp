---
phase: 30
plan: 01
title: Skill ODD + 2 agentes core + 2 comandos críticos
goal: Criar skill ODD, agentes observability-instrumenter e incident-investigator, comandos /instrumentar-fase e /investigar-producao
status: complete
covers_reqs: [SKPR-01, AGCORE-01, AGCORE-02, CMD-01, CMD-03]
---

# Plan 01: Skill ODD + 2 agentes + 2 comandos

## Tarefas

| # | Task | Arquivo | REQ |
|---|------|---------|-----|
| 1 | Skill `observability-driven-development` (4 perguntas pré-PR + auto-page autor) | `kit/skills/observability-driven-development/SKILL.md` | SKPR-01 |
| 2 | Agente `observability-instrumenter` (gera patches OTel + atributos canônicos) | `kit/agents/observability-instrumenter.md` | AGCORE-01 |
| 3 | Agente `incident-investigator` (Core Analysis Loop + MCP Supabase + estado persistente) | `kit/agents/incident-investigator.md` | AGCORE-02 |
| 4 | Comando `/instrumentar-fase` (gera INSTRUMENTATION.md por plano) | `kit/commands/instrumentar-fase.md` | CMD-01 |
| 5 | Comando `/investigar-producao` (lança incident-investigator com estado persistente) | `kit/commands/investigar-producao.md` | CMD-03 |
| 6 | Smoke: sync idempotente (run 2× = byte-idêntico excluindo timestamp) | — | — |
| 7 | Validar `description ≤ 200 chars` em todos | — | — |

## Depende de

- Phase 29 concluída (skills SKFD existem para cross-reference)

## Validação

- 5 arquivos existem
- Frontmatter válido com `description ≤ 200 chars`
- Cross-refs Markdown apontando para skills SKFD da Phase 29
- Sync idempotente
- `incident-investigator` declara `mcp__supabase__*` em frontmatter `tools`
- `observability-instrumenter` NÃO usa MCP Supabase (modifica só código local)
