# MILESTONES.md — Histórico de releases

## v1.28 → v1.45 — reconciliação retroativa (registrada em 2026-07-01)

> Releases v1.28→v1.45 foram shippadas por PR direto, fora do fluxo de fases do framework.
> Registro de 1 linha por release; fonte de verdade: `git tag` + `CHANGELOG.md` (datas do
> CHANGELOG quando a entry existe; datas de tag quando não). Sem detalhe inventado.

- **v1.45.0** (2026-07-01) — Comando `/base`: gestão do registro canônico `PROJETOS.md` (listar/adicionar/editar/remover/init, projetos conectados multi-projeto).
- **v1.44.1** (2026-07-01) — Housekeeping: `PROJETOS.md` no repo + `.gitignore` para marcadores locais de instalação; sem mudança funcional no pacote.
- **v1.44.0** (2026-06-23) — Absorção do shadcn/improve (ondas P0+P1+P2): skills `agent-safety-hard-rules`/`leverage-scoring`/`reconcile-execution-backlog`, agents `advisor-auditor`/`diff-auditor`/`direction-prospector`, commands `/auditar`/`/prospectar-direcao`/`/reconciliar`; PLAN.md hermético; fix advisory HIGH do `hono`.
- **v1.43.0** (2026-06-19) — 8 agents novos da auditoria do kit (KIT-AUDIT) + gate de integridade de cross-links `.md` + fix de 25 cross-links + sync `VERSION` 1.42.0. *(Sem entry no CHANGELOG; fonte: `git log v1.42.0..v1.43.0`.)*
- **v1.42.0** (2026-06-19) — Agent `commit-pr-conductor` + drift-guards de contagem de packs. *(Sem entry no CHANGELOG; fonte: `git log v1.41.0..v1.42.0`.)*
- **v1.41.0** (2026-06-14) — Content Packs Fase 3 (lockfile por pack/target, `kit pack add/remove/store/doctor`) + consciência de custo em runtime (`cost_tier` nas listagens, pré-flight de subagentes) + gate bloqueante `resource-frontmatter` + router bundle-aware.
- **v1.40.0** (2026-06-14) — Consciência de uso e custo nos recursos: `cost_tier` em 174 agents/skills, descriptions outcome-first ≤200 chars, `docs/audit-recursos-melhorias.md` (auditoria multi-agente).
- **v1.39.0** (2026-06-14) — Content Packs (instalação modular/seletiva): 6 packs autossuficientes, `kit pack list/info`, gate de cobertura; fix `bin/mcp.js` dual-mode CLI/stdio.
- **v1.38.0** (2026-06-13) — Suporte ao Google Antigravity 2.0 (IDE + CLI, MCP config compartilhado); remoção do target `gemini-cli` e da flag `--gemini` de `/revisar`.
- **v1.37.0** (2026-06-05) — Cost Tracking Suite (Phase 172): 5 MCP tools `cost-*`, CLI `kit cost` (7 sub-actions), statusline, skill `cost-tracking`, GH Action de refresh do pricing snapshot.
- **v1.36.0** (2026-06-05) — Hardening do `workflow-generator`: templates copiáveis + bloco anti-patterns + validação obrigatória contra os 3 bugs estruturais fatais de `.workflow.js` da v1.35. *(Sem git tag; fonte: CHANGELOG.)*
- **v1.35.0** (2026-06-05) — Workflow Generator: geração de Dynamic Workflows sob demanda seguindo os 6 patterns canônicos da Anthropic. *(Sem git tag; fonte: CHANGELOG.)*
- **v1.34.0** (2026-06-05) — Dynamic Workflows capability: loader `kit/workflows/`, sync/reverse-sync de `*.workflow.js`, 1º workflow embarcado (`auditar-observabilidade-cobertura`). *(Sem git tag; fonte: CHANGELOG.)*
- **v1.33.0** (2026-05-25) — Suíte de design UI ("fluência de design para IA"): skills de design + agent materializador, arquitetura Ensinar/Comandar/Detectar.
- **v1.32.0** (2026-05-19) — Suíte de autenticação Supabase: expansão da cobertura a partir da doc oficial (auth básico/sessões, social/OAuth/SSO, MFA/segurança).
- **v1.31.0** (2026-05-18) — Density & routing hardening: resposta à análise de 10 pontos ("kit denso, agents não chamados corretamente").
- **v1.30.2** (2026-05-13) — Always-emit attribution + auto-registro do hook `UserPromptSubmit` no `auto-install`.
- **v1.30.1** (2026-05-13) — Kit Attribution & First-Tool Browser Open (visibilidade de uso real do kit).
- **v1.30.0** (2026-05-13) — Edge Functions 2026 Modernization: 5 skills novas + agent `supabase-edge-fn-tester` + 18 gaps da doc oficial fechados.
- **v1.29.0** (2026-05-12) — MCP-Native Discovery via Auto-Sync: 6 fases (166-171), 25 REQs — roots capability, tool `auto-install`, restart signal, resources, doctor drift check.
- **v1.28.0** (2026-05-12) — UX & Onboarding: developer experience do MCP stdio server, redução de TTFU; primeiro milestone não-content desde v1.20.

---

## v1.27 Supabase Branching & CI/CD Workflow (Shipped: 2026-05-11)

**Phases completed:** 7 phases (149-155), 45 REQs covered (100%), 20 atomic commits

**Key accomplishments:**

- **5 skills novas** (`kit/skills/`): `supabase-branching-workflow` (544 linhas — preview vs persistent, deploy DAG 7 steps, GitHub integration setup, Dashboard alpha caveats, custo Branching Compute Hours FORA do Spend Cap), `supabase-config-toml-remotes` (807 linhas — `[remotes]` block, secrets per-branch, dotenvx encrypted fields, 6 grupos canônicos), `supabase-ci-cd-github-actions` (880 linhas — 8 workflows canônicos com warning "never to public repo" 2×), `supabase-pgtap-testing` (1053 linhas — pgTAP + Deno tests + cross-ref legacy-characterizer, gap testing nunca antes coberto), `supabase-migration-repair` (823 linhas — migration list/repair, rollback preview, schema drift, permission denied troubleshooting). Total: **4107 linhas** de conteúdo canônico.
- **2 agents novos** (`kit/agents/`): `supabase-branching-architect` (562 linhas — projeta estratégia branching ANTES do setup, coleta 4 decisões via AskUserQuestion, produz BRANCHING-DESIGN.md, cross-suite delega para `supabase-architect`), `supabase-cicd-pipeline-implementer` (777 linhas — recebe BRANCHING-DESIGN.md + materializa 7-8 workflows GitHub Actions + cross-suite handoffs para `supabase-migration-writer` e `release-pipeline-auditor`). Verdicts canônicos GO/STRENGTHEN/REWRITE-com-confirmação (pattern v1.23). Total: **1339 linhas**.
- **Cross-suite enrichment (3 agents v1.x patched):** `supabase-architect` (v1.8) ganha section "Branching Strategy Decision" com handoff cooperativo + cost alert Branching Compute fora do Spend Cap. `supabase-migration-writer` (v1.23) ganha warnings sobre concurrent `db push` from different machines + timestamp order após rebase. `release-pipeline-auditor` (v1.10) ganha "Branching Workflow Validation" com 4 checks (required check Supabase Preview, secrets stored, migration safety pre-merge, backup workflow não em repo público).
- **9ª trilha de maturidade adicionada:** deployment maturity. Complementa as 4 trilhas de segurança Supabase (RLS row-level v1.23 + Column-Level v1.24 + Custom Claims app access v1.25 + Postgres Roles system access v1.26) — ortogonal: trilhas v1.23-v1.26 controlam **quem vê o quê**; trilha v1.27 controla **como mudanças chegam à produção**.
- **3 cross-suite handoffs novos** (ARCH-05 → `supabase-architect`, CICD-03 → `supabase-migration-writer`, CICD-04 → `release-pipeline-auditor`). Total cross-suite handoffs cumulativos: **27** (12 RLS v1.23 + 5 column v1.24 + 3 RBAC v1.25 + 4 Roles v1.26 + 3 Branching v1.27).
- **Princípio canônico v1.23 preservado (herdado v1.24/v1.25/v1.26):** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Aplicado em ambos os agents novos (architect coleta decisões SEM descartar intent; cicd-implementer materializa com verdicts construtivos GO/STRENGTHEN/REWRITE-com-confirmação, não BLOCK rígido).
- **Anti-patterns canônicos capturados (cumulativo cross-skills):** backup em repo público (warning 2× na skill + reforço 3× no cicd-implementer), schema changes direto no remote bypassing migration history, concurrent `db push` from different machines, "update branch" sobrescreve all edge functions (perda silenciosa), Branching Compute Hours fora do Spend Cap (custo invisível), timestamps wrong order após git rebase, `migration repair` esperando reverter SQL (atualiza tracking table only), encrypted: syntax em field não-designated (não decripta silenciosamente).
- Glossário compartilhado `_shared-supabase/glossary.md` ganhou 10 termos novos com tag `(v1.27)`: Branching Compute Hours, Branching workflow (Supabase), Deploy DAG (7 steps), dotenvx encrypted fields, Migration repair, Persistent branch, pgTAP testing, Preview branch, `[remotes]` block, Schema drift.
- AUTOGEN-COUNTS regen: 64→**66 agents** (+2: supabase-branching-architect + supabase-cicd-pipeline-implementer), 89 commands (mantido), 71→**76 skills** (+5: branching-workflow + config-toml-remotes + ci-cd-github-actions + pgtap-testing + migration-repair), 23 gates (mantido); file-manifest 375→**382 files**. Stable API v1.0+ preservada cross-15-releases (v1.13→v1.27). Defense-in-depth camadas mantidas em 10 (v1.27 é ortogonal — deployment maturity). Próximo marco: v1.28 (a definir — candidatos: Supabase Vault encryption-at-rest, Backup & Recovery dedicado, outros Auth Hooks, MFA enforcement, Terraform provider).

