---
name: event-based-slos
description: Use ao definir SLO — SLI event-based (não time-based), sliding window 30d, decouple what/why. SLO-based alerts substituem thresholds brutos como CPU/memória.
---

# Observabilidade — Event-Based SLOs

## Quando usar

LLM carrega esta skill ao definir/avaliar SLOs ou substituir alertas threshold por SLO-based. Trigger phrases:

- "definir SLO", "criar SLI"
- "alertas confiáveis", "alert fatigue"
- "error budget", "sliding window"
- "como medir saúde do serviço"
- "decouple what from why"

## Regras absolutas

- **SLI sempre event-based, nunca time-based** — "% de eventos com `result.success=true` em 30d" > "% de janelas de 5min com p99 < 300ms"
- **Sliding window 30d por default** — fixed window (calendário) gera comportamento perverso (cliente não esquece bug por causa de reset).
- **Target ≤ 99.95%** — para SLO 99.99%+ você não tem tempo de reagir antes do budget acabar; use métricas/dashboards informativos em vez de SLO.
- **Decouple "what" do "why"** — SLO alert diz que tem dor (sintoma); investigation descobre porquê (use [`core-analysis-loop`](../skills/core-analysis-loop/SKILL.md)). NUNCA misturar (anti-pattern: "alert se memória > 80% AND p99 > 300ms").
- **Customer-facing journey, não system metric** — SLI mede o que o cliente sente ("login funcionou em < 800ms"), não estado interno ("threads ativas").
- **Granular por endpoint/feature** — 1 SLO por jornada crítica do user. Não SLO global "site availability" — específico demais para ser ignorável.
- **Owner explícito** — cada SLO tem dono nomeado. Sem owner = sem ação = sem valor.
- **Substituir alertas threshold gradualmente** — após SLO comprovar valor (1+ incident detectado por SLO antes de threshold), DELETAR threshold antigo.

## Risk continuum — SLO target é decisão explícita

> Cross-ref canônico: [sre-risk-management](../sre-risk-management/SKILL.md) (cap 3 do livro Google SRE — Embracing Risk).

SLO target NÃO é meta arbitrária ("queremos 99.99% porque soa bom"). É uma escolha consciente no **continuum risk × innovation**: cada nove adicional **multiplica custo** mas **divide benefício marginal** percebido pelo cliente.

| Target | Tolerância 30d | User-perceptible? | Quando faz sentido |
|---|---|---|---|
| 99% | 7.2 h | Sim, notável | Tier free, beta features, internal tools |
| 99.5% | 3.6 h | Notável em paths críticos | Tier free de produção |
| 99.9% | 43.2 min | Aceitável para maior parte de UX | Tier paid default |
| 99.95% | 21.6 min | Quase imperceptível | Tier enterprise / mission-critical |
| 99.99% | 4.3 min | Imperceptível em smartphone (~99% no canal do user) | Apenas se justificado por user perception (raro) |

**Sabedoria 99.99%** — cliente final acessa via smartphone (~99% disponibilidade) com ISP residencial (~99%). Serviço 99.99% **não é distinguível** de 99.999% nesse contexto: ambos parecem "sempre funcionando". Esforço além de 99.95% para serviço user-facing é tipicamente desperdício.

**Error budget é o instrumento contábil dessa decisão.** Para SLO 99.9% em 30d com 10M eventos: budget = `0.001 × 10M = 10k bad events`. Esse 10k é orçamento explícito para gastar em deploys arriscados, experimentos, refactors. Quando esgota, releases freezam até regenerar — não como punição, mas como **balanço explícito risk × innovation**.

**Diferentes tiers, diferentes targets** — `customer.tier='enterprise'` pode justificar 99.95%; `tier='free'` pode operar em 99.5%. Tratar todos como tier-1 desperdiça budget; tratar todos como tier-3 frustra clientes pagantes. A skill `sre-risk-management` documenta o framework completo de decisão.

> Em resumo: a regra `Target ≤ 99.95%` desta skill (acima) é **consequência** do risk continuum, não restrição arbitrária. Para 99.99%+ trate como métrica informativa (dashboard), NÃO como SLO acionável (alerts).

## Patterns canônicos

### Pattern: SLI event-based vs time-based

