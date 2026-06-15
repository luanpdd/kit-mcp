---
name: supabase
description: Orquestrador da Suíte Supabase — recebe planejamento ou draft SQL de qualquer agent/user e devolve código hardenado pronto (RLS, migrations, Edge Functions). NUNCA bloqueia o upstream.
argument-hint: "<subcomando> [args...]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Orquestrador único da Suíte Supabase. **Serviço de materialização (v1.23):** recebe planejamento de qualquer agent ou input do user e devolve código hardenado pronto. **NUNCA bloqueia upstream** — agents externos passam draft via `Task()` para receber SQL final hardenado preservando intent.

Faz dispatch via `Task(subagent_type=supabase-...)` para o agent especializado correto. É o **único ponto de chain de agents Supabase** — agents permanecem função pura (anti-pitfall A10 de v1.8).

**Princípio canônico v1.23:** Agents não-Supabase pensam/planejam; agents Supabase materializam/hardenam; ninguém descarta upstream.

**Cria/Atualiza:** o que cada agent invocado cria/atualiza (migrations, schemas, functions, etc.) — com RLS auto-injetada no output via handoff cooperativo com `supabase-rls-hardener` em CREATE TABLE.

**Após:** o usuário tem o output do agent (plano, código, SQL hardenado, ou veredito GO/STRENGTHEN/REWRITE).
</objective>

<execution_context>
Skills consultadas pelos agents: `kit/skills/supabase-*/SKILL.md` + `kit/skills/_shared-supabase/glossary.md` (Phase 25).
Agents disponíveis: `kit/agents/supabase-*.md` (Phase 26) + `kit/agents/schema-checker.md` (existente).
</execution_context>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Agent dispatched |
|---|---|---|
| `arquiteto` | `architect`, `arch` | `supabase-architect` |
| `migration` | `migrar`, `migrate` | `supabase-migration-writer` (v1.23: auto-chain cooperativo com hardener em CREATE TABLE) |
| `rls` | — | `supabase-rls-writer` (v1.23: GRANTs + IS NOT NULL + views security_invoker) |
| `hardener` | `harden`, `endurecer` | `supabase-rls-hardener` (v1.23 canonical materializer — recebe draft via Task) |
| `column` | `coluna`, `col-priv` | `supabase-column-privileges-writer` (v1.24 canonical materializer column-level — recebe spec via Task) |
| `rbac` | `roles`, `permissions`, `claims` | `supabase-rbac-implementer` (v1.25 canonical materializer Custom Claims & RBAC via Auth Hook — recebe spec via Task) |
| `role` | `papel`, `roles-pg` | `supabase-roles-implementer` (v1.26 canonical materializer Postgres Roles — recebe spec via Task; system access) |
| `edge` | `edge-function`, `function`, `funcao` | `supabase-edge-fn-writer` (v1.30: 2026 patterns — withSupabase, deno.json, config.toml) |
| `test` | `testar`, `tests`, `deno-test` | `supabase-edge-fn-tester` (v1.30 — gera Deno tests para função existente) |
| `mcp` | `mcp-server`, `mcp-lite` | `supabase-edge-fn-writer` com `pattern=mcp-server` |
| `ai` | `ai-session`, `embeddings-builtin`, `gte-small`, `ollama` | `supabase-edge-fn-writer` com `pattern=rag-embeddings` (Supabase.ai.Session) |
| `wasm` | `wasm-module` | `supabase-edge-fn-writer` com `pattern=wasm` + static_files config.toml |
| `websocket` | `ws`, `realtime-ws` | `supabase-edge-fn-writer` com `pattern=websocket` + `per_worker` |
| `realtime` | `tempo-real` | `supabase-realtime-implementer` |
| `auth` | `autenticacao`, `auth-ssr` | `supabase-auth-bootstrapper` |
| `social` | `oauth`, `login-social` | `supabase-social-auth-implementer` (v1.32 — social login Google/GitHub/Apple/Facebook/LinkedIn + custom OAuth/OIDC) |
| `mfa` | `2fa`, `totp` | `supabase-mfa-implementer` (v1.32 — MFA TOTP/Phone + enforcement RLS por AAL) |
| `hooks` | `auth-hook`, `hook` | `supabase-auth-hook-writer` (v1.32 — materializa os 6 Auth Hooks Postgres/HTTP) |
| `oauth-server` | `mcp-auth`, `idp` | `supabase-oauth-server-implementer` (v1.32 — Supabase como OAuth 2.1/OIDC identity provider + MCP authentication) |
| `sso` | `saml`, `enterprise-sso` | `supabase-sso-saml-architect` (v1.32 — Enterprise SSO SAML 2.0 + multi-tenant) |
| `storage` | `armazenamento` | `supabase-storage-implementer` |
| `rag` | `pgvector`, `embeddings` | `supabase-edge-fn-writer` com `pattern=rag-embeddings` |
| `cron` | `queues`, `pgmq`, `background` | `supabase-edge-fn-writer` com `pattern=cron-pgmq` |
| `check` | `validar`, `validate` | `schema-checker` (validação pré-migration) |
| `help` | `ajuda`, `?` | exibe esta tabela inline |

