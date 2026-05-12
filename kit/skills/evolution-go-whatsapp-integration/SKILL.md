---
name: evolution-go-whatsapp-integration
description: Use ao integrar Evolution Go (whatsmeow) ou Meta Cloud API com Supabase B2B multi-tenant…
---

# Evolution Go + WhatsApp — Integração Multi-Tenant Supabase

## Quando usar

LLM carrega esta skill ao integrar WhatsApp em B2B SaaS multi-tenant. Trigger phrases:

- "Evolution Go integration", "evolution-api whatsmeow"
- "WhatsApp Cloud API Meta", "WhatsApp Business API"
- "webhook signature HMAC SHA256"
- "tenant identification webhook"
- "whatsapp idempotency message_id"
- "rate limit Meta 80 msg/s", "Evolution Go throttle"

## Regras absolutas

**REGRA #1 (HMAC validation antes de JSON.parse — Meta):** Meta envia `X-Hub-Signature-256: sha256=<hmac>` header. Validar HMAC sobre **raw body** **ANTES** de parse JSON. Middleware que parseia primeiro = signature inválida (body mutado).

**REGRA #2 (timing-safe comparison):** HMAC validation usa `crypto.timingSafeEqual` (Node) ou `crypto.subtle.timingSafeEqual` (Deno). Comparação `===` direta = timing attack — atacante deduz HMAC byte-a-byte por timing.

**REGRA #3 (tenant identification):** Webhook URL contém `org_id`: `/functions/v1/whatsapp/{org_id}/webhook`. Edge Function valida UUID format ANTES de qualquer processamento. Para Evolution Go, alternativa é `instance_name` no payload → lookup `org_id` em tabela `org_whatsapp_configs`.

**REGRA #4 (idempotência via unique constraint):** Tabela `whatsapp_messages` tem `unique(org_id, message_id)`. INSERT usa `ON CONFLICT DO NOTHING`. Meta entrega at-least-once com retry 7 dias — duplicatas SÃO normais, não excessões.

**REGRA #5 (rate limit Meta — 80 msg/s):** Meta Cloud API: 80 msg/s default por número. Erro 131056 quando exceder, escala para 24h ban se persistir. Throttle server-side via `pgmq` queue ou rate limiter Edge.

**REGRA #6 (throttle Evolution Go — 1 msg/s):** Evolution Go usa whatsmeow (protocolo WhatsApp Web não-oficial). WhatsApp Web bane número se enviar massivamente. Default conservador: 1 msg/s manual no app code (biblioteca não enforce).

**REGRA #7 (HMAC secret per-org):** Cada org tem `hmac_secret` próprio (gerado no setup, armazenado em `org_whatsapp_configs`). Vazamento de secret de uma org não compromete outras.

## Patterns canônicos

### Tabela `org_whatsapp_configs`

```sql
create table public.org_whatsapp_configs (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('meta_cloud', 'evolution_go')),
  phone_number_id text,                  -- Meta Cloud API phone_number_id
  evolution_instance_name text,          -- Evolution Go instance name (alternative)
  hmac_secret text,                       -- per-org webhook HMAC (Meta) — REGRA #7
  api_key_vault_ref text,                -- Vault secret reference (não armazenar key direto)
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.org_whatsapp_configs enable row level security;

-- RLS: members com permission update:org_settings
create policy "org_whatsapp_configs_select" on public.org_whatsapp_configs
  for select to authenticated
  using (private.is_member_of(org_id));

create policy "org_whatsapp_configs_update" on public.org_whatsapp_configs
  for update to authenticated
  using (private.has_permission('update', 'org_settings', org_id))
  with check (private.has_permission('update', 'org_settings', org_id));
```

### Tabela `whatsapp_messages` — idempotency built-in

```sql
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  message_id text not null,              -- ID do WhatsApp (provider)
  direction text not null check (direction in ('inbound', 'outbound')),
  contact_phone text not null,
  contact_name text,
  content text,
  message_type text check (message_type in ('text', 'image', 'audio', 'document', 'location', 'contact', 'reaction')),
  payload jsonb,                          -- raw payload do provider
  status text default 'received' check (status in ('received', 'sent', 'delivered', 'read', 'failed')),
  conversation_id uuid,                   -- FK para conversations (state machine)
  received_at timestamptz not null default now(),
  unique (org_id, message_id)            -- REGRA #4: idempotency
);

create index whatsapp_messages_org_phone_idx on public.whatsapp_messages (org_id, contact_phone, received_at desc);
create index whatsapp_messages_conversation_idx on public.whatsapp_messages (conversation_id) where conversation_id is not null;

alter table public.whatsapp_messages enable row level security;
-- RLS standard multi-tenant (members lê todas, super_admin bypass)
```

