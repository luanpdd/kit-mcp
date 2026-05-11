# Phase 154 — Agents novos `supabase-branching-architect` + `supabase-cicd-pipeline-implementer`

**Status:** Concluída
**Data:** 2026-05-11
**Milestone:** v1.27 — Supabase Branching & CI/CD

## Objetivo entregue

Criados 2 agents canônicos novos em `kit/agents/` que materializam a estratégia v1.27 de Supabase Branching + CI/CD:

1. **`kit/agents/supabase-branching-architect.md`** — Projeta estratégia branching ANTES do setup técnico. Coleta 4 decisões canônicas via AskUserQuestion (ARCH-01..04), produz BRANCHING-DESIGN.md com custo estimado Branching Compute Hours, cross-suite delega para supabase-architect (v1.8). Verdicts canônicos v1.23.

2. **`kit/agents/supabase-cicd-pipeline-implementer.md`** — Recebe BRANCHING-DESIGN.md upstream + materializa 7-8 workflows GitHub Actions canônicos (CICD-01) + SECRETS-CHECKLIST.md com 6 secrets canônicos (CICD-02). Cross-suite handoff para supabase-migration-writer (v1.23 — CICD-03) e release-pipeline-auditor (v1.10 — CICD-04). Verdicts GO/STRENGTHEN/REWRITE-com-confirmação (CICD-05).

## REQs cobertos (10/10)

### supabase-branching-architect (5/5)
- **ARCH-01:** AskUserQuestion GitHub integration vs Dashboard alpha — default GitHub (Dashboard tem 4 caveats canônicos)
- **ARCH-02:** AskUserQuestion persistent vs ephemeral mix — pode haver mix (1 persistent + N ephemeral)
- **ARCH-03:** AskUserQuestion seed strategy — seed.sql default vs custom ORM via fountainhead/action-wait-for-check
- **ARCH-04:** AskUserQuestion secret strategy — CLI direct vs dotenvx encrypted commits vs GitHub environments vs Vault
- **ARCH-05:** Produz BRANCHING-DESIGN.md + cross-suite handoff Task() para supabase-architect

### supabase-cicd-pipeline-implementer (5/5)
- **CICD-01:** Materializa 7-8 workflows em `.github/workflows/`: ci.yml, staging.yml, production.yml, generate-types.yml, database-tests.yml (opcional), functions-tests.yml (opcional), backup.yml (com WARNING never to public repo 2×), notify-failure.yaml
- **CICD-02:** SECRETS-CHECKLIST.md com 6 secrets canônicos: SUPABASE_ACCESS_TOKEN, PRODUCTION_PROJECT_ID, PRODUCTION_DB_PASSWORD, STAGING_PROJECT_ID, STAGING_DB_PASSWORD, SUPABASE_DB_URL
- **CICD-03:** Cross-suite handoff Task() para supabase-migration-writer (v1.23) se workflows referenciam novas migrations
- **CICD-04:** Cross-suite handoff Task() para release-pipeline-auditor (v1.10) para audit hermeticidade do pipeline gerado
- **CICD-05:** Verdicts GO/STRENGTHEN/REWRITE-com-confirmação (pattern canônico v1.23)

## Decisões canônicas registradas

### Pattern v1.26 (estrutural)
Ambos agents seguem rigorosamente o pattern canônico v1.26 estabelecido por `supabase-roles-implementer.md`:
- Frontmatter YAML completo (name + description com trigger phrases + tools)
- Mission statement explícito
- Distinção canônica vs agent paralelo
- Inputs esperados (estrutura `<upstream_intent>` + contexto)
- Passos numerados com Step 0 Preflight
- Verdicts GO/STRENGTHEN/REWRITE-com-confirmação
- Cross-suite invocação tabela
- Failure modes + Anti-patterns + Quality gates + Observabilidade integrada
- Ver também com cross-refs

### Princípio canônico v1.23 (handoff cooperativo)
- Agents não-Supabase pensam/planejam; Supabase agents materializam/auditam
- **Nenhum lado descarta upstream** — conflitos resolvidos via diff + Confirmação Pendente
- Verdicts construtivos (GO/STRENGTHEN/REWRITE) preservam intent original

### Cross-suite handoffs (3 documentados)
1. **ARCH-05 → supabase-architect (v1.8):** branching-architect invoca architect para projetar schema + RLS + realtime integrado com branching strategy
2. **CICD-03 → supabase-migration-writer (v1.23):** cicd-pipeline-implementer invoca migration-writer se workflows referenciam novas migrations
3. **CICD-04 → release-pipeline-auditor (v1.10):** cicd-pipeline-implementer invoca audit hermeticidade do pipeline gerado

### Anti-patterns críticos prevenidos
- **Backup em repo público** (CICD-04) → REWRITE bloqueia com 3 opções de remediation
- **Dashboard alpha em projeto sério** (ARCH-01) → REWRITE com Confirmação Pendente listando 4 caveats
- **Branching em Free tier** (ARCH-00 Preflight) → REWRITE recomenda upgrade Pro+
- **Concurrent db push sem coordenação** (CICD-01) → `concurrency: cancel-in-progress: false` canônico
- **seed.sql com dados de produção** (ARCH-03) → caveat dataless documentado + recomendação staging project separado

## Métricas

- **supabase-branching-architect.md:** ~340 linhas
- **supabase-cicd-pipeline-implementer.md:** ~470 linhas
- **Total:** ~810 linhas de agent body
- **Cross-suite handoffs documentados:** 3 (ARCH→architect, CICD→migration-writer, CICD→release-auditor)
- **Verdicts implementados:** 6 (3 GO/STRENGTHEN/REWRITE × 2 agents)
- **Quality gates por agent:** 7 (architect) + 10 (cicd-implementer)

## Cross-suite integration (v1.27)

Fase 154 fecha a Suíte v1.27 de Supabase Branching & CI/CD com 2 agents que orquestram as 5 skills v1.27:

- **Phase 149** — skill `supabase-branching-workflow` (base de conhecimento)
- **Phase 150** — skill `supabase-config-toml-remotes` (dotenvx pattern)
- **Phase 151** — skill `supabase-ci-cd-github-actions` (8 workflows YAML)
- **Phase 152** — skill `supabase-pgtap-testing`
- **Phase 153** — skill `supabase-migration-repair`
- **Phase 154 (esta)** — 2 agents materializadores

Pattern de invocação canônico:

```
User → /supabase branching
  → supabase-branching-architect (coleta 4 decisões + BRANCHING-DESIGN.md)
    → Task() supabase-architect (schema + RLS + realtime integrado)
    → Task() supabase-cicd-pipeline-implementer (materializa workflows + SECRETS-CHECKLIST)
      → Task() supabase-migration-writer (se novas migrations)
      → Task() release-pipeline-auditor (audit hermeticidade)
```

## Próximos passos

- Phase 155+: orquestrador `/supabase branching` que invoca os 2 agents em sequência
- v1.27 milestone audit + glossário compartilhado +N termos (branching, dotenvx, fountainhead, etc.)
- Release notes v1.27 + AUTOGEN-COUNTS regen (agents 64→66, skills 71→76)
