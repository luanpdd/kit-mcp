# Phase 113: CRM Lead Pipeline - Contexto

**Coletado:** 2026-05-10 · **Modo:** auto-gen

<domain>
Skill `crm-lead-pipeline-patterns` + agent `crm-pipeline-implementer`. 6 stages canônicos + custom_*, trigger BEFORE UPDATE valida transições (data-driven via lead_stage_transitions table), trigger AFTER UPDATE audit ownership transfer + notification, dedup unique constraints, integração WhatsApp lookup contact_phone.

REQs: CRM-01..05.
</domain>

<decisions>
- Stages canônicos hard-coded em check constraint + custom_* prefix permitido
- Transições via tabela data-driven (lead_stage_transitions) — admin pode adicionar custom transitions sem mudança de schema
- CHECK não basta — trigger BEFORE UPDATE com RAISE EXCEPTION (REGRA #2)
- Ownership transfer dispara notification via Edge Function (não inline trigger)
- WhatsApp integration via cross-phase handoff para evolution-go-integrator (Phase 112)
</decisions>

<code_context>
- Phase 106 schema base
- Phase 108 RLS hierarchy
- Phase 109 audit_logs + private.audit_log
- Phase 112 whatsapp_messages + conversations (cross-phase handoff)
</code_context>

<deferred>
- Lead scoring (manual ou auto/AI) — diferenciador, out of scope v1.21
- Pipeline analytics dashboard — out of scope
- Quotation/proposal generation — out of scope
</deferred>
