# Fase 107: Org Onboarding Flow - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Skill `org-onboarding-flow` + agent `org-onboarding-implementer` — fluxo signup → criar org → primeiro admin → setup wizard, com slug imutável e redirect trail. Atomicidade SQL (org + members em 1 trx). Setup wizard async (não bloqueia signup). Slugs reservados em allowlist.

REQs cobertos: ORG-01, ORG-02, ORG-03.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Pesquisa cristalizou:
- Atomicidade via RPC PG `create_organization(name, slug)` — não 2 inserts separados
- Slug strategy default: imutável + redirect trail via `organization_slug_history`
- Setup wizard async — Edge Function separada, fire-and-forget no client

### Cross-suite delegation explícita
- Agent invoca `supabase-migration-writer` (v1.8) para SQL final
- Agent invoca `supabase-edge-fn-writer` (v1.8) para Edge Function setup wizard

</decisions>

<code_context>
## Insights do Código Existente

- Phase 106 entregou schema canônico (`organizations`, `organization_members`, `roles`, `organization_slug_history`)
- `supabase-migration-writer` (v1.8) já cobre RLS + style guide + declarative
- `supabase-edge-fn-writer` (v1.8) já cobre Deno + npm:/jsr: + verify_jwt
- `_shared-multi-tenant/glossary.md` define `first admin`, `bulk invite`

</code_context>

<specifics>
## Ideias Específicas

Allowlist de slugs reservados (api, admin, app, www, dashboard, support, help, docs, blog, auth) é convenção mínima — pode ser estendida pelo consumidor.

</specifics>

<deferred>
## Ideias Adiadas

- Bulk invite (N invites em batch) — Phase 110 (member-invite-flow)
- Owner transfer — Phase 111 (super-admin) ou skill futura
- Multi-language wizard — out of scope v1.21
</deferred>
