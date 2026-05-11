# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.24 — Segurança em Nível de Coluna (Column-Level Security) (Phases 131–136)

> Gerado: 2026-05-11 | 6 phases | 1 skill + 1 agent + 5 patches + 5 cross-suite handoffs + 5 doc updates | 26 REQs (cobertura 100%)

**Princípio canônico (herdado de v1.23):** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam. Nenhum lado descarta o outro.

**Caveat embutido:** Column-level privileges é feature avançada. Para maioria dos casos, RLS + dedicated role table é preferido. Skills/agents marcam explicitamente.

**Contagem pré-v1.24:** 61 agents, 89 commands, 68 skills, 23 gates.
**Contagem pós-v1.24 esperada:** **62 agents** (+1: supabase-column-privileges-writer), 89 commands (mantido — subcomando `column` interno), **69 skills** (+1: supabase-column-level-security), 23 gates (mantido).

### Phase 131: Skill nova `supabase-column-level-security`

**Objetivo:** Criar skill canônica documentando 100% da doc oficial Supabase Column Level Security — GRANT/REVOKE column-level, table-level vs column-level, wildcard restriction, considerações de impacto, integração com RLS, dedicated role table pattern, Studio dashboard reference, anti-patterns.

**Dependências:** Nenhuma (fundação).

**Requisitos cobertos (8):** COL-01, COL-02, COL-03, COL-04, COL-05, COL-06, COL-07, COL-08

**Critérios de sucesso (4):**
1. Arquivo `kit/skills/supabase-column-level-security/SKILL.md` existe com frontmatter v1.0+ válido
2. `grep -c "grant.*\(.*\).*on table\|revoke.*\(.*\).*on table" kit/skills/supabase-column-level-security/SKILL.md` ≥ 3 (patterns canônicos)
3. `grep -c "wildcard\|SELECT \*" kit/skills/supabase-column-level-security/SKILL.md` ≥ 2 (caveat documentado)
4. `grep -c "dedicated role table\|advanced feature\|usar com parc" kit/skills/supabase-column-level-security/SKILL.md` ≥ 2 (recomendação canônica documentada)

### Phase 132: Patches skills existentes (rls-policies + migrations + defense-in-depth)

**Objetivo:** Integrar column-level security nas skills existentes da Suíte Supabase — section nova em rls-policies, BLOCO 6 opcional em migrations template, Camada 8 em defense-in-depth.

**Dependências:** Phase 131 (cross-refs ativos para skill nova).

**Requisitos cobertos (3):** COL-09, COL-10, COL-11

**Critérios de sucesso (3):**
1. `grep -c "Combining RLS with Column-Level\|column-level.*RLS" kit/skills/supabase-rls-policies/SKILL.md` ≥ 1 (COL-09)
2. `grep -c "BLOCO 6\|column.level.*privileges" kit/skills/supabase-migrations/SKILL.md` ≥ 1 (COL-10)
3. `grep -c "Camada 8\|column-level privileges" kit/skills/supabase-rls-defense-in-depth/SKILL.md` ≥ 1 (COL-11)

### Phase 133: Agent novo `supabase-column-privileges-writer`

**Objetivo:** Criar agent canônico que recebe spec (table + colunas sensíveis + roles) via Task() e produz REVOKE table-level + GRANT column-level SQL preservando intent upstream. Verdicts GO/STRENGTHEN/REWRITE-com-confirmação alinhados com `supabase-rls-hardener` (v1.23).

**Dependências:** Phase 131 (skill nova como base de conhecimento) + Phase 132 (cross-refs ativos).

**Requisitos cobertos (3):** COL-12, COL-13, COL-14

**Critérios de sucesso (4):**
1. Arquivo `kit/agents/supabase-column-privileges-writer.md` existe com frontmatter válido (`tools` inclui `Task`)
2. `grep -c "Verdict.*GO\|Verdict.*STRENGTHEN\|Verdict.*REWRITE" kit/agents/supabase-column-privileges-writer.md` ≥ 3
3. `grep -c "upstream_intent\|draft.*columns\|user_facing_caller" kit/agents/supabase-column-privileges-writer.md` ≥ 3
4. `grep -c "audit.*column.*privileges\|detect.*column.*privileges" kit/agents/supabase-column-privileges-writer.md` ≥ 1 (COL-14)

### Phase 134: Patches agents Supabase existentes (rls-hardener + command)

**Objetivo:** Atualizar `supabase-rls-hardener` (v1.23) com Detector 8 (column-level privileges check) + chain cooperativo para `supabase-column-privileges-writer`. Atualizar `/supabase` command com subcomando novo `column`.

