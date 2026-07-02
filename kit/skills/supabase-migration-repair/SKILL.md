---
name: supabase-migration-repair
cost_tier: leve
description: Diagnostica e repara sync errors Supabase — mismatch entre supabase/migrations/ e tracking table remota, migration repair --status, rollback preview branch, drift de timestamps e erros
---

# Supabase — Migration Repair

## Quando usar

Use esta skill ao enfrentar **sync errors** ou **estado inconsistente** entre o folder local `supabase/migrations/` e a tracking table remota `supabase_migrations.schema_migrations`, ou ao precisar de rollback de preview branch após migration falha.

Trigger phrases:

- "migration repair", "supabase migration repair"
- "sync error Supabase", "migration history mismatch"
- "supabase migration list mostra mismatch"
- "schema drift Supabase", "git rebase migration timestamps"
- "permission denied migration", "permission denied for table _type"
- "permission denied 42501 Supabase", "custom_role to postgres"
- "rollback preview branch Supabase"
- "db push falhando re-aplicar migration"
- "db pull pg_dump error graphql"

**Use esta skill APENAS para:**

- Diagnosticar mismatch entre folder local e tracking table remoto
- Corrigir history record em `supabase_migrations.schema_migrations` quando schema state real está OK
- Rollback de preview branch ephemeral via PR close+reopen (cross-ref skill `supabase-branching-workflow` Phase 149)
- Resolver drift de timestamps após git rebase em equipe
- Resolver erros `42501 permission denied` e `pg_dump error permission denied for table _type`

**NÃO use esta skill para:**

- Reverter mudanças de schema reais — `migration repair` NÃO reverte SQL (cross-ref CAVEAT CRÍTICO abaixo)
- Substituir testes de migration — preview branch + DAG step 5 (cross-ref skill `supabase-branching-workflow` Phase 149) é o gate canônico
- Bypassar migration files aplicando schema changes via Dashboard SQL editor — isso CRIA o problema que esta skill diagnostica
- Recovery de production database com data loss — backup + point-in-time recovery do Supabase (fora do escopo desta skill)

## Princípio canônico

Três princípios canônicos sustentam toda a skill:

### Princípio 1 — Tracking table state ≠ schema state real

A tracking table `supabase_migrations.schema_migrations` é um **registro de histórico** de quais migrations foram aplicadas. O **schema state real** é o estado físico do DB (tabelas, colunas, indices, funções, policies).

Os dois podem divergir:

| Schema real | Tracking table | Causa | Sintoma |
|---|---|---|---|
| Tabela `foo` existe | Sem registro 20240102 | Migration aplicada manualmente via Dashboard SQL editor | `db push` tenta re-aplicar 20240102 e falha com "relation foo already exists" |
| Tabela `foo` NÃO existe | Com registro 20240102 | Tracking table corrupto / migration teve rollback parcial | `db push` skip 20240102 mas tabela ausente | 
| Tabela `foo` existe | Com registro 20240102 | Estado normal — sincronizado | Nenhum |
| Tabela `foo` NÃO existe | Sem registro 20240102 | Nada aplicado ainda — pendente | `db push` aplica 20240102 normalmente |

### Princípio 2 — Diagnose ANTES de repair

NUNCA execute `supabase migration repair` sem primeiro rodar `supabase migration list` para entender QUAL migration está em qual estado de mismatch. Repair cego pode mascarar bug + tornar recovery mais difícil.

### Princípio 3 — Rollback preview preferível a manual revert

Para preview branches Supabase Branching (Phase 149), **delete+reopen do PR** é canônico e seguro. Tentar criar "reverter migration" manualmente para desfazer schema changes em preview branch é anti-pattern — preview branches são ephemeral by design (cross-ref skill `supabase-branching-workflow` Phase 149).

## CAVEAT CRÍTICO — Tracking table apenas

> **`supabase migration repair` atualiza APENAS a tracking table `supabase_migrations.schema_migrations`. NÃO aplica SQL nem reverte SQL.**
>
> Este caveat é repetido **DUAS VEZES** nesta skill (Pattern 2 + abaixo) porque é a fonte #1 de bugs em recovery de migrations Supabase. LLMs e humanos frequentemente assumem que `repair --status reverted` "desfaz" a migration — **NÃO DESFAZ**.
>
> Se a migration realmente alterou schema (criou tabela, alterou coluna, etc.), `repair --status reverted` APENAS remove o registro do histórico. As mudanças físicas no DB **permanecem**. Para reverter mudanças de schema reais:
>
> 1. Criar **nova migration** que desfaz as mudanças (`drop table ...`, `alter table ... drop column ...`)
> 2. Aplicar via `supabase db push`
> 3. NÃO usar `repair --status reverted` esperando reverter SQL

