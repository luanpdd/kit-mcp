# Fase 153: Skill nova `supabase-migration-repair` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Criar skill `kit/skills/supabase-migration-repair/SKILL.md` cobrindo:
- Diagnóstico via `supabase migration list` (compara local vs remote)
- `supabase migration repair --status applied|reverted <migration-timestamp>` (tracking table ONLY, NÃO aplica SQL)
- Rollback preview via delete+reopen (PR close+reopen)
- Schema drift handling após git rebase (rename timestamps)
- Permission denied troubleshooting (graphql schema grant, custom_role to postgres)

Entregar 5 REQs: REPAIR-01..05.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Pattern canônico v1.26. Skill provavelmente 500-700 linhas.

</decisions>

<code_context>
## Insights do Código Existente

Cross-refs:
- supabase-migrations — pattern de migrations
- supabase-branching-workflow (Phase 149) — preview branch rollback
- supabase-postgres-roles (v1.26) — grant para custom roles

</code_context>

<specifics>
## Ideias Específicas

- `migration repair` é tracking table only — NUNCA aplica/reverte SQL
- Tracking table: `supabase_migrations.schema_migrations`
- Rollback preview: delete branch + reopen PR = `supabase db reset` equivalente
- Permission denied típico: pg_dump query failed → grant graphql to postgres+anon+authenticated+service_role
- Permission denied custom role: db push 42501 → `grant "custom_role" to "postgres"`

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma.

</deferred>
