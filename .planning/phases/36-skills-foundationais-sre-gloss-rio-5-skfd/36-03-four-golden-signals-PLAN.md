---
phase: 36
plan: 03
title: Skill four-golden-signals — Latency/Traffic/Errors/Saturation (cap 6)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/skills/four-golden-signals/SKILL.md
requirements: [SKFD-SRE-02]
status: ready
---

# Plan 03 — Skill `four-golden-signals/SKILL.md`

## Goal

Criar `kit/skills/four-golden-signals/SKILL.md` documentando o capítulo 6 do livro Google SRE — *Monitoring Distributed Systems*. Os 4 sinais dourados universais (Latency, Traffic, Errors, Saturation), distinção black-box vs white-box monitoring, latência success vs error SEMPRE separadas, percentis (p50/p95/p99/p99.9) NUNCA mean, histograms com bucketing exponencial. Skill auto-contida — base de instrumentação para Phase 37 agente `golden-signals-instrumenter` e Phase 38 comando `/golden-signals`.

## Files to create

- `D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: four-golden-signals` + `description ≤ 200 chars` (anti-pitfall A2)
- **NÃO criar pasta `references/`** (anti-pitfall A8)
- 5 seções canônicas: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Verificação`, `## Ver também`
- Skill auto-contida — não fazer LLM ler outra skill para entender o conteúdo
- Verificar que skill `four-golden-signals` NÃO existe ainda (planning_context "CHECK if already exists from v1.9" — confirmado: não existe — somente skills `structured-events`, `distributed-tracing`, `opentelemetry-standard`, `core-analysis-loop`, `observability-driven-development`, `event-based-slos`, `burn-rate-alerting`, `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model` existem)

## Tasks

<task id="36-03-T1" name="Frontmatter + Quando usar">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/observability-driven-development/SKILL.md (linhas 1-20 — shape de frontmatter + Quando usar)
    - D:/projetos/opensource/mcp/kit/skills/structured-events/SKILL.md (precedente sibling — observability skill)
  </read_first>
  <action>
    Verificar primeiro que `kit/skills/four-golden-signals/` NÃO existe (Glob check). Se existir, ABORTAR (planning_context flagged check).

    Escrever frontmatter + `## Quando usar`:

    ```markdown
    ---
    name: four-golden-signals
    description: Use ao instrumentar serviço user-facing — Latency + Traffic + Errors + Saturation, percentis (não mean), histogram exponencial, latência success vs error separadas.
    ---

    # SRE — Four Golden Signals

    ## Quando usar

    LLM carrega esta skill ao instrumentar Edge Function/serviço/microservice user-facing. Trigger phrases:

    - "golden signals", "4 sinais dourados"
    - "latency, traffic, errors, saturation"
    - "instrumentar serviço", "métricas mínimas"
    - "p99 latency", "percentis vs mean"
    - "black-box vs white-box monitoring"
    - "Google SRE cap 6"
    - "Latency success vs error"
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Diretório `kit/skills/four-golden-signals/` NÃO existia antes (verificação prévia)
    - Arquivo `kit/skills/four-golden-signals/SKILL.md` criado
    - Frontmatter contém `name: four-golden-signals` e `description` ≤ 200 chars
    - Seção `## Quando usar` contém pelo menos 5 trigger phrases incluindo "golden signals", "p99 latency", "black-box vs white-box"
  </acceptance_criteria>
</task>