## Pattern 1: Diagnóstico via `supabase migration list` (REPAIR-01)

Primeira ação canônica em qualquer cenário de migration error — **sempre** começar por aqui.

### Comando

```bash
supabase migration list
```

### Output canônico

```
        LOCAL          │     REMOTE     │     TIME (UTC)
  ─────────────────────┼────────────────┼─────────────────────
        20240101120000 │ 20240101120000 │ 2024-01-01 12:00:00
        20240102140000 │ -              │ 2024-01-02 14:00:00
        -              │ 20240103160000 │ 2024-01-03 16:00:00
```

### Interpretação canônica das 3 colunas

| Coluna | Significado |
|---|---|
| **LOCAL** | Timestamp encontrado em `supabase/migrations/*.sql` (folder local do repo git) |
| **REMOTE** | Timestamp registrado em `supabase_migrations.schema_migrations` (tracking table no DB remoto) |
| **TIME (UTC)** | Quando foi aplicada (presente apenas quando coluna REMOTE tem valor) |

### 3 estados canônicos por linha

**Estado 1: sincronizado**

```
20240101120000 │ 20240101120000 │ 2024-01-01 12:00:00
```

Migration presente em ambos — estado **normal**, nenhuma ação necessária.

**Estado 2: local-only (pending push)**

```
20240102140000 │ -              │ 2024-01-02 14:00:00
```

Migration existe no folder local mas NÃO foi aplicada no remote. Ação canônica:

```bash
supabase db push
```

Aplica migrations pendentes em ordem cronológica.

**Estado 3: remote-only (drift)**

```
-              │ 20240103160000 │ 2024-01-03 16:00:00
```

Migration foi aplicada no remote (registrada na tracking table) MAS o arquivo `.sql` correspondente NÃO existe no folder local. Causas possíveis:

- Migration aplicada manualmente via Dashboard SQL editor sem commit no git
- Outro dev aplicou migration e ainda não pushou para git remoto
- Arquivo local foi deletado por engano

Ação canônica:

```bash
supabase db pull
```

Gera arquivo `.sql` local correspondente à migration registrada no remote. Sincroniza folder local com tracking table.

### Comportamento canônico de `supabase db push`

`supabase db push` compara local folder vs remote tracking table:

1. Lista migrations em `supabase/migrations/*.sql` (folder local)
2. Lista migrations em `supabase_migrations.schema_migrations` (tracking table)
3. Calcula diff: migrations no folder MAS não na tracking table
4. Aplica em ordem cronológica (por timestamp) — registra cada uma na tracking table após sucesso

**Caveat — tracking table é fonte de verdade para "o que foi aplicado":**

Se você deleta o folder local, `db push` NÃO re-aplica migrations já registradas na tracking table. Para forçar re-aplicação, precisa:

1. `db pull` para regenerar folder local a partir do remote, OU
2. `migration repair --status reverted <timestamp>` para remover o registro da tracking table (CAVEAT CRÍTICO repetido — isso só remove o registro, NÃO reverte schema)

### Estrutura interna da tracking table

```sql
-- estrutura canônica da tracking table (não modificar manualmente)
\d supabase_migrations.schema_migrations

       Column       │           Type
  ──────────────────┼─────────────────────────
   version          │ text NOT NULL PRIMARY KEY
   name             │ text
   statements       │ text[]
```

- `version` — timestamp da migration (PK)
- `name` — descrição da migration
- `statements` — array com SQL aplicado (audit trail)

**NUNCA modifique esta tabela diretamente.** Use `migration repair` (Pattern 2) para mutação segura via CLI.

## Pattern 2: `migration repair --status applied|reverted` (REPAIR-02)

> **CAVEAT CRÍTICO REPETIDO — tracking table apenas:**
>
> `supabase migration repair` atualiza APENAS a tracking table `supabase_migrations.schema_migrations`. **NÃO aplica SQL nem reverte SQL.**
>
> Se a migration realmente alterou schema, `repair --status reverted` remove o registro do histórico MAS as mudanças físicas no DB **permanecem**. Para reverter schema changes reais, crie nova migration via `supabase migration new`.

### Sintaxe canônica

```bash
supabase migration repair --status <applied|reverted> <migration-timestamp>
```

Dois subcomandos canônicos:

