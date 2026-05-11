---
name: supabase-ci-cd-github-actions
description: Use ao automatizar Supabase via GitHub Actions — 8 workflows canônicos da doc oficial (ci.yml, staging.yml, production.yml, generate-types.yml, database-tests.yml, functions-tests.yml, backup.yml com warning "never backup to public repo" 2×, notify-failure.yaml). Secrets centralizados (SUPABASE_ACCESS_TOKEN + PRODUCTION_DB_PASSWORD/PROJECT_ID + STAGING_DB_PASSWORD/PROJECT_ID + SUPABASE_DB_URL). v1.27 incorpora 100% da doc oficial.
---

# Supabase — CI/CD GitHub Actions

## Quando usar

Esta skill cobre **8 workflows GitHub Actions canônicos** da doc oficial Supabase para automatizar lifecycle do projeto — validação em PR, deploy para staging/production, generação de types TypeScript, testes pgTAP + Deno, backup periódico, e propagação de failure check.

Trigger phrases:

- "CI Supabase GitHub Actions", "workflow Supabase CI"
- "deploy Supabase staging", "deploy Supabase production"
- "ci.yml Supabase", "staging.yml Supabase", "production.yml Supabase"
- "generate-types.yml Supabase", "schema.gen.ts CI"
- "database-tests.yml Supabase", "supabase test db CI"
- "functions-tests.yml Supabase", "deno test --allow-all CI"
- "backup.yml Supabase", "supabase db dump cron", "automated backup Supabase"
- "notify-failure.yaml Supabase", "fountainhead/action-wait-for-check"
- "Never backup your data to a public repository"
- "supabase secrets set CI", "supabase link --project-ref CI"

**Use APENAS para:**

- Validar migrations + schema declarativo em PR (gate antes do merge)
- Automatizar deploy para staging (branch develop) e production (branch main)
- Verificar que `schema.gen.ts` (types TypeScript) está committed e up-to-date
- Rodar testes pgTAP (`supabase test db`) + testes Deno (`deno test --allow-all`) em CI
- Backup periódico do schema/data/roles via cron midnight em repo **PRIVADO**
- Propagar falha do check "Supabase Preview" para o status do PR

**NÃO use para:**

- Substituir Supabase Branching (cross-ref skill `supabase-branching-workflow` Phase 149) — branching é gerenciado via Supabase Dashboard ou GitHub Integration (não GitHub Actions workflow customizado)
- Backup de dados sensíveis em **repositório público** — sempre repositório **privado** com criptografia adicional se PII (cross-ref Anti-pattern 1)
- Bypass de migration history — `db push` deve respeitar `supabase_migrations.schema_migrations` (cross-ref Anti-pattern 2)
- `db push` concorrente de máquinas diferentes — race condition pode corromper migration history (cross-ref Anti-pattern 3)

## Princípio canônico

Quatro princípios canônicos:

1. **CI/CD shift-left.** Cada PR valida migrations + types + tests **antes** do merge — sem surpresas em produção. Gate canônico = required status check enforced via branch protection rules.

2. **Cada PR gera preview branch isolado.** Workflows GitHub Actions são complementares ao Supabase Branching (cross-ref skill `supabase-branching-workflow` Phase 149) — branching gera o branch DB; GitHub Actions valida o código que define migrations e Edge Functions.

3. **Required check enforced.** Branch protection rule "Require status checks to pass before merging" + selecionar workflows críticos (CI-01 ci, CI-04 generate-types, CI-08 notify-failure) — sem ✓ verde, sem merge para `main`.

4. **3-dump backup separados (CI-07).** Roles + Schema + Data dumps em arquivos SEPARADOS — isolation de concerns:
   - `roles.sql` (--role-only) pode ser revisado independente
   - `schema.sql` cabe em git diff legível
   - `data.sql` (--data-only --use-copy) gera arquivo grande mas restaurável independente

### Distinção canônica vs Supabase Branching

| | Supabase Branching | GitHub Actions workflows |
|---|---|---|
| Gerencia | Branch DB Postgres + Edge Functions config | Código (migrations, types, tests) |
| Trigger | PR webhook (Branching) | PR events (workflows) |
| Source of truth | Supabase Dashboard config | `.github/workflows/*.yml` versionado |
| Validação | Deploy DAG 7 steps (cross-ref Phase 149 Pattern 2) | Type-check, pgTAP, Deno tests, db push |
| Cobrança | Branching Compute Hours (fora Spend Cap) | GitHub Actions minutes (free 2k/mês) |

Os dois são **complementares** — workflows GitHub Actions validam o **código** que vai para o branch DB; Branching gerencia o **ambiente** onde o código roda.

## Secrets GitHub Actions necessários

