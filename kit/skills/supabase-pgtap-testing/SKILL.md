---
name: supabase-pgtap-testing
description: Use ao escrever testes de database/Edge Function em Supabase — pgTAP extension (TAP…
---

# Supabase — pgTAP & Deno Testing

## Quando usar

Esta skill cobre **testing-shift-left para Supabase** — testar schema, RLS, PG functions e Edge Functions ANTES de deploy via CI. Dois runners canônicos:

1. **pgTAP** (`supabase test db`) — database tests via TAP (Test Anything Protocol) Postgres extension
2. **Deno test** (`deno test --allow-all`) — Edge Functions tests via Deno runtime nativo

Trigger phrases:

- "testes Supabase", "test Supabase", "testing Supabase"
- "pgTAP", "supabase test db", "TAP Postgres extension"
- "plan ok is throws_ok results_eq pgTAP", "has_table has_column col_type_is"
- "Deno test Edge Function", "deno test --allow-all"
- "testar RLS Supabase", "characterization tests PG function"
- "supabase/tests/", "supabase/functions/_tests/"
- "testar trigger Postgres", "testar function Postgres"
- ".env.local Deno tests", "SUPABASE_URL SUPABASE_ANON_KEY tests"
- "characterization PG legado", "refatorar function Postgres com tests"

**Use APENAS para:**

- Validar schema, columns, tipos, FKs via pgTAP (`has_table`, `has_column`, `col_type_is`)
- Validar RLS policies retornando `permission denied` quando esperado (`throws_ok 42501`)
- Validar PG functions retornando outputs esperados (`results_eq`)
- Validar constraints, triggers, defaults (`throws_ok 23502 not_null_violation`, `throws_ok 23505 unique_violation`)
- Testar Edge Functions HTTP handlers (status, response body, side effects)
- Capturar comportamento atual de PG function legada como **characterization oracle** (Feathers cap 13)
- Integrar com workflow CI `database-tests.yml` (Phase 151 CI-05) e `functions-tests.yml` (CI-06)

**NÃO use para:**

- Substituir integration tests no app layer (frontend ↔ Supabase via client SDK) — pgTAP cobre só DB; Deno tests cobrem só Edge Function isolado
- Performance tests (latência, throughput) — pgTAP é assertion-based, não benchmark; use `pgbench` ou Vegeta para load testing
- Tests em produção sem `rollback` — sempre `begin; ... rollback;` (cross-ref Anti-pattern 1)
- Substituir auditoria via `auditor-consistencia-isolamento` (v1.22) — tests validam comportamento esperado; auditor detecta anti-patterns estáticos no SQL
- Substituir mutation testing (`ai-mutation-tester`) — pgTAP é characterization; mutation testing valida que tests realmente detectam regressão

## Princípio canônico

Três princípios canônicos:

1. **Testing shift-left.** Cada PR valida schema + RLS + PG functions + Edge Functions ANTES do merge. Gate canônico = required status check `database-tests / build` e `functions-tests / build` enforced via branch protection (cross-ref skill `supabase-ci-cd-github-actions` Phase 151 patterns 5 e 6).

2. **Tests são schema mutations transacionais.** Todo teste pgTAP roda dentro de `begin; ... rollback;` — assertions executam, fixtures são inseridas, RLS é exercitada, mas DB volta ao estado original. Nunca polui DB compartilhado; tests podem rodar em paralelo sem race.

3. **pgTAP é o oracle imutável para refactor de PG legado.** Quando PG function complexa (> 100 linhas, sem tests) precisa ser refatorada, pgTAP captura comportamento atual como characterization (Feathers cap 13). Tests viram oracle congelado — qualquer mudança que altere comportamento previamente capturado falha o build. Sem characterization, refactor de PG é "edit and pray" (cross-ref skill `legacy-characterization-tests` v1.16).

### Distinção canônica vs outros runners

| | pgTAP (`supabase test db`) | Deno test (`deno test`) | Vitest/Jest (app layer) |
|---|---|---|---|
| Escopo | Schema, RLS, PG functions, triggers | Edge Functions HTTP handlers | Frontend + cliente Supabase |
| Linguagem | SQL (TAP syntax) | TypeScript (Deno runtime) | TypeScript (Node runtime) |
| Isolamento | `begin; ... rollback;` (atomic) | Function call por test | Mocked client OR real (E2E) |
| Onde roda | Postgres local (via `supabase start`) | Deno runtime + Postgres local | Node + browser environment |
| CI workflow | `database-tests.yml` (Phase 151 CI-05) | `functions-tests.yml` (CI-06) | Custom `vitest.yml` ou `jest.yml` |
| Trigger canônico | PR (gate) | PR (gate) | PR + post-merge (canary) |

Os três runners são **complementares** — pgTAP valida DB, Deno valida Edge Function HTTP layer, Vitest/Jest valida cliente. Nenhum substitui os outros.

## Pattern 1: pgTAP extension setup + sintaxe canônica (TEST-01)

### Habilitar pgTAP

Em migration dedicada (uma única vez por projeto):

```sql
-- supabase/migrations/YYYYMMDDHHmmss_enable_pgtap.sql
create extension if not exists pgtap with schema extensions;
```

**Por que `with schema extensions`:** convenção Supabase canônica — todas extensions ficam em schema dedicado (`extensions`), separadas de `public`. Permite namespace isolation + GRANT EXECUTE granular.

### Diretório canônico `supabase/tests/`

Supabase CLI busca automaticamente arquivos `*.sql` em `supabase/tests/` quando executa `supabase test db`:

```text
supabase/
├── migrations/
│   ├── 20260101000000_initial_schema.sql
│   └── 20260102000000_enable_pgtap.sql
├── tests/
│   ├── employees_test.sql          # ← descoberto automaticamente
│   ├── rls_organizations_test.sql  # ← descoberto automaticamente
│   └── triggers_audit_test.sql     # ← descoberto automaticamente
└── functions/
```

Naming convention: `<entity>_test.sql` ou `<concern>_test.sql` — nome descritivo + sufixo `_test.sql`. CLI roda em ordem alfabética.

### Estrutura canônica de um teste pgTAP

```sql
-- supabase/tests/employees_test.sql
begin;                              -- inicia transação
select plan(4);                     -- declara 4 testes (CRÍTICO — sem plan, falha silencioso)

-- Test 1: tabela existe
select has_table('public', 'employees', 'employees table should exist');

-- Test 2: coluna existe com tipo correto
select has_column('public', 'employees', 'name', 'name column should exist');
select col_type_is('public', 'employees', 'name', 'text', 'name should be text');

-- Test 3: comportamento de seed
select results_eq(
  'select count(*) from public.employees',
  'values (3::bigint)',
  'employees count should be 3 after seed'
);

-- Test 4: constraint NOT NULL
select throws_ok(
  'insert into public.employees (name) values (null)',
  '23502',  -- SQLSTATE not_null_violation
  'null in name should violate not-null constraint'
);

select * from finish();             -- finaliza plano (gera summary TAP)
rollback;                           -- desfaz qualquer side effect
```

**Crítico:** `plan(N)` declara o número exato de assertions executadas. Se você roda 5 mas declarou 4, pgTAP reporta `# Looks like you planned 4 tests but ran 5.` — teste falha. Se rodar menos do que planejou, idem.

### Funções pgTAP canônicas

#### Schema/structure assertions

```sql
-- tabela existe
select has_table('public', 'orders', 'orders table exists');

-- tabela NÃO existe
select hasnt_table('public', 'old_table', 'old_table was dropped');

-- coluna existe
select has_column('public', 'orders', 'total', 'total column exists');

-- tipo da coluna
select col_type_is('public', 'orders', 'total', 'numeric(10,2)', 'total is numeric(10,2)');

-- NOT NULL
select col_not_null('public', 'orders', 'customer_id', 'customer_id is NOT NULL');

-- DEFAULT
select col_has_default('public', 'orders', 'created_at', 'created_at has default');

-- PRIMARY KEY
select has_pk('public', 'orders', 'orders has primary key');

-- FOREIGN KEY
select has_fk('public', 'orders', 'orders.customer_id references customers');

-- INDEX
select has_index('public', 'orders', 'orders_customer_id_idx', 'index exists');
```

#### Function/trigger assertions

```sql
-- function existe
select has_function('public', 'calculate_total', array['uuid'], 'function exists');

-- return type
select function_returns('public', 'calculate_total', 'numeric', 'returns numeric');

-- trigger existe
select has_trigger('public', 'orders', 'set_updated_at', 'trigger exists');

-- enum value
select has_enum('public', 'order_status', array['pending', 'paid', 'shipped'], 'enum values');
```

#### Behavioral assertions

```sql
-- equality (simple)
select is(1 + 1, 2, '1+1 equals 2');

-- inequality
select isnt(now(), '2020-01-01'::timestamp, 'now is not 2020');

-- boolean check
select ok(exists(select 1 from public.users where id = '...'), 'user exists');

-- equality (query result)
select results_eq(
  'select id, name from public.users where active = true order by id limit 2',
  $$values ('uuid-1'::uuid, 'Alice'), ('uuid-2'::uuid, 'Bob')$$,
  'active users are Alice and Bob'
);

-- inequality (query result)
select results_ne(
  'select count(*) from public.deleted_users',
  'values (0::bigint)',
  'deleted_users is not empty'
);

-- subset (query result is subset)
select set_eq(
  'select email from public.users',
  $$values ('a@x.com'), ('b@x.com'), ('c@x.com')$$,
  'all users have correct emails'
);
```

#### Error/exception assertions

```sql
-- erro específico
select throws_ok(
  'insert into public.employees (name) values (null)',
  '23502',                                    -- SQLSTATE not_null_violation
  'null name should fail not-null constraint'
);

-- error matching pattern
select throws_like(
  'select * from public.private_table',
  '%permission denied%',
  'cross-org SELECT raises permission denied'
);

-- NÃO lança erro
select lives_ok(
  $$insert into public.employees (name, email) values ('Alice', 'alice@x.com')$$,
  'valid insert should succeed'
);
```

#### Custom test helpers — fixtures

```sql
-- helper para criar user JWT context
create or replace function tests.set_jwt_claim(claim_name text, claim_value text)
returns void
language sql
as $$
  select set_config('request.jwt.claim.' || claim_name, claim_value, true);
$$;

-- uso em teste
select tests.set_jwt_claim('sub', 'uuid-of-user-1');
select tests.set_jwt_claim('user_role', 'admin');

-- agora policies que consultam auth.uid() retornam 'uuid-of-user-1'
select results_eq(
  'select count(*) from public.posts',
  'values (10::bigint)',  -- esperando 10 posts visíveis para este user
  'user-1 admin sees all posts'
);
```

### SQLSTATE codes canônicos para `throws_ok`

| Code | Nome | Caso |
|------|------|------|
| `23502` | `not_null_violation` | INSERT/UPDATE com null em column NOT NULL |
| `23503` | `foreign_key_violation` | Referência inexistente em FK |
| `23505` | `unique_violation` | Duplicate em UNIQUE/PK |
| `23514` | `check_violation` | Falha em CHECK constraint |
| `42501` | `insufficient_privilege` | RLS bloqueando OR GRANT ausente |
| `22001` | `string_data_right_truncation` | String muito longa para column |
| `22008` | `datetime_field_overflow` | Date inválida |
| `P0001` | `raise_exception` | RAISE EXCEPTION explícito em PG function |

## Pattern 2: `supabase test db` runner + integração CI (TEST-02)

### Execução local

```bash
# Garantir Postgres local rodando (sobe via Docker)
supabase start

# Rodar todos os tests em supabase/tests/
supabase test db

# Output (TAP format):
# 1..4
# ok 1 - employees table should exist
# ok 2 - name column should exist
# ok 3 - name should be text
# ok 4 - employees count should be 3 after seed
# # Pass: 4
# # Fail: 0
```

### Output TAP — anatomia

```text
1..4                                  ← plan (4 tests esperados)
ok 1 - test description               ← test passou
not ok 2 - test description           ← test falhou
# Failed test 2: 'test description'   ← detalhe da falha
#     got: 'actual_value'
#     expected: 'expected_value'
ok 3 - test description
ok 4 - test description
# Looks like you failed 1 test of 4.  ← summary
```

Exit code:
- **0** — todos tests passaram
- **1** — algum teste falhou (CI fails → required check fails → merge bloqueado)
- **3** — erro fatal (DB não disponível, syntax error em arquivo de test)

### Rodar test específico

```bash
# Apenas um arquivo
supabase test db supabase/tests/employees_test.sql

# Útil para debug rápido durante TDD
```

### Integração CI (cross-ref Phase 151 CI-05 `database-tests.yml`)

Workflow canônico em `.github/workflows/database-tests.yml`:

```yaml
name: database-tests
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db start
      - run: supabase test db
```

**Crítico:**
- `supabase db start` (não `supabase start`) — sobe apenas Postgres, mais rápido que stack completa
- `supabase test db` consome `supabase/tests/*.sql` em ordem alfabética
- Falha em qualquer teste = exit code 1 = workflow falha = required check falha = merge bloqueado

Required check `database-tests / build` deve ser obrigatório em branch protection rule para `main` (cross-ref Phase 151 lista de required checks).

### Caveat — fixtures via `supabase/seed.sql`

`supabase db start` aplica todas migrations + executa `supabase/seed.sql` (se existir). Use seed para popular dados de fixture compartilhados:

```sql
-- supabase/seed.sql (rodado uma vez em db start)
insert into public.employees (id, name, email) values
  ('00000000-0000-0000-0000-000000000001', 'Alice', 'alice@x.com'),
  ('00000000-0000-0000-0000-000000000002', 'Bob', 'bob@x.com'),
  ('00000000-0000-0000-0000-000000000003', 'Carol', 'carol@x.com');
```

Testes referenciam UUIDs determinísticos:

```sql
select results_eq(
  'select name from public.employees where id = ''00000000-0000-0000-0000-000000000001'' ',
  $$values ('Alice')$$,
  'Alice exists'
);
```

**Caveat:** seed roda APENAS em `db start` (não a cada test). Tests que precisam de fixture específica devem inserir dentro do `begin; ... rollback;` para isolar.

### Caveat — paralelismo

`supabase test db` roda arquivos **sequencialmente** (não em paralelo). Cada arquivo tem `begin; ... rollback;` próprio — isolamento OK. Mas tempo total cresce linearmente com N arquivos.

Mitigação para suítes grandes (> 50 arquivos):
- Particionar em jobs paralelos no GitHub Actions (matrix strategy)
- Cada job roda subset de `supabase/tests/<group>/`

## Pattern 3: Deno Edge Function tests (TEST-03)

### Estrutura canônica

```text
supabase/
└── functions/
    ├── hello/
    │   └── index.ts                    # Edge Function code
    ├── create-invite/
    │   └── index.ts
    └── _tests/                          # ← convenção (_ prefix evita conflito com fn name)
        ├── hello_test.ts
        └── create-invite_test.ts
```

Naming convention: `<fn-name>_test.ts` em `supabase/functions/_tests/`.

### Anatomy de um teste Deno

```typescript
// supabase/functions/_tests/hello_test.ts
import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";

Deno.test("hello function returns 200", async () => {
  const response = await fetch("http://127.0.0.1:54321/functions/v1/hello", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "World" }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.message, "Hello World!");
});

Deno.test("hello function rejects empty body", async () => {
  const response = await fetch("http://127.0.0.1:54321/functions/v1/hello", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, 400);
});
```

### Execução local

```bash
# Sobe stack completa (Postgres + Auth + Edge Functions runtime + Storage)
supabase start

# Rodar tests
deno test --allow-all supabase/functions/_tests/ --env-file .env.local
```

`--allow-all` permite acesso file system + network + env vars (Deno é sandboxed por default).

`--env-file .env.local` carrega env vars de arquivo local. Sem essa flag, `Deno.env.get(...)` retorna `undefined`.

### Estrutura `.env.local` (gitignored)

```bash
# supabase/functions/.env.local (gitignored — gerado dinamicamente)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJ...local-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...local-service-role-key...
```

**Caveat:** `supabase start` imprime essas keys no output. Capture-as automaticamente:

```bash
# Linux/macOS
supabase status -o env > supabase/functions/.env.local

# Windows PowerShell
supabase status -o env | Out-File -Encoding utf8 supabase/functions/.env.local
```

Atualizar `.env.local` a cada `supabase start` — keys mudam se containers forem recriados.

### Importar handler diretamente (test unitário)

Alternativa ao test via HTTP — importar handler direto:

```typescript
// supabase/functions/_tests/hello_unit_test.ts
import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";

// Assumindo hello/index.ts exporta handler
import { handler } from "../hello/index.ts";

Deno.test("handler returns 200 for valid input", async () => {
  const req = new Request("http://localhost/hello", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "World" }),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);

  const data = await res.json();
  assertEquals(data.message, "Hello World!");
});

Deno.test("handler returns 400 for invalid input", async () => {
  const req = new Request("http://localhost/hello", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const res = await handler(req);
  assertEquals(res.status, 400);
});
```

**Vantagens vs HTTP test:**
- Mais rápido (sem network roundtrip)
- Testa lógica isolada do handler
- Não requer `supabase start` (apenas Deno runtime)

**Desvantagens:**
- Não exercita auth middleware (JWT verification)
- Não exercita rate limiting / CORS / Deno.serve setup
- Mais frágil a mudanças no boilerplate da Edge Function

**Canônico:** combinar AMBOS — unit tests do handler (rápidos) + smoke test via HTTP (validação E2E mínima).

### Integração CI (cross-ref Phase 151 CI-06 `functions-tests.yml`)

Workflow canônico em `.github/workflows/functions-tests.yml`:

```yaml
name: functions-tests
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - uses: denoland/setup-deno@v2
        with:
          deno-version: latest
      - run: supabase start
      - name: Generate .env.local
        run: supabase status -o env > supabase/functions/.env.local
      - run: deno test --allow-all supabase/functions/_tests/ --env-file supabase/functions/.env.local
```

Required check `functions-tests / build` deve ser obrigatório em branch protection rule para `main`.

### Caveat — fixtures DB para Edge Function tests

Edge Function pode escrever em DB. Tests precisam:

1. Inserir fixtures via SQL antes do test
2. Limpar após o test (ou cada test recria estado)

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,  // bypass RLS para setup
);