- `--status applied <timestamp>` — adiciona registro à tracking table (marca como aplicada)
- `--status reverted <timestamp>` — remove registro da tracking table (marca como reverted)

### Caso 1 — Migration aplicada manualmente (precisa marcar como applied)

**Cenário:**

- Dev abriu Dashboard → SQL editor → executou `CREATE TABLE foo (...)` direto no DB remoto
- Schema state OK (tabela existe), mas tracking table NÃO tem registro
- Posteriormente, dev criou migration `20240102_create_foo.sql` no folder local com o mesmo SQL
- `supabase db push` lista migration como pending → tenta aplicar → falha com `relation "foo" already exists`

**Diagnóstico:**

```bash
supabase migration list
# Output:
#   20240102140000 │ -  │ 2024-01-02 14:00:00
```

Confirma migration está local-only — porém schema state real tem a tabela. Repair canônico:

```bash
supabase migration repair --status applied 20240102140000
```

**O que acontece:**

- Tracking table recebe novo registro: `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20240102140000', 'create_foo')`
- Schema state físico NÃO é alterado (tabela `foo` continua existindo, sem nenhuma operação SQL extra)
- Próximo `supabase migration list` mostra migration sincronizada

**Quando usar este caso:**

- Hotfix aplicado emergencialmente via Dashboard SQL editor sem migration file
- Migration aplicada manualmente em ambiente novo (ex: replicar schema de produção)
- Schema gerado por ferramenta externa (Drizzle, Prisma) onde tracking table está fora de sync

### Caso 2 — Migration registrada mas nunca aplicada (precisa marcar como reverted)

**Cenário:**

- Tracking table tem registro `20240102140000` MAS schema state real NÃO tem a tabela criada por essa migration
- Causas possíveis: tracking table corrupto, migration teve rollback parcial, restore parcial de backup

**Diagnóstico:**

```bash
supabase migration list
# Output:
#   20240102140000 │ 20240102140000 │ 2024-01-02 14:00:00
```

Aparenta sincronizado, mas tabela não existe. Confirmar via:

```sql
-- conectar via psql ou Dashboard SQL editor
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'foo';
-- 0 rows
```

Repair canônico:

```bash
supabase migration repair --status reverted 20240102140000
```

**O que acontece:**

- Tracking table tem registro DELETADO: `DELETE FROM supabase_migrations.schema_migrations WHERE version = '20240102140000'`
- Schema state físico NÃO é alterado (tabela `foo` continua não existindo — `repair` não cria nada)
- `supabase db push` agora considera migration como pending → aplica normalmente

**Quando usar este caso:**

- Tracking table está fora de sync por motivo desconhecido
- Migration tem registro mas schema state real não reflete (tabela ausente, coluna ausente, etc.)
- Precisa "forçar" re-aplicação de migration via `db push` após confirmar que schema real não tem as mudanças

### Anti-uso CRÍTICO — não usar para reverter schema

```bash
# ERRADO — esperar que isso reverta a tabela criada pela migration
supabase migration repair --status reverted 20240102140000
```

**Por quê:** apenas remove o registro. A tabela `foo` continua existindo. Próximo `supabase db push` vai tentar aplicar a migration novamente, falhar com `relation already exists`, e você fica em loop infinito.

**Certo — para reverter schema changes reais:**

```bash
# 1. Criar nova migration que desfaz as mudanças
supabase migration new drop_foo

# 2. Editar arquivo gerado supabase/migrations/<novo-timestamp>_drop_foo.sql:
#    drop table if exists public.foo;

# 3. Aplicar
supabase db push
```

### Fluxograma canônico de decisão

```
Sync error em supabase migration list?
       │
       ├─ Local-only (LOCAL=X, REMOTE=-)
       │     │
       │     ├─ Schema real TEM as mudanças?
       │     │     ├─ SIM → repair --status applied <X>
       │     │     └─ NÃO → supabase db push (aplicação normal)
       │     │
       │
       ├─ Remote-only (LOCAL=-, REMOTE=Y)
       │     │
       │     ├─ Schema real TEM as mudanças?
       │     │     ├─ SIM → supabase db pull (regenera arquivo local)
       │     │     └─ NÃO → repair --status reverted <Y> (limpa registro órfão)
       │
       └─ Aparenta sincronizado mas erros persistem
             │
             ├─ Conectar via psql + verificar schema state real
             └─ Decidir entre repair vs nova migration baseado em estado
```

## Pattern 3: Rollback preview branch via delete + reopen (REPAIR-03)

