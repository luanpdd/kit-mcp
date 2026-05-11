# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.27 — Supabase Branching & CI/CD Workflow (Phases 149–155)

> Gerado: 2026-05-11 | 7 phases | 5 skills + 2 agents + 3 cross-suite enrichments + 5 release artifacts | 45 REQs (cobertura 100%)

**Princípio canônico (herdado v1.23-v1.26):** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam.

**Contagem pré-v1.27:** 64 agents, 89 commands, 71 skills, 23 gates.
**Contagem pós-v1.27 esperada:** **66 agents** (+2: supabase-branching-architect + supabase-cicd-pipeline-implementer), 89 commands (mantido), **76 skills** (+5: supabase-branching-workflow + supabase-config-toml-remotes + supabase-ci-cd-github-actions + supabase-pgtap-testing + supabase-migration-repair), 23 gates (mantido).

### Phase 149: Skill nova `supabase-branching-workflow`
**Objetivo:** Preview vs persistent branches, deploy DAG 7 steps, GitHub integration setup, Dashboard alpha caveats, custo Branching Compute Hours.
**REQs:** BRANCH-01..05 (5 REQs)

### Phase 150: Skill nova `supabase-config-toml-remotes`
**Objetivo:** `[remotes]` block + branch-specific config + secret management per-branch + dotenvx encrypted pattern + 6 grupos canônicos encrypted fields.
**REQs:** CFG-01..05 (5 REQs)

### Phase 151: Skill nova `supabase-ci-cd-github-actions`
**Objetivo:** 8 workflows canônicos (ci/staging/production/generate-types/database-tests/functions-tests/backup/notify-failure) + secrets canônicos + warning "never backup to public repo" 2×.
**REQs:** CI-01..08 (8 REQs)

### Phase 152: Skill nova `supabase-pgtap-testing`
**Objetivo:** pgTAP extension + tests em supabase/tests/*.sql + `supabase test db` runner + Deno test pattern + cross-ref `legacy-characterizer` (Feathers suite).
**REQs:** TEST-01..04 (4 REQs)

### Phase 153: Skill nova `supabase-migration-repair`
**Objetivo:** `supabase migration list/repair` + rollback preview via delete+reopen + schema drift handling após git rebase + permission denied troubleshooting.
**REQs:** REPAIR-01..05 (5 REQs)

### Phase 154: Agents novos `supabase-branching-architect` + `supabase-cicd-pipeline-implementer`
**Objetivo:** Architect coleta decisões + produz BRANCHING-DESIGN.md; CICD implementer materializa 7 workflows + cross-suite handoffs (migration-writer + release-pipeline-auditor). Princípio canônico v1.23.
**REQs:** ARCH-01..05 + CICD-01..05 (10 REQs)

### Phase 155: Cross-suite enrichment (3 agents v1.x) + Release artifacts
**Objetivo:** XS em supabase-architect + supabase-migration-writer + release-pipeline-auditor; AUTOGEN-COUNTS regen (64→66 agents, 71→76 skills); file-manifest 375→382; CHANGELOG v1.27; glossário +10 termos; package.json bump 1.26→1.27.
**REQs:** XS-01..03 + REL-01..05 (8 REQs)

## Mapeamento REQ → Phase (cobertura 45/45)

| Categoria | REQs | Phase | Artefato |
|-----------|------|-------|----------|
| BRANCH-01..05 | 5 REQs | 149 | Skill `supabase-branching-workflow` |
| CFG-01..05 | 5 REQs | 150 | Skill `supabase-config-toml-remotes` |
| CI-01..08 | 8 REQs | 151 | Skill `supabase-ci-cd-github-actions` |
| TEST-01..04 | 4 REQs | 152 | Skill `supabase-pgtap-testing` |
| REPAIR-01..05 | 5 REQs | 153 | Skill `supabase-migration-repair` |
| ARCH-01..05 + CICD-01..05 | 10 REQs | 154 | Agents `supabase-branching-architect` + `supabase-cicd-pipeline-implementer` |
| XS-01..03 + REL-01..05 | 8 REQs | 155 | Cross-suite enrichment + Release artifacts |
| **Total** | **45 REQs** | **7 phases** | **45 mapeados (100%)** |

## Princípio de execução

7 phases content-only. Stable API v1.0+ preservada. Pattern herdado v1.23-v1.26. Trilha v1.27 (deployment maturity) é ortogonal às trilhas v1.23-v1.26 (security).

## Próximo passo

```
/planejar-fase 149
```

---
*Roadmap gerado: 2026-05-11 via /novo-marco v1.27*
*Cobertura: 45/45 REQs mapeados (100%)*
*Phase numbering: 149..155*
