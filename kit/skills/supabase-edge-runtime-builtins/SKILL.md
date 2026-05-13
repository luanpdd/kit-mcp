---
name: supabase-edge-runtime-builtins
description: Use ao usar built-ins do Edge Runtime Supabase — `Supabase.ai.Session` para embeddings/LLM (gte-small + Ollama/Llamafile), file system persistente via S3FS (`/s3/<bucket>`) + ephemeral (`/tmp`), regional invocation via `x-region` header e `FunctionRegion` enum, WebSockets com `Deno.upgradeWebSocket` + `per_worker` policy, Wasm modules com `static_files` em config.toml, env vars runtime (SB_REGION, SB_EXECUTION_ID, DENO_DEPLOYMENT_ID).
---

# Supabase — Edge Runtime Built-ins · 2026

## Quando usar

Carrega quando:

- "embeddings em Edge Function", "Supabase.ai.Session", "gte-small"
- "LLM em Edge Function" (Ollama, Llamafile, AI_INFERENCE_API_HOST)
- "persistent storage Edge Function", "/s3/ mount", "S3FS"
- "rodar Edge Function em região específica", "x-region", "FunctionRegion"
- "WebSocket em Edge Function", "Deno.upgradeWebSocket"
- "Wasm em Edge Function", "static_files config.toml", "wasm-bindgen"
- "Edge Function regional latency"

> Pré-requisito: [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md).

## 1. `Supabase.ai.Session` — modelo built-in

### Embeddings com gte-small (zero deps)

```ts
import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts'

const model = new Supabase.ai.Session('gte-small')

Deno.serve(async (req) => {
  const { text } = await req.json()
  // PT-BR: gte-small → 384 dimensões, English-only, max 512 tokens
  const embedding = await model.run(text, { mean_pool: true, normalize: true })
  return Response.json({ embedding })   // array de 384 floats
})
```

Use com pgvector — vector(384). Ver [`supabase-pgvector-rag`](../supabase-pgvector-rag/SKILL.md).

### LLM via Ollama (self-hosted)

```bash
# 1. instalar Ollama localmente / em VM
ollama pull mistral
ollama serve

# 2. setar secret apontando para o servidor
supabase secrets set AI_INFERENCE_API_HOST=http://ollama-host:11434
```

```ts
const session = new Supabase.ai.Session('mistral')

Deno.serve(async (req) => {
  const { prompt } = await req.json()
  // PT-BR: stream para baixa latência percebida
  const stream = await session.run(prompt, { stream: true, mode: 'ollama' })

  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk.response ?? ''))
        }
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' } },
  )
})
```

### LLM via Llamafile (OpenAI-compatível)

```bash
supabase secrets set AI_INFERENCE_API_HOST=http://llamafile-host:8080
```

```ts
const session = new Supabase.ai.Session('LLaMA_CPP')   // model name não importa — depende do .llamafile rodando

const output = await session.run(
  {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ],
  },
  { mode: 'openaicompatible', stream: false },
)
```

Performance local de Ollama é **muito menor** que servidor com GPU dedicada. Para produção, use VM com GPU ou aguarde Supabase hosted LLM API (early access).

## 2. File System — Persistente (S3FS) + Ephemeral (/tmp)

### Ephemeral `/tmp` (default — reset por invocação)

```ts
Deno.serve(async (req) => {
  if (req.headers.get('content-type') !== 'application/zip') {
    return new Response('zip required', { status: 400 })
  }
  const uploadId = crypto.randomUUID()
  await Deno.writeFile(`/tmp/${uploadId}.zip`, req.body!)
  // PT-BR: processa em background para não exceder memória
  EdgeRuntime.waitUntil(processZip(uploadId))
  return Response.json({ uploadId })
})
```

Limites: Free 256 MB, Paid 512 MB.

### Persistent S3FS — mount qualquer S3-compatible bucket

Secrets necessários (`supabase secrets set ...`):

```
S3FS_ENDPOINT_URL=https://<project>.supabase.co/storage/v1/s3
S3FS_REGION=us-east-1
S3FS_ACCESS_KEY_ID=...
S3FS_SECRET_ACCESS_KEY=...
```

