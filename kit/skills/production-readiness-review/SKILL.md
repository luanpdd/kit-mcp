---
name: production-readiness-review
description: Use antes de aceitar serviço em produção — PRR checklist 6 axes (System/Instrumentation/Emergency/Capacity/Change/Performance), 3 engagement models, handoff dev→SRE.
---

# SRE — Production Readiness Review (PRR)

## Quando usar

LLM carrega esta skill ao avaliar serviço/feature antes de produção, conduzir handoff dev→SRE, ou definir engagement model. Trigger phrases:

- "PRR", "production readiness review"
- "production-bound", "ready for prod"
- "handoff dev to SRE"
- "engagement model", "early engagement"
- "SRE platform", "frameworks readiness"
- "Google SRE cap 32"
- "system architecture / instrumentation / emergency response / capacity / change / performance"

## Regras absolutas

- **PRR é GATE, não recomendação** — feature/serviço sem PRR aprovado NÃO entra em produção real (apenas dogfooding/staging). Sem gate, "production-ready" vira slogan; com gate, vira invariante.
- **6 axes obrigatórios** — System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance. Pular um axe = aprovação inválida (lacuna oculta vira incident em 6 meses).
- **3 engagement models — escolher conforme custo do serviço** — Simple PRR (serviços pequenos/internal), Early Engagement (serviços críticos), Frameworks/SRE Platform (serviços built on top of platform). Modelo errado = ou over-investment (Simple para tier-1) ou under-investment (Early para internal tool).
- **PRR é ANTES, não DEPOIS** — não "deploy primeiro, fazer PRR depois". PRR conclusão é pré-requisito de aceitar tráfego real (≥ 1% de usuários).
- **PRR é EVIDENCE-BASED, não opinião** — cada item do checklist tem critério verificável (load test report, runbook URL, dashboard link). "Acreditamos que está pronto" ≠ PRR aprovado.
- **Action items P0 = blocker; P1 = scheduled** — gaps P0 (sem instrumentação básica, sem rollback, sem on-call) bloqueiam aprovação. Gaps P1 (otimização capacidade, runbook adicional) viram tasks com due date — não bloqueiam, mas são tracked.
- **Reviewer ≠ time dev** — PRR conduzido por SRE ou par externo ao time dev (eyes-on-code novos, viés reduzido). Auto-PRR pelo time dev = oversight.
- **PRR é vivo, não one-shot** — após mudança maior (rewrite, novo dependency, RPS 10×), re-run PRR. Statement "passou PRR uma vez em 2024" não é evidence em 2026.

## Patterns canônicos

### Pattern: checklist canônico PRR — 6 axes detalhados

