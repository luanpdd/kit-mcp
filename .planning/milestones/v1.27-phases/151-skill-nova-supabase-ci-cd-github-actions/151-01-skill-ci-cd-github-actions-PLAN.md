---
plan_id: 151-01-skill-ci-cd-github-actions
phase: 151
wave: 1
depends_on: []
autonomous: true
requirements:
  - CI-01
  - CI-02
  - CI-03
  - CI-04
  - CI-05
  - CI-06
  - CI-07
  - CI-08
files_modified:
  - kit/skills/supabase-ci-cd-github-actions/SKILL.md
estimated_lines: 800
must_haves:
  - "Frontmatter YAML válido com name=supabase-ci-cd-github-actions + description com trigger phrases (GitHub Actions Supabase, ci.yml, staging.yml, production.yml, generate-types.yml, database-tests.yml, functions-tests.yml, backup.yml, notify-failure.yaml, never backup to public repo)"
  - "Seção 'Quando usar' com trigger phrases canônicos + use APENAS para / NÃO use para"
  - "Seção 'Princípio canônico' (CI/CD shift-left + cada PR gera preview branch + required check enforced + 3-dump backup separados)"
  - "Seção 'Secrets GitHub Actions' centralizada listando 6 secrets necessários (SUPABASE_ACCESS_TOKEN, PRODUCTION_DB_PASSWORD, PRODUCTION_PROJECT_ID, STAGING_DB_PASSWORD, STAGING_PROJECT_ID, SUPABASE_DB_URL) + onde configurar Settings → Secrets and variables → Actions"
  - "CI-01: Pattern 1 — workflow `ci.yml` com YAML completo (pull_request + workflow_dispatch + actions/checkout@v4 + supabase/setup-cli@v1 + supabase db start + verify generated types via git diff --ignore-space-at-eol --exit-code) + explicação inline"
  - "CI-02: Pattern 2 — workflow `staging.yml` com YAML completo (push develop + STAGING_* secrets + supabase link + supabase db push) + explicação inline"
  - "CI-03: Pattern 3 — workflow `production.yml` com YAML completo (push main + PRODUCTION_* secrets + supabase link + supabase db push) + diferenças vs staging.yml"
  - "CI-04: Pattern 4 — workflow `generate-types.yml` com YAML completo (pull_request + supabase init + db start + gen types typescript --local > schema.gen.ts + fail se diff) + explicação inline"
  - "CI-05: Pattern 5 — workflow `database-tests.yml` com YAML completo (pull_request + setup-cli + db start + supabase test db) + cross-ref pgTAP Phase 152"
  - "CI-06: Pattern 6 — workflow `functions-tests.yml` com YAML completo (pull_request + setup-cli + denoland/setup-deno@v2 + supabase start + deno test --allow-all deno-test.ts --env-file .env.local) + explicação inline"
  - "CI-07: Pattern 7 — workflow `backup.yml` com YAML completo (push/PR/dispatch/schedule cron midnight + 3-dump pattern roles/schema/data + stefanzweifel/git-auto-commit-action@v4) + **BANNER WARNING 'Never backup your data to a public repository' DUAS VEZES** (uma no início, uma no final do pattern)"
  - "CI-08: Pattern 8 — workflow `notify-failure.yaml` com YAML completo (pull_request types opened/reopened/synchronize + paths supabase/** + fountainhead/action-wait-for-check@v1.2.0 + exit 1 on failure)"
  - "Seção 'Anti-patterns' com ≥ 4 anti-patterns formato Errado/Por quê/Certo (Backup em repo público, Schema changes direto no remote bypass migration history, Concurrent db push from different machines, Secrets sem encryption nas configurações GitHub)"
  - "Seção 'Cross-suite integration (v1.27)' linkando supabase-branching-workflow (Phase 149) + supabase-config-toml-remotes (Phase 150) + skills futuras Phases 152-154"
  - "Seção 'Ver também' com cross-refs (supabase-branching-workflow, supabase-config-toml-remotes, supabase-migrations, hermetic-builds, release-engineering, eliminating-toil, glossário) + doc oficial"
  - "Tamanho 700-900 linhas (skill maior por ter 8 patterns)"
  - "Warning 'Never backup your data to a public repository' aparece ≥ 2× no arquivo final"
---

# Plano 151-01: Skill nova `supabase-ci-cd-github-actions`

## Objetivo