---

## v1.26 Postgres Roles (Shipped: 2026-05-11)

**Phases completed:** 6 phases (143-148), 34 REQs covered (100%), 7 atomic commits

**Key accomplishments:**

- **Skill nova `supabase-postgres-roles`** documenta 100% da doc oficial Supabase Postgres Roles — distinção roles vs users (LOGIN privilege determina), CREATE ROLE syntax (group sem LOGIN vs user com `with login password`), password best practices canônicos (12+ chars, password manager, mixed case+symbols, percent-encoding obrigatório em connection string com tabela completa de encoding: `=` `%3D`, `&` `%26`, `+` `%2B`, etc.), GRANT/REVOKE patterns (per schema/table/function/sequence + default privileges para tabelas futuras), role hierarchy (INHERIT default vs NOINHERIT preferido para superuser-like com SET ROLE explícito), **10 predefined Supabase roles** documentados com responsibility (postgres admin, anon unauthenticated, authenticator PostgREST switch, authenticated logged-in, service_role bypass RLS, supabase_auth_admin Auth middleware, supabase_storage_admin Storage middleware, supabase_etl_admin Replication, dashboard_user UI, supabase_admin internal), 4 patterns canônicos (CREATE ROLE básico, GRANT/REVOKE, hierarchy multi-level, custom service accounts para cron/BI), 5 anti-patterns, pg_stat_statements audit por role, changing postgres password (sem downtime).
- **Agent novo `supabase-roles-implementer`** — canonical materializer paralelo aos 3 hardeners existentes (rls-hardener v1.23, column-privileges-writer v1.24, rbac-implementer v1.25). Recebe spec (custom roles + hierarchy + GRANT matrix) via `Task()` upstream context + intent. Materializa CREATE ROLE + INHERIT/NOINHERIT + GRANT/REVOKE per schema/table/function/sequence + password security check (12+ chars, percent-encoding warning, generate 32-char random ou source from vault). Verdicts construtivos GO/STRENGTHEN/REWRITE-com-confirmação. **REWRITE com confirmação obrigatória** se caller pede role para application access (sugere RLS + Custom Claims v1.25). BLOCK se tenta criar role com nome de predefined Supabase role.
- **Camada 10 (Postgres Roles Hierarchy) adicionada ao defense-in-depth** — checklist atualizado de 9 para 10 itens; DEFENSE-08 dedicated section. Service accounts internos (cron, BI, ETL, admin scripts) usam Postgres roles dedicados em vez de service_role API key — auditabilidade superior via pg_stat_statements + role com BYPASSRLS específicos.
- **Subcomando novo `/supabase role`** (sinônimos: `papel`, `roles-pg`) dispatcheando para `supabase-roles-implementer`. Section dedicada no command com aviso "system access apenas" + cross-ref para `/supabase rbac` (application access v1.25). Distinção canônica reforçada — Postgres roles = system access; RLS + Custom Claims = application access.
- **Agent `supabase-rls-hardener` (v1.23) ganha Detector 10** — flagra custom Postgres roles sem `description`/`comment` documentado (P2), com BYPASSRLS sem razão clara (P1), com GRANT ALL em schema completo sem justificativa (P0), ou service_role API key sendo usado em cron/BI quando custom role dedicado seria melhor (P1). Chain cooperativo para `supabase-roles-implementer` quando gap detectado.
- **Agent `supabase-architect` (v1.8) ganha section "5.1 Postgres Roles"** — prompt upfront sobre custom service accounts no design phase: "Esta feature precisa de service accounts internos (cron jobs, BI tools, ETL, admin scripts)?". Cross-suite handoff para `supabase-roles-implementer` na ordem de implementação. Reinforça anti-pattern: NÃO criar Postgres roles para application access (use RLS + Custom Claims).
- **Cross-suite handoff cooperativo Postgres Roles (4 agents v1.21):** audit-log-implementer cria `security_admin` (group role com BYPASSRLS para payload PII via SET ROLE), lgpd-compliance-auditor cria `dpo_role` (user role com LOGIN PASSWORD + BYPASSRLS para DSR + erasure Art. 18), crm-pipeline-implementer cria `lead_manager` (group role SEM BYPASSRLS — respeita org boundary — para PII columns leads via SET ROLE), super-admin-implementer cria `platform_admin` (user role com LOGIN PASSWORD + BYPASSRLS separado de service_role para audit trail granular em pg_stat_statements).
- **Princípio canônico (herdado v1.23, estendido v1.24/v1.25/v1.26):** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Aplicado em 4 cross-suite handoffs Postgres Roles (adiciona aos 12 RLS v1.23 + 5 column v1.24 + 3 RBAC v1.25 = **24 cross-suite handoffs cumulativos**). Distinção canônica system access vs application access enforced cross-skill/agent/command.
- Patches em 5 skills existentes: `supabase-rls-policies` (section "Postgres Roles vs RLS — quando usar qual" com tabela comparativa), `supabase-rls-defense-in-depth` (Camada 10 + DEFENSE-08), `supabase-database-functions` (section "GRANT EXECUTE por role hierarchy" + pattern com schema privado), `supabase-migrations` (BLOCO 7 OPCIONAL — CREATE ROLE para custom service accounts), `supabase-custom-claims-rbac` v1.25 (section "Postgres Roles vs Custom Claims — distinção canônica" com tabela comparativa).
- Glossário compartilhado `_shared-supabase/glossary.md` ganhou 8 termos novos com tag `(v1.26)`: Postgres roles, INHERIT/NOINHERIT, LOGIN PASSWORD, GRANT/REVOKE syntax, role hierarchy, predefined Supabase roles, role switching authenticator, percent-encoding password.
- AUTOGEN-COUNTS regen: 63→**64 agents** (+1: supabase-roles-implementer), 89 commands (mantido), 70→**71 skills** (+1: supabase-postgres-roles), 23 gates (mantido); file-manifest 373→**375 files**. Stable API v1.0+ preservada cross-14-releases (v1.13→v1.26). PRR 30/30 mantido (content-only milestone). Defense-in-depth camadas: 9 → 10. Próximo marco: v1.27 (a definir — candidatos: Supabase Vault, outros Auth Hooks, MFA enforcement).

---

## v1.25 Custom Claims & RBAC via Auth Hooks (Shipped: 2026-05-11)

**Phases completed:** 6 phases (137-142), 32 REQs covered (100%), 7 atomic commits

**Key accomplishments:**

