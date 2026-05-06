---
id: obs-skills-frontmatter
stage: pre-verify
blocking: true
description: Valida que skills observability têm frontmatter completo (name + description ≤ 200 chars) e seções obrigatórias do template.
---

# Observability skills frontmatter gate

**When to run:** pre-verify.

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar que cada skill em kit/skills/{structured-events,distributed-tracing,opentelemetry-standard,core-analysis-loop,observability-driven-development,event-based-slos,burn-rate-alerting,telemetry-sampling,telemetry-pipelines,observability-maturity-model}/SKILL.md
# tem frontmatter completo + seções obrigatórias.
# Portable bash 3.2+ (macOS default).
set -e

VIOLATIONS=0
SKILLS="structured-events distributed-tracing opentelemetry-standard core-analysis-loop observability-driven-development event-based-slos burn-rate-alerting telemetry-sampling telemetry-pipelines observability-maturity-model"

for skill in $SKILLS; do
  file="kit/skills/$skill/SKILL.md"
  if [ ! -f "$file" ]; then
    echo "FAIL: $file — skill ausente"
    VIOLATIONS=$((VIOLATIONS + 1))
    continue
  fi

  # PT-BR: frontmatter name presente
  if ! grep -qE '^name:' "$file"; then
    echo "FAIL: $file — frontmatter 'name:' ausente"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

  # PT-BR: frontmatter description presente
  if ! grep -qE '^description:' "$file"; then
    echo "FAIL: $file — frontmatter 'description:' ausente"
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    desc=$(grep -E '^description:' "$file" | head -1 | sed 's/description: //')
    len=${#desc}
    if [ "$len" -gt 200 ]; then
      echo "FAIL: $file — description=$len chars (limite 200, anti-pitfall A2)"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi

  # PT-BR: 4+ seções H2 (Quando usar, Regras absolutas, Patterns canônicos, Anti-patterns OU Verificação)
  h2_count=$(grep -cE '^## ' "$file")
  if [ "$h2_count" -lt 4 ]; then
    echo "FAIL: $file — só $h2_count seções H2 (mínimo 4 — Quando usar, Regras absolutas, Patterns canônicos, Anti-patterns/Verificação)"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: 10 skills observability com frontmatter completo + 4+ seções H2"
  exit 0
else
  echo "FAIL: $VIOLATIONS violação(ões)"
  exit 1
fi
```

## Why

- Skills sem `description` não aparecem em `listKit` (LLM não acha o trigger)
- `description > 200 chars` infla CLAUDE.md desnecessariamente (anti-pitfall A2)
- Skills sem template fixo geram outputs inconsistentes — gate força padrão.

## REQ

QA-01.