Quando uma migration ruim foi pushada para preview branch Supabase Branching e DAG falhou no step 5 (migrate), o **canônico** é NÃO criar reverter migration — use rollback via PR close+reopen.

### Workflow canônico (5 passos)

```
1. Dev pusha migration ruim em PR
       ↓
2. Supabase webhook → DAG step 5 (migrate) FALHA
       ↓ status no PR: "Supabase Preview ✗"
       ↓
3. Dev fecha PR (GitHub UI: "Close pull request")
       ↓
4. Supabase Branching detecta PR closed → DELETA preview branch
       ↓ (cleanup completo: DB, Edge Functions, Storage config)
       ↓
5. Dev fixa migration + reopen PR (GitHub UI: "Reopen pull request")
       ↓
6. Supabase Branching detecta PR reopened → CRIA novo preview branch
       ↓ DAG roda steps 1-7 do zero com migration corrigida
```

### Equivalência canônica

**Delete preview branch + reopen** = **`supabase db reset` local**.

Ambos:

- Limpam DB state completamente
- Re-executam todas migrations em ordem cronológica
- Re-aplicam `supabase/seed.sql`
- Resetam Edge Functions para versão atual do branch git

### Caveats canônicos

**Caveat 1 — Data changes adicionais SÃO PERDIDOS**

`seed.sql` é re-aplicado como dataless setup. Quaisquer rows inseridas/atualizadas manualmente durante uso do preview branch:

- Via Dashboard Table editor
- Via testes manuais (insert, update direto)
- Via Edge Function execution (que escreveu em tabelas)

**são perdidas** no reset. Aceito como trade-off canônico para reset limpo — preview branches são ephemeral by design (cross-ref skill `supabase-branching-workflow` Phase 149).

**Caveat 2 — Auto-pause em inatividade NÃO substitui reset**

Preview branches auto-pausam após inatividade (~24h sem requests), mas isso preserva o state. NÃO é equivalente a reset. Para limpeza real, sempre use close+reopen.

**Caveat 3 — Branching Compute Hours acumulam novamente**

Reopen recria preview branch do zero → nova hora de Branching Compute Hours é cobrada (cross-ref skill `supabase-branching-workflow` Phase 149 — Pattern 5 custo). Se rollback acontece 5× para o mesmo PR, são 5 horas extras cobradas. Considere disciplina: testar migration localmente antes de push.

### Quando usar este pattern

- Migration ruim foi pushada para preview branch
- DAG step 5 (migrate) falhou — sem possibilidade de recovery via re-push (porque o branch já está em estado "failed")
- Você quer voltar ao estado limpo sem aplicar reverter migration manualmente
- Aceita perda de data changes adicionais que não estavam em seed.sql

### Quando NÃO usar este pattern

- Persistent branches (staging/QA) — NÃO use delete+reopen; persistent branches são long-lived (cross-ref skill `supabase-branching-workflow` Phase 149 — Pattern 1)
- Production project — production NUNCA tem rollback via "close PR" — use migration de reversão + `db push` + cuidados extras (backup + monitoramento)
- Quando você precisa preservar data changes — não há recovery dos dados após delete

### Workflow alternativo: push corrected migration

Se o branch ainda está em estado "failed" mas branch ainda existe (PR não foi fechado):

```
1. Identificar root cause via Dashboard → branch deployment logs (step 5 stderr)
2. Corrigir migration localmente
3. git commit + git push (mesmo PR)
4. Supabase webhook detecta push → re-run DAG do step 1
5. Se passa step 5 → step 6 (seed) e step 7 (deploy) executam
```

Este workflow é **preferível** se o erro foi simples (typo, syntax error) — evita Branching Compute Hours extras do reset.

## Pattern 4: Schema drift após git rebase (REPAIR-04)

Cenário canônico em equipes que mergem migrations em paralelo via PRs em main.

### Problema canônico

```
Timeline:
  T   = Dev A cria PR-A com migration 20240106120000_dev_A.sql
  T+1 = Dev B cria PR-B com migration 20240106130000_dev_B.sql
  T+2 = PR-B é merged primeiro (dev_B agora está em main)
  T+3 = Dev A faz git pull origin main → traz dev_B
  T+4 = Dev A faz git rebase main em sua branch
  T+5 = Estado: branch de Dev A tem dev_B (timestamp 13:00) + dev_A (timestamp 12:00)
```

**Problema:** após rebase, Dev A tem migrations em ordem:

