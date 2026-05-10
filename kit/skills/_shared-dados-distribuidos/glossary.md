# Glossário Dados Distribuídos — Termos, Patterns e Convenções

> Arquivo de referência compartilhado pelas skills da Suíte DDIA Foundations v1.22 (capítulos 4, 5, 6, 7, 8, 9 e 11 de *Designing Data-Intensive Applications*, Martin Kleppmann, O'Reilly 2017, ISBN 978-1-449-37332-0). **NÃO é skill** — não tem `description:` triggerável; não aparece em `listKit`. Cross-referenciado pelas 7 skills da suíte via Markdown link relativo.
>
> **Cross-suite reference ATIVO:** termos Supabase já definidos em [`_shared-supabase/glossary.md`](../_shared-supabase/glossary.md) (v1.8) e termos multi-tenant em [`_shared-multi-tenant/glossary.md`](../_shared-multi-tenant/glossary.md) (v1.21) — esta skill **não duplica**, apenas linka. Termos como `RLS`, `STABLE`, `pgmq`, `pg_cron`, `wal2json`, `tenant`, `org_id`, `audit log`, `RBAC` são definidos lá.

---

## (a) Termos PT-BR ↔ EN — Modelos de Consistência (Ch 5, 9)

| EN | PT-BR / Significado |
|---|---|
| **linearizability** | **Linearizabilidade** — modelo de consistência forte: dados replicados aparecem como uma única cópia, todas as operações executam atomicamente em uma ordem total única. Behavior = "variável em programa single-threaded". Custo: lento em redes com latência alta. Postgres single-leader oferece linearizabilidade no líder; réplicas físicas não. |
| **causal consistency** | **Consistência causal** — modelo mais fraco que linearizabilidade: preserva ordem de eventos relacionados causalmente (causa antes do efeito), permite eventos concorrentes em qualquer ordem. Sem overhead de coordenação global. Adequado para chat/colaboração onde "resposta vem após pergunta" mas mensagens paralelas podem ter ordem livre. |
| **eventual consistency** | **Consistência eventual** — modelo fraco: réplicas convergem ao mesmo estado *eventualmente* se as escritas pararem. Sem garantia de quando. Usado em feeds sociais, contadores, analytics. Anti-pattern: usar para invariantes (uniqueness, saldo financeiro). |
| **read-after-write consistency** | **Consistência leitura-após-escrita** — usuário sempre vê os próprios writes mais recentes (mesmo lendo de réplica). Solução típica: roteamento sticky por `user_id` ou ler do líder por janela de tempo após write. |
| **monotonic reads** | **Leituras monotônicas** — garantia de que leituras sucessivas do mesmo usuário não "voltam no tempo". Solução: sticky session por user para a mesma réplica. |
| **consistent prefix reads** | **Prefixo causal consistente** — observador vê escritas em uma ordem que respeita causalidade (efeito não aparece antes da causa). Solução: log de replicação com partição por chave causal. |

---

## (b) Termos PT-BR ↔ EN — Replicação (Ch 5)

| EN | PT-BR / Significado |
|---|---|
| **leader-follower replication** | **Replicação líder-seguidor** — single-leader: clientes mandam writes ao líder, líder propaga eventos de mudança aos seguidores (réplicas). Reads podem ser feitos em qualquer réplica (sujeito a lag). Pattern Postgres + read replicas Supabase Pro+. |
| **multi-leader replication** | **Replicação multi-líder** — clientes mandam writes a qualquer um dos líderes, líderes sincronizam entre si. Robusto contra falhas/latência mas complexo (resolução de conflitos). Raramente usado em Supabase. |
| **leaderless replication** | **Replicação sem líder** — clientes mandam write a N nodes, leem de M nodes em paralelo, detectam stale reads. Usado em Cassandra/DynamoDB; fora do escopo Supabase. |
| **replication lag** | **Atraso de replicação** — diferença temporal entre commit no líder e visibilidade na réplica. Tipicamente <100ms em Supabase mas pode crescer sob carga. Mensurável via `pg_last_wal_replay_lsn()`. |
| **synchronous replication** | **Replicação síncrona** — líder confirma write apenas após replicar para ≥1 seguidor. Garante zero data loss em failover; custo de latência. |
| **asynchronous replication** | **Replicação assíncrona** — líder confirma write antes de replicar. Default Postgres. Risco: failover em momento de lag perde writes. |

---

## (c) Termos PT-BR ↔ EN — Transações e Isolamento (Ch 7)

> Termos canônicos do livro DDIA + manual oficial Postgres preservados em EN (não traduzir nas descrições internas).

| EN | PT-BR / Significado |
|---|---|
| **dirty read** | **Leitura suja** — transação A lê dados não-commitados de transação B. Prevenido por READ COMMITTED e níveis acima (default Postgres). |
| **dirty write** | **Escrita suja** — transação A sobrescreve write não-commitado de transação B. Prevenido por todas as implementações de transação. |
| **read skew** | **Distorção de leitura (não-repeatable read)** — cliente vê partes do DB em diferentes pontos no tempo durante a mesma transação. Prevenido por snapshot isolation (REPEATABLE READ Postgres). |
| **lost update** | **Atualização perdida** — duas transações fazem read-modify-write concorrente; uma sobrescreve o write da outra sem incorporar suas mudanças. Prevenido por: `SELECT FOR UPDATE` (lock pessimista), CAS atomic com `WHERE version = $v` (lock otimista), ou `pg_advisory_xact_lock`. |
| **write skew** | **Distorção de escrita** — transação lê algo, decide com base no valor, escreve a decisão. Mas a premissa da decisão é invalidada pelo write concorrente de outra transação. Apenas **serializable isolation** previne completamente. Mitigação no nível do app: materializar o conflito via `SELECT ... FOR UPDATE` em todas as rows do predicate. |
| **phantom read** | **Leitura fantasma** — transação lê objetos que casam com search condition; outra transação muda resultados via insert/delete. Snapshot isolation previne phantoms simples; phantoms no contexto de write skew exigem index-range locks ou SSI. |
| **MVCC** | **Multi-version concurrency control** — Postgres mantém múltiplas versões da mesma row; readers veem a versão consistente do snapshot da transação, sem bloquear writers. Base do REPEATABLE READ no Postgres. Visualizado via `xmin`/`xmax`. |
| **snapshot isolation** | **Isolamento de snapshot** — transação lê de um snapshot consistente do DB tirado no início. Postgres REPEATABLE READ implementa via MVCC. Não previne write skew nem lost update genérico. |
| **serializable snapshot isolation (SSI)** | **Isolamento de snapshot serializável (SSI)** — algoritmo otimista: transações executam sem bloquear; ao commit, sistema verifica se a execução foi serializável e aborta se não. Postgres SERIALIZABLE = SSI desde 9.1. Predicate-aware (detecta conflitos de write skew automaticamente). Trade-off: aborts esporádicos, app precisa retry. |
| **two-phase locking (2PL)** | **Bloqueio em duas fases** — abordagem clássica de serializability: cada transação adquire locks em todas as rows lidas/escritas (fase 1) e libera no commit (fase 2). Custo de performance alto; raramente usado em Postgres moderno. |
| **predicate lock** | **Lock por predicado** — lock que cobre não apenas rows existentes mas também rows futuras que casariam com o predicate. Necessário para prevenir phantoms em SSI. |

---

## (d) Termos PT-BR ↔ EN — Particionamento e Tenant Quente (Ch 6)

| EN | PT-BR / Significado |
|---|---|
| **partition / shard** | **Partição / shard** — divisão horizontal de uma tabela: cada subset reside em uma partição separada. Postgres native via `PARTITION BY` (range/hash/list); Supabase suporta. |
| **range partitioning** | **Particionamento por range** — partições por intervalos contínuos da chave (ex: `created_at` por mês). Bom para range scans; risco de hot partition na partição mais recente. |
| **hash partitioning** | **Particionamento por hash** — partições pela função hash da chave (ex: `HASH (org_id) PARTITIONS 16`). Distribuição uniforme; perde locality para range scans. |
| **hot partition / hot tenant** | **Partição quente / tenant quente** — partição/tenant que recebe desproporcionalmente mais traffic que a média (3×–100×). Caso canônico no livro: "tenant Justin Bieber" (celebridade que gera 1000× tráfego de um usuário comum). Detecção: queries/min ratio, storage GB ratio, slots de conexão ratio agrupados por `tenant_id`. |
| **document-partitioned secondary index** | **Índice secundário particionado por documento** — índice secundário local em cada partição. Query cross-partition precisa scatter-gather (mais lento); writes baratos. Default recomendado no livro. |
| **term-partitioned secondary index** | **Índice secundário particionado por termo** — índice global organizado pelo valor indexado. Query rápida; writes caros (precisa atualizar índice em outra partição). |
| **rebalancing** | **Rebalanceamento** — redistribuir dados entre partições conforme volume cresce ou tenants ficam quentes. Estratégias: hash mod N (ruim, requer remap total ao adicionar node), consistent hashing, partitioning fixo (hash partitions = N nodes adiciona node = move 1/N partitions). |

---

## (e) Termos PT-BR ↔ EN — Sistemas Distribuídos: Armadilhas (Ch 8)

| EN | PT-BR / Significado |
|---|---|
| **partial failure** | **Falha parcial** — sistema distribuído onde alguns nodes funcionam e outros não. Detecção via timeouts é falaciosa (lento ≠ morto). Mitigação: consenso de N-1 nodes, não decisão unilateral. |
| **clock skew** | **Desvio de relógio** — relógios de diferentes nodes podem divergir significativamente (mesmo com NTP). NUNCA usar `clock_timestamp()` para lógica de expiração. Em Postgres: `now()` = início da transação (monotônico dentro), `clock_timestamp()` = wall clock real (pode pular para trás), `transaction_timestamp()` = alias para `now()`. |
| **fencing token** | **Token de fencing (cerca)** — número monotônico crescente associado a uma lock/lease. Storage rejeita writes com token < último visto. Previne split-brain quando processo sofre GC pause, perde a lease, e volta sem saber. Implementação Postgres: `pg_advisory_xact_lock(hashtext('lock_name'))` + sequence monotônica para o ID. |
| **GC pause / process pause** | **Pausa de GC / processo** — processo congela por segundos (garbage collector stop-the-world, swap para disco, virtualização). Outros nodes assumem que morreu, fazem failover; processo volta achando que ainda tem a lease. Mitigação: fencing token. |
| **byzantine fault** | **Falha bizantina** — node mente / envia mensagens corrompidas / age maliciosamente. Fora do escopo de aplicações típicas (apenas blockchain / safety-critical). Default em Supabase: assumir crash-recovery model (node pode reiniciar com estado parcial), não byzantine. |
| **phi accrual failure detector** | **Detector de falha phi accrual** — algoritmo probabilístico que estima a chance de um node estar morto baseado no histórico de heartbeats. Substitui timeout fixo binário. |

---

## (f) Termos PT-BR ↔ EN — Consensus (Ch 9)

| EN | PT-BR / Significado |
|---|---|
| **consensus** | **Consenso** — N nodes concordam em uma decisão única e irrevogável (qual node é líder, qual valor a write tomou). Necessário para uniqueness constraints distribuídos, eleição de líder, total order broadcast. |
| **total order broadcast** | **Broadcast de ordem total** — entrega de mensagens a todos os nodes na mesma ordem. Reducível a consenso. Em Postgres: WAL é total order broadcast natural para replicação. |
| **two-phase commit (2PC)** | **Commit em duas fases (2PC)** — protocolo de commit atômico distribuído: coordinator pergunta "prepared?" a todos participants (fase 1), depois envia "commit/abort" (fase 2). Limitações: blocking se coordinator morre, performance impact, falta de heuristic recovery. Alternativas modernas: sagas, transactional outbox. |
| **saga pattern** | **Saga** — alternativa a 2PC para transações distribuídas: sequência de transações locais, cada uma com compensating action que desfaz se step posterior falhar. |
| **transactional outbox** | **Outbox transacional** — pattern de publishing eventos atomic com write no DB: `INSERT INTO outbox (event) VALUES (...)` na mesma transação do `UPDATE` principal; processador async lê outbox e publica no broker. Garante exactly-once entre DB e broker. |
| **CAP theorem** | **Teorema CAP** — durante partição de rede, sistema escolhe Consistency (C) OU Availability (A); Partition tolerance (P) é dada (rede falha sempre). Postgres single-leader = CP (rejeita writes). |
| **PACELC** | **PACELC** — extensão prática do CAP: durante Partição = escolher A vs C; Else (operação normal) = escolher Latency vs Consistency. Quadrante real onde sistemas vivem. |

---

## (g) Termos PT-BR ↔ EN — Encoding e Evolução (Ch 4)

| EN | PT-BR / Significado |
|---|---|
| **encoding / serialization** | **Encoding / serialização** — converter representação in-memory (objetos, structs) em sequência de bytes para storage/network. Reversa = decoding/deserialization. |
| **backward compatibility** | **Compat backward** — código novo lê dados escritos por código antigo. Geralmente fácil (autor do código novo conhece formato antigo). |
| **forward compatibility** | **Compat forward** — código antigo lê dados escritos por código novo. Mais difícil — código antigo precisa ignorar campos novos sem quebrar. |
| **rolling upgrade / staged rollout** | **Rolling upgrade / rollout escalonado** — deploy gradual: nova versão sobe em poucos nodes primeiro, validação, depois espalha. Permite zero downtime + rollback rápido se v2 quebrar. Pré-requisito: backward + forward compat dos dados em trânsito. |
| **schema evolution** | **Evolução de schema** — mudança no schema de dados ao longo do tempo (add field, drop field, rename, type change) preservando compat. Avro/Protobuf têm regras formais; Postgres precisa de pattern 3-passos. |
| **Avro** | Sistema de encoding binário schema-driven (Apache). Reader's schema diferente do writer's schema é resolvido via schema resolution rules. |
| **Protocol Buffers / Protobuf** | Sistema de encoding binário schema-driven (Google). Field tags numéricos preservam compat; `optional` campos nunca quebram leitura. |
| **Thrift** | Sistema de encoding binário schema-driven (Facebook). Similar a Protobuf em garantias de compat. |
| **schema registry** | **Registro de schemas** — serviço central que armazena schemas versionados (typically para Avro/Kafka). Cada mensagem carrega ID do schema; consumer puxa schema do registry para deserializar. |

---

## (h) Termos PT-BR ↔ EN — Streams de Eventos (Ch 11)

| EN | PT-BR / Significado |
|---|---|
| **AMQP/JMS-style broker** | **Broker AMQP/JMS-style** — broker assigna mensagens individuais a consumers; consumer faz ack; mensagem deletada após ack. Ex: RabbitMQ, postgres LISTEN/NOTIFY. Adequado para task queue onde ordem não importa. |
| **log-based broker** | **Broker baseado em log** — broker grava mensagens em log append-only particionado; consumer rastreia offset; mensagens permanecem no disk (replayable). Ex: Kafka, pgmq. Adequado para stream processing. |
| **CDC** | **Change Data Capture** — captura mudanças no DB como stream de eventos. Em Postgres: `wal2json`, Supabase Realtime broadcast, `pglogical`. Use cases: sync índice de busca, desnormalização, sync multi-region. |
| **event sourcing** | **Event sourcing** — eventos imutáveis são source of truth; estado atual é projeção. Em Postgres: tabela append-only de eventos + projeções via Materialized Views ou trigger. Audit log v1.21 = event sourcing parcial. |
| **exactly-once semantics** | **Semântica exactly-once** — cada evento processado uma e somente uma vez. Implementação Postgres: idempotency key + unique constraint, transactional outbox. |
| **at-least-once semantics** | **Semântica at-least-once** — evento pode ser entregue mais de uma vez (retry após crash). Default Meta Cloud API webhooks. App precisa idempotency. |
| **stream-stream join** | **Join stream-stream** — match entre dois streams dentro de janela temporal (ex: pedido + pagamento dentro de 5min). |
| **stream-table join** | **Join stream-table** — stream de eventos enriquecido com lookup em changelog table (CDC + atividade). |
| **table-table join** | **Join table-table** — merge de dois changelogs CDC, produzindo stream de mudanças da view materializada. |
| **log compaction** | **Compactação de log** — para cada chave, manter apenas o último valor (não toda história). Pgmq usa retention TTL via `vacuum_archive`; event sourcing precisa snapshot periódico. |

---

## (i) Convenção de naming PT-BR (a partir de v1.22)

A partir do milestone v1.22 (Suíte DDIA Foundations), o kit-mcp adota **PT-BR como linguagem default** para naming de skills, agents, commands e diretórios `_shared-*`. Esta seção é a **referência canônica** consumida pelas 7 skills da suíte e pelas suítes futuras.

### Regras

| Regra | Aplicação | Exemplo |
|---|---|---|
| **Novos artefatos: PT-BR** | Skills/agents/commands criados a partir de v1.22 usam nomes PT-BR | `evolucao-schema-compativel`, `tenant-quente-mitigacao`, `auditor-consistencia-isolamento` |
| **Termos técnicos canônicos preservados** | Termos do manual oficial Postgres, livros DDIA/SRE/Feathers, RFCs e specs ficam em EN dentro de descrições/conteúdo | `write skew`, `lost update`, `MVCC`, `RLS`, `CDC`, `snapshot isolation`, `fencing token`, `linearizability` |
| **Artefatos pré-v1.22 NÃO renomeados** | Skills/agents/commands de v1.0 → v1.21 mantêm nomes EN para preservar discoverability via `mcp__kit__list_kit` e quebra zero de cross-refs externos | `multi-tenant-rls-hierarchy` (v1.21), `supabase-edge-functions` (v1.8), `core-analysis-loop` (v1.10) |
| **Diretórios `_shared-*` PT-BR** | Novos diretórios compartilhados usam PT-BR | `_shared-dados-distribuidos` (v1.22) vs `_shared-multi-tenant` (v1.21, mantido) |
| **Code blocks SQL/TS em EN** | Identificadores SQL e TypeScript permanecem em EN; comentários acima do código em PT-BR | `-- Adiciona coluna nullable\nalter table public.leads add column phone_country text;` |
| **Headings de skill em PT-BR** | Títulos de seção em PT-BR; termos técnicos canônicos preservados na descrição | `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Ver também` |
| **Frontmatter `description:` em PT-BR** | Início da descrição em PT-BR; termos técnicos preservados | `description: Use ao escrever migration Postgres ... padrão 3-passos (adicionar nullable → backfill em batches → impor NOT NULL), análogos Avro/Protobuf...` |

### Exemplos lado a lado

```
# v1.22 (PT-BR novo)
kit/skills/evolucao-schema-compativel/SKILL.md
kit/skills/tenant-quente-mitigacao/SKILL.md
kit/skills/postgres-isolamento-concorrencia/SKILL.md
kit/agents/auditor-consistencia-isolamento.md
kit/commands/dados-distribuidos.md
kit/skills/_shared-dados-distribuidos/glossary.md

# v1.21 (EN preservado, NÃO renomeado)
kit/skills/multi-tenant-rls-hierarchy/SKILL.md
kit/skills/audit-log-multi-tenant/SKILL.md
kit/agents/multi-tenant-isolation-auditor.md
kit/commands/multi-tenant.md
kit/skills/_shared-multi-tenant/glossary.md
```

### Rationale

1. **Alinhamento com o usuário primário** do kit-mcp (português brasileiro) — nomes de comandos digitados frequentemente devem ser legíveis na língua nativa.
2. **Preservação de termos canônicos** porque o vocabulário técnico (write skew, MVCC, RLS, CDC) é o mesmo em qualquer língua e está consagrado na literatura — traduzir cria ambiguidade ("distorção de escrita" sozinho ≠ "write skew" para quem busca via Google).
3. **Não-renomeação retroativa** evita quebra silenciosa de cross-refs entre skills (`see also: multi-tenant-rls-hierarchy`), bookmarks de usuários, e referências externas em PRs/Notion.

### Checklist para skill v1.22+

- [ ] Nome do diretório/arquivo em PT-BR (kebab-case)
- [ ] Frontmatter `description:` começa em PT-BR
- [ ] Termos técnicos canônicos preservados em EN dentro da descrição
- [ ] Headings em PT-BR
- [ ] Texto narrativo em PT-BR
- [ ] Code blocks SQL/TS em EN; comentários em PT-BR
- [ ] Cross-refs ATIVOS (link Markdown relativo) para glossário e skills relacionadas — sem duplicar definições

---

## (j) Cross-Refs Externos

- [Designing Data-Intensive Applications, Martin Kleppmann (O'Reilly 2017)](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/) — fonte canônica desta suíte
- [PostgreSQL Documentation — Concurrency Control](https://www.postgresql.org/docs/current/mvcc.html)
- [PostgreSQL Documentation — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Apache Avro — Schema Evolution](https://avro.apache.org/docs/current/spec.html#Schema+Resolution)
- [Protocol Buffers — Updating Message Types](https://protobuf.dev/programming-guides/proto3/#updating)
- [Martin Kleppmann blog — Schema evolution in Avro, Protocol Buffers and Thrift](https://martin.kleppmann.com/2012/12/05/schema-evolution-in-avro-protocol-buffers-thrift.html)
- [Supabase Supavisor 1M Connections](https://supabase.com/blog/supavisor-1-million)
- [PostgreSQL Wiki — Loose indexscan / Hot update / pg_stat_statements](https://wiki.postgresql.org/)

---

## (k) Cross-Suite Invocation Pattern (herdado de v1.21)

Skills da Suíte DDIA Foundations **não duplicam** lógica das suítes anteriores. Padrão canônico de delegação:

```
evolucao-schema-compativel (v1.22)
  ├─ cross-ref ativo para supabase-migrations (v1.8) — naming convention + RLS obrigatório
  └─ cross-ref ativo para supabase-declarative-schema (v1.8) — workflow stop → db diff → revisar

tenant-quente-mitigacao (v1.22)
  ├─ cross-ref ativo para multi-tenant-performance-scaling (v1.21) — Supavisor + partial indexes
  └─ cross-ref ativo para b2b-saas-architecture (v1.21) — Single Schema + org_id default

streams-eventos-cdc (v1.22)
  ├─ cross-ref ativo para supabase-cron-queues (v1.8) — pg_cron + pgmq pattern
  ├─ cross-ref ativo para audit-log-multi-tenant (v1.21) — append-only event sourcing semântica
  └─ cross-ref ativo para supabase-realtime (v1.8) — broadcast como CDC stream

postgres-isolamento-concorrencia (v1.22)
  └─ cross-ref ativo para supabase-database-functions (v1.8) — STABLE/IMMUTABLE/VOLATILE markers

auditor-consistencia-isolamento (v1.22)
  └─→ Task(supabase-migration-writer)        # SQL final corrigido
  └─→ Task(supabase-edge-fn-writer)          # Edge Function instrumentada

validador-evolucao-schema (v1.22)
  └─ invocado por supabase-migration-writer (v1.8) ANTES de escrever migration arriscada
```

**Anti-pattern:** skill v1.22 reescrever lógica RLS multi-tenant do zero (deve cross-ref). Agent v1.22 escrever migration direta (deve delegar para `supabase-migration-writer`).
