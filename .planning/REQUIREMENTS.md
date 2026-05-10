# REQUIREMENTS.md — Milestone v1.21 Suíte Multi-Tenant SaaS B2B

> Última atualização: 2026-05-10 — milestone v1.21 iniciado.
> Status: definido. Rastreabilidade preenchida pelo roadmap em `.planning/ROADMAP.md`.

## Contexto

6ª suíte do kit-mcp (após Supabase v1.8, Observabilidade v1.9, SRE v1.10, SRE Resilience v1.11, Legacy v1.12). Especialização sobre `/supabase` v1.8 para apps B2B com hierarquia firm→department→leader→collaborator e RBAC granular.

**Material-fonte da pesquisa:** `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md`.

**Stack alvo dos consumidores:** React + Supabase + Vercel.

**Contrato preservado:** content-only milestone, Stable API v1.0+ inalterada, zero deps novas no kit-mcp (apenas markdown).

## Requisitos do Milestone v1.21

### Architecture Core (ARCH)

- [ ] **ARCH-01**: Skill `b2b-saas-architecture` documenta estratégia canônica Single Schema + `org_id` + RLS, com tabela comparativa (single schema / schema-per-tenant / db-per-tenant) e quando cada uma aplica
- [ ] **ARCH-02**: Skill `b2b-saas-architecture` define schema canônico de 7 tabelas (`organizations`, `departments`, `roles`, `permissions`, `role_permissions`, `organization_members`, `department_members`) com FKs explícitas
- [ ] **ARCH-03**: Skill `multi-tenant-rls-hierarchy` define 4 helper functions PG canônicas (`private.is_member_of`, `private.has_role`, `private.has_permission`, `private.is_super_admin`) com signatures SQL completas e marcação `STABLE`
- [ ] **ARCH-04**: Skill `multi-tenant-rls-hierarchy` documenta partial indexes obrigatórios para performance RLS (incluindo `organization_members(user_id, org_id) WHERE status='active'`)
- [ ] **ARCH-05**: Skill `b2b-saas-architecture` define JWT claims minimal (`super_admin: bool` em `app_metadata` apenas) com justificativa anti-bloat
- [ ] **ARCH-06**: Skill `multi-tenant-performance-scaling` cobre Supavisor transaction mode (porta 6543), partitioning por `org_id` quando justificado, e MVs per-tenant

### Organization Onboarding (ORG)

- [ ] **ORG-01**: Skill `org-onboarding-flow` documenta fluxo signup → criar org → primeiro admin → setup wizard
- [ ] **ORG-02**: Agent `org-onboarding-implementer` gera código Supabase para fluxo (migration + RLS + Edge Function de setup)
- [ ] **ORG-03**: Skill cobre slug imutável + redirect trail caso mutação seja necessária

### RBAC (RBAC)

- [ ] **RBAC-01**: Skill `rbac-permissions-matrix-supabase` documenta modelagem action × resource × scope com permission strings `resource:action`
- [ ] **RBAC-02**: Skill cobre 3 roles built-in (owner/admin/member) + custom roles via tabela `roles` org-scoped
- [ ] **RBAC-03**: Skill documenta regra canônica "usuário só atribui roles ≤ ao próprio role"
- [ ] **RBAC-04**: Skill cobre permission inheritance department→org (default: dept role sobrescreve org role; NULL herda)

### Invite Flow (INVITE)

- [ ] **INVITE-01**: Skill `member-invite-flow` documenta token SHA-256 (`crypto.randomBytes(32).toString('hex')`) com hash no banco (nunca raw)
- [ ] **INVITE-02**: Skill cobre TTL 7 dias + single-use + state machine (`pending → accepted | rejected | cancelled | expired`)
- [ ] **INVITE-03**: Skill documenta padrão email-locked (NUNCA link compartilhável sem email-lock)
- [ ] **INVITE-04**: Agent `invite-flow-implementer` implementa idempotency em accept (race protection)

### Super-Admin Platform (ADMIN)

- [ ] **ADMIN-01**: Skill `super-admin-platform-pattern` documenta cross-tenant view + impersonation (padrão GitHub Enterprise)
- [ ] **ADMIN-02**: Skill cobre banner visual de impersonação + motivo obrigatório + TTL 30min
- [ ] **ADMIN-03**: Agent `super-admin-implementer` aborta se super-admin sem audit log obrigatório (BLOCKER)
- [ ] **ADMIN-04**: Skill cobre `super_admin: bool` em JWT `app_metadata` (set apenas via service_role)

### Audit Logs (AUDIT)

