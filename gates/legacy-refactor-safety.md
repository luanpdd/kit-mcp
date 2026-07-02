---
id: legacy-refactor-safety
stage: pre-execute
blocking: false
description: Valida que tasks com kind=refactor em arquivos > 500 linhas OU com contrato externo têm characterization tests linkados. Skip se fase só toca markdown OR fase é greenfield. Opt-in via workflow.legacy_refactor_gate_blocking=true.
---

# Legacy refactor safety gate

**When to run:** pre-execute (consultive por default; blocking se `workflow.legacy_refactor_gate_blocking=true` E `omm.capacidade_1_resilience >= 3`).

**Skill canônica:** [`pre-refactor-characterization`](../kit/skills/pre-refactor-characterization/SKILL.md)

**Agent invocado:** [`refactor-safety-auditor`](../kit/agents/refactor-safety-auditor.md)

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar que tasks com kind=refactor em arquivos arriscados têm safety net.
# Estratégia: descobrir tasks da fase atual, identificar refactor + arquivos flagged,
# verificar characterization tests linkados, gerar warning ou block conforme mode.
# Bash 3.2-portable (macOS default).
set -e

# PT-BR: identificar fase atual via STATE.md
STATE_FILE=".planning/STATE.md"
CURRENT_PHASE=""
if [ -f "$STATE_FILE" ]; then
  CURRENT_PHASE=$(grep -E "^Fase:" "$STATE_FILE" 2>/dev/null | head -1 | sed -E 's/^Fase: *([0-9]+).*/\1/')
fi

if [ -z "$CURRENT_PHASE" ]; then
  echo "INFO: nenhuma fase ativa — gate skip."
  exit 0
fi

PHASE_DIR=".planning/phases/phase-${CURRENT_PHASE}"
[ ! -d "$PHASE_DIR" ] && exit 0

# PT-BR: ler config para mode
GATE_BLOCKING=false
if [ -f ".planning/config.json" ] && command -v jq >/dev/null; then
  CFG=$(jq -r '.workflow.legacy_refactor_gate_blocking // empty' .planning/config.json 2>/dev/null)
  [ "$CFG" = "true" ] && GATE_BLOCKING=true
fi

# PT-BR: ler omm — Capacidade 1 (Resilience) calibra mode default
if [ "$GATE_BLOCKING" = "false" ] && [ -f ".planning/OMM-REPORT.md" ]; then
  OMM_RES=$(grep -oE 'Capacidade 1.*Resilience.*[0-9]/5' .planning/OMM-REPORT.md 2>/dev/null \
    | grep -oE '[0-9]/5' | head -1 | sed 's|/5||')
  if [ -n "$OMM_RES" ] && [ "$OMM_RES" -ge 3 ]; then
    GATE_BLOCKING=true
  fi
fi

# PT-BR: identificar PLAN.md da fase atual
PLAN_FILES=$(find "$PHASE_DIR" -name "PLAN.md" 2>/dev/null)

REFACTOR_TASKS_RISKY=()
REFACTOR_TASKS_OK=()
TOTAL_REFACTOR=0

for plan_file in $PLAN_FILES; do
  # PT-BR: detectar tasks com kind=refactor (heurística — frase canônica)
  if grep -qiE "(refactor|refator|extract method|extract class|move method|reorganizar|limpar)" "$plan_file"; then
    # extrair arquivos mencionados em tasks de refactor
    AFFECTED_FILES=$(grep -oE "(src|lib|app|supabase|tests)/[a-zA-Z0-9_./-]+\.(ts|tsx|js|jsx|mjs|py|java|go|rb|cs|rs|cpp|c|h)" "$plan_file" 2>/dev/null | sort -u)

    for f in $AFFECTED_FILES; do
      [ ! -f "$f" ] && continue

      # PT-BR: critérios de risco
      LINES=$(wc -l < "$f" 2>/dev/null | tr -d ' ')
      EXTERNAL=false
      if echo "$f" | grep -qE "(supabase/functions|src/api|/handlers/webhooks|pages/api|integrations)"; then
        EXTERNAL=true
      fi

      RISK_HIGH=false
      [ "${LINES:-0}" -gt 500 ] && RISK_HIGH=true
      [ "$EXTERNAL" = "true" ] && RISK_HIGH=true

      if [ "$RISK_HIGH" = "true" ]; then
        TOTAL_REFACTOR=$((TOTAL_REFACTOR + 1))

        # PT-BR: verificar characterization tests linkados
        STEM=$(basename "$f" | sed 's/\.[^.]*$//')
        HAS_CHAR=false
        for chardir in tests test __tests__; do
          if find "$chardir" -path "*characterization*$STEM*" 2>/dev/null | head -1 | grep -q . ; then
            HAS_CHAR=true
            break
          fi
        done

        if [ "$HAS_CHAR" = "true" ]; then
          REFACTOR_TASKS_OK+=("$f")
        else
          REFACTOR_TASKS_RISKY+=("$f (lines=$LINES, external=$EXTERNAL)")
        fi
      fi
    done
  fi
