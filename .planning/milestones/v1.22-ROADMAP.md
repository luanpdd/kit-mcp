# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.22 — Suíte DDIA Foundations (Phases 117–123)

> Gerado: 2026-05-10 | 7 phases | 7 skills + 3 agents + 1 command + 1 glossário | 60 REQs (cobertura 100%)

**Objetivo:** Adicionar a 8ª suíte ao kit-mcp derivada de *Designing Data-Intensive Applications* (Martin Kleppmann, O'Reilly 2017, ISBN 978-1-449-37332-0). Fecha gaps de **consistência, partitioning, isolation, distributed systems traps e event streams** identificados nas suítes Supabase v1.8 + Multi-Tenant v1.21. Cobre capítulos 4, 5, 6, 7, 8, 9, 11.

**Restrição crítica:** Content-only milestone — zero alterações em `src/core/`. Stable API v1.0+ preservada.

**Convenção nova (a partir de v1.22):** PT-BR para naming de skills/agents/commands. Termos técnicos canônicos (CDC, RLS, MVCC, write skew) preservados em descrições internas pois são canônicos no manual oficial Postgres/livro DDIA, mas nomes de arquivos/identificadores em PT-BR claros.

**Padrão cross-suite:** Agents v1.22 delegam para agents v1.8 (`supabase-migration-writer`, `supabase-edge-fn-writer`) e v1.21 (`multi-tenant-isolation-auditor`, `crm-pipeline-implementer`) via cross-ref Markdown + `Task()` handoff. Nunca reimplementam lógica já coberta — pattern formalizado em v1.21 herdado.

**Convenção de conteúdo:** PT-BR em texto narrativo. Code blocks em EN com comentários PT-BR (precedente v1.8 → v1.21).

---

### Ondas de Execução

```
Onda 1 (paralelo):  Phase 117  Phase 119
Onda 2 (paralelo):  Phase 118  Phase 120  Phase 121
Onda 3:             Phase 122
Onda 4:             Phase 123
```

**Rationale das ondas:**
- Phase 117 (glossário compartilhado + EVOLUCAO) e Phase 119 (TENANT) podem iniciar em paralelo — TENANT consome conceitos próprios do DDIA Ch 6 sem dependência do glossário (vocabulário básico de partitioning é auto-explicativo na própria skill).
- Phase 118 (LEITURA), Phase 120 (ISOLAMENTO + ARMADILHAS) e Phase 121 (MODELO + STREAMS) ficam em Onda 2 pois cross-referenciam o glossário canônico produzido em Phase 117.
- Phase 122 (Agents + command) entra em Onda 3 — agents consomem todas as 7 skills (`auditor-consistencia-isolamento` consome ISOLAMENTO + ARMADILHAS; `detector-tenant-quente` consome TENANT; `validador-evolucao-schema` consome EVOLUCAO).
- Phase 123 (cross-suite integration + release artifacts) é Onda 4 final pois patches em skills/agents v1.8 + v1.11 + v1.21 referenciam artefatos novos de v1.22.

---

### Phase 117: Glossário Compartilhado + Evolução de Schema Compatível (Ch 4)

**Objetivo:** Estabelecer vocabulário canônico PT-BR ↔ EN da Suíte DDIA + skill `evolucao-schema-compativel` documentando padrão 3-passos para Postgres + análogos Avro/Protobuf + rolling upgrade. Fundação sobre a qual as skills seguintes se apoiam.

**Tipo:** Content-only

**Artefatos produzidos:**
- `kit/skills/_shared-dados-distribuidos/glossary.md`
- `kit/skills/evolucao-schema-compativel/SKILL.md`

**REQs cobertos:** SUITE-03, EVOLUCAO-01, EVOLUCAO-02, EVOLUCAO-03, EVOLUCAO-04 (5 REQs)

**Pode ser paralelo com:** Phase 119

**Critérios de sucesso observáveis:**

1. O glossário `_shared-dados-distribuidos/glossary.md` define ≥ 15 termos canônicos PT-BR ↔ EN: linearizabilidade, consistência causal, consistência eventual, atualização perdida (lost update), distorção de escrita (write skew), leitura fantasma (phantom read), MVCC, CDC, event sourcing, fencing token, partição quente (hot partition), líder-seguidor (leader-follower), broker baseado em log, snapshot isolation, serializable snapshot isolation (SSI).
2. O glossário documenta a convenção PT-BR para naming de artefatos (a partir de v1.22) com exemplos: `evolucao-schema-compativel` (PT-BR) vs `multi-tenant-rls-hierarchy` (EN, pré-v1.22 preservado).
3. A skill `evolucao-schema-compativel` apresenta padrão 3-passos com SQL completo em cada passo: (a) `ALTER TABLE ... ADD COLUMN x text` (nullable), (b) `UPDATE ... SET x = ... WHERE x IS NULL` em batches de 10k rows, (c) `ALTER TABLE ... ALTER COLUMN x SET NOT NULL` apenas após backfill 100% verificado.
4. A skill mapeia análogos Avro/Protobuf de schema evolution para Postgres: rename de coluna via `CREATE OR REPLACE VIEW`, alargamento `varchar(50)→varchar(255)` seguro vs estreitamento inseguro, mudança de default em coluna em uso (deve ser feita em 2 passos com backfill).
5. A skill documenta rolling upgrade em apps client-side: deploy escalonado V1+V2 coexistindo, JWT/session compat entre versões, contratos de API em Edge Functions com versionamento de payload (campos opcionais, nunca-remover-obrigatório).
6. Ambos os artefatos retornam sem erro via `mcp__kit__list_kit`.

---

### Phase 118: Consistência de Leitura em Réplicas (Ch 5)

**Objetivo:** Skill `consistencia-leitura-replica` documentando os 3 problemas canônicos do DDIA Ch 5 (read-after-write, leituras monotônicas, prefixo causal) mapeados para contexto Supabase (Supavisor read replicas, Realtime broadcast vs DB read).

**Tipo:** Content-only

**Artefatos produzidos:**
- `kit/skills/consistencia-leitura-replica/SKILL.md`

**REQs cobertos:** LEITURA-01, LEITURA-02, LEITURA-03, LEITURA-04 (4 REQs)

**Depende de:** Phase 117 (glossário canônico)

**Pode ser paralelo com:** Phase 120, Phase 121

**Critérios de sucesso observáveis:**

1. A skill documenta os 3 problemas canônicos DDIA Ch 5 em seções nomeadas: (a) read-after-write inconsistente (usuário lê própria escrita stale), (b) leituras não-monotônicas (segunda leitura "volta no tempo"), (c) prefixo causal violado (efeito visível antes da causa).
2. A skill mapeia 3 soluções canônicas para Supabase: leitura no líder após escrita do mesmo usuário (write timestamp + janela), sticky session por user_id no roteamento de réplica via header personalizado, detecção de leitura stale via `pg_last_wal_replay_lsn()` comparado com timestamp da escrita.
3. A skill cobre Supavisor read replica routing (porta 6543 transaction mode vs 5432 session mode) com tabela de decisão `pooler.read.*` vs `pooler.transaction.*` e exemplos de connection string para cada caso.
4. A skill cobre interação Realtime broadcast vs leitura no DB com pitfall canônico: broadcast pode chegar antes do commit replicar para read replica → padrão "ler o próprio broadcast" (cliente confia no payload broadcast em vez de re-fetch do DB) com exemplo de código.
5. A skill cross-referencia o glossário `_shared-dados-distribuidos/glossary.md` para termos como "líder-seguidor", "consistência eventual" via link Markdown ativo (sem duplicar definições).

---

### Phase 119: Mitigação de Tenant Quente (Ch 6)

**Objetivo:** Skill `tenant-quente-mitigacao` documentando detecção do "tenant Justin Bieber" + 5 estratégias de mitigação com tradeoffs + particionamento range vs hash + índices secundários + rebalanceamento sem downtime.

**Tipo:** Content-only

**Artefatos produzidos:**
- `kit/skills/tenant-quente-mitigacao/SKILL.md`

**REQs cobertos:** TENANT-01, TENANT-02, TENANT-03, TENANT-04, TENANT-05 (5 REQs)

**Pode ser paralelo com:** Phase 117

**Critérios de sucesso observáveis:**

1. A skill documenta detecção do "tenant Justin Bieber" com 3 métricas canônicas: queries/min ratio (>3× P50 = WARN, >10× P50 = CRITICAL), storage GB ratio com mesmos thresholds, slots de conexão ratio. SQL completo de extração via `pg_stat_statements` + `pg_database_size` agregado por `tenant_id`.
2. A skill apresenta tabela comparativa de 5 estratégias de mitigação com tradeoffs explícitos: (a) rate limit por tenant (impacto UX), (b) pool de conexão isolado via Supavisor multi-pool, (c) read replica dedicada (custo Supabase Pro+), (d) desnormalização (Materialized Views per-tenant, complexidade refresh), (e) request shaping com fila prioritária via pgmq.
3. A skill cobre particionamento range vs hash para `tenant_id` em tabelas > 50k rows/tenant via árvore de decisão: hash quando workload uniforme cross-tenant, range quando hot tenants conhecidos a priori (anchor tenant), com `CREATE TABLE ... PARTITION BY HASH (org_id) PARTITIONS 16` exemplo completo.
4. A skill documenta estratégias de índice secundário (document-partitioned vs term-partitioned) aplicado a queries cross-tenant em views super-admin: document-partitioned (índice local por partição, query precisa scatter-gather) vs term-partitioned (índice global, write mais caro), com recomendação default document-partitioned.
5. A skill cobre rebalanceamento via 4-passos: (a) detectar tenant alvo via thresholds Phase 119.1, (b) `pg_dump --schema=public --table='*tenant_X*'` para schema isolado, (c) `pgbouncer` redirect para nova instância via routing config, (d) cleanup com `DROP SCHEMA tenant_X CASCADE` apenas após 7d sem queries — sem downtime.

---

### Phase 120: Isolamento Postgres + Armadilhas Distribuídas (Ch 7 + Ch 8)

**Objetivo:** Skills `postgres-isolamento-concorrencia` (6 race conditions, isolation level decision tree, lost update + write skew + phantom prevention) + `armadilhas-sistemas-distribuidos` (clock skew, fencing tokens, GC pause, falhas parciais, modelos de sistema). Pareadas porque consumidores típicos enfrentam ambos os problemas simultaneamente em Edge Functions Supabase.

**Tipo:** Content-only

**Artefatos produzidos:**
- `kit/skills/postgres-isolamento-concorrencia/SKILL.md`
- `kit/skills/armadilhas-sistemas-distribuidos/SKILL.md`

**REQs cobertos:** ISOLAMENTO-01, ISOLAMENTO-02, ISOLAMENTO-03, ISOLAMENTO-04, ISOLAMENTO-05, ARMADILHAS-01, ARMADILHAS-02, ARMADILHAS-03, ARMADILHAS-04, ARMADILHAS-05 (10 REQs)

**Depende de:** Phase 117 (glossário canônico)

**Pode ser paralelo com:** Phase 118, Phase 121

**Critérios de sucesso observáveis:**

1. A skill `postgres-isolamento-concorrencia` documenta os 6 tipos de race condition (dirty read, dirty write, read skew, lost update, write skew, phantom read) com SQL exemplo isolado de cada — termos EN preservados pois são canônicos no manual oficial Postgres + livro DDIA.
2. A skill apresenta árvore de decisão para isolation level Postgres: READ COMMITTED (default, cobre 95% dos casos), REPEATABLE READ (snapshot isolation/MVCC, para relatórios consistentes), SERIALIZABLE (SSI, para invariantes complexos cross-row) — com decisão explícita "qual escolher" por tipo de transação.
3. A skill cobre 3 padrões para prevenir lost update com tradeoff de performance: (a) `SELECT ... FOR UPDATE` em transação (lock pessimista, baixo throughput), (b) `UPDATE ... SET x = x + 1 WHERE id = $1 AND version = $v` atomic com WHERE conditions (otimista, retry on miss), (c) `pg_advisory_xact_lock(hashtext($1))` para lock semântico.
4. A skill cobre prevenção de write skew via materialização do conflito: FOR UPDATE em todas as rows lidas no predicate, OU `EXCLUDE USING gist` constraint no DB para overlap (ex: room booking), OU `ISOLATION LEVEL SERIALIZABLE` (Postgres SSI = predicate-aware) como fallback genérico.
5. A skill mapeia prevenção de phantom read via index-range locks ou predicate locks: explica que SERIALIZABLE em Postgres usa SSI (Serializable Snapshot Isolation, predicate-aware) e contrasta com REPEATABLE READ que NÃO previne phantom (apenas snapshot da sessão).
6. A skill `armadilhas-sistemas-distribuidos` documenta perigos de clock skew com tabela canônica: `now()` (início da transação, monotônico dentro da transação), `clock_timestamp()` (real-time wall clock, pode pular para trás se NTP corrigir), `transaction_timestamp()` (alias para `now()`). Regra: NUNCA usar `clock_timestamp()` para lógica de expiração.
7. A skill cobre fencing tokens canônicos para distributed locks: `pg_advisory_xact_lock(hashtext('lock_name'))` + sequence monotônico para ID do token. Aplicações: super-admin actions, jobs agendados pgmq, eleição de líder (substituto barato de Zookeeper para escala Supabase).
8. A skill documenta GC pause / process pause com cenário canônico: nó adquire lease, sofre GC pause de 30s, lease expira durante pause, outro nó assume liderança, primeiro nó volta e ainda acha que tem lease → split brain. Mitigação: fencing token cresce monotônico, storage rejeita writes com token < último visto.
9. A skill cobre falhas parciais: detecção de falha por timeout é falaciosa (lentidão ≠ morte). Apresenta padrão "phi accrual failure detector" e regra de quando assumir nó morto vs apenas lento (consenso de N-1 nós, não decisão unilateral).
10. A skill mapeia modelos de sistema (byzantine vs crash-stop vs crash-recovery) com aplicação em contexto Supabase: geralmente crash-recovery (nó pode reiniciar e voltar com estado parcial). Byzantine fora do scope (apenas blockchain/safety-critical).

---

### Phase 121: Modelo de Consistência + Streams de Eventos (Ch 9 + Ch 11)

**Objetivo:** Skills `escolha-modelo-consistencia` (linearizável vs causal vs eventual, uniqueness distribuído, total order broadcast, CAP/PACELC, 2PC alternativas) + `streams-eventos-cdc` (brokers AMQP vs log-based, CDC com wal2json/Realtime, event sourcing com audit_log, exactly-once em pgmq, stream joins, log compaction). Pareadas porque modelos de consistência fundamentam decisões de event streams.

**Tipo:** Content-only

**Artefatos produzidos:**
- `kit/skills/escolha-modelo-consistencia/SKILL.md`
- `kit/skills/streams-eventos-cdc/SKILL.md`

**REQs cobertos:** MODELO-01, MODELO-02, MODELO-03, MODELO-04, MODELO-05, STREAMS-01, STREAMS-02, STREAMS-03, STREAMS-04, STREAMS-05, STREAMS-06 (11 REQs)

**Depende de:** Phase 117 (glossário canônico)

**Pode ser paralelo com:** Phase 118, Phase 120

**Critérios de sucesso observáveis:**

1. A skill `escolha-modelo-consistencia` apresenta árvore de decisão linearizável vs causal vs eventual com 3 exemplos canônicos: uniqueness constraint cross-tenant = linearizável (precisa total order), feed social = eventual (atraso aceitável), chat de equipe = causal (mensagem A causa resposta B, ordem preservada).
2. A skill documenta uniqueness constraints distribuídos via single-leader Postgres (`UNIQUE` constraint nativa) com explicação detalhada: por que UPDATE+SELECT em nível de app é inseguro mesmo com `SELECT FOR UPDATE` (race entre check e insert ainda existe se outro processo já tem o lock pendente).
3. A skill cobre análogos de total order broadcast em Postgres: logical replication slots, posição WAL (`pg_current_wal_lsn()`), `pg_logical_emit_message()` para eventos custom. Quando é necessário: invariantes globais cross-tenant (ex: licença unique global).
4. A skill mapeia teorema CAP ao modelo prático PACELC: durante partição de rede, escolher consistency vs availability; durante operação normal, latency vs consistency. Postgres single-leader = CP (rejeita writes durante partição). Eventual consistency = AP. Tabela com 4 quadrantes + exemplos reais.
5. A skill cobre limitações do 2PC (two-phase commit): blocking se coordenador morre, performance impact, falta de heuristic recovery. Alternativas modernas: sagas (compensação local), transactional outbox (write DB + event em mesma transação, processador async lê outbox).
6. A skill `streams-eventos-cdc` documenta diferença entre brokers AMQP/JMS-style vs log-based com tabela: AMQP-style (RabbitMQ, postgres LISTEN/NOTIFY) — mensagem deletada após ack, ordering por consumer; log-based (Kafka, pgmq) — append-only, multiple consumers podem reler, ordering preservado.
7. A skill cobre padrões CDC (Change Data Capture) em Postgres: (a) `wal2json` + Supabase Realtime broadcast para sync cross-region, (b) `pglogical` → Kafka externo para ingestão analytics, (c) trigger-based para casos específicos. Use cases: índice de busca (Elasticsearch), desnormalização (Materialized Views), sync multi-region.
8. A skill documenta padrão event sourcing em Postgres: tabela de eventos como source of truth + projeções (Materialized Views ou desnormalizações mantidas por trigger). Audit log v1.21 (`audit_log`) mapeado para semântica event sourcing — cross-ref ativo para skill `audit-log-multi-tenant` v1.21.
9. A skill cobre semântica exactly-once em pgmq: tabela de dedup com `unique constraint (event_id)`, idempotency key no handler (mesmo input → mesmo output), transactional outbox para writes cross-service (write DB + event em mesma transação atomic).
10. A skill cobre 3 tipos de stream join: (a) stream-stream (com janela temporal, ex: matching de pedido + pagamento dentro de 5min), (b) stream-table (CDC + atividade, ex: lookup de user info para enrichment), (c) table-table (merge de changelogs CDC). Padrões em Postgres com SQL exemplo de cada.
11. A skill mapeia log compaction: pgmq não tem nativo (usa retention TTL com `vacuum_archive`); event sourcing precisa snapshot periódico + compact. Estratégia documentada: snapshot a cada 1000 eventos, compact deleta eventos < snapshot.

---

### Phase 122: Agents de Auditoria + Comando `/dados-distribuidos`

**Objetivo:** 3 agents especializados (`auditor-consistencia-isolamento`, `detector-tenant-quente`, `validador-evolucao-schema`) + comando orquestrador `/dados-distribuidos` com sinônimos PT/EN e 4 subcomandos. Agents consomem as 7 skills das Phases 117-121.

**Tipo:** Content-only

**Artefatos produzidos:**
- `kit/agents/auditor-consistencia-isolamento.md`
- `kit/agents/detector-tenant-quente.md`
- `kit/agents/validador-evolucao-schema.md`
- `kit/commands/dados-distribuidos.md`

**REQs cobertos:** SUITE-01, SUITE-02, AGENTE-01, AGENTE-02, AGENTE-03, AGENTE-04, AGENTE-05, AGENTE-06 (8 REQs)

**Depende de:** Phase 117, Phase 118, Phase 119, Phase 120, Phase 121 (todas as skills upstream)

**Critérios de sucesso observáveis:**

1. O comando `/dados-distribuidos` é invocável com sinônimos PT/EN: `dados-distribuidos`, `ddia`, `dados`, `consistencia`, `replicacao`, `streams` — verificável via `mcp__kit__list_kit` retornando o command com aliases documentados.
2. O comando rotea para 4 subcomandos: `auditar-consistencia` → `auditor-consistencia-isolamento`, `auditar-tenant-quente` → `detector-tenant-quente`, `validar-evolucao-schema` → `validador-evolucao-schema`, `implementar-cdc` → handoff para skill `streams-eventos-cdc` + agent `supabase-edge-fn-writer` v1.8 — com fallback amigável quando subcomando inexistente.
3. O agent `auditor-consistencia-isolamento` scaneia migrations + RPCs + Edge Functions e detecta os 6 anti-patterns canônicos: (a) SELECT-then-UPDATE sem `FOR UPDATE` (lost update), (b) trigger sem materializar predicate (write skew), (c) `now()`/`clock_timestamp()` em lógica de expiração (clock skew), (d) UNIQUE check em nível de app (race), (e) write cross-tenant sem lock (cross-tenant lost update), (f) handler sem idempotência (duplicate processing).
4. O agent produz `AUDITORIA-CONSISTENCIA.md` priorizado P0/P1/P2 com findings linkados a `arquivo:linha` + sugestão de fix referenciando skill canônica (ex: "use SELECT FOR UPDATE — ver skill `postgres-isolamento-concorrencia`").
5. O agent `detector-tenant-quente` consulta logs Supabase via `mcp__supabase__execute_sql` (queries dos últimos 30d agrupadas por org_id), identifica outliers usando thresholds da skill TENANT (>3× P50 = WARN, >10× P50 = CRITICAL) e produz `AUDITORIA-TENANT-QUENTE.md` com top 5 tenants quentes + métricas + estratégia de mitigação sugerida (consome skill `tenant-quente-mitigacao` v1.22).
6. O agent `validador-evolucao-schema` recebe SQL de migration via stdin/argument, detecta 4 breaks canônicos: NOT NULL adicionado em coluna existente, column dropped, type narrowed (varchar(255)→varchar(50)), default mudado em coluna em uso. Produz veredito GO/NO-GO/NEEDS-REVIEW com sugestão de migration segura (3-step) quando NO-GO — invocável standalone OU automaticamente por `supabase-migration-writer` (v1.8) via cross-suite handoff.
7. Todos os 3 agents documentam cross-suite invocation explicitamente: delegam escrita de migration corrigida para `supabase-migration-writer` v1.8 + escrita de Edge Function instrumentada para `supabase-edge-fn-writer` v1.8 — pattern v1.21 herdado.

---

### Phase 123: Cross-Suite Integration + Release Artifacts

**Objetivo:** 12 patches em skills/agents existentes (v1.8 + v1.11 + v1.21) referenciando artefatos novos de v1.22 + atualização de release artifacts (AUTOGEN-COUNTS, file-manifest.json, README, CHANGELOG, COMPATIBILITY.md) + audit final.

**Tipo:** Integration (modifica arquivos existentes em kit/)

**Artefatos produzidos/modificados:**
- Patches em 8 skills existentes: `multi-tenant-performance-scaling` (v1.21), `multi-tenant-rls-hierarchy` (v1.21), `crm-lead-pipeline-patterns` (v1.21), `super-admin-platform-pattern` (v1.21), `cascading-failures` (v1.11), `audit-log-multi-tenant` (v1.21), `supabase-cron-queues` (v1.8), `supabase-migrations` (v1.8)
- Patches em 4 agents existentes: `supabase-architect` (v1.8), `supabase-migration-writer` (v1.8), `multi-tenant-isolation-auditor` (v1.21), `crm-pipeline-implementer` (v1.21)
- `kit/AUTOGEN-COUNTS.md` regenerado
- `kit/file-manifest.json` regenerado
- `kit/README.md` ganha seção "Suíte DDIA Foundations"
- `CHANGELOG.md` ganha entry v1.22.0
- Convenção PT-BR documentada em glossário (cross-ref de Phase 117)

**REQs cobertos:** CROSS-01, CROSS-02, CROSS-03, CROSS-04, CROSS-05, CROSS-06, CROSS-07, CROSS-08, CROSS-09, CROSS-10, CROSS-11, CROSS-12, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05 (17 REQs)

**Depende de:** Phase 122 (todos os artefatos da suíte completos para cross-ref)

**Critérios de sucesso observáveis:**

1. Os 12 patches cross-suite estão aplicados verificáveis via `grep`: `multi-tenant-performance-scaling` ganhou seção "Detecção e Mitigação de Tenant Quente" com link ativo para `tenant-quente-mitigacao`; `multi-tenant-rls-hierarchy` ganhou seção "Invariantes Linearizáveis Cross-Tenant"; `crm-lead-pipeline-patterns` ganhou `SELECT FOR UPDATE` em trigger de transição de stage; `super-admin-platform-pattern` ganhou fencing token para TTL de impersonação.
2. Os patches em skills v1.11 e v1.8 estão aplicados: `cascading-failures` (v1.11) ganhou "Clock Skew" como failure mode adicional com cross-ref ativo para `armadilhas-sistemas-distribuidos`; `audit-log-multi-tenant` (v1.21) ganhou seção "Semântica Event Sourcing" + log compaction; `supabase-cron-queues` (v1.8) ganhou "Padrões Exactly-Once"; `supabase-migrations` (v1.8) ganhou "Padrão Rolling-Upgrade" com link para `evolucao-schema-compativel`.
3. Os patches em agents v1.8 e v1.21 estão aplicados: `supabase-architect` (v1.8) ganhou pergunta upfront "Que modelo de consistência essa feature precisa?" com árvore de decisão cross-ref para `escolha-modelo-consistencia`; `supabase-migration-writer` (v1.8) auto-invoca `validador-evolucao-schema` ANTES de escrever migration arriscada (handoff documentado); `multi-tenant-isolation-auditor` (v1.21) ganhou detecção de gap de tenant quente (consome `detector-tenant-quente`); `crm-pipeline-implementer` (v1.21) gera `SELECT FOR UPDATE` em transição de stage como default agora.
4. AUTOGEN-COUNTS.md regenerado reflete: 57→60 agents (+3 da Phase 122), 88→89 commands (+1 da Phase 122), 60→67 skills (+7 das Phases 117-121), 23 gates (mantido — esta suíte não introduz gates novos por design).
5. file-manifest.json regenerado tem ~395 entries (355 v1.21 + ~40 novos: 7 SKILL.md + 3 agent.md + 1 command.md + 1 glossary.md + roadmap + audit + patches em arquivos pré-existentes não contam como entries novas, apenas atualização de hash).
6. README.md kit/ ganha seção "Suíte DDIA Foundations" no índice mencionando: 7 skills (capítulos 4, 5, 6, 7, 8, 9, 11 do livro Kleppmann 2017), 3 agents (auditor, detector, validador), comando `/dados-distribuidos`, glossário compartilhado, convenção PT-BR de naming a partir de v1.22.
7. CHANGELOG.md ganha entry v1.22.0 com sumário das adições + cross-ref para 12 cross-suite patches + convenção PT-BR documentada.
8. CI permanece verde após regen — sem regressão de coverage (≥86.84%), mutation baseline (≥57.40%), ou MCP p95 latency (0ms baseline).

---

### Mapeamento de Fases (tabela executiva)

| Phase | Nome | REQs cobertos | Artefatos | Tipo | Onda |
|---|---|---|---|---|---|
| 117 | Glossário + Evolução Schema (Ch 4) | SUITE-03; EVOLUCAO-01..04 | 1 glossário + 1 skill | Content-only | 1 |
| 118 | Consistência Leitura Réplica (Ch 5) | LEITURA-01..04 | 1 skill | Content-only | 2 |
| 119 | Tenant Quente Mitigação (Ch 6) | TENANT-01..05 | 1 skill | Content-only | 1 |
| 120 | Isolamento + Armadilhas (Ch 7+8) | ISOLAMENTO-01..05; ARMADILHAS-01..05 | 2 skills | Content-only | 2 |
| 121 | Modelo Consistência + Streams (Ch 9+11) | MODELO-01..05; STREAMS-01..06 | 2 skills | Content-only | 2 |
| 122 | Agents + Command `/dados-distribuidos` | SUITE-01, SUITE-02; AGENTE-01..06 | 3 agents + 1 command | Content-only | 3 |
| 123 | Cross-Suite Integration + Release | CROSS-01..12; DOC-01..05 | 12 patches + release artifacts | Integration | 4 |

**Total: 7 phases, 7 skills + 1 glossário + 3 agents + 1 command + 12 cross-suite patches, 60 REQs.**

---

### Dependências entre Fases

```
Phase 117 (glossário + EVOLUCAO Ch 4) ──┐
                                        ├──► Phase 118 (LEITURA Ch 5)
                                        ├──► Phase 120 (ISOLAMENTO + ARMADILHAS Ch 7+8)
                                        └──► Phase 121 (MODELO + STREAMS Ch 9+11)
                                                                                  │
Phase 119 (TENANT Ch 6) ──────────────────────────────────────────────────────────┤
                                                                                  ▼
                                                                      Phase 122 (3 agents + command)
                                                                                  │
                                                                                  ▼
                                                                      Phase 123 (cross-suite + release)
```

---

### Cobertura de REQs (validação 100%)

**Total REQs em REQUIREMENTS.md:** 60 (3 SUITE + 4 EVOLUCAO + 4 LEITURA + 5 TENANT + 5 ISOLAMENTO + 5 ARMADILHAS + 5 MODELO + 6 STREAMS + 6 AGENTE + 12 CROSS + 5 DOC)

**Nota sobre contagem:** A instrução do `/novo-marco` mencionou "46 REQs em 11 categorias", mas a contagem real do `REQUIREMENTS.md` é **60 REQs** distribuídas nas mesmas 11 categorias. O roadmap mapeia os 60 REQ-IDs reais. Discrepância documentada para auditoria — não é falha de cobertura.

**Cobertos por phase:**
- Phase 117: 5 REQs (SUITE-03, EVOLUCAO-01..04)
- Phase 118: 4 REQs (LEITURA-01..04)
- Phase 119: 5 REQs (TENANT-01..05)
- Phase 120: 10 REQs (ISOLAMENTO-01..05, ARMADILHAS-01..05)
- Phase 121: 11 REQs (MODELO-01..05, STREAMS-01..06)
- Phase 122: 8 REQs (SUITE-01, SUITE-02, AGENTE-01..06)
- Phase 123: 17 REQs (CROSS-01..12, DOC-01..05)

**Soma:** 5+4+5+10+11+8+17 = **60/60 (100%)**

Cada REQ-ID está em **exatamente uma** phase (sem duplicação, sem omissão).

---

<details>
<summary>Concluídos</summary>

- v1.0.0 → v1.5.3 — early stabilization + patches
- v1.6.0 → v1.7.0 — Perf+lean
- v1.8.0 — Suíte Supabase
- v1.9.0 — Observabilidade
- v1.10.0 — SRE Engagement
- v1.11.0 — SRE Resilience & Release Engineering
- v1.12 — Legacy Code Mastery & AI-Era Refactoring
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — 11 REQs, 33 tests. [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)
- **v1.14.0 — Web/Core Security Hardening (Phases 82-84)** — 6 REQs HIGH, 63 tests. [Audit](./milestones/v1.14-MILESTONE-AUDIT.md)
- **v1.15.0 — DX & Token Economy Wave 2 (Phases 85-87)** — 5 REQs, 26 tests. [Audit](./milestones/v1.15-MILESTONE-AUDIT.md)
- **v1.16.0 — Performance Runtime Wave (Phases 88-89)** — 6 REQs, 18 tests. [Audit](./milestones/v1.16-MILESTONE-AUDIT.md)
- **v1.17.0 — Performance Wave 2 + Quick Wins (Phases 90-93)** — 9 REQs, 27 tests, PRR 22→24/30. [Audit](./milestones/v1.17-MILESTONE-AUDIT.md)
- **v1.18.0 — Eat Your Own Dog Food (Phases 94-97)** — 7 REQs, 74 tests, 418 baseline. PRR **27/30**. [Audit](./milestones/v1.18-MILESTONE-AUDIT.md)
- **v1.19.0 — Maturidade Operacional (Phases 98-99)** — 5 REQs, 64 tests, 482 baseline. PRR **28/30**. Coverage 77.89→81.51%. [Audit](./milestones/v1.19-MILESTONE-AUDIT.md)
- **v1.20.0 — Tech Debt Closure & Quality Hardening (Phases 100-105)** — 6 REQs, 89 tests, 671 baseline. PRR **30/30**. Coverage 81.51→86.84%. Mutation baseline 57.40%. [Audit](./milestones/v1.20-MILESTONE-AUDIT.md) · [Roadmap](./milestones/v1.20-ROADMAP.md)
- **v1.21.0 — Suíte Multi-Tenant SaaS B2B (Phases 106-116)** — 59 REQs, 11 phases, 15 skills + 10 agents + 1 command + 1 glossário + 3 audit gates. 6ª suíte do kit; especializa `/supabase` v1.8 para apps B2B (hierarquia firm→dept→role→permission, RBAC, invite flow, super-admin, audit log, LGPD, Evolution Go/WhatsApp, CRM, React patterns). Stable API v1.0+ preservada (content-only). [Audit](./milestones/v1.21-MILESTONE-AUDIT.md) · [Roadmap](./milestones/v1.21-ROADMAP.md) · [Requirements](./milestones/v1.21-REQUIREMENTS.md)

</details>
