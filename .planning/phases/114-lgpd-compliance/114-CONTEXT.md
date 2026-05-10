# Phase 114: LGPD Compliance - Contexto

**Coletado:** 2026-05-10 · **Modo:** auto-gen

<domain>
Skill `lgpd-multi-tenant-compliance` + agent `lgpd-compliance-auditor`. 9 direitos Art. 18, DSR SLA 15d Art. 19 + cron alert D-3, consent granular default opt-out (Art. 8 §5), erasure via anonymization, cross-border config Brasil sa-east-1 + adequacy decision Brasil-UE jan/2026.

REQs: LGPD-01..06.
</domain>

<decisions>
- Anonymization preservando UUID (não hard delete)
- Consent per-finalidade (analytics, marketing, third_party, profiling, cookies_optional, customs)
- DSR table com deadline_at automático (created_at + 15 days)
- pg_cron alert D-3 para admin via notifications table
- Audit gaps em 8 checks (4 P0 + 3 P1 + 1 P2)
</decisions>

<code_context>
- Phase 109 audit_logs com PII sanitization (cross-ref REGRA #4)
- Phase 109 legal_hold flag — usado em DSR erasure
- Phase 111 super_admin pode processar DSR
</code_context>

<deferred>
- DPIA (Data Protection Impact Assessment) automation — out of scope
- DPO (Data Protection Officer) workflow — humano
- Multi-language consent UI — out of scope
- ANPD reporting templates — out of scope
</deferred>