````markdown
```markdown
# PRR Checklist — <serviço/feature> — <data>

Reviewer: @<sre-or-external>
Status: Draft | In Review | Approved | Blocked

---

## Axe 1: System Architecture

- [ ] **Redundância**: serviço tolera falha de N instâncias (N=1 mínimo, N=2 ideal). Evidence: deployment manifest (replicas: 2+).
- [ ] **Single point of failure mapeado**: SPOFs documentados; mitigation plan claro. Evidence: arch diagram + SPOF list.
- [ ] **Failure modes mapeados**: top 5 modos de falha conhecidos com impact + mitigation. Evidence: failure mode analysis doc.
- [ ] **Load balancing strategy**: round-robin / least-conn / consistent-hash documentado. Evidence: LB config.
- [ ] **Graceful degradation**: serviço degrada (não crasha) sob carga ou dependency failure. Evidence: chaos test report ou load test config.

## Axe 2: Instrumentation, Metrics, Monitoring

- [ ] **4 golden signals presentes**: Latency (histogram), Traffic (counter), Errors (counter por error.type), Saturation (gauge). Evidence: dashboard URL + queries.
- [ ] **SLI/SLO definidos**: ao menos 1 SLO por jornada crítica do user (ver [event-based-slos](../event-based-slos/SKILL.md)). Evidence: SLO.md em `.planning/slos/`.
- [ ] **Alertas SLO burn-rate**: NÃO threshold em CPU/mem/etc. Evidence: alert rules em código + correlação com SLO definido.
- [ ] **Logs estruturados**: wide events com campos canônicos (`user.id`, `request.id`, `error.type`, `result.success`, `duration_ms`, `build_id`). Evidence: log query exemplo.
- [ ] **Traces propagados**: W3C TraceContext header em hops cross-service. Evidence: trace exemplo cross-service.

## Axe 3: Emergency Response

- [ ] **Runbook existe e foi testado**: passos para incident comuns (5+ scenarios). Evidence: URL do runbook + log do último teste.
- [ ] **On-call rotation definida**: schedule visível, ≥ 2 pessoas, escalation policy. Evidence: PagerDuty/Opsgenie schedule.
- [ ] **Page routing**: alertas SLO → on-call específico (não generic). Evidence: alert routing rules.
- [ ] **Escalation policy**: timeline clara (page → 5 min ack → 15 min escalate to L2 → 30 min L3). Evidence: doc.
- [ ] **Wheel of Misfortune realizado nos últimos 90d**: time praticou response em incident histórico. Evidence: data + participantes.

## Axe 4: Capacity Planning

- [ ] **Load test executado**: pico esperado × 2 testado; report com latency degradation curve. Evidence: load test report.
- [ ] **RPS limit documentado**: serviço sabe seu max sustainable RPS por instance. Evidence: number + source.
- [ ] **Auto-scaling testado**: scale-up + scale-down funcionam sem intervenção manual. Evidence: scaling test log.
- [ ] **Quota/rate-limit por tenant**: tenant abusivo não derruba serviço para outros. Evidence: rate-limit config.
- [ ] **Headroom ≥ 30%**: capacidade atual / pico esperado ≥ 1.3. Evidence: cálculo + dashboard.

## Axe 5: Change Management

- [ ] **Canary release**: deploys vão para 1% → 10% → 100% com hold em cada estágio. Evidence: CI pipeline config.
- [ ] **Feature flags**: features novas atrás de flag (deploy ≠ release). Evidence: feature flag service.
- [ ] **Rollback automatizado**: SLO burn rate > N nos primeiros M min após deploy → rollback automático. Evidence: rollback automation config.
- [ ] **CI/CD gates obrigatórios**: testes + lint + security scan + load test (em paths críticos). Evidence: CI config.
- [ ] **Deploy frequency mensurado**: time conhece sua deploy cadence (commits/dia ou /semana). Evidence: metric URL.

## Axe 6: Performance

- [ ] **Latency baseline (p50/p95/p99/p99.9)**: número conhecido para cada percentil principal. Evidence: dashboard query.
- [ ] **Error budget definido**: SLO target × window definidos; budget calculado. Evidence: SLO.md.
- [ ] **Saturation tracked**: CPU / memory / connection pool / queue depth — recurso mais escasso identificado. Evidence: gauge query.
- [ ] **Long tail (p99.9) monitored**: não só p50; alerta se p99.9 > N×p50 (regression detection). Evidence: query.
- [ ] **Risk continuum justificado**: target SLO escolhido com base em risk × innovation, não default 99.99%. Evidence: justificativa em SLO.md (ver [sre-risk-management](../sre-risk-management/SKILL.md)).

---

## Action Items

| # | Axe | Item | Severity | Owner | Due |
|---|-----|------|----------|-------|-----|
| 1 | 2 | Adicionar saturation gauge em /api/v1/orders | P0 | @bob | 2026-05-15 |
| 2 | 4 | Documentar RPS limit em runbook | P1 | @alice | 2026-05-22 |

## Decisão

- [x] **Approved** — service production-ready
- [ ] **Approved with conditions** — P1s tracked, P0s blockers em release próximo
- [ ] **Blocked** — P0 gaps; service NÃO aceita tráfego real até resolução

## Reviewer signature

Reviewer: @<sre>
Date: YYYY-MM-DD
```
````

### Pattern: 3 engagement models — quando usar cada

| Modelo | Quando usar | SRE involvement | Custo SRE |
|---|---|---|---|
| **Simple PRR** | Serviços pequenos, internal tools, dogfood-only | Reviewer 1 sessão; checklist preenchido por dev | Baixo (4-8h) |
| **Early Engagement** | Serviços críticos (tier-1), customer-facing, expected RPS > 1k/s | SRE participa do design; junior review em milestones; full PRR pré-launch | Médio (semanas) |
| **Frameworks / SRE Platform** | Serviços built on top of plataforma SRE-blessed (lib + templates + gates já PRR-ready) | SRE manteve plataforma; dev usa scaffolds; PRR é confirmação que dev seguiu plataforma | Baixo recorrente, alto setup inicial |

Modelo escolhido pelo **custo de outage** do serviço:

- Outage < $1k/min → Simple PRR (1 sessão, checklist)
- Outage $1k-100k/min → Early Engagement (SRE no design)
- Outage > $100k/min OR > 10 microserviços similares → Platform (libs/scaffolds eliminam toil de PRR)

### Pattern: handoff dev → SRE — sequência canônica

```text
1. Dev declara intenção: "Esse serviço vai produção em 2026-MM-DD."
2. Reviewer SRE aceita engagement model (Simple/Early/Platform).
3. Dev preenche PRR checklist (6 axes) com evidence em cada item.
4. Reviewer abre PRR-REPORT.md em .planning/prr/<service>.md, score cada axe (Pass/Fail/N-A).
5. Reviewer + dev discutem gaps:
   - P0 (blocker): dev resolve antes de production ship
   - P1 (scheduled): owner + due date; tracked em roadmap
   - P2 (optional): documentado mas não obrigatório
6. Após P0s resolvidos, reviewer marca Approved e assina.
7. Dev ship (canary 1% → 100%).
8. Pós-launch: SRE review SLO compliance em 7d, 30d, 90d.
9. Re-PRR triggered em mudanças maiores (rewrite, RPS 10×, novo dependency tier-1).
```

