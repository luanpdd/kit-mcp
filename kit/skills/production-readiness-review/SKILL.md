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
