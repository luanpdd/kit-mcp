---
name: auditar-observabilidade-cobertura-workflow
description: Variante Dynamic Workflows do audit de cobertura — 1 agent por Edge Function em paralelo + verify adversarial por gap. PoC para comparar contra /auditar-observabilidade-cobertura.
argument-hint: "[--traffic-window 30d] [--top-n 5] [--dimensions signals,slo,burn-alert,characterization] [--output PATH]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - Workflow
  - mcp__supabase__list_edge_functions
  - mcp__supabase__get_logs
  - mcp__supabase__execute_sql
---

# auditar-observabilidade-cobertura-workflow

> **PoC — Dynamic Workflows (Opus 4.8+).** Mesma intenção do [`/auditar-observabilidade-cobertura`](./auditar-observabilidade-cobertura.md) mas executa em paralelo via `Workflow()`: 1 agent por Edge Function auditando as 4 dimensões + verify adversarial só nos gaps reportados + synthesizer final.

> Use este comando para **comparar** wall-clock e qualidade do report contra a versão serial.

<objective>
Roda o script `auditar-observabilidade-cobertura.workflow.js` registrado em `.claude/workflows/`, que faz fan-out por função e remove a barreira do agent monolítico.

**Por que existe (PoC):**
- A versão serial encadeia N funções × 4 dimensões em UM agent — context grows linearly, foco se perde a partir de ~30 funções.
- Esta versão tem 1 contexto por função (audit pequeno, foco preservado) + verify só onde houve gap (cost-controlled).
- Cross-suite (v1.9 + v1.10 + v1.12) intacto — só a topologia muda.

**Output:** mesmo `.planning/OBSERVABILITY-COVERAGE.md` da versão serial (mesma estrutura), permitindo `diff` direto.
</objective>

<context>
**Argumentos (idênticos ao command original):**
- `--traffic-window 30d` (default `30d`)
- `--top-n 5` (default `5`)
- `--dimensions signals,slo,burn-alert,characterization` (default todos)
- `--output PATH` (default `.planning/OBSERVABILITY-COVERAGE.md` — use `.planning/OBSERVABILITY-COVERAGE-WORKFLOW.md` para A/B)

**Pré-requisitos:**
- Claude Code Max / Team / Enterprise (Dynamic Workflows em research preview)
- `Workflow` tool habilitada na sessão
- Resto idêntico ao command original (projeto Supabase + MCP recomendado)

**Quando usar PoC ao invés do original:**
- Você tem ≥ 10 Edge Functions e quer medir ganho real
- Você está validando se Dynamic Workflows cabe no kit-mcp antes de migrar outros orquestradores
- Auditoria pesada que hoje toma > 10min na versão serial
</context>

<process>

## 1. Parsear argumentos

```bash
TRAFFIC_WINDOW=$(echo "$ARGUMENTS" | grep -oE -- '--traffic-window [^ ]+' | awk '{print $2}')
TOP_N=$(echo "$ARGUMENTS" | grep -oE -- '--top-n [0-9]+' | awk '{print $2}')
DIMENSIONS=$(echo "$ARGUMENTS" | grep -oE -- '--dimensions [^ ]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

[ -z "$TRAFFIC_WINDOW" ] && TRAFFIC_WINDOW="30d"
[ -z "$TOP_N" ]          && TOP_N=5
[ -z "$DIMENSIONS" ]     && DIMENSIONS="signals,slo,burn-alert,characterization"
[ -z "$OUTPUT_PATH" ]    && OUTPUT_PATH=".planning/OBSERVABILITY-COVERAGE.md"
```

## 2. Disparar o Workflow

```text
Workflow(
  name: "auditar-observabilidade-cobertura",
  args: {
    projectRoot: ".",
    trafficWindow: "${TRAFFIC_WINDOW}",
    topN: ${TOP_N},
    dimensions: ["${DIMENSIONS//,/\",\"}"],
    outputPath: "${OUTPUT_PATH}"
  }
)
```

Acompanhe o progresso ao vivo em `/workflows` (CLI/Desktop/VS Code). Cada Edge Function aparece como um chip no phase `Audit`; gaps reais entram em `Verify`.

## 3. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR-OBSERVABILIDADE-COBERTURA-WORKFLOW
═══════════════════════════════════════════════════════════

Status:          <GREEN|YELLOW|RED>
Total functions: <N>
Tier:            <full|partial>
Output:          ${OUTPUT_PATH}

Cobertura por dimensão:
  4 Signals:  <X>/<N>
  SLO:        <Y>/<N>
  Burn alert: <Z>/<N>
  Char tests: <W>/<N>

Top ${TOP_N} críticas: [resumo do workflow]

──────────────────────────────────────────────────────────
A/B vs versão serial:
  - Para comparar, rode também /auditar-observabilidade-cobertura --output .planning/OBSERVABILITY-COVERAGE-SERIAL.md
  - Diff: diff .planning/OBSERVABILITY-COVERAGE.md .planning/OBSERVABILITY-COVERAGE-SERIAL.md
  - Wall-clock: /workflows mostra duração total; cronometre a serial manualmente
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (defaults idênticos ao command original)
- [ ] `Workflow(name: "auditar-observabilidade-cobertura", args: ...)` invocado
- [ ] Output em `${OUTPUT_PATH}` com mesma estrutura do command original
- [ ] Tabela X/N + top-N críticas + recomendações priorizadas
- [ ] Verify adversarial reportado (quantos gaps confirmados vs refutados)
- [ ] Instruções de A/B contra versão serial inclusas no pós-output
</success_criteria>
