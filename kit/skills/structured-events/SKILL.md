---
name: structured-events
description: Use ao instrumentar — wide events de alta cardinalidade (1/request), campos canônicos com dot notation, evite logs unstructured e métricas pre-aggregated.
---

# Observabilidade — Structured Events (Wide Events)

## Quando usar

LLM carrega esta skill quando instrumentar código para emitir telemetria. Trigger phrases:

- "structured logging", "wide events", "observability events"
- "instrumentar handler", "emitir telemetria", "log estruturado"
- "como salvar evento de request"
- "campos canônicos", "atributos de span"
- "alta cardinalidade", "debug por user_id"

## Regras absolutas

- **1 evento por request** — não múltiplos. Acumule contexto durante o request, emita 1 wide event no final (ou em erros).
- **Wide é melhor que narrow** — adicione campos liberalmente. Custo de 100 campos/evento ≈ 10 campos. Disco é barato; falta de campo no incidente é caro.
- **Alta cardinalidade é OBRIGATÓRIA** — `user.id`, `tenant_id`, `request.id`, `customer.email`. Sem isso, observabilidade não funciona (Cap 1).
- **Dot notation OTel** — `user.id` (não `userId` nem `user_id`). `error.type`, `http.status_code`, `db.query`. Snake_case apenas em colunas de DB.
- **NUNCA pre-aggregate** — não emita "p99 latency = 247ms"; emita o `duration_ms` cru de cada request. Aggregation no read time.
- **Estruturado, não texto livre** — JSON, OTel attributes, ou colunas tipadas. **Nunca** `console.log("user 123 did X at 12:34")`.
- **Errors são especiais** — sample 100% de eventos com `result.success = false`. Sucesso pode ser samplado (skill `telemetry-sampling`).
- **Capture context, não code** — emita atributos de business logic (`customer.tier`, `feature_flag.x`), não estado interno de código (`var_x_value_at_line_42`).

## Patterns canônicos

### Pattern: handler instrumentado (Node/TypeScript)

```ts
// PT-BR: 1 evento por request, alta cardinalidade, atributos canônicos
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('orders-service')

export async function handlePlaceOrder(req: Request) {
  return tracer.startActiveSpan('place_order', async (span) => {
    // PT-BR: campos canônicos sempre — alta cardinalidade
    span.setAttribute('user.id', req.user.id)
    span.setAttribute('tenant_id', req.user.tenant)
    span.setAttribute('customer.tier', req.user.tier)
    span.setAttribute('request.id', req.headers['x-request-id'])
    span.setAttribute('endpoint', '/api/v1/orders')
    span.setAttribute('http.method', 'POST')
    span.setAttribute('build_id', process.env.BUILD_ID ?? 'dev')

    // PT-BR: feature flags como dimensões
    span.setAttribute('feature_flag.new_pricing', req.flags.newPricing)

    try {
      const order = await createOrder(req.body)

      // PT-BR: result e atributos de domínio
      span.setAttribute('result.success', true)
      span.setAttribute('order.id', order.id)
      span.setAttribute('order.amount_cents', order.amount)
      span.setAttribute('order.items_count', order.items.length)
      span.setAttribute('http.status_code', 200)
      span.setStatus({ code: SpanStatusCode.OK })
      return order
    } catch (e) {
      // PT-BR: erros — sample 100%, classificar por tipo
      span.setAttribute('result.success', false)
      span.setAttribute('error.type', classifyError(e))
      span.setAttribute('error.message', e.message)
      span.setAttribute('http.status_code', e.statusCode ?? 500)
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
      throw e
    } finally {
      span.end()  // PT-BR: SEMPRE — duration_ms é calculado aqui
    }
  })
}

function classifyError(e: any): string {
  if (e.code === 'P2002') return 'db_conflict'
  if (e.statusCode === 401) return 'auth'
  if (e.statusCode === 403) return 'authz'
  if (e.statusCode === 422) return 'validation'
  if (e.statusCode === 429) return 'rate_limit'
  if (e.code === 'ETIMEDOUT') return 'timeout'
  return 'unknown'
}
```

### Pattern: Edge Function (Deno) com structured event

```ts
// PT-BR: Supabase Edge Function — 1 evento estruturado por invocação
import { trace } from 'npm:@opentelemetry/api@1.9.0'

const tracer = trace.getTracer('edge-process-emails')

Deno.serve(async (req) => {
  return tracer.startActiveSpan('process_emails', async (span) => {
    const requestId = crypto.randomUUID()
    span.setAttribute('request.id', requestId)
    span.setAttribute('build_id', Deno.env.get('SUPABASE_GIT_SHA') ?? 'local')

    try {
      const body = await req.json()
      span.setAttribute('user.id', body.user_id)
      span.setAttribute('tenant_id', body.tenant_id)
      span.setAttribute('email.batch_size', body.emails?.length ?? 0)

      const result = await processBatch(body.emails)

      span.setAttribute('result.success', true)
      span.setAttribute('email.sent_count', result.sent)
      span.setAttribute('email.failed_count', result.failed)
      span.setAttribute('duration_ms', result.duration)

      return new Response(JSON.stringify(result), { status: 200 })
    } catch (e) {
      span.setAttribute('result.success', false)
      span.setAttribute('error.type', classify(e))
      span.setAttribute('error.message', String(e))
      return new Response(JSON.stringify({ error: 'failed' }), { status: 500 })
    } finally {
      span.end()
    }
  })
})
```

### Pattern: campos canônicos por categoria