Criar skill canônica `kit/skills/supabase-ci-cd-github-actions/SKILL.md` cobrindo os **8 workflows GitHub Actions canônicos** da doc oficial Supabase:

1. **CI-01** — `ci.yml` (pull_request + verify generated types committed)
2. **CI-02** — `staging.yml` (push develop + STAGING_* secrets + db push)
3. **CI-03** — `production.yml` (push main + PRODUCTION_* secrets + db push)
4. **CI-04** — `generate-types.yml` (pull_request + verify schema.gen.ts)
5. **CI-05** — `database-tests.yml` (supabase test db pgTAP runner)
6. **CI-06** — `functions-tests.yml` (Deno test --allow-all)
7. **CI-07** — `backup.yml` (3-dump pattern + cron midnight + auto-commit) **+ WARNING 2× "Never backup to public repo"**
8. **CI-08** — `notify-failure.yaml` (fountainhead/action-wait-for-check + exit 1)

Pattern canônico v1.26-v1.27. Conteúdo PT-BR. Code blocks YAML/bash EN com comentários PT-BR.

## Contexto upstream

- Material-fonte: doc oficial Supabase GitHub Actions (já incorporada em REQUIREMENTS.md CI-01..08 + prompt da fase)
- Skills pré-requisito: `supabase-branching-workflow` (Phase 149) + `supabase-config-toml-remotes` (Phase 150)
- Skills cross-ref canônicas: `hermetic-builds`, `release-engineering`, `eliminating-toil`, `supabase-migrations`
- Princípio canônico v1.23-v1.26: handoff cooperativo SQL (não BLOCK rígido)

## Tasks

<task id="151-01-T1" description="Criar diretório kit/skills/supabase-ci-cd-github-actions/ e SKILL.md com frontmatter">
  <action>
    Criar diretório `kit/skills/supabase-ci-cd-github-actions/`.
    Inicializar `SKILL.md` com frontmatter YAML name=supabase-ci-cd-github-actions + description trigger phrases incluindo "never backup to public repo" caveat.
  </action>
  <acceptance_criteria>
    - File exists
    - Frontmatter has name=supabase-ci-cd-github-actions
    - Description menciona "never backup to public repo" + 8 workflows
  </acceptance_criteria>
</task>

<task id="151-01-T2" description="Adicionar 'Quando usar' + 'Princípio canônico' + 'Secrets GitHub Actions'">
  <action>
    1. Título H1 `# Supabase — CI/CD GitHub Actions`
    2. Seção `## Quando usar` com trigger phrases (CI Supabase, GitHub Actions Supabase, supabase db push CI, staging.yml/production.yml/ci.yml/backup.yml workflows, pgTAP CI, Deno test CI)
    3. Seção `## Princípio canônico` — 3 princípios:
       - CI/CD shift-left — cada PR valida migrations + types antes do merge
       - Cada PR gera preview branch isolado (cross-ref Phase 149)
       - Required check enforced via branch protection rules
       - 3-dump backup separados (roles + schema + data) por isolamento de concerns
    4. Seção `## Secrets GitHub Actions necessários` centralizada — tabela 6 secrets + onde configurar (Settings → Secrets and variables → Actions)
  </action>
  <acceptance_criteria>
    - Section 'Quando usar' exists
    - Section 'Princípio canônico' exists com 3-4 princípios
    - Section 'Secrets GitHub Actions necessários' com tabela 6 secrets
  </acceptance_criteria>
</task>

<task id="151-01-T3" description="Adicionar Pattern 1: ci.yml (CI-01)">
  <action>
    Seção `## Pattern 1: ci.yml — validation on pull request` (CI-01) com YAML completo + explicação line-by-line + caveats (`git diff --ignore-space-at-eol --exit-code` previne false positives por whitespace; `workflow_dispatch` permite re-run manual).
  </action>
  <acceptance_criteria>
    - Section 'Pattern 1' com 'ci.yml' presente
    - YAML completo com pull_request + workflow_dispatch + actions/checkout@v4 + supabase/setup-cli@v1 + supabase db start + verify types via git diff
  </acceptance_criteria>
</task>

<task id="151-01-T4" description="Adicionar Pattern 2: staging.yml (CI-02)">
  <action>
    Seção `## Pattern 2: staging.yml — deploy migrations to staging` (CI-02) com YAML completo + secrets necessários (SUPABASE_ACCESS_TOKEN, STAGING_DB_PASSWORD, STAGING_PROJECT_ID) + explicação `supabase link --project-ref` antes de `db push`.
  </action>
  <acceptance_criteria>
    - Section 'Pattern 2' com 'staging.yml' presente
    - YAML completo com push develop + STAGING_* secrets + supabase link + db push
  </acceptance_criteria>