Para Supabase Storage S3, gerar access key em [Storage > S3 Connection](https://supabase.com/docs/guides/storage/s3/authentication).

```ts
// Leitura
const csv = await Deno.readFile('/s3/uploads/results.csv')

// Escrita
await Deno.writeTextFile('/s3/exports/report-2026.txt', 'hello')

// Criar subdiretório
await Deno.mkdir('/s3/uploads/2026-05')

// Listar
for await (const entry of Deno.readDir('/s3/uploads')) {
  console.log(entry.name)
}
```

Mount path: `/s3/<bucket-name>/<key>`. Sem limites Supabase específicos (limites do S3 backend aplicam).

### Sync File APIs — só na inicialização

```ts
// ✓ ok — durante script init
const config = JSON.parse(Deno.readTextFileSync('/s3/config/app.json'))

Deno.serve(async (req) => {
  // ⚠ ERRO — Deno.statSync blocklisted em callback
  // Deno.statSync('/tmp/x')

  // ✓ certo — usar versão async
  const info = await Deno.stat('/tmp/x')
})
```

APIs sync (`Deno.readFileSync`, `statSync`, `mkdirSync`, etc.) **só durante initial script evaluation**. Em handlers/setTimeout/etc — sempre async.

## 3. Regional Invocation

Edge Functions executam na região mais próxima ao caller por default. Para forçar região específica (útil quando função é DB-heavy e DB é regional):

### Via SDK

```ts
import { FunctionRegion } from 'npm:@supabase/supabase-js@2.95.0'

await supabase.functions.invoke('bulk-import', {
  body: payload,
  region: FunctionRegion.SaEast1,   // São Paulo
})
```

### Via header (qualquer cliente HTTP)

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/bulk-import \
  -H 'apikey: sb_publishable_...' \
  -H 'x-region: sa-east-1' \
  -d '{...}'
```

### Quando header não disponível (CORS, webhooks) — query param

```
https://<ref>.supabase.co/functions/v1/bulk-import?forceFunctionRegion=sa-east-1
```

### Regiões disponíveis (14 total)

| Cluster | Regiões |
|---|---|
| América do Sul | `sa-east-1` (São Paulo) |
| América do Norte | `ca-central-1`, `us-east-1`, `us-west-1`, `us-west-2` |
| Europa | `eu-central-1`, `eu-west-1`, `eu-west-2`, `eu-west-3` |
| Ásia-Pacífico | `ap-northeast-1`, `ap-northeast-2`, `ap-south-1`, `ap-southeast-1`, `ap-southeast-2` |

### Verificar região da execução

```ts
console.log('executed in:', Deno.env.get('SB_REGION'))
```

Response header `x-sb-edge-region` indica para o caller.

**Caveat:** com `x-region` explícito, requests **não** failover automático em outage da região. Considere fallback para default region em SDK wrapper.

## 4. WebSockets

```toml
# supabase/config.toml — REQUIRED para WebSocket local
[edge_runtime]
policy = "per_worker"
```

```ts
// supabase/functions/realtime-chat/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const SECRET = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SECRET['default'])

Deno.serve(async (req) => {
  const upgrade = req.headers.get('upgrade') ?? ''
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('expected websocket upgrade', { status: 400 })
  }

  // PT-BR: browser WebSocket não permite custom headers → JWT via query param
  const jwt = new URL(req.url).searchParams.get('jwt') ?? ''
  const { data, error } = await supabase.auth.getUser(jwt)
  if (error || !data.user) return new Response('unauthorized', { status: 403 })

  const { socket, response } = Deno.upgradeWebSocket(req)

  socket.onopen = () => console.log('socket opened', { user: data.user!.id })
  socket.onmessage = (e) => {
    socket.send(JSON.stringify({ echo: e.data, at: Date.now() }))
  }
  socket.onerror = (e) => console.log('socket error:', (e as ErrorEvent).message)
  socket.onclose = () => console.log('socket closed')

  return response
})
```

```toml
[functions.realtime-chat]
verify_jwt = false                       # JWT validado via query param no handler
```

Deploy: `supabase functions deploy realtime-chat --no-verify-jwt`.

**Alternativa autenticação:** subprotocol no header `Sec-WebSocket-Protocol: jwt-<token>` — parse no handler.

### Outbound WebSocket (proxy/relay)

Edge Function pode abrir WebSocket para outro server e fazer relay (ex: OpenAI Realtime API). Padrão duplo: inbound `Deno.upgradeWebSocket` + outbound `new WebSocket('wss://...')`.

## 5. Wasm modules

### Setup Rust + wasm-bindgen

```bash
# Dentro da pasta da função
cd supabase/functions/wasm-add
cargo new --lib add-wasm
# Editar Cargo.toml com wasm-bindgen dep + crate-type = ["cdylib"]
# Editar src/lib.rs com #[wasm_bindgen] add function
wasm-pack build --target deno
```

```toml
# supabase/config.toml — CLI 2.7.0+
[functions.wasm-add]
static_files = ["./functions/wasm-add/add-wasm/pkg/*"]
```

```ts
// supabase/functions/wasm-add/index.ts
import init, { add } from './add-wasm/pkg/add_wasm.js'

