---
id: observability-coverage
stage: pre-milestone-close
blocking: false
description: Valida que ≥ X% das Edge Functions têm 4 golden signals + SLO + burn alert + characterization. Default threshold 70%. Opt-in via workflow.observability_coverage_threshold.
---

# Observability coverage gate (cross-suite)

**When to run:** pre-milestone-close (consultive default; blocking se `workflow.observability_coverage_threshold > 0`).

**Skills canônicas:** [`four-golden-signals`](../kit/skills/four-golden-signals/SKILL.md), [`event-based-slos`](../kit/skills/event-based-slos/SKILL.md), [`burn-rate-alerting`](../kit/skills/burn-rate-alerting/SKILL.md), [`legacy-characterization-tests`](../kit/skills/legacy-characterization-tests/SKILL.md)

**Agent invocado:** [`observability-coverage-auditor`](../kit/agents/observability-coverage-auditor.md)

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar cobertura cross-suite de Edge Functions
set -e

# threshold do gate
THRESHOLD=70
if [ -f ".planning/config.json" ] && command -v jq >/dev/null; then
  CFG=$(jq -r '.workflow.observability_coverage_threshold // empty' .planning/config.json 2>/dev/null)
  [ -n "$CFG" ] && [ "$CFG" != "null" ] && THRESHOLD=$CFG
fi

# se threshold = 0, gate skip (opt-in)
if [ "$THRESHOLD" -eq 0 ]; then
  echo "INFO: workflow.observability_coverage_threshold=0 — gate skip (opt-in não habilitado)."
  exit 0
fi

# enumerar Edge Functions
NUM_EDGE_FNS=$(find supabase/functions -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
if [ "$NUM_EDGE_FNS" -eq 0 ]; then
  echo "INFO: nenhuma Edge Function detectada — gate skip."
  exit 0
fi

# contar Edge Functions cobertas em cada dimensão
COVERED_SIGNALS=0
COVERED_SLO=0
COVERED_BURN=0
COVERED_CHAR=0

for fn_dir in $(find supabase/functions -mindepth 1 -maxdepth 1 -type d 2>/dev/null); do
  FN_NAME=$(basename "$fn_dir")
  FN_FILE="$fn_dir/index.ts"
  [ ! -f "$FN_FILE" ] && continue

  # 4 golden signals
  HAS_LATENCY=$(grep -qE "createHistogram|histogram.*ms|latency_histogram" "$FN_FILE" && echo true || echo false)
  HAS_TRAFFIC=$(grep -qE "createCounter.*requests|http_requests_total|trafficCounter" "$FN_FILE" && echo true || echo false)
  HAS_ERRORS=$(grep -qE "createCounter.*errors|http_errors_total|error_type" "$FN_FILE" && echo true || echo false)
  HAS_SAT=$(grep -qE "createObservableGauge|connection_pool|queue_depth" "$FN_FILE" && echo true || echo false)
  if [ "$HAS_LATENCY" = "true" ] && [ "$HAS_TRAFFIC" = "true" ] && [ "$HAS_ERRORS" = "true" ] && [ "$HAS_SAT" = "true" ]; then
    COVERED_SIGNALS=$((COVERED_SIGNALS + 1))
  fi

  # SLO
  if [ -f ".planning/slos/$FN_NAME.md" ] || ([ -f ".planning/SLO.md" ] && grep -q "$FN_NAME" ".planning/SLO.md"); then
    COVERED_SLO=$((COVERED_SLO + 1))
  fi

  # Burn alert
  if grep -rq "$FN_NAME" .planning/burn-rate-alerts.md .planning/SLO.md 2>/dev/null; then
    COVERED_BURN=$((COVERED_BURN + 1))
  fi

  # Characterization
  for chardir in tests/characterization test/characterization __tests__/characterization; do
    if find "$chardir" -path "*$FN_NAME*" 2>/dev/null | head -1 | grep -q .; then
      COVERED_CHAR=$((COVERED_CHAR + 1))
      break
    fi
  done
done

# computar percentages
PCT_SIGNALS=$((COVERED_SIGNALS * 100 / NUM_EDGE_FNS))
PCT_SLO=$((COVERED_SLO * 100 / NUM_EDGE_FNS))
PCT_BURN=$((COVERED_BURN * 100 / NUM_EDGE_FNS))
PCT_CHAR=$((COVERED_CHAR * 100 / NUM_EDGE_FNS))

# avg
PCT_AVG=$(( (PCT_SIGNALS + PCT_SLO + PCT_BURN + PCT_CHAR) / 4 ))

echo ""
echo "observability-coverage gate — threshold: ${THRESHOLD}%"
echo ""
echo "  4 Golden Signals:        ${COVERED_SIGNALS}/${NUM_EDGE_FNS} (${PCT_SIGNALS}%)"
echo "  SLO definido:            ${COVERED_SLO}/${NUM_EDGE_FNS} (${PCT_SLO}%)"
echo "  Burn rate alert:         ${COVERED_BURN}/${NUM_EDGE_FNS} (${PCT_BURN}%)"
echo "  Characterization tests:  ${COVERED_CHAR}/${NUM_EDGE_FNS} (${PCT_CHAR}%)"
echo ""
echo "  Avg coverage: ${PCT_AVG}%"
echo ""

# decisão
if [ "$PCT_AVG" -ge "$THRESHOLD" ]; then
  echo "✓ Avg ≥ threshold (${PCT_AVG}% ≥ ${THRESHOLD}%). Gate aprovado."
  exit 0
fi

echo "⚠ Avg < threshold (${PCT_AVG}% < ${THRESHOLD}%)."
echo ""
echo "Próximas ações:"
echo "  /auditar-observabilidade-cobertura      (vê detalhes + top 5 críticas)"
echo "  /golden-signals <fn>                    (instrumentar 4 signals)"
echo "  /definir-slo <fn>                       (define SLO event-based)"
echo "  /caracterizar <fn>                      (characterization tests)"
echo ""

# blocking se threshold > 0 e não atingido
if [ "$THRESHOLD" -gt 0 ]; then
  exit 1
fi

exit 0
```

## Configuração

```json
{
  "workflow": {
    "observability_coverage_threshold": 70
  }
}
```

**Default:** `0` (skip — opt-in). Recomendação:
- Projetos < 6 meses: 50 (consultive)
- Projetos 6-12 meses: 70
- Projetos > 12 meses ou tier-1 production: 80+

## Quando NÃO rodar

- Projeto sem Edge Functions (puro frontend/backend stateless)
- Projeto recém-criado (< 1 mês) — distribuição de Edge Functions ainda imatura
- Greenfield onde Edge Functions estão sendo escritas em paralelo a milestones

## Ver também

- [`observability-coverage-auditor`](../kit/agents/observability-coverage-auditor.md) — agent canônico
- [`/auditar-observabilidade-cobertura`](../kit/commands/auditar-observabilidade-cobertura.md) — comando dedicado
- [`omm-no-regression`](./omm-no-regression.md) — gate análogo da Suíte Observabilidade
- [`golden-signals-coverage`](./golden-signals-coverage.md) — gate específico apenas para golden signals
