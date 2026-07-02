---
name: armadilhas-sistemas-distribuidos
cost_tier: leve
description: Evita 5 armadilhas — clock skew (now() vs clock_timestamp()), fencing tokens, GC pause, falhas parciais e modelos de sistema. Use ao desenhar TTL, lease ou distributed lock em Supabase/Edge
---

# Armadilhas de Sistemas Distribuídos — Clock Skew, Fencing Tokens, GC Pause, Falhas Parciais, Modelos de Sistema

## Quando usar

LLM carrega esta skill ao desenhar ou revisar código que depende de relógio (expiração, TTL, ordenação por timestamp) ou distributed lock em ambiente Supabase / Edge Function. Trigger phrases:

- "TTL expirado", "lease", "deadline", "timeout"
- "clock skew", "wall clock", "now() vs clock_timestamp()", "timestamp errado"
- "ordenação por timestamp", "ordering cross-node"
- "distributed lock", "leader election", "advisory lock", "fencing token"
- "split brain", "GC pause", "process pause", "stop-the-world"
- "nó morto vs lento", "detecção de falha", "phi accrual", "heartbeat"
- "byzantine fault", "crash-recovery model", "crash-stop"
- "Edge Function não responde", "lock que não libera"

Esta skill **estende** [`cascading-failures`](../cascading-failures/SKILL.md) (v1.11) — herda noção de timeout vs falha real e adiciona armadilhas de relógio + fencing tokens + modelos de sistema (cap 8 DDIA).

