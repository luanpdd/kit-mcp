---
name: distributed-tracing
description: Use ao instrumentar tracing — trace_id/span_id/parent_id, propagar W3C TraceContext via header traceparent, stitching além de RPCs (batch, lambda, queue).
---

# Observabilidade — Distributed Tracing

## Quando usar

LLM carrega esta skill ao instrumentar tracing distribuído ou stitching de spans. Trigger phrases:

- "distributed tracing", "traces", "spans"
- "propagar contexto entre serviços", "trace cross-service"
- "W3C TraceContext", "traceparent header"
- "trace_id span_id parent_span_id"
- "ligar lambda batch job ao trace"
- "stitching de eventos"

## Regras absolutas

- **trace_id é compartilhado** entre todos os spans de um único request distribuído. **NÃO** mude por hop.
- **span_id é único por span** — gere novo a cada `startSpan()`. 16 hex chars (8 bytes).
- **parent_span_id aponta para span pai** — null no root span. Define a árvore.
- **W3C TraceContext é o padrão** — header HTTP `traceparent: 00-{trace_id}-{span_id}-{flags}`. Adote sempre. B3 é fallback para legacy.
- **Propague ANTES de fazer call cross-service** — extrair contexto do request inbound, propagar no request outbound. Sem isso, trace quebra.
- **Stitching ≠ apenas RPC** — também batch jobs, queue messages, lambda invocations, S3 uploads. Carregue `traceparent` em metadata da queue, env var do lambda, header da Step Function.
- **Sample decision propaga** — bit `01` em flags de `traceparent` significa "sample=true". Decisão tomada no head propaga downstream.
- **Não invente trace_id** — sempre derive do contexto inbound ou gere via SDK (não `crypto.randomUUID()`).
- **Spans devem ter `kind`** — `SERVER` (handler de inbound), `CLIENT` (call outbound), `PRODUCER`/`CONSUMER` (queue), `INTERNAL` (subspan dentro do mesmo process).

## Patterns canônicos

### Pattern: extrair contexto inbound + propagar outbound (Node)

```ts
// PT-BR: handler HTTP — extrai traceparent do request inbound, propaga em call outbound
import { trace, context, propagation } from '@opentelemetry/api'

const tracer = trace.getTracer('orders-service')

export async function placeOrder(req: Request) {
  // PT-BR: 1 — extrair contexto inbound do header traceparent
  const inboundContext = propagation.extract(context.active(), req.headers)

  return tracer.startActiveSpan(
    'place_order',
    { kind: SpanKind.SERVER },
    inboundContext,
    async (span) => {
      span.setAttribute('user.id', req.user.id)

      // PT-BR: 2 — fazer call outbound — propagation injeta traceparent automaticamente
      //         se você usar fetch/grpc instrumentados (ver skill opentelemetry-standard)
      const outboundHeaders: Record<string, string> = {}
      propagation.inject(context.active(), outboundHeaders)

      const inventoryRes = await fetch('http://inventory/check', {
        headers: outboundHeaders,  // PT-BR: traceparent injetado aqui
        body: JSON.stringify({ items: req.items })
      })

      span.end()
      return inventoryRes.json()
    }
  )
}
```

### Pattern: traceparent format

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             ^  ^                                ^                 ^
             |  |                                |                 |
             version                             |                 flags (sampled bit)
                trace_id (32 hex / 16 bytes)     |
                                                 span_id (16 hex / 8 bytes)
```

```text
flags:
  01 = sampled    (decisão upstream: capture este trace)
  00 = not sampled (decisão upstream: skip)
```

### Pattern: trace cross-service via Supabase Edge Function

```ts
// PT-BR: Edge Function recebe request → propaga para outro service
import { trace, context, propagation } from 'npm:@opentelemetry/api@1.9.0'
import { W3CTraceContextPropagator } from 'npm:@opentelemetry/core@1.27.0'

propagation.setGlobalPropagator(new W3CTraceContextPropagator())

const tracer = trace.getTracer('edge-orders')

