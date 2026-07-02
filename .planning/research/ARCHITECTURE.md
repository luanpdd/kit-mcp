# Pesquisa de Arquitetura — v1.21 Suíte Multi-Tenant SaaS B2B

**Domínio:** Integração da Suíte Multi-Tenant com kit-mcp + arquitetura B2B para apps React + Supabase + Vercel
**Pesquisado:** 2026-05-10
**Confiança:** HIGH (decisões fundamentadas em precedentes diretos do kit v1.8–v1.20 + Supabase docs oficiais + padrões de produção verificados)

---

## Resumo Executivo

v1.21 é a **sexta suíte do kit-mcp** e a primeira com dependências explícitas em suíte anterior (v1.8 Supabase). Isso introduz um padrão novo: **cross-suite delegation via cross-ref Markdown** — agents novos não reimplementam lógica Supabase, apenas a referenciam e especializam. A integração interna do kit é aditiva e zero-breaking. A arquitetura de aplicativo para consumers segue uma progressão de decisões: isolation strategy → schema hierarchy → RLS helpers → JWT design → org switcher state → Edge Function tenant ID → build order.

**Princípio organizador:** *Especialização sobre duplicação.* Agents v1.21 invocam e estendem agents v1.8 via cross-ref Markdown. Skills v1.21 herdam e citam skills v1.8 sem copiar conteúdo.

---

## A. Integração Interna do kit-mcp (entre suítes)

### A1. Como `b2b-saas-architect` invoca `supabase-architect` sem duplicar lógica

**Padrão adotado: delegação explícita via cross-ref Markdown + seção de handoff**

`b2b-saas-architect` não reimplementa projeção de schema, RLS ou topologia realtime — essas responsabilidades pertencem a `supabase-architect` (v1.8). O padrão é:

1. `b2b-saas-architect` coleta domínio multi-tenant (hierarquia firm→dept→role, isolation strategy, volumes)
2. Produz um `B2B-DESIGN.md` com decisões multi-tenant específicas
3. Instrui explicitamente o caller a delegar para `supabase-architect` passando o `B2B-DESIGN.md` como contexto

```markdown
## Handoff para supabase-architect

Após produzir este plano, delegar implementação de schema para:

  Task(subagent_type="supabase-architect", prompt="<feature>
  b2b_design: .planning/phases/<N>/B2B-DESIGN.md
  isolation_strategy: single-schema-tenant-id
  org_hierarchy: firm→department→member
  helper_functions: private.is_member_of, private.has_role, private.has_permission")

Cross-ref canônico: [supabase-architect](../supabase-architect.md) (kit v1.8)
```

**Regra:** `b2b-saas-architect` NUNCA pergunta sobre tier Supabase (isso é responsabilidade do `supabase-architect` no Step 1). Ele pergunta sobre hierarquia organizacional, isolation strategy e volumes esperados por tenant.

**Divisão de responsabilidades:**

| Responsabilidade | Agent responsável |
|---|---|
| Tier Supabase, branches billing, Free pause | `supabase-architect` (v1.8 Step 1) |
| Entidades core, relações, volumes | `supabase-architect` (v1.8 Step 2) |
| Hierarquia firma→dept→role→permission | `b2b-saas-architect` (v1.21) |
| Isolation strategy (single vs schema vs database) | `b2b-saas-architect` (v1.21) |
| Schema final das helper functions PG | `b2b-saas-architect` (v1.21) |
| Migrations, RLS, Edge Functions | Delegado via `/supabase` command (v1.8) |

---

### A2. Como `multi-tenant-rls-writer` herda anti-pitfalls de `supabase-rls-writer`

**Padrão adotado: herança por referência explícita + extensão de template**

`multi-tenant-rls-writer` não reescreve as regras absolutas de RLS. Ele as herda citando a skill e o agent originais, e adiciona apenas o que é específico do contexto multi-tenant:

```markdown
## Regras absolutas herdadas (ver supabase-rls-writer + supabase-rls-policies)

As regras absolutas de `supabase-rls-writer` (v1.8) aplicam-se integralmente:
- `(select auth.uid())` SEMPRE com wrapper — [supabase-rls-policies](../skills/supabase-rls-policies/SKILL.md)
- `user_metadata` NUNCA em policy de autorização — [supabase-rls-writer](./supabase-rls-writer.md) Step 1
- 4 policies separadas por operação (nunca `for all`)
- `to authenticated`/`to anon` sempre explícito
- Indexes obrigatórios em colunas referenciadas

## Extensões específicas multi-tenant (este agent adiciona)

- Helper functions `private.*` SEMPRE como intermediário (nunca `auth.jwt()` inline em policies)
- Bypass super-admin SEMPRE como política RESTRICTIVE separada (não inline na policy de negócio)
- Hierarquia dept→org: department policy checa member via helper, não via JOIN inline
```

**Anti-pitfall herdado crítico:** `(select auth.uid())` wrapper. Em multi-tenant, as queries tendem a ser mais complexas (joins com `organizations`, `departments`) — sem o wrapper, cada linha testada reavalia `auth.uid()`. Em tabelas de tenant com 100k+ linhas o impacto é ainda maior que em apps single-user.

**Anti-pitfall novo exclusivo multi-tenant:** não verificar isolamento cross-tenant. RLS que filtra por `org_id = (select private.get_active_org())` mas não valida que o `org_id` passado pertence ao usuário autenticado cria privilege escalation horizontal.

---

### A3. Como `evolution-go-integrator` invoca `supabase-edge-fn-writer`

**Padrão adotado: delegation com contexto especializado no prompt**

