---
id: omm-no-regression
stage: pre-conclude
blocking: false
description: Valida que nenhuma das 5 capacidades OMM regrediu vs marco anterior. Rodável em /concluir-marco. Não-bloqueante (warn) por default; configurável via workflow.omm_no_regression.
---

# OMM no-regression gate

**When to run:** pre-conclude (antes de `/concluir-marco` arquivar marco).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar que OMM-REPORT.md atual não tem capacidade regredida vs marco anterior.
# Estratégia: comparar scores no OMM-REPORT.md atual vs último arquivado.
set -e

CURRENT=".planning/OMM-REPORT.md"

if [ ! -f "$CURRENT" ]; then
  echo "WARN: $CURRENT ausente — rodar /auditar-observabilidade primeiro. Pulando gate."
  exit 0
fi

# PT-BR: encontrar OMM-REPORT.md anterior em milestones arquivados
PREVIOUS=$(find .planning/milestones -name "OMM-REPORT.md" -type f 2>/dev/null | sort -r | head -1)

if [ -z "$PREVIOUS" ] || [ ! -f "$PREVIOUS" ]; then
  echo "INFO: sem OMM-REPORT anterior arquivado (primeiro marco com OMM). Pulando regression check."
  exit 0
fi

# PT-BR: extrair scores do OMM-REPORT.md atual e anterior
# Formato esperado: "| 1 | Resiliência | 3 | ... |"

REGRESSIONS=0
for cap in 1 2 3 4 5; do
  current_score=$(grep -E "^\| $cap \| " "$CURRENT" 2>/dev/null | awk -F'|' '{print $4}' | tr -d ' ' | head -1)
  previous_score=$(grep -E "^\| $cap \| " "$PREVIOUS" 2>/dev/null | awk -F'|' '{print $4}' | tr -d ' ' | head -1)

  if [ -z "$current_score" ] || [ -z "$previous_score" ]; then
    continue
  fi

  if [ "$current_score" -lt "$previous_score" ]; then
    cap_name=$(grep -E "^\| $cap \| " "$CURRENT" | awk -F'|' '{print $3}' | xargs)
    echo "REGRESSION: Capacidade $cap ($cap_name) regrediu de $previous_score → $current_score"
    REGRESSIONS=$((REGRESSIONS + 1))
  fi
done

if [ "$REGRESSIONS" -eq 0 ]; then
  echo "PASS: nenhuma das 5 capacidades OMM regrediu vs $PREVIOUS"
  exit 0
else
  echo "WARN: $REGRESSIONS capacidade(s) regredida(s)"
  # PT-BR: blocking=false por default. Para tornar bloqueante:
  #   workflow.omm_no_regression=true
  if [ "$(node ./.claude/framework/bin/tools.cjs config-get workflow.omm_no_regression 2>/dev/null || echo false)" = "true" ]; then
    exit 1
  fi
  exit 0
fi
```

## Why

OMM regression alerta o time que algo deteriorou apesar do esforço do marco. Sem este gate, regressions silenciam e accumulate como tech debt invisível.

Default não-bloqueante para evitar ruído inicial; flag `workflow.omm_no_regression=true` opt-in quando time confiante.

## REQ

QA-03 + INT-FW-04 + INT-FW-05.

## Configuração

```bash
# PT-BR: tornar bloqueante (recomendado depois de 2-3 marcos consecutivos sem regression)
node ./.claude/framework/bin/tools.cjs config-set workflow.omm_no_regression true
```