Deno.serve(async (req) => {
  // PT-BR: extrair traceparent inbound
  const inboundCtx = propagation.extract(context.active(), {
    traceparent: req.headers.get('traceparent') ?? '',
  })

  return tracer.startActiveSpan(
    'edge_handler',
    { kind: 1 /* SERVER */ },
    inboundCtx,
    async (span) => {
      span.setAttribute('endpoint', new URL(req.url).pathname)

      // PT-BR: call outbound para Postgres via PostgREST — injeta traceparent
      const outHeaders: Record<string, string> = {}
      propagation.inject(context.active(), outHeaders)

      const dbRes = await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/orders', {
        method: 'POST',
        headers: {
          ...outHeaders,
          'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
          'content-type': 'application/json',
        },
        body: await req.text(),
      })

      span.setAttribute('db.status_code', dbRes.status)
      span.end()
      return dbRes
    }
  )
})
```

### Pattern: stitching além de RPC — queue message (não-RPC)

```ts
// PT-BR: producer — anexa traceparent ao payload da queue (pgmq, SQS, RabbitMQ)
import { trace, context, propagation } from '@opentelemetry/api'

const tracer = trace.getTracer('producer')

export async function enqueueEmail(emailJob: EmailJob) {
  return tracer.startActiveSpan(
    'enqueue_email',
    { kind: SpanKind.PRODUCER },
    async (span) => {
      span.setAttribute('queue.name', 'emails')
      span.setAttribute('email.recipient', emailJob.to)

      // PT-BR: serializar contexto no payload da mensagem
      const carrier: Record<string, string> = {}
      propagation.inject(context.active(), carrier)

      await pgmqEnqueue('emails', {
        ...emailJob,
        _trace_context: carrier,  // PT-BR: viaja com o job
      })

      span.end()
    }
  )
}

// PT-BR: consumer — extrai traceparent do payload, continua o trace
export async function processEmailJob(job: EmailJobWithContext) {
  const inboundCtx = propagation.extract(
    context.active(),
    job._trace_context ?? {}  // PT-BR: se vazio, novo trace
  )

  return tracer.startActiveSpan(
    'process_email',
    { kind: SpanKind.CONSUMER },
    inboundCtx,
    async (span) => {
      span.setAttribute('email.recipient', job.to)
      // PT-BR: agora o span do worker faz parte do mesmo trace do producer
      await sendEmail(job)
      span.end()
    }
  )
}
```

### Pattern: stitching de batch job (não-RPC)

```ts
// PT-BR: cron job processa N items — 1 span por item, todos com mesmo trace_id
const tracer = trace.getTracer('billing-cron')

export async function dailyBillingJob() {
  return tracer.startActiveSpan('daily_billing', async (rootSpan) => {
    rootSpan.setAttribute('job.type', 'cron')
    rootSpan.setAttribute('build_id', BUILD_ID)

    const customers = await db.getCustomersDueForBilling()
    rootSpan.setAttribute('customers.count', customers.length)

    // PT-BR: cada customer vira span filho com mesmo trace_id
    for (const customer of customers) {
      await tracer.startActiveSpan(
        'bill_customer',
        { kind: SpanKind.INTERNAL },
        async (span) => {
          span.setAttribute('customer.id', customer.id)
          span.setAttribute('customer.tier', customer.tier)
          try {
            await chargeCustomer(customer)
            span.setAttribute('result.success', true)
          } catch (e) {
            span.setAttribute('result.success', false)
            span.setAttribute('error.type', classify(e))
          } finally {
            span.end()
          }
        }
      )
    }

    rootSpan.end()
  })
}
```

### Pattern: span kinds

| Kind | Quando usar | Exemplo |
|---|---|---|
| `SERVER` | Recebendo request inbound | Handler HTTP, gRPC server method |
| `CLIENT` | Fazendo call outbound | `fetch()`, gRPC client call, DB query |
| `PRODUCER` | Enviando msg para queue | `pgmq.enqueue()`, SQS publish |
| `CONSUMER` | Processando msg de queue | Worker recebendo job |
| `INTERNAL` | Subdivisão dentro do mesmo process | "json_parse", "validation_step" |

### Pattern: query traces — montar waterfall

```sql
-- PT-BR: pegar todos os spans de um trace em ordem cronológica
select
  span_id,
  parent_span_id,
  span_name,
  span_kind,
  service_name,
  duration_ms,
  start_time
from observability.spans
where trace_id = '4bf92f3577b34da6a3ce929d0e0e4736'
order by start_time asc;

