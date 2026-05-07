---
phase: 36
plan: 01
title: Glossário SRE compartilhado — _shared-sre/glossary.md
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/skills/_shared-sre/glossary.md
requirements: [GLOS-01, GLOS-02, GLOS-03]
status: ready
---

# Plan 01 — Glossário SRE compartilhado (`_shared-sre/glossary.md`)

## Goal

Criar `kit/skills/_shared-sre/glossary.md` — arquivo de referência canônico bilíngue PT-BR↔EN consultado pelas 5 skills SKFD-SRE da Phase 36 e pelos agentes/comandos das Phases 37-41. **NÃO é skill** — sem frontmatter triggerável; não aparece em `listKit` (precedente: `_shared-supabase/glossary.md`, `_shared-observability/glossary.md`).

Cobre o vocabulário do livro *Site Reliability Engineering* (Beyer, Jones, Petoff, Murphy — Google/O'Reilly, 2016) capítulos 3, 4, 5, 6, 15, 32 — risk/SLO/toil/golden-signals/postmortem/PRR.

## Files to create

- `D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md`

## Constraints (anti-pitfall reminders)

- **NÃO criar pasta `references/`** dentro de `_shared-sre/` (anti-pitfall A8 — só `glossary.md`)
- **SEM frontmatter triggerável** (`name:` + `description:`) — header em Markdown puro
- Code blocks em EN literal, comentários inline em PT-BR (precedente D-01 das suítes anteriores)
- Cross-refs entre skills usam Markdown relativo (`../skills/<slug>/SKILL.md`)

## Tasks

<task id="36-01-T1" name="Criar diretório e estrutura inicial do glossário">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-observability/glossary.md (precedente direto — copiar shape)
    - D:/projetos/opensource/mcp/kit/skills/_shared-supabase/glossary.md (precedente original — verificar header sem frontmatter)
  </read_first>
  <action>
    Criar diretório `kit/skills/_shared-sre/` e arquivo `glossary.md`. Header (sem frontmatter):

    ```markdown
    # Glossário SRE — Termos, Comandos e Patterns Canônicos

    > Arquivo de referência compartilhado pelas skills `sre-*`, `four-golden-signals`, `eliminating-toil`, `blameless-postmortems`, `production-readiness-review`. **NÃO é skill** — não tem `description:` triggerável; não aparece em `listKit`. Cross-referenciado pelas skills via Markdown link relativo.

    > **Material-fonte:** *Site Reliability Engineering: How Google Runs Production Systems* — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016). ISBN 978-1-491-92912-4.
    ```

    Estrutura: 5 seções `(a) Termos PT-BR ↔ EN`, `(b) Comandos canônicos`, `(c) Patterns canônicos`, `(d) Anti-patterns explícitos`, `(e) Cross-references`. Footer com data e material-fonte.
  </action>
  <acceptance_criteria>
    - Diretório `kit/skills/_shared-sre/` existe
    - Arquivo `kit/skills/_shared-sre/glossary.md` existe
    - Linha 1 é `# Glossário SRE — Termos, Comandos e Patterns Canônicos`
    - **NÃO contém** `---\nname:` no início (sem frontmatter — não é skill)
    - Contém os 5 headers `## (a) Termos`, `## (b) Comandos`, `## (c) Patterns`, `## (d) Anti-patterns`, `## (e) Cross-references`
    - Contém referência ao livro com ISBN `978-1-491-92912-4`
  </acceptance_criteria>
</task>

<task id="36-01-T2" name="Seção (a) Termos PT-BR ↔ EN — vocabulário canônico bilíngue (GLOS-01)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-observability/glossary.md (linhas 7-102 — referência de shape de tabelas por subseção)
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (arquivo criado em T1)
  </read_first>
  <action>
    Adicionar seção `## (a) Termos PT-BR ↔ EN` com 6 subseções, cada uma com tabela `| EN | PT-BR / Significado |`. Termos obrigatórios listados verbatim:

    **Subseção `### Risk e Reliability` (cap 3):**
    - `risk continuum` — Continuum de risco; 100% disponibilidade NÃO é o objetivo (custo cresce não-linearmente; usuário em 99% smartphone não distingue 99.99% vs 99.999%)
    - `as reliable as needs to be, no more` — "Tão confiável quanto precisa ser, não mais" — princípio Google SRE
    - `99.99% wisdom` — sabedoria 99.99%: além desse target o usuário final não percebe melhoria (ex: smartphone com 99% disponibilidade dilui)
    - `availability target` — alvo de disponibilidade; escolha explícita no balanço risk × innovation × cost
    - `error budget` — orçamento de erro; `(1 - SLO_target) × total_events` — fração de "bad" tolerável
    - `risk × innovation tradeoff` — quanto mais inovação, mais risco; budget é o mediador explícito
    - `MTTR` — Mean Time To Recovery; tempo médio do incident até recovery
    - `MTBF` — Mean Time Between Failures; tempo médio entre falhas
    - `MTTF` — Mean Time To Failure; tempo médio até falha (sem recovery)

    **Subseção `### SLI/SLO/SLA` (cap 4):**
    - `SLI` — Service-Level Indicator; métrica que classifica eventos como good/bad
    - `SLO` — Service-Level Objective; meta interna de SLI (ex: 99.9% das requests good em 30d)
    - `SLA` — Service-Level Agreement; acordo externo com cliente — geralmente menos rígido que SLO
    - `availability` — disponibilidade; fração de tempo/eventos em estado utilizável
    - `latency` — latência; tempo de resposta (sempre em percentis, nunca mean)
    - `throughput` — vazão; requests/segundo ou eventos/minuto
    - `correctness` — correção; resposta certa para input dado
    - `durability` — durabilidade; dado armazenado sobrevive ao tempo
    - `time-to-first-byte` (TTFB) — tempo até o primeiro byte da resposta

    **Subseção `### Four Golden Signals` (cap 6):**
    - `Latency` — latência; tempo de resposta de request bem-sucedido vs falho (medir SEPARADO — falhas rápidas mascaram falhas lentas)
    - `Traffic` — tráfego; volume de demanda no sistema (HTTP requests/s, mensagens/s, bytes/s)
    - `Errors` — erros; taxa de requests falhas (explícitas: 5xx; implícitas: 200 com resposta errada; políticas: > SLO)
    - `Saturation` — saturação; "quão cheio" o serviço está; medida do recurso mais limitado
    - `golden signals` — sinais dourados; conjunto Latency+Traffic+Errors+Saturation — universais para qualquer serviço user-facing
    - `black-box monitoring` — monitoramento caixa-preta; teste do serviço como usuário externo (HTTP probes)
    - `white-box monitoring` — monitoramento caixa-branca; introspecção interna (logs, métricas, traces)
    - `histogram` — histograma; distribuição com buckets (latência sempre em histogram, nunca gauge)
    - `exponential bucketing` — bucketing exponencial; buckets `0,1,2,4,8,16,...` ou base 1.5/2 — captura long tail
    - `percentile` — percentil; p50, p95, p99, p99.9 — latência SEMPRE em percentis
    - `mean` — média; **anti-pattern para latência** — long tail invisível
    - `long tail` — cauda longa; eventos lentos que dominam UX mas somem na média

    **Subseção `### Toil` (cap 5):**
    - `toil` — trabalho operacional manual repetitivo, automatizável, tático, sem valor durável, escala linear com tamanho do serviço (definição canônica Google: 6 critérios)
    - `toil ≤ 50% rule` — regra ≤ 50%; SRE não pode gastar mais que 50% do tempo em toil — restante para engineering
    - `automation` — automação; eliminação de toil via código que se executa sem humano
    - `overhead` — overhead administrativo; reuniões, RH, planning — NÃO é toil (não-eliminável)
    - `grungy work` — trabalho ingrato; necessário mas com valor durável (refactor, security cleanup) — NÃO é toil
    - `toil tax` — imposto de toil; custo oculto que cresce com produto (prevenir > remediar)

    **Subseção `### Postmortem` (cap 15):**
    - `postmortem` — postmortem; documento escrito após incident registrando timeline, causes, ações
    - `blameless` — sem culpa; foca em sistemas/processos, NÃO em pessoas — psychological safety
    - `root cause` — causa raiz; condição mais profunda que, removida, previne recorrência
    - `contributing factors` — fatores contribuintes; condições que amplificaram impacto mas não foram raiz
    - `trigger` — gatilho; evento que iniciou a falha (geralmente deploy, config change, traffic spike)
    - `detection` — detecção; como o incident foi descoberto (alerta? cliente? interno?)
    - `resolution` — resolução; passos tomados para recuperar serviço
    - `impact` — impacto; usuários/revenue/reputação afetados (sempre quantificar)
    - `action items` — ações pós-postmortem; SMART (specific, measurable, assignable, realistic, time-bound) com owner
    - `lessons learned` — lições aprendidas; insights generalizáveis para outros sistemas/times
    - `Wheel of Misfortune` — Roda da Desgraça; exercício de role-play para training de novos engineers (uma pessoa narra incident histórico, time pratica response)
    - `no postmortem left unreviewed` — princípio: todo postmortem revisado por par sênior antes de arquivar

    **Subseção `### PRR — Production Readiness Review` (cap 32):**
    - `PRR` — Production Readiness Review; checklist conduzido por SREs antes de aceitar serviço em produção
    - `Simple PRR` — modelo simples; SRE revisa, time dev implementa
    - `Early Engagement` — engagement antecipado; SRE participa desde design
    - `Frameworks/SRE Platform` — frameworks/plataforma SRE; libs/templates que tornam serviços PRR-ready by default
    - `production-bound` — destinado a produção; feature/serviço que será exposto a usuários reais
    - `6 axes of PRR` — 6 eixos do PRR: System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance
    - `engagement model` — modelo de engagement; como SRE se relaciona com time dev (simple/early/platform)
    - `handoff readiness` — prontidão para handoff; quando dev pode entregar serviço ao SRE para operação
    - `SRE platform` — plataforma SRE; conjunto de libs+templates+gates que codifica PRR-readiness
  </action>
  <acceptance_criteria>
    - Seção `## (a) Termos PT-BR ↔ EN` existe
    - Contém as 6 subseções: `### Risk e Reliability`, `### SLI/SLO/SLA`, `### Four Golden Signals`, `### Toil`, `### Postmortem`, `### PRR — Production Readiness Review`
    - Contém literalmente as strings: `risk continuum`, `error budget`, `99.99% wisdom`, `MTTR`, `MTBF`, `SLI`, `SLO`, `SLA`, `Latency`, `Traffic`, `Errors`, `Saturation`, `black-box`, `white-box`, `histogram`, `percentile`, `toil`, `≤ 50%`, `postmortem`, `blameless`, `root cause`, `Wheel of Misfortune`, `PRR`, `Simple PRR`, `Early Engagement`, `6 axes of PRR`
    - Cada subseção começa com `### ` e contém ao menos uma tabela `| EN | PT-BR / Significado |`
    - Cobre GLOS-01 (vocabulário canônico bilíngue) integralmente
  </acceptance_criteria>
</task>

<task id="36-01-T3" name="Seção (b) Comandos canônicos — templates postmortem + checklist PRR + queries SLI standardized (GLOS-02)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-observability/glossary.md (linhas 105-167 — shape da seção de comandos canônicos)
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (arquivo em construção)
  </read_first>
  <action>
    Adicionar seção `## (b) Comandos canônicos` com 4 subseções:

    **Subseção `### Template canônico de Postmortem (Markdown)`** — bloco de código Markdown puro com o template seguinte (campos canônicos cap 15):

    ```markdown
    # Postmortem: <incident-id> — <título-curto>

    **Data do incident:** YYYY-MM-DD
    **Autores:** <nomes>
    **Status:** Draft | Reviewed | Final
    **Severidade:** SEV1 | SEV2 | SEV3

    ## Summary

    1-2 parágrafos: o que aconteceu, quem foi afetado, como foi resolvido.

    ## Impact

    - Usuários afetados: <número/percentual>
    - Duração: HH:MM
    - Revenue/SLO impact: <quantificado>
    - Serviços downstream impactados: <lista>

    ## Root Causes

    Condição mais profunda que, removida, previne recorrência. NÃO é "deploy do fulano" — é "ausência de canary release" ou "RPS limit não documentado".

    ## Trigger

    Evento que iniciou a falha (deploy X, config change Y, traffic spike Z).

    ## Resolution

    Passos tomados para recuperar serviço (ordem cronológica, com horários UTC).

    ## Detection

    Como descobrimos: alerta SLO burn rate? cliente reportou? monitoramento interno?
    Tempo de detecção (gap entre trigger e detecção).

    ## Action Items

    | # | Action | Owner | Priority | Due |
    |---|--------|-------|----------|-----|
    | 1 | <SMART action> | @user | P0/P1/P2 | YYYY-MM-DD |

    ## Lessons Learned

    Insights generalizáveis. O que estamos fazendo BEM (reforçar)? O que faltou (corrigir)?

    ## Timeline (UTC)

    - HH:MM — <evento>
    - HH:MM — <evento>
    - HH:MM — <resolution>
    ```

    **Subseção `### Checklist canônico de PRR (6 axes)`** — checklist Markdown organizado em 6 grupos. Cada axis tem 3-5 itens:

    1. **System Architecture:** redundância? single point of failure? failure modes mapeados? load balancing strategy? graceful degradation?
    2. **Instrumentation, Metrics, Monitoring:** 4 golden signals presentes? SLI/SLO definidos? alertas SLO burn-rate (não threshold)? logs estruturados? traces propagados?
    3. **Emergency Response:** runbook existe e foi testado? on-call rotation definida? page routing? escalation policy? Wheel of Misfortune realizado nos últimos 90d?
    4. **Capacity Planning:** load test feito? RPS limit documentado? auto-scaling testado? quota/rate-limit por tenant? headroom ≥ 30%?
    5. **Change Management:** canary release? feature flags? rollback automatizado? CI/CD gates obrigatórios? deploy frequency mensurado?
    6. **Performance:** latência baseline (p50/p95/p99)? error budget definido? saturation tracked (CPU/mem/conn pool)? long tail (p99.9) monitored?

    **Subseção `### Queries SLI standardized (Postgres)`** — 3 blocos SQL canônicos:

    ```sql
    -- PT-BR: SLI event-based — boa request = HTTP 2xx + duration < 300ms
    select
      count(*) filter (where status_code < 400 and duration_ms < 300) as good,
      count(*) filter (where status_code >= 400 or duration_ms >= 300) as bad,
      count(*) as total
    from observability.events
    where service = 'orders-api' and timestamp > now() - interval '30 days';

    -- PT-BR: 4 golden signals em 1 query (Latency p50/p95/p99 + Traffic + Errors + Saturation)
    select
      date_trunc('minute', timestamp) as minute,
      count(*) as traffic_per_min,
      count(*) filter (where result_success = false) as errors_per_min,
      percentile_cont(0.50) within group (order by duration_ms) as latency_p50,
      percentile_cont(0.95) within group (order by duration_ms) as latency_p95,
      percentile_cont(0.99) within group (order by duration_ms) as latency_p99,
      max(connection_pool_used_pct) as saturation_max
    from observability.events
    where service = 'orders-api' and timestamp > now() - interval '1 hour'
    group by minute
    order by minute desc;

    -- PT-BR: latência success vs error separadas (cap 6 — não misturar)
    select
      result_success,
      percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
      percentile_cont(0.99) within group (order by duration_ms) as p99_ms,
      count(*) as n
    from observability.events
    where service = 'orders-api' and timestamp > now() - interval '1 hour'
    group by result_success;
    ```

    **Subseção `### MCP tools relevantes`** — lista plain text dos tools usados pelos agentes SRE da Phase 37:

    ```text
    mcp__supabase__list_tables          — schema review (PRR axis "System Architecture")
    mcp__supabase__execute_sql          — queries SLI / golden signals
    mcp__supabase__get_advisors         — security/performance lints (PRR axis "Performance")
    mcp__supabase__list_edge_functions  — inventário de serviços para PRR
    mcp__supabase__get_logs             — verificação de instrumentação (PRR axis "Instrumentation")
    ```
  </action>
  <acceptance_criteria>
    - Seção `## (b) Comandos canônicos` existe
    - Contém as 4 subseções: `### Template canônico de Postmortem`, `### Checklist canônico de PRR`, `### Queries SLI standardized`, `### MCP tools relevantes`
    - Template Postmortem contém literalmente os 9 headers: `## Summary`, `## Impact`, `## Root Causes`, `## Trigger`, `## Resolution`, `## Detection`, `## Action Items`, `## Lessons Learned`, `## Timeline (UTC)`
    - Checklist PRR enumera literalmente os 6 axes: `System Architecture`, `Instrumentation`, `Emergency Response`, `Capacity Planning`, `Change Management`, `Performance`
    - 3 blocos SQL existem (procurar `select` em fence ```sql)
    - Lista MCP tools menciona pelo menos `mcp__supabase__execute_sql`, `mcp__supabase__list_tables`, `mcp__supabase__get_advisors`
    - Cobre GLOS-02 (comandos canônicos consultáveis)
  </acceptance_criteria>
</task>

<task id="36-01-T4" name="Seção (c) Patterns canônicos — risk continuum + golden signals OTel + toil scoring">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-observability/glossary.md (linhas 169-261 — shape da seção patterns canônicos)
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (arquivo em construção)
  </read_first>
  <action>
    Adicionar seção `## (c) Patterns canônicos` com 4 subseções:

    **Subseção `### Pattern: risk continuum em decisão de SLO target`** — prosa explicativa + tabela:

    | Target | Tolerância 30d | Quando usar | Custo relativo |
    |---|---|---|---|
    | 99% | 7.2 h | Tier free, beta features, internal tools | 1× |
    | 99.5% | 3.6 h | Tier free de produção | 2× |
    | 99.9% | 43.2 min | Tier paid, paths críticos default | 5× |
    | 99.95% | 21.6 min | Tier enterprise / mission-critical | 10× |
    | 99.99% | 4.3 min | Apenas se justificado por user perception (raro) | 50×+ |
    | 99.999% | 26 s | NUNCA para serviço user-facing (smartphone dilui) | 100×+ |

    **Subseção `### Pattern: 4 golden signals em código (OTel SDK)`** — bloco TypeScript:

    ```ts
    // PT-BR: instrumentação canônica de Edge Function — 4 golden signals
    import { trace, metrics } from '@opentelemetry/api'

    const tracer = trace.getTracer('orders-service')
    const meter = metrics.getMeter('orders-service')

    // PT-BR: 1. LATENCY — histogram com bucketing exponencial
    const latencyHistogram = meter.createHistogram('http_request_duration_ms', {
      description: 'Request latency in ms',
      unit: 'ms',
      // PT-BR: buckets exponenciais cobrem long tail (1ms → 30s)
      advice: { explicitBucketBoundaries: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] }
    })

    // PT-BR: 2. TRAFFIC — counter de requests recebidos
    const trafficCounter = meter.createCounter('http_requests_total', {
      description: 'Total HTTP requests received'
    })

    // PT-BR: 3. ERRORS — counter por error.type (alta cardinalidade controlada)
    const errorsCounter = meter.createCounter('http_errors_total', {
      description: 'Total HTTP errors by error.type'
    })

    // PT-BR: 4. SATURATION — gauge do recurso mais escasso (connection pool em DB)
    const saturationGauge = meter.createObservableGauge('db_connection_pool_used_pct', {
      description: 'DB connection pool utilization %',
      unit: '%'
    })

    export async function placeOrder(req: Request) {
      const startMs = performance.now()
      trafficCounter.add(1, { endpoint: '/api/v1/orders', method: 'POST' })

      return tracer.startActiveSpan('place_order', async (span) => {
        try {
          const order = await db.insertOrder(req.body)
          // PT-BR: latência APENAS de success — separar de error
          const durationMs = performance.now() - startMs
          latencyHistogram.record(durationMs, { result: 'success', endpoint: '/api/v1/orders' })
          return order
        } catch (e) {
          const durationMs = performance.now() - startMs
          // PT-BR: latência de erro — separada
          latencyHistogram.record(durationMs, { result: 'error', endpoint: '/api/v1/orders' })
          // PT-BR: counter por error.type — categoria, não message
          errorsCounter.add(1, { error_type: classify(e), endpoint: '/api/v1/orders' })
          throw e
        } finally {
          span.end()
        }
      })
    }
    ```

    **Subseção `### Pattern: classificação de toil (decisão tree)`** — fluxograma textual:

    ```text
    Tarefa repetitiva detectada → aplicar 6 critérios canônicos:

    1. Manual?           (humano executa cada vez) ────┐
    2. Repetitiva?       (já fiz isso 3+ vezes)        │
    3. Automatizável?    (script/cron resolve)          ├── Se TODOS sim → TOIL
    4. Tática?           (reage a evento, não planeja)  │   → automatizar / eliminar
    5. Sem valor durável? (não cria asset permanente)   │   → contar em ≤ 50% rule
    6. Escala linear?    (mais users = mais trabalho)  ─┘

    Se NÃO for toil mas repetitivo, classificar:
    - OVERHEAD (reuniões, RH) → não-eliminável, não conta em ≤ 50%
    - GRUNGY WORK (refactor, sec cleanup) → necessário, valor durável → projeto
    ```

    **Subseção `### Pattern: postmortem timeline em UTC`** — exemplo de timeline padronizado:

    ```text
    ## Timeline (UTC)

    - 14:23 — Deploy v2.3.0 do orders-service mergeado em main
    - 14:27 — CI completa, deploy automatizado para prod (canary 10%)
    - 14:31 — Alerta SLO burn rate dispara (page on-call)
    - 14:33 — On-call ack page; abre incident Slack channel #inc-2026-05-06-01
    - 14:38 — Hipótese inicial: deploy v2.3.0 (correlação temporal)
    - 14:42 — Rollback canary para 0%; SLO burn cessa
    - 14:50 — Confirma: deploy v2.3.0 introduziu N+1 query em /api/v1/orders
    - 15:02 — Fix em PR #1234; CI verde em 14 min
    - 15:18 — Deploy do fix; canary 10% → 100% sem regressão
    - 15:25 — Incident resolvido; SLO compliance retorna a 99.92%
    ```
  </action>
  <acceptance_criteria>
    - Seção `## (c) Patterns canônicos` existe
    - Contém as 4 subseções: `### Pattern: risk continuum`, `### Pattern: 4 golden signals em código (OTel SDK)`, `### Pattern: classificação de toil`, `### Pattern: postmortem timeline em UTC`
    - Tabela de risk continuum lista os 6 targets: 99%, 99.5%, 99.9%, 99.95%, 99.99%, 99.999%
    - Bloco TypeScript dos golden signals contém literalmente os 4 nomes de variáveis: `latencyHistogram`, `trafficCounter`, `errorsCounter`, `saturationGauge`
    - Bloco TypeScript usa `createHistogram`, `createCounter`, `createObservableGauge`
    - Decision tree de toil enumera os 6 critérios (Manual/Repetitiva/Automatizável/Tática/Sem valor durável/Escala linear)
    - Timeline UTC contém pelo menos 8 entradas no formato `HH:MM —`
  </acceptance_criteria>
</task>

<task id="36-01-T5" name="Seção (d) Anti-patterns explícitos — alert fatigue + hero culture + 99.99%+ + fixed window + blame + mean-only (GLOS-03)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-observability/glossary.md (linhas 263-365 — shape da seção anti-patterns)
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (arquivo em construção)
  </read_first>
  <action>
    Adicionar seção `## (d) Anti-patterns explícitos` com 7 subseções, cada uma seguindo o padrão `ANTI-PATTERN / POR QUÊ É RUIM / CERTO`:

    **`### Alert fatigue`** — paginar em demais sintomas → noise mascara real signals → pessoas ignoram alertas → próximo SEV1 perdido. CERTO: SLO-based alerting (event burn rate); deletar alertas threshold sem ação clara.

    **`### Hero culture`** — celebrar quem fica acordado 36h em incident → comportamento perverso (esperar pelo herói); evita investimento sistêmico em automation; burn-out garantido. CERTO: blameless postmortem foca em sistema; action items > "fulano salvou o dia"; ≤ 50% toil rule.

    **`### SLO 99.99%+ default`** — definir SLO 99.99% sem justificativa de user perception → tolerância 30d = 4.3 min, sem tempo de reagir; pressões para "esconder" outages; budget esgota antes do alert. CERTO: target ≤ 99.95% para SLO real; 99.99%+ apenas com justificativa explícita (raro); use métricas/dashboards informativos.

    **`### Fixed-window error budget`** — budget reseta dia 1 do mês → "Tivemos outage dia 31, reseta amanhã" — cliente NÃO esquece; pressão para postergar fixes para depois do reset; behavioral hazard. CERTO: sliding window 30d; outage dia 31 fica no budget até dia 30 do mês seguinte (sai gradualmente).

    **`### Blame culture (vs blameless)`** — postmortem nomeia "fulano fez deploy errado" → engineers escondem incidents próximos ao limite; psychological safety colapsa; replicação garantida. CERTO: postmortem foca em sistema/processo (ausência de canary, ausência de rollback automatizado); pessoas são parte do sistema, NÃO o root cause; revisão por par sênior antes de arquivar.

    **`### Mean-only latency`** — alertar/reportar mean latency → mean = 50ms, mas p99 = 5000ms (long tail invisível); UX dominada por p99; mean é métrica enganosa. CERTO: SEMPRE percentis (p50, p95, p99, p99.9); histogram com bucketing exponencial; latência success vs error separadas.

    **`### Monitoring causes não symptoms`** — alertar em "CPU > 80% / memória < 10% / threads > N" → mistura "what" (sintoma) com "why" (causa); false positives (cron job legítimo); false negatives (sistema lento sem CPU alta); normalização do desvio. CERTO: alertar APENAS em SLO burn rate (event-based, customer-impacting); decouple "what" de "why" — alert diz que tem dor, debug descobre porquê.

    Cada subseção segue exatamente este shape (precedente `_shared-observability/glossary.md` linhas 268-279):

    ```text
    ANTI-PATTERN: <comportamento concreto>

    POR QUÊ É RUIM: <consequência sistêmica>

    CERTO: <ação substituta com referência a skill/ferramenta>
    ```
  </action>
  <acceptance_criteria>
    - Seção `## (d) Anti-patterns explícitos` existe
    - Contém as 7 subseções: `### Alert fatigue`, `### Hero culture`, `### SLO 99.99%+ default`, `### Fixed-window error budget`, `### Blame culture`, `### Mean-only latency`, `### Monitoring causes não symptoms`
    - Cada uma das 7 subseções contém literalmente as três palavras-âncora `ANTI-PATTERN`, `POR QUÊ É RUIM`, `CERTO`
    - Cobre GLOS-03 (anti-patterns explícitos: alert fatigue, hero culture, SLO 99.99%+, fixed-window, blame culture, mean-only, monitoring causes)
  </acceptance_criteria>
</task>

<task id="36-01-T6" name="Seção (e) Cross-references + footer">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-observability/glossary.md (linhas 367-396 — shape da seção cross-references + footer)
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (arquivo em construção)
  </read_first>
  <action>
    Adicionar seção `## (e) Cross-references` listando skills e agentes que consultam o glossário:

    ```markdown
    Skills que consultam este glossário:

    - `kit/skills/sre-risk-management/SKILL.md`
    - `kit/skills/four-golden-signals/SKILL.md`
    - `kit/skills/eliminating-toil/SKILL.md`
    - `kit/skills/blameless-postmortems/SKILL.md`
    - `kit/skills/production-readiness-review/SKILL.md`

    Agentes que consultam este glossário (Phase 37):

    - `kit/agents/golden-signals-instrumenter.md`
    - `kit/agents/toil-auditor.md`
    - `kit/agents/postmortem-writer.md`
    - `kit/agents/prr-conductor.md`

    Comandos que consultam este glossário (Phase 38):

    - `kit/commands/golden-signals.md`
    - `kit/commands/auditar-toil.md`
    - `kit/commands/postmortem.md`
    - `kit/commands/prr.md`
    - `kit/commands/risk-budget.md`
    - `kit/commands/sre.md` (orquestrador)

    Skills v1.9 que cross-referenciam este glossário (Phase 39 patches):

    - `kit/skills/event-based-slos/SKILL.md` (ganha bloco "Risk continuum")
    ```

    Footer:

    ```markdown
    ---

    *Glossário criado em 2026-05-06 (Phase 36 do milestone v1.10 SRE Engagement).*
    *Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016, ISBN 978-1-491-92912-4). Caps prioritários: 3, 4, 5, 6, 15, 32.*
    ```
  </action>
  <acceptance_criteria>
    - Seção `## (e) Cross-references` existe
    - Lista 5 skills SRE: `sre-risk-management`, `four-golden-signals`, `eliminating-toil`, `blameless-postmortems`, `production-readiness-review`
    - Lista 4 agentes da Phase 37: `golden-signals-instrumenter`, `toil-auditor`, `postmortem-writer`, `prr-conductor`
    - Lista 6 comandos da Phase 38 (incluindo `sre.md` orquestrador)
    - Footer contém ISBN `978-1-491-92912-4` e a string `Phase 36 do milestone v1.10`
  </acceptance_criteria>
</task>

<task id="36-01-T7" name="Smoke test — sync idempotente 2× (GLOS-01..03 final + crit-4 do ROADMAP)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (arquivo finalizado)
    - D:/projetos/opensource/mcp/src/core/sync.js (entender contrato de sync)
  </read_first>
  <action>
    Rodar smoke test idempotência. Em PowerShell:

    ```powershell
    # PT-BR: criar tmpdir
    $tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "kit-sync-phase36-$(Get-Random)")

    # PT-BR: sync 1×
    node D:\projetos\opensource\mcp\bin\kit.js sync install claude-code --project-root $tmp.FullName

    # PT-BR: snapshot do glossary materializado
    $first = Get-Content "$($tmp.FullName)\.claude\skills\_shared-sre\glossary.md" -Raw -ErrorAction SilentlyContinue

    # PT-BR: sync 2×
    node D:\projetos\opensource\mcp\bin\kit.js sync install claude-code --project-root $tmp.FullName

    # PT-BR: snapshot 2
    $second = Get-Content "$($tmp.FullName)\.claude\skills\_shared-sre\glossary.md" -Raw -ErrorAction SilentlyContinue

    # PT-BR: compare
    if ($first -eq $second) { "IDEMPOTENT_OK" } else { "IDEMPOTENT_FAIL"; exit 1 }

    # PT-BR: sanity — glossary NÃO está em listKit (não é skill triggerável)
    $catalog = node D:\projetos\opensource\mcp\bin\kit.js list 2>&1 | Out-String
    if ($catalog -match '_shared-sre/glossary') { "SHOULD_NOT_BE_LISTED"; exit 1 } else { "NOT_LISTED_OK" }
    ```

    Caso `claude-code` materialize skills em estrutura diferente, ajustar path. Se MCP já trata `_shared-*` paths como assets compartilhados, smoke continua válido — o teste é byte-equality entre 2 syncs consecutivos.
  </action>
  <acceptance_criteria>
    - `kit sync install claude-code --project-root <tmpdir>` rodado 2× produz `.claude/skills/_shared-sre/glossary.md` byte-idêntico (excluindo timestamps gerados)
    - `_shared-sre/glossary.md` NÃO aparece em `kit list` (não é skill — sem frontmatter triggerável)
    - Cobre crit-4 do ROADMAP (sync idempotente)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/skills/_shared-sre/glossary.md` existe (~12-18 KB esperado)
- [ ] Arquivo NÃO tem frontmatter `---\nname:` (não é skill)
- [ ] Contém os 5 headers principais: `## (a)`, `## (b)`, `## (c)`, `## (d)`, `## (e)`
- [ ] Cobre os 6 capítulos do livro (3, 4, 5, 6, 15, 32) via vocabulário, comandos, patterns, anti-patterns
- [ ] Termos canônicos verbatim presentes (ver T2 acceptance)
- [ ] Template Postmortem com 9 headers canônicos (ver T3 acceptance)
- [ ] Checklist PRR com 6 axes (ver T3 acceptance)
- [ ] 7 anti-patterns presentes (ver T5 acceptance)
- [ ] Sync idempotente 2× = byte-idêntico (ver T7)
- [ ] CLAUDE.md gerado **NÃO** cresce após este plan (glossary não é skill listada)

## Must-haves (goal-backward)

1. Glossário SRE existe em `kit/skills/_shared-sre/glossary.md` consultável pelos agentes/comandos das Phases 37-41 — **se ausente, agentes/comandos das fases seguintes têm cross-refs mortos**
2. Vocabulário bilíngue PT-BR↔EN cobre os 6 capítulos prioritários — **se faltar termo (ex: "Wheel of Misfortune"), `blameless-postmortems/SKILL.md` precisa repetir definição inline (DRY violation)**
3. Comandos canônicos (template postmortem + checklist PRR + queries SLI) consultáveis pelos agentes da Phase 37 — **`postmortem-writer` e `prr-conductor` consomem essas definições; sem elas, agentes inventam estrutura por turno**
4. Anti-patterns explícitos (alert fatigue, 99.99%+, fixed window, blame, mean-only) presentes — **agentes precisam saber o que NÃO fazer; sem essa seção, geram conteúdo plausível mas errado**
5. Glossário NÃO listado em `listKit` — **se vira skill triggerável por engano, polui description budget e quebra precedente das suítes anteriores**

## Notes

- **Zero alterações em `src/core/`** — content-only por design (anti-pitfall A1 preservado)
- **Zero novas deps** — Markdown puro (anti-pitfall A9 preservado)
- Arquivo deve ficar em ~12-18 KB; se passar de 25 KB, considerar mover patterns secundários para skills específicas
- Glossário é leitura de referência, não de runtime — pode ser denso (não otimizar para "scanning" como SKILL.md)