Deno.test("create-invite writes to org_invites table", async () => {
  // Setup
  await supabase.from("organizations").insert({ id: "org-1", name: "Test" });

  // Act
  const { data } = await supabase.functions.invoke("create-invite", {
    body: { org_id: "org-1", email: "new@x.com", role: "member" },
  });

  // Assert
  assertEquals(data.success, true);

  const { data: invites } = await supabase
    .from("org_invites")
    .select("*")
    .eq("org_id", "org-1");
  assertEquals(invites?.length, 1);

  // Teardown
  await supabase.from("org_invites").delete().eq("org_id", "org-1");
  await supabase.from("organizations").delete().eq("id", "org-1");
});
```

**Caveat:** ao contrário de pgTAP (transactional rollback automático), Deno tests precisam de cleanup MANUAL. Considere padrão `beforeEach/afterEach`:

```typescript
async function cleanup() {
  await supabase.from("org_invites").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("organizations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

Deno.test({
  name: "create-invite test",
  async fn() {
    await cleanup();  // estado limpo antes
    // ... test body ...
    await cleanup();  // teardown
  },
});
```

Ou usar `Deno.test.beforeEach` (Deno 1.40+):

```typescript
Deno.test.beforeEach(cleanup);
Deno.test.afterEach(cleanup);

Deno.test("create-invite writes to org_invites", async () => {
  // ...
});
```

## Pattern 4: Cross-ref legacy-characterizer — pgTAP como mecanismo de characterization (TEST-04)

### Princípio canônico (Feathers cap 13)

**Legacy code = código sem testes** (definição Feathers, não estética). PG function/trigger/policy com > 100 linhas e sem tests = legacy, mesmo se escrita ontem.

Antes de refatorar PG function legada, **characterize first** — capture comportamento atual como pgTAP tests. Tests viram oracle imutável. Refactor preserva oracle. Bug fix vem em PR separado depois.

### Workflow canônico de characterization de PG function

```text
1. Identificar PG function alvo do refactor
   Exemplo: public.calculate_invoice_total(uuid) — 200 linhas, sem tests

2. Inventariar inputs/outputs
   Inputs:
     - parâmetro: invoice_id uuid
     - reads: invoices, line_items, discounts, taxes (4 tabelas)
     - reads globais: current_setting('app.tax_rate')
   Outputs:
     - return: numeric(10,2)
     - side effects: insert em audit_log + update em invoices.calculated_at

3. Para cada grupo de equivalência (5+ inputs):
   a. Construir input (fixture)
   b. Executar function REAL — sem mocks ainda
   c. Capturar output completo + side effects
   d. REVISAR linha por linha — marcar bugs conhecidos como comments
   e. Salvar como pgTAP assertion

4. Escrever pgTAP test file
   - plan(N) declara N grupos × M assertions cada
   - results_eq para return value
   - results_eq para side effects (linhas em audit_log)
   - throws_ok para edge cases que esperam erro

5. supabase test db — TODOS verdes = baseline estabelecido

6. Refactor pode começar
```

### Exemplo canônico

```sql
-- supabase/tests/calculate_invoice_total_characterization_test.sql
begin;
select plan(10);

-- ===== GRUPO 1: invoice típica com 1 line item =====
-- Setup
insert into public.invoices (id, customer_id, status) values
  ('inv-001', 'cust-001', 'pending');
insert into public.line_items (invoice_id, sku, qty, unit_price) values
  ('inv-001', 'SKU-1', 2, 50.00);

-- Test 1: return value
select results_eq(
  $$select public.calculate_invoice_total('inv-001'::uuid)$$,
  $$values (100.00::numeric)$$,
  'GROUP 1: typical invoice 1 line item — total 100.00'
);

-- Test 2: side effect — audit_log row created
select results_eq(
  $$select event_type, target_id from public.audit_log where target_id = 'inv-001'::uuid$$,
  $$values ('invoice_total_calculated'::text, 'inv-001'::uuid)$$,
  'GROUP 1: audit_log row created'
);

-- ===== GRUPO 2: invoice com discount =====
insert into public.invoices (id, customer_id, status) values
  ('inv-002', 'cust-001', 'pending');
insert into public.line_items (invoice_id, sku, qty, unit_price) values
  ('inv-002', 'SKU-2', 1, 200.00);
insert into public.discounts (invoice_id, percentage) values
  ('inv-002', 10.0);  -- 10% discount

select results_eq(
  $$select public.calculate_invoice_total('inv-002'::uuid)$$,
  $$values (180.00::numeric)$$,
  'GROUP 2: invoice with 10% discount — total 180.00'
);

-- ===== GRUPO 3: invoice vazia (BUG #1 conhecido — retorna 0, deveria raise) =====
insert into public.invoices (id, customer_id, status) values
  ('inv-003', 'cust-001', 'pending');
-- NO line_items inseridos

-- BUG #1: function retorna 0 para invoice vazia, deveria raise 'invalid_invoice'
-- Preservar comportamento bugado durante refactor; fix em PR separado.
select results_eq(
  $$select public.calculate_invoice_total('inv-003'::uuid)$$,
  $$values (0.00::numeric)$$,
  'GROUP 3 [BUG #1]: empty invoice returns 0 (should raise — preserved as oracle)'
);

-- ===== GRUPO 4: invoice inexistente — espera erro =====
select throws_ok(
  $$select public.calculate_invoice_total('00000000-0000-0000-0000-000000000000'::uuid)$$,
  'P0001',
  'GROUP 4: non-existent invoice raises P0001'
);

-- ===== GRUPO 5: invoice com NEG line items (edge case histórico) =====
insert into public.invoices (id, customer_id, status) values
  ('inv-005', 'cust-001', 'pending');
insert into public.line_items (invoice_id, sku, qty, unit_price) values
  ('inv-005', 'SKU-3', -1, 100.00);  -- qty NEGATIVO (devolução)

select results_eq(
  $$select public.calculate_invoice_total('inv-005'::uuid)$$,
  $$values (-100.00::numeric)$$,
  'GROUP 5: negative qty produces negative total (refund flow)'
);

-- ... outros grupos (boundary valid, side-effect heavy, etc.) ...

select * from finish();
rollback;
```

### Bugs preservados como comments

**Crítico:** characterization captura o que código FAZ, não o que DEVERIA fazer. Bugs conhecidos viram comments inline (`-- BUG #X: deveria Y, é Z`). Refactor preserva o oracle (incluindo bugs). Bug fix vem em PR separado **depois** do refactor, com seu próprio teste.

Exemplo do test acima: GROUP 3 marca `BUG #1` — função retorna 0 para invoice vazia em vez de raise exception. Refactor manterá esse comportamento. PR de bug fix subsequente alterará a assertion para `throws_ok` e fixará a função.

### Behavioral coverage check (mutation testing — recomendado)

pgTAP cobre o **que** o código faz; mutation testing valida que tests **detectam regressão**. Para PG functions críticas:

1. Rodar `supabase test db` — baseline verde
2. Aplicar mutation (manualmente — não há tool padrão para PG mutation; use search-replace deliberado):
   - Trocar `+` por `-` na cálculo
   - Trocar `>` por `>=` em CHECK
   - Comentar `RAISE EXCEPTION` em edge case
3. Rodar `supabase test db` — esperado vermelho. Se ficar verde, characterization tem ponto cego.
4. Adicionar test que cobre o ponto cego
5. Reverter mutation; suite volta a verde

Cross-ref skill `ai-mutation-tester` (v1.20) — pattern análogo para JavaScript/TypeScript.

### Quando pgTAP characterization é mandatório

Aplicar pgTAP characterization (cross-ref skill `pre-refactor-characterization` v1.18) ANTES de refactor de:

- PG function > 100 linhas sem tests existentes
- PG function consumida por > 3 callers (alto blast radius se regredir)
- RLS policy complexa (> 5 OR conditions, ou referencia auth.uid() + claim + subquery)
- Trigger BEFORE/AFTER que muta dados em outras tabelas
- Function exposta via Edge Function ou PostgREST RPC (contrato externo)

## Anti-patterns

### Anti-pattern 1: Tests sem `rollback`

**Errado:**

```sql
-- supabase/tests/employees_test.sql
select plan(2);

select has_table('public', 'employees', 'employees exists');

insert into public.employees (name) values ('Test User');  -- SEM begin/rollback!

select results_eq(
  'select count(*) from public.employees where name = ''Test User''',
  'values (1::bigint)',
  'inserted user found'
);

select * from finish();
```

**Por quê:** `INSERT` sem `begin; ... rollback;` é **persistido** no DB local. Após rodar `supabase test db`:

- Teste pode "passar" na primeira run mas falhar na segunda (`count` já não é 1, é 2)
- DB local poluído com dados sintéticos — afeta outros tests
- Se rodar em CI, novo container DB cada run = OK; mas localmente é problema

**Certo:**

```sql
-- supabase/tests/employees_test.sql
begin;                                    -- inicia transação
select plan(2);

select has_table('public', 'employees', 'employees exists');

insert into public.employees (name) values ('Test User');

select results_eq(
  'select count(*) from public.employees where name = ''Test User''',
  'values (1::bigint)',
  'inserted user found'
);

select * from finish();
rollback;                                 -- desfaz INSERT
```

`rollback` é **incondicional** — mesmo se `finish()` falhar, transação aborta no rollback. Estado DB inalterado.

### Anti-pattern 2: Esquecer `plan(N)` — testes silenciosos

**Errado:**

```sql
begin;
-- SEM plan() declarado

select has_table('public', 'employees', 'test 1');
select has_column('public', 'employees', 'name', 'test 2');
select col_type_is('public', 'employees', 'name', 'text', 'test 3');

select * from finish();
rollback;
```

**Por quê:** sem `plan(N)`, pgTAP **não sabe** quantos tests esperar. Output ainda mostra `ok 1`, `ok 2`, `ok 3` mas:

- TAP harness pode interpretar como "0 tests planned, 3 executed" → falha silenciosa em CI
- `finish()` reporta `1..0` (planejados zero) — exit code pode ser 0 (sucesso) mesmo se tests **falharem** silenciosamente
- Adicionar test novo não é notado (deveria mudar `plan(N)` para `plan(N+1)`, mas como não tem plan, esquecer é invisível)

**Certo:**

```sql
begin;
select plan(3);                           -- DECLARA EXPLICITAMENTE 3 tests

select has_table('public', 'employees', 'test 1');
select has_column('public', 'employees', 'name', 'test 2');
select col_type_is('public', 'employees', 'name', 'text', 'test 3');

select * from finish();
rollback;
```

`plan(N)` é **obrigatório**. Se rodar 4 mas declarou 3, pgTAP reporta `# Looks like you planned 3 tests but ran 4.` — falha.

Manter `plan(N)` atualizado é parte do contrato — se adiciona test, atualiza plan.

### Anti-pattern 3: Tests Deno sem `.env.local`

**Errado:**

```bash
# rodar tests sem env file
deno test --allow-all supabase/functions/_tests/
```

```typescript
// dentro do test
const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/hello`);
// Deno.env.get("SUPABASE_URL") retorna undefined
// fetch("undefined/functions/v1/hello") = URL inválida
// Error: Invalid URL: 'undefined/functions/v1/hello'
```

**Por quê:** sem `--env-file`, `Deno.env.get(...)` retorna `undefined`. `fetch` com URL inválida lança erro genérico. Mensagem confusa — dev pensa que tem bug no handler, na verdade é env config.

**Certo:**

```bash
# Gerar .env.local
supabase status -o env > supabase/functions/.env.local

# Rodar com env file
deno test --allow-all supabase/functions/_tests/ --env-file supabase/functions/.env.local
```

```typescript
// Defensive: assert env vars existem (fail-fast com mensagem clara)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY. " +
    "Run: supabase status -o env > supabase/functions/.env.local"
  );
}
```

Em CI, geração de `.env.local` deve ser **step explícito** do workflow (cross-ref Phase 151 CI-06):

```yaml
- name: Generate .env.local
  run: supabase status -o env > supabase/functions/.env.local
