---
name: postgres-isolamento-concorrencia
description: Use ao escrever transação Postgres com risco de race condition — 6 tipos canônicos (dirty read, dirty write, read skew, lost update, write skew, phantom read), árvore de decisão para isolation le…
---

# Isolamento e Concorrência Postgres — 6 Race Conditions, Decision Tree, 3 Padrões para Lost Update

## Quando usar

LLM carrega esta skill ao escrever ou revisar transação Postgres com risco de race condition concorrente. Trigger phrases:

- "transação Postgres concorrente", "race condition", "isolamento", "isolation level"
- "lost update", "write skew", "phantom read", "dirty read", "read skew"
- "SELECT FOR UPDATE", "advisory lock", "compare-and-swap", "version optimistic lock"
- "snapshot isolation", "SERIALIZABLE", "REPEATABLE READ", "READ COMMITTED"
- "MVCC", "SSI", "predicate lock", "exclusion constraint"
- "duplicate insert na concorrência", "contador errado", "saldo negativo"
- "duas transações alterando a mesma row"

Esta skill **estende** [`supabase-database-functions`](../supabase-database-functions/SKILL.md) (v1.8) — herda STABLE/IMMUTABLE/VOLATILE markers e adiciona escolha de isolation level + padrões para lost update/write skew/phantom em transações multi-statement.

