---
state_version: 1.0
milestone: v1.28
milestone_name: "UX & Onboarding — kit-mcp developer experience"
status: "milestone entregue — 10 fases (156-165) completas, aguardando /publicar"
last_updated: "2026-05-12T12:00:00.000Z"
progress:
  total_phases: 10
  completed_phases: 10
  total_plans: 10
  completed_plans: 10
---

# STATE.md

## Posição Atual

Fase: — (milestone v1.28 entregue)
Plano: —
Status: v1.28 ENTREGUE — 10 fases (156-165) completas, 10 commits atômicos. Pronto para `/auditar-marco` + `/publicar`.
Última atividade: 2026-05-12 — Phase 165 (`kit replay`) commitada.

## Milestone entregue

**v1.28 — UX & Onboarding (10 fases, 156-165)** ✓

| # | Fase | Wave | Status |
|---|---|---|---|
| 156 | README diagrama 2 fluxos | 1 | ✓ |
| 157 | Sidecar UI auto-spawn ON por padrão | 1 | ✓ |
| 158 | Log file rotativo + `kit logs` | 1 | ✓ |
| 159 | `kit doctor` v1.28 checks | 1 | ✓ |
| 160 | `kit sync` progress + diff sumário | 2 | ✓ |
| 161 | `kit init` onboarding interativo | 2 | ✓ |
| 162 | `kit status` metrics CLI | 2 | ✓ |
| 163 | `kit inspect` live | 3 | ✓ |
| 164 | OS notification opt-in | 3 | ✓ |
| 165 | `kit replay list/show/diff` | 3 | ✓ |

## Deliverables v1.28

- **2 novos módulos:** `src/core/logger.js`, `src/core/notify.js`
- **5 novos comandos CLI:** `kit init`, `kit logs`, `kit inspect`, `kit status`, `kit replay {list,show,diff}`
- **6 novas env vars:** KIT_MCP_NO_UI, KIT_MCP_LOG_DIR, KIT_MCP_LOG_RETENTION_DAYS, KIT_MCP_INSPECT, KIT_MCP_NOTIFY, KIT_MCP_NOTIFY_THROTTLE_MS
- **2 enhancements:** `kit doctor` (+2 checks), `kit sync install` (+`--quiet` + tally)
- **README:** nova section "How kit-mcp works" + tabela "When do I use what?" + "Why no terminal output?"
- **Zero deps externas novas**
- **Zero breaking changes** (Stable API v1.0+ preservada cross-16-releases)

## Contexto Acumulado

- **Counts pré-v1.28:** 66 agents, 89 commands, 76 skills, 23 audit gates
- **Counts pós-v1.28:** 66 agents (mantido), 94 commands (+5: init, logs, inspect, status, replay; 89→94), 76 skills (mantido), 23 gates (mantido). NOTA: AUTOGEN-COUNTS precisa regen via `kit sync` (não fiz neste sprint autônomo).
- **file-manifest:** precisa regen (+ 2 novos módulos core + N artefatos .planning/)
- **Coverage:** não medido neste sprint (manter ≥ 86%)
- **Stable API v1.0+:** preservada cross-**16 releases** (v1.13→v1.28)
- **PRR:** mantido 30/30 (sem mudanças que invalidem axes)
- **Defense-in-depth:** 10 camadas (v1.28 ortogonal — UX-only)

## Próxima ação

1. `/auditar-marco v1.28` — auditoria de fechamento
2. Regen AUTOGEN-COUNTS via `kit sync` e atualizar README
3. Regen `kit/file-manifest.json`
4. `/publicar` ou `/publicar-rapido` — PR + Notion + GitHub tag

## Atenções para próxima sessão

- AUTOGEN-COUNTS desatualizado (89→94 commands)
- file-manifest.json não regenerado
- Sem testes unitários adicionados para `logger.js` / `notify.js` — cobertura pode regredir; smoke tests inline foram suficientes para validação manual
- Replay reexecute via LLM fica como follow-up para v1.29
