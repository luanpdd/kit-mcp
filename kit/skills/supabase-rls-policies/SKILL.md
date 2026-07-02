---
name: supabase-rls-policies
cost_tier: leve
description: Gera RLS policies Supabase seguras — (select auth.uid()) wrapper, GRANT antes de ENABLE RLS, policies por operação, índice em colunas, IS NOT NULL anti-silent-fail, NUNCA user_metadata em
---

# Supabase — RLS Policies

## Quando usar

LLM carrega esta skill quando criar, auditar ou debugar Row Level Security em Supabase. Trigger phrases:

- "criar policy RLS", "RLS policy", "row level security"
- "policies separadas por operação"
- "auth.uid()", "auth.jwt()"
- "MFA enforcement", "AAL2"
- "auditar segurança de tabela Supabase"
- "GRANT antes de ENABLE RLS", "defense in depth", "security_invoker"
- "anon role vs anonymous user", "raw_app_meta_data vs raw_user_meta_data"

## Defense in depth — RLS como camada (v1.23)

RLS é um **Postgres primitive** que oferece **defense in depth**: protege dados mesmo quando acessados por third-party tooling (Metabase, dbt, ferramentas BI conectadas via JDBC). Mesmo se um vazamento de chave API ou bypass na camada de aplicação acontece, RLS impede acesso indevido **no banco**.

A regra mestre:

> **RLS *must* always be enabled on any tables stored in an exposed schema. By default, this is the `public` schema.**

Se você não tem RLS na camada do banco, você está confiando que **todo cliente** (front-end, backend, third-party, scripts, MCP tools) faça filtering corretamente. Isso é frágil.

**Princípio em v1.23 (handoff cooperativo):** todo SQL gerado pelo kit passa pelo `supabase-rls-hardener` antes do output final — drafts upstream são preservados, mas hardening RLS é obrigatório.

## Regras absolutas

**WARNING — REGRA #1 (segurança crítica):** **NUNCA** referencie `user_metadata` em policy de autorização. `user_metadata` é editável pelo cliente via `auth.updateUser({data: {...}})` — usuário pode auto-elevar `role: 'admin'` ou `plan: 'premium'`. Use **`app_metadata`** (set apenas via service_role) para roles/permissions. Splinter linter 0015 detecta automaticamente.

**REGRA #2 (performance crítica):** **SEMPRE** envolva `auth.uid()` em `(select auth.uid())`. Sem o wrapper, Postgres reavalia a função **uma vez por linha** — degrada queries com filtro RLS em **até 1000×**. Documentado nos benchmarks oficiais (`test2a-wrappedSQL-uid`: 179ms → 9ms, 94.97% improvement).

**REGRA #3 (anti silent-fail anônimo — v1.23):** Para policies que dependem de identidade autenticada, use **`auth.uid() IS NOT NULL AND auth.uid() = user_id`** ao invés de apenas `(select auth.uid()) = user_id`. Quando o usuário não está logado, `auth.uid()` retorna `null`, e `null = user_id` é **sempre false** silenciosamente — a policy "funciona" mas confunde debugging. O check explícito de `IS NOT NULL` deixa intent claro.

**Outras regras:**

- **`GRANT` antes de `ENABLE RLS`** (v1.23) — sempre conceda privilégios necessários aos roles `anon`/`authenticated`/`service_role` ANTES de habilitar RLS. Sem GRANT, mesmo policies "permissive" falham porque o role não tem permissão de tabela.
- **`policies separadas por operação`** — uma `for select`, uma `for insert`, uma `for update`, uma `for delete`. **Nunca** `for all` cobrindo CRUD inteiro.
- **`TO authenticated`** ou **`to anon`** sempre explícito — nunca deixar implícito (default `to public` é insecure; impede otimização do executor que skipa execução de policy para roles fora do TO clause).
- `for select` e `for delete` usam **apenas `using`** (sem `with check`).
- `for insert` usa **apenas `with check`** (sem `using`).
- `for update` usa **`using` + `with check`** (using para qual linha pode ser atualizada, with check para qual estado a linha pode assumir).
- Índice obrigatório nas colunas referenciadas pela policy: `create index on public.tasks (user_id);`. Sem index, scan full em cada query.
- `permissive` é default e preferido. `restrictive` é raro e exige justificativa explícita.
- Para MFA enforcement: `(auth.jwt()->>'aal')::text = 'aal2'` em policies que exigem 2FA ativo.
- **Views** com `security_invoker=true` (Postgres 15+) — por padrão views bypassam RLS (criadas como `security_definer` rodando como `postgres`). Ver seção "Views" abaixo.