<task id="36-03-T2" name="Regras absolutas — 8 princípios canônicos cap 6">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 19-28 — shape de "Regras absolutas")
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção Four Golden Signals — após Plan 01 T2)
  </read_first>
  <action>
    Adicionar seção `## Regras absolutas` com 8 bullets:

    ```markdown
    ## Regras absolutas

    - **4 sinais são universais para serviço user-facing** — Latency + Traffic + Errors + Saturation. Se mede esses 4, captura ~95% da saúde operacional. Outros sinais (CPU, memória, disco I/O) são **causas potenciais**, não sintomas — vão em white-box monitoring secundário.
    - **Latency success vs error sempre separadas** — falhas rápidas (HTTP 500 em 5ms) mascaram latência ruim de successes se misturadas. Sempre `histogram(duration_ms, {result: 'success'})` e `histogram(duration_ms, {result: 'error'})` em séries distintas.
    - **NUNCA mean para latency** — long tail invisível: mean=50ms mas p99=5000ms é UX ruim para 1% dos usuários (tipicamente os mais valiosos: enterprise tier). SEMPRE histogram com percentis.
    - **Histogram com bucketing exponencial** — buckets `[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]` ms ou base 1.5/2. Captura long tail sem cardinality explosion.
    - **Errors counter por error.type (não message)** — `error.type` enumerado (5-15 valores: `timeout`, `validation`, `auth`, `rate_limit`, `db`, `provider_down`, ...). `error.message` é alta cardinalidade — não usar como dimension.
    - **Saturation é resource-specific** — não existe métrica genérica de saturação. Para HTTP service: connection pool used %. Para DB: tablespace used %. Para queue: queue depth. Para CPU-bound: load average. Identificar O recurso mais escasso ANTES de instrumentar.
    - **Black-box monitora UX, white-box monitora internals** — black-box (synthetic prober HTTP) detecta "site offline" mesmo se métricas internas estão verdes (corner case clássico). White-box (golden signals) explica "porquê" quando black-box dispara.
    - **Reportar p50, p95, p99, p99.9 — não só p99** — p50 (mediana) é UX típica; p95 é primeiro deslize; p99 é cauda; p99.9 é seu 1 em 1000 que é seu cliente enterprise. Cada percentil conta uma história diferente.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Regras absolutas` contém 8 bullets
    - Cada um dos 4 golden signals (Latency, Traffic, Errors, Saturation) é mencionado por nome
    - Contém literalmente: `success vs error sempre separadas`, `NUNCA mean`, `bucketing exponencial`, `error.type`, `Saturation é resource-specific`, `Black-box`, `white-box`, `p50, p95, p99, p99.9`
  </acceptance_criteria>
</task>

