# Glossário SRE — Termos, Comandos e Patterns Canônicos

> Arquivo de referência compartilhado pelas skills `sre-*`, `four-golden-signals`, `eliminating-toil`, `blameless-postmortems`, `production-readiness-review`. **NÃO é skill** — não tem `description:` triggerável; não aparece em `listKit`. Cross-referenciado pelas skills via Markdown link relativo.

> **Material-fonte:** *Site Reliability Engineering: How Google Runs Production Systems* — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016). ISBN 978-1-491-92912-4.

---

## (a) Termos PT-BR ↔ EN

### Risk e Reliability

> Vocabulário do cap 3 (Embracing Risk). Reliability é tratada como continuum, não absoluto. Custo de "9s" cresce não-linearmente; user perception satura em torno de 99.95%-99.99% para serviços user-facing.

| EN | PT-BR / Significado |
|---|---|
| **risk continuum** | Continuum de risco — 100% de disponibilidade NÃO é o objetivo; o custo cresce não-linearmente com cada "9". Usuário em smartphone com 99% de disponibilidade não distingue 99.99% de 99.999% no serviço. |
| **as reliable as needs to be, no more** | "Tão confiável quanto precisa ser, não mais" — princípio Google SRE. Sobrar reliability é tão danoso quanto faltar (custa innovation velocity). |
| **99.99% wisdom** | Sabedoria do 99.99% — além desse target o usuário final não percebe melhoria, porque o link "fraco" entre ele e o serviço (smartphone, ISP, Wi-Fi) já dilui qualquer ganho marginal. |
| **availability target** | Alvo de disponibilidade — escolha explícita no balanço risk × innovation × cost. NÃO é meta arbitrária do CTO. |
| **error budget** | Orçamento de erro — `(1 - SLO_target) × total_events`. Fração tolerável de eventos "bad" antes de violar o SLO. Quando esgota, freeze releases. |
| **risk × innovation tradeoff** | Tradeoff risco × inovação — quanto mais inovação, mais risco. O budget é o mediador EXPLÍCITO desse tradeoff, alinhando dev e SRE. |
| **MTTR** | Mean Time To Recovery — tempo médio entre detecção do incident e recovery completo. Métrica chave do OMM Capacidade 1 (Resilience). |
| **MTBF** | Mean Time Between Failures — tempo médio entre falhas consecutivas. Mede estabilidade do serviço em prod. |
| **MTTF** | Mean Time To Failure — tempo médio até primeira falha (sem recovery). Comum em hardware, raro em serviços (que sempre recovery). |

### SLI/SLO/SLA

> Vocabulário do cap 4 (Service Level Objectives). SLI é a métrica; SLO é a meta interna; SLA é o contrato externo. SLA geralmente é menos rígido que SLO (gap = margem de segurança).

| EN | PT-BR / Significado |
|---|---|
| **SLI** | Service-Level Indicator — métrica que classifica eventos como "good" ou "bad". Sempre **event-based** (não time-based), com numerador/denominador definidos em events. |
| **SLO** | Service-Level Objective — meta interna de SLI (ex: 99.9% das requests good em janela 30d sliding). Drives engineering priorities. |
| **SLA** | Service-Level Agreement — acordo externo com cliente. Geralmente menos rígido que SLO (gap = margem). Violá-lo gera consequências contratuais (refund, credit). |
| **availability** | Disponibilidade — fração de tempo OU eventos em estado utilizável. Definição event-based é canônica (cap 4). |
| **latency** | Latência — tempo de resposta. **Sempre em percentis** (p50, p95, p99, p99.9), nunca em mean. |
| **throughput** | Vazão — requests/segundo OU eventos/minuto. Mede demanda atendida. |
| **correctness** | Correção — resposta certa para input dado. Distinto de availability (sistema "up" pode estar retornando dado errado). |
| **durability** | Durabilidade — dado armazenado sobrevive ao tempo. Storage SLO. |
| **time-to-first-byte** (TTFB) | Tempo até o primeiro byte da resposta — métrica de UX importante para serviços HTTP. |

### Four Golden Signals

> Vocabulário do cap 6 (Monitoring Distributed Systems). Latency + Traffic + Errors + Saturation são os 4 sinais mínimos universais para qualquer serviço user-facing. Originados de SREs operando os serviços do Google.

