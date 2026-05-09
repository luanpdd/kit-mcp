---
name: burn-rate-status
description: Tabela de burn rate por SLO consumindo .planning/slos/*.yml + .planning/metrics/snapshots/. Calcula SLI atual, burn rate (% budget gasto/h), ETA exhaustão e ação (PAGE/TICKET/WARN/OK). Aplica skill burn-rate-alerting.
argument-hint: "[<slo_name>] [--lookahead 4h] [--baseline 1h] [--format table|json]"
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Snapshot de burn rate para 1 SLO (se especificado) ou TODOS os SLOs definidos em `.planning/slos/*.yml`. Aplica skill [`burn-rate-alerting`](../skills/burn-rate-alerting/SKILL.md) — fórmula `burn_rate = error_rate / (1 - target)`, lookahead ≤ 4× baseline.

**Lê:** `.planning/slos/*.yml` (definição) + `.planning/metrics/snapshots/*.json` (eventos persistidos via `metrics.persistSnapshot()` — Phase 99).

**Cria/Atualiza:** nada — comando read-only.

**Após:** o user vê tabela com status (PAGE / TICKET / WARN / OK) e pode escolher invocar `/investigar-producao` se há burn ativo, ou rodar mais carga e re-snapshotar via `metrics-snapshot` MCP tool se a janela está vazia.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — opcional `<slo_name>` para 1 SLO; sem args = todos.

**Flags:**
- `--lookahead <duration>` — janela predictive (default: `4h` para short-term page-tier)
- `--baseline <duration>` — janela base (default: `1h`)
- `--format <table|json>` — output format (default: `table`)

**Combinações canônicas:**
- short-term (page-tier): lookahead 4h, baseline 1h
- long-term (ticket-tier): lookahead 3d, baseline 18h

**Phase 99 wiring:** este comando consome dados persistidos pela API
`persistSnapshot()` adicionada em `src/core/metrics.js` (Phase 99). Sem
snapshots na janela, o comando emite "no_data" para o SLO em vez de
inventar números. Para gerar dados, invoque o MCP tool `metrics-snapshot`
durante uso normal — futura fase pode auto-persistir.
</context>

<process>

## 1. Parsear argumentos

Bash:
```bash
SLO_NAME=$(echo "$ARGUMENTS" | awk '{for(i=1;i<=NF;i++) if($i !~ /^--/) {print $i; exit}}')
LOOKAHEAD=$(echo "$ARGUMENTS" | grep -oE -- '--lookahead [^ ]+' | awk '{print $2}')
BASELINE=$(echo "$ARGUMENTS" | grep -oE -- '--baseline [^ ]+' | awk '{print $2}')
FORMAT=$(echo "$ARGUMENTS" | grep -oE -- '--format [^ ]+' | awk '{print $2}')

[ -z "$LOOKAHEAD" ] && LOOKAHEAD="4h"
[ -z "$BASELINE" ] && BASELINE="1h"
[ -z "$FORMAT" ] && FORMAT="table"
```

Convert duration to ms (helper):
```bash
to_ms() {
  local d="$1"
  case "$d" in
    *h) echo $(( ${d%h} * 3600000 ));;
    *m) echo $(( ${d%m} * 60000 ));;
    *s) echo $(( ${d%s} * 1000 ));;
    *d) echo $(( ${d%d} * 86400000 ));;
    *) echo 0 ;;
  esac
}
LOOKAHEAD_MS=$(to_ms "$LOOKAHEAD")
BASELINE_MS=$(to_ms "$BASELINE")
```

## 2. Listar SLOs (FIX Phase 99: extension `.yml`, não `.md`)

```bash
if [ -n "$SLO_NAME" ]; then
  SLO_FILES=(".planning/slos/${SLO_NAME}.yml")
else
  SLO_FILES=(.planning/slos/*.yml)
fi

# Filtra entradas inexistentes (caso o glob não tenha match).
EXISTING_SLOS=()
for f in "${SLO_FILES[@]}"; do
  [ -f "$f" ] && EXISTING_SLOS+=("$f")
done

if [ ${#EXISTING_SLOS[@]} -eq 0 ]; then
  echo "Nenhum SLO definido em .planning/slos/. Rode /definir-slo <feature> primeiro."
  exit 0
fi
```

## 3. Para cada SLO, carregar metadata + calcular SLI

Para cada `SLO_FILE` em `EXISTING_SLOS`:

### 3.1 Extrair campos canônicos do YAML via regex

Os SLOs do projeto seguem schema fixo (validado por `test/unit/slo-schema.test.js`). Sem `js-yaml` — regex sobre os keys conhecidos:

```bash
SLO_NAME=$(grep -oE '^\s+name:\s*\S+' "$SLO_FILE" | head -1 | awk '{print $2}')
SERVICE=$(grep -oE '^\s+service:\s*\S+' "$SLO_FILE" | head -1 | awk '{print $2}')
SLO_TYPE=$(grep -oE '^\s+type:\s*\S+' "$SLO_FILE" | head -1 | awk '{print $2}')

# Availability SLO: target = ratio decimal (e.g. 0.995)
TARGET_RATIO=$(grep -oE '^target:\s*[0-9.]+' "$SLO_FILE" | awk '{print $2}')
# Latency SLO: target_ms + percentile
TARGET_MS=$(grep -oE '^target_ms:\s*[0-9]+' "$SLO_FILE" | awk '{print $2}')
PERCENTILE=$(grep -oE '^\s+percentile:\s*[0-9]+' "$SLO_FILE" | awk '{print $2}')
```

### 3.2 Carregar snapshots da janela baseline

Use a API `loadSnapshots()` adicionada em Phase 99. Inline node script:

```bash
SNAPS_JSON=$(node --input-type=module -e "
import { loadSnapshots } from './src/core/metrics.js';
const snaps = await loadSnapshots(process.cwd(), $BASELINE_MS);
console.log(JSON.stringify(snaps));
")
SNAPSHOT_COUNT=$(echo "$SNAPS_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).length)")
```

Se `SNAPSHOT_COUNT < 2`, marcar SLO como `no_data`:
```bash
if [ "$SNAPSHOT_COUNT" -lt 2 ]; then
  echo "SLO $SLO_NAME: insufficient snapshots in baseline window ($BASELINE) — got $SNAPSHOT_COUNT, need ≥2"
  echo "Generate data: invoke 'metrics-snapshot' MCP tool during normal use."
  STATUS="no_data"
  continue  # pula para o próximo SLO
fi
```

### 3.3 Calcular SLI por tipo de SLO

**Availability (`type: event-based`):**

Inline node — primeiro vs último snapshot dentro da janela. Delta de counters dá good/bad events na janela:

```bash
SLI_RESULT=$(node --input-type=module -e "
import { loadSnapshots } from './src/core/metrics.js';
const snaps = await loadSnapshots(process.cwd(), $BASELINE_MS);
if (snaps.length < 2) { console.log(JSON.stringify({sli:null, error:'no_data'})); process.exit(0); }
const first = snaps[0];
const last = snaps[snaps.length - 1];
let goodFirst = 0, goodLast = 0, totalFirst = 0, totalLast = 0;
for (const [k,v] of Object.entries(first.counters)) {
  if (k.endsWith(':ok')) goodFirst += v;
  totalFirst += v;
}
for (const [k,v] of Object.entries(last.counters)) {
  if (k.endsWith(':ok')) goodLast += v;
  totalLast += v;
}
const good = goodLast - goodFirst;
const total = totalLast - totalFirst;
const sli = total > 0 ? good / total : null;
const errorRate = total > 0 ? (total - good) / total : 0;
console.log(JSON.stringify({sli, errorRate, good, total, totalFirst, totalLast}));
")
```

**Latency (`type: percentile`):**

Para latency, usar o p95 do último snapshot na janela (cumulative — FIFO histogram dá p95 sobre as últimas 1000 amostras). SLI = fração de samples acima de target_ms é o budget consumido.

```bash
SLI_RESULT=$(node --input-type=module -e "
import { loadSnapshots } from './src/core/metrics.js';
const snaps = await loadSnapshots(process.cwd(), $BASELINE_MS);
if (snaps.length < 1) { console.log(JSON.stringify({sli:null, error:'no_data'})); process.exit(0); }
const last = snaps[snaps.length - 1];
const target = $TARGET_MS;
let totalSamples = 0, slowSamples = 0;
for (const [tool, lat] of Object.entries(last.latency)) {
  totalSamples += lat.count;
  if (lat.p95 > target) slowSamples += Math.round(lat.count * 0.05); // approximation: p95 above target → ~5% slow
}
const sli = totalSamples > 0 ? 1 - (slowSamples / totalSamples) : null;
const errorRate = totalSamples > 0 ? slowSamples / totalSamples : 0;
console.log(JSON.stringify({sli, errorRate, totalSamples, slowSamples, p95Max: Math.max(0, ...Object.values(last.latency).map(l => l.p95 || 0))}));
")
```

### 3.4 Calcular burn rate + status

Aplicar fórmula canônica da skill `burn-rate-alerting`:

```bash
BURN_STATUS=$(node --input-type=module -e "
const result = $SLI_RESULT;
if (result.error) { console.log(JSON.stringify({status:'no_data'})); process.exit(0); }
const target = $TARGET_RATIO || (1 - 0.05); // latency: 1 - ratio_above_target (5%)
const errorRate = result.errorRate;
const slack = 1 - target;  // budget = (1 - target)
const burnRate = slack > 0 ? errorRate / slack : 0;

let status, action;
if (burnRate >= 14.4) {
  status = 'PAGE';
  action = 'Page on-call — invoke /investigar-producao';
} else if (burnRate >= 6.0) {
  status = 'TICKET';
  action = 'Open ticket — investigate before budget exhausted';
} else if (burnRate >= 1.0) {
  status = 'WARN';
  action = 'Monitor — burn rate sustained ≥1× exhausts budget in window';
} else {
  status = 'OK';
  action = '—';
}

// ETA exhaustion (predictive). For burn_rate=0 (no errors), ETA is ∞.
const baselineHours = $BASELINE_MS / 3600000;
const eta = burnRate > 0 ? (1 / burnRate) * 30 * 24 / baselineHours : null; // hours until exhausted
const etaStr = eta === null ? '—' : (eta < 24 ? eta.toFixed(1) + 'h' : (eta/24).toFixed(1) + 'd');

console.log(JSON.stringify({status, action, burnRate: burnRate.toFixed(2), errorRate: (errorRate*100).toFixed(2), eta: etaStr}));
")
```

### 3.5 Acumular linha da tabela

```bash
SLO_ROWS+=("| $SLO_NAME | ${TARGET_RATIO:-${TARGET_MS}ms p$PERCENTILE} | $BASELINE | ${ERROR_RATE}% | ${BURN_RATE}× | $ETA | **$STATUS** | $ACTION |")
```

## 4. Renderizar tabela mestra

```text
═══════════════════════════════════════════════════════════
 framework ► BURN-RATE-STATUS ▸ {timestamp}
 baseline=$BASELINE  lookahead=$LOOKAHEAD  snapshots=$TOTAL_SNAPS
═══════════════════════════════════════════════════════════

| SLO | Target | Window | Error rate | Burn rate | ETA exhaustão | Status | Ação |
|---|---|---|---|---|---|---|---|
{$SLO_ROWS}
```

## 5. Sugerir próximas ações

```bash
# Contar status counts
PAGE_COUNT=$(echo "$SLO_ROWS" | grep -c "PAGE" || echo 0)
TICKET_COUNT=$(echo "$SLO_ROWS" | grep -c "TICKET" || echo 0)
WARN_COUNT=$(echo "$SLO_ROWS" | grep -c "WARN" || echo 0)
NO_DATA_COUNT=$(echo "$SLO_ROWS" | grep -c "no_data" || echo 0)
```

Output:
```text
## Próximas ações

{Se PAGE_COUNT > 0:}
⚠ {PAGE_COUNT} SLO(s) em PAGE — invocar /investigar-producao "<slo_name> burn rate {burn_rate}×"

{Se TICKET_COUNT > 0:}
☐ {TICKET_COUNT} SLO(s) em TICKET — abrir issue, investigar antes do budget esgotar

{Se WARN_COUNT > 0:}
ⓘ {WARN_COUNT} SLO(s) em WARN — burn rate sustained ≥1× exhausts budget

{Se NO_DATA_COUNT > 0:}
⊘ {NO_DATA_COUNT} SLO(s) sem dados na janela — invoque o MCP tool 'metrics-snapshot' periodicamente para popular .planning/metrics/snapshots/
```

## 6. Modo `/loop` (idempotência)

Se chamado dentro de `/loop`, comportamento idempotente:
- Snapshot fresh em cada invocação (não acumular state).
- Output curto se status não mudou (apenas linha-resumo; sem repetir tabela completa).
- Acionar AskUserQuestion APENAS quando algum SLO transiciona OK → WARN/TICKET/PAGE.

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (SLO opcional + flags --lookahead/--baseline/--format)
- [ ] SLOs descobertos via glob `.planning/slos/*.yml` (FIX Phase 99: extension `.yml`, não `.md`)
- [ ] Snapshots carregados via `loadSnapshots()` (Phase 99 — `src/core/metrics.js`)
- [ ] SLI calculado por tipo (event-based ratio para availability, percentile para latency)
- [ ] Burn rate calculado pela fórmula `error_rate / (1 - target)` (skill burn-rate-alerting)
- [ ] Status enum: PAGE / TICKET / WARN / OK / no_data
- [ ] ETA exhaustão computada (predictive forecast)
- [ ] Tabela markdown agregada
- [ ] Sugestões de próximas ações para SLOs em alerta
- [ ] Idempotente em /loop (sem acúmulo de state)
- [ ] no_data graceful — não inventa números, sugere `metrics-snapshot`
</success_criteria>
