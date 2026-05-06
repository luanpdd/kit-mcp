# Fase 28: Validação cross-IDE + 5 audit gates + cleanup - Contexto

**Coletado:** 2026-05-06
**Status:** Concluída
**Modo:** Smart discuss em modo autônomo

<domain>
## Limite da Fase

Entregar 5 audit gates novos em `gates/`, migrar UUID pessoal de `schema-checker.md`, atualizar CHANGELOG/MILESTONES/STATE para v1.8.0, e validar cross-IDE.

</domain>

<decisions>
## Decisões de Implementação

### Gates (markdown specs com bash check inline)
- **D-28-01:** Gates como arquivos `gates/<name>.md` (existing pattern), não scripts `.mjs` separados. Frontmatter: `id`, `stage` (pre-verify/post-verify), `blocking`, `description`. Body: `## Check` com bash code block.
- **D-28-02:** 4 gates blocking (`budget-description`, `no-personal-uuid`, `agent-no-recursive-dispatch`, `skill-must-include`) + 1 non-blocking (`sync-idempotent` — ambient failures viram warn).

### UUID cleanup
- **D-28-03:** `kit/agents/schema-checker.md` migrado: `mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql/list_tables` → `mcp__supabase__execute_sql/list_tables/apply_migration`. Breaking interno documentado no CHANGELOG.

### Validação cross-IDE
- **D-28-04:** Smoke test sintético — confirmar que sync para 8 IDEs continua produzindo output válido (sem rodar 8 IDEs reais, dado escopo de single session). Gate `sync-idempotent` valida idempotência.

</decisions>