## Setup canônico — GRANTs + ENABLE RLS (v1.23)

O setup completo para uma tabela em schema exposto é:

```sql
-- 1. GRANTs por role (faça ANTES de ENABLE RLS)
grant select on public.tasks to anon;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.tasks to service_role;

-- 2. Enable RLS
alter table public.tasks enable row level security;

-- 3. Policies granulares (sem isso, nada é acessível com publishable key)
create policy "users_select_own_tasks"
  on public.tasks for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- ... INSERT/UPDATE/DELETE policies análogos

-- 4. Índice obrigatório
create index tasks_user_id_idx on public.tasks (user_id);
```

**Por que GRANTs antes de ENABLE RLS:** RLS é uma camada de filtragem de linhas **adicionada** sobre as permissões de tabela. Sem `GRANT SELECT TO authenticated`, mesmo se a policy retorna true, a query falha com "permission denied". Os GRANTs estabelecem o que o role *pode tentar* fazer; RLS estabelece *quais linhas* ele vê.

**Roles canônicos Supabase:**

- `anon` — requisição sem autenticação (usuário deslogado)
- `authenticated` — requisição com JWT válido de Supabase Auth
- `service_role` — bypassa RLS (ver "Bypassing RLS" abaixo); use APENAS em backend/admin

## Auto-enable RLS para tabelas novas (v1.23)

Para evitar esquecimento humano, instale event trigger que ativa RLS automaticamente em `CREATE TABLE`:

```sql
create or replace function rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (system schema or not in enforced list)', cmd.object_identity;
     end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function rls_auto_enable();
```

**Caveats:**
- Aplica-se a tabelas criadas **após** o trigger ser instalado — existentes precisam de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` manual.
- Tabelas em `pg_catalog`, `information_schema`, `pg_toast*`, `pg_temp*` são skipped (sistema).
- Padrão completo + variações em [`supabase-rls-defense-in-depth`](../supabase-rls-defense-in-depth/SKILL.md) (v1.23).

## `anon` Postgres role vs anonymous Auth user (v1.23)

Confusão comum: **`anon` Postgres role** ≠ **anonymous user de Supabase Auth**.

- **`anon` Postgres role** — requisição sem JWT (usuário deslogado). É um Postgres role como qualquer outro; aparece em `TO anon` clauses.
- **anonymous user de Supabase Auth** — usuário criado via `supabase.auth.signInAnonymously()` (Auth feature). Tem JWT válido, assume o role `authenticated`, e pode ser diferenciado por checar a claim `is_anonymous` no JWT.

**Implicação em policies:**

```sql
-- visivel a qualquer cliente (anon Postgres ou authenticated com is_anonymous=true ou regular)
create policy "public_profiles_view"
  on public.profiles for select
  to authenticated, anon
  using (true);

-- bloqueia anonymous Auth users mesmo que estejam autenticados
create policy "premium_features_no_anonymous"
  on public.premium_data for select
  to authenticated
  using (
    (select auth.jwt()->>'is_anonymous')::boolean is not true
    and (select auth.uid()) = user_id
  );
```

## Patterns canônicos

### SELECT — usuário lê apenas suas próprias linhas

```sql
-- política de SELECT com wrapper (select auth.uid()) + IS NOT NULL anti silent-fail
create policy "users_select_own_tasks"
  on public.tasks
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

-- index obrigatório (sem isso, scan full)
create index tasks_user_id_idx on public.tasks (user_id);
```

### INSERT, UPDATE, DELETE separados

```sql
-- INSERT — usuário só pode criar linhas com user_id = ele mesmo
create policy "users_insert_own_tasks"
  on public.tasks
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

-- UPDATE — restringe quais linhas (using) E qual estado novo (with check)
-- IMPORTANTE: UPDATE também exige policy SELECT correspondente (sem ela, UPDATE não funciona)
create policy "users_update_own_tasks"
  on public.tasks
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  )
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