done

# PT-BR: relatório
if [ ${#REFACTOR_TASKS_RISKY[@]} -eq 0 ]; then
  echo "✓ legacy-refactor-safety — sem refactors arriscados sem characterization."
  if [ ${#REFACTOR_TASKS_OK[@]} -gt 0 ]; then
    echo "   ${#REFACTOR_TASKS_OK[@]} refactor(s) com characterization linkados."
  fi
  exit 0
fi

# PT-BR: há refactors arriscados sem char
echo ""
echo "⚠ legacy-refactor-safety — refactor(s) sem characterization detectado(s):"
echo ""
for item in "${REFACTOR_TASKS_RISKY[@]}"; do
  echo "  - $item"
done
echo ""
echo "Skill canônica: kit/skills/pre-refactor-characterization/SKILL.md"
echo ""
echo "Caminhos para resolver:"
echo "  1. /caracterizar <file>                    (full chain — preferido)"
echo "  2. /refactor-seguro --mode=sprout <file>  (não toca legado, ADICIONA via sprout)"
echo "  3. /refactor-seguro --mode=safe-extract <file>  (apenas refactor mecânico)"
echo "  4. /refactor-seguro --mode=override --ticket REQ-N --reason \"...\"  (último recurso)"
echo ""

if [ "$GATE_BLOCKING" = "true" ]; then
  echo "MODE: blocking (workflow.legacy_refactor_gate_blocking=true OR OMM Capacidade 1 ≥ 3)"
  echo "Resolve antes de prosseguir com /executar-fase."
  exit 1
else
  echo "MODE: consultive (warning apenas)"
  echo "Para tornar blocking: setar workflow.legacy_refactor_gate_blocking=true em .planning/config.json"
  exit 0
fi
```

## Configuração

```json
// .planning/config.json
{
  "workflow": {
    "legacy_refactor_gate_blocking": true,
    "legacy_refactor_min_lines": 500,
    "legacy_refactor_external_paths": [
      "supabase/functions/**",
      "src/api/**",
      "src/handlers/webhooks/**",
      "pages/api/**"
    ]
  }
}
```

**Default:** `legacy_refactor_gate_blocking` = false (consultive). Auto-promove para `true` se `omm-auditor` (v1.9) reportar Capacidade 1 (Resilience) ≥ 3 — sinal de que projeto tem maturity de safety.

## Quando NÃO rodar

- Fase só toca markdown/docs — sem código a refactor
- Projeto < 1 mês de idade — código novo não é "legacy" no sentido Feathers
- Projeto sem `omm-auditor` rodado E sem flag explícita — skip silencioso (consultive)
- Tasks são `bug-fix` ou `feature` (não refactor) — gate só roda em refactor

## Ver também

- [`pre-refactor-characterization`](../kit/skills/pre-refactor-characterization/SKILL.md) — knowledge base do gate
- [`refactor-safety-auditor`](../kit/agents/refactor-safety-auditor.md) — agent invocado em runtime
- [`legacy-characterizer`](../kit/agents/legacy-characterizer.md) — agent que gera safety net
- [`golden-signals-coverage`](./golden-signals-coverage.md) — gate análogo da Suíte SRE
- [`prr-checklist-coverage`](./prr-checklist-coverage.md) — gate análogo da Suíte SRE para PRR
- [`omm-no-regression`](./omm-no-regression.md) — gate análogo da Suíte Observabilidade para OMM
