---
name: burn-rate-alerting
description: Use ao calcular burn rate predictive — lookahead/baseline window com fator 4×, context-aware vs short-term, fórmula de extrapolação para alert page vs ticket.
---

# Observabilidade — Burn Rate Alerting

## Quando usar

LLM carrega esta skill ao configurar alertas SLO ou avaliar burn rate. Trigger phrases:

- "burn rate alert", "burn rate forecast"
- "lookahead window", "baseline window"
- "predictive vs context-aware"
- "quando paginar vs quando criar ticket"
- "extrapolar exhaustão de budget"

## Fórmula canônica

```
burn_rate = error_rate / (1 - SLO_target)
```

| Burn rate | Significado |
|---|---|
| 1× | Budget durará exatamente a janela do SLO |
| 2× | Budget acabará em metade da janela |
| 10× | Budget acabará em 1/10 da janela |
| 100× | Budget esgotado em horas, não dias |

**Predictive forecast (Cap 13 p145):**

```
projected_remaining_at_lookahead = current_remaining - (burn_rate_now × lookahead_window)
ALERT iff projected_remaining_at_lookahead < 0
```

## Regras absolutas

- **Lookahead ≤ 4× baseline** — extrapolar 4 horas a partir de baseline 1h é confiável; extrapolar 1 dia a partir de 1h é flappy. (Sem ajuste de seasonality)
- **Sliding window 30d** para o SLO — alinha com customer memory (skill [`event-based-slos`](../skills/event-based-slos/SKILL.md))
- **2 alertas por SLO** — short-term (page) + long-term (ticket). Não 1 só, não 5+.
- **Short-term: lookahead 4h, baseline 1h** — paga on-call em horas
- **Long-term: lookahead 3d, baseline 18h** — abre ticket, não acorda alguém
- **Context-aware vs short-term** — escolher por trade-off de custo vs sensibilidade. Default short-term para a maioria; context-aware se "10% restante = mais urgente que 90%".
- **Não alertar zero-level** — se você só alerta quando budget = 0, não há tempo de reagir. Use predictive sempre.

## Patterns canônicos

### Pattern: 2 alertas canônicos por SLO

```yaml
# PT-BR: para SLO 99.9% checkout_success com window 30d
slo: checkout_success
target: 0.999
window: 30d_sliding

alerts:
  # PT-BR: PAGE — paginar on-call (urgent)
  - name: short_term_burn
    type: predictive
    lookahead: 4h          # PT-BR: forecast 4h à frente
    baseline: 1h           # PT-BR: 4× regra (4h ≤ 4× 1h ✓)
    severity: page
    threshold_burn_rate: 14.4   # PT-BR: 4h × 14.4 = ~58h, esgota budget de 30d×0.001 = 43.2min em <4h
    routing: pagerduty:on-call
  
  # PT-BR: TICKET — criar ticket Jira/Linear (não-urgent)
  - name: long_term_burn
    type: predictive
    lookahead: 3d
    baseline: 18h          # PT-BR: 4× regra (3d ≤ 4× 18h = 72h ✓)
    severity: ticket
    threshold_burn_rate: 1.0    # PT-BR: 1× = vai esgotar em 30d se continuar
    routing: jira:engineering
```

### Pattern: query de burn rate atual (Postgres)

```sql
-- PT-BR: burn rate atual em janela baseline (último 1h)
-- Para SLO 99.9% checkout_success
with baseline as (
  select
    sum(good) as good,
    sum(bad) as bad,
    sum(total) as total
  from obs.sli_checkout_success
  where bucket > now() - interval '1 hour'   -- baseline window
)
select
  total,
  bad,
  bad::float / nullif(total, 0) as error_rate,
  (bad::float / nullif(total, 0)) / (1 - 0.999) as burn_rate,
  case
    when bad::float / nullif(total, 0) >= 0.0144 then 'PAGE'   -- burn_rate ≥ 14.4
    when bad::float / nullif(total, 0) >= 0.001 then 'TICKET'   -- burn_rate ≥ 1
    else 'OK'
  end as alert_status
from baseline;
```

### Pattern: predictive forecast — esgotamento

```sql
-- PT-BR: ETA exhaustão do budget em horas
with current_state as (
  select
    sum(case when bucket > now() - interval '30 days' then bad else 0 end) as bad_30d,
    sum(case when bucket > now() - interval '30 days' then total else 0 end) as total_30d,
    sum(case when bucket > now() - interval '1 hour' then bad else 0 end) as bad_1h,
    sum(case when bucket > now() - interval '1 hour' then total else 0 end) as total_1h
  from obs.sli_checkout_success
)
select
  -- PT-BR: budget restante em eventos
  (1 - 0.999) * total_30d - bad_30d as remaining_budget,
  -- PT-BR: taxa atual de queima (eventos/hora)
  bad_1h::float / 1 as burn_per_hour,
  -- PT-BR: ETA = budget restante / taxa
  case
    when bad_1h = 0 then 'NO_BURN'
    else round(((1 - 0.999) * total_30d - bad_30d) / nullif(bad_1h, 0))::text || 'h'
  end as eta_to_exhaustion
from current_state;
```

