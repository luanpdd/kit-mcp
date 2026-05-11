# Fase 152: Skill nova `supabase-pgtap-testing` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Criar skill `kit/skills/supabase-pgtap-testing/SKILL.md` cobrindo:
- pgTAP extension setup (`create extension pgtap`)
- Unit tests em `supabase/tests/*.sql` com sintaxe canônica (plan/ok/is/throws_ok/finish)
- `supabase test db` runner local + integração CI workflow (referência ao Phase 151 CI-05)
- Deno Edge Function testing pattern (deno-test.ts + .env.local + `deno test --allow-all`)
- Cross-ref `legacy-characterizer` (Feathers suite) — pgTAP como mecanismo para characterization tests em PG functions/RLS policies/triggers

Entregar 4 REQs: TEST-01..04.

**Gap testing nunca antes coberto no kit-mcp** — esta é a primeira skill explícita sobre testing pattern Supabase.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Pattern canônico v1.26. Skill provavelmente 500-700 linhas (4 REQs com profundidade técnica).

</decisions>

<code_context>
## Insights do Código Existente

Cross-refs:
- legacy-characterizer (Feathers suite v1.x) — characterization tests
- supabase-ci-cd-github-actions (Phase 151) — workflows database-tests/functions-tests
- supabase-database-functions — funções PG que devem ser testadas
- supabase-rls-policies — policies que devem ser testadas

</code_context>

<specifics>
## Ideias Específicas

- pgTAP é PostgreSQL extension que provê assertions TAP-style
- Comandos canônicos: plan(N), ok(boolean, description), is(value, expected, description), throws_ok(sql, errcode, msgpat), finish()
- `supabase test db` busca tests em `supabase/tests/` por default
- Deno tests usam `Deno.test()` + `assertEquals()` etc
- .env.local provê env vars para functions tests
- Integração com legacy-characterizer: pgTAP como mecanismo de assertion para snapshots de comportamento

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma.

</deferred>