<task id="36-03-T3" name="Patterns canônicos — definição cada signal + OTel SDK + queries SQL + black-box probe">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção c — pattern 4 golden signals em código)
    - D:/projetos/opensource/mcp/kit/skills/opentelemetry-standard/SKILL.md (precedente para uso de OTel SDK)
  </read_first>
  <action>
    Adicionar seção `## Patterns canônicos` com 5 sub-patterns:

    **`### Pattern: definição canônica dos 4 signals (tabela)`**:

    | Signal | Definição | Tipo de instrument | Granularity recomendada |
    |---|---|---|---|
    | **Latency** | Tempo de request bem-sucedido vs falho — SEPARADO | Histogram (ms) com bucketing exponencial | Por endpoint × `result` (success/error) |
    | **Traffic** | Volume de demanda — requests/s, msgs/s, bytes/s | Counter | Por endpoint × method |
    | **Errors** | Taxa de requests que falharam (explícitas: 5xx; implícitas: 200 com payload errado; políticas: > SLO target) | Counter | Por endpoint × `error.type` |
    | **Saturation** | "Quão cheio" o serviço está — % do recurso mais escasso | ObservableGauge (%) | Por resource (connection pool, queue, CPU) |

    **`### Pattern: instrumentação canônica em OTel SDK (TypeScript/Deno)`**:

    ```ts
    // PT-BR: 4 golden signals em Edge Function — copiar este shape
    import { trace, metrics } from '@opentelemetry/api'

    const tracer = trace.getTracer('orders-service')
    const meter = metrics.getMeter('orders-service')

    // PT-BR: 1. LATENCY — histogram bucketed exponencial
    const latencyHistogram = meter.createHistogram('http_request_duration_ms', {
      description: 'Request latency in ms — split by result',
      unit: 'ms',
      advice: { explicitBucketBoundaries: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] }
    })

    // PT-BR: 2. TRAFFIC — counter de requests recebidos
    const trafficCounter = meter.createCounter('http_requests_total', {
      description: 'Total HTTP requests received'
    })

    // PT-BR: 3. ERRORS — counter por error.type (categoria, não message)
    const errorsCounter = meter.createCounter('http_errors_total', {
      description: 'Total HTTP errors by error.type'
    })

    // PT-BR: 4. SATURATION — gauge do recurso mais escasso
    const saturationGauge = meter.createObservableGauge('db_connection_pool_used_pct', {
      description: 'DB connection pool utilization %',
      unit: '%'
    })
    saturationGauge.addCallback((result) => {
      // PT-BR: callback executado em scrape — lê estado atual do pool
      result.observe(getConnectionPoolUsedPct(), { resource: 'db_pool', service: 'orders' })
    })

    export async function placeOrder(req: Request) {
      const startMs = performance.now()
      const dims = { endpoint: '/api/v1/orders', method: 'POST' }

      // PT-BR: 2. Traffic — incrementar antes de processar
      trafficCounter.add(1, dims)

      return tracer.startActiveSpan('place_order', async (span) => {
        try {
          const order = await db.insertOrder(req.body)
          // PT-BR: 1. Latency success — só após success confirmar
          const durationMs = performance.now() - startMs
          latencyHistogram.record(durationMs, { ...dims, result: 'success' })
          return order
        } catch (e) {
          // PT-BR: 1. Latency error — separada da success
          const durationMs = performance.now() - startMs
          latencyHistogram.record(durationMs, { ...dims, result: 'error' })
          // PT-BR: 3. Errors — counter por error.type (enum baixa cardinalidade)
          errorsCounter.add(1, { ...dims, error_type: classify(e) })
          throw e
        } finally {
          span.end()
        }
      })
    }

    // PT-BR: classifier — enum estável de 5-15 valores
    function classify(e: unknown): string {
      if (e instanceof TimeoutError) return 'timeout'
      if (e instanceof ValidationError) return 'validation'
      if (e instanceof AuthError) return 'auth'
      if (e instanceof RateLimitError) return 'rate_limit'
      if (e instanceof DbError) return 'db'
      return 'unknown'
    }
    ```

    **`### Pattern: queries SQL para 4 signals em 1 dashboard`**:

    ```sql
    -- PT-BR: dashboard único — 4 golden signals últimos 60 minutos, por minuto
    select
      date_trunc('minute', timestamp) as minute,
      -- Traffic
      count(*) as traffic_rpm,
      -- Errors (por error.type)
      count(*) filter (where result_success = false) as errors_total,
      count(*) filter (where error_type = 'timeout') as errors_timeout,
      count(*) filter (where error_type = 'rate_limit') as errors_rate_limit,
      count(*) filter (where error_type = 'db') as errors_db,
      -- Latency p50/p95/p99 — APENAS success
      percentile_cont(0.50) within group (order by duration_ms)
        filter (where result_success = true) as latency_p50_success,
      percentile_cont(0.95) within group (order by duration_ms)
        filter (where result_success = true) as latency_p95_success,
      percentile_cont(0.99) within group (order by duration_ms)
        filter (where result_success = true) as latency_p99_success,
      -- Latency p99 — APENAS error (visibilidade de error path lentidão)
      percentile_cont(0.99) within group (order by duration_ms)
        filter (where result_success = false) as latency_p99_error,
      -- Saturation (gauge max no minuto)
      max(connection_pool_used_pct) as saturation_pool_max
    from observability.events
    where service = 'orders-api' and timestamp > now() - interval '60 minutes'
    group by minute
    order by minute desc;
    ```

    **`### Pattern: black-box probe complementar (synthetic check)`**:

    ```ts
    // PT-BR: black-box monitoring — chamar serviço como cliente externo
    // Roda em CI ou serviço external (uptimerobot, datadog synthetics)
    async function blackBoxProbe(): Promise<{ ok: boolean; durationMs: number }> {
      const startMs = Date.now()
      const r = await fetch('https://api.example.com/api/v1/orders/probe', {
        method: 'POST',
        body: JSON.stringify({ probe: true, sku: 'TEST-001' }),
        headers: { 'X-Probe': 'true' }
      })
      const durationMs = Date.now() - startMs
      // PT-BR: validar resposta — não basta status 200
      const body = await r.json()
      const ok = r.status === 200 && body.order_id != null && durationMs < 1000
      return { ok, durationMs }
    }

    // PT-BR: rodar a cada 30s; alerta se 3 consecutivos falham (debounce contra flake)
    ```

    **`### Pattern: saturation por tipo de serviço`** — tabela de o recurso a medir por contexto:

    | Tipo de serviço | Recurso mais escasso | Métrica de saturation |
    |---|---|---|
    | HTTP API stateless | Connection pool DB | `db_connection_pool_used_pct` |
    | API com cache | Memory do cache | `cache_memory_used_pct` |
    | Worker async | Queue depth | `queue_depth_messages` |
    | Edge Function | Concurrency limit Deno | `concurrent_executions_pct` |
    | DB | Tablespace ou WAL | `disk_used_pct`, `wal_lag_bytes` |
    | CPU-bound (encoder, ML) | Load average | `cpu_load_avg_5min` |
    | Network egress | Bandwidth | `egress_bytes_per_sec_pct` |
  </action>
  <acceptance_criteria>
    - Seção `## Patterns canônicos` contém 5 sub-patterns
    - Tabela de definição lista os 4 signals com colunas Definição/Tipo/Granularity
    - Bloco TypeScript do OTel SDK contém 4 instruments: `latencyHistogram`, `trafficCounter`, `errorsCounter`, `saturationGauge`
    - SQL query computa: `traffic_rpm`, `errors_total`, `latency_p50_success`, `latency_p95_success`, `latency_p99_success`, `latency_p99_error`, `saturation_pool_max`
    - Black-box probe exemplo usa `fetch` + valida response body (não só status code)
    - Tabela saturation por tipo lista pelo menos 5 tipos de serviço
  </acceptance_criteria>
</task>

<task id="36-03-T4" name="Anti-patterns — 6 anti-patterns canônicos de monitoring">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção d — anti-patterns)
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 172-249 — shape Anti-patterns)
  </read_first>
  <action>
    Adicionar seção `## Anti-patterns` com 6 sub-anti-patterns no shape `ANTI / PROBLEMA / CERTO`:

    **`### ANTI: mean latency`** — alerta/dashboard com `avg(duration_ms)` → long tail invisível; mean=50ms mas p99=5000ms = UX ruim invisível; cliente enterprise (no p99) sofre sem nunca disparar alerta. CERTO: histogram com `percentile_cont(0.99)`; alertar em p99 > target.

    **`### ANTI: latência success+error misturadas`** — `histogram(duration_ms)` sem dimension `result` → falhas rápidas (HTTP 500 em 5ms) puxam mean para baixo, mascaram lentidão real de success. CERTO: dimension `{result: 'success'}` vs `{result: 'error'}` SEMPRE separadas.

    **`### ANTI: Errors com error.message como dimension`** — `errorsCounter.add(1, { error_message: e.message })` → cada mensagem única é uma série temporal; cardinality explosion (1M+ séries em horas); time-series DB OOMs ou throttles. CERTO: enum `error.type` com 5-15 valores fixos; `error.message` em log/span attribute (não métrica).

    **`### ANTI: monitoring causes não symptoms`** — alertar em "CPU > 80% / memory < 10% / threads > N" → mistura "what" (sintoma user-facing) com "why" (causa interna); falsos positivos (cron job legítimo dispara CPU); falsos negativos (sistema lento sem CPU alta). CERTO: alertar em SLO burn rate sobre os 4 signals (event-based, customer-impacting); usar CPU/memory como **debug context** em white-box monitoring, não como alert source.

    **`### ANTI: saturation genérica`** — copiar pattern de outro serviço sem identificar o gargalo real → mede CPU em serviço onde gargalo é connection pool; mede memory em serviço CPU-bound; saturation alerta nunca dispara antes do incident. CERTO: identificar **explicitamente** o recurso mais escasso (DB pool? queue depth? Deno concurrency?) ANTES de instrumentar (ver Pattern: saturation por tipo de serviço).

    **`### ANTI: black-box only (sem white-box)`** — só prober externo → sabe que "site offline" mas não sabe **porquê**; debug requer SSH/log dive em prod sem instrumentation; MTTR cresce horas. CERTO: black-box detecta UX impact + white-box (4 signals) explica root cause. Os dois juntos.

    Cada bloco usa o shape:

    ```markdown
    ### ANTI: <nome>

    \`\`\`text
    ANTI: <comportamento concreto>

    PROBLEMA: <consequência sistêmica>

    CERTO: <ação substituta>
    \`\`\`
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Anti-patterns` contém 6 sub-anti-patterns: `### ANTI: mean latency`, `### ANTI: latência success+error misturadas`, `### ANTI: Errors com error.message como dimension`, `### ANTI: monitoring causes não symptoms`, `### ANTI: saturation genérica`, `### ANTI: black-box only`
    - Cada um contém literalmente as 3 palavras-âncora `ANTI:`, `PROBLEMA:`, `CERTO:`
  </acceptance_criteria>
