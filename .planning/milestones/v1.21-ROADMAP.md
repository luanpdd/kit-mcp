# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.21 — Suíte Multi-Tenant SaaS B2B (Phases 106–116)

> Gerado: 2026-05-10 | 11 phases | 15 skills + 10 agents + 1 command + 1 glossário + 3 gates | 59 REQs

**Objetivo:** Adicionar a 6ª suíte ao kit-mcp — comando `/multi-tenant` + 10 agents + 15 skills + glossário compartilhado, especializando a suíte `/supabase` v1.8 para apps B2B com hierarquia firm→department→leader→collaborator e RBAC granular.

**Restrição crítica:** Content-only milestone — zero alterações em `src/core/`. Stable API v1.0+ preservada.

**Padrão cross-suite:** Agents v1.21 delegam para agents v1.8 via cross-ref Markdown + `Task()` handoff. Nunca reimplementam lógica Supabase já coberta.

**Convenção de conteúdo:** PT-BR em texto narrativo. Code blocks em EN com comentários PT-BR.

---

### Ondas de Execução

```
Onda 1 (paralelo):  Phase 106  Phase 116
Onda 2 (paralelo):  Phase 107  Phase 108  Phase 109
Onda 3 (paralelo):  Phase 110  Phase 111  Phase 112  Phase 113  Phase 114
Onda 4:             Phase 115
```

**Rationale das ondas:**
- Phase 106 (schema + helpers content) e Phase 116 (kit artifacts cross-cutting: command, glossário, gates) podem iniciar em paralelo — command e glossário não dependem de conteúdo de domínio específico.
- Phase 109 (Audit log) está em Onda 2 (não Onda 3) porque `ADMIN-03` declara BLOCKER: `super-admin-implementer` ABORTA sem audit log obrigatório. Phase 111 (Onda 3) precisa de Phase 109 concluída.
- Phase 115 (Frontend React) depende de Phase 108 (RLS completa) e Phase 110 (invite flow) — fica em Onda 4.

---

### Phase 106: Schema Core + Helper Functions PG

**Objetivo:** Estabelecer o schema canônico de 7 tabelas multi-tenant + conteúdo das 4 helper functions `private.*` + skill `b2b-saas-architecture` + skill `multi-tenant-performance-scaling`. Fundação sobre a qual todas as fases seguintes se apoiam.

**Artefatos produzidos:**
- `kit/skills/b2b-saas-architecture/SKILL.md`
- `kit/skills/multi-tenant-performance-scaling/SKILL.md`

**REQs cobertos:** ARCH-01, ARCH-02, ARCH-05, ARCH-06

**Pode ser paralelo com:** Phase 116

**Critérios de sucesso observáveis:**

1. Ao consultar a skill `b2b-saas-architecture`, o kit retorna a tabela comparativa entre single-schema, schema-per-tenant e db-per-tenant com recomendação explícita "default para 90% dos casos B2B".
2. A skill documenta o schema canônico das 7 tabelas (`organizations`, `departments`, `roles`, `permissions`, `role_permissions`, `organization_members`, `department_members`) com FKs explícitas e ordem de dependência de criação.
3. A skill define JWT claims minimal (`super_admin: bool` em `app_metadata` apenas) com anti-pattern explícito contra Opção C (lista de orgs no JWT causa bloat e stale de 1h).
4. Skill `multi-tenant-performance-scaling` referencia Supavisor porta 6543 (transaction mode), estratégia de partitioning por `org_id` quando > 50k rows/tenant, e Materialized Views per-tenant como padrão de query caching.
5. Ambas as skills são retornadas por `mcp__kit__list_kit` sem erro.

---

### Phase 107: Org Onboarding Flow

**Objetivo:** Skill `org-onboarding-flow` + agent `org-onboarding-implementer` — fluxo signup → criar org → primeiro admin → setup wizard, com slug imutável e redirect trail.

**Artefatos produzidos:**
- `kit/skills/org-onboarding-flow/SKILL.md`
- `kit/agents/org-onboarding-implementer.md`

