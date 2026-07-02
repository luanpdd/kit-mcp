---
phase: 30
status: complete
completed: 2026-05-06
covers_reqs: [SKPR-01, AGCORE-01, AGCORE-02, CMD-01, CMD-03]
---

# Phase 30 — Summary: Agentes core + comandos críticos + skill ODD

## Entregue

5 artefatos:

| # | Artefato | REQ | Tamanho |
|---|----------|-----|---------|
| 1 | `kit/skills/observability-driven-development/SKILL.md` | SKPR-01 | ~13 KB |
| 2 | `kit/agents/observability-instrumenter.md` | AGCORE-01 | ~8 KB |
| 3 | `kit/agents/incident-investigator.md` | AGCORE-02 | ~9 KB |
| 4 | `kit/commands/instrumentar-fase.md` | CMD-01 | ~7 KB |
| 5 | `kit/commands/investigar-producao.md` | CMD-03 | ~5 KB |

## Validação

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | Skill ODD com 4 perguntas pré-PR + auto-page autor | ✅ documentadas com tabelas e exemplos práticos |
| 2 | `observability-instrumenter` gera spans + atributos canônicos | ✅ helper `classifyError`, padrão de span SERVER kind, propagação outbound |
| 3 | `incident-investigator` aplica Core Analysis Loop + MCP Supabase + estado persistente | ✅ `mcp__supabase__get_logs/execute_sql/get_advisors/list_tables` em frontmatter `tools`; `.planning/investigations/<id>.md` |
| 4 | `/instrumentar-fase` gera INSTRUMENTATION.md por plano | ✅ template com Spans/Eventos críticos/Métricas/4 perguntas ODD |
| 5 | `/investigar-producao` lança agente com estado persistente | ✅ flag `--id` para retomar, listagem de investigações ativas |
| 6 | Sync idempotente | ✅ todos os 5 artefatos projetam corretamente para `.claude/` |
| 7 | `description ≤ 200 chars` em todos | ✅ 159-179 chars (todos < 200) |

## Cross-refs criadas

Skills da Phase 29 ↔ artefatos da Phase 30:
- ODD → `structured-events`, `distributed-tracing`, `event-based-slos` (forward ref Phase 32)
- `observability-instrumenter` → `structured-events`, `distributed-tracing`, `opentelemetry-standard`, `observability-driven-development`
- `incident-investigator` → `core-analysis-loop`
- `/instrumentar-fase` → `observability-driven-development`, `observability-instrumenter`
- `/investigar-producao` → `incident-investigator`, `core-analysis-loop`

## Próximo: Phase 31 — Integração Suíte Supabase (patches nos 7 agentes)
