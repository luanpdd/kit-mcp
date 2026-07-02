# Fase 151: Skill nova `supabase-ci-cd-github-actions` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Criar skill canônica `kit/skills/supabase-ci-cd-github-actions/SKILL.md` provendo os **8 workflows GitHub Actions canônicos** da doc oficial Supabase:

1. `ci.yml` — pull_request + setup-cli + db start + verify types committed
2. `staging.yml` — push develop + STAGING_* secrets + supabase link/db push
3. `production.yml` — push main + PRODUCTION_* secrets + supabase link/db push
4. `generate-types.yml` — schema.gen.ts verification on PR
5. `database-tests.yml` — pgTAP runner (`supabase test db`)
6. `functions-tests.yml` — Deno tests (denoland/setup-deno@v2 + `deno test --allow-all`)
7. `backup.yml` — 3-dump pattern (roles + schema + data) + cron midnight + auto-commit
8. `notify-failure.yaml` — fountainhead/action-wait-for-check + exit 1 on failure

Entregar 8 REQs: CI-01..08.

**Warning canônico (BANNER 2× na skill):** "Never backup your data to a public repository."

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Pattern canônico v1.26. Skill grande (esta tem 8 REQs vs 5 das outras) — provavelmente 700-900 linhas. Cada workflow merece sua subseção com YAML completo.

</decisions>

<code_context>
## Insights do Código Existente

Cross-refs:
- supabase-branching-workflow (Phase 149) — pré-requisito para entender preview branches
- supabase-config-toml-remotes (Phase 150) — secrets que os workflows referenciam
- hermetic-builds — auditar workflows gerados para reproducibility
- release-engineering — deployment philosophy

</code_context>

<specifics>
## Ideias Específicas

- Warning "never to public repo" 2× repetido (canônico da doc)
- Backup workflow tem 3 dumps separados (roles --role-only, schema, data --data-only --use-copy)
- Cron diário midnight `'0 0 * * *'`
- Auto-commit via `stefanzweifel/git-auto-commit-action@v4`
- Secrets necessários: SUPABASE_ACCESS_TOKEN, PRODUCTION_DB_PASSWORD, PRODUCTION_PROJECT_ID, STAGING_DB_PASSWORD, STAGING_PROJECT_ID, SUPABASE_DB_URL

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma.

</deferred>
