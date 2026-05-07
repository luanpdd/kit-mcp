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

_Em construção — preenchido em T3._

---

## (c) Patterns canônicos

_Em construção — preenchido em T4._

---

## (d) Anti-patterns explícitos

_Em construção — preenchido em T5._

---

## (e) Cross-references

_Em construção — preenchido em T6._

---

*Glossário criado em 2026-05-07 (Phase 36 do milestone v1.10 SRE Engagement).*
*Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016, ISBN 978-1-491-92912-4). Caps prioritários: 3, 4, 5, 6, 15, 32.*
