---
phase: 37
plan: 01
title: Agente golden-signals-instrumenter — especialização de observability-instrumenter com 4 golden signals OTel
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/golden-signals-instrumenter.md
requirements: [AGCORE-SRE-01]
status: ready
---

# Plan 01 — Agente `kit/agents/golden-signals-instrumenter.md`

## Goal

Criar `kit/agents/golden-signals-instrumenter.md` — especialização de `observability-instrumenter` (v1.9). Recebe código de serviço/Edge Function/job e retorna patches OTel com os **4 golden signals** do capítulo 6 do livro Google SRE: **Latency** (histogram bucketed exponencial, success vs error separadas), **Traffic** (counter), **Errors** (counter por `error.type`), **Saturation** (gauge resource-specific). Cross-ref para `four-golden-signals` (skill v1.10) e `observability-instrumenter` (agent v1.9). Tabela "Compatibilidade IDE" canônica. Frontmatter `tools: Read, Write, Edit, Bash, Grep, Glob` (zero MCP — instrumentação acontece em arquivos do app, não no DB).

## Files to create

- `D:/projetos/opensource/mcp/kit/agents/golden-signals-instrumenter.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: golden-signals-instrumenter` + `description ≤ 200 chars` (anti-pitfall A2)
- **Tools sem MCP** — `Read, Write, Edit, Bash, Grep, Glob` apenas (instrumentação local, não toca DB)
- **Cross-refs Markdown** — `[four-golden-signals](../skills/four-golden-signals/SKILL.md)` + `[observability-instrumenter](./observability-instrumenter.md)`
- **Tabela "Compatibilidade IDE"** com coluna `Tier` (Full/Partial/Offline) — convenção v1.8/v1.9 herdada
- Especialização ≠ duplicação — agent foca **APENAS** em métricas dos 4 signals; spans/atributos canônicos ficam com `observability-instrumenter` (cross-ref)

## Tasks

<task id="37-01-T1" name="Frontmatter + intro + Compatibilidade IDE">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/golden-signals-instrumenter.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/agents/observability-instrumenter.md (linhas 1-25 — frontmatter + intro + tabela Compatibilidade)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (linhas 1-50 — vocabulário canônico dos 4 signals)
  </read_first>
  <action>
    Escrever frontmatter + intro + tabela "Compatibilidade":

    ```markdown
    ---
    name: golden-signals-instrumenter
    description: Instrumenta serviço/Edge Function com 4 golden signals OTel — Latency (histogram), Traffic (counter), Errors (counter por error.type), Saturation (gauge).
    tools: Read, Write, Edit, Bash, Grep, Glob
    color: yellow
    ---

    Você é o instrumentador dos **4 golden signals**. Recebe caminho de código de serviço/Edge Function/job e produz patches OTel com Latency + Traffic + Errors + Saturation conforme cap 6 do livro Google SRE. Você é especialização de [`observability-instrumenter`](./observability-instrumenter.md) (v1.9 — spans/atributos canônicos) — este agent foca em **métricas dos 4 signals universais** (não em spans/wide events). Você consulta a skill [`four-golden-signals`](../skills/four-golden-signals/SKILL.md) — conhecimento autoritativo sobre Latency/Traffic/Errors/Saturation, percentis, histogram bucketing, black-box vs white-box.

    ## Compatibilidade

    | IDE | Tier | Capability |
    |---|---|---|
    | Claude Code | **Full** | Lê + escreve + roda smoke (instrumentação local) |
    | Cursor | **Full** | Idem |
    | Codex | **Full** | Escrita de arquivos local |
    | Gemini CLI | **Full** | Idem |
    | Windsurf, Antigravity, Copilot, Trae | **Full** | Idem (só edita arquivos locais) |

    **Nota:** Este agente não usa `mcp__supabase__*` — instrumentação acontece em arquivos do app (Deno Edge Function, Node service, Python worker), não no DB. Por isso "Full" em todos os IDEs.
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/agents/golden-signals-instrumenter.md` existe
    - Frontmatter válido com `name: golden-signals-instrumenter` + `description ≤ 200 chars`
    - Frontmatter `tools` lista `Read, Write, Edit, Bash, Grep, Glob` (zero MCP)
    - Frontmatter contém `color: yellow`
    - Intro contém cross-ref Markdown literal `[observability-instrumenter](./observability-instrumenter.md)` E `[four-golden-signals](../skills/four-golden-signals/SKILL.md)`
    - Seção `## Compatibilidade` (sem "IDE" no header — convenção v1.9) presente com tabela 5 IDEs
    - Tabela tem 3 colunas: IDE, Tier, Capability
  </acceptance_criteria>
