---
name: consistencia-leitura-replica
description: Use ao usar Supabase read replicas via Supavisor (porta 6543) ou ao combinar Realtime broadcast + leitura DB — 3 problemas canônicos DDIA Ch 5 (read-after-write inconsistente, leituras não-monotônicas, prefixo causal violado), 3 soluções para Supabase (leitura no líder após escrita, sticky session por user_id, detecção stale via pg_last_wal_replay_lsn), padrão "ler o próprio broadcast" para evitar re-fetch após broadcast.
---

# Consistência Leitura Réplica — Supabase + Supavisor + Realtime

## Quando usar

LLM carrega esta skill ao usar Supabase Pro+ com **read replicas** ou ao combinar Realtime broadcast com leitura subsequente do DB. Trigger phrases:

- "Supabase read replica", "réplica de leitura"
- "porta 6543 vs 5432", "Supavisor session vs transaction"
- "read-after-write", "leitura após escrita inconsistente"
- "monotonic reads", "leituras não-monotônicas"
- "consistent prefix reads", "prefixo causal violado"
- "replication lag Supabase", "atraso de replicação"
- "broadcast Realtime + SELECT stale"
- "pg_last_wal_replay_lsn", "WAL position detection"

Esta skill aplica **DDIA Ch 5 "Problems With Replication Lag"** ao stack Supabase. Cross-referenciada por `supabase-realtime` (v1.8) ao bundlear broadcast + leitura, e por `multi-tenant-performance-scaling` (v1.21) ao escalar Postgres em Pro+.

