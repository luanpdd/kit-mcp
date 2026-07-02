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

> Comportamentos comuns que parecem corretos mas são ativamente prejudiciais. Cada um inclui ANTI-PATTERN (comportamento concreto), POR QUÊ É RUIM (consequência sistêmica) e CERTO (substituto canônico). Cap 3, 4, 5, 6, 12, 15.

### Alert fatigue

```text
ANTI-PATTERN: paginar em todos os sintomas (CPU > 80%, mem < 10%, threads > N,
              latência > X em qualquer endpoint, log com "ERROR", etc.).
              Mais alertas = "mais cobertura", supostamente.

POR QUÊ É RUIM: noise mascara real signals; pessoas começam a ignorar pages
                ("é o cron job de novo"); psychological habituation;
                próximo SEV1 chega no meio do ruído e é perdido.

CERTO: SLO-based alerting (event burn rate) — alerta só quando customer
       impact é mensurável. Deletar alertas threshold sem ação clara.
       Regra: cada page deve ter runbook concreto OU ser deletada.
```

### Hero culture

```text
ANTI-PATTERN: celebrar quem fica acordado 36h em incident; bonus para
              "incident champion"; on-call que "resolve tudo sozinho".
              Cultura que premia heroísmo individual.

POR QUÊ É RUIM: comportamento perverso (esperar pelo herói em vez de
                investir em automation); evita investimento sistêmico;
                burn-out garantido em 6-12 meses; conhecimento concentrado
                em 1 pessoa = bus factor 1.

CERTO: blameless postmortem foca em sistema; action items > "fulano salvou
       o dia"; ≤ 50% toil rule (se 1 pessoa está apagando incêndio, é
       sinal de subinvestimento em automation, não falta de heróis).
```

### SLO 99.99%+ default

```text
ANTI-PATTERN: definir SLO 99.99% sem justificativa; "queremos ser melhores
              que a concorrência"; copiar SLO de cloud provider sem
              adaptar ao serviço.

POR QUÊ É RUIM: tolerância 30d = 4.3 min, sem tempo de reagir;
                pressões para "esconder" outages para preservar number;
                budget esgota antes do alert ser útil;
                custo de innovation velocity 50× maior que SLO 99.9%.

CERTO: target ≤ 99.95% para SLO real; 99.99%+ apenas com justificativa
       explícita de user perception (raro — geralmente smartphone/Wi-Fi
       já dilui qualquer ganho marginal); use métricas/dashboards
       informativos para tracking de excellence sem comprometer.
```

### Fixed-window error budget

```text
ANTI-PATTERN: error budget reseta dia 1 do mês; "tivemos outage dia 31,
              reseta amanhã"; calendar-aligned budget tracking.

POR QUÊ É RUIM: cliente NÃO esquece outage por causa de calendar reset;
                pressão para postpone fixes para depois do reset
                (behavioral hazard); dificulta planejamento de capacity;
                amplifica gaming do sistema.

CERTO: sliding window 30d. Outage dia 31 fica no budget até dia 30 do
       mês seguinte (sai gradualmente). Trata-se de função contínua,
       não step function. Mais alinhado com user perception real.
```

### Blame culture (vs blameless)

```text
ANTI-PATTERN: postmortem nomeia "fulano fez deploy errado"; root cause
              identificada como "human error"; punição/PIP após incident;
              postmortem como ferramenta de accountability individual.

POR QUÊ É RUIM: engineers escondem incidents próximos ao limite;
                psychological safety colapsa; replicação garantida
                (sistema não muda — só a pessoa); informação importante
                some (quem viveu não fala, quem fala não viveu).

CERTO: postmortem foca em sistema/processo (ausência de canary,
       ausência de rollback automatizado, runbook desatualizado);
       pessoas são parte do sistema, NÃO o root cause; revisão por par
       sênior antes de arquivar; "no postmortem left unreviewed".
```

### Mean-only latency

```text
ANTI-PATTERN: alertar/reportar mean latency; dashboard com "average
              response time"; SLA com "média mensal de latência";
              p99 considerado "muito ruidoso" e descartado.

POR QUÊ É RUIM: mean = 50ms, mas p99 = 5000ms (long tail invisível);
                UX dominada por p99 (1% dos usuários têm experiência
                terrível, mas média esconde); mean é métrica enganosa
                em qualquer distribuição com cauda longa.

CERTO: SEMPRE percentis (p50, p95, p99, p99.9); histogram com bucketing
       exponencial (não gauge); latência success vs error separadas
       (cap 6 — falhas rápidas mascaram falhas lentas); alertas
       baseados em p99 ou p99.9, nunca mean.
```

