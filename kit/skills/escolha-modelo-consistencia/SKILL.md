---
name: escolha-modelo-consistencia
cost_tier: leve
description: Guia modelo de consistência em Supabase/Postgres — árvore de decisão linearizabilidade vs causal vs eventual, UNIQUE constraint anti-race, transactional outbox, sagas e CAP/PACELC. Use ao
---

# Escolha de Modelo de Consistência — Decision Tree + Patterns Postgres

## Quando usar

LLM carrega esta skill ao desenhar feature distribuída em Supabase + Postgres com necessidade de escolher um modelo de consistência. Trigger phrases:

- "qual modelo de consistência usar", "linearizabilidade vs causal vs eventual"
- "uniqueness constraint cross-tenant", "slug único global"
- "ordem causal de eventos", "consistência forte vs eventual"
- "CAP teorema Postgres", "PACELC trade-off"
- "2PC alternativas", "saga pattern", "transactional outbox"
- "total order broadcast Postgres", "WAL position monotônica"
- "race condition em INSERT app-level", "ON CONFLICT vs SELECT FOR UPDATE"

Esta skill **estende** [`audit-log-multi-tenant`](../audit-log-multi-tenant/SKILL.md) (v1.21) ao usar o pattern transactional outbox para garantir publish atomic com write principal, e [`supabase-cron-queues`](../supabase-cron-queues/SKILL.md) (v1.8) ao consumir pgmq como destino do outbox.

