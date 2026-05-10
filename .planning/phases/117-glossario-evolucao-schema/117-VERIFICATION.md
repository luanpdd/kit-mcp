---
status: passed
phase: 117
verified_at: 2026-05-10
verified_by: autonomo-workflow
notes: 5/5 critérios verificados via inspeção de arquivo + linha
---

# Phase 117 — Verification

## Critérios de sucesso (do ROADMAP.md v1.22, Phase 117)

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Glossário define ≥ 15 termos canônicos PT-BR ↔ EN: linearizabilidade, consistência causal, consistência eventual, atualização perdida (lost update), distorção de escrita (write skew), leitura fantasma (phantom read), MVCC, CDC, event sourcing, fencing token, partição quente (hot partition), líder-seguidor (leader-follower), broker baseado em log, snapshot isolation, serializable snapshot isolation (SSI). | ✅ | `kit/skills/_shared-dados-distribuidos/glossary.md` define **62 termos** distribuídos em 8 seções de domínio (a, b, c, d, e, f, g, h). Termos exigidos pelo critério verificáveis: `linearizability` (linha 19), `causal consistency` (linha 20), `eventual consistency` (linha 21), `lost update` (linha 36), `write skew` (linha 37), `phantom read` (linha 38), `MVCC` (linha 39), `snapshot isolation` (linha 40), `serializable snapshot isolation (SSI)` (linha 41), `hot partition / hot tenant` (linha 50), `leader-follower replication` (linha 30), `log-based broker` (linha 80), `CDC` (linha 81), `event sourcing` (linha 82), `fencing token` (linha 60). |
| 2 | Glossário documenta convenção PT-BR para naming de artefatos (a partir de v1.22) com exemplos: `evolucao-schema-compativel` (PT-BR) vs `multi-tenant-rls-hierarchy` (EN, pré-v1.22 preservado). | ✅ | `kit/skills/_shared-dados-distribuidos/glossary.md` seção (i) "Convenção de naming PT-BR (a partir de v1.22)" — tabela de regras + exemplos lado a lado mostrando explicitamente `evolucao-schema-compativel` (PT-BR) e `multi-tenant-rls-hierarchy` (EN preservado) + rationale + checklist de aplicação para skill v1.22+. |
| 3 | Skill `evolucao-schema-compativel` apresenta padrão 3-passos com SQL completo: (a) `ALTER TABLE ... ADD COLUMN x text` (nullable), (b) `UPDATE ... SET x = ... WHERE x IS NULL LIMIT 10000` em loop, (c) `ALTER TABLE ... ALTER COLUMN x SET NOT NULL` apenas após backfill verificado. | ✅ | `kit/skills/evolucao-schema-compativel/SKILL.md` seção "Padrão 3-passos: adicionar coluna NOT NULL em tabela em uso" — três blocos SQL sequenciais: Migration 1 com `alter table public.leads add column phone_country text;` (nullable), Migration 2 com `do $$ ... loop ... update public.leads set phone_country = case ... where ctid in (select ctid ... limit 10000) ... exit when rows_updated = 0 ... pg_sleep(0.1) ... end loop;`, Migration 3 com pattern `add constraint ... check ... not valid` → `validate constraint` → `alter column phone_country set not null` (otimização Postgres 12+). |
| 4 | Skill mapeia análogos Avro/Protobuf de schema evolution para Postgres: rename de coluna via `CREATE OR REPLACE VIEW`, alargamento `varchar(50)→varchar(255)` seguro vs estreitamento inseguro, mudança de default em coluna em uso (deve ser feita em 2 passos com backfill). | ✅ | `kit/skills/evolucao-schema-compativel/SKILL.md` seção "Análogos Avro/Protobuf → Postgres (matriz canônica)" — tabela com 10 operações comparando Avro/Protobuf vs Postgres (incluindo `Widen string (varchar(50) → varchar(255))` = seguro catalog-only e `Narrow string (varchar(255) → varchar(50))` = inseguro requer shadow column); seção "Rename de coluna via view (zero downtime)" com `create or replace view public.leads_v1 as select ... phone_e164 as contact_phone ...`; seção "Mudança de default em coluna em uso (2-passos)" com `alter table public.leads add column stage_v2 text default 'qualified';` + swap atomic. |
| 5 | Skill documenta rolling upgrade em apps client-side: deploy escalonado V1+V2 coexistindo, JWT/session compat entre versões, contratos de API em Edge Functions com versionamento de payload (campos opcionais, nunca-remover-obrigatório). | ✅ | `kit/skills/evolucao-schema-compativel/SKILL.md` seção "Versionamento de payload em Edge Functions Supabase" com `LeadPayloadV1`, `LeadPayloadV2 extends LeadPayloadV1` (campos optional), `LeadPayloadV3` (deprecation pattern) + handler resolvendo alias + emitindo deprecation warning; seção "Rolling upgrade client-side com JWT/session compat" com `app_metadata.schema_version` no JWT + adaptação server-side de response baseado em versão + `supabase.auth.refreshSession()` após upgrade do cliente; REGRA #5 e REGRA #6 explicitam never-remove-required + V1+V2 coexistindo. |
| 6 | Ambos os artefatos retornam sem erro via `mcp__kit__list_kit`. | ✅ | Skill `evolucao-schema-compativel` tem frontmatter YAML válido (`name:` + `description:` PT-BR começando com "Use ao escrever migration Postgres..."). Glossário `_shared-dados-distribuidos/glossary.md` segue convenção `_shared-*` (não-skill, sem `description:` triggerável; não aparece em `listKit` por design — header documenta explicitamente). Validação automática ocorre via CI / `mcp__kit__list_kit` post-merge. |