-- DELETE — apenas a coluna using (sem with check)
create policy "users_delete_own_tasks"
  on public.tasks
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );
```

### Role admin via `app_metadata`

```sql
-- segurança: app_metadata é set apenas via service_role (admin API)
-- cliente NÃO pode mutá-lo
create policy "admins_manage_all_tasks"
  on public.tasks
  for update
  to authenticated
  using (
    (select auth.jwt()->'app_metadata'->>'role') = 'admin'
  )
  with check (
    (select auth.jwt()->'app_metadata'->>'role') = 'admin'
  );
```

### Team membership via `app_metadata` (array)

```sql
-- exemplo: app_metadata.teams = ["team_a", "team_b"]
create policy "team_members_view"
  on public.team_resources
  for select
  to authenticated
  using (
    team_id::text in (select jsonb_array_elements_text((select auth.jwt()->'app_metadata'->'teams')))
  );
```

### MFA enforcement (AAL2)

```sql
-- exigir 2FA ativo para acessar dados sensíveis
-- restrictive force AND com policy SELECT base
create policy "mfa_required_for_billing"
  on public.billing_records
  as restrictive
  for select
  to authenticated
  using (
    (select (auth.jwt()->>'aal')::text) = 'aal2'
  );
```

### Views com `security_invoker=true` (Postgres 15+) — v1.23

Por padrão, views são criadas com `security_definer` (rodam com permissões do criador, geralmente `postgres`) — **bypassam RLS** das tabelas subjacentes. Em Postgres 15+, use `security_invoker=true` para fazer a view respeitar as policies RLS do role chamador:

```sql
create view public.user_active_tasks
with (security_invoker = true)
as
select id, title, status, created_at
from public.tasks
where status = 'active';
```

**Em versões < Postgres 15:** revoke acesso de `anon`/`authenticated` à view, ou crie em schema não-exposto:

```sql
-- alternativa pré-Postgres 15: revoke acesso
revoke select on public.legacy_view from anon, authenticated;

-- ou crie em schema privado:
create view private.internal_view as ...;
```

## `app_metadata` vs `user_metadata` — caveats canônicos (v1.23)

A função `auth.jwt()` retorna o JWT do usuário fazendo a requisição. Existem duas claims relacionadas a metadata:

- **`raw_user_meta_data`** — pode ser atualizado pelo authenticated end-user via `supabase.auth.updateUser({ data: { ... } })`. **NÃO é seguro para authorization.** Use apenas para preferences (tema, idioma, avatar URL).
- **`raw_app_meta_data`** — **NÃO pode ser atualizado pelo cliente** — só via service_role + admin API. **É o lugar correto** para roles, permissions, team memberships, plan tier.

**Caveat #1 (JWT freshness):** JWT nem sempre está "fresh". Se você remove um user de um team e atualiza `app_metadata`, isso não reflete em `auth.jwt()` até o JWT ser refreshed (geralmente 1h TTL). Para invalidação imediata, force logout do user via `auth.admin.signOut()`.

**Caveat #2 (cookie 4096 bytes):** Se você usa Cookies para Auth, esteja atento ao JWT size. Browsers limitam cada cookie a 4096 bytes. Se você embarca arrays grandes em `app_metadata.teams` ou similar, o JWT pode passar do limite. Mitigação: store apenas IDs, busque membership via SQL com policy/RPC.

**Caveat #3 (NULL handling):** Para requests sem auth, `auth.uid()` retorna `null`. `null = user_id` é sempre **false silenciosamente** em SQL — a policy não erra, só não match. Sempre use `IS NOT NULL AND ...` (REGRA #3) para deixar intent claro.

## Performance — recomendações canônicas (v1.23)

Toda authorization tem custo. RLS é poderoso mas pode ser caro em queries que scaneam muitas linhas. Recomendações baseadas em benchmarks oficiais Supabase:

### 1. Index nas colunas usadas em policies (99.94% improvement)

```sql
-- antes: scan full
-- depois: index scan
create index tasks_user_id_idx on public.tasks (user_id);
```

### 2. Envolva funções em `(select ...)` para caching de plano (até 99.99% improvement)

```sql
-- antes: re-executa auth.uid() por linha (179ms para 100k rows)
using (auth.uid() = user_id)

