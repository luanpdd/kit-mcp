# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.25 — Custom Claims & RBAC via Auth Hooks (Phases 137–142)

> Gerado: 2026-05-11 | 6 phases | 1 skill + 1 agent + 4 skill patches + 3 agent patches + 3 cross-suite + 5 doc | 32 REQs (cobertura 100%)

**Princípio canônico (herdado de v1.23/v1.24):** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam.

**Caveat embutido:** JWT freshness — mudanças em user_roles só refletem após token refresh. Auth hook delivery é eventually consistent.

**Contagem pré-v1.25:** 62 agents, 89 commands, 69 skills, 23 gates.
**Contagem pós-v1.25 esperada:** **63 agents** (+1: supabase-rbac-implementer), 89 commands (mantido — subcomando `rbac` interno), **70 skills** (+1: supabase-custom-claims-rbac), 23 gates (mantido).

### Phase 137: Skill nova `supabase-custom-claims-rbac`

**Objetivo:** Criar skill canônica documentando 100% da doc oficial Supabase Custom Claims & RBAC via Custom Access Token Auth Hook — 7 passos canônicos (enum types, tables, hook function, supabase_auth_admin grants, authorize function, RLS policies, client decoder) + anti-patterns + caveat JWT freshness.

**Dependências:** Nenhuma (fundação).

**Requisitos cobertos (10):** CLAIMS-01..CLAIMS-10

### Phase 138: Patches skills existentes (rls-policies + defense-in-depth + database-functions + rbac-permissions-matrix-supabase)

**Objetivo:** Integrar custom claims em 4 skills existentes — section nova em rls-policies, Camada 9 em defense-in-depth, pattern em database-functions, update em rbac-permissions-matrix-supabase (v1.21).

**Dependências:** Phase 137 (cross-refs ativos).

**Requisitos cobertos (4):** SKILL-PATCH-01..SKILL-PATCH-04

### Phase 139: Agent novo `supabase-rbac-implementer`

**Objetivo:** Criar agent canônico que recebe spec (roles + permissions matrix) via Task() e materializa setup completo RBAC. Verdicts GO/STRENGTHEN/REWRITE-com-confirmação. Validação de auth hook instalado.

**Dependências:** Phase 137 (skill base) + Phase 138 (cross-refs).

**Requisitos cobertos (4):** RBAC-AGENT-01..RBAC-AGENT-04

### Phase 140: Patches agents Supabase (rls-hardener + auth-bootstrapper + /supabase command)

**Objetivo:** Atualizar `supabase-rls-hardener` (v1.23) com Detector 9 + chain cooperativo; atualizar `supabase-auth-bootstrapper` (v1.8) com setup auth hook + jwt-decode; atualizar `/supabase` command com subcomando novo `rbac`.

**Dependências:** Phase 139 (chain target).

**Requisitos cobertos (5):** HARDEN-09, HARDEN-10, AUTH-PATCH-01, CMD-05, CMD-06

### Phase 141: Cross-suite handoff cooperativo (3 agents v1.21)

**Objetivo:** Aplicar pattern de handoff cooperativo custom claims em 3 agents implementers v1.21 com RBAC: multi-tenant-rls-writer, super-admin-implementer, audit-log-implementer.

**Dependências:** Phase 139 (handoff target).

**Requisitos cobertos (3):** CROSS-16, CROSS-17, CROSS-18

### Phase 142: Release artifacts

**Objetivo:** Regenerar AUTOGEN-COUNTS (62→63 agents, 69→70 skills), file-manifest, CHANGELOG entry v1.25, glossário +8 termos, bump package.json 1.24.0→1.25.0.

**Dependências:** Todas as phases anteriores.

**Requisitos cobertos (5):** DOC-01..DOC-05

## Mapeamento REQ → Phase (cobertura 32/32)

| Categoria | REQs | Phase |
|-----------|------|-------|
| CLAIMS-* | CLAIMS-01..10 | 137 |
| SKILL-PATCH-* | SKILL-PATCH-01..04 | 138 |
| RBAC-AGENT-* | RBAC-AGENT-01..04 | 139 |
| HARDEN-09, HARDEN-10, AUTH-PATCH-01, CMD-05..06 | 5 REQs | 140 |
| CROSS-16..18 | 3 REQs | 141 |
| DOC-01..05 | 5 REQs | 142 |
| **Total** | **32 REQs** | **32 mapeados (100%)** |

## Dependências entre phases

```
Phase 137 (skill nova) ──> Phase 138 (skill patches)
                                  │
                                  ▼
                          Phase 139 (agent novo)
                                  │
                                  ▼
                          Phase 140 (agents patches)
                                  │
                                  ▼
                          Phase 141 (cross-suite v1.21)
                                  │
                                  ▼
                          Phase 142 (release artifacts)
```

## Princípio de execução

Todas as 6 phases content-only. Stable API v1.0+ preservada. Pattern herdado v1.23/v1.24.

## Próximo passo

```
/planejar-fase 137
```

Ou autonomous execution inline (pattern v1.23/v1.24):
```
(inline phase-by-phase)
```

---
*Roadmap gerado: 2026-05-11 via /novo-marco v1.25*
*Cobertura: 32/32 REQs mapeados (100%)*
*Phase numbering: 137..142*