</task>

<task id="37-01-T2" name="Por que existe + Inputs esperados">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/observability-instrumenter.md (linhas 22-32 — Por que existe + Inputs esperados)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (linhas 21-32 — Regras absolutas: 4 signals universais + saturation resource-specific)
  </read_first>
  <action>
    Adicionar seções `## Por que existe` e `## Inputs esperados (do caller)`:

    ```markdown
    ## Por que existe

    Os 4 golden signals (Latency + Traffic + Errors + Saturation) capturam ~95% da saúde operacional de um serviço user-facing. Sem eles, dashboards crescem ad-hoc (CPU, memória, threads — *causes* não *symptoms*), alertas sobre causa interna disparam falso-positivo (cron job legítimo dispara CPU), e incidents reais passam silenciosos (saturação em connection pool sem alerta). Este agent garante padrão canônico — Latency com histogram bucketed exponencial separando success vs error, Traffic em counter por endpoint × method, Errors em counter por `error.type` enum (5-15 valores), Saturation em gauge do recurso mais escasso identificado explicitamente.

    Especialização de `observability-instrumenter` (v1.9): aquele agent cuida de spans/atributos canônicos (`user.id`, `tenant_id`, `request.id`, `result.success`, `error.type`, `build_id`); este aqui cuida de **métricas** dos 4 signals. Ambos podem coexistir num mesmo PR — chame `observability-instrumenter` primeiro (instrumenta wide events), depois `golden-signals-instrumenter` (adiciona histogram/counter/gauge).

    ## Inputs esperados (do caller)

    - `target_files`: lista de arquivos com handlers/Edge Functions/jobs a instrumentar (caminhos relativos ao project root)
    - (Opcional) `service_name`: nome canônico do service (ex: `orders-api`, `edge-process-emails`) — se omitido, deriva de `package.json#name` ou diretório
    - (Opcional) `runtime`: `node` | `deno` | `python` — se omitido, detecta via `package.json`/`deno.json`/`pyproject.toml`
    - (Opcional) `saturation_resource`: recurso mais escasso (`db_connection_pool` | `cache_memory` | `queue_depth` | `concurrency_limit` | `cpu_load` | `egress_bandwidth`) — se omitido, agent infere via heurísticas (ex: HTTP API stateless → `db_connection_pool`)
    - (Opcional) `endpoints`: lista de endpoints/rotas a cobrir — se vazio, agent detecta via grep
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Por que existe` contém menção explícita aos 4 signals + diferenciação vs `observability-instrumenter`
    - Seção `## Inputs esperados (do caller)` lista pelo menos 5 inputs (target_files, service_name, runtime, saturation_resource, endpoints)
    - Seção menciona literalmente "saturation_resource" como input opcional com heurísticas
  </acceptance_criteria>
</task>