```sql
-- PT-BR: BAD — SLI time-based (anti-pattern)
-- "99% das janelas de 5 min têm p99 < 300ms"
-- Problema: pre-aggregation perde fidelidade; janela com 1 outlier puxa p99.

-- PT-BR: GOOD — SLI event-based
-- "99.9% dos eventos individuais têm duration < 300ms e result_success = true"
select 
  count(*) filter (where duration_ms < 300 and result_success = true) as good,
  count(*) as total,
  count(*) filter (where duration_ms < 300 and result_success = true)::float / count(*) as compliance
from observability.events
where 
  event_name = 'http_request' 
  and endpoint = '/api/v1/orders'
  and timestamp > now() - interval '30 days';
```

### Pattern: SLO definition canônico

```yaml
# PT-BR: SLO documentado em formato YAML — alimenta agent slo-engineer
slo:
  name: checkout_success
  description: "Checkout completes successfully within 800ms (customer perception)"
  owner: orders-team@company.com   # PT-BR: dono nomeado
  
  sli:
    type: event_based              # PT-BR: NUNCA time-based
    event_filter:
      service: orders-api
      endpoint: /api/v1/checkout
      http_method: POST
    good_event:                    # PT-BR: predicate booleano
      result_success: true
      duration_ms: { lt: 800 }
    bad_event:                     # PT-BR: complemento
      operator: not_good           # qualquer evento que não é "good"
  
  target: 0.999                    # PT-BR: 99.9% — não 99.99%+ por design
  window: 30d_sliding              # PT-BR: nunca fixed/calendar
  
  alerts:                          # PT-BR: ver skill burn-rate-alerting
    - name: page_short_term
      lookahead: 4h
      baseline: 1h
      severity: page
    - name: ticket_long_term
      lookahead: 3d
      baseline: 18h
      severity: ticket
```

### Pattern: SLI materialized view (Postgres)

```sql
-- PT-BR: view materializa SLI events para queries baratas
-- Refresh agendado (pg_cron) ou em tempo real (trigger)
create materialized view obs.sli_checkout_success as
select
  date_trunc('minute', timestamp) as bucket,
  count(*) filter (where result_success = true and duration_ms < 800) as good,
  count(*) filter (where not (result_success = true and duration_ms < 800)) as bad,
  count(*) as total
from observability.events
where 
  service = 'orders-api'
  and endpoint = '/api/v1/checkout'
  and http_method = 'POST'
  and timestamp > now() - interval '35 days'  -- 30d + buffer
group by 1
with no data;

-- PT-BR: índice para queries de burn rate
create index on obs.sli_checkout_success (bucket);

-- PT-BR: refresh schedule via pg_cron — a cada 30s
select cron.schedule(
  'refresh_sli_checkout_success',
  '*/30 * * * * *',
  $$ refresh materialized view concurrently obs.sli_checkout_success $$
);
```

### Pattern: SLO compliance query (atual e histórico)

```sql
-- PT-BR: compliance atual — % good no último 30d
select 
  sum(good)::float / nullif(sum(total), 0) as compliance_30d,
  0.999 as target,
  case 
    when sum(good)::float / nullif(sum(total), 0) >= 0.999 then 'IN_BUDGET'
    else 'OUT_OF_BUDGET'
  end as status
from obs.sli_checkout_success
where bucket > now() - interval '30 days';

-- PT-BR: error budget remaining
-- Budget = (1 - target) × total_events
-- Remaining = budget - bad_events_so_far
select
  (1 - 0.999) * sum(total) as budget,
  sum(bad) as burned,
  (1 - 0.999) * sum(total) - sum(bad) as remaining,
  100.0 * (1 - sum(bad) / nullif((1 - 0.999) * sum(total), 0)) as remaining_pct
from obs.sli_checkout_success
where bucket > now() - interval '30 days';
```

### Pattern: SLO replacing thresholds (case study Honeycomb)

```text
ANTES (cap 12 do livro):
  - Alert: CPU > 80% (false positive: garbage collector)
  - Alert: memory > 90% (false positive: cache warming)
  - Alert: 5xx > 1% in 5min (false negative: 0.5% por 1h burns 60% do budget)
  - Alert: p99 latency > 500ms in 5min (false positive: 1 spike isolado)

DEPOIS:
  - 1 SLO: checkout_success em 30d sliding
  - 1 alert preditivo: burn rate sustained 4h+
  - 1 alert ticket: burn rate sustained 3d+
  
RESULTADO: 60% menos paginations, 100% dos incidents reais detectados.
```

### Pattern: customer-facing SLI dimensions

