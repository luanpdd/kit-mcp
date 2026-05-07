---
name: sre-risk-management
description: Use ao escolher SLO target — risk continuum, error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more", sabedoria 99.99%.
---

# SRE — Risk Management

## Quando usar

LLM carrega esta skill ao definir SLO target, debater "qual disponibilidade precisamos?", ou justificar trade-off entre velocidade de release e estabilidade. Trigger phrases:

- "SLO target", "qual disponibilidade?"
- "99.9% vs 99.99%", "quantos noves?"
- "error budget", "risk budget"
- "risk continuum"
- "as reliable as needs to be"
- "sabedoria 99.99%", "smartphone dilui SLO"
- "embracing risk", "Google SRE cap 3"

## Regras absolutas

- **100% disponibilidade NÃO é o objetivo** — custo cresce não-linearmente acima de 99.95%; benefício marginal cai a zero porque outros componentes (ISP do usuário, smartphone, ar do ambiente) já têm < 99.99% de disponibilidade. Esforço além disso é desperdício.
- **"As reliable as needs to be, no more"** — disponibilidade é decisão de produto, não de engenharia. Pergunta: "qual nível o usuário percebe como aceitável e está disposto a pagar?" — não "qual o máximo que conseguimos?".
- **Sabedoria 99.99%** — smartphone tem ~99% de disponibilidade (sinal cai, bateria acaba, app trava). Usuário em 99% smartphone NÃO distingue serviço 99.99% vs 99.999% — ambos parecem "sempre funcionando" no contexto dele.
- **Error budget é balanço explícito risk × innovation** — `(1 - SLO_target) × total_events` é orçamento de "bad" que pode ser gasto em deploys arriscados, experimentos, refactors. Se budget esgota, freeze releases até regenerar.
- **Target ≤ 99.95% para SLO real** — 99.99% = 4.3 min de tolerância em 30d; sem tempo de reagir antes do budget esgotar; alerts viram zero-level. Para 99.99%+, use métricas/dashboards informativos, NÃO SLO acionável.
- **SLI deve refletir customer perception** — meça o que o usuário sente ("checkout completou em < 800ms"), não estado interno ("threads ativas"). Risk é sobre consequência do customer, não engenharia.
- **Diferentes tiers, diferentes targets** — `customer.tier='enterprise'` pode ter SLO 99.95%; `tier='free'` pode ter 99.5%. Risk é gradual; tratar todos clientes como tier-1 desperdiça budget.

## Patterns canônicos

### Pattern: risk continuum como decisão explícita

| Target | Tolerância 30d | User-perceptible? | Recomendação | Custo relativo |
|---|---|---|---|---|
| 99% | 7.2 h | Sim (notável) | Tier free, beta features, internal tools | 1× |
| 99.5% | 3.6 h | Notável em paths críticos | Tier free de produção | 2× |
| 99.9% | 43.2 min | Aceitável para maior parte de UX | Tier paid default | 5× |
| 99.95% | 21.6 min | Quase imperceptível | Tier enterprise / mission-critical | 10× |
| 99.99% | 4.3 min | Imperceptível em smartphone | Apenas se justificado por user perception (raro) | 50×+ |
| 99.999% | 26 s | NÃO perceptível | NUNCA para serviço user-facing | 100×+ |

Cada nove adicional **multiplica custo** mas **divide benefício marginal**. Cliente final (humano em smartphone com ISP residencial ~99%) tem disponibilidade no canal de comunicação inferior à do seu serviço 99.99%. Essa é a sabedoria 99.99%.

### Pattern: error budget como decisão de release

```yaml
# PT-BR: SLO documenta target + política de budget
slo:
  name: checkout_success
  target: 0.999          # 99.9% — escolha explícita no risk continuum
  window: 30d_sliding

# PT-BR: política de budget — o que fazer quando queima
budget_policy:
  green:                 # > 50% restante
    action: "Releases livres; experimentos OK"
  yellow:                # 10-50% restante
    action: "Aumentar canary % menor; review extra de PRs riscados"
  red:                   # < 10% restante
    action: "Freeze de features; foco em stability; postmortems revisitados"
  exhausted:             # 0%
    action: "Freeze total; rollback de releases recentes; SEV1 incident review"
```

Budget esgotado **não é punição** — é sinal de que o time gastou risk em demais releases arriscadas e precisa pausar para investir em stability. Restaurar budget = entregar trabalho que reduz erro, não pular o reset.

### Pattern: target diferenciado por customer.tier

```sql
-- PT-BR: SLO compliance por tier — diferentes targets, diferentes alarmes
select
  customer_tier,
  count(*) as total,
  count(*) filter (where result_success = true and duration_ms < 800) as good,
  count(*) filter (where result_success = true and duration_ms < 800)::float / count(*) as compliance,
  case customer_tier
    when 'enterprise' then 0.9995    -- PT-BR: 99.95% — paga por SLO rigoroso
    when 'pro' then 0.999            -- PT-BR: 99.9%
    when 'free' then 0.995           -- PT-BR: 99.5% — best effort
  end as target,
  case
    when count(*) filter (where result_success = true and duration_ms < 800)::float / count(*) >= (
      case customer_tier
        when 'enterprise' then 0.9995
        when 'pro' then 0.999
        when 'free' then 0.995
      end
    ) then 'IN_BUDGET'
    else 'OUT_OF_BUDGET'
  end as status
from observability.events
where service = 'orders-api' and timestamp > now() - interval '30 days'
group by customer_tier;
```

### Pattern: justificar 99.99%+ excepcional

```text
Para SLO ≥ 99.99%, o time DEVE responder afirmativamente a TODAS as perguntas:

1. User percebe diretamente a falha? (não apenas erro 500 — UX colapsa, dados perdidos)
   Ex: trading platform de high-frequency, controle de fluxo industrial, healthcare critical

2. Custo de outage > 10× custo de engineering p/ atingir target?
   (calcular: 4.3 min outage por mês × revenue/min impactado)

3. Sistema componentes downstream também são ≥ 99.99%?
   (cliente em ISP 99% — investir aqui é desperdício; trocar de ISP/CDN primeiro)

4. Time tem cultura para sustentar (canary obrigatório, rollback < 60s, on-call < 30s page)?
   (sem isso, 99.99% é aspiracional — real será 99.5%)

Se QUALQUER resposta = NÃO → use 99.95% ou menos. Justificar em SLO.md comentário inline.
```
