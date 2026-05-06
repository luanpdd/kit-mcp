---
name: telemetry-sampling
description: Use ao reduzir custo de telemetria — head/tail sampling, by-key, dynamic. 100% errors, by-tier para customers, head-based propaga via traceparent.
---

# Observabilidade — Telemetry Sampling

## Quando usar

LLM carrega esta skill ao reduzir custo de telemetria sem perder sinal. Trigger phrases:

- "sampling", "reduzir custo de telemetria"
- "head-based vs tail-based"
- "by-key sampling", "dynamic sampling"
- "100% errors mas só 1% sucessos"
- "trace fica incompleto após sampling"

## Regras absolutas

- **100% dos erros sempre** — sample 100% de eventos com `result.success = false`. Erros são raros e críticos. Nunca sample.
- **100% de paying/enterprise customers** — high-value, baixo volume relativo, debug crucial.
- **Head-based propaga via `traceparent` flag** — decisão tomada no service de entrada, propagada downstream para garantir trace completo.
- **Tail-based requer collector buffer** — decisão pós-trace; impossível de implementar inline em código.
- **Constant probability falha em low volume** — 1/1000 de 100 req/min = 0.1 evento/min, perde tudo.
- **Sample rate gravado no evento** — sem isso, agregações reconstroem totais errados.
- **Errors > success** — categorize: paying customers > free, enterprise > pro > free.
- **Não sample antes de aggregate** — pre-aggregation perde alta cardinalidade. Sample evento bruto, aggregate no read.

## Estratégias canônicas

### Head-based sampling (decisão no início do trace)

```ts
// PT-BR: decisão tomada no service de entrada, propagada via traceparent flag
import { trace, context } from '@opentelemetry/api'
import { TraceFlags } from '@opentelemetry/api'

function shouldSample(event: SpanContext): boolean {
  // PT-BR: 100% errors (head-based: erros raramente são conhecidos no head;
  //         verificar HTTP status no início via header)
  if (event.attributes['result.success'] === false) return true
  
  // PT-BR: 100% enterprise — alto valor
  if (event.attributes['customer.tier'] === 'enterprise') return true
  
  // PT-BR: 10% pro
  if (event.attributes['customer.tier'] === 'pro') return Math.random() < 0.1
  
  // PT-BR: 1% free baseline
  return Math.random() < 0.01
}

// PT-BR: marcar flag sampled no traceparent — propaga para downstream
const flags = shouldSample(event) ? TraceFlags.SAMPLED : TraceFlags.NONE
```

### Tail-based sampling (decisão após trace completar)

```yaml
# PT-BR: OTel Collector config — sampling pós-trace
# 100% errors + outliers de latência + 1% success
processors:
  tail_sampling:
    decision_wait: 10s   # PT-BR: buffer 10s para esperar todos os spans do trace
    policies:
      - name: errors-policy
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: latency-outliers
        type: latency
        latency: { threshold_ms: 1000 }   # PT-BR: > 1s é outlier
      - name: probabilistic-baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 1 }
```

### By-key sampling

```ts
// PT-BR: taxas diferentes por chave — mais preciso que constant
const SAMPLE_RATES: Record<string, number> = {
  // chave: [error.type | endpoint | tenant_id, etc.]
  'error_rate_limit': 0.5,         // PT-BR: 50% (já frequente, mas importante)
  'error_validation': 1.0,         // PT-BR: 100% (raro, debug crítico)
  'tenant_acme-corp': 1.0,         // PT-BR: 100% (big customer)
  'endpoint_/health': 0.001,       // PT-BR: 0.1% (muito frequente, baixo valor)
  'default': 0.05                  // PT-BR: 5% baseline
}

function sampleByKey(event: SpanLike): boolean {
  const errorKey = `error_${event.attributes['error.type']}`
  const tenantKey = `tenant_${event.attributes['tenant_id']}`
  const endpointKey = `endpoint_${event.attributes['endpoint']}`
  
  const rate = SAMPLE_RATES[errorKey]
            ?? SAMPLE_RATES[tenantKey]
            ?? SAMPLE_RATES[endpointKey]
            ?? SAMPLE_RATES['default']
  
  return Math.random() < rate
}
```

### Dynamic sampling (taxa adapta com volume)

```ts
// PT-BR: lookback 30s — quanto traffic veio recentemente?
let recentVolume = 0
setInterval(() => { recentVolume = 0 }, 30_000)

function sampleDynamic(event: SpanLike): boolean {
  recentVolume++
  
  // PT-BR: tráfego baixo → sample mais; tráfego alto → sample menos
  if (recentVolume < 100) return true                  // até 100 spans em 30s, mantém todos
  if (recentVolume < 1000) return Math.random() < 0.1  // até 1k, 10%
  return Math.random() < 0.01                          // > 1k, 1%
}
```

