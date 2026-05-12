---
name: supabase-postgres-roles
description: Use ao gerenciar Postgres roles em Supabase — system access (cron jobs, BI tools, ETL, admin scripts). Distinção canônica vs RLS+Custom Claims (application access).
---

# Supabase — Postgres Roles

## Quando usar (e quando NÃO usar)

Postgres roles gerenciam acesso ao banco — **system access** (service accounts internos, cron jobs, BI tools, ETL, admin scripts).

**Use Postgres roles APENAS para:**

- ✅ Service accounts internos (cron jobs com pg_cron, BI tools como Metabase, ETL scripts)
- ✅ Admin roles com BYPASSRLS (`security_admin`, `dpo_role`, `lead_manager`, `platform_admin`)
- ✅ Roles para column-level GRANTs específicos (cross-ref skill `supabase-column-level-security` v1.24)
- ✅ Custom roles que substituem service_role key em scripts (auditabilidade superior)

**NÃO use Postgres roles para:**

- ❌ "Admin vs user" application access → use **RLS + Custom Claims** (skill `supabase-custom-claims-rbac` v1.25)
- ❌ Filtrar dados por linha → use **RLS row-level** (skill `supabase-rls-policies` v1.23)
- ❌ Filtrar dados por coluna → use **Column-Level Privileges** (skill `supabase-column-level-security` v1.24)
- ❌ Substituir auth.users (auth.users é gerenciado pelo Supabase Auth — não criar roles para end-users)

Trigger phrases:

- "create role Postgres", "custom Postgres role"
- "role hierarchy", "INHERIT NOINHERIT"
- "GRANT REVOKE Postgres"
- "service account Supabase", "cron job role"
- "Postgres roles vs RLS"

## Distinção canônica

| | Application Access | System Access |
|---|---|---|
| Mecanismo | RLS + Custom Claims | Postgres Roles |
| Quem é o "user" | End-user via JWT (`auth.uid()`) | Service account interno |
| Identidade | JWT claim (`user_role`) | Postgres role login |
| Permissions | Granular por linha/coluna | Per tabela/schema/function |
| Audit trail | RLS denial logs (42501) | pg_stat_statements por role |
| Example | "User admin pode deletar messages" | "Cron job pode SELECT em todas tabs para backup" |

## Princípio canônico

Roles vs Users:

- **Role** = entidade Postgres que pode ter permissions
- **User** = role com `LOGIN` privilege (pode autenticar via senha)
- **Group** = role sem `LOGIN` (usado para herança de permissions)

```sql
-- group role (sem LOGIN — usado para hierarchy)
create role "readonly_group";

-- user role (com LOGIN — service account)
create role "readonly_user" with login password 'extremely_secure_pwd';

-- user role inherita do group
grant readonly_group to readonly_user;
-- agora readonly_user tem todas permissions do readonly_group
```

## Pattern 1: CREATE ROLE básico

### Group role (sem LOGIN)

```sql
create role "billing_group";
-- usado apenas como container de permissions; não pode logar
```

### User role (com LOGIN PASSWORD)

```sql
create role "billing_service" with login password 'p4ss-w0rd!sup3r_s3cur3';
```

**Password best practices (canônico):**

1. **12+ characters mínimo** — quanto mais longo, melhor
2. **Use password manager** para gerar (Bitwarden, 1Password, etc.)
3. **Mix upper + lower + numbers + special symbols** (`! @ # $ % &`)
4. **NÃO use dictionary words** comuns
5. **Roteie via secrets vault** — nunca hardcode em git

### Caveat — Percent-encoding em connection string

Special symbols em password precisam ser **percent-encoded** quando usados em connection string:

```
ANTES (raw password): p=ssword
DEPOIS (em URL):     p%3Dssword

Connection string:
postgresql://postgres.projectref:p%3Dssword@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

Tabela de encoding canônica:

| Char | Encoded |
|------|---------|
| `=`  | `%3D` |
| `&`  | `%26` |
| `+`  | `%2B` |
| `#`  | `%23` |
| `:`  | `%3A` |
| `/`  | `%2F` |
| `@`  | `%40` |
| `space` | `%20` |

## Pattern 2: GRANT / REVOKE permissions

GRANT canônico:

```sql
-- permission em schema completo
grant usage on schema public to billing_service;
grant select on all tables in schema public to billing_service;

-- permission em tabela específica
grant select, insert on table public.invoices to billing_service;

-- permission em função específica
grant execute on function public.calculate_total(uuid) to billing_service;

-- permission em sequence (necessário para INSERT em tabelas com SERIAL/BIGSERIAL)
grant usage on sequence public.invoices_id_seq to billing_service;
```

REVOKE canônico:

```sql
revoke select on table public.invoices from billing_service;
revoke execute on function public.calculate_total(uuid) from billing_service;
```

**Caveat — Default privileges para novos objetos:**