- **Skill nova `supabase-custom-claims-rbac`** documenta 100% da doc oficial Supabase Custom Claims & RBAC via Custom Access Token Auth Hook — 7 passos canônicos (enum types `app_role`/`app_permission`, tabelas `user_roles`+`role_permissions`, função `custom_access_token_hook(event jsonb)`, 6 GRANTs/REVOKEs para `supabase_auth_admin`, habilitar hook Dashboard/config.toml, função `authorize(permission)` com `security definer + set search_path = '' + stable`, RLS policies usando `(SELECT authorize('permission'))`) + 5 anti-patterns + client decoder (jwt-decode + onAuthStateChange) + comparação 3 mecanismos de delivery (app_metadata vs helper function STABLE vs custom claims via auth hook).
- **Agent novo `supabase-rbac-implementer`** — canonical materializer paralelo ao `supabase-rls-hardener` (v1.23) e `supabase-column-privileges-writer` (v1.24). Recebe spec (roles + permissions matrix + multi_tenant flag) via `Task()` upstream context + intent original. Materializa setup completo (7 passos SQL canônicos + client decoder snippet). Verdicts construtivos GO/STRENGTHEN/REWRITE-com-confirmação. Invocável cross-suite por 5 agents callers (multi-tenant-rls-writer, super-admin-implementer, audit-log-implementer, supabase-rls-hardener Detector 9, supabase-auth-bootstrapper).
- **Camada 9 (Auth Hooks Custom Claims) adicionada ao defense-in-depth** — checklist atualizado de 8 para 9 itens; DEFENSE-07 dedicated section. Pattern v1.25 é zero-JOIN para role global vs helper function STABLE (v1.21) com JOIN custoso por query.
- **Subcomando novo `/supabase rbac`** (sinônimos: `roles`, `permissions`, `claims`) dispatcheando para `supabase-rbac-implementer`. Section dedicada no command com aviso pattern recomendado v1.25 + caveat JWT freshness.
- **Agent `supabase-rls-hardener` (v1.23) ganha Detector 9** — flagra projects com user_roles table mas sem auth hook configurado via query `pg_proc` + `has_function_privilege`; chain cooperativo para `supabase-rbac-implementer` quando gap detectado; comportamento OPT-IN.
- **Agent `supabase-auth-bootstrapper` (v1.8) ganha Custom Claims & RBAC integration (v1.25)** — jwt-decode dependency + listener com decoder em `client.ts` + helper `getUserRole()` em `server.ts` + handoff cooperativo para `supabase-rbac-implementer` quando caller sinaliza `enable_rbac=true` ou detecta `user_roles` table.
- **Cross-suite handoff cooperativo RBAC (3 agents v1.21):** multi-tenant-rls-writer (RBAC híbrido — claim global + helper function per-org), super-admin-implementer (migração `super_admin: bool` de app_metadata para custom claim via auth hook com compat policy combinada durante transição), audit-log-implementer (audit trigger em user_roles com event taxonomy 'role_assigned'/'role_revoked'/'role_updated' AFTER INSERT/UPDATE/DELETE).
- **Princípio canônico (herdado v1.23):** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Aplicado em 3 cross-suite handoffs RBAC (adiciona aos 12 RLS v1.23 + 5 column-level v1.24 = **20 cross-suite handoffs cumulativos**). Caveat JWT freshness documentado (mudanças em user_roles refletem após token refresh TTL 1h; force logout via `auth.admin.signOut()` para revogação imediata).
- Patches em 4 skills existentes: `supabase-rls-policies` (section "RBAC via Custom Claims + authorize() function"), `supabase-rls-defense-in-depth` (Camada 9 + DEFENSE-07), `supabase-database-functions` (pattern Custom Access Token Auth Hook + 6 GRANTs/REVOKEs canônicos), `rbac-permissions-matrix-supabase` v1.21 (tabela comparativa + recomendação combinar claim global + helper function per-org).
- Glossário compartilhado `_shared-supabase/glossary.md` ganhou 8 termos novos com tag `(v1.25)`: custom claims, Custom Access Token Auth Hook, JWT user_role claim, authorize() function, supabase_auth_admin role, app_role enum, app_permission enum, jwt-decode client pattern.
- AUTOGEN-COUNTS regen: 62→**63 agents** (+1: supabase-rbac-implementer), 89 commands (mantido), 69→**70 skills** (+1: supabase-custom-claims-rbac), 23 gates (mantido); file-manifest 371→**373 files**. Stable API v1.0+ preservada cross-13-releases (v1.13→v1.25). PRR 30/30 mantido (content-only milestone). Defense-in-depth camadas: 8 → 9.

---

## v1.24 Segurança em Nível de Coluna (Column-Level Security) (Shipped: 2026-05-11)

**Phases completed:** 6 phases (131-136), 26 REQs covered (100%), 7 atomic commits

**Key accomplishments:**

- **Skill nova `supabase-column-level-security`** documenta 100% da doc oficial Supabase Column Level Security — GRANT/REVOKE column-level basics, table-level vs column-level distinção, wildcard `*` restriction caveat (restricted roles falham com SELECT *), considerações cross-operation (INSERT/UPDATE/DELETE), integração com RLS, dedicated role table pattern (recomendado pela doc oficial como alternativa preferida), Studio dashboard reference (Feature Preview), 4 patterns canônicos (UPDATE restricted, SELECT PII, audit log protected, token raw service-role-only), 4 anti-patterns + auditoria query SQL.
- **Agent novo `supabase-column-privileges-writer`** — canonical materializer paralelo ao `supabase-rls-hardener` (v1.23). Recebe spec (table + sensitive_columns + allowed_roles) via `Task()` upstream context + intent original. Verdicts construtivos GO/STRENGTHEN/REWRITE-com-confirmação. Aviso "Feature AVANÇADA" explícito + critério Step 1 retorna REWRITE se caso comum (admin/user) — sugere dedicated role table como alternativa preferida.
- Skill `supabase-rls-policies` (v1.23) ganhou section "Combining RLS with Column-Level Privileges (v1.24)" — quando combinar + caveats wildcard + pattern SQL combinado. Skill `supabase-migrations` (v1.23) ganhou BLOCO 6 OPCIONAL no template canônico v1.24 — column-level privileges quando colunas sensíveis declaradas. Skill `supabase-rls-defense-in-depth` (v1.23) ganhou **Camada 8** (column-level privileges) + checklist defense-in-depth atualizado de 7 para 8 itens + DEFENSE-06 section dedicada + auditoria query SQL.
- Agent `supabase-rls-hardener` (v1.23) ganhou **Detector 8** (column-level privileges check) — flagra tabelas com PII sem column-level via `information_schema.columns` keyword match (10 patterns: email, phone, ssn, cpf, token, password, credit_card, bank_account, salary, payload); chain cooperativo para `supabase-column-privileges-writer` quando gap detectado; comportamento OPT-IN. Command `/supabase` ganhou subcomando novo `column` (sinônimos: `coluna`, `col-priv`) dispatcheando para o agent novo + section dedicada com aviso "Feature AVANÇADA".
- **Cross-suite handoff cooperativo column-level (5 agents v1.21 com PII):** audit-log-implementer (`audit_log.payload` PII sanitization), lgpd-compliance-auditor (`dsr_requests.subject_email/phone/address/metadata` para DSR + erasure), crm-pipeline-implementer (`leads.phone/email/notes` para LGPD com caveat RLS-vs-column), multi-tenant-rls-writer (hierarquia org/dept com caveat Postgres role vs RLS dinâmica), invite-flow-implementer (`org_invites.token_raw` apenas service_role + Camada 9 ressalva).
- **Princípio canônico (herdado de v1.23):** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Aplicado em 5 cross-suite handoffs column-level (adiciona aos 12 handoffs RLS-level de v1.23). Pattern Task() pseudo-code customizado por agent com `<upstream_intent>` + `<sensitive_columns>` + `<allowed_roles>` específicos do domínio.
- Glossário compartilhado `_shared-supabase/glossary.md` ganhou 5 termos novos com tag `(v1.24)`: column-level privileges, table-level privileges, wildcard restriction, dedicated role table pattern, column privilege auditing.
- AUTOGEN-COUNTS regen: 61→**62 agents** (+1: supabase-column-privileges-writer), 89 commands (mantido), 68→**69 skills** (+1: supabase-column-level-security), 23 gates (mantido); file-manifest 369→**371 files**. Stable API v1.0+ preservada cross-12-releases (v1.13→v1.24). PRR 30/30 mantido (content-only milestone).

---

## v1.23 Reforço RLS Supabase + Handoff Cooperativo SQL (Shipped: 2026-05-11)

**Phases completed:** 7 phases (124-130), 42 REQs covered (100%), 12 atomic commits