### Combinando: by-key + dynamic + head

```ts
function shouldSample(event: SpanLike): boolean {
  // PT-BR: 1. Errors sempre 100%
  if (event.attributes['result.success'] === false) return true
  
  // PT-BR: 2. Enterprise sempre 100%
  if (event.attributes['customer.tier'] === 'enterprise') return true
  
  // PT-BR: 3. Outras chaves de alto valor
  if (event.attributes['feature_flag.experiment_a'] === true) return true   // experimento ativo
  
  // PT-BR: 4. Dynamic baseline
  return sampleDynamic(event)
}
```

## Patterns canônicos

### Pattern: gravar sample_rate no evento

```ts
// PT-BR: sem sample_rate, agregações no read time não conseguem reconstruir totais
const sampleRate = computeSampleRate(event)
if (Math.random() < sampleRate) {
  span.setAttribute('_sample_rate', sampleRate)   // PT-BR: 0.01 = 1% sampled
  span.setAttribute('_sampled', true)
  // PT-BR: agora o backend pode multiplicar contagens por 1/sample_rate
  exportSpan(span)
}
```

### Pattern: query reconstruindo totais com sample_rate

```sql
-- PT-BR: sem sample_rate, count(*) está errado
-- COM sample_rate, sum(1/_sample_rate) reconstrói total estimado
select
  endpoint,
  sum(1.0 / _sample_rate) as estimated_total,
  count(*) as samples_collected,
  sum(1.0 / _sample_rate) filter (where result_success = false) as estimated_errors
from observability.events
where timestamp > now() - interval '1 hour'
group by endpoint
order by estimated_total desc;
```

### Pattern: sampling para alta cardinalidade

```ts
// PT-BR: cardinalidade alta (millions of users) — não pode sample por user.id
//         mas pode sample por (customer.tier, error.type) — combinação cardin. baixa
function sampleByDimensions(event: SpanLike): number {
  const key = `${event.attributes['customer.tier']}-${event.attributes['error.type'] ?? 'success'}`
  
  const rates: Record<string, number> = {
    'enterprise-success': 0.5,
    'enterprise-error': 1.0,
    'pro-success': 0.1,
    'pro-error': 1.0,
    'free-success': 0.01,
    'free-error': 1.0,
  }
  
  return rates[key] ?? 0.01
}
```

## Anti-patterns

### ANTI: constant probability em low volume

```text
ANTI: app com 100 req/min, sample rate fixo 1/1000 → 0.1 evento/min retidos
       Você verá 1 erro a cada 10 minutos. Sinal perdido.

CERTO: dynamic sampling — alta taxa quando volume baixo, baixa quando alto.
```

### ANTI: sample errors

```text
ANTI: sample 1% de errors junto com 1% de success — erros são 0.5% do tráfego;
       seu sample retém 0.005% de errors total. Praticamente nunca aparecem.

CERTO: 100% errors. SEMPRE. Erros são raros e críticos.
```

### ANTI: sample sem gravar rate

```text
ANTI: sample 1/100 mas evento não tem _sample_rate
       Backend conta literais → count = 1% do real → métricas erradas

CERTO: gravar _sample_rate no evento; agregar com sum(1/rate) no read.
```

### ANTI: tail-based sem collector

```text
ANTI: tentar implementar tail-based em SDK do app — precisa bufferizar todos os spans
       de cada trace, esperar conclusão, decidir, exportar. Memória e latência altas.

CERTO: tail-based requer OTel Collector como sidecar/proxy. App envia 100% para
       Collector; Collector decide via processor `tail_sampling`.
```

### ANTI: head-based sem propagação

```text
ANTI: decisão de sample tomada no service A → não propagada para B → B decide sozinho
       → trace fica incompleto (alguns spans em A, outros em B, sem correlação)

CERTO: marcar TraceFlags.SAMPLED no traceparent; B respeita decisão upstream.
```

## Verificação

1. **Errors 100%** — `select count(*) where result_success=false` × `1/sample_rate` ≈ count real
2. **Enterprise 100%** — verificar via query que enterprise tier tem _sample_rate=1 sempre
3. **Sample rate gravado** — `select count(*) filter (where _sample_rate is null)` = 0
4. **Trace integridade** — head-based: trace tem todos os spans (não 50% missing)
5. **Custo redução real** — bytes/segundo enviado para backend caiu sem perder sinal de error/p99

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — termos sampling
- `kit/skills/distributed-tracing/SKILL.md` — head vs tail decision timing
- `kit/skills/opentelemetry-standard/SKILL.md` — Collector tail_sampling processor
- `kit/skills/event-based-slos/SKILL.md` — SLO precisa de sample_rate para reconstruir totais

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 17: "Cheap and Accurate Enough: Sampling".*