Termos canônicos (`read-after-write consistency`, `monotonic reads`, `consistent prefix reads`, `replication lag`, `leader-follower replication`) definidos em [`_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) seções (a) e (b) — esta skill **não duplica**, apenas linka.

## Regras absolutas

**REGRA #1 (read-after-write own data):** Para leituras do **próprio dado do usuário** dentro de janela de **5s após write**, rotear para **porta 5432 (líder)** — não 6543. Sem isso, usuário cria post → GET retorna 404 → percepção de bug. Justify: DDIA p. 156 "always read the user's own profile from the leader".

**REGRA #2 (sticky session monotonic):** Para usuários ativos lendo de réplicas, escolher réplica via `hash(user_id) mod N` — **não round-robin**. Round-robin viola monotonic reads (DDIA p. 158). Mitigação obrigatória: fallback para líder se réplica down.

**REGRA #3 (broadcast trust payload):** Após receber Realtime broadcast com `payload.record`, **NÃO** fazer SELECT subsequente. Confiar no payload — server é a fonte canônica do evento. SELECT pode atingir réplica que ainda não replicou (lag típico 50-500ms).

**REGRA #4 (causal partition):** Writes causalmente relacionados (pergunta + resposta em chat, parent + child em árvore) **DEVEM** ir para a mesma partição lógica. Em Supabase: usar mesmo `org_id` ou `conversation_id` como partition key. DDIA p. 159 "any writes which are causally related to each other are written to the same partition".

**REGRA #5 (LSN wait com timeout):** Quando usar `pg_last_wal_replay_lsn() >= captured_lsn`, **SEMPRE** com timeout (3-5s). Sem timeout, query trava se réplica falhou. Após timeout, fallback para líder.

## Patterns canônicos

### Problema 1: Read-after-write inconsistente (DDIA Ch 5, p. 156)

**Cenário canônico:** usuário cria post via form submit → tela mostra "criado com sucesso" → usuário clica "ver post" → request vai para réplica → réplica ainda não replicou → 404. Da perspectiva do usuário: "perdi meu dado".

```
User 1234 ──INSERT─→ Leader (5432)         ┐
                       │                     │ replication lag (50-500ms)
                       └──WAL──────────────→ Follower (6543, replica)
                                              │
User 1234 ─SELECT────────────────────────────→ ❌ 404
           (vai para replica via Supavisor)
```

**Solução A — leitura no líder após write do mesmo usuário:**

```typescript
// PT-BR: client mantém timestamp do último write em memória
class SupabaseRouter {
  private lastWriteAt: Map<string, number> = new Map() // userId → timestamp ms
  private readonly STICKY_WINDOW_MS = 5000               // 5s leitura no líder

  async write(userId: string, table: string, payload: unknown) {
    const result = await this.leaderClient.from(table).insert(payload)
    this.lastWriteAt.set(userId, Date.now())
    return result
  }

  async read(userId: string, table: string, filter: object) {
    const lastWrite = this.lastWriteAt.get(userId) ?? 0
    const elapsedMs = Date.now() - lastWrite

    // PT-BR: dentro da janela 5s, ler do líder (porta 5432)
    if (elapsedMs < this.STICKY_WINDOW_MS) {
      return this.leaderClient.from(table).select().match(filter)
    }
    // PT-BR: fora da janela, OK ler de replica via pooler 6543
    return this.replicaClient.from(table).select().match(filter)
  }
}
```

**Trade-off:** dentro da janela, perde benefício do read scaling. DDIA recomenda janela curta (1-5s) — cobre 99% dos casos UX sem sobrecarregar líder.

### Problema 2: Leituras não-monotônicas (DDIA Ch 5, p. 158)

**Cenário canônico:** usuário 2345 abre lista de comentários — primeira leitura vai para réplica 1 (lag 100ms) → vê comentário X. Segundo refresh vai para réplica 2 (lag 800ms) → comentário X **desapareceu**. Da perspectiva do usuário: "dado voltou no tempo".

```
User 2345 ─SELECT(1)────→ Replica 1 (lag 100ms) → 1 result   ✅
User 2345 ─SELECT(2)────→ Replica 2 (lag 800ms) → 0 results  ❌ (parecia ter sumido)
```

**Solução B — sticky session por `user_id` em routing:**

```typescript
// PT-BR: hash determinístico do user_id → escolhe replica fixa para esse user
import { createHash } from 'node:crypto'

function pickReplica(userId: string, replicas: ReadonlyArray<SupabaseClient>): SupabaseClient {
  const hash = createHash('sha256').update(userId).digest()
  const idx = hash.readUInt32BE(0) % replicas.length
  return replicas[idx]
}

// PT-BR: usage com fallback para líder se replica falhar
async function readWithStickyReplica(userId: string, query: () => Promise<Result>) {
  const replica = pickReplica(userId, REPLICAS)
  try {
    return await query.call(replica)
  } catch (err) {
    if (isReplicaDownError(err)) {
      // PT-BR: fallback obrigatório — REGRA #2
      return await query.call(LEADER)
    }
    throw err
  }
}
```

**Pitfall:** réplica fica down → todos os usuários alocados a ela ficam sem leitura. Mitigação: detectar via health check + reroute para líder até réplica voltar.

### Problema 3: Prefixo causal violado (DDIA Ch 5, p. 159)

**Cenário canônico chat:** Mr Poons pergunta "How far into the future can you see, Mrs Cake?" → write vai para partição A. Mrs Cake responde "About ten seconds usually, Mr Poons." → write vai para partição B. Observador lê de B (lag baixo) e A (lag alto): **vê resposta antes da pergunta**.

```
Partição A (lag 800ms): "How far into the future..."
Partição B (lag 100ms): "About ten seconds..."

Observer lê B → vê resposta ✅
Observer lê A → vê pergunta ✅
Observer ordem percebida: resposta → pergunta ❌
```

**Solução parcial — particionamento por chave causal:**

```sql
-- PT-BR: ambas msgs (pergunta + resposta) particionadas por conversation_id
-- garante mesma partição lógica = mesma ordem WAL
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
) partition by hash (conversation_id);

-- PT-BR: indexes ajudam ordering
create index messages_conv_created_idx
  on public.messages (conversation_id, created_at);
```

**Limitação:** garante consistent prefix dentro de uma partição. Cross-partition (ex: usuário em duas conversações simultâneas), DDIA p. 159 conclui "in general, ensuring consistent prefix reads requires snapshot isolation". Em Supabase prático: **manter conversação em uma tabela com chave causal explícita**.

### Solução C — Detecção stale via `pg_last_wal_replay_lsn()`

Quando precisa de garantia "este read viu meu write" sem rotear ao líder:

```sql
-- PT-BR: capturar LSN no líder após write (chamada do app via RPC)
create or replace function public.get_current_lsn()
returns text
language sql
security invoker
set search_path = ''
as $$
  -- PT-BR: pg_current_wal_lsn() retorna posição atual do WAL no líder
  select pg_current_wal_lsn()::text;
$$;

-- PT-BR: na replica, esperar até replay alcançar o LSN capturado
create or replace function public.wait_for_lsn(target_lsn text, timeout_ms int default 5000)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  start_at timestamptz := clock_timestamp();
  elapsed_ms int;
