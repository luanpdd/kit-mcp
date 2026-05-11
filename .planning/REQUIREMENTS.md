# Requisitos: kit-mcp — Milestone v1.25

**Definidos:** 2026-05-11
**Valor Central:** Single canonical source para fluxo de trabalho IA dev sincronizado em 8 IDEs alvo. v1.25 adiciona pattern canônico de **Custom Claims via Custom Access Token Auth Hook** para RBAC, complementando RLS row-level (v1.23) + column-level (v1.24) com claims customizados no JWT que evitam JOINs custosos em policies.

**Princípio canônico (herdado de v1.23/v1.24):** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam. Nenhum lado descarta o outro.

**Material-fonte:** documentação oficial Supabase Custom Claims & Role-based Access Control via Custom Access Token Auth Hook (cobertura 100%).

**Caveat embutido:** JWT freshness — mudanças em user_roles só refletem no JWT após token refresh (TTL 1h default). Auth hook delivery é eventually consistent. Para invalidação imediata, force logout do user via `auth.admin.signOut()`.

## Requisitos v1.25

### Skill nova `supabase-custom-claims-rbac`

- [ ] **CLAIMS-01**: Skill documenta enum types canônicos (`app_role`, `app_permission`)
- [ ] **CLAIMS-02**: Skill documenta tabelas `user_roles` (user_id → role) e `role_permissions` (role → permission) com FKs + unique constraints
- [ ] **CLAIMS-03**: Skill documenta Custom Access Token Auth Hook function (`custom_access_token_hook(event jsonb) returns jsonb`) com SQL completo
- [ ] **CLAIMS-04**: Skill documenta permissions canônicos para `supabase_auth_admin` role (GRANT USAGE schema + GRANT EXECUTE function + REVOKE FROM authenticated/anon/public + GRANT ALL ON user_roles + REVOKE FROM authenticated/anon/public + RLS policy permitindo read)
- [ ] **CLAIMS-05**: Skill documenta `authorize()` function `security definer` que lê `auth.jwt() ->> 'user_role'` e checa permission em role_permissions
- [ ] **CLAIMS-06**: Skill documenta RLS policies usando `authorize()` — pattern `using ((SELECT authorize('channels.delete')))`
- [ ] **CLAIMS-07**: Skill documenta enable do hook via Dashboard (Authentication > Hooks Beta) e local development
- [ ] **CLAIMS-08**: Skill documenta client-side JWT decode via `jwt-decode` package + `onAuthStateChange` listener pattern
- [ ] **CLAIMS-09**: Skill documenta caveat JWT freshness (mudanças em user_roles só refletem após token refresh; force logout para invalidação imediata)
- [ ] **CLAIMS-10**: Skill documenta anti-patterns (esquecer GRANT ao supabase_auth_admin, hardcoded role em policy ao invés de authorize(), assumir JWT fresh sem refresh, mutar app_metadata do cliente para mudar role)

### Patches em skills existentes (4 artefatos)

- [ ] **SKILL-PATCH-01**: Skill `supabase-rls-policies` ganha section "RBAC via Custom Claims + authorize() function (v1.25)" — combinar RLS row-level com claim check
- [ ] **SKILL-PATCH-02**: Skill `supabase-rls-defense-in-depth` ganha Camada 9 (Auth Hooks - Custom Claims) — alternativa moderna a dedicated role table com JOIN
- [ ] **SKILL-PATCH-03**: Skill `supabase-database-functions` ganha pattern "Custom Access Token Auth Hook" + supabase_auth_admin GRANTs canônicos
- [ ] **SKILL-PATCH-04**: Skill `rbac-permissions-matrix-supabase` (v1.21) atualizada com auth hook como mecanismo canônico de delivery dos claims (era helper function PG STABLE)

### Agent novo `supabase-rbac-implementer`

- [ ] **RBAC-AGENT-01**: Agent novo recebe spec (roles + permissions matrix) via Task() upstream context + intent original
- [ ] **RBAC-AGENT-02**: Agent materializa setup completo: enum types + 2 tables + auth hook function + supabase_auth_admin grants + authorize() function + RLS policies template + client decoder snippet
- [ ] **RBAC-AGENT-03**: Agent produz verdicts GO/STRENGTHEN/REWRITE-com-confirmação (paralelo ao rls-hardener e column-privileges-writer)
- [ ] **RBAC-AGENT-04**: Agent emite query SQL para validar auth hook instalado + supabase_auth_admin permissions corretos

