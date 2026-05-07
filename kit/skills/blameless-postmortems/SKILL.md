---
name: blameless-postmortems
description: Use após incident SEV1/SEV2 — template canônico (9 seções), cultura blameless (foco em sistema, não pessoas), no postmortem left unreviewed, Wheel of Misfortune.
---

# SRE — Blameless Postmortems

## Quando usar

LLM carrega esta skill ao escrever postmortem após incident, revisar postmortem de par, ou conduzir Wheel of Misfortune. Trigger phrases:

- "postmortem", "post-mortem"
- "incident review"
- "blameless", "sem culpa"
- "root cause analysis", "5 whys"
- "Wheel of Misfortune"
- "lessons learned"
- "Google SRE cap 15"
- "no postmortem left unreviewed"

## Regras absolutas

- **Foco em sistema/processo, NÃO em pessoas** — root cause é "ausência de canary release" ou "RPS limit não documentado", NÃO "Maria fez deploy errado". Pessoas são parte do sistema. Se Maria errou, pergunte: "que processo permitiu o erro chegar a prod?".
- **Trigger postmortem para SEV1/SEV2 + near-miss notáveis** — todo incident customer-facing com impacto ≥ 1 min de SLO burn ou ≥ 1 user reportado. Near-miss (incident detectado antes de impacto) também: oportunidade de aprender sem custo.
- **"No postmortem left unreviewed"** — todo postmortem revisado por par sênior antes de arquivar. Sem revisão, postmortem mente (involuntariamente — autor está perto demais).
- **Action items SMART com owner nomeado** — Specific, Measurable, Assignable, Realistic, Time-bound. "Melhorar monitoring" NÃO é SMART. "Adicionar alert SLO burn rate em /api/v1/orders por @bob até 2026-05-15" É SMART.
- **Timeline em UTC** — não "horário local Brasília" ou ambíguo. Times distribuídos compõem timeline e UTC é o único timezone universal. Sempre `HH:MM UTC`.
- **Quantificar impact** — usuários afetados (número/percentual), revenue impact, SLO budget consumido. Sem quantificação, severity é subjetivo.
- **Lições generalizáveis, não específicas** — "Adicionar alert para essa query específica" é local. "Adicionar alert SLO em todas as queries de write em paths críticos" é generalizável.
- **Wheel of Misfortune trimestral** — exercício de role-play onde uma pessoa narra um incident histórico e o time pratica response (sem dados reais expostos a stress real). Treina muscle memory para SEV1.
