---
name: sre-risk-management
cost_tier: leve
description: Orienta escolha de SLO target — decide noves justificáveis via risk continuum, modela error budget como balanço risk×innovation e define política green/yellow/red por tier de cliente.
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

## Anti-patterns

### ANTI: pursuit of 100% availability

```text
ANTI: perseguir 100% como meta de disponibilidade — rejeitar qualquer outage como
      falha de engenharia; medir sucesso por "zero downtime"

PROBLEMA: custo cresce assintoticamente perto de 100%; benefício marginal cai a zero
          porque downstream (ISP do usuário, smartphone, ar do ambiente) já tem
          < 99.99%; time burns out perseguindo target inalcançável; budget de
          inovação some — toda capacidade vai para reliability sem ganho real.

CERTO: aceitar imperfeição como design — error budget existe PARA SER GASTO em
       deploys arriscados, experimentos, refactors. Reliability é trade-off
       contra velocity, não absoluto.
```

### ANTI: SLO 99.99% sem justificativa

```text
ANTI: definir 99.99% como target por default — "queremos o melhor possível";
      copiar número do AWS SLA; impor 99.99% sem checklist de justificação

PROBLEMA: 4.3 min de tolerância em 30d é zero margem de manobra; alerts disparam
          após budget esgotar (zero-level — tarde demais para ação preventiva);
          comportamentos perversos (esconder outages para preservar number);
          time-pressure compulsiva; aspiração ≠ realidade — real será 99.5%
          por falta de cultura para sustentar.

CERTO: ≤ 99.95% por default; 99.99%+ exige passar checklist de 4 perguntas
       (ver Pattern: justificar 99.99%+ excepcional). Documentar racional em
       SLO.md como comentário inline auditável.
```

### ANTI: SLO global "site availability"

```text
ANTI: 1 SLO genérico "site availability 99.9%" cobrindo tudo — /admin, /api,
      /checkout, /search, /docs com mesmo target

PROBLEMA: falha em /admin (uso 1×/dia por staff) não importa para customer;
          falha em /checkout (uso 100×/min com revenue impact) é catastrófico;
          mistura tudo no mesmo budget — alerts confusos, ações vagas; quando
          burn dispara, time não sabe o que priorizar.

CERTO: 1 SLO por jornada crítica do user (`checkout_success: 99.9%`,
       `login_success: 99.95%`, `search_p95: 99% < 200ms`); cada um com target
       apropriado ao seu risk; admin/docs SEM SLO formal (só metric informativo).
```

### ANTI: budget como score de "performance"

```text
ANTI: celebrar "atingimos SLO 99.99% este mês!" como vitória; KPIs comparam
      times por % budget intacto; pressão de leadership para subir target

PROBLEMA: budget vira métrica de vaidade; budget intacto significa SUBUTILIZAÇÃO
          (não shippamos suficientes deploys arriscados/experimentos); leadership
          pressiona por mais features sem reconhecer trade-off; quando budget
          esgota uma vez, vira "fracasso" — time esconde problemas no próximo mês.

CERTO: budget é orçamento — gastá-lo é OK e esperado. KPI é "shippamos N deploys
       de valor sem queimar budget", não "budget alto". Budget esgotado = sinal
       de aprender (quais releases custaram caro?), não punição.
```

### ANTI: SLA == SLO

```text
ANTI: usar SLA do contrato (99.9%) como SLO interno — "se prometemos 99.9% no
      contrato, basta atingir 99.9% internamente"

PROBLEMA: 0 margem de segurança entre compromisso comercial e meta interna;
          primeira anomalia operacional quebra contrato; sem buffer para reagir;
          SEV1 vira liability legal; cliente perde confiança no primeiro burn.

CERTO: SLO interno mais rígido que SLA externo — fator de margem 5×.
       SLA externo: 99.9% (compromisso ao cliente);
       SLO interno: 99.95% (meta de engenharia com folga para reagir).
```

## Verificação

Antes de marcar SLO target como decidido:

1. **Target justificado por customer perception** — não "queremos 99.99%" mas "usuário em smartphone percebe falha acima de X%"
2. **Target ≤ 99.95%** OU passou checklist de 99.99%+ (ver Pattern: justificar 99.99%+ excepcional)
3. **Tier-aware** — diferentes targets para `customer.tier` quando aplicável (enterprise/pro/free)
4. **Budget policy documentada** — 4 estados (green/yellow/red/exhausted) com ações claras
5. **Owner nomeado** — SLO sem dono = sem ação = sem valor
6. **SLI customer-facing** — mede o que cliente sente, não estado interno
7. **SLA externo > SLO interno** — margem entre compromisso comercial e meta interna

## Ver também

- [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — termos canônicos risk continuum, error budget, MTTR/MTBF
- [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — definir SLO event-based com sliding window
- [`burn-rate-alerting`](../burn-rate-alerting/SKILL.md) (v1.9) — alertas predictive sobre error budget
- [`production-readiness-review`](../production-readiness-review/SKILL.md) — PRR axis "Performance" usa risk continuum
- [`blameless-postmortems`](../blameless-postmortems/SKILL.md) — postmortem documenta budget consumido

---

*Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016) — Cap 3: "Embracing Risk".*
