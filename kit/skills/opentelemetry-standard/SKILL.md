---
name: opentelemetry-standard
description: Use ao adotar OTel — SDK + API + Tracer + Meter + Exporter + OTLP + Collector. Auto-instrumentation primeiro, custom attrs depois. Vendor-neutral por design.
---

# Observabilidade — OpenTelemetry (OTel)

## Quando usar

LLM carrega esta skill ao instrumentar código com OpenTelemetry. Trigger phrases:

- "OpenTelemetry", "OTel"
- "instrumentação vendor-neutral"
- "OTel SDK Tracer Meter Exporter Collector"
- "OTLP exporter"
- "auto-instrumentation"
- "OTel para Edge Function Deno", "OTel Node.js"

## Regras absolutas

- **Use OTel sempre** — vendor-neutral por design. Não adote APM proprietário no código aplicacional. Trocar backend = trocar exporter, não código.
- **API ≠ SDK** — `@opentelemetry/api` é o que devs importam (especificação). `@opentelemetry/sdk-*` é a implementação. Use API em libs, SDK no entry-point do app.
- **Auto-instrumentation primeiro** — instale `@opentelemetry/auto-instrumentations-node` (ou Deno equivalente) e tenha tracing de HTTP/gRPC/DB grátis em minutos. Depois adicione custom attrs.
- **Configure SDK NO ENTRY-POINT** — antes de qualquer outro require/import. Caso contrário, instrumentation patches não pegam.
- **Use OTLP como wire format** — porta 4318 (HTTP) ou 4317 (gRPC). É o padrão; todos os backends modernos aceitam.
- **Collector como sidecar** — em produção, app envia OTLP para Collector local (porta 4318). Collector roteia para destino final. Permite trocar destino sem redeploy.
- **Tracer name = component name** — `trace.getTracer('orders-service')`, não `trace.getTracer('default')`.
- **Resource attributes obrigatórios** — `service.name`, `service.version`, `deployment.environment`. Setados 1× no SDK setup.
- **Não polua o tracer global** — em libs, exponha como parâmetro ou use named tracer. Não dependa de tracer global.

## Componentes OTel

| Componente | Responsabilidade | Exemplo de uso |
|---|---|---|
| **API** | Especificação (interface) | `import { trace } from '@opentelemetry/api'` |
| **SDK** | Implementação concreta | `import { NodeSDK } from '@opentelemetry/sdk-node'` |
| **Tracer** | Cria e gerencia spans | `trace.getTracer('my-service')` |
| **Meter** | Cria e gerencia métricas | `metrics.getMeter('my-service')` |
| **Context propagation** | Serializa/extrai contexto entre services | `propagation.inject()`, `propagation.extract()` |
| **Exporter** | Envia dados para backend | `OTLPTraceExporter`, `JaegerExporter`, etc. |
| **Collector** | Proxy/sidecar standalone | Binário `otelcol` |
| **OTLP** | Wire protocol default | HTTP 4318, gRPC 4317, Protobuf |

## Patterns canônicos

### Pattern: SDK setup Node.js (entry-point)

```ts
// PT-BR: arquivo `instrumentation.ts` — IMPORTAR ANTES de qualquer outra coisa
// Em package.json: "node --import ./instrumentation.ts ./src/index.ts"
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'orders-service',
    [ATTR_SERVICE_VERSION]: process.env.BUILD_ID ?? 'dev',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',  // PT-BR: Collector local
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 10_000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()

// PT-BR: graceful shutdown — flush pending traces
process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0))
})
```

### Pattern: SDK setup Deno (Edge Function)

