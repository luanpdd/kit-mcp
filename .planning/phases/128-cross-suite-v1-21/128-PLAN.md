# Plano: Fase 128 — Patches cross-suite v1.21 (handoff cooperativo em 8 implementers)

**Criado:** 2026-05-11
**Status:** Executed (inline autonomous mode)
**Requisitos cobertos:** CROSS-01..CROSS-08 (8 REQs)

## Objetivo

Atualizar 8 agents implementers v1.21 com handoff cooperativo obrigatório — drafts SQL passam via `Task()` para `supabase-rls-hardener` antes de devolver output final. Cada agent ganha section "Cooperative handoff to supabase-rls-hardener (v1.23)" + cross-ref ativo no "Ver também".

## Tarefas

Pattern aplicado em cada um dos 8 agents (CROSS-01..CROSS-08):

1. **multi-tenant-rls-writer** — CROSS-01 — Helper functions schema private + STABLE + partial index
2. **audit-log-implementer** — CROSS-02 — REVOKE DELETE/UPDATE (append-only) + PII hashing + retention pg_cron
3. **crm-pipeline-implementer** — CROSS-03 — Lead dedup constraints + state machine trigger + ownership transfer
4. **org-onboarding-implementer** — CROSS-04 — Atomicidade (org + members em 1 trx) + slug uniqueness
5. **invite-flow-implementer** — CROSS-05 — Token SHA-256 + TTL 7d + state machine + email-lock
6. **super-admin-implementer** — CROSS-06 — Cross-tenant RLS PERMISSIVE + impersonation TTL + audit BLOCKER
7. **evolution-go-integrator** — CROSS-07 — Webhook tenant_id no URL path + HMAC + idempotency
8. **lgpd-compliance-auditor** — CROSS-08 — DSR SLA 15 dias + erasure via anonymization + pseudonymization

Cada section adicionada antes de "## Ver também" + cross-ref `[supabase-rls-hardener](./supabase-rls-hardener.md)` em primeira posição de "Ver também".

## Arquivos modificados

8 agents v1.21:
- `kit/agents/multi-tenant-rls-writer.md`
- `kit/agents/audit-log-implementer.md`
- `kit/agents/crm-pipeline-implementer.md`
- `kit/agents/org-onboarding-implementer.md`
- `kit/agents/invite-flow-implementer.md`
- `kit/agents/super-admin-implementer.md`
- `kit/agents/evolution-go-integrator.md`
- `kit/agents/lgpd-compliance-auditor.md`

## Validação

```bash
# 8 agents devem todos referenciar supabase-rls-hardener
grep -l "supabase-rls-hardener" kit/agents/{multi-tenant-rls-writer,audit-log-implementer,crm-pipeline-implementer,org-onboarding-implementer,invite-flow-implementer,super-admin-implementer,evolution-go-integrator,lgpd-compliance-auditor}.md
# Esperado: 8 files matching

# pattern Task(subagent_type="supabase-rls-hardener" deve aparecer em todos
grep -c "Task(subagent_type=\"supabase-rls-hardener\"" kit/agents/{multi-tenant-rls-writer,audit-log-implementer,crm-pipeline-implementer,org-onboarding-implementer,invite-flow-implementer,super-admin-implementer,evolution-go-integrator,lgpd-compliance-auditor}.md
# Esperado: ≥ 1 cada (8 matches total mínimo)
```

## Riscos

- **Risco baixo:** Patches aditivos. Pattern consistente cross-agent reduz risco de drift.
- **Mitigação:** Constraints específicos do domínio preservam intent específico de cada agent. Phase 130 regen file-manifest captura novos hashes.
