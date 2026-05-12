---
name: supabase-column-level-security
description: Use ao implementar Column-Level Security (CLS) em Supabase — complementa RLS com privilégios granulares por coluna via GRANT/REVOKE (col1, col2) ON TABLE. Feature AVANÇADA…
---

# Supabase — Column Level Security

## ⚠ Quando usar (e quando NÃO usar)

**Column-Level Security é feature AVANÇADA.** Para a maioria dos casos de controle de acesso, **NÃO** recomendamos column-level privileges. Prefira:

1. **RLS policies row-level** (skill [`supabase-rls-policies`](../supabase-rls-policies/SKILL.md)) — primeira linha de defesa
2. **Dedicated role table** — tabela `user_roles` com `is_admin`, `can_edit_billing`, etc.; RLS consulta esta tabela em policies; permite mudança dinâmica de roles sem reescrever GRANT/REVOKE

**Use column-level privileges APENAS quando:**

- **Compliance LGPD/GDPR** exige restrição granular por coluna (PII columns como SSN, CPF, salary)
- **Audit log sanitization** — coluna `payload` da audit_log deve ser legível só por security_admin
- **Billing data restrito** — `credit_card_token`, `bank_account` lisíveis apenas pelo billing_admin role
- **Token raw em tabelas** — `org_invites.token_raw` (apenas service_role) — depois TTL, hash apenas

**NÃO use para:**

- Hide/show colunas por user role normal (use view + RLS ao invés)
- Filtrar dados por linha (isso é RLS, não CLS)
- "Esconder" colunas no UI (cliente sempre vê o schema; CLS apenas restringe acesso runtime)

Trigger phrases:

- "column-level privileges", "column privileges Postgres"
- "GRANT (col) ON TABLE", "REVOKE (col) FROM role"
- "PII column restriction"
- "audit log payload column protected"

## Princípio canônico

Postgres tem **dois níveis** de privileges:

1. **Table-level (`GRANT/REVOKE ON TABLE`)** — default, aplica a todas colunas
2. **Column-level (`GRANT/REVOKE (col1, col2) ON TABLE`)** — granular por coluna; **subset** do table-level

**Hierarquia:** se você tem table-level `UPDATE` + column-level `UPDATE (title)` simultaneamente, o table-level **prevalece** (mais permissivo vence). Para restringir, você precisa **REVOKE table-level primeiro**, depois **GRANT column-level apenas nas colunas permitidas**.

```sql
-- ANTES: authenticated tem table-level UPDATE (default)
-- pode UPDATE todas colunas

-- PASSO 1: REVOKE table-level (perde acesso a TODAS colunas)
revoke update on table public.posts from authenticated;

-- PASSO 2: GRANT column-level apenas em title + content
grant update (title, content) on table public.posts to authenticated;

-- AGORA: authenticated só pode UPDATE title + content
-- tentativa de UPDATE em user_id, created_at, etc. falha com "permission denied for column"
```

## ⚠ Caveat #1 — Wildcard `*` restriction

**Restricted roles NÃO podem usar `SELECT *`.** Se uma role tem column-level privilege em **apenas algumas colunas** (não todas), `SELECT * FROM <table>` falha com:

```
ERROR: permission denied for column <restricted_col>
```

**Implicação prática:**

```sql
-- restrict authenticated role a apenas alguns SELECTs
revoke select on table public.posts from authenticated;
grant select (id, title, content) on table public.posts to authenticated;

-- depois disso:
-- ❌ select * from posts;  -- FALHA (tenta acessar created_at, user_id, etc.)
-- ✅ select id, title, content from posts;  -- OK
```

**Aplicação em SDK Supabase:**

```js
// errado — usa wildcard implícito quando você omite columns
const { data } = supabase.from('posts').select()  // SELECT * by default

// certo — sempre liste colunas explicitamente em tabelas com column-level
const { data } = supabase.from('posts').select('id, title, content')
```

**Defensive practice:** em tabelas com qualquer column-level privilege, **NUNCA** use `.select()` sem argumento. Sempre `.select('col1, col2, col3')`.

