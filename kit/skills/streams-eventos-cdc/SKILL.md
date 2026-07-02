---
name: streams-eventos-cdc
cost_tier: leve
description: Orienta implementação de event stream em Supabase — AMQP/JMS-style vs log-based (pgmq), CDC via wal2json + Realtime ou pglogical→Kafka, event sourcing append-only e exactly-once com dedup table.
---

# Streams, Eventos e CDC — Brokers, Event Sourcing, Exactly-Once em Postgres

## Quando usar

LLM carrega esta skill ao implementar pipeline event-driven em Supabase + Postgres. Trigger phrases:

- "event stream Postgres", "CDC Supabase", "wal2json + Realtime"
- "pgmq vs LISTEN/NOTIFY", "broker log-based vs AMQP"
- "event sourcing Postgres", "tabela append-only de eventos"
- "exactly-once pgmq", "dedup table idempotency"
- "stream join com janela", "stream-table CDC enrichment"
- "log compaction Postgres", "snapshot eventos"
- "projeção materialized view de eventos", "denormalization via trigger"

Esta skill **estende** [`audit-log-multi-tenant`](../audit-log-multi-tenant/SKILL.md) (v1.21) ao reconhecer audit_log como event sourcing parcial; [`supabase-cron-queues`](../supabase-cron-queues/SKILL.md) (v1.8) para pgmq pattern; e [`supabase-realtime`](../supabase-realtime/SKILL.md) (v1.8) para broadcast como CDC stream.

