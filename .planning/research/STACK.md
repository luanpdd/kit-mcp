# Pesquisa de Stack — Suíte Multi-Tenant SaaS B2B (`@luanpdd/kit-mcp` v1.21)

**Domínio:** Multi-Tenant SaaS B2B — React + Supabase + Vercel
**Pesquisado:** 2026-05-10
**Confiança:** HIGH (versões verificadas via npm/docs oficiais; padrões validados em fontes primárias)

> Stack que as SKILLS devem citar/recomendar para USUÁRIOS do kit construindo apps B2B multi-tenant.
> O kit-mcp em si não adiciona nenhuma dependência — este documento é sobre o que recomendar
> para consumidores. Contexto anterior (v1.8 Supabase) ainda válido; este arquivo cobre
> APENAS o novo domínio multi-tenant B2B (v1.21).

---

## 1. RBAC — Autorização client-side

### Decisao canonica: `@casl/ability` v6 + `@casl/react`

**Racional:** CASL e a unica lib RBAC JavaScript que e genuinamente isomorfica (mesmo codigo
frontend/backend), tem integracao React de primeira classe via hook `useAbility` e componente
`<Can>`, e tem footprint minimo (~5 KB min+gzip para `@casl/ability`, +1 KB para `@casl/react`).
A v6 e stable e ativamente mantida.

| Pacote | Versao | Proposito |
|--------|--------|-----------|
| `@casl/ability` | **6.8.0** (latest, ~3 meses atras) | Core: definicao de rules + check `can(action, resource)` |
| `@casl/react` | 4.x (segue @casl/ability) | `<Can>` component + `useAbility` hook |

**Padrao de integracao com Supabase:**

```ts
// PT-BR: popula o Ability a partir dos claims do token Supabase (custom access token hook)
import { defineAbility } from '@casl/ability'

export function buildAbility(claims: {
  role: string
  org_id: string
  permissions: string[]  // vindas do custom access token hook
}) {
  return defineAbility((can) => {
    for (const perm of claims.permissions) {
      const [action, resource] = perm.split(':')  // ex: 'read:leads'
      can(action, resource, { org_id: claims.org_id })  // scope por org
    }
    if (claims.role === 'super_admin') {
      can('manage', 'all')
    }
  })
}
```

```tsx
// PT-BR: componente PermissionGate usando CASL
import { useAbility } from '@casl/react'
import { AbilityContext } from './ability-context'

export function PermissionGate({
  action,
  resource,
  children,
  fallback = null,
}: {
  action: string
  resource: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const ability = useAbility(AbilityContext)
  if (!ability.can(action, resource)) return <>{fallback}</>
  return <>{children}</>
}

// Uso:
// <PermissionGate action="delete" resource="leads">
//   <DeleteButton />
// </PermissionGate>
```

**Regra critica:** CASL no frontend e apenas UX (hide/show). A autorizacao real fica em RLS
Postgres + Edge Functions. Nunca confiar em CASL como barreira de seguranca.

### Por que nao Casbin

Casbin JS e design-first para backend Go/Java. O port JavaScript e pesado, nao tem integracao
React nativa, e o modelo CONF file e overkill para a maioria dos apps SaaS. Anti-recomendado
para React.

### Por que nao Permify / Oso / Permit.io

Sao servicos externos (latencia de rede em cada check). Fazem sentido para empresas com
multiplos microsservicos precisando de policy store centralizado. Para um monolito React +
Supabase, adicionar uma chamada de rede a cada check de permissao e custo desnecessario.
Anti-recomendado para estagio de startup.

---

## 2. Auth claim management — JWT custom claims multi-tenant

### Decisao canonica: Custom Access Token Hook + `@supabase/ssr` v0.10.x (Next.js) ou `@supabase/supabase-js` v2 (Vite SPA)

| Runtime | Pacote | Versao |
|---------|--------|--------|
| Next.js v15+ App Router | `@supabase/ssr` | **0.10.2** (latest, ~22 dias atras) |
| Vite SPA (sem SSR) | `@supabase/supabase-js` | **2.105.4** (latest) |

**Injetar `org_id` e `app_role` no JWT via Custom Access Token Hook:**

```sql
-- PT-BR: hook Supabase Auth que roda antes de cada emissao de token
-- registrar no dashboard: Authentication > Hooks > Custom Access Token
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  v_org_id uuid;
  v_role text;
  v_permissions text[];
begin
  claims := event->'claims';

  -- PT-BR: busca org ativa e role do membro autenticado
  select m.org_id, m.role, array_agg(p.code)
    into v_org_id, v_role, v_permissions
    from public.org_members m
    left join public.role_permissions rp on rp.role = m.role
    left join public.permissions p on p.id = rp.permission_id
   where m.user_id = (event->>'user_id')::uuid
     and m.is_active = true
     and (
       -- PT-BR: org ativa: preferencialmente a do app_metadata, senao a mais antiga
       m.org_id = (claims->'app_metadata'->>'active_org_id')::uuid
       or not exists (
         select 1 from public.org_members m2
          where m2.user_id = m.user_id
            and m2.org_id = (claims->'app_metadata'->>'active_org_id')::uuid
       )
     )
   group by m.org_id, m.role
   limit 1;

  if v_org_id is not null then
    claims := jsonb_set(claims, '{org_id}', to_jsonb(v_org_id::text));
    claims := jsonb_set(claims, '{app_role}', to_jsonb(v_role));
    claims := jsonb_set(claims, '{permissions}', to_jsonb(v_permissions));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- PT-BR: grants obrigatorios para o hook funcionar
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

**Helper function de RLS (sem query extra por request):**

```sql
-- PT-BR: extrair org_id do JWT — O(1), sem roundtrip ao DB
create or replace function auth.org_id() returns uuid
  language sql stable
  security definer
  set search_path = ''
  as $$
    select (auth.jwt()->>'org_id')::uuid
  $$;

