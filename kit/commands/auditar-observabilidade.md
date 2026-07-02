---
name: auditar-observabilidade
description: Invoca omm-auditor para gerar OMM-REPORT.md scored. 5 capacidades com trend vs marco anterior. Action items priorizados P0-P3.
argument-hint: "[--previous <marco>] [--ci]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---

<objective>
Gerar OMM-REPORT.md com snapshot scored das 5 capacidades de observabilidade. Aplica skill [`observability-maturity-model`](../skills/observability-maturity-model/SKILL.md) — sintomas qualitativos doing well/poorly por capacidade.

**Cria/Atualiza:**
- `.planning/OMM-REPORT.md` — snapshot atual
- (Em `/concluir-marco`) `.planning/milestones/<v>/OMM-REPORT.md` — snapshot arquivado

**Após:** time tem 5 scores + trend + action items priorizados.
</objective>

<context>
**Argumentos:** `$ARGUMENTS`

**Flags:**
- `--previous <marco>` — comparar com marco específico (default: detecta automaticamente do MILESTONES.md)
- `--ci` — modo CI: exit code 0 se OK, 1 se regression em qualquer capacidade

**Quando rodar:**
- Manualmente para snapshot informal
- Em `/auditar-marco` (audit pre-conclusion) — Phase 35 INT-FW-04
- Em `/concluir-marco` (gate de regression) — Phase 35 INT-FW-05
</context>

<process>

## 1. Parsear argumentos

```bash
PREVIOUS=$(echo "$ARGUMENTS" | grep -oE -- '--previous [^ ]+' | awk '{print $2}')
CI_MODE=$(echo "$ARGUMENTS" | grep -c -- '--ci' || true)
```

## 2. Detectar previous milestone

```bash
if [ -z "$PREVIOUS" ]; then
  # PT-BR: extrair último concluído de MILESTONES.md
  PREVIOUS=$(grep -E '^### v[0-9.]+\b' .planning/MILESTONES.md | head -2 | tail -1 | grep -oE 'v[0-9.]+')
fi
```

## 3. Dispatch para `omm-auditor`

```text
Task(
  subagent_type="omm-auditor",
  prompt="
${PREVIOUS:+previous_milestone: ${PREVIOUS}}
mode: ${CI_MODE:+ci}snapshot

Gerar OMM-REPORT.md com:
1. Score 1-5 por capacidade (5 capacidades)
2. Trend vs ${PREVIOUS:-último marco}
3. Action items priorizados P0-P3
4. Regression alerts (se alguma capacidade regrediu)
5. Comparação por marco
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR-OBSERVABILIDADE
═══════════════════════════════════════════════════════════

[output do omm-auditor — snapshot inline]

OMM-REPORT.md: .planning/OMM-REPORT.md

${CI_MODE:+## CI Mode}
${CI_MODE:+Exit code: 0 (OK) / 1 (regression detectada)}
```

## 5. Modo `--ci`

Se `--ci` setado:
- Parse OMM-REPORT.md para detectar regression alerts
- Se ≥ 1 regression → exit 1 (CI fails)
- Senão → exit 0 (OK)

</process>

<success_criteria>
- [ ] omm-auditor invocado via Task
- [ ] OMM-REPORT.md gerado em `.planning/OMM-REPORT.md`
- [ ] 5 capacidades scored
- [ ] Trend calculado vs `--previous` ou auto-detectado
- [ ] Action items P0-P3 listados
- [ ] Modo `--ci` exit code apropriado se regression
</success_criteria>
