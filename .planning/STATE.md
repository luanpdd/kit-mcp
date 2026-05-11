---
state_version: 1.0
milestone: none
milestone_name: "—"
status: "v1.27 entregue, aguardando próximo milestone (v1.28 a definir)"
last_updated: "2026-05-11T23:30:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# STATE.md

## Posição Atual

Fase: — (nenhum milestone ativo)
Plano: —
Status: v1.27.0 entregue — working tree limpo após `/concluir-marco v1.27`. Pronto para `/novo-marco` v1.28.
Última atividade: 2026-05-11 — `/concluir-marco v1.27` (7 phases archived → milestones/v1.27-phases/, package.json 1.26.0→1.27.0, tag v1.27.0)

## Milestone ativo

_Nenhum_ — v1.27 entregue. Use `/novo-marco` para iniciar v1.28.

## Contexto Acumulado (dos milestones v1.23 + v1.24 + v1.25 + v1.26 + v1.27 entregues)

- **Suite kit:** 8 suítes ativas (Supabase v1.8 + 7 outras) + 4 hardening layers (v1.23 RLS + v1.24 Column-Level + v1.25 Custom Claims RBAC + v1.26 Postgres Roles) + **v1.27 9ª trilha (deployment maturity — branching + CI/CD)**
- **Counts:** **66 agents, 89 commands, 76 skills, 23 audit gates** (post-v1.27)
- **file-manifest:** **382 files hashed** (375→382 em v1.27)
- **Coverage:** 86.84% line (mantida; content-only milestone)
- **PRR:** **30/30** (mantido cross-content-only milestone)
- **Mutation baseline:** 57.40% (mantido)
- **MCP p95 latency:** 0ms (mantido)
- **Stable API v1.0+:** preservada cross-**15 releases** (v1.13→v1.27)
- **Cross-suite invocation pattern:** formalizado v1.21, enriquecido v1.23 (handoff cooperativo SQL), estendido v1.24/v1.25/v1.26/v1.27
- **Convenção PT-BR naming:** estabelecida v1.22, herdada v1.23-v1.27
- **Princípio canônico v1.23 (herdado v1.24/v1.25/v1.26/v1.27):** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Aplicado em **27 cross-suite handoffs cumulativos** (12 RLS v1.23 + 5 column v1.24 + 3 RBAC v1.25 + 4 Roles v1.26 + 3 Branching v1.27).
- **Defense-in-depth camadas:** **10** (mantido — v1.27 é ortogonal: deployment maturity, não security).
- **Trilha de segurança Supabase consolidada:** RLS (linha) + Column-Level (coluna) + Custom Claims (app access role) + Postgres Roles (system access role) — 4 mecanismos complementares cobrindo aplicação completa.
- **Trilha v1.27 (deployment maturity):** preview branches + CI/CD pipelines + pgTAP testing + migration repair — ortogonal a security (pipeline ≠ authz).
- **Working tree:** clean (post-archive).

## Próximo passo

```
/novo-marco v1.28 (a definir)
```

`/clear` primeiro → janela de contexto fresca para questionamento → pesquisa → requisitos → roadmap.

## Tech debt parqueado (deferido para v1.28+)

**Carry-over de v1.20 (deferido):**
1. Phase 100: cli/index.js extract helpers + branch coverage gate → 86→90 coverage ratchet
2. Phase 101: completar mutation baseline 5 files restantes + CI mutation gate threshold ~55%
3. Phase 105: p99 latency monitoring + M1 cold-start CLI sub-200ms

**Deferido em v1.21-v1.27:** ver MILESTONES.md para lista completa por marco.

**Deferido em v1.27:**
- Supabase Vault encryption-at-rest para PII columns (separado de branching)
- Backup & Recovery dedicado (RTO/RPO, PITR, restore drills) — escopo próprio
- Outros Auth Hooks além de Custom Access Token
- MFA enforcement patterns (AAL2 obrigatório por role/permission)
- Realtime authorization patterns avançados
- Terraform provider (alternativa IaC ao GitHub branching)
- SOC 2 compliance específico

## Quirk persistente (gravado em memory)

`gh auth switch --user luanpdd` é necessário ANTES de cada `git push` — wincred cache reverte para `in100tiva`.

## Histórico

- **v1.27.0** — Supabase Branching & CI/CD Workflow — entregue 2026-05-11 (7 phases, 45 REQs, 20 atomic commits, content-only)
- v1.26.0 — Postgres Roles — entregue 2026-05-11 (6 phases, 34 REQs, 7 atomic commits, content-only)
- v1.25.0 — Custom Claims & RBAC via Auth Hooks — entregue 2026-05-11 (6 phases, 32 REQs, content-only)
- v1.24.0 — Segurança em Nível de Coluna (Column-Level Security) — entregue 2026-05-11 (6 phases, 26 REQs, content-only)
- v1.23.0 — Reforço RLS Supabase + Handoff Cooperativo SQL — entregue 2026-05-11 (7 phases, 42 REQs, content-only)
- v1.22.0 — Suíte DDIA Foundations — entregue 2026-05-10 (7 phases, 60 REQs, content-only)
- v1.21.0 — Suíte Multi-Tenant SaaS B2B — entregue 2026-05-10 (11 phases, 59 REQs, content-only)
- v1.20.0 — Tech Debt Closure & Quality Hardening — entregue 2026-05-10 (6 fases, PRR 30/30, +89 tests)
- v1.13 → v1.19 — 7 releases em 2026-05-09 (~9h sessão; 21 fases; PRR 22→28)
- Todos artefatos em `.planning/milestones/v1.X-{ROADMAP,REQUIREMENTS}.md` + `.planning/milestones/v1.X-phases/`