**REQs cobertos:** ORG-01, ORG-02, ORG-03

**Depende de:** Phase 106

**Pode ser paralelo com:** Phase 108, Phase 109

**Critérios de sucesso observáveis:**

1. Ao invocar `/multi-tenant onboarding`, o agent `org-onboarding-implementer` é dispatched e pergunta sobre slug strategy (imutável vs redirect trail) antes de gerar qualquer código.
2. O agent produz migration SQL com criação de org + inserção de `organization_members` para o primeiro admin em uma única transação (atomicidade — sem janela entre criação de org e membership).
3. A skill documenta "slug imutável" como default com alternativa de `slug_history` + redirect 301 explicitamente — pitfall documentado antes que o consumer o descubra em produção.
4. O agent delega escrita da Edge Function de setup wizard para `supabase-edge-fn-writer` via handoff documentado (cross-suite delegation explícita).
5. O fluxo completo signup → org criada → primeiro admin → redirect ao dashboard está descrito em etapas numeradas na skill.

---

### Phase 108: RLS Hierarchy Completa + RBAC

**Objetivo:** Skill `multi-tenant-rls-hierarchy` + skill `rbac-permissions-matrix-supabase` + agent `multi-tenant-rls-writer` + agent `multi-tenant-isolation-auditor` — 4 helper functions PG com signatures completas, policies compostas, herança dept→org, e matrix action × resource × scope.

**Artefatos produzidos:**
- `kit/skills/multi-tenant-rls-hierarchy/SKILL.md`
- `kit/skills/rbac-permissions-matrix-supabase/SKILL.md`
- `kit/agents/multi-tenant-rls-writer.md`
- `kit/agents/multi-tenant-isolation-auditor.md`

**REQs cobertos:** ARCH-03, ARCH-04, RBAC-01, RBAC-02, RBAC-03, RBAC-04

**Depende de:** Phase 106

**Pode ser paralelo com:** Phase 107, Phase 109

**Critérios de sucesso observáveis:**

1. A skill `multi-tenant-rls-hierarchy` exibe as 4 signatures SQL completas com marcação `STABLE`, `security invoker` e `set search_path = ''` para todas: `private.is_member_of`, `private.has_role`, `private.has_permission`, `private.is_super_admin`.
2. A skill documenta o partial index obrigatório `organization_members(user_id, org_id) WHERE status='active'` com justificativa de impacto em tabelas 100k+ rows por tenant.
3. O agent `multi-tenant-rls-writer` contém seção explícita "Regras herdadas de supabase-rls-writer (v1.8)" com link cross-ref — nunca reimplementa, apenas referencia e estende.
4. O agent `multi-tenant-isolation-auditor` executa `SELECT relname FROM pg_class WHERE relrowsecurity = false AND relkind = 'r'` via `mcp__supabase__execute_sql` e ABORTA plano se resultado não-vazio.
5. A skill `rbac-permissions-matrix-supabase` documenta a regra "usuário só atribui roles ≤ ao próprio role" com exemplo de CHECK ou policy para enforcement.
6. A herança dept→org (nullable `department_members.role_id` herda de `organization_members.role_id`) está documentada com a função `private.effective_role_in_dept` e query de resolução `coalesce(dm.role_id, om.role_id)`.

---

### Phase 109: Audit Log Multi-Tenant

**Objetivo:** Skill `audit-log-multi-tenant` + agent `audit-log-implementer` — tabela `audit_log` append-only, taxonomy canônica de 7 eventos, retention via pg_cron (3 tiers), PII sanitization automática, legal hold flag para erasure LGPD.

**Artefatos produzidos:**
- `kit/skills/audit-log-multi-tenant/SKILL.md`
- `kit/agents/audit-log-implementer.md`

**REQs cobertos:** AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04

**Depende de:** Phase 106

**Pode ser paralelo com:** Phase 107, Phase 108