</task>

<task id="151-01-T5" description="Adicionar Pattern 3: production.yml (CI-03)">
  <action>
    Seção `## Pattern 3: production.yml — deploy migrations to production` (CI-03) com YAML completo + diferenças vs staging.yml (PRODUCTION_* secrets + push main) + warning sobre cautela.
  </action>
  <acceptance_criteria>
    - Section 'Pattern 3' com 'production.yml' presente
    - YAML completo com push main + PRODUCTION_* secrets
  </acceptance_criteria>
</task>

<task id="151-01-T6" description="Adicionar Pattern 4: generate-types.yml (CI-04)">
  <action>
    Seção `## Pattern 4: generate-types.yml — verify schema.gen.ts committed` (CI-04) com YAML completo + explicação porque commit types matters (consumer projetos TypeScript precisam types up-to-date).
  </action>
  <acceptance_criteria>
    - Section 'Pattern 4' com 'generate-types.yml' presente
    - YAML completo com supabase init + db start + gen types + diff verify
  </acceptance_criteria>
</task>

<task id="151-01-T7" description="Adicionar Pattern 5: database-tests.yml (CI-05)">
  <action>
    Seção `## Pattern 5: database-tests.yml — pgTAP runner` (CI-05) com YAML completo + cross-ref skill futuro Phase 152 (supabase-pgtap-testing).
  </action>
  <acceptance_criteria>
    - Section 'Pattern 5' com 'database-tests.yml' presente
    - YAML completo com supabase test db
    - Cross-ref pgTAP Phase 152
  </acceptance_criteria>
</task>

<task id="151-01-T8" description="Adicionar Pattern 6: functions-tests.yml (CI-06)">
  <action>
    Seção `## Pattern 6: functions-tests.yml — Deno tests for Edge Functions` (CI-06) com YAML completo + denoland/setup-deno@v2 + `deno test --allow-all deno-test.ts --env-file .env.local` + explicação `.env.local` para CI.
  </action>
  <acceptance_criteria>
    - Section 'Pattern 6' com 'functions-tests.yml' presente
    - YAML completo com denoland/setup-deno@v2 + supabase start + deno test
  </acceptance_criteria>
</task>

<task id="151-01-T9" description="Adicionar Pattern 7: backup.yml (CI-07) — WARNING 2× obrigatório">
  <action>
    Seção `## Pattern 7: backup.yml — automated 3-dump backup with auto-commit` (CI-07) com:

    1. **BANNER WARNING NO INÍCIO**: "Never backup your data to a public repository" (callout destacado)
    2. YAML completo com 3-dump pattern (roles --role-only + schema + data --data-only --use-copy) + cron midnight + auto-commit via stefanzweifel/git-auto-commit-action@v4
    3. Explicação de cada dump (porque separar roles, schema, data)
    4. **BANNER WARNING NO FINAL**: "Never backup your data to a public repository" (callout destacado)
    5. Caveats adicionais (rotação de backups, retention policy externa, criptografia em repo privado se PII)
  </action>
  <acceptance_criteria>
    - Section 'Pattern 7' com 'backup.yml' presente
    - YAML completo com 3-dump pattern
    - "Never backup your data to a public repository" aparece ≥ 2× no Pattern 7
  </acceptance_criteria>
</task>