O `evolution-go-integrator` é responsável por decidir a arquitetura do webhook (como identificar o tenant, como validar HMAC, como garantir idempotência). A escrita da Edge Function Deno é delegada para `supabase-edge-fn-writer`:

```markdown
## Handoff para supabase-edge-fn-writer

Para escrever a Edge Function do webhook WhatsApp, delegar:

  Task(subagent_type="supabase-edge-fn-writer", prompt="
  Escrever Edge Function Deno para webhook Evolution Go/WhatsApp.
  
  Tenant identification: URL path param (org_id em /functions/v1/whatsapp/{org_id}/webhook)
  Auth: HMAC-SHA256 com secret per-org (buscar de public.org_webhook_secrets via service_role)
  Idempotency: dedup por (message_id, org_id) em tabela whatsapp_messages
  jwt_verify: false (webhook externo não tem JWT de usuário)
  
  evolution_integrator_design: .planning/phases/<N>/EVOLUTION-DESIGN.md
  ")
```

O `evolution-go-integrator` produz `EVOLUTION-DESIGN.md` com as decisões de arquitetura (identificação de tenant, assinatura HMAC, dedup, rate limit Meta). `supabase-edge-fn-writer` implementa o código seguindo o design.

---

### A4. Como `audit-log-implementer` usa `supabase-cron-queues` para retention

**Padrão adotado: cross-ref direto para skill canônica**

O `audit-log-implementer` usa a skill `supabase-cron-queues` para implementar o scheduled retention cleanup. Não reinventa o pattern `cron → pgmq → Edge Function` — apenas o aplica ao contexto de audit logs:

```markdown
## Retention via cron-queues

Para retention de audit logs, aplicar pattern canônico:
- [supabase-cron-queues](../skills/supabase-cron-queues/SKILL.md) — pg_cron + pgmq + pg_net

Pattern específico (adapta o canônico):
- pg_cron schedule diário (3am): DELETE FROM audit_logs WHERE created_at < NOW() - (
    SELECT retention_days FROM org_settings WHERE org_id = audit_logs.org_id
  ) * INTERVAL '1 day'
- Nunca deletar em pg_cron diretamente se volume > 10k rows/org — enfileirar em pgmq, processar em Edge Function em batches de 1k por org
```

---

### A5. Padrão de glossário compartilhado — cross-suite sem duplicação

**Padrão adotado: citação de termos, não cópia**

`_shared-multi-tenant/glossary.md` cita termos de `_shared-supabase/glossary.md` via cross-ref Markdown quando o termo já está definido lá. Apenas termos novos específicos ao domínio B2B multi-tenant são definidos:

```markdown
# Glossário Multi-Tenant SaaS B2B

## Termos já definidos na suíte Supabase (não duplicar)

Os seguintes termos são definidos em [_shared-supabase/glossary.md](../_shared-supabase/glossary.md)
e aplicam-se integralmente:
- `app_metadata` — para roles/permissions (nunca user_metadata)
- `service_role` — bypass de RLS; usado para super-admin e webhooks externos
- `(select auth.uid())` wrapper — performance crítica em RLS
- `pg_cron`, `pgmq`, `pg_net` — background jobs pattern

## Termos novos (multi-tenant B2B)

| EN | PT-BR / Significado |
|---|---|
| **tenant** | Organização isolada — a unidade de isolamento mais alta. Sinônimo: org, firma. |
| **org_id** | UUID da organização. Presente em quase toda tabela do schema. Coluna de filtro primária de RLS. |
| **super_admin** | Usuário com acesso cross-tenant (o dono da plataforma). Set via `app_metadata.super_admin: true`. |
...
```

**Regra:** se um termo existe em `_shared-supabase/glossary.md`, ele NÃO é redefinido em `_shared-multi-tenant/glossary.md`. Apenas um link para a fonte canônica.

---

## B. Arquitetura Multi-Tenant nos Apps Consumidores

### B1. Tenant Isolation Strategy — Comparação Canônica

**Três estratégias com recomendação default:**

#### Estratégia 1: Single Schema com `tenant_id` em toda tabela (shared schema)

```sql
-- Toda tabela tem tenant_id como segunda coluna (depois de id)
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  -- ... campos do domínio
  created_at  timestamptz not null default now()
);

-- Index obrigatório (RLS filtra por org_id em toda query)
create index contacts_org_id_idx on public.contacts (org_id);

-- RLS via helper function (B3 abaixo)
create policy "contacts_select_members"
  on public.contacts for select to authenticated
  using (private.is_member_of(org_id));
```

| Aspecto | Avaliação |
|---|---|
| Custo operacional | Baixo — 1 database, 1 schema |
| Isolamento | Lógico (RLS) — bug em policy = cross-tenant leak |
| Performance | Bom com indexes em org_id + `(select auth.uid())` |
| Migrations | Simples — 1 arquivo migra todos os tenants |
| Escala de tenants | Até ~10k tenants confortável |
| Compliance LGPD/GDPR | Delete por tenant via `DELETE WHERE org_id = ?` — simples |
| Complexidade dev | Baixa — padrão Supabase natural |

**Quando escolher:** SaaS B2B com volume de tenants moderado (1–10k), equipe pequena, early-stage. **Default recomendado para 90% dos casos.**

#### Estratégia 2: Schema-per-Tenant (Postgres SCHEMAS isolados)

```sql
-- Criar schema isolado por tenant
create schema "tenant_abc123";
-- Cada tabela vive no schema do tenant
create table "tenant_abc123".contacts (...);
-- RLS pode ser omitido (isolamento pelo schema path)
set search_path = 'tenant_abc123';
```

