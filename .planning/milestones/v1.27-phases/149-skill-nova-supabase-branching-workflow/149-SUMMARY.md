# Fase 149 — SUMMARY

**Concluída:** 2026-05-11
**Plan:** 149-01-skill-branching-workflow
**Mode:** standard autonomous (1 plano, 1 wave)

## O que foi criado

### Arquivo novo

`kit/skills/supabase-branching-workflow/SKILL.md` — **544 linhas**

### REQs cobertos (5/5)

- **BRANCH-01** — Preview vs Persistent Branches (Pattern 1) com tabela comparativa 8 dimensões + critério de escolha + CLI `--persistent` + caveat health check 30 min
- **BRANCH-02** — Deploy DAG 7 steps canônicos (Pattern 2) — clone → pull → health → configure → migrate → seed → deploy + skip behavior em falha (step 5 migrate falha → step 6 seed e step 7 deploy SKIPPED) + diagrama ASCII + caveat dataless by design
- **BRANCH-03** — GitHub Integration Setup (Pattern 3) — 5 toggles (Authorize Supabase, working directory, automatic branching, "Supabase changes only" filter, deploy to production) + workflow esperado + required check enforcement + branch protection rules
- **BRANCH-04** — Dashboard Branching Alpha Caveats (Pattern 4) — 4 caveats canônicos (custom roles não capturados, merge só para `main`, edge functions sobrescritas silenciosamente, delete de functions manual em main) + tabela comparativa Dashboard alpha vs GitHub integration + recomendação canônica explícita
- **BRANCH-05** — Custo Branching Compute Hours (Pattern 5 + ALERTA destacado) — Micro $0.01344/h + **FORA do Spend Cap** (repetido 4× no doc) + Compute Credits NÃO aplicam + billing line item + cálculos de capacity planning + 5 mitigações canônicas

## Estrutura canônica (pattern v1.26)

1. Frontmatter YAML (name + description com trigger phrases + caveat custo)
2. `## Quando usar` — trigger phrases + use APENAS para / NÃO use para
3. `## Princípio canônico` — distinção preview vs persistent + critério de escolha
4. `## ALERTA DE CUSTO — Branching Compute Hours` — bloco destacado com estimativas concretas
5. `## Pattern 1: Preview vs Persistent Branches` (BRANCH-01)
6. `## Pattern 2: Deploy DAG — 7 steps canônicos` (BRANCH-02)
7. `## Pattern 3: GitHub Integration Setup` (BRANCH-03)
8. `## Pattern 4: Dashboard Branching Alpha — Caveats canônicos` (BRANCH-04)
9. `## Pattern 5: Custo Branching Compute Hours` (BRANCH-05)
10. `## Anti-patterns` — 6 anti-patterns no formato Errado/Por quê/Certo
11. `## Cross-suite integration (v1.27)` — base para skills v1.27 Phase 150-153 + agents Phase 154
12. `## Ver também` — 11 cross-refs (5 skills atuais + 4 futuras v1.27 + glossário + doc oficial)

## Anti-patterns (6 — todos no formato Errado/Por quê/Certo)

1. Usar Dashboard branching alpha para projeto sério
2. Ignorar Spend Cap caveat (FORA do Spend Cap reforçado)
3. Tentar merge entre preview branches
4. Push direto na main sem preview branch
5. Esperar persistent branch funcionar como production (dataless by design)
6. Criar persistent branch sem cleanup policy

## Cross-refs

**Skills atuais (5):**

- supabase-migrations (v1.23)
- supabase-postgres-roles (v1.26) — caveat Caveat 1 Dashboard alpha
- supabase-declarative-schema
- evolucao-schema-compativel (v1.22)
- release-engineering, hermetic-builds

**Skills futuras v1.27 referenciadas (4):**

- supabase-config-toml-remotes (Phase 150)
- supabase-ci-cd-github-actions (Phase 151)
- supabase-pgtap-testing (Phase 152)
- supabase-migration-repair (Phase 153)

**Outros:**

- supabase-edge-functions (cross-ref no DAG step 7)
- glossário compartilhado (`_shared-supabase/glossary.md`)
- Doc oficial Supabase (3 links)

## Decisões canônicas registradas

- **Recomendação GitHub integration sobre Dashboard alpha** — explícita em Pattern 3, Pattern 4 + Anti-pattern 1
- **Branching Compute Hours FORA do Spend Cap** — repetido em frontmatter + ALERTA bloco + Pattern 5 + Anti-pattern 2 (4× total)
- **Dataless by design** — registrado em Pattern 2 (step 6 seed) + Anti-pattern 5
- **Pattern Errado/Por quê/Certo** — herdado v1.26 (supabase-postgres-roles)
- **Convenção PT-BR** (v1.22+) — texto em PT-BR, code blocks YAML/SQL EN com comentários PT-BR

## Validação de acceptance criteria

Todos os critérios das 9 tasks (T1..T9) validados via grep:

- T1: frontmatter YAML válido + name + description com trigger phrases + "FORA do Spend Cap" presente
- T2: seções `Quando usar`, `Princípio canônico`, `ALERTA DE CUSTO` presentes; $0.01344 e "Compute Credits NÃO aplicam" documentados
- T3: tabela Preview vs Persistent com Auto-pause/auto-delete/ephemeral, CLI `--persistent`, caveat 30 minutos
- T4: Deploy DAG, todos 7 step names (clone, pull, health, configure, migrate, seed, deploy), SKIPPED behavior, exemplo "step 5", "dataless"
- T5: GitHub Integration, 5 toggles (Authorize Supabase, working directory, automatic branching, "Supabase changes only", deploy to production), required check, branch protection
- T6: Dashboard Branching Alpha, 4 caveats (custom roles, merge só para, sobrescritas, delete de functions), "alpha" presente, recomendação GitHub integration
- T7: 6 anti-patterns ≥ 4 com Errado (6) / Por quê (6) / Certo (6)
- T8: Cross-suite integration (v1.27), Ver também, cross-refs todos presentes, doc oficial link
- T9: ≥ 400 linhas (544), frontmatter --- abre/fecha, todos BRANCH-01..05 keywords presentes

## Tamanho final

**544 linhas** (alvo 500-700, mínimo 400)
