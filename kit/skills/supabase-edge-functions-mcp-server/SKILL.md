---
name: supabase-edge-functions-mcp-server
description: Use ao construir MCP server (Model Context Protocol) em Supabase Edge Functions com `mcp-lite` — scaffolding via `npm create mcp-lite@latest` template "Supabase Edge Functions (MCP server)", pattern dois apps Hono (root mounta em /<function-name>, inner handle /mcp), deno.json com imports `mcp-lite`/`hono`/`zod`, `verify_jwt=false` no template + auth no nível MCP, deploy a `https://<ref>.supabase.co/functions/v1/mcp-server/mcp` exposed para Claude/Cursor.
---

# Supabase — Edge Functions como MCP Server (`mcp-lite`) · 2026

## Quando usar

Carrega quando:

- "criar MCP server", "Model Context Protocol server"
- "mcp-lite supabase", "Claude tool customizado"
- "expor Supabase como tool para LLM", "Cursor MCP edge function"
- "MCP authentication", "StreamableHttpTransport mcp"

> Pré-requisito: [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) (Deno + config.toml).
> Complemento: [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md) (autenticação em MCP via withSupabase).

## Por que MCP em Edge Function

| Vantagem | Detalhe |
|---|---|
| **Zero cold starts efetivos** | Edge runtime fica warm; baixa latência |
| **Distribuição global** | Deploy 1x, executa próximo do user |
| **Acesso direto Postgres** | `ctx.supabaseAdmin` queries sem hop adicional |
| **Footprint mínimo** | `mcp-lite` é zero-deps TypeScript |
| **Auth Supabase integrada** | RLS / Custom Claims / RBAC reusados |

## Scaffolding canônico

```bash
npm create mcp-lite@latest
# selecionar: "Supabase Edge Functions (MCP server)"
cd my-mcp-server
```

Gera:

```
my-mcp-server/
├── supabase/
│   ├── config.toml                  # minimal — só edge runtime
│   └── functions/
│       └── mcp-server/
│           ├── index.ts             # implementação
│           └── deno.json
├── package.json
└── tsconfig.json
```

### `config.toml` mínimo (template)

```toml
project_id = "starter-mcp-supabase"

[api]
enabled = true
port = 54321

[edge_runtime]
enabled = true
policy = "per_worker"
deno_version = 2
```

Sem DB / Storage / Studio — só Edge Functions runtime. Adicionar conforme necessidade.

### `deno.json` per-function

```json
{
  "compilerOptions": {
    "lib": ["deno.window", "deno.ns"],
    "strict": true
  },
  "imports": {
    "hono": "npm:hono@^4.6.14",
    "mcp-lite": "npm:mcp-lite@0.8.2",
    "zod": "npm:zod@^4.1.12"
  }
}
```

## Pattern canônico — dois apps Hono

```ts
// supabase/functions/mcp-server/index.ts
import { Hono } from 'hono'
import { McpServer, StreamableHttpTransport } from 'mcp-lite'
import { z } from 'zod'

// PT-BR: instância MCP
const mcp = new McpServer({
  name: 'starter-mcp-supabase-server',
  version: '1.0.0',
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
})

// PT-BR: tool exemplo — sum
mcp.tool('sum', {
  description: 'Adds two numbers together',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  handler: (args: { a: number; b: number }) => ({
    content: [{ type: 'text', text: String(args.a + args.b) }],
  }),
})

// PT-BR: bind a HTTP transport (Streamable HTTP)
const transport = new StreamableHttpTransport()
const httpHandler = transport.bind(mcp)

// PT-BR: Supabase roteia tudo para /<function-name>/* → precisa de 2 apps
const app = new Hono()
const mcpApp = new Hono()

mcpApp.get('/', (c) =>
  c.json({
    message: 'MCP Server on Supabase Edge Functions',
    endpoints: { mcp: '/mcp', health: '/health' },
  }),
)

mcpApp.all('/mcp', async (c) => {
  // PT-BR: delega para mcp-lite httpHandler
  return await httpHandler(c.req.raw)
})

mcpApp.get('/health', (c) => c.json({ ok: true }))

// PT-BR: mount com o NOME da função — Supabase prefixa URL com /functions/v1/<name>
app.route('/mcp-server', mcpApp)

Deno.serve(app.fetch)
```

**Pegadinha-chave:** Supabase Edge roteia `https://<ref>.supabase.co/functions/v1/mcp-server/*` para sua função. Por isso o outer `app.route('/mcp-server', mcpApp)`. Sem isso, requests retornam 404.

## Desenvolvimento local

```bash
# 1. levantar local
supabase start

# 2. servir função (no-verify-jwt durante dev — produção tem auth no MCP layer)
supabase functions serve --no-verify-jwt mcp-server
```

