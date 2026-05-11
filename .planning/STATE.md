---
state_version: 1.0
milestone: v1.27
milestone_name: "Supabase Branching & CI/CD Workflow"
status: "v1.27 roadmap criado, pronto para /planejar-fase 149"
last_updated: "2026-05-11T22:45:00.000Z"
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# STATE.md

## Posição Atual

Fase: 149 (não iniciada — pronta para planejamento)
Plano: —
Status: Roadmap criado, pronto para `/planejar-fase 149`
Última atividade: 2026-05-11 — ROADMAP.md gerado para v1.27 (7 phases, 45 REQs, cobertura 100%)

## Milestone ativo

**v1.27 — Supabase Branching & CI/CD Workflow** (roadmap criado)

7 entregáveis distribuídos em 7 phases (149-155):
- Phase 149: Skill `supabase-branching-workflow` (5 REQs — BRANCH)
- Phase 150: Skill `supabase-config-toml-remotes` (5 REQs — CFG)
- Phase 151: Skill `supabase-ci-cd-github-actions` (8 REQs — CI)
- Phase 152: Skill `supabase-pgtap-testing` (4 REQs — TEST)
- Phase 153: Skill `supabase-migration-repair` (5 REQs — REPAIR)
- Phase 154: Agents `supabase-branching-architect` + `supabase-cicd-pipeline-implementer` (10 REQs — ARCH + CICD)
- Phase 155: Cross-suite enrichment (3 agents v1.x) + Release artifacts (8 REQs — XS + REL)

**Cobertura:** 45/45 REQs mapeados (100%), 0 não-mapeados.

## Contexto Acumulado (dos milestones v1.23 + v1.24 + v1.25 + v1.26 entregues)

- **Suite kit:** 8 suítes ativas (Supabase v1.8 + 7 outras) + 4 hardening layers (v1.23 RLS + v1.24 Column-Level + v1.25 Custom Claims RBAC + **v1.26 Postgres Roles**)
- **Counts:** 64 agents, 89 commands, 71 skills, 23 audit gates (post-v1.26)
- **Counts pós-v1.27 esperada:** 66 agents (+2), 89 commands (mantido), 76 skills (+5), 23 gates (mantido)
- **file-manifest:** 375 files hashed (375 → 382 esperado em v1.27)
- **Coverage:** 86.84% line (mantida; content-only milestone)
- **PRR:** **30/30** (mantido cross-content-only milestone)
- **Mutation baseline:** 57.40% (mantido)
- **MCP p95 latency:** 0ms (mantido)
- **Stable API v1.0+:** preservada cross-14-releases (v1.13→v1.26)
- **Cross-suite invocation pattern:** formalizado v1.21, enriquecido v1.23 (handoff cooperativo SQL), estendido v1.24/v1.25/v1.26
- **Convenção PT-BR naming:** estabelecida v1.22, herdada v1.23-v1.26
- **Princípio canônico v1.23 (herdado v1.24/v1.25/v1.26):** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Aplicado em **24 cross-suite handoffs cumulativos** (12 RLS v1.23 + 5 column v1.24 + 3 RBAC v1.25 + 4 Roles v1.26). Esperado +6-7 em v1.27 (ARCH + CICD + XS).
- **Defense-in-depth camadas:** **10** (v1.26 adicionou Camada 10 = Postgres Roles Hierarchy). v1.27 é ortogonal a defense-in-depth (deployment maturity, não security).
- **Trilha de segurança Supabase consolidada:** RLS (linha) + Column-Level (coluna) + Custom Claims (app access role) + Postgres Roles (system access role) — 4 mecanismos complementares cobrindo aplicação completa
- **Trilha v1.27 (deployment maturity):** preview branches + CI/CD pipelines — ortogonal a security (pipeline ≠ authz)
- **Working tree:** clean (post-archive)

## Próximo passo

```
/planejar-fase 149
```

Ou autonomous execution inline (pattern v1.23/v1.24/v1.25/v1.26):
```
(inline phase-by-phase)
```

## Tech debt parqueado (deferido para v1.27+ e v1.28+)

**Carry-over de v1.20 (deferido para v1.28+):**
1. Phase 100: cli/index.js extract helpers + branch coverage gate → 86→90 coverage ratchet
2. Phase 101: completar mutation baseline 5 files restantes + CI mutation gate threshold ~55%
3. Phase 105: p99 latency monitoring + M1 cold-start CLI sub-200ms

**Deferido em v1.27:**
- Supabase Vault encryption-at-rest para PII columns (separado de branching)
- Backup & Recovery dedicado (RTO/RPO, PITR, restore drills) — escopo próprio
- Outros Auth Hooks além de Custom Access Token (Send Email, Send SMS, MFA Verification, Password Verification, Before User Created)
- MFA enforcement patterns (AAL2 obrigatório por role/permission)
- Realtime authorization patterns avançados
- Terraform provider (alternativa IaC ao GitHub branching)
- SOC 2 compliance específico (compliance enterprise)

## Quirk persistente (gravado em memory)

`gh auth switch --user luanpdd` é necessário ANTES de cada `git push` — wincred cache reverte para `in100tiva`.

## Histórico

- **v1.27.0** — Supabase Branching & CI/CD Workflow — em andamento (roadmap criado 2026-05-11, 7 phases, 45 REQs)
- v1.26.0 — Postgres Roles — entregue 2026-05-11 (6 phases, 34 REQs, 7 commits atomic, content-only)
- v1.25.0 — Custom Claims & RBAC via Auth Hooks — entregue 2026-05-11 (6 phases, 32 REQs, content-only)
- v1.24.0 — Segurança em Nível de Coluna (Column-Level Security) — entregue 2026-05-11 (6 phases, 26 REQs, content-only)
- v1.23.0 — Reforço RLS Supabase + Handoff Cooperativo SQL — entregue 2026-05-11 (7 phases, 42 REQs, content-only)
- v1.22.0 — Suíte DDIA Foundations — entregue 2026-05-10 (7 phases, 60 REQs, content-only)
- v1.21.0 — Suíte Multi-Tenant SaaS B2B — entregue 2026-05-10 (11 phases, 59 REQs, content-only)
- v1.20.0 — Tech Debt Closure & Quality Hardening — entregue 2026-05-10 (6 fases, PRR 30/30, +89 tests)
- v1.13 → v1.19 — 7 releases em 2026-05-09 (~9h sessão; 21 fases; PRR 22→28)
- Todos artefatos em `.planning/milestones/v1.X-{ROADMAP,REQUIREMENTS}.md` + `.planning/milestones/v1.X-phases/`
