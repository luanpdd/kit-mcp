---
phase: 152
plan_id: 152-01
title: Skill nova — supabase-pgtap-testing
milestone: v1.27
status: in_progress
requirements:
  - TEST-01  # pgTAP extension setup + sintaxe canônica
  - TEST-02  # supabase test db runner + CI integration
  - TEST-03  # Deno Edge Function tests
  - TEST-04  # cross-ref legacy-characterizer
---

# Phase 152 — Skill nova `supabase-pgtap-testing`

## Objetivo

Criar skill canônica `kit/skills/supabase-pgtap-testing/SKILL.md` cobrindo testing-shift-left para Supabase — pgTAP database tests + Deno Edge Function tests + cross-ref com legacy-characterizer (cap 13 Feathers) como mecanismo de characterization para PG functions legadas.

Cobre 4 REQs (TEST-01..TEST-04) da REQUIREMENTS.md v1.27.

## Contexto cross-suite v1.27

Esta skill é **complemento direto** de:

- `supabase-ci-cd-github-actions` (Phase 151) — workflow `database-tests.yml` (CI-05) e `functions-tests.yml` (CI-06) consomem `supabase test db` + `deno test --allow-all` cobertos nesta skill
- `legacy-characterization-tests` (v1.16) — pgTAP é o mecanismo canônico para implementar characterization (cap 13 Feathers) em PG functions/triggers/policies legadas

Princípio canônico: **tests are schema mutations** — tests rodam em transações `begin; ... rollback;` para nunca poluir DB.

## REQs cobertos

### TEST-01 — pgTAP extension setup

- `create extension if not exists pgtap with schema extensions;`
- Diretório canônico: `supabase/tests/` (Supabase CLI busca automaticamente)
- Sintaxe canônica TAP (Test Anything Protocol):
  - `plan(N)` declara N testes
  - `ok()`, `is()`, `isnt()`, `throws_ok()`, `has_table()`, `has_column()`, `col_type_is()`, `results_eq()`, `finish()`
- Template `begin; select plan(N); ... select * from finish(); rollback;`

### TEST-02 — `supabase test db` runner

- Comando local: `supabase test db` (assume `supabase start` rodando)
- Output: TAP format `1..N` + `ok/not ok` lines
- Integração CI: workflow `database-tests.yml` (cross-ref Phase 151 CI-05)

### TEST-03 — Deno Edge Function tests

- Arquivo canônico: `supabase/functions/_tests/<fn>_test.ts`
- Imports `https://deno.land/std@.../assert/mod.ts`
- Comando local: `deno test --allow-all supabase/functions/_tests/ --env-file .env.local`
- `.env.local` com `SUPABASE_URL` + `SUPABASE_ANON_KEY` capturados de `supabase status`

### TEST-04 — Cross-ref legacy-characterizer

- pgTAP = mecanismo canônico para characterization tests (Feathers cap 13) em PG legado
- Pré-condição obrigatória antes de refactor de PG function complexa (> 100 linhas, sem tests)
- Tests viram oracle imutável — qualquer regressão falha o build

## Estrutura da skill

```text
kit/skills/supabase-pgtap-testing/SKILL.md
├── Frontmatter YAML (name, description com trigger phrases)
├── Quando usar (trigger phrases + use APENAS / NÃO use)
├── Princípio canônico (3 princípios — shift-left, transactional rollback, characterization)
├── Pattern 1: pgTAP extension + sintaxe canônica (TEST-01)
├── Pattern 2: supabase test db runner + CI integration (TEST-02)
├── Pattern 3: Deno Edge Function tests (TEST-03)
├── Pattern 4: pgTAP como mecanismo de characterization legacy (TEST-04)
├── Anti-patterns (5 itens canônicos)
├── Cross-suite integration (v1.27)
└── Ver também (cross-refs)
```

## Tamanho esperado

500-700 linhas (similar a `supabase-postgres-roles` v1.26 e `supabase-ci-cd-github-actions` v1.27).

## Anti-patterns mínimos (≥4)

1. Tests em produção sem `rollback` — poluem DB irreversivelmente
2. Esquecer `plan(N)` — pgTAP requer plan declarado; sem ele, testes silenciosamente passam
3. Tests Deno sem `.env.local` — env vars ausentes silenciosamente fazem `fetch` falhar com URL inválida
4. Tratar pgTAP como "testes completos" — pgTAP cobre schema/RLS/PG functions; ainda precisa de integration tests no app layer
5. Snapshot pgTAP sem revisão — tests verdes mas validam comportamento bugado (cross-ref `legacy-characterization-tests` anti-pattern 3)

## Cross-refs canônicos

1. `supabase-database-functions` — PG functions são prime target de pgTAP
2. `supabase-rls-policies` (v1.23) — RLS policies validadas via pgTAP (`results_eq` + `throws_like '%permission denied%'`)
3. `supabase-ci-cd-github-actions` (Phase 151) — workflow CI-05 que consome `supabase test db`
4. `legacy-characterization-tests` — pgTAP é o oracle imutável durante refactor PG
5. `supabase-edge-functions` — Deno tests cobrem Edge Function logic
6. `pre-refactor-characterization` (v1.18) — gate auto-trigger que pgTAP satisfaz

## Verificação

- [x] Diretório `kit/skills/supabase-pgtap-testing/` criado
- [x] SKILL.md com 500-700 linhas
- [x] 4 REQs cobertos (TEST-01..04)
- [x] ≥4 anti-patterns documentados (alvo: 5)
- [x] ≥5 cross-refs (alvo: 6)
- [x] Frontmatter YAML compatível com kit registry
- [x] Idioma PT-BR (convenção v1.22+)
- [x] Commit atômico via `tools.cjs commit`

## Notas

- Esta skill **não cria agent novo** — fica como skill standalone consumida por `supabase-edge-fn-writer`, `supabase-migration-writer`, `supabase-database-functions` e pelo agent futuro Phase 154 `supabase-cicd-pipeline-implementer`.
- Cross-ref bidirecional com `supabase-ci-cd-github-actions` (Phase 151) já estava prevista como skill futura — esta phase fecha esse forward-ref.
