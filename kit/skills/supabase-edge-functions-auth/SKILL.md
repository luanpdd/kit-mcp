---
name: supabase-edge-functions-auth
cost_tier: leve
description: Autentica Edge Functions Supabase 2026 com @supabase/server — withSupabase auth modes (user/secret/none), verify_jwt por função, Authorization JWT vs apikey, diagnóstico de 401.
---

# Supabase — Edge Functions Auth (`@supabase/server`) · 2026

## Quando usar

Carrega quando:

- "auth em Edge Function", "withSupabase", "createSupabaseContext"
- "verify_jwt true/false", "Authorization vs apikey", "401 edge function"
- "Stripe webhook auth", "service-to-service edge", "cron chamar edge function"
- "RBAC Edge Function", "user JWT no handler"

> Pré-requisito: [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) (Deno + env vars JSON dict).
> Complemento: [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md) (status codes 401/403).

## Conceito-chave: 2 headers, 2 camadas

| Header | Valor | Para |
|---|---|---|
| `Authorization` | `Bearer <user-jwt>` | Usuário logado via Supabase Auth |
| `apikey` | `sb_publishable_...` ou `sb_secret_...` | Cliente browser ou service-to-service |

**2 camadas de validação:**

1. **Platform-level (`verify_jwt`)** — plataforma valida JWT em `Authorization` antes do handler. Se header ausente/inválido → **401 não chega no código**.
2. **Handler-level** — você decide o que fazer com credencial recebida.

### Pegadinha canônica (#1 causa de 401)

Mandar API key (`sb_publishable_*` / `sb_secret_*`) como Bearer:

```
⚠ Authorization: Bearer sb_publishable_abc123     → 401 (não é JWT)
✓ Authorization: Bearer eyJhbGciOiJI...           → JWT válido
✓ apikey: sb_publishable_abc123                   → API key correta
```

API keys 2026 (`sb_*`) **não são JWTs** — a platform check não valida; seu handler não pode usar `auth.getUser()` nelas.

## Toggle `verify_jwt` por função

```toml
# supabase/config.toml
[functions.user-profile]
verify_jwt = true       # default — para funções chamadas com JWT do usuário

[functions.stripe-webhook]
verify_jwt = false      # webhook externo (Stripe assina o body — não envia JWT)

[functions.internal-cron]
verify_jwt = false      # chamada por cron com apikey: secret_key
```

Regra: deixe `true` quando o caller é browser logado (`supabase.functions.invoke`); desligue para webhooks externos ou service-to-service que autentica via `apikey`.

CLI local pode passar `--no-verify-jwt` para um deploy/serve único:

```bash
supabase functions serve hello-world --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

## `@supabase/server` — wrapper canônico 2026

Package npm que reduz boilerplate de auth + contexto Supabase pré-configurado.

### Auth modes

| Mode | Aceita | `ctx` recebido |
|---|---|---|
| `'user'` | JWT válido em `Authorization` | `ctx.supabase` scoped ao caller (respeita RLS), `ctx.userClaims` |
| `'secret:<name>'` | `sb_secret_<name>` em `apikey` | `ctx.supabaseAdmin` (bypassa RLS) |
| `'publishable:<name>'` | `sb_publishable_<name>` em `apikey` | `ctx.supabase` anon |
| `'none'` | Qualquer caller (sem check) | Cliente plain — handler responsabilidade total |

`<name>` referencia chaves nomeadas criadas em **Settings > API keys** (ex: `'secret:automations'`).

Combinar modos: `auth: ['user', 'secret:automations']` — primeiro match vence; `ctx.authMode` indica qual.

## Patterns canônicos

### Pattern 1 — User-facing (RLS aplicada)

```ts
// supabase/functions/notes/index.ts
import { withSupabase } from 'npm:@supabase/server@1'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    // ctx.supabase já vem scoped ao caller → RLS policies do user aplicadas
    const { data, error } = await ctx.supabase.from('notes').select('*')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ data, email: ctx.userClaims?.email })
  }),
}
```

```toml
[functions.notes]
verify_jwt = true
```

### Pattern 2 — Service-to-service (cron/pg_net/worker)

```ts
// supabase/functions/run-automations/index.ts
import { withSupabase } from 'npm:@supabase/server@1'

export default {
  fetch: withSupabase({ auth: 'secret:automations' }, async (req, ctx) => {
    // ctx.supabaseAdmin → bypassa RLS, scoped ao secret key 'automations'
    await ctx.supabaseAdmin.from('automation_log').insert({ ran_at: new Date() })
    return Response.json({ ok: true })
  }),
}
```

```toml
[functions.run-automations]
verify_jwt = false
```

Crie a chave nomeada no Dashboard → **Settings > API keys** com nome `automations`. Compartilhe `sb_secret_...` resultante apenas com o serviço chamador.

### Pattern 3 — Webhook externo (Stripe/GitHub/Resend)

```ts
// supabase/functions/stripe-webhook/index.ts
import { withSupabase } from 'npm:@supabase/server@1'
import Stripe from 'npm:stripe@17'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    const signature = req.headers.get('stripe-signature') ?? ''
    const body = await req.text()
    try {
      stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
    } catch {
      return new Response('bad signature', { status: 400 })
    }
    // ctx.supabaseAdmin disponível para DB writes
    await ctx.supabaseAdmin.from('stripe_events').insert({ raw: body })
    return Response.json({ received: true })
  }),
}
```

```toml
[functions.stripe-webhook]
verify_jwt = false
```

`auth: 'none'` desliga toda checagem de credencial Supabase. **Você é responsável por validar via signature do provedor.** Nunca use em endpoint sensível sem outro mecanismo.

### Pattern 4 — Função pública (health check)

```ts
// supabase/functions/health/index.ts
import { withSupabase } from 'npm:@supabase/server@1'

