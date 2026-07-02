# Phase 121 — Plan 01 Summary

**Status:** done
**Concluído:** 2026-05-10

## Arquivos criados

| Caminho | Linhas | Descrição |
|---|---|---|
| `kit/skills/escolha-modelo-consistencia/SKILL.md` | ~440 | Skill canônica cobrindo 5 critérios DDIA Ch 9 (linearizabilidade vs causal vs eventual; uniqueness via single-leader; total order broadcast Postgres; CAP/PACELC; 2PC alternativas) aplicados a Postgres + Supabase |
| `kit/skills/streams-eventos-cdc/SKILL.md` | ~545 | Skill canônica cobrindo 6 critérios DDIA Ch 11 (brokers AMQP vs log-based; 3 padrões CDC; event sourcing; exactly-once pgmq; 3 stream joins; log compaction) aplicados a Postgres + Supabase + pgmq + Realtime |

## REQs cobertos (11)

### Skill `escolha-modelo-consistencia` (MODELO-01..05)

| REQ | Descrição | Evidência (path:section) |
|---|---|---|
| **MODELO-01** | Árvore de decisão linearizabilidade vs causal vs eventual + 3 exemplos canônicos por modelo | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-01 — Árvore de decisão linearizabilidade vs causal vs eventual` (decision tree ASCII + tabela 3 modelos × 3 exemplos canônicos + trade-offs em latência) |
| **MODELO-02** | Uniqueness constraints distribuídos via single-leader Postgres (UNIQUE nativo é linearizável; app-level UPDATE+SELECT é race; padrão `INSERT ... ON CONFLICT DO NOTHING RETURNING id`) | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-02 — Uniqueness constraints distribuídos via single-leader Postgres` (schema canônico organizations + ANTI-PATTERN race condition + PADRÃO CORRETO ON CONFLICT + variação leitura owner existente) |
| **MODELO-03** | Análogos de total order broadcast em Postgres — `pg_current_wal_lsn()`, `pg_logical_emit_message()`, logical replication slots | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-03 — Análogos de total order broadcast em Postgres` (3 análogos com SQL + tabela quando usar cada + motivação canônica DDIA Ch 9) |
| **MODELO-04** | CAP teorema → PACELC com tabela 4 quadrantes (P+C, P+A, Normal+C, Normal+L) + mapeamento Postgres/Supabase | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-04 — CAP teorema → PACELC com tabela 4 quadrantes` (tabela 4 estados × 4 colunas + mapeamento explícito Postgres single-leader = CP/PC + REGRA derivada) |
| **MODELO-05** | 2PC limitações + alternativas (sagas, transactional outbox) com SQL exemplo | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-05 — 2PC limitações + alternativas modernas` (diagrama 2PC + 3 limitações canônicas + saga SQL + transactional outbox SQL com `for update skip locked` + cross-ref ATIVO audit-log-multi-tenant) |

### Skill `streams-eventos-cdc` (STREAMS-01..06)

| REQ | Descrição | Evidência (path:section) |
|---|---|---|
| **STREAMS-01** | Brokers AMQP/JMS-style vs log-based — tabela canônica 6 colunas + decision tree + exemplo SQL ambos | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-01 — Brokers AMQP/JMS-style vs log-based` (tabela comparativa + decision tree ASCII + exemplo LISTEN/NOTIFY + exemplo pgmq completo) |
| **STREAMS-02** | 3 padrões CDC em Postgres — wal2json + Realtime, pglogical → Kafka, trigger-based + tabela use cases | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-02 — 3 padrões CDC em Postgres` (3 abordagens com SQL + JS client Realtime + tabela use cases canônicos) |
| **STREAMS-03** | Event sourcing em Postgres — tabela `events` append-only + projeções (MV ou trigger denormalization) + cross-ref ATIVO audit-log-multi-tenant | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-03 — Event sourcing em Postgres` (schema canônico events + REVOKE DELETE/UPDATE + projeção MV + projeção trigger + tabela MV vs trigger + cross-ref ATIVO audit-log) |
| **STREAMS-04** | Exactly-once em pgmq — dedup table + handler atomic + idempotency key + transactional outbox | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-04 — Exactly-once em pgmq` (3 técnicas: dedup table SQL + handler atomic com unique_violation exception + idempotency via UPDATE condicional/INSERT ON CONFLICT + cross-ref ATIVO escolha-modelo-consistencia) |
| **STREAMS-05** | 3 tipos stream join — stream-stream com janela tumbling 5min, stream-table CDC enrichment, table-table merge changelogs | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-05 — 3 tipos de stream join com SQL exemplo` (3 SQL completos: order_payment_join_5min view, user_events enrichment, orders_denorm MV com triggers de refresh) |
| **STREAMS-06** | Log compaction — pgmq retention TTL + snapshot manual em event sourcing com `compact_aggregate_events` | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-06 — Log compaction strategy` (pgmq purge_archive via pg_cron + tabela snapshots + função create_snapshot + função compact_aggregate_events com SECURITY DEFINER + estratégia canônica 1000 eventos) |

## Cross-refs ATIVOS

### Skill `escolha-modelo-consistencia`
- `../_shared-dados-distribuidos/glossary.md` (Phase 117 v1.22)
- `../audit-log-multi-tenant/SKILL.md` (v1.21) — pattern transactional outbox
- `../supabase-cron-queues/SKILL.md` (v1.8) — pgmq pattern + cleanup retention
- `../supabase-database-functions/SKILL.md` (v1.8) — STABLE/IMMUTABLE markers
- `../streams-eventos-cdc/SKILL.md` (Phase 121 irmã) — event sourcing como aplicação prática

### Skill `streams-eventos-cdc`
- `../_shared-dados-distribuidos/glossary.md` (Phase 117 v1.22)
- `../audit-log-multi-tenant/SKILL.md` (v1.21) — audit_log É event sourcing semantics (REQ STREAMS-03)
- `../supabase-cron-queues/SKILL.md` (v1.8) — pgmq pattern + retention
- `../supabase-realtime/SKILL.md` (v1.8) — broadcast como CDC stream (REQ STREAMS-02)
- `../escolha-modelo-consistencia/SKILL.md` (Phase 121 irmã) — transactional outbox base de exactly-once (REQ STREAMS-04)
- `../supabase-database-functions/SKILL.md` (v1.8)

## Padrões reaproveitados

- Estrutura canônica de SKILL.md: frontmatter PT-BR, "Quando usar" + trigger phrases, "Regras absolutas" numeradas, "Patterns canônicos" com SQL real, "Anti-patterns" numerados, "Ver também" com cross-refs (template: `multi-tenant-rls-hierarchy/SKILL.md` v1.21).
- Convenção `private.*` schema para helpers + `pg_cron` para refresh assíncrono (consumido de `supabase-postgres-style` v1.8 e `supabase-cron-queues` v1.8).
- Convenção REVOKE DELETE/UPDATE para append-only + RLS (consumido de `audit-log-multi-tenant` v1.21).
- Convenção `INSERT ... ON CONFLICT DO NOTHING RETURNING id` para uniqueness atomic (canonizado nesta fase, válido como referência geral).
- Convenção `for update skip locked` para múltiplos workers em paralelo (consumido de `supabase-cron-queues` v1.8 + canonizado para outbox).

## Próximo passo

Commit 4 — adicionar SUMMARY + VERIFICATION (este arquivo + 121-VERIFICATION.md). Próxima fase v1.22: Phase 122 (`agents-comando`) ou Phase 123 (`cross-suite-release`) conforme roadmap.
</content>
</invoke>