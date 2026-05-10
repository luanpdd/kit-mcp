# Fase 119: Tenant Quente — Mitigação (DDIA Ch 6) — Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (skip_discuss)

<domain>
## Limite da Fase

Skill `tenant-quente-mitigacao` da Suíte DDIA Foundations v1.22 — aplica conceitos de **Partitioning** (DDIA Ch 6) ao contexto Postgres + Supabase + RLS multi-tenant. Foco em escalar quando **um tenant** consome desproporcionalmente recursos vs os demais (problema "Justin Bieber tenant" — referência DDIA p.196 + nota [13]).

REQs cobertos: TENANT-01..05 (5 REQs).

Deliverable único:
1. Skill `kit/skills/tenant-quente-mitigacao/SKILL.md` cobrindo:
   - Detecção do tenant quente (3 métricas canônicas com SQL)
   - 5 estratégias de mitigação tabuladas com tradeoffs
   - Particionamento range vs hash para `tenant_id` (decision tree)
   - Índices secundários document-partitioned vs term-partitioned (queries cross-tenant super-admin)
   - Rebalanceamento sem downtime (4 passos pg_dump + Supavisor reroute)

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via workflow.skip_discuss=true. Decisões guiadas por:
- Pattern do `multi-tenant-performance-scaling/SKILL.md` (v1.21) como template estrutural — frontmatter, "Quando usar" com trigger phrases, "Regras absolutas", "Patterns canônicos" com SQL real, "Anti-patterns" numerados, "Ver também" com cross-refs.
- Tradução conceitual: DDIA Ch 6 é genérico (HBase, Cassandra, MongoDB) — esta skill traduz para Postgres + Supavisor + Supabase. Hash/range partitioning vira `PARTITION BY HASH/RANGE` declarativo Postgres; scatter-gather vira EXPLAIN sobre tabela particionada.
- Cross-suite: skill consome conceitos de `multi-tenant-performance-scaling` (Supavisor pooling) e `supabase-postgres-style` (style guide SQL). Cross-ref ATIVO via Markdown link relativo.
- Cross-ref ANTECIPADO: `_shared-dados-distribuidos/glossary.md` será criado na Phase 117 (paralela) — referenciado como se já existisse.

### Decisões cristalizadas pela pesquisa (vinculantes)
- 3 métricas canônicas de detecção: queries/min ratio (`pg_stat_statements`), storage GB ratio (`pg_total_relation_size`), conn slots ratio (`pg_stat_activity`). Thresholds: >3× P50 = WARN, >10× P50 = CRITICAL.
- 5 estratégias: rate limit por tenant, pool conexão isolado (Supavisor multi-pool), read replica dedicada, desnormalização (MV per-tenant), request shaping (pgmq priority queue).
- Particionamento: hash quando workload uniforme, range quando hot tenants conhecidos a priori (anchor tenant manual partition).
- Índices secundários: document-partitioned default (local index, scatter-gather aceitável p/ super-admin); term-partitioned apenas em query path crítica.
- Rebalanceamento: 4 passos — (a) detectar via thresholds, (b) `pg_dump --table='*tenant_X*'`, (c) Supavisor redirect routing config, (d) `DROP SCHEMA tenant_X CASCADE` apenas após 7d sem queries.

</decisions>

<code_context>
## Insights do Código Existente

- `kit/skills/multi-tenant-performance-scaling/SKILL.md` (v1.21) — template estrutural canônico (5 seções)
- `kit/skills/_shared-supabase/glossary.md` (v1.8) — define `pg_stat_statements`, `pg_cron`, `pgmq` reaproveitáveis
- `kit/skills/_shared-multi-tenant/glossary.md` (v1.21) — define `tenant`, `org_id`, `cross-tenant query`
- `.claude/ddia-extracted.txt` linhas 8313-9117 — Ch 6 Partitioning completo, summary 8997-9050

</code_context>

<specifics>
## Ideias Específicas

Conceito "Justin Bieber tenant" (DDIA p.196 + nota [13] referenciando 3% dos servidores Twitter dedicados a 1 celebrity) é o anchor narrativo da skill — usado para conectar conceito DDIA abstract a exemplo concreto B2B SaaS (1 cliente enterprise consumindo 10× recursos do P50).

</specifics>

<deferred>
## Ideias Adiadas

- Agent `hot-tenant-mitigator` (auto-aplicar patches): defer para v1.23+ se houver demanda. Skill standalone basta para v1.22.
- Gate `hot-tenant-detection` automática: defer — métrica precisa de baseline 30d, gate prematuro daria muitos falsos positivos.
- Integration com SLO suite (alert quando hot tenant excede error budget): defer para v1.23 cross-suite.

</deferred>