| EN | PT-BR / Significado |
|---|---|
| **Latency** | Latência — tempo de resposta. **Latência de success vs failure deve ser medida SEPARADAMENTE** — falhas rápidas mascaram falhas lentas e vice-versa. Sempre em percentis. |
| **Traffic** | Tráfego — volume de demanda no sistema. HTTP requests/s, mensagens/s, bytes/s. Counter monotônico. |
| **Errors** | Erros — taxa de requests falhas. **Explícitas** (5xx), **implícitas** (200 com resposta errada), **políticas** (200 mas latência > SLO). Counter por `error.type`. |
| **Saturation** | Saturação — "quão cheio" o serviço está. Medida do recurso MAIS LIMITADO (CPU, memória, conn pool, IO). Gauge resource-specific. |
| **golden signals** | Sinais dourados — conjunto Latency+Traffic+Errors+Saturation. Universal para qualquer serviço user-facing. Se você só pode medir 4 coisas, meça essas. |
| **black-box monitoring** | Monitoramento caixa-preta — testar o serviço como usuário externo. HTTP probes, synthetic transactions. Detecta sintoma do POV do cliente. |
| **white-box monitoring** | Monitoramento caixa-branca — introspecção interna. Logs, métricas, traces. Detecta causa, não apenas sintoma. |
| **histogram** | Histograma — distribuição com buckets. **Latência sempre em histogram, nunca gauge** — gauge perde long tail. |
| **exponential bucketing** | Bucketing exponencial — buckets crescem em razão `1.5×` ou `2×` (ex: `1, 2, 5, 10, 25, 50, 100, 250...`). Captura long tail sem explodir cardinalidade. |
| **percentile** | Percentil — `p50`, `p95`, `p99`, `p99.9`. Latência SEMPRE em percentis. p99 = "99% das requests respondem em ≤ X ms". |
| **mean** | Média — **anti-pattern para latência**. Long tail invisível: mean = 50ms mas p99 = 5s mascara experiência ruim de 1% dos usuários. |
| **long tail** | Cauda longa — eventos lentos que dominam UX percebida mas somem na média. Captados por p99/p99.9 e por histograms com buckets exponenciais. |

### Toil

> Vocabulário do cap 5 (Eliminating Toil). Toil é o trabalho operacional manual repetitivo automatizável que rouba tempo de engineering durável. Definição canônica Google: 6 critérios.

| EN | PT-BR / Significado |
|---|---|
| **toil** | Trabalho operacional manual repetitivo, automatizável, tático, sem valor durável, escala linear com tamanho do serviço. **Os 6 critérios canônicos**: manual, repetitivo, automatizável, tático (reativo), sem valor durável, escala linear. |
| **toil ≤ 50% rule** | Regra ≤ 50% — SRE não pode gastar mais que 50% do tempo em toil. Restante é engineering durável (automação, redesign, reliability work). |
| **automation** | Automação — eliminação de toil via código que se executa sem humano. Cron, queue, daemon, script idempotente. |
| **overhead** | Overhead administrativo — reuniões, RH, planning, 1:1s. **NÃO é toil** — é não-eliminável. |
| **grungy work** | Trabalho ingrato — refactor, security cleanup, deprecation migration. **NÃO é toil** — tem valor durável (asset permanente após conclusão). |
| **toil tax** | Imposto de toil — custo oculto que cresce linearmente com o produto. Prevenir > remediar — design para minimizar toil é mais barato que automação retroativa. |

### Postmortem

> Vocabulário do cap 15 (Postmortem Culture). Postmortem é blameless por construção — foca em sistema/processo, não pessoas. Princípio: "no postmortem left unreviewed".

| EN | PT-BR / Significado |
|---|---|
| **postmortem** | Postmortem — documento escrito após incident registrando timeline, causes, ações. Único deliverable obrigatório de toda Severidade SEV1/SEV2. |
| **blameless** | Sem culpa — foca em sistemas/processos, NÃO em pessoas. Psychological safety é pré-requisito para honesty. Pessoas escondem fatos quando culpadas. |
| **root cause** | Causa raiz — condição mais profunda que, removida, previne recorrência. NÃO é "fulano fez deploy errado" — é "ausência de canary release" ou "RPS limit não documentado". |
| **contributing factors** | Fatores contribuintes — condições que amplificaram impacto mas não foram raiz. Ex: "monitoring lag de 4 min" (impacto), não "deploy ruim" (trigger). |
| **trigger** | Gatilho — evento concreto que iniciou a falha. Geralmente deploy, config change, traffic spike, third-party outage. |
| **detection** | Detecção — como o incident foi descoberto. Alerta SLO burn rate? Cliente reportou? Monitoramento interno? Tempo de detecção (gap trigger → detect) é métrica chave. |
| **resolution** | Resolução — passos tomados para recuperar serviço. Ordem cronológica, com horários UTC. |
| **impact** | Impacto — usuários/revenue/reputação afetados. **Sempre quantificar** — "10K usuários afetados", "$50K revenue impact", "3% violação do SLO mensal". |
| **action items** | Ações pós-postmortem — SMART (specific, measurable, assignable, realistic, time-bound) com owner. P0/P1/P2 + due date. |
| **lessons learned** | Lições aprendidas — insights generalizáveis para outros sistemas/times. O que estamos fazendo BEM (reforçar)? O que faltou (corrigir)? |
| **Wheel of Misfortune** | Roda da Desgraça — exercício de role-play para training. Uma pessoa narra incident histórico, time pratica response. Cap 15 recomenda quartely. |
| **no postmortem left unreviewed** | Princípio canônico — todo postmortem revisado por par sênior antes de arquivar. Sem review = postmortem morre na gaveta. |

