---
phase: 153
title: Skill nova — supabase-migration-repair
milestone: v1.27
status: passed
verified_at: 2026-05-11
plans:
  - 153-01-skill-migration-repair
requirements:
  - REPAIR-01
  - REPAIR-02
  - REPAIR-03
  - REPAIR-04
  - REPAIR-05
---

# Phase 153 — VERIFICATION

## Status: PASSED

Todos os critérios de aceitação da Phase 153 foram satisfeitos.

## Checklist de verificação

### Entregáveis (4/4)

- [x] `kit/skills/supabase-migration-repair/SKILL.md` criado (823 linhas)
- [x] `.planning/phases/153-skill-nova-supabase-migration-repair/153-01-skill-migration-repair-PLAN.md` criado
- [x] `.planning/phases/153-skill-nova-supabase-migration-repair/153-SUMMARY.md` criado
- [x] `.planning/phases/153-skill-nova-supabase-migration-repair/153-VERIFICATION.md` criado (este arquivo)

### REQs cobertos (5/5)

- [x] **REPAIR-01** — Diagnóstico via `supabase migration list`
  - Comando + output canônico tabular (LOCAL / REMOTE / TIME UTC)
  - 3 estados canônicos por linha
  - Tabela canônica de interpretação
  - Estrutura interna da tracking table `supabase_migrations.schema_migrations`
  - Comportamento canônico de `supabase db push`

- [x] **REPAIR-02** — `supabase migration repair --status applied|reverted`
  - Sintaxe canônica + 2 subcomandos
  - **CAVEAT CRÍTICO repetido 2× explicitamente** (linha 66 + linha 187)
  - Caso 1: applied
  - Caso 2: reverted
  - Anti-uso explícito: NÃO usar para reverter schema
  - Fluxograma canônico de decisão

- [x] **REPAIR-03** — Rollback preview via delete + reopen
  - Workflow canônico 5 passos
  - Equivalência canônica com `db reset`
  - 3 caveats (data loss / auto-pause não substitui / Branching Compute Hours acumulam)
  - Workflow alternativo: push corrected migration
  - "Quando NÃO usar"

- [x] **REPAIR-04** — Schema drift após git rebase
  - Problema canônico timeline T → T+5
  - Solução canônica 4 passos
  - Resultado final folder layout
  - Princípio canônico: "later changes DEVEM ter later timestamps"
  - Cuidado git history
  - Caveat se migration já foi pushada

- [x] **REPAIR-05** — Permission denied troubleshooting
  - **Caso 1** db pull "permission denied for table _type" → grant graphql
  - **Caso 2** db push erro 42501 → grant custom_role to postgres
  - Caveat INHERIT vs NOINHERIT
  - Tabela canônica final (erro → SQLSTATE → comando → solução)

### CAVEAT "tracking table apenas" — ocorrências (≥2 exigido)

- [x] Ocorrência 1 — Linha 66 (bloco quote destacado introdução): explícito "APENAS a tracking table"
- [x] Ocorrência 2 — Linha 187 (Pattern 2 abertura, bloco quote destacado): "APENAS a tracking table" explícito + tag "REPETIDO"
- [x] Reforços adicionais (Princípio 1, anti-pattern 1, fluxograma) reforçam mas não duplicam literalmente

### Anti-patterns (5 — superou alvo de 4)

- [x] Anti-pattern 1: `migration repair --status reverted` esperando reverter SQL
- [x] Anti-pattern 2: Schema changes direto no remote bypassing migration files
- [x] Anti-pattern 3: Não rebase local antes de db push em equipe
- [x] Anti-pattern 4: Concurrent db push from different machines
- [x] Anti-pattern 5: Renomear migrations em produção

### Cross-refs (10 — superou alvo de 5)

- [x] `supabase-migrations` (v1.23)
- [x] `supabase-branching-workflow` (v1.27, Phase 149)
- [x] `supabase-config-toml-remotes` (v1.27, Phase 150)
- [x] `supabase-ci-cd-github-actions` (v1.27, Phase 151)
- [x] `supabase-pgtap-testing` (v1.27, Phase 152)
- [x] `supabase-postgres-roles` (v1.26)
- [x] `evolucao-schema-compativel` (v1.22)
- [x] `supabase-declarative-schema`
- [x] `supabase-rls-policies` (v1.23)
- [x] Glossário Supabase + doc oficial

### Compliance com convenções

- [x] Frontmatter YAML compatível com kit registry (`name` + `description`)
- [x] Idioma PT-BR (convenção v1.22+)
- [x] Trigger phrases canônicas (9+ frases gatilho)
- [x] Pattern "Quando usar" / "NÃO use" separado
- [x] Pattern "Princípio canônico" com 3 princípios numerados
- [x] Tabelas canônicas (4 tabelas: distinção schema vs tracking, erro→SQLSTATE→solução, etc.)
- [x] Cross-suite integration section (v1.27)
- [x] Forward-refs de Phase 149 + Phase 151 fechados

## Verificação cruzada

### Phase 149 forward-ref fechado

Phase 149 SKILL.md (`supabase-branching-workflow`) referenciava:

> **`supabase-migration-repair` (v1.27, Phase 153) — `migration list/repair` + rollback preview branch quando step migrate falha**

Esta phase entrega exatamente essa skill. Forward-ref fechado em Pattern 2 (DAG recovery via re-push) + Pattern 3 (rollback via delete+reopen).

### Phase 151 forward-ref fechado

Phase 151 SKILL.md (`supabase-ci-cd-github-actions`) referenciava esta skill para troubleshooting de pipelines que executam `supabase db push`. Pattern 5 (permission denied) cobre os erros mais comuns em CI/CD.

### Princípio canônico v1.23 mantido (handoff cooperativo)

Skill cooperativa — não bloqueia upstream:

- `supabase-migration-writer` planeja migration → se falha em CI, esta skill é o "kit de emergência"
- `supabase-rls-writer` (v1.23) cria policies → se schema drift acontece, esta skill diagnostica
- Cross-suite handoff pattern preservado

## Inventário final

| Item | Valor |
|------|-------|
| SKILL.md linhas | 823 |
| CAVEAT "tracking table apenas" ocorrências explícitas | 2 (linha 66 + linha 187) |
| Anti-patterns | 5 |
| Cross-refs | 10 |
| Patterns canônicos | 5 (REPAIR-01..05) |
| Tabelas canônicas | 4 |
| Casos de permission denied documentados | 2 (graphql + custom role) |
| REQs cobertos | 5/5 (100%) |

## Conclusão

Phase 153 entregue com 100% de cobertura dos REQs REPAIR-01..05. Skill `supabase-migration-repair` está pronta para ser consumida por agents existentes (migration-writer, rls-writer) e pelos agents futuros Phase 154 (`supabase-branching-architect`, `supabase-cicd-pipeline-implementer`).

Forward-refs de Phase 149 e Phase 151 fechados. Trilha CI/CD + recovery canônica Supabase agora consiste em 5 skills consolidadas:

1. Branching workflow (Phase 149)
2. Config TOML remotes (Phase 150)
3. CI/CD GitHub Actions (Phase 151)
4. pgTAP testing (Phase 152)
5. **Migration repair (Phase 153)** — esta phase

Próxima phase: 154 — agents novos que consumirão estas 5 skills via Task() handoff.