**Key accomplishments:**

- Incorporados 100% da documentação oficial Supabase Row Level Security na skill `supabase-rls-policies` — GRANTs antes de ENABLE RLS, padrão `auth.uid() IS NOT NULL AND ...` (anti silent-fail anônimo), views com `security_invoker=true` (Postgres 15+), diferença `anon` Postgres role vs anonymous Auth user, performance recommendations (minimize joins/filtros redundantes/security definer cache), `raw_app_meta_data` vs `raw_user_meta_data` + JWT freshness + cookie 4096 bytes, defense in depth narrative; anti-patterns expandidos 4→7.
- Skill `supabase-migrations` ganhou template canônico v1.23 com 5 blocos obrigatórios para CREATE TABLE: CREATE TABLE → GRANTs por role → ENABLE RLS → 4 policies granulares com IS NOT NULL → INDEX. Pattern força hardening desde a primeira migration.
- **Skill nova `supabase-rls-defense-in-depth`** documentando 6 camadas de defesa em profundidade (policy + event trigger `rls_auto_enable` + GRANT explícito + bypass controlado + views security_invoker + service_role caveat), com 7-item checklist + auditoria queries SQL para detectar gaps em produção.
- **Agent novo `supabase-rls-hardener`** — canonical materializer com verdicts construtivos **GO** (passa direto), **STRENGTHEN** (ajusta com diff explícito mantendo intent), **REWRITE** (anti-pattern crítico, requer confirmação obrigatória do caller se user_facing_caller=true). Invocável cross-suite por 12 agents callers documentados (8 v1.21 + 1 v1.22 + 3 framework core).
- **Princípio canônico v1.23 estabelecido:** agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream. Pattern de handoff cooperativo via `Task(subagent_type=supabase-rls-hardener)` aplicado em 12 cross-suite handoffs: 8 implementers v1.21 (multi-tenant-rls-writer, audit-log-implementer, crm-pipeline-implementer, org-onboarding-implementer, invite-flow-implementer, super-admin-implementer, evolution-go-integrator, lgpd-compliance-auditor), 1 auditor v1.22 (auditor-consistencia-isolamento — Detector 7 valida migrations passaram pelo hardener), 3 framework core (planner injeta tarefa final SQL, executor invoca ANTES de aplicar, debugger valida fix proposto).
- Agents Supabase v1.8 existentes atualizados: `supabase-rls-writer` emite GRANTs + IS NOT NULL opcional via input `include_is_not_null_check` + gera views `security_invoker=true` quando aplicável; `supabase-migration-writer` recebe draft via `Task()` upstream context, auto-chain cooperativo para hardener em CREATE TABLE, devolve SQL + nota de divergências quando intent conflita; command `/supabase` documentado como **serviço de materialização** (nunca bloqueia upstream) com subcomando novo `hardener` para dispatch direto.
- Glossário compartilhado `_shared-supabase/glossary.md` ganhou 6 termos novos com tag `(v1.23)`: defense-in-depth, hardener, cooperative-handoff, event-trigger-rls-auto-enable, bypassrls, security_invoker — cross-refs ativos para skill defense-in-depth e agent hardener.
- AUTOGEN-COUNTS regen: 60→**61 agents** (+1: supabase-rls-hardener), 89 commands (mantido), 67→**68 skills** (+1: supabase-rls-defense-in-depth), 23 gates (mantido); file-manifest 367→**369 files** hashed. Stable API v1.0+ preservada cross-11-releases (v1.13→v1.23). PRR 30/30 mantido (content-only milestone). Próximo marco parqueado: v1.24 Segurança em Nível de Coluna (Column-Level Security).

---

## v1.22 Suíte DDIA Foundations (Shipped: 2026-05-10)

- 8ª suíte do kit, derivada de *Designing Data-Intensive Applications* (Kleppmann, 2017) — consistência, partitioning, isolation, distributed systems traps e event streams sobre as suítes Supabase v1.8 + Multi-Tenant v1.21. 7 phases (117-123), 60 REQs. *(Entrada reconciliada em 2026-07-01; fonte: CHANGELOG + ROADMAP arquivado.)*

---

## v1.21 Suíte Multi-Tenant SaaS B2B (Shipped: 2026-05-10)

**Phases completed:** 11 phases, 11 plans, 0 tasks

**Key accomplishments:**

- 6ª suíte adicionada ao kit-mcp (Multi-Tenant SaaS B2B) — comando `/multi-tenant` orquestrador + 10 agents + 15 skills + glossário compartilhado `_shared-multi-tenant/glossary.md`, especializando `/supabase` v1.8 para apps B2B com hierarquia firm→department→leader→collaborator e RBAC granular sem duplicar lógica via cross-suite Task() handoff explicitamente documentado.
- Schema canônico de 7 tabelas multi-tenant (`organizations`, `departments`, `roles`, `permissions`, `role_permissions`, `organization_members`, `department_members`) + 4 helper functions PG (`private.is_member_of`, `private.has_role`, `private.has_permission`, `private.is_super_admin`) com signature SQL completa marcada `STABLE` + partial index `organization_members(user_id, org_id) WHERE status='active'` documentado para tabelas 100k+ rows.
- Audit log multi-tenant append-only (`REVOKE DELETE FROM authenticated`) com taxonomy canônica de 7 eventos (login/member_invited/role_changed/data_exported/member_removed/settings_changed/super_admin_action), retention via pg_cron (Free 30d/Pro 90d/Enterprise 365d), PII sanitization SHA-256 e flag `legal_hold` para LGPD — BLOCKER ADMIN-03 desbloqueado para Phase 111.
- Invite flow completo com token SHA-256 (raw no email + hash no banco), TTL 7 dias single-use, state machine 5 estados (pending→accepted|rejected|cancelled|expired), email-lock obrigatório, idempotência via `SELECT ... FOR UPDATE` em transação para race protection.
- Super Admin platform impersonation (padrão GitHub Enterprise) com 3 requisitos mandatórios: banner visual, motivo obrigatório, TTL 30min — `super_admin: bool` setado APENAS via service_role; agent ABORTA se Phase 109 audit log não está implementado (BLOCKER ADMIN-03 enforced).
- WhatsApp/Evolution Go integration: webhook URL path `/functions/v1/whatsapp/{org_id}/webhook` com tenant_id ANTES do parse, HMAC per-org validado ANTES de `JSON.parse` (WHATSAPP-07), idempotência `unique(org_id, message_id) ON CONFLICT DO NOTHING`, rate limit Meta 80 msg/s + state machine xstate v5 persistida em PG.
- CRM lead pipeline com 6 stages canônicos (lead→qualified→proposal→negotiation→won|lost), state machine via trigger Postgres `BEFORE UPDATE` com `RAISE EXCEPTION` (não só CHECK constraint contornável), ownership transfer com notification + audit obrigatório, lead dedup `unique(org_id, phone)` + `unique(org_id, email)`, integração WhatsApp lookup contact→lead.
- LGPD compliance per-tenant: 9 direitos Art. 18 (confirmação/acesso/correção/anonimização/portabilidade/eliminação/info compart./revogação consent/revisão decisão automatizada), DSR SLA 15 dias (Art. 19) com pg_cron alerta D-3, consent default opt-out (Art. 8 §5), erasure via anonymization (UUID preserved + PII NULL/hash), cross-border `gru1` Vercel + `sa-east-1` Supabase.
- React patterns multi-tenant: `org-switcher` URL-based `/orgs/[slug]/` com middleware Next.js v16 + `useParams()` para Vite SPA, `permission-gate` com `@casl/ability` 6.8 + anti-pattern client-only sem RLS server-side documentado, `member-management` com 9 componentes shadcn/ui canônicos (data-table TanStack v8, dialog, select, badge, dropdown-menu, avatar, command, form, toast).
- Cross-suite invocation pattern formalizado — agents v1.21 delegam para agents v1.8 via cross-ref Markdown + `Task()` handoff documentado em command + glossário + cada agent. Stable API v1.0+ preservada (zero alterações em `src/core/`). AUTOGEN-COUNTS regen: 47→57 agents, 87→88 commands, 45→60 skills, 20→23 gates; file-manifest.json 327→355 files.

---

## v1.20 Tech Debt Closure & Quality Hardening (Shipped: 2026-05-10)

**Phases completed:** 6 phases, 7 plans, 0 tasks

**Key accomplishments:**

