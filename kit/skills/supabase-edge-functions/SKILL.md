---
name: supabase-edge-functions
description: Use ao escrever Edge Functions — Deno + imports npm:/jsr: (NUNCA bare), Deno.serve, env vars pre-populadas, file writes APENAS em /tmp, EdgeRuntime.waitUntil.
---

# Supabase — Edge Functions (Deno)

## Quando usar

LLM carrega esta skill quando criar, editar ou debugar Supabase Edge Functions (Deno runtime). Trigger phrases:

- "criar Edge Function", "Supabase functions"
- "Deno + Supabase"
- "supabase functions deploy"
- "Edge Function background task"
- "import npm: jsr: em Edge Function"

## Regras absolutas

- **Runtime é Deno**, não Node.js. Use APIs Deno (`Deno.serve`, `Deno.env`, `Deno.writeTextFile`).
- **Imports SEMPRE com `npm:` ou `jsr:`** prefix. **NUNCA** bare specifiers (`import x from 'pkg'` falha em runtime).
- **Use versão pinada** nos imports — `npm:hono@4.6.7`, `npm:@supabase/supabase-js@2`. Sem version, runtime resolve para latest e quebra em deploy.
- **Env vars pre-populadas** (não definir manualmente):
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEYS` (anon key — para client-side context)
  - `SUPABASE_SECRET_KEYS` (service role — server-side only)
  - `SUPABASE_DB_URL` (conexão direta ao Postgres)
- Para outros secrets, set via `supabase secrets set --env-file path/to/.env`.
- **`Deno.serve`** é o entry point canônico. **Nunca** `addEventListener('fetch')` (deprecated) ou `serve` de `https://deno.land/std@0.168.0/http/server.ts` (não usar).
- **File writes APENAS em `/tmp`** — qualquer outro path é read-only.
- Para tarefas em background após resposta, use **`EdgeRuntime.waitUntil(promise)`**. Sem isso, função termina antes da promise.
- Multi-rota com Hono ou Express deve **prefixar** todas as rotas com `/<function-name>` (ex: `/my-function/users`) — sem prefix, request 404 quando deployada.

## Patterns canônicos

### Função básica — Deno.serve + npm: import

```ts
// supabase/functions/hello/index.ts
// PT-BR: imports versionados sempre com npm:
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SECRET_KEYS')!   // service role server-side
  )

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title')
    .limit(10)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Background task com `EdgeRuntime.waitUntil`

```ts
// supabase/functions/audit-log/index.ts
// PT-BR: responde rápido, processa pesado em background

Deno.serve(async (req) => {
  const body = await req.json()

  // PT-BR: `waitUntil` mantém runtime alive até promise resolver
  EdgeRuntime.waitUntil((async () => {
    // PT-BR: file write apenas em /tmp
    await Deno.writeTextFile(
      `/tmp/audit-${Date.now()}.log`,
      JSON.stringify(body)
    )
    // PT-BR: pode chamar APIs externas, gerar embeddings, etc.
    await fetch('https://example.com/audit', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  })())

  // PT-BR: response volta imediatamente
  return new Response('accepted', { status: 202 })
})
```

### Multi-rota com Hono

```ts
// supabase/functions/api/index.ts
// PT-BR: rotas prefixadas com /api (nome da function)
import { Hono } from 'npm:hono@4.6.7'

const app = new Hono().basePath('/api')

app.get('/users', (c) => c.json({ users: [] }))
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
app.post('/users', async (c) => {
  const body = await c.req.json()
  return c.json({ created: body }, 201)
})

Deno.serve(app.fetch)
```

### Função usando JSR e Node built-in

```ts
// supabase/functions/hash/index.ts
// PT-BR: imports do JSR + Node built-in (precisa node: prefix)
import { encodeHex } from 'jsr:@std/encoding/hex'
import { createHash } from 'node:crypto'

Deno.serve(async (req) => {
  const { text } = await req.json()
  const hash = createHash('sha256').update(text).digest('hex')
  return new Response(JSON.stringify({ hash }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Auth — service-role server-side

```ts
// supabase/functions/admin-action/index.ts
// PT-BR: service-role bypassa RLS — apenas server-side
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // PT-BR: extrair JWT do header Authorization e validar
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('unauthorized', { status: 401 })
  }

  // PT-BR: client com service-role para operação privilegiada
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SECRET_KEYS')!
  )

  // PT-BR: validar JWT e extrair user
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (!user || error) return new Response('unauthorized', { status: 401 })

  // PT-BR: agora pode operar com privilégios de service_role
  await supabase.from('audit_log').insert({ user_id: user.id, action: 'admin_view' })

  return new Response('ok')
})
```

## Anti-patterns

### Anti-pattern 1: Bare specifier sem `npm:`/`jsr:`

**Errado:**
```ts
import { createClient } from '@supabase/supabase-js'      // ⚠ bare specifier
```

**Por quê:** Deno não resolve bare specifiers. Runtime falha em startup com erro `Module not found`.

**Certo:**
```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
```

### Anti-pattern 2: `Deno.writeTextFile` fora de `/tmp`

**Errado:**
```ts
await Deno.writeTextFile('/data/audit.log', data)         // ⚠ filesystem read-only
await Deno.writeTextFile('./local/x.log', data)           // ⚠ idem
```

**Por quê:** Edge Functions runtime tem filesystem read-only exceto `/tmp`. Writes fora de `/tmp` falham com `EACCES`.

**Certo:**
```ts
await Deno.writeTextFile(`/tmp/audit-${Date.now()}.log`, data)
```

### Anti-pattern 3: Trabalho pesado inline na response

**Errado:**
```ts
Deno.serve(async (req) => {
  const body = await req.json()
  await processHeavyJob(body)        // ⚠ trava response 30s+
  await sendEmail(body)              // ⚠ idem
  return new Response('done')
})
```

**Por quê:** cliente espera resposta. Edge Functions têm timeout (default 60s). Falhas pontuais quebram UX.

**Certo:** use `EdgeRuntime.waitUntil` para liberar resposta:
```ts
Deno.serve(async (req) => {
  const body = await req.json()
  EdgeRuntime.waitUntil((async () => {
    await processHeavyJob(body)
    await sendEmail(body)
  })())
  return new Response('accepted', { status: 202 })
})
```

### Anti-pattern 4: Multi-rota sem prefix

**Errado:**
```ts
const app = new Hono()                  // ⚠ sem basePath
app.get('/users', handler)
Deno.serve(app.fetch)                   // request a /users → 404 em produção
```

**Por quê:** quando deployado, URL é `https://<ref>.supabase.co/functions/v1/<name>/...`. Sem `basePath('/<name>')` no router, request a `/users` não casa.

**Certo:**
```ts
const app = new Hono().basePath('/api')   // PT-BR: prefix com nome da function
```

## Ver também

- [supabase-auth-ssr](../supabase-auth-ssr/SKILL.md) — clients usam `npm:@supabase/supabase-js`
- [supabase-rls-policies](../supabase-rls-policies/SKILL.md) — service-role server-side bypassa RLS
- [supabase-cron-queues](../supabase-cron-queues/SKILL.md) — Edge Functions invocadas por `pg_net.http_post`
- [glossário](../_shared-supabase/glossary.md) — comandos CLI (`supabase functions deploy`)