**Por que Onda 2 e não Onda 3:** ADMIN-03 é BLOCKER — `super-admin-implementer` (Phase 111) ABORTA se audit log não está implementado. Phase 109 precisa estar concluída antes de Phase 111 poder iniciar.

**Critérios de sucesso observáveis:**

1. O agent `audit-log-implementer` gera `REVOKE DELETE ON TABLE audit_logs FROM authenticated` na migration — tabela append-only verificável via `\dp audit_logs` no Supabase Studio.
2. A skill documenta a event taxonomy canônica com os 7 eventos mínimos: `login`, `member_invited`, `role_changed`, `data_exported`, `member_removed`, `settings_changed`, `super_admin_action`.
3. A skill cobre retention via `pg_cron` com os 3 tiers (Free 30d / Pro 90d / Enterprise 365d) e o campo `legal_hold: boolean` que bloqueia delete enquanto DSR LGPD está pendente.
4. O agent usa o padrão `supabase-cron-queues` (skill v1.8) via cross-ref explícito para retention scheduler — sem reimplementar pattern pg_cron + pgmq.
5. A skill documenta PII sanitization: `actor_name` e `target_email` armazenados como hash SHA-256 (não raw), e `tenant_id` como campo indexado de primeira classe em toda query.

---

### Phase 110: Invite Flow

**Objetivo:** Skill `member-invite-flow` + agent `invite-flow-implementer` — token SHA-256 com hash no banco, TTL 7 dias, single-use, state machine com 5 estados, email-lock obrigatório, idempotência em accept com race protection via `FOR UPDATE`.

**Artefatos produzidos:**
- `kit/skills/member-invite-flow/SKILL.md`
- `kit/agents/invite-flow-implementer.md`

**REQs cobertos:** INVITE-01, INVITE-02, INVITE-03, INVITE-04

**Depende de:** Phase 107 (org exists), Phase 108 (RLS policies ativas)

**Pode ser paralelo com:** Phase 111, Phase 112, Phase 113, Phase 114

**Critérios de sucesso observáveis:**

1. A skill documenta token SHA-256 com `crypto.randomBytes(32).toString('hex')` e instrução explícita: armazenar `sha256(token)` no banco, enviar raw token no email — nunca inverso.
2. A state machine está documentada com os 5 estados (`pending → accepted | rejected | cancelled | expired`) e tabela de transições permitidas.
3. A skill documenta o anti-pattern email-lock com exemplo explícito: "NUNCA expor link sem email-lock — qualquer pessoa com o link aceitaria o invite sem autenticação".
4. O agent gera código de accept com `SELECT ... FOR UPDATE` dentro de transação para race protection — segundo `accept` simultâneo retorna `already_accepted` ao invés de criar membership duplicada.
5. Idempotência em accept documentada: segunda chamada com mesmo token por mesmo usuário retorna 200 (não erro) se membership já existe.

---

### Phase 111: Super Admin Platform

**Objetivo:** Skill `super-admin-platform-pattern` + agent `super-admin-implementer` — cross-tenant view, impersonation (padrão GitHub Enterprise), banner visual obrigatório, motivo obrigatório, TTL 30min, `super_admin: bool` em `app_metadata` via service_role exclusivamente.

**Artefatos produzidos:**
- `kit/skills/super-admin-platform-pattern/SKILL.md`
- `kit/agents/super-admin-implementer.md`

**REQs cobertos:** ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04

**Depende de:** Phase 106, Phase 107, Phase 108, Phase 109 (BLOCKER — audit log obrigatório per ADMIN-03)

**Pode ser paralelo com:** Phase 110, Phase 112, Phase 113, Phase 114

**Critérios de sucesso observáveis:**