begin
  loop
    -- PT-BR: pg_last_wal_replay_lsn() na replica = última posição replayed
    if pg_last_wal_replay_lsn() >= target_lsn::pg_lsn then
      return true;
    end if;

    elapsed_ms := extract(milliseconds from (clock_timestamp() - start_at))::int;
    if elapsed_ms >= timeout_ms then
      return false; -- PT-BR: REGRA #5 — timeout sem bloquear infinito
    end if;

    perform pg_sleep(0.05); -- PT-BR: 50ms entre polls
  end loop;
end;
$$;
```

**Uso típico no client:**

```typescript
// PT-BR: 1) write no líder, captura LSN
const { data: lsn } = await leaderClient.rpc('get_current_lsn')
await leaderClient.from('orders').insert(order)

// PT-BR: 2) read no líder, espera replay
const { data: ready } = await replicaClient.rpc('wait_for_lsn', {
  target_lsn: lsn,
  timeout_ms: 3000,
})

if (ready) {
  // PT-BR: replica caught up, leitura é safe
  return replicaClient.from('orders').select().eq('id', order.id)
}
// PT-BR: timeout — fallback para líder (REGRA #5)
return leaderClient.from('orders').select().eq('id', order.id)
```

### Supavisor read replica routing

| Porta | Modo | Use case | Connection string |
|---|---|---|---|
| **6543** | Transaction (default Pro+) | Apps com pooler já configurado, edge runtimes, serverless | `postgresql://postgres.[ref]:pwd@aws-0-region.pooler.supabase.com:6543/postgres` |
| **5432** | Session (líder) | Reads críticas (read-after-write), writes, prepared statements, advisory locks | `postgresql://postgres.[ref]:pwd@aws-0-region.pooler.supabase.com:5432/postgres` |
| `pooler.read.*` | Réplica routing | Read-heavy workloads em Pro+ com replicas habilitadas | (futuro Supabase feature — placeholder hoje) |

**Decisão por tipo de query:**

```
SELECT do próprio dado dentro 5s do write?  → 5432 (líder, REGRA #1)
SELECT cross-user, sem janela sticky?       → 6543 (replica via Supavisor)
INSERT / UPDATE / DELETE?                    → 5432 (sempre líder)
SELECT FOR UPDATE / advisory lock?           → 5432 (transaction precisa session mode)
```

Cross-ref ATIVO: [`multi-tenant-performance-scaling/SKILL.md`](../multi-tenant-performance-scaling/SKILL.md) (v1.21) cobre Supavisor REGRA #1 sob lente de connection pooling — esta skill cobre a mesma porta sob lente de consistência.

### Realtime broadcast + leitura DB — padrão "ler o próprio broadcast"

**Cenário canônico:** client A faz INSERT em `orders` → server emite Realtime broadcast `new_order` no canal `org:orders:org_42` → client B recebe broadcast → client B faz SELECT para refresh da lista. **Pode receber dado stale** (replica não replicou ainda).

**Sequência do bug:**

```
t=0ms   Client A INSERT → Leader
t=10ms  Server emite broadcast → todos clients no canal recebem
t=15ms  Client B recebe broadcast → triggers re-fetch
t=20ms  Client B SELECT → Replica (lag ainda 80ms)
t=20ms  Replica retorna lista SEM o novo order ❌
t=80ms  Replica finalmente replicou (mas client B já desenhou stale)
```

**Padrão correto — confiar no payload broadcast:**

```typescript
// PT-BR: client confia no payload, NÃO faz SELECT subsequente
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const channel = supabase
  .channel('org:orders:org_42', { config: { private: true } })
  .on('broadcast', { event: 'new_order' }, ({ payload }) => {
    // PT-BR: REGRA #3 — confie no payload, NÃO faça SELECT
    setOrders((prev) => [...prev, payload.record])
  })
  .subscribe()

// PT-BR: cleanup obrigatório — pattern de supabase-realtime v1.8
return () => {
  supabase.removeChannel(channel)
}
```

**Server side — emitir payload completo no broadcast:**

```typescript
// PT-BR: Edge Function que cria order e broadcast com record completo
Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const order = await req.json()

  // PT-BR: 1) INSERT no líder
  const { data: created } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single()

  // PT-BR: 2) broadcast com record completo — clients confiam neste payload
  await supabase
    .channel(`org:orders:${order.org_id}`)
    .send({
      type: 'broadcast',
      event: 'new_order',
      payload: { record: created }, // PT-BR: payload canônico
    })

  return new Response(JSON.stringify(created), { status: 201 })
})
```