- Suíte de testes unitários cresceu 169 testes (482→651) elevando 7 de 8 arquivos hot ao ≥90% line coverage; cli/index.js parou em 82.61% por limites estruturais documentados.
- CI line coverage gate elevado de 80% para 86% via edit em ci.yml (THRESHOLD + REQ tag + history block) — desvio estratégico documentado: 86 em vez do 90 original porque cli/index.js fica em 82.61% por limites estruturais (live spawn + TTY), e atingir 90 violaria Stable API v1.0+.
- Stryker instalado + configurado + baseline mutation score 57.40% em 10 arquivos src/core/ (1310 mutants, 739 killed). Documento canônico v1.20 para futuro mutation gate.
- handleMetricsSnapshot agora invoca persistSnapshot() automaticamente antes de retornar o payload, com throttle 1s in-memory e graceful fs error — fechando o gap operacional onde .planning/metrics/snapshots/ ficava vazio até trigger manual.
- `/burn-rate-status` agora calcula burn rate dual-window (fast 1h + slow 6h) independentemente por SLO e combina via canonical Google SRE logic — PAGE quando ambos críticos, TICKET para slow erosion sustained, WARN para spike isolado ou mild burn ≥1×, conservativo no_data quando qualquer janela tem snapshots insuficientes.
- RUNBOOK.md expanded 5 → 9 scenarios, EMERGENCY-DRILL-LOG.md trimestral cadence established with 2026-Q2 entry, and PRR-RECHECK.md documents Emergency axe 4/5 → 5/5 — closing SRE-20-01 and lifting v1.20 PRR projection to 29/30 (pending Phase 105 Performance).
- Pre-warm fire-and-forget de `listKit(BUNDLED_KIT_ROOT)` após `server.connect`, dropando M4 p95 de 144.55ms para 0.0ms (>100% redução vs target ≥30%) e fechando PRR Performance axe 4/5 → 5/5 — total v1.20 30/30, milestone pronto para `/auditar-marco`.

---

## v1.19 Maturidade Operacional (Shipped: 2026-05-09)

**Phases completed:** 2 phases, 0 plans, 0 tasks

**Key accomplishments:**

- Coverage line threshold raised 75 → 80% via 33 new tests in 2 files; auto-spawn.js 57→88%, cli/index.js 55→75%; overall baseline 77.89→81.51% (+3.6 pp).
- Adds disk-persistent rolling 30d snapshots to src/core/metrics.js (persistSnapshot + loadSnapshots) and wires /burn-rate-status to consume real SLO YAMLs + snapshots — replaces prior skill-driven skeleton with end-to-end SLI + burn rate + status enum + ETA exhaustion calc; 31 new regression tests pin every step of the math.

---

## v1.18 Eat Your Own Dog Food (Shipped: 2026-05-09)

**Phases completed:** 4 phases, 1 plans, 9 tasks

**Key accomplishments:**

- In-memory counter + latency histogram (p50/p95/p99) wired around the MCP central catch, exposed via a new parameterless `metrics-snapshot` tool — zero new dependencies.
- Two event-based SLOs (availability ratio + p95 latency) wired to the Phase 94.01 in-memory metrics module via YAML files in `.planning/slos/`, with 10 regex-based schema regression tests — zero new deps.
- Three operations docs (RUNBOOK with 5 Symptom→Diagnosis→Fix scenarios, FAILURE-MODES with 12-row impact×likelihood matrix, BENCHMARK with 5 measured baselines including 232ms cold-start and 144ms MCP p95) plus 11 regex-based shape regression tests — zero new deps.
- Coverage line threshold raised 65→75% via 38 new tests for 4 hot files (failures.js 17→99%, install.js 19→96%, auto-spawn.js 31→57%, cli/index.js 37→55%); overall baseline 69.95→77.89%.

---

## v1.17 Performance Wave 2 + Quick Wins (Shipped: 2026-05-09)

**Phases completed:** 4 phases, 2 plans, 10 tasks

**Key accomplishments:**

- 1. [Rule 1 — Bug fix] Test 1 assertion relaxed from `==` to `<=`.
- Four-item polish sweep: `open` moved to optionalDependencies, regen-manifest.js parallelized (~37% faster), dead `getLocalVersion` import removed from src/cli/index.js, and validateProjectRoot in path-safety.js gained @param/@returns JSDoc.
- Deps budget gate now sums `dependencies + optionalDependencies` (closes pre-v1.17 loophole that allowed 9 effective deps) and a new line-coverage gate fails CI below 65% via `node --experimental-test-coverage` parsed from the node:test reporter footer.

---

## v1.16 Performance Runtime Wave (Shipped: 2026-05-09)

**Phases completed:** 2 phases, 5 plans, 2 tasks

**Key accomplishments:**

- 1. `src/core/sync.js` — write loop refactored.
- Cache-aware 500ms debounce in watchKit() — coalesces IDE save-bursts and invalidates kitCache before re-sync, eliminating stale TTL-cached projections after edits
- detectReverse() executa os 5 walks (agents, commands, skills, framework, hooks) via Promise.all em vez de awaits sequenciais, mantendo Stable API e fail-fast error semantics — synthetic A/B no kit-mcp tree mostra ~52% speedup das walks orchestration.
- Top-level eager imports of `../ui/server.js`, `../ui/wrapper.js`, and `../ui/browser.js` were moved to dynamic `await import()` inside the subcommand handlers that actually use them, with a 3-test regression suite asserting cold-start stays under a 1500ms ceiling.
- `@inquirer/prompts` and `chokidar` moved to optionalDependencies + lazy-loaded via closure-cached `await import()` with descriptive fallback errors instructing `npm i <package>` — consumers running `npm install --omit=optional` now get functional core CLI while interactive/watch commands fail with actionable messages.

---

## v1.15 DX & Token Economy Wave 2 (Shipped: 2026-05-09)

**Phases completed:** 3 phases, 5 plans, 9 tasks

**Key accomplishments:**

- `terse:true` param + `--terse` CLI flag em list-agents/list-commands/list-skills retornam apenas `{kind, name}` — payload medido em corpus real reduz 68.8% (well above ≥40% threshold)
- Single canonical kit/COMPATIBILITY.md substitui 27 tabelas inline duplicadas em agents — cada agent ganhou linha `
- Idempotent ESM script regen the AUTOGEN-COUNTS block in README.md from real kit/ disk counts (47 agents · 87 commands · 45 skills · 20 gates), with cross-platform EOL preservation and 4 regression tests guarding against future drift.
- Idempotent SHA256 manifest regenerator script + prepublishOnly chain + CI drift gate that fails any PR shipping a stale `kit/file-manifest.json`, formally fixing recurring drift seen in v1.13/v1.14/v1.15.85.
- CI smoke matrix expanded from 1 → 8 IDE targets via `target` axis with step gating (`if: matrix.target == claude-code`) for target-agnostic steps; generic registry-driven Sync round-trip step replaces hardcoded claude-code asserts; local regression test (10 cases) mirrors the same contract for defense in depth

---

## v1.14 Web/Core Security Hardening (Shipped: 2026-05-09)

**Phases completed:** 3 phases, 6 plans, 14 tasks

**Key accomplishments:**

- Strict CSP via SHA-256 hash of inline script, 64-char hex auth token in lockfile, and requireAuth middleware on /publish /shutdown /events /state — closing 2 HIGH XSS+CSRF vulnerabilities deferred from v1.13.
- Transparent auth-token handshake from sidecar to browser via `?t=<token>` URL handshake (then scrubbed via history.replaceState), plus Authorization Bearer in both in-process publisher (`src/ui/client.js`) and out-of-process hook (`kit/hooks/sidecar-tool-publisher.js` v1.14.0), closing SEC-14-02 end-to-end with zero user-visible token interaction.
- MCP handlers handleSync e handleReverseSync agora bloqueiam projectRoot fora de git workspace (UNC fake host, AppData arbitrário) via helper puro com walk-up `.git/` heurístico — fechando vetor SEC-14-03 de write-anywhere.
- SEC-14-04 closed: gate-runner.execScript replaces predictable Date.now+Math.random tmp filename with fs.mkdtemp + per-run unique dir, eliminating symlink TOCTOU vector in shared multi-user /tmp.
- SHA256 manifest verification at sync install boundary, regenerated kit/file-manifest.json (221 to 327 entries), opt-out env var for dev — closes SEC-14-05 against tampered-kit projection.
- Single shared redactSecrets + sanitizeMcpError helper applied at MCP central catch + Anthropic API 401 rethrow + replay JSON persistence — closes SEC-14-06 with three call sites, six regex patterns, and 35 new regression tests covering positive matches, no-false-positive fixtures, and runtime stdio guarantees.

---

## v1.13 Security & Performance Hardening (Shipped: 2026-05-09)

**Phases completed:** 3 phases, 10 plans, 13 tasks

**Key accomplishments:**

- Closed CRITICAL `gates.run` arbitrary-shell-exec primitive over MCP transport — handler now returns stable refusal sentinel instead of spawning bash from gate body content; CLI `kit gates run` unaffected.
- Defense-in-depth path traversal guard for `.planning/replays/` — allowlist regex `/^[A-Za-z0-9_.-]+$/` + post-resolve assertion applied to all 3 MCP-exposed callers (loadReplay, annotateReplay, recordReplay)
- Strict `npm ci` enforcement in publish + CI workflows, with mandatory unit/integration tests and high-CVE audit gate before any `npm publish` — closes the v1.12.1 race condition escape vector at the publish boundary.
- Aplicação do pattern v1.12.1 sidecar (callback antes de process.exit) a 4 hooks com bug latente de drop de payload em pipes lentos, plus taxonomia inline em 6 hooks e regression test de 3 cases.
- 1. [Rule 3 - Blocker] Corrected `listKit` import path in test file
- Removed 66 lines of dead `# hooks:` example block from 11 agent frontmatters and added a 3-test anti-regression guard, recovering ~880 tokens per multi-agent session.
- 1. [Rule 2 - Critical] Mitigated DEP0190 deprecation in test runner
- Backfill de 3 entries de release ausentes (v1.11.0, v1.12.0, v1.12.1) em CHANGELOG.md + transformação do awk-extract gate de warn em hard-fail para final tags, fechando DRIFT-13-01.
- Substituição estática de 10 contadores hardcoded em README.md (drift +147% / +45% / +4800% / +300%) pelos valores reais do filesystem (47 agents, 87 commands, 49 skills, 20 gates) — DRIFT-13-02 fechado.
- MCP server reads `serverInfo.version` from package.json at boot via `readPkgVersion()` mirroring bin/cli.js:43-51, plus 4-case regression test guarding against drift recurrence