| Dimensão | Valor | Por quê SLI deve incluir |
|---|---|---|
| `endpoint` | `/api/v1/checkout` | Granular — não SLO global |
| `customer.tier` | `'enterprise'` | Diferentes targets por tier (Pro = 99.95% vs Free = 99.5%) |
| `region` | `us-east-1` | Identificar problema regional vs global |
| `feature_flag.<name>` | `true`/`false` | SLO durante rollout incremental |
| `tenant_id` | `'acme'` | Big customers podem ter SLOs próprios |

## Anti-patterns

### ANTI: SLO 99.99% ou 99.999%

```text
ANTI: target 99.99% em SLO de 30d sliding
  - 30d × 24h × 60min × (1-0.9999) = 4.3 minutos de tolerância
  - Sem tempo para reagir antes do budget esgotar
  - Burn rate alerts disparam após o budget acabar (zero-level)

CERTO: target ≤ 99.95% para SLO real
       Para 99.99%+, use métricas/dashboards informativos (não alerta)
```

### ANTI: SLO global "site up"

```text
ANTI: 1 SLO "site availability" para tudo
  - Falha em /api/v1/admin não conta para 99% dos clientes
  - Falha em /api/v1/checkout = catastrófico
  - Misturar = alarmes confusos, ações vagas

CERTO: 1 SLO por jornada crítica do user
  - checkout_success: 99.9%
  - login_success: 99.95%
  - search_p95_latency: 99% < 200ms
  - admin_panel: SEM SLO (uso baixo, latência aceitável)
```

### ANTI: SLO sem owner

```text
ANTI: SLO definido em retrospectiva, sem dono nomeado
  - Burn alert dispara → ninguém atende → escalation
  - Sem follow-up no fim do mês

CERTO: SLO tem owner em arquivo (yaml ou tabela DB)
       owner = team email ou pessoa específica
       Burn alert roteia direto para owner antes de escalation
```

### ANTI: SLO == SLA externo

```text
ANTI: usar SLA do contrato (99.9% uptime) como SLO interno

PROBLEMA: 0 margem de segurança. Atinge SLA mínimo no fio = 1 incident e quebra.

CERTO: SLO interno mais rígido que SLA externo
       SLA externo: 99.9% (compromisso com cliente)
       SLO interno: 99.95% (margem de 5× para reagir)
```

### ANTI: alterar SLI quando burn ocorre

```text
ANTI: SLO está queimando → "vamos relaxar SLI para reduzir false positives"
       (definir bad_event mais frouxo)

PROBLEMA: você está mascarando dor real. Próximo incident similar passa silencioso.

CERTO: SLI é compromisso com customer experience. Se está queimando, fixar
       o problema (root cause via core-analysis-loop), não o SLI.
       Se SLI sistematicamente errado (mede coisa errada): substituir, não relaxar.
```

### ANTI: fixed window (mensal/calendário)

```text
ANTI: error budget reseta dia 1 do mês

PROBLEMA: 
  - "Tivemos outage dia 31, reseta amanhã" — cliente NÃO esquece
  - Pressão para postergar fixes para "depois do reset"
  - Behavioral hazard: deploy arriscado dia 30

CERTO: sliding window 30d
       Outage dia 31 fica no budget até dia 30 do mês seguinte (sai gradualmente)
       Sem incentivo perverso, comportamento humano realista
```

## Verificação

Antes de marcar SLO como produção-pronto:

1. **Owner nomeado** — email/team em `slo.owner`
2. **SLI event-based** — pred boolean, não time-bucket
3. **Target ≤ 99.95%** — > 99.95% sinaliza informativo, não SLO
4. **Window 30d sliding** — não fixed
5. **Customer-facing journey** — SLI mede o que o cliente sente
6. **Materialized view** existe e é refreshable (pg_cron)
7. **Burn alerts** configurados (ver skill `burn-rate-alerting`)
8. **Quero SLO ou metric?** — se a resposta é "informativo", crie metric, não SLO

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — termos canônicos SLI/SLO/error budget
- `kit/skills/structured-events/SKILL.md` — eventos canônicos para alimentar SLI
- `kit/skills/burn-rate-alerting/SKILL.md` — lookahead/baseline windows
- `kit/skills/core-analysis-loop/SKILL.md` — investigar quando SLO queima
- `kit/agents/slo-engineer.md` — gera SLO.md + SQL para materializar SLI

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 12: "Using Service-Level Objectives for Reliability".*
