# Phase 110: Invite Flow - Contexto

**Coletado:** 2026-05-10 · **Modo:** auto-gen (skip_discuss)

<domain>
Skill `member-invite-flow` + agent `invite-flow-implementer`. Token SHA-256 (raw enviado por email, hash no banco), TTL 7d single-use, state machine 5 estados, email-locked obrigatório, FOR UPDATE em accept, audit obrigatório. Bulk invite com rate limit. Cron expire pending.

REQs: INVITE-01, INVITE-02, INVITE-03, INVITE-04.
</domain>

<decisions>
- Token: crypto.randomBytes(32).toString('hex') — 64 hex chars
- Hash: SHA-256 no banco; raw nunca persistido após retornar do RPC
- Email-locked enforced em accept_invite RPC (lower(user.email) = lower(invited_email))
- Idempotência: FOR UPDATE + check accepted_by_id = caller
- Cross-suite: delega SQL para supabase-migration-writer + Edge Function (envio email) para supabase-edge-fn-writer
</decisions>

<code_context>
- Phase 106: organization_members + roles disponíveis
- Phase 109: audit_logs + private.audit_log function disponíveis
- Phase 108: private.has_permission para RLS
</code_context>

<deferred>
- Email customization templates (white-label) — out of scope
- Magic link em vez de invite token (Supabase Auth feature) — alternativa, não default
</deferred>
