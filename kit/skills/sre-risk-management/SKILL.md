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