export default {
  fetch: withSupabase({ auth: 'none' }, async (_req, _ctx) => {
    return Response.json({ ok: true, region: Deno.env.get('SB_REGION') })
  }),
}
```

```toml
[functions.health]
verify_jwt = false
```

### Pattern 5 — Modo combinado (user + service)

```ts
// supabase/functions/dual/index.ts
import { withSupabase } from 'npm:@supabase/server@1'

export default {
  fetch: withSupabase({ auth: ['user', 'secret:automations'] }, async (req, ctx) => {
    if (ctx.authMode === 'user') {
      // user flow — ctx.supabase scoped ao caller
      const { data } = await ctx.supabase.from('me').select('*').single()
      return Response.json(data)
    }
    // service flow — ctx.supabaseAdmin bypassa RLS
    await ctx.supabaseAdmin.from('audit').insert({ source: 'automation' })
    return Response.json({ ok: true })
  }),
}
```

### Pattern 6 — Erros customizados via `createSupabaseContext`

```ts
import { createSupabaseContext } from 'npm:@supabase/server@1'

export default {
  fetch: async (req: Request) => {
    const { data: ctx, error } = await createSupabaseContext(req, { auth: 'user' })
    if (error) {
      // shape 401 conforme contrato API
      return Response.json(
        { message: error.message, code: error.code },
        { status: error.status, headers: { 'WWW-Authenticate': 'Bearer' } },
      )
    }
    return Response.json({ message: `hello ${ctx.userClaims?.email}` })
  },
}
```

### Pattern 7 — Sem `@supabase/server` (RLS manual)

Quando precisar de controle fino ou não puder adicionar dependência:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const PUBLISHABLE = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)

Deno.serve(async (req) => {
  // PT-BR: forward Authorization → supabase-js → queries respeitam RLS do user
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    PUBLISHABLE['default'],
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  )
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
})
```

Para validar JWT manualmente:

```ts
const { data: { user }, error } = await supabase.auth.getUser(
  req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
)
if (!user || error) return new Response('unauthorized', { status: 401 })
```

## Env vars 2026 esperadas

`@supabase/server` lê estas (auto-provisionadas na plataforma + CLI local):

| Variável | O que é |
|---|---|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_PUBLISHABLE_KEYS` | JSON dict de chaves publishable |
| `SUPABASE_SECRET_KEYS` | JSON dict de chaves secret |
| `SUPABASE_JWKS` | JWK Set para validar user JWTs |

Fallback local (single-key): `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` ainda funcionam.

## Anti-patterns

### AA1 — API key como Bearer

```
⚠ Authorization: Bearer sb_publishable_abc      → 401, gateway rejeita
✓ apikey: sb_publishable_abc
```

### AA2 — Chamar `auth.getUser()` em função `verify_jwt=false` sem repassar Authorization

Função com `verify_jwt=false` desliga apenas a **plataforma** — `auth.getUser()` ainda pode ser chamada se o caller mandar JWT. Mas se você não recebe JWT (webhook), `auth.getUser()` retorna `null`. Para Service-to-Service, use `auth: 'secret:<name>'` e `ctx.supabaseAdmin`.

### AA3 — `service_role` no client browser

`SUPABASE_SECRET_KEYS` (e legacy `SUPABASE_SERVICE_ROLE_KEY`) bypassam RLS. NUNCA expor em código browser. Só server-side (Edge Function, backend Node).

### AA4 — `auth: 'none'` em endpoint que lê/grava dado sensível

`'none'` aceita qualquer caller. Use apenas quando há outra validação (signature webhook, mTLS, etc.) ou endpoint genuinamente público (health check).

### AA5 — Hardcode `'service_role'` em vez de chave nomeada

Em 2026, prefira chaves nomeadas (`secret:automations`, `secret:internal-cron`) — permite rotação granular e audit por consumidor. Legacy `SUPABASE_SERVICE_ROLE_KEY` ainda funciona mas é uma única chave global.

### AA6 — `Authorization` E `apikey` ambos errados

Browser logado chamando `supabase.functions.invoke` envia **ambos**: `Authorization: Bearer <user-jwt>` + `apikey: sb_publishable_default`. É esperado e correto.

## Diagnóstico de 401

| Sintoma | Causa provável | Fix |
|---|---|---|
| 401 antes do handler | `verify_jwt=true` + Authorization ausente/inválido | mandar JWT válido OU `verify_jwt = false` |
| 401 do handler (`@supabase/server`) | apikey errada para o mode declarado | conferir mode vs header enviado |
| 401 só em produção, ok em dev | env vars não setadas em prod | `supabase secrets set` |
| 401 com `auth.getUser()` returning null | JWT expirou ou JWKS errado | refresh JWT no client |

## Ver também

- [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) — base Deno + env vars JSON dict
- [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md) — status codes 401/403/405
- [`supabase-custom-claims-rbac`](../supabase-custom-claims-rbac/SKILL.md) — Custom Claims em JWT acessíveis via `ctx.userClaims`
- [`supabase-rls-policies`](../supabase-rls-policies/SKILL.md) — RLS aplicada quando `ctx.supabase` scoped
- [`supabase-rls-defense-in-depth`](../supabase-rls-defense-in-depth/SKILL.md) — `secret_role` caveat
- [`supabase-auth-ssr`](../supabase-auth-ssr/SKILL.md) — clients Next.js v16
- [`_shared-supabase/glossary.md`](../_shared-supabase/glossary.md) — termos canônicos auth