---

## v1.12.1 Hotfix sidecar-tool-publisher (Shipped: 2026-05-08)

- Corrige race condition no hook `sidecar-tool-publisher.js` — `tool_invocation` events dropados antes do TCP flush completar quando `process.exit(0)` seguia `socket.write`. *(Entrada reconciliada em 2026-07-01; fonte: CHANGELOG.)*

---

## v1.12 Suíte Legacy Code Mastery & AI-Era Refactoring (Shipped: 2026-05-08)

- Técnicas de *Working Effectively with Legacy Code* (Michael Feathers, 2004) modernizadas para a era IA/Supabase (2026). 38 REQs em 31 fases (48-78), 5 ondas; cada artefato distingue "Feathers original (2004)" vs "extensão IA/Supabase (2026)". *(Entrada reconciliada em 2026-07-01; fonte: CHANGELOG.)*

---

## v1.11 Suíte SRE Resilience & Release Engineering (Shipped: 2026-05-08)

- 2ª camada SRE derivada do livro Google SRE — caps 22 (Cascading Failures) + 8 (Release Engineering). 24 REQs em 6 fases (42-47), content-only, Stable API v1.0+ preservada. *(Entrada reconciliada em 2026-07-01; fonte: CHANGELOG.)*

---

## v1.10 SRE Engagement (Shipped: 2026-05-07)

**Phases completed:** 6 phases, 30 plans, 0 tasks

**Key accomplishments:**