await init()   // PT-BR: Deno 2.1+ vai simplificar isso

Deno.serve(async (req) => {
  const { a, b } = await req.json()
  return Response.json({ sum: add(a, b) })
})
```

**Caveat:** `static_files` **não funciona** com `--use-api`. Precisa Docker no build: `supabase functions deploy wasm-add` (sem `--use-api`).

### Casos de uso

- Image processing pesado (`magick-wasm`)
- Crypto custom (libsodium)
- Computações intensivas portadas de C/Rust
- WebAssembly puro evitando JS overhead

## 6. Env vars runtime (read-only)

| Variável | O que é |
|---|---|
| `SB_REGION` | AWS region da invocação (ex: `us-east-1`) |
| `SB_EXECUTION_ID` | UUID do isolate atual |
| `DENO_DEPLOYMENT_ID` | `{project_ref}_{function_id}_{version}` — útil para `build_id` em traces |

Usar como atributos canônicos em [`structured-events`](../structured-events/SKILL.md) / [`distributed-tracing`](../distributed-tracing/SKILL.md).

```ts
import { trace } from 'npm:@opentelemetry/api@1.9.0'

Deno.serve(async (req) => {
  const span = trace.getActiveSpan()
  span?.setAttributes({
    'sb.region': Deno.env.get('SB_REGION')!,
    'sb.execution_id': Deno.env.get('SB_EXECUTION_ID')!,
    'build_id': Deno.env.get('DENO_DEPLOYMENT_ID')!,
  })
  // ...
})
```

## Anti-patterns

### AR1 — Heavy LLM em Edge Function user-facing
Wall clock free 150s, paid 400s, CPU 2s/request. LLM grande estoura. Para inference síncrona pesada, considere job queue + worker dedicado (`pg_cron` → `pgmq` → Edge → external).

### AR2 — `/s3/` sem S3FS env vars
Mount path requer 4 env vars. Sem elas, write retorna `EACCES`. Validar `supabase secrets list` antes de deploy.

### AR3 — WebSocket sem `per_worker` local
Local fecha conexão em 1s. Sempre `policy = "per_worker"` em `config.toml` para WebSocket dev.

### AR4 — `x-region` em endpoint com failover esperado
Header desliga roteamento automático. Use apenas quando latência regional > tolerância para outages.

### AR5 — Wasm com `--use-api` deploy
`static_files` requer Docker no bundle. Falha silenciosamente em API deploy.

### AR6 — `Supabase.ai.Session` para textos > 512 tokens (gte-small)
gte-small trunca para 512 tokens; embeddings podem perder precisão. Para textos longos, chunk antes ou use modelo maior (Ollama com all-minilm/embeddings).

## Ver também

- [`supabase-edge-functions`](../supabase-edge-functions/SKILL.md) — base
- [`supabase-edge-functions-limits`](../supabase-edge-functions-limits/SKILL.md) — limits para AI/Wasm
- [`supabase-pgvector-rag`](../supabase-pgvector-rag/SKILL.md) — embeddings em DB
- [`supabase-storage`](../supabase-storage/SKILL.md) — alternativa user-managed
- [`supabase-realtime`](../supabase-realtime/SKILL.md) — quando preferir Realtime broadcast vs WebSocket custom
- [`structured-events`](../structured-events/SKILL.md) — atributos canônicos `sb.region`, `build_id`
- [`llm-as-dependency`](../llm-as-dependency/SKILL.md) — adapter pattern para Supabase.ai
