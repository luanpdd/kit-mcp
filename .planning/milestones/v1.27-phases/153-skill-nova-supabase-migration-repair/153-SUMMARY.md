---
phase: 153
title: Skill nova — supabase-migration-repair
milestone: v1.27
status: complete
plans:
  - 153-01-skill-migration-repair
requirements:
  - REPAIR-01
  - REPAIR-02
  - REPAIR-03
  - REPAIR-04
  - REPAIR-05
---

# Phase 153 — SUMMARY

## Objetivo entregue

Criada a skill canônica `kit/skills/supabase-migration-repair/SKILL.md` cobrindo 100% dos REQs REPAIR-01..REPAIR-05 da REQUIREMENTS.md v1.27 — "kit de emergência" canônico para sync errors entre local `supabase/migrations/` e remote `supabase_migrations.schema_migrations` tracking table, rollback de preview branches via delete+reopen, schema drift handling após git rebase e permission denied troubleshooting (graphql + custom role).

## Entregáveis

| Artefato | Caminho | Tamanho |
|----------|---------|---------|
| SKILL.md | `kit/skills/supabase-migration-repair/SKILL.md` | 823 linhas (alvo 500-700; superado intencionalmente pelo nível de detalhe da doc oficial) |
| PLAN.md | `.planning/phases/153-skill-nova-supabase-migration-repair/153-01-skill-migration-repair-PLAN.md` | full plan |
| SUMMARY.md | `.planning/phases/153-skill-nova-supabase-migration-repair/153-SUMMARY.md` | este arquivo |
| VERIFICATION.md | `.planning/phases/153-skill-nova-supabase-migration-repair/153-VERIFICATION.md` | status: passed |

## REQs cobertos (5/5)

### REPAIR-01 — Diagnóstico via `supabase migration list`

- Comando + output canônico (3 colunas LOCAL / REMOTE / TIME UTC)
- 3 estados canônicos por linha (sincronizado / local-only / remote-only)
- Tabela com interpretação canônica
- Estrutura interna da tracking table `supabase_migrations.schema_migrations` (version + name + statements[])
- Comportamento canônico de `supabase db push` (diff folder vs tracking → aplica pending em ordem cronológica)

### REPAIR-02 — `supabase migration repair --status applied|reverted`

- Sintaxe canônica + 2 subcomandos (applied / reverted)
- **CAVEAT CRÍTICO repetido 2× explicitamente** (linha 66 e linha 187 do SKILL.md)
- Caso 1: migration aplicada manualmente → repair --status applied
- Caso 2: migration registrada mas nunca aplicada → repair --status reverted
- Anti-uso explícito: NÃO usar para reverter schema
- Fluxograma canônico de decisão (sync error → escolha do repair correto)

### REPAIR-03 — Rollback preview via delete + reopen

- Workflow canônico 5 passos (push migration → DAG falha → close PR → delete branch → reopen PR → novo branch)
- Equivalência canônica: delete+reopen = `supabase db reset` local
- 3 caveats canônicos (data loss / auto-pause não substitui / Branching Compute Hours acumulam)
- Workflow alternativo: push corrected migration (sem reset, se simples)
- Critérios "quando NÃO usar" (persistent branches, production)

### REPAIR-04 — Schema drift após git rebase

- Problema canônico timeline T → T+5 (dev_A + dev_B em paralelo)
- Solução canônica 4 passos (git pull → migration new → mv arquivo → db reset)
- Resultado final folder layout
- Princípio canônico: "changes que dependem de earlier changes DEVEM ter later timestamps"
- Cuidado git history (mv detectado como rename)
- Caveat se migration já foi pushada (combinação com Pattern 3)

### REPAIR-05 — Permission denied troubleshooting

- **Caso 1**: db pull erro "permission denied for table _type" (pg_dump fail)
  - Causa: projetos antigos sem grant graphql schema
  - Solução SQL: 3 statements grant all (tables + functions + sequences) para postgres, anon, authenticated, service_role
- **Caso 2**: db push erro 42501 com custom role
  - Causa: tabela criada com custom role; postgres sem permission
  - Solução SQL: `grant "custom_role" to "postgres"`
  - Caveat INHERIT vs NOINHERIT (cross-ref skill supabase-postgres-roles v1.26)
- Tabela canônica final: erro → SQLSTATE → comando → solução

## CAVEAT canônico "tracking table apenas" — ocorrências (≥2 exigido, entregue: 2 explícitas + várias reforçadas)

- **Linha 66**: bloco quote destacado na introdução ("CAVEAT CRÍTICO — Tracking table apenas") — explícito
- **Linha 187**: Pattern 2 abre com mesmo bloco quote ("CAVEAT CRÍTICO REPETIDO — tracking table apenas") — explícito
- Reforços adicionais ao longo do texto (Princípio 1 distinguindo schema state vs tracking table, anti-pattern 1 com sintoma do bug, fluxograma, etc.)

## Anti-patterns documentados (5 — superou alvo de 4)

1. Usar `migration repair --status reverted` esperando reverter SQL — CAVEAT CRÍTICO violado, sintoma loop infinito de repair attempts
2. Schema changes direto no remote bypassing migration files — cria divergência tracking table vs schema real
3. Não rebase local antes de db push em equipe — timestamps fora de ordem causam FK failures
4. Concurrent db push from different machines — race condition na tracking table
5. Renomear migrations em produção — mismatch irreversível; produção é forward-only

## Cross-refs (10)

1. `supabase-migrations` (v1.23)
2. `supabase-branching-workflow` (v1.27, Phase 149)
3. `supabase-config-toml-remotes` (v1.27, Phase 150)
4. `supabase-ci-cd-github-actions` (v1.27, Phase 151)
5. `supabase-pgtap-testing` (v1.27, Phase 152)
6. `supabase-postgres-roles` (v1.26)
7. `evolucao-schema-compativel` (v1.22)
8. `supabase-declarative-schema`
9. `supabase-rls-policies` (v1.23)
10. Glossário Supabase compartilhado + doc oficial

## Cross-suite integration (v1.27)

Fecha forward-refs das phases anteriores v1.27:

- Phase 149 (`supabase-branching-workflow`) referenciava esta skill para diagnóstico de DAG step 5 (migrate) failures
- Phase 151 (`supabase-ci-cd-github-actions`) referenciava esta skill para troubleshooting de pipelines que executam `db push`

Esta skill **não cria agent novo** — fica como skill standalone consumida por:

- `supabase-migration-writer` (referência pós-falha de migration)
- `supabase-rls-writer` (v1.23) (quando RLS depende de schema state drifted)
- Agents futuros Phase 154 (`supabase-branching-architect`, `supabase-cicd-pipeline-implementer`)

## Princípios canônicos estabelecidos

1. **Tracking table state ≠ schema state real** — tabela canônica com 4 combinações + sintomas
2. **Diagnose ANTES de repair** — sempre rodar `migration list` primeiro
3. **Rollback preview preferível a manual revert** — preview branches são ephemeral by design

## Notas de implementação

- Idioma PT-BR (convenção v1.22+)
- Tamanho excedeu alvo (823 vs 500-700) — justificado pelo escopo amplo (5 patterns + 2 casos de permission denied + 5 anti-patterns com sintomas + fluxograma de decisão + tabela canônica final)
- Forward-refs de Phase 149 e Phase 151 fechados
- CAVEAT CRÍTICO "tracking table apenas" repetido 2× explicitamente conforme requisito

## Próxima fase

Phase 154 (v1.27) — agents novos `supabase-branching-architect` + `supabase-cicd-pipeline-implementer`, que consumirão skills das Phases 149-153.
