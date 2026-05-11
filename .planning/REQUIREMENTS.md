# Requisitos: kit-mcp — Milestone v1.26

**Definidos:** 2026-05-11
**Valor Central:** Single canonical source para fluxo de trabalho IA dev sincronizado em 8 IDEs alvo. v1.26 adiciona pattern canônico de **Postgres Roles management** complementando RLS (v1.23) + Column-Level (v1.24) + Custom Claims RBAC (v1.25) com a fundação que sustenta as 3 trilhas: roles Postgres que definem system access (cron jobs, BI tools, ETL, admin scripts).

**Princípio canônico (herdado v1.23-v1.25):** Agents não-Supabase pensam/planejam. Agents Supabase materializam/hardenam. Nenhum lado descarta upstream.

**Material-fonte:** documentação oficial Supabase Postgres Roles (cobertura 100%).

**Distinção canônica:**
- Application access (RLS + Custom Claims): controla users vendo linhas/colunas
- System access (Postgres Roles): controla service accounts internos

## Requisitos v1.26

### Skill nova `supabase-postgres-roles`

- [ ] **ROLES-01**: Distinção Roles vs Users — roles podem ser users (LOGIN) ou groups (sem LOGIN)
- [ ] **ROLES-02**: CREATE ROLE syntax (`create role "name"` + variant `with login password 'pwd'`)
- [ ] **ROLES-03**: Password best practices — 12+ chars, password manager, mixed case+symbols, percent-encoding em connection string
- [ ] **ROLES-04**: GRANT/REVOKE permission patterns (SELECT, INSERT, UPDATE, DELETE em tabelas/views/functions/triggers)
- [ ] **ROLES-05**: Role hierarchy — INHERIT (child inherits parent) e NOINHERIT (override, tipicamente superuser)
- [ ] **ROLES-06**: 10 predefined Supabase roles documentados (postgres, anon, authenticator, authenticated, service_role, supabase_auth_admin, supabase_storage_admin, supabase_etl_admin, dashboard_user, supabase_admin) com responsibility de cada
- [ ] **ROLES-07**: Quando criar custom role vs usar predefined — service accounts internos (cron, BI, ETL); admin roles com BYPASSRLS; column-level GRANTs específicos
- [ ] **ROLES-08**: `authenticator` role canônico — JWT verify + switch role (anon ou authenticated baseado em JWT)
- [ ] **ROLES-09**: Changing postgres password — Dashboard Database Settings; sem downtime; serviços internos auto-update; serviços externos hardcoded credentials precisam manual update
- [ ] **ROLES-10**: Anti-patterns — usar service_role para application access; custom role para admin/user roles (deveria ser RLS + Custom Claims); password sem percent-encoding em URL; INHERIT em superuser; criar role sem documentação clara
- [ ] **ROLES-11**: pg_stat_statements para audit (cada role tem queries rastreáveis)
- [ ] **ROLES-12**: Cross-ref Postgres roles vs custom claims (v1.25) — system access vs application access; quando usar qual

### Patches em skills existentes (5 artefatos)

- [ ] **SKILL-PATCH-05**: Skill `supabase-rls-policies` (v1.23) ganha section "Postgres Roles vs RLS — quando usar qual" — system access vs application access
- [ ] **SKILL-PATCH-06**: Skill `supabase-rls-defense-in-depth` (v1.23) ganha Camada 10 (Postgres Roles Hierarchy) + DEFENSE-08 no checklist (era 9 itens → 10 itens)
- [ ] **SKILL-PATCH-07**: Skill `supabase-database-functions` (v1.8) expande GRANT EXECUTE patterns com role hierarchy + cross-ref Postgres roles
- [ ] **SKILL-PATCH-08**: Skill `supabase-migrations` (v1.23) ganha BLOCO 7 opcional (CREATE ROLE para custom service accounts)
- [ ] **SKILL-PATCH-09**: Skill `supabase-custom-claims-rbac` (v1.25) ganha section "Postgres Roles vs Custom Claims — distinção canônica" (system access vs application access)