- run: deno test --allow-all supabase/functions/_tests/ --env-file supabase/functions/.env.local
```

### Anti-pattern 4: Tratar pgTAP como "testes completos"

**Errado:** time considera que pgTAP + Deno tests cobrem TODO o sistema → para CI: "se database-tests e functions-tests passam, deploy é seguro".

**Por quê:** pgTAP cobre **schema e PG logic**; Deno tests cobrem **Edge Function HTTP handlers**. NENHUM dos dois cobre:

- Cliente frontend interagindo com Supabase via `@supabase/supabase-js` (race conditions, retry, optimistic UI)
- Comportamento Realtime (subscriptions, broadcast, presence)
- Auth flows end-to-end (signup → email confirm → first login → setup wizard)
- RLS visto do ponto de vista do cliente autenticado (JWT real, não simulado via `set_config`)
- Performance / latência sob carga
- Edge cases de browser (CORS, cookies, localStorage)

**Certo:** treat pgTAP + Deno como **two layers of defense-in-depth**, não substituto de integration tests:

```text
Pirâmide de testes Supabase (canônica):

           /\
          /E2E\          ← Playwright/Cypress: 5-10 critical user journeys
         /------\
        /  INT.  \       ← Vitest/Jest com Supabase real: auth flow, multi-tenant
       /----------\
      /  DENO TESTS \    ← pattern 3: Edge Functions HTTP handlers
     /--------------\
    /     pgTAP      \   ← pattern 1: schema + RLS + PG functions
   /------------------\
   |  Unit tests app  |  ← Vitest/Jest cliente: componentes React, helpers
