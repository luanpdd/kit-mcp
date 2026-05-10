---
status: passed
phase: 121
verified_at: 2026-05-10
---

# Phase 121 — Verification

## Critérios de sucesso (REQs MODELO-01..05 + STREAMS-01..06 = 11 REQs)

### Skill `escolha-modelo-consistencia` (DDIA Ch 9)

| # | Critério | Status | Evidência (path:section) |
|---|---|---|---|
| 1 | **MODELO-01** — Skill apresenta árvore de decisão linearizabilidade vs causal vs eventual com 3 exemplos canônicos por modelo (slug global, chat, feed social) + trade-offs em latência | passed | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-01 — Árvore de decisão linearizabilidade vs causal vs eventual` — decision tree ASCII completo (2 perguntas binárias → 3 modelos) + tabela 3 modelos × 3 exemplos cada (slug global/license key/custom domain; chat/comentários/issue tracker; feed/contadores/métricas) + bullet trade-offs latência |
| 2 | **MODELO-02** — Skill cobre uniqueness constraints distribuídos via single-leader Postgres: `UNIQUE` constraint nativo é linearizável; ANTI-PATTERN app-level `SELECT FOR UPDATE` + INSERT é race condition; PADRÃO CORRETO `INSERT ... ON CONFLICT DO NOTHING RETURNING id` | passed | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-02 — Uniqueness constraints distribuídos via single-leader Postgres` — schema canônico organizations + ANTI-PATTERN com transação e explicação ("`SELECT FOR UPDATE` lockeia rows existentes — quando 0 rows, não há nada para lockar") + PADRÃO CORRETO + variação leitura owner via CTE union all |
| 3 | **MODELO-03** — Skill documenta análogos de total order broadcast em Postgres: logical replication slots, `pg_current_wal_lsn()`, `pg_logical_emit_message(transactional, prefix, content)` + quando necessário (invariantes globais cross-tenant) | passed | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-03 — Análogos de total order broadcast em Postgres` — 3 análogos com SQL completo (LSN coluna em events; `pg_logical_emit_message` com transactional=true; `pg_create_logical_replication_slot` + `pg_logical_slot_get_changes`) + tabela "quando usar cada" + motivação canônica DDIA (licença unique global, billing event ordering) |
| 4 | **MODELO-04** — Skill apresenta CAP teorema → PACELC com tabela 4 quadrantes (P+C, P+A, Normal+C, Normal+L) + mapeamento Postgres single-leader = CP/PC | passed | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-04 — CAP teorema → PACELC com tabela 4 quadrantes` — tabela 4 estados × 4 colunas (Trade-off, Sistemas exemplares, Quando faz sentido) + mapeamento explícito Postgres single-leader = CP/PC, Supabase read replicas = CP no líder + PL na réplica, eventual via pgmq = AP/PL + REGRA derivada (declarar EXPLICITAMENTE) |
| 5 | **MODELO-05** — Skill cobre 2PC limitações (3 canônicas: blocking se coordinator morre, performance impact, falta de heuristic recovery) + alternativas modernas com SQL exemplo (sagas, transactional outbox) | passed | `kit/skills/escolha-modelo-consistencia/SKILL.md` seção `### REQ MODELO-05 — 2PC limitações + alternativas modernas` — diagrama ASCII 2PC + 3 limitações canônicas detalhadas + Saga SQL (cancel order + estornar + restaurar inventário com saga_steps) + Transactional outbox completo (schema + index parcial + pattern atomic + worker assíncrono com `for update skip locked`) + cross-ref ATIVO `audit-log-multi-tenant` (audit_log É outbox) |

### Skill `streams-eventos-cdc` (DDIA Ch 11)

