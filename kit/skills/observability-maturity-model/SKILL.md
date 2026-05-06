---
name: observability-maturity-model
description: Use ao avaliar maturidade observabilidade — 5 capacidades (resiliência, qualidade, complexidade, cadência, comportamento) com sintomas doing well/poorly por capacidade.
---

# Observabilidade — Maturity Model (OMM)

## Quando usar

LLM carrega esta skill ao auditar maturidade observability de projeto/time. Trigger phrases:

- "OMM", "observability maturity"
- "estamos prontos para SRE?"
- "quanto vale investir em observability?"
- "auditar observabilidade"
- "como saber se time está bem?"

## As 5 capacidades (Cap 21)

OMM mede 5 capacidades sociotécnicas, cada uma com sintomas qualitativos. Não é checkbox — é trajetória.

| # | Capacidade | Pergunta central |
|---|------------|------------------|
| **1** | **Resiliência** (Respond to System Failure) | Quanto tempo MTTR? On-call sustentável? |
| **2** | **Qualidade de Código** (Deliver High-Quality Code) | Bugs encontrados em prod ou pre-merge? |
| **3** | **Complexidade / Tech Debt** (Manage Complexity) | Engineers conseguem encontrar gargalos sem chutes? |
| **4** | **Cadência de Release** (Predictable Release Cadence) | Tempo do commit ao prod? Deploy diariamente ou mensalmente? |
| **5** | **Comportamento de Usuário** (Understand User Behavior) | Time consegue responder "quem usa feature X?" |

## Capacidade 1 — Resiliência

### Doing well
- Uptime atinge metas de negócio e está melhorando
- On-call response a alertas é eficiente; alertas não são ignorados
- Plantão não é estressante; engineers aceitam shifts adicionais
- Engineers manejam workload de incidents sem horas extras

### Doing poorly
- Time gastando muito tempo + dinheiro em on-call
- Incidents frequentes e prolongados
- On-call sofre alert fatigue ou perde failures reais
- Investigators não conseguem diagnosticar incidents
- Mesmas pessoas sempre puxadas para emergências (knowledge silo)

### Como observability ajuda
Alertas relevantes/focados/acionáveis (reduzem alert fatigue). Relação clara entre error budget e customer needs. Wide events permitem investigators efetivos. Alta cardinalidade pinpoint sources rapidamente. Investigation paths democratizados (qualquer engineer respondedor).

## Capacidade 2 — Qualidade de Código

### Doing well
- Código é estável; menos bugs em prod; menos outages
- Após deploy, time foca em customer solutions, não suporte
- Engineers acham intuitivo debugar em qualquer estágio
- Issues isoladas são fix-áveis sem cascading failures

### Doing poorly
- Custo alto de customer support
- Alto % do tempo de eng gasto em bugs vs features novas
- Engineers reluctant em deployar (perceived risk)
- Reproduzir falhas demora muito
- Devs com baixa confidence no código pós-ship

### Como observability ajuda
Mesmo tooling para debugar 1 máquina ou 10k. Telemetry rica mostra código em ação. Validar fix é fácil. Watch deployments e fix antes de visível para usuários.

## Capacidade 3 — Complexidade / Tech Debt

### Doing well
- Engineers gastam maioria do tempo em forward progress
- Bug fixing minoritário
- Engineers raramente desorientados ("onde no codebase?")

### Doing poorly
- Eng time desperdiçado rebuilding após scaling limits
- Times distraídos fixando coisa errada
- Localized changes têm ripple effects descontrolados
- "Haunted graveyard" — código que ninguém quer mexer

### Como observability ajuda
Performance end-to-end claramente mensurada. Investigators encontram trilhas em parte desconhecida do sistema. Tracing aponta gargalo correto. Engineers identificam o que otimizar (não chutes).

## Capacidade 4 — Cadência de Release

### Doing well
- Cadência alinha com customer needs
- Código entra em prod logo após escrito; engineer dispara deploy próprio
- Code paths habilitáveis/desabilitáveis sem deploy (feature flags)
- Deploys e rollbacks são rápidos

### Doing poorly
- Releases infrequentes; muita intervenção humana
- Muitas mudanças shipped de uma vez (batches)
- Releases em ordem específica obrigatória
- Sales gating em release train específico
- Times evitando deploys em certos dias/horários

### Como observability ajuda
Entende build pipeline + production. Mostra degradação em tests ou erros de build. Confidence no release: comparar build_id antes/depois é trivial. Drilldown em eventos específicos.

## Capacidade 5 — Comportamento de Usuário

### Doing well
- Product team consegue responder "qual feature mais usada?", "qual customer tier mais ativo?"
- Adoption tracking de features novas
- Sucesso ou abandono mensurável por dimensão (geo, tier, feature flag)

