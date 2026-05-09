---
id: release-pipeline-policy
stage: pre-milestone-close
blocking: false
description: Valida release pipeline scored ≥ X/30 (default 20 = ADEQUATE) em hermeticidade + reprodutibilidade + policy enforcement. Opt-in via workflow.complete_milestone_release_pipeline_gate. Cap 8 livro Google SRE.
---

# Release pipeline policy gate

**When to run:** pre-milestone-close (consultive default; blocking se `workflow.complete_milestone_release_pipeline_gate=true`).

**Skill canônica:** [`release-engineering`](../kit/skills/release-engineering/SKILL.md) + [`hermetic-builds`](../kit/skills/hermetic-builds/SKILL.md)

**Agent invocado:** [`release-pipeline-auditor`](../kit/agents/release-pipeline-auditor.md)

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar release pipeline scored >= threshold
set -e

# threshold do gate
THRESHOLD=20  # default: ADEQUATE
GATE_BLOCKING=false

if [ -f ".planning/config.json" ] && command -v jq >/dev/null; then
  CFG=$(jq -r '.workflow.complete_milestone_release_pipeline_gate // empty' .planning/config.json 2>/dev/null)
  if [ "$CFG" = "true" ]; then
    GATE_BLOCKING=true
  fi
  CFG_THRESH=$(jq -r '.workflow.release_pipeline_threshold // empty' .planning/config.json 2>/dev/null)
  [ -n "$CFG_THRESH" ] && [ "$CFG_THRESH" != "null" ] && THRESHOLD=$CFG_THRESH
fi

# se não opt-in, gate skip
if [ "$GATE_BLOCKING" = false ] && [ -z "$RELEASE_PIPELINE_POLICY_FORCE" ]; then
  echo "INFO: release-pipeline-policy gate is opt-in (workflow.complete_milestone_release_pipeline_gate=false). Skip."
  exit 0
fi

# ler RELEASE-AUDIT.md OR delegar via Task se ausente/stale
AUDIT_FILE=".planning/RELEASE-AUDIT.md"
SCORE=""

if [ -f "$AUDIT_FILE" ]; then
  # check se fresh (≤ 30 dias)
  if [ "$(uname)" = "Darwin" ]; then
    AUDIT_DATE=$(stat -f %m "$AUDIT_FILE")
  else
    AUDIT_DATE=$(stat -c %Y "$AUDIT_FILE")
  fi
  AGE_DAYS=$(( ($(date +%s) - AUDIT_DATE) / 86400 ))

  if [ "$AGE_DAYS" -gt 30 ]; then
    echo "⚠ RELEASE-AUDIT.md stale (${AGE_DAYS}d). Re-rodar /auditar-release antes de close."
    [ "$GATE_BLOCKING" = true ] && exit 1
  fi

  # parse score
  SCORE=$(grep -oE "Score:\*\*\s*[0-9]+/30" "$AUDIT_FILE" | grep -oE "[0-9]+" | head -1)
fi

if [ -z "$SCORE" ]; then
  echo "⚠ RELEASE-AUDIT.md ausente OR sem score parseável."
  echo "Rode: /auditar-release  (gera relatório fresh)"
  [ "$GATE_BLOCKING" = true ] && exit 1
  exit 0
fi

echo ""
echo "release-pipeline-policy gate — threshold: ${THRESHOLD}/30"
echo "  RELEASE-AUDIT.md score: ${SCORE}/30"
echo ""

# decisão
if [ "$SCORE" -ge "$THRESHOLD" ]; then
  if [ "$SCORE" -ge 25 ]; then
    echo "✓ ROBUST (≥ 25/30) — milestone arquivável."
  else
    echo "✓ ADEQUATE (20-24) — milestone arquivável com warnings."
  fi
  exit 0
fi

if [ "$SCORE" -lt 15 ]; then
  echo "✗ BROKEN (< 15/30) — pipeline não pode ser fonte de verdade. ESCALAR."
elif [ "$SCORE" -lt 20 ]; then
  echo "✗ FRAGILE (15-19/30) — gaps significativos."
fi

echo ""
echo "Próximas ações:"
echo "  1. Aplicar top 5 fixes do RELEASE-AUDIT.md"
echo "  2. Re-rodar /auditar-release"
echo "  3. Re-tentar /concluir-marco após score >= ${THRESHOLD}"
echo ""

[ "$GATE_BLOCKING" = true ] && exit 1
exit 0
```

## Configuração

```json
{
  "workflow": {
    "complete_milestone_release_pipeline_gate": false,
    "release_pipeline_threshold": 20
  }
}
```

**Default:** `complete_milestone_release_pipeline_gate=false` (opt-in). Threshold 20 = ADEQUATE; promove para 25 (ROBUST) em projetos tier-1.

## Quando NÃO rodar

- Projeto < 6 meses (pipeline ainda imatura)
- Releases manuais (sem CI/CD complexo)
- Solo dev side project
- Projeto puramente experimental

## Ver também

- [`release-pipeline-auditor`](../kit/agents/release-pipeline-auditor.md) — agent canônico
- [`/auditar-release`](../kit/commands/auditar-release.md) — comando dedicado
- [`hermetic-builds`](../kit/skills/hermetic-builds/SKILL.md)
- [`release-engineering`](../kit/skills/release-engineering/SKILL.md)
- [`prr-checklist-coverage`](./prr-checklist-coverage.md) — gate análogo PRR (v1.10)
- [`legacy-refactor-safety`](./legacy-refactor-safety.md) — gate análogo Legacy (v1.12)

*Material-fonte: cap 8 livro Google SRE.*