| Aspecto | Avaliação |
|---|---|
| Custo operacional | Médio — migrations por schema, connection pool por schema |
| Isolamento | Forte — impossível cross-tenant sem search_path errado |
| Performance | Melhor por tenant (sem filtro org_id), pior agregado (cross-schema queries impossíveis) |
| Migrations | Complexo — 1 migration por tenant (N vezes) |
| Escala de tenants | Até ~500 schemas confortável (Postgres suporta mais, mas tooling fica pesado) |
| Compliance LGPD/GDPR | DROP SCHEMA elimina tudo — simples para delete de tenant |
| Complexidade dev | Alta — connection routing, schema management, search_path |

**Quando escolher:** Compliance extremo (saúde/jurídico), clientes enterprise com auditoria isolada, tenants com dados sensíveis que exigem evidência de isolamento física.

#### Estratégia 3: Database-per-Tenant

| Aspecto | Avaliação |
|---|---|
| Custo operacional | Alto — 1 database Supabase por tenant = billing multiplicado |
| Isolamento | Máximo — sem compartilhamento algum |
| Performance | Máxima por tenant, sem ruído de vizinho |
| Migrations | Muito complexo — pipeline de deploy paralelo |
| Escala de tenants | ~10–50 tenants maximum (custo proibitivo) |

**Quando escolher:** Contratos enterprise onde o cliente exige "meu próprio banco de dados". Raramente justificado com Supabase.

**Recomendação default: Estratégia 1 (single schema + tenant_id + RLS).**

Razões:
- Compatible com tooling Supabase nativo (migrations, declarative schema, MCP)
- RLS via helper functions `private.is_member_of()` é auditável e performático
- Compliance LGPD por tenant via `DELETE WHERE org_id = ?` e `SELECT WHERE org_id = ?` para export
- Supabase v1.8 skills + agents já conhecem este padrão

---

### B2. Schema Canônico — Hierarquia firm→department→leader→collaborator

#### Tabelas core (ordem de dependência)

```sql
-- 1. ORGANIZATIONS (firma / tenant root)
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,                       -- para URL routing (ex: /orgs/acme/)
  plan          text not null default 'free'                -- billing tier
    check (plan in ('free', 'starter', 'pro', 'enterprise')),
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index organizations_slug_idx on public.organizations (slug);

-- 2. DEPARTMENTS (divisões dentro da firma — hierarquia flat ou tree)
create table public.departments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  parent_id     uuid references public.departments(id) on delete set null, -- nullable = dept raiz
  name          text not null,
  created_at    timestamptz not null default now()
);
create index departments_org_id_idx on public.departments (org_id);
create index departments_parent_id_idx on public.departments (parent_id);

-- 3. ROLES (catálogo de papéis por org — não global)
create table public.roles (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,                              -- 'leader', 'collaborator', 'viewer'
  is_system     boolean not null default false,             -- roles criados pelo sistema (não deletáveis)
  created_at    timestamptz not null default now(),
  unique (org_id, name)
);
create index roles_org_id_idx on public.roles (org_id);

-- 4. PERMISSIONS (ações permitidas por recurso)
create table public.permissions (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,                              -- 'contacts:read', 'contacts:write', 'billing:manage'
  resource      text not null,                              -- 'contacts', 'billing', 'members', 'reports'
  description   text,
  unique (action, resource)
);

-- 5. ROLE_PERMISSIONS (quais permissions cada role tem)
create table public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- 6. ORGANIZATION_MEMBERS (membros da org — nível firma)
create table public.organization_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role_id       uuid not null references public.roles(id),
  status        text not null default 'active'
    check (status in ('active', 'suspended', 'pending')),
  invited_by    uuid references auth.users(id),
  joined_at     timestamptz not null default now(),
  unique (org_id, user_id)
);
create index org_members_org_id_idx on public.organization_members (org_id);
create index org_members_user_id_idx on public.organization_members (user_id);
create index org_members_role_id_idx on public.organization_members (role_id);

-- 7. DEPARTMENT_MEMBERS (membros de dept — herda de org_members)
create table public.department_members (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id) on delete cascade,
  org_member_id  uuid not null references public.organization_members(id) on delete cascade,
  role_id        uuid references public.roles(id),          -- nullable = herda role do org_member
  created_at     timestamptz not null default now(),
  unique (department_id, org_member_id)
);
create index dept_members_dept_id_idx on public.department_members (department_id);
create index dept_members_org_member_id_idx on public.department_members (org_member_id);
```

#### Herança de permissions: department_members → organization_members

`department_members.role_id` é nullable. Quando NULL, o membro herda o role de `organization_members.role_id`. Quando não NULL, o role de departamento sobrescreve (para promoter alguém a leader dentro de um dept sem promover na org inteira).

A helper function `private.has_role()` implementa esta lógica de herança:

```sql
-- Resolve role efetivo: dept role > org role
create or replace function private.effective_role_in_dept(
  p_dept_id uuid,
  p_org_id  uuid
) returns uuid
language sql
stable security invoker
set search_path = ''
as $$
  select coalesce(
    dm.role_id,           -- dept-level override (se existir)
    om.role_id            -- org-level fallback
  )
  from public.organization_members om
  left join public.department_members dm
    on dm.org_member_id = om.id
    and dm.department_id = p_dept_id
  where om.user_id = (select auth.uid())
    and om.org_id  = p_org_id
    and om.status  = 'active'
  limit 1
$$;
```

#### Recursive departments vs flat

