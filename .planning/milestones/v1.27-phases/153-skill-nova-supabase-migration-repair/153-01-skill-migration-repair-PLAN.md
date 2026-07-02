---
phase: 153
plan_id: 153-01
title: Skill nova — supabase-migration-repair
milestone: v1.27
status: in_progress
requirements:
  - REPAIR-01  # Diagnóstico supabase migration list
  - REPAIR-02  # supabase migration repair (tracking table only)
  - REPAIR-03  # Rollback preview via delete + reopen
  - REPAIR-04  # Schema drift handling após git rebase
  - REPAIR-05  # Permission denied troubleshooting (graphql + custom role)
---

# Phase 153 — Skill nova `supabase-migration-repair`

## Objetivo

Criar skill canônica `kit/skills/supabase-migration-repair/SKILL.md` cobrindo o "kit de emergência" canônico para sync errors entre local `supabase/migrations/` e remote `supabase_migrations.schema_migrations` tracking table, mais rollback de preview branches via delete+reopen, schema drift após git rebase e troubleshooting de permission denied.

Cobre 5 REQs (REPAIR-01..REPAIR-05) da REQUIREMENTS.md v1.27.

## Contexto cross-suite v1.27

Esta skill é o **complemento de operação** das skills introduzidas em v1.27:

- `supabase-branching-workflow` (Phase 149) — quando preview branch falha no step 5 (migrate) do DAG, esta skill cobre o "como diagnosticar e reparar"
- `supabase-ci-cd-github-actions` (Phase 151) — pipelines que executam `supabase migration up` e podem falhar com mismatch tracking table
- `supabase-pgtap-testing` (Phase 152) — quando tests falham por schema desatualizado

Princípio canônico estabelecido: **tracking table state ≠ schema state real**. `migration repair` corrige APENAS o registro de histórico — NUNCA reverte ou aplica SQL.

## REQs cobertos

### REPAIR-01 — Diagnóstico via `supabase migration list`

- Comando `supabase migration list` compara `supabase/migrations/*.sql` local vs `supabase_migrations.schema_migrations` remote
- Output tabular: colunas LOCAL / REMOTE / TIME (UTC)
- 3 estados canônicos:
  - `20240101  20240101` — sincronizado (presente em ambos)
  - `20240102  -        ` — falta no remote (local-only, pendente push)
  - `-         20240103` — falta no local (remote-only, alguém aplicou direto no DB)
- Tracking table real: `supabase_migrations.schema_migrations` (1 row per migration applied)
- Comportamento canônico de `supabase db push`: compara folder vs tracking table → aplica apenas migrations não-aplicadas, em ordem cronológica

### REPAIR-02 — `supabase migration repair --status applied|reverted <timestamp>`

> **CAVEAT CRÍTICO — tracking table only:** `supabase migration repair` atualiza APENAS a tracking table `supabase_migrations.schema_migrations`. NÃO aplica SQL nem reverte SQL.

Casos canônicos de uso:

- **Migration aplicada manualmente no remote (via Dashboard SQL editor):** schema state OK, mas tracking table desatualizado → `db push` tenta re-aplicar e falha → `repair --status applied <timestamp>` corrige registro
- **Migration registrada como aplicada mas nunca executada:** raro, mas pode ocorrer em projetos antigos → `repair --status reverted <timestamp>` remove do histórico, permitindo `db push` re-aplicar

**Caveat repetido 2× canônico:** repair NÃO modifica schema; se schema state estiver inconsistente, repair sozinho NÃO basta — precisa migration corrigida via `db push`.

### REPAIR-03 — Rollback preview branch via delete + reopen

Workflow canônico (5 passos):

1. PR close → Supabase Branching deleta preview branch automaticamente
2. PR reopen → Supabase Branching cria novo preview branch
3. Novo branch é equivalente a `supabase db reset` local
4. Reaplicação do `supabase/seed.sql` (dataless by design — cross-ref skill `supabase-branching-workflow`)
5. **Data changes adicionais fora do seed são PERDIDOS** — aceito como trade-off para reset limpo

Quando usar:

- Migration ruim foi pushada para preview branch e DAG falhou no step 5
- Quer voltar ao estado limpo sem aplicar reverter migration manualmente
- Preview branch entrou em estado "failed" do DAG sem possibilidade de recovery via re-push

### REPAIR-04 — Schema drift handling após git rebase

Problema canônico:

- Teammate merge nova migration em `main` com timestamp T+1 enquanto sua branch ainda tem migration com timestamp T
- Após `git rebase main`, sua migration ainda tem timestamp T — **MAIS ANTIGO** que a do teammate (T+1)
- Local `supabase db reset` aplica migrations em ordem cronológica → sua migration roda PRIMEIRO, falhando porque depende de schema state que só existe APÓS migration T+1

