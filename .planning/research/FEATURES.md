# Pesquisa de Funcionalidades — Suíte Multi-Tenant SaaS B2B v1.21

**Domínio:** Multi-Tenant SaaS B2B — hierarquia firm→department→leader→collaborator, RBAC granular, Evolution Go/WhatsApp, CRM, LGPD, React patterns
**Pesquisado:** 2026-05-10
**Confiança:** HIGH (fontes: WorkOS, Clerk, Linear changelog março/2025, Evolution API v2 docs, Meta API docs, LGPD/ANPD, Yaro Labs, CASL React)

---

## 1. Org Primitive

### Anatomia mínima (table stakes)

Campo canônico da tabela `organizations` convergindo em Stripe, Vercel, Linear e WorkOS:

```sql
-- anatomia mínima convergente entre Stripe/Vercel/Linear/WorkOS
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,           -- URL-safe; proibir mutação ou manter redirect
  owner_id    uuid references auth.users,     -- role=owner; transferível; exactly 1
  plan        text not null default 'free',   -- free|pro|enterprise → liga a billing
  status      text not null default 'active', -- active|suspended|deleted
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  metadata    jsonb default '{}'              -- extensível sem migration: domínios verificados, etc.
);
```

**Como cada empresa modela:**
- **Stripe**: `Account` é o tenant. `id = acct_xxx`, sem slug nativo (slug é concern do produto consumidor). `metadata` livre. Status mapeado em `charges_enabled + payouts_enabled`.
- **Vercel**: Team = org. `slug` exposto na URL de primeiro nível (`vercel.com/<slug>`). `plan` determina limites de build/seat/bandwidth. `owner_id` é membro com role `owner`.
- **Linear**: Workspace = org. Slug em `linear.app/<slug>`. Sub-teams introduzidos em março/2025 (5 níveis de profundidade). `plan` é Free/Pro/Enterprise. Ownership transferível.
- **WorkOS**: `Organization` é o primitivo. Membership object separado (`org_id + user_id + role`). Domínios verificados como campo de primeira classe. SSO/SCIM por org.

**Complexidade:** LOW — 1 tabela, sem recursão, sem tabelas adicionais.

**Anti-feature:** Slug mutável sem redirect trail. Se o slug muda, todos os bookmarks e integrações (webhooks, OAuth callbacks, deep links) quebram silenciosamente. Proibir mudança de slug OU manter tabela `slug_history` com redirect 301.

**Classificação:** TABLE STAKES — sem org primitive, o produto não é B2B.

---

## 2. Member Roles

### Modelo built-in mínimo (table stakes)

3 roles built-in, imutáveis, suficientes para 80% dos casos B2B:

| Role | Capacidades canônicas |
|------|-----------------------|
| `owner` | Tudo + delete org + billing + transferir ownership. Exatamente 1 por org (without owner = org orphan). |
| `admin` | Gerenciar membros, convidar, revogar, criar departments, alterar settings. NÃO pode deletar org nem acessar billing. |
| `member` | Acesso de leitura/escrita ao conteúdo da org. Sem gestão de membros ou configurações. |

```sql
create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null default 'member', -- owner|admin|member|(custom role slug)
  status     text not null default 'active', -- active|suspended
  invited_by uuid references auth.users,
  joined_at  timestamptz default now(),
  unique (org_id, user_id)
);

-- index crítico para RLS performance (sem isso, policy scan full)
create index memberships_org_user_idx on public.memberships (org_id, user_id);
create index memberships_user_idx on public.memberships (user_id);
```

### Custom roles (differentiator)

WorkOS, Clerk e Auth0 convergem em "org-scoped custom roles" com permission strings granulares. Modelo:

- **Role templates globais** — owner/admin/member definidos pela plataforma
- **Custom roles por org** — org define roles extras (ex: `billing_manager`, `viewer`, `team_leader`)
- Permissions são strings: `members:invite`, `invoices:create`, `leads:read`

```sql
create table public.org_roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations on delete cascade,
  name        text not null,
  slug        text not null,
  is_builtin  boolean default false, -- owner/admin/member são builtin
  created_at  timestamptz default now(),
  unique (org_id, slug)
);

create table public.role_permissions (
  role_id    uuid not null references public.org_roles on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);

-- index crítico para has_permission() helper
create index role_permissions_role_perm_idx on public.role_permissions (role_id, permission);
```

**Quem pode atribuir o quê (regra universal):**
- Usuário só pode atribuir roles **iguais ou menores** ao seu próprio role
- `owner` pode atribuir qualquer role incluindo `admin`
- `admin` pode atribuir `member` e custom roles abaixo de admin
- `member` não pode atribuir roles

**Complexidade:** MEDIUM — 2 tabelas adicionais + helper function + RLS referenciando permissão.

**Anti-feature:** Role global não scoped por org. Um `admin` de org A não deve ter nenhuma visibilidade ou privilege em org B. Roles DEVEM ser org-scoped.

**Classificação:** 3 roles built-in = TABLE STAKES. Custom roles = DIFFERENTIATOR.

---

## 3. Department / Team Hierarchy

### Modelos canônicos em 2025

| App | Primitive | Profundidade | Herança | Notas |
|-----|-----------|-------------|---------|-------|
| **Linear** | Team + Sub-team | 5 níveis (lançado março/2025) | Workflows, cycles, labels herdados do parent. Sub-teams herdam Slack notifications do parent. | First-class feature nova |
| **Slack** | Workspace → Channel | 2 níveis (Enterprise Grid adiciona Org > Workspace) | Roles delegados por workspace; channel não é sub-org | Channel é agrupamento de comunicação, não de hierarquia |
| **Notion** | Workspace → Teamspace → Page | 3 níveis lógicos | Permissões herdam do workspace, override por teamspace | Teamspace é o equivalente mais próximo de department |

### Modelo recomendado para firm→department

```sql
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations on delete cascade,
  parent_id  uuid references public.departments, -- null = department raiz da org
  name       text not null,
  slug       text not null,
  created_at timestamptz default now(),
  unique (org_id, slug)
);

-- membros podem ter role em org E role específica em department
create table public.department_memberships (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  role          text not null default 'member', -- leader|member
  unique (department_id, user_id)
);

-- indexes para RLS e queries
create index dept_org_idx on public.departments (org_id);
create index dept_memberships_user_idx on public.department_memberships (user_id, department_id);
```

### Trade-offs: Sub-orgs reais vs flat vs tags

