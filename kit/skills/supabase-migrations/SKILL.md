---
name: supabase-migrations
description: Use ao criar arquivos de migration Supabase — naming YYYYMMDDHHmmss_short.sql, header de metadados, RLS obrigatório em toda nova tabela, granular policies.
---

# Supabase — Migrations

## Quando usar

LLM carrega esta skill quando criar/editar arquivos em `supabase/migrations/`. Trigger phrases:

- "criar migration Supabase", "supabase migration new"
- "alterar schema do banco", "alter table"
- "criar nova tabela em Postgres/Supabase"
- "adicionar coluna a tabela existente"
- "drop column / drop table" (operações destrutivas — exige cuidado extra)

## Regras absolutas

- **Naming canônico:** `YYYYMMDDHHmmss_short_description.sql` em UTC (ex: `20260506120000_create_tasks.sql`). Use `supabase migration new <name>` para gerar timestamp correto.
- **Header de metadados** no topo de cada migration (block comment) descrevendo Migration / Created / Purpose / Affects.
- **lowercase em todo SQL** (alinhado com `supabase-postgres-style`).
- **Comentários copiosos** em comandos destrutivos: `drop table`, `drop column`, `alter table ... drop column`, `truncate`, `delete from` em massa. Comentário explica o porquê + impacto.
- **`RLS` obrigatório em toda nova tabela** — `alter table public.<name> enable row level security;` no mesmo arquivo da criação.
- **`granular policies`** — uma `for select`, uma `for insert`, uma `for update`, uma `for delete`. **Nunca** `for all`.
- **`(select auth.uid())`** sempre wrapped (REGRA #1 de RLS).
- **Index nas colunas referenciadas por RLS:** `create index on public.<table> (user_id);` no mesmo arquivo.
- Idempotência onde possível: `create table if not exists`, `create index if not exists`. Migrations rodam em ordem mas tooling pode re-executar.
- Migrations são **append-only**. Para reverter, criar nova migration que desfaz — nunca editar migration já aplicada.

## Patterns canônicos

### Criar tabela com RLS + policies granulares + index

```sql
/*
  Migration: create_tasks
  Created: 2026-05-06
  Purpose: Cria tabela tasks com RLS habilitado e policies granulares por operação.
  Affects: public.tasks (new), public.tasks policies (new — 4 policies)
*/

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- granular policies: uma por operação por role
create policy "users_select_own_tasks"
  on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_insert_own_tasks"
  on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users_update_own_tasks"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_delete_own_tasks"
  on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- index obrigatório nas colunas usadas pela policy
create index if not exists tasks_user_id_idx on public.tasks (user_id);
```

### Adicionar coluna a tabela existente

```sql
/*
  Migration: add_priority_to_tasks
  Created: 2026-05-06
  Purpose: Adiciona coluna priority (low/medium/high) a tasks com default low.
  Affects: public.tasks (column added — non-destructive)
*/

alter table public.tasks
  add column if not exists priority text not null default 'low';

-- check constraint para enum-like
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high'));
```

### Operação destrutiva — drop column com comentário extensivo

```sql
/*
  Migration: drop_legacy_subtitle_column
  Created: 2026-05-06
  Purpose: Remove coluna subtitle (deprecated em v3.0 — nunca foi usada em produção).
  Affects: public.tasks (column dropped — DESTRUCTIVE)
  Risk: Baixo — coluna nullable nunca populada (validado via select count(*) where subtitle is not null = 0).
  Rollback: criar nova migration `add subtitle column` se necessário.
*/

-- DROP de coluna deprecated. Validado upstream: zero linhas com valor não-null.
-- Operação destrutiva — irreversível sem backup.
alter table public.tasks
  drop column if exists subtitle;
```

## Anti-patterns

### Anti-pattern 1: Criar tabela sem RLS

**Errado:**
```sql
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null
);
-- esqueceu enable row level security
```

**Por quê:** sem RLS, tabela exposta ao role `anon` e `authenticated` sem filtro — qualquer cliente lê tudo. RLS habilitado sem policies bloqueia tudo (mais seguro como default que deixar aberto).

**Certo:** sempre `alter table public.tasks enable row level security;` + policies granulares no mesmo arquivo.

### Anti-pattern 2: `for all` em vez de granular policies

**Errado:**
```sql
create policy "users_manage_tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id);
```

**Por quê:** mistura `using` (controla SELECT/UPDATE/DELETE) com `with check` (controla INSERT/UPDATE) — em UPDATE você pode querer regras diferentes para "qual linha tocar" vs "qual estado novo".

**Certo:** 4 policies separadas (uma por operação) — ver pattern "Criar tabela" acima.

### Anti-pattern 3: `drop column` sem comentário

**Errado:**
```sql
alter table public.tasks drop column legacy_field;
```

**Por quê:** futuros leitores não sabem por que a coluna foi removida; rollback fica difícil; risk não documentado.

**Certo:** comentário no header explica Purpose + Affects + Risk + Rollback (ver pattern destrutivo acima).

### Anti-pattern 4: `auth.uid()` sem `(select)` wrapper

**Errado:**
```sql
using (auth.uid() = user_id)
```

**Por quê:** degradação 1000× em queries com filtro RLS (Postgres reavalia por linha).

**Certo:**
```sql
using ((select auth.uid()) = user_id)
```

## Ver também

- [supabase-postgres-style](../supabase-postgres-style/SKILL.md) — convenção de naming + style aplicada
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — granular policies + WARNING user_metadata
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — funções com `set search_path = ''`
- [supabase-declarative-schema](../supabase-declarative-schema/SKILL.md) — workflow alternativo (declarative-first → diff)
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN + comandos CLI