### Agent novo `supabase-roles-implementer`

- [ ] **ROLES-AGENT-01**: Agent recebe spec (custom roles + hierarchy + GRANT matrix) via Task() upstream context + intent original
- [ ] **ROLES-AGENT-02**: Agent materializa CREATE ROLE + INHERIT/NOINHERIT + GRANT/REVOKE per schema/table/function
- [ ] **ROLES-AGENT-03**: Agent emite password security check (12+ chars, percent-encoding warning) quando role tem LOGIN PASSWORD
- [ ] **ROLES-AGENT-04**: Agent produz verdicts GO/STRENGTHEN/REWRITE-com-confirmação; REWRITE se caso é "application access" (sugere RLS + Custom Claims)
- [ ] **ROLES-AGENT-05**: Agent emite query SQL para validar roles + permissions existentes (audit pre-create)

### Patches em agents Supabase (3 artefatos)

- [ ] **HARDEN-11**: Agent `supabase-rls-hardener` (v1.23) ganha Detector 10 (Postgres Roles audit) — flagra projects com custom roles sem documentação ou GRANTs frouxos
- [ ] **ARCH-PATCH-01**: Agent `supabase-architect` (v1.8) ganha prompt upfront sobre Postgres roles (custom service accounts necessários?)
- [ ] **CMD-07**: Command `/supabase` ganha subcomando novo `role` (sinônimos: `papel`, `roles-pg`) dispatcheando para `supabase-roles-implementer`

### Cross-Suite Cooperative Handoff (4 agents v1.21)

- [ ] **CROSS-19**: Agent `audit-log-implementer` (v1.21) ganha handoff cooperativo — criar role `security_admin` para acesso payload (cross-ref column-level v1.24)
- [ ] **CROSS-20**: Agent `lgpd-compliance-auditor` (v1.21) ganha handoff cooperativo — criar role `dpo_role` (Data Protection Officer) para DSR access
- [ ] **CROSS-21**: Agent `crm-pipeline-implementer` (v1.21) ganha handoff cooperativo — criar role `lead_manager` para PII columns access
- [ ] **CROSS-22**: Agent `super-admin-implementer` (v1.21) ganha handoff cooperativo — criar role `platform_admin` separado de service_role (governance + audit trail)

### Documentation & Release

- [ ] **DOC-01**: README.md AUTOGEN-COUNTS regenerado (63→64 agents, 89 commands mantido, 70→71 skills)
- [ ] **DOC-02**: file-manifest.json atualizado com novos artefatos
- [ ] **DOC-03**: CHANGELOG entry v1.26 documentando 6 entregáveis + princípio canônico herdado + 10 predefined Supabase roles
- [ ] **DOC-04**: Glossário compartilhado +8 termos (Postgres roles, INHERIT/NOINHERIT, LOGIN PASSWORD, GRANT/REVOKE syntax, role hierarchy, predefined Supabase roles, role switching authenticator, percent-encoding password)
- [ ] **DOC-05**: MILESTONES.md + PROJECT.md + STATE.md transitions via `/concluir-marco`; package.json bump 1.25.0→1.26.0

## Rastreabilidade

| Categoria | REQs | Phase |
|-----------|------|-------|
| ROLES-01..12 | 12 REQs | 143 |
| SKILL-PATCH-05..09 | 5 REQs | 144 |
| ROLES-AGENT-01..05 | 5 REQs | 145 |
| HARDEN-11, ARCH-PATCH-01, CMD-07 | 3 REQs | 146 |
| CROSS-19..22 | 4 REQs | 147 |
| DOC-01..05 | 5 REQs | 148 |

**Cobertura:** 34 REQs total, 34 mapeados para 6 phases (143-148), 0 não-mapeados.