| Abordagem | Pro | Con | Quando usar |
|-----------|-----|-----|-------------|
| Sub-orgs reais com RLS recursiva (`WITH RECURSIVE`) | Modela hierarquia real; herança automática de permissões | RLS recursiva = table scan em cada query = lentidão severa em orgs com 50+ departments | NUNCA em RLS — usar apenas em queries explícitas da aplicação |
| Modelo flat 2 níveis (org → department, sem profundidade) | RLS simples e performático; cobre 95% dos casos B2B | Não representa hierarquia profunda (divisões > sub-divisões) | MVP e maioria dos produtos B2B |
| Tags/labels sem hierarchy FK | RLS trivial; queries rápidas | Relatórios de "todos do dept X e sub-depts" requerem código extra | Quando hierarquia não é requisito de negócio |

**Recomendação para o kit:** Modelo flat de 2 níveis com `parent_id` opcional. Não implementar `WITH RECURSIVE` em políticas RLS — complexidade não compensa para escopo B2B genérico. Hierarquias profundas (conglomerados enterprise) estão fora do escopo.

**Complexidade:** MEDIUM — 2 tabelas adicionais + RLS scoped por department_id + helper function `is_department_member()`.

**Classificação:** DIFFERENTIATOR — não é requisito para lançar, mas eleva o produto para enterprise.

---

## 4. Permissions Granulares

### Permission como string canônica (table stakes para custom roles)

O padrão convergente em 2025 é `resource:action`:

```
members:invite          members:remove          members:read
roles:assign            billing:read            billing:manage
invoices:create         invoices:read
leads:create            leads:read              leads:update        leads:delete
data:export             settings:read           settings:manage
audit_log:read          departments:create      departments:manage
```

### RBAC matrix: Actor → Action → Resource (scoped to org)

```
Actor (user + org context) → Action → Resource (scoped to org/department)
```

Exemplo: user `alice` com role `admin` em `org:acme` pode `members:invite` em qualquer department de `org:acme`, mas não pode `billing:manage` porque seu role não tem essa permission.

### Helper function PG (crítica para RLS performance)

```sql
-- verifica se usuário tem permission em org via role assignment
create or replace function public.has_permission(
  p_user_id    uuid,
  p_org_id     uuid,
  p_permission text
) returns boolean
  language sql stable security invoker
  set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.org_roles r    on r.slug = m.role and r.org_id = m.org_id
    join public.role_permissions rp on rp.role_id = r.id
    where m.user_id = p_user_id
      and m.org_id  = p_org_id
      and m.status  = 'active'
      and rp.permission = p_permission
  );
$$;
```

**Complexidade:** HIGH — tabelas `org_roles` + `role_permissions` + helper function. RLS com subquery em 3 tabelas requer indexação cuidadosa para não degradar (ver seção de riscos técnicos).

**Anti-feature:** Hardcode de permissions no código sem tabela. Quando a empresa cresce e precisa customizar roles de clientes enterprise, vira rewrite completo.

**Classificação:** Permission strings = DIFFERENTIATOR (junto com custom roles). Helper function PG = TABLE STAKES se usar custom roles.

---

## 5. Invite Flow (Token-Based)

### State machine canônico (table stakes)

```
[triggered by admin/owner]
        ↓
    PENDING ──────────────────→ EXPIRED (TTL vencido, pg_cron)
        │
        ├──→ ACCEPTED (user clica + válida token + entra como member)
        ├──→ REJECTED (user clica "recusar")
        └──→ CANCELLED (admin revoga antes de aceitar)
```

### Implementação

```sql
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations on delete cascade,
  email       text not null,
  role        text not null default 'member',
  token_hash  text not null unique,   -- SHA-256 do token; token real enviado só por email
  status      text not null default 'pending', -- pending|accepted|rejected|cancelled|expired
  invited_by  uuid references auth.users,
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at  timestamptz default now()
);

-- dedup: evita múltiplos convites pending para mesmo email na mesma org
create unique index invites_org_email_pending_idx
  on public.invites (org_id, lower(email))
  where status = 'pending';

-- cron de expiração (pg_cron, a cada hora):
-- update public.invites set status = 'expired' where status = 'pending' and expires_at < now();
```

### Padrões canônicos

**Token de invite:**
- Gerar 32+ bytes criptograficamente seguros (crypto.randomBytes ou Web Crypto API)
- Encodar como URL-safe base64 ou hex
- Armazenar apenas o hash SHA-256 no banco — token real apenas no email
- Single-use: marcar `status = 'accepted'` ao resgatar
- TTL padrão: **7 dias** (Clerk, WorkOS, Auth0 convergem neste valor)

**Primeiro admin (criador da org):**
- Signup → criar org → owner automático, sem invite flow
- Owner é o único role que NÃO precisa de invite — é atribuído atomicamente na criação da org

**Transferência de ownership:**
- Owner promove outro membro existente para `owner`
- Ao confirmar: owner anterior rebaixa automaticamente para `admin` (garantia de exactly-1-owner)
- Transferência gera evento obrigatório em `audit_logs` (`ownership.transferred`)

**Bulk invite (differentiator):**
- CSV upload com email + role pré-definido por linha
- Processamento async (Edge Function + pgmq) para evitar timeout
- Dedup: ignora emails já membros ou com convite pending

**Complexidade:** MEDIUM — tabela de invites + cron de expiração + Edge Function de email + hash de token.

**Anti-feature:** Link de invite compartilhável (sem email-lock). Qualquer pessoa com o link entra na org. Se necessário: exigir admin approval após click (join request workflow, NÃO auto-accept).

**Anti-feature:** Armazenar token raw no banco. Breach do DB → todos os convites pending ficam comprometidos.

**Classificação:** Invite flow token-based = TABLE STAKES. Bulk invite CSV = DIFFERENTIATOR.

---

## 6. Super-Admin Platform (Impersonação)

### O que o padrão canônico exige

Super-admin é o operador da plataforma (você), não membro de nenhuma org. Requer:

1. **Cross-tenant view** — queries sem filtro de org_id via JWT claim `super_admin: true` (setado via service_role, nunca por user_metadata)
2. **Impersonação com trail obrigatório** — toda ação em nome de user/org registrada em audit_logs separado com `actor_type = 'super_admin'`
3. **Banner visual** — UI mostra "Você está impersonando [Nome] em [Org]" durante toda a sessão
4. **Motivo obrigatório** — campo texto livre antes de iniciar impersonação (rastreabilidade + cultura de accountability)
5. **Revogação rápida** — botão "Sair da impersonação" sempre acessível
6. **TTL curto** — token de impersonação expira em 30 minutos máximo

### Implementação Supabase

```sql
-- RLS com bypass para super_admin via app_metadata (NUNCA user_metadata)
create policy "memberships_select_org_or_super_admin"
  on public.memberships
  for select
  to authenticated
  using (
    org_id = (select (auth.jwt()->'app_metadata'->>'current_org_id')::uuid)
    or
    (auth.jwt()->'app_metadata'->>'super_admin')::boolean = true
  );
```

