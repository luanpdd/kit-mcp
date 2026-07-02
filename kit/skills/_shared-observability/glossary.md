# Glossário Observabilidade — Termos, Comandos e Patterns Canônicos

> Arquivo de referência compartilhado pelas skills `observability-*` e `*-events`, `*-tracing`, `*-slo*`, `*-sampling`, `*-pipelines`, `*-maturity-model`. **NÃO é skill** — não tem `description:` triggerável; não aparece em `listKit`. Cross-referenciado pelas skills via Markdown link relativo.

> **Material-fonte:** *Observability Engineering* — Charity Majors, Liz Fong-Jones, George Miranda (O'Reilly, 2022). ISBN 978-1-492-07644-5.

---

## (a) Termos PT-BR ↔ EN

### Conceitos centrais

| EN | PT-BR / Significado |
|---|---|
| **observability** | Observabilidade — capacidade de explicar **qualquer** estado novo do sistema sem precisar fazer novo deploy de instrumentação. Contraste com **monitoring**, que requer prever falhas em advance. |
| **monitoring** | Monitoramento — coleta de métricas pré-definidas para detectar **estados conhecidos** (CPU > 80%, memória < 10%). Insuficiente para distributed systems modernos. |
| **cardinality** | Cardinalidade — número de valores únicos possíveis em um campo. `user.id` em app com 1M usuários = cardinalidade 1M. **Alta cardinalidade é essencial** para observabilidade. |
| **dimensionality** | Dimensionalidade — número de campos/atributos em um evento. Wide events têm alta dimensionalidade (100+ campos). |
| **first principles** | Primeiros princípios — raciocínio do zero sobre o sistema, sem assumir nada. Base do `core-analysis-loop`. |
| **wide event** | Evento amplo — 1 evento por request com muitos campos (alta dimensionalidade) e alta cardinalidade. **Building block** da observabilidade (cap 5). |

### Telemetria

| EN | PT-BR / Significado |
|---|---|
| **structured event** | Evento estruturado — registro tipado com campos nomeados (JSON ou similar). Contrário de log unstructured (texto livre). |
| **trace** | Rastro distribuído — coleção de spans relacionados por `trace_id` que descreve o caminho completo de um request através de múltiplos serviços. |
| **span** | Span — unidade de trabalho dentro de um trace. Identificada por `span_id` único; aponta para `parent_span_id`. |
| **trace_id** | Identificador único do trace (32 hex chars / 16 bytes). Compartilhado entre todos os spans do mesmo trace. |
| **span_id** | Identificador único do span (16 hex chars / 8 bytes). |
| **parent_span_id** | `span_id` do span pai. Null no root span. Define a árvore de spans. |
| **W3C TraceContext** | Padrão W3C para propagar contexto cross-service via header HTTP `traceparent: 00-{trace_id}-{span_id}-{flags}`. |
| **B3 / B3M** | Padrão Zipkin de propagação. Headers `X-B3-TraceId`, `X-B3-SpanId`, `X-B3-Sampled`. Suporte secundário em OTel. |
| **stitching** | Costura — ligar spans relacionados em um trace via `trace_id` + `parent_span_id`. Funciona além de RPCs (batch jobs, lambdas, S3 uploads). |
| **context propagation** | Propagação de contexto — mecanismo de OTel SDK que serializa/deserializa contexto entre services (header HTTP, gRPC metadata, queue message attrs). |
| **head-based sampling** | Sampling no início — decisão de sample tomada quando trace é iniciado (no service de entrada). Propagada via flag em `traceparent`. |
| **tail-based sampling** | Sampling no fim — decisão tomada após trace completar (requer buffer/collector). Permite manter erros + outliers preservando custo. |

### OpenTelemetry

| EN | PT-BR / Significado |
|---|---|
| **OTel** | OpenTelemetry — projeto CNCF, união de OpenTracing + OpenCensus (2019). Padrão vendor-neutral para telemetria. |
| **OTel API** | Especificação que devs usam para instrumentar (sem implementação). |
| **OTel SDK** | Implementação concreta da API: state, batching, exportação. |
| **Tracer** | Componente do SDK que cria/gerencia spans. |
| **Meter** | Componente do SDK que cria/gerencia métricas. |
| **Exporter** | Plug-in do SDK que traduz dados in-memory em formato de destino (OTLP, Jaeger, Prometheus, vendor-specific). |
| **OTLP** | OpenTelemetry Protocol — wire format default. HTTP em porta 4318; gRPC em 4317. Protobuf schema. |
| **Collector** | Binário standalone (proxy/sidecar) que recebe telemetria, processa e roteia para múltiplos destinos. |
| **auto-instrumentation** | Instrumentação automática via wrappers/middleware (HTTP, gRPC, DB drivers). Time-to-first-value baixo. |
| **custom instrumentation** | Instrumentação manual com atributos de business logic (`customer.tier`, `feature_flag`, `experiment_arm`). |

### SLOs e Burn Rate

| EN | PT-BR / Significado |
|---|---|
| **SLI** | Service-Level Indicator — métrica que classifica eventos como "good" ou "bad". Deve ser **event-based**, não time-based. |
| **SLO** | Service-Level Objective — meta interna de SLI (ex: 99.9% das requests com `result.success = true` em 30 dias). |
| **SLA** | Service-Level Agreement — acordo externo com cliente/usuário. Geralmente menos rígido que SLO interno. |
| **error budget** | Orçamento de erro — fração de eventos "bad" tolerável dentro de um SLO (ex: SLO 99.9% → 0.1% de budget). |
| **burn rate** | Taxa de queima — velocidade com que o error budget está sendo consumido. Burn rate 1 = budget durará a janela exata; burn rate 10 = budget acaba 10× mais rápido. |
| **sliding window** | Janela deslizante — recorte de tempo que avança continuamente (ex: últimos 30d). Recomendado vs **fixed window** (calendário). |
| **fixed window** | Janela fixa — recorte alinhado ao calendário (ex: dia 1 a 30 do mês). Anti-pattern: cliente não esquece bug do dia 30 só porque virou mês. |
| **lookahead window** | Janela de previsão — quanto tempo no futuro o burn alert prevê (ex: alert se vai esgotar em 4h). |
| **baseline window** | Janela de base — quanto tempo passado é usado para calcular burn atual (ex: últimos 1h). Regra: lookahead ≤ 4× baseline sem ajuste de seasonality. |
| **predictive burn alert** | Alerta preditivo — dispara quando taxa atual prevê esgotamento dentro do lookahead. Mais cedo que zero-level. |
| **context-aware burn alert** | Alerta com contexto — leva em conta budget remanescente (10% restante = mais urgente que 90%). Mais caro computacionalmente. |
| **short-term burn alert** | Alerta de curto prazo — só extrapola baseline recente, ignora budget total. Mais barato. |

### Observability-Driven Development (ODD)

| EN | PT-BR / Significado |
|---|---|
| **ODD** | Observability-Driven Development — análogo a TDD mas para production. Bundle telemetria com feature; valide em prod, não só em testes. |
| **shift-left observability** | Empurrar observabilidade para a esquerda do SDLC — instrumentar **antes** do PR, não depois do incident. |
| **production as glass castle** | Anti-pattern — equipes têm medo de mexer em prod porque não conseguem entender o que acontece lá. ODD transforma em "interactive playground". |
| **auto-page the merger** | Padrão — paginar automaticamente quem mergeou o PR por 30-60min após deploy. Tighten feedback loop. |
| **decoupling deployments from releases** | Separar deploy de release — feature flags, progressive delivery. Permite observar comportamento antes de expor a 100%. |

### Sampling e Pipelines

| EN | PT-BR / Significado |
|---|---|
| **constant probability sampling** | Sampling com probabilidade fixa (ex: 1 em 1000). Falha em low volume — eventos raros desaparecem. |
| **dynamic sampling** | Sampling adaptativo — taxa muda com volume de tráfego ou conteúdo do evento. |
| **by-key sampling** | Sampling por chave — taxa diferente por valor de campo (ex: 100% de erros, 1% de sucessos, 50% de paying customers). |
| **telemetry pipeline** | Pipeline de telemetria — sequência de stages (receive → process → route → export). OTel Collector é exemplo. |
| **routing** | Roteamento — mandar telemetria para destinos diferentes baseado em conteúdo (severity, tenant). |
| **buffering** | Buffer — armazenar temporariamente para tolerar falhas/lentidão downstream. |

### Observability Maturity Model (OMM)

| EN | PT-BR / Significado |
|---|---|
| **OMM** | Observability Maturity Model — framework de 5 capacidades para avaliar maturidade de observabilidade de um time/projeto. |
| **resilience capability** | Capacidade de resiliência — responder a falhas com recovery mensurável (MTTR, on-call burden). |
| **code quality capability** | Capacidade de qualidade de código — observability ajuda a fechar feedback loop entre dev e prod. |
| **complexity capability** | Capacidade de manejar complexidade — encontrar gargalos sem chutes; debugging em sistemas grandes. |
| **release cadence capability** | Capacidade de cadência de release — métrica chave: tempo do commit ao prod. |
| **user behavior capability** | Capacidade de entender comportamento de usuário — observability data ≈ behavioral data + technical data. |

---

## (b) Comandos canônicos

### OpenTelemetry CLI

```bash
# Receiver/exporter dev — local OTel Collector via Docker
docker run -p 4317:4317 -p 4318:4318 \
  -v "$(pwd)/otelcol-config.yaml":/etc/otelcol/config.yaml \
  otel/opentelemetry-collector:latest

# Validar config OTLP
otelcol validate --config=otelcol-config.yaml

# Tracegen — gera traces sintéticos para testar pipelines
telemetrygen traces --otlp-insecure --traces 100 --rate 10
```

### Supabase / Postgres — queries para SLI events

```sql
-- PT-BR: SLI event-based — boa request = HTTP 2xx + duration < 300ms
-- Materializa contagem em view para alimentar burn rate
create or replace view obs.sli_endpoint_home as
select
  date_trunc('minute', created_at) as bucket,
  count(*) filter (where status_code < 400 and duration_ms < 300) as good,
  count(*) filter (where status_code >= 400 or duration_ms >= 300) as bad,
  count(*) as total
from obs.events
where event_name = 'http_request' and path = '/home'
group by bucket;

-- PT-BR: burn rate atual com janela deslizante 1h
select
  sum(bad)::float / nullif(sum(total), 0) as error_rate,
  (sum(bad)::float / nullif(sum(total), 0)) / (1 - 0.999) as burn_rate
from obs.sli_endpoint_home
where bucket >= now() - interval '1 hour';
```

### Logflare (Supabase logs platform) — equivalentes

```bash
# CLI logflare — buscar eventos
supabase logs api --filter "request.path=/home" --limit 100

# Via SQL no schema 'logs'
select metadata->>'request.path', count(*) 
from logs.edge_function_logs 
where timestamp > now() - interval '1h'
group by 1;
```

### MCP tools Supabase (canônico kit-mcp)

```text
mcp__supabase__get_logs            — logs por service (api, postgres, edge-function, auth)
mcp__supabase__execute_sql         — query SQL para validar hipóteses
mcp__supabase__get_advisors        — security/performance lints
mcp__supabase__list_tables         — schema atual
mcp__supabase__apply_migration     — aplicar migration que materializa SLI events
```

---

## (c) Patterns canônicos

### Pattern: campos canônicos em wide events

Convenção de nomes para atributos OTel/JSON estruturado (dot notation). **Use sempre estes nomes** ao instrumentar:

| Campo | Tipo | Exemplo | Por quê |
|---|---|---|---|
| `user.id` | uuid | `"550e8400-e29b-41d4-..."` | Cardinalidade alta — debug por usuário |
| `tenant_id` | uuid/text | `"acme"` | Multi-tenancy — debug por tenant |
| `request.id` | uuid v4 | `"req_abc123"` | Correlação — propagado via header `x-request-id` |
| `result.success` | bool | `true` / `false` | SLI event-based — bom/mau |
| `error.type` | enum | `"timeout"`, `"validation"`, `"auth"`, `"rate_limit"`, `"db"` | Categoria de erro — filtragem rápida |
| `error.message` | text | `"connection refused"` | Debug — não usado em SLI |
| `duration_ms` | int | `127` | Latência — sempre milissegundos |
| `build_id` | text | `"abc123f"` ou `"v1.9.0"` | Debug — comparar versões |
| `feature_flag.<name>` | bool | `feature_flag.new_checkout: true` | Experimentação — slice/dice |
| `customer.tier` | enum | `"free"`, `"pro"`, `"enterprise"` | Priorização — sample diferente |
| `endpoint` | text | `"/api/v1/orders"` | Agrupamento — by-route |
| `http.status_code` | int | `200`, `404`, `503` | SLI — código HTTP |

### Pattern: estrutura de span OTel

```ts
// PT-BR: instrumentação canônica de handler com atributos custom
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('checkout-service')

export async function placeOrder(req: Request) {
  return tracer.startActiveSpan('place_order', async (span) => {
    // PT-BR: atributos canônicos sempre
    span.setAttribute('user.id', req.user.id)
    span.setAttribute('tenant_id', req.tenant)
    span.setAttribute('customer.tier', req.user.tier)
    span.setAttribute('request.id', req.id)

    try {
      const order = await db.insertOrder(req.body)
      span.setAttribute('result.success', true)
      span.setAttribute('order.id', order.id)
      return order
    } catch (e) {
      span.setAttribute('result.success', false)
      span.setAttribute('error.type', classify(e))  // 'validation' | 'db' | 'rate_limit'
      span.setAttribute('error.message', e.message)
      throw e
    } finally {
      span.end()  // PT-BR: SEMPRE em finally — duration_ms calculado aqui
    }
  })
}
```

### Pattern: SLI event-based vs time-based

```ts
// PT-BR: BAD — time-based SLI (anti-pattern)
// "p99 latency < 300ms over each 5-minute window"
// Problema: 5 min de violação no fim de uma janela some quando janela vira

// PT-BR: GOOD — event-based SLI
// "proportion of events with duration < 300ms in last 30d"
function isGoodEvent(event: HttpEvent): boolean {
  return event.status_code < 400 && event.duration_ms < 300
}

// PT-BR: contagem para SLO
const total = events.length
const good = events.filter(isGoodEvent).length
const slo_compliance = good / total  // ≥ 0.999 para SLO 99.9%
```

### Pattern: Core Analysis Loop em prosa

```text
1. SINTOMA: alerta dispara — "checkout SLO burn rate = 8 (4× acima de 2)"

2. HIPÓTESE inicial (de dados, NÃO intuição):
   - Query 1: GROUP BY error.type — qual erro domina?
   - Resultado: error.type = 'rate_limit' representa 78% dos eventos bad

3. VALIDAÇÃO/REFINAMENTO:
   - Query 2: GROUP BY tenant_id WHERE error.type = 'rate_limit'
   - Resultado: tenant_id = 'acme' representa 95% dos rate_limits

4. PRÓXIMA ITERAÇÃO:
   - Query 3: GROUP BY endpoint WHERE tenant_id = 'acme' AND error.type = 'rate_limit'
   - Resultado: endpoint = '/api/v1/bulk_orders' = 100%
   - ROOT CAUSE: tenant acme está fazendo bulk orders acima do quota.
   - AÇÃO: aumentar quota OU contactar acme OU adicionar backpressure.
```

---

## (d) Anti-patterns explícitos

### Dashboard-flipping

```text
ANTI-PATTERN: ver spike num dashboard, abrir 12 outros dashboards, procurar visualmente
                por "shape similar" para identificar correlação.

POR QUÊ É RUIM: pattern matching humano não escala; depende de dashboards pré-criados;
                não funciona para emergent failures (Cap 8).

CERTO: usar Core Analysis Loop — partir de uma query, refinar com GROUP BY iterativo,
       chegar à root cause via dados.
```

### Cause-based alerts

```text
ANTI-PATTERN: alertar em CPU > 80%, memória < 10%, threads > N, etc.
              Misturar "what" (sintoma) com "why" (causa raiz).

POR QUÊ É RUIM: gera false positives (cron job legítimo dispara CPU alta);
                gera false negatives (sistema lento sem CPU alta);
                normalização do desvio (Cap 12 — "Challenger disaster").

CERTO: alertar APENAS em SLO burn rate (event-based, customer-impacting).
       Decouple "what" de "why" — alert diz que tem dor, debug descobre porquê.
```

### Fixed-window error budget

```text
ANTI-PATTERN: error budget reseta dia 1 do mês.
              "Tivemos outage dia 31, mas reseta amanhã."

POR QUÊ É RUIM: clientes não esquecem outage por causa de calendar reset;
                gera comportamento perverso (postpone fix para depois do reset);
                dificulta planejamento de capacidade.

CERTO: sliding window 30d.
       Outage dia 31 ainda conta no budget até dia 30 do mês seguinte (sai gradualmente).
```

### Constant probability sampling em low volume

```text
ANTI-PATTERN: sample rate fixo 1/1000 mesmo para erros.

POR QUÊ É RUIM: se você tem 1000 req/min e 1% de erro = 10 erros/min,
                samplados 1/1000 = 0.01 erros/min = perde sinal de erro.

CERTO: by-key sampling — 100% de erros, 1% de sucessos.
       Em low volume, prefira capturar tudo ou usar dynamic sampling.
```

### AIOps como solução

```text
ANTI-PATTERN: comprar "AIOps platform" para agrupar/suprimir/processar alertas.

POR QUÊ É RUIM: você está pagando para mascarar normalização do desvio (Cap 12).
                ML não cria sinal onde não há — apenas filtra ruído de alertas
                que não deveriam existir em primeiro lugar.

CERTO: deletar alertas inúteis. Migrar para SLO-based alerting (Cap 12).
       Investir em observability tooling, não em alert noise reduction.
```

### Time-based SLI

```text
ANTI-PATTERN: "99% das janelas de 5 minutos têm p99 < 300ms"

POR QUÊ É RUIM: pre-aggregation perde fidelidade; janela com 1 outlier puxa p99 acima
                mesmo com 99.9% das requests boas; difícil de compor com error budget.

CERTO: event-based SLI — "99.9% dos eventos individuais têm duration < 300ms".
```

### Observability como debugger

```text
ANTI-PATTERN: usar observability tool para debugar lógica de função (line-by-line).

POR QUÊ É RUIM: scale errado — emitir 1 evento por linha de código gera GB/min e
                custa 10× o sistema observado (Cap 11).

CERTO: observability é para ENCONTRAR ONDE debugar (qual service, qual hop, qual versão).
       Para line-level use debugger (gdb, pdb) ou profiler.
```

### Glass castle production

```text
ANTI-PATTERN: equipe tem medo de mexer em produção porque "qualquer mexida quebra tudo".

POR QUÊ É RUIM: feature freeze efetivo; rollback automático sem entender;
                deploys raros que batchean N changes (cada deploy é alto risco).

CERTO: ODD — bundle telemetria com feature; deploy frequente + observable;
       pequenas mudanças isoladas; auto-page do merger por 30-60min.
```

---

## (e) Cross-references

Skills que consultam este glossário:

- `kit/skills/structured-events/SKILL.md`
- `kit/skills/distributed-tracing/SKILL.md`
- `kit/skills/opentelemetry-standard/SKILL.md`
- `kit/skills/core-analysis-loop/SKILL.md`
- `kit/skills/observability-driven-development/SKILL.md` *(Phase 30)*
- `kit/skills/event-based-slos/SKILL.md` *(Phase 32)*
- `kit/skills/burn-rate-alerting/SKILL.md` *(Phase 32)*
- `kit/skills/telemetry-sampling/SKILL.md` *(Phase 34)*
- `kit/skills/telemetry-pipelines/SKILL.md` *(Phase 34)*
- `kit/skills/observability-maturity-model/SKILL.md` *(Phase 34)*

Agentes que consultam este glossário:

- `kit/agents/observability-instrumenter.md` *(Phase 30)*
- `kit/agents/incident-investigator.md` *(Phase 30)*
- `kit/agents/slo-engineer.md` *(Phase 32)*
- `kit/agents/burn-rate-forecaster.md` *(Phase 32)*
- `kit/agents/omm-auditor.md` *(Phase 34)*

---

*Glossário criado em 2026-05-06 (Phase 29 do milestone v1.9 Observabilidade).*
*Material-fonte: Observability Engineering — O'Reilly, 2022 (978-1-492-07644-5).*