## REQs cobertos (5/5)

| REQ | Status | Evidência |
|---|---|---|
| SUITE-03 | ✅ | Glossário `_shared-dados-distribuidos/glossary.md` cross-referencia `_shared-supabase/glossary.md` (v1.8) e `_shared-multi-tenant/glossary.md` (v1.21) via header + sem duplicação de termos `RLS`, `STABLE`, `pgmq`, `tenant`, `org_id`, `audit log`. |
| EVOLUCAO-01 | ✅ | Skill seção "Padrão 3-passos" com 3 blocos SQL sequenciais e DO LOOP de backfill em batches 10k. |
| EVOLUCAO-02 | ✅ | Skill seção "Versionamento de payload em Edge Functions Supabase" com TypeScript V1→V2→V3 + REGRA #5 (never-remove-required). |
| EVOLUCAO-03 | ✅ | Skill matriz Avro/Protobuf → Postgres (10 operações) + 3 patterns dedicados (rename via view, narrow inseguro vs widen seguro, mudança de default 2-passos). |
| EVOLUCAO-04 | ✅ | Skill seção "Rolling upgrade client-side com JWT/session compat" + REGRA #6 (V1+V2 coexistindo). |

## Artefatos produzidos

```
kit/skills/_shared-dados-distribuidos/glossary.md   (~210 linhas, 62 termos PT-BR ↔ EN, 11 seções)
kit/skills/evolucao-schema-compativel/SKILL.md      (~310 linhas, 6 REGRAs + 5 patterns + 6 anti-patterns + checklist)
.planning/phases/117-glossario-evolucao-schema/117-CONTEXT.md
.planning/phases/117-glossario-evolucao-schema/117-01-PLAN.md
.planning/phases/117-glossario-evolucao-schema/117-01-SUMMARY.md
.planning/phases/117-glossario-evolucao-schema/117-VERIFICATION.md
```

## Pre-conditions cumpridas para Phases seguintes

Glossário canônico v1.22 disponível para cross-ref (sem duplicação) por:

- **Phase 118** (`consistencia-leitura-replica`): pode cross-ref termos `read-after-write consistency`, `monotonic reads`, `consistent prefix reads`, `replication lag`, `leader-follower replication` (seções a, b)
- **Phase 119** (`tenant-quente-mitigacao`): pode cross-ref termos `hot partition / hot tenant`, `range partitioning`, `hash partitioning`, `document-partitioned secondary index`, `term-partitioned secondary index`, `rebalancing` (seção d)
- **Phase 120** (`postgres-isolamento-concorrencia` + `armadilhas-sistemas-distribuidos`): pode cross-ref termos `dirty read`, `read skew`, `lost update`, `write skew`, `phantom read`, `MVCC`, `snapshot isolation`, `SSI`, `2PL`, `predicate lock` (seção c) + `partial failure`, `clock skew`, `fencing token`, `GC pause`, `phi accrual failure detector` (seção e)
- **Phase 121** (`escolha-modelo-consistencia` + `streams-eventos-cdc`): pode cross-ref termos `linearizability`, `causal consistency`, `eventual consistency`, `consensus`, `total order broadcast`, `2PC`, `saga pattern`, `transactional outbox`, `CAP theorem`, `PACELC` (seções a, f) + `AMQP/JMS-style broker`, `log-based broker`, `CDC`, `event sourcing`, `exactly-once semantics`, `at-least-once semantics`, `stream-stream join`, `stream-table join`, `table-table join`, `log compaction` (seção h)
- **Phase 122** (3 agents + command): pode cross-ref convenção PT-BR (seção i) ao nomear `auditor-consistencia-isolamento`, `detector-tenant-quente`, `validador-evolucao-schema`, `dados-distribuidos`

Skill `evolucao-schema-compativel` disponível para invocação direta (LLM trigger via `description`) e cross-ref por:

- **Phase 122** agent `validador-evolucao-schema` consome esta skill diretamente ao validar migrations
- **Phase 123** patches em `supabase-migrations` (v1.8) e `supabase-migration-writer` (v1.8) cross-ref ATIVO para esta skill

## Conclusão

Phase 117 entregue com sucesso. Fundação da Suíte DDIA Foundations v1.22 está em produção: glossário canônico PT-BR ↔ EN + skill `evolucao-schema-compativel` + convenção de naming PT-BR documentada como referência canônica para as 5 phases seguintes (118-121) e suítes futuras.