Supabase não tem impersonação nativa. Implementar via Edge Function:
- Edge Function recebe `{target_user_id, reason}` + verifica `super_admin: true` no JWT do chamador
- Emite JWT temporário com `sub = target_user_id` + `app_metadata.impersonated_by = super_admin_id` + `exp = now() + 30min`
- Registra `admin.impersonation_started` em audit_logs antes de emitir o token

### Audit obrigatório (padrão GitHub Enterprise)

Toda ação cross-tenant registrada com:
- `actor_id` do super-admin
- `actor_type = 'super_admin'`
- `org_id` da org acessada (mesmo para cross-tenant)
- `reason` (texto livre)
- `ip_address` + `user_agent`
- Timestamps de início e fim de sessão de impersonação

Super-admin NÃO pode apagar nem seus próprios registros de audit. Audit log de super-admin é imutável.

**Complexidade:** HIGH — JWT customization via service_role + Edge Function de impersonação + audit log imutável + UI com estado de sessão.

**Anti-feature:** Super-admin sem trail de audit. LGPD Art. 37 e clientes enterprise com SOC 2 exigem saber quem acessou seus dados. Retrofitar audit em cima de sistema existente é caro e arriscado.

**Classificação:** DIFFERENTIATOR operacional — não é requisito para lançar MVP, mas é pré-requisito para vendas enterprise. Implementar desde o início porque retrofitar é caro.

---

## 7. Audit Logs Multi-Tenant

### Eventos canônicos (table stakes)

| Categoria | Eventos |
|-----------|---------|
| Auth | `user.login`, `user.logout`, `user.mfa_enabled`, `user.password_changed` |
| Membros | `member.invited`, `member.joined`, `member.role_changed`, `member.removed`, `member.suspended` |
| Org | `org.created`, `org.plan_changed`, `org.settings_changed`, `org.deleted`, `ownership.transferred` |
| Dados | `data.exported`, `data.bulk_deleted`, `report.generated` |
| Super-admin | `admin.impersonation_started`, `admin.impersonation_ended`, `admin.cross_tenant_query` |
| Segurança | `invite.created`, `invite.accepted`, `invite.expired`, `api_key.created`, `api_key.revoked` |
| CRM | `lead.created`, `lead.stage_changed`, `lead.owner_changed`, `lead.deleted` |
| WhatsApp | `whatsapp.message_sent`, `whatsapp.instance_connected`, `whatsapp.instance_disconnected` |

### Estrutura do evento

```sql
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations, -- null para eventos super-admin cross-tenant
  actor_id      uuid,          -- user_id do executor (null para automações)
  actor_type    text not null, -- 'user'|'super_admin'|'system'|'api_key'
  actor_email   text,          -- denormalizado para consultas mesmo se user deletado
  event_type    text not null, -- 'member.invited', 'org.plan_changed', etc.
  resource_type text,          -- 'member'|'org'|'invite'|'lead'
  resource_id   text,          -- ID do recurso afetado
  before_state  jsonb,         -- snapshot antes (para auditoria de mudanças)
  after_state   jsonb,         -- snapshot depois
  ip_address    inet,
  user_agent    text,
  source        text,          -- 'ui'|'api'|'super_admin_panel'|'system'
  created_at    timestamptz default now()
);

-- indexes para queries canônicas
create index audit_logs_org_created_idx on public.audit_logs (org_id, created_at desc);
create index audit_logs_actor_idx       on public.audit_logs (actor_id, created_at desc);
create index audit_logs_event_type_idx  on public.audit_logs (event_type, org_id);
```

### Retention por tier

| Tier | Período | Justificativa |
|------|---------|---------------|
| Free | 30 dias | Custo de storage |
| Pro | 90 dias | Operacional |
| Enterprise | 365 dias (configurável até 3 anos) | SOC 2 Type II + LGPD |
| Legal hold | Indefinido | Suspende erasure request durante litígio |

Dados > 90 dias: migrar para cold storage (Parquet/S3). Queries > 30 segundos: rodar async via pgmq + notificação por email.

### Export (differentiator)

Formatos: CSV + JSON. Enterprise: feed para SIEM via webhook. Filtros obrigatórios: `actor`, `event_type`, `resource`, `date_range`, `result`. Queries longas: async com notificação.

**Complexidade:** MEDIUM — tabela de audit + cron de retention + export async + RLS (usuário vê apenas logs de sua org; super-admin vê tudo).

**Dependência crítica com LGPD:** usuário pede erasure, mas `audit_logs` tem seu `actor_id`. Resolver com anonimização seletiva: ao processar erasure, substituir `actor_id → null` e `actor_email → '[deleted]'` no audit_logs, preservando o trail do evento (o que aconteceu) sem o dado pessoal (quem fez). Legal hold suspende anonimização.

**Classificação:** Audit log básico = TABLE STAKES. Export/SIEM = DIFFERENTIATOR.

---

## 8. LGPD Compliance Per-Tenant

### 9 Data Subject Rights (LGPD Art. 18)

| Direito | Implementação técnica | Prazo LGPD |
|---------|----------------------|------------|
| Acesso | Exportar todos dados pessoais do titular em JSON/CSV | 15 dias |
| Confirmação | Confirmar se processa dados (endpoint dedicado) | 15 dias |
| Correção | UI para corrigir campos; log da correção | 15 dias |
| Anonimização/Bloqueio | Marcar dados como anonimizados; suspender processing | 15 dias |
| Portabilidade | Exportar em formato estruturado interoperável (JSON-LD ou CSV) | 15 dias |
| Eliminação (Erasure) | Hard delete de dados pessoais; com exceções para obrigação legal | 15 dias |
| Compartilhamento | Listar terceiros com acesso (integrações, subprocessadores) | 15 dias |
| Revogação de consentimento | Botão/API de opt-out imediato | Imediato |
| Recusa + consequências | Informar o que acontece ao recusar no momento da coleta | No momento |

### DSR workflow (como Vanta/Drata estruturam)

```sql
create table public.dsr_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations,
  requestor_id  uuid references auth.users,
  requestor_email text not null,
  type          text not null, -- 'access'|'portability'|'erasure'|'correction'|'objection'
  status        text not null default 'pending', -- pending|in_progress|completed|rejected
  reason        text,                            -- motivo se rejected
  deadline_at   timestamptz not null,            -- created_at + 15 days
  completed_at  timestamptz,
  evidence_url  text,                            -- link para export/evidência enviada
  created_at    timestamptz default now()
);
```

Fluxo: titular submete request → sistema cria `dsr_request` → alert para DPO/admin → execução (export/delete/anonymize) → notificação ao titular com evidência → fechamento com audit trail completo.

### Consent management granular (differentiator)