### PRR — Production Readiness Review

> Vocabulário do cap 32 (Evolving SRE Engagement Model). PRR é o checklist conduzido por SREs antes de aceitar serviço em produção. 3 modelos: Simple PRR, Early Engagement, Frameworks/Platform.

| EN | PT-BR / Significado |
|---|---|
| **PRR** | Production Readiness Review — checklist conduzido por SREs antes de aceitar serviço em produção. Output: PRR-REPORT.md scored em 6 axes. |
| **Simple PRR** | Modelo simples — SRE revisa, time dev implementa. Modelo de entrada para serviços simples. |
| **Early Engagement** | Engagement antecipado — SRE participa desde design. Decisões arquiteturais ganham reliability input antes de escrita de código. |
| **Frameworks/SRE Platform** | Frameworks/plataforma SRE — libs/templates que tornam serviços PRR-ready by default. Codifica reliability como dependência, não como checklist. |
| **production-bound** | Destinado a produção — feature/serviço que será exposto a usuários reais. Disparador de PRR obrigatório. |
| **6 axes of PRR** | 6 eixos do PRR — System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance. |
| **engagement model** | Modelo de engagement — como SRE se relaciona com time dev (Simple PRR / Early Engagement / Frameworks). Evolui com maturidade do produto. |
| **handoff readiness** | Prontidão para handoff — ponto em que dev pode entregar serviço ao SRE para operação. PRR scored ≥ threshold em todos os 6 axes. |
| **SRE platform** | Plataforma SRE — conjunto de libs+templates+gates que codifica PRR-readiness. v1.10 do kit-mcp aproxima desse modelo (skills + agents + commands + gates). |

---

## (b) Comandos canônicos

### Template canônico de Postmortem (Markdown)

> Estrutura canônica do cap 15. Use literal este shape para qualquer postmortem do projeto. 9 headers obrigatórios + frontmatter de metadata.

```markdown
# Postmortem: <incident-id> — <título-curto>

**Data do incident:** YYYY-MM-DD
**Autores:** <nomes>
**Status:** Draft | Reviewed | Final
**Severidade:** SEV1 | SEV2 | SEV3

## Summary

1-2 parágrafos: o que aconteceu, quem foi afetado, como foi resolvido. Linguagem clara — postmortem deve ser legível para alguém que NÃO estava no incident.

## Impact

- Usuários afetados: <número/percentual>
- Duração: HH:MM
- Revenue/SLO impact: <quantificado>
- Serviços downstream impactados: <lista>

## Root Causes

Condição mais profunda que, removida, previne recorrência. NÃO é "deploy do fulano" — é "ausência de canary release" ou "RPS limit não documentado". Pode haver múltiplas root causes.

## Trigger

Evento concreto que iniciou a falha (deploy X, config change Y, traffic spike Z). Distinto de root cause: trigger é o que acendeu a chama, root cause é a casa cheia de gás.

## Resolution

Passos tomados para recuperar serviço (ordem cronológica, com horários UTC). Inclui ações que NÃO funcionaram — para informar próximos incidents.

## Detection

Como descobrimos: alerta SLO burn rate? cliente reportou? monitoramento interno?
Tempo de detecção (gap entre trigger e detecção). Se cliente reportou primeiro = falha de monitoring.

## Action Items

| # | Action | Owner | Priority | Due |
|---|--------|-------|----------|-----|
| 1 | <SMART action> | @user | P0/P1/P2 | YYYY-MM-DD |

## Lessons Learned

Insights generalizáveis. O que estamos fazendo BEM (reforçar)? O que faltou (corrigir)? Aplicável a OUTROS sistemas/times além do afetado.

## Timeline (UTC)

- HH:MM — <evento>
- HH:MM — <evento>
- HH:MM — <resolution>
```

