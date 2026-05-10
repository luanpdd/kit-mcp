# Fase 108: RLS Hierarchy + RBAC - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

Fase **central** da Suíte Multi-Tenant SaaS B2B v1.21:
- 2 skills: `multi-tenant-rls-hierarchy` (4 helper functions PG canônicas + super_admin PERMISSIVE) + `rbac-permissions-matrix-supabase` (modelagem + escalation rule)
- 2 agents: `multi-tenant-rls-writer` (especializa supabase-rls-writer v1.8) + `multi-tenant-isolation-auditor` (audita gaps cross-tenant)

REQs: ARCH-03, ARCH-04, RBAC-01, RBAC-02, RBAC-03, RBAC-04.

</domain>

<decisions>
## Decisões de Implementação

### Cristalizadas
- Helpers em schema `private` (não `public` — PostgREST não expõe)
- Todas STABLE + security invoker + search_path = ''
- super_admin via PERMISSIVE separada (não OR embutido)
- Herança dept→org via coalesce no `effective_role_in_dept`
- Permission strings padrão `<resource>:<action>` snake_case
- Role escalation rule: rank-based (owner=3, admin=2, member=1, custom=0)

### Cross-suite
- multi-tenant-rls-writer **especializa** supabase-rls-writer v1.8 (herda anti-pitfalls explicitamente — 5 regras herdadas)
- multi-tenant-isolation-auditor padrão de output similar a observability-coverage-auditor

</decisions>

<code_context>
## Insights do Código Existente

- `supabase-rls-writer` (v1.8) define ABORT condition para user_metadata — herdada
- `supabase-rls-policies` (v1.8) — `(select auth.uid())` wrapper documentado — herdado
- `supabase-database-functions` (v1.8) — pattern security invoker + search_path — herdado
- Phase 106 cristalizou schema base (organizations, organization_members, roles, permissions, role_permissions, department_members)

</code_context>

<specifics>
## Ideias Específicas

audit_super_admin trigger gera por tabela individualmente (não global) — flexibilidade para opt-out por tabela menos crítica.

</specifics>

<deferred>
## Ideias Adiadas

- Permission expressions (regras tipo `org_id = $1 and (status = 'active' or owner_id = auth.uid())`) — out of scope v1.21
- Time-based permissions (válido por X dias) — out of scope
</deferred>