```sql
create table public.consent_records (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations,
  user_id        uuid not null references auth.users,
  consent_type   text not null, -- 'analytics'|'marketing'|'third_party_sharing'|'product_updates'
  granted        boolean not null,
  granted_at     timestamptz,
  revoked_at     timestamptz,
  ip_address     inet,
  consent_text_version text, -- versão do texto aceito (hash ou semver)
  created_at     timestamptz default now(),
  unique (org_id, user_id, consent_type)
);
```

Regras de consent LGPD:
- **Granular:** analytics separado de marketing separado de compartilhamento com terceiros
- **Revogável sem penalidade** para funcionalidades essenciais
- **Rastreável:** IP + timestamp de concessão e revogação
- **Texto versionado:** o que o usuário aceitou em qual versão do texto

### Tensão Erasure × Audit Log (decisão arquitetural crítica)

| Situação | O que fazer |
|----------|-------------|
| Usuário pede erasure normal | Anonimizar: `actor_id = null`, `actor_email = '[deleted]'` em audit_logs; hard delete de dados pessoais em outras tabelas |
| Org tem legal hold ativo | Suspender erasure; notificar titular; documentar motivo |
| Audit log tem obrigação legal (nota fiscal, compliance financeiro) | Preservar o evento; anonimizar apenas campos PII (`actor_email`, nomes) |
| Super-admin audit log | Nunca anonimizar ou deletar — é log de acesso a dados, tem obrigação regulatória própria |

LGPD Art. 16 exceções para retenção: (i) obrigação legal, (ii) pesquisa (anonimizado), (iii) transferência sob LGPD, (iv) uso exclusivo anonimizado pelo controller.

**Complexidade:** HIGH — tabelas DSR + consent + legal hold flag + workflow de processamento + portal do titular + anonimização seletiva.

**Dependência:** Audit log é pré-requisito. LGPD requer que o próprio processo de erasure seja logado no audit trail que sobrevive à erasure.

**Classificação:** DIFFERENTIATOR no curto prazo, mas TABLE STAKES para qualquer produto BR com dados pessoais. ANPD intensificou audits em 2025.

---

## 9. Evolution Go / WhatsApp Integration

### O que é Evolution Go

Evolution Go é a reimplementação em Go do Evolution API (original Node.js/NestJS). Stack: Go 1.24+, Gin framework, PostgreSQL/GORM, biblioteca `whatsmeow` (protocolo WhatsApp Web não-oficial). Suporta REST API + WebSocket + Webhook + AMQP/RabbitMQ + NATS. GitHub: `github.com/evolution-foundation/evolution-go`.

**Distinção crítica:** Evolution API/Go usa `whatsmeow` (WhatsApp Web protocol unofficial) — NÃO é a Meta WhatsApp Cloud API oficial.

| | Evolution Go (whatsmeow) | Meta Cloud API (oficial) |
|-|--------------------------|--------------------------|
| Aprovação | Sem verificação Meta | Exige Business Verification |
| Pairing | QR Code por instância | Número verificado Meta |
| Rate limits | Não documentados; throttle manual necessário | 80 MPS default, 1000 MPS upgrade |
| Signature | Não documentado; usar API key + IP whitelist | `X-Hub-Signature-256` HMAC-SHA256 |
| ToS risk | Risco de blocking pela Meta | Dentro dos ToS Meta |

### Endpoints principais (Evolution API v2, compatíveis com Go)

| Recurso | Endpoint pattern |
|---------|-----------------|
| Criar instância | `POST /instance/create` |
| QR Code pairing | `GET /instance/connect/{instanceName}` |
| Status da instância | `GET /instance/fetchInstances` |
| Deletar instância | `DELETE /instance/delete/{instanceName}` |
| Enviar texto | `POST /message/sendText/{instanceName}` |
| Enviar mídia | `POST /message/sendMedia/{instanceName}` |
| Verificar número | `POST /chat/whatsappNumbers/{instanceName}` |
| Criar grupo | `POST /group/create/{instanceName}` |
| Configurar webhook | `POST /webhook/set/{instanceName}` |

### 19 Webhook event types (Evolution API v2, documentados)

**Mensagens:** `MESSAGES_SET`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `MESSAGES_DELETE`, `SEND_MESSAGE`

**Conexão/Auth:** `CONNECTION_UPDATE`, `APPLICATION_STARTUP`, `QRCODE_UPDATED`, `NEW_TOKEN`

**Contatos:** `CONTACTS_SET`, `CONTACTS_UPSERT`, `CONTACTS_UPDATE`

**Chats:** `CHATS_SET`, `CHATS_UPDATE`, `CHATS_UPSERT`, `CHATS_DELETE`

**Grupos:** `GROUPS_UPSERT`, `GROUPS_UPDATE`, `GROUP_PARTICIPANTS_UPDATE`

**Presença:** `PRESENCE_UPDATE`

### Assinatura de webhook

A documentação oficial do Evolution API v2 **não documenta HMAC signature**. Estratégia de segurança compensatória:
- Configurar `AUTHENTICATION_API_KEY` e validar header `apikey` em cada request recebido
- Whitelist de IPs do servidor Evolution Go
- Processar idempotência via `key.id` do payload (campo único por mensagem WhatsApp)
- Para migração futura para Meta Cloud API oficial: implementar `X-Hub-Signature-256` (HMAC-SHA256 com secret compartilhado)

### Rate limits Meta Cloud API (para referência/migração futura)

- Default: **80 MPS** (messages per second) por número
- Upgrade automático para **1.000 MPS** quando: tier ilimitado + quality rating alto + 100k+ usuários únicos em 24h
- Request rate limit: **10 requests/segundo** por endpoint (cada request pode conter múltiplas mensagens)
- Error `130429` = throughput limit excedido (retry com exponential backoff)
- Error `131056` = pair rate limit (mensagens muito rápidas para mesmo destinatário)

### Rate limits Evolution Go (whatsmeow)

Não documentados formalmente. Prática da comunidade: throttle de **1 mensagem/segundo** como padrão conservador. Bulk envios via fila com delay aleatório (jitter) entre mensagens. Instâncias podem ser banidas pela Meta sem aviso.

### Idempotência e dedup

```sql
-- tabela de mensagens processadas para dedup de webhook delivery
create table public.whatsapp_messages (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations,
  instance_id    text not null,
  message_key_id text not null,   -- key.id do payload Evolution
  from_phone     text not null,
  to_phone       text not null,
  message_type   text not null,   -- 'text'|'image'|'audio'|'document'
  content        jsonb,
  direction      text not null,   -- 'inbound'|'outbound'
  received_at    timestamptz default now(),
  unique (instance_id, message_key_id)  -- dedup garantido pelo banco
);
```