1. O agent `super-admin-implementer` ABORTA com mensagem explícita se audit log (Phase 109) não está implementado — checagem antes de gerar qualquer código de super-admin.
2. A skill documenta impersonation (GitHub Enterprise style) com 3 requisitos mandatórios: banner visual na UI, campo `reason` obrigatório no audit log, TTL de 30min com revogação automática de sessão.
3. A skill documenta que `super_admin: bool` em `app_metadata` é setado APENAS via service_role — com exemplo de Edge Function protegida e anti-pattern de set via client-side.
4. A skill documenta cross-tenant view com query de exemplo: `SELECT * FROM organizations` retorna todos os tenants apenas quando `private.is_super_admin()` é true em policy PERMISSIVE separada.
5. O evento `super_admin_action` no audit log tem campos obrigatórios documentados: `actor_id`, `target_org_id`, `action`, `reason`, `session_id`, `expires_at`.

---

### Phase 112: WhatsApp / Evolution Go Integration

**Objetivo:** Skill `evolution-go-whatsapp-integration` + skill `whatsapp-conversation-state-machine` + agent `evolution-go-integrator` — webhook URL path com tenant_id, HMAC per-org, idempotência via `ON CONFLICT DO NOTHING`, rate limit Meta 80 msg/s, state machine xstate v5 persistida em PG.

**Artefatos produzidos:**
- `kit/skills/evolution-go-whatsapp-integration/SKILL.md`
- `kit/skills/whatsapp-conversation-state-machine/SKILL.md`
- `kit/agents/evolution-go-integrator.md`

**REQs cobertos:** WHATSAPP-01, WHATSAPP-02, WHATSAPP-03, WHATSAPP-04, WHATSAPP-05, WHATSAPP-06, WHATSAPP-07

**Depende de:** Phase 106 (organizations table), Phase 109 (audit log para webhook events)

**Pode ser paralelo com:** Phase 110, Phase 111, Phase 113, Phase 114

**Critérios de sucesso observáveis:**

1. A skill documenta tabela comparativa Evolution Go (whatsmeow) vs Meta Cloud API com trade-offs: custo, rate limit, tenant routing, requisitos de infra — escolha documentada, não arbitrária.
2. A skill documenta tenant identification via URL path `/functions/v1/whatsapp/{org_id}/webhook` com validação UUID ANTES de abrir o payload (fail-fast antes do parse).
3. O agent `evolution-go-integrator` ABORTA se HMAC validation é aplicada após `JSON.parse` — WHATSAPP-07 como check explícito no step de validação do agent.
4. A skill documenta idempotência via `unique(org_id, message_id) ON CONFLICT DO NOTHING` com justificativa: Meta entrega at-least-once com retry automático por 7 dias.
5. A skill documenta rate limit Meta (80 msg/s, penalty 24h ban via erro 131056) + throttle Evolution Go (1 msg/s) com estratégia de queue para burst via pgmq.
6. O agent delega escrita da Edge Function Deno para `supabase-edge-fn-writer` via handoff com `EVOLUTION-DESIGN.md` como contexto — cross-suite invocation explicitamente documentada no agent.

---

### Phase 113: CRM Lead Pipeline

**Objetivo:** Skill `crm-lead-pipeline-patterns` + agent `crm-pipeline-implementer` — 6 stages canônicos, state machine via trigger Postgres (não só CHECK constraint), ownership transfer com notification + audit, lead dedup, integração WhatsApp.

**Artefatos produzidos:**
- `kit/skills/crm-lead-pipeline-patterns/SKILL.md`
- `kit/agents/crm-pipeline-implementer.md`

**REQs cobertos:** CRM-01, CRM-02, CRM-03, CRM-04, CRM-05

**Depende de:** Phase 106, Phase 109 (audit log para ownership transfer)

**Pode ser paralelo com:** Phase 110, Phase 111, Phase 112, Phase 114

**Critérios de sucesso observáveis:**

