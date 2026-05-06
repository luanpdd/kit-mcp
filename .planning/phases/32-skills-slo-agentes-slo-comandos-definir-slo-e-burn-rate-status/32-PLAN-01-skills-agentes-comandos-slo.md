---
phase: 32
plan: 01
title: 2 skills SLO + 2 agentes SLO + 2 comandos
status: complete
covers_reqs: [SKPR-02, SKPR-03, AGCORE-03, AGCORE-04, CMD-02, CMD-04]
---

# Plan 01: Skills SLO + agentes + comandos

## Tarefas

| # | Artefato | REQ |
|---|----------|-----|
| 1 | `kit/skills/event-based-slos/SKILL.md` | SKPR-02 |
| 2 | `kit/skills/burn-rate-alerting/SKILL.md` | SKPR-03 |
| 3 | `kit/agents/slo-engineer.md` | AGCORE-03 |
| 4 | `kit/agents/burn-rate-forecaster.md` | AGCORE-04 |
| 5 | `kit/commands/definir-slo.md` | CMD-02 |
| 6 | `kit/commands/burn-rate-status.md` | CMD-04 |

## Validação

- 6 artefatos com frontmatter válido (`description ≤ 200`)
- Cross-refs entre as 2 skills + 2 agentes + 2 comandos formam grafo coerente
- Sync idempotente
- Agentes declaram `mcp__supabase__execute_sql`/`apply_migration` em `tools`