```
supabase/migrations/
├── 20240106120000_dev_A.sql  (mais antiga)
├── 20240106130000_dev_B.sql  (mais nova)
```

Local `supabase db reset` aplica em ordem cronológica:

1. Aplica `20240106120000_dev_A.sql` PRIMEIRO
2. Aplica `20240106130000_dev_B.sql` DEPOIS

Se `dev_A` depende de schema state que só existe APÓS `dev_B` (ex: dev_A adiciona FK para tabela que dev_B criou), `supabase db reset` falha.

**Pior:** quando `db push` para production, ordem cronológica força dev_A primeiro → falha em produção.

### Solução canônica (4 passos)

```bash
# Passo 1: Pull main (traz migrations recentes da equipe)
git pull origin main

# Passo 2: Criar nova migration com timestamp atualizado (placeholder)
supabase migration new dev_A
# Cria: supabase/migrations/20240106140000_dev_A.sql (timestamp ATUAL, mais novo)

# Passo 3: Renomear migration antiga para o novo timestamp
mv supabase/migrations/20240106120000_dev_A.sql supabase/migrations/20240106140000_dev_A.sql

# (Passo 2 criou arquivo vazio; passo 3 sobrescreve com conteúdo correto)

# Passo 4: Reset local para reaplicar tudo em ordem cronológica correta
supabase db reset
```

### Resultado final

```
supabase/migrations/
├── 20240106130000_dev_B.sql  (do teammate, vem primeiro)
├── 20240106140000_dev_A.sql  (renomeada com timestamp posterior, vem depois)
```

`supabase db reset` aplica em ordem correta:

1. Aplica `20240106130000_dev_B.sql` (tabela criada por dev_B)
2. Aplica `20240106140000_dev_A.sql` (FK funciona porque tabela já existe)

### Princípio canônico

> **Changes que dependem de earlier changes DEVEM ter later timestamps.**
>
> Append-only migration history não tolera reordering retroativo. Se você precisa ordenar migration A antes de B mas A tem timestamp mais antigo, **renomeie** A para timestamp posterior a B.

### Cuidado canônico — git history

Após `mv supabase/migrations/<old>.sql supabase/migrations/<new>.sql`:

```bash
# git detecta como rename (boa preservação de history)
git status
# renamed: supabase/migrations/20240106120000_dev_A.sql -> supabase/migrations/20240106140000_dev_A.sql

git add supabase/migrations/
git commit -m "fix: rebase migration dev_A após merge de dev_B em main"
```

### Caveat — se a migration JÁ FOI PUSHADA para preview/staging

Se sua migration `dev_A` já foi pushada para preview branch e DAG executou (mesmo se falhou), a tracking table do preview tem registro `20240106120000`. Renomear o arquivo local cria mismatch:

- Local folder: `20240106140000_dev_A.sql` (renomeado)
- Tracking table preview: `20240106120000` (registro antigo)

Solução canônica nesse caso:

1. Renomear arquivo localmente (passos 1-4 acima)
2. Close+reopen PR (Pattern 3 — rollback preview) → recria preview branch do zero
3. Push do branch corrigido → DAG roda com timestamp correto

### Quando este pattern NÃO se aplica

- Migrations independentes (não há dependência de ordem) — pode ignorar drift, ordem cronológica resolve corretamente
- Migrations já aplicadas em produção — NÃO renomeie migrations em produção; cria mismatch entre tracking table e folder local. Use forward-only migration de correção.

## Pattern 5: Permission denied troubleshooting (REPAIR-05)

Dois casos canônicos documentados na doc oficial Supabase — ambos exigem aplicação manual de GRANT via Dashboard SQL Editor.

### Caso 1 — db pull erro "permission denied for table _type"

#### Erro completo

```
$ supabase db pull
Error: Error running pg_dump on remote database:
pg_dump: error: query failed: ERROR:  permission denied for table _type
pg_dump: error: query was: LOCK TABLE "graphql"."_type" IN ACCESS SHARE MODE
```

#### Causa canônica

Projetos Supabase **antigos** (criados antes da introdução do GraphQL schema com grants padrão) NÃO têm GRANTs corretos em `graphql._type`. `pg_dump` requer LOCK ACCESS SHARE em todas as tabelas do schema para snapshot consistente — falha sem GRANT.

#### Solução canônica

Executar no **Dashboard → SQL Editor** (não em migration file porque é one-time fix para schema graphql gerenciado pelo Supabase):

```sql
grant all on all tables in schema graphql to postgres, anon, authenticated, service_role;
grant all on all functions in schema graphql to postgres, anon, authenticated, service_role;
grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
```