**Cross-ref ATIVO:** [`supabase-realtime/SKILL.md`](../supabase-realtime/SKILL.md) (v1.8) define padrão de canal (`scope:entity:id`, `private:true`, `removeChannel` cleanup). Esta skill estende com o padrão `payload.record` específico para evitar replica lag bug.

## Anti-patterns

### Anti-pattern 1: Round-robin entre réplicas para o mesmo usuário

**Errado:**
```typescript
// PT-BR: pegar replica aleatoriamente cada read
const replica = REPLICAS[Math.floor(Math.random() * REPLICAS.length)]
return replica.from('messages').select()
```

**Por quê:** viola monotonic reads (DDIA p. 158). User vê mensagem X em uma leitura, depois X some na próxima (replica 2 ainda não replicou). Leituras "voltam no tempo".

**Certo:** sticky session por `hash(user_id) mod N` (Solução B acima).

### Anti-pattern 2: Re-fetch após broadcast

**Errado:**
```typescript
.on('broadcast', { event: 'new_order' }, async () => {
  // PT-BR: re-fetch que pode atingir replica stale
  const { data } = await supabase.from('orders').select() // ❌
  setOrders(data)
})
```

**Por quê:** broadcast chega em 10-15ms, mas replication lag tipicamente 50-500ms. SELECT no callback **garantido** vai chegar antes da replica replicar. Bug "intermittent missing data".

**Certo:** confiar no `payload.record` enviado pelo server (REGRA #3 + Solução padrão "ler o próprio broadcast").

### Anti-pattern 3: `pg_last_wal_replay_lsn()` sem timeout

**Errado:**
```sql
-- PT-BR: loop infinito se replica falhou
do $$
begin
  loop
    if pg_last_wal_replay_lsn() >= captured_lsn::pg_lsn then exit; end if;
    perform pg_sleep(0.05);
  end loop;
end$$;
```

**Por quê:** se replica desconectou do WAL stream (network partition, disk full), `pg_last_wal_replay_lsn()` nunca alcança o LSN do líder. Query trava indefinidamente, esgota connection pool.

**Certo:** timeout 3-5s + fallback explícito para líder (REGRA #5 + função `wait_for_lsn` acima).

### Anti-pattern 4: Cross-partition para conversação causal

**Errado:**
```sql
-- PT-BR: messages particionadas por created_at (range temporal)
create table public.messages (...) partition by range (created_at);
```

**Por quê:** pergunta e resposta em uma conversação podem cair em partições diferentes (se virada de mês entre as duas). Viola consistent prefix reads — observador vê resposta antes da pergunta.

**Certo:** particionar por `conversation_id` (HASH), garante que toda a conversação fica na mesma partição = mesma ordem WAL = consistent prefix.

### Anti-pattern 5: Porta 6543 para `SELECT FOR UPDATE`

**Errado:**
```typescript
// PT-BR: tentando lock pessimista via Supavisor transaction mode
const { data } = await client6543.rpc('lock_order', { id })
```

**Por quê:** Supavisor 6543 (transaction mode) não preserva sessão entre statements — `SELECT FOR UPDATE` libera o lock na próxima query. Lock vira no-op silencioso.

**Certo:** porta 5432 (session mode) para qualquer operação que precisa estado de sessão (locks, prepared statements, `SET LOCAL`, advisory locks).

## Ver também

- [`_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) — termos canônicos `read-after-write consistency`, `monotonic reads`, `consistent prefix reads`, `replication lag`, `leader-follower replication` (Phase 117)
- [`supabase-realtime/SKILL.md`](../supabase-realtime/SKILL.md) — broadcast com `private:true`, naming `scope:entity:id`, cleanup `removeChannel` (v1.8)
- [`multi-tenant-performance-scaling/SKILL.md`](../multi-tenant-performance-scaling/SKILL.md) — Supavisor connection string canônica, REGRA #1 porta 6543 (v1.21)
- [`supabase-database-functions/SKILL.md`](../supabase-database-functions/SKILL.md) — padrões PG functions (security invoker, search_path) usados em `get_current_lsn` e `wait_for_lsn`
- [Designing Data-Intensive Applications, Martin Kleppmann (O'Reilly 2017)](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/) — Ch 5 "Problems With Replication Lag" (p. 155-160)
- [PostgreSQL Documentation — pg_last_wal_replay_lsn](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-RECOVERY-INFO)
- [Supabase Read Replicas](https://supabase.com/docs/guides/platform/read-replicas)
- [Supabase Supavisor 1M Connections](https://supabase.com/blog/supavisor-1-million)