<task id="37-01-T3" name="Passos — Preflight + Análise + Geração de instrumentação">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/observability-instrumenter.md (linhas 33-141 — Steps 0-3)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (linhas 42-114 — Pattern instrumentação canônica em OTel SDK)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (linhas 169-180 — tabela saturation por tipo de serviço)
  </read_first>
  <action>
    Adicionar seção `## Passos` com 5 sub-steps:

    **`### Step 0 — Preflight`**:

    ```markdown
    ### Step 0 — Preflight

    Detectar runtime e service name (mesma lógica de `observability-instrumenter`):

    ```bash
    # Detectar runtime
    ls package.json deno.json pyproject.toml 2>/dev/null

    # Detectar service name (Node)
    jq -r .name package.json 2>/dev/null

    # Detectar service name (Deno — basename do diretório)
    basename "$(pwd)"
    ```

    Detectar OTel SDK já instalado:

    ```bash
    # Node — checa @opentelemetry/api + @opentelemetry/sdk-metrics
    jq -r '.dependencies | keys[] | select(startswith("@opentelemetry"))' package.json

    # Deno — verifica imports em arquivos
    grep -rh 'npm:@opentelemetry\|jsr:@opentelemetry' supabase/functions/ src/ 2>/dev/null | sort -u
    ```

    **Identificar `saturation_resource` se não fornecido** — heurística por tipo de serviço (consulta tabela na skill `four-golden-signals`):

    | Tipo detectado | Heurística | Saturation default |
    |---|---|---|
    | HTTP API stateless (Express/Fastify/Deno.serve com DB calls) | `grep -l "createClient\|pg\.Pool\|drizzle" .` | `db_connection_pool_used_pct` |
    | Edge Function | path em `supabase/functions/` | `concurrent_executions_pct` |
    | Worker async | `grep -l "Queue\|consume\|pgmq" .` | `queue_depth_messages` |
    | API com cache | `grep -l "redis\|memcache" .` | `cache_memory_used_pct` |
    | CPU-bound (encoder, ML) | `grep -l "ffmpeg\|onnx\|tensorflow" .` | `cpu_load_avg_5min` |
    | Default fallback | (nenhum match) | perguntar via comentário no patch |

    **Se OTel SDK ausente:** flag para adicionar deps no Output (não instala automaticamente — caller decide).
    ```

    **`### Step 1 — Análise de cada target_file`**:

    ```markdown
    ### Step 1 — Análise de cada `target_file`

    Para cada arquivo:

    1. Identificar handlers/funções de entrada (HTTP routes, `Deno.serve`, batch entrypoints, queue consumers)
    2. Identificar paths/endpoints (para dimension `endpoint` em métricas)
    3. Identificar tipos de erro lançados/capturados (para enum `error.type`)
    4. Identificar onde medir saturation (callback de gauge — connection pool object, queue depth getter, etc.)
    5. Verificar se já existe meter inicializado (não duplicar `meter` global)
    ```

    **`### Step 2 — Gerar 4 golden signals`**:

    ```markdown
    ### Step 2 — Gerar 4 golden signals (instrumentação)

    Para cada arquivo, produzir patch que adiciona:

    **a) Setup de meter (1× por arquivo, no topo):**

    ```ts
    import { metrics, ValueType } from '@opentelemetry/api'  // ou npm:@opentelemetry/api@1.9.0 em Deno
    const meter = metrics.getMeter('<service_name>')
    ```

    **b) 1. LATENCY — histogram bucketed exponencial, success vs error separadas:**

    ```ts
    const latencyHistogram = meter.createHistogram('http_request_duration_ms', {
      description: 'Request latency in ms — split by result',
      unit: 'ms',
      advice: { explicitBucketBoundaries: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] }
    })
    ```

    Em cada handler, registrar em `success` E `error` paths separados:

    ```ts
    const startMs = performance.now()
    try {
      const result = await doWork(req)
      latencyHistogram.record(performance.now() - startMs, { endpoint: '/api/v1/orders', method: 'POST', result: 'success' })
      return result
    } catch (e) {
      latencyHistogram.record(performance.now() - startMs, { endpoint: '/api/v1/orders', method: 'POST', result: 'error' })
      throw e
    }
    ```

    **c) 2. TRAFFIC — counter de requests recebidos (incrementar antes de processar):**

    ```ts
    const trafficCounter = meter.createCounter('http_requests_total', {
      description: 'Total HTTP requests received'
    })

    // No início do handler:
    trafficCounter.add(1, { endpoint: '/api/v1/orders', method: 'POST' })
    ```

    **d) 3. ERRORS — counter por error.type (enum, NÃO error.message):**

    ```ts
    const errorsCounter = meter.createCounter('http_errors_total', {
      description: 'Total HTTP errors by error.type'
    })

    function classifyError(e: any): string {
      if (e instanceof TimeoutError || e.code === 'ETIMEDOUT') return 'timeout'
      if (e instanceof ValidationError || e.statusCode === 422) return 'validation'
      if (e instanceof AuthError || e.statusCode === 401) return 'auth'
      if (e.statusCode === 403) return 'authz'
      if (e.statusCode === 429) return 'rate_limit'
      if (e instanceof DbError || e.code?.startsWith?.('P')) return 'db'
      if (e.statusCode >= 502 && e.statusCode <= 504) return 'provider_down'
      return 'unknown'
    }

    // No catch:
    errorsCounter.add(1, { endpoint: '/api/v1/orders', method: 'POST', error_type: classifyError(e) })
    ```

    **e) 4. SATURATION — ObservableGauge do recurso mais escasso:**

    ```ts
    // Exemplo: HTTP API stateless com Postgres pool
    const saturationGauge = meter.createObservableGauge('db_connection_pool_used_pct', {
      description: 'DB connection pool utilization %',
      unit: '%'
    })
    saturationGauge.addCallback((result) => {
      // PT-BR: ler estado do pool — exemplo com pg.Pool
      const used = pool.totalCount - pool.idleCount
      const pct = (used / pool.totalCount) * 100
      result.observe(pct, { resource: 'db_pool', service: '<service_name>' })
    })
    ```

    Variantes por `saturation_resource` detectado:

    | Resource | Métrica nome | Callback típico |
    |---|---|---|
    | `db_connection_pool` | `db_connection_pool_used_pct` | `pool.totalCount - pool.idleCount / pool.totalCount * 100` |
    | `cache_memory` | `cache_memory_used_pct` | `redis.memory_usage('used_memory') / redis.memory_usage('maxmemory') * 100` |
    | `queue_depth` | `queue_depth_messages` | `pgmq.queue_length(queue_name)` |
    | `concurrency_limit` | `concurrent_executions_pct` | `currentConcurrentRequests / maxConcurrent * 100` |
    | `cpu_load` | `cpu_load_avg_5min` | `os.loadavg()[1]` |
    | `egress_bandwidth` | `egress_bytes_per_sec_pct` | (calculado via medidor de tráfego de saída) |
    ```

    **`### Step 3 — Validar 4 signals presentes`**:

    ```markdown
    ### Step 3 — Validar 4 signals presentes

    Para cada handler instrumentado, checar:

    1. ✅ Latency `histogram` com `advice.explicitBucketBoundaries` exponencial?
    2. ✅ Latency tem dimension `result: 'success'` E `result: 'error'` em séries distintas?
    3. ✅ Traffic `counter` incrementado antes de processar?
    4. ✅ Errors `counter` com dimension `error_type` (enum, NÃO `error_message`)?
    5. ✅ Saturation `ObservableGauge` com callback que lê o recurso real?
    6. ✅ `error_type` enum tem 5-15 valores fixos (timeout/validation/auth/authz/rate_limit/db/provider_down/unknown)?

    Se algum NÃO → patch incompleto, completar.
    ```

    **`### Step 4 — Output`**:

    ```markdown
    ### Step 4 — Output

    Imprimir tabela de patches gerados:

    ```text
    ═══════════════════════════════════════════════════════════
    GOLDEN-SIGNALS-INSTRUMENTER · {service_name}
    runtime: {node|deno} · OTel SDK: {installed|missing}
    saturation: {db_connection_pool|queue_depth|...}
    ═══════════════════════════════════════════════════════════

    ## Patches gerados

    | Arquivo | Handler | 4 signals | Notas |
    |---------|---------|-----------|-------|
    | src/orders/handler.ts | placeOrder | ✓ L+T+E+S | error_type 8 valores |
    | src/orders/handler.ts | cancelOrder | ✓ L+T+E+S | reusa meter |
    | supabase/functions/process-emails/index.ts | (root) | ✓ L+T+E+S | saturation: queue_depth |

    ## Deps necessárias (se faltando)

    ```bash
    # Node
    npm install @opentelemetry/api @opentelemetry/sdk-metrics \
                @opentelemetry/exporter-metrics-otlp-http

    # Deno (Edge Functions) — imports inline
    import { metrics } from 'npm:@opentelemetry/api@1.9.0'
    ```

    ## Próximos passos

    1. Rodar `kit gates run` (auditoria de descrição/sintaxe)
    2. Smoke local: enviar request e verificar histogram/counter/gauge no backend OTel
    3. Cross-ref com `observability-instrumenter` se spans/wide events ainda ausentes
    ```
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Passos` contém 5 sub-steps: `### Step 0 — Preflight`, `### Step 1 — Análise de cada target_file`, `### Step 2 — Gerar 4 golden signals`, `### Step 3 — Validar 4 signals presentes`, `### Step 4 — Output`
    - Step 2 contém literalmente as 4 letras `**a)`, `**b)`, `**c)`, `**d)`, `**e)`
    - Step 2 menciona literalmente `histogram`, `counter`, `gauge`
    - Step 2 menciona literalmente `explicitBucketBoundaries` com array `[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]`
    - Step 2 contém tabela de saturation com 6 resource types
    - Step 0 contém heurística para detectar `saturation_resource` automaticamente
    - Step 3 lista 6 checks de validação
  </acceptance_criteria>