Solução canônica (4 passos):

1. `git pull origin main` (traz migration T+1 do teammate)
2. `supabase migration new dev_A` cria nova migration com timestamp T+2 (placeholder)
3. `mv supabase/migrations/<T>_dev_A.sql supabase/migrations/<T+2>_dev_A.sql` renomeia migration antiga
4. `supabase db reset` local reaplica TUDO em ordem cronológica correta (T+1 do teammate → T+2 seu)

**Princípio canônico:** changes que dependem de earlier changes DEVEM ter later timestamps. Append-only migration history não tolera reordering retroativo.

### REPAIR-05 — Permission denied troubleshooting

Dois casos canônicos documentados (ambos da doc oficial):

**Caso 1: db pull erro "permission denied for table _type"**

```
Error: Error running pg_dump on remote database: pg_dump: error: query failed:
ERROR:  permission denied for table _type
pg_dump: error: query was: LOCK TABLE "graphql"."_type" IN ACCESS SHARE MODE
```

Causa: projetos antigos não têm grant correto no graphql schema introspection.

Solução SQL (executar no Dashboard SQL Editor):

```sql
grant all on all tables in schema graphql to postgres, anon, authenticated, service_role;
grant all on all functions in schema graphql to postgres, anon, authenticated, service_role;
grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
```

**Caso 2: db push erro 42501 com custom role**

```
ERROR: permission denied for table X (SQLSTATE 42501)
```

Causa: tabela criada com custom role (cross-ref skill `supabase-postgres-roles` v1.26); `postgres` role não tem permission para modificá-la em migration.

Solução SQL:

```sql
grant "custom_role" to "postgres";
```

## Estrutura da skill

```text
kit/skills/supabase-migration-repair/SKILL.md
├── Frontmatter YAML (name + description com trigger phrases)
├── Quando usar (trigger phrases + use APENAS / NÃO use)
├── Princípio canônico (3 princípios — tracking table ≠ schema state, diagnose antes repair, rollback preferível a manual revert)
├── CAVEAT CRÍTICO destacado em bloco quote: migration repair atualiza APENAS tracking table
├── Pattern 1: Diagnóstico `migration list` (REPAIR-01)
├── Pattern 2: `migration repair --status applied|reverted` (REPAIR-02) — caveat repetido 2×
├── Pattern 3: Rollback preview via delete+reopen (REPAIR-03)
├── Pattern 4: Schema drift após git rebase (REPAIR-04)
├── Pattern 5: Permission denied troubleshooting (REPAIR-05) — 2 casos
├── Anti-patterns (≥4)
├── Cross-suite integration (v1.27)
└── Ver também (cross-refs)
```

## Tamanho esperado

500-700 linhas (similar a `supabase-postgres-roles` v1.26 e `supabase-branching-workflow` v1.27).

## Anti-patterns mínimos (≥4)

1. Usar `migration repair` esperando reverter SQL (CAVEAT CRÍTICO violado)
2. Schema changes direto no remote bypassing migration files (cria drift inevitável)
3. Não rebase local antes de db push em equipe (timestamps fora de ordem)
4. Concurrent db push from different machines (race condition na tracking table)

## Cross-refs canônicos

1. `supabase-migrations` (v1.23) — pattern de migrations append-only
2. `supabase-branching-workflow` (Phase 149) — preview branch lifecycle + delete+reopen rollback
3. `supabase-postgres-roles` (v1.26) — grant custom_role to postgres para REPAIR-05 caso 2
4. `evolucao-schema-compativel` (v1.22) — pattern 3-passos para evitar destructive migrations que requerem repair
5. `supabase-declarative-schema` — workflow alternativo (declarative-first → diff → migrate)

## Verificação

- [x] Diretório `kit/skills/supabase-migration-repair/` criado
- [x] SKILL.md com 500-700 linhas
- [x] 5 REQs cobertos (REPAIR-01..05)
- [x] ≥4 anti-patterns documentados
- [x] ≥5 cross-refs
- [x] Frontmatter YAML compatível com kit registry
- [x] Idioma PT-BR (convenção v1.22+)
- [x] CAVEAT "tracking table apenas" aparece ≥2× no corpo da skill
- [x] Commit atômico via `tools.cjs commit`

## Notas

- Esta skill **não cria agent novo** — fica como skill standalone consumida por `supabase-migration-writer`, `supabase-rls-writer`, e pelos agents futuros Phase 154 (`supabase-branching-architect`, `supabase-cicd-pipeline-implementer`).
- Cross-ref bidirecional com `supabase-branching-workflow` (Phase 149) e `supabase-ci-cd-github-actions` (Phase 151) — ambos referenciavam esta skill futura. Forward-refs fechados.