Material-fonte: *Designing Data-Intensive Applications*, Martin Kleppmann (O'Reilly 2017), capítulo 11 "Stream Processing" (linhas 17812-19637 do material extraído; summary 19408-19481). Termos canônicos PT-BR ↔ EN definidos em [`../_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) seção (h).

## Regras absolutas

**REGRA #1 (broker log-based default para event sourcing):** Para event sourcing, CDC ou pipeline com replay obrigatório, escolher **log-based broker** (Kafka, pgmq) — mensagem retida (TTL configurável), múltiplos consumers tracked offset independente, replay possível. AMQP/JMS-style (RabbitMQ, LISTEN/NOTIFY) deletam mensagem após ack — sem replay, single-consumer.

**REGRA #2 (CDC via wal2json + Realtime é default Supabase):** Se ambiente é Supabase + use case é sync índice/desnormalização/multi-region, default é wal2json + Supabase Realtime broadcast. Zero infra extra. Apenas considerar pglogical → Kafka externo se warehousing analítico for o uso primário.

**REGRA #3 (event sourcing exige tabela append-only + projeções derivadas):** Tabela `events` deve ser **append-only** (REVOKE DELETE/UPDATE como audit_log v1.21). Estado atual = projeção derivada via Materialized View ou trigger-maintained denormalization — NUNCA escrever direto em "tabela de estado". Source of truth = stream de eventos.

**REGRA #4 (exactly-once pgmq exige dedup + idempotency + transactional outbox):** pgmq não garante exactly-once nativo (at-least-once entrega). Para semântica exactly-once: (a) **dedup table** com `unique(event_id)` rejeitando duplicatas; (b) **handler idempotente** (mesmo input → mesmo output, sem efeitos colaterais); (c) **transactional outbox** para cross-service writes.

**REGRA #5 (stream join exige janela temporal explícita):** Stream-stream join sem janela = memória cresce sem limite (cada evento aguarda match indefinidamente). Toda janela deve ter TTL explícito (tumbling, sliding, session). Default: tumbling 5min para business events; sliding 1min para latency-sensitive.

**REGRA #6 (log compaction não-trivial em pgmq — exige snapshot manual):** pgmq não tem log compaction nativa (Kafka tem). Para event sourcing com snapshot: criar tabela `snapshots` periodicamente, deletar `events.id < snapshot_lsn` correspondente. Sem snapshot = tabela `events` cresce sem limite, replay torna-se O(n) caro.

## Patterns canônicos

### REQ STREAMS-01 — Brokers AMQP/JMS-style vs log-based

| Tipo | Exemplos | Mensagem após ack | Multi-consumer | Replay | Use case |
|---|---|---|---|---|---|
| **AMQP/JMS-style** | RabbitMQ, postgres `LISTEN/NOTIFY`, ActiveMQ | Deletada (consumida) | Single (work queue — distribui rounds robin) | Não (gone after ack) | Task queue async (envio email, geração PDF) |
| **Log-based** | Kafka, pgmq, Redpanda, Pulsar | Retida (TTL configurável) | Multiple (cada consumer tracks offset independente) | Sim (replay desde offset N) | Event sourcing, CDC, audit, analytics |

**Como escolher:**

```
Use case precisa de replay? ─── Sim ──► log-based (pgmq, Kafka)
                  │
                  Não
                  │
                  ▼
Múltiplos consumers veem mesma mensagem? ─── Sim ──► log-based
                  │
                  Não
                  │
                  ▼
Mensagem é "task" descartável após processada? ─── Sim ──► AMQP/JMS-style (RabbitMQ, LISTEN/NOTIFY)
                  │
                  Não
                  │
                  ▼
Default (event-driven em B2B SaaS): log-based (pgmq)
```

**Exemplo postgres LISTEN/NOTIFY (AMQP-style — single consumer, sem replay):**

```sql
-- Producer
notify ch_orders, '{"order_id":"abc-123","status":"paid"}';

-- Consumer (Edge Function)
listen ch_orders;
-- Sleep até receber notification — single consumer recebe, mensagem some
```

**Exemplo pgmq (log-based — multi-consumer, replay):**

```sql
-- Setup (uma vez)
select pgmq.create('orders');

-- Producer
select pgmq.send('orders', '{"order_id":"abc-123","status":"paid"}');

-- Consumer 1 (worker A)
select * from pgmq.read('orders', 30, 1);
-- vt=30s (visibility timeout), 1 mensagem por leitura
-- Após ler: mensagem fica invisível por 30s — outro worker não pega
-- Worker A processa e dá ack:
select pgmq.delete('orders', msg_id);
-- Sem ack em 30s → mensagem volta à queue (at-least-once)

-- Consumer 2 (worker B / archive)
-- Se queue tem retention, archive table mantém histórico para replay
select * from pgmq.archive('orders', msg_id);
-- Mensagens em archive são replayable
```

### REQ STREAMS-02 — 3 padrões CDC em Postgres

CDC (Change Data Capture) = capturar mudanças no DB como stream de eventos. 3 abordagens canônicas em Supabase:

**Abordagem 1: wal2json + Supabase Realtime broadcast** (default)

```sql
-- Habilitar replication identity (necessário para wal2json capturar UPDATE/DELETE com colunas)
alter table public.orders replica identity full;

-- Supabase Realtime já consome WAL via wal2json internamente
-- Cliente subscreve canal específico via JS client
```

```typescript
// Cliente Supabase consume CDC stream via Realtime
const channel = supabase
  .channel('orders-cdc', { config: { private: true } })
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'orders' },
    (payload) => {
      // payload.eventType: INSERT | UPDATE | DELETE
      // payload.new: nova row (INSERT/UPDATE)
      // payload.old: row antiga (UPDATE/DELETE — exige replica identity full)
      console.log('CDC event:', payload);
    }
  )
  .subscribe();
```

**Trade-offs:** zero infra extra; baixa latência (sub-segundo); RLS aplicada nas mensagens (cada cliente vê só rows permitidas). Limite: scale na ordem de milhares de subscribers por canal.

**Abordagem 2: pglogical → Kafka externo** (warehousing analítico)

```sql
-- Em Supabase Pro+ habilitar pglogical (extensão)
create extension if not exists pglogical;

-- Setup nó provider (Postgres source)
select pglogical.create_node(
  node_name := 'supabase_prod',
  dsn := 'host=db.xxx.supabase.co dbname=postgres'
);

-- Replication set para tabelas que viram stream
select pglogical.create_replication_set(set_name := 'cdc_set');
select pglogical.replication_set_add_table('cdc_set', 'public.orders', synchronize_data := false);

-- Conector Kafka (Debezium ou similar) consome pglogical → publica em Kafka topic
-- Trade-off: requer infra Kafka externa, latência maior (segundos), throughput muito maior
```

**Abordagem 3: Trigger-based** (casos custom onde wal2json não cobre)

```sql
-- Trigger que emite evento custom quando flag X muda
create or replace function public.emit_lead_qualified_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.stage != 'qualified' and new.stage = 'qualified' then
    insert into public.outbox (event_type, payload)
    values (
      'lead_qualified',
      jsonb_build_object(
        'lead_id', new.id,
        'org_id', new.org_id,
        'qualified_by', (select auth.uid()),
        'qualified_at', now()
      )
    );
  end if;
  return new;
end;
$$;

create trigger lead_qualified_trigger
  after update on public.leads
  for each row
  execute function public.emit_lead_qualified_event();
```

**Quando usar trigger-based:** semântica de evento mais rica que "linha mudou" (ex: business event "qualified" derivado de mudança específica). Worker async lê outbox e publica downstream.

**Use cases canônicos:**

| Use case | Abordagem recomendada |
|---|---|
| Sync índice de busca (Elasticsearch, Meilisearch) | wal2json + Realtime → função client que sincroniza |
| Desnormalização (Materialized View atualizada por evento) | Trigger-based (mais controle sobre quando refresh) |
| Sync multi-region cold standby | pglogical → Kafka → consumer remoto |
| Audit log retroativo + análise comportamental | wal2json (captura cru) → analytics warehouse |
| Notificação push (mobile app) | Realtime broadcast direto (zero step intermediário) |

### REQ STREAMS-03 — Event sourcing em Postgres

**Princípio canônico:** eventos imutáveis são source of truth; estado atual é projeção derivada.

**Schema canônico:**

```sql
-- Tabela events — source of truth (append-only)
create table public.events (
  id bigserial primary key,
  aggregate_id uuid not null,           -- ID da entidade (order, user, ...)
  aggregate_type text not null,         -- Tipo da entidade ('order', 'user')
  event_type text not null,             -- 'order_created', 'order_paid', 'order_shipped'
  payload jsonb not null,               -- Detalhes do evento
  metadata jsonb,                       -- actor_id, request_id, trace_id
  created_at timestamptz not null default now()
);

-- Index canônico (para reproduzir histórico de uma entidade)
create index events_aggregate_idx on public.events (aggregate_id, id);

-- Index para query por tipo (analytics)
create index events_type_created_idx on public.events (event_type, created_at);

-- REGRA #3 — append-only: REVOKE DELETE/UPDATE
revoke delete, update on public.events from public, authenticated, anon, service_role;
-- Apenas postgres role pode deletar (cleanup com snapshot)
```

**Cross-ref ATIVO** para [`audit-log-multi-tenant`](../audit-log-multi-tenant/SKILL.md) (v1.21) — audit_log É event sourcing semantics: append-only, imutável, retém histórico cronológico. Quem implementou audit_log já fez event sourcing parcial.

**Projeção via Materialized View:**

```sql
-- Projeção: estado atual de cada order derivado dos eventos
create materialized view public.order_state as
select
  aggregate_id as order_id,
  -- Reconstrói estado a partir dos eventos (último win)
  (array_agg(payload->>'status' order by id desc))[1] as current_status,
  (array_agg(payload->>'total' order by id desc))[1]::numeric as current_total,
  min(created_at) as created_at,
  max(created_at) as updated_at,
  count(*) as event_count
from public.events
where aggregate_type = 'order'
group by aggregate_id;

create unique index on public.order_state (order_id);

-- Refresh (incremental via concurrent OR full)
refresh materialized view concurrently public.order_state;
-- Ou via pg_cron a cada N minutos
```

**Projeção via trigger-maintained denormalization:**

```sql
-- Tabela de estado mantida por trigger (atualizada por cada novo evento)
create table public.order_current_state (
  order_id uuid primary key,
  status text not null,
  total numeric,
  updated_at timestamptz not null default now()
);

create or replace function public.project_order_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.aggregate_type = 'order' then
    insert into public.order_current_state (order_id, status, total, updated_at)
    values (
      new.aggregate_id,
      new.payload->>'status',
      (new.payload->>'total')::numeric,
      new.created_at
    )
    on conflict (order_id) do update
    set status = excluded.status,
        total = coalesce(excluded.total, public.order_current_state.total),
        updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;

create trigger project_order_event_trigger
  after insert on public.events
  for each row
  execute function public.project_order_event();
```

**Quando MV vs trigger:**

| Critério | MV concurrent refresh | Trigger denormalization |
|---|---|---|
| **Latência** | Periódica (minutos) | Imediata (no commit do evento) |
| **Custo write** | Baixo (write apenas em events) | Alto (write em events + state) |
| **Custo read** | Baixo (state já agregado) | Baixo |
| **Use case** | Analytics, dashboards | UI real-time, business state |

### REQ STREAMS-04 — Exactly-once em pgmq

pgmq oferece **at-least-once** nativo (mensagem reenviada se worker crash sem ack). Para semântica **exactly-once**, combinação de 3 técnicas:

**Técnica 1: Dedup table com unique(event_id)**

```sql
-- Tabela de eventos já processados
create table public.processed_events (
  event_id uuid primary key,
  processed_at timestamptz not null default now(),
  processor text not null              -- nome do worker para debug
);
```

**Técnica 2: Handler atomic — INSERT na dedup + processamento na MESMA transação**

```sql
-- Worker (Edge Function ou função PG)
create or replace function public.process_order_event(p_msg_id bigint)
returns void
language plpgsql
security definer  -- worker tem privilégios elevados
set search_path = ''
as $$
declare
  v_msg record;
  v_event_id uuid;
begin
  -- Lê mensagem da queue com visibility timeout
  select msg_id, message into v_msg
  from pgmq.read('orders', 30, 1)
  limit 1;

  if v_msg is null then return; end if;

  v_event_id := (v_msg.message->>'event_id')::uuid;

  begin
    -- Atomic: INSERT dedup + processamento
    insert into public.processed_events (event_id, processor)
    values (v_event_id, 'process_order_event');
    -- Falha (unique violation) se já processado → exception abort tudo

    -- ... lógica de processamento idempotente ...
    update public.orders set status = 'paid' where id = (v_msg.message->>'order_id')::uuid;

    -- Ack — remove da queue
    perform pgmq.delete('orders', v_msg.msg_id);

  exception when unique_violation then
    -- Já processado — apenas dar ack para remover da queue
    perform pgmq.delete('orders', v_msg.msg_id);
  end;
end;
$$;
```

**Técnica 3: Idempotency key no handler — mesmo input → mesmo output (sem efeitos colaterais)**

Idempotency = processar a mesma mensagem N vezes produz o mesmo resultado. Padrões:

```sql
-- Idempotente via UPDATE condicional (não muda se já está no estado)
update public.orders
set status = 'paid'
where id = $1 and status != 'paid';
-- Se já 'paid' → no-op, RETURNING vazio

-- Idempotente via INSERT ON CONFLICT
insert into public.payments (order_id, amount, transaction_id)
values ($1, $2, $3)
on conflict (transaction_id) do nothing;
-- Mesmo transaction_id → no-op
```

**Cross-ref ATIVO** para [`escolha-modelo-consistencia`](../escolha-modelo-consistencia/SKILL.md) — pattern transactional outbox descrito lá é a base de exactly-once entre DB e broker (write atomic em mesma transação).

### REQ STREAMS-05 — 3 tipos de stream join com SQL exemplo

**Tipo 1: Stream-stream join (com janela temporal)**

Match de eventos de 2 streams dentro de uma janela. Ex: matching pedido + pagamento dentro de 5min via tumbling window.

```sql
-- Materialização: 2 tabelas event log + JOIN com window
create table public.order_events (
  order_id uuid not null,
  event_at timestamptz not null,
  event_type text not null,
  payload jsonb
);

create table public.payment_events (
  payment_id uuid not null,
  order_id uuid not null,
  event_at timestamptz not null,
  amount numeric
);

-- Stream-stream join via tumbling window 5min
create or replace view public.order_payment_join_5min as
select
  o.order_id,
  o.event_at as order_at,
  p.event_at as paid_at,
  p.amount,
  date_trunc('minute', o.event_at) as window_start
from public.order_events o
join public.payment_events p on p.order_id = o.order_id
where o.event_type = 'order_created'
  and p.event_at between o.event_at and o.event_at + interval '5 minutes'
order by o.event_at;
```

**Trade-off:** janela tumbling = não-overlapping, mais simples; sliding = overlapping, mais alertas; session = dinâmica, agrupada por user activity.

**Tipo 2: Stream-table join (CDC + atividade — enrichment)**

Stream de eventos enriquecido com lookup em tabela de referência atualizada por CDC.

```sql
-- Tabela users mantida atualizada via CDC (Realtime ou trigger)
-- Stream de eventos: clicks, logins, purchases — precisa enriched com user info

select
  e.event_id,
  e.event_type,
  e.event_at,
  -- Enrichment: lookup do user no momento atual (não do momento do evento)
  u.email,
  u.tier,
  u.country
from public.user_events e
join public.users u on u.id = e.user_id
where e.event_at > now() - interval '1 hour';

-- Para latência baixa: keep tabela users em memória do worker (CDC stream → cache)
```

**Cuidado canônico:** se a tabela mudou desde o evento, enrichment usa o estado **atual** do user, não o estado **no momento do evento**. Para histórico fiel: capturar snapshot no payload do evento (ex: `payload.user_email_at_event`).

**Tipo 3: Table-table join (merge de changelogs CDC)**

Merge de 2 changelogs CDC para produzir view denormalizada. Ex: orders changelog + customers changelog → view denormalizada de pedidos com info do cliente.

```sql
-- Materialized view derivada de 2 streams CDC mergeados
create materialized view public.orders_denorm as
select
  o.order_id,
  o.status,
  o.total,
  o.created_at as order_created_at,
  c.email as customer_email,
  c.tier as customer_tier,
  c.country as customer_country
from public.orders o
join public.customers c on c.id = o.customer_id;

create unique index on public.orders_denorm (order_id);

-- Refresh disparado por CDC events em orders OU customers
create or replace function public.refresh_orders_denorm()
returns trigger
language plpgsql
as $$
begin
  refresh materialized view concurrently public.orders_denorm;
  return null;
end;
$$;

create trigger orders_changelog_trigger
  after insert or update on public.orders
  for each statement
  execute function public.refresh_orders_denorm();

create trigger customers_changelog_trigger
  after update on public.customers
  for each statement
  execute function public.refresh_orders_denorm();
```

**Trade-off:** refresh CONCURRENTLY exige unique index, latência maior. Para tabelas grandes, usar incremental refresh via trigger denormalization (REQ STREAMS-03).

### REQ STREAMS-06 — Log compaction strategy

Log compaction = para cada chave, manter apenas o último valor. Reduz storage sem perder estado atual.

**pgmq não tem nativa** — usa retention TTL via `vacuum_archive`:

```sql
-- pgmq archive movido para tabela archive periodicamente
select pgmq.archive('orders', 12345);
-- Após N dias na archive, vacuum_archive deleta hard

-- Configurar TTL via pg_cron
select cron.schedule(
  'pgmq_vacuum_archive',
  '0 2 * * *',
  $$ select pgmq.purge_archive('orders', 30); $$
  -- Deleta da archive mensagens > 30 dias
);
```

**Event sourcing exige snapshot periódico + compact:**

```sql
-- Tabela de snapshots — estado materializado a cada N eventos
create table public.snapshots (
  aggregate_id uuid primary key,
  snapshot_lsn bigint not null,        -- até qual event.id este snapshot reflete
  state jsonb not null,                -- estado serializado
  created_at timestamptz not null default now()
);

-- Função: criar snapshot para um aggregate quando event_count > threshold
create or replace function public.create_snapshot(p_aggregate_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state jsonb;
  v_snapshot_lsn bigint;
begin
  -- Reproduzir todos os eventos para construir estado atual
  select
    jsonb_build_object(
      'status', (array_agg(payload->>'status' order by id desc))[1],
      'total', (array_agg(payload->>'total' order by id desc))[1]::numeric,
      'event_count', count(*)
    ),
    max(id)
  into v_state, v_snapshot_lsn
  from public.events
  where aggregate_id = p_aggregate_id;

  -- Salvar snapshot (insert or update)
  insert into public.snapshots (aggregate_id, snapshot_lsn, state)
  values (p_aggregate_id, v_snapshot_lsn, v_state)
  on conflict (aggregate_id) do update
  set snapshot_lsn = excluded.snapshot_lsn,
      state = excluded.state,
      created_at = now();
end;
$$;

-- Compact: deletar eventos < snapshot_lsn (tomados em consideração no snapshot)
-- ATENÇÃO: requer privilégio especial (REGRA #3 — REVOKE DELETE em events)
-- Apenas postgres role + função SECURITY DEFINER
create or replace function public.compact_aggregate_events(p_aggregate_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted int;
  v_snapshot_lsn bigint;
begin
  -- Confirmar que snapshot existe
  select snapshot_lsn into v_snapshot_lsn
  from public.snapshots
  where aggregate_id = p_aggregate_id;

  if v_snapshot_lsn is null then
    raise exception 'Snapshot ausente para aggregate_id %', p_aggregate_id;
  end if;

  -- Deletar eventos antes do snapshot
  delete from public.events
  where aggregate_id = p_aggregate_id
    and id <= v_snapshot_lsn;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.compact_aggregate_events from public, authenticated, anon;
-- Apenas service_role pode chamar
```

**Estratégia canônica:** snapshot a cada 1000 eventos por aggregate; compact após snapshot validado (replay do snapshot reproduz estado atual). Sem snapshot/compact, replay para reconstruir estado torna-se O(n) caro em aggregates antigos.

## Anti-patterns

### Anti-pattern 1: Usar LISTEN/NOTIFY para event sourcing

**Errado:**

```sql
-- ❌ LISTEN/NOTIFY como "event log"
notify ch_orders, '{"order_id":"abc","event":"paid"}';
-- Consumer offline → mensagem perdida
-- Sem replay, sem multi-consumer
```

**Por quê:** LISTEN/NOTIFY é AMQP/JMS-style — single consumer ativo recebe, mensagem some. Se consumer offline durante notify, evento perdido. Sem replay.

**Certo:** pgmq (log-based) ou tabela `events` append-only para event sourcing (REGRA #1).

### Anti-pattern 2: Event sourcing sem dedup → eventos duplicados

**Errado:**

```sql
-- ❌ Worker pgmq processa sem dedup table
create or replace function public.process_event(p_msg jsonb)
returns void
language plpgsql
as $$
begin
  -- Processa direto, sem checar se já processado
  update public.orders set status = 'paid' where id = (p_msg->>'order_id')::uuid;
  -- Se mensagem reentregue (worker crash + redelivery) → status setado 2×
  -- Se webhook externo → cobra cliente 2×
end;
$$;
```

**Por quê:** pgmq é at-least-once. Mensagem pode ser entregue >1× (worker crash sem ack, visibility timeout expirado). Sem dedup, processamento repetido = side effect duplicado.

**Certo:** dedup table + handler idempotente (REGRA #4). Mesmo input → mesmo output.

### Anti-pattern 3: Stream-stream join sem janela temporal

**Errado:**

```sql
-- ❌ Sem janela temporal: memória cresce indefinidamente
select o.order_id, p.payment_id
from public.order_events o
join public.payment_events p on p.order_id = o.order_id;
-- Cada evento aguarda match indefinido — payment de 3 anos atrás casa com order recente
-- Memória do worker cresce sem limite
```

**Por quê:** stream join sem TTL = sistema mantém eventos em memória aguardando match. Memória cresce linearmente com tempo, eventualmente OOM.

**Certo:** janela explícita (REGRA #5):

```sql
-- ✅ Tumbling window 5min
join public.payment_events p on p.order_id = o.order_id
where p.event_at between o.event_at and o.event_at + interval '5 minutes';
```

### Anti-pattern 4: Materialized View sem CONCURRENTLY → bloqueio em refresh

**Errado:**

```sql
-- ❌ refresh sem CONCURRENTLY trava reads na MV durante refresh
refresh materialized view public.order_state;
-- Bloqueia SELECT na MV até terminar — minutos em MVs grandes
```

**Por quê:** refresh exclusivo locka a MV. Leitores ficam bloqueados.

**Certo:** CONCURRENTLY + unique index na MV:

```sql
-- ✅ Unique index obrigatório para CONCURRENTLY
create unique index on public.order_state (order_id);

refresh materialized view concurrently public.order_state;
-- Refresh em background; reads continuam funcionando
```

### Anti-pattern 5: Event sourcing sem snapshot → replay O(n) caro

**Errado:**

```sql
-- ❌ Reconstruir estado de aggregate antigo via replay completo
select * from public.events
where aggregate_id = $1
order by id;
-- Aggregate com 1M eventos → query lenta, alocação memória pesada
```

**Por quê:** sem snapshot, replay para reconstruir estado é O(n) onde n = número total de eventos do aggregate. Em aggregates antigos (orders de 5 anos), aggregação fica cara.

**Certo:** snapshot periódico + replay incremental (REGRA #6):

```sql
-- ✅ Carregar snapshot + replay apenas eventos posteriores
select state from public.snapshots where aggregate_id = $1;
-- Aplicar eventos com id > snapshot_lsn (poucos eventos recentes)
select * from public.events
where aggregate_id = $1 and id > (select snapshot_lsn from public.snapshots where aggregate_id = $1);
```

## Ver também

- [_shared-dados-distribuidos/glossary.md](../_shared-dados-distribuidos/glossary.md) — termos `AMQP/JMS-style broker`, `log-based broker`, `CDC`, `event sourcing`, `exactly-once semantics`, `at-least-once semantics`, `stream-stream join`, `stream-table join`, `table-table join`, `log compaction` (seção h)
- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — Phase 109 v1.21, audit_log É event sourcing semantics (REQ STREAMS-03 cross-ref ATIVO)
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — v1.8, pgmq pattern + cleanup retention TTL
- [supabase-realtime](../supabase-realtime/SKILL.md) — v1.8, broadcast como CDC stream (REQ STREAMS-02 abordagem 1)
- [escolha-modelo-consistencia](../escolha-modelo-consistencia/SKILL.md) — Phase 121 (irmã), transactional outbox como base de exactly-once (REQ STREAMS-04 cross-ref ATIVO)
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — v1.8, security invoker + search_path canônicos
- DDIA Ch 11 (Stream Processing, summary p.464) — material-fonte canônico
</content>
</invoke>