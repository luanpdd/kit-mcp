# Glossário Multi-Tenant SaaS B2B — Termos, Patterns e Convenções

> Arquivo de referência compartilhado pelas skills da Suíte Multi-Tenant v1.21. **NÃO é skill** — não tem `description:` triggerável; não aparece em `listKit`. Cross-referenciado pelas 15 skills via Markdown link relativo.
>
> **Cross-suite reference ATIVO:** termos Supabase já definidos em [`_shared-supabase/glossary.md`](../_shared-supabase/glossary.md) — esta skill **não duplica**, apenas linka. Termos como `RLS`, `auth.uid()`, `app_metadata`, `service_role`, `pg_cron`, `pgmq`, `STABLE`, `SECURITY INVOKER`, `search_path = ''` são definidos lá.

---

## (a) Termos PT-BR ↔ EN — Multi-Tenancy Core

### Tenancy

| EN | PT-BR / Significado |
|---|---|
| **tenant** | Inquilino — entidade de top-level que isola dados entre clientes (organização/escritório). Em B2B SaaS = `organizations` row. |
| **`org_id`** | Coluna canônica em **toda tabela multi-tenant** que identifica a qual `organizations.id` aquela linha pertence. RLS sempre filtra por `org_id`. |
| **multi-tenant** | App que serve N tenants do mesmo deployment, com isolamento de dados entre eles (tipicamente via RLS). |
| **single-tenant** | App que serve 1 tenant por deployment (típico enterprise on-prem). |
| **isolation strategy** | Como tenants são separados — **single schema + `org_id`** (default 90% B2B), schema-per-tenant, ou DB-per-tenant. Ver skill [`b2b-saas-architecture`](../b2b-saas-architecture/SKILL.md). |
| **cross-tenant query** | Query que toca dados de mais de um tenant — apenas super_admin pode executar. Sempre auditada. |
| **tenant routing** | Mapeamento URL → tenant. Padrão canônico: `/orgs/[slug]/...`. |

### Hierarquia

| EN | PT-BR / Significado |
|---|---|
| **organization** | Tenant root. Tabela `public.organizations`. Tem `owner_id`, `plan`, `slug` (imutável). |
| **department** | Sub-divisão opcional de uma org. Tabela `public.departments` com `org_id` FK + `parent_id` para hierarquia (até 5 níveis máx por convenção). |
| **member** | User pertencente a uma org. Tabela `public.organization_members(org_id, user_id, role_id)`. |
| **department member** | User pertencente a um dept. Tabela `public.department_members(dept_id, user_id, role_id)`. `role_id` NULL = herda do `organization_members`. |
| **leader** | Membro de departamento com flag `is_leader = true`. Não é uma role — é capability adicional dentro do dept. |

### RBAC

| EN | PT-BR / Significado |
|---|---|
| **RBAC** | Role-Based Access Control — autorização por role (não por user direto). Cada user tem 1 role por org. |
| **role** | Função/cargo dentro de uma org. Tabela `public.roles(org_id, name)`. 3 built-in (owner/admin/member) + custom permitidos. |
| **permission** | Capacidade granular — string `<resource>:<action>` (ex: `leads:create`, `members:invite`). Tabela `public.permissions(action, resource)`. |
| **permission matrix** | Mapeamento N:M de roles ↔ permissions. Tabela `public.role_permissions(role_id, permission_id)`. |
| **role inheritance** | Department member sem role própria herda role do organization_members. NULL → herda; preenchido → sobrescreve. |
| **role escalation rule** | Regra canônica: usuário só pode atribuir roles ≤ ao próprio role (admin não cria owner; member não cria admin). |

### Super-admin

| EN | PT-BR / Significado |
|---|---|
| **super_admin** | Usuário com `app_metadata.super_admin = true` (set apenas via service_role). Bypassa todas as RLS via helper function `private.is_super_admin()`. |
| **impersonation** | Super-admin assume identidade de outro user temporariamente para suporte. **Sempre** com banner visual + reason obrigatório + TTL 30min. |
| **platform admin** | Sinônimo de super_admin no contexto B2B SaaS. |
| **cross-tenant view** | Lista todos tenants para super_admin (Settings → All Organizations). Apenas super_admin enxerga. |

### Invite Flow

| EN | PT-BR / Significado |
|---|---|
| **invitation token** | Hash SHA-256 de uma string aleatória de 32 bytes. Armazenado no banco; raw token enviado por email. Single-use, TTL 7 dias. |
| **invite state machine** | `pending → accepted | rejected | cancelled | expired`. Transições enforced via trigger ou check constraint. |
| **email-locked invite** | Invite válido apenas se quem clica está logado com email destino. Anti-pattern: link compartilhável (qualquer um aceita). |
| **first admin** | Usuário criador da org — ganha role `owner` na criação, sem invite. |
| **bulk invite** | UI permite invite N emails de uma vez. Cada um gera linha em `org_invites` independente. |

### Audit Log

| EN | PT-BR / Significado |
|---|---|
| **audit log** | Tabela `public.audit_logs` append-only registrando eventos críticos com `tenant_id` indexado. |
| **append-only table** | Tabela onde `DELETE` e `UPDATE` são revogados via `REVOKE DELETE, UPDATE FROM authenticated`. Apenas service_role pode mutar (via partition swap, raramente). |
| **event taxonomy** | 7 eventos canônicos mínimos: `login`, `member_invited`, `role_changed`, `data_exported`, `member_removed`, `settings_changed`, `super_admin_action`. |
| **legal hold** | Flag boolean `legal_hold` em row de audit_log que **bloqueia** delete enquanto DSR LGPD está pendente. |
| **PII sanitization** | Antes de armazenar em audit_log, hash de `actor_email` e `target_phone` (SHA-256). Nunca raw PII em log. |

### LGPD

| EN | PT-BR / Significado |
|---|---|
| **LGPD** | Lei Geral de Proteção de Dados (Brasil) — Lei 13.709/2018. Equivalente brasileiro do GDPR. |
| **DSR** | Data Subject Request — pedido formal do titular dos dados exercendo direito previsto em Art. 18 LGPD. SLA legal 15 dias (Art. 19). |
| **9 direitos LGPD Art. 18** | Confirmação · Acesso · Correção · Anonimização/Bloqueio/Eliminação · Portabilidade · Eliminação · Informação sobre compartilhamento · Revogação de consentimento · Revisão de decisão automatizada |
| **anonymization** | Padrão de erasure: preservar UUID, apagar PII (`name → NULL`, `email → SHA-256 hash`, `phone → NULL`). Permite manter audit trail sem violar LGPD. |
| **consent grain** | Granularidade do consentimento — separado por finalidade (analytics ≠ marketing ≠ third-party-share). Default opt-out (Art. 8 §5 LGPD). |
| **adequacy decision** | Decisão da ANPD/comissão equivalente reconhecendo país como destino seguro de transferência internacional. Brasil-UE estabelecida em jan/2026. |

### Webhooks (Evolution Go / Meta Cloud)

| EN | PT-BR / Significado |
|---|---|
| **Evolution Go** | Implementação alternativa do WhatsApp via biblioteca `whatsmeow` (Go) — usa protocolo WhatsApp Web não-oficial. Não é Meta Cloud API. |
| **Meta Cloud API** | API oficial WhatsApp Business da Meta. Requer Business Account, número aprovado, custo por conversa. |
| **HMAC-SHA256 signature** | Validação de webhook Meta — header `X-Hub-Signature-256: sha256=<hmac>`. Computar HMAC sobre **raw body antes de JSON.parse**. |
| **timing-safe comparison** | Comparação de strings em tempo constante (`crypto.timingSafeEqual`) para evitar timing attacks na validação HMAC. |
| **idempotency key** | `(org_id, message_id)` unique constraint — `ON CONFLICT DO NOTHING` evita duplicatas em retry Meta (entrega at-least-once). |
| **webhook event types** | 19 tipos documentados Evolution Go: `messages.upsert`, `messages.update`, `groups.upsert`, etc. |
| **rate limit Meta** | 80 msg/s default. Exceder = erro 131056, escala para 24h ban. |
| **throttle Evolution Go** | 1 msg/s (manual, biblioteca não enforce). Acima disso = ban Meta de qualquer forma (mesma infra subjacente). |
| **conversation state machine** | Modelagem de fluxo conversa WhatsApp (lead → qualified → opt-in → conversation → action). Estados persistidos em PG (não em memória). Implementado com `xstate v5`. |

### CRM Lead Pipeline

| EN | PT-BR / Significado |
|---|---|
| **lead** | Contato em estágio inicial do funil de vendas. Tabela `public.leads(org_id, contact_email, contact_phone, stage, owner_id)`. |
| **stages canônicos** | `lead → qualified → proposal → negotiation → won | lost`. Transições enforced via trigger BEFORE UPDATE (não só CHECK constraint que client pode burlar). |
| **ownership transfer** | Mudar `owner_id` de um lead. Sempre dispara: notificação ao novo owner + entry em audit_log com `previous_owner_id, new_owner_id, reason`. |
| **lead dedup** | Unique constraint `(org_id, contact_phone)` + `(org_id, contact_email)`. Lookup obrigatório antes de criar lead via integração WhatsApp. |
| **scoring** | Pontuação de lead (manual ou auto). Diferenciador (não table stakes). Out-of-scope v1.21. |

### React Patterns