Antes de adotar qualquer workflow desta skill, configurar os secrets no repositório GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Origem | Workflows que usam | Caso de uso |
|--------|--------|---------------------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token (Dashboard → Account → Access Tokens) | staging.yml, production.yml | Autenticação do CLI Supabase em GitHub Actions runner |
| `STAGING_DB_PASSWORD` | Dashboard → Project Settings → Database (staging project) | staging.yml | Password do `postgres` role no staging — usado por `supabase link` |
| `STAGING_PROJECT_ID` | Dashboard → Project Settings → General → Reference ID (staging project) | staging.yml | Project reference do staging — usado por `supabase link --project-ref` |
| `PRODUCTION_DB_PASSWORD` | Dashboard → Project Settings → Database (production project) | production.yml | Password do `postgres` role no production |
| `PRODUCTION_PROJECT_ID` | Dashboard → Project Settings → General → Reference ID (production project) | production.yml | Project reference do production |
| `SUPABASE_DB_URL` | Connection string do production (`postgresql://postgres:pwd@host/db`) | backup.yml | URL completa para `supabase db dump --db-url` |

### Caveat — `SUPABASE_ACCESS_TOKEN` é per-user

Personal access tokens são vinculados ao **usuário** que os criou — se este usuário sair da organização, o token fica órfão e workflows quebram silenciosamente.

**Mitigação canônica:** criar token vinculado a uma **service account** dedicada da empresa (ex: `ci@company.com`) em vez de conta pessoal do dev.

### Caveat — Rotacionar passwords periodicamente

`PRODUCTION_DB_PASSWORD` e `STAGING_DB_PASSWORD` devem ser rotacionados a cada 90 dias (best practice). Após rotação no Dashboard, atualizar o secret em GitHub Actions — workflows quebram silenciosamente se o secret estiver stale.

### Caveat — `SUPABASE_DB_URL` contém password — encrypted by default

GitHub Actions encripta secrets automaticamente em rest e nos logs (mascaramento). NUNCA ecoar o secret em `run:` step — mesmo mascarado, pode vazar em error logs ou crash dumps.

## Pattern 1: `ci.yml` — validation on pull request (CI-01)

Workflow canônico que valida migrations + types em todo PR aberto:

```yaml
name: CI
on:
  pull_request:
  workflow_dispatch:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Start Supabase local development setup
        run: supabase db start
      - name: Verify generated types are checked in
        run: |
          supabase gen types typescript --local > types.gen.ts
          if ! git diff --ignore-space-at-eol --exit-code --quiet types.gen.ts; then
            echo "Detected uncommitted changes after build. See status below:"
            git diff
            exit 1
          fi
```

### Explicação line-by-line

- **`on: pull_request`** — trigger automático em todo PR aberto/atualizado
- **`workflow_dispatch`** — permite re-run manual via Actions tab (útil para debug)
- **`actions/checkout@v4`** — clona o repo no runner; v4 é a versão canônica atual (v3 ainda funciona mas sem features recentes)
- **`supabase/setup-cli@v1`** — instala CLI Supabase no runner (Docker layer cached); `version: latest` pega última release estável
- **`supabase db start`** — sobe instância Postgres + Auth + Realtime local via Docker
- **`supabase gen types typescript --local`** — gera tipos TypeScript a partir do schema do DB local (que aplicou as migrations no `db start`)
- **`git diff --ignore-space-at-eol --exit-code --quiet types.gen.ts`** — compara `types.gen.ts` gerado vs versionado em git; se diff existir, falha com exit 1

### Caveats canônicos

- **`--ignore-space-at-eol`** previne false positives causados por diferenças LF vs CRLF entre runner Linux e dev Windows
- **`--exit-code`** força exit 1 se diff (default `git diff` retorna 0 mesmo com diff)
- **`--quiet`** suprime output redundante (já temos `echo` + `git diff` manuais)
- O workflow só falha se `types.gen.ts` está **stale** — dev deve `supabase gen types typescript --local > types.gen.ts && git add types.gen.ts && git commit` localmente antes do PR

### Por que validar types committed

Consumer projetos TypeScript (clientes do projeto Supabase) **importam** `types.gen.ts` para type-safety em queries (`createClient<Database>()`). Se types estão stale:

- Compilação consumer falha silenciosamente em produção
- Type assertions ficam erradas (campo `created_at` ainda `string`, mas DB já é `timestamp`)
- Refactor downstream quebra sem warning

Required check `CI / test` deve ser obrigatório em branch protection rules para `main`.

## Pattern 2: `staging.yml` — deploy migrations to staging (CI-02)

Workflow para deploy automático de migrations ao staging Supabase project quando push para branch `develop`:

```yaml
name: Deploy Migrations to Staging
on:
  push:
    branches:
      - develop
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
      SUPABASE_PROJECT_ID: ${{ secrets.STAGING_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase link --project-ref $SUPABASE_PROJECT_ID
      - run: supabase db push
```

### Explicação line-by-line

- **`on: push: branches: [develop]`** — trigger quando alguém faz push direto em `develop` (ou merge de PR para `develop`)
- **`workflow_dispatch`** — re-run manual via Actions tab
- **`env: SUPABASE_ACCESS_TOKEN`** — secret do GitHub setado como env var no job (CLI lê este env var para autenticar)
- **`env: SUPABASE_DB_PASSWORD`** — password do `postgres` role; `supabase link` consome este env var implicitamente
- **`env: SUPABASE_PROJECT_ID`** — reference ID do staging project; usado no `--project-ref`
- **`supabase link --project-ref $SUPABASE_PROJECT_ID`** — associa CLI ao projeto remoto staging (escreve `.supabase/config.json` no runner)
- **`supabase db push`** — aplica migrations pendentes (que não estão em `supabase_migrations.schema_migrations` do remote) em ordem cronológica