**Recomendação: tree com `parent_id nullable` (1 nível de recursão suficiente para 99% dos casos)**

- `parent_id IS NULL` = departamento raiz da organização
- `parent_id = <dept_id>` = subdepartamento
- Não usar `ltree` ou `WITH RECURSIVE` para hierarquia no filtro RLS — complexidade proibitiva em performance
- RLS filtra por membership direta no departamento, não por árvore completa
- Se necessário listar departamentos filhos, fazer query separada (fora do RLS)

```sql
-- Para listar toda a árvore (query separada, não em RLS)
with recursive dept_tree as (
  select id, name, parent_id, 0 as depth
  from public.departments
  where org_id = $1 and parent_id is null
  union all
  select d.id, d.name, d.parent_id, dt.depth + 1
  from public.departments d
  join dept_tree dt on d.parent_id = dt.id
)
select * from dept_tree order by depth, name;
```

---

### B3. RLS Hierarchy — Helper Functions PG Canônicas

#### Schema `private` (separado de `public`)

Todas as helper functions vivem no schema `private` — não expostas via PostgREST. Criar o schema na primeira migration:

```sql
create schema if not exists private;
```

#### Função 1: `private.is_member_of`

```sql
-- Retorna true se o usuário autenticado é membro ativo da org
create or replace function private.is_member_of(p_org_id uuid)
returns boolean
language sql
stable                       -- mesma transação, mesmo resultado; permite caching PG
security invoker             -- executa com permissões do caller (nunca definer)
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where org_id  = p_org_id
      and user_id = (select auth.uid())
      and status  = 'active'
  )
$$;

-- Index suportando a função (obrigatório)
create index org_members_user_org_active_idx
  on public.organization_members (user_id, org_id)
  where status = 'active';   -- partial index — só linhas ativas
```

#### Função 2: `private.has_role`

```sql
-- Retorna true se o usuário tem o role especificado na org (nome do role, não ID)
create or replace function private.has_role(p_org_id uuid, p_role_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.roles r on r.id = om.role_id
    where om.org_id   = p_org_id
      and om.user_id  = (select auth.uid())
      and om.status   = 'active'
      and r.name      = p_role_name
      and r.org_id    = p_org_id
  )
$$;
```

#### Função 3: `private.has_permission`

```sql
-- Retorna true se o usuário tem a permission especificada na org
-- (resolve via role → role_permissions → permissions)
create or replace function private.has_permission(
  p_action   text,
  p_resource text,
  p_org_id   uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role_id  = om.role_id
    join public.permissions p       on p.id        = rp.permission_id
    where om.org_id   = p_org_id
      and om.user_id  = (select auth.uid())
      and om.status   = 'active'
      and p.action    = p_action
      and p.resource  = p_resource
  )
$$;
```

#### Função 4: `private.is_super_admin`

```sql
-- Retorna true se o usuário é super admin da plataforma (cross-tenant)
-- Lê de app_metadata (nunca user_metadata)
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt()->'app_metadata'->>'super_admin')::boolean,
    false
  )
$$;
```

#### Composição em policies

```sql
-- Policy simples: apenas membership
create policy "contacts_select_org_members"
  on public.contacts for select to authenticated
  using (private.is_member_of(org_id));

-- Policy com role específico: leader pode deletar
create policy "contacts_delete_leaders"
  on public.contacts for delete to authenticated
  using (private.has_role(org_id, 'leader'));

-- Policy com permission granular
create policy "contacts_insert_writers"
  on public.contacts for insert to authenticated
  with check (private.has_permission('contacts:write', 'contacts', org_id));

-- Policy super admin: acesso a tudo (RESTRICTIVE — bypass total)
-- CRITICAL: usar RESTRICTIVE para que super_admin ADICIONE acesso, não substitua
create policy "contacts_super_admin_bypass"
  on public.contacts for all to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
```

**NOTA sobre `RESTRICTIVE` vs `PERMISSIVE`:**
- Policies de negócio são `PERMISSIVE` (default) — pelo menos uma deve ser verdadeira
- A policy de super admin DEVE ser `PERMISSIVE` também, pois super admin precisa de pelo menos uma policy que permita o acesso
- `RESTRICTIVE` seria errado aqui — RESTRICTIVE adiciona restrições, não bypass

Forma correta para super admin bypass:
```sql
-- Super admin: policy permissive separada que admite tudo
-- O PG avalia: (any permissive true) AND (all restrictive true)
-- Portanto, super admin policy PERMISSIVE permite acesso independente das outras permissives
create policy "super_admin_all_access"
  on public.contacts for all to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
```

#### Performance: `STABLE` vs `IMMUTABLE` nas helpers

- `STABLE`: função pode ler DB, mas retorna mesmo resultado na transação. **Correto para helpers que fazem SELECT** (is_member_of, has_role, has_permission). Postgres pode reutilizar resultado dentro de 1 query.
- `IMMUTABLE`: sem acesso a DB, resultado idêntico para mesmos args sempre. **Correto apenas para** `is_super_admin()` (só lê JWT, sem DB) — mas `STABLE` é conservadoramente correto para todas.
- Nunca usar `VOLATILE` (default) em helpers de RLS — força re-execução por linha, anulando o ganho do `(select)` wrapper.

**Index strategy para helpers:**

```sql
-- is_member_of: precisa de index (user_id, org_id) com partial WHERE status='active'
create index org_members_user_org_active_idx
  on public.organization_members (user_id, org_id)
  where status = 'active';

-- has_role: precisa de index adicional em roles(name, org_id)
create index roles_name_org_idx on public.roles (name, org_id);

-- has_permission: index composto em permissions(action, resource)
create index permissions_action_resource_idx on public.permissions (action, resource);
-- + index em role_permissions(role_id) — já coberto por FK index implícito
```