Endpoint local: `http://localhost:54321/functions/v1/mcp-server/mcp`

### Testar com Claude Code

```bash
claude mcp add my-mcp -t http http://localhost:54321/functions/v1/mcp-server/mcp
```

### Testar com MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Adicionar a URL acima na UI.

## Adicionar tools que tocam Supabase

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const SECRET = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SECRET['default'])

mcp.tool('search_orders', {
  description: 'Search orders by customer',
  inputSchema: z.object({
    customer_id: z.string(),
    limit: z.number().min(1).max(50).default(10),
  }),
  handler: async ({ customer_id, limit }) => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, total, created_at')
      .eq('customer_id', customer_id)
      .limit(limit)
    if (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true }
    }
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  },
})
```

## Deploy produção

```bash
supabase functions deploy --no-verify-jwt mcp-server
```

URL final: `https://<project-ref>.supabase.co/functions/v1/mcp-server/mcp`

## Autenticação MCP em produção

Template usa `--no-verify-jwt`. Para produção, implemente auth no nível MCP seguindo [MCP Authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) — não no nível plataforma Supabase.

### Pattern: auth via header customizado + validação no handler

```ts
mcpApp.all('/mcp', async (c) => {
  // PT-BR: token MCP — pode ser API key custom ou JWT do user
  const mcpToken = c.req.header('x-mcp-token')
  if (!mcpToken || !await isValidMcpToken(mcpToken)) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  return await httpHandler(c.req.raw)
})
```

### Pattern: bridge para Supabase Auth (user-scoped tools)

```ts
import { withSupabase } from 'npm:@supabase/server@1'

mcpApp.all('/mcp', async (c) => {
  // PT-BR: passar JWT do user via header x-supabase-jwt; tool exec usa ctx.supabase
  const userJwt = c.req.header('x-supabase-jwt')
  if (userJwt) {
    // delegate to withSupabase wrapper para validar + scope client
    return await withSupabase({ auth: 'user' }, async (req, ctx) => {
      // anexar ctx.supabase ao mcp context para tools usarem RLS-aware client
      (mcp as any).context = { supabase: ctx.supabase }
      return await httpHandler(req)
    })(c.req.raw)
  }
  return c.json({ error: 'jwt required' }, 401)
})
```

## Best practices segurança

- **Não exponha dados sensíveis** sem auth — tools `search_*` em prod sempre RLS-aware (`ctx.supabase` scoped)
- **Valide inputs** — Zod schemas obrigatórios em cada tool
- **Limite escopo** — só exponha tools necessárias
- **Monitor uso** — `four-golden-signals` instrumentation no mcpApp `/mcp` handler
- **Rate limit** — saturated MCP server abusa de DB; usar Supavisor pool config

## Anti-patterns

### AM1 — Esquecer `app.route('/<function-name>', mcpApp)`
Single Hono app sem mount → 404 em prod. Supabase prefixa URL com nome da função.

### AM2 — Tool sem `inputSchema` Zod
Sem schema, MCP cliente envia qualquer formato. Crashes silenciosos.

### AM3 — `service_role` em tool exposta sem auth
`ctx.supabaseAdmin` bypassa RLS. MCP tool com admin client + sem auth = vazamento total. Use `'user'` mode.

### AM4 — JWT em query param (URL log leak)
`?jwt=...` é logado por proxies. Sempre header `x-mcp-token` ou `Authorization`.

### AM5 — Tool retornando dados crus de query sem filtro
LLM amplifica payload sensível. Limit + select específico (`select('id, name')`) — nunca `select('*')`.

## Cross-suite handoffs

| De | Para | Quando |
|---|---|---|
| Este skill | [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md) | Adicionar `withSupabase` no MCP handler |
| Este skill | [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md) | Rate limit + idempotency em tools de write |
| Este skill | [`four-golden-signals`](../four-golden-signals/SKILL.md) | Instrumentar `/mcp` handler |
| Este skill | [`supabase-pgvector-rag`](../supabase-pgvector-rag/SKILL.md) | Tool `semantic_search` com embeddings |
| Este skill | [`supabase-custom-claims-rbac`](../supabase-custom-claims-rbac/SKILL.md) | Tools com permission gate via `authorize()` |

## Ver também

- [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) — base
- [`supabase-edge-functions-auth`](../supabase-edge-functions-auth/SKILL.md) — withSupabase
- [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md) — rate limit
- [`supabase-edge-runtime-builtins`](../supabase-edge-runtime-builtins/SKILL.md) — Supabase.ai em tool
- [`legacy-api-only-applications`](../legacy-api-only-applications/SKILL.md) — adapter pattern
