---
id: prr-checklist-coverage
stage: pre-verify
blocking: true
description: Valida que cada PRR-REPORT.md em .planning/prr/ cobre os 6 axes canonicos (System Architecture/Instrumentation/Emergency/Capacity/Change/Performance — cap 32 livro Google SRE).
---

# PRR checklist coverage gate

**When to run:** pre-verify (blocking — PRR sem 6 axes = aprovação inválida).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar que cada PRR-REPORT.md em .planning/prr/**/*.md cobre os 6 axes do PRR.
# Match por palavra-chave em heading H2 (case-insensitive). Pular um axe = aprovação inválida.
# Bash 3.2-portable (macOS default).
set -e

PRR_DIR=".planning/prr"

# PT-BR: se não há PRR reports, gate passa com INFO
if [ ! -d "$PRR_DIR" ]; then
  echo "INFO: $PRR_DIR não existe — projeto sem PRR reports. Gate skipped."
  exit 0
fi

# PT-BR: listar todos os *.md em .planning/prr/ recursivamente
PRR_FILES=$(find "$PRR_DIR" -type f -name "*.md" 2>/dev/null || true)
PRR_FILES=$(echo "$PRR_FILES" | grep -v "^$" || true)

if [ -z "$PRR_FILES" ]; then
  echo "INFO: $PRR_DIR vazio — sem PRR reports. Gate skipped."
  exit 0
fi

# PT-BR: para cada PRR report, validar que cobre os 6 axes
VIOLATIONS=0
OLDIFS="$IFS"
IFS='
'
for prr_file in $PRR_FILES; do
  [ -z "$prr_file" ] && continue
  [ ! -f "$prr_file" ] && continue

  # PT-BR: extrair headings H2 (case-insensitive)
  H2=$(grep -E "^## " "$prr_file" 2>/dev/null || true)

  # PT-BR: 6 axes — match em palavras-chave (qualquer variante aceitável)
  AXE_MISSING=""

  # Axe 1: System Architecture
  if ! echo "$H2" | grep -qiE "system.*architecture|architecture"; then
    AXE_MISSING="$AXE_MISSING Axe1(SystemArchitecture)"
  fi

  # Axe 2: Instrumentation / Metrics / Monitoring
  if ! echo "$H2" | grep -qiE "instrumentation|metrics|monitoring"; then
    AXE_MISSING="$AXE_MISSING Axe2(Instrumentation)"
  fi

  # Axe 3: Emergency Response
  if ! echo "$H2" | grep -qiE "emergency.*response|emergency"; then
    AXE_MISSING="$AXE_MISSING Axe3(EmergencyResponse)"
  fi

  # Axe 4: Capacity Planning
  if ! echo "$H2" | grep -qiE "capacity.*planning|capacity"; then
    AXE_MISSING="$AXE_MISSING Axe4(CapacityPlanning)"
  fi

  # Axe 5: Change Management
  if ! echo "$H2" | grep -qiE "change.*management|change"; then
    AXE_MISSING="$AXE_MISSING Axe5(ChangeManagement)"
  fi

  # Axe 6: Performance
  if ! echo "$H2" | grep -qiE "performance"; then
    AXE_MISSING="$AXE_MISSING Axe6(Performance)"
  fi

  if [ -n "$AXE_MISSING" ]; then
    echo "FAIL: $prr_file — axes ausentes:$AXE_MISSING"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done
IFS="$OLDIFS"

if [ "$VIOLATIONS" -eq 0 ]; then
  total=$(echo "$PRR_FILES" | wc -l | tr -d ' ')
  echo "PASS: $total PRR-REPORT(s) cobrem os 6 axes canônicos"
  exit 0
else
  echo "FAIL: $VIOLATIONS PRR-REPORT(s) com axes ausentes"
  echo "Sugestão: rodar /sre prr <service> ou /prr para regenerar com template canônico (6 axes obrigatórios)."
  echo "Cross-ref: kit/skills/production-readiness-review/SKILL.md + kit/agents/prr-conductor.md"
  echo "Princípio canônico: 'Pular um axe = aprovação inválida' (cap 32 livro Google SRE)."
  exit 1
fi
```

## Verdict

- **passed** — cada PRR-REPORT.md em `.planning/prr/**/*.md` tem H2 cobrindo os 6 axes (System Architecture / Instrumentation / Emergency Response / Capacity Planning / Change Management / Performance) OR diretório `.planning/prr/` ausente
- **block** — pelo menos 1 PRR-REPORT.md com axe(s) ausente(s)

## Why

O livro Google SRE (cap 32 — *Evolving SRE Engagement Model*) define **6 axes canônicos** do Production Readiness Review. A skill `production-readiness-review` (Phase 36 / SKFD-SRE-05) declara como regra absoluta: *"Pular um axe = aprovação inválida (lacuna oculta vira incident em 6 meses)"*.

Sem este gate, PRRs apressados podem omitir axes "menos relevantes" (anti-pattern documentado na skill); gaps em Change Management ou Capacity Planning não detectados em PRR viram incidents em produção meses depois. Gate força padrão canônico — cada `PRR-REPORT.md` cobrindo os 6 axes integralmente, mesmo que items dentro de um axe sejam N/A para o serviço (justificativa explícita no item, não no axe).

Cross-ref agent canônico: [`prr-conductor`](../kit/agents/prr-conductor.md) (Phase 37 / AGCORE-SRE-04). Skill: [`production-readiness-review`](../kit/skills/production-readiness-review/SKILL.md) (Phase 36 / SKFD-SRE-05). Comando: `/prr --service <name>` ou `/prr --feature <description>` (Phase 38 / CMD-SRE-04).

## REQ

QA-SRE-03.

## Configuração

Gate é **blocking** por default. Para tornar warn-only durante adoption inicial:

```bash
node ./.claude/framework/bin/tools.cjs config-set workflow.prr_checklist_coverage_warn true
```

(Nota: implementação do toggle warn-only é deferida — gate atual não consulta config.)