### Monitoring causes não symptoms

```text
ANTI-PATTERN: alertar em "CPU > 80%", "memória < 10%", "threads > N",
              "disk I/O > X"; mistura "what" (sintoma observável pelo
              cliente) com "why" (causa raiz interna).

POR QUÊ É RUIM: false positives (cron job legítimo dispara CPU alta;
                page no domingo de manhã sem causa real);
                false negatives (sistema lento sem CPU alta — ex: lock
                contention, GC pause, network latency);
                normalização do desvio (cap 12 do livro Observability
                Engineering — Challenger disaster framing);
                acoplamento alert × infra (cada novo serviço = N alertas).

CERTO: alertar APENAS em SLO burn rate (event-based, customer-impacting).
       Decouple "what" de "why" — alert diz que tem dor (SLO burn 4×),
       debug descobre porquê (CPU? memória? lock? deploy?). Métricas de
       saturação são gauge informativo no dashboard, não trigger de page.
```

---

## (f) Vocabulário v1.11 — Cascading Failures (cap 22)

> Vocabulário do cap 22 (Addressing Cascading Failures). Cascading failure é falha que se amplifica via loops de feedback — primeiro nó cai, traffic flui para outros, eles também caem, etc. Prevenção custa muito menos que recuperação.

| EN | PT-BR / Significado |
|---|---|
| **cascading failure** | Falha em cascata — failure que se amplifica via loops de feedback. Triggers comuns: server overload, resource exhaustion (CPU/mem/FDs/threads), service unavailability gera retry storm. |
| **retry storm** | Tempestade de retries — clientes retentam após failure simultaneamente, multiplicando carga e prolongando outage. Prevenção: jitter + retry budget + deadline propagation. |
| **thundering herd** | Manada trovejante — N clientes acordam ao mesmo tempo após recovery e batem no servidor recém-recuperado, derrubando-o de novo. Prevenção: jitter em wake-up, slow-start. |
| **load shedding** | Descarte de carga — server intencionalmente rejeita requests quando overloaded (HTTP 503 + Retry-After) em vez de aceitar e cair. Preserva capacidade para subset de tráfego. |
| **graceful degradation** | Degradação graciosa — modo reduzido sob carga (e.g., desligar features não-críticas, retornar cached/stale data, reduzir precision). Preferível a falha total. |
| **circuit breaker** | Disjuntor — pattern: após N failures consecutivas, "abre o circuito" e falha rápido (sem chamar dep) por window T. Protege caller e dep. Estados: closed/open/half-open. |
| **deadline propagation** | Propagação de deadline — request chega com TTL X; cada hop downstream subtrai tempo gasto até aqui e aborta se restante ≤ 0. Evita work zumbi após client desistir. |
| **kill switch** | Chave-mata — flag que desabilita feature inteira via 1 comando (config update / feature flag). Útil em incident pra parar bleed de feature problemática. |
| **throttle** | Estrangular — limitar rate de operações (per-user, per-tenant, global). Diferente de load shedding: throttle é per-policy contínuo; shed é reactive a saturation. |
| **queue management** | Gestão de fila — política sobre o que fazer quando queue lota: drop oldest (LIFO), drop newest (FIFO), drop random, drop by priority. Default `drop oldest` evita starvation. |
| **resource exhaustion** | Esgotamento de recurso — CPU 100%, memory OOM, file descriptors esgotados, threads bloqueadas, conn pool empty. Cada um é trigger comum de cascade. |
| **server overload** | Sobrecarga de servidor — load > capacity. Lab leve sintoma: latency p99 sobe 10×, then errors, then crashes. Detect via Saturation (cap 6). |
| **slow start** | Início lento — após recovery, aceita tráfego gradual (10% → 25% → 50% → 100%) em vez de full blast. Permite caches aquecerem, conn pools abrirem. |
| **degraded mode** | Modo degradado — fallback path quando dep crítica está down (cache stale, default values, simplified algorithm). Distinct de graceful degradation: degraded mode é design-time, not load-driven. |

## (g) Vocabulário v1.11 — Release Engineering (cap 8)

