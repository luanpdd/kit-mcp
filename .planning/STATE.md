---
state_version: 1.0
milestone: none
milestone_name: "—"
status: "v1.25 entregue, aguardando próximo milestone (v1.26 a definir)"
last_updated: "2026-05-11T21:00:00.000Z"
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
Status: v1.25.0 entregue — working tree limpo após `/concluir-marco v1.25`. Pronto para `/novo-marco` v1.26.
Última atividade: 2026-05-11 — `/concluir-marco v1.25` (6 phases archived → milestones/v1.25-phases/, package.json 1.24.0→1.25.0, tag v1.25.0)

## Milestone ativo

_Nenhum_ — v1.25 entregue. Use `/novo-marco` para iniciar v1.26.

## Contexto Acumulado (dos milestones v1.23 + v1.24 + v1.25 entregues)

- **Suite kit:** 8 suítes ativas (Supabase v1.8 + 7 outras) + 3 hardening layers (v1.23 RLS + v1.24 Column-Level + **v1.25 Custom Claims RBAC**)
- **Counts:** 63 agents, 89 commands, 70 skills, 23 audit gates (post-v1.25)
- **file-manifest:** 373 files hashed (371→373 em v1.25)
- **Coverage:** 86.84% line (mantida; content-only milestone)
- **PRR:** **30/30** (mantido cross-content-only milestone)
- **Mutation baseline:** 57.40% (mantido)
- **MCP p95 latency:** 0ms (mantido)
- **Stable API v1.0+:** preservada cross-13-releases (v1.13→v1.25)
- **Cross-suite invocation pattern:** formalizado v1.21, enriquecido v1.23 (handoff cooperativo SQL), estendido v1.24 (column-level), **estendido v1.25 (RBAC via custom claims)**
- **Convenção PT-BR naming:** estabelecida v1.22, herdada v1.23/v1.24/v1.25
- **Princípio canônico v1.23 (herdado v1.24/v1.25):** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Aplicado em **20 cross-suite handoffs cumulativos** (12 RLS v1.23 + 5 column v1.24 + 3 RBAC v1.25).
- **Defense-in-depth camadas:** **9** (v1.25 adicionou Camada 9 = Auth Hooks Custom Claims)
- **Working tree:** clean (post-archive)

## Próximo passo

```
/novo-marco v1.26 (a definir)
```

`/clear` primeiro → janela de contexto fresca para questionamento → pesquisa → requisitos → roadmap.

## Tech debt parqueado (deferido para v1.26+)

**Carry-over de v1.20:**
1. Phase 100: cli/index.js extract helpers + branch coverage gate → 86→90 coverage ratchet
2. Phase 101: completar mutation baseline 5 files restantes + CI mutation gate threshold ~55%
3. Phase 105: p99 latency monitoring + M1 cold-start CLI sub-200ms

**Deferido em v1.21:**
- TanStack Start, Expo, SolidStart/SvelteKit/Nuxt + Hono/Express/Fastify integrations
- WhatsApp template management, CRM AI scoring, multi-region deployment
- Advanced audit log analytics dashboards

**Deferido em v1.22:**
- CRDTs (mergeable counters, OR-Sets), batch processing (DDIA Ch 10), multi-region active-active, CDC pipeline diagram

**Deferido em v1.23:**
- RLS testing framework (pgTAP integration); migração automática policies não-hardenadas; UI dashboard hardening status; burn rate alerting integrado com hardener; telemetry cooperative handoff

**Deferido em v1.24:**
- Supabase Vault (encryption at rest); dynamic column masking via views; pg_audit integration; UI dashboard column privileges; migração retroativa column-level

**Deferido em v1.25:**
- Outros Auth Hooks (Send Email, Send SMS, MFA Verification, Password Verification)
- Auth Hook em Edge Function (variant alternativa ao PG function)
- Migração retroativa helper function STABLE → custom claim para projetos existentes
- Dashboard UI customizada para gerenciar roles (kit-mcp é CLI-first)
- MFA enforcement via custom claim (`(SELECT (auth.jwt()->>'aal') = 'aal2')` em authorize)

## Quirk persistente (gravado em memory)

`gh auth switch --user luanpdd` é necessário ANTES de cada `git push` — wincred cache reverte para `in100tiva`.

## Histórico

- **v1.25.0** — Custom Claims & RBAC via Auth Hooks — entregue 2026-05-11 (6 phases, 32 REQs, 7 commits atomic, content-only)
- v1.24.0 — Segurança em Nível de Coluna (Column-Level Security) — entregue 2026-05-11 (6 phases, 26 REQs, content-only)
- v1.23.0 — Reforço RLS Supabase + Handoff Cooperativo SQL — entregue 2026-05-11 (7 phases, 42 REQs, content-only)
- v1.22.0 — Suíte DDIA Foundations — entregue 2026-05-10 (7 phases, 60 REQs, content-only)
- v1.21.0 — Suíte Multi-Tenant SaaS B2B — entregue 2026-05-10 (11 phases, 59 REQs, content-only)
- v1.20.0 — Tech Debt Closure & Quality Hardening — entregue 2026-05-10 (6 fases, PRR 30/30, +89 tests)
- v1.13 → v1.19 — 7 releases em 2026-05-09 (~9h sessão; 21 fases; PRR 22→28)
- Todos artefatos em `.planning/milestones/v1.X-{ROADMAP,REQUIREMENTS}.md` + `.planning/milestones/v1.X-phases/`