**Detect `supabase/config.toml`:** se presente, extrai `project_id` (linha `project_id = "<ref>"`) e passa como contexto para o agent.
</context>

<process>

## 1. Parsear Subcomando

```bash
# PT-BR: extrair primeiro token de $ARGUMENTS como subcomando
SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
```

**Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo de uso. Sair.

## 2. Resolver Sinônimos

Mapear `SUBCMD` para agent name canônico:

```
arquiteto, architect, arch       → supabase-architect
migration, migrar, migrate       → supabase-migration-writer  (v1.23: auto-chain hardener em CREATE TABLE)
rls                              → supabase-rls-writer        (v1.23: GRANTs + IS NOT NULL + views security_invoker)
hardener, harden, endurecer      → supabase-rls-hardener      (v1.23 canonical materializer)
column, coluna, col-priv         → supabase-column-privileges-writer  (v1.24 canonical materializer column-level — feature AVANÇADA)
rbac, roles, permissions, claims → supabase-rbac-implementer           (v1.25 canonical materializer Custom Claims & RBAC via Auth Hook)
role, papel, roles-pg            → supabase-roles-implementer          (v1.26 canonical materializer Postgres Roles — system access only)
edge, edge-function, function, funcao → supabase-edge-fn-writer  (v1.30: 2026 patterns)
test, testar, tests, deno-test   → supabase-edge-fn-tester    (v1.30)
mcp, mcp-server, mcp-lite        → supabase-edge-fn-writer (com flag pattern=mcp-server)  (v1.30)
ai, ai-session, gte-small, ollama → supabase-edge-fn-writer (com flag pattern=rag-embeddings)  (v1.30)
wasm, wasm-module                → supabase-edge-fn-writer (com flag pattern=wasm)  (v1.30)
websocket, ws, realtime-ws       → supabase-edge-fn-writer (com flag pattern=websocket)  (v1.30)
realtime, tempo-real             → supabase-realtime-implementer
auth, autenticacao, auth-ssr     → supabase-auth-bootstrapper
social, oauth, login-social      → supabase-social-auth-implementer    (v1.32 social login + custom OAuth/OIDC)
mfa, 2fa, totp                   → supabase-mfa-implementer            (v1.32 MFA TOTP/Phone + enforcement RLS)
hooks, auth-hook, hook           → supabase-auth-hook-writer           (v1.32 materializa Auth Hooks Postgres/HTTP)
oauth-server, mcp-auth, idp      → supabase-oauth-server-implementer   (v1.32 OAuth 2.1/OIDC identity provider + MCP auth)
sso, saml, enterprise-sso        → supabase-sso-saml-architect         (v1.32 Enterprise SSO SAML 2.0)
storage, armazenamento           → supabase-storage-implementer
rag, pgvector, embeddings        → supabase-edge-fn-writer (com flag pattern=rag-embeddings)
cron, queues, pgmq, background   → supabase-edge-fn-writer (com flag pattern=cron-pgmq)
check, validar, validate         → schema-checker
```