---

### B4. JWT Claims Design

**O que vai em `app_metadata` do Supabase Auth:**

#### Opção A: Minimal JWT (recomendada para maioria)

```json
{
  "app_metadata": {
    "super_admin": true
  }
}
```

Sem `org_id` no JWT. Toda lookup de org_id vai ao banco via helper functions. RLS é a fonte de verdade.

| Trade-off | Avaliação |
|---|---|
| JWT size | Mínimo — nenhum dado de org |
| Query overhead | Cada RLS check faz SELECT em organization_members |
| Stale data | Nunca — cada query lê estado atual do banco |
| Complexidade | Baixa — sem Custom Access Token Hook |

**Quando usar:** apps com ≤ 3 orgs por usuário, times pequenos, early-stage.

#### Opção B: org_id default no JWT

```json
{
  "app_metadata": {
    "default_org_id": "uuid-da-org-default",
    "super_admin": false
  }
}
```

| Trade-off | Avaliação |
|---|---|
| JWT size | Pequeno — 1 UUID |
| Query overhead | RLS usa `auth.jwt()->'app_metadata'->>'default_org_id'` (0 queries extras) |
| Stale data | 1h até expiração do JWT — se user sair da org, acesso temporário |
| Complexidade | Média — precisar de Custom Access Token Hook para setar |

**Quando usar:** apps onde 95%+ das ações são na org default, performance crítica.

#### Opção C: lista de orgs no JWT (anti-padrão para maioria)

```json
{
  "app_metadata": {
    "orgs": [
      {"id": "uuid1", "role": "leader"},
      {"id": "uuid2", "role": "collaborator"}
    ]
  }
}
```

| Trade-off | Avaliação |
|---|---|
| JWT size | Grande — cresce com número de orgs (JWT tem limite ~8KB) |
| Query overhead | Zero queries extras em RLS para membership check |
| Stale data | 1h — remoção de membro não é imediata |
| Complexidade | Alta — Custom Access Token Hook obrigatório; revogação problemática |

**Anti-padrão para maioria.** JWT bloat em usuários com muitas orgs. Revogação lenta é risco de segurança.

**Recomendação default: Opção A (minimal JWT)**

Helper functions consultam o banco, que é a fonte de verdade atualizada. O ganho de performance de Opção B raramente justifica a complexidade de stale-data. Super admin é o único claim necessário no JWT porque determina bypass completo de RLS — precisa ser fast-path.

**Custom Access Token Hook (quando usar Opção B):**

```sql
-- Supabase Auth Hook — executa antes de emitir JWT
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer          -- SECURITY DEFINER aqui é justificado: precisa ler auth.users
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_is_super_admin boolean;
begin
  -- Buscar org default do usuário
  select org_id into v_org_id
  from public.organization_members
  where user_id = (event->>'user_id')::uuid
    and status = 'active'
  order by joined_at asc
  limit 1;

  -- Verificar super admin
  select (event->'user'->>'is_super_admin')::boolean into v_is_super_admin;

  -- Injetar no app_metadata
  return jsonb_set(
    event,
    '{claims,app_metadata}',
    event->'claims'->'app_metadata'
      || jsonb_build_object(
           'default_org_id', v_org_id,
           'super_admin', coalesce(v_is_super_admin, false)
         )
  );
end
$$;
```

---

### B5. Org Switcher State

#### Next.js v16 (App Router) — URL path recomendado

```
/orgs/[slug]/          → dashboard da org
/orgs/[slug]/contacts  → contacts da org
/orgs/[slug]/settings  → settings da org
```

**Middleware para validação:**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const slugMatch = pathname.match(/^\/orgs\/([^\/]+)/)
  
  if (!slugMatch) return NextResponse.next()
  
  const slug = slugMatch[1]
  const response = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (cs) => cs.forEach(c => response.cookies.set(c)) } }
  )
  
  // Validar membership (RLS faz o trabalho pesado)
  const { data: org } = await supabase
    .from('organizations')
    .select('id, slug, name')
    .eq('slug', slug)
    .single()
  
  if (!org) return NextResponse.redirect(new URL('/orgs', request.url))
  
  // Passar org_id via header para Server Components
  response.headers.set('x-org-id', org.id)
  response.headers.set('x-org-slug', org.slug)
  
  return response
}

export const config = { matcher: ['/orgs/:slug*'] }
```

**Vantagens do URL path:**
- Deep-linkable — URL compartilhada sempre abre na org correta
- Back/forward funciona
- Vercel edge: nenhuma configuração extra de domínio
- SEO trivial

**Subdomínio (acme.app.com) — quando usar:**
- White-label: cliente quer `acme.suaapp.com`
- Requer Vercel Wildcard Domains (Pro+)
- Adiciona complexidade de certificado SSL por subdomínio
- Middleware extrai `request.headers.get('host')` em vez de path

**Cookie/localStorage — anti-padrão:**
- Estado não persiste em URL sharing
- Race condition em tabs múltiplas
- Nunca usar como mecanismo primário

**Vite SPA (sem middleware):**
```typescript
// src/providers/OrgProvider.tsx
// Active org vive no URL: /orgs/:orgSlug/*
// React Router v6: useParams() → { orgSlug }
// Buscar org_id via orgSlug em useEffect
// Armazenar em context — nunca em localStorage como autoridade
import { useParams } from 'react-router-dom'