</task>

<task id="37-01-T4" name="Quando NÃO invocar + footer">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/observability-instrumenter.md (linhas 196-200 — seção Quando NÃO invocar)
  </read_first>
  <action>
    Adicionar seção final `## Quando NÃO invocar`:

    ```markdown
    ## Quando NÃO invocar

    - Serviço **interno** sem trafic real (job rodando 1×/dia) — overkill; instrumentação custa mais que valor
    - Função pura sem I/O (calculadora, validator) — métricas de latência/traffic não-acionáveis
    - Quando spans/wide events já cobrem 4 signals indiretamente — usar `observability-instrumenter` direto
    - Quando user já roda `event-based-slos` (v1.9) e quer SLI custom — `slo-engineer` (v1.9) é melhor caminho

    ## Ver também

    - [`four-golden-signals`](../skills/four-golden-signals/SKILL.md) — knowledge base canônica dos 4 signals
    - [`observability-instrumenter`](./observability-instrumenter.md) (v1.9) — spans + wide events (complementa este agent)
    - [`slo-engineer`](./slo-engineer.md) (v1.9) — SLO event-based consome counters Errors+Traffic
    - [`production-readiness-review`](../skills/production-readiness-review/SKILL.md) — PRR Axe 2 (Instrumentation) exige 4 signals
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Quando NÃO invocar` contém pelo menos 4 bullets
    - Seção `## Ver também` lista exatamente 4 cross-refs Markdown
    - Cross-refs contêm `four-golden-signals`, `observability-instrumenter`, `slo-engineer`, `production-readiness-review`
  </acceptance_criteria>