### Checklist canônico de PRR (6 axes)

> Checklist conduzido pelo SRE antes de aceitar serviço/feature em produção. Cap 32. Cada axis tem 3-5 itens; score 0-2 por item, total normalizado em 0-100% por axis. Threshold default: ≥ 80% em todos para handoff readiness.

1. **System Architecture**
   - Redundância: serviço tem replicas em ≥ 2 zonas? failover testado?
   - Single point of failure: identificado e mitigado? (DB primary, Redis instance, etc.)
   - Failure modes mapeados: cada dependência tem comportamento documentado em caso de falha?
   - Load balancing strategy: round-robin? least-conn? consistent-hash? Adequada ao perfil?
   - Graceful degradation: serviço opera (modo degradado) se dependência crítica falha?

2. **Instrumentation, Metrics, Monitoring**
   - 4 golden signals presentes: Latency (histogram), Traffic (counter), Errors (counter), Saturation (gauge)?
   - SLI/SLO definidos: ≥ 1 SLI canônico (event-based) com SLO target acordado com stakeholders?
   - Alertas SLO burn-rate (não threshold): paginam baseados em consumo de error budget, não CPU%?
   - Logs estruturados: JSON com `request.id`, `user.id`, `tenant_id`, `duration_ms`, `error.type`?
   - Traces propagados: `traceparent` header preservado cross-service via OTel SDK?

3. **Emergency Response**
   - Runbook existe e foi testado: documento PT-BR/EN para top-N incidents conhecidos?
   - On-call rotation definida: escala via PagerDuty/Opsgenie/equivalente, com follow-the-sun se aplicável?
   - Page routing: alerta certo chega na pessoa certa em ≤ 5 min?
   - Escalation policy: se primary não ack em 10 min, secondary é paged?
   - Wheel of Misfortune realizado nos últimos 90d: time praticou response em incident histórico?

4. **Capacity Planning**
   - Load test feito: serviço sustenta N% acima do peak observado em últimos 30d?
   - RPS limit documentado: capacidade conhecida por endpoint, com hard-stop antes do colapso?
   - Auto-scaling testado: regra de scale-up/down disparada em condição realista?
   - Quota/rate-limit por tenant: prevenção de noisy-neighbor entre clients?
   - Headroom ≥ 30%: utilization atual ≤ 70% para absorver spike?

5. **Change Management**
   - Canary release: novo deploy expõe a 1-10% antes de 100%?
   - Feature flags: changes desacopladas de deploy, rollback sem rebuild?
   - Rollback automatizado: SLO burn em canary dispara rollback em ≤ 5 min sem humano?
   - CI/CD gates obrigatórios: tests + lint + security scan antes de merge?
   - Deploy frequency mensurado: cadência conhecida + correlação com incidents?

6. **Performance**
   - Latência baseline (p50/p95/p99): valor conhecido + alerta em regressão?
   - Error budget definido: budget remanescente visível em dashboard, atualizado em real-time?
   - Saturation tracked: CPU/memória/conn pool/IO trackeados como gauge?
   - Long tail (p99.9) monitored: percentil extremo medido — não basta p95?

### Queries SLI standardized (Postgres)

> Queries canônicas para materializar SLI events em SLO compliance. Use sobre tabela `observability.events` (precedente v1.9 — `obs.events` ou similar). Ajustar nome do schema/tabela ao projeto.

```sql
-- PT-BR: SLI event-based — boa request = HTTP 2xx + duration < 300ms
-- Materializa contagem para alimentar burn rate e SLO compliance
select
  count(*) filter (where status_code < 400 and duration_ms < 300) as good,
  count(*) filter (where status_code >= 400 or duration_ms >= 300) as bad,
  count(*) as total
from observability.events
where service = 'orders-api' and timestamp > now() - interval '30 days';

-- PT-BR: 4 golden signals em 1 query (Latency p50/p95/p99 + Traffic + Errors + Saturation)
-- Use para dashboard real-time de saúde do serviço
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
-- Falhas rápidas mascaram falhas lentas; sempre splitar por result.success
select
  result_success,
  percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
  percentile_cont(0.99) within group (order by duration_ms) as p99_ms,
  count(*) as n
from observability.events
where service = 'orders-api' and timestamp > now() - interval '1 hour'
group by result_success;
```

### MCP tools relevantes

> Tools do Supabase MCP usados pelos agentes SRE da Phase 37 (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) para conduzir PRR / instrumentação / postmortem com dados reais.