- Skill canônica SRE Risk Management documentando cap 3 do livro Google SRE (Embracing Risk): risk continuum 6 targets, sabedoria 99.99%, error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more".
- Skill canônica SRE cap 6 documentando os 4 sinais dourados universais (Latency/Traffic/Errors/Saturation), black-box vs white-box monitoring, latência success vs error separadas, percentis vs mean, e histograms com bucketing exponencial — auto-contida com OTel SDK em TypeScript/Deno e queries SQL prontas.
- Skill canônica `eliminating-toil` documentando cap 5 do livro Google SRE — definição operacionalizável de toil (6 critérios), regra ≤ 50%, distinção toil vs overhead vs grungy work, template TOIL-AUDIT.md, estágios de automação L0-L4 e 5 anti-patterns.
- Skill canônica em kit/skills/blameless-postmortems/SKILL.md cobrindo capítulo 15 do livro Google SRE — template canônico de 9 seções (Summary/Impact/Root Causes/Trigger/Resolution/Detection/Action Items/Lessons Learned/Timeline UTC), cultura blameless explícita, no postmortem left unreviewed, Wheel of Misfortune como training trimestral.
- Skill canônica PRR (cap 32 Google SRE) com checklist 6 axes detalhado in-line, 3 engagement models, template PRR-REPORT.md, e sequência handoff dev→SRE em 9 passos — base para prr-conductor Phase 37.
- Especialização do observability-instrumenter (v1.9) com 4 golden signals OTel canônicos — Latency (histogram bucketed exponencial), Traffic (counter), Errors (counter por error.type enum), Saturation (gauge resource-specific)
- Agente content-only `kit/agents/toil-auditor.md` (11.9 KB / 277 linhas) que audita repo + git log + scripts shell + runbooks aplicando 6 critérios canônicos de toil (manual/repetitivo/automatizável/tático/sem valor durável/escala linear), prioriza P0/P1/P2 via score `(frequency × pain) / effort_days`, computa `% do tempo do time` vs ≤ 50% rule, e gera TOIL-AUDIT.md com priorização e estágio L0-L4 de automação alvo
- Agent canônico em kit/agents/postmortem-writer.md que gera postmortem blameless seguindo template de 9 seções (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC); suporta 2 modos mutuamente exclusivos — `--from-investigation <id>` extrai automaticamente de `.planning/investigations/<id>.md` (artefato do incident-investigator v1.9) e `--incident "<descrição>"` standalone com AskUserQuestion guiado em 9 perguntas; aplica 5 Whys quando blame culture detectada via regex; produz output em `.planning/postmortems/<id>.md` com status Draft + checklist 8 perguntas para reviewer sênior ("no postmortem left unreviewed").
- Agente SRE que conduz Production Readiness Review (cap 32 do livro Google SRE) para serviço/feature antes de produção, lendo schema/Edge Functions/SLOs/advisors via 4 Supabase MCP tools (list_tables, execute_sql, get_advisors, list_edge_functions), produzindo PRR-REPORT.md scored em 6 axes com modo offline fallback gracioso quando MCP indisponível.
- Wrapper command kit/commands/golden-signals.md (142 linhas / 6.1 KB) que dispatch para `golden-signals-instrumenter` via `Task(subagent_type=...)` e suporta 3 modos de target resolution (arquivo único, diretório, número de fase) — entrada canônica do user para aplicar 4 golden signals OTel (Latency histogram + Traffic counter + Errors counter + Saturation gauge) em código de serviço.
- Wrapper command kit/commands/auditar-toil.md (146-char description, 5.8 KB / 129 linhas) que dispatch para toil-auditor via Task(subagent_type=...) com 4 flags opcionais e graceful degradation sem git history, gera .planning/TOIL-AUDIT.md priorizado P0/P1/P2.
- Wrapper /postmortem invoca postmortem-writer com 2 modos mutuamente exclusivos (--from-investigation v1.9 trail OU --incident standalone) gerando postmortem blameless 9 seções em .planning/postmortems/<id>.md
- Wrapper command `kit/commands/prr.md` que dispatcha para `prr-conductor` agent com 2 modos `--service|--feature`, 6 axes obrigatórios, 3 engagement models e AskUserQuestion duplo (engagement + reviewer anti auto-PRR).
- Comando direto read-only que exibe error budget vs risk continuum (cap 3 SRE) — lê .planning/slos/, posiciona cada SLO no continuum 99% → 99.999%, classifica em 4 status enum (OPTIMAL/OVER-SPEC/UNDER-SPEC/BUDGET-EXHAUSTED), e aplica sabedoria 99.99% inline em modo --explain.
- Terceiro orquestrador da família v1.8/v1.9/v1.10 — dispatch para 4 agents SRE com sinônimos PT/EN + caso especial risk-budget como comando direto + validação flags mutuamente exclusivas pre-dispatch
- Patch editorial em kit/skills/event-based-slos/SKILL.md inserindo bloco "Risk continuum — SLO target é decisão explícita" com tabela canônica de 5 linhas (99%–99.99%) + sabedoria 99.99% + cross-ref Markdown ativo para sre-risk-management; frontmatter byte-idêntico preservado.
- Patch puramente editorial de `kit/agents/omm-auditor.md` (+52 linhas / -0 linhas) que faz a Capacidade 3 (Complexidade / Tech Debt) consultar `toil-auditor` via cross-ref Markdown ativo e incorporar `% toil pelo time` no scoring 1-5 — frontmatter byte-idêntico, modelo 5-capacidade canônico preservado, regra absoluta "score > 3 exige TOIL-AUDIT.md fresco" estabelecida.
- Patch substancial em `kit/agents/supabase-edge-fn-writer.md` (v1.8 + v1.9) adiciona seção "Four Golden Signals" (cap 6 livro Google SRE) — toda Edge Function gerada nasce com Latency histogram + Traffic counter + Errors counter por error.type + Saturation gauge resource-specific. Frontmatter byte-idêntico preservado.
- Patch v1.10 do agent supabase-architect: nova seção 'Production Readiness Review' (cap 32 livro Google SRE) + extensão do template de output com '## 10. PRR pré-production' — frontmatter byte-preservado
- Chain canônico /forense → /postmortem documentado via bloco <sre_integration> em kit/commands/forense.md (cap 15 Google SRE)
- Gate PRR opcional adicionado ao /concluir-marco via flag workflow.complete_milestone_prr_gate (default false), com status table 3-row, critério ≥ 2 dos 4 sinais de production maturity e cross-refs ATIVOS para skill + agent v1.10
- Bloco `<sre_integration>` adicionado ao `/auditar-marco` — auto-invoca `/auditar-toil` antes de `/auditar-observabilidade`, fechando loop cap 5 SRE → omm-auditor Capacidade 3 (Phase 39 INT-OBS-02)
- Gate bash 3.2-portable blocking pre-verify que detecta os 4 golden signals (Latency=histogram, Traffic=counter, Errors=counter, Saturation=gauge) via regex inclusiva em código tocado, com skip gracefully para projetos content-only.
- Bash 3.2-portable blocking pre-conclude gate enforcing "no postmortem left unreviewed" (cap 15 Google SRE) by cross-checking .planning/investigations/ vs .planning/postmortems/ via basename match, with Status: INCONCLUSIVE recognized as exception
- Gate bash 3.2-portable blocking pre-verify validando que cada PRR-REPORT.md em .planning/prr/
- README.md updated with new SRE Engagement suite (v1.10) section listing 6 skills + 4 agents + 6 commands + 3 audit gates with end-to-end workflow example, citing Site Reliability Engineering book (Google/O'Reilly 2016) — pure additive patch (55 insertions / 0 deletions)
- QA-SRE-05

---

> Reconstruído a partir do CHANGELOG e dos commits. Fonte canônica das versões está em `CHANGELOG.md`.

## Concluídos

### v0.1.x — Foundation (2026-05-03)

- v0.1.0: Initial release. 5 MCP tools, 8 IDE targets, registry table, markdown-reference projection.
- v0.1.1–0.1.6: Polishes (`--via npx`/`local`/`global`, CI, npm provenance, README, badges, reverse-sync, watch, gate runner, forensics reflect).

### v0.2.0 — Cleanup falho (2026-05-03)

- Removeu por engano o kit pessoal achando ser third-party. **Deprecated retroativamente** — não usar.

### v0.2.1 — Patch da v0.2.0 (2026-05-03)

- Mantém o erro da v0.2.0. Não usar.

### v0.3.0 — Workflow restaurado (2026-05-03)

- 19 agents, 60 commands, framework, hooks restaurados de `069349c^`.
- Skills da Anthropic Cowork excluídas conscientemente.
- Trynux/IEP-Advocacia/Notion ID hardcoded → env vars (`KIT_NOTION_PARENT_PAGE_ID`, `OBSIDIAN_VAULT_REPO`).

### v0.4.0 — Docs alinhados (2026-05-03)

- README reescrito: kit bundled é caminho default; `--kit-root` é escape hatch.
- BUG: import morto `DEFAULT_KIT_ROOT` em `src/mcp-server/index.js` quebrava boot via `npx`. **Deprecated**.

### v0.4.1 — Fix MCP boot (2026-05-03)

- Removido import morto.
- Adicionado boot test ao CI.

### v0.5.0 — Mirror-tree sync (2026-05-03)

- Nova capability `framework` e `hooks` no registry: cópia recursiva de `kit/framework/` e `kit/hooks/` para `.claude/framework/` e `.claude/hooks/`.
- Marker `.kit-mcp-managed` na raiz pra `sync remove` seguro.
- CI cobre projection + safety (preserva user files sem marker).
- **Resolve a regressão estrutural** que fazia commands tipo `/novo-marco` aparecerem na IDE mas falharem em runtime ao tentar ler templates.

### v1.0.0 — Estabilização para 1.0 (2026-05-03) 🎉 First stable

- 12/12 REQs entregues em 5 fases (tooling, parser, reverse-sync, tests, cut).
- Tests: 42 automatizados (37 unit + 5 integration) via `node:test`, zero deps.
- CI: 6/6 combinações verdes (Ubuntu/macOS/Windows × Node 20/22) em todo push.
- Reverse-sync simétrico: detect/apply para framework + hooks (mirror-tree).
- Parser fixes coordenados: stub reorder + HTML-comment skip + YAML quoting.
- publish.yml cria GitHub Release object automaticamente em todo `v*`.
- Stable API commitment: TARGETS, MCP actions, CLI surface, core exports, stub format, marker semantics.
- Detalhes: `.planning/milestones/v1.0.0/`.

### v1.2.0 — GUI sidecar de acompanhamento (2026-05-04) 🪟 Live process viewer

- 56/56 REQs entregues em 8 fases (lock arquitetural, fundações, servidor HTTP+SSE, UI estática, publisher+wrapper, CLI integration, MCP auto-spawn, hardening+release).
- Sidecar web localhost (porta 7100-7199) com SSE; abre via `kit ui start` ou `autoSpawn:true` em tools MCP de sync/reverse-sync/gates.
- Stable API v1.0+ preservada — apenas adições. `src/core/` literalmente intocado (`git diff` vazio).
- 1 dep nova: `open@11` (única; budget atingido em 6/6).
- Tests: 151 (49 u + 9 i baseline → ~80 u + ~71 i = 151). +93 vs v1.1.
- 7 audit gates ativos no CI: stdout discipline em `src/ui/`, dep budget, npm pack UI assets, Host check, Origin check, CSP shape, path redaction.
- Threat model finalizado em `docs/sidecar-security.md`: bind 127.0.0.1, CSP estrito, path scrubbing central, sem auth (mitigado).
- Bug pré-existente corrigido: `kit --version` agora lê de `package.json` (era hardcoded 1.0.0).
- Ship readiness: working tree clean, todos os tests verde, REL-02 (tag) e REL-03 (npm publish) requerem user action.
- Detalhes: `.planning/milestones/v1.2.0/`.

### v1.1.0 — Feedback visual no terminal (2026-05-03) 🎨 Visual UX

- 10/10 REQs entregues em 5 fases (UI primitives, --json flag, progress, selectors, cut).
- `src/core/ui.js` (~167 LOC) — color/icons/spinner/progress/select/confirm/summary, respeita NO_COLOR + isTTY.
- Default output muda de JSON para human-readable; `--json` global flag preserva v1.0.
- Progress bar em ops longas (sync install, reverse-sync apply); spinner em curtas (kit list-*, sync targets).
- Selector interativo em `install write` e `sync install` quando target ausente em TTY.
- `install write` sempre faz dry-run + preview + confirm (`--yes`/`--json` bypass).
- Tests +16 (49 unit + 9 integration = 58 total).
- Deps adicionadas: picocolors, @inquirer/prompts (selectivamente importado).
- Stable API additions: --json semantics, onProgress callback signature, non-TTY error fallback.
- Detalhes: `.planning/milestones/v1.1.0/`.

### v1.3.0 → v1.5.3 — Patches ad-hoc (2026-05-04 → 2026-05-05)

Série de patches feitos fora do framework — UI redesign, framework velocity, UI tokens display, auto-reconnect, idle-default fix, audit bundle. Todos em `CHANGELOG.md` (canônico). Resumo:

- v1.2.3 — humanize labels (PT-BR, caminhos amigáveis)
- v1.3.0 — UI redesign Claude Design (active hero, timeline rail, tweaks panel)
- v1.4.0 — framework velocity (publicar-rapido, main-sync, auto-detects, schema-checker, post-migration hook)
- v1.5.0 — UI tokens display + sessão history + defensive labels
- v1.5.1 — UI auto-reconnect via /healthz + bordas com respiro
- v1.5.2 — sidecar idle-default = 0 (não encerra sozinho)
- v1.5.3 — bundle audit quick-wins (POST /shutdown Origin check, awk regex em publish.yml, drop absPath de list-*, trim Vago/Correto)

### v1.6.0 — Perf+lean (2026-05-05) 🧹 16 audit items + observability hook

- 16/16 REQs entregues em 3 fases (Phase 19 quick wins / Phase 20 hardening / Phase 21 token economy) + Phase 19.5 inserida (observability hook).
- planner.md compactado 53→35 KB (-34%); CLAUDE.md gerado 10→8.5 KB (-19%).
- listKit cache TTL 30s, regex top-level, sync/reverse-sync aceitam kit pré-carregado.
- Sidecar `/state` paginado, healthz timeout 500ms, TOCTOU re-probe, walkTree path traversal bloqueado, redactPath Windows-aware.
- CI: Node 24 na matriz, npm audit gate, deps-budget mensagem dinâmica, prepublishOnly preflight.
- Hook PostToolUse `sidecar-tool-publisher.js` publica `tool_invocation` events com source detection (multi-IDE pill na UI).
- Stable API v1.0+ preservada. Tests: 102 unit + 67 integration verde.

### v1.6.1 — DX patch (2026-05-05) 🩺 Diagnostic + upgrade-check

- `kit doctor` — diagnostic command (version/sidecar/hook/settings/.planning/orphan locks)
- Upgrade-check no boot do `kit ui start` com banner amarelo se atrás do npm latest
- Cache TTL 30s em `listGates` (mirrors PERF-01 pattern)
- 112 unit + 67 integration green; Stable API preservada.

### v1.7.0 — Perf+lean part 2 + UX canonical (2026-05-06) 🧹 Workflow compaction + naming

- Phase 22: workflow files compactados (discuss-phase 49→39 KB, plan-phase 36→31 KB, new-project 40→37 KB)
- Phase 23: stubs-only sync mode (1.79× speedup em cold listKit; cache key separado)
- Phase 24: boilerplate dedup (output-style centralizado em references/, 19 KB economizados em 18 agents) + /fazer canonical com árvore de decisão; aliases /rapido /expresso /proximo linkam de volta
- 115 unit + 67 integration green; Stable API preservada.

### v1.8.0 — Suíte Supabase (2026-05-06) 🗄️ Skills+Agents+Command especializados

- 31/31 REQs entregues em 4 fases (Phases 25-28).
- **11 skills canônicas** em `kit/skills/supabase-*/SKILL.md`: realtime, auth-ssr, edge-functions, declarative-schema, rls-policies, database-functions, migrations, postgres-style, storage, pgvector-rag, cron-queues. Auto-contidas, template fixo de 5 seções, code blocks EN com comentários PT-BR.
- **Glossário** em `kit/skills/_shared-supabase/glossary.md` — termos PT-BR↔EN + comandos CLI canônicos + patterns canônicos consolidados.
- **7 agents** em `kit/agents/supabase-*.md`: architect, migration-writer, rls-writer, edge-fn-writer, realtime-implementer, auth-bootstrapper, storage-implementer. Cada um com tabela Compatibilidade IDE + preflight MCP + modo offline gracioso + canonical layouts.
- **1 command** `/supabase` em `kit/commands/supabase.md` com 10 subcomandos (sinônimos PT/EN). Dispatch via `Task(subagent_type=supabase-...)`. Único orquestrador.
- **5 audit gates** em `gates/`: budget-description, no-personal-uuid, agent-no-recursive-dispatch, skill-must-include, sync-idempotent.
- **Cleanup oportunístico:** `kit/agents/schema-checker.md` migrado de UUID `mcp__0a712001-...` (UUID pessoal) para `mcp__supabase__*` canônico. Breaking interno fixado.
- Stable API v1.0+ preservada — content-only milestone (zero alterações em `src/core/`).
- Material-fonte: 7 guias oficiais Supabase + 4 dimensões de pesquisa (`.planning/research/`).
- Detalhes: `.planning/milestones/v1.8.0/` (após `/concluir-marco`).

### v1.9.0 — Observabilidade (2026-05-06) 🔭 Skills+Agentes+Comandos derivados de Observability Engineering

- 41/41 REQs entregues em 7 fases (Phases 29-35).
- **11 skills observability** em `kit/skills/`: `_shared-observability/glossary.md`, `structured-events`, `distributed-tracing`, `opentelemetry-standard`, `core-analysis-loop`, `observability-driven-development`, `event-based-slos`, `burn-rate-alerting`, `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model`.
- **5 agents** em `kit/agents/`: `observability-instrumenter`, `incident-investigator` (usa MCP Supabase get_logs/execute_sql/get_advisors), `slo-engineer` (apply_migration), `burn-rate-forecaster`, `omm-auditor`.
- **6 commands**: `/instrumentar-fase`, `/investigar-producao`, `/definir-slo`, `/burn-rate-status`, `/auditar-observabilidade`, `/observabilidade` (orquestrador análogo a `/supabase`).
- **3 audit gates** em `gates/`: `obs-skills-frontmatter`, `obs-agents-mcp-supabase`, `omm-no-regression`.
- **Integração profunda com Suíte Supabase v1.8** — 7 agents Supabase patcheados com bloco "Observabilidade integrada" (skills observability cross-referenced; SLI tables nascem com schema; auth/storage/edge-fn/realtime instrumentados desde projeto).
- **Integração com fluxo framework** — `/discutir-fase`, `/planejar-fase`, `/verificar-trabalho`, `/forense`, `/auditar-marco`, `/concluir-marco` ganharam blocos `<observability_integration>` com hooks ODD + OMM.
- Material-fonte: livro *Observability Engineering* (Charity Majors, Liz Fong-Jones, George Miranda — O'Reilly, 2022, ISBN 978-1-492-07644-5).
- Stable API v1.0+ preservada — content-only milestone (zero alterações em `src/core/`).
- Detalhes: `.planning/milestones/v1.9/`.

## Em andamento

(nada — v1.45.0 concluído em 2026-07-01; próximo milestone a definir via `.planning/DIRECTION.md`)

## Backlog macro (não-priorizado)

> Reavaliado em 2026-07-01 (reconcile DIR-02): sem evidência de dor atual (zero issues, zero
> menções recentes) — itens mantidos estacionados. Ver `.planning/DIRECTION.md`, seção
> "Considerado e rejeitado".

- **CLI awkwardness do double-`kit`**: `kit kit list-agents`, `kit kit search`, `kit kit get` — o grupo "kit" repete o nome do binário. Considerar achatar (alias top-level: `kit list-agents` direto, mantendo `kit kit ...` como compatibilidade) ou renomear o grupo (`kit browse list-agents`?). Detectado em smoke da v1.1.0.
- **HTTP transport** para IDEs que não falam stdio MCP.
- **forensics reflect com diff visual** em vez de full content.
- **`kit gates run --all`** agregando vereditos de todas as gates de um stage.
- **Dependabot config** para `chokidar` e `@modelcontextprotocol/sdk`.
- **`kit sync watch` exposto via MCP** (challenge: long-running tool).
- **Tests além de smoke** — unit/integration para kit.js, sync.js, reverse-sync.js, gate-runner.js.
- **Skill da `inserir-fase` com description quebrada** (mostra `<!-- kit-mcp:reference -->` em vez do real description). Bug de parsing do frontmatter quando há linha em branco antes do conteúdo.
- **GitHub Releases page** ainda mostra `v0.2.0 — cleanup` como Latest. Criar Release object pra v0.5.0.
- **Documentação site** (a partir do README + CHANGELOG).
- **Reverse-sync para framework/hooks** — atualmente só agents/commands/skills.
