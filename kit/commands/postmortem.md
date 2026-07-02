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

<process>

## 1. Parsear argumentos (2 modos)

```bash
INV_ID=$(echo "$ARGUMENTS" | grep -oE -- '--from-investigation [^ ]+' | awk '{print $2}')
INCIDENT=$(echo "$ARGUMENTS" | grep -oE -- '--incident "[^"]+"' | sed 's/--incident //; s/^"//; s/"$//')
SEVERITY=$(echo "$ARGUMENTS" | grep -oE -- '--severity [^ ]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

# PT-BR: validar mutuamente exclusivos
if [ -n "$INV_ID" ] && [ -n "$INCIDENT" ]; then
  echo "✗ Erro: --from-investigation e --incident são mutuamente exclusivos. Escolha um."
  exit 1
fi

# PT-BR: se nenhum dos 2 → AskUserQuestion (Modo C — interativo)
if [ -z "$INV_ID" ] && [ -z "$INCIDENT" ]; then
  # Listar investigations recentes para sugestão
  RECENT_INVS=$(ls -t .planning/investigations/*.md 2>/dev/null | head -5 | while read f; do basename "$f" .md; done | tr '\n' ',')
  # AskUserQuestion: "Modo? Continuar de investigation existente OU postmortem standalone?"
  # Opções: Continuar de <ID> (uma por investigation recente) | Standalone (texto livre)
  echo "ℹ Sem flag explícita. Use --from-investigation <id> ou --incident \"<descrição>\"."
  [ -n "$RECENT_INVS" ] && echo "  Investigations recentes: $RECENT_INVS"
  exit 1
fi
```

## 2. Validar pré-requisitos por modo

```bash
mkdir -p .planning/postmortems

# PT-BR: Modo A — investigation file precisa existir
if [ -n "$INV_ID" ]; then
  INV_FILE=".planning/investigations/${INV_ID}.md"
  if [ ! -f "$INV_FILE" ]; then
    echo "✗ Investigation $INV_ID não existe. Liste com: ls .planning/investigations/"
    echo "  Para postmortem standalone: /postmortem --incident \"<descrição>\""
    exit 1
  fi
  # PT-BR: derivar postmortem id do investigation_id
  POSTMORTEM_ID="$INV_ID"
fi

# PT-BR: Modo B — gerar postmortem id automaticamente
if [ -n "$INCIDENT" ]; then
  DATE=$(date -u +%Y-%m-%d-%H%M)
  SLUG=$(echo "$INCIDENT" | tr ' ' '-' | tr -cd 'a-zA-Z0-9-' | head -c 30 | sed 's/-$//')
  POSTMORTEM_ID="postmortem-${DATE}-${SLUG}"
fi

# PT-BR: default output_path (override via --output)
[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/postmortems/${POSTMORTEM_ID}.md"

# PT-BR: idempotência — não sobrescrever postmortem existente sem confirmar
if [ -f "$OUTPUT_PATH" ]; then
  echo "⚠ Postmortem $OUTPUT_PATH já existe."
  echo "  Use --output <novo-path> ou rm $OUTPUT_PATH antes de re-rodar."
  exit 1
fi
```

## 3. Listar postmortems recentes (UX)

```bash
# PT-BR: contexto — postmortems anteriores para correlacionar lessons learned
ls -t .planning/postmortems/*.md 2>/dev/null | head -3 | while read f; do
  ID=$(basename "$f" .md)
  DATE=$(grep -m1 '\*\*Date:\*\*' "$f" 2>/dev/null | sed 's/.*Date:\*\* //' || echo "?")
  printf "  %s — %s\n" "$ID" "$DATE"
done
```

## 4. Dispatch para `postmortem-writer`

```text
Task(
  subagent_type="postmortem-writer",
  prompt="
${INV_ID:+investigation_id: ${INV_ID}}
${INCIDENT:+incident_description: ${INCIDENT}}
${SEVERITY:+severity: ${SEVERITY}}
output_path: ${OUTPUT_PATH}
postmortem_id: ${POSTMORTEM_ID}

Aplicar skill blameless-postmortems. Modo:
${INV_ID:+- Modo A: ler .planning/investigations/${INV_ID}.md, extrair trigger/root_cause/hipóteses/action_items automaticamente; perguntar via AskUserQuestion apenas campos faltantes (impact quantificado, severity, autores).}
${INCIDENT:+- Modo B: gerar template; perguntar via AskUserQuestion 9 questões guiadas — uma por seção canônica (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline).}

Padrões obrigatórios:
- Foco em sistema/processo (NUNCA em pessoas) — anti-pattern blame culture
- Action items SMART (Specific, Measurable, Assignable, Realistic, Time-bound)
- Timeline em UTC sempre
- Impact quantificado (# usuários, duração, SLO budget consumido, revenue se aplicável)
- 9 seções canônicas obrigatórias (skip = inválido)
"
)
```

## 5. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► POSTMORTEM ▸ ${POSTMORTEM_ID}
═══════════════════════════════════════════════════════════

[output do postmortem-writer — ver Step 6 do agent]

## Estado salvo
.planning/postmortems/${POSTMORTEM_ID}.md

## Próximos passos
1. Revisar o postmortem com o time — "no postmortem left unreviewed"
2. Distribuir para reviewer SRE OU par externo (anti-pattern: auto-review)
3. Action items entram no roadmap (`/adicionar-tarefa` ou `/adicionar-fase`)
4. Se PRR for próximo passo de production-readiness: `/prr --service <name>`
5. Cross-ref OMM: postmortems alimentam Capacidade 5 (Incident Response) — `/observabilidade omm`
```

</process>

<success_criteria>
- [ ] `--from-investigation <id>` E `--incident "<text>"` parseados (mutuamente exclusivos)
- [ ] Modo A: arquivo `.planning/investigations/<id>.md` validado existe antes de dispatch
- [ ] Modo B: postmortem_id auto-gerado a partir de date + slug
- [ ] Idempotência: não sobrescreve postmortem existente sem `--output` explícito
- [ ] `postmortem-writer` invocado via `Task(subagent_type=...)` com prompt completo (modo + 9 seções + padrões)
- [ ] `.planning/postmortems/<id>.md` criado pelo agent
- [ ] Próximos passos sugerem cross-ref para `/prr`, `/observabilidade omm`, `/adicionar-tarefa`
</success_criteria>