### Serviço de materialização (v1.23 — handoff cooperativo)

Quando agents externos (multi-tenant, debugger, planner, executor, audit-log, CRM, etc.) precisam produzir SQL/DDL, devem invocar `/supabase migration "<plano>"` ou `Task(subagent_type=supabase-rls-hardener, prompt=<draft+intent>)` ao invés de gerar SQL próprio. O command NÃO bloqueia — recebe planejamento, devolve código hardenado.

**Pattern de invocação:**

```python
# de outro agent (ex: multi-tenant-rls-writer)
result = Task(subagent_type="supabase-rls-hardener", prompt=f"""
<upstream_intent>
Source agent: multi-tenant-rls-writer
Original goal: criar policies hierárquicas org→dept→role para {table_name}
Constraints: helper functions já existem em schema private
</upstream_intent>

<draft_sql>
{draft_policies_sql}
</draft_sql>

<user_facing_caller>true</user_facing_caller>
""")
# result.verdict: GO | STRENGTHEN | REWRITE
# result.final_sql: SQL hardenado preservando intent
```

**Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair.

```
✗ Subcomando desconhecido: '<SUBCMD>'

Subcomandos válidos:
  arquiteto / architect    → projetar schema + RLS + topology antes de implementar
  migration / migrar       → escrever migration SQL
  rls                      → gerar policies RLS para tabela
  edge                     → escrever Edge Function Deno
  realtime                 → configurar canais Realtime (RLS + trigger + client)
  auth                     → bootstrap Next.js v16 + Supabase Auth (SSR)
  storage                  → configurar Storage (bucket + RLS + client)
  rag                      → Edge Function com embeddings + pgvector
  cron                     → pattern cron → pgmq → Edge Function
  check                    → validar SQL antes de apply (schema-checker)

Uso: /supabase <subcomando> <args...>
Exemplo: /supabase arquiteto "app de chat com presence multi-room"
```

## 3. Detectar `supabase/config.toml`

```bash
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

Se presente, anexar `project_id=<value>` ao prompt do agent. Se ausente, agent funciona sem (offline ou pergunta ao user).

## 4. Dispatch

Invocar `Task(subagent_type=<agent_name>, prompt=<built_prompt>)`.

**Prompt construído:**

```
{ARGS}

{Se project_id detectado:}
project_id: {PROJECT_ID}

{Se subcomando rag/cron — flag de modo:}
mode: rag-embeddings   (ou cron-pgmq-edge)

