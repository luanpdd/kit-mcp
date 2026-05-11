# Requisitos: kit-mcp — Milestone v1.27

**Definidos:** 2026-05-11
**Valor Central:** Single canonical source para fluxo de trabalho IA dev sincronizado em 8 IDEs alvo. v1.27 adiciona pattern canônico de **branching workflow + CI/CD GitHub Actions** à Suíte Supabase — profissionaliza o fluxo de deploy substituindo "push direto na main" por preview branches + pipelines automatizadas. Complementa as 4 trilhas de segurança Supabase (RLS v1.23 + Column-Level v1.24 + Custom Claims v1.25 + Postgres Roles v1.26) com a **9ª trilha** do kit: deployment maturity.

**Princípio canônico (herdado v1.23-v1.26):** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam. Nenhum lado descarta upstream.

**Material-fonte:** documentação oficial Supabase Branching + CI/CD GitHub Actions (11 markdowns, cobertura 100%).

**Distinção canônica:**
- Trilhas v1.23-v1.26 (segurança de dados): controlam **quem vê o quê**
- Trilha v1.27 (deployment maturity): controla **como mudanças chegam à produção**

## Requisitos v1.27

### BRANCH — Skill nova `supabase-branching-workflow` (5)

- [ ] **BRANCH-01**: Skill documenta diferença entre preview (ephemeral, auto-pause em inatividade, auto-delete em PR merge/close) e persistent branches (long-lived staging/QA, não auto-pause) com critério de escolha
- [ ] **BRANCH-02**: Skill descreve deploy DAG 7 steps (clone → pull → health → configure → migrate → seed → deploy) + skip behavior em falha de parent step (ex: migrate falha em step 5 → seed step 6 skipped)
- [ ] **BRANCH-03**: Skill documenta GitHub integration setup (Authorize Supabase, working directory, automatic branching toggle, "Supabase changes only" filter, deploy to production toggle)
- [ ] **BRANCH-04**: Skill documenta Dashboard branching alpha caveats (custom roles não capturados no branch creation, merge só para main não entre preview branches, edge functions sobrescritas no "update branch", delete de functions manual em main)
- [ ] **BRANCH-05**: Skill alerta custo Branching Compute Hours (Micro $0.01344/h, **fora do Spend Cap**, Compute Credits NÃO aplicam, billing como "Branching Compute Hours" no invoice)

### CFG — Skill nova `supabase-config-toml-remotes` (5)

- [ ] **CFG-01**: Skill documenta `[remotes.<name>]` block referencing existing `project_id` (obtido via `supabase --experimental branches list`), com exemplo staging/production
- [ ] **CFG-02**: Skill cobre branch-specific configuration overrides (db.pool_size, api.max_rows, db.seed.sql_paths, auth.external.*, edge_runtime.secrets)
- [ ] **CFG-03**: Skill documenta secret management per-branch (`supabase secrets set --env-file ./supabase/.env`; secrets NÃO herdam entre branches; cada branch tem credenciais únicas)
- [ ] **CFG-04**: Skill documenta dotenvx pattern (.env.keys decryption key + .env.preview/.env.production encrypted values), `encrypted:` vs `env()` syntax (encrypted: só funciona em fields designados; env() para non-secret fields)
- [ ] **CFG-05**: Skill lista os 6 grupos de encrypted fields canônicos da doc oficial (Studio openai_api_key; Database root_key + vault; Auth Core/Email SMTP/Captcha/Hooks/SMS/External; Edge Runtime secrets)

### CI — Skill nova `supabase-ci-cd-github-actions` (8)

