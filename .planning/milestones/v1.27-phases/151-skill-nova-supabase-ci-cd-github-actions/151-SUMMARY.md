# Fase 151 — SUMMARY

**Concluída:** 2026-05-11
**Plan:** 151-01-skill-ci-cd-github-actions
**Mode:** standard autonomous (1 plano, 1 wave)

## O que foi criado

### Arquivo novo

`kit/skills/supabase-ci-cd-github-actions/SKILL.md` — **880 linhas**

### REQs cobertos (8/8)

- **CI-01** — Workflow `ci.yml` (Pattern 1) — pull_request + workflow_dispatch + actions/checkout@v4 + supabase/setup-cli@v1 + supabase db start + verify generated types via `git diff --ignore-space-at-eol --exit-code --quiet types.gen.ts` + explicação line-by-line + caveats (false positives whitespace, exit-code, quiet) + por que validar types committed
- **CI-02** — Workflow `staging.yml` (Pattern 2) — push develop + workflow_dispatch + 3 env vars (SUPABASE_ACCESS_TOKEN, STAGING_DB_PASSWORD, STAGING_PROJECT_ID) + `supabase link --project-ref $SUPABASE_PROJECT_ID` + `supabase db push` + caveats (GitFlow develop convention, drift detection, idempotência)
- **CI-03** — Workflow `production.yml` (Pattern 3) — push main + PRODUCTION_DB_PASSWORD/PROJECT_ID secrets + tabela diferenças vs staging.yml + warning canônico cautela em deploy production + 4 mitigações (required checks, manual approval, pre-deploy hook) + alternativa tag-based deploy
- **CI-04** — Workflow `generate-types.yml` (Pattern 4) — pull_request + supabase init + db start + `gen types typescript --local > schema.gen.ts` + diff verify + diferenças vs Pattern 1 + workflow developer local + caveat naming convention
- **CI-05** — Workflow `database-tests.yml` (Pattern 5) — pull_request + actions/checkout@v3 + supabase/setup-cli@v1 + db start + `supabase test db` + anatomy teste pgTAP (plan/results_eq/throws_like/finish) + cross-ref skill futura Phase 152 + caveat exit code != 0 → CI fail
- **CI-06** — Workflow `functions-tests.yml` (Pattern 6) — pull_request + denoland/setup-deno@v2 + supabase start + `deno test --allow-all deno-test.ts --env-file .env.local` + workflow `.env.local` para CI (captura via grep) + anatomy teste Deno + caveat Edge Functions runtime fora do test
- **CI-07** — Workflow `backup.yml` (Pattern 7) — push/PR/dispatch/schedule cron midnight + 3-dump pattern (roles --role-only, schema, data --data-only --use-copy) + stefanzweifel/git-auto-commit-action@v4 + tabela por que 3 dumps separados + caveats (rotação, retention policy externa, criptografia git-crypt, restore procedure documentado, frequência, branching) + diferença vs PITR managed Supabase + **2 BANNERS WARNING "Never backup your data to a public repository"** (início + final do Pattern 7)
- **CI-08** — Workflow `notify-failure.yaml` (Pattern 8) — pull_request types opened/reopened/synchronize + paths supabase/** + fountainhead/action-wait-for-check@v1.2.0 + checkName Supabase Preview + token GITHUB_TOKEN + exit 1 on failure + por que separar este workflow (branch protection integration) + lista canônica required checks recomendados

## Estrutura canônica (pattern v1.26-v1.27)

1. Frontmatter YAML (name + description com trigger phrases + caveat "never backup to public repo")
2. `## Quando usar` — trigger phrases + use APENAS para / NÃO use para
3. `## Princípio canônico` — 4 princípios + distinção canônica vs Supabase Branching
4. `## Secrets GitHub Actions necessários` — tabela 6 secrets (SUPABASE_ACCESS_TOKEN, STAGING_DB_PASSWORD, STAGING_PROJECT_ID, PRODUCTION_DB_PASSWORD, PRODUCTION_PROJECT_ID, SUPABASE_DB_URL) + 3 caveats (per-user, rotação 90 dias, encryption default)
5. `## Pattern 1: ci.yml` (CI-01)
6. `## Pattern 2: staging.yml` (CI-02)
7. `## Pattern 3: production.yml` (CI-03)
8. `## Pattern 4: generate-types.yml` (CI-04)
9. `## Pattern 5: database-tests.yml` (CI-05)
10. `## Pattern 6: functions-tests.yml` (CI-06)
11. `## Pattern 7: backup.yml` (CI-07) — com 2 banners WARNING canônicos
12. `## Pattern 8: notify-failure.yaml` (CI-08)
13. `## Anti-patterns` — 5 anti-patterns formato Errado/Por quê/Certo
14. `## Cross-suite integration (v1.27)` — 3º pilar CI/CD canônico + cross-refs skills v1.27 + agent novo Phase 154
15. `## Ver também` — 13 cross-refs (10 skills + glossário + doc oficial 5 links)

## Anti-patterns (5 — todos Errado/Por quê/Certo)

1. **Backup em repo público** — dados sensíveis expostos forever; mitigação repo PRIVADO + verify visibility API + git-crypt para PII + repo dedicado para backups
2. **Schema changes direto no remote (bypass migration history)** — drift entre git e DB; mitigação sempre `supabase migration new` + PR workflow + `migration repair` se emergencial via Dashboard
3. **Concurrent `db push` from different machines** — race condition em `supabase_migrations.schema_migrations`; mitigação workflows como source of truth + concurrency control + anúncio Slack para emergencial
4. **Secrets sem encryption nas configurações GitHub (plaintext em workflow)** — git history preserva forever; mitigação `secrets.*` syntax + UI configuration + audit history + rotação imediata se vazou
5. **Workflows sem `concurrency` control causando race em deploy** — production.yml dispara 2× em PRs em rápida sucessão; mitigação `concurrency: group: deploy-production, cancel-in-progress: false`

## Warning canônico "Never backup your data to a public repository"

Aparece **3×** no arquivo (≥ 2× exigido):

1. Pattern 7 banner início (callout destacado com explicação PII)
2. Pattern 7 banner final (callout destacado com 4 mitigações: verify visibility, branch protection, audit admins, repo dedicado)
3. Anti-pattern 1 (Backup em repo público) — contexto adicional

## Cross-refs

**Skills atuais referenciadas (10):**

- supabase-branching-workflow (v1.27, Phase 149) — pré-requisito conceitual; CI-08 propaga "Supabase Preview" check
- supabase-config-toml-remotes (v1.27, Phase 150) — secrets management dotenvx
- supabase-migrations (v1.23) — migration files que `db push` consome
- supabase-postgres-roles (v1.26) — roles dumps em backup.yml
- supabase-edge-functions — Edge Functions que functions-tests.yml testa
- hermetic-builds — auditar workflows reproducibility
- release-engineering — deployment philosophy
- eliminating-toil — workflows substituem toil manual
- evolucao-schema-compativel (v1.22) — 3-step migration safe para mudanças destrutivas
- lgpd-multi-tenant-compliance (v1.21) — backup criptografado per-tenant LGPD

**Skills futuras v1.27 referenciadas (2):**

- supabase-pgtap-testing (Phase 152) — detalhes pgTAP que CI-05 executa
- supabase-migration-repair (Phase 153) — recovery quando db push falha drift

**Outros:**

- glossário compartilhado (`_shared-supabase/glossary.md`)
- Doc oficial Supabase (5 links: GitHub Actions guide, GitHub Actions docs, denoland/setup-deno, stefanzweifel/git-auto-commit-action, fountainhead/action-wait-for-check)

## Decisões canônicas registradas

- **Warning "Never backup to public repo" 3×** — Pattern 7 banner início + banner final + Anti-pattern 1 contexto (canônico da doc oficial)
- **Secrets centralizados antes de Patterns** — facilita configuração GitHub Settings em um único lugar; tabela 6 secrets com origem/workflows/caso de uso
- **3-dump pattern separados** — roles + schema + data isolation por concerns (tabela canônica explicando por que separar)
- **Required checks recomendados** — lista canônica (5 checks: CI/test, generate-types/build, database-tests/build, functions-tests/build, notify-failure/failed); separar daqueles que NÃO devem ser required (backup, deploy)
- **Concurrency control** — `cancel-in-progress: false` para enfileirar e não cancelar (Anti-pattern 5)
- **Pattern Errado/Por quê/Certo** — herdado v1.26 (supabase-postgres-roles)
- **Convenção PT-BR** (v1.22+) — texto PT-BR, code blocks YAML/bash EN com comentários PT-BR
- **Distinção canônica vs Supabase Branching** — workflows automatizam **código**; Branching gerencia **ambiente**; são complementares (não competidores)

## Validação de acceptance criteria

Todos os critérios das 13 tasks (T1..T13) validados:

- T1: frontmatter YAML válido + name + description com trigger phrases incluindo "never backup to public repo"
- T2: seções `Quando usar`, `Princípio canônico`, `Secrets GitHub Actions necessários` presentes
- T3-T10: Patterns 1-8 com YAML completo + explicação line-by-line + caveats
- T11: 5 anti-patterns ≥ 4 com Errado/Por quê/Certo
- T12: Cross-suite integration + Ver também + cross-refs todos presentes + doc oficial 5 links
- T13: 880 linhas ≥ 700, frontmatter --- abre/fecha, todos CI-01..08 cobertos, warning ≥ 2× (3× verificado)

## Tamanho final

**880 linhas** (target 700-900) — atingiu target sem extrapolar; cada Pattern tem nível de detalhamento equivalente (~70-100 linhas) + 2 banners WARNING canônicos no Pattern 7.