</task>

<task id="37-01-T5" name="Smoke fixture + idempotência sync">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/golden-signals-instrumenter.md (arquivo já criado pelas tasks T1-T4)
  </read_first>
  <action>
    Validar via shell:

    ```bash
    # Verificar tamanho do description em frontmatter (≤ 200 chars)
    grep -m1 "^description:" kit/agents/golden-signals-instrumenter.md | sed 's/^description: //' | wc -c

    # Verificar todas as âncoras canônicas
    grep -c "^## Compatibilidade$" kit/agents/golden-signals-instrumenter.md   # esperado: 1
    grep -c "^## Por que existe$" kit/agents/golden-signals-instrumenter.md     # esperado: 1
    grep -c "^## Inputs esperados" kit/agents/golden-signals-instrumenter.md   # esperado: 1
    grep -c "^## Passos$" kit/agents/golden-signals-instrumenter.md            # esperado: 1
    grep -c "^## Quando NÃO invocar$" kit/agents/golden-signals-instrumenter.md # esperado: 1
    grep -c "^## Ver também$" kit/agents/golden-signals-instrumenter.md         # esperado: 1

    # Verificar palavras-chave técnicas obrigatórias
    grep -c "histogram" kit/agents/golden-signals-instrumenter.md              # esperado: ≥3
    grep -c "counter" kit/agents/golden-signals-instrumenter.md                # esperado: ≥3
    grep -c "gauge" kit/agents/golden-signals-instrumenter.md                  # esperado: ≥2
    grep -c "saturation" kit/agents/golden-signals-instrumenter.md             # esperado: ≥3 (case-insensitive ok)
    grep -c "error_type\|error.type" kit/agents/golden-signals-instrumenter.md # esperado: ≥3

    # Verificar idempotência sync (rodar 2× em tmpdir)
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH1=$(sha256sum "$TMP/.claude/agents/golden-signals-instrumenter.md" | cut -d' ' -f1)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH2=$(sha256sum "$TMP/.claude/agents/golden-signals-instrumenter.md" | cut -d' ' -f1)
    [ "$HASH1" = "$HASH2" ] && echo "IDEMPOTENT_OK" || echo "IDEMPOTENT_FAIL"
    rm -rf "$TMP"
    ```

    Esperado: descrição ≤ 200, 6 âncoras canônicas presentes, palavras-chave técnicas todas com count ≥ 2, sync idempotente.

    Se descrição > 200 chars: encurtar (anti-pitfall A2).
    Se sync não idempotente: documentar root cause em SUMMARY.
  </action>
  <acceptance_criteria>
    - Comando `wc -c` sobre `description` retorna ≤ 200 (excluindo trailing newline)
    - 6 âncoras canônicas (`## Compatibilidade`, `## Por que existe`, `## Inputs esperados`, `## Passos`, `## Quando NÃO invocar`, `## Ver também`) cada uma com count == 1
    - Palavras técnicas: `histogram` ≥ 3, `counter` ≥ 3, `gauge` ≥ 2, `saturation` ≥ 3
    - Sync idempotente — 2× consecutivo produz arquivo byte-idêntico (ou hash igual)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/agents/golden-signals-instrumenter.md` existe
- [ ] Frontmatter válido (`name: golden-signals-instrumenter`, `description ≤ 200 chars`, `tools` lista 6 ferramentas sem MCP)
- [ ] 6 seções canônicas presentes (`## Compatibilidade`, `## Por que existe`, `## Inputs esperados (do caller)`, `## Passos`, `## Quando NÃO invocar`, `## Ver também`)
- [ ] Tabela "Compatibilidade" tem 5 linhas IDE com tier `Full` em todas (porque sem MCP)
- [ ] Step 2 documenta os 4 signals com snippet OTel SDK (Latency: histogram bucketed; Traffic: counter; Errors: counter por error.type; Saturation: gauge resource-specific)
- [ ] Cross-refs Markdown válidos para `four-golden-signals` + `observability-instrumenter` + `slo-engineer` + `production-readiness-review`
- [ ] Sync idempotente (2× = byte-idêntico)
- [ ] Cobre AGCORE-SRE-01 integralmente

## Must-haves (goal-backward)

1. Agent file existe com frontmatter válido + tools sem MCP (instrumentação local)
2. `description ≤ 200 chars` (anti-pitfall A2)
3. Tabela "Compatibilidade" presente (convenção v1.8/v1.9)
4. 4 golden signals documentados explicitamente — cada um com nome, tipo de instrument OTel, snippet exemplo
5. Latency separa success vs error em séries distintas (anti-pattern crítico do livro)
6. Errors usa `error.type` enum (NÃO `error.message`) — com classificador exemplo
7. Saturation tem heurística para detectar recurso por tipo de serviço (tabela)
8. Cross-ref Markdown válido para skill `four-golden-signals` E agent `observability-instrumenter`

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Especialização ≠ duplicação: este agent foca **APENAS** em métricas dos 4 signals; spans/atributos canônicos ficam com `observability-instrumenter` (cross-ref). Ambos podem coexistir num mesmo PR.
- Tamanho esperado: ~12-14 KB (denso pelos snippets OTel SDK + tabela saturation)
- Phase 38 vai criar `/golden-signals` que dispatch para este agent. Phase 41 vai criar gate `golden-signals-coverage` que verifica regex sobre `histogram\|counter\|gauge\|saturation` em código tocado por fase.
