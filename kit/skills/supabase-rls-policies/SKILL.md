---
name: supabase-rls-policies
description: Use ao criar/auditar RLS — sempre (select auth.uid()), policies separadas por operação, índices nas colunas, NUNCA user_metadata em autorização.
---

# Supabase — RLS Policies

## Quando usar

LLM carrega esta skill quando criar, auditar ou debugar Row Level Security em Supabase. Trigger phrases:

- "criar policy RLS", "RLS policy", "row level security"
- "policies separadas por operação"
- "auth.uid()", "auth.jwt()"
- "MFA enforcement", "AAL2"
- "auditar segurança de tabela Supabase"

## Regras absolutas

**WARNING — REGRA #1 (segurança crítica):** **NUNCA** referencie `user_metadata` em policy de autorização. `user_metadata` é editável pelo cliente via `auth.updateUser({data: {...}})` — usuário pode auto-elevar `role: 'admin'` ou `plan: 'premium'`. Use **`app_metadata`** (set apenas via service_role) para roles/permissions.

**REGRA #2 (performance crítica):** **SEMPRE** envolva `auth.uid()` em `(select auth.uid())`. Sem o wrapper, Postgres reavalia a função **uma vez por linha** — degrada queries com filtro RLS em **até 1000×**.

**Outras regras:**

- **`policies separadas por operação`** — uma `for select`, uma `for insert`, uma `for update`, uma `for delete`. **Nunca** `for all` cobrindo CRUD inteiro.
- **`TO authenticated`** ou **`to anon`** sempre explícito — nunca deixar implícito (default `to public` é insecure).
- `for select` e `for delete` usam **apenas `using`** (sem `with check`).
- `for insert` usa **apenas `with check`** (sem `using`).
- `for update` usa **`using` + `with check`** (using para qual linha pode ser atualizada, with check para qual estado a linha pode assumir).
- Índice obrigatório nas colunas referenciadas pela policy: `create index on public.tasks (user_id);`. Sem index, scan full em cada query.
- `permissive` é default e preferido. `restrictive` é raro e exige justificativa explícita.
- Para MFA enforcement: `(auth.jwt()->>'aal')::text = 'aal2'` em policies que exigem 2FA ativo.

## Patterns canônicos

### SELECT — usuário lê apenas suas próprias linhas

```sql
-- política de SELECT com wrapper (select auth.uid()) obrigatório
create policy "users_select_own_tasks"
  on public.tasks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

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
  with check ((select auth.uid()) = user_id);

-- UPDATE — restringe quais linhas (using) E qual estado novo (with check)
create policy "users_update_own_tasks"
  on public.tasks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- DELETE — apenas a coluna using (sem with check)
create policy "users_delete_own_tasks"
  on public.tasks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
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

### MFA enforcement (AAL2)

```sql
-- exigir 2FA ativo para acessar dados sensíveis
create policy "mfa_required_for_billing"
  on public.billing_records
  for select
  to authenticated
  using (
    (select (auth.jwt()->>'aal')::text) = 'aal2'
    and (select auth.uid()) = user_id
  );
```

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

## Ver também

- [supabase-database-functions](../supabase-database-functions/SKILL.md) — funções com `set search_path = ''` que respeitam RLS
- [supabase-storage](../supabase-storage/SKILL.md) — RLS sobre `storage.objects` (multi-tenant path isolation)
- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — autenticação que popula `auth.uid()`
- [supabase-migrations](../supabase-migrations/SKILL.md) — migrations sempre com RLS habilitado em novas tabelas
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN + roles + comandos CLI