Termos canônicos preservados em EN porque são padrão internacional do manual oficial Postgres ([transaction-iso.html](https://www.postgresql.org/docs/current/transaction-iso.html)) e do livro DDIA Ch 7. Definições PT-BR ↔ EN no glossário [`_shared-dados-distribuidos/glossary.md`](../_shared-dados-distribuidos/glossary.md) seção (c).

## Regras absolutas

**REGRA #1 (Postgres NÃO permite dirty read):** Mesmo se a aplicação solicitar `READ UNCOMMITTED`, o Postgres silenciosamente promove para `READ COMMITTED`. Citação: manual oficial — *"In PostgreSQL, you can request any of the four standard transaction isolation levels, but internally only three distinct isolation levels are implemented, namely PostgreSQL's Read Uncommitted mode behaves like Read Committed."*

**REGRA #2 (default = READ COMMITTED é OK para 95% dos casos):** Se a transação faz UPDATE ou INSERT em uma única tabela com `WHERE id = $1`, READ COMMITTED basta — Postgres garante atomicidade no nível da row. Subir para REPEATABLE READ ou SERIALIZABLE custa abort rate (`serialization_failure`) e não traz benefício.

**REGRA #3 (lost update tem 3 padrões — escolher por workload):** Sob READ COMMITTED, dois `UPDATE` concorrentes baseados em valor lido podem perder uma das mudanças (read-modify-write não-atômico). Resolver via uma de 3 técnicas — pessimista (`FOR UPDATE`), otimista (CAS via `WHERE version = $v`) ou semântica (`pg_advisory_xact_lock`). Veja Padrão 3 abaixo para escolher por workload.

**REGRA #4 (write skew exige uma de 3 técnicas — não OR genérico):** Snapshot isolation (REPEATABLE READ Postgres) NÃO previne write skew. Resolver com uma de 3 técnicas — materializar conflito via `FOR UPDATE` em rows lidas, declarar conflito via `EXCLUDE USING gist` constraint, ou subir para `SERIALIZABLE` (Postgres SSI = predicate-aware) como fallback genérico.

**REGRA #5 (REPEATABLE READ NÃO previne phantom em Postgres):** Apenas `SERIALIZABLE` (que usa SSI desde Postgres 9.1) previne phantom porque é predicate-aware. REPEATABLE READ implementa snapshot isolation = imagem consistente do start da trx, mas INSERT cross-trx que cai no predicate ainda altera resultado em re-query no mesmo snapshot.

**REGRA #6 (SERIALIZABLE = aborts esporádicos — app precisa retry):** SSI é otimista — transações executam sem bloquear; ao commit verifica serializabilidade e aborta com `SQLSTATE 40001` se não. App **DEVE** ter retry loop com backoff (recomendado: até 3 tentativas, exponential backoff a partir de 50ms).

## Patterns canônicos

### REQ ISOLAMENTO-01 — Os 6 race conditions com SQL exemplo isolado

#### 1. Dirty read

Definição: T1 lê dados não-commitados de T2; depois T2 rollback.

**Postgres NÃO permite (REGRA #1):**

```sql
-- Sessão A
begin isolation level read uncommitted;  -- silenciosamente vira READ COMMITTED
update public.accounts set balance = balance - 100 where id = 1;
-- (sem commit)

-- Sessão B
begin;
select balance from public.accounts where id = 1;
-- Retorna o saldo ANTES do update da Sessão A — SEM dirty read.
-- Isso é por design Postgres; nenhum nível de isolamento permite ver writes não-commitados.
```

#### 2. Dirty write

Definição: T1 sobrescreve write não-commitado de T2.

**Postgres previne via row-level lock implícito em UPDATE:**

```sql
-- Sessão A
begin;
update public.accounts set balance = 200 where id = 1;  -- adquire ROW EXCLUSIVE lock
-- (sem commit ainda)

-- Sessão B
begin;
update public.accounts set balance = 300 where id = 1;
-- Sessão B BLOQUEIA aqui até A commitar ou rollback.
-- Quando A commita, B procede — sem dirty write.
```

#### 3. Read skew (non-repeatable read)

Definição: T1 lê row → T2 commita update na mesma row → T1 re-lê e vê valor diferente.

**Acontece sob READ COMMITTED; prevenido por REPEATABLE READ (snapshot isolation):**

```sql
-- Sessão A — READ COMMITTED (default)
begin;
select balance from public.accounts where id = 1;  -- 100

-- Sessão B (entre as queries)
begin;
update public.accounts set balance = 500 where id = 1;
commit;

-- Sessão A continua
select balance from public.accounts where id = 1;  -- 500 (DIFERENTE — read skew)
commit;

-- Solução: subir A para REPEATABLE READ
begin isolation level repeatable read;
select balance from public.accounts where id = 1;  -- 100
-- (B faz update e commit no meio)
select balance from public.accounts where id = 1;  -- 100 (mesmo snapshot)
commit;
```

#### 4. Lost update

Definição: T1 e T2 fazem read-modify-write concorrentes; uma sobrescreve a outra sem incorporar mudanças.

**Cenário clássico — contador de vendas:**

```sql
-- Sessão A
begin;
select sales_count from public.products where id = 1;  -- 10
-- App computa: 10 + 1 = 11
update public.products set sales_count = 11 where id = 1;
commit;

-- Sessão B (concorrente)
begin;
select sales_count from public.products where id = 1;  -- 10 (mesmo snapshot)
-- App computa: 10 + 1 = 11
update public.products set sales_count = 11 where id = 1;
commit;

-- Resultado: sales_count = 11 (DEVERIA SER 12 — uma venda perdida)
```

Solução: ver REQ ISOLAMENTO-03 (3 padrões abaixo).

#### 5. Write skew

Definição: T1 e T2 leem o mesmo predicate, decidem com base nele, escrevem coisas diferentes que invalidam o predicate.

**Cenário canônico DDIA — doctor on-call (precisa ≥ 1 doctor on-call):**

```sql
-- Schema
create table public.doctors (
  id bigserial primary key,
  name text not null,
  on_call boolean not null
);
insert into public.doctors (name, on_call) values
  ('Alice', true),
  ('Bob',   true);

-- Sessão A — Alice quer sair de plantão
begin isolation level repeatable read;
-- Alice lê: 2 doctors on-call → invariante "≥ 1" mantido se eu sair → posso sair
select count(*) from public.doctors where on_call = true;  -- 2

-- Sessão B (concorrente) — Bob quer sair de plantão
begin isolation level repeatable read;
-- Bob lê: 2 doctors on-call → invariante "≥ 1" mantido se eu sair → posso sair
select count(*) from public.doctors where on_call = true;  -- 2 (mesmo snapshot)

-- Sessão A
update public.doctors set on_call = false where name = 'Alice';
commit;

-- Sessão B (não vê o write de A — snapshot isolation)
update public.doctors set on_call = false where name = 'Bob';
commit;

-- Resultado: 0 doctors on-call (INVARIANTE QUEBRADA — write skew)
```

Solução: ver REQ ISOLAMENTO-04 (3 caminhos).

#### 6. Phantom read

Definição: T1 query com WHERE → T2 INSERT row matching WHERE → T1 re-query vê novo row.

**Acontece sob READ COMMITTED e até REPEATABLE READ no manual SQL padrão; prevenido por SERIALIZABLE em Postgres:**

```sql
-- Sessão A — booking de sala
begin isolation level repeatable read;
select count(*) from public.bookings
  where room_id = 'sala_a'
    and tstzrange(starts_at, ends_at, '[)') && tstzrange('2026-06-01 09:00', '2026-06-01 10:00', '[)');
-- 0 conflitos → posso reservar

-- Sessão B (concorrente)
begin isolation level repeatable read;
select count(*) from public.bookings
  where room_id = 'sala_a'
    and tstzrange(starts_at, ends_at, '[)') && tstzrange('2026-06-01 09:00', '2026-06-01 10:00', '[)');
-- 0 conflitos → posso reservar (mesmo snapshot)

insert into public.bookings (room_id, starts_at, ends_at) values ('sala_a', '2026-06-01 09:00', '2026-06-01 10:00');
commit;

-- Sessão A
insert into public.bookings (room_id, starts_at, ends_at) values ('sala_a', '2026-06-01 09:00', '2026-06-01 10:00');
commit;

-- Resultado: 2 bookings overlap (PHANTOM — REPEATABLE READ não detecta INSERT cross-trx)
```

Solução: SERIALIZABLE (REGRA #5) ou `EXCLUDE USING gist` constraint (ver REQ ISOLAMENTO-04).

---

### REQ ISOLAMENTO-02 — Árvore de decisão isolation level

```
Qual transação você está escrevendo?

├─ CRUD simples: INSERT / UPDATE / DELETE em UMA tabela com WHERE id = $1
│  └─► READ COMMITTED (default)
│     • Postgres garante atomicidade na row (REGRA #2)
│     • Sem aborts esporádicos
│     • 95% dos casos em Edge Functions Supabase
│
├─ Relatório / query longa em MÚLTIPLAS tabelas, snapshot consistente importa
│  └─► REPEATABLE READ (snapshot isolation via MVCC)
│     • set transaction isolation level repeatable read;
│     • Garante que todas as queries da trx veem a mesma "foto" do DB
│     • Útil para: dashboards, exports CSV, agregações com JOINs
│     • NÃO previne lost update / write skew / phantom
│
└─ Invariante complexa cross-row: doctor on-call, booking sem overlap, saldo ≥ 0
   └─► SERIALIZABLE (Postgres SSI — predicate-aware desde 9.1)
      • set transaction isolation level serializable;
      • Detecta write skew, phantom, lost update genérico
      • Custo: aborts esporádicos com SQLSTATE 40001 — app DEVE ter retry (REGRA #6)
      • Quando outras técnicas (FOR UPDATE / EXCLUDE constraint) não cabem
```

**Setando isolation level — 3 formas:**

```sql
-- (a) Por transação — recomendado (escopo claro)
begin isolation level serializable;
-- ... queries ...
commit;

-- (b) Por sessão (afeta TODAS as transações da sessão até reset)
set session characteristics as transaction isolation level serializable;

-- (c) Por sistema (postgresql.conf — NÃO recomendado)
-- default_transaction_isolation = 'serializable'
```

---

### REQ ISOLAMENTO-03 — 3 padrões para prevenir lost update

| Padrão | Sintaxe | Tradeoff | Quando usar |
|---|---|---|---|
| **(a) Pessimista — `SELECT ... FOR UPDATE`** | `select balance from accounts where id = $1 for update;` | Bloqueia leitores concorrentes; baixo throughput se contention alta | Writes raros + contention baixa (ex: settlement bancário 1×/dia) |
| **(b) Otimista — CAS via `WHERE version`** | `update accounts set balance = $1, version = version + 1 where id = $2 and version = $v;` | Sem bloqueio; precisa retry on miss (return 0 rows) | Writes frequentes + contention baixa-média (ex: contador de likes) |
| **(c) Semântico — `pg_advisory_xact_lock`** | `select pg_advisory_xact_lock(hashtext('lock_name'));` | Lock por nome lógico, não amarra a row; libera no commit/rollback | Lock global / singleton operation (ex: cron job que NÃO deve rodar 2× concorrente) |

#### Padrão (a) — SELECT FOR UPDATE pessimista

```sql
-- Transferência bancária — débito + crédito atômico
begin;
-- Lock em ambas as rows ANTES de ler (ordering por ID previne deadlock)
select balance from public.accounts where id = least($from_id, $to_id) for update;
select balance from public.accounts where id = greatest($from_id, $to_id) for update;

-- Validação no app
-- if balance_from < amount: rollback

update public.accounts set balance = balance - $amount where id = $from_id;
update public.accounts set balance = balance + $amount where id = $to_id;
commit;
```

#### Padrão (b) — CAS otimista com version column

```sql
-- Schema
alter table public.products add column if not exists version bigint not null default 0;

-- App — retry loop
-- 1. Read
select sales_count, version from public.products where id = $1;
-- (assume: sales_count = 10, version = 7)

-- 2. App computa: sales_count + 1 = 11

-- 3. Atomic compare-and-swap
update public.products
   set sales_count = 11,
       version = version + 1
 where id = $1
   and version = 7;
-- if rowcount = 0: outra trx mudou — retry desde o read

-- 4. Commit
commit;
```

#### Padrão (c) — Advisory lock semântico

```sql
-- Cron job que sincroniza dados externos — NÃO pode rodar 2× concorrente
begin;
-- Lock por nome lógico (NÃO amarra row específica)
select pg_advisory_xact_lock(hashtext('sync_external_api'));

-- Se outra instância do cron já tem o lock, esta trx aguarda.
-- Como é xact_lock, libera automaticamente no commit/rollback.

-- ... lógica de sync ...
commit;
```

**Regra de polegar para escolher:**
- Lock global, single-row ou multi-row arbitrário → **(c) advisory_xact_lock**
- Lock em rows específicas conhecidas a priori, contention baixa → **(a) FOR UPDATE**
- Update incremental sem dependência de outras rows, contention média-alta → **(b) CAS otimista**

---

### REQ ISOLAMENTO-04 — Prevenção write skew (3 caminhos)

#### Caminho 1 — Materializar conflito via FOR UPDATE em rows lidas

```sql
-- Sessão A — Alice quer sair de plantão
begin;
-- Lock em TODAS as rows do predicate (materializa o conflito)
select count(*) from public.doctors where on_call = true for update;  -- 2

-- Sessão B aguarda aqui (até A commitar)

update public.doctors set on_call = false where name = 'Alice';
commit;

-- Sessão B desbloqueia agora
select count(*) from public.doctors where on_call = true for update;  -- 1 (não 2!)
-- Lógica do app verifica: count = 1, se eu sair vai para 0 → ABORT
rollback;
```

Limitação: precisa enumerar TODAS as rows do predicate. Se o predicate é grande/aberto (ex: `where price > 100`), `FOR UPDATE` não locka rows futuras — apenas existentes.

#### Caminho 2 — Declarar conflito via EXCLUDE USING gist (ideal para overlap)

```sql
-- Booking de sala SEM overlap (room_id + range temporal)
create extension if not exists btree_gist;

create table public.bookings (
  id bigserial primary key,
  room_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Constraint declarativo: zero overlap por sala
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

-- Sessão A
begin;
insert into public.bookings (room_id, starts_at, ends_at)
  values ('sala_a', '2026-06-01 09:00', '2026-06-01 10:00');
commit;

-- Sessão B (concorrente)
begin;
insert into public.bookings (room_id, starts_at, ends_at)
  values ('sala_a', '2026-06-01 09:00', '2026-06-01 10:00');
-- ERROR: conflicting key value violates exclusion constraint
-- (DB rejeita declarativamente — sem app logic)
```

Aplicação canônica: room booking, schedule slot, version range, IP allocation.

#### Caminho 3 — SERIALIZABLE (Postgres SSI = predicate-aware) como fallback genérico

Quando enumerar rows é caro (predicate aberto) e EXCLUDE constraint não modela o conflito, subir para SERIALIZABLE:

```sql
-- Doctor on-call — solução genérica
begin isolation level serializable;
select count(*) from public.doctors where on_call = true;  -- 2

update public.doctors set on_call = false where name = 'Alice';

commit;
-- Se trx concorrente (Bob) tentou o mesmo: uma das duas aborta com
-- SQLSTATE 40001 (serialization_failure). App precisa retry (REGRA #6).
```

App retry loop canônico:

```typescript
// Edge Function — Deno
import { Pool } from "npm:pg@8";

async function withSerializableRetry<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("begin isolation level serializable");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (err: unknown) {
      await client.query("rollback");
      // SQLSTATE 40001 = serialization_failure (retryable)
      if ((err as { code?: string }).code === "40001" && attempt < maxRetries - 1) {
        // Backoff exponencial: 50ms, 100ms, 200ms
        await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw new Error("Max retries excedido — contention demais ou bug");
}
```

---

### REQ ISOLAMENTO-05 — Prevenção phantom read

**Contraste canônico:**

| Isolation level | Snapshot isolation | Predicate-aware | Previne phantom? |
|---|---|---|---|
| READ COMMITTED | Não (re-read pode ver writes commitados) | Não | NÃO |
| REPEATABLE READ | Sim (snapshot do start da trx) | **Não** (apenas rows do snapshot) | **NÃO** — INSERT cross-trx ainda invalida count |
| SERIALIZABLE (SSI) | Sim | **Sim** (rastreia predicate locks) | **SIM** |

**Por quê REPEATABLE READ NÃO previne phantom:**

REPEATABLE READ via MVCC garante: se T1 leu rows X e Y no momento `t`, re-ler depois mostra os mesmos X e Y. MAS — se T2 commitou um INSERT de Z (que cai no predicate `where price > 100`) entre as duas leituras de T1, o snapshot de T1 ainda não contém Z (porque snapshot é tirado no `begin`). Então `select * from p where price > 100` retorna o mesmo conjunto. Aparentemente OK.

PROBLEMA: se T1 usa o count para tomar decisão (ex: "se não houver booking conflitante, faço meu booking"), o predicate continua válido para T1, mas para T2 que commitou primeiro, o booking de T1 vai conflitar APÓS commit. Esse é o phantom no contexto de write skew — exemplo do booking de sala (caso 6 acima).

**Postgres SSI resolve:**

SSI (Serializable Snapshot Isolation, padrão desde Postgres 9.1) rastreia predicate locks: quando T1 faz `select where price > 100`, SSI registra que T1 "depende" do predicate. Se T2 faz `INSERT (price = 150)` cross-trx, SSI detecta que essa INSERT poderia mudar o resultado da query de T1 — e ao commit de uma das duas, aborta com `SQLSTATE 40001`.

**Custo:** False positives (aborts mesmo quando não havia conflito real). Tradeoff aceito porque SSI é otimista (sem locks pessimistas) — performance superior a 2PL na média.

**Quando NÃO usar SERIALIZABLE:**

- Read-mostly workload com poucos updates → READ COMMITTED basta (Padrão 1 acima)
- Update incremental tipo contador (sem cross-row decision) → CAS otimista com version (Padrão (b) ISOLAMENTO-03)
- Booking declarativo → EXCLUDE constraint (Caminho 2 ISOLAMENTO-04)

---

## Anti-patterns

### Anti-pattern 1: Read-modify-write sob READ COMMITTED sem proteção

**Errado:**
```sql
-- Edge Function que incrementa contador
begin;
select sales_count from public.products where id = 1;  -- 10
-- App: novo = 10 + 1 = 11
update public.products set sales_count = 11 where id = 1;
commit;
```

**Por quê:** Lost update clássico (race condition #4). Sob carga concorrente, vários incrementos perdidos.

**Certo:** uma das 3 técnicas da REGRA #3:
```sql
-- (b) Otimista: increment atomic via expressão SQL (sem read-modify-write app-side)
update public.products set sales_count = sales_count + 1 where id = 1;
```

### Anti-pattern 2: Subir tudo para SERIALIZABLE "para garantir"

**Errado:**
```sql
-- postgresql.conf
default_transaction_isolation = 'serializable'
```

**Por quê:** SERIALIZABLE tem custo — aborts esporádicos (`SQLSTATE 40001`). Se app não tem retry loop universal, queries falham aleatoriamente em produção sob carga. E para 95% dos casos (CRUD single-row), READ COMMITTED basta (REGRA #2).

**Certo:** READ COMMITTED por default; subir explicitamente apenas em transações com invariante cross-row complexa (`begin isolation level serializable;`).

### Anti-pattern 3: SELECT FOR UPDATE sem ORDER BY (deadlock)

**Errado:**
```sql
-- Sessão A
select * from public.accounts where id in ($from_id, $to_id) for update;

-- Sessão B (concorrente, transferência inversa)
select * from public.accounts where id in ($to_id, $from_id) for update;
```

**Por quê:** Postgres pode adquirir locks em ordem diferente em A vs B (depende da ordem física das rows). Resultado: deadlock detectado, uma trx morre com `SQLSTATE 40P01`.

**Certo:** ordenar por chave primária para garantir ordem global de aquisição de lock:
```sql
select * from public.accounts where id = least($from_id, $to_id) for update;
select * from public.accounts where id = greatest($from_id, $to_id) for update;
```

### Anti-pattern 4: Solicitar READ UNCOMMITTED esperando dirty read

**Errado:**
```sql
begin isolation level read uncommitted;
-- "Vou ler mais rápido sem MVCC overhead"
```

**Por quê:** Postgres ignora silenciosamente — promove para READ COMMITTED (REGRA #1). Programador acha que está em modo "rápido" mas comportamento é idêntico a READ COMMITTED. Dead code visível mas inerte.

**Certo:** se o objetivo é performance de leitura, usar `select` em transação separada de leituras escolhidas (sem `begin`/`commit`) — Postgres roda em modo single-statement com mesmo isolation default.

### Anti-pattern 5: Confiar em REPEATABLE READ para prevenir write skew

**Errado:**
```sql
begin isolation level repeatable read;
select count(*) from public.doctors where on_call = true;
-- if count >= 2: update doctors set on_call = false where name = 'Alice';
commit;
```

**Por quê:** REPEATABLE READ implementa snapshot isolation, mas snapshot isolation NÃO previne write skew (REGRA #4 + race condition #5). Doctor on-call cai para 0 sob concorrência.

**Certo:** uma das 3 técnicas de REQ ISOLAMENTO-04 — FOR UPDATE em rows lidas, EXCLUDE constraint, ou SERIALIZABLE com retry.

## Ver também

- [supabase-database-functions](../supabase-database-functions/SKILL.md) — STABLE/IMMUTABLE/VOLATILE markers (esta skill estende para isolation em transações multi-statement)
- [crm-lead-pipeline-patterns](../crm-lead-pipeline-patterns/SKILL.md) — lead deduplication usa `unique(org_id, contact_email)` + `INSERT ... ON CONFLICT` (lost update prevention canônico)
- [member-invite-flow](../member-invite-flow/SKILL.md) — accept invite usa `FOR UPDATE` para idempotência (Padrão (a) REQ ISOLAMENTO-03)
- [supabase-migrations](../supabase-migrations/SKILL.md) — migration que adiciona `version bigint` para CAS otimista (Padrão (b))
- [_shared-dados-distribuidos/glossary.md](../_shared-dados-distribuidos/glossary.md) seção (c) — definições canônicas PT-BR ↔ EN dos 6 race conditions, MVCC, SSI, predicate lock
- [PostgreSQL Documentation — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — fonte canônica oficial
- [PostgreSQL Documentation — Concurrency Control / MVCC](https://www.postgresql.org/docs/current/mvcc.html) — implementação interna
- DDIA Cap 7 (Kleppmann, O'Reilly 2017) — Transactions — race conditions canônicos, summary p. 257-258