## ⚠ Caveat #2 — Impacto cross-operation

Quando você restringe uma coluna, **todas as operações** que tocam essa coluna falham:

- **SELECT** — `SELECT col_restricted` falha; `SELECT *` também falha (wildcard)
- **INSERT** — `INSERT (col_restricted) VALUES (...)` falha se role não tem `INSERT (col_restricted)`
- **UPDATE** — `UPDATE SET col_restricted = ...` falha
- **DELETE** — opera no nível de linha, NÃO afetado por column privileges (DELETE bypassa column check)

**Exemplo concreto:**

```sql
revoke update (price) on table public.products from authenticated;

-- depois disso:
-- ❌ update products set price = 100 where id = 1;  -- FALHA
-- ❌ update products set title = 'x', price = 100;  -- FALHA (price restringido)
-- ✅ update products set title = 'x';                -- OK (não toca price)
-- ✅ delete from products where price > 50;         -- OK (DELETE ignora column priv)
-- ❌ select * from products;                         -- FALHA se SELECT (price) revoked tb
```

**Implicação para INSERT:** mesmo em INSERT, role precisa ter privilege em **todas as colunas que vão receber valor** (incluindo defaults explícitos).

## Patterns canônicos

### Pattern 1 — Restringir UPDATE em colunas específicas

```sql
-- caso: post.title e post.content podem ser editados pelo owner
-- mas user_id e created_at NÃO podem ser mudados

-- 1. REVOKE table-level UPDATE
revoke update on table public.posts from authenticated;

-- 2. GRANT column-level UPDATE apenas onde é seguro
grant update (title, content, updated_at) on table public.posts to authenticated;

-- 3. RLS row-level garante que só o owner pode editar (combinação canônica)
create policy "users_update_own_posts"
  on public.posts for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  )
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );
```

### Pattern 2 — Restringir SELECT em PII columns

```sql
-- caso: tabela users tem ssn (sensitive) — visível APENAS para security_admin role

-- 1. criar role específico (skill `supabase-rls-defense-in-depth` Camada 2)
create role security_admin with login password '<strong>';

-- 2. REVOKE table-level SELECT de roles padrão
revoke select on table public.users from anon, authenticated;

-- 3. GRANT column-level SELECT apenas em colunas não-sensíveis para authenticated
grant select (id, email, display_name, created_at) on table public.users to authenticated;

-- 4. GRANT table-level SELECT (acesso total) APENAS para security_admin
grant select on table public.users to security_admin;

-- 5. RLS row-level continua aplicada (ex: user vê apenas próprio registro)
create policy "users_select_own" on public.users for select to authenticated
  using ((select auth.uid()) = id);

-- IMPORTANTE: cliente precisa usar select('id, email, display_name, created_at') — não select(*)
```

### Pattern 3 — Audit log com payload protegido

```sql
-- caso: audit_log tem payload jsonb com PII; só security_admin vê payload completo

revoke select on table public.audit_log from authenticated;

grant select (id, event_type, user_id, org_id, occurred_at) on table public.audit_log to authenticated;

grant select on table public.audit_log to security_admin;  -- payload visível só aqui

-- bonus: combine com RLS row-level (user vê só audit_log da própria org)
create policy "audit_log_select_own_org" on public.audit_log for select to authenticated
  using (
    org_id::text = any(
      select jsonb_array_elements_text((select auth.jwt()->'app_metadata'->'orgs'))
    )
  );
```

### Pattern 4 — Token raw em invites (apenas service_role)

```sql
-- caso: org_invites.token_raw é gerado durante create, hash armazenado, raw enviado por email
-- depois, nenhum role além de service_role deve poder ler o raw (cross-ref invite-flow-implementer)

revoke select on table public.org_invites from anon, authenticated;

-- nem authenticated nem anon podem ver token_raw
grant select (id, org_id, email, status, expires_at, created_at) on table public.org_invites to authenticated;

-- service_role vê tudo (incluindo token_raw) — usado durante envio de email
grant select on table public.org_invites to service_role;
```

## Dedicated role table pattern (RECOMENDADO pela doc oficial)