```ts
// PT-BR: setup OTel em Edge Function — pode ser arquivo `_otel.ts` importado primeiro
import { NodeSDK } from 'npm:@opentelemetry/sdk-node@0.55.0'
import { OTLPTraceExporter } from 'npm:@opentelemetry/exporter-trace-otlp-http@0.55.0'
import { resourceFromAttributes } from 'npm:@opentelemetry/resources@1.27.0'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'edge-process-emails',
    'service.version': Deno.env.get('SUPABASE_GIT_SHA') ?? 'local',
    'deployment.environment': Deno.env.get('SUPABASE_ENV') ?? 'production',
  }),
  traceExporter: new OTLPTraceExporter({
    // PT-BR: em Supabase, OTLP collector pode rodar como sidecar ou
    //         enviar direto para destino externo (Honeycomb, etc.)
    url: Deno.env.get('OTLP_ENDPOINT') ?? 'http://localhost:4318/v1/traces',
    headers: {
      // PT-BR: backends comerciais usam header de auth aqui
      authorization: `Bearer ${Deno.env.get('OTLP_TOKEN') ?? ''}`,
    },
  }),
})

sdk.start()
```

### Pattern: usar Tracer em código

```ts
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api'

// PT-BR: 1× por arquivo/módulo — nome do componente
const tracer = trace.getTracer('orders-service')

export async function placeOrder(req: Request) {
  return tracer.startActiveSpan(
    'place_order',
    { kind: SpanKind.SERVER },
    async (span) => {
      span.setAttribute('user.id', req.user.id)
      try {
        const order = await db.insertOrder(req.body)
        span.setAttribute('order.id', order.id)
        span.setStatus({ code: SpanStatusCode.OK })
        return order
      } catch (e) {
        span.recordException(e as Error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
        throw e
      } finally {
        span.end()
      }
    }
  )
}
```

### Pattern: usar Meter (métricas)

```ts
import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('orders-service')

// PT-BR: counter para eventos contáveis
const ordersCreated = meter.createCounter('orders.created.total', {
  description: 'Total orders created',
})

// PT-BR: histogram para distribuições (latency)
const orderDuration = meter.createHistogram('orders.duration_ms', {
  description: 'Order placement duration in ms',
  unit: 'ms',
})

export async function placeOrder(req: Request) {
  const start = Date.now()
  try {
    const order = await db.insertOrder(req.body)
    ordersCreated.add(1, {
      'tenant_id': req.user.tenant,
      'customer.tier': req.user.tier,
      'result.success': true,
    })
    return order
  } finally {
    orderDuration.record(Date.now() - start, {
      'tenant_id': req.user.tenant,
    })
  }
}
```

### Pattern: OTel Collector config (otelcol-config.yaml)

```yaml
# PT-BR: collector como sidecar — recebe OTLP, processa, exporta para múltiplos destinos
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024
  # PT-BR: tail-based sampling — 100% errors, 1% successes
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors-policy
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: probabilistic-policy
        type: probabilistic
        probabilistic: { sampling_percentage: 1 }

exporters:
  # PT-BR: para Honeycomb (exemplo)
  otlphttp/honeycomb:
    endpoint: https://api.honeycomb.io
    headers:
      x-honeycomb-team: ${env:HONEYCOMB_API_KEY}
  # PT-BR: para arquivo local — debug
  file:
    path: /var/log/otel-traces.json
  # PT-BR: para Logflare (Supabase)
  otlphttp/logflare:
    endpoint: https://api.logflare.app/otel
    headers:
      x-api-key: ${env:LOGFLARE_API_KEY}

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [tail_sampling, batch]
      exporters: [otlphttp/honeycomb, file]
```

### Pattern: rodar Collector via Docker (dev)

```bash
# PT-BR: Collector local com config customizado
docker run -p 4317:4317 -p 4318:4318 \
  -v "$(pwd)/otelcol-config.yaml":/etc/otelcol/config.yaml \
  -e HONEYCOMB_API_KEY="$HONEYCOMB_API_KEY" \
  otel/opentelemetry-collector:latest \
  --config=/etc/otelcol/config.yaml
```

### Pattern: tracegen — testar pipeline