### Pattern: SRE Platform como amplificador

```text
Plataforma SRE consiste em:

1. Library/SDK que codifica boas práticas (otel-by-default, structured-logging-by-default,
   4-golden-signals-by-default, rate-limit-by-default, circuit-breaker-by-default)
2. Scaffolds/templates de novo serviço (kit-mcp 's `/sre`, e.g., `/sre new-service <name>`)
3. CI gates que verificam adequação à plataforma (gates de Phase 41:
   golden-signals-coverage, postmortem-template-required, prr-checklist-coverage)
4. Runbook templates por categoria de serviço (HTTP API, async worker, batch job)

Resultado: novo serviço nasce com 80% do PRR já passado por design.
PRR vira confirmação ("você usou a plataforma?"), não auditoria de zero.

Trade-off: setup inicial alto (semanas-meses para escrever plataforma).
Recomendado para org com 10+ microserviços similares.
```

### Pattern: PRR-REPORT.md template canônico

````markdown
```markdown
# PRR-REPORT — <serviço/feature> — <data>

**Reviewer:** @<sre-or-external>
**Engagement model:** Simple PRR | Early Engagement | Frameworks/Platform
**Status:** Approved | Approved with conditions | Blocked

## Sumário executivo

Resultado por axe (1-2 linhas cada):

| Axe | Score | Status |
|-----|-------|--------|
| 1. System Architecture | 5/5 | Pass |
| 2. Instrumentation, Metrics, Monitoring | 4/5 | Pass with gaps |
| 3. Emergency Response | 3/5 | Fail (P0) |
| 4. Capacity Planning | 4/5 | Pass with gaps |
| 5. Change Management | 5/5 | Pass |
| 6. Performance | 4/5 | Pass with gaps |

## Detalhamento por axe

[seção por axe com itens checked + evidence + gaps]

## Action Items

[tabela com P0/P1/P2 + owner + due]

## Aprovação

[Approved / Approved with conditions / Blocked]
[Assinatura + data]
```
````

## Anti-patterns

### ANTI: PRR depois do launch

```text
ANTI: fazer PRR após serviço já em produção.

PROBLEMA: gaps P0 já causaram incidents (sem instrumentação significa SEV1 cego);
          valor de gate perdido; PRR vira post-mortem disfarçado.

CERTO: PRR ANTES de aceitar tráfego real (≥ 1%); blocker se P0 pendente.
       PRR conclusão é pré-requisito de aceitar tráfego, não follow-up.
```

### ANTI: auto-PRR pelo time dev

```text
ANTI: time dev preenche checklist + auto-aprova.

PROBLEMA: confirmation bias (dev acredita que serviço é maduro); itens vagos
          passam ("Sim, temos monitoring"); gaps invisíveis até incident.

CERTO: reviewer EXTERNO ao time (SRE ou outro time dev sênior); evidence-based
       em cada item; dev preenche, externo verifica.
```

### ANTI: pular axes "menos relevantes"

```text
ANTI: "Esse serviço é simples, não precisa de capacity planning."

PROBLEMA: axe pulado vira lacuna; "simples" é subjetivo; decisão baseada em
          assumption sem evidence.

CERTO: TODOS os 6 axes preenchidos. Item N/A é resposta válida (com justificativa)
       — pular silenciosamente NÃO é. Para serviços pequenos, model "Simple PRR"
       cobre os 6 em 4-8h.
```

### ANTI: PRR como rubber stamp

```text
ANTI: reviewer aprova sem ler evidence; meeting 15 min; checklist marcado "looks good".

PROBLEMA: first-incident (em 3-6 meses) revela 5+ gaps; reviewer responsabilidade
          compartilhada por incident.

CERTO: reviewer aplica time-budget (4-8h Simple, dias Early); evidence verificada
       em cada item; não-OK = blocker, não "todos têm gaps".
```

### ANTI: engagement model errado para custo

```text
ANTI: Simple PRR para tier-1 (outage > $100k/min) OU Early Engagement para internal
       tool com 5 usuários.

PROBLEMA: Simple para tier-1 — SRE não engajou no design; problemas estruturais
          inviáveis de fix pós-launch; tier-1 com instabilidade. Early para
          internal tool — over-investment SRE; deslocamento de trabalho importante.

CERTO: escolher model conforme custo de outage (regra do glossário: < $1k/min =
       Simple, > $100k/min = Platform).
```

### ANTI: PRR one-shot

```text
ANTI: passou PRR em 2024, foi para prod, nunca re-PRR'd.

PROBLEMA: 2 anos depois — dependency new, RPS 10×, código rewrote, time rotated;
          PRR original irrelevante.

CERTO: re-PRR triggered em (a) rewrite > 50%, (b) RPS escala > 10×, (c) novo
       dependency tier-1, (d) time-of-record rotation > 50%, (e) anualmente como
       hygiene.
```
