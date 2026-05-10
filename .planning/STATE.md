---
state_version: 1.0
milestone: v1.20
milestone_name: "Tech Debt Closure & Quality Hardening"
status: Roadmap criado
last_updated: "2026-05-10T00:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  phase_range: "100-105"
---

# STATE.md

## Posição Atual

Fase: Não iniciada (roadmap criado, próximo passo: `/discutir-fase 100` ou `/planejar-fase 100`)
Plano: —
Status: Roadmap criado — 6 fases (100-105) mapeadas a 6 REQs
Última atividade: 2026-05-10 — Roadmap v1.20 criado

## Milestone ativo

**v1.20 Tech Debt Closure & Quality Hardening** — fechamento de 6 itens parqueados pós-v1.19. Target PRR 28→30/30, coverage 80→90%, mutation testing baseline. Fases 100-105 (6 fases, 1 REQ por fase).

## Roadmap

| Phase | REQ | Foco |
|---|---|---|
| 100 | INFRA-20-01 | Coverage ratchet 80→90% |
| 101 | INFRA-20-02 | Mutation testing baseline (stryker) |
| 102 | OBS-20-01 | Auto-snapshot em metrics-snapshot tool |
| 103 | OBS-20-02 | Multi-window burn-rate (1h fast + 6h slow) |
| 104 | SRE-20-01 | PRR Emergency 4/5 → 5/5 (RUNBOOK + drill log) |
| 105 | SRE-20-02 | PRR Performance 4/5 → 5/5 (lazy-load + p95 sub-100ms) |

## Contexto Acumulado (v1.19 e anteriores)

- v1.19.0 publicada 2026-05-09 (Maturidade Operacional)
- 7 releases em 2026-05-09 (v1.13→v1.19) = 21 fases entregues
- Suite atual: 482 testes, coverage 81.51%, PRR 28/30
- Stable API v1.0+ preservada cross-7-releases

## Quirk persistente

`gh auth switch --user luanpdd` é necessário ANTES de cada `git push` — wincred cache reverte para `in100tiva` (que não tem acesso ao luanpdd/kit-mcp).