-- depois: initPlan, executa 1 vez e reusa (9ms)
using ((select auth.uid()) = user_id)
```

Aplicável a qualquer função que não muda baseado em row data: `auth.uid()`, `auth.jwt()`, `security definer` functions. **Não funciona** se o resultado depende da linha (ex: `is_owner(row_id)` precisa rodar por linha).

### 3. Adicione filtros redundantes nas queries client-side (94.74% improvement)

Mesmo com policy aplicada, adicione `.eq()` ou `where` explícito no client:

```js
// errado — confia 100% na policy
const { data } = supabase.from('tasks').select()

// certo — Postgres usa o filtro para construir query plan melhor
const { data } = supabase.from('tasks').select().eq('user_id', userId)
```

Policy é "implicit where clause"; filtro explícito ajuda o planner Postgres a escolher index scan ao invés de seq scan.

### 4. Specify role com `TO` clause (99.78% improvement)

```sql
-- antes (sem TO): policy roda para todos roles, inclusive anon
create policy "rls_test_select" on rls_test
using ((select auth.uid()) = user_id);

-- depois: anon skipa execução
create policy "rls_test_select" on rls_test
to authenticated
using ((select auth.uid()) = user_id);
```

### 5. Use `security definer` functions para policies caras

Se a policy precisa fazer JOIN ou query custosa, encapsule em função `security definer` que bypassa RLS interno:

```sql
-- função pode acessar roles_table sem aplicar RLS recursivamente
create function private.has_good_role()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.roles_table
    where (select auth.uid()) = user_id and role = 'good_role'
  );
end;
$$;

-- policy fica simples e cacheável
create policy "rls_test_select"
on public.test_table
to authenticated
using ((select private.has_good_role()));
```

**IMPORTANTE:** funções `security definer` NUNCA em schema exposto (`public`). Sempre em `private` ou similar (não exposto via API settings).

### 6. Minimize joins (99.78% improvement)

Reescreva policies que fazem join na source table para usar `IN` ao invés:

```sql
-- antes: join entre test_table (source) e team_user (target)
create policy "rls_test_select" on public.test_table
to authenticated
using (
  (select auth.uid()) in (
    select user_id
    from public.team_user
    where team_user.team_id = team_id  -- join com source!
  )
);

-- depois: filtra primeiro, depois IN
create policy "rls_test_select" on public.test_table
to authenticated
using (
  team_id in (
    select team_id
    from public.team_user
    where user_id = (select auth.uid())  -- sem join
  )
);
```

Se a lista interna pode passar de 1000 items, considere abordagem com `security definer` function ao invés.

## Anti-patterns

### Anti-pattern 1: `auth.uid()` sem `(select)` wrapper

**Errado:**
```sql
create policy "users_select_own_tasks"
  on public.tasks
  for select
  to authenticated
  using (auth.uid() = user_id);            -- sem (select) — re-executa por linha
```

**Por quê:** Postgres reavalia `auth.uid()` para cada linha sendo testada. Em tabela com 100k linhas, isso é 100k chamadas. O `(select)` permite Postgres executar **uma vez** e reusar — degradação de até **1000×** sem o wrapper. Documentado em [RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv).

**Certo:**
```sql
using ((select auth.uid()) = user_id)
```

### Anti-pattern 2: `WARNING user_metadata` em autorização — privilege escalation

**Errado:**
```sql
create policy "admins_manage_all"
  on public.tasks
  for update
  to authenticated
  using (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'   -- editável pelo cliente!
  );
```

**Por quê:** o cliente pode chamar `supabase.auth.updateUser({ data: { role: 'admin' } })` e instantaneamente ganhar privilégios de admin. `user_metadata` é projetado para preferences do usuário (tema, idioma), não para autorização. Documentado em [Splinter linter 0015](https://supabase.github.io/splinter/0015_rls_references_user_metadata/).

**Certo:** ver "Role admin via `app_metadata`" acima — `app_metadata` requer service_role para mutar.

### Anti-pattern 3: `for all` em vez de policies granulares

**Errado:**
```sql
create policy "users_manage_own_tasks"
  on public.tasks
  for all                                  -- cobre CRUD inteiro com mesma regra
  to authenticated
  using ((select auth.uid()) = user_id);