- [ ] **CI-01**: Workflow `ci.yml` canônico (pull_request + supabase/setup-cli@v1 + supabase db start + verify generated types committed via `git diff --ignore-space-at-eol --exit-code`)
- [ ] **CI-02**: Workflow `staging.yml` (push branch develop + secrets SUPABASE_ACCESS_TOKEN/STAGING_DB_PASSWORD/STAGING_PROJECT_ID + supabase link + supabase db push)
- [ ] **CI-03**: Workflow `production.yml` (push branch main + secrets PRODUCTION_DB_PASSWORD/PRODUCTION_PROJECT_ID + supabase link + supabase db push)
- [ ] **CI-04**: Workflow `generate-types.yml` (pull_request + supabase init + db start + gen types typescript --local > schema.gen.ts + fail se diff exit-code 1)
- [ ] **CI-05**: Workflow `database-tests.yml` (actions/checkout + setup-cli + supabase db start + `supabase test db` pgTAP runner)
- [ ] **CI-06**: Workflow `functions-tests.yml` (actions/checkout + setup-cli + denoland/setup-deno@v2 + supabase start + `deno test --allow-all deno-test.ts --env-file .env.local`)
- [ ] **CI-07**: Workflow `backup.yml` (3-dump pattern: roles `--role-only` + schema + data `--data-only --use-copy`; schedule cron `'0 0 * * *'` midnight + workflow_dispatch + push/PR triggers; auto-commit via `stefanzweifel/git-auto-commit-action@v4` "Supabase backup"; **warning explícito "never backup to public repo" 2×** na skill)
- [ ] **CI-08**: Workflow `notify-failure.yaml` (pull_request types opened/reopened/synchronize + fountainhead/action-wait-for-check@v1.2.0 Supabase Preview check + exit 1 on conclusion failure)

### TEST — Skill nova `supabase-pgtap-testing` (4)