1. A skill documenta os 6 stages canônicos (`lead → qualified → proposal → negotiation → won | lost`) com tabela de transições permitidas e transições explicitamente proibidas.
2. A skill documenta trigger Postgres `BEFORE UPDATE` que valida state transitions com `RAISE EXCEPTION` em transição inválida — diferenciado de `CHECK constraint` que é contornável pelo client.
3. O agent `crm-pipeline-implementer` gera código de ownership transfer com: (a) notificação ao novo owner, (b) entrada no `audit_log` com `previous_owner_id + new_owner_id + reason` obrigatório.
4. A skill documenta lead dedup via `unique constraint (org_id, phone)` + `unique constraint (org_id, email)` com lógica de merge quando phone e email conflitam em registros diferentes.
5. A skill documenta integração WhatsApp: `contact_phone → lookup leads WHERE org_id = $org_id → auto-create lead` se não encontrado, com `org_id` do webhook como contexto de criação do lead.

---

### Phase 114: LGPD Compliance

**Objetivo:** Skill `lgpd-multi-tenant-compliance` + agent `lgpd-compliance-auditor` — 9 direitos Art. 18 com workflow per-tenant, DSR SLA 15 dias (Art. 19) com alerta pg_cron D-3, consent granular com default opt-out, erasure via anonymization (nunca hard delete), cross-border config.

**Artefatos produzidos:**
- `kit/skills/lgpd-multi-tenant-compliance/SKILL.md`
- `kit/agents/lgpd-compliance-auditor.md`

**REQs cobertos:** LGPD-01, LGPD-02, LGPD-03, LGPD-04, LGPD-05, LGPD-06

**Depende de:** Phase 106, Phase 109 (audit log para DSR tracking)

**Pode ser paralelo com:** Phase 110, Phase 111, Phase 112, Phase 113

**Critérios de sucesso observáveis:**

1. A skill lista os 9 direitos LGPD Art. 18 com workflow per-tenant para cada: confirmação, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento, revogação de consentimento, revisão de decisão automatizada.
2. A skill documenta DSR com SLA 15 dias (Art. 19) + pg_cron configurado para alerta D-3 (3 dias antes do prazo) — prazo acionável, não apenas documentado.
3. A skill documenta anti-pattern consent default opt-in com referência explícita ao Art. 8 §5 LGPD — o requisito de consentimento positivo e específico está linkado à lei.
4. A skill documenta erasure via anonymization: UUID preservado, PII apagada (`name → NULL`, `email → hash`, `phone → NULL`) — com justificativa de que hard delete destrói audit trail e pode violar retenção legal mínima.
5. O agent `lgpd-compliance-auditor` detecta 3 gaps críticos: DSR table missing, consent default opt-in, hard delete em erasure flow — produz relatório com severity por gap.
6. A skill documenta cross-border: `regions: ["gru1"]` (Vercel) + `sa-east-1` (Supabase) com nota sobre adequacy decision Brasil-UE de jan/2026.

---

### Phase 115: Frontend React Patterns

**Objetivo:** Skill `org-switcher-react-pattern` + skill `permission-gate-react-pattern` + skill `member-management-react-shadcn` — URL-based org context, CASL React `@casl/ability` 6.8, shadcn/ui 9 components canônicos, zustand v5 org store, JWT stale strategy após role change.

**Artefatos produzidos:**
- `kit/skills/org-switcher-react-pattern/SKILL.md`
- `kit/skills/permission-gate-react-pattern/SKILL.md`
- `kit/skills/member-management-react-shadcn/SKILL.md`

**REQs cobertos:** REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REACT-06

**Depende de:** Phase 108 (RLS hierarchy), Phase 110 (invite flow — member management UI)

**Onda 4 — última fase de domínio**

**Critérios de sucesso observáveis:**