| Categoria | Campos | Exemplo |
|---|---|---|
| **Identidade** | `user.id`, `tenant_id`, `session.id` | `"550e8400-e29b-41d4-..."` |
| **Request** | `request.id`, `endpoint`, `http.method`, `http.status_code` | `"req_abc123"`, `"/api/v1/orders"`, `"POST"`, `200` |
| **Resultado** | `result.success`, `error.type`, `error.message` | `true`, `"validation"`, `"email already exists"` |
| **Performance** | `duration_ms`, `db.query_count`, `cache.hit` | `127`, `3`, `true` |
| **Build/Deploy** | `build_id`, `service.version`, `region` | `"abc123f"`, `"v1.9.0"`, `"us-east-1"` |
| **Business** | `customer.tier`, `order.amount_cents`, `feature_flag.<name>` | `"pro"`, `4990`, `true` |
| **Tracing** | `trace.id`, `span.id`, `span.parent_id` | (auto via OTel) |

### Pattern: query observability — encontrar pattern em wide events

```sql
-- PT-BR: alta cardinalidade permite group by ad hoc — sem schema rigido
-- Exemplo: qual tenant + endpoint + error_type domina os erros da última hora?
select
  tenant_id,
  endpoint,
  error_type,
  count(*) as error_count,
  avg(duration_ms) as avg_duration
from observability.events
where 
  result_success = false
  and timestamp > now() - interval '1 hour'
group by tenant_id, endpoint, error_type
order by error_count desc
limit 20;
```

## Anti-patterns

### ANTI: log unstructured

```ts
// PT-BR: BAD — não estruturado, não queryable, sem alta cardinalidade
console.log(`User ${userId} placed order ${orderId} for $${amount}`)

// PT-BR: GOOD — structured wide event
span.setAttribute('user.id', userId)
span.setAttribute('order.id', orderId)
span.setAttribute('order.amount_cents', amount * 100)
```

### ANTI: pre-aggregate em métricas

```ts
// PT-BR: BAD — pre-aggregation perde alta cardinalidade
metrics.histogram('order_latency_ms').record(duration, { service: 'orders' })

// PT-BR: GOOD — emit raw event, agregue no read
span.setAttribute('duration_ms', duration)
// PT-BR: ao queryar: SELECT percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)
//        FROM events GROUP BY tenant_id, endpoint  -- alta cardinalidade preservada!
```

### ANTI: múltiplos eventos por request

```ts
// PT-BR: BAD — 5 eventos para 1 request, sem trace context
log('user_action_started', { user_id })
log('user_action_db_query', { user_id, query })
log('user_action_email_sent', { user_id, to })
log('user_action_completed', { user_id })
log('user_action_response_sent', { user_id, status })

// PT-BR: GOOD — 1 wide event acumulando contexto
const span = tracer.startSpan('user_action')
span.setAttribute('user.id', user_id)
// ... ao longo do handler, span.setAttribute('email.recipient', ...) etc.
span.end()  // 1 evento emitido com todos os atributos
```

### ANTI: cardinalidade baixa

```ts
// PT-BR: BAD — apenas service e endpoint, sem identidade
span.setAttribute('service', 'orders')
span.setAttribute('endpoint', '/place')
// PT-BR: durante incident você não consegue responder "afeta quem?"

// PT-BR: GOOD — adicione identidades de alta cardinalidade
span.setAttribute('user.id', '550e8400-...')
span.setAttribute('tenant_id', 'acme-corp')
span.setAttribute('customer.tier', 'pro')
// PT-BR: durante incident: "afeta quem?" → group by customer.tier, tenant_id
```

### ANTI: capturar valores internos de código

```ts
// PT-BR: BAD — atributos sobre estado de variáveis, não sobre business
span.setAttribute('var_temp_array_length', tempArr.length)
span.setAttribute('loop_iteration', i)

// PT-BR: GOOD — atributos sobre business + identidade
span.setAttribute('order.items_count', items.length)
span.setAttribute('user.id', userId)
```

### ANTI: nomes inconsistentes de atributos

```ts
// PT-BR: BAD — mesmo conceito com nomes diferentes em handlers diferentes
span.setAttribute('userId', user.id)        // handler A
span.setAttribute('user_id', user.id)       // handler B
span.setAttribute('user', user.id)          // handler C
// PT-BR: query `WHERE user_id = X` falha em handler A; agg cross-handler quebra

// PT-BR: GOOD — convenção única em todo o projeto
span.setAttribute('user.id', user.id)       // sempre dot notation OTel
```

## Verificação

Antes de marcar instrumentação completa:

1. **1 evento por request** — em request de exemplo, contar eventos emitidos. Deve ser 1 (ou 2 se houver retry interno).
2. **Atributos canônicos presentes** — checar `user.id`, `tenant_id`, `request.id`, `result.success`, `endpoint`, `duration_ms` no evento emitido.
3. **Alta cardinalidade verificada** — `select count(distinct user_id)` deve crescer com tráfego real (não estagnar em N pequeno).
4. **`result.success` define SLI** — boolean confiável para alimentar SLO downstream (ver skill `event-based-slos`).
5. **Erros têm `error.type` enum** — não `error.message` cru. Permite group by por categoria.
6. **Build_id presente** — permite comparar versão antes vs depois de deploy.
7. **Smoke local** — emitir 100 eventos sintéticos, queryar via `select * from events where user_id = X` deve retornar todos.

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — termos canônicos, campos canônicos, anti-patterns
- `kit/skills/distributed-tracing/SKILL.md` — como spans se conectam em traces
- `kit/skills/opentelemetry-standard/SKILL.md` — SDK e exporters
- `kit/skills/core-analysis-loop/SKILL.md` — como queryar wide events para debug

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 5: "Structured Events Are the Building Blocks of Observability".*
