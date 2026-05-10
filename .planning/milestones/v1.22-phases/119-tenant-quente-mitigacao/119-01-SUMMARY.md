# Phase 119 — Plan 01 Summary

**Status:** done
**Concluído:** 2026-05-10

## Arquivos criados

| Caminho | Linhas | Descrição |
|---|---|---|
| `kit/skills/tenant-quente-mitigacao/SKILL.md` | ~390 | Skill canônica cobrindo 5 critérios DDIA Ch 6 aplicados a Postgres + Supabase |

## REQs cobertos

| REQ | Descrição | Evidência (path:section) |
|---|---|---|
| **TENANT-01** | Detecção do "tenant Justin Bieber" — 3 métricas canônicas + thresholds 3× / 10× P50 | `kit/skills/tenant-quente-mitigacao/SKILL.md` seção `### REQ TENANT-01 — Detecção do "tenant Justin Bieber"` (3 views SQL: `private.hot_tenant_query_rate`, `private.hot_tenant_storage`, `private.hot_tenant_conn_slots`) |
| **TENANT-02** | 5 estratégias de mitigação tabuladas com tradeoffs | `kit/skills/tenant-quente-mitigacao/SKILL.md` seção `### REQ TENANT-02 — 5 estratégias de mitigação (tabela canônica)` (rate limit, pool isolado, read replica, MV per-tenant, request shaping pgmq) |
| **TENANT-03** | Particionamento range vs hash com decision tree | `kit/skills/tenant-quente-mitigacao/SKILL.md` seção `### REQ TENANT-03 — Particionamento range vs hash para 'tenant_id'` (decision tree + exemplos `PARTITION BY HASH` 16 partições + `PARTITION BY RANGE` anchor tenant) |
| **TENANT-04** | Índices document-partitioned vs term-partitioned | `kit/skills/tenant-quente-mitigacao/SKILL.md` seção `### REQ TENANT-04 — Índices secundários document-partitioned vs term-partitioned` (tabela comparativa + lookup table manual + recomendação default) |
| **TENANT-05** | Rebalanceamento sem downtime — 4 passos | `kit/skills/tenant-quente-mitigacao/SKILL.md` seção `### REQ TENANT-05 — Rebalanceamento sem downtime (4 passos)` (detect → pg_dump → Supavisor reroute → cleanup 7d) |

## Cross-refs ATIVOS

- `../_shared-dados-distribuidos/glossary.md` (Phase 117 paralela — referenciado como se já existisse)
- `../multi-tenant-performance-scaling/SKILL.md` (v1.21)
- `../supabase-postgres-style/SKILL.md` (v1.8)
- `../multi-tenant-rls-hierarchy/SKILL.md` (v1.21)
- `../super-admin-platform-pattern/SKILL.md` (v1.21)

## Padrões reaproveitados

- Estrutura canônica de SKILL.md: frontmatter PT-BR, "Quando usar" + trigger phrases, "Regras absolutas" numeradas, "Patterns canônicos" com SQL real, "Anti-patterns" numerados, "Ver também" com cross-refs (template: `multi-tenant-performance-scaling/SKILL.md`).
- Convenção `private.*` schema para helpers + `pg_cron` para refresh assíncrono (consumido de `supabase-postgres-style`).
- Convenção naming partição `<tabela_base>_<org_id_underscore>` (consumido de `multi-tenant-performance-scaling` Phase 108 LIST partitioning).

## Próximo passo

Commit 3 — adicionar SUMMARY + VERIFICATION (este arquivo + 119-VERIFICATION.md).