- [ ] **AUDIT-01**: Skill `audit-log-multi-tenant` define event taxonomy canônica (login, member_invited, role_changed, data_exported, member_removed, settings_changed, super_admin_action)
- [ ] **AUDIT-02**: Agent `audit-log-implementer` gera tabela `audit_log` append-only (REVOKE DELETE/UPDATE em PG; partition + read-only attach como alternativa)
- [ ] **AUDIT-03**: Skill cobre retention via pg_cron (Free 30d / Pro 90d / Enterprise 365d) com legal hold flag para LGPD erasure pendente
- [ ] **AUDIT-04**: Skill documenta PII sanitization automática + tenant_id obrigatório indexado

### LGPD Compliance (LGPD)

- [ ] **LGPD-01**: Skill `lgpd-multi-tenant-compliance` cobre 9 direitos LGPD Art. 18 com workflow per-tenant
- [ ] **LGPD-02**: Skill cobre DSR com SLA 15 dias (Art. 19) + alert pg_cron próximo do prazo
- [ ] **LGPD-03**: Skill documenta consent management granular (analytics ≠ marketing ≠ third-party) com default opt-out (anti-pitfall Art. 8 §5)
- [ ] **LGPD-04**: Skill cobre erasure com anonymization (UUID preservado, PII apagada) — NUNCA hard delete que destrói audit trail
- [ ] **LGPD-05**: Skill documenta cross-border config (`regions: ["gru1"]` Vercel + Supabase `sa-east-1`) considerando adequacy decision Brasil-UE de jan/2026
- [ ] **LGPD-06**: Agent `lgpd-compliance-auditor` audita gaps (DSR table missing, consent default opt-in, hard delete em erasure flow)

### WhatsApp / Evolution Go (WHATSAPP)

- [ ] **WHATSAPP-01**: Skill `evolution-go-whatsapp-integration` cobre Evolution Go (whatsmeow) E Meta Cloud API com tabela comparativa
- [ ] **WHATSAPP-02**: Skill documenta tenant identification via URL path `/functions/v1/whatsapp/{org_id}/webhook` + per-instance lookup Evolution Go
- [ ] **WHATSAPP-03**: Agent `evolution-go-integrator` implementa HMAC-SHA256 validation (Meta) + API key + IP whitelist (Evolution Go) com timing-safe comparison
- [ ] **WHATSAPP-04**: Skill documenta idempotency via `unique(org_id, message_id) ON CONFLICT DO NOTHING` (Meta entrega at-least-once, retry 7 dias)
- [ ] **WHATSAPP-05**: Skill cobre rate limit Meta 80 msg/s default (penalty 24h ban se exceder via erro 131056) + throttle Evolution Go 1 msg/s
- [ ] **WHATSAPP-06**: Skill `whatsapp-conversation-state-machine` modela conversação WhatsApp como xstate v5 com estados persistidos em PG
- [ ] **WHATSAPP-07**: Agent aborta se HMAC validation aplicada APÓS JSON.parse (validate raw body first)

### CRM Lead Pipeline (CRM)

- [ ] **CRM-01**: Skill `crm-lead-pipeline-patterns` define stages canônicos (`lead → qualified → proposal → negotiation → won | lost`)
- [ ] **CRM-02**: Skill cobre trigger Postgres validando state transitions (independente do client; CHECK constraint não basta)
- [ ] **CRM-03**: Agent `crm-pipeline-implementer` implementa ownership transfer com notification + audit log
- [ ] **CRM-04**: Skill documenta lead dedup via phone/email com unique constraint
- [ ] **CRM-05**: Skill cobre integração WhatsApp (lookup `contact_phone` → auto-create lead se não encontrado)

### React Frontend Patterns (REACT)

- [ ] **REACT-01**: Skill `org-switcher-react-pattern` documenta URL pattern `/orgs/[slug]/` (Next.js App Router middleware) + `useParams()` (Vite SPA + React Router v6)
- [ ] **REACT-02**: Skill `permission-gate-react-pattern` documenta CASL React (`@casl/ability` 6.8 + `@casl/react` 4.x) + hook `usePermission(action, resource)`
- [ ] **REACT-03**: Skill cobre anti-pattern: permission check SÓ client → server-side enforcement obrigatório (RLS + policy)
- [ ] **REACT-04**: Skill `member-management-react-shadcn` cobre componentes shadcn canônicos (data-table TanStack v8, dialog, select, badge, dropdown-menu, avatar, command, form, toast)
- [ ] **REACT-05**: Skill cobre org context global via `zustand` v5 com persist middleware
- [ ] **REACT-06**: Skill cobre JWT stale após role change (refresh strategy)

