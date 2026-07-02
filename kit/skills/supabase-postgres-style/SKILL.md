---
name: supabase-postgres-style
cost_tier: leve
description: Use ao escrever SQL para Postgres/Supabase. Enforça snake_case, lowercase reserved, tabelas plural, timestamptz (ISO 8601), aliases explícitos e CTEs lineares em queries complexas.
---

# Supabase — Postgres Style Guide

## Quando usar

LLM carrega esta skill quando trabalhar com SQL em projeto Supabase/Postgres — definir schemas, escrever queries, criar tabelas/colunas, padronizar dates, decidir nomes. Trigger phrases:

- "criar tabela em postgres", "create table"
- "escrever query SQL para Supabase"
- "estilo de schema", "convenção de nomes em SQL"
- "estrutura de query complexa" (CTE vs subquery)

## Regras absolutas

- **Sempre** use **`lowercase reserved`** words: `select`, `from`, `where`, `join`, `with`, `as`. **Nunca** `SELECT`, `FROM`, `WHERE` em maiúscula.
- **Sempre** use **`snake_case`** para tabelas, colunas, funções, índices. **Nunca** `camelCase` ou `PascalCase`.
- **Tabelas em plural** (`books`, `authors`, `users`); **colunas em singular** (`title`, `author_id`, `created_at`).
- **Datas em `ISO 8601`** com timezone: `timestamptz` (não `timestamp` sem tz). String literal: `'2026-05-06T12:00:00Z'`.
- Aliases descritivos com `as` **explícito**: `select b.title as book_title from books as b`. Nunca alias implícito.
- Evite `id` ambíguo. Em FKs use `<entity>_id` (`author_id`, `user_id`). Em PKs use `id` apenas se a tabela já é singular contextualmente.
- Para queries complexas: prefira **múltiplas CTEs lineares** sobre subqueries aninhadas. Cada CTE com 1 propósito + comentário.
- JOINs sempre com nomes completos da tabela qualificadora: `books.author_id = authors.id` (não aliases curtos como `b.x = a.y` sem `as`).

## Patterns canônicos

### Tabela típica

```sql
-- estilo: lowercase reserved + snake_case + tabela em plural + colunas em singular
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author_id uuid references public.authors (id) on delete cascade,
  published_at timestamptz,                       -- ISO 8601 com timezone
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- comentário descritivo na tabela (até 1024 chars)
comment on table public.books is 'Catálogo de livros disponíveis na biblioteca.';
```

### Query simples (uma linha por cláusula)

```sql
-- query curta: pode ficar em poucas linhas
select id, title, author_id
  from public.books
  where published_at is not null
  order by published_at desc
  limit 50;
```

### Query complexa com CTEs lineares

```sql
-- preferir CTEs lineares — cada uma com 1 propósito
with recent_books as (
  -- 1. livros publicados nos últimos 30 dias
  select id, title, author_id, published_at
    from public.books
    where published_at >= now() - interval '30 days'
),
author_stats as (
  -- 2. agregação por autor sobre os livros recentes
  select author_id, count(*) as total_recent
    from recent_books
    group by author_id
)
select a.name as author_name, s.total_recent
  from author_stats as s
  join public.authors as a on a.id = s.author_id
  order by s.total_recent desc;
```

## Anti-patterns

### Anti-pattern 1: Reserved words em maiúscula + mixed case

**Errado:**
```sql
SELECT * FROM Books WHERE Title='X'
```

**Por quê:** vai contra convenção da comunidade Postgres + dificulta diff em pull requests. Identificadores `Books` exigirão quoting (`"Books"`) sempre, ou o Postgres dobra para `books` quietly.

**Certo:**
```sql
select * from books where title = 'X'
```

### Anti-pattern 2: `timestamp` sem timezone + camelCase

**Errado:**
```sql
create table users (
  id int primary key,
  createdAt timestamp,                    -- sem timezone
  fullName text                           -- camelCase
);
```

**Por quê:** `timestamp` (sem `tz`) não preserva timezone — converte tudo para o timezone do servidor; ambíguo em apps multi-região. `camelCase` em SQL é estilizado por engine driver (caso por caso) e quebra em ferramentas que esperam snake_case.

**Certo:**
```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text
);
```

### Anti-pattern 3: subqueries aninhadas em vez de CTEs

**Errado:**
```sql
select * from (
  select author_id, count(*) from (
    select * from books where published_at > now() - interval '30 days'
  ) recent group by author_id
) ranked where count > 5;
```

**Por quê:** ilegível, impossível de comentar cada nível, query plan harder to read.

**Certo:** ver "Query complexa com CTEs lineares" acima.

## Ver também

- [supabase-migrations](../supabase-migrations/SKILL.md) — estilo aplicado em arquivos de migration
- [supabase-database-functions](../supabase-database-functions/SKILL.md) — estilo aplicado em funções Postgres
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — convenção de naming em policies
- [glossário](../_shared-supabase/glossary.md) — termos PT-BR↔EN + comandos CLI canônicos