### Caveats canônicos

- **`develop` como branch de staging** é convenção GitFlow; alguns times usam `main` para staging e tag-based deploy para production — adapte conforme convention
- `db push` consulta `supabase_migrations.schema_migrations` (tabela do Supabase) para determinar quais migrations aplicar — se há drift entre history local e remote, o push falha (cross-ref skill futura `supabase-migration-repair` Phase 153)
- Permissões: o token `SUPABASE_ACCESS_TOKEN` precisa de permissão `db` no projeto staging (default em personal tokens)

### Idempotência

`db push` é **idempotente** — se rodar 2× consecutivos no mesmo commit, a 2ª execução não faz nada (já aplicado). Mesmo trigger acidental (re-run) é seguro.

## Pattern 3: `production.yml` — deploy migrations to production (CI-03)

Workflow para deploy automático de migrations ao production Supabase project quando push para branch `main`:

```yaml
name: Deploy Migrations to Production
on:
  push:
    branches:
      - main
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.PRODUCTION_DB_PASSWORD }}
      SUPABASE_PROJECT_ID: ${{ secrets.PRODUCTION_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase link --project-ref $SUPABASE_PROJECT_ID
      - run: supabase db push
```

### Diferenças vs staging.yml

| | staging.yml | production.yml |
|---|---|---|
| `on: push: branches` | `develop` | `main` |
| `SUPABASE_DB_PASSWORD` | `${{ secrets.STAGING_DB_PASSWORD }}` | `${{ secrets.PRODUCTION_DB_PASSWORD }}` |
| `SUPABASE_PROJECT_ID` | `${{ secrets.STAGING_PROJECT_ID }}` | `${{ secrets.PRODUCTION_PROJECT_ID }}` |
| Caso de uso | Merge para develop = release candidate | Merge para main = release final |
| Rollback | Re-deploy commit anterior (rebuild migration if needed) | Mais delicado — cross-ref `supabase-migration-repair` Phase 153 |

### Warning canônico — cautela em deploy production

Production deploy via `db push` automático é **conveniência ao custo de risco**:

- Migrations destrutivas (DROP COLUMN, ALTER TYPE) aplicam imediatamente em production após merge
- Sem janela de aprovação manual
- Rollback de migration é complexo (cross-ref skill `evolucao-schema-compativel` v1.22 — pattern 3-step expand/migrate/contract)

**Mitigações canônicas:**

1. **Required check `CI / test` (Pattern 1) obrigatório** em branch protection para `main` — sem ✓ verde, sem merge
2. **Required check `database-tests` (Pattern 5)** — pgTAP testes passando antes do merge
3. **Manual approval para PRs com label `migration`** — extra gate de revisão humana
4. **Pre-deploy hook personalizado** — adicionar step `supabase db diff --linked` para preview da mudança antes do `db push`

### Alternativa — deploy manual via tag

Alguns times preferem deploy production só via tag versionada:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

Este pattern desacopla "merge para main" de "deploy production" — release manager cria tag explicitamente quando pronto.

## Pattern 4: `generate-types.yml` — verify schema.gen.ts committed (CI-04)

Workflow dedicado a verificar que os TypeScript types estão committed e up-to-date — alternativa mais leve ao Pattern 1 (CI-01) se quiser separar concerns:

```yaml
name: 'generate-types'
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
        - uses: supabase/setup-cli@v1
          with:
            version: latest
        - run: supabase init
        - run: supabase db start
        - name: Verify generated types match Postgres schema
          run: |
            supabase gen types typescript --local > schema.gen.ts
            if ! git diff --ignore-space-at-eol --exit-code --quiet schema.gen.ts; then
              echo "Detected uncommitted changes after build. See status below:"
              git diff
              exit 1
            fi
```

### Diferenças vs Pattern 1 (CI-01)

- **`supabase init`** — inicializa estrutura `supabase/` se não existir (ci.yml assume já inicializada)
- **`schema.gen.ts`** como nome do arquivo (CI-01 usa `types.gen.ts`) — naming convenção do time; canônico é qualquer um, **DESDE QUE consistente**
- Não tem `actions/checkout@v4` explícito (algumas docs Supabase omitem; mas o checkout é necessário em prática — adicione se não tiver)

### Por que TypeScript types matter no CI

Schema do Postgres é **source of truth** dos tipos. Quando schema muda (nova coluna, novo type ENUM), os tipos TypeScript precisam ser regenerados. Sem CI:

- Dev esquece de regenerar tipos → consumer compila com tipos stale → runtime errors em queries
- PR review humano detecta inconsistência? Difícil — types files são gerados automaticamente
- Sem gate em CI, types stale propagam para produção

### Workflow para developer local

```bash
# após criar migration que muda schema
supabase db reset  # aplica todas migrations em DB local clean
supabase gen types typescript --local > types.gen.ts
git add types.gen.ts
git commit -m "chore: regenerate types after migration X"
```