Material-fonte: *Designing Data-Intensive Applications*, Martin Kleppmann (O'Reilly 2017), capítulo 9 "Consistency and Consensus" (linhas 13198-15600 do material extraído; summary 15323-15425). Termos canônicos PT-BR ↔ EN definidos em [`../_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) seções (a) e (f).

## Regras absolutas

**REGRA #1 (uniqueness cross-tenant exige linearizabilidade):** Slug global, license key, custom domain — qualquer chave que precise ser **única em todo o sistema** (não apenas dentro de um tenant) **DEVE** usar `UNIQUE` constraint nativo Postgres no líder. Eventual consistency permite duplicatas durante janela de divergência; aceitável APENAS se não houver invariante de unicidade.

**REGRA #2 (NUNCA usar UPDATE+SELECT app-level para uniqueness):** O padrão `SELECT id FROM users WHERE slug = $1; if (!exists) INSERT ...` é **race condition garantida**, mesmo com `SELECT FOR UPDATE`. Dois clientes podem chegar simultaneamente, cada um fazer SELECT, ambos verem ausência da row, ambos fazerem INSERT — conflito ou duplicata. Padrão correto: deixar o `UNIQUE` constraint disparar erro via `INSERT ... ON CONFLICT DO NOTHING RETURNING id`.

**REGRA #3 (ordem causal não basta para invariantes globais):** Consistência causal preserva A causa B — boa para chat ("resposta após pergunta"), comentários ("reply após post"). NÃO basta para invariantes globais como "saldo da conta nunca negativo" ou "no máximo 100 licenças vendidas". Esses exigem linearizabilidade.

**REGRA #4 (CAP é trade-off PARTICIONADO; PACELC inclui caso normal):** Durante partição de rede o sistema escolhe Consistência (rejeita writes) OU Disponibilidade (aceita writes em ambos lados, divergência). PACELC adiciona o caso normal (sem partição): escolher Latência (rede async) ou Consistência (sync replication). Postgres single-leader = **CP/PC** — rejeita writes durante partition do líder; latência alta para garantir consistência sync.

**REGRA #5 (2PC é blocking — prefira sagas ou transactional outbox para distribuídas):** 2PC (two-phase commit) trava recursos se coordinator morre entre prepare e commit (resource locks held forever). Não tem heuristic recovery automática. **Alternativas canônicas modernas**: (a) **Sagas** — transações locais com `compensate()` reverso; (b) **Transactional outbox** — write DB + event no outbox em mesma transação local, async worker publica.

**REGRA #6 (eventual consistency exige convergência testável):** Se escolher eventual consistency (feed social, contadores, métricas analytics), é obrigatório ter **teste de convergência**: simular partition + writes em ambos lados + healing → verificar que ambos lados convergem ao mesmo estado em tempo limitado. Sem teste = bug latente que aparece em produção.

## Patterns canônicos

### REQ MODELO-01 — Árvore de decisão linearizabilidade vs causal vs eventual

```
                    ┌─────────────────────────────────────────────┐
                    │ A operação precisa ver TODAS escritas       │
                    │ anteriores como atomic ordered global?      │
                    └─────────────────────────────────────────────┘
                              │                  │
                       Sim    │                  │  Não
                              ▼                  ▼
                ┌──────────────────────┐  ┌─────────────────────────────────┐
                │ LINEARIZABILIDADE    │  │ Existe relação causal A causa B │
                │ (single-leader,      │  │ que precisa ser preservada?     │
                │ UNIQUE constraint)   │  └─────────────────────────────────┘
                └──────────────────────┘            │              │
                                              Sim   │              │  Não
                                                    ▼              ▼
                                       ┌──────────────────┐  ┌────────────────┐
                                       │ CAUSAL           │  │ EVENTUAL       │
                                       │ (chat,           │  │ (feed social,  │
                                       │  comentários)    │  │  contadores,   │
                                       └──────────────────┘  │  métricas)     │
                                                             └────────────────┘
```

**3 exemplos canônicos por modelo:**

| Modelo | Exemplo 1 | Exemplo 2 | Exemplo 3 |
|---|---|---|---|
| **Linearizabilidade** | Slug global de organização (`acme-corp`) — único cross-tenant | License key — única em todo o sistema | Custom domain — único globalmente |
| **Causal** | Chat — pergunta causa resposta, ordem importa para mesmo participante | Comentários em post — reply após post | Issue tracker — comentário após mudança de status |
| **Eventual** | Feed social timeline — posts podem aparecer fora de ordem entre devices | Contadores de likes/views — eventual ≠ exato OK | Métricas analytics — agregação eventual OK |

**Trade-offs em latência:**

- **Linearizabilidade**: latência alta (round-trip ao líder), throughput limitado pelo líder
- **Causal**: latência média, mais paralelizável (réplica responde se já viu causalmente o write requerido)
- **Eventual**: latência mínima (réplica mais próxima), throughput máximo

### REQ MODELO-02 — Uniqueness constraints distribuídos via single-leader Postgres

`UNIQUE` constraint nativo Postgres é **linearizável** porque o single-leader é a fonte da verdade — todas as writes passam pelo mesmo node, conflito é detectado atomicamente.

```sql
-- Schema canônico — slug global cross-tenant (DDIA Ch 9 — uniqueness exige consenso)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,        -- UNIQUE = linearizável (single-leader)
  name text not null,
  created_at timestamptz not null default now()
);
```

**ANTI-PATTERN (race condition garantida):**

```sql
-- ❌ ERRADO — race entre SELECT e INSERT
-- Cliente A
begin;
  select id from public.organizations where slug = 'acme-corp' for update;
  -- Suponha que retorna 0 rows
  -- Cliente B nesse instante faz a mesma query — também retorna 0 rows
  insert into public.organizations (slug, name) values ('acme-corp', 'ACME Corp');
  -- Cliente B também insere → ERRO 23505 OU duplicate (se sem UNIQUE)
commit;

-- Mesmo com SELECT FOR UPDATE, o lock é por row existente
-- Se a row NÃO existe ainda, não há nada para lockar
-- Postgres NÃO oferece "lock the absence of a row" sem uma row sentinel
```

**Por quê:** `SELECT FOR UPDATE` lockeia rows existentes. Quando `WHERE slug = $1` retorna 0 rows, **não há row para lockar**. Dois clientes concorrentes ambos veem ausência, ambos tentam INSERT, um falha com erro 23505 (unique violation).

**PADRÃO CORRETO:**

```sql
-- ✅ CERTO — deixa UNIQUE constraint disparar erro atomicamente
insert into public.organizations (slug, name)
values ('acme-corp', 'ACME Corp')
on conflict (slug) do nothing
returning id;

-- Se RETURNING retornar 1 row → INSERT bem-sucedido, slug agora pertence a este client
-- Se RETURNING retornar 0 rows → slug já existia (outro client ganhou)
-- Atomicidade garantida pelo Postgres single-leader (linearizável)
```

**Variação com leitura do owner existente:**

```sql
-- Quando o caller também precisa do id quando já existe
with ins as (
  insert into public.organizations (slug, name)
  values ($1, $2)
  on conflict (slug) do nothing
  returning id
)
select id from ins
union all
select id from public.organizations where slug = $1
limit 1;
```

### REQ MODELO-03 — Análogos de total order broadcast em Postgres

Total order broadcast = entrega de mensagens a todos os nodes na **mesma ordem**. Reducível a consenso (Ch 9). Em Postgres, três análogos canônicos:

```sql
-- Análogo 1: pg_current_wal_lsn() — posição global no WAL, MONOTONICAMENTE crescente
-- Equivale a um "global counter" que todos os consumers veem na mesma ordem
select pg_current_wal_lsn();
-- → 0/1A2B3C4D — LSN (Log Sequence Number) opaco mas comparável (>, <, =)

-- Uso típico: ordenar eventos persistidos cronologicamente (cross-tabela)
select event_id, created_at, pg_current_wal_lsn() as lsn_at_insert
from public.events
order by lsn_at_insert;
```

```sql
-- Análogo 2: pg_logical_emit_message — broadcast de evento custom no WAL stream
-- Eventos NÃO precisam estar em uma tabela; ainda assim entram no WAL ordenadamente
-- Consumers de logical replication veem todos na mesma ordem

-- transactional=true → mensagem só vira visível se a transação commitar
select pg_logical_emit_message(
  true,                    -- transactional
  'app_events',            -- prefix (usado para filtrar consumers)
  '{"type":"order_paid","order_id":"abc-123"}'::text  -- payload arbitrário
);

-- Consumer (replication slot) consome via pg_logical_slot_get_changes
-- Todos os consumers veem 'order_paid' antes de qualquer evento posterior
```

```sql
-- Análogo 3: Logical replication slots — todos consumers veem mesma ordem de WAL
-- Replication slot = posição persistente no WAL stream

create publication app_pub for table public.events, public.organizations;

-- Cada consumer cria seu próprio slot
select * from pg_create_logical_replication_slot('consumer_1', 'pgoutput');

-- Consumir mudanças em ordem
select * from pg_logical_slot_get_changes('consumer_1', null, null);
-- Retorna mudanças desde último get_changes em ORDEM DE WAL
-- Múltiplos consumers veem a MESMA ordem (total order broadcast)
```

**Quando usar cada análogo:**

| Análogo | Use case | Trade-off |
|---|---|---|
| `pg_current_wal_lsn()` em coluna | Ordenar eventos cross-tabela cronologicamente | Storage extra; só funciona dentro do mesmo cluster |
| `pg_logical_emit_message` | Broadcast de evento sem persistir em tabela | Consumer precisa estar online; mensagem perdida se sem slot |
| Logical replication slots | Pipeline robusto CDC ou cross-cluster sync | Slot inativo retém WAL → risco de disk full |

**Quando necessário (motivação canônica do livro Ch 9):** invariantes globais cross-tenant — licença unique global, billing event ordering, total ordering de eventos para reconciliação financeira.

### REQ MODELO-04 — CAP teorema → PACELC com tabela 4 quadrantes

CAP é trade-off **DURANTE PARTIÇÃO**. PACELC adiciona o caso **NORMAL (sem partição)** — escolher Latência ou Consistência.

| Estado | Trade-off | Sistemas exemplares | Quando faz sentido |
|---|---|---|---|
| **Partição + escolha CP** | Rejeita writes (consistência preservada) | Postgres single-leader (rejeita writes durante partition do líder), HBase | Invariantes financeiros, uniqueness global, transações monetárias |
| **Partição + escolha AP** | Aceita writes em ambos lados (divergência) | Cassandra, DynamoDB, CouchDB | Feed social, métricas analytics, contadores onde divergência é tolerável |
| **Normal + escolha PC** | Latência alta para garantir consistência (sync replication) | Spanner (commit timestamp via TrueTime), CockroachDB (Raft), Postgres synchronous_commit | Multi-region com SLA de consistência, financeiro distribuído |
| **Normal + escolha PL** | Latência baixa, eventual consistency (async replication) | DynamoDB, Cassandra, Postgres com async replicas | Geo-distribuído com priority em latência local, leitura de dados não-críticos |

**Mapeamento Postgres + Supabase:**

- **Postgres single-leader** = **CP/PC** — rejeita writes se líder em partition; sync replication se `synchronous_commit = on` com sync replica.
- **Supabase read replicas (Pro+)** = **CP no líder + PL na réplica** — write é CP (líder rejeita se isolado); read pode ser PL (réplica retorna stale data com baixa latência).
- **Eventual consistency manual via app** (escrever em pgmq + processar async) = **AP/PL** — write aceita sempre (não bloqueia se consumer offline); eventual no consumer side.

**REGRA derivada do PACELC:** declarar EXPLICITAMENTE no design de cada feature: (a) o que acontece durante partition, (b) o que acontece em operação normal. Não declarar = bug latente quando partition acontecer.

### REQ MODELO-05 — 2PC limitações + alternativas modernas

**2PC (two-phase commit)** é o protocolo clássico de commit atômico distribuído:

```
Coordinator                Participant 1            Participant 2
    │  ─── prepare? ──────►   │                        │
    │                         │  ─── prepare? ─────►   │
    │  ◄──── prepared ────    │                        │
    │                         │  ◄──── prepared ───    │
    │  ─── commit ──────────► │                        │
    │                         │  ─── commit ────────►  │
```

**Limitações canônicas (DDIA Ch 9):**

1. **Blocking se coordinator morre entre prepare e commit** — participants seguram resource locks indefinidamente, esperando decisão do coordinator. "Heuristic recovery" exige intervenção humana e pode resultar em divergência.
2. **Performance impact** — 2 round-trips (prepare + commit), latência multiplicada por 2 vs single-node commit. Em sistemas de alta concorrência, contention nos resource locks.
3. **Falta de heuristic recovery automática** — se coordinator nunca volta, participant não sabe se outros commitam ou abortam. Decisão unilateral pode quebrar atomicidade.

**Alternativa 1: Sagas (compensação local)**

Cada step é uma transação local. Cada step tem `compensate()` reverso. Se step N falha, executar `compensate()` de N-1, N-2, ... 1.

```sql
-- Saga: cancelar order + estornar pagamento + restaurar inventário

-- Step 1: cancelar order
begin;
  update public.orders set status = 'cancelled' where id = $1;
  insert into public.saga_steps (saga_id, step, status) values ($2, 'cancel_order', 'done');
commit;

-- Step 2: estornar pagamento (chama API externa via Edge Function)
-- Se falha → compensate Step 1: restore order status
-- Compensate é uma transação local, não distribuída

-- Step 3: restaurar inventário
-- Se falha → compensate Step 2 (recharge) + Step 1 (restore order)
```

**Quando usar sagas:** microservices distribuídos onde cada serviço tem seu próprio DB; latência tolerável (sequencial); compensação faz sentido semanticamente (idempotência + reversibilidade).

**Alternativa 2: Transactional outbox**

Write DB + event no outbox em **mesma transação local** (atomic, single-node). Worker async lê outbox e publica em broker (Kafka/pgmq). Garante exactly-once entre DB e broker.

```sql
-- Schema do outbox
create table public.outbox (
  id bigserial primary key,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Index parcial para worker pegar só pendentes
create index outbox_pending_idx on public.outbox (id)
  where processed_at is null;

-- Pattern de uso (atomic write + event)
begin;
  insert into public.orders (customer_id, total) values ($1, $2);
  insert into public.outbox (event_type, payload)
    values ('order_created', jsonb_build_object('order_id', currval('orders_id_seq')));
commit;
-- Atomic: ou ambos commitam, ou nenhum

-- Worker assíncrono (Edge Function via pg_cron)
with claimed as (
  update public.outbox
  set processed_at = now()
  where id = (
    select id from public.outbox
    where processed_at is null
    order by id
    limit 1
    for update skip locked
  )
  returning *
)
select pgmq.send('events', payload) from claimed;
-- skip locked → múltiplos workers processam em paralelo sem conflito
```

**Vantagens transactional outbox vs 2PC:**

- Sem coordinator distribuído — DB local é o único ponto atomicidade.
- Sem blocking — se worker morre, outro worker pega via `for update skip locked`.
- Escala horizontalmente (múltiplos workers).
- Cross-ref ATIVO para [`audit-log-multi-tenant`](../audit-log-multi-tenant/SKILL.md) — pattern audit_log v1.21 É um caso específico de outbox (write principal + audit_log row em mesma transação).

**Quando usar transactional outbox:** publish-after-write em pipeline async, sem necessidade de blocking commit cross-service. Default canônico para event-driven em B2B SaaS.

## Anti-patterns

### Anti-pattern 1: SELECT-then-INSERT app-level para uniqueness

**Errado:**

```typescript
// ❌ Race condition garantida
const existing = await supabase
  .from('organizations')
  .select('id')
  .eq('slug', slug)
  .single();

if (!existing.data) {
  await supabase
    .from('organizations')
    .insert({ slug, name });
}
```

**Por quê:** entre o SELECT e o INSERT, outro cliente pode INSERT — duplicata ou erro 23505.

**Certo:** ON CONFLICT (REGRA #2):

```typescript
// ✅ Atomic, sem race
const { data, error } = await supabase
  .from('organizations')
  .insert({ slug, name })
  .select('id')
  .single();

if (error?.code === '23505') {
  // Slug já existia — pode optar por buscar o id existente
  const existing = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();
  return existing.data?.id;
}
return data?.id;
```

### Anti-pattern 2: Usar eventual consistency para invariantes financeiros

**Errado:** "saldo da conta nunca negativo" implementado lendo do read replica:

```typescript
// ❌ Read replica pode estar atrasada → permite débito que faria saldo negativo
const balance = await supabaseReadReplica
  .from('accounts')
  .select('balance')
  .eq('id', accountId)
  .single();

if (balance.data.balance >= amount) {
  await supabasePrimary
    .from('accounts')
    .update({ balance: balance.data.balance - amount })
    .eq('id', accountId);
}
```

**Por quê:** read replica retorna saldo desatualizado (eventual). Cliente pode passar a verificação local e debitar, mas o líder já tem outras transações em andamento → saldo negativo possível.

**Certo:** invariantes financeiros = linearizabilidade no líder + lock pessimista (`SELECT FOR UPDATE`) ou condicional (`UPDATE WHERE balance >= amount`):

```sql
-- ✅ Lock pessimista
begin;
  select balance from public.accounts where id = $1 for update;
  -- Verifica balance + amount em mesmo transação
  update public.accounts set balance = balance - $2 where id = $1;
commit;

-- OU update condicional atomic
update public.accounts
set balance = balance - $2
where id = $1 and balance >= $2
returning balance;
-- Se RETURNING vazio → saldo insuficiente; nada foi alterado
```

### Anti-pattern 3: 2PC entre Edge Function e API externa

**Errado:** tentar usar `BEGIN; ... ; PREPARE TRANSACTION; ...` para coordenar Postgres + API externa:

```sql
-- ❌ PREPARE TRANSACTION precisa que API externa também suporte 2PC
-- Quase nenhuma API externa suporta (Stripe, Twilio, Meta — nenhuma)
begin;
  insert into public.orders (...) values (...);
  -- chamada à Stripe API aqui não pode participar de 2PC
prepare transaction 'order_with_payment';
```

**Por quê:** API externa não tem `prepare` e `commit` separados. Se Stripe processa o cobro mas Postgres falha em commit, dinheiro foi cobrado sem order. Inconsistência.

**Certo:** transactional outbox + worker idempotente (REGRA #5):

```sql
begin;
  insert into public.orders (...) values (...);
  insert into public.outbox (event_type, payload)
    values ('charge_payment', jsonb_build_object('order_id', currval('orders_id_seq'), 'amount', $1));
commit;
-- Worker async lê outbox, chama Stripe com idempotency key, retry-safe
```

Idempotency key garante que retry não cobra duas vezes. Stripe expõe `Idempotency-Key` header para isso.

### Anti-pattern 4: Confundir consistência causal com linearizabilidade

**Errado:** assumir que "ordem causal preservada" = "invariante global respeitado".

```typescript
// ❌ "Vou usar consistência causal porque chat tem ordem causal"
// Mas o use case real era: limite de 10 mensagens grátis por user
const messageCount = await supabaseCausal
  .from('messages')
  .select('count', { count: 'exact', head: true })
  .eq('user_id', userId)
  .single();

if (messageCount.count < 10) {
  await supabaseCausal.from('messages').insert({ user_id: userId, ... });
}
```

**Por quê:** consistência causal preserva A→B no caminho causal, mas count é uma agregação **global**. Dois inserts concorrentes em devices diferentes podem ambos passar a verificação (cada um vê count=9) → user envia 11 mensagens.

**Certo:** invariantes globais (limite N, saldo, uniqueness) = linearizabilidade. Use single-leader Postgres + atomic check:

```sql
-- ✅ Atomic check via UPDATE condicional
update public.users
set messages_count = messages_count + 1
where id = $1 and messages_count < 10
returning messages_count;
-- Se RETURNING vazio → limite atingido
```

### Anti-pattern 5: Outbox sem cleanup → tabela cresce sem limite

**Errado:** `INSERT INTO outbox` sem nunca DELETAR rows processadas:

```sql
update public.outbox set processed_at = now() where id = $1;
-- Mas nunca DELETE → tabela cresce 1M+ rows/mês
```

**Por quê:** outbox processada vira lixo — não precisa mais. Tabela inflada degrada performance dos índices, vacuum lento, disk usage cresce.

**Certo:** cron periódico para arquivar/deletar processadas > N dias:

```sql
-- pg_cron job daily
select cron.schedule(
  'cleanup_outbox',
  '0 3 * * *',
  $$
    delete from public.outbox
    where processed_at is not null
      and processed_at < now() - interval '7 days';
  $$
);
```

Cross-ref para [`supabase-cron-queues`](../supabase-cron-queues/SKILL.md) (v1.8) — pattern pg_cron + retention.

## Ver também

- [_shared-dados-distribuidos/glossary.md](../_shared-dados-distribuidos/glossary.md) — termos `linearizability`, `causal consistency`, `eventual consistency`, `total order broadcast`, `CAP theorem`, `PACELC`, `two-phase commit`, `saga pattern`, `transactional outbox` (seções a + f)
- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — Phase 109 v1.21, pattern audit_log É transactional outbox
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — v1.8, pgmq como destino do outbox + cleanup retention
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — v1.8, STABLE/IMMUTABLE markers em helpers consumidos
- [streams-eventos-cdc](../streams-eventos-cdc/SKILL.md) — Phase 121 (irmã), event sourcing como aplicação prática de transactional outbox
- DDIA Ch 9 (Consistency and Consensus, summary p.354) — material-fonte canônico
</content>
</invoke>