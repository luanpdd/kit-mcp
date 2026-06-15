---
name: multi-tenant
description: Orquestrador da Suíte Multi-Tenant SaaS B2B — roteia para agents de architect, RLS, onboarding, convite, super-admin, audit-log, CRM, LGPD e isolation-audit com sinônimos PT/EN.
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
Orquestrador único da Suíte Multi-Tenant SaaS B2B v1.21. Recebe um subcomando e args, faz dispatch via `Task(subagent_type=<multi-tenant-agent>)` para o agent especializado correto. É o **único ponto de chain de agents da Suíte Multi-Tenant** — agents permanecem função pura (anti-pitfall A10 v1.8).

**Cross-Suite Invocation Pattern (introduzido v1.21):** Agents da Suíte Multi-Tenant **delegam para agents da Suíte Supabase v1.8** quando precisam materializar SQL, Edge Functions, RLS policies, Realtime, Storage. Padrão canônico:
- `b2b-saas-architect` → delega plano de migration para `supabase-migration-writer`
- `multi-tenant-rls-writer` → herda anti-pitfalls de `supabase-rls-writer` via cross-ref
- `evolution-go-integrator` → delega Edge Function code para `supabase-edge-fn-writer`
- `audit-log-implementer` → usa skill `supabase-cron-queues` para retention scheduling
- `org-onboarding-implementer` → invoca `supabase-migration-writer` para migration + `supabase-edge-fn-writer` para wizard

**Cria/Atualiza:** o que cada agent invocado cria/atualiza (skills consultadas, migrations propostas, Edge Functions, agents implementers).

**Após:** o usuário tem o output do agent (plano, código, SQL, ou veredito de auditoria).
</objective>

<execution_context>
Skills consultadas pelos agents: `kit/skills/{b2b-saas-architecture,multi-tenant-rls-hierarchy,rbac-permissions-matrix-supabase,multi-tenant-performance-scaling,org-onboarding-flow,member-invite-flow,super-admin-platform-pattern,audit-log-multi-tenant,lgpd-multi-tenant-compliance,evolution-go-whatsapp-integration,whatsapp-conversation-state-machine,crm-lead-pipeline-patterns,org-switcher-react-pattern,permission-gate-react-pattern,member-management-react-shadcn}/SKILL.md` + `kit/skills/_shared-multi-tenant/glossary.md` + cross-ref ATIVO para `kit/skills/_shared-supabase/glossary.md`.

Agents disponíveis (Suíte Multi-Tenant v1.21): `kit/agents/{b2b-saas-architect,multi-tenant-rls-writer,multi-tenant-isolation-auditor,lgpd-compliance-auditor,org-onboarding-implementer,invite-flow-implementer,super-admin-implementer,audit-log-implementer,evolution-go-integrator,crm-pipeline-implementer}.md`.

Agents Suíte Supabase v1.8 invocados via cross-suite delegation: `supabase-architect`, `supabase-migration-writer`, `supabase-rls-writer`, `supabase-edge-fn-writer`, `supabase-realtime-implementer`, `supabase-storage-implementer`, `supabase-auth-bootstrapper`.
</execution_context>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Agent dispatched |
|---|---|---|
| `arquiteto` | `architect`, `arch` | `b2b-saas-architect` |
| `rls-tenant` | `rls`, `policies` | `multi-tenant-rls-writer` |
| `isolation-audit` | `audit-tenancy`, `auditar-tenancy` | `multi-tenant-isolation-auditor` |
| `lgpd-audit` | `lgpd`, `compliance`, `compliance-audit` | `lgpd-compliance-auditor` |
| `onboarding` | `org`, `onboard` | `org-onboarding-implementer` |
| `convite` | `invite`, `invitation` | `invite-flow-implementer` |
| `super-admin` | `admin`, `platform-admin` | `super-admin-implementer` |
| `audit-log` | `audit`, `auditoria-log` | `audit-log-implementer` |
| `whatsapp` | `evolution-go`, `wpp`, `evolution` | `evolution-go-integrator` |
| `crm` | `pipeline`, `crm-pipeline`, `leads` | `crm-pipeline-implementer` |
| `help` | `ajuda`, `?` | exibe esta tabela inline |

**Aliases globais para o nome da suíte:** `multi-tenant`, `b2b`, `tenant`, `escritorio`, `tenancy` (todos roteiam para este orquestrador via `/multi-tenant`).

**Detect `supabase/config.toml`:** se presente, extrai `project_id` e passa como contexto para o agent (mesmo pattern de `/supabase` v1.8).
</context>

<process>

## 1. Parsear Subcomando

```bash
SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
```

**Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo de uso. Sair.

## 2. Resolver Sinônimos

Mapear `SUBCMD` para agent name canônico:

```
arquiteto, architect, arch                     → b2b-saas-architect
rls-tenant, rls, policies                      → multi-tenant-rls-writer
isolation-audit, audit-tenancy, auditar-tenancy → multi-tenant-isolation-auditor
lgpd-audit, lgpd, compliance, compliance-audit → lgpd-compliance-auditor
onboarding, org, onboard                       → org-onboarding-implementer
convite, invite, invitation                    → invite-flow-implementer
super-admin, admin, platform-admin             → super-admin-implementer
audit-log, audit, auditoria-log                → audit-log-implementer
whatsapp, evolution-go, wpp, evolution         → evolution-go-integrator
crm, pipeline, crm-pipeline, leads             → crm-pipeline-implementer
```

**Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair.

```
✗ Subcomando desconhecido: '<SUBCMD>'

Subcomandos válidos:
  arquiteto / architect       → projetar schema multi-tenant + RLS hierarchy + RBAC matrix antes de implementar
  rls-tenant / rls            → gerar policies RLS hierárquicas (org/dept/role/permission/super-admin)
  isolation-audit / audit-tenancy → auditar gaps de isolamento cross-tenant (RLS missing, JOIN cross-tenant)
  lgpd / compliance           → auditar gaps LGPD per-tenant (DSR, consent, erasure, retention)
  onboarding / org            → fluxo signup → criar org → primeiro admin → setup wizard
  convite / invite            → token-based invite + accept flow + role assignment
  super-admin / admin         → cross-tenant view + impersonation + audit obrigatório
  audit-log / audit           → tabela append-only + retention pg_cron + PII sanitization
  whatsapp / evolution-go     → webhooks Evolution Go + Meta Cloud + HMAC + idempotency
  crm / pipeline              → state machine PG triggers + ownership transfer + lead dedup
  help / ajuda / ?            → exibe tabela de subcomandos

Uso: /multi-tenant <subcomando> <args...>
Exemplos:
  /multi-tenant arquiteto "app B2B advocacia com escritorios + departamentos"
  /multi-tenant rls "gerar policies hierárquicas para tabela leads"
  /multi-tenant whatsapp "webhook Evolution Go para org acme"
  /multi-tenant lgpd "auditar gaps LGPD do projeto"
```

## 3. Detectar `supabase/config.toml`

```bash
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

Se presente, anexar `project_id=<value>` ao prompt do agent. Se ausente, agent funciona sem.

## 4. Dispatch

Invocar `Task(subagent_type=<agent_name>, prompt=<built_prompt>)`.

**Prompt construído:**

```
{ARGS}

{Se project_id detectado:}
project_id: {PROJECT_ID}

{Para arquiteto: tier upfront via AskUserQuestion}
{caller: pergunte ao user via AskUserQuestion sobre tier (Free/Pro/Team) e branches antes de produzir o plano — mesmo pattern do supabase-architect Step 1}
```

**Subcomando `arquiteto`:** antes de dispatch, faça `AskUserQuestion` perguntando tier (Free/Pro/Team/Enterprise) e se vai usar branches Supabase. Inclua resposta no prompt. (Cross-suite delegation: o `b2b-saas-architect` invoca `supabase-architect` no final via Task() handoff para a parte tier/branches/realtime.)

**Subcomando `isolation-audit`:** dispatch para `multi-tenant-isolation-auditor` que requer MCP Supabase ativo. Se MCP indisponível, agent declara modo offline e produz checklist baseado apenas em arquivos do repo (sem `pg_class` query).

**Subcomando `lgpd`:** mesma lógica — agent funciona offline mas perde precisão sem MCP.

## 5. Output

Output do agent é o output do command. Sem post-processing — agent já formata estruturado.

</process>

<success_criteria>
- [ ] Subcomando resolvido para agent canônico (10 subcomandos × seus sinônimos)
- [ ] `project_id` extraído de `supabase/config.toml` se presente
- [ ] Subcomando `arquiteto` faz `AskUserQuestion` upfront sobre tier + branches
- [ ] Dispatch via `Task(subagent_type=...)` — único ponto de chain de agents da Suíte Multi-Tenant
- [ ] Subcomando inválido → mensagem clara com lista
- [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline
- [ ] Args após subcomando passam transparentemente para o agent
- [ ] Cross-suite invocation documentada (agents v1.21 → agents v1.8)
</success_criteria>