```

**Por quê:** semântica de `for all` mistura `using` (que controla SELECT/UPDATE/DELETE) com `with check` (que controla INSERT/UPDATE), levando a confusão. Em UPDATE você pode querer regras diferentes para "qual linha tocar" vs "qual estado novo". Granularidade explícita previne erros sutis.

**Certo:** ver pattern com 4 policies separadas acima (SELECT, INSERT, UPDATE, DELETE).

### Anti-pattern 4: Sem índice nas colunas da policy

**Errado:**
```sql
-- policy referencia user_id mas não há index
create policy "users_select_own_tasks" on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- (esqueceu) create index on public.tasks (user_id);
```

**Por quê:** cada query com filtro RLS força sequential scan. Em produção com 100k+ linhas, isso é lentidão crônica.

**Certo:**
```sql
create index tasks_user_id_idx on public.tasks (user_id);
```

### Anti-pattern 5: ENABLE RLS sem GRANT — query falha silenciosa (v1.23)

**Errado:**
```sql
alter table public.tasks enable row level security;
-- esqueceu de grant select on public.tasks to authenticated;
create policy "users_select" ... using (...);
```

**Por quê:** RLS é camada *sobre* permissões de tabela. Sem GRANT, role não pode tentar acessar a tabela — query retorna "permission denied" mesmo se policy permitiria.

**Certo:** sempre GRANT primeiro, depois ENABLE RLS, depois policies (ver "Setup canônico" acima).

### Anti-pattern 6: View sem `security_invoker=true` em Postgres 15+ — bypass de RLS (v1.23)

**Errado:**
```sql
-- view criada como postgres user — bypassa RLS de public.tasks
create view public.user_tasks_view as
select id, title from public.tasks where user_id = auth.uid();
```

**Por quê:** views por default são `security_definer` (rodam com permissões do criador). Cliente acessando a view bypass RLS das tabelas underlying. Atacante consegue ler dados de outros users via SELECT na view.

**Certo:**
```sql
create view public.user_tasks_view
with (security_invoker = true)
as
select id, title from public.tasks
where user_id = (select auth.uid());
```

### Anti-pattern 7: `null = user_id` silent-fail (v1.23)

**Errado:**
```sql
using ((select auth.uid()) = user_id)
-- se user não logado, auth.uid() é null
-- null = user_id é always false → policy "funciona" mas confunde
```

**Por quê:** intent ambíguo — você queria bloquear não-logados ou tratar como caso especial? `null = X` retornar false silenciosamente esconde o intent e dificulta debug.

**Certo:**
```sql
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
```

## Postgres Roles vs RLS — quando usar qual (v1.26)

Postgres roles e RLS são **conceitos complementares**:

| | Postgres Roles | RLS |
|---|---|---|
| Escopo | System access (service accounts, cron, BI) | Application access (end-users) |
| Identidade | Login Postgres (`SET ROLE`) | JWT (`auth.uid()`) |
| Granularidade | Per schema/table/function | Per linha + coluna |
| Audit | pg_stat_statements por role | RLS denial logs |
| Use case | "Cron job pode SELECT em todas tabs" | "User vê apenas próprias rows" |

**Princípio canônico v1.26:**

- **Para end-users:** RLS + Custom Claims (v1.25) — NÃO criar role Postgres por user
- **Para service accounts:** Postgres roles dedicados (NÃO usar service_role API key sempre)
- **Para column-level access:** Postgres roles + column-level GRANTs (skill `supabase-column-level-security` v1.24)

Padrão completo de Postgres roles em [`supabase-postgres-roles`](../supabase-postgres-roles/SKILL.md) (v1.26).

## RBAC via Custom Claims + authorize() function (v1.25)

A partir de v1.25, o pattern **canônico** de RBAC em Supabase é via **Custom Access Token Auth Hook** que injeta `user_role` no JWT durante geração do token. Em vez de policies fazendo JOIN custoso em `user_roles` table, a policy lê o claim direto via `auth.jwt() ->> 'user_role'` (ou via `authorize()` function que abstrai role → permission lookup).

```sql
-- Pattern v1.25 — RLS policy usando authorize() (claim do JWT consultado)
create policy "Allow authorized delete access" on public.channels for delete
to authenticated
using ((SELECT authorize('channels.delete')));