export function OrgProvider({ children }) {
  const { orgSlug } = useParams()
  const [activeOrg, setActiveOrg] = useState(null)
  
  // Buscar org ao montar/mudar slug
  useEffect(() => {
    supabase.from('organizations')
      .select('id, slug, name')
      .eq('slug', orgSlug)
      .single()
      .then(({ data }) => setActiveOrg(data))
  }, [orgSlug])
  
  return <OrgContext.Provider value={activeOrg}>{children}</OrgContext.Provider>
}
```

---

### B6. Edge Functions Multi-Tenant — Identificação de Tenant em Webhooks

**Problema:** webhooks Evolution Go chegam sem JWT de usuário Supabase. Como identificar qual tenant (org) recebe a mensagem?

#### Opção recomendada: URL path + HMAC per-org

```
/functions/v1/whatsapp/{org_id}/webhook
```

**Implementação:**

```typescript
// supabase/functions/whatsapp-webhook/index.ts
// verify_jwt: false (em supabase/config.toml: [functions.whatsapp-webhook] verify_jwt = false)
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // 1. Extrair org_id da URL
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')  // /functions/v1/whatsapp/{org_id}/webhook
  const orgId = pathParts[pathParts.length - 2]
  
  if (!orgId || !isValidUUID(orgId)) {
    return new Response('invalid org_id', { status: 400 })
  }
  
  // 2. Buscar HMAC secret do org (service_role bypassa RLS)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const { data: webhook_config } = await supabaseAdmin
    .from('org_webhook_configs')
    .select('hmac_secret, is_active')
    .eq('org_id', orgId)
    .eq('provider', 'evolution')
    .single()
  
  if (!webhook_config?.is_active) {
    return new Response('org not found or inactive', { status: 404 })
  }
  
  // 3. Validar HMAC (Evolution Go envia X-Webhook-Signature)
  const signature = req.headers.get('x-webhook-signature') ?? ''
  const body = await req.text()
  const expected = await computeHmac(body, webhook_config.hmac_secret)
  
  if (!timingSafeEqual(signature, expected)) {
    return new Response('invalid signature', { status: 401 })
  }
  
  // 4. Processar payload com org_id como contexto
  const payload = JSON.parse(body)
  
  // 5. Idempotência: dedup por (message_id, org_id)
  const { error: insertError } = await supabaseAdmin
    .from('whatsapp_messages')
    .insert({
      org_id,
      message_id: payload.data.key.id,
      // ... campos do payload
    })
  
  // Conflict = mensagem já processada = idempotente
  if (insertError?.code === '23505') {
    return new Response('duplicate', { status: 200 })
  }
  
  return new Response('ok', { status: 200 })
})
```

**Tabela de suporte:**
```sql
create table public.org_webhook_configs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  provider    text not null check (provider in ('evolution', 'stripe', 'twilio')),
  hmac_secret text not null,                         -- gerado no onboarding, armazenado encriptado
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, provider)
);
-- RLS: apenas service_role (webhooks externos) e super_admin
```

**Alternativa: mapeamento phone_number → org_id**

```sql
-- Tabela de instâncias WhatsApp por org
create table public.whatsapp_instances (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  phone_number    text not null unique,         -- +55 11 99999-9999 normalizado
  instance_name   text not null,               -- nome da instância no Evolution
  is_active       boolean not null default true
);
create index whatsapp_instances_phone_idx on public.whatsapp_instances (phone_number);
```

URL simplificada sem org_id:
```
/functions/v1/whatsapp/webhook
```
Edge Function extrai `phone_number` do payload → busca org_id na tabela. Mais simples para Evolution Go (1 endpoint único), mas 1 query extra por webhook.

**Recomendação: URL path + HMAC.** Motivos:
- Identifica tenant antes de abrir o payload (fail-fast)
- HMAC por org garante que tenant A não pode enviar webhooks para tenant B
- Padrão adotado por Stripe, GitHub, Twilio
- Compatível com Evolution Go que permite configurar URL por instância

---

### B7. Build Order Numerada com Dependências

```
Preconditions (sem dependências):
  Phase 106 ──→ Schema + helper functions + RLS base
                (organizations, departments, roles, permissions,
                 organization_members, department_members,
                 private.is_member_of, private.has_role,
                 private.has_permission, private.is_super_admin)

Depende de Phase 106:
  Phase 107 ──→ Org onboarding flow
                (signup → criar org → primeiro admin → setup wizard)
                Depende de: organizations, organization_members, roles (sistema)

  Phase 108 ──→ RLS hierarchy completa
                (policies em todas as tabelas de domínio)
                Depende de: helper functions (106), schema completo (106)

Cross-cutting (independentes, mas dependem de 106):
  Phase 109 ──→ Audit log multi-tenant
                (audit_logs table + trigger em tabelas core + retention cron)
                Depende de: organizations (106), cron-queues pattern (skill v1.8)

Depende de 107 + 108:
  Phase 110 ──→ Invite flow
                (token-based invites, accept/decline, role pré-definido)
                Depende de: org exists (107), RLS policies (108)

Depende de tudo acima:
  Phase 111 ──→ Super admin
                (cross-tenant view, impersonation, billing dashboard)
                Depende de: schema completo (106), org onboarding (107), RLS (108)

Domain features (depois do core):
  Phase 112 ──→ WhatsApp / Evolution Go integration
                (org_webhook_configs, whatsapp_instances, whatsapp_messages,
                 Edge Function webhook, dedup, HMAC per-org)
                Depende de: organizations (106), audit log (109)

  Phase 113 ──→ CRM Pipeline
                (contacts, pipelines, pipeline_stages, deals, deal_activities)
                Depende de: organizations (106), audit log (109), members (107)

