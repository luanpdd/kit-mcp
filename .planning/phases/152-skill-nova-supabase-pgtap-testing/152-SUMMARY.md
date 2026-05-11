---
phase: 152
title: Skill nova — supabase-pgtap-testing
milestone: v1.27
status: complete
plans:
  - 152-01-skill-pgtap-testing
requirements:
  - TEST-01
  - TEST-02
  - TEST-03
  - TEST-04
---

# Phase 152 — SUMMARY

## Objetivo entregue

Criada a skill canônica `kit/skills/supabase-pgtap-testing/SKILL.md` cobrindo 100% dos REQs TEST-01..04 da REQUIREMENTS.md v1.27 — testing-shift-left para Supabase via pgTAP (database tests) + Deno test (Edge Function tests) + cross-ref legacy-characterizer (cap 13 Feathers).

## Entregáveis

| Artefato | Caminho | Tamanho |
|----------|---------|---------|
| SKILL.md | `kit/skills/supabase-pgtap-testing/SKILL.md` | 1053 linhas (alvo 500-700; superado intencionalmente pelo nível de detalhe da doc oficial pgTAP) |
| PLAN.md | `.planning/phases/152-skill-nova-supabase-pgtap-testing/152-01-skill-pgtap-testing-PLAN.md` | full plan |
| SUMMARY.md | `.planning/phases/152-skill-nova-supabase-pgtap-testing/152-SUMMARY.md` | este arquivo |
| VERIFICATION.md | `.planning/phases/152-skill-nova-supabase-pgtap-testing/152-VERIFICATION.md` | status: passed |

## REQs cobertos (4/4)

### TEST-01 — pgTAP extension setup
- `create extension if not exists pgtap with schema extensions;`
- Diretório canônico `supabase/tests/` (descoberta automática)
- Funções pgTAP completas: `plan`, `ok`, `is`, `isnt`, `throws_ok`, `throws_like`, `lives_ok`, `has_table`, `hasnt_table`, `has_column`, `col_type_is`, `col_not_null`, `col_has_default`, `has_pk`, `has_fk`, `has_index`, `has_function`, `function_returns`, `has_trigger`, `has_enum`, `results_eq`, `results_ne`, `set_eq`, `finish`
- Tabela canônica de SQLSTATE codes (23502, 23503, 23505, 23514, 42501, 22001, 22008, P0001)

### TEST-02 — `supabase test db` runner + CI integration
- Comando local + output TAP format anatomy
- Exit codes (0/1/3) + impacto em CI
- Workflow YAML completo (cross-ref Phase 151 CI-05)
- Caveat fixtures via `supabase/seed.sql`
- Caveat paralelismo + mitigation matrix strategy

### TEST-03 — Deno Edge Function tests
- Estrutura `supabase/functions/_tests/<fn>_test.ts`
- Padrão HTTP test vs unit test (importar handler diretamente)
- `.env.local` capturado via `supabase status -o env`
- Workflow YAML completo (cross-ref Phase 151 CI-06)
- Padrão `beforeEach/afterEach` para cleanup manual (DB writes)

### TEST-04 — Cross-ref legacy-characterizer
- Princípio Feathers cap 13 aplicado a PG functions
- Workflow canônico 6 passos de characterization de PG function
- Exemplo completo com 5 grupos de equivalência (typical, discount, empty BUG#1, non-existent, negative)
- Bugs preservados como comments inline (oracle imutável)
- Mutation testing manual para validar coverage
- Critérios de quando pgTAP characterization é mandatório

## Anti-patterns documentados (5)

1. Tests sem `rollback` — DB local poluído
2. Esquecer `plan(N)` — falha silenciosa em CI
3. Tests Deno sem `.env.local` — `Deno.env.get()` retorna `undefined`, fetch falha com URL inválida
4. Tratar pgTAP como "testes completos" — pirâmide de testes canônica (pgTAP + Deno + Integration + E2E)
5. Snapshot pgTAP sem revisão — PII/secrets/timestamps voláteis vazam para git history

## Cross-refs (13)

1. `supabase-ci-cd-github-actions` (Phase 151)
2. `legacy-characterization-tests` (v1.16)
3. `pre-refactor-characterization` (v1.18)
4. `supabase-database-functions`
5. `supabase-rls-policies` (v1.23)
6. `supabase-rls-defense-in-depth` (v1.23)
7. `supabase-edge-functions`
8. `supabase-postgres-roles` (v1.26)
9. `supabase-custom-claims-rbac` (v1.25)
10. `supabase-migrations` (v1.23)
11. `ai-mutation-tester` (v1.20)
12. Glossário Supabase compartilhado
13. Doc oficial pgTAP + Supabase

## Cross-suite integration (v1.27)

- Fecha forward-ref de Phase 151 (`supabase-ci-cd-github-actions` referenciava "skill futura `supabase-pgtap-testing` Phase 152")
- Tabela canônica "Casos de uso por agent" (6 agents consomem esta skill):
  - `supabase-migration-writer`
  - `supabase-rls-writer` (v1.23)
  - `supabase-edge-fn-writer`
  - `legacy-characterizer`
  - `refactor-safety-auditor`
  - `supabase-cicd-pipeline-implementer` (Phase 154 futura)

## Princípios canônicos estabelecidos

1. **Testing shift-left** — required check enforced via branch protection
2. **Tests são schema mutations transacionais** — `begin; ... rollback;` é canônico
3. **pgTAP é o oracle imutável para refactor PG legado** — cap 13 Feathers aplicado a Postgres

## Notas de implementação

- Esta skill **não cria agent novo** — fica como skill canônica consumida por agents existentes (migration-writer, rls-writer, edge-fn-writer) e pelo agent futuro Phase 154 `supabase-cicd-pipeline-implementer`
- Idioma PT-BR (convenção v1.22+)
- Tamanho excedeu alvo (1053 vs 500-700 alvo) — justificado pelo escopo amplo (2 runners + characterization + 30+ funções pgTAP catalogadas)

## Próxima fase

Phase 153 (próxima v1.27) — provavelmente `supabase-migration-repair` skill conforme forward-ref na Phase 151.