```

Cada camada cobre **incidentes diferentes**:
- pgTAP: regressão em schema/policy/function
- Deno: regressão em Edge Function logic
- Integration: regressão em cliente ↔ Supabase wire
- E2E: regressão em user journey

Sem todas as camadas, gaps de cobertura existem. CI deve ter **separate required checks** por camada.

### Anti-pattern 5: Snapshot pgTAP sem revisão (characterization shortcut)

**Errado:** copy-paste output bruto de query como `results_eq` expected sem inspecionar — "se runs verde, está OK".

```sql
-- characterization sem revisão
select results_eq(
  $$select public.complex_function('input-1')$$,
  $$values ('a', '2026-05-11T10:23:45.123456Z'::timestamptz, 'token_abc123xyz', 42, '00000000-1234-5678-9abc-def012345678'::uuid)$$,
  'preserved as-is'
);
```

**Por quê:** output bruto pode incluir:

- **PII** (emails, names) — vazam para git history
- **Tokens/secrets** — vazam para git history (irreversível)
- **Timestamps voláteis** — test será flaky em run subsequente
- **UUIDs locais** — gerados por `gen_random_uuid()`, mudam a cada run

CI fica "verde" porque snapshot bate consigo mesmo da última run, mas:
- Adicionar fixture nova quebra (timestamp diferente)
- PR review humano não detecta bugs (não inspecionou output)
- Secrets podem ser commitados sem aviso

**Certo:** revisão linha-por-linha + sanitização antes de salvar (cross-ref skill `legacy-characterization-tests` Pattern 6):

```sql
-- characterization com sanitização determinística
begin;
-- 1. Fixar clock para determinismo
select set_config('app.fake_now', '2026-05-11T10:00:00Z', true);

