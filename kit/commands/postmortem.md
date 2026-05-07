---
name: postmortem
description: Invoca postmortem-writer — modo --from-investigation <id> (lê v1.9 trail) ou --incident "<descrição>" standalone; produz postmortem blameless 9 seções.
argument-hint: "(--from-investigation <id> | --incident \"<descrição>\") [--severity SEV1|SEV2|SEV3]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Gerar **postmortem blameless** de 9 seções (cap 15 do livro Google SRE) — Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC. Invoca o agente [`postmortem-writer`](../agents/postmortem-writer.md) que aplica a skill [`blameless-postmortems`](../skills/blameless-postmortems/SKILL.md) — cultura blameless ("foco em sistema/processo, NÃO em pessoas"), action items SMART, "no postmortem left unreviewed".

**Cria/Atualiza:**
- `.planning/postmortems/<id>.md` — postmortem blameless completo

**Após:** o user tem postmortem revisável + action items concretos. Phase 40 INT-FW-V2-01 chained do `/forense` automaticamente após Core Analysis Loop fechar.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — comando suporta **2 modos mutuamente exclusivos**.

**Modo A: `--from-investigation <id>` (preferido — continuação de v1.9)**

Lê `.planning/investigations/<id>.md` produzido pelo [`incident-investigator`](../agents/incident-investigator.md) (v1.9 — Core Analysis Loop). Extrai automaticamente: trigger, root cause, hipóteses validadas, action items. Campos faltantes (impact quantificado, severity, autores) são perguntados via `AskUserQuestion`.

**Modo B: `--incident "<descrição>"` (standalone)**

Para postmortem sem investigation prévia (incident menor, near-miss, lições retrospectivas). Agent gera template e usa `AskUserQuestion` para 9 perguntas guiadas — uma por seção canônica.

**Flags adicionais:**
- `--severity <SEV1|SEV2|SEV3>` — severity do incident (default: AskUserQuestion)
- `--output <path>` — caminho do postmortem (default: `.planning/postmortems/<id>.md` — id auto-gerado)

**Exemplos:**
```
/postmortem --from-investigation incident-2026-05-06-1432-checkout-burn   # Modo A
/postmortem --incident "checkout SLO burn às 14:32 — RCA N+1 query orders" --severity SEV2  # Modo B
/postmortem --incident "near-miss: deploy bloqueou 2min antes do PR-1234"                    # near-miss
```

**Pré-requisito (Modo A):** arquivo `.planning/investigations/<id>.md` existe (criado por `/investigar-producao` ou `/forense`).
</context>