</task>

<task id="36-03-T5" name="Verificação + Ver também + footer">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 251-275 — shape Verificação + Ver também + footer)
  </read_first>
  <action>
    Adicionar seções finais.

    **`## Verificação`**:

    ```markdown
    ## Verificação

    Antes de marcar instrumentação como production-ready, validar:

    1. **Os 4 signals presentes** — Latency (histogram), Traffic (counter), Errors (counter por error.type), Saturation (gauge resource-specific)
    2. **Latency separada** — `result: 'success'` e `result: 'error'` em séries distintas
    3. **Histogram com bucketing exponencial** — não fixed buckets lineares
    4. **error.type é enum (5-15 valores)** — não `error.message` como dimension
    5. **Saturation tem o recurso certo identificado** — connection pool? queue depth? concurrency? CPU load?
    6. **Black-box probe complementar** — synthetic check do happy path principal a cada 30s
    7. **Dashboard de 4 signals** existe e é o **primeiro** lugar de debug em incident
    ```

    **`## Ver também`**:

    ```markdown
    ## Ver também

    - [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — termos canônicos golden signals, black-box, white-box, percentile
    - [`opentelemetry-standard`](../opentelemetry-standard/SKILL.md) (v1.9) — OTel SDK base, exporter, OTLP
    - [`structured-events`](../structured-events/SKILL.md) (v1.9) — wide events que alimentam SLI de Errors
    - [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — SLO sobre Errors+Latency forma SLI canônico
    - [`burn-rate-alerting`](../burn-rate-alerting/SKILL.md) (v1.9) — alertar em SLO burn-rate, não em CPU
    - [`production-readiness-review`](../production-readiness-review/SKILL.md) — PRR axis "Instrumentation" exige 4 signals
    ```

    **Footer:**

    ```markdown
    ---

    *Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016) — Cap 6: "Monitoring Distributed Systems" (Four Golden Signals).*
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Verificação` contém checklist de 7 itens
    - Seção `## Ver também` lista exatamente 6 cross-refs Markdown relativos
    - Footer cita literalmente `Cap 6: "Monitoring Distributed Systems"`
    - Arquivo total ≤ 14 KB (denso por código de exemplo OTel)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/skills/four-golden-signals/SKILL.md` existe (não existia antes)
- [ ] Frontmatter válido (`name: four-golden-signals`, `description ≤ 200 chars`)
- [ ] 6 seções presentes: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Verificação`, `## Ver também`
- [ ] Cobre cap 6: Latency, Traffic, Errors, Saturation, black-box vs white-box, percentis, histograms exponenciais
- [ ] Auto-contida — código de exemplo OTel completo, queries SQL completas, sem deps em outras skills para entender o quê fazer
- [ ] Cobre SKFD-SRE-02 integralmente (4 signals + black/white-box + latência success vs error + percentis + histograms exponenciais)

## Must-haves (goal-backward)

1. Skill `four-golden-signals/SKILL.md` existe com frontmatter triggerável
2. Documenta cap 6 do livro (Latency/Traffic/Errors/Saturation)
3. Auto-contida — código OTel SDK exemplo é runnable copy-paste; queries SQL são executáveis em `observability.events`
4. Latência success vs error separadas — invariante explícita em Regras + Anti-patterns
5. Bucketing exponencial documentado — exemplo concreto de buckets `[1, 2, 5, 10, ...]`

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Skill é base para Phase 37 agente `golden-signals-instrumenter` e Phase 38 comando `/golden-signals`
- Tamanho esperado ~10-14 KB (denso por código TypeScript + SQL)
- Bucketing exponencial `[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]` cobre 1ms-30s sem cardinality explosion
