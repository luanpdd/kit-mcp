---
state_version: 1.0
milestone: v1.29
milestone_name: "MCP-Native Discovery via Auto-Sync"
status: "milestone iniciado — definindo requisitos e roadmap"
last_updated: "2026-05-12T13:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# STATE.md

## Posição Atual

Fase: 166 (a planejar)
Plano: —
Status: v1.29 iniciado — MCP-Native Discovery. 6 fases (166-171). Modo execução: totalmente autônomo.
Última atividade: 2026-05-12 — bootstrap v1.29 após v1.28 release + tag publicada.

## Milestone ativo

**v1.29 — MCP-Native Discovery via Auto-Sync (6 fases, 166-171)**

| # | Fase | Effort | Status |
|---|---|---|---|
| 166 | MCP `roots` capability consumption | S | pending |
| 167 | Auto-sync no boot (idempotente + permission) | M | pending |
| 168 | Restart signal via tool result + marker file | S | pending |
| 169 | MCP `notifications/resources/updated` | M | pending |
| 170 | Tool descriptions com keywords (fallback) | XS | pending |
| 171 | `kit doctor` sync drift check | S | pending |

## Contexto Acumulado (pós-v1.28)

- **Counts:** 66 agents, 89 commands, 76 skills, 23 audit gates
- **file-manifest:** 382 files hashed
- **Coverage:** 88.40% line (último CI run f6db800)
- **Stable API v1.0+:** preservada cross-**16 releases**
- **CI:** verde em 9 OS×Node combos pós-PRs #8 #9 #10 #11 #12 #13
- **v1.28 deliverables ativos:** logger.js, notify.js, kit init/logs/inspect/status/replay, sidecar auto-spawn default + test-mode skip, README reformulado (168 linhas)

## Próxima ação

Implementar fase 166 — MCP `roots` capability.