### Webhook handler — Edge Function (Meta Cloud)

```typescript
// supabase/functions/whatsapp-webhook/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeHex } from 'jsr:@std/encoding@1/hex'

// REGRA #2: timing-safe comparison nativo Deno
async function verifyHmac(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const computedSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = encodeHex(new Uint8Array(computedSig))

  // Timing-safe comparison
  if (signature.length !== expected.length) return false
  let result = 0
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return result === 0
}

Deno.serve(async (req) => {
  // REGRA #3: extract org_id from URL path
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const orgId = pathParts[pathParts.length - 2]  // /whatsapp/<org_id>/webhook
  if (!orgId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
    return new Response('invalid_org_id', { status: 400 })
  }

  // REGRA #1: read raw body BEFORE parse
  const rawBody = await req.text()

  // service_role para acessar org_whatsapp_configs (webhook não tem JWT user)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Buscar HMAC secret da org
  const { data: config } = await admin
    .from('org_whatsapp_configs')
    .select('hmac_secret, provider, enabled')
    .eq('org_id', orgId)
    .single()

  if (!config || !config.enabled) {
    return new Response('config_not_found_or_disabled', { status: 404 })
  }

  // Validar HMAC (Meta) — REGRA #1 + #2
  if (config.provider === 'meta_cloud') {
    const sigHeader = req.headers.get('x-hub-signature-256') || ''
    const sig = sigHeader.replace('sha256=', '')
    if (!await verifyHmac(rawBody, sig, config.hmac_secret)) {
      return new Response('invalid_signature', { status: 403 })
    }
  } else if (config.provider === 'evolution_go') {
    // Evolution Go usa API key + IP whitelist (HMAC não documentada)
    const apiKey = req.headers.get('apikey')
    if (apiKey !== Deno.env.get('EVOLUTION_GO_API_KEY')) {
      return new Response('invalid_api_key', { status: 403 })
    }
    // Optional: validar IP origem em allowlist
  }

  // Agora parse JSON (signature já validada)
  const payload = JSON.parse(rawBody)

  // Extrair message do payload (formato varia por provider)
  const messages = config.provider === 'meta_cloud'
    ? payload.entry?.[0]?.changes?.[0]?.value?.messages || []
    : payload.data?.messages || [payload.data]

  // REGRA #4: idempotent insert
  for (const msg of messages) {
    const { error } = await admin.from('whatsapp_messages').insert({
      org_id: orgId,
      message_id: msg.id,
      direction: 'inbound',
      contact_phone: msg.from,
      contact_name: msg.profile?.name,
      content: msg.text?.body || null,
      message_type: msg.type,
      payload: msg
    })
    // ON CONFLICT (org_id, message_id) DO NOTHING — duplicate ignored silently
    // (Postgres returns 0 rows affected, no error)
  }

  // Audit log inbound
  await admin.rpc('audit_log', {
    p_event_type: 'custom_whatsapp_webhook_received',
    p_tenant_id: orgId,
    p_payload: { message_count: messages.length, provider: config.provider }
  })

  // Meta espera 200 OK rapidamente (timeout 20s — processamento longo deve ser async)
  return new Response('ok', { status: 200 })
})
```

### Send message com rate limit (Meta Cloud)

```typescript
// supabase/functions/whatsapp-send/index.ts
// PT-BR: rate limiter via pgmq (queue + worker) para respeitar 80 msg/s Meta
// REGRA #5

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization')
  // ... validate JWT, extract org_id ...

  const { to, message } = await req.json()

  // Em vez de enviar direto, enfilera em pgmq (rate limit no consumer)
  await admin.rpc('pgmq_send', {
    queue_name: `whatsapp_outbound_${orgId.replace(/-/g, '_')}`,
    msg: { to, message, sent_by: caller.id, timestamp: new Date() }
  })

  return new Response(JSON.stringify({ queued: true }), { status: 202 })
})

// Worker separado (cron 1s) consome queue e chama Meta API respeitando 80 msg/s
// (Edge Function `whatsapp-send-worker` invocada por pg_cron a cada 1s)
```

