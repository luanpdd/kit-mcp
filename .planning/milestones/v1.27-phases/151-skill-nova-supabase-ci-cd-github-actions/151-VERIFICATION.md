---
phase: 151
status: passed
verified_at: 2026-05-11
verifier: autonomous-mode
---

# Verification: Phase 151 — Skill nova `supabase-ci-cd-github-actions`

## Status: PASSED

## Goal-backward check

**Objetivo da fase:** Criar skill canônica `supabase-ci-cd-github-actions` cobrindo CI-01..08 com warning canônico "Never backup your data to a public repository" repetido ≥ 2× no arquivo.

## must_haves verificados (17/17)

| # | must_have | Verificação | Status |
|---|-----------|-------------|--------|
| 1 | Frontmatter YAML válido com name=supabase-ci-cd-github-actions | `grep -q "^name: supabase-ci-cd-github-actions$"` | PASS |
| 2 | Description com trigger phrases incluindo "never backup to public repo" | description menciona 8 workflows + secrets centralizados + caveat backup | PASS |
| 3 | Seção "Quando usar" com trigger phrases | trigger phrases (CI Supabase, GitHub Actions, ci.yml/staging.yml/production.yml/backup.yml/etc.) presentes | PASS |
| 4 | Seção "Princípio canônico" (4 princípios) | 4 princípios + distinção canônica vs Supabase Branching | PASS |
| 5 | Seção "Secrets GitHub Actions necessários" com 6 secrets | tabela com SUPABASE_ACCESS_TOKEN, STAGING/PRODUCTION_DB_PASSWORD/PROJECT_ID, SUPABASE_DB_URL + 3 caveats | PASS |
| 6 | CI-01: Pattern 1 ci.yml com YAML completo | YAML pull_request + workflow_dispatch + actions/checkout@v4 + setup-cli + db start + verify types via git diff --ignore-space-at-eol --exit-code | PASS |
| 7 | CI-02: Pattern 2 staging.yml com YAML completo | YAML push develop + STAGING_* secrets + supabase link --project-ref + db push | PASS |
| 8 | CI-03: Pattern 3 production.yml com YAML completo | YAML push main + PRODUCTION_* secrets + tabela diferenças vs staging.yml + alternativa tag-based | PASS |
| 9 | CI-04: Pattern 4 generate-types.yml com YAML completo | YAML pull_request + supabase init + db start + gen types > schema.gen.ts + diff verify | PASS |
| 10 | CI-05: Pattern 5 database-tests.yml com YAML completo | YAML pull_request + setup-cli + db start + supabase test db + cross-ref pgTAP Phase 152 | PASS |
| 11 | CI-06: Pattern 6 functions-tests.yml com YAML completo | YAML pull_request + denoland/setup-deno@v2 + supabase start + deno test --allow-all --env-file .env.local | PASS |
| 12 | CI-07: Pattern 7 backup.yml com YAML completo + BANNER WARNING 2× | YAML push/PR/dispatch/schedule cron midnight + 3-dump pattern + auto-commit; warnings "Never backup your data to a public repository" 2× no Pattern 7 (início + final) | PASS |
| 13 | CI-08: Pattern 8 notify-failure.yaml com YAML completo | YAML pull_request types opened/reopened/synchronize + paths supabase/** + fountainhead/action-wait-for-check@v1.2.0 + exit 1 | PASS |
| 14 | ≥ 4 anti-patterns Errado/Por quê/Certo | 5 anti-patterns documentados | PASS |
| 15 | Cross-suite integration (v1.27) | seção presente linkando supabase-branching-workflow (Phase 149) + supabase-config-toml-remotes (Phase 150) + skills futuras (Phases 152-154) | PASS |
| 16 | Ver também com cross-refs canônicos | 13 cross-refs (10 skills + glossário + doc oficial 5 links) | PASS |
| 17 | Tamanho 700-900 linhas + warning ≥ 2× no arquivo | 880 linhas + "Never backup your data to a public repository" 3× | PASS |

## REQs cobertos (8/8)

- **CI-01** — Workflow `ci.yml` (Pattern 1)
- **CI-02** — Workflow `staging.yml` (Pattern 2)
- **CI-03** — Workflow `production.yml` (Pattern 3)
- **CI-04** — Workflow `generate-types.yml` (Pattern 4)
- **CI-05** — Workflow `database-tests.yml` (Pattern 5)
- **CI-06** — Workflow `functions-tests.yml` (Pattern 6)
- **CI-07** — Workflow `backup.yml` (Pattern 7) + WARNING 2× canônico
- **CI-08** — Workflow `notify-failure.yaml` (Pattern 8)

## Warning canônico validado

**"Never backup your data to a public repository"** aparece **3×** no arquivo (gate canônico exigia ≥ 2×):

| Localização | Linhas aprox. | Contexto |
|-------------|---------------|----------|
| Pattern 7 banner início | ~501 | Callout destacado antes do YAML workflow (explicação PII + repo PRIVADO) |
| Pattern 7 banner final | ~589 | Callout destacado após Pattern 7 explanation (4 mitigações canônicas: verify visibility, branch protection, audit admins, repo dedicado) |
| Anti-pattern 1 | ~684 | Contexto Errado/Por quê/Certo para "Backup em repo público" |

## Anti-patterns validados (5 ≥ 4 exigidos)

1. Backup em repo público (linha 684)
2. Schema changes direto no remote (bypass migration history) (linha 717)
3. Concurrent `db push` from different machines (linha 747)
4. Secrets sem encryption nas configurações GitHub (linha 776)
5. Workflows sem `concurrency` control causando race em deploy (linha 807)

Todos no formato Errado/Por quê/Certo.

## Patterns validados (8/8)

Headings detectados via `grep "^## Pattern [0-9]:"`:

| Linha | Heading |
|-------|---------|
| 97 | `## Pattern 1: ci.yml — validation on pull request (CI-01)` |
| 153 | `## Pattern 2: staging.yml — deploy migrations to staging (CI-02)` |
| 200 | `## Pattern 3: production.yml — deploy migrations to production (CI-03)` |
| 265 | `## Pattern 4: generate-types.yml — verify schema.gen.ts committed (CI-04)` |
| 326 | `## Pattern 5: database-tests.yml — pgTAP runner (CI-05)` |
| 395 | `## Pattern 6: functions-tests.yml — Deno tests for Edge Functions (CI-06)` |
| 497 | `## Pattern 7: backup.yml — automated 3-dump backup with auto-commit (CI-07)` |
| 602 | `## Pattern 8: notify-failure.yaml — propagate Supabase Preview check failure (CI-08)` |

## Estrutura canônica validada (v1.26-v1.27)

- Frontmatter --- abre/fecha
- Quando usar (trigger phrases + use APENAS / NÃO use)
- Princípio canônico (4 princípios + distinção vs Branching)
- Secrets GitHub Actions necessários (centralizado, 6 secrets tabela + 3 caveats)
- Pattern 1-8 (cada um com YAML completo + explicação line-by-line + caveats)
- Anti-patterns (5 com Errado/Por quê/Certo)
- Cross-suite integration (v1.27)
- Ver também (13 cross-refs)

## Artefatos

- `kit/skills/supabase-ci-cd-github-actions/SKILL.md` (880 linhas)
- `.planning/phases/151-skill-nova-supabase-ci-cd-github-actions/151-01-skill-ci-cd-github-actions-PLAN.md`
- `.planning/phases/151-skill-nova-supabase-ci-cd-github-actions/151-SUMMARY.md`

## Próximo

Phase 152 — Skill `supabase-pgtap-testing` (TEST-01..04 — pgTAP setup + sintaxe + supabase test db runner + cross-ref legacy-characterizer)