Em vez de column-level privileges complexos, prefira a abordagem canônica:

```sql
-- 1. tabela de roles
create table public.user_roles (
  user_id uuid primary key references auth.users (id),
  is_admin boolean default false,
  can_view_pii boolean default false,
  can_edit_billing boolean default false
);

-- 2. RLS na tabela de roles (só service_role pode mutar)
alter table public.user_roles enable row level security;
create policy "users_view_own_role" on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

-- 3. helper function
create or replace function public.can_view_pii()
returns boolean
language sql
stable
as $$
  select coalesce(
    (select can_view_pii from public.user_roles where user_id = (select auth.uid())),
    false
  );
$$;

-- 4. usar em RLS policies (sem column-level)
create policy "select_users_with_pii" on public.users for select to authenticated
  using (public.can_view_pii());
```

**Vantagens vs column-level:**

- **Dinâmico:** roles mudam via UPDATE simples (`update user_roles set can_view_pii = true where user_id = ...`); column-level exige REVOKE/GRANT
- **Auditável:** mudanças em user_roles ficam em audit_log; mudanças em GRANT são silent
- **Sem caveat de wildcard:** `select *` funciona; column-level força listar colunas
- **Composable:** combinar múltiplos predicados em policy é mais expressivo que multi-column GRANT
- **Self-service:** users podem ver próprio role; column privileges não tem auto-discovery

**Quando column-level continua melhor:**

- Defesa em profundidade adicional (camada extra além de RLS) — Camada 8 de defense-in-depth (skill [`supabase-rls-defense-in-depth`](../supabase-rls-defense-in-depth/SKILL.md))
- Compliance exige restrição **no banco** (não apenas na app) — ex: LGPD audit
- Third-party tooling acessa banco direto (Metabase, dbt) — column-level protege mesmo sem app

## Studio Dashboard (Supabase UI)

A UI de column-level privileges fica em **Feature Preview** no dashboard Supabase (intencionalmente escondida — recomendação implícita de não usar):

```
Dashboard → Database → Column Privileges
(Feature Preview)
```

**Caveat:** Studio UI permite mudanças mas **não versiona** — mudanças via UI não geram migration automática. Para projetos sérios, gerencie via migrations (`supabase migration new`) — ver pattern em skill [`supabase-migrations`](../supabase-migrations/SKILL.md) BLOCO 6 (v1.24).

## Manage column privileges in migrations

Pattern canônico para uma migration completa com column-level:

```sql
/*
  Migration: create_posts_with_column_privileges
  Created: 2026-05-11
  Purpose: Create posts table with row-level + column-level security
  Affects: public.posts (new), policies (new), column privileges (new)
*/

-- BLOCO 1: CREATE TABLE
create table public.posts (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users (id),
  title text,
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- BLOCO 2: GRANTs table-level (default)
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.posts to service_role;

-- BLOCO 3: ENABLE RLS
alter table public.posts enable row level security;

-- BLOCO 4: RLS policies row-level
create policy "users_update_own_posts" on public.posts for update
  to authenticated
  using ((select auth.uid()) = user_id);

-- BLOCO 5: Index
create index posts_user_id_idx on public.posts (user_id);

-- BLOCO 6 (v1.24): Column-Level Privileges (OPCIONAL — apenas se PII)
-- REVOKE table-level UPDATE de authenticated (perde acesso a TODAS colunas)
revoke update on table public.posts from authenticated;

-- GRANT column-level UPDATE apenas em title + content
grant update (title, content, updated_at) on table public.posts to authenticated;

-- service_role mantém acesso total (não precisa GRANT extra — já tem)
```

## Auditoria — detectar tabelas com PII sem column privileges

```sql
-- listar tabelas com colunas potencialmente sensíveis sem column-level GRANT/REVOKE
select
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and (
    c.column_name ilike '%email%'
    or c.column_name ilike '%phone%'
    or c.column_name ilike '%ssn%'
    or c.column_name ilike '%cpf%'
    or c.column_name ilike '%token%'
    or c.column_name ilike '%password%'
    or c.column_name ilike '%credit_card%'
    or c.column_name ilike '%bank_account%'
    or c.column_name ilike '%salary%'
  )
  and not exists (
    -- check se há column_privilege específico para esta coluna
    select 1
    from information_schema.column_privileges p
    where p.table_schema = c.table_schema
      and p.table_name = c.table_name
      and p.column_name = c.column_name
  )
order by c.table_schema, c.table_name, c.column_name;
```