GRANT em "all tables" só cobre tabelas **existentes**. Para tabelas futuras criadas no schema, use `ALTER DEFAULT PRIVILEGES`:

```sql
-- todas tabelas futuras criadas em public terão SELECT GRANT para billing_service
alter default privileges in schema public
  grant select on tables to billing_service;
```

## Pattern 3: Role Hierarchy (INHERIT / NOINHERIT)

INHERIT (default): child role herda permissions do parent.

```sql
-- group com permissions base
create role "readers";
grant select on all tables in schema public to readers;

-- user inherita
create role "alice" with login password 'pwd1';
grant readers to alice;
-- alice agora tem SELECT em todas tabelas public (via readers)

-- multi-level hierarchy
create role "admins";
grant readers to admins;  -- admins inherita de readers
grant insert, update, delete on all tables in schema public to admins;

create role "bob" with login password 'pwd2';
grant admins to bob;
-- bob inherita de admins (que inherita de readers) — full CRUD em public
```

NOINHERIT: child role tem que **explicitamente** assumir parent role para usar permissions.

```sql
create role "superuser_proxy" noinherit;
grant postgres to superuser_proxy;

-- Para usar permissions de postgres, superuser_proxy precisa SET ROLE:
set role postgres;
-- agora opera como postgres
reset role;
```

**Quando usar NOINHERIT:**

- Roles superuser (postgres) — exigir SET ROLE explícito como guard
- Audit trail mais claro (queries mostram a role ativa)
- Princípio canônico: opt-in explícito em vez de implícito

## 10 Predefined Supabase Roles (documentação)

Supabase configura 10 roles automaticamente em todo projeto. **Não criar substitutos** — documentar e usar conforme apropriado.

### `postgres`
**Tipo:** Admin/superuser. **Quando usar:** scripts de admin via dashboard ou psql direto.
**NUNCA:** dar password ao third-party ou expor.

### `anon`
**Tipo:** Public unauthenticated. **Quando usar:** requests sem JWT (cliente deslogado).
**Caveat:** `anon` Postgres role ≠ anonymous Auth user (cross-ref skill `supabase-rls-policies` v1.23).

### `authenticator`
**Tipo:** PostgREST switch role. **Quando usar:** internal — PostgREST recebe JWT, valida, e switches para `anon` ou `authenticated` baseado em claims.
**Caveat:** acesso muito limitado — apenas SWITCH ROLE.

### `authenticated`
**Tipo:** Logged-in users. **Quando usar:** requests com JWT válido (autenticado).

### `service_role`
**Tipo:** Bypass RLS. **Quando usar:** backend tasks (Edge Functions, scripts admin).
**NUNCA:** expor ao cliente — vazamento = acesso total ao DB.

### `supabase_auth_admin`
**Tipo:** Auth middleware. **Quando usar:** internal — Supabase Auth service.
**Caveat:** GRANT EXECUTE em Custom Access Token Auth Hook (cross-ref skill `supabase-custom-claims-rbac` v1.25); scope `auth` schema.

### `supabase_storage_admin`
**Tipo:** Storage middleware. **Quando usar:** internal — Supabase Storage service. Scope `storage` schema.

### `supabase_etl_admin`
**Tipo:** Replication. **Quando usar:** internal — Replication powered by Supabase ETL. Read-all + bypass RLS + write `etl` schema.

### `dashboard_user`
**Tipo:** Supabase UI. **Quando usar:** internal — commands via Supabase dashboard.

### `supabase_admin`
**Tipo:** Internal admin. **Quando usar:** internal — upgrades + automations.

## Pattern 4: Custom service account roles

Caso canônico — criar role dedicado em vez de service_role API key:

```sql
-- 1. role para cron job (sem LOGIN — usado via pg_cron)
create role "cron_job_role" noinherit;
-- bypass RLS para acessar todas orgs
alter role "cron_job_role" with bypassrls;

-- 2. GRANTs específicos
grant usage on schema public to cron_job_role;
grant select, insert, delete on table public.audit_log to cron_job_role;

-- 3. pg_cron usa este role
select cron.schedule(
  'cleanup_old_logs',
  '0 3 * * *',
  $$ delete from public.audit_log where created_at < now() - interval '90 days' $$
);
-- pg_cron executa as queries com este role; auditabilidade superior vs service_role API key
```

```sql
-- role para BI tool (Metabase) — read-only com login
create role "metabase_reader" with login password 'percent-encode-this!';
alter role "metabase_reader" with bypassrls;  -- BI precisa ver todas linhas

grant usage on schema public to metabase_reader;
grant select on all tables in schema public to metabase_reader;
alter default privileges in schema public
  grant select on tables to metabase_reader;
```

## Changing postgres password

Mudar password do `postgres` role:

1. **Dashboard:** Database Settings page → "Database password" → enter new
2. **Sem downtime:** serviços internos (PostgREST, PgBouncer, etc.) auto-update
3. **External services com hardcoded credentials:** manual update necessário (revisar deploy configs)