Cross-cutting (pode ser paralelo ao domain):
  Phase 114 ──→ LGPD compliance
                (data subject rights, consent management, data export/delete per-tenant)
                Depende de: schema completo (106), audit log (109)

Frontend (React):
  Phase 115 ──→ Org switcher + Permission gate + Member management UI
                (org-switcher-react-pattern, permission-gate-react-pattern,
                 member-management-react-shadcn)
                Depende de: RLS (108), invite flow (110)

Kit artifacts:
  Phase 116 ──→ 10 agents + 15 skills + 1 glossário + /multi-tenant command
                (todos os artefatos do kit — pode iniciar em paralelo com 106)
```

**Build order numerada:**

| # | Phase | Precondição | Pode Paralelo com |
|---|---|---|---|
| 1 | 106 Schema + helpers + RLS base | Nada | 116 (kit artifacts) |
| 2 | 107 Org onboarding | 106 | 109 Audit |
| 3 | 108 RLS hierarchy completa | 106 | 109 Audit |
| 4 | 109 Audit log | 106 | 107, 108 |
| 5 | 110 Invite flow | 107 + 108 | 111 Super admin |
| 6 | 111 Super admin | 106 + 107 + 108 | 110 Invite |
| 7 | 112 WhatsApp/Evolution | 106 + 109 | 113 CRM |
| 8 | 113 CRM Pipeline | 106 + 109 | 112 WhatsApp |
| 9 | 114 LGPD compliance | 106 + 109 | 112, 113 |
| 10 | 115 Frontend React | 108 + 110 | 112, 113, 114 |
| 11 | 116 Kit artifacts | Nada | 106+ |

**Onda 1 (paralelo):** 106 + 116
**Onda 2 (paralelo):** 107 + 108 + 109
**Onda 3 (paralelo):** 110 + 111 + 112 + 113 + 114
**Onda 4:** 115 (depende de 108 + 110)

---

## Estrutura de Projeto Recomendada (artefatos kit-mcp)

```
kit/
├── agents/
│   ├── b2b-saas-architect.md           ◄ novo v1.21
│   ├── multi-tenant-rls-writer.md      ◄ novo v1.21
│   ├── multi-tenant-isolation-auditor.md ◄ novo v1.21
│   ├── lgpd-compliance-auditor.md      ◄ novo v1.21
│   ├── org-onboarding-implementer.md   ◄ novo v1.21
│   ├── invite-flow-implementer.md      ◄ novo v1.21
│   ├── super-admin-implementer.md      ◄ novo v1.21
│   ├── audit-log-implementer.md        ◄ novo v1.21
│   ├── evolution-go-integrator.md      ◄ novo v1.21
│   └── crm-pipeline-implementer.md     ◄ novo v1.21
├── commands/
│   └── multi-tenant.md                 ◄ novo v1.21
└── skills/
    ├── _shared-multi-tenant/
    │   └── glossary.md                 ◄ novo v1.21
    ├── b2b-saas-architecture/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── multi-tenant-rls-hierarchy/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── rbac-permissions-matrix-supabase/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── multi-tenant-performance-scaling/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── org-onboarding-flow/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── member-invite-flow/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── super-admin-platform-pattern/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── audit-log-multi-tenant/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── lgpd-multi-tenant-compliance/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── evolution-go-whatsapp-integration/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── whatsapp-conversation-state-machine/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── crm-lead-pipeline-patterns/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── org-switcher-react-pattern/
    │   └── SKILL.md                    ◄ novo v1.21
    ├── permission-gate-react-pattern/
    │   └── SKILL.md                    ◄ novo v1.21
    └── member-management-react-shadcn/
        └── SKILL.md                    ◄ novo v1.21
