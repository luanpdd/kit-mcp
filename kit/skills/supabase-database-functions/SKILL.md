---
name: supabase-database-functions
description: Use ao criar funções Postgres — SECURITY INVOKER por padrão, SET search_path = '' SEMPRE, schema-qualified names, IMMUTABLE/STABLE quando possível.
---

# Supabase — Database Functions

## Quando usar

LLM carrega esta skill quando criar ou auditar funções Postgres em projeto Supabase. Trigger phrases:

- "criar função Postgres", "create or replace function"
- "trigger de banco", "function trigger"
- "SECURITY INVOKER vs DEFINER"
- "search_path", "set search_path"
- "função imutável", "stable function"

## Regras absolutas

- **Sempre `SECURITY INVOKER`** por default — função roda com permissões de quem invoca (mais seguro). `SECURITY DEFINER` apenas com justificativa explícita escrita em comentário no topo da função.
- **Sempre `set search_path = ''`** — sem isso, função vulnerável a hijack de schema. Documentado em [Database Advisors lint 0011](https://supabase.com/docs/guides/database/database-advisors).
- **Schema-qualified** (em todas as referências a tabelas, colunas, outras funções): `public.tasks`, não `tasks`. Sem qualifier, lookup falha quando `search_path = ''`.
- Marque **`IMMUTABLE`** se função não consulta DB e sempre retorna o mesmo para os mesmos inputs (ex: formatadores de string).
- Marque **`STABLE`** se função consulta DB mas não modifica e retorna o mesmo dentro de uma transação (ex: lookups). Permite Postgres cachear o resultado por query.
- Use **`VOLATILE`** apenas se função modifica dados ou tem side effects (default — não precisa explicitar).
- Error handling com `RAISE EXCEPTION 'mensagem'` — nunca silent fail.
- Para triggers: include `CREATE TRIGGER` válido junto com `CREATE FUNCTION` na mesma migration.

## Patterns canônicos

### Função simples — SECURITY INVOKER + search_path

```sql
-- formatador puro: IMMUTABLE
create or replace function public.format_full_name(first_name text, last_name text)
returns text
language sql
security invoker
set search_path = ''
immutable
as $$
  select first_name || ' ' || last_name;
$$;
```

### Função com query — STABLE + schema-qualified

```sql
-- conta tasks de um usuário (não modifica) — STABLE permite caching
create or replace function public.get_user_task_count(p_user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.tasks                    -- schema-qualified obrigatório
    where user_id = p_user_id;
  return v_count;
end;
$$;
```

### Trigger — atualizar `updated_at`

```sql
-- function + trigger juntos na mesma migration
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();
```

### Função com error handling

```sql
create or replace function public.transfer_credits(
  p_from_user uuid,
  p_to_user uuid,
  p_amount integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Valor de transferência deve ser positivo: %', p_amount;
  end if;

  select balance into v_from_balance
    from public.accounts
    where user_id = p_from_user
    for update;                          -- lock para evitar race

  if v_from_balance < p_amount then
    raise exception 'Saldo insuficiente';
  end if;

  update public.accounts
    set balance = balance - p_amount
    where user_id = p_from_user;

  update public.accounts
    set balance = balance + p_amount
    where user_id = p_to_user;
end;
$$;
```

### `SECURITY DEFINER` — quando justificável

```sql
-- caso raro: função precisa fazer algo que invoker não pode fazer
-- ex: contar todos os usuários (acessível só para admins via app_metadata)
-- mas exposto via RPC para qualquer authenticated com auth check interno

-- comentário JUSTIFICANDO o DEFINER (obrigatório)
create or replace function public.count_active_users()
returns integer
-- security definer porque: precisamos bypassar RLS de auth.users que bloqueia leitura
-- mitigação: validamos role admin via app_metadata logo no topo
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_count integer;
begin
  -- validar admin via app_metadata (não user_metadata!)
  if (auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then
    raise exception 'Acesso negado: apenas admins';
  end if;

  select count(*) into v_count
    from public.users
    where last_seen_at > now() - interval '30 days';
  return v_count;
end;
$$;
```

## Anti-patterns

### Anti-pattern 1: `SECURITY DEFINER` + sem `set search_path` + sem schema qualifier

**Errado:**
```sql
create or replace function f()
returns integer
language plpgsql
security definer                          -- ⚠ sem justificativa
as $$                                     -- ⚠ sem set search_path
begin
  return (select count(*) from tasks);   -- ⚠ sem public. qualifier
end;
$$;
```

**Por quê:** atacante pode criar `tasks` em schema próprio + manipular `search_path` via `set local search_path = atacante,public` antes de invocar. Função `SECURITY DEFINER` executa com permissões do owner — atacante consegue ler/escrever onde não deveria.

**Certo:**
```sql
create or replace function public.f()
returns integer
language plpgsql
security invoker                          -- prefira invoker
set search_path = ''                      -- bloqueia hijack
stable
as $$
begin
  return (select count(*) from public.tasks);  -- qualified
end;
$$;
```

### Anti-pattern 2: Função consulta DB mas marcada `IMMUTABLE`

**Errado:**
```sql
create or replace function public.user_count_immutable()
returns integer
language sql
immutable                                 -- ⚠ função consulta DB — não imutável
set search_path = ''
as $$
  select count(*) from public.users;
$$;
```

**Por quê:** `IMMUTABLE` diz para Postgres "este resultado nunca muda para os mesmos inputs". Postgres pode cachear ou pré-computar. Mas a contagem de usuários muda — Postgres pode retornar valor stale indefinidamente.

**Certo:** usar `stable` (consulta DB, não modifica, mesmo em uma transação) ou `volatile` (default — recompute sempre).

### Anti-pattern 3: Silent fail sem `raise exception`

**Errado:**
```sql
create or replace function public.deduct_credits(p_user uuid, p_amount integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- ⚠ sem validação — atualiza mesmo com saldo negativo
  update public.accounts
    set balance = balance - p_amount
    where user_id = p_user;
end;
$$;
```

**Por quê:** silent fail oculta bugs. Saldo fica negativo sem aviso; testes downstream falham com mensagens enigmáticas.

**Certo:**
```sql
-- valida + raise exception se inválido (ver pattern "transfer_credits" acima)
```

## Ver também

- [supabase-postgres-style](../supabase-postgres-style/SKILL.md) — convenção de naming + style aplicada em funções
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — funções e RLS interagem (SECURITY INVOKER respeita RLS do invoker)
- [supabase-migrations](../supabase-migrations/SKILL.md) — funções em migrations são versionadas
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — funções invocadas por `pg_cron` jobs
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN + comandos CLI
