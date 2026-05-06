# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Posição Atual

Fase: Não iniciada (roadmap criado)
Plano: —
Status: Roadmap criado (4 fases, Phase 25 → Phase 28)
Última atividade: 2026-05-06 — Roadmap v1.8 criado (31 REQs mapeados em 4 fases)

## Milestone ativo

**v1.8 Suíte Supabase** — adicionar skills + agents + command `/supabase` para suporte canônico a Postgres/DB, Auth, Realtime, Edge Functions, RLS, Migrations, Storage, pgvector/RAG, Cron+Queues.

## Próximo passo

`/planejar-fase 25` — Phase 25: 11 skills Supabase + glossário compartilhado (`_shared-supabase/glossary.md`).

Dependências da Phase 25: nenhuma. Pode iniciar imediatamente.

## Bloqueadores

(nenhum)

## Todos pendentes

(vazio)

## Histórico

- v1.0.0 — concluído 2026-05-03 (`.planning/milestones/v1.0.0/`)
- v1.1.0 — concluído 2026-05-03 (`.planning/milestones/v1.1.0/`)
- v1.2.0 — concluído 2026-05-04 (`.planning/milestones/v1.2.0/`)
- v1.2.3 → v1.5.3 — patches ad-hoc fora do framework (CHANGELOG é canônico)
- v1.6.0 — concluído 2026-05-05 (16 audit REQs + observability hook); publicado em npm
- v1.6.1 — concluído 2026-05-05 (kit doctor + upgrade-check + gates cache, Onda 1); publicado em npm
- v1.7.0 — concluído 2026-05-06 (workflow compaction + stubs-only sync + boilerplate dedup + /fazer canonical, Onda 2); cut pendente
- v1.8.0 — em planejamento (Suíte Supabase: 11 skills + 7 agents + command + 5 gates)

## Contexto Acumulado

Os 7 milestones anteriores (v1.0 → v1.7) construíram a infraestrutura genérica do kit-mcp (registry, sync, MCP tools, sidecar, observability, perf+lean). v1.8 muda o foco para **conteúdo especializado**: a primeira suíte de skills+agents+command focada em um stack específico (Supabase). v1.8 é **content-only por design** — zero alterações em `src/core/`, registry, sync. Stable API v1.0+ preservada. Material-fonte: 7 guias oficiais Supabase + 4 dimensões de pesquisa em `.planning/research/`. Sidecar em http://127.0.0.1:7100/ para observability.

Roadmap v1.8 (4 fases, Phase 25 → Phase 28):
- Phase 25 — 11 skills + glossário (12 REQs)
- Phase 26 — 7 agents + convenção universal SB-A00 (8 REQs)
- Phase 27 — command `/supabase` orquestrador (2 REQs)
- Phase 28 — 5 audit gates + 4 validação cross-IDE + cleanup (9 REQs)

Total: 31 REQs mapeados (zero unmapped).