1. A skill `org-switcher-react-pattern` documenta o padrão URL `/orgs/[slug]/` para Next.js App Router com middleware que valida slug → org_id ANTES de servir qualquer página; e o equivalente `useParams()` para Vite SPA com React Router v6.
2. A skill `permission-gate-react-pattern` documenta `@casl/ability` 6.8 + `@casl/react` 4.x com hook `usePermission(action, resource)` e anti-pattern explícito: permission check APENAS no client sem RLS server-side é security theater.
3. A skill `member-management-react-shadcn` lista os 9 componentes shadcn canônicos (data-table TanStack v8, dialog, select, badge, dropdown-menu, avatar, command, form, toast) com exemplo de composição para a tela de membros.
4. A skill documenta `zustand` v5 com persist middleware para org context global — com exemplo de `useOrgStore()` tipado em TypeScript.
5. A skill documenta JWT stale após role change: `supabase.auth.refreshSession()` chamado imediatamente após operação de role change, com fallback no RLS como enforcement final independente do JWT client.
6. Anti-pattern subdomínio sem Vercel Wildcard Domains está documentado com aviso de custo (requer Vercel Pro+) — evita armadilha de infra descoberta tarde.

---

### Phase 116: Kit Artifacts: Command + Glossário + Audit Gates + Release

**Objetivo:** Artefatos cross-cutting da suíte — comando `/multi-tenant` orquestrador com ~11 subcomandos + sinônimos PT/EN, glossário `_shared-multi-tenant/glossary.md` com cross-ref ativo para `_shared-supabase`, 3 audit gates novos, release artifacts atualizados (README, AUTOGEN-COUNTS, file-manifest.json, COMPATIBILITY.md). Pattern de cross-suite invocation documentado explicitamente no command.

**Artefatos produzidos:**
- `kit/commands/multi-tenant.md`
- `kit/skills/_shared-multi-tenant/glossary.md`
- `gates/multi-tenant-rls-coverage.mjs`
- `gates/service-role-not-in-user-facing.mjs`
- `gates/dept-cycle-prevention.mjs`
- Atualizações: README seção 6ª suíte, AUTOGEN-COUNTS regen, file-manifest.json regen, COMPATIBILITY.md

**REQs cobertos:** SUITE-01, SUITE-02, SUITE-03, SUITE-04, SUITE-05, SUITE-06, SUITE-07, TEST-01, TEST-02, TEST-03

**Corre em Onda 1 (inicia paralelo com Phase 106); conclui após todas as outras**

**Critérios de sucesso observáveis:**

1. O comando `/multi-tenant arquiteto` (e sinônimos `b2b`, `tenant`, `escritorio`) é invocável e dispatcha para `b2b-saas-architect` — verificável via `mcp__kit__list_kit` retornando o command.
2. O command contém seção "Cross-Suite Invocation" documentando explicitamente que agents v1.21 delegam para agents v1.8 via `Task()` handoff — padrão novo introduzido neste milestone.
3. O glossário `_shared-multi-tenant/glossary.md` cross-referencia `_shared-supabase/glossary.md` via link Markdown sem duplicar termos já definidos — termos como `app_metadata`, `service_role`, `pg_cron` apenas linkados.
4. Os 3 audit gates são executados via `mcp__kit__run_gates` e retornam PASS em codebase clean: `multi-tenant-rls-coverage` (CREATE TABLE sem ENABLE RLS = BLOCK), `service-role-not-in-user-facing` (Edge Function user-facing com service_role key = WARN), `dept-cycle-prevention` (departments sem trigger anti-cycle com FK self-referencial = BLOCK).
5. Suite total de testes cresce ≥ 25 novos tests (1 por skill nova + 1 por agent novo + testes de gates), coverage permanece ≥ 86% e mutation baseline ≥ 57.40% nos 10 arquivos baseline.
6. AUTOGEN-COUNTS e file-manifest.json refletem os novos artefatos sem discrepância — CI verde após regen.

---

### Mapeamento de Fases (tabela executiva)

