---
phase: 33
status: complete
completed: 2026-05-06
covers_reqs: [INT-FW-01, INT-FW-02, INT-FW-03, INT-FW-06]
---

# Phase 33 — Summary: Integração com fluxo framework

## Entregue

4 patches editoriais em comandos do framework existentes:

| Comando | REQ | Hook documentado |
|---------|-----|------------------|
| `/discutir-fase` | INT-FW-01 | Pergunta canônica ODD; resultado salvo em `<observability>` section do CONTEXT.md |
| `/planejar-fase` | INT-FW-02 | plan-checker valida 4 perguntas ODD no CONTEXT.md; bloqueia se ausentes |
| `/verificar-trabalho` | INT-FW-03 | incident-investigator em modo "validation" pós-UAT — confirma instrumentação real, não só código existe |
| `/forense` | INT-FW-06 | Core Analysis Loop — cada anomalia vira hipótese com query de validação |

## Configuração via workflow flags (defaults)

| Flag | Default | Comando afetado |
|------|---------|-----------------|
| `workflow.observability_phase_questions` | `true` | `/discutir-fase` |
| `workflow.observability_plan_gate` | `true` | `/planejar-fase` |
| `workflow.observability_uat_validation` | `true` | `/verificar-trabalho` |

## Skills cross-referenced

- [`observability-driven-development`](../../../../kit/skills/observability-driven-development/SKILL.md) — em `/discutir-fase` e `/planejar-fase`
- [`core-analysis-loop`](../../../../kit/skills/core-analysis-loop/SKILL.md) — em `/verificar-trabalho` e `/forense`

## Agentes invocados via hooks

- [`incident-investigator`](../../../../kit/agents/incident-investigator.md) — em `/verificar-trabalho` (modo validation)

## Padrão preservado

- Patches são editoriais — workflows em `.claude/framework/workflows/*.md` continuam funcionais como antes
- Hooks são opcionais (controlados por flags) e degradam graciosamente quando MCP Supabase não disponível
- Frontmatter dos comandos inalterado (description, allowed-tools)
- Stable API v1.0+ preservada

## Próximo: Phase 34 — Skills escala + OMM + orquestrador