-- 2. Fixar UUIDs determinísticos via fixture
insert into public.things (id, name, created_at) values
  ('00000000-0000-0000-0000-000000000001', 'Test', '2026-05-11T10:00:00Z'::timestamptz);

-- 3. Snapshot review:
-- - Email 'alice@x.com' está no fixture (não real PII)
-- - Timestamp '2026-05-11T10:00:00Z' está congelado (fake clock)
-- - UUID '00000000...001' está determinístico (fixture)
-- - Token 'token_test_abc' está sanitized (não real)
select results_eq(
  $$select id, name, created_at from public.things where id = '00000000-0000-0000-0000-000000000001'::uuid$$,
  $$values ('00000000-0000-0000-0000-000000000001'::uuid, 'Test'::text, '2026-05-11T10:00:00Z'::timestamptz)$$,
  'thing fixture matches characterization oracle (reviewed 2026-05-11)'
);

select * from finish();
rollback;
```

**Crítico:** comentar quando snapshot foi revisado + por quem. Commit message: "characterize complex_function — reviewed 2026-05-11, bugs noted in comments".

## Cross-suite integration (v1.27)

Esta skill é **complemento essencial** da skill Phase 151 `supabase-ci-cd-github-actions`:

- Phase 151 estabelece workflows CI (`database-tests.yml` + `functions-tests.yml`) que executam `supabase test db` + `deno test --allow-all`
- Phase 152 (ESTA) detalha a **sintaxe canônica** dos tests que esses workflows consomem
- Forward-ref de Phase 151 é fechado por esta skill (Pattern 5 da Phase 151 referenciava "skill futura `supabase-pgtap-testing` Phase 152")

Cross-refs com skills existentes v1.x:

- **`legacy-characterization-tests` (v1.16)** — pgTAP é o mecanismo canônico para implementar characterization (cap 13 Feathers) em PG legado; Pattern 4 desta skill é especialização para Postgres
- **`pre-refactor-characterization` (v1.18)** — gate auto-trigger que bloqueia refactor sem characterization; pgTAP satisfaz a pré-condição para PG functions
- **`ai-mutation-tester` (v1.20)** — mutation testing complementar; valida que pgTAP detecta regressão
- **`supabase-database-functions`** — PG functions criadas seguindo essa skill são prime target de pgTAP (SECURITY INVOKER + SET search_path = '' são testáveis)
- **`supabase-rls-policies` (v1.23)** — RLS policies validadas via `throws_like '%permission denied%'` + `results_eq` com diferentes JWT claims
- **`supabase-edge-functions`** — Edge Functions cobertas por Deno tests (Pattern 3)
- **`supabase-postgres-roles` (v1.26)** — testes de roles validáveis via `has_role`, `set role test_role; ...; reset role`
- **`supabase-custom-claims-rbac` (v1.25)** — testes de auth hook validáveis via fixture JWT + `set_config('request.jwt.claim.user_role', 'admin', true)`

Base para agent futuro v1.27:

- **`supabase-cicd-pipeline-implementer` (Phase 154, futura)** — agent que materializa workflows + tests; consome esta skill para gerar test files iniciais junto com migrations

Pattern de handoff cooperativo herdado v1.23-v1.26: **architect** projeta strategy → **test-writer** materializa pgTAP/Deno tests → **release-pipeline-auditor** (v1.10) audita coverage do pipeline. Nenhum agente descarta upstream — handoff cooperativo (princípio canônico v1.23).

### Casos de uso por agent

| Agent | Como consome esta skill |
|-------|-------------------------|
| `supabase-migration-writer` | Gera migration + pgTAP test inicial (has_table, has_column, has_pk) |
| `supabase-rls-writer` (v1.23) | Gera RLS policies + pgTAP test (throws_like '%permission denied%' para cross-tenant) |
| `supabase-edge-fn-writer` | Gera Edge Function + Deno test (handler retorna 200/400 esperado) |
| `legacy-characterizer` | Gera pgTAP characterization tests para PG function legada (cap 13 Feathers) |
| `refactor-safety-auditor` | Verifica existência de pgTAP tests antes de permitir refactor PG |
| `supabase-cicd-pipeline-implementer` (Phase 154 futura) | Gera workflows `database-tests.yml` + `functions-tests.yml` + tests iniciais |

## Ver também

- [supabase-ci-cd-github-actions](../supabase-ci-cd-github-actions/SKILL.md) (v1.27, Phase 151) — workflows CI que executam `supabase test db` + `deno test`
- [legacy-characterization-tests](../legacy-characterization-tests/SKILL.md) (v1.16) — cap 13 Feathers; pgTAP é mecanismo canônico para Postgres
- [pre-refactor-characterization](../pre-refactor-characterization/SKILL.md) (v1.18) — gate que pgTAP satisfaz para PG functions
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — PG functions testáveis via pgTAP
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) (v1.23) — RLS testável via `throws_like` + `set_config jwt claim`
- [supabase-rls-defense-in-depth](../supabase-rls-defense-in-depth/SKILL.md) (v1.23) — Camadas testáveis em pgTAP
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — Edge Functions cobertas por Deno tests
- [supabase-postgres-roles](../supabase-postgres-roles/SKILL.md) (v1.26) — `has_role`, `set role` testáveis
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) (v1.25) — fixture JWT via `set_config('request.jwt.claim.*')`
- [supabase-migrations](../supabase-migrations/SKILL.md) (v1.23) — migration cria tabela; pgTAP test valida
- [ai-mutation-tester](../../agents/ai-mutation-tester.md) (v1.20) — mutation testing complementar
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos pgTAP, TAP, plan(N), throws_ok, results_eq, supabase test db, deno test --allow-all
- Doc oficial pgTAP: [pgTAP Documentation](https://pgtap.org/documentation.html)
- Doc oficial Supabase: [Testing with pgTAP](https://supabase.com/docs/guides/database/extensions/pgtap), [Testing Edge Functions](https://supabase.com/docs/guides/functions/unit-test)
