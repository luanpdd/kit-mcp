# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Posição Atual

Fase: Não iniciada (definindo requisitos)
Plano: —
Status: Definindo requisitos
Última atividade: 2026-05-06 — Milestone v1.8 (Suíte Supabase) iniciado

## Milestone ativo

**v1.8 Suíte Supabase** — adicionar skills + agents + command `/supabase` para suporte canônico a Postgres/DB, Auth, Realtime, Edge Functions, RLS, Migrations.

## Próximo passo

Definir requisitos (REQ-IDs) e roadmap por fases. Roadmap começa em **Phase 25**.

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

## Contexto Acumulado

Os 6 milestones anteriores (v1.0 → v1.7) construíram a infraestrutura genérica do kit-mcp (registry, sync, MCP tools, sidecar, observability, perf+lean). v1.8 muda o foco para **conteúdo especializado**: a primeira suíte de skills+agents+command focada em um stack específico (Supabase). Material-fonte dos 7 guias oficiais Supabase fornecidos pelo user na abertura. Sidecar em http://127.0.0.1:7100/ para observability.