| EN | PT-BR / Significado |
|---|---|
| **org switcher** | Componente UI que troca tenant ativo. Padrão canônico: URL `/orgs/[slug]/...` (Next.js middleware) ou `useParams()` (Vite SPA). |
| **permission gate** | Componente declarativo `<PermissionGate permission="leads:create">` que esconde UI quando user não tem permission. **Apenas UX** — server-side enforcement obrigatório via RLS. |
| **CASL** | Biblioteca canônica RBAC para React 2026. `@casl/ability` 6.8 + `@casl/react` 4.x. Isomorfica (frontend + backend). |
| **JWT stale** | Após mudança de role, JWT do client ainda tem role antiga até refresh (~1h). Mitigação: `supabase.auth.refreshSession()` imediatamente após operação de role change + RLS como enforcement final. |
| **shadcn/ui** | Component library copy-paste (não NPM package). Componentes para member management: `data-table`, `dialog`, `select`, `badge`, `dropdown-menu`, `avatar`, `command`, `form`, `toast`. |

---

## (b) Decisões Arquiteturais Vinculantes (cristalizadas em Phase 106)

1. **Single Schema + `org_id` + RLS** é estratégia default (90% B2B). Schema-per-tenant é exceção justificada por compliance.
2. **JWT minimal** — apenas `super_admin: bool` em `app_metadata`. Lista de orgs no JWT é anti-pattern.
3. **Helper functions PG STABLE** — todas as funções `private.is_member_of`, `private.has_role`, `private.has_permission`, `private.is_super_admin` marcadas `STABLE`. VOLATILE = re-execução por linha.
4. **7 tabelas core** — `organizations`, `departments`, `roles`, `permissions`, `role_permissions`, `organization_members`, `department_members` (+ auxiliar `organization_slug_history`).
5. **Slug imutável** com redirect trail via `organization_slug_history`. Mutação direta = bookmarks/webhooks/OAuth quebram.
6. **Audit log append-only** — REVOKE DELETE, UPDATE para `authenticated`. Apenas service_role pode mutar.
7. **DSR erasure via anonymization** — preserva UUID, apaga PII. Hard delete destrói audit trail.
8. **HMAC validation antes de JSON.parse** — sobre raw body. Validar após parse = inválido.

---

## (c) Convenções de Naming (todas as tabelas multi-tenant)

| Padrão | Exemplo |
|---|---|
| Tabelas em snake_case plural | `organizations`, `organization_members`, `department_members`, `role_permissions` |
| Colunas em snake_case singular | `org_id`, `user_id`, `role_id`, `created_at`, `is_leader` |
| FK naming `<entidade>_id` | `org_id`, `user_id`, `dept_id`, `role_id`, `permission_id` |
| Boolean prefix `is_` ou `has_` | `is_leader`, `is_super_admin`, `is_built_in`, `has_permission` |
| Timestamps ISO 8601 | `created_at`, `updated_at`, `joined_at`, `expires_at`, `accepted_at` |
| Helper functions em schema `private` | `private.is_member_of`, `private.has_role`, `private.has_permission`, `private.is_super_admin` |
| Audit triggers em schema `private` | `private.track_org_slug_change`, `private.create_audit_partition`, `private.on_org_created` |

---

## (d) Cross-Refs Externos

- [Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase Supavisor 1M Connections](https://supabase.com/blog/supavisor-1-million)
- [Meta Developers — WhatsApp Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/)
- [Meta Developers — Messaging Limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)
- [Evolution API Documentation](https://doc.evolution-api.com/v2/en/configuration/webhooks)
- [LGPD Brazil — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — International Data Transfers Deadline 2025](https://www.mydata-trust.com/2025/08/19/brazil-data-transfers-deadline/)
- [CASL Documentation](https://casl.js.org/)
- [shadcn/ui](https://ui.shadcn.com/)

---

## (e) Cross-Suite Invocation Pattern (introduzido v1.21)

Agents da Suíte Multi-Tenant **não duplicam** lógica Supabase. Padrão canônico de delegação:

```
b2b-saas-architect (v1.21)
  └─→ Task(supabase-architect)         # plano de migration + tier/branches
      └─→ Task(supabase-migration-writer) # SQL final

multi-tenant-rls-writer (v1.21)
  ├─ herda anti-pitfalls supabase-rls-writer (v1.8) via cross-ref Markdown
  └─ adiciona helper functions hierárquicas + super_admin bypass

evolution-go-integrator (v1.21)
  └─→ Task(supabase-edge-fn-writer)     # Deno code da Edge Function

audit-log-implementer (v1.21)
  └─ usa skill supabase-cron-queues (v1.8) para retention scheduling

org-onboarding-implementer (v1.21)
  ├─→ Task(supabase-migration-writer)   # migration de criação de org
  └─→ Task(supabase-edge-fn-writer)     # Edge Function setup wizard
```

**Anti-pattern:** agent v1.21 reescrever lógica de RLS do zero (deve herdar e estender). Agent v1.21 escrever Edge Function direto (deve delegar para `supabase-edge-fn-writer`).
