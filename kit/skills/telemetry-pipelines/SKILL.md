---
name: telemetry-pipelines
cost_tier: leve
description: Guia de arquitetura de telemetry pipeline com OTel Collector — routing multi-destino, buffering, filtering de PII e backpressure. Use ao desenhar ou auditar pipelines de coleta/transporte.
---

# Observabilidade — Telemetry Pipelines

## Quando usar

LLM carrega esta skill ao desenhar pipeline de telemetria. Trigger phrases:

- "OTel Collector", "telemetry pipeline"
- "routing de telemetria"
- "buffering, filtering, transformation"
- "build vs buy de pipeline"
- "1 backend ou múltiplos"

## Atributos do pipeline (Cap 18)

| Atributo | Significado | Importância |
|---|---|---|
| Routing | Mandar dados a destinos diferentes baseado em conteúdo | Alta |
| Security | TLS + auth headers + audit trail | Alta |
| Workload isolation | Erros num destino não afetam outros | Alta |
| Buffering | Tolerar lentidão temporária | Alta |
| Capacity management | Backpressure quando upstream lento | Alta |
| Data filtering | Drop dados sensíveis antes de export | Média-Alta |
| Data augmentation | Adicionar resource attributes (region, env) | Média |
| Data transformation | Renomear campos, normalizar formatos | Média |
| Quality | Validação de schema | Média |

## Regras absolutas

- **App envia para sidecar/Collector local** — nunca direto para backend remoto. Trocar destino = config no Collector, não redeploy do app.
- **OTel Collector é o default** — vendor-neutral, plug-in arquitetura. Usar pipelines proprietários (vendor agent) cria lock-in.
- **Multi-destino é normal** — 1 mesmo trace pode ir para Honeycomb (debug), Logflare (compliance), arquivo local (dev) simultaneamente.
- **Buffering é obrigatório** — destinos remotos têm hiccups; sem buffer, perde dados.
- **Filtragem por security/compliance** — drop campos PII antes de export externo. PII em arquivo local = ok; em vendor remoto = problema legal.
- **Workload isolation** — erro/lentidão em 1 destino não bloqueia outros. Use exporters paralelos no Collector.
- **Capacity managemement** — Collector deve ter limites de buffer e graceful drop quando saturado (não OOM).

## Patterns canônicos

### Pattern: Collector config canônico (multi-destino)

```yaml
# PT-BR: otel-collector-config.yaml — recebe OTLP, processa, roteia
receivers:
  otlp:
    protocols:
      http: { endpoint: 0.0.0.0:4318 }
      grpc: { endpoint: 0.0.0.0:4317 }

processors:
  # PT-BR: batch para reduzir round-trips
  batch:
    timeout: 10s
    send_batch_size: 1024
  
  # PT-BR: tail sampling — 100% errors, 1% baseline
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 1 }
  
  # PT-BR: filter PII — drop campos sensíveis antes de export remoto
  attributes/redact_pii:
    actions:
      - key: user.email
        action: hash         # hash em vez de drop — mantém cardinalidade
      - key: user.cpf
        action: delete
      - key: credit_card.number
        action: delete
  
  # PT-BR: augment com resource attributes
  resource:
    attributes:
      - key: deployment.environment
        value: ${env:NODE_ENV}
        action: insert
      - key: cloud.region
        value: ${env:AWS_REGION}
        action: insert

exporters:
  # PT-BR: para Honeycomb (debug)
  otlphttp/honeycomb:
    endpoint: https://api.honeycomb.io
    headers:
      x-honeycomb-team: ${env:HONEYCOMB_API_KEY}
  
  # PT-BR: para Logflare (Supabase compliance)
  otlphttp/logflare:
    endpoint: https://api.logflare.app/otel
    headers:
      x-api-key: ${env:LOGFLARE_API_KEY}
  
  # PT-BR: arquivo local — debug local, retain 7d
  file:
    path: /var/log/otel/traces.json
    rotation:
      max_megabytes: 100
      max_days: 7
      max_backups: 10

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [tail_sampling, attributes/redact_pii, resource, batch]
      exporters: [otlphttp/honeycomb, otlphttp/logflare, file]
    metrics:
      receivers: [otlp]
      processors: [resource, batch]
      exporters: [otlphttp/honeycomb]
    logs:
      receivers: [otlp]
      processors: [attributes/redact_pii, batch]
      exporters: [otlphttp/logflare, file]
  
  # PT-BR: telemetria do collector próprio (meta-observability)
  telemetry:
    logs:
      level: info
    metrics:
      level: detailed
      address: 0.0.0.0:8888
```