### Patches em agents Supabase (3 artefatos)

- [ ] **HARDEN-09**: Agent `supabase-rls-hardener` ganha Detector 9 (RBAC via custom claims check) — flagra projects com user_roles table mas sem auth hook instalado
- [ ] **HARDEN-10**: Agent `supabase-rls-hardener` faz chain cooperativo para `supabase-rbac-implementer` quando Detector 9 encontra gap
- [ ] **AUTH-PATCH-01**: Agent `supabase-auth-bootstrapper` inclui setup de auth hook + jwt-decode no bootstrap Next.js v16 + onAuthStateChange listener pattern

### Command `/supabase` patches

- [ ] **CMD-05**: Command `/supabase` ganha subcomando novo `rbac` (sinônimos: `roles`, `permissions`, `claims`) dispatcheando para `supabase-rbac-implementer`
- [ ] **CMD-06**: Subcomando `rbac` documentado com input format `<roles>` + `<permissions_matrix>` + `<user_facing_caller>` (alinhado com pattern v1.23/v1.24)

### Cross-Suite Cooperative Handoff (3 agents v1.21)

- [ ] **CROSS-16**: Agent `multi-tenant-rls-writer` (v1.21) ganha handoff cooperativo para `supabase-rbac-implementer` — custom claims como alternativa moderna a helper functions PG STABLE
- [ ] **CROSS-17**: Agent `super-admin-implementer` (v1.21) ganha handoff cooperativo — `super_admin: bool` pode migrar de `app_metadata` para custom claim via auth hook
- [ ] **CROSS-18**: Agent `audit-log-implementer` (v1.21) ganha handoff cooperativo — eventos de mudança de role registrados via auth hook trigger

### Documentation & Release

- [ ] **DOC-01**: README.md AUTOGEN-COUNTS regenerado (62→63 agents, 89 commands mantido, 69→70 skills)
- [ ] **DOC-02**: file-manifest.json atualizado com novos artefatos (skill + agent novos)
- [ ] **DOC-03**: CHANGELOG entry v1.25 documentando 6 entregáveis + princípio canônico herdado + caveat JWT freshness
- [ ] **DOC-04**: Glossário compartilhado `_shared-supabase/glossary.md` +8 termos novos (custom claims, Custom Access Token Auth Hook, JWT user_role claim, authorize() function, supabase_auth_admin role, app_role enum, app_permission enum, jwt-decode client pattern)
- [ ] **DOC-05**: MILESTONES.md atualizado pós-`/concluir-marco`; PROJECT.md/STATE.md refletem v1.25 entregue; package.json bump 1.24.0→1.25.0

## Fora do Escopo (v1.25)

| Funcionalidade | Motivo |
|----------------|--------|
| Outros Auth Hooks (Send Email, Send SMS, MFA Verification, etc.) | v1.26+ — foco em Custom Access Token para RBAC |
| Encryption at rest (Supabase Vault) | v1.26+ — escopo separado |
| Dashboard UI customizada para gerenciar roles | v2 — kit-mcp é CLI-first |
| Auth Hook em outras linguagens (Edge Function ao invés de PG) | v1.26+ — variant alternativa |
| Migração retroativa de projetos com helper function STABLE para custom claims | Risco médio — defer para tooling com dry-run |

## Rastreabilidade

_(preenchido pelo roadmapper)_

| Categoria | REQs | Phase |
|-----------|------|-------|
| Skill nova (CLAIMS-*) | CLAIMS-01..10 | 137 |
| Skill patches (SKILL-PATCH-*) | SKILL-PATCH-01..04 | 138 |
| Agent novo (RBAC-AGENT-*) | RBAC-AGENT-01..04 | 139 |
| Hardener + bootstrap + command | HARDEN-09..10, AUTH-PATCH-01, CMD-05..06 | 140 |
| Cross-suite (CROSS-*) | CROSS-16..18 | 141 |
| Release (DOC-*) | DOC-01..05 | 142 |

**Cobertura:** 32 REQs total, 32 mapeados para 6 phases (137-142), 0 não-mapeados.

---
*Requisitos definidos: 2026-05-11*