**Complexidade:** HIGH — instâncias stateful por número (QR pairing), webhook processing com dedup, fila para envio em massa, QR pairing UI, health check de instâncias.

**Anti-feature:** Uma instância Evolution para múltiplos tenants. Cada org com WhatsApp ativo precisa de sua própria instância (seu próprio número). Orquestrador de instâncias multi-tenant é requisito, não opcional.

**Classificação:** DIFFERENTIATOR vertical — central para mercado BR com vendas via WhatsApp. Não é table stakes para B2B genérico.

---

## 10. CRM Lead Pipeline

### Stages canônicos (table stakes para verticais de vendas)

Convergência Pipedrive + HubSpot + CRMs B2B:

```
lead → qualified → proposal → negotiation → won
                                           → lost
```

`won` e `lost` são estados terminais. Regressão de `won → lead` é inválida e deve falhar no banco (check constraint ou trigger).

```sql
create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations,
  owner_id        uuid references auth.users,            -- responsável atual
  title           text not null,
  stage           text not null default 'lead'
    check (stage in ('lead','qualified','proposal','negotiation','won','lost')),
  score           integer default 0 check (score between 0 and 100),
  source          text,    -- 'whatsapp'|'form'|'referral'|'cold_outreach'
  contact_name    text,
  contact_phone   text,
  contact_email   text,
  expected_value  numeric(12,2),
  currency        char(3) default 'BRL',
  won_at          timestamptz,
  lost_at         timestamptz,
  lost_reason     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- activity log por lead
create table public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads on delete cascade,
  user_id     uuid references auth.users,
  type        text not null, -- 'whatsapp_message'|'call'|'email'|'note'|'stage_changed'|'owner_changed'
  content     jsonb,         -- diff de stage/owner, texto de nota, etc.
  created_at  timestamptz default now()
);

-- indexes para queries de CRM
create index leads_org_stage_idx on public.leads (org_id, stage);
create index leads_owner_idx     on public.leads (owner_id, org_id);
create index leads_phone_idx     on public.leads (contact_phone, org_id);
```

### Scoring (differentiator)

**Manual:** seller atribui score 0-100 baseado em critérios internos.

**Auto (fit/intent):**
- Fit score: dados demográficos (tamanho da empresa, setor, cargo do contato)
- Intent score: comportamento observável (resposta rápida no WhatsApp, abre emails, clica em links)
- Score combinado = weighted average configurável por org

### Ownership transfer

Ao mudar `owner_id`: gravar entry em `lead_activities` com `type = 'owner_changed'` e `content = {from: uuid, to: uuid, reason: text}`. Novo owner recebe notificação. Registrar em `audit_logs` como `lead.owner_changed`.

### Integração WhatsApp → CRM (fluxo canônico)

```
Mensagem WhatsApp (webhook Evolution)
        ↓
Lookup: contact_phone já é lead existente?
        ├── SIM → append lead_activities (type = 'whatsapp_message')
        │          → notificar owner do lead
        └── NÃO → criar novo lead (stage = 'lead', source = 'whatsapp')
                   → round-robin assignment ou queue para admin
```

**Anti-feature:** Stage transitions sem validação no banco. Frontend pode ser burlado via API. Usar check constraint em `stage` + trigger que valida transições permitidas.

**Anti-feature:** Pipeline genérico sem customização por org. Diferentes verticais (advocacia, medicina, vendas) têm stages diferentes. Suportar stages customizáveis por org é DIFFERENTIATOR.

**Complexidade:** MEDIUM — 2 tabelas + state machine + integração WhatsApp + scoring opcional.

**Classificação:** CRM básico = DIFFERENTIATOR para kit genérico. Central para verticais de vendas BR.

---

## 11. Org Switcher UI

### Padrões canônicos em 2025

| App | URL Pattern | Persistência | Troca de sessão |
|-----|-------------|-------------|-----------------|
| **Linear** | `linear.app/<slug>/...` | Cookie de sessão (`active_org`) | Reload da página |
| **Vercel** | `vercel.com/<slug>/...` | Cookie de sessão | Reload, mantém JWT |
| **Clerk** | `/orgs/:slug/...` (configurável) | JWT session (`active_org_id`) | JWT reemitido via middleware |
| **Slack** | URL scoped por workspace; switcher lateral | Cookie por workspace | Nova aba ou redirect |

**Padrão Clerk (mais documentado para React/Next.js 2025):**

```
URL: /orgs/:slug/dashboard
     /orgs/:slug/members
     /orgs/:slug/settings
```

- `clerkMiddleware()` detecta slug na URL e seta `active_org` na sessão automaticamente via `organizationSyncOptions`
- Validação obrigatória server-side: slug da URL deve bater com `session.orgSlug` — previne acesso cross-org com JWT stale
- Se slug não existe OU usuário não é membro: middleware NÃO modifica a org ativa (silently fails safe)
- `OrganizationSwitcher` component com `afterSelectOrganizationUrl="/orgs/:slug/dashboard"`

**Implementação custom (Supabase + Next.js sem Clerk):**

```tsx
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const slugMatch = pathname.match(/^\/orgs\/([^\/]+)/);

  if (slugMatch) {
    const slug = slugMatch[1];
    const supabase = createMiddlewareClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      // verificar que usuário é membro da org com esse slug
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!org) return NextResponse.redirect('/orgs'); // slug inexistente

      const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('org_id', org.id)
        .eq('user_id', session.user.id)
        .single();

      if (!membership) return NextResponse.redirect('/orgs'); // não é membro
    }
  }
}
```

Persistência da org ativa: cookie httpOnly `current_org_id` (para SSR) + atualização de JWT claim via service_role quando necessário para RLS.

**Anti-feature:** Org switcher sem URL refletindo org ativa. Usuário compartilha link e receptor vê org errada. URL SEMPRE deve incluir org identifier.

**Anti-feature:** Subdomain por tenant (`acme.app.com`) para MVP. Wildcard TLS + DNS propagation + CORS por subdomínio = complexidade 10× maior. Usar path-based `/orgs/:slug/` para MVP; subdomain é tier enterprise quando houver demanda real.

**Complexidade:** MEDIUM — middleware de validação + componente React + lógica de persist.

**Classificação:** TABLE STAKES para multi-org. Sem isso, troca de contexto é impossível.

---

## 12. Permission Gate (React)

### Padrão canônico React 2025

**CASL + @casl/react** é o padrão dominante para declarative permission gates em React:

```tsx
// 1. Definir ability baseado nas permissões do usuário atual (vindas do servidor)
import { defineAbility } from '@casl/ability';
import { Can, useAbility } from '@casl/react';

const ability = defineAbility((can) => {
  userPermissions.forEach(permission => {
    const [resource, action] = permission.split(':');
    can(action, resource); // Ex: 'invite', 'members'
  });
});

// 2. Uso declarativo (preferido para composição)
<Can I="invite" a="members" ability={ability}>
  <InviteButton />
</Can>

// 3. Hook imperativo (para lógica condicional)
const { can } = useAbility();
if (can('create', 'invoices')) {
  showCreateButton();
}
```

**Alternativa simples sem CASL (adequada para 3 roles built-in):**

```tsx
// hook custom baseado em role simples
function usePermission(permission: string): boolean {
  const { orgPermissions } = useOrgContext(); // array de strings carregado após login
  return orgPermissions.includes(permission);
}

// componente gate declarativo
function PermissionGate({
  permission,
  children,
  fallback = null
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hasPermission = usePermission(permission);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// uso
<PermissionGate permission="members:invite" fallback={<DisabledButton />}>
  <InviteButton />
</PermissionGate>
```

**Onde carregar permissões:**
- **JWT `app_metadata.permissions[]`** — rápido, sem round-trip, mas JWT pode ficar stale após role change. Usar short-lived tokens (15 min) ou session refresh após role change
- **API call no login** — armazenar em React context/Zustand/React Query cache; mais flexível e sempre fresco
- **Evitar:** carregar TODAS as permissões de TODOS os recursos no JWT (JWT grande = cookies lentos; limite prático ~4KB)

**Anti-feature:** Permission check apenas no frontend. Frontend gate é UX, não segurança. Toda mutation precisa de verificação server-side (Edge Function + `has_permission()` helper PG). Usuário com JWT válido pode chamar API diretamente ignorando o frontend.

**Anti-feature:** Permissões stale no JWT sem invalidação. Se admin muda role de um usuário, o usuário ainda tem as permissões antigas até o JWT expirar. Solução: session refresh imediato após role change + curto TTL de JWT.

**Complexidade:** LOW — hook + componente wrapper. A complexidade real está no backend (permission model + `has_permission()` helper).

**Classificação:** TABLE STAKES — sem gate UI, qualquer usuário vê e tenta ações para as quais não tem permissão.

---

## Panorama de Funcionalidades

### Requisitos Básicos (Table Stakes — sem isso, app não compete)

| Funcionalidade | Por Que É Esperada | Complexidade | Notas de Implementação |
|----------------|--------------------|--------------|------------------------|
| Org primitive (id/name/slug/owner/plan/status) | Base de toda hierarquia multi-tenant | LOW | 1 tabela; slug imutável ou redirect |
| 3 roles built-in (owner/admin/member) | Hierarquia básica esperada em todo B2B SaaS | LOW | Join table memberships com role |
| Invite flow token-based | Único caminho de onboarding sem invite = produto morto | MEDIUM | Token SHA-256 + TTL 7d + cron de expiração |
| Permission gate React | UI deve refletir permissões sem expor ações proibidas | LOW | Hook + componente; sempre reforçar no backend |
| Org switcher com URL slug | Multi-org sem switcher = contexto errado constant | MEDIUM | Middleware de validação + cookie/JWT persist |
| Audit log (eventos canônicos) | Clientes enterprise exigem rastreabilidade desde dia 1 | MEDIUM | Tabela audit_logs + indexes + RLS |

### Diferenciais (Vantagem Competitiva)

| Funcionalidade | Proposta de Valor | Complexidade | Quando Adicionar |
|----------------|-------------------|--------------|-----------------|
| Custom roles + permission strings granulares | Enterprise quer controle fino de quem faz o quê | HIGH | Primeiro cliente enterprise pedindo controle fino |
| Department hierarchy (2 níveis) | Orgs com > 20 membros precisam de estrutura | MEDIUM | Quando org ativa tem estrutura departamental real |
| Super-admin platform (impersonação auditada) | Suporte ao cliente sem comprometer segurança | HIGH | Desde o início — retrofit é caro |
| LGPD DSR workflow automatizado | Pré-requisito para aceitar dados pessoais BR | HIGH | Antes de aceitar usuários BR em produção |
| Consent management granular | Transparência e trust; exigido por LGPD para analytics/marketing | MEDIUM | Junto com LGPD |
| Bulk invite via CSV | Onboarding de times grandes sem invite 1-a-1 | MEDIUM | Quando usuários reclamarem de invite manual |
| Audit log export (CSV/SIEM) | Clientes com equipe de segurança | MEDIUM | Tier enterprise |
| CRM com scoring automático | Diferencial em verticais de vendas | HIGH | Após validar pipeline manual funcionando |
| WhatsApp → CRM auto-capture | Fluxo natural para mercado BR | HIGH | Core para verticais de vendas com WhatsApp |
| Evolution Go integration | Canal principal de comunicação BR | HIGH | Quando cliente precisar de WhatsApp |

### Anti-Funcionalidades (Comumente Pedidas, Frequentemente Problemáticas)

| Funcionalidade | Por Que É Pedida | Por Que É Problemática | Alternativa |
|----------------|------------------|------------------------|-------------|
| Slug mutável sem redirect | "Empresa mudou de nome" | Bookmarks, webhooks e OAuth callbacks quebram silenciosamente | Proibir mudança OU manter tabela `slug_history` com redirect 301 |
| Link de invite compartilhável (sem email-lock) | "Mais conveniente no onboarding" | Qualquer pessoa com o link entra na org; link vazado = breach | Link com email-lock + TTL 7d; se link aberto for necessário: join request + admin approval |
| RLS recursiva para hierarquia de departamentos | "Quero herdar permissões de todos sub-depts" | `WITH RECURSIVE` em RLS policy = table scan em cada query = produto lento | Modelo flat 2 níveis + lookup manual de subárvore na aplicação quando necessário |
| Permission check só no frontend | "A RLS já protege o banco" | Com JWT válido, usuário pode chamar API diretamente; frontend gate é UX, não segurança | Sempre verificar `has_permission()` no Edge Function + RLS como segunda camada |
| JWT com todas as permissões granulares | "Sem round-trip de permissions" | JWT grande = cookies lentos (limite ~4KB); permissions mudam e JWT fica stale | Carregar permissions via API call após login; usar cache (React Query/Zustand); short-lived JWTs |
| Super-admin sem audit trail | "É só uso interno" | LGPD Art. 37 + SOC 2 exigem rastreabilidade de acesso a dados de clientes | Audit obrigatório desde o primeiro deploy — retrofitar é caro |
| Erasure que deleta audit log | "Usuário pediu pra apagar tudo" | Audit log pode ter obrigação legal de retenção (fiscal, compliance) | Anonimizar (null actor_id, '[deleted]' em PII) mas preservar o evento; legal hold suspende |
| Subdomain por tenant para MVP | "Parece mais profissional/white-label" | Wildcard TLS + DNS propagation + CORS = complexidade 10× maior | Path-based `/orgs/:slug/` para MVP; subdomain para enterprise tier quando houver demanda |
| Uma instância Evolution para múltiplos tenants | "Simplifica a infra" | Cada org com WhatsApp próprio precisa de sua própria instância (próprio número) | Orquestrador de instâncias multi-tenant: 1 instância por org por número |
| Stage transitions sem validação no banco | "Validamos no frontend" | API call direta burla validação; `won → lead` é transição inválida que não pode acontecer | Check constraint em `stage` + trigger PG que valida transições permitidas |