#### Verificação após fix

```bash
supabase db pull
# Output esperado: "Schema pulled successfully" sem erro de permission denied
```

#### Caveat canônico — projetos novos

Projetos criados após 2024 vêm com esses GRANTs configurados automaticamente. Se você está em projeto criado recentemente e ainda recebe esse erro, verifique se há roles customizadas que precisam de GRANT também:

```sql
-- exemplo: se você criou role "data_team_reader" e quer permitir db pull com ela
grant all on all tables in schema graphql to data_team_reader;
grant all on all functions in schema graphql to data_team_reader;
grant all on all sequences in schema graphql to data_team_reader;
```

### Caso 2 — db push erro 42501 com custom role

#### Erro completo

```
$ supabase db push
Applying migration 20240107120000_alter_orders.sql...
ERROR: permission denied for table orders (SQLSTATE 42501)
Error: failed to apply migration
```

#### Causa canônica

Tabela `orders` foi criada com **custom role** (ex: `app_admin` ou similar) em migration anterior. Quando `supabase db push` executa a próxima migration, o conexão é feita como role `postgres` (default do CLI), e `postgres` NÃO tem permission para modificar a tabela porque o owner é `app_admin`.

SQLSTATE `42501` é o código canônico Postgres para "insufficient_privilege". Cross-ref skill `supabase-postgres-roles` (v1.26) para entendimento completo de custom roles.

#### Solução canônica

Conceder membership do custom role para `postgres`:

```sql
grant "custom_role" to "postgres";
```

Substituindo `custom_role` pelo nome real (ex: `app_admin`, `lead_manager`, etc.):

```sql
-- exemplo concreto
grant "app_admin" to "postgres";
```

#### Como funciona

- `grant "app_admin" to "postgres"` torna `postgres` **membro** do role `app_admin`
- Por default, roles em Postgres usam INHERIT — `postgres` herda permissions de `app_admin`
- Agora `postgres` consegue modificar tabelas que têm owner = `app_admin`

#### Caveat canônico — INHERIT vs SET ROLE

Se `app_admin` foi criado com NOINHERIT (cross-ref skill `supabase-postgres-roles` v1.26 — Pattern 3), simples GRANT membership NÃO é suficiente. `postgres` precisa `SET ROLE app_admin` explicitamente antes de cada operação:

```sql
-- na migration (não recomendado, mas funciona)
set role app_admin;
alter table public.orders add column foo text;
reset role;
```

Solução **preferível** se você está em projeto novo: criar custom roles com INHERIT default (cross-ref skill `supabase-postgres-roles` v1.26 — Pattern 3).

#### Quando aplicar este GRANT

Aplique **uma única vez** após criar a custom role:

```sql
-- na primeira migration que cria a custom role (cross-ref skill supabase-postgres-roles)
create role "app_admin" noinherit;
alter role "app_admin" with bypassrls;
grant "app_admin" to "postgres";  -- ⚡ esta linha resolve o erro 42501
```

Comments explicativos canônicos na migration:

```sql
-- GRANT membership de app_admin para postgres
-- Permite que supabase db push (conectado como postgres) modifique tabelas
-- com owner app_admin sem precisar SET ROLE explícito.
-- Sem isso: erro SQLSTATE 42501 ao alterar tabela.
grant "app_admin" to "postgres";
```

### Tabela canônica — erros + soluções

| Erro | SQLSTATE | Comando que dispara | Solução canônica |
|---|---|---|---|
| `permission denied for table _type` | (sem código) pg_dump error | `supabase db pull` | `grant all on all tables in schema graphql to postgres, anon, authenticated, service_role` |
| `permission denied for table X` | 42501 | `supabase db push` | `grant "custom_role" to "postgres"` |
| `relation X already exists` | 42P07 | `supabase db push` | `migration repair --status applied <timestamp>` (Pattern 2) |
| `relation X does not exist` | 42P01 | `supabase db push` | Verificar ordem de migrations (Pattern 4) ou pull do remote (Pattern 1) |

## Anti-patterns

### Anti-pattern 1: Usar `migration repair --status reverted` esperando reverter SQL

**Errado:**

```bash
# Dev quer "desfazer" CREATE TABLE foo que migration 20240102 criou
supabase migration repair --status reverted 20240102140000
# Espera: tabela foo deletada
# Realidade: apenas registro de tracking table removido — tabela foo continua existindo
```