**Dependências:** Phase 133 (chain target).

**Requisitos cobertos (4):** HARDEN-07, HARDEN-08, CMD-03, CMD-04

**Critérios de sucesso (3):**
1. `grep -c "Detector 8\|column-level privileges check\|supabase-column-privileges-writer" kit/agents/supabase-rls-hardener.md` ≥ 2
2. `grep -c "column\|coluna\|col-priv" kit/commands/supabase.md` ≥ 3 (subcomando documentado)
3. `grep -c "supabase-column-privileges-writer\|column dispatched" kit/commands/supabase.md` ≥ 1

### Phase 135: Cross-suite handoff cooperativo (5 agents v1.21)

**Objetivo:** Aplicar pattern de handoff cooperativo column-level em 5 agents implementers v1.21 com PII: audit-log-implementer, lgpd-compliance-auditor, crm-pipeline-implementer, multi-tenant-rls-writer, invite-flow-implementer. Cada agent ganha section "Cooperative handoff column-level (v1.24)" + cross-ref ativo.

**Dependências:** Phase 133 (handoff target).

**Requisitos cobertos (5):** CROSS-11, CROSS-12, CROSS-13, CROSS-14, CROSS-15

**Critérios de sucesso (2):**
1. `grep -l "supabase-column-privileges-writer" kit/agents/{audit-log-implementer,lgpd-compliance-auditor,crm-pipeline-implementer,multi-tenant-rls-writer,invite-flow-implementer}.md | wc -l` retorna 5
2. `grep -c "Cooperative handoff column-level\|column.level.*v1.24" kit/agents/{audit-log-implementer,lgpd-compliance-auditor,crm-pipeline-implementer,multi-tenant-rls-writer,invite-flow-implementer}.md` ≥ 1 cada

### Phase 136: Release artifacts (AUTOGEN-COUNTS + file-manifest + CHANGELOG + glossário + MILESTONES)

**Objetivo:** Regenerar AUTOGEN-COUNTS (61→62 agents, 68→69 skills), file-manifest, CHANGELOG entry v1.24, glossário compartilhado +5 termos novos, bump package.json 1.23.0→1.24.0, preparar transitions para `/concluir-marco`.

**Dependências:** Todas as phases anteriores (131-135).

**Requisitos cobertos (5):** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05

**Critérios de sucesso (4):**
1. `grep "62 agents\|69 skills" README.md` retorna match (DOC-01)
2. `grep -A 3 "## \[1.24.0\]" CHANGELOG.md` retorna entry completa (DOC-03)
3. `grep -c "column-level privileges\|table-level privileges\|wildcard restriction\|dedicated role table" kit/skills/_shared-supabase/glossary.md` ≥ 4 (DOC-04)
4. `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)"` retorna `1.24.0`

## Mapeamento REQ → Phase (cobertura 26/26)

| Categoria | REQs | Phase |
|-----------|------|-------|
| COL-* (skill nova) | COL-01..08 | 131 |
| COL-* (skill patches) | COL-09, 10, 11 | 132 |
| COL-* (agent novo) | COL-12, 13, 14 | 133 |
| HARDEN-* + CMD-* | HARDEN-07, 08, CMD-03, 04 | 134 |
| CROSS-* (v1.21) | CROSS-11..15 | 135 |
| DOC-* | DOC-01..05 | 136 |
| **Total** | **26 REQs** | **26 mapeados** |

## Dependências entre phases

```
Phase 131 (skill column-level) ──> Phase 132 (skill patches)
                                          │
                                          ▼
                                  Phase 133 (agent column-privileges-writer)
                                          │
                                          ▼
                                  Phase 134 (rls-hardener + command patches)
                                          │
                                          ▼
                                  Phase 135 (cross-suite 5 agents v1.21)
                                          │
                                          ▼
                                  Phase 136 (release artifacts)
```

**Caminho crítico:** 131 → 132 → 133 → 134 → 135 → 136 (6 fases sequenciais).

## Princípio de execução

Todas as 6 phases são **content-only** (zero alterações em `src/core/`). Stable API v1.0+ preservada. CI permanece verde sem ajustes em test suite. Pattern herdado de v1.23 (handoff cooperativo) aplicado consistentemente.

## Próximo passo

```
/planejar-fase 131
```

Ou para autonomous execution sequencial:

```
/autonomo
```

---
*Roadmap gerado: 2026-05-11 via /novo-marco v1.24*
*Cobertura: 26/26 REQs mapeados (100%)*
*Phase numbering: 131..136 (continuação de v1.23 que terminou em 130)*
