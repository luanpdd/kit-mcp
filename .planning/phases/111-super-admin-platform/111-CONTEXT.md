# Phase 111: Super Admin Platform - Contexto

**Coletado:** 2026-05-10 · **Modo:** auto-gen

<domain>
Skill `super-admin-platform-pattern` + agent `super-admin-implementer`. Cross-tenant view via PERMISSIVE, impersonation TTL 30min + reason + banner, super_admin via app_metadata + service_role apenas, delete org dupla confirmação. **BLOCKER ADMIN-03** validado (Phase 109 ✓).

REQs: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04.
</domain>

<decisions>
- Cross-tenant via PERMISSIVE policies em tabelas críticas (organizations, leads, audit_logs, organization_members)
- Impersonation via Edge Function com magic link TTL 30min hard-coded
- Delete org soft default (status='archived'), hard opt-in
- ABORT no agent se audit_logs ausente (BLOCKER ADMIN-03)
</decisions>

<code_context>
- Phase 109 audit_logs implementado ✓ (BLOCKER unlocked)
- Phase 108 private.is_super_admin disponível
- Phase 106 schema base disponível
</code_context>

<deferred>
- Multi-factor auth para impersonation (TOTP) — out of scope v1.21
- Approval workflow (segundo super-admin aprova ação) — out of scope
- Detailed analytics dashboard — out of scope
</deferred>