### Lookup contact → lead (integração CRM)

```typescript
// Em handler webhook, após inserir whatsapp_messages, criar/lookup lead
const { data: existingLead } = await admin
  .from('leads')
  .select('id, owner_id')
  .eq('org_id', orgId)
  .eq('contact_phone', msg.from)
  .maybeSingle()

if (!existingLead) {
  // Auto-create lead (Phase 113)
  await admin.from('leads').insert({
    org_id: orgId,
    contact_phone: msg.from,
    contact_name: msg.profile?.name,
    stage: 'lead',
    source: 'whatsapp_inbound'
  })
}
```

## Anti-patterns

### Anti-pattern 1: HMAC validation depois de JSON.parse

**Errado:**
```typescript
const payload = await req.json()  // body já parsed e mutado
if (!verifyHmac(JSON.stringify(payload), sig, secret)) { ... }  // signature inválida!
```

**Por quê:** `JSON.stringify(JSON.parse(body))` não retorna bytes idênticos ao original (espaço, ordem keys, números). Hash diferente. Validação sempre falha (ou nunca falha, dependendo do bug).

**Certo:** `req.text()` para raw body, validar HMAC, depois `JSON.parse(rawBody)`.

### Anti-pattern 2: Comparação `===` em HMAC

**Errado:**
```typescript
if (computedSig === providedSig) { ... }
```

**Por quê:** comparação JS faz short-circuit no primeiro byte diferente. Atacante mede tempo de resposta, deduz HMAC byte-a-byte ao longo de horas.

**Certo:** REGRA #2 — `crypto.subtle.timingSafeEqual` ou loop XOR-only.

### Anti-pattern 3: Webhook sem idempotency

**Errado:**
```typescript
await admin.from('whatsapp_messages').insert({ ..., message_id: msg.id })
// Sem ON CONFLICT — segundo retry duplica
```

**Por quê:** Meta retry behavior at-least-once por 7 dias. Sem dedup, mesma mensagem entra N vezes na DB → CRM com leads duplicadas, contagens erradas, cobrança errada.

**Certo:** REGRA #4 — `unique(org_id, message_id)` + `ON CONFLICT DO NOTHING`.

### Anti-pattern 4: Send direto sem rate limit

**Errado:**
```typescript
// Loop enviando 1000 mensagens
for (const lead of leads) {
  await fetch('https://graph.facebook.com/.../messages', { body: ... })
}
// → 80 msg/s exceeded → erro 131056 → 24h ban do número
```

**Por quê:** Meta enforce rigoroso. Penalty é severa (24h sem usar o número = perda de cliente real ligando).

**Certo:** REGRA #5 — pgmq queue + worker com rate limit 80 msg/s. Para Evolution Go, REGRA #6 — 1 msg/s manual.

### Anti-pattern 5: HMAC secret compartilhado entre orgs

**Errado:**
```typescript
const secret = Deno.env.get('META_HMAC_SECRET')  // global, mesmo para todas orgs
```

**Por quê:** vazamento via uma org = comprometimento de todas. Compliance multi-tenant exige isolation.

**Certo:** REGRA #7 — `hmac_secret` em `org_whatsapp_configs` per-org. Generate no setup do Meta App per-org.

## Ver também

- [whatsapp-conversation-state-machine](../whatsapp-conversation-state-machine/SKILL.md) — Phase 112 sibling, modelagem de conversas
- [crm-lead-pipeline-patterns](../crm-lead-pipeline-patterns/SKILL.md) — Phase 113, lookup contact→lead
- [audit-log-multi-tenant](../audit-log-multi-tenant/SKILL.md) — Phase 109, eventos `custom_whatsapp_*`
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — pgmq queue + worker pattern para rate limit
- [supabase-edge-fn-writer](../../agents/supabase-edge-fn-writer.md) — agent que escreve Edge Functions
- [_shared-multi-tenant/glossary.md](../_shared-multi-tenant/glossary.md) — `Evolution Go`, `Meta Cloud API`, `HMAC-SHA256`, `idempotency key`, `rate limit Meta`
- [Meta Developers — WhatsApp Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/)
- [Meta Developers — Messaging Limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)
- [Evolution API Documentation](https://doc.evolution-api.com/v2/en/configuration/webhooks)