### Suíte kit-mcp Internal (SUITE)

- [ ] **SUITE-01**: Comando `/multi-tenant` orquestrador com ~11 subcomandos (sinônimos PT/EN: `multi-tenant`, `b2b`, `tenant`, `escritorio`)
- [ ] **SUITE-02**: 4 agents core implementados (`b2b-saas-architect`, `multi-tenant-rls-writer`, `multi-tenant-isolation-auditor`, `lgpd-compliance-auditor`)
- [ ] **SUITE-03**: 6 agents implementers implementados (`org-onboarding-implementer`, `invite-flow-implementer`, `super-admin-implementer`, `audit-log-implementer`, `evolution-go-integrator`, `crm-pipeline-implementer`)
- [ ] **SUITE-04**: Glossário `kit/skills/_shared-multi-tenant/glossary.md` com cross-ref ATIVO para `_shared-supabase/glossary.md` (não duplica termos)
- [ ] **SUITE-05**: Pattern de cross-suite invocation documentado (agents v1.21 delegam para agents v1.8 via `Task()` ou cross-ref Markdown — não duplicação)
- [ ] **SUITE-06**: Release artifacts atualizados (README com seção 6ª suíte + AUTOGEN-COUNTS regen + file-manifest.json regen + COMPATIBILITY.md cross-IDE)
- [ ] **SUITE-07**: 3 audit gates novos em `gates/`: `multi-tenant-rls-coverage` (CREATE TABLE sem ENABLE RLS), `service-role-not-in-user-facing` (Edge Function user-facing com service_role key), `dept-cycle-prevention` (trigger anti-cycle missing)

### Tests & Quality (TEST)

- [ ] **TEST-01**: Suite total cresce com mínimo 1 test por skill nova + 1 por agent novo (≥ 25 novos tests)
- [ ] **TEST-02**: Coverage mantida ≥ 86% line (CI threshold v1.20)
- [ ] **TEST-03**: Mutation baseline mantido ≥ 57.40% nos 10 src/core/ files baseline

## Requisitos Futuros (deferidos para v1.22+)

- TanStack Start integration (skill server-side)
- Expo (React Native) integration para mobile multi-tenant
- SolidStart / SvelteKit / Nuxt integrations
- Hono / Express / Fastify backend integrations
- WhatsApp template management (Business API templates approval flow)
- WhatsApp media handling (images, audio, documents) com Supabase Storage
- CRM advanced: AI scoring (lead intent prediction), conversion analytics
- Multi-region deployment patterns (Vercel multi-region + Supabase replicas)
- Advanced audit log analytics (queries pré-built, dashboards)
- Tech debt deferido do v1.20 (Phase 100 cli/index.js extract, Phase 101 mutation 5 files restantes, Phase 105 p99 monitoring)

## Fora do Escopo (exclusões explícitas)

- **Verticais específicas (advocacia/OAB, médica/CFM, contabilidade/CRC)** — confirmado pelo usuário 2026-05-10. Suíte é genérica B2B aplicável a qualquer nicho. Skills domain (CRM, WhatsApp) são reutilizáveis cross-vertical.
- **Better Auth e Clerk como alternativas a Supabase Auth** — análise comparativa documentada: Supabase Auth + RLS multi-tenant é canônico para o stack React + Supabase + Vercel. Better Auth/Clerk podem virar suítes específicas v2.x se aparecer caso real.
- **Schema-per-tenant e DB-per-tenant** — Single schema + `org_id` + RLS é canônico para 90% B2B SaaS. Schema-per-tenant fica documentado nas skills como alternativa para compliance extremo (saúde/jurídico com auditoria isolacional), mas NÃO é o caminho default das skills.
- **Custom Auth providers** (LDAP, SAML enterprise) — fora do escopo v1.21. Supabase Auth nativo + OAuth providers já cobertos pela suíte v1.8 são suficientes.
- **Postgres extensions self-hosted** (pgaudit como source canônica) — kit recomenda custom triggers PG + pg_cron como caminho canônico Supabase, NÃO pgaudit (não tem `org_id` nativo, ineficiente para multi-tenant).

## Rastreabilidade

(preenchida pelo roadmap em `.planning/ROADMAP.md` após `/novo-marco` Step 10)

| REQ-ID | Phase |
|---|---|
| (TBD) | (TBD) |

---

**Total: 51 REQs em 11 categorias.** Cobertura derivada da pesquisa consolidada em `.planning/research/SUMMARY.md`.