```text
mcp__supabase__list_tables          — schema review (PRR axis "System Architecture")
mcp__supabase__execute_sql          — queries SLI / golden signals / análise de incident
mcp__supabase__get_advisors         — security/performance lints (PRR axis "Performance")
mcp__supabase__list_edge_functions  — inventário de serviços para PRR
mcp__supabase__get_logs             — verificação de instrumentação (PRR axis "Instrumentation")
```

---

## (c) Patterns canônicos

### Pattern: risk continuum em decisão de SLO target

> Cap 3. SLO target NÃO é meta arbitrária — é escolha explícita no continuum risk × innovation × cost. Custo cresce não-linearmente; usuário satura em torno de 99.95-99.99% para serviços user-facing (smartphone/ISP/Wi-Fi diluem qualquer melhoria além).

| Target | Tolerância 30d | Quando usar | Custo relativo |
|---|---|---|---|
| 99% | 7.2 h | Tier free, beta features, internal tools | 1× |
| 99.5% | 3.6 h | Tier free de produção | 2× |
| 99.9% | 43.2 min | Tier paid, paths críticos default | 5× |
| 99.95% | 21.6 min | Tier enterprise / mission-critical | 10× |
| 99.99% | 4.3 min | Apenas se justificado por user perception (raro) | 50×+ |
| 99.999% | 26 s | NUNCA para serviço user-facing (smartphone dilui) | 100×+ |

**Princípio Google SRE:** "as reliable as needs to be, no more". Sobrar reliability é tão danoso quanto faltar — custa innovation velocity, e o usuário não percebe melhoria além de ~99.95%-99.99%.

**Como aplicar:**
1. Identifique o link mais fraco entre serviço e usuário final (ex: Wi-Fi 99% disponível dilui qualquer SLO 99.999%)
2. Escolha SLO target ≤ 99.95% por default — só suba para 99.99%+ com justificativa documentada
3. Documente o tradeoff explícito: "este SLO em troca de N% velocity gasto em reliability work"
4. Revise a cada milestone — risk appetite evolui com produto

### Pattern: 4 golden signals em código (OTel SDK)

> Cap 6. Os 4 sinais mínimos universais aplicados em uma Edge Function/handler via OTel SDK. Latência separada por `result` (success vs error); errors counter por `error.type` (categoria, não message); saturation gauge é resource-specific (geralmente conn pool).

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

**Atributos canônicos das métricas:**
- `endpoint`: path normalizado (`/api/v1/orders`, NÃO `/api/v1/orders/abc-123`)
- `method`: HTTP method (`GET`, `POST`)
- `result`: `success` ou `error` — para latência APENAS
- `error_type`: categoria fechada (`timeout`, `validation`, `auth`, `rate_limit`, `db`, `internal`)

### Pattern: classificação de toil (decisão tree)

> Cap 5. Antes de classificar trabalho como "toil", aplicar os 6 critérios canônicos Google. Trabalho repetitivo NÃO é automaticamente toil — overhead administrativo e grungy work são repetitivos mas têm naturezas diferentes.

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

**Regra ≤ 50%:** SRE não pode gastar mais que 50% do tempo em toil. Se passa de 50%, é gatilho para:
1. Pedir mais headcount (toil cresce com produto, não scale linearmente com time)
2. Engajar projeto de automation com prioridade P0
3. Renegociar com produto sobre features que adicionam toil

### Pattern: postmortem timeline em UTC

> Cap 15. Timeline padronizado em UTC com horários `HH:MM` em ordem cronológica. Inclui ações que NÃO funcionaram (informa próximos incidents) e gap entre trigger e detection (métrica chave de monitoring quality).

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

**Insights derivados desse timeline:**
- **Detection lag:** trigger 14:23 → detect 14:31 = 8 min. Alvo: ≤ 5 min. Action item: alerta de canary regression em 1 min.
- **Resolution time:** 14:31 → 15:25 = 54 min (MTTR). Action item: rollback automatizado em < 5 min via SLO burn detection.
- **Root cause:** "deploy introduziu N+1" é trigger; root cause é "ausência de query plan diff em CI".

---

## (d) Anti-patterns explícitos

_Em construção — preenchido em T5._

---

## (e) Cross-references

_Em construção — preenchido em T6._

---

*Glossário criado em 2026-05-07 (Phase 36 do milestone v1.10 SRE Engagement).*
*Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016, ISBN 978-1-491-92912-4). Caps prioritários: 3, 4, 5, 6, 15, 32.*