<task id="151-01-T10" description="Adicionar Pattern 8: notify-failure.yaml (CI-08)">
  <action>
    Seção `## Pattern 8: notify-failure.yaml — propagate Supabase Preview check failure` (CI-08) com YAML completo + fountainhead/action-wait-for-check@v1.2.0 + paths supabase/** + exit 1 on failure.
  </action>
  <acceptance_criteria>
    - Section 'Pattern 8' com 'notify-failure.yaml' presente
    - YAML completo com fountainhead/action-wait-for-check + exit 1
  </acceptance_criteria>
</task>

<task id="151-01-T11" description="Adicionar Anti-patterns ≥ 4 com Errado/Por quê/Certo">
  <action>
    Seção `## Anti-patterns` com 4+ anti-patterns:

    ### Anti-pattern 1: Backup em repo público
    ### Anti-pattern 2: Schema changes direto no remote (bypass migration history)
    ### Anti-pattern 3: Concurrent `db push` from different machines
    ### Anti-pattern 4: Secrets sem encryption nas configurações GitHub (commitar plaintext em workflow files)
  </action>
  <acceptance_criteria>
    - Section 'Anti-patterns' exists
    - ≥ 4 anti-patterns no formato Errado/Por quê/Certo
  </acceptance_criteria>
</task>

<task id="151-01-T12" description="Adicionar Cross-suite integration + Ver também">
  <action>
    1. `## Cross-suite integration (v1.27)`:
       - Esta skill consome `supabase-branching-workflow` (Phase 149 — preview branches que ci.yml/notify-failure.yaml gating)
       - Esta skill consome `supabase-config-toml-remotes` (Phase 150 — secrets management dotenvx workflow CI)
       - Esta skill é pré-requisito para `supabase-pgtap-testing` (Phase 152 — CI-05 instancia testes pgTAP)
       - Esta skill é pré-requisito para `supabase-migration-repair` (Phase 153 — rollback em CI quando migrate falha)
       - Base para agent novo Phase 154 `supabase-cicd-pipeline-implementer`

    2. `## Ver também`:
       - supabase-branching-workflow (v1.27, Phase 149)
       - supabase-config-toml-remotes (v1.27, Phase 150)
       - supabase-pgtap-testing (v1.27, Phase 152, futura)
       - supabase-migration-repair (v1.27, Phase 153, futura)
       - supabase-migrations (v1.23)
       - hermetic-builds — auditar workflows para reproducibility
       - release-engineering — deployment philosophy
       - eliminating-toil — automação CI substitui toil manual
       - glossário compartilhado
       - Doc oficial: Supabase GitHub Actions guide + GitHub Actions docs
  </action>
  <acceptance_criteria>
    - Section 'Cross-suite integration (v1.27)' exists
    - Section 'Ver também' com cross-refs canônicos
  </acceptance_criteria>
</task>

<task id="151-01-T13" description="Validar tamanho mínimo e ocorrências warning">
  <action>
    Validar estado final:
    1. Tamanho ≥ 700 linhas (target 700-900)
    2. Frontmatter YAML válido
    3. Todas seções principais (Quando usar, Princípio canônico, Secrets GitHub Actions, Patterns 1-8, Anti-patterns, Cross-suite, Ver também)
    4. Todos 8 REQs cobertos (CI-01..08)
    5. ≥ 4 anti-patterns Errado/Por quê/Certo
    6. "Never backup your data to a public repository" aparece ≥ 2× no arquivo (gate canônico)
  </action>
  <acceptance_criteria>
    - File ≥ 700 linhas
    - 8 REQs cobertos (CI-01..08)
    - ≥ 4 anti-patterns
    - "Never backup your data to a public repository" ≥ 2× no arquivo
  </acceptance_criteria>
</task>

## Verificação de objetivo

Após T1..T13 completarem, executar verificação reversa:

1. **Existência:** `kit/skills/supabase-ci-cd-github-actions/SKILL.md` existe
2. **REQs cobertos:** 8/8 — CI-01 (ci.yml), CI-02 (staging.yml), CI-03 (production.yml), CI-04 (generate-types.yml), CI-05 (database-tests.yml), CI-06 (functions-tests.yml), CI-07 (backup.yml), CI-08 (notify-failure.yaml)
3. **Estrutura canônica v1.26-v1.27:** frontmatter + Quando usar + Princípio canônico + Secrets centralizados + Patterns 1-8 + Anti-patterns + Cross-suite + Ver também
4. **Tamanho:** ≥ 700 linhas (target 700-900)
5. **Anti-patterns:** ≥ 4 entries com pattern Errado/Por quê/Certo
6. **Warning canônico:** "Never backup your data to a public repository" ≥ 2× no arquivo
7. **Tom canônico:** PT-BR instrucional direto, code blocks YAML/bash EN com comentários PT-BR

## Decisões canônicas registradas

- **Warning "Never backup to public repo" 2×** — Pattern 7 banner início + final (canônico da doc oficial)
- **Secrets centralizados antes de Patterns** — facilita configuração GitHub Settings em um único lugar
- **3-dump pattern separados** — roles/schema/data isolation por concerns (canônico backup workflow)
- **Pattern Errado/Por quê/Certo** — herdado v1.26
- **Convenção PT-BR** (v1.22+) — texto PT-BR, code blocks YAML/bash EN com comentários PT-BR
