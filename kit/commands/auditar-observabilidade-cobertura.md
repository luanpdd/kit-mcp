---
name: auditar-observabilidade-cobertura
description: Audita projeto Supabase mostrando X/N Edge Functions com 4 golden signals + Y/N com SLO + Z/N com burn alert + W/N com characterization tests. Top 5 críticas (por traffic 30d) sem cobertura. User-request explícito.
argument-hint: "[--traffic-window 30d] [--top-n 5] [--dimensions signals,slo,burn-alert,characterization] [--output PATH]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Write
  - mcp__supabase__list_edge_functions
  - mcp__supabase__get_logs
  - mcp__supabase__execute_sql
---

<objective>
**O comando que você roda hoje pra ver o tamanho do buraco e priorizar.** Audit horizontal de cobertura cross-suite (Observabilidade v1.9 + SRE v1.10 + Legacy v1.12). Roda contra projeto Supabase, gera relatório:

- Edge functions emitindo 4 golden signals: **X / N**
- Edge functions com SLO definido: **Y / N**
- Edge functions com burn rate alert: **Z / N**
- Edge functions com characterization tests: **W / N**
- **Top 5 funções mais críticas (por chamadas 30d) sem cobertura completa**

Invoca o agente [`observability-coverage-auditor`](../agents/observability-coverage-auditor.md) que cross-references skills v1.9 + v1.10 + v1.12.

**Cria/Atualiza:**
- `.planning/OBSERVABILITY-COVERAGE.md` — relatório scored com tabela X/N por dimensão + top críticas + recomendações priorizadas

**Após:** o user vê tamanho do buraco quantitativamente e tem fila ordenada por (traffic × missing dimensions). As 2 que ele instrumentou às pressas viram baseline; as outras N entram na fila ordenada.
</objective>

<context>
**Argumentos:**
- `--traffic-window 30d` — janela para criticidade (default: 30d)
- `--top-n 5` — quantas críticas listar (default: 5)
- `--dimensions <list>` — quais dimensões auditar (default: `signals,slo,burn-alert,characterization`)
- `--output PATH` — caminho do output (default: `.planning/OBSERVABILITY-COVERAGE.md`)

**Exemplos:**
```
/auditar-observabilidade-cobertura                                    # defaults
/auditar-observabilidade-cobertura --top-n 10                         # listar top 10
/auditar-observabilidade-cobertura --dimensions signals,slo           # só 2 dimensões
/auditar-observabilidade-cobertura --traffic-window 7d                # janela menor
```

**Pré-requisitos:**
- Projeto Supabase (`supabase/config.toml` presente)
- MCP Supabase conectado para traffic data + Edge Functions list (recomendado)
- Sem MCP: agent reverte para enumerate via filesystem (sem traffic data → top-N por filesystem only)

**Quando este comando é o caminho:**
- Você quer "ver o buraco" antes de priorizar instrumentação
- Você instrumentou algumas Edge Functions ad-hoc; agora quer audit estruturado das outras
- Audit trimestral cross-suite
- Pré-requisito de `/concluir-marco` quando `workflow.observability_coverage_threshold` opt-in
- `/auditar-marco` chain (audit milestone consume este)
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

mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Validar pré-requisitos

```bash
PROJECT_ID=""
if [ -f "supabase/config.toml" ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi

# Detectar tier (Full vs Partial)
TIER="full"
if [ -z "$PROJECT_ID" ]; then
  TIER="partial"
  echo "ℹ project_id não detectado em supabase/config.toml — degradando para tier partial (sem traffic data)"
fi

# Detectar Edge Functions via filesystem
NUM_EDGE_FNS=$(find supabase/functions -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
if [ "$NUM_EDGE_FNS" -eq 0 ]; then
  echo "ERROR: nenhuma Edge Function detectada em supabase/functions/. Audit cancelado."
  exit 1
fi
```

## 3. Dispatch para `observability-coverage-auditor`

```text
Task(
  subagent_type="observability-coverage-auditor",
  prompt="
project_root: .
output_path: ${OUTPUT_PATH}
traffic_window: ${TRAFFIC_WINDOW}
top_n_critical: ${TOP_N}
dimensions: ${DIMENSIONS}
${PROJECT_ID:+project_id: ${PROJECT_ID}}
tier: ${TIER}

Aplicar skills (cross-suite v1.9+v1.10+v1.12). Etapas:
1. Enumerar Edge Functions (via mcp__supabase__list_edge_functions ou filesystem fallback)
2. Para cada Edge Function, auditar:
   - 4 Golden Signals (grep por createHistogram/createCounter/createObservableGauge)
   - SLO definido (.planning/slos/<name>.md ou .planning/SLO.md menção)
   - Burn rate alert (config presente)
   - Characterization tests (tests/characterization/<name>/ presente)
3. Coletar traffic 30d via mcp__supabase__get_logs (Tier Full) ou skip (Tier Partial)
4. Calcular criticality_score = traffic × missing_count
5. Compilar matriz + top ${TOP_N} críticas + recomendações priorizadas
6. Output: .planning/OBSERVABILITY-COVERAGE.md
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR-OBSERVABILIDADE-COBERTURA ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do observability-coverage-auditor]

## Próximos passos priorizados

1. **Atacar top 1 crítica primeiro** — comando direto:
   - Se signals missing: `/golden-signals <function-path>`
   - Se SLO missing: `/definir-slo <function-name>`
   - Se char missing: `/caracterizar <function-path>`
   - Se burn alert missing: configurar via `/burn-rate-status` + alert manager

2. **Continuar pela ordem de criticality** (top 2, 3, ...)

3. **Bulk approach** se há > 10 funções missing:
   - Priorize SIGNALS primeiro (visibility é fundação)
   - Depois SLO (define o que importa)
   - Depois BURN ALERT (early warning)
   - Depois CHARACTERIZATION (refactor safety)

4. **Auto-completion** via:
   - `/observabilidade audit-coverage` — sinônimo deste comando
   - `/observabilidade omm` — OMM scoring v1.9 que consume este audit
   - `/auditar-marco` — milestone audit que opt-in invoca este

## Cross-suite

Este audit é o **HUB** que conecta as 3 suítes:
- v1.9 Observabilidade (golden signals + SLO + burn alert)
- v1.10 SRE (PRR Axe 2 Instrumentation + Axe 4 Capacity)
- v1.12 Legacy (characterization safety net)

Re-rodar trimestralmente OR após cada milestone com novas Edge Functions.
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (todos opcionais, defaults razoáveis)
- [ ] Project_id resolvido OU degradado para tier partial sem warning
- [ ] Edge Functions enumeradas (≥ 1 detectada)
- [ ] `observability-coverage-auditor` invocado via Task
- [ ] Output forwarded transparentemente
- [ ] Próximos passos PRIORIZADOS com comandos prontos para copy-paste
- [ ] Cross-references com /observabilidade, /auditar-marco, /golden-signals, /caracterizar
- [ ] Atende explicitamente ao user-request "comando que você roda hoje pra ver o tamanho do buraco"
</success_criteria>