**Por quê:** `repair` é tracking-table-only. CAVEAT CRÍTICO repetido nesta skill (Pattern 2 + introdução). LLMs e humanos frequentemente assumem semantics de "rollback completo" — incorreto.

**Sintoma do bug:** próximo `supabase db push` tenta re-aplicar a migration → falha com `relation "foo" already exists` (SQLSTATE 42P07) → loop infinito de tentativas de repair.

**Certo:**

```bash
# Para reverter schema changes reais, crie nova migration
supabase migration new drop_foo
# Editar arquivo gerado:
#   drop table if exists public.foo;
supabase db push
```

### Anti-pattern 2: Schema changes direto no remote bypassing migration files

**Errado:**

```sql
-- Dev abre Dashboard → SQL Editor → executa direto no DB remoto:
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  created_at timestamptz not null default now()
);

-- Sem commit no git, sem migration file, sem registro na tracking table
```

**Por quê:** cria divergência canônica entre schema real (tabela existe) e tracking table (sem registro). Cross-ref Princípio 1. Próximo dev que clonar repo + rodar `supabase db reset` local NÃO terá a tabela.

**Sintomas:**

- Outros devs reportam "minha app não funciona, tabela audit_log não existe"
- CI/CD pipeline falha em ambientes novos (preview branches, persistent staging)
- `supabase db pull` mostra surpresas (tabela "remote-only")

**Certo:**

```bash
# 1. Criar migration file via CLI
supabase migration new create_audit_log

# 2. Editar arquivo gerado com SQL (incluindo GRANTs + RLS — cross-ref skill supabase-migrations)
#    supabase/migrations/<timestamp>_create_audit_log.sql

# 3. Testar localmente
supabase db reset

# 4. Commit + push + PR (cross-ref skill supabase-branching-workflow Phase 149)
git add supabase/migrations/
git commit -m "feat: add audit_log table"
git push
# Abre PR → preview branch criado → DAG step 5 valida migration
```

### Anti-pattern 3: Não rebase local antes de db push em equipe

**Errado:**

```
Dev A workflow:
  1. Cria branch feature-A com migration 20240106120000_dev_A.sql
  2. NÃO pulla main por 1 semana (dev_B foi merged enquanto isso)
  3. Direto: supabase db push para staging
  4. Resultado: ordem cronológica força dev_A antes de dev_B → falha
```

**Por quê:** ordem cronológica de migrations é determinada por timestamp. Sem rebase, sua migration pode estar "presa" no passado relativo a migrations da equipe.

**Sintomas:**

- `db push` falha com "relation X does not exist" (FK para tabela que dev_B criou)
- Staging branch entra em estado "failed" do DAG
- Production fica em risco de mesma falha se dev fizer merge sem revisão

**Certo:**

```bash
# Antes de QUALQUER db push
git pull origin main
git rebase main

# Se houver conflito de timestamps → aplicar Pattern 4 (rename migration files)
supabase migration list  # diagnose primeiro
# se mismatch detectado, renomear migration antiga para timestamp atualizado

supabase db reset  # validar localmente em ordem cronológica correta
supabase db push   # só depois disso
```

### Anti-pattern 4: Concurrent db push from different machines

**Errado:**

```
Dev A (machine 1):
  19:00 — supabase db push (target: staging)

Dev B (machine 2):
  19:01 — supabase db push (target: staging)
  ↓ race condition
```

**Por quê:** dois processos `db push` simultâneos podem ambos detectar a mesma migration como pending → ambos tentam aplicar → race condition na tracking table → pode resultar em registro duplicado OU registro ausente após retry.

**Sintomas:**

- Tracking table corrompido (duplicate version OU missing version)
- Migration aplicada parcialmente (algumas statements rodaram, outras não)
- `supabase migration list` mostra estado inconsistente que não bate com nenhum cenário canônico

**Certo:**

- **Centralizar `db push` em CI/CD** — apenas pipelines (GitHub Actions, GitLab CI) executam `db push` em ambientes compartilhados (staging, production). Cross-ref skill `supabase-ci-cd-github-actions` (Phase 151).
- **Lock manual em produção** — se você precisa fazer manual push em production, comunique no canal #release-coordination ANTES (humano lock)
- **Dev workflow** — devs NUNCA fazem `db push` para staging direto da máquina local; sempre via PR + merge + CI/CD pipeline

### Anti-pattern 5: Renomear migrations em produção

**Errado:**