Se este workflow não rodar, CI Pattern 1 ou Pattern 4 falha — gate canônico.

### Caveat — naming convention

Manter um único nome (`types.gen.ts` OU `schema.gen.ts`, não os dois) é importante:

- Consumer apps importam: `import type { Database } from './types.gen.ts'`
- Mudar o nome quebra todos consumers
- Recomendação: padronizar `types.gen.ts` (mais explícito que `schema.gen.ts`)

## Pattern 5: `database-tests.yml` — pgTAP runner (CI-05)

Workflow para rodar testes pgTAP no DB local em CI (cross-ref skill futura `supabase-pgtap-testing` Phase 152):

```yaml
name: 'database-tests'
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db start
      - run: supabase test db
```

### Explicação line-by-line

- **`actions/checkout@v3`** — versão da doc oficial; v4 também funciona (recomendado migrar)
- **`supabase db start`** — sobe Postgres + aplica todas migrations + aplica `seed.sql` se configurado
- **`supabase test db`** — runner pgTAP integrado do CLI Supabase; lê arquivos `supabase/tests/*.sql` em ordem alfabética e executa cada teste

### Anatomy de um teste pgTAP

Arquivo `supabase/tests/users.test.sql` (cross-ref skill futura Phase 152 para detalhes):

```sql
begin;
select plan(2);

-- Teste 1: usuário authenticated pode SELECT em sua própria org
select results_eq(
  $$select count(*) from organizations where id = current_setting('app.test_org_id')::uuid$$,
  $$select 1::bigint$$,
  'authenticated user can SELECT own org'
);

-- Teste 2: usuário NÃO pode SELECT em outra org
select throws_like(
  $$select * from organizations where id = '00000000-0000-0000-0000-000000000000'::uuid$$,
  '%permission denied%',
  'cross-org SELECT raises permission denied'
);

select * from finish();
rollback;
```

### Cross-ref skill futura — supabase-pgtap-testing (Phase 152)

Detalhes completos de pgTAP estarão em skill dedicada (Phase 152) — esta skill (Phase 151) cobre apenas a **integração CI**:

- Setup pgTAP extension (`create extension pgtap`)
- Sintaxe canônica de testes (plan, ok, is, throws_ok, finish)
- Test fixtures + cleanup pattern
- Cross-ref `legacy-characterizer` para characterization tests em PG functions

Por enquanto, basta saber que `supabase test db` é o entrypoint canônico — workflow YAML acima é completo.

### Caveat — falhas pgTAP retornam exit code != 0

Se algum teste falha, `supabase test db` retorna exit 1 → CI fails → required check fails → merge bloqueado (com branch protection rule).

Required check `database-tests / build` deve ser obrigatório em branch protection para `main`.

## Pattern 6: `functions-tests.yml` — Deno tests for Edge Functions (CI-06)

Workflow para rodar testes Deno de Edge Functions em CI:

```yaml
name: 'functions-tests'
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - uses: denoland/setup-deno@v2
        with:
          deno-version: latest
      - run: supabase start
      - run: deno test --allow-all deno-test.ts --env-file .env.local
```

### Explicação line-by-line

- **`denoland/setup-deno@v2`** — instala Deno runtime no runner (Edge Functions rodam em Deno, não Node)
- **`deno-version: latest`** — última versão estável; alguns times pinam para evitar surprise (`deno-version: 1.45.0`)
- **`supabase start`** — sobe stack completa (Postgres + Auth + Edge Functions runtime + Storage) — diferente de `db start` que sobe só DB
- **`deno test --allow-all deno-test.ts --env-file .env.local`** — roda testes definidos em `deno-test.ts`
  - `--allow-all` permite acesso file system + network + env vars (Deno é sandboxed por default)
  - `--env-file .env.local` carrega env vars de arquivo local (URLs locais, anon key local)

### `.env.local` para CI

Arquivo `.env.local` (gitignored — gerado pelo runner ou stub):

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJ...local-anon-key-from-supabase-start...
SUPABASE_SERVICE_ROLE_KEY=eyJ...local-service-role-key...
```

**Caveat:** `supabase start` mostra anon/service keys no output — em CI, capture via:

```bash
- run: |
    supabase start > /tmp/supabase-start.log
    echo "SUPABASE_URL=$(grep 'API URL' /tmp/supabase-start.log | awk '{print $NF}')" >> .env.local
    echo "SUPABASE_ANON_KEY=$(grep 'anon key' /tmp/supabase-start.log | awk '{print $NF}')" >> .env.local
```

Ou — mais limpo — passar keys via env vars dinâmicas:

```bash
- run: deno test --allow-all deno-test.ts
  env:
    SUPABASE_URL: ${{ env.SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ env.SUPABASE_ANON_KEY }}
```

### Anatomy de um teste Deno para Edge Function

Arquivo `supabase/functions/_tests/deno-test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.test("invite endpoint creates org_invites row", async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data, error } = await supabase.functions.invoke("create-invite", {
    body: { email: "newuser@example.com", role: "member" },
  });

  assertEquals(error, null);
  assertEquals(data.success, true);
});
```

### Caveat — Edge Functions runtime fora do test

Testes Deno **chamam** Edge Functions (via `supabase.functions.invoke`) ou **importam diretamente** o handler. Para testar handler isolado:

```typescript
import { handler } from "../create-invite/index.ts";