-- PT-BR: encontrar root span — parent_span_id IS NULL ou span sem parent no mesmo trace
select * 
from observability.spans
where trace_id = '4bf92f3577b34da6a3ce929d0e0e4736'
  and parent_span_id is null;

-- PT-BR: spans mais lentos cross-trace, último 1h
select 
  service_name, 
  span_name,
  percentile_cont(0.99) within group (order by duration_ms) as p99,
  count(*) as samples
from observability.spans
where start_time > now() - interval '1 hour'
group by service_name, span_name
having count(*) > 100
order by p99 desc
limit 20;
```

## Anti-patterns

### ANTI: gerar trace_id por hop

```ts
// PT-BR: BAD — quebra a cadeia, cada service vê trace diferente
const traceId = crypto.randomUUID().replace(/-/g, '').slice(0, 32)

// PT-BR: GOOD — extrair do header inbound; deixar SDK gerar root
const inboundCtx = propagation.extract(context.active(), req.headers)
tracer.startActiveSpan('handler', {}, inboundCtx, ...)
```

### ANTI: esquecer de propagar em call outbound

```ts
// PT-BR: BAD — outbound call sem traceparent — trace quebra no service B
await fetch('http://service-b/api', { body: ... })

// PT-BR: GOOD — injetar traceparent
const headers: Record<string, string> = {}
propagation.inject(context.active(), headers)
await fetch('http://service-b/api', { headers, body: ... })
```

### ANTI: trace só de RPCs, não de batch/queue

```ts
// PT-BR: BAD — producer/consumer não compartilham trace, debug fica fragmentado
await pgmqEnqueue('emails', payload)  // sem trace context
// ... depois worker processa sem saber que veio do request X

// PT-BR: GOOD — propagar contexto via metadata da queue
const carrier = {}
propagation.inject(context.active(), carrier)
await pgmqEnqueue('emails', { ...payload, _trace_context: carrier })
```

### ANTI: span sem `end()`

```ts
// PT-BR: BAD — span fica aberto forever, duration_ms não calculado, memory leak
const span = tracer.startSpan('handler')
// ... handler logic
return result  // PT-BR: ESQUECEU span.end()

// PT-BR: GOOD — sempre `try/finally`
const span = tracer.startSpan('handler')
try {
  // ... logic
} finally {
  span.end()
}
```

### ANTI: span hierarchy errada

```ts
// PT-BR: BAD — usar startSpan sem startActiveSpan, parent não é settado automático
const parent = tracer.startSpan('parent')
const child = tracer.startSpan('child')  // PT-BR: parent_span_id ficou null
parent.end()
child.end()

// PT-BR: GOOD — startActiveSpan empurra contexto, child herda parent
tracer.startActiveSpan('parent', (parent) => {
  tracer.startActiveSpan('child', (child) => {
    // PT-BR: child.parent_span_id === parent.span_id
    child.end()
  })
  parent.end()
})
```

## Verificação

1. **1 trace_id por request** — enviar 1 request, queryar `SELECT DISTINCT trace_id FROM spans WHERE request_id = X` → 1 resultado.
2. **Cross-service stitching** — request HTTP service A → service B → DB. Queryar `SELECT count(distinct service_name) FROM spans WHERE trace_id = X` → ≥ 3.
3. **Root span identificável** — `SELECT * FROM spans WHERE trace_id = X AND parent_span_id IS NULL` → 1 row (o root).
4. **Span hierarchy correta** — graficar via tool (Jaeger UI, Honeycomb, etc.) ou recursivo SQL — deve formar árvore válida (sem ciclos).
5. **Duration não-zero** — `SELECT min(duration_ms), max(duration_ms) FROM spans` — min ≥ 0, max razoável.
6. **Sampled flag respeitado** — verificar que se traceparent inbound = `01`, downstream também sample=true.
7. **Queue stitching funciona** — enqueue + consume → mesmo `trace_id` em ambos os spans.

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — W3C TraceContext, B3, span kinds
- `kit/skills/structured-events/SKILL.md` — atributos canônicos por span
- `kit/skills/opentelemetry-standard/SKILL.md` — SDK que faz extract/inject
- `kit/skills/telemetry-sampling/SKILL.md` *(Phase 34)* — head vs tail sampling decisão

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 6: "Stitching Events into Traces".*