### Pattern: context-aware vs short-term

```text
SHORT-TERM (cheap):
  - Olha apenas baseline window (último 1h)
  - Não considera quanto budget já foi gasto
  - Mais barato; default para maioria
  - Pode causar false positive se budget está cheio (90% restante)

CONTEXT-AWARE (expensive):
  - Considera budget remanescente
  - "Remaining budget × tolerable_burn_rate ≥ lookahead × current_burn_rate"
  - Mais caro (query SLO total + recente)
  - Recomendado para SLOs de alto risco onde 10% restante > 90% restante
```

### Pattern: dashboard de burn rate (Markdown gerado por `/burn-rate-status`)

```markdown
# Burn Rate Status — 2026-05-06 14:32 UTC

| SLO | Target | Window | Budget gasto | Burn rate atual | ETA exhaustão | Ação |
|---|---|---|---|---|---|---|
| checkout_success | 99.9% | 30d sliding | 23% | 1.4× | 12d | informativo |
| login_success | 99.95% | 30d sliding | 78% | 8.0× | 4h | **PAGE on-call** |
| search_latency | 99% | 30d sliding | 15% | 0.7× | — | OK |
| admin_panel | (sem SLO) | — | — | — | — | — |
```

### Pattern: tightening alerts gradualmente

```text
SEMANA 1: SLO + alerts em test channel (não real page)
SEMANA 2: SLO + alerts em low-priority email
SEMANA 3-4: validar que SLO detecta incidents reais
SEMANA 5+: alerts SLO viram primários, threshold antigos para test channel
SEMANA 8+: deletar threshold antigos completamente

PT-BR: case study Honeycomb (Cap 12 p135) — SLO detectou outage 8h antes
       de threshold tradicional alertar. Confiança = deletar antigos.
```

## Anti-patterns

### ANTI: 1 alerta apenas (zero-level)

```text
ANTI: alert dispara quando budget == 0 (totalmente exausto)

PROBLEMA: você não tem tempo de reagir. Budget zerou, SLO violado, cliente afetado.

CERTO: 2 alertas:
  - Short-term: burn rate 14.4× → page (4h de runway)
  - Long-term: burn rate 1× → ticket (3d de runway)
```

### ANTI: lookahead >> baseline

```text
ANTI: lookahead 1d a partir de baseline 1h (24×)

PROBLEMA: extrapolação linear de janela curta para janela longa é inválida.
          Ciclos diários, semanais, sazonalidades distorcem.
          Alert flappa (entra/sai a cada hora).

CERTO: lookahead ≤ 4× baseline (regra empírica do livro p145)
       Para alertar 1d à frente: baseline ≥ 6h
```

### ANTI: burn rate threshold = 1×

```text
ANTI: page on-call quando burn rate >= 1× (igual à taxa que esgota a janela)

PROBLEMA: 1× sustained durante 1 mês = budget zerou ao final.
          Time tem 30d para reagir. NÃO é page-worthy.

CERTO: page = 14.4× (esgota em 4h, ação imediata)
       ticket = 1× (esgota em 30d, ação planejada)
```

### ANTI: burn rate calculation com janela errada

```text
ANTI: calcular burn rate sobre janela inteira de SLO (30d)

PROBLEMA: smooth out spikes recentes. Você vê "compliance ok 99.7%" mesmo
          quando última 1h queimou 30% do budget. Reage tarde.

CERTO: burn rate sobre baseline window (1h ou 18h), comparado ao SLO inteiro
       para avaliar remaining budget.
```

### ANTI: ignorar seasonality

```text
ANTI: alertar 1d à frente sem considerar que sábado tem 1/3 do tráfego

PROBLEMA: false positive sexta à noite (sábado vai ser baixo);
          false negative segunda de manhã (sábado foi baixo, segunda explode).

CERTO: ou (a) usar baseline window grande o suficiente para capturar 1 ciclo
            (≥ 24h cobre dia/noite; ≥ 7d cobre semana);
       ou (b) modelar seasonality (cíclico) — context-aware burn alerts
            que conhecem padrões.
```

## Verificação

Antes de promover burn alerts a produção:

1. **2 alertas por SLO** — short-term (page) + long-term (ticket)
2. **Lookahead ≤ 4× baseline** — verifique aritmética em cada
3. **Threshold burn rate calculado** — `target=99.9% → page=14.4×, ticket=1×`
4. **Routing nomeado** — `pagerduty:on-call` ou `jira:engineering`
5. **Test channel primeiro** — 1+ semana em low-priority antes de promover
6. **SLO já provou valor** — detectou incident antes de threshold antigo
7. **Documentação** — runbook de "o que fazer quando alert dispara"

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — burn rate, lookahead/baseline
- `kit/skills/event-based-slos/SKILL.md` — SLO definition
- `kit/skills/core-analysis-loop/SKILL.md` — investigar root cause após alert
- `kit/agents/burn-rate-forecaster.md` — agente que calcula via SQL
- `kit/commands/burn-rate-status.md` — comando que invoca forecaster

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 13: "Acting on and Debugging SLO-Based Alerts".*