| # | Critério | Status | Evidência (path:section) |
|---|---|---|---|
| 6 | **STREAMS-01** — Skill apresenta tabela canônica AMQP/JMS-style (RabbitMQ, LISTEN/NOTIFY) vs log-based (Kafka, pgmq) com 6 colunas (Tipo, Exemplos, Mensagem após ack, Multi-consumer, Replay, Use case) + decision tree | passed | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-01 — Brokers AMQP/JMS-style vs log-based` — tabela comparativa 2 linhas × 6 colunas + decision tree ASCII (4 perguntas → log-based ou AMQP) + exemplo SQL LISTEN/NOTIFY (notify ch_orders + listen ch_orders) + exemplo SQL pgmq completo (create + send + read com vt + delete + archive) |
| 7 | **STREAMS-02** — Skill cobre 3 padrões CDC em Postgres: (a) wal2json + Supabase Realtime broadcast, (b) pglogical → Kafka externo, (c) Trigger-based + tabela use cases (sync índice, desnormalização, sync multi-region) | passed | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-02 — 3 padrões CDC em Postgres` — Abordagem 1 (replica identity full + JS client Realtime channel postgres_changes) + Abordagem 2 (pglogical create_node + create_replication_set + Debezium) + Abordagem 3 (trigger emit_lead_qualified_event com outbox) + tabela 5 use cases canônicos × abordagem recomendada |
| 8 | **STREAMS-03** — Skill cobre event sourcing em Postgres: tabela `events` source-of-truth (append-only, REVOKE DELETE/UPDATE) + projeções via Materialized View OU trigger-maintained denormalization + tabela MV vs trigger + cross-ref ATIVO para `audit-log-multi-tenant` | passed | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-03 — Event sourcing em Postgres` — schema events com aggregate_id, aggregate_type, event_type, payload jsonb, metadata + 2 indexes canônicos + REVOKE delete/update (REGRA #3) + cross-ref ATIVO explícito audit-log-multi-tenant ("audit_log É event sourcing semantics") + projeção MV order_state com array_agg + projeção trigger order_current_state + tabela MV vs trigger 4 critérios |
| 9 | **STREAMS-04** — Skill cobre exactly-once em pgmq via 3 técnicas: dedup table com `unique(event_id)`, handler atomic (INSERT dedup + processamento na mesma transação) + idempotency key + transactional outbox + cross-ref ATIVO `escolha-modelo-consistencia` | passed | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-04 — Exactly-once em pgmq` — Técnica 1 (tabela processed_events com event_id PK + processor) + Técnica 2 (worker SECURITY DEFINER atomic com pgmq.read + INSERT dedup + EXCEPTION WHEN unique_violation) + Técnica 3 (UPDATE condicional WHERE status != 'paid' + INSERT ON CONFLICT) + cross-ref ATIVO `escolha-modelo-consistencia` (transactional outbox base) |
| 10 | **STREAMS-05** — Skill cobre 3 tipos de stream join com SQL exemplo: stream-stream com janela tumbling 5min, stream-table CDC + atividade enrichment, table-table merge changelogs | passed | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-05 — 3 tipos de stream join com SQL exemplo` — Tipo 1 stream-stream (view order_payment_join_5min com BETWEEN o.event_at + interval '5 minutes' + date_trunc tumbling window_start) + Tipo 2 stream-table (user_events JOIN users com cuidado canônico sobre estado atual vs momento do evento) + Tipo 3 table-table (MV orders_denorm com 2 triggers de refresh CONCURRENTLY em orders e customers changelog) |
| 11 | **STREAMS-06** — Skill cobre log compaction strategy: pgmq retention TTL via `vacuum_archive`/`purge_archive` + snapshot manual em event sourcing (tabela snapshots + função `create_snapshot` + função `compact_aggregate_events` SECURITY DEFINER) + estratégia canônica 1000 eventos | passed | `kit/skills/streams-eventos-cdc/SKILL.md` seção `### REQ STREAMS-06 — Log compaction strategy` — pgmq purge_archive via cron.schedule diária 30 dias + tabela snapshots (aggregate_id PK, snapshot_lsn bigint, state jsonb) + função create_snapshot (jsonb_build_object com array_agg + max(id) + ON CONFLICT DO UPDATE) + função compact_aggregate_events SECURITY DEFINER com REVOKE EXECUTE FROM authenticated/anon + estratégia "snapshot a cada 1000 eventos por aggregate" |