### Doing poorly
- Time intui "users gostaram disso" sem dados
- BI reports lentos demais (dias) para steering decisions
- "Quantos users hit este bug?" leva sprint inteiro para responder
- Sales/Customer Success usam dashboards diferentes do eng (silos)

### Como observability ajuda
Data democratizada — Product, CS, Sales, Exec consultam mesma observability data. Granular por user/tenant. Time real (não BI overnight). Slice & dice ad hoc por feature flag, customer tier, region.

## Patterns canônicos

### Pattern: scoring de OMM (1-5 por capacidade)

```text
1 = Initial: ad-hoc, individual heroics, sem padrão
2 = Repeatable: básico funciona; alguns engineers conseguem
3 = Defined: documentado e cross-team; new hires aprendem
4 = Managed: métricas + targets; tracking de regressão
5 = Optimizing: melhoria contínua; experimentação ativa
```

### Pattern: snapshot OMM (Markdown gerado por agent)

```markdown
# OMM Snapshot — kit-mcp 2026-05-06

| Capacidade | Score (1-5) | Trend | Sintomas-chave |
|---|---|---|---|
| 1. Resiliência | 3 | ↑ | MTTR 2h (era 6h em v1.7) |
| 2. Qualidade | 4 | → | Bugs em prod ↓ 70% após v1.6 |
| 3. Complexidade | 2 | ↑ | Tracing recém adotado v1.9 |
| 4. Cadência | 4 | → | Daily deploy ativo |
| 5. Comportamento usuário | 1 | ↑ | Sem product analytics ainda |

## Action items (priorizados)
1. [Cap 5] Adicionar dashboards Product (mais alto ROI dado score 1)
2. [Cap 3] Skills de tracing (Phase 29-30 v1.9 endereçaram)
3. [Cap 1] Reduzir MTTR de 2h para < 1h (usar incident-investigator)
```

### Pattern: regression check entre marcos

```text
ANTES de /concluir-marco, gerar OMM snapshot.
Se ALGUMA capacidade regrediu vs marco anterior:
  - Bloquear conclusion (workflow.omm_no_regression = true)
  - Ou abrir ticket explícito + warning, mas permitir conclusion
```

## Anti-patterns

### ANTI: scoring por checkbox (Maturity Model literal)

```text
ANTI: "checklist com 50 items; score = N items checked / 50"

PROBLEMA: prática observability não cabe em checklist. Score = comportamento sociotécnico.

CERTO: avaliar SINTOMAS qualitativos. "On-call está sustentável?" "Engineers conseguem debugar sem help?" Score reflete trajetória.
```

### ANTI: comparar org com peers (FAANG envy)

```text
ANTI: "FAANG faz X, então temos que fazer X também"

PROBLEMA: contexto importa. Org de 10 engineers ≠ Google.

CERTO: compare com VOCÊ MESMO (vs marco anterior). Cada org tem trajetória própria.
```

### ANTI: maturity model como ferramenta de marketing

```text
ANTI: "estamos no nível 5 de OMM!" como bragging rights

PROBLEMA: nível 5 é teórico (continuous improvement, never done).
          Self-promotion mascara gaps reais.

CERTO: OMM é diagnostic interno. Output → action items, não slides para sales.
```

### ANTI: prática técnica sem cultura

```text
ANTI: comprar tools de observability achando que resolve

PROBLEMA: tools sem skills/processo geram dashboards inúteis.
          OMM é SOCIO-técnico.

CERTO: tooling + skills + processo + cultura + buy-in. OMM mede tudo.
```

## Verificação

OMM snapshot canônico:

1. **5 capacidades scored** — cada uma 1-5
2. **Sintomas qualitativos citados** — não números abstratos
3. **Trend vs último marco** — ↑ ↓ →
4. **Action items priorizados** — capacidade com score baixo = high priority
5. **Owner por action item** — sem owner = sem ação
6. **Regression check** — alertar se alguma capacidade regrediu

---

## Ver também

- `kit/skills/_shared-observability/glossary.md` — termos OMM
- `kit/skills/event-based-slos/SKILL.md` — Cap 1 (resiliência via SLO/burn rate)
- `kit/skills/observability-driven-development/SKILL.md` — Cap 2 (qualidade), Cap 4 (cadência)
- `kit/skills/core-analysis-loop/SKILL.md` — Cap 3 (complexidade — encontrar gargalo)
- `kit/agents/omm-auditor.md` — agente que pontua e gera OMM snapshot
- `kit/commands/auditar-observabilidade.md` — comando que invoca o agente

*Material-fonte: Observability Engineering (O'Reilly, 2022) — Cap 21: "An Observability Maturity Model".*