> Vocabulário do cap 8 (Release Engineering). Release engineering é disciplina específica que existe em paralelo a SRE e dev — cuida da pipeline de "código no merge → bits em prod". Foco: reproducibilidade, hermeticidade, policy enforcement.

| EN | PT-BR / Significado |
|---|---|
| **hermetic build** | Build hermético — build que produz output bit-idêntico em qualquer máquina, qualquer momento, dado mesmo input. Sem network, sem timestamps, sem env vars não-pinadas. |
| **reproducible build** | Build reprodutível — sinônimo de hermetic OU subset (apenas determinismo de output, sem requirement de network isolation). |
| **release pipeline** | Pipeline de release — sequência canônica: source → build → test → package → deploy. Cada estágio com inputs/outputs versionados. |
| **deployment policy** | Política de deploy — regras sobre QUEM pode deployar, QUANDO (freeze windows), ONDE (canary → 100%), COMO (signed commits, required reviewers, CI gates verde). |
| **self-service deployment** | Deploy self-service — engenheiros deployam sozinhos via UI/CLI sem precisar pedir SRE. Pré-requisito: policies enforced em ferramenta, não via aprovação manual. |
| **build provenance** | Proveniência de build — metadata sobre COMO o artefato foi construído (commit SHA, builder ID, build env, deps versions, signature). SLSA framework moderniza. |
| **configuration management** | Gestão de config — config separada de código (12-factor); config versionada, auditável, rollback-able. ConfigMaps, env vars, feature flags. |
| **branching strategy** | Estratégia de branching — Trunk-based (preferred) vs Gitflow. Trunk: main sempre deployable; feature flags para work in progress. Gitflow: branches longos, harder to rollback. |
| **release engineering invariant** | Invariante de release engineering — propriedade que NUNCA é violada, mesmo sob pressão. Examples: "build sem network", "deploy só com CI verde", "rollback < 5min em qualquer release". |
| **continuous build** | Build contínuo — toda commit dispara build automático. Quebra detectada em minutos vs dias. |
| **continuous test** | Teste contínuo — toda commit dispara suite. Failure visível antes de merge (na PR). |
| **continuous deployment** | Deploy contínuo — todo commit que passa CI vai pra prod automaticamente. Distinct de continuous delivery (deploy disponível mas não auto). |
| **canary release** | Release canário — rollout gradual: 1% → 10% → 50% → 100% com SLO check em cada estágio. Limita blast radius de bug. |
| **rollback** | Rollback — reverter para release anterior. Tempo target: < 5 min em qualquer release. Pré-requisito: artefato anterior preservado, schema migrations forward-only OR reversible. |
| **forward-fix** | Forward fix — em vez de rollback, fazer hotfix forward. Preferível quando rollback custaria perda de dado (e.g., schema migration que adicionou coluna NOT NULL). |
| **lockfile** | Arquivo de trava — `package-lock.json`/`pnpm-lock.yaml`/`deno.lock`/`Cargo.lock`/`go.sum`. Pin de TODAS deps transitivas a versões específicas. **Sem lockfile = não-reprodutível.** |
| **frozen-lockfile** | Lockfile congelado — modo CI (`npm ci`, `pnpm install --frozen-lockfile`, `cargo install --locked`) que falha se lockfile não-sincronizado. Garante deterministic install. |
| **config drift** | Drift de config — config em prod divergiu de config em git. Causa: changes ad-hoc via UI/CLI sem PR. Solução: GitOps (config = git, prod = mirror). |
| **no-rollback culture** | Cultura sem rollback — equipe que sempre forward-fixes, nunca rollbacks. Sintoma: rollback "nunca foi testado", quando precisa não funciona. Anti-pattern. |
| **build cache** | Cache de build — output de etapas determinísticas reusado entre runs. Acelera 10-100×. Requirement: hermeticidade (input idêntico → output idêntico → cacheável). |

## (h) Anti-patterns v1.11 (cap 22 + 8)

> Comportamentos comuns que ativamente causam cascade ou release fragility. Format: ANTI-PATTERN / POR QUÊ É RUIM / CERTO.

### Retry sem jitter (retry storm trigger)

```text
ANTI-PATTERN: client falha → retry após 1s; 1000 clients fazem isso
              simultaneamente; servidor recebe 1000 retries no mesmo segundo
              após cada delay window.

POR QUÊ É RUIM: thundering herd. Server cai, recupera, cai de novo no
                wake-up coordenado. Outage prolonga indefinidamente.

CERTO: full jitter — `delayMs = random(0, base * 2^attempt)`. Spread aleatório
       distribui carga ao longo da janela. Retry budget global limita N total
       de retries por segundo (se exceder = circuit breaker abre).
```

