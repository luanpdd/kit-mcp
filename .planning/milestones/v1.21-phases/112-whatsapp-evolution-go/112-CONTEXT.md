# Phase 112: WhatsApp/Evolution Go - Contexto

**Coletado:** 2026-05-10 · **Modo:** auto-gen

<domain>
2 skills + 1 agent. Webhook handler (HMAC Meta + API key Evolution Go), idempotency, rate limit pgmq, conversation state machine xstate v5, integração CRM auto-create lead.

REQs: WHATSAPP-01..07.
</domain>

<decisions>
- Provider abstrato — meta_cloud OU evolution_go via org_whatsapp_configs.provider
- HMAC validation antes de JSON.parse — REGRA #1 enforced no agent brief
- Timing-safe comparison via crypto.subtle (Deno) — REGRA #2 enforced
- Idempotency via unique(org_id, message_id) + ON CONFLICT DO NOTHING
- Send queue pgmq + worker para rate limit Meta 80 msg/s
- State machine xstate v5 persistido em conversations.state JSONB
- Cross-suite delega Edge Functions para supabase-edge-fn-writer
</decisions>

<code_context>
- pgmq extension necessária — verificada no preflight
- Phase 109 audit_logs disponível
- skill supabase-cron-queues v1.8 — pattern pg_cron + pgmq referenciado
</code_context>

<deferred>
- Template message management (Meta Business templates approval) — out of scope
- Media handling (images/audio/docs via Supabase Storage) — out of scope
- Multi-language conversation flows — out of scope
</deferred>