### Pattern: routing por conteúdo

```yaml
# PT-BR: rotear traces para destinos diferentes baseado em service.name
processors:
  routing/service:
    from_attribute: service.name
    table:
      - value: orders-service
        exporters: [otlphttp/honeycomb]
      - value: payments-service
        exporters: [otlphttp/honeycomb, otlphttp/datadog]   # 2 destinos
    default_exporters: [file]
```

### Pattern: backpressure

```yaml
# PT-BR: limit memory + drop oldest se saturar
processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 1500            # PT-BR: drop quando passar de 1.5 GB
    spike_limit_mib: 512       # PT-BR: tolerância a spikes de 512 MB

service:
  pipelines:
    traces:
      processors: [memory_limiter, ...]   # PT-BR: PRIMEIRO no pipeline
```

### Pattern: build vs buy

```text
PT-BR: critérios para construir vs comprar pipeline (Cap 18 p239):

CONSTRUIR (próprio Collector custom) se:
  - Volume > 10M spans/segundo (vendors caros nesse range)
  - Compliance específico que vendor não cobre
  - 5+ engineers full-time disponíveis para ops

COMPRAR (vendor managed: Honeycomb / Datadog / etc.) se:
  - Volume < 1M spans/segundo
  - Time pequeno (≤ 3 engineers)
  - Compliance geral (SOC2, GDPR — vendors já cobrem)

HÍBRIDO (default recomendado):
  - OTel Collector (open source) como sidecar local
  - Backend SaaS como destino primary
  - File local como secondary (compliance/debug)
```

## Anti-patterns

### ANTI: app envia direto para backend remoto

```text
ANTI: SDK exporta direto para api.honeycomb.io
       Trocar para Datadog = redeploy de TODOS os services
       Pipeline vai abaixo se backend tem hiccup → app trava

CERTO: app → localhost:4318 (Collector) → roteamento múltiplo
       Trocar destino = editar Collector config; sem redeploy
```

### ANTI: 1 destino monolítico

```text
ANTI: Honeycomb único destino para tudo
       Vendor outage = visibilidade total perdida
       Compliance pode exigir cópia em region específica

CERTO: Honeycomb (debug) + Logflare (compliance) + file (local)
       Cada destino independente; falha em 1 não afeta outros
```

### ANTI: sem PII filter antes de export remoto

```text
ANTI: spans com `user.email`, `user.cpf` enviados literalmente para vendor SaaS
       GDPR / LGPD violado; vendor outage = leak

CERTO: processor `attributes/redact_pii` — hash emails, drop docs.
       Cópia local pode reter para debug interno; remoto vê só hash.
```

### ANTI: sem buffering

```text
ANTI: sync export — cada span é POST imediato
       Backend latência = app latência sobe
       Backend down = spans perdidos

CERTO: batch processor (10s ou 1024 spans) + retry
       Buffer absorve hiccups de até segundos sem afetar app
```

### ANTI: vendor agent proprietary

```text
ANTI: instalar dd-agent / new-relic-agent / etc. em todos os hosts
       Vendor lock-in; trocar = reinstrumentar tudo

CERTO: OTel SDK + OTel Collector
       Vendor é apenas o destino do exporter; trocar = mudar 1 linha de config
```

## Verificação

1. **App configurado para localhost:4318** — `select * from connections` deve mostrar app→Collector apenas
2. **Multi-destino funciona** — fazer 1 request → trace aparece em Honeycomb + Logflare + file simultaneamente
3. **Filter PII testado** — span com user.email=foo@x.com → no destino remoto, atributo é hash, não literal
4. **Backpressure** — gerar carga sintética acima do limit → Collector dropa, não OOM
5. **Buffer recovery** — desligar destino remoto temporariamente → spans bufferados → ligar → flush

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — telemetry pipeline, routing, buffering
- `kit/skills/opentelemetry-standard/SKILL.md` — OTel Collector basics
- `kit/skills/telemetry-sampling/SKILL.md` — tail_sampling processor

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 18: "Telemetry Management with Pipelines".*