Termos canônicos preservados em EN porque são padrão internacional do livro DDIA Ch 8 + literatura de sistemas distribuídos. Definições PT-BR ↔ EN no glossário [`_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) seção (e).

## Regras absolutas

**REGRA #1 (NUNCA wall clock para lógica de expiração):** `clock_timestamp()` retorna real-time wall clock que pode pular (forward ou backward) quando NTP corrige drift. NUNCA usar para expirar TTL, lease, invite token, ordenação cross-transaction. Use `now()` ou `transaction_timestamp()` (alias) — monotônico DENTRO da transação. Para timestamp absoluto persistido, escreva `now()` na transação que cria o token.

**REGRA #2 (lock distribuído sem fencing token = split-brain garantido):** Qualquer pattern de "adquire lease 30s + faz trabalho" é vulnerável a GC pause / network partition / VM suspend. Mitigação **obrigatória**: token de fencing monotônico crescente; o storage rejeita writes com `last_token < $token`. Sem fencing, dois processos podem se achar líder simultaneamente e gerar writes conflitantes. Pattern Postgres canônico: `pg_advisory_xact_lock(hashtext('lock_name'))` + `nextval('fencing_tokens_seq')`.

**REGRA #3 (timeout fixo para detectar nó morto = false positives):** Timeout binário (responde em N ms = vivo, não responde = morto) confunde lentidão com morte. Em rede sob carga, RTT pode subir 10× sem o nó estar morto. Mitigação: timeout dinâmico baseado em P99 RTT histórico (`>= 3× P99`) + consenso de N-1 nós antes de declarar morto.

**REGRA #4 (default Supabase = crash-recovery model):** Em Supabase você assume `crash-recovery` — Edge Functions reiniciam, Postgres faz failover preservando WAL, jobs pgmq são re-entregues após crash. NÃO assuma `crash-stop` (nó nunca volta). NÃO assuma `byzantine` (nó mente) — fora do scope, apenas blockchain/safety-critical.

**REGRA #5 (lentidão é a pior falha — pior que down):** Nó completamente down é facilmente detectável (TCP RST imediato, conexão recusada). Nó "limping" (Gigabit interface caiu para 1 kbit/s por driver bug — exemplo DDIA Ch 8 nota [90]) ainda responde mas degrada o sistema inteiro. Mitigação: SLO-based health check (latência P99 > N ms = unhealthy, não apenas "respondeu sim/não").

## Patterns canônicos

### REQ ARMADILHAS-01 — Clock skew: tabela canônica de timestamps Postgres

| Função | Semântica | Quando usar | Quando NÃO |
|---|---|---|---|
| `now()` / `transaction_timestamp()` | **Início da transação** — monotônico DENTRO da transação (todas as chamadas dentro da mesma trx retornam o mesmo valor) | Audit log timestamps, default values em colunas `created_at`/`updated_at`, lógica de expiração persistida ("token expira em `now() + interval '7 days'`") | Profiling de performance dentro da trx (não muda) |
| `statement_timestamp()` | **Início do statement atual** — diferente entre statements da mesma trx | Profiling: `select clock_timestamp() - statement_timestamp() as elapsed` para latência por statement | Lógica de expiração (mesma trx pode ter valores diferentes) |
| `clock_timestamp()` | **Real-time wall clock** — muda a cada chamada; pode pular forward ou backward se NTP corrige drift | Logs de duração interna (mensurar quanto tempo X levou no MEIO de uma trx) | **NUNCA** lógica de expiração; **NUNCA** ordenação cross-transaction; **NUNCA** TTL de lease |
| `current_timestamp` (palavra-chave SQL) | Sinônimo de `transaction_timestamp()` — início da transação | Idem `now()` | Idem `now()` |

#### Exemplo errado vs certo

**Errado:**
```sql
-- Token expira 24h após criação — usando wall clock
insert into public.api_tokens (token, expires_at)
  values ($1, clock_timestamp() + interval '24 hours');
```

Por quê: `clock_timestamp()` é real-time. Se NTP corrige drift backward (raro mas possível), o `expires_at` pode ser MENOR que `now()` da próxima validação — token já nasce expirado.

**Certo:**
```sql
-- Token expira 24h após criação — usando início da transação
insert into public.api_tokens (token, expires_at)
  values ($1, now() + interval '24 hours');

-- Validação na próxima transação
select * from public.api_tokens
  where token = $1
    and expires_at > now();
```

#### Profile latência interna sem violar a regra

```sql
-- Profiling DENTRO de uma trx — clock_timestamp OK aqui (não persistido)
do $$
declare
  t0 timestamptz := clock_timestamp();
begin
  perform expensive_function();
  raise notice 'Levou %', clock_timestamp() - t0;
end $$;
```

---

### REQ ARMADILHAS-02 — Fencing tokens canônicos para distributed locks

#### Pattern Postgres completo

```sql
-- (a) Sequence monotônica para fencing tokens
create sequence if not exists fencing_tokens_seq;

-- (b) Tabela protegida por fencing
create table public.locked_resource (
  id uuid primary key,
  last_token bigint not null default 0,
  value text,
  updated_at timestamptz not null default now()
);

-- (c) Acquire lock + obter token (em uma transação)
begin;

-- pg_advisory_xact_lock: lock por nome lógico, libera no commit/rollback
select pg_advisory_xact_lock(hashtext('resource:42'));

-- nextval é safe sob concorrência — sequences são MVCC-exempt
select nextval('fencing_tokens_seq') as token;
-- (assume retornou: token = 17)

-- Faz o trabalho longo aqui (ex: chamar API externa, computar coisa cara)

-- Storage rejeita writes com token < último visto
update public.locked_resource
   set value = $1,
       last_token = 17,
       updated_at = now()
 where id = $resource_id
   and last_token < 17;
-- if rowcount = 0: outro processo com token MAIOR já escreveu — abort

commit;
```

#### Aplicações canônicas em Supabase

| Use case | Lock name | Fencing rationale |
|---|---|---|
| Super-admin impersonation com TTL 30min | `super_admin:impersonate:<actor_id>` | Edge Function pode sofrer timeout de 60s; sem fencing, segunda invocação assume sessão vencida e duas escritas concorrentes corrompem audit log. Ver [super-admin-platform-pattern](../super-admin-platform-pattern/SKILL.md) |
| Job agendado pgmq que processa fila | `pgmq:worker:<queue_name>:<batch_id>` | Worker pode crashar mid-batch; fencing garante que retry não duplica processamento mesmo se o worker original "voltar" zumbi |
| Eleição de líder simples (substituto leve de ZooKeeper) | `leader:<region>` | Nó "líder" sofre GC pause de 60s; outro nó assume; fencing rejeita writes do nó antigo quando volta. Ver REQ ARMADILHAS-03 abaixo |

---

### REQ ARMADILHAS-03 — GC pause / process pause: cenário split-brain canônico + mitigação

#### Cenário canônico (DDIA Ch 8 p. 287-291)

```
T = 0s    Nó A adquire lease 30s no resource R; recebe token = 17
T = 0s    Nó A começa trabalho lento (ex: write em S3 + DB)

T = 5s    Nó A entra em GC pause (stop-the-world full GC)
          [Nó A está congelado — não envia heartbeat, não responde]

T = 30s   Lease de A expira no broker
T = 31s   Nó B ganha lease no resource R; recebe token = 18
T = 35s   Nó B faz update em R com value="B", token=18, last_token=18

T = 50s   Nó A volta do GC pause
          [Nó A AINDA acha que tem o lease — sua memória local diz que sim]
T = 51s   Nó A faz update em R com value="A", token=17

         Sem fencing: write de A SOBRESCREVE write de B → split brain (corrupção)
         Com fencing: storage rejeita porque last_token=18 > token=17 → consistência preservada
```

#### Implementação Edge Function Deno

```typescript
// Edge Function — write em recurso compartilhado com fencing
import { Pool } from "npm:pg@8";

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL")! });

async function safeWriteWithFencing(
  resourceId: string,
  newValue: string,
): Promise<{ ok: boolean; reason?: string }> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    // Adquire lock por nome lógico (libera no commit/rollback)
    await client.query(
      "select pg_advisory_xact_lock(hashtext($1))",
      [`resource:${resourceId}`],
    );

    // Obtém fencing token monotônico
    const { rows: [{ token }] } = await client.query<{ token: string }>(
      "select nextval('fencing_tokens_seq') as token",
    );

    // CHAMA EXTERNAL API LENTA — pode levar 10-60s
    // (Edge Function pode atingir timeout aqui; ou GC pause, ou suspend de VM)
    await callExternalApiSlowly();

    // Storage rejeita se outro processo já escreveu com token maior
    const { rowCount } = await client.query(
      `update public.locked_resource
          set value = $1, last_token = $2, updated_at = now()
        where id = $3 and last_token < $2`,
      [newValue, token, resourceId],
    );

    await client.query("commit");

    if (rowCount === 0) {
      // Outro processo (com token maior) já escreveu durante nossa pause
      return { ok: false, reason: "fenced_out" };
    }
    return { ok: true };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
```

#### Outros gatilhos de pause além de GC

DDIA Ch 8 enumera (p. 290-291):

- **Stop-the-world garbage collection** — JVM/V8/etc; pode pausar minutos em heaps grandes
- **VM suspend** — hipervisor pode suspender VM por migração live (segundos a minutos sem aviso)
- **Swap pesado para disco** — se host fica sem RAM, processo trava em page faults
- **`SIGSTOP` / Ctrl-Z em terminal** — operador pausa processo investigando bug
- **NTP step adjustment** — relógio pode pular forward/backward por minutos (raro mas existe)

Em Edge Functions Supabase: timeout do runtime Deno (60s default), VM cold start, suspensão durante deploy = todos gatilhos equivalentes.

---

### REQ ARMADILHAS-04 — Falhas parciais: detecção por timeout é falaciosa

#### Por que timeout binário falha

DDIA Ch 8 p. 280-282: "lentidão não é morte". Cenários onde nó está vivo mas parece morto:

- Network congestionado: pacotes filados; RTT 100ms → 5s
- GC pause: nó vivo mas não responde por 30s
- CPU starvation: nó com 100% load mas processando aos poucos
- Driver bug "limping" (REGRA #5): responde, só que LENTO

E vice-versa — nó morto que parece vivo:

- TCP keep-alive ainda válido na conexão até next request
- Heartbeat enviado segundos antes do crash, ainda dentro da janela

#### Phi accrual failure detector (literatura clássica)

Algoritmo probabilístico (Cassandra usa em produção): em vez de "vivo/morto" binário, calcula `φ` = probabilidade do nó estar morto baseado em variance histórica de heartbeats.

```
φ alto (e.g. > 8) → quase certeza de morte (assume morto)
φ médio (3-8)     → suspeito, mas espera mais antes de declarar morto
φ baixo (< 3)     → vivo, confiar na resposta
```

Implementação completa de phi accrual em Postgres está fora de escopo (precisa janela móvel de heartbeats por nó, agregação stream); referência se necessário no link DDIA bibliografia.

#### Pattern prático para Supabase: timeout dinâmico

Substituir timeout fixo "30s = morto" por:

```sql
-- Tabela de heartbeats por instância
create table public.instance_heartbeats (
  instance_id text primary key,
  last_seen timestamptz not null,
  -- janela móvel de RTT últimos 100 heartbeats
  rtt_p99_ms numeric not null default 1000
);

-- Detecção: nó morto se sem heartbeat por >= 3× P99 RTT histórico
create or replace view private.suspected_dead_instances as
select instance_id,
       extract(epoch from (now() - last_seen)) * 1000 as silent_ms,
       rtt_p99_ms,
       case
         when extract(epoch from (now() - last_seen)) * 1000 >= 3 * rtt_p99_ms
           then 'suspected_dead'
         else 'alive'
       end as status
from public.instance_heartbeats;
```

#### Regra de quem assume nó morto

**NÃO** decisão unilateral — regra DDIA p. 296-297: precisa **consenso de N-1 nós** antes de declarar morto e iniciar failover. Em sistema com 3 nós, ≥ 2 precisam concordar. Para apps Supabase com ≤ 3 instâncias, normalmente o broker (pgmq, pg_cron) já faz isso transparentemente — **não tente reimplementar**.

---

### REQ ARMADILHAS-05 — Modelos de sistema: quando cada um aplica em Supabase

| Modelo | Premissa | Realista em Supabase? | Exemplo |
|---|---|---|---|
| **Crash-stop** | Nó crashou, **nunca volta** | NÃO — irreal | Apenas para análise teórica de algoritmos |
| **Crash-recovery** | Nó pode crashar, depois reiniciar com **estado parcial** (estado em memória perdido; estado em disco preservado) | **SIM — modelo Supabase típico** | Edge Function timeout + restart; Postgres failover preservando WAL; pgmq worker crash + retry |
| **Byzantine** | Nó pode mentir, enviar mensagens corrompidas, agir maliciosamente | NÃO — fora do scope | Apenas blockchain (Bitcoin, Ethereum), aviônica, militar |

#### Implicações práticas

**Como Supabase = crash-recovery, você DEVE:**

1. **Persistir estado crítico em disco antes de "ack"** — Edge Function não pode confirmar processamento até `commit` no DB.
2. **Tornar operações idempotentes** — qualquer write deve ser safe se executado N vezes (exemplo canônico: `INSERT ... ON CONFLICT DO NOTHING` para webhook de pagamento).
3. **Usar fencing tokens (REQ ARMADILHAS-02)** quando tem distributed locks — porque "nó voltou achando que ainda é líder" é cenário comum em crash-recovery.
4. **Nunca confiar em estado em memória sobreviver crash** — caches em memória de Edge Function são perdidos em restart; persista no Postgres ou Redis.

**O que NÃO se preocupar (fora do scope):**

- Nó Postgres mentindo (corrupção de dados maliciosa) — não é seu modelo. Se preocupação real, use TLS + checksums (Postgres já tem); se preocupação extrema, blockchain.
- Eleição de líder bizantina (Paxos, Raft com defesa contra mentira) — Supabase usa pg + replicas single-leader, modelo trust-based dentro do tenant.

#### Anti-modelo: tratar Supabase como crash-stop

```typescript
// ERRADO — assume que se Edge Function crashar, simplesmente "desaparece"
async function processPayment(payment: Payment) {
  await chargeStripe(payment);     // sem idempotency key
  await db.insert("payments", payment);  // sem ON CONFLICT
  // Se crashar entre chargeStripe e insert: cobrança feita mas não registrada
  // Retry vai cobrar de novo (Stripe sem idempotency key cobra 2×)
}
```

```typescript
// CERTO — assume crash-recovery; idempotente em todas as etapas
async function processPayment(payment: Payment) {
  // Stripe idempotency key — Stripe rejeita se key já vista
  await chargeStripe(payment, { idempotencyKey: payment.id });

  // INSERT ... ON CONFLICT — DB rejeita duplicata silenciosamente
  await db.query(
    `insert into public.payments (id, amount, status)
       values ($1, $2, 'charged')
       on conflict (id) do nothing`,
    [payment.id, payment.amount],
  );
}
```

---

## Anti-patterns

### Anti-pattern 1: `clock_timestamp()` em lógica de expiração

**Errado:**
```sql
update public.sessions set expires_at = clock_timestamp() + interval '1 hour' where id = $1;
```

**Por quê:** `clock_timestamp()` real-time pode pular para trás se NTP corrige drift. Sessão pode expirar antes do esperado (ou nunca expirar, se relógio voltou). Viola REGRA #1.

**Certo:** `now()` (alias `transaction_timestamp()`) — monotônico dentro da trx:
```sql
update public.sessions set expires_at = now() + interval '1 hour' where id = $1;
```

### Anti-pattern 2: Distributed lock sem fencing token

**Errado:**
```typescript
// "Adquire lock 30s, faz trabalho, libera"
const lockId = await redis.set("resource:42", "locked", { EX: 30, NX: true });
if (lockId) {
  await doExpensiveWork();  // pode levar 60s; ou GC pause de 45s
  await writeToStorage(value);  // sem proteção
  await redis.del("resource:42");
}
```

**Por quê:** se `doExpensiveWork()` excede 30s (lease expirou) ou processo sofre pause, outro nó assume lock e começa a trabalhar. Quando este volta, `writeToStorage` sobrescreve o write do segundo nó. Split brain — viola REGRA #2.

**Certo:** fencing token (REQ ARMADILHAS-02). Cada acquire pega `nextval('fencing_tokens_seq')`; storage compara com `last_token` e rejeita writes antigos.

### Anti-pattern 3: Detectar nó morto com timeout fixo

**Errado:**
```python
# Heartbeat check
if time_since_last_heartbeat > 30_seconds:
    declare_dead(node)
    failover()
```

**Por quê:** sob carga ou GC pause, nó vivo pode silenciar 30s. Failover desnecessário gera split brain (dois nós ativos). Viola REGRA #3.

**Certo:** timeout dinâmico baseado em P99 histórico + consenso (REQ ARMADILHAS-04):
```python
threshold = max(3 * historical_p99_rtt_ms, 30_000)  # piso de 30s
if time_since_last_heartbeat > threshold:
    if quorum_agrees(node):
        declare_dead(node)
```

### Anti-pattern 4: Assumir crash-stop em Edge Function

**Errado:**
```typescript
// Edge Function que envia email e marca como enviado
async function sendWelcomeEmail(userId: string) {
  await emailService.send(userId);
  await db.query("update users set welcome_sent = true where id = $1", [userId]);
}
```

**Por quê:** se Edge Function crashar entre `emailService.send` e o `update`, retry vai mandar 2 emails. Crash-recovery é a realidade — viola REGRA #4.

**Certo:** mover para "outbox pattern" (write na tabela primeiro, send depois — separado por job idempotente):
```typescript
// 1. Idempotent enqueue
await db.query(
  `insert into public.email_outbox (user_id, kind)
     values ($1, 'welcome') on conflict (user_id, kind) do nothing`,
  [userId],
);
// 2. Worker pgmq consome outbox e envia (com idempotency key no provider)
```

### Anti-pattern 5: `clock_timestamp()` para ordenar eventos cross-node

**Errado:**
```sql
-- Tabela de eventos com ordering por clock_timestamp
insert into public.events (kind, payload, occurred_at)
  values ('user_action', $1, clock_timestamp());

-- Query "ordem global"
select * from public.events order by occurred_at desc limit 100;
```

**Por quê:** se `events` é populada por múltiplos nós (Edge Functions diferentes), cada um tem `clock_timestamp()` próprio. Skew de 100ms entre nós distorce ordenação. Eventos podem aparecer "fora de ordem causal" — viola REGRA #1.

**Certo:** ordenação por `id` monotônico (sequence) ou logical timestamp (Lamport, vector clock — fora de scope desta skill, ver futuras skills consenso v1.23).
```sql
-- Sequence monotônica garante ordem global
alter table public.events add column event_seq bigint default nextval('events_seq');
select * from public.events order by event_seq desc limit 100;
```

## Ver também

- [cascading-failures](../cascading-failures/SKILL.md) — timeout vs falha real (esta skill estende para clock skew + fencing)
- [super-admin-platform-pattern](../super-admin-platform-pattern/SKILL.md) — TTL impersonation 30min usa fencing token (REQ ARMADILHAS-02 aplicação canônica)
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — pgmq worker é crash-recovery (REGRA #4); idempotency obrigatória
- [retry-strategies](../retry-strategies/SKILL.md) — retry exige idempotency (cross-ref para Anti-pattern 4)
- [postgres-isolamento-concorrencia](../postgres-isolamento-concorrencia/SKILL.md) — `pg_advisory_xact_lock` definido lá; aqui usamos para fencing
- [_shared-dados-distribuidos/glossary.md](../_shared-dados-distribuidos/glossary.md) seção (e) — definições canônicas PT-BR ↔ EN de partial failure, clock skew, fencing token, GC pause, byzantine fault, phi accrual
- [PostgreSQL Documentation — Date/Time Functions](https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT) — fonte canônica oficial das 4 funções de timestamp
- DDIA Cap 8 (Kleppmann, O'Reilly 2017) — The Trouble with Distributed Systems — clock skew p. 287-294, fencing tokens p. 304-305, summary p. 302-303
