---
state_version: 1.0
milestone: v1.28
milestone_name: "UX & Onboarding — kit-mcp developer experience"
status: "milestone iniciado — definindo requisitos e roadmap"
last_updated: "2026-05-12T00:00:00.000Z"
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# STATE.md

## Posição Atual

Fase: 156 (a planejar)
Plano: —
Status: v1.28 iniciado — UX & Onboarding. 10 fases (156-165) divididas em 3 waves. Modo execução: totalmente autônomo.
Última atividade: 2026-05-12 — `/novo-marco v1.28` bootstrap

## Milestone ativo

**v1.28 — UX & Onboarding (10 fases, 156-165)**

| # | Fase | Wave | Effort | Status |
|---|---|---|---|---|
| 156 | README diagrama 2 fluxos + tabela "quando uso o quê" | 1 | XS | pending |
| 157 | Sidecar UI auto-spawn ON por padrão | 1 | S | pending |
| 158 | Log file rotativo + `kit logs --tail` | 1 | S | pending |
| 159 | `kit doctor` — health check completo | 1 | M | pending |
| 160 | `kit sync` progress bar + diff sumário | 2 | S | pending |
| 161 | `kit init` onboarding interativo | 2 | M | pending |
| 162 | `kit status` — metrics snapshot CLI | 2 | S | pending |
| 163 | `kit mcp --inspect` TUI dev mode | 3 | M | pending |
| 164 | Notification on tool call (opt-in) | 3 | S | pending |
| 165 | `kit replay <id>` — reexecutar tool call | 3 | M | pending |

## Contexto Acumulado (cumulativo cross-15-releases)

- **Suite kit:** 8 suítes ativas + 4 hardening layers + 9ª trilha deployment maturity (v1.27)
- **Counts pré-v1.28:** 66 agents, 89 commands, 76 skills, 23 audit gates
- **file-manifest:** 382 files hashed
- **Coverage:** 86.84% line
- **PRR:** 30/30
- **Mutation baseline:** 57.40%
- **MCP p95 latency:** 0ms
- **Stable API v1.0+:** preservada cross-15-releases (v1.13→v1.27); v1.28 NÃO quebra (UX-only additions)
- **Cross-suite invocation pattern:** 27 handoffs cumulativos
- **Convenção PT-BR naming:** mantida
- **Princípio canônico v1.23:** mantido (irrelevante para v1.28 — não há Supabase work)
- **Defense-in-depth camadas:** 10 (mantido — v1.28 é UX-only, ortogonal a segurança)

## Próxima ação

`/autonomo` — modo totalmente autônomo, sem pausa entre fases.
