# Fase 121: Escolha de Modelo de Consistência + Streams/Eventos/CDC (DDIA Ch 9 + Ch 11) — Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (skip_discuss)

<domain>
## Limite da Fase

2 skills da Suíte DDIA Foundations v1.22:

1. **`escolha-modelo-consistencia`** — aplica conceitos de **Consistency and Consensus** (DDIA Ch 9) ao contexto Postgres + Supabase. Foco em: (a) árvore de decisão linearizabilidade vs causal vs eventual; (b) uniqueness constraints distribuídos via single-leader Postgres; (c) análogos de total order broadcast em Postgres (logical replication slots, WAL position, `pg_logical_emit_message`); (d) CAP/PACELC mapeado ao real; (e) limitações 2PC + alternativas modernas (sagas, transactional outbox).

2. **`streams-eventos-cdc`** — aplica conceitos de **Stream Processing** (DDIA Ch 11) ao contexto Postgres + Supabase + pgmq + Realtime. Foco em: (a) brokers AMQP/JMS-style vs log-based; (b) padrões CDC em Postgres (3 abordagens); (c) event sourcing em Postgres com tabela append-only + projeções via MV ou trigger; (d) exactly-once em pgmq via dedup table + idempotency key + transactional outbox; (e) 3 tipos de stream join com SQL exemplo; (f) log compaction strategy.

REQs cobertos: MODELO-01..05 (5 REQs) + STREAMS-01..06 (6 REQs) = 11 REQs total.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Fase de discuss pulada via workflow.skip_discuss=true. Decisões guiadas por:
- Pattern do `multi-tenant-rls-hierarchy/SKILL.md` (v1.21) como template estrutural — frontmatter PT-BR, "Quando usar" com trigger phrases, "Regras absolutas" numeradas, "Patterns canônicos" com SQL real, "Anti-patterns" numerados, "Ver também" com cross-refs.
- Tradução conceitual: DDIA Ch 9 e Ch 11 são genéricos (Kafka, Cassandra, Spanner) — estas skills traduzem para Postgres + Supabase + pgmq + Realtime. Total order broadcast vira logical replication WAL; log-based broker vira pgmq; CDC vira wal2json + Realtime broadcast.
- Cross-suite: skills consomem conceitos de `audit-log-multi-tenant` (v1.21 — event sourcing semântica), `supabase-cron-queues` (v1.8 — pgmq pattern), `supabase-realtime` (v1.8 — broadcast como CDC stream). Cross-refs ATIVOS via Markdown link relativo.
- Cross-ref para `_shared-dados-distribuidos/glossary.md` (Phase 117) já criado.

### Decisões cristalizadas pela pesquisa (vinculantes)

**Skill `escolha-modelo-consistencia`:**
- Árvore de decisão com 2 perguntas canônicas → 3 modelos (linearizabilidade, causal, eventual) + 3 exemplos canônicos por modelo.
- Uniqueness constraints: nativo `UNIQUE` Postgres é linearizável via single-leader; app-level `UPDATE+SELECT` é race mesmo com `SELECT FOR UPDATE` em outros casos. Padrão correto: `INSERT ... ON CONFLICT DO NOTHING RETURNING id`.
- Total order broadcast em Postgres: `pg_current_wal_lsn()` (posição WAL monotônica), `pg_logical_emit_message(transactional, prefix, content)` (broadcast custom), logical replication slots (consumers veem mesma ordem WAL).
- CAP/PACELC tabela 4 quadrantes: P+C (Postgres single-leader durante partition), P+A (Cassandra/DynamoDB), Normal+C (Spanner/CockroachDB), Normal+L (DynamoDB/Cassandra).
- 2PC limitações: blocking se coordinator morre, performance impact (2 round-trips), falta de heuristic recovery. Alternativas: sagas (compensação local), transactional outbox (atomic DB write + event).