### Retry sem deadline (cascade amplification)

```text
ANTI-PATTERN: request chega no nó A com timeout 30s; A chama B com retry 3×
              (timeout 30s cada). B chama C com retry 3× (timeout 30s).
              Worst-case path: 30s × 3 × 3 = 270s, mas client já desistiu em 30s.

POR QUÊ É RUIM: 240s de work zumbi após client gone. Recursos consumidos
                inutilmente. Cascade amplifica — 1 retry de A vira 9 calls
                pra C.

CERTO: deadline propagation. A recebe TTL=30s. Antes de chamar B, calcula
       remaining = 30s - elapsed. Passa remaining como deadline a B (header
       grpc-timeout, AbortSignal.timeout). B faz mesmo com C. Quando deadline
       chega a 0, falha rápido sem retry. Retry budget também limita amplificação.
```

### Deploy não-hermético (config drift entre environments)

```text
ANTI-PATTERN: build em CI usa `npm install` (não `npm ci`). Local dev usa
              versão diferente de deps porque resolveu o range diferente.
              Deploy passa em CI, falha em prod com NPE em dep transitiva.

POR QUÊ É RUIM: bug não-reproduzível. Reviewer aprova "no meu ambiente
                roda". Prod cai com bug que CI não detectou. Forensics
                impossível porque "que versão de X estava em prod naquele
                momento?" não tem resposta.

CERTO: lockfile commitado + `npm ci` (ou `pnpm install --frozen-lockfile`,
       `pip install --require-hashes`). Build hermético — input idêntico
       (commit SHA + lockfile) → output bit-idêntico. Toda deploy tem
       artefato reproducible.
```

### No-rollback culture (acumulação de risk)

```text
ANTI-PATTERN: equipe sempre forward-fixes. "Rollback é complicado".
              Última vez que rolledback foi há 18 meses. Não está
              testado.

POR QUÊ É RUIM: quando incident grave ocorre, rollback é a opção certa
                — mas não funciona porque nunca foi exercitado. Forward-fix
                em meio a outage adiciona complexidade. MTTR cresce.

CERTO: rollback testado em DR exercise mensal. Cada release verifica
       que rollback funciona em < 5 min. Schema migrations sempre
       reversible (ADD col nullable, never DROP). Artefato N-1 sempre
       preservado e re-deployable.
```

### Release pipeline manual (toil + risk)

```text
ANTI-PATTERN: deploy = "engineer X faz SSH em prod, copia artefato,
              kill+restart". Documentado em runbook de 30 passos.

POR QUÊ É RUIM: toil (cap 5 — manual + repetitivo + automatizável).
                Drift entre runbook e realidade. Erros humanos.
                Sem audit trail (quem deployou o quê quando).

CERTO: deploy = git push tag (ou merge em main). CI/CD pipeline cuida
       de build hermético + tests + canary + rollback config. Self-service
       deployment com policies enforced. Audit trail automático via CI logs.
```

## (e) Cross-references

Skills que consultam este glossário:

- `kit/skills/sre-risk-management/SKILL.md`
- `kit/skills/four-golden-signals/SKILL.md`
- `kit/skills/eliminating-toil/SKILL.md`
- `kit/skills/blameless-postmortems/SKILL.md`
- `kit/skills/production-readiness-review/SKILL.md`
- `kit/skills/cascading-failures/SKILL.md` (v1.11)
- `kit/skills/load-shedding-graceful-degradation/SKILL.md` (v1.11)
- `kit/skills/retry-strategies/SKILL.md` (v1.11)
- `kit/skills/hermetic-builds/SKILL.md` (v1.11)
- `kit/skills/release-engineering/SKILL.md` (v1.11)

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

---

*Glossário criado em 2026-05-07 (Phase 36 do milestone v1.10 SRE Engagement).*
*Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016, ISBN 978-1-491-92912-4). Caps prioritários: 3 (Embracing Risk), 4 (SLOs), 5 (Eliminating Toil), 6 (Monitoring Distributed Systems / Four Golden Signals), 15 (Postmortem Culture), 32 (Evolving SRE Engagement Model / PRR).*