---

## Dependências de Funcionalidades

```
[Org Primitive]
    └──requer──> [Supabase Auth / JWT]
    └──habilita──> [Member Roles]
                     └──habilita──> [Invite Flow]
                     └──habilita──> [Permission Gate UI]
                     └──habilita──> [Custom Roles]
                                     └──habilita──> [Permission Strings Granulares]
                                                     └──requer──> [has_permission() helper PG]

[Audit Log]
    └──requer──> [Org Primitive]
    └──requer──> [Member Roles] (para registrar actor role)
    └──habilita──> [LGPD Compliance]
                     └──habilita──> [DSR Workflow]
                     └──habilita──> [Consent Management]
                     └──habilita──> [Legal Hold]

[Super-Admin Platform]
    └──requer──> [Audit Log]   ← BLOCKER — sem audit, super-admin é anti-feature de segurança
    └──requer──> [Org Primitive]

[Department Hierarchy]
    └──requer──> [Org Primitive]
    └──requer──> [Member Roles]
    └──habilita──> [Permission Strings com scope department]

[CRM Lead Pipeline]
    └──requer──> [Org Primitive] (leads scoped por org)
    └──habilita──> [WhatsApp→CRM Integration]
    └──habilita──> [Lead Scoring]

[Evolution Go Integration]
    └──requer──> [CRM Lead Pipeline] (destino das mensagens inbound)
    └──habilita──> [WhatsApp→CRM auto-capture]
    └──habilita──> [Conversation State Machine]

[Org Switcher UI]
    └──requer──> [Org Primitive]
    └──requer──> [Member Roles] (saber quais orgs o usuário tem acesso)
    └──habilita──> [Permission Gate UI] (contexto da org ativa)

[Permission Gate UI]
    └──requer──> [Member Roles]
    └──NÃO-substitui──> [Backend Permission Check]
```

### Notas de Dependência

- **Super-Admin requer Audit Log** (BLOCKER): impersonação sem trail é anti-feature de segurança. Não implementar super-admin sem audit log funcional.
- **LGPD requer Audit Log**: DSR de erasure precisa ser logado no audit trail que sobrevive à erasure do usuário.
- **Org Switcher requer Permission Gate**: ao trocar de org, as permissions mudam; UI precisa re-render os gates com o contexto da nova org ativa.
- **Evolution Go requer CRM**: mensagens inbound precisam de destino (lead ou contato existente). Sem CRM, as mensagens chegam mas não há onde associá-las.
- **Department Hierarchy NÃO bloqueia** custom roles — podem ser implementados independentemente.

---

## Definição de MVP

### Lançar Com (v1 da suíte — skills + agents obrigatórios)

- [ ] **Org primitive + memberships schema** — base de tudo; sem isso nada funciona
- [ ] **3 roles built-in (owner/admin/member)** — hierarquia básica sem custom roles
- [ ] **RLS hierárquica (org-level)** — isolamento de dados entre tenants; pré-requisito de segurança
- [ ] **Invite flow token-based** — único caminho de onboarding; sem invite = produto morto
- [ ] **Super-admin platform** — suporte ao cliente + compliance desde o dia 1; retrofit é caro
- [ ] **Audit log básico (eventos canônicos)** — rastreabilidade mínima; pré-requisito do super-admin
- [ ] **Permission gate React** — UX responde a roles; frontend sem gate = UX quebrada
- [ ] **Org switcher React** — multi-org é o caso de uso core do B2B SaaS

### Adicionar Após Validação (v1.x)

- [ ] **Custom roles + permission strings granulares** — gatilho: primeiro cliente enterprise pedindo controle fino
- [ ] **Department hierarchy (2 níveis)** — gatilho: org ativa com > 20 membros precisando de estrutura
- [ ] **LGPD DSR workflow** — gatilho: antes de aceitar dados pessoais de usuários BR (deveria ser day 1)
- [ ] **Consent management granular** — gatilho: junto com LGPD; antes de analytics/marketing
- [ ] **CRM lead pipeline** — gatilho: vertical de vendas confirmada como use case principal
- [ ] **Evolution Go integration** — gatilho: primeiro cliente precisando de WhatsApp

### Consideração Futura (v2+)

- [ ] **Bulk invite via CSV** — gatilho: reclamação recorrente de invite 1-a-1 para times grandes
- [ ] **Audit log export / SIEM feed** — gatilho: primeiro cliente com equipe de segurança
- [ ] **Lead scoring automático (fit/intent)** — gatilho: CRM manual validado com volume suficiente
- [ ] **Subdomain por tenant (white-label)** — gatilho: cliente enterprise pedindo branding próprio
- [ ] **Pipeline stages customizáveis por org** — gatilho: múltiplas verticais com stages diferentes

---

## Matriz de Priorização

| Funcionalidade | Valor para Skill Writer | Custo de Documentar | Prioridade |
|----------------|------------------------|---------------------|------------|
| Org primitive | HIGH | LOW | P1 |
| Member roles (3 built-in) | HIGH | LOW | P1 |
| RLS hierárquica multi-tenant | HIGH | MEDIUM | P1 |
| Invite flow token-based | HIGH | MEDIUM | P1 |
| Super-admin platform | HIGH | MEDIUM | P1 |
| Audit log (eventos canônicos) | HIGH | MEDIUM | P1 |
| Permission gate React | HIGH | LOW | P1 |
| Org switcher React | HIGH | LOW | P1 |
| Custom roles + permission strings | HIGH | HIGH | P2 |
| Department hierarchy | MEDIUM | MEDIUM | P2 |
| LGPD compliance | HIGH | HIGH | P2 |
| CRM pipeline | MEDIUM | MEDIUM | P2 |
| Evolution Go integration | MEDIUM | HIGH | P2 |
| Consent management | MEDIUM | MEDIUM | P3 |
| Lead scoring automático | LOW | HIGH | P3 |
| Bulk invite CSV | LOW | LOW | P3 |

---

## Análise Comparativa