-- vs. pattern v1.21 — RLS policy usando helper function STABLE (JOIN em DB)
create policy "Allow admin delete" on public.channels for delete
to authenticated
using ((SELECT private.has_role('admin')));
```

**Vantagens canônicas do pattern v1.25:**

- **Performance:** claim no JWT é zero-JOIN; helper function STABLE faz query em user_roles table
- **Composability:** `authorize(permission)` abstrai role → permission; trocar quem tem permission = UPDATE em role_permissions (sem alterar policies)
- **Type safety:** `app_permission` enum garante consistência cross-policy

**Caveat JWT freshness:** mudanças em `user_roles` só refletem no JWT após refresh (TTL 1h). Para revogação imediata, force logout via `auth.admin.signOut(userId)`. Em multi-tenant complexo (role por org), **combine** custom claim (role global) + helper function PG (role context-aware) — claim sozinho não cobre per-org context.

Padrão completo (7 passos + anti-patterns + caveats) em [`supabase-custom-claims-rbac`](../supabase-custom-claims-rbac/SKILL.md) (v1.25).

## Combining RLS with Column-Level Privileges (v1.24)

RLS row-level e column-level privileges são **camadas complementares**:

- **RLS** filtra **quais linhas** o role vê/modifica
- **Column privileges** filtra **quais colunas** o role pode acessar dentro da linha

Combinação canônica: RLS + column-level (Camada 8 de defense-in-depth, skill `supabase-rls-defense-in-depth` v1.24).

```sql
-- 1. RLS row-level — user só vê próprias posts
create policy "users_select_own_posts"
  on public.posts for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- 2. Column-level — mesmo nas próprias posts, user não vê coluna sensível (ex: admin_notes)
revoke select on table public.posts from authenticated;
grant select (id, user_id, title, content, created_at) on table public.posts to authenticated;

-- 3. service_role / admin_role vê tudo (incluindo admin_notes)
grant select on table public.posts to service_role;

-- Cliente DEVE listar colunas explicitamente:
-- ❌ supabase.from('posts').select()       — FALHA (wildcard expansion → admin_notes)
-- ✅ supabase.from('posts').select('id, user_id, title, content, created_at')
```

**Quando combinar:**

- Compliance LGPD/GDPR onde algumas colunas (PII) precisam restrição extra além do RLS
- Audit log com payload sanitizado — RLS filtra por org, column priv filtra payload
- Billing data — RLS filtra por owner, column priv filtra credit_card_token

**Quando NÃO combinar:**

- Caso comum (admin/user roles) — use dedicated role table (skill [`supabase-column-level-security`](../supabase-column-level-security/SKILL.md)) ao invés
- Tabelas sem PII real — overhead sem benefício

**Caveat crítico:** com column privileges, **todo SELECT deve listar colunas explicitamente** — `SELECT *` falha. Atualize SDK calls + queries SQL ad-hoc + ferramentas BI conectadas.

Padrão completo + 4 patterns canônicos em [`supabase-column-level-security`](../supabase-column-level-security/SKILL.md) (v1.24).

## Bypassing RLS — quando e como

3 mecanismos canônicos para bypass de RLS:

1. **`service_role`** — chave Supabase com bypass automático. **NUNCA** exponha ao cliente. Use APENAS em backend (Edge Functions com env var `SUPABASE_SERVICE_ROLE_KEY`, scripts admin, migrations). Caveat: ao chamar SDK Supabase com service_role mas com `Authorization: Bearer <user_jwt>` ainda set, RLS do user é aplicado (override).
2. **`alter role <name> with bypassrls`** — privilégio Postgres que permite role bypass RLS sempre. Use para roles internos (`postgres`, custom admin role). NUNCA conceda a um role que recebe requisições de cliente.
3. **`security definer` functions** — função roda com permissões do criador (geralmente `postgres` = bypassrls). Encapsule lógica admin/cross-tenant em função `security definer` no schema `private`.

Padrões avançados em [`supabase-rls-defense-in-depth`](../supabase-rls-defense-in-depth/SKILL.md) (v1.23).

## Ver também

- [supabase-rls-defense-in-depth](../supabase-rls-defense-in-depth/SKILL.md) — event trigger, BYPASSRLS, service_role caveat, security definer, views security_invoker (v1.23)
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — funções com `set search_path = ''` que respeitam RLS
- [supabase-storage](../supabase-storage/SKILL.md) — RLS sobre `storage.objects` (multi-tenant path isolation)
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — autenticação que popula `auth.uid()`
- [supabase-migrations](../supabase-migrations/SKILL.md) — migrations sempre com GRANT + RLS habilitado em novas tabelas
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN + roles + comandos CLI