**NÃO:** dar password do `postgres` role para third-party — crie role dedicado.

## Auditoria — pg_stat_statements por role

Cada role tem queries rastreáveis em `pg_stat_statements`:

```sql
select
  rolname,
  count(*) as query_count,
  sum(total_exec_time)::numeric(10,2) as total_time_ms
from pg_stat_statements s
join pg_roles r on s.userid = r.oid
where rolname not in ('postgres', 'authenticator')  -- filtrar admin
group by rolname
order by total_time_ms desc;
```

Identificar qual service account está consumindo mais — útil para debug + capacity planning.

## Anti-patterns

### Anti-pattern 1: Usar service_role API key para tudo

**Errado:**
```bash
# .env do cron job
SUPABASE_KEY=eyJ...service_role_key...
```

**Por quê:** sem auditabilidade — todas queries logam como `service_role`; difícil identificar qual script fez o quê.

**Certo:** criar role dedicado por service account:
```sql
create role "cron_billing_role" noinherit;
alter role "cron_billing_role" with bypassrls;
-- GRANTs específicos
-- pg_cron usa este role; queries logam com identidade clara
```

### Anti-pattern 2: Custom role para "admin vs user" application access

**Errado:**
```sql
-- criar role "admin" Postgres para gerenciar quem é admin no app
create role "app_admin";
-- ... add users to this role ...
```

**Por quê:** Postgres roles não são designed para application access — não dinâmico, não auditável, mistura system + application concerns.

**Certo:** use RLS + Custom Claims (skill `supabase-custom-claims-rbac` v1.25) — `user_role: 'admin'` no JWT via auth hook, consultado por `authorize()`.

### Anti-pattern 3: Password sem percent-encoding em URL

**Errado:**
```
postgresql://user:p=ssword@host/db
```

**Por quê:** `=` é parseado como query string separator — conexão falha.

**Certo:**
```
postgresql://user:p%3Dssword@host/db
```

### Anti-pattern 4: INHERIT em superuser-like role

**Errado:**
```sql
create role "dba_role" inherit;  -- inherit default em todos roles
grant postgres to dba_role;
-- dba_role agora tem postgres privileges implicitly
```

**Por quê:** sem audit trail explícito de quando privileges admin são usados.

**Certo:** NOINHERIT + SET ROLE explícito:
```sql
create role "dba_role" noinherit;
grant postgres to dba_role;
-- usuário precisa: set role postgres; ...; reset role;
-- queries logam com identidade postgres durante operação
```

### Anti-pattern 5: Criar role sem documentação

**Errado:**
```sql
create role "xyz" with login password 'pwd';
-- 6 meses depois, ninguém sabe pra que serve
```

**Por quê:** sem documentação, próximo dev assume é abandoned + remove ou mantém indefinidamente.

**Certo:** sempre comment no migration + entry em README:
```sql
-- role para Metabase BI conectar em produção (read-only)
-- Owner: data-team@company.com
-- Created: 2026-05-11 v1.26
create role "metabase_reader" with login password '<from-vault>';
comment on role "metabase_reader" is 'BI tool service account — read-only. Owner: data-team@company.com';
```

## Cross-suite integration (v1.26)

Esta skill é base para agent novo `supabase-roles-implementer` (Phase 145) — recebe spec via `Task()` e materializa CREATE ROLE + GRANT/REVOKE + hierarchy. Pattern de handoff cooperativo herdado de v1.23-v1.25.

Para column-level GRANTs específicos por role, **combine** com skill `supabase-column-level-security` (v1.24). Para custom claims que entregam `user_role` no JWT, use skill `supabase-custom-claims-rbac` (v1.25) — Postgres roles são para system access; custom claims são para application access.

## Ver também

- [supabase-roles-implementer](../../agents/supabase-roles-implementer.md) (v1.26) — canonical materializer
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) (v1.23) — section "Postgres Roles vs RLS — quando usar qual" (v1.26)
- [supabase-rls-defense-in-depth](../supabase-rls-defense-in-depth/SKILL.md) (v1.23) — Camada 10 (Postgres Roles Hierarchy) v1.26
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — GRANT EXECUTE patterns
- [supabase-column-level-security](../supabase-column-level-security/SKILL.md) (v1.24) — combinar com column-level GRANTs por role
- [supabase-custom-claims-rbac](../supabase-custom-claims-rbac/SKILL.md) (v1.25) — distinção canônica system access vs application access
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos Postgres roles, INHERIT/NOINHERIT, LOGIN PASSWORD, GRANT/REVOKE syntax, role hierarchy, predefined Supabase roles, role switching authenticator, percent-encoding password
- Doc oficial Postgres: [Database Roles](https://www.postgresql.org/docs/current/database-roles.html), [Role Membership](https://www.postgresql.org/docs/current/role-membership.html), [Function Permissions](https://www.postgresql.org/docs/current/perm-functions.html)