**Skill `streams-eventos-cdc`:**
- Tabela canônica brokers: AMQP/JMS (RabbitMQ, LISTEN/NOTIFY) vs log-based (Kafka, pgmq) — 6 colunas (mensagem após ack, multi-consumer, replay, use case).
- 3 padrões CDC em Postgres: (1) wal2json + Supabase Realtime broadcast — zero infra, baixa latência; (2) pglogical → Kafka — robusto para warehousing; (3) Trigger-based — casos custom.
- Event sourcing: tabela `events` append-only com `aggregate_id` + `event_type` + `payload jsonb`; projeções via MV (`order_state`) ou trigger-maintained denormalization. Cross-ref ATIVO para `audit-log-multi-tenant` (v1.21) — audit_log É event sourcing semantics.
- Exactly-once em pgmq: dedup table com `unique(event_id)` + `INSERT INTO processed_events ... ON CONFLICT DO NOTHING` na mesma transação do handler + idempotency key.
- 3 tipos stream join: stream-stream (pedido + pagamento dentro de 5min via janela tumbling), stream-table (CDC + atividade — JOIN com tabela atualizada por CDC), table-table (merge de orders changelog + customers changelog).
- Log compaction: pgmq não tem nativo (usa retention TTL via `vacuum_archive`); event sourcing precisa snapshot periódico + compact (`DELETE FROM events WHERE id < snapshot_lsn`).

</decisions>

<code_context>
## Insights do Código Existente

- `kit/skills/multi-tenant-rls-hierarchy/SKILL.md` (v1.21) — template estrutural canônico (5 seções)
- `kit/skills/_shared-dados-distribuidos/glossary.md` (v1.22 Phase 117) — define `linearizability`, `causal consistency`, `eventual consistency`, `total order broadcast`, `transactional outbox`, `saga pattern`, `CAP theorem`, `PACELC`, `AMQP/JMS-style broker`, `log-based broker`, `CDC`, `event sourcing`, `exactly-once semantics`, `stream-stream join`, `stream-table join`, `table-table join`, `log compaction` — reaproveitáveis
- `kit/skills/audit-log-multi-tenant/SKILL.md` (v1.21) — event sourcing semantics (append-only) referenciado por `streams-eventos-cdc`
- `kit/skills/supabase-cron-queues/SKILL.md` (v1.8) — pgmq pattern referenciado por ambas
- `kit/skills/supabase-realtime/SKILL.md` (v1.8) — broadcast como CDC stream
- `.claude/ddia-extracted.txt` linhas 13198-15600 (Ch 9 Consistency and Consensus; summary 15323-15425)
- `.claude/ddia-extracted.txt` linhas 17812-19637 (Ch 11 Stream Processing; summary 19408-19481)

</code_context>

<specifics>
## Ideias Específicas

- **Anchor narrativo `escolha-modelo-consistencia`**: o exemplo "slug global cross-tenant" (DDIA Ch 9 — uniqueness constraint requer linearizabilidade) é canônico para B2B SaaS — slugs de organizações precisam ser únicos globalmente, não pode ser eventual consistency.

- **Anchor narrativo `streams-eventos-cdc`**: ponto da skill é estabelecer ponte explícita audit_log v1.21 ↔ event sourcing DDIA Ch 11 — quem implementou audit_log já fez event sourcing parcial, pode escalar para projeções.

- **Decision tree `escolha-modelo-consistencia`** segue formato pergunta-binária canônica do livro: pergunta 1 ("atomic ordered global?") → linearizabilidade ou continuar; pergunta 2 ("relação causal A→B?") → causal ou eventual.

</specifics>

<deferred>
## Ideias Adiadas

- Agent `consistency-model-selector` (auto-escolher modelo dado descrição do feature): defer para v1.23+ se houver demanda. Skill standalone basta para v1.22 — escolha precisa de julgamento humano.
- Agent `cdc-pipeline-implementer` (auto-aplicar wal2json setup): defer — exige conhecimento específico do projeto e isso é mais agent-de-implementação que skill.
- Validador automático de exactly-once via mutation testing: defer para v1.23 cross-suite (precisa integrar com `ai-mutation-tester` v1.20).
- Skill specifica `transactional-outbox-pattern`: condensada como anti-pattern + pattern canônico dentro de `streams-eventos-cdc` STREAMS-04 (não justifica skill própria — apenas 1 pattern).

</deferred>
</content>
</invoke>