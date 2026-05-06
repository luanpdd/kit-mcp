# STATE.md — sessão atual

> Atualizado por workflows e mantido entre sessões. Source of truth para "onde paramos".

## Posição Atual

Fase: Concluída
Plano: —
Status: v1.8.0 arquivada + v1.8.1 patch de integração aplicado (7 edições). CI roda 4 gates blocking. Pronto para cut.
Última atividade: 2026-05-06 — Patch v1.8.1: integração Supabase Suite no fluxo (/fazer, planner, executor, /depurar, discuss-phase, plan-phase, CI gates)

## Milestone ativo

**Nenhum.** v1.8.0 + v1.8.1 prontos. Cut: `npm version 1.8.1 -m "v%s — Suíte Supabase + integração"` + `git push --follow-tags`.

## Próximo passo

1. `/auditar-marco` — audita 4 fases contra intenção original
2. `/concluir-marco` — arquiva milestone em `.planning/milestones/v1.8.0/`
3. Cut da v1.8.0:
   ```bash
   npm version minor -m "v%s — Suíte Supabase"
   git push --follow-tags origin main
   # publish.yml auto-publica via npm
   ```

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
- v1.8.0 — concluído 2026-05-06 (Suíte Supabase: 11 skills + 7 agents + command + 5 gates + UUID cleanup, Phases 25-28); aguardando lifecycle + cut

## Contexto Acumulado

Os 7 milestones anteriores (v1.0 → v1.7) construíram a infraestrutura genérica do kit-mcp. v1.8 é o primeiro milestone **content-only** com expertise especializada: Suíte Supabase (skills + agents + command + gates focados em Postgres/Supabase backend). 31 REQs entregues em 4 fases sem alterar `src/core/`. Todos os anti-pitfalls (A1-A12 packaging + B1-B14 Supabase) endereçados via gates ou patterns embutidos. Sidecar em http://127.0.0.1:7100/ ainda ativo da abertura.
