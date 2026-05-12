---
state_version: 1.0
milestone: v1.29
milestone_name: "MCP-Native Discovery via Auto-Sync"
status: "milestone entregue — 6 fases (166-171) completas, aguardando release+tag"
last_updated: "2026-05-12T13:30:00.000Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 6
  completed_plans: 6
---

# STATE.md

## Posição Atual

Fase: — (milestone v1.29 entregue)
Plano: —
Status: v1.29 ENTREGUE — 6 fases (166-171) completas, 6 commits atômicos. package.json 1.29.0. Aguardando release PR + tag.
Última atividade: 2026-05-12 — Phase 171 commitada.

## Milestone entregue

**v1.29 — MCP-Native Discovery via Auto-Sync (6 fases, 166-171)** ✓

| # | Fase | Status |
|---|---|---|
| 166 | MCP `roots` capability — `src/mcp-server/roots.js` | ✓ |
| 167 | Auto-install tool — sync para `.claude/` idempotente | ✓ |
| 168 | Restart signal — marker file + `ack-restart` tool | ✓ |
| 169 | MCP `resources` + `notifications/resources/list_changed` | ✓ |
| 170 | Tool descriptions com keywords (fallback MCP puro) | ✓ |
| 171 | `kit doctor` auto-install drift + restart-pending | ✓ |

## Deliverables v1.29

- **2 novos MCP tools:** `auto-install`, `ack-restart`
- **2 novas capabilities:** `resources` (server-side), `roots` (consumer)
- **1 novo módulo:** `src/mcp-server/roots.js`
- **1 novo script:** `scripts/check-tool-descriptions.mjs`
- **2 markers em `.claude/`:** `.kit-mcp-version` (idempotência), `.kit-mcp-restart-required` (restart-pending)
- **2 novos `kit doctor` checks:** auto-install, restart pending
- **Tool descriptions enriquecidas:** `kit` (596 chars) e `auto-install` (499 chars) com trigger keywords
- **Zero deps externas novas**
- **Zero breaking changes** (Stable API v1.0+ preservada cross-17-releases)

## Contexto Acumulado pós-v1.29

- **Counts:** 66 agents, 89 commands (kit/), 76 skills, 23 audit gates — sem mudanças no conteúdo
- **MCP tools:** 7 → **9** (auto-install + ack-restart)
- **MCP capabilities:** tools → tools + **resources** + **roots-consumer**
- **MCP resources expostos:** **231** entries (URIs kit://agent/skill/command/<name>)
- **Local tests:** 560/562 pass (unchanged)
- **Stable API:** preservada cross-**17 releases**

## Próxima ação

1. PR + auto-merge na main
2. Aguardar CI verde
3. Tag v1.29.0