```

---

## Padrões Arquiteturais

### Padrão 1: Cross-Suite Delegation (novo em v1.21)

**O que é:** Agent v1.21 não reimplementa responsabilidade coberta por agent v1.8. Em vez disso, produz um design file e instrui o caller a delegar para o agent v1.8 com contexto.

**Quando usar:** Sempre que um agent v1.21 precisar de schema SQL, policies RLS base, ou Edge Functions Deno.

**Trade-offs:**
- Pro: DRY, evita drift entre suítes, v1.8 é a fonte de verdade de padrões Supabase
- Contra: cadeia de agentes mais longa (2 invocações em vez de 1)
- Mitigação: `/multi-tenant` command orquestra a cadeia transparentemente para o usuário

### Padrão 2: Helper Functions como camada de indireção RLS

**O que é:** RLS policies nunca chamam `auth.jwt()` ou `auth.uid()` diretamente — sempre passam por `private.*` helper functions. Políticas são declarativas; lógica vive nas functions.

**Quando usar:** Toda policy de tabela que requer verificação de membership, role ou permission.

**Trade-offs:**
- Pro: lógica centralizada, testável individualmente, mudança em 1 lugar propaga para todas as policies
- Contra: 1 layer extra de indireção (mitigado por STABLE + partial indexes)

### Padrão 3: URL-based Tenant Context

**O que é:** O `org_id` ativo no frontend é determinado pela URL, não por cookie/localStorage. Middleware valida antes de servir qualquer página.

**Quando usar:** Next.js v16 com App Router. Para Vite SPA, React Router v6 com useParams.

**Trade-offs:**
- Pro: deep-linkable, sem race conditions entre tabs, auditável nos logs de acesso
- Contra: URLs mais longas (`/orgs/acme/contacts` em vez de `/contacts`)

---

## Anti-Padrões

### Anti-Padrão 1: Duplicar lógica Supabase nos agents v1.21

**O que as pessoas fazem:** Escrever RLS policies completas dentro de `multi-tenant-rls-writer` sem referenciar `supabase-rls-writer`.

**Por que está errado:** Drift imediato. Se `supabase-rls-writer` corrigir um bug (ex: atualizar pattern de `(select auth.uid())`), `multi-tenant-rls-writer` fica desatualizado.

**Faça isto em vez disso:** Cross-ref explícito + seção "Regras herdadas de supabase-rls-writer (v1.8)".

### Anti-Padrão 2: Colocar org_id em JWT claims para todas as orgs

**O que as pessoas fazem:** Adicionar `"orgs": [{"id": "...", "role": "..."}]` para cada org no JWT.

**Por que está errado:** JWT cresce linearmente com número de orgs. Usuário com 20 orgs tem JWT gigante. Revogação de membership não é imediata (até 1h de stale). Risco de segurança real.

**Faça isto em vez disso:** JWT minimal com apenas `super_admin: bool`. Lookup de membership via helper functions (banco é a fonte de verdade).

### Anti-Padrão 3: RLS inline sem helper functions

**O que as pessoas fazem:** Escrever JOIN inline na policy:
```sql
using (exists (select 1 from organization_members where org_id = contacts.org_id and user_id = auth.uid()))
```

**Por que está errado:** Lógica duplicada em N policies. Sem (select) wrapper no `auth.uid()`. Manutenção impossível.

**Faça isto em vez disso:** `using (private.is_member_of(org_id))` — 1 linha, STABLE, com index.

### Anti-Padrão 4: Não isolar schema `private` do PostgREST

**O que as pessoas fazem:** Criar helper functions em `public` schema.

**Por que está errado:** `public` schema é exposto via PostgREST. Funções `private.is_member_of` chamadas por cliente externo via API = information disclosure sobre membership.

**Faça isto em vez disso:** Sempre schema `private` para helpers. Nunca expor via PostgREST.

### Anti-Padrão 5: Webhook Evolution sem idempotência

**O que as pessoas fazem:** Processar webhook e inserir mensagem sem dedup check.

**Por que está errado:** Evolution Go pode reenviar webhook em retry. Mensagem duplicada = usuário recebe resposta 2x, cobrança duplicada, etc.

**Faça isto em vez disso:** `unique (org_id, message_id)` na tabela + `ON CONFLICT DO NOTHING`.

---

## Pontos de Integração

### Entre suítes (cross-suite)

| De | Para | Padrão |
|---|---|---|
| `b2b-saas-architect` (v1.21) | `supabase-architect` (v1.8) | Delegation — B2B-DESIGN.md como contexto |
| `multi-tenant-rls-writer` (v1.21) | `supabase-rls-writer` (v1.8) | Herança por referência + extensão |
| `evolution-go-integrator` (v1.21) | `supabase-edge-fn-writer` (v1.8) | Delegation — EVOLUTION-DESIGN.md como contexto |
| `audit-log-implementer` (v1.21) | `supabase-cron-queues` (skill v1.8) | Cross-ref de skill, padrão aplicado ao contexto |
| `_shared-multi-tenant/glossary.md` | `_shared-supabase/glossary.md` | Citação por link Markdown, não duplicação |

### Serviços externos (nos apps dos consumers)

| Serviço | Padrão de Integração | Notas |
|---|---|---|
| Evolution Go API | URL path tenant_id + HMAC per-org + dedup | Edge Function `verify_jwt: false` |
| Supabase Auth | app_metadata minimal (super_admin only) | Custom Access Token Hook opcional |
| Vercel Edge | Middleware valida slug → org_id antes de servir | Next.js v16 App Router |
| Vite/React | URL path via React Router useParams | OrgProvider wraps children |

---

## Fontes

- [Supabase RLS Best Practices — makerkit.dev](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Multi-Tenant Applications with RLS — AntStack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Custom Claims RBAC — Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Custom Access Token Hook — Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [RLS Performance Best Practices — Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Next.js Multi-Tenant Guide — Vercel](https://vercel.com/guides/nextjs-multi-tenant-application)
- [Next.js 16 Multi-Tenant Architecture — Medium](https://medium.com/@sureshdotariya/next-js-16-architecture-blueprint-for-large-scale-applications-build-scalable-saas-multi-tenant-ab0efe9f2dad)
- [Evolution API Webhooks Docs](https://doc.evolution-api.com/v2/en/configuration/webhooks)
- [Supabase JWT Fields Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- `D:/projetos/opensource/mcp/kit/agents/supabase-architect.md` — delegação e responsabilidades v1.8
- `D:/projetos/opensource/mcp/kit/agents/supabase-rls-writer.md` — anti-pitfalls herdados
- `D:/projetos/opensource/mcp/kit/skills/supabase-rls-policies/SKILL.md` — regras absolutas de RLS
- `D:/projetos/opensource/mcp/kit/skills/supabase-cron-queues/SKILL.md` — padrão pg_cron + pgmq
- `D:/projetos/opensource/mcp/kit/skills/_shared-supabase/glossary.md` — termos Supabase canônicos
- `D:/projetos/opensource/mcp/kit/commands/supabase.md` — padrão de orquestrador com dispatch

---

*Pesquisa de arquitetura para: v1.21 Suíte Multi-Tenant SaaS B2B — integração com kit-mcp + arquitetura B2B*
*Pesquisado: 2026-05-10*