Cross-ref auditoria sistemática em agent [`supabase-rls-hardener`](../../agents/supabase-rls-hardener.md) Detector 8 (v1.24).

## Anti-patterns

### Anti-pattern 1 — Column-level sem revoke table-level prévio

**Errado:**
```sql
-- column-level GRANT sem revoke table-level
grant update (title) on table public.posts to authenticated;
-- authenticated AINDA pode update todas colunas (table-level vence)
```

**Por quê:** Postgres aplica privilege mais permissivo — column-level GRANT sem REVOKE table-level prévio é no-op.

**Certo:**
```sql
revoke update on table public.posts from authenticated;
grant update (title) on table public.posts to authenticated;
```

### Anti-pattern 2 — Esperar que `SELECT *` funcione com column-level

**Errado:**
```sql
revoke select (sensitive_col) on table public.users from authenticated;
-- esperar que select * automaticamente skipe sensitive_col — NÃO FUNCIONA
```

```js
const { data } = supabase.from('users').select()  // SELECT * — FALHA
```

**Por quê:** Postgres aplica permission check à query inteira. `SELECT *` é `SELECT col1, col2, ..., sensitive_col` expandido — falha se qualquer coluna sem permission.

**Certo:** sempre listar colunas explicitamente:
```js
const { data } = supabase.from('users').select('id, email, display_name')
```

### Anti-pattern 3 — Column-level em vez de dedicated role table

**Errado (para caso "admin vê PII"):**
```sql
revoke select (ssn, salary) on table public.employees from authenticated;
-- agora você precisa criar role separado, granular GRANT a cada admin, etc.
```

**Por quê:** muda admin = REVOKE/GRANT manual; sem audit trail; sem self-discovery.

**Certo:** dedicated role table + RLS function — ver section "Dedicated role table pattern (RECOMENDADO)" acima.

### Anti-pattern 4 — Column-level em INSERT esquecendo DEFAULTs

**Errado:**
```sql
revoke insert on table public.audit_log from authenticated;
grant insert (event_type, payload) on table public.audit_log to authenticated;

-- código tenta:
insert into audit_log (event_type, payload) values ('login', '{}');
-- FALHA porque user_id (PK default gen_random_uuid) também precisa de GRANT
```

**Certo:** lista TODAS colunas que recebem valor (incluindo defaults gerados):
```sql
grant insert (event_type, payload, user_id, occurred_at) on table public.audit_log to authenticated;
```

Ou prefira que cliente não faça INSERT direto — use RPC function `SECURITY DEFINER` que tem privilege total.

## Cross-suite integration (v1.24)

Esta skill é base para o agent novo `supabase-column-privileges-writer` (Phase 133) — recebe spec de table + colunas sensíveis via `Task()` e produz REVOKE/GRANT column-level SQL preservando intent upstream.

Princípio canônico v1.23 (herdado): agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Para column-level, o agent canonical é `supabase-column-privileges-writer`.

## Ver também

- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) (v1.23) — RLS row-level (primeira camada de defesa)
- [supabase-rls-defense-in-depth](../supabase-rls-defense-in-depth/SKILL.md) (v1.23) — column-level é Camada 8 de defesa em profundidade (v1.24)
- [supabase-migrations](../supabase-migrations/SKILL.md) (v1.24) — BLOCO 6 opcional com column-level no template canônico
- [supabase-column-privileges-writer](../../agents/supabase-column-privileges-writer.md) (v1.24) — agent canonical materializador
- [supabase-rls-hardener](../../agents/supabase-rls-hardener.md) (v1.23) — Detector 8 valida column-level em tabelas com PII (v1.24)
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos column-level privileges, table-level privileges, wildcard restriction, dedicated role table pattern