{Para architect: tier upfront via AskUserQuestion}
{caller: pergunte ao user via AskUserQuestion sobre tier (Free/Pro/Team) e branches antes de produzir o plano — ver supabase-architect Step 1}
```

**Subcomando `arquiteto`:** antes de dispatch, faça `AskUserQuestion` perguntando tier (Free/Pro/Team/Enterprise) e se vai usar branches. Inclua resposta no prompt.

**Subcomando `check`:** dispatch para `schema-checker` (existente). O caller deve passar `migration_path` e `project_id` no `$ARGUMENTS` — exemplo: `/supabase check supabase/migrations/20260506_x.sql`.

**Subcomando `migration` (v1.23 — CMD-02):** após `supabase-migration-writer` produzir SQL inicial, o agent **AUTOMATICAMENTE** invoca `supabase-rls-hardener` via `Task()` para validar defense-in-depth em CREATE TABLE. Output final inclui verdict + RLS auto-injetada. Caller NÃO precisa invocar hardener separadamente — é parte do contrato do subcomando.

**Subcomando `hardener` (v1.23 novo):** dispatch direto para `supabase-rls-hardener`. Útil quando caller tem draft SQL pronto e quer apenas validação/hardening sem gerar SQL novo. Aceita input com bloco `<draft_sql>` no `$ARGUMENTS` ou via stdin.

**Subcomando `column` (v1.24 novo):** dispatch direto para `supabase-column-privileges-writer`. Recebe spec de table + colunas sensíveis + roles permitidos e produz REVOKE table-level + GRANT column-level. **Feature AVANÇADA** — apenas para casos com PII compliance (LGPD/GDPR), audit log payload, billing data, tokens raw. Para casos comuns (admin/user roles), prefira dedicated role table pattern (documentado em [`supabase-column-level-security`](../skills/supabase-column-level-security/SKILL.md)). Aceita input com bloco `<sensitive_columns>` e `<allowed_roles>` no `$ARGUMENTS`.

**Subcomando `rbac` (v1.25 novo):** dispatch direto para `supabase-rbac-implementer`. Recebe spec de roles + permissions matrix + multi_tenant flag e materializa setup completo (7 passos canônicos: enum types + user_roles + role_permissions + Custom Access Token Auth Hook + supabase_auth_admin GRANTs + authorize() function + RLS policies template + client jwt-decode snippet). Pattern recomendado v1.25 para RBAC — zero-JOIN em policies via claim no JWT. Caveat JWT freshness (mudanças refletem após token refresh). Aceita input com bloco `<roles>` + `<permissions_matrix>` + `<multi_tenant>` no `$ARGUMENTS`. Cross-ref skill [`supabase-custom-claims-rbac`](../skills/supabase-custom-claims-rbac/SKILL.md).

**Subcomando `role` (v1.26 novo):** dispatch direto para `supabase-roles-implementer`. Recebe spec de custom Postgres roles + hierarchy + GRANT matrix e materializa setup completo (CREATE ROLE com LOGIN PASSWORD opcional + role hierarchy INHERIT/NOINHERIT + GRANT/REVOKE per schema/table/function + password security check). **System access apenas** — para application access (end-users), use `/supabase rbac` (v1.25). Aceita input com bloco `<roles_to_create>` + `<grants>` + `<use_case>` no `$ARGUMENTS`. Cross-ref skill [`supabase-postgres-roles`](../skills/supabase-postgres-roles/SKILL.md).

**Subcomando `edge` (v1.30 modernizado):** dispatch para `supabase-edge-fn-writer` que agora aplica 6 skills 2026 — env vars JSON dict (`JSON.parse(SUPABASE_PUBLISHABLE_KEYS)['default']`), `withSupabase` para auth (4 modes: `'user' | 'secret:<name>' | 'publishable:<name>' | 'none'`), per-function `deno.json` (substitui import_map global legacy), per-function `config.toml` entry (`verify_jwt`, `entrypoint`, `static_files`), CORS via `npm:@supabase/supabase-js@2.95.0/cors`, instrumentação OTel + 4 golden signals + SRE defenses (timeout/jitter/RateLimitError handling). Aceita flag `pattern=basic|rag-embeddings|cron-pgmq|mcp-server|websocket|wasm|background-task` no `$ARGUMENTS`. Auto-handoff sugerido para `/supabase test <fn>` ao final.

**Subcomando `test` (v1.30 novo):** dispatch direto para `supabase-edge-fn-tester`. Gera `supabase/functions/tests/<fn>-test.ts` com cobertura canônica de 5 equivalence classes (happy/validation/auth/rate-limit/timeout) usando Deno test runner + `assertSnapshot` + `FunctionsHttpError`/`FunctionsRelayError`/`FunctionsFetchError`. Pattern-specific: `characterization` (legacy via fixtures capturados), `webhook` (signature HMAC fixture), `rag` (determinismo via temperature=0), `mcp` (delega para MCP Inspector). Handoff cooperativo upstream: `supabase-edge-fn-writer` recomenda esse subcomando automaticamente ao criar função nova. Cross-ref skill [`supabase-edge-functions-testing`](../skills/supabase-edge-functions-testing/SKILL.md).

**Subcomandos `mcp` / `ai` / `wasm` / `websocket` (v1.30 novos):** atalhos para `supabase-edge-fn-writer` com pattern específico — economizam o caller de especificar manualmente. Cada um carrega skill especializada:
- `mcp` → [`supabase-edge-functions-mcp-server`](../skills/supabase-edge-functions-mcp-server/SKILL.md) (mcp-lite, dois Hono apps)
- `ai` → [`supabase-edge-runtime-builtins`](../skills/supabase-edge-runtime-builtins/SKILL.md) (Supabase.ai.Session, gte-small, Ollama)
- `wasm` → [`supabase-edge-runtime-builtins`](../skills/supabase-edge-runtime-builtins/SKILL.md) + auto-adiciona `static_files` em config.toml (CLI 2.7.0+, requer Docker no deploy)
- `websocket` → [`supabase-edge-runtime-builtins`](../skills/supabase-edge-runtime-builtins/SKILL.md) + auto-adiciona `policy = "per_worker"` em config.toml

**Subcomandos de autenticação (v1.32 novos):** materializam a suíte de auth. Cada um faz dispatch direto para o agent canônico e carrega a skill especializada:
- `social` → `supabase-social-auth-implementer` + skill [`supabase-social-oauth`](../skills/supabase-social-oauth/SKILL.md) — social login (Google/GitHub/Apple/Facebook/LinkedIn) + custom OAuth/OIDC, rota callback PKCE.
- `mfa` → `supabase-mfa-implementer` + skill [`supabase-mfa`](../skills/supabase-mfa/SKILL.md) — enrollment TOTP/Phone + enforcement RLS RESTRICTIVE por AAL.
- `hooks` → `supabase-auth-hook-writer` + skill [`supabase-auth-hooks`](../skills/supabase-auth-hooks/SKILL.md) — materializa os 6 Auth Hooks (Postgres function ou Edge Function com Standard Webhooks).
- `oauth-server` → `supabase-oauth-server-implementer` + skill [`supabase-oauth-server`](../skills/supabase-oauth-server/SKILL.md) — Supabase como OAuth 2.1/OIDC identity provider, **MCP authentication**, RLS por `client_id`.
- `sso` → `supabase-sso-saml-architect` + skill [`supabase-enterprise-sso-saml`](../skills/supabase-enterprise-sso-saml/SKILL.md) — Enterprise SSO SAML 2.0, attribute mappings, multi-tenant.

O subcomando `auth` (existente) continua para bootstrap SSR Next.js v16 via `supabase-auth-bootstrapper`. Skills de conhecimento complementares (sem agent dedicado): [`supabase-auth-methods`](../skills/supabase-auth-methods/SKILL.md), [`supabase-auth-sessions`](../skills/supabase-auth-sessions/SKILL.md), [`supabase-jwt-signing-keys`](../skills/supabase-jwt-signing-keys/SKILL.md), [`supabase-third-party-auth`](../skills/supabase-third-party-auth/SKILL.md), [`supabase-auth-hardening`](../skills/supabase-auth-hardening/SKILL.md) — a LLM as carrega automaticamente pelos trigger phrases.

## 5. Output

Output do agent é o output do command. Sem post-processing — agent já formata estruturado.

</process>

<success_criteria>
- [ ] Subcomando resolvido para agent canônico (21 subcomandos × seus sinônimos — v1.32)
- [ ] `project_id` extraído de `supabase/config.toml` se presente
- [ ] Subcomando `arquiteto` faz `AskUserQuestion` upfront sobre tier + branches
- [ ] Dispatch via `Task(subagent_type=...)` — único ponto de chain de agents Supabase
- [ ] Subcomando inválido → mensagem clara com lista
- [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline
- [ ] Subcomando `check` → invoca `schema-checker` (existente)
- [ ] Subcomando `edge` (v1.30) → invoca `supabase-edge-fn-writer` com 2026 patterns + auto-recomenda `/supabase test` ao final
- [ ] Subcomando `test` (v1.30) → invoca `supabase-edge-fn-tester` que lê config.toml + index.ts para detectar auth mode
- [ ] Subcomandos `mcp` / `ai` / `wasm` / `websocket` (v1.30) → passam `pattern=<canônico>` para writer
- [ ] Subcomandos `social` / `mfa` / `hooks` / `oauth-server` / `sso` (v1.32) → dispatch para o agent de auth canônico
- [ ] Args após subcomando passam transparentemente para o agent
</success_criteria>