## Restrições atendidas

| Restrição | Status | Evidência |
|---|---|---|
| Frontmatter `description` em PT-BR | passed | `kit/skills/escolha-modelo-consistencia/SKILL.md` linhas 2-3; `kit/skills/streams-eventos-cdc/SKILL.md` linhas 2-3 |
| Headings PT-BR em ambas skills | passed | "Quando usar", "Regras absolutas", "Patterns canônicos", "Anti-patterns", "Ver também" em ambas |
| Termos técnicos canônicos preservados | passed | `linearizabilidade`, `total order broadcast`, `CDC`, `event sourcing`, `exactly-once`, `transactional outbox`, `WAL`, `LSN`, `MVCC`, `pgmq`, `wal2json`, `pg_logical_emit_message`, `at-least-once`, `tumbling window`, `replica identity full`, `pglogical` mantidos em EN dentro do conteúdo PT-BR |
| Code blocks SQL em EN com comentários PT-BR | passed | Todos os blocos SQL têm sintaxe Postgres EN; comentários `-- PT-BR` (ex: `-- Schema canônico — slug global cross-tenant`, `-- ANTI-PATTERN — Race condition garantida`, `-- Atomic: ou ambos commitam, ou nenhum`) |
| Cross-refs Markdown ATIVOS (links relativos) | passed | Skill modelo: 5 links em "Ver também" + 2 cross-refs ATIVOS no corpo (audit-log-multi-tenant em REQ MODELO-05; supabase-cron-queues em Anti-pattern 5). Skill streams: 6 links em "Ver também" + 3 cross-refs ATIVOS no corpo (audit-log-multi-tenant em REQ STREAMS-03; escolha-modelo-consistencia em REQ STREAMS-04; supabase-realtime em REQ STREAMS-02) |
| Cross-suite invocation pattern (não duplicar lógica de v1.21/v1.8) | passed | Skill modelo cross-ref `audit-log-multi-tenant` v1.21 sem reescrever audit_log; skill streams cross-ref `supabase-cron-queues` v1.8 sem reescrever pgmq pattern. Lógica nova (uniqueness via ON CONFLICT, total order broadcast Postgres, exactly-once dedup) é específica desta fase |
| Zero alteração em `src/core/` | passed | Apenas `kit/skills/escolha-modelo-consistencia/`, `kit/skills/streams-eventos-cdc/` + `.planning/phases/121-modelo-streams/` modificados |

## Artefatos produzidos

```
kit/skills/escolha-modelo-consistencia/SKILL.md          (~440 linhas — frontmatter + 5 seções canônicas)
kit/skills/streams-eventos-cdc/SKILL.md                  (~545 linhas — frontmatter + 5 seções canônicas)
.planning/phases/121-modelo-streams/121-CONTEXT.md
.planning/phases/121-modelo-streams/121-01-PLAN.md
.planning/phases/121-modelo-streams/121-01-SUMMARY.md
.planning/phases/121-modelo-streams/121-VERIFICATION.md
```

## Conclusão

Phase 121 entregue com sucesso. **2 skills** (escolha-modelo-consistencia + streams-eventos-cdc) cobrem **11 critérios canônicos** derivados de DDIA Ch 9 (Consistency and Consensus) e Ch 11 (Stream Processing) traduzidos para Postgres + Supabase + pgmq + Realtime. Cross-refs ATIVOS estabelecidos com a Suíte DDIA Foundations v1.22 (`_shared-dados-distribuidos`), com a Suíte Multi-Tenant SaaS B2B v1.21 (`audit-log-multi-tenant`) e com a Suíte Supabase v1.8 (`supabase-cron-queues`, `supabase-realtime`, `supabase-database-functions`). Pattern transactional outbox canonizado nas duas skills (modelo descreve como alternativa a 2PC; streams aplica como base de exactly-once). Pattern `INSERT ... ON CONFLICT DO NOTHING RETURNING id` para uniqueness atomic canonizado para uso geral.
</content>
</invoke>