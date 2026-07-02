---
name: supabase-declarative-schema
cost_tier: leve
description: Gerencia schema Supabase declarativo via supabase/schemas/ — gera migration com stop → db diff -f → revisar → apply. Caveats — views, RLS, partitions.
---

# Supabase — Declarative Database Schema

## Quando usar

LLM carrega esta skill quando trabalhar com `supabase/schemas/` (declarative source-of-truth) em vez de migrations imperativas. Trigger phrases:

- "supabase schemas/", "declarative schema"
- "supabase db diff", "gerar migration de schema"
- "schema source of truth"
- "como adicionar tabela em projeto declarative"

## Regras absolutas

- **Workflow canônico:**
  1. Editar arquivos `.sql` em `supabase/schemas/` (representando estado **final** desejado de cada entidade)
  2. **`supabase stop`** — derrubar containers locais (necessário antes de diff)
  3. **`supabase db diff -f <name>`** — gera migration em `supabase/migrations/<timestamp>_<name>.sql`
  4. **Revisar manualmente** a migration gerada (diff é heurístico — pode gerar SQL incorreto em renames, drops, etc.)
  5. `supabase db reset` para aplicar local; `supabase db push` para aplicar remote
- **Nunca pule `supabase stop`** antes de `db diff` — diff sem stop produz output inconsistente.
- **Nunca pule revisão** da migration gerada — especialmente para renames (diff pode gerar `drop+create` em vez de `rename column`).
- **DML (INSERT/UPDATE/DELETE) NÃO é declarative** — fica em migrations imperativas (`supabase/migrations/`) ou `supabase/seed.sql`.
- **Files ordenados lexicograficamente** — para gerenciar dependências (FKs), nomeie de forma que a ordem de execução resolva referências (ex: `01_users.sql`, `02_tasks.sql`).
- **Adicione novas colunas no fim** da definição da tabela — evita diffs falsos em PRs.
- Seu `kit` de schemas reflete estado final, **não** o histórico — migrations carregam o histórico.

## Patterns canônicos

### Estrutura típica de `supabase/schemas/`

```
supabase/
├── schemas/
│   ├── 01_extensions.sql         -- create extension if not exists ...
│   ├── 02_users.sql              -- public.users (mirror de auth.users)
│   ├── 03_tasks.sql              -- public.tasks
│   ├── 04_tasks_rls.sql          -- policies em public.tasks
│   └── 05_functions.sql          -- public.set_updated_at, etc.
├── migrations/                    -- gerado por db diff (revisado e commitado)
└── seed.sql                       -- DML (não declarative)
```

### Workflow de mudança

```bash
# PT-BR: 1. editar schemas/
# (ex: adicionar coluna priority em supabase/schemas/03_tasks.sql)

# PT-BR: 2. parar containers (obrigatório antes de diff)
supabase stop

# PT-BR: 3. gerar migration
supabase db diff -f add_priority_to_tasks

# PT-BR: 4. revisar arquivo gerado
# supabase/migrations/<timestamp>_add_priority_to_tasks.sql
# (verificar se diff capturou só o intended change — não renames falsos, drops indevidos)

# PT-BR: 5. aplicar local
supabase db reset

# PT-BR: 6. (depois) aplicar remote
supabase db push
```

### Schema com FK e RLS

```sql
-- supabase/schemas/03_tasks.sql
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'todo',
  priority text not null default 'low',           -- novas colunas: append no fim
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- policies em arquivo separado (04_tasks_rls.sql) ou aqui
-- mas sempre granulares (ver supabase-rls-policies)
```

## Caveats — limitações conhecidas do declarative

O `migra` diff tool (usado por `supabase db diff`) tem edge cases. **Sempre revise** a migration gerada antes de aplicar.

### DML (INSERT/UPDATE/DELETE)
- **Não rastreável** por declarative (declarative só captura DDL — Data Definition Language).
- Use `supabase/seed.sql` para seed data ou migrations imperativas para mudanças de dados.

### View ownership e atributos
- Diff **não captura mudanças de owner** de views.
- **Security invoker em views** não é diferenciado por diff — usar migration manual se mudar.
- **Materialized views** têm suporte limitado.
- **Mudança de column type em views** não recria a view — diff pode falhar silenciosamente.

### RLS policies
- `alter policy` statements são suportados mas podem ter edge cases.
- **Column privileges** não são totalmente capturados.

### Outras entidades
- **Schema privileges:** não rastreados (cada schema diffado separadamente).
- **Comments on objects:** não rastreados.
- **Partitions:** suporte limitado — partitioned tables podem precisar migration manual.
- **`alter publication ... add table`:** não detectado por diff.
- **`create domain`:** ignorado por diff (usar migration imperativa).
- **`grant` statements:** duplicados a partir de default privileges — verificar saída.

## Anti-patterns

### Anti-pattern 1: `db diff` com containers up

**Errado:**
```bash
# containers ainda rodando
supabase db diff -f my_change   # ⚠ output inconsistente
```

**Por quê:** diff compara schema declarado em `schemas/` com DB local atual. Se containers up, DB tem state inconsistente (mid-transaction, locks abertos).

**Certo:**
```bash
supabase stop
supabase db diff -f my_change
```

### Anti-pattern 2: Aplicar migration gerada sem revisão

**Errado:**
```bash
supabase db diff -f rename_column
supabase db push   # ⚠ aplicou sem revisar
```

**Por quê:** diff é heurístico. Em renames, pode gerar `drop column old + create column new` em vez de `alter table ... rename column`. Resultado: dados perdidos.

**Certo:** sempre abrir `supabase/migrations/<timestamp>_*.sql` e revisar antes de aplicar.

### Anti-pattern 3: DML em `supabase/schemas/`

**Errado:**
```sql
-- supabase/schemas/03_tasks.sql
create table if not exists public.tasks (...);

insert into public.tasks (id, title) values (...);   -- ⚠ DML não é declarative
```

**Por quê:** declarative captura apenas DDL. Inserts em `schemas/` rodam quando schema é aplicado, mas não são rastreáveis em migrations — recriam sempre que `db reset`.

**Certo:** mover INSERTs para `supabase/seed.sql` ou migration imperativa.

### Anti-pattern 4: Adicionar coluna no meio da definição

**Errado:**
```sql
-- antes
create table public.tasks (id uuid, title text, created_at timestamptz);

-- depois (coluna adicionada NO MEIO)
create table public.tasks (id uuid, priority text, title text, created_at timestamptz);
```

**Por quê:** diff pode interpretar como reorder e gerar SQL ineficiente (drop + recreate de várias colunas).

**Certo:** appendar no fim:
```sql
create table public.tasks (id uuid, title text, created_at timestamptz, priority text);
```

## Ver também

- [supabase-migrations](../supabase-migrations/SKILL.md) — formato e regras dos arquivos gerados em `migrations/`
- [supabase-postgres-style](../supabase-postgres-style/SKILL.md) — estilo SQL nas declarações
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — como expressar RLS em schemas/
- [glossário](../_shared-supabase/glossary.md) — comandos CLI canônicos (`supabase stop`, `db diff -f`, `db reset`)
