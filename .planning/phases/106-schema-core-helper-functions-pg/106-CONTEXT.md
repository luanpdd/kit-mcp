# Fase 106: Schema Core + Helper Functions PG - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Estabelecer o schema canônico de 7 tabelas multi-tenant (`organizations`, `departments`, `roles`, `permissions`, `role_permissions`, `organization_members`, `department_members`) com FKs explícitas + conteúdo das 4 helper functions PG canônicas em schema `private` (`is_member_of`, `has_role`, `has_permission`, `is_super_admin`) com signatures STABLE — tudo materializado em duas skills do kit-mcp:

1. `kit/skills/b2b-saas-architecture/SKILL.md` — schema canônico, isolation strategies, JWT claims minimal
2. `kit/skills/multi-tenant-performance-scaling/SKILL.md` — Supavisor transaction mode (porta 6543), partitioning por `org_id`, Materialized Views per-tenant

Esta fase é **fundação** da Suíte Multi-Tenant SaaS B2B v1.21 — todas as fases 107-115 referenciam o schema canônico e helpers definidos aqui.

REQs cobertos: ARCH-01, ARCH-02, ARCH-05, ARCH-06.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração do usuário. Use o objetivo da fase no ROADMAP (linhas 37-55 de `.planning/ROADMAP.md`), os 5 critérios de sucesso observáveis listados, e a pesquisa consolidada em `.planning/research/SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` para guiar decisões.

### Decisões já validadas pela pesquisa (vinculantes para planejamento)
- **Single Schema + `org_id` + RLS** é estratégia default — schema-per-tenant e db-per-tenant ficam documentados como alternativas para compliance extremo
- **JWT claims minimal** — apenas `super_admin: bool` em `app_metadata`. Lista de orgs no JWT é anti-pattern (bloat + stale 1h)
- **4 helper functions** em schema `private` (não `public` — PostgREST não expõe), todas marcadas `STABLE`, `security invoker`, `set search_path = ''`
- **Partial indexes obrigatórios** — `organization_members(user_id, org_id) WHERE status='active'`, composite em `roles(name, org_id)`, composite em `permissions(action, resource)`
- **Supavisor transaction mode porta 6543** para Vercel/serverless (porta 5432 só para long-running Node.js)

### Cross-suite delegation
Esta skill é referenciada por agents nas fases seguintes via cross-ref Markdown ATIVO. Não escreve código direto — fornece o schema canônico que `multi-tenant-rls-writer` (Phase 108), `org-onboarding-implementer` (Phase 107), etc. usam como entrada.

</decisions>

<code_context>
## Insights do Código Existente

Contexto da base de código será coletado durante a pesquisa do plan-phase.

Convenção do kit já estabelecida (referenciar):
- `kit/skills/_shared-supabase/glossary.md` (v1.8) — termos canônicos a reutilizar via cross-ref
- `kit/skills/supabase-rls-policies/SKILL.md` (v1.8) — anti-patterns canônicos `(select auth.uid())` wrapper, no `user_metadata` em authz
- `kit/skills/supabase-database-functions/SKILL.md` (v1.8) — padrões de functions PG (security invoker, search_path = '')
- `kit/skills/supabase-postgres-style/SKILL.md` (v1.8) — naming snake_case, lowercase reserved
- Pattern padrão de SKILL.md: frontmatter (`name`, `description`), seções "Quando usar", "Regras absolutas", "Patterns canônicos", "Anti-patterns", "Ver também"

</code_context>

<specifics>
## Ideias Específicas

Sem requisitos específicos — fase de discuss pulada. Consulte a descrição da fase no ROADMAP e critérios de sucesso.

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
