---
state_version: 1.0
milestone: v1.23
milestone_name: "Reforço RLS Supabase + Handoff Cooperativo SQL"
status: "Roadmap criado — pronto para planejamento"
last_updated: "2026-05-10T18:45:00.000Z"
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# STATE.md

## Posição Atual

Fase: Não iniciada (roadmap criado, aguardando `/planejar-fase 124`)
Plano: —
Status: Roadmap criado — pronto para planejamento
Última atividade: 2026-05-10 — Roadmap v1.23 criado via roadmapper (7 phases, 42/42 REQs mapeados)

## Milestone ativo

**v1.23 Reforço RLS Supabase + Handoff Cooperativo SQL** — incorporar 100% da doc oficial RLS da Supabase; agents externos passam draft SQL via `Task()` cooperativo para agents Supabase materializarem hardening (não BLOCK, não descarta upstream).

**Princípio canônico:** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam. Nenhum lado descarta o outro.

**Roadmap (7 phases, 124→130):**
- Phase 124 — Fundação RLS: skill `supabase-rls-policies` (RLS-01..07) + skill `supabase-migrations` (MIGR-01) — 8 REQs
- Phase 125 — Skill nova `supabase-rls-defense-in-depth` (DEFENSE-01..05) + glossário parcial (DOC-04 split) — 6 REQs
- Phase 126 — Agent novo `supabase-rls-hardener` (HARDEN-01..06) — 6 REQs
- Phase 127 — Patches agents Supabase existentes: writer + migration-writer + command (RLS-08..10, MIGR-02..04, CMD-01..02) — 8 REQs
- Phase 128 — Patches cross-suite v1.21 (CROSS-01..08, 8 implementers) — 8 REQs
- Phase 129 — Patches cross-suite v1.22 + framework core (CROSS-09..10) — 2 REQs
- Phase 130 — Release artifacts: AUTOGEN-COUNTS + file-manifest + CHANGELOG + glossário finalizado + MILESTONES (DOC-01..03, DOC-04 finaliza, DOC-05) — 5 REQs

**Cobertura:** 42/42 REQs mapeados (100%), 0 não-mapeados.

**Entregáveis previstos (9):** patches em skill `supabase-rls-policies` + agent `supabase-rls-writer` + skill `supabase-migrations` + agent `supabase-migration-writer` + command `/supabase`; skill nova `supabase-rls-defense-in-depth`; agent novo `supabase-rls-hardener` (verdicts GO/STRENGTHEN/REWRITE-com-confirmação); patches cross-suite em 10 agents externos; auto-enable RLS event trigger como default em projetos novos.

**Próximo marco parqueado:** v1.24 Segurança em Nível de Coluna (Column-Level Security) — após v1.23 concluído.

## Contexto Acumulado (do milestone v1.22 entregue)

- **Suite kit:** 8 suítes ativas (Supabase v1.8, Observabilidade v1.9, SRE v1.10, SRE Resilience v1.11, Legacy v1.12, Hardening v1.13-v1.20, Multi-Tenant SaaS B2B v1.21, DDIA Foundations v1.22)
- **Counts pré-v1.23:** 60 agents, 89 commands, 67 skills, 23 audit gates
- **Counts pós-v1.23 esperado:** 61 agents (+1 supabase-rls-hardener), 89 commands, 68 skills (+1 supabase-rls-defense-in-depth), 23 gates (mantido)
- **file-manifest:** 367 files hashed (pré-v1.23) → +2 esperado pós-v1.23
- **Coverage:** 86.84% line (mantida; v1.23 será content-only)
- **PRR:** **30/30** (mantido cross-content-only milestone)
- **Mutation baseline:** 57.40% (mantido)
- **MCP p95 latency:** 0ms (mantido)
- **Stable API v1.0+:** preservada cross-10-releases (v1.13→v1.22) — v1.23 mantém
- **Cross-suite invocation pattern:** formalizado em v1.21, herdado em v1.22, **enriquecido em v1.23 com semântica cooperativa explícita**
- **Convenção PT-BR naming:** estabelecida em v1.22 (artefatos novos PT-BR; pré-v1.22 preservados) — v1.23 segue (skill nova `supabase-rls-defense-in-depth` mantém prefixo `supabase-` por consistência com a família existente)
- **Working tree:** clean ao iniciar v1.23

## Próximo passo

```
/planejar-fase 124  (Fundação RLS: supabase-rls-policies + supabase-migrations patches)
```

Ou autonomous execution sequencial 124→130:

```
/autonomo
```

## Tech debt parqueado (deferido para v1.24+)

**Carry-over de v1.20:**
1. Phase 100: cli/index.js extract helpers + branch coverage gate → 86→90 coverage ratchet
2. Phase 101: completar mutation baseline 5 files restantes (sync, ui, watch, reverse-sync, gate-runner) + CI mutation gate threshold ~55%
3. Phase 105: p99 latency monitoring com disk-persistent snapshots + M1 cold-start CLI sub-200ms

**Deferido em v1.21:**
- TanStack Start, Expo, SolidStart/SvelteKit/Nuxt integrations
- Hono/Express/Fastify backend integrations
- WhatsApp template management + media handling (Supabase Storage)
- CRM advanced: AI scoring (lead intent prediction), conversion analytics
- Multi-region deployment patterns (Vercel multi-region + Supabase replicas)
- Advanced audit log analytics dashboards

**Deferido em v1.22:**
- Skills específicas para CRDTs (mergeable counters, OR-Sets) — relevante para colaborativo realtime
- Skills para batch processing (DDIA Ch 10) — pgmq + scheduled jobs já satisfazem
- Skill para multi-region active-active deployment Supabase
- Tooling para visualização de event flow (CDC pipeline diagram generator)

**Deferido em v1.23 (próximo marco):**
- v1.24: Column-Level Security (skill `supabase-column-level-security` + agent `supabase-column-privileges-writer` + cross-suite handoff cooperativo column-level)
- RLS testing framework (pgTAP integration) — não cobre material-fonte v1.23
- Migração automática de policies existentes não-hardenadas — risco alto, requer dry-run
- UI dashboard de hardening status — v2, kit-mcp é CLI-first
- Burn rate alerting integrado com hardener (alertar quando taxa de REWRITE sobe) — v2
- Telemetry de cooperative handoff (% de drafts upstream GO vs STRENGTHEN vs REWRITE) — v2

## Quirk persistente (gravado em memory)

`gh auth switch --user luanpdd` é necessário ANTES de cada `git push` — wincred cache reverte para `in100tiva` (que não tem acesso ao luanpdd/kit-mcp).

## Histórico

- v1.22.0 — Suíte DDIA Foundations — entregue 2026-05-10 (7 phases, 60 REQs, 28+ commits atomic, content-only)
- v1.21.0 — Suíte Multi-Tenant SaaS B2B — entregue 2026-05-10 (11 phases, 59 REQs, 18 commits atomic, content-only)
- v1.20.0 — Tech Debt Closure & Quality Hardening — entregue 2026-05-10 (6 fases, PRR 30/30, +89 tests)
- v1.13 → v1.19 — 7 releases em 2026-05-09 (~9h sessão; 21 fases; PRR 22→28)
- Todos artefatos em `.planning/milestones/v1.X-{ROADMAP,MILESTONE-AUDIT,REQUIREMENTS}.md`
