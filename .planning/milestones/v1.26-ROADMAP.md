# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.26 — Postgres Roles (Phases 143–148)

> Gerado: 2026-05-11 | 6 phases | 1 skill + 1 agent + 5 skill patches + 3 agent patches + 4 cross-suite + 5 doc | 34 REQs (100%)

**Princípio canônico (herdado v1.23-v1.25):** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam.

**Contagem pré-v1.26:** 63 agents, 89 commands, 70 skills, 23 gates.
**Contagem pós-v1.26 esperada:** **64 agents** (+1: supabase-roles-implementer), 89 commands (mantido — subcomando `role` interno), **71 skills** (+1: supabase-postgres-roles), 23 gates (mantido).

### Phase 143: Skill nova `supabase-postgres-roles`
**Objetivo:** Documentar 100% da doc oficial — roles vs users, CREATE ROLE, password best practices, GRANT/REVOKE, hierarchy, 10 predefined Supabase roles, quando criar custom role, anti-patterns.
**REQs:** ROLES-01..12 (12 REQs)

### Phase 144: Patches em 5 skills existentes
**REQs:** SKILL-PATCH-05..09 (5 REQs — rls-policies, defense-in-depth, database-functions, migrations, custom-claims-rbac)

### Phase 145: Agent novo `supabase-roles-implementer`
**REQs:** ROLES-AGENT-01..05 (5 REQs)

### Phase 146: Patches em rls-hardener (Detector 10) + supabase-architect + /supabase command
**REQs:** HARDEN-11, ARCH-PATCH-01, CMD-07 (3 REQs)

### Phase 147: Cross-suite handoff (4 agents v1.21)
**REQs:** CROSS-19..22 (4 REQs — audit-log/security_admin, lgpd/dpo_role, crm/lead_manager, super-admin/platform_admin)

### Phase 148: Release artifacts
**REQs:** DOC-01..05 (5 REQs)

## Mapeamento REQ → Phase (cobertura 34/34)

Total: 34 REQs mapeados (100%), 0 não-mapeados.

## Princípio de execução

6 phases content-only. Stable API v1.0+ preservada. Pattern herdado v1.23-v1.25.