| Phase | Nome | REQs cobertos | Artefatos | Onda |
|---|---|---|---|---|
| 106 | Schema Core + Helper Functions | ARCH-01, 02, 05, 06 | 2 skills | 1 |
| 107 | Org Onboarding Flow | ORG-01, 02, 03 | 1 skill + 1 agent | 2 |
| 108 | RLS Hierarchy + RBAC | ARCH-03, 04; RBAC-01…04 | 2 skills + 2 agents | 2 |
| 109 | Audit Log Multi-Tenant | AUDIT-01…04 | 1 skill + 1 agent | 2 |
| 110 | Invite Flow | INVITE-01…04 | 1 skill + 1 agent | 3 |
| 111 | Super Admin Platform | ADMIN-01…04 | 1 skill + 1 agent | 3 |
| 112 | WhatsApp / Evolution Go | WHATSAPP-01…07 | 2 skills + 1 agent | 3 |
| 113 | CRM Lead Pipeline | CRM-01…05 | 1 skill + 1 agent | 3 |
| 114 | LGPD Compliance | LGPD-01…06 | 1 skill + 1 agent | 3 |
| 115 | Frontend React Patterns | REACT-01…06 | 3 skills | 4 |
| 116 | Kit Artifacts (command + glossário + gates + release) | SUITE-01…07; TEST-01…03 | 1 command + 1 glossário + 3 gates + release updates | 1→final |

**Total: 11 phases, 15 skills, 10 agents, 1 command, 1 glossário, 3 audit gates.**

---

### Dependências entre Fases

```
Phase 106 (base)
    ├──► Phase 107 (onboarding)
    ├──► Phase 108 (RLS + RBAC)     ──────────────────────────────────► Phase 115 (React)
    └──► Phase 109 (audit log)                                                ▲
              │                                                               │
              ├──► Phase 111 (super admin — BLOCKER ADMIN-03)               │
              ├──► Phase 112 (WhatsApp)                                      │
              ├──► Phase 113 (CRM)                         Phase 110 (invite) ┘
              └──► Phase 114 (LGPD)                              ▲
                                                     Phase 107 + 108 ─────────┘

Phase 116 — inicia em Onda 1 (paralelo com 106), conclui após todas
```

---

<details>
<summary>Concluídos</summary>

- v1.0.0 → v1.5.3 — early stabilization + patches
- v1.6.0 → v1.7.0 — Perf+lean
- v1.8.0 — Suíte Supabase
- v1.9.0 — Observabilidade
- v1.10.0 — SRE Engagement
- v1.11.0 — SRE Resilience & Release Engineering
- v1.12 — Legacy Code Mastery & AI-Era Refactoring
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — 11 REQs, 33 tests. [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)
- **v1.14.0 — Web/Core Security Hardening (Phases 82-84)** — 6 REQs HIGH, 63 tests. [Audit](./milestones/v1.14-MILESTONE-AUDIT.md)
- **v1.15.0 — DX & Token Economy Wave 2 (Phases 85-87)** — 5 REQs, 26 tests. [Audit](./milestones/v1.15-MILESTONE-AUDIT.md)
- **v1.16.0 — Performance Runtime Wave (Phases 88-89)** — 6 REQs, 18 tests. [Audit](./milestones/v1.16-MILESTONE-AUDIT.md)
- **v1.17.0 — Performance Wave 2 + Quick Wins (Phases 90-93)** — 9 REQs, 27 tests, PRR 22→24/30. [Audit](./milestones/v1.17-MILESTONE-AUDIT.md)
- **v1.18.0 — Eat Your Own Dog Food (Phases 94-97)** — 7 REQs, 74 tests, 418 baseline. PRR **27/30**. [Audit](./milestones/v1.18-MILESTONE-AUDIT.md)
- **v1.19.0 — Maturidade Operacional (Phases 98-99)** — 5 REQs, 64 tests, 482 baseline. PRR **28/30**. Coverage 77.89→81.51%. [Audit](./milestones/v1.19-MILESTONE-AUDIT.md)
- **v1.20.0 — Tech Debt Closure & Quality Hardening (Phases 100-105)** — 6 REQs, 89 tests, 671 baseline. PRR **30/30**. Coverage 81.51→86.84%. Mutation baseline 57.40%. [Audit](./milestones/v1.20-MILESTONE-AUDIT.md) · [Roadmap](./milestones/v1.20-ROADMAP.md)

</details>