```bash
# PT-BR: gera 100 traces sintéticos, 10/segundo, valida que pipeline está vivo
go install github.com/open-telemetry/opentelemetry-collector-contrib/cmd/telemetrygen@latest
telemetrygen traces --otlp-insecure --otlp-endpoint=localhost:4317 --traces 100 --rate 10
```

## Anti-patterns

### ANTI: configurar SDK depois de imports

```ts
// PT-BR: BAD — instrumentation patches não pegam código já carregado
import express from 'express'   // express já carregado, sem patches OTel
import { NodeSDK } from '@opentelemetry/sdk-node'
new NodeSDK({...}).start()       // tarde demais

// PT-BR: GOOD — SDK no entry-point com `--import`
// node --import ./instrumentation.ts ./src/index.ts
// (instrumentation.ts inicializa SDK antes de qualquer outro código)
```

### ANTI: usar SDK em libs

```ts
// PT-BR: BAD — lib importa SDK, força app a usar mesma versão
import { NodeSDK } from '@opentelemetry/sdk-node'  // em uma lib

// PT-BR: GOOD — lib só importa API, app traz SDK
import { trace } from '@opentelemetry/api'  // lib usa só API
```

### ANTI: tracer global anônimo

```ts
// PT-BR: BAD — sem nome de componente, dificulta filtrar por service em queries
const tracer = trace.getTracer('default')

// PT-BR: GOOD — nome do component
const tracer = trace.getTracer('orders-service')
```

### ANTI: backend proprietary direto

```ts
// PT-BR: BAD — code aplicacional acoplado a vendor
import { Datadog } from 'dd-trace'  // 6 meses depois quer trocar = refactor massivo

// PT-BR: GOOD — OTel + exporter trocável via config
import { trace } from '@opentelemetry/api'
// trocar backend = trocar exporter no SDK setup, não código
```

### ANTI: instrumentar sem resource attributes

```ts
// PT-BR: BAD — sem service.name, query SELECT WHERE service = ? não funciona
new NodeSDK({ traceExporter: ... })

// PT-BR: GOOD — resource sempre presente
new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'orders-service',
    'service.version': BUILD_ID,
    'deployment.environment': ENV,
  }),
  traceExporter: ...
})
```

### ANTI: enviar OTLP direto para múltiplos backends

```ts
// PT-BR: BAD — app conhece todos os destinos (Honeycomb, Datadog, Logflare)
//                 redeploy obrigatório para mudar destino
new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: 'https://honeycomb.io...' }),
})

// PT-BR: GOOD — app envia para Collector local; Collector roteia
new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }),
})
// PT-BR: Collector decide para onde mandar (Honeycomb + Logflare + arquivo) via config
```

## Verificação

1. **SDK iniciou** — log no setup: "OTel SDK started for service=orders-service version=...". Sem isso, traces não saem.
2. **Auto-instrumentation ativa** — fazer 1 request HTTP via fetch ou axios → span aparece em `select * from spans` sem código manual.
3. **OTLP sendo enviado** — `tcpdump port 4318` durante request real → tráfego POST visível.
4. **Resource attributes corretos** — `select distinct service_name, service_version FROM spans` → resultado esperado.
5. **Tracer custom funciona** — adicionar `tracer.startSpan('custom')` → span aparece queryable.
6. **Collector roteando** — fazer request → trace aparece em DESTINO 1 (Honeycomb) e DESTINO 2 (arquivo local) simultaneamente.
7. **Graceful shutdown** — `kill -TERM` no app → SDK flush pendente; sem traces perdidos no shutdown.

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — termos OTel canônicos
- `kit/skills/structured-events/SKILL.md` — campos canônicos por span
- `kit/skills/distributed-tracing/SKILL.md` — context propagation cross-service
- `kit/skills/telemetry-pipelines/SKILL.md` *(Phase 34)* — Collector config avançada
- `kit/skills/telemetry-sampling/SKILL.md` *(Phase 34)* — sampling no Collector

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 7: "Instrumentation with OpenTelemetry".*