create or replace function auth.app_role() returns text
  language sql stable
  security definer
  set search_path = ''
  as $$
    select auth.jwt()->>'app_role'
  $$;

-- Exemplo de policy usando os helpers:
create policy "members_select_own_org"
  on public.leads for select to authenticated
  using (org_id = (select auth.org_id()));
```

**Limitacao critica:** O JWT aumenta em tamanho a cada claim adicionado. Para usuarios com
multiplas orgs, nao colocar todos os `org_id` em array no token. Padrao canonico: um `org_id`
ativo por sessao. Org switcher muda via re-auth (ver secao 2a).

**Vite SPA:** Usa `createClient` de `@supabase/supabase-js` com listener `onAuthStateChange`.
Sessao armazenada em `localStorage` (padrao Supabase para SPAs).

---

## 2a. Org Switcher — padrao de troca de org ativa

**Problema:** JWT tem `org_id` fixo ate expirar (~1h). Trocar de org requer novo token.

**Solucao canonica:** Edge Function (service_role) que chama `admin.updateUserById` atualizando
`app_metadata.active_org_id` e em seguida retorna novo token via `refreshSession`.

```ts
// PT-BR: Edge Function para trocar org ativa — usa service_role (nunca expor no client)
// supabase/functions/switch-org/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { newOrgId } = await req.json()
  const authHeader = req.headers.get('Authorization')!
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // PT-BR: verifica se usuario e membro da org alvo
  const { data: membership } = await userClient
    .from('org_members')
    .select('role')
    .eq('org_id', newOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!membership) return new Response('Forbidden', { status: 403 })

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: { active_org_id: newOrgId }
  })
  // PT-BR: forcaa refresh do token no client (re-trigger hook de custom claims)
  return new Response(JSON.stringify({ ok: true }))
})
```

**Anti-pattern:** Nao guardar `active_org_id` apenas no estado React — perde ao refresh de
pagina. Deve refletir no JWT via `app_metadata` (persistido no Supabase Auth).

---

## 3. Webhook handling — Evolution Go / WhatsApp

### Decisao canonica: Node.js `crypto` built-in — sem lib externa

Evolution Go usa `GLOBAL_API_KEY` como autenticacao de API e segue o padrao de webhooks da Meta
(WhatsApp Business API): header `X-Hub-Signature-256: sha256=<hmac>`.

**Nao adicionar nenhuma lib externa para HMAC.** Node.js `crypto` / Deno `SubtleCrypto` sao
suficientes e sao o padrao da industria (GitHub, Stripe, Meta usam o mesmo approach).

**Padrao canonico — Supabase Edge Function (Deno):**

```ts
// PT-BR: valida assinatura HMAC-SHA256 do webhook Meta/WhatsApp / Evolution Go
// CRITICO: verificar ANTES de qualquer parse de JSON — usar raw bytes
async function validateWebhookSignature(
  rawBody: ArrayBuffer,
  signatureHeader: string,  // valor de X-Hub-Signature-256
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const computed = await crypto.subtle.sign('HMAC', key, rawBody)
  const hexComputed = 'sha256=' + Array.from(new Uint8Array(computed))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  // PT-BR: timing-safe comparison — crypto.subtle nao expoe timingSafeEqual diretamente
  // usar length check + XOR para evitar timing attack
  if (hexComputed.length !== signatureHeader.length) return false
  let diff = 0
  for (let i = 0; i < hexComputed.length; i++) {
    diff |= hexComputed.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(async (req) => {
  const rawBody = await req.arrayBuffer()  // PT-BR: raw antes de parse
  const sig = req.headers.get('x-hub-signature-256') ?? ''
  const valid = await validateWebhookSignature(rawBody, sig, Deno.env.get('WEBHOOK_SECRET')!)
  if (!valid) return new Response('Invalid signature', { status: 401 })

  const payload = JSON.parse(new TextDecoder().decode(rawBody))
  // PT-BR: processar async para responder rapido
  EdgeRuntime.waitUntil(processWebhook(payload))
  return new Response('', { status: 202 })
})
```

**Idempotencia — padrao Stripe aplicado:**

```sql
-- PT-BR: tabela de deduplicacao de webhooks (idempotency keys)
-- event_id: valor do campo id do payload Evolution Go ou X-Event-Id header
create table public.webhook_events (
  event_id text primary key,
  org_id uuid,                           -- se o webhook e org-scoped
  source text not null,                  -- 'evolution_go' | 'meta_whatsapp' | 'stripe'
  received_at timestamptz default now(),
  processed_at timestamptz,
  status text default 'pending',         -- pending | processed | failed
  payload jsonb
);
-- PT-BR: index para limpeza de retencao
create index webhook_events_age_idx on public.webhook_events (received_at);
-- PT-BR: limpar eventos com mais de 7 dias (pg_cron)
-- select cron.schedule('clean-webhooks', '0 3 * * *',
--   $$delete from public.webhook_events where received_at < now() - interval '7 days'$$);
```

**Anti-pattern:** Nao usar `===` string comparison para HMAC — timing attack. Usar XOR loop
(Deno) ou `timingSafeEqual` (Node.js).

**Retry handling:** Aceitar `202 Accepted` imediato, processar async via `EdgeRuntime.waitUntil`
ou pgmq queue. Nunca processar sincronamente dentro do timeout de webhook.

---

## 4. Invite token generation

### Decisao canonica: `crypto.randomBytes(32).toString('hex')` — token opaco, sem JWT

**Racional:** Tokens de invite sao single-use e armazenados em DB com expiracao. JWT seria
overengineering — adiciona complexidade de assinatura para algo que o DB ja controla por primary
key + expiracao. Alem disso, JWTs tem superficie de ataque conhecida (alg: none, key confusion
CVE-2015-9235) desnecessaria para este caso de uso.

**Padrao canonico:**

```ts
// Node.js (Edge Function Deno)
import { randomBytes } from 'node:crypto'          // Node.js
// Deno nativo (sem imports):
const bytes = new Uint8Array(32)
crypto.getRandomValues(bytes)                       // 256 bits de entropia
const token = Array.from(bytes)
  .map(b => b.toString(16).padStart(2, '0')).join('')  // 64 chars hex
```

**Schema canonico:**

```sql
-- PT-BR: tabela de invites com token opaco
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,          -- randomBytes(32).toString('hex') — 256 bits
  org_id uuid not null references public.orgs(id) on delete cascade,
  invited_email text not null,
  role text not null,                  -- role pre-definido (admin | member | viewer)
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  declined_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- PT-BR: indices para lookup rapido e limpeza
create index org_invites_token_idx on public.org_invites (token);
create index org_invites_expire_idx
  on public.org_invites (expires_at)
  where accepted_at is null and declined_at is null;

-- PT-BR: RLS — apenas membros admin da org veem invites pendentes
alter table public.org_invites enable row level security;
create policy "admin_select_org_invites"
  on public.org_invites for select to authenticated
  using (
    org_id = (select auth.org_id())
    and (select auth.app_role()) in ('admin', 'owner')
  );
```

**Por que nao magic-link Supabase para invite:** Magic links sao para autenticacao (login), nao
para invite de membro. Para invite, voce precisa de role pre-definido, expiracao customizada, e
possibilidade de aceitar sem criar conta imediatamente. Token opaco + accept flow proprio e mais
flexivel.

**Por que nao JWT para invite:** O token de invite NAO precisa de payload verificavel pelo client
offline. Qualquer dado necessario (role, org_id) esta no DB atrelado ao token. JWT adiciona
superficie de ataque sem beneficio neste cenario.

---

## 5. Audit log — multi-tenant

### Decisao canonica: Custom trigger em Postgres com `org_id` explicito

**Opcoes avaliadas:**

| Opcao | Recomendacao | Motivo |
|-------|-------------|--------|
| Custom triggers + tabela `audit_log` | **USAR** | Schema com `org_id`, RLS, controle de retencao |
| `supa_audit` extension | Nao usar sem customizacao | Schema sem `org_id` — dados de tenants misturados |
| `pgaudit` extension | Nao usar para app-level | Statement-level apenas, grava em arquivo de log (nao tabela), inacessivel via SQL |
| OpenTelemetry spans para audit | Nao usar como SSOT | Semconv audit nao estabilizada em 2026 (issue #2468 aberta); spans expiram antes de prazo LGPD |

**Schema canonico:**

```sql
-- PT-BR: tabela de audit log multi-tenant com isolamento por org_id
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null,               -- isolamento multi-tenant (NUNCA NULL)
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,                     -- pk da linha afetada (cast to text)
  user_id uuid,                       -- auth.uid() no momento — pode ser null (service_role)
  old_data jsonb,                     -- estado antes (null para INSERT)
  new_data jsonb,                     -- estado depois (null para DELETE)
  changed_at timestamptz default now() not null
);

-- PT-BR: indices para queries comuns por tenant
create index audit_log_org_time_idx on public.audit_log (org_id, changed_at desc);
create index audit_log_table_idx on public.audit_log (org_id, table_name, changed_at desc);
create index audit_log_record_idx on public.audit_log (org_id, record_id) where record_id is not null;

-- PT-BR: RLS — cada tenant ve apenas seu proprio audit log
alter table public.audit_log enable row level security;

create policy "audit_select_own_org"
  on public.audit_log for select to authenticated
  using (org_id = (select auth.org_id()));
```

**Trigger canonico (reutilizavel em qualquer tabela que tenha `org_id`):**

```sql
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log
    (org_id, table_name, operation, record_id, user_id, old_data, new_data)
  values (
    coalesce(new.org_id, old.org_id),          -- funciona para UPDATE e DELETE
    tg_table_name,
    tg_op,
    coalesce(new.id::text, old.id::text),       -- assume PK = id (adaptar se diferente)
    (select auth.uid()),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- PT-BR: aplicar em tabelas criticas (leads, membros, pagamentos, etc.)
create trigger audit_leads
  after insert or update or delete on public.leads
  for each row execute function public.audit_trigger_fn();
```

**Retencao com pg_cron:**

```sql
-- PT-BR: limpeza semanal — configuravel por org via tabela de config
select cron.schedule(
  'audit-log-retention',
  '0 3 * * 0',  -- domingo 3am UTC
  $$
    delete from public.audit_log
     where changed_at < now() - interval '90 days'
  $$
);
```

**Performance warning (do Supabase oficial):** Triggers de audit reduzem throughput de escrita.
Nao recomendado em tabelas com pico de escrita > 3k ops/s. Para high-write tables, usar abordagem
assincrona: trigger insere em pgmq queue, Edge Function consome e grava em `audit_log`.

---

## 6. CRM state machine

### Decisao canonica: XState v5 (client-side) + CHECK constraint / trigger Postgres (server-side)

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Client-side orchestration | `xstate` | **5.24.0** |
| React hooks | `@xstate/react` | **6.1.0** |
| Server-side validation | Postgres `CHECK` constraint + trigger | built-in |

**XState v5 padrao para lead pipeline:**

```ts
import { createMachine } from 'xstate'

// PT-BR: state machine de lead — apenas transicoes validas sao permitidas
export const leadMachine = createMachine({
  id: 'lead',
  initial: 'new',
  states: {
    new: {
      on: {
        QUALIFY: 'qualified',
        DISCARD: 'lost',
      },
    },
    qualified: {
      on: {
        PROPOSE: 'proposal',
        DISCARD: 'lost',
      },
    },
    proposal: {
      on: {
        NEGOTIATE: 'negotiation',
        DISCARD: 'lost',
      },
    },
    negotiation: {
      on: {
        WIN: 'won',
        LOSE: 'lost',
      },
    },
    won: { type: 'final' },
    lost: { type: 'final' },
  },
})
```

**Validacao server-side (independente do client):**

```sql
-- PT-BR: tipo enum para status de lead
create type lead_status as enum ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost');

-- PT-BR: trigger para validar transicoes de estado no servidor (mirror do XState machine)
create or replace function public.validate_lead_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then return new; end if;  -- sem mudanca
  if not (
    (old.status = 'new'         and new.status in ('qualified', 'lost'))     or
    (old.status = 'qualified'   and new.status in ('proposal', 'lost'))      or
    (old.status = 'proposal'    and new.status in ('negotiation', 'lost'))   or
    (old.status = 'negotiation' and new.status in ('won', 'lost'))
  ) then
    raise exception 'transicao de lead invalida: % → %', old.status, new.status
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger validate_lead_status_transition
  before update of status on public.leads
  for each row execute function public.validate_lead_transition();
```

**Quando usar Zustand em vez de XState para CRM:** XState e ideal quando ha fluxo complexo
(guards, parallel states, delayed transitions). Para pipelines simples (<5 estados, sem guards),
Zustand e suficiente e menor em bundle. Usar XState quando ha WhatsApp conversation state machine
— conversacoes tem estados paralelos (ativo, aguardando, encerrado, bot vs humano).

**Bundle consideration:** `xstate` 5.x = 2.09 MB unpacked (minificado/gzipped muito menor).
Importar apenas o que usar com tree-shaking.

---

## 7. React state management para multi-tenant

### Decisao canonica: Zustand v5 para org context global

| Lib | Versao | Bundle (min+gzip) | Recomendacao |
|-----|--------|-------------------|-------------|
| `zustand` | **5.0.10** | ~1 KB | **Canonica** — org/tenant context global |
| `jotai` | **2.20.0** | ~4 KB | Complementar — estado granular derivado |
| Context API | built-in | 0 KB | Apenas para dados estaticos que nao re-renderizam |

**Zustand v5 para org context (com persist):**

```ts
// PT-BR: store de org ativa — persiste entre refreshes de pagina
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OrgStore {
  activeOrgId: string | null
  activeRole: string | null
  orgs: Array<{ id: string; name: string; role: string }>
  switchOrg: (orgId: string) => Promise<void>
  setOrgs: (orgs: OrgStore['orgs']) => void
}

export const useOrgStore = create<OrgStore>()(
  persist(
    (set, get) => ({
      activeOrgId: null,
      activeRole: null,
      orgs: [],
      setOrgs: (orgs) => set({ orgs }),
      switchOrg: async (orgId) => {
        const org = get().orgs.find(o => o.id === orgId)
        if (!org) return
        // PT-BR: chama Edge Function switch-org que atualiza app_metadata + refresh do token
        await fetch('/functions/v1/switch-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newOrgId: orgId }),
        })
        // PT-BR: refresh do client para pegar novo JWT com org_id atualizado
        await supabase.auth.refreshSession()
        set({ activeOrgId: orgId, activeRole: org.role })
      },
    }),
    { name: 'org-store' }  // PT-BR: persiste em localStorage
  )
)
```

**Por que nao Context API para org context:** Context API causa re-render em todos os consumers
quando o valor muda. Para org context (lido em quase todos os componentes), isso gera re-renders
desnecessarios. Zustand tem subscriptions granulares — so re-renderiza quem usa o campo especifico.

**Por que nao Redux Toolkit:** Bundle ~15 KB vs ~1 KB Zustand. Redux Toolkit e indicado quando ha
time grande (>10 devs) precisando de DevTools avancado e time travel debugging.

**Jotai como complemento:** Usar para estado derivado do org context (ex: features habilitadas
para a org atual, permissoes calculadas). `atom(() => ...)` e ideal para derivacoes reativas sem
re-renderizar tudo.

---

## 8. shadcn/ui — componentes para member management

### Decisao canonica: shadcn/ui CLI (sem numero de versao semver — e copy-paste)

shadcn/ui nao e um pacote npm com versao — e uma CLI que copia componentes para o projeto.
A versao efetiva e determinada pelo TanStack Table e Radix primitives subjacentes.

**Stack base 2026 para projeto novo:**

```bash
# PT-BR: stack canonico para projeto B2B SaaS novo em 2026
npx create-next-app@latest --typescript --tailwind  # Next.js 15, React 19, Tailwind v4
npx shadcn@latest init
```

**Componentes shadcn especificos para member management:**

| Componente shadcn | Uso em multi-tenant |
|-------------------|---------------------|
| `data-table` | Lista de membros com sorting/filtering/pagination (TanStack Table v8) |
| `dialog` | Modal de invite, modal de confirmacao de remocao |
| `select` | Role selector (admin / member / viewer) |
| `badge` | Exibir role/status do membro (Active, Invited, Suspended) |
| `dropdown-menu` | Acoes por membro: editar role, remover, re-enviar invite |
| `avatar` | Avatar do membro (iniciais ou foto) |
| `command` | Org switcher com busca instantanea (`Command` + `Popover`) |
| `form` | Formulario de invite com `react-hook-form` + `zod` |
| `toast` | Feedback de acoes: invite enviado, erro de permissao, etc. |

**Dependencias implicitas instaladas com shadcn:**

- `@tanstack/react-table` v8 — engine do data-table (sorting, filtering, pagination, row selection)
- `react-hook-form` + `@hookform/resolvers` + `zod` — formularios com validacao
- `@radix-ui/*` — primitives acessiveis (Dialog, Select, DropdownMenu, Avatar, Command)

**Org switcher canonico com shadcn Command:**

```tsx
// PT-BR: org switcher — Command (busca) dentro de Popover
// Dispara useOrgStore.switchOrg ao selecionar uma org
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useOrgStore } from '@/stores/org-store'

export function OrgSwitcher() {
  const { orgs, activeOrgId, switchOrg } = useOrgStore()
  const activeOrg = orgs.find(o => o.id === activeOrgId)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2">
          {activeOrg?.name ?? 'Selecionar org'}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Command>
          <CommandInput placeholder="Buscar org..." />
          <CommandList>
            {orgs.map(org => (
              <CommandItem key={org.id} onSelect={() => switchOrg(org.id)}>
                {org.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

---

## 9. Connection pooling — Supabase + Vercel Edge

### Decisao canonica: Supavisor transaction mode (porta 6543) para Vercel/serverless

**Contexto 2026:** Supabase deprecou o Session Mode na porta 6543 em 2025-02-28.
Apos a mudanca:

- **Porta 6543:** apenas transaction mode (Supavisor)
- **Porta 5432:** session mode direto (nao pooled)

| Contexto de deploy | String de conexao | Modo |
|--------------------|--------------------|------|
| Vercel Functions (serverless) | `DATABASE_POOLER_URL` (porta 6543) | Transaction mode — obrigatorio |
| Supabase Edge Functions | Conexao via `supabase-js` (HTTP, nao SQL direto) | N/A |
| Long-running Node.js server | `DATABASE_URL` (porta 5432) | Session mode — OK |
| Prisma + Vercel | `DATABASE_URL` = porta 6543 + `?pgbouncer=true&connection_limit=1` | Transaction mode |
| Drizzle + Vercel | `DATABASE_URL` = porta 6543 | Transaction mode |

**Por que transaction mode para Vercel:** Serverless functions abrem nova conexao por invocacao.
Sem pool, com trafego moderado as conexoes Postgres se esgotam rapidamente (Free: 60 conn,
Pro: 200 conn). Transaction mode retorna a conexao ao pool assim que a query termina.

**Dedicated Pooler (PgBouncer):** Clientes Pro/Team podem provisionar PgBouncer dedicado
co-localizado com o DB para menor latencia. Prioritario para multi-tenant com alta concorrencia.

**Vercel + IPv6:** Vercel nao suporta IPv6 puro. Supavisor dual-stack resolve transparentemente.

**Multi-tenant e Supavisor:** Supavisor foi construido nativamente para multi-tenant
(Supabase cloud serve multiplos projetos). Per-tenant pool isolation e suportado.

---

## 10. LGPD tooling

### Decisao canonica: custom Postgres tables + pg_cron para automacao (sem lib externa de terceiro)

**Racional:** Nao existe biblioteca Node.js estabelecida para LGPD compliance de nivel enterprise
em 2026 que valha adicionar como dependencia. Os requisitos de LGPD sao implementados como
padroes de schema + automation + politicas operacionais.

**Schema canonico para LGPD:**

```sql
-- PT-BR: registro de consentimento por titular de dados (data subject)
-- base legal: art. 7 e 8 LGPD (Lei 13.709/2018)
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  subject_id uuid references auth.users(id),       -- null se pre-cadastro
  subject_email text,                               -- para titulares sem conta
  purpose text not null,                            -- 'crm_contact' | 'marketing' | 'whatsapp_messaging'
  legal_basis text not null,                        -- 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation'
  granted_at timestamptz default now(),
  revoked_at timestamptz,
  policy_version text not null,                     -- versao do texto de politica aceito
  ip_address inet,                                  -- evidencia de consentimento
  constraint valid_lgpd_basis check (
    legal_basis in ('consent', 'legitimate_interest', 'contract',
                    'legal_obligation', 'vital_interests', 'public_task', 'research')
  )
);

-- PT-BR: requisicoes de direitos do titular (DSR — Data Subject Request)
-- prazo LGPD: 15 dias para resposta (art. 19)
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  subject_email text not null,
  subject_name text,
  request_type text not null check (
    request_type in ('access', 'rectification', 'deletion', 'portability',
                     'restriction', 'objection', 'withdraw_consent')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'completed', 'rejected')
  ),
  requested_at timestamptz default now(),
  deadline_at timestamptz generated always as
    (requested_at + interval '15 days') stored,    -- prazo legal LGPD
  completed_at timestamptz,
  rejection_reason text,
  response_data jsonb                              -- para portabilidade: JSON do export
);

create index dsr_deadline_idx on public.data_subject_requests (deadline_at)
  where status in ('pending', 'in_progress');
create index dsr_org_idx on public.data_subject_requests (org_id, requested_at desc);
```

**Automacao com pg_cron:**

```sql
-- PT-BR: alerta diario para DSRs proximos do prazo (15 dias LGPD)
select cron.schedule(
  'lgpd-dsr-deadline-alert',
  '0 8 * * *',  -- 8am UTC diario
  $$
    insert into public.platform_notifications (type, org_id, payload)
    select 'dsr_deadline_warning', org_id,
           jsonb_build_object('request_id', id, 'deadline', deadline_at, 'type', request_type)
      from public.data_subject_requests
     where status in ('pending', 'in_progress')
       and deadline_at < now() + interval '3 days'
  $$
);

-- PT-BR: retencao automatica — anonimizar dados de orgs encerradas apos 30 dias
select cron.schedule(
  'lgpd-data-retention',
  '0 2 * * 0',  -- domingo 2am UTC
  $$
    update public.leads
       set email = 'anonimizado@lgpd.invalid',
           phone = null,
           name = 'Anonimizado LGPD'
     where org_id in (
       select id from public.orgs
        where deleted_at is not null
          and deleted_at < now() - interval '30 days'
     )
  $$
);
```

**Por que nao Vanta/Drata SDKs para LGPD:** Sao plataformas de compliance enterprise
(SOC 2, ISO 27001) focadas em coleta de evidencias e auditorias — nao em implementar
data subject rights programaticamente. Relevantes para SaaS que precisa de certificacoes
enterprise, mas nao substituem o schema acima.

**Por que nao pgaudit para LGPD:** pgaudit grava em arquivo de log (nao em tabela), sem `org_id`
canonico, sem retencao controlavel por tenant. Custom triggers em tabela de `audit_log` (secao 5)
sao superiores para LGPD porque: sao queryaveis por SQL, tem `org_id` explicito, e a retencao
e configuravel por tenant.

**Notificacao de violacao (72h LGPD, art. 48):** Implementar via alert em `audit_log` + webhook
para canal de seguranca (Slack/email). Nao ha lib especifica — e um runbook operacional.

---

## Stack Recomendado — Tabela consolidada

### Tecnologias Core

| Tecnologia | Versao 2026 | Proposito no multi-tenant |
|------------|------------|--------------------------|
| `@supabase/ssr` | **0.10.2** | Auth SSR (Next.js v15+ App Router) |
| `@supabase/supabase-js` | **2.105.4** | Auth SPA (Vite), client universal |
| `@casl/ability` | **6.8.0** | RBAC client-side (check can/cannot por resource) |
| `@casl/react` | **4.x** | `<Can>` component + `useAbility` hook |
| `zustand` | **5.0.10** | Org context global (org switcher state) |
| `xstate` | **5.24.0** | State machine para WhatsApp conversation + CRM lead pipeline |
| `@xstate/react` | **6.1.0** | Hooks React para XState v5 |
| Node.js `crypto` (built-in) | Node.js built-in | HMAC webhook validation + token invite |
| Supavisor (porta 6543) | gerenciado Supabase | Connection pooling para Vercel/serverless |

### Bibliotecas de Suporte

| Biblioteca | Versao | Proposito | Quando Usar |
|------------|--------|-----------|-------------|
| `jotai` | **2.20.0** | Atoms derivados do org context | Estado granular reativo derivado do org store |
| `@tanstack/react-table` | v8 (via shadcn) | Data table membros | Toda UI de listagem com sorting/filter/pagination |
| `react-hook-form` + `zod` | atuais (via shadcn) | Formulario invite + validacao | Formularios de onboarding e invite flow |
| `shadcn/ui` (CLI) | latest (copy-paste) | UI: data-table, dialog, command, badge | Member management UI completa |

### Extensoes Postgres (habilitadas no Supabase)

| Extension | Proposito | Habilitada Por Default? |
|-----------|-----------|------------------------|
| `pg_cron` | Jobs de retention LGPD, alertas DSR, limpeza de webhooks | Nao — habilitar manualmente |
| `pgmq` | Fila async para webhook processing high-volume | Nao — habilitar manualmente |

### Padrao de Hook SQL

| Artefato | Proposito |
|----------|-----------|
| `custom_access_token_hook` | Injetar org_id + app_role + permissions no JWT |
| `audit_trigger_fn` | Audit log multi-tenant com org_id |
| `validate_lead_transition` | Validar state machine de CRM server-side |

---

## Instalacao

```bash
# PT-BR: auth + RBAC
npm install @supabase/ssr @supabase/supabase-js @casl/ability @casl/react

# PT-BR: state management
npm install zustand xstate @xstate/react

# PT-BR: shadcn (CLI — nao npm install direto)
npx shadcn@latest init
npx shadcn@latest add data-table dialog select badge dropdown-menu avatar command form toast

# PT-BR: dependencias implicitas (shadcn instala automaticamente):
# @tanstack/react-table react-hook-form @hookform/resolvers zod @radix-ui/*
```

---

## Alternativas Consideradas

| Recomendado | Alternativa | Quando usar a alternativa |
|-------------|------------|--------------------------|
| `@casl/ability` | Permify / Oso | Multiplos microsservicos precisando de policy store centralizado |
| `@casl/ability` | Casbin JS | Nunca para React — Casbin JS e para backend, sem React integration nativa |
| `zustand` | Context API | Dados estaticos que nao causam re-render em cascata (theme, locale) |
| `zustand` | Redux Toolkit | Times grandes (>10 devs) que precisam de DevTools avancado + time travel |
| `xstate` v5 | Zustand para state machine | Pipelines simples com <5 estados e sem guards/parallel states |
| Custom triggers (audit) | `supa_audit` extension | Se o schema nao precisa de `org_id` — generico sem tenant isolation |
| Custom triggers (audit) | `pgaudit` | Se o requisito e compliance de statement-level para DBA audit |
| Token opaco hex (invite) | `jsonwebtoken` lib | Para invite tokens que precisam ser verificaveis offline pelo client sem DB roundtrip |
| Supavisor porta 6543 | Direct connection porta 5432 | Apenas para long-running Node.js servers com conexoes persistentes |
| pg_cron + schema custom (LGPD) | Vanta/Drata SDK | Plataformas de evidencias enterprise (SOC 2, ISO 27001) |

---

## O Que NAO Usar

| Evitar | Por Que | Usar Em Vez Disso |
|--------|---------|-------------------|
| `@supabase/auth-helpers-nextjs` | DEPRECATED — quebra em Next.js v14+, sem updates de seguranca | `@supabase/ssr` v0.10.x |
| Casbin JS no frontend React | Bundle pesado, sem React integration, design para backend | `@casl/ability` + `@casl/react` |
| `user_metadata` em RLS para role | Editavel pelo client via `auth.updateUser()` — privilege escalation trivial | `app_metadata` (somente service_role pode mutar) |
| `Math.random()` para tokens | Nao criptograficamente seguro — previsivel com poucos tokens observados | `crypto.randomBytes(32)` / `crypto.getRandomValues()` |
| JWT para invite tokens | Surface de ataque (alg: none, key confusion CVE-2015-9235) sem beneficio | Token opaco hex + tabela `org_invites` |
| `pgaudit` para app-level audit | Grava em arquivo de log, sem `org_id`, sem retencao por tenant | Custom triggers em `audit_log` com `org_id` |
| `supa_audit` sem customizacao | Schema sem `org_id` — dados de multiplos tenants misturados | Custom triggers com `org_id` explicito |
| Vanta/Drata SDK para implementar LGPD | Sao plataformas de evidencias, nao implementacoes de data subject rights | Custom schema Postgres + pg_cron |
| Redux Toolkit | Bundle ~15 KB vs ~1 KB Zustand para mesma funcionalidade em SaaS mid-size | Zustand v5 |
| Session mode Supavisor porta 6543 | Deprecado 2025-02-28 — porta 6543 e agora apenas transaction mode | Transaction mode porta 6543 (serverless) / porta 5432 (session) |
| OpenTelemetry spans como SSOT de audit | Semconv audit nao estabilizada (issue #2468 aberta); spans expiram antes do prazo LGPD | Custom triggers em `audit_log` |

---

## Variantes de Stack por Condicao

**Se Next.js App Router (v15+):**
- Usar `@supabase/ssr` v0.10.x com `createServerClient` + `createBrowserClient`
- Middleware obrigatorio para refresh de sessao
- `cookies: { getAll, setAll }` — nunca metodos individuais

**Se Vite SPA (sem SSR):**
- Usar `@supabase/supabase-js` v2.105.4 diretamente
- `onAuthStateChange` para reagir a troca de org
- `localStorage` para persistencia de sessao (padrao Supabase)
- Zustand `persist` middleware para org context entre refreshes de pagina

**Se usuario tem multiplas orgs:**
- Org switcher via Edge Function que chama `admin.updateUserById` e `refreshSession`
- Zustand `persist` para manter `active_org_id` entre navegacoes
- NUNCA colocar todos os `org_id` do usuario no JWT — apenas o ativo

**Se write throughput em tabela auditada > 1k ops/s:**
- Desabilitar trigger sincrono na tabela
- Usar pgmq queue: trigger insere mensagem → Edge Function consome async → grava em `audit_log`

**Se app precisa de compliance SOC 2 alem de LGPD:**
- Avaliar Vanta/Drata para coleta de evidencias (nao para implementacao de schema)
- Custom audit log (secao 5) alimenta as evidencias que Vanta/Drata coletam

**Se CRM pipeline tem <5 estados e sem logica condicional:**
- Usar Zustand simples com campo `status: LeadStatus`
- XState so justifica quando ha guards, parallel states, ou delayed transitions

---

## Compatibilidade de Versoes

| Pacote | Compativel Com | Notas |
|--------|---------------|-------|
| `@supabase/ssr` 0.10.x | Next.js 14, 15 / Node.js >= 18 | Nao compativel com `@supabase/auth-helpers-nextjs` (conflito de cookies) |
| `zustand` 5.x | React 18, 19 / TypeScript >= 4.5 | Requer `useSyncExternalStore` — nao compativel com React < 18 |
| `@casl/ability` 6.x | Qualquer framework JS | Isomorfico — mesma versao no browser e no Node.js |
| `xstate` 5.x | React 18, 19 (via `@xstate/react` 6.x) | v4 e v5 tem API incompativel — nao misturar |
| `shadcn/ui` (2026) | Next.js 15 + React 19 + Tailwind v4 | Para projetos React 18 + Tailwind v3, shadcn ainda funciona (backward compat) |
| Supavisor transaction mode | `@supabase/supabase-js` (HTTP) / Prisma / Drizzle | Prisma requer `?pgbouncer=true&connection_limit=1` na connection string |
| `jotai` 2.x | React 18, 19 | Compativel com `use` hook do React 19 |

---

## Fontes

- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — padrao JWT custom claims + org_id
- [Supabase Custom Claims RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — hook SQL + RLS com claims
- [Supabase Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — Supavisor transaction vs session mode
- [Supabase supa_audit GitHub](https://github.com/supabase/supa_audit) — extensao audit sem multi-tenant nativo
- [Supabase pgAudit Docs](https://supabase.com/docs/guides/database/extensions/pgaudit) — statement-level, arquivo de log
- [Supabase Postgres Audit blog](https://supabase.com/blog/postgres-audit) — custom trigger em 150 linhas
- [pganalyze: pgAudit vs supa_audit](https://pganalyze.com/blog/5mins-postgres-auditing-pgaudit-supabase-supa-audit) — comparacao de abordagens
- [CASL v6 docs](https://casl.js.org/v6/en/guide/install/) — isomorphic RBAC
- [@casl/ability npm](https://www.npmjs.com/package/@casl/ability) — v6.8.0 verificado
- [@casl/react npm](https://www.npmjs.com/package/@casl/react) — v4.x, React hooks + Can component
- [Permit.io: CASL for React](https://www.permit.io/blog/how-to-use-casl-for-implementing-authorization-in-react) — integracao React com CASL
- [zustand npm](https://www.npmjs.com/package/zustand) — v5.0.10 verificado
- [zustand v5 announcement](https://pmnd.rs/blog/announcing-zustand-v5/) — React 18+ only, mudancas v5
- [jotai npm](https://www.npmjs.com/package/jotai) — v2.20.0 (publicado 2026-05-09)
- [xstate npm](https://www.npmjs.com/package/xstate) — v5.24.0
- [@xstate/react npm](https://www.npmjs.com/package/@xstate/react) — v6.1.0
- [@supabase/ssr npm](https://www.npmjs.com/package/@supabase/ssr) — v0.10.2 (latest)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — Next.js 15 + React 19 + Tailwind v4
- [shadcn/ui data-table](https://ui.shadcn.com/docs/components/radix/data-table) — TanStack Table v8 integration
- [HMAC webhook guide](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) — SHA256 + timing-safe
- [Webhook security patterns](https://didit.me/blog/webhook-security-patterns/) — idempotency keys + 7-day retention
- [Evolution Go GitHub](https://github.com/evolution-foundation/evolution-go) — GLOBAL_API_KEY auth, WEBHOOK_URL config
- [WhatsApp webhook guide](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices) — X-Hub-Signature-256
- [OTel audit log proposal (issue #2468)](https://github.com/open-telemetry/semantic-conventions/issues/2468) — convencao nao estabilizada em 2026
- [LGPD compliance guide 2026](https://captaincompliance.com/education/lgpd-compliance-checklist/) — 15 dias DSR, 72h breach notification
- [State management 2026 comparison](https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge) — Zustand canonico 2026
- [React state Zustand vs Jotai 2026](https://www.salmanizhar.com/blog/modern-state-management-comparison) — benchmark e recomendacoes
- [Production Postgres Pooling 2026](https://nerdleveltech.com/production-postgres-pooling-pgbouncer-supabase-supavisor-tutorial) — Supavisor + pgBouncer

---

*Pesquisa de stack para: Suite Multi-Tenant SaaS B2B — kit-mcp v1.21*
*Pesquisado: 2026-05-10*