```bash
# Production tracking table tem registro 20240106120000
# Dev renomeia o arquivo local para 20240106140000 (sem entender o impacto)
mv supabase/migrations/20240106120000_old.sql supabase/migrations/20240106140000_old.sql

# Push para production
supabase db push --target=production
# ↓ falha: 20240106120000 (registrado) ≠ 20240106140000 (folder)
```

**Por quê:** tracking table em produção é **append-only history**. Renomear arquivos locais cria mismatch irreversível. Diferente de Pattern 4 (rename ANTES de qualquer push), em produção a migration JÁ foi registrada — renomear local é destrutivo.

**Sintomas:**

- `db push` para production falha permanentemente
- `migration repair` é necessário para corrigir, mas pode levar a mais bugs se aplicado errado
- Worst case: rollback de production via point-in-time recovery (custo + downtime)

**Certo:**

- **Renames de migration são VÁLIDOS apenas se nunca foram aplicados** (preview branch deletado + recriado, ou apenas em folder local sem nenhum push)
- **Em produção, sempre forward-only**: criar nova migration que desfaz/corrige, nunca renomear histórico
- **Treinamento de equipe**: documentar este anti-pattern no onboarding; novo dev pode descobrir Pattern 4 e aplicar inadvertidamente em produção

## Cross-suite integration (v1.27)

Esta skill é o **complemento operacional** das skills v1.27 introduzidas em Phases 149-152:

- **`supabase-branching-workflow`** (Phase 149) — quando DAG step 5 (migrate) falha em preview branch, use Pattern 3 (rollback via delete+reopen). Forward-ref de Phase 149 fechado nesta skill.
- **`supabase-config-toml-remotes`** (Phase 150) — secrets per-branch podem mascarar permission errors se a migration espera env var diferente. Diagnosticar via Pattern 5 quando aplicável.
- **`supabase-ci-cd-github-actions`** (Phase 151) — pipelines que executam `supabase db push` podem falhar com erros documentados em Pattern 5. Fix one-time via Dashboard SQL editor, depois pipeline funciona.
- **`supabase-pgtap-testing`** (Phase 152) — tests falhando em CI por schema desatualizado podem indicar tracking table mismatch — diagnose via Pattern 1 antes de assumir bug no test.

Esta skill é **standalone** — não cria agent novo. É consumida por:

- `supabase-migration-writer` — referencia para ações pós-falha de migration
- `supabase-rls-writer` (v1.23) — quando RLS depende de schema state que pode estar drifted
- Agents futuros Phase 154 (`supabase-branching-architect`, `supabase-cicd-pipeline-implementer`) — incorporam diagnóstico Pattern 1 em workflows recomendados

Pattern de handoff cooperativo herdado v1.23-v1.26: **architect** projeta workflow → **pipeline-implementer** materializa pipeline → quando falha, **migration-repair** skill é o "kit de emergência" canônico para recovery.

## Ver também

- [supabase-migrations](../supabase-migrations/SKILL.md) (v1.23) — pattern canônico de migration files (5 blocos obrigatórios + naming)
- [supabase-branching-workflow](../supabase-branching-workflow/SKILL.md) (v1.27, Phase 149) — preview branch lifecycle + DAG 7 steps + delete+reopen rollback
- [supabase-config-toml-remotes](../supabase-config-toml-remotes/SKILL.md) (v1.27, Phase 150) — `[remotes]` block + secrets per-branch
- [supabase-ci-cd-github-actions](../supabase-ci-cd-github-actions/SKILL.md) (v1.27, Phase 151) — 8 workflows canônicos GitHub Actions
- [supabase-pgtap-testing](../supabase-pgtap-testing/SKILL.md) (v1.27, Phase 152) — testes pgTAP integrados no DAG
- [supabase-postgres-roles](../supabase-postgres-roles/SKILL.md) (v1.26) — INHERIT/NOINHERIT, GRANT membership, predefined Supabase roles
- [evolucao-schema-compativel](../evolucao-schema-compativel/SKILL.md) (v1.22) — 3-step migration safe rolling upgrade (expand → migrate data → contract)
- [supabase-declarative-schema](../supabase-declarative-schema/SKILL.md) — workflow alternativo (declarative-first → diff → migrate)
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) (v1.23) — RLS deve ser parte de cada migration nova
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos canônicos migration repair, tracking table, schema drift, sync error
- Doc oficial Supabase: [Migration Repair](https://supabase.com/docs/reference/cli/supabase-migration-repair), [Local Development](https://supabase.com/docs/guides/local-development/cli/getting-started), [Branching](https://supabase.com/docs/guides/deployment/branching)