- [ ] **TEST-01**: Skill documenta pgTAP extension setup (`create extension pgtap`) + criação de unit tests em supabase/tests/*.sql com sintaxe canônica (plan/ok/is/throws_ok/finish)
- [ ] **TEST-02**: Skill documenta `supabase test db` runner local + integração CI workflow (CI-05)
- [ ] **TEST-03**: Skill documenta Deno Edge Function testing pattern (deno-test.ts file + .env.local + `deno test --allow-all`)
- [ ] **TEST-04**: Skill cross-refs `legacy-characterizer` (Feathers suite v1.x) — pgTAP como mecanismo para characterization tests em PG functions/RLS policies/triggers, gap testing nunca antes coberto no kit-mcp

### REPAIR — Skill nova `supabase-migration-repair` (5)

- [ ] **REPAIR-01**: Skill documenta diagnóstico via `supabase migration list` (compara local supabase/migrations/ folder vs remote supabase_migrations.schema_migrations table)
- [ ] **REPAIR-02**: Skill documenta `supabase migration repair --status applied|reverted <migration-timestamp>` (atualiza tracking table only, NÃO aplica/reverte SQL — use para corrigir history record quando schema state real está OK)
- [ ] **REPAIR-03**: Skill documenta rollback de preview branch via delete + reopen (PR close+reopen equivalente a `supabase db reset` local; reseed do seed.sql; perda de data changes adicionais não em seed)
- [ ] **REPAIR-04**: Skill documenta schema drift handling após git rebase (rename migration files com timestamps em ordem cronológica correta, supabase db reset local; changes que dependem de earlier changes devem ter later timestamps)
- [ ] **REPAIR-05**: Skill documenta permission denied troubleshooting — db pull error "permission denied for table _type" → grant graphql schema (postgres+anon+authenticated+service_role); db push erro 42501 com custom role → `grant "custom_role" to "postgres"`

### ARCH — Agent novo `supabase-branching-architect` (5)

- [ ] **ARCH-01**: Agent coleta via AskUserQuestion: GitHub integration vs Dashboard alpha (default recomendação: GitHub porque Dashboard tem limitações documentadas)
- [ ] **ARCH-02**: Agent coleta: persistent (staging/QA long-lived) vs ephemeral (preview auto-pause) — pode haver mix (ex: persistent staging + features ephemeral)
- [ ] **ARCH-03**: Agent coleta: seed strategy (seed.sql default da doc oficial vs custom ORM via fountainhead/action-wait-for-check workflow)
- [ ] **ARCH-04**: Agent coleta: secret strategy (CLI direct via `supabase secrets set` vs dotenvx encrypted commits via .env.preview/.env.production)
- [ ] **ARCH-05**: Agent produz `BRANCHING-DESIGN.md` com decisões coletadas + cross-suite delega para `supabase-architect` (handoff cooperativo herdado v1.23)

### CICD — Agent novo `supabase-cicd-pipeline-implementer` (5)

- [ ] **CICD-01**: Agent recebe BRANCHING-DESIGN.md como input + materializa os 7 workflows .github/workflows/ (ci, staging, production, generate-types, database-tests, functions-tests, backup, notify-failure) baseado nas decisões coletadas pelo branching-architect
- [ ] **CICD-02**: Agent lista secrets necessários no GitHub Actions repository settings (SUPABASE_ACCESS_TOKEN personal token, PRODUCTION_PROJECT_ID, PRODUCTION_DB_PASSWORD, STAGING_PROJECT_ID, STAGING_DB_PASSWORD, SUPABASE_DB_URL para backup)
- [ ] **CICD-03**: Cross-suite handoff para `supabase-migration-writer` (v1.23) — migrations referenciadas pelos workflows seguem template v1.23+ (5 blocos obrigatórios + GRANT antes RLS + naming YYYYMMDDHHmmss_short)
- [ ] **CICD-04**: Cross-suite handoff para `release-pipeline-auditor` (v1.10) — audit hermeticidade do pipeline gerado (lockfile commitado, no network in build, frozen-install, image SHA pinned)
- [ ] **CICD-05**: Agent verdicts GO/STRENGTHEN/REWRITE-com-confirmação (pattern canônico v1.23) — STRENGTHEN ajusta com diff, REWRITE requer confirmação pelo user

### XS — Cross-suite enrichment em 3 agents v1.x (3)

- [ ] **XS-01**: `supabase-architect` (v1.8) ganha seção upfront "Branching Strategy Decision" no fluxo de prompts + alerta custo Branching Compute Hours antes de aprovar Pro plan
- [ ] **XS-02**: `supabase-migration-writer` (v1.23) ganha warnings sobre concurrent `db push` from different machines (coordenação 1 deployer por vez) + timestamp order após git rebase (rename arquivos)
- [ ] **XS-03**: `release-pipeline-auditor` (v1.10) ganha branching workflow validation no audit (required check Supabase Preview enforced, secrets stored em GitHub Actions repository, migration safety pre-merge no preview branch)

### REL — Release artifacts (5)

- [ ] **REL-01**: AUTOGEN-COUNTS regen (64→66 agents = +2: branching-architect + cicd-pipeline-implementer; 71→76 skills = +5: branching-workflow + config-toml-remotes + ci-cd-github-actions + pgtap-testing + migration-repair)
- [ ] **REL-02**: file-manifest regen (375 + 7 novos files = 382)
- [ ] **REL-03**: CHANGELOG v1.27 entry com escopo + decisões canônicas + breaking-changes (none — todos aditivos)
- [ ] **REL-04**: glossário compartilhado +10 termos (branching workflow, preview branch, persistent branch, deploy DAG, [remotes] block, dotenvx encrypted fields, pgTAP testing, migration repair, schema drift, Branching Compute Hours)
- [ ] **REL-05**: package.json bump 1.26.0→1.27.0 + tag v1.27.0

## Requisitos Futuros (deferidos para v1.28+)

- Supabase Vault encryption-at-rest para PII columns (separado de branching)
- Backup & Recovery dedicado (RTO/RPO, PITR, restore drills) — escopo próprio
- Outros Auth Hooks além de Custom Access Token (Send Email, Send SMS, MFA Verification, Password Verification, Before User Created)
- MFA enforcement patterns (AAL2 obrigatório por role/permission)
- Realtime authorization patterns avançados
- Terraform provider (alternativa IaC ao GitHub branching — marco próprio se decisão for migrar para IaC)
- SOC 2 compliance específico (compliance enterprise — só quando houver cliente B2B exigindo)

## Fora do Escopo

- **Mudanças no framework core** — v1.27 é content-only milestone (skills + agents); zero deps novas, zero breaking changes na API
- **Re-arquitetura de marcos anteriores** — princípio canônico v1.23 (handoff cooperativo) preservado intacto
- **Multi-cloud deployment** — Supabase é o único alvo; deploy a outros providers (Vercel via Supabase ↔ Vercel integration) está fora de escopo direto, mas referenciado em CI-08 como exemplo
- **Migração retroativa** — projetos consumidores existentes que querem adotar branching seguem a doc oficial; kit-mcp não força migração

## Rastreabilidade

(Preenchida pelo roadmap após `/novo-marco` step 10)