Deno.test("handler validates email format", async () => {
  const req = new Request("http://localhost/create-invite", {
    method: "POST",
    body: JSON.stringify({ email: "invalid", role: "member" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});
```

Required check `functions-tests / build` deve ser obrigatório em branch protection para `main`.

## Pattern 7: `backup.yml` — automated 3-dump backup with auto-commit (CI-07)

> ## WARNING CANÔNICO
>
> **Never backup your data to a public repository.**
>
> Backups contêm **dados sensíveis** (PII, emails, hashed passwords, tokens, IDs internos, schema completo). Repositório público expõe TODOS os dados históricos via git history — irreversível.
>
> Use **APENAS** repositório **privado** (GitHub Private repo ou GitHub Enterprise). Considere criptografia adicional (git-crypt, GPG) se backups contêm PII regulado (LGPD/GDPR).

Workflow para backup periódico do projeto Supabase com 3 dumps separados + auto-commit:

```yaml
name: Supa-backup

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * *' # Runs every day at midnight
jobs:
  run_db_backup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    env:
      supabase_db_url: ${{ secrets.SUPABASE_DB_URL }}
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.head_ref }}
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Backup roles
        run: supabase db dump --db-url "$supabase_db_url" -f roles.sql --role-only
      - name: Backup schema
        run: supabase db dump --db-url "$supabase_db_url" -f schema.sql
      - name: Backup data
        run: supabase db dump --db-url "$supabase_db_url" -f data.sql --data-only --use-copy

      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: Supabase backup
```

### Explicação line-by-line

- **`on: schedule: cron: '0 0 * * *'`** — roda diariamente à meia-noite UTC; cron canônico de backup periódico
- **`on: push/pull_request: branches: [main]`** — backup também em push/PR para main (extra trigger de safety net)
- **`workflow_dispatch`** — re-run manual via Actions tab
- **`permissions: contents: write`** — necessário para `git-auto-commit-action` push de volta ao repo
- **`actions/checkout@v3 with: ref: ${{ github.head_ref }}`** — checkout do branch do PR (não default branch)
- **`supabase/setup-cli@v1`** — instala CLI
- **`supabase db dump --db-url "$supabase_db_url" -f roles.sql --role-only`** — Dump 1: apenas Postgres roles (CREATE ROLE statements)
- **`supabase db dump --db-url "$supabase_db_url" -f schema.sql`** — Dump 2: schema completo (CREATE TABLE, INDEX, FUNCTION, etc.)
- **`supabase db dump --db-url "$supabase_db_url" -f data.sql --data-only --use-copy`** — Dump 3: apenas dados (INSERT/COPY statements); `--use-copy` é mais rápido para tabelas grandes
- **`stefanzweifel/git-auto-commit-action@v4 with: commit_message: Supabase backup`** — auto-commit dos 3 arquivos `.sql` se houver diferenças

### Por que 3 dumps separados — isolation de concerns

| Arquivo | Conteúdo | Por que separar |
|---------|----------|-----------------|
| `roles.sql` | CREATE ROLE statements | Roles são lifecycle separado do schema — review independente; cross-ref skill `supabase-postgres-roles` (v1.26) |
| `schema.sql` | CREATE TABLE, INDEX, FUNCTION, RLS policies, GRANTs | Schema cabe em git diff legível — review de mudanças facilitada |
| `data.sql` | INSERT/COPY de dados | Arquivo grande; restaurável independente do schema; permite restaurar dados sem alterar schema |

### Caveats adicionais

- **Rotação de backups** — git não trunca automaticamente; arquivo `data.sql` cresce indefinidamente. Mitigação: criar branch dedicado `supabase-backups` + workflow separado para rotation (`git filter-repo` periódico)
- **Retention policy externa** — para compliance LGPD/GDPR (cross-ref skill `lgpd-multi-tenant-compliance` v1.21), considerar backup paralelo a S3 com lifecycle policy (delete após 30/90 dias)
- **Criptografia adicional para PII** — git-crypt encripta arquivos no repo (chave separada em vault corporativo); GPG é alternativa para encryption-at-rest
- **Restore procedure documentado** — backup sem restore testado é pior que sem backup; documentar em runbook (`.planning/RUNBOOK.md`) o processo de restore
- **Frequência** — `cron '0 0 * * *'` = 1× por dia midnight UTC. Para alta criticidade, considere `0 */6 * * *` (6h) ou `0 */4 * * *` (4h)
- **Branching workflow** — backup workflow roda no project **principal** (production), não em preview branches; verificar `SUPABASE_DB_URL` aponta para production

### Diferença vs Supabase managed backups

Supabase Pro plan oferece **PITR (Point-in-Time Recovery)** managed — backup contínuo até 7 dias atrás. Workflow `backup.yml` é **complementar** (não substituto):

| | PITR managed (Supabase) | backup.yml (custom) |
|---|---|---|
| Frequência | Contínuo (WAL streaming) | Daily midnight |
| Retention | 7-28 dias (depende do plan) | Indefinido (git history) |
| Custo | Incluído no Pro plan | GitHub Actions minutes + repo storage |
| Granularidade | Point-in-time (segundo) | Daily snapshot |
| Visibilidade | Dashboard apenas | Git diff visível |
| Caso de uso | Disaster recovery rápido | Audit trail + cross-region backup |

Recomendação canônica: usar **AMBOS** — PITR para recovery operacional, `backup.yml` para audit trail histórico.

> ## WARNING CANÔNICO (REPETIDO)
>
> **Never backup your data to a public repository.**
>
> Mesmo workflow privado pode acidentalmente expor backup se o repo for tornado público posteriormente. Verificar via:
>
> 1. **Settings → General → Danger Zone → "Change repository visibility"** está em **Private**
> 2. **Settings → Branches → Branch protection** restringe push para `main`
> 3. **Auditar org members** com `Admin` permission no repo (podem mudar visibility)
> 4. **Considerar repo DEDICADO para backups** — separar de código fonte; reduz surface area de exposição acidental

## Pattern 8: `notify-failure.yaml` — propagate Supabase Preview check failure (CI-08)

Workflow que **propaga** o status do check "Supabase Preview" (gerado pelo Supabase Branching GitHub integration, cross-ref Phase 149 Pattern 3) para o status final do PR:

```yaml
name: Branch Status

on:
  pull_request:
    types:
      - opened
      - reopened
      - synchronize
    branches:
      - main
      - develop
    paths:
      - 'supabase/**'

jobs:
  failed:
    runs-on: ubuntu-latest
    steps:
      - uses: fountainhead/action-wait-for-check@v1.2.0
        id: check
        with:
          checkName: Supabase Preview
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          token: ${{ secrets.GITHUB_TOKEN }}

      - if: ${{ steps.check.outputs.conclusion == 'failure' }}
        run: exit 1
```

### Explicação line-by-line

- **`on: pull_request: types: [opened, reopened, synchronize]`** — trigger em todos eventos PR relevantes
- **`on: pull_request: branches: [main, develop]`** — apenas PRs targeting main ou develop (filtra noise de feature → feature PRs)
- **`on: pull_request: paths: ['supabase/**']`** — apenas PRs que tocam `supabase/` (filtra PRs de docs/frontend que não trigam Supabase Preview)
- **`fountainhead/action-wait-for-check@v1.2.0`** — third-party action que espera um check específico aparecer no commit + retorna `conclusion`
- **`checkName: Supabase Preview`** — nome do check gerado pelo Supabase GitHub integration (gerado automaticamente quando preview branch é criado)
- **`ref: ${{ github.event.pull_request.head.sha || github.sha }}`** — SHA do commit alvo (head do PR ou SHA do push); fallback `github.sha` cobre edge cases
- **`token: ${{ secrets.GITHUB_TOKEN }}`** — token automático do GitHub Actions (sem precisar configurar secret manual)
- **`if: ${{ steps.check.outputs.conclusion == 'failure' }} run: exit 1`** — falha o workflow se Supabase Preview falhou

### Por que separar este workflow

Sem este workflow:

- "Supabase Preview" check aparece como external check no PR
- Status mostra falha **isolado**, mas merge button pode estar habilitado se branch protection não selecionou explicitamente "Supabase Preview"

Com este workflow:

- `notify-failure / failed` aparece como check **do próprio repo**
- Branch protection rule "require status checks" pode selecionar `notify-failure / failed`
- Sem ✓ verde em `notify-failure / failed` → merge bloqueado mesmo se merge button parece habilitado

### Caveats canônicos

- **`fountainhead/action-wait-for-check` é third-party** — auditar versão pinada (`@v1.2.0` específico, não `@v1`); supply chain attack surface
- **Timeout** — action default espera até timeout do workflow (60min); para reduzir, usar `timeoutSeconds: 600` no with
- **Check name exato** — `Supabase Preview` deve match exato (case-sensitive); se Supabase muda o nome do check, este workflow quebra silenciosamente
- **`paths` filter** — se PR não tocar `supabase/`, workflow não roda, mas check fica ausente → branch protection pode bloquear merge incorretamente. Mitigação: usar `paths-ignore` em vez de `paths` para inverter lógica

### Required checks recomendados em branch protection (main)

Lista canônica de required checks após adotar todos os workflows desta skill:

1. `CI / test` (Pattern 1)
2. `generate-types / build` (Pattern 4)
3. `database-tests / build` (Pattern 5)
4. `functions-tests / build` (Pattern 6)
5. `notify-failure / failed` (Pattern 8 — propaga Supabase Preview)

Workflows que NÃO devem ser required:
- `Supa-backup` (Pattern 7) — backup é write side-effect; falha ≠ bloquear merge
- `Deploy Migrations to Staging` (Pattern 2) — deploy só após merge
- `Deploy Migrations to Production` (Pattern 3) — deploy só após merge

## Anti-patterns

### Anti-pattern 1: Backup em repo público

**Errado:**

```yaml
# .github/workflows/backup.yml em repo PÚBLICO
- name: Backup data
  run: supabase db dump --db-url "$supabase_db_url" -f data.sql --data-only --use-copy
- uses: stefanzweifel/git-auto-commit-action@v4
```

Workflow funciona, mas repo é público — `data.sql` committed contém **todos os dados** (emails, hashed passwords, PII).

**Por quê:** dados sensíveis ficam expostos publicamente para sempre (git history é permanente); compliance LGPD/GDPR violado; surface de ataque massiva (qualquer um pode clonar e analisar offline); breach notification obrigatória.

**Certo:**

1. **Repo PRIVADO** — `Settings → General → Danger Zone → Visibility: Private`
2. **Verificar via API:**
   ```bash
   gh repo view <org>/<repo> --json visibility
   # esperado: {"visibility": "PRIVATE"}
   ```
3. **Auditar admins** com permissão para mudar visibility — restringir
4. **Para PII regulado** — git-crypt encryption-at-rest:
   ```bash
   git-crypt init
   git-crypt add-gpg-user user@company.com
   # .gitattributes:
   # *.sql filter=git-crypt diff=git-crypt
   ```
5. **Considerar repo DEDICADO** apenas para backups (não compartilhar com código fonte) — reduz surface area de exposição acidental

### Anti-pattern 2: Schema changes direto no remote (bypass migration history)

**Errado:**

```bash
# dev faz mudança via Dashboard SQL Editor em production
ALTER TABLE users ADD COLUMN avatar_url text;

# nenhuma migration arquivo criada
# supabase_migrations.schema_migrations sem entry para esta mudança
```

Próximo `db push` via workflow (Pattern 2 ou 3):

- CLI compara local migrations vs remote `schema_migrations` — não detecta a mudança "fantasma" feita via Dashboard
- Migration subsequente pode falhar se assume estado anterior do schema

**Por quê:** quebra migration history → drift entre git e DB → próximas migrations falham com `column already exists` ou similar → debugging pesadelo; rollback impossível porque a mudança não tem migration reversa.

**Certo:**

1. **Sempre criar migration** via CLI:
   ```bash
   supabase migration new add_avatar_url_to_users
   # editar arquivo gerado em supabase/migrations/YYYYMMDDHHmmss_add_avatar_url_to_users.sql:
   # alter table public.users add column avatar_url text;
   ```
2. **Aplicar via PR** + workflow Pattern 1 (CI) valida + workflow Pattern 3 (production.yml) aplica
3. **Se mudança emergencial via Dashboard foi inevitável** — criar migration arquivo retrospectivo + usar `supabase migration repair` (cross-ref skill futura `supabase-migration-repair` Phase 153) para sincronizar history

### Anti-pattern 3: Concurrent `db push` from different machines

**Errado:** dois devs rodam `supabase db push` simultaneamente — um do laptop, outro do GitHub Actions workflow:

```bash
# Dev A — laptop
$ supabase db push
# aplicando migration_001...

# Workflow (paralelo)
$ supabase db push
# também aplicando migration_001...
```

**Por quê:** race condition em `supabase_migrations.schema_migrations` — duas conexões competem por lock, podem inserir duplicates, corromper history, ou deixar migration aplicada parcialmente; debugging pesadelo (state inconsistente entre history e schema real).

**Certo:**

1. **Workflows GitHub Actions são source of truth** — devs NÃO rodam `db push` em production manualmente
2. **Concurrency control nos workflows:**
   ```yaml
   # staging.yml e production.yml
   concurrency:
     group: deploy-${{ github.workflow }}
     cancel-in-progress: false
   ```
   `cancel-in-progress: false` enfileira execuções em vez de cancelar → previne race
3. **Para emergencial** — anunciar no Slack `#engineering` antes; verificar via Actions tab que nenhum workflow está running

### Anti-pattern 4: Secrets sem encryption nas configurações GitHub (plaintext em workflow)

**Errado:**

```yaml
# .github/workflows/staging.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_DB_PASSWORD: my-actual-password-here  # PLAINTEXT
      SUPABASE_ACCESS_TOKEN: sbp_actual_token_here   # PLAINTEXT
```

**Por quê:** workflow file é committed em git → password e access token expostos publicamente em git history → mesmo se removidos depois, git log preserva → rotação manual necessária + compromisso de qualquer secret encontrado.

**Certo:**

1. **Sempre via `secrets`:**
   ```yaml
   env:
     SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}
     SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
   ```
2. **Configurar via UI:** `Settings → Secrets and variables → Actions → New repository secret`
3. **Auditar histórico** — buscar acidentes:
   ```bash
   git log -p | grep -E '(password|token|secret|key)' | head -50
   ```
4. **Se vazou:** rotacionar TODOS os secrets imediatamente (Dashboard → reset DB password + revoke access token + create new token + update GitHub secret)

### Anti-pattern 5: Workflows sem `concurrency` control causando race em deploy

**Errado:** dois PRs mergem para `main` em rápida sucessão; workflow `production.yml` dispara 2× concorrentemente:

```yaml
# production.yml SEM concurrency
on:
  push:
    branches: [main]
```

PR #100 mergeado → workflow run #1 inicia → ainda rodando.
PR #101 mergeado → workflow run #2 inicia paralelo → `db push` concorrente → race em `supabase_migrations.schema_migrations`.

**Por quê:** Anti-pattern 3 manifestado em produção real; corrupção de migration history em produção; pode resultar em deploy parcial → schema inconsistente → app quebra.

**Certo:**

```yaml
# production.yml COM concurrency
on:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false  # enfileira, não cancela
```

`cancel-in-progress: false` é canônico — cancel-in-progress: true poderia abortar uma migration aplicação parcial → estado pior.

## Cross-suite integration (v1.27)

Esta skill é o **3º pilar do CI/CD canônico Supabase**:

- **`supabase-branching-workflow` (Phase 149)** — descreve **quando** preview branches são criados (PR webhook → branch DB isolado)
- **`supabase-config-toml-remotes` (Phase 150)** — descreve **como** configurar branch-specific overrides + secrets per-branch
- **`supabase-ci-cd-github-actions` (Phase 151, ESTA)** — descreve **como** automatizar via GitHub Actions workflows

Cross-refs com skills futuras v1.27:

- **`supabase-pgtap-testing` (Phase 152, futura)** — detalhes completos pgTAP que CI-05 (`database-tests.yml`) executa
- **`supabase-migration-repair` (Phase 153, futura)** — `migration repair` em workflow para recovery quando `db push` falha drift

Cross-refs com skills existentes v1.x:

- **`hermetic-builds`** — auditar workflows GitHub Actions para reproducibility (`actions/checkout@v4` pinado, `supabase/setup-cli@v1` pinado, `denoland/setup-deno@v2` pinado, lockfile committed)
- **`release-engineering`** — deployment philosophy (canary, feature flags, gradual rollout); `production.yml` Pattern 3 é deploy automático que pode evoluir para tag-based
- **`eliminating-toil`** — workflows substituem toil manual (deploy manual → automated push; backup manual → cron midnight)
- **`supabase-migrations` (v1.23)** — migration arquivos que `db push` consome
- **`supabase-postgres-roles` (v1.26)** — roles dumps em `backup.yml` Pattern 7

Base para agent novo v1.27:

- **`supabase-cicd-pipeline-implementer` (Phase 154, futura)** — recebe spec via `Task()` e materializa `.github/workflows/*.yml` + `[remotes.<branch>]` blocks + secrets configuration

Pattern de handoff cooperativo herdado v1.23-v1.26: **architect** projeta strategy → **cicd-pipeline-implementer** materializa workflows → **release-pipeline-auditor** (v1.10) audita hermeticidade do pipeline final. Nenhum agente descarta upstream — handoff cooperativo (princípio canônico v1.23).

## Ver também

- [supabase-branching-workflow](../supabase-branching-workflow/SKILL.md) (v1.27, Phase 149) — preview branches que ci.yml + notify-failure.yaml validam
- [supabase-config-toml-remotes](../supabase-config-toml-remotes/SKILL.md) (v1.27, Phase 150) — secrets management dotenvx + `[remotes]` blocks per-branch que workflows consomem
- [supabase-pgtap-testing](../supabase-pgtap-testing/SKILL.md) (v1.27, Phase 152, futura) — sintaxe pgTAP + setup que database-tests.yml roda
- [supabase-migration-repair](../supabase-migration-repair/SKILL.md) (v1.27, Phase 153, futura) — recovery quando db push falha em CI por drift
- [supabase-migrations](../supabase-migrations/SKILL.md) (v1.23) — migration files que db push aplica
- [supabase-postgres-roles](../supabase-postgres-roles/SKILL.md) (v1.26) — roles dumps em backup.yml Pattern 7
- [supabase-edge-functions](../supabase-edge-functions/SKILL.md) — Edge Functions que functions-tests.yml testa via Deno
- [hermetic-builds](../hermetic-builds/SKILL.md) — auditar workflows para reproducibility (actions pinned + lockfile + frozen-install)
- [release-engineering](../release-engineering/SKILL.md) — deployment philosophy + canary + rollback strategies
- [eliminating-toil](../eliminating-toil/SKILL.md) — workflows substituem toil manual (deploy + backup + types regen)
- [evolucao-schema-compativel](../evolucao-schema-compativel/SKILL.md) (v1.22) — 3-step migration safe pattern para mudanças destrutivas em production.yml
- [lgpd-multi-tenant-compliance](../lgpd-multi-tenant-compliance/SKILL.md) (v1.21) — backup criptografado per-tenant para compliance LGPD
- [glossário compartilhado](../_shared-supabase/glossary.md) — termos GitHub Actions Supabase, ci.yml, staging.yml, production.yml, backup 3-dump, fountainhead/action-wait-for-check, never backup to public repo
- Doc oficial: [Supabase GitHub Actions](https://supabase.com/docs/guides/deployment/ci), [GitHub Actions docs](https://docs.github.com/en/actions), [denoland/setup-deno](https://github.com/denoland/setup-deno), [stefanzweifel/git-auto-commit-action](https://github.com/stefanzweifel/git-auto-commit-action), [fountainhead/action-wait-for-check](https://github.com/fountainhead/action-wait-for-check)