| Funcionalidade | Stripe | Linear | Vercel | Clerk | WorkOS | Abordagem Suíte v1.21 |
|----------------|--------|--------|--------|-------|--------|----------------------|
| Org primitive | `Account` (acct_xxx, metadata, status) | `Workspace` (slug, plan, owner) | `Team` (slug, plan, limits) | `Organization` (id, name, slug, metadata) | `Organization` (id, name, domains, SSO) | Tabela `organizations` com campos convergentes; slug imutável |
| URL pattern | N/A (API only) | `linear.app/<slug>` | `vercel.com/<slug>` | `/orgs/:slug` | Portal separado | `/orgs/:slug/...` (Clerk pattern) |
| Roles | N/A (billing) | Admin/Member + team-level custom | Owner/Member/Billing | Owner/Admin/Member + custom | Owner/Admin/Member + custom | 3 built-in + custom roles org-scoped |
| Invite | Email único | Email único | Email único | Token + email + SCIM | Token + email + SCIM | Token SHA-256 + email, TTL 7d, single-use |
| Dept hierarchy | N/A | Sub-teams 5 níveis (março/2025) | N/A | N/A | N/A | Flat 2 níveis (org → dept), parent_id opcional |
| Audit log | Event log API pago | N/A nativo | Activity log básico | Admin dashboard | Dedicated audit log API | Tabela audit_logs + export CSV/JSON |
| Super-admin | Stripe dashboard (interno) | N/A | Vercel staff tools (interno) | Clerk dashboard | WorkOS admin panel | Painel próprio + trail obrigatório + banner de impersonação |
| Permissions | Product plan-based | Team-scoped | Billing-scoped | Custom permissions strings | Fine-grained RBAC + SCIM | Permission strings `resource:action` + has_permission() |
| LGPD | GDPR compliance (aplicável) | N/A nativo | N/A nativo | DSR suportado | DSR + GDPR toolkit | DSR workflow + consent + anonimização seletiva |

---

## Riscos Técnicos Notáveis

1. **RLS com permission check subquery em 3 tabelas:** `has_permission()` helper percorre `memberships → org_roles → role_permissions`. Sem índice em `role_permissions(role_id, permission)`, cada query RLS vira table scan. Indexação é obrigatória antes do primeiro deploy.

2. **Department hierarchy com `WITH RECURSIVE` em RLS:** Qualquer implementação de herança de permissão por hierarquia de departments via CTE recursiva em política RLS resulta em 10-50× degradação para orgs com 100+ departments. Não usar recursão em RLS — fazer lookup de subárvore na aplicação.

3. **Supabase impersonation via JWT temporário:** Supabase não tem impersonação nativa. A Edge Function que emite JWT com `sub = target_user_id` deve ter TTL máximo de 30 minutos, nunca reutilizável e sempre preceded de registro em audit_logs.

4. **LGPD erasure versus audit log de conformidade:** A decisão arquitetural de anonimizar (null actor_id) versus deletar registros de audit deve ser feita antes de qualquer implementação. Mudar depois exige UPDATE em audit_logs que pode violar imutabilidade pretendida.

5. **Evolution Go instâncias stateful:** Cada número WhatsApp = 1 instância com estado próprio (sessão WhatsApp Web). Múltiplos tenants com múltiplos números = orquestrador de instâncias com health check, reconexão automática e QR re-pairing UI. Arquitetura não é stateless como REST APIs convencionais.

6. **CRM state machine sem validação no banco:** Stages inválidos (ex: `won → lead`) chegam via API direta mesmo com frontend protegido. Check constraint em coluna `stage` + trigger PG que valida a matriz de transições antes de persistir.

7. **JWT stale após role change:** Se usuário tem permissions carregadas no JWT e seu role muda, ele continua com permissões antigas até o JWT expirar. Mitigação: curto TTL de JWT (15 min) + session refresh forçado após qualquer mudança de role.

---

## Fontes

- [WorkOS — Multi-tenant RBAC design](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas)
- [WorkOS — Model your B2B SaaS with organizations](https://workos.com/blog/model-your-b2b-saas-with-organizations)
- [WorkOS — Multi-tenant permissions: Slack, Notion, Linear](https://workos.com/blog/multi-tenant-permissions-slack-notion-linear)
- [Clerk — Org slugs in URLs (canonical pattern)](https://clerk.com/docs/guides/organizations/org-slugs-in-urls)
- [Clerk — Organizations overview](https://clerk.com/docs/guides/organizations/overview)
- [Clerk — URL-based active organization sync (changelog 2024-12)](https://clerk.com/changelog/2024-12-20-sync-org-with-url)
- [Evolution API v2 — Webhook configuration](https://doc.evolution-api.com/v2/en/configuration/webhooks)
- [Evolution Go — GitHub (evolution-foundation/evolution-go)](https://github.com/evolution-foundation/evolution-go)
- [Linear — Sub-teams changelog (março 2025)](https://linear.app/changelog/2025-03-06-sub-teams)
- [Linear — Sub-teams docs](https://linear.app/docs/sub-teams)
- [Yaro Labs — Audit Logs for SaaS: What to Track and How to Build](https://yaro-labs.com/blog/audit-logs-for-saas)
- [Complydog — Brazil LGPD Complete Guide for SaaS](https://complydog.com/blog/brazil-lgpd-complete-data-protection-compliance-guide-saas)
- [Jetico — LGPD Right to Erasure](https://jetico.com/blog/lgpd-right-erasure-how-comply/)
- [Supersaas — Invite flow state machine](https://supersaas.dev/docs/teams/invite-flow)
- [CASL React — Dynamic Permissions Guide](https://dev.to/naufalafif/dynamic-permissions-in-react-using-casl-a-guide-to-secure-your-app-2ino)
- [CASL — Stalniy CASL library](https://github.com/stalniy/casl)
- [Supabase — RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Fyno — WhatsApp rate limits guide](https://www.fyno.io/blog/whatsapp-rate-limits-for-developers-a-guide-to-smooth-sailing-clycvmek2006zuj1oof8uiktv)
- [Wuseller — WhatsApp Cloud API scale guide 2026](https://www.wuseller.com/whatsapp-business-knowledge-hub/scale-whatsapp-cloud-api-master-throughput-limits-upgrades-2026/)
- [HubSpot — Leads, Lifecycle, and Pipeline Stage Overview](https://www.getgsi.com/blog/hubspot-leads-lifecycle-and-pipeline-stage-overview)
- [Auth0 — User onboarding strategies B2B SaaS](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/)
- [Securiti — LGPD Compliance](https://securiti.ai/solutions/lgpd/)
- [Logto — Build multi-tenant SaaS application](https://blog.logto.io/build-multi-tenant-saas-application)

---
*Pesquisa de funcionalidades para: Suíte Multi-Tenant SaaS B2B (kit-mcp v1.21)*
*Pesquisado: 2026-05-10*
