---
name: burn-rate-status
description: Tabela de burn rate dual-window por SLO consumindo .planning/slos/*.yml + .planning/metrics/snapshots/.
argument-hint: "[<slo_name>] [--fast-baseline 1h] [--slow-baseline 6h] [--format table|json]"
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Snapshot de burn rate **dual-window** (1h fast + 6h slow) para 1 SLO (se especificado) ou TODOS os SLOs definidos em `.planning/slos/*.yml`. Aplica skill [`burn-rate-alerting`](../skills/burn-rate-alerting/SKILL.md) — fórmula canônica `burn_rate = error_rate / (1 - target)`, com lookahead/baseline obedecendo o **fator 4×** (page-tier: lookahead 1h ≤ 4× baseline 5m equivalente operacional; ticket-tier: lookahead 6h ≤ 4× baseline 30m). Status combinado segue o canonical Google SRE: PAGE quando ambas as janelas críticas, TICKET quando apenas slow erosion sustained, WARN para spike-only ou mild burn, OK quando ambas as janelas em estado saudável.

**Lê:** `.planning/slos/*.yml` (definição com `alert_thresholds.page` + `.ticket`) + `.planning/metrics/snapshots/*.json` (eventos persistidos via `metrics.persistSnapshot()` — Phase 99 + Phase 102 auto-snapshot).

**Cria/Atualiza:** nada — comando read-only.

**Após:** o user vê tabela com colunas `fast_burn`, `slow_burn`, `combined` (status PAGE / TICKET / WARN / OK) e pode escolher invocar `/investigar-producao` se há burn ativo, ou aguardar mais snapshots se ambas janelas estão `no_data`.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — opcional `<slo_name>` para 1 SLO; sem args = todos.

**Flags (defaults dual-window — Phase 103):**
- `--fast-baseline <duration>` — janela fast (page-tier). Default: `1h`.
- `--slow-baseline <duration>` — janela slow (ticket-tier). Default: `6h`.
- `--format <table|json>` — output format. Default: `table`.

**Combinações canônicas (skill burn-rate-alerting):**
- **Fast (page-tier):** lookahead 1h, baseline 5m, multiplier 14.4× — esgota ~2% do budget mensal em 1h.
- **Slow (ticket-tier):** lookahead 6h, baseline 30m, multiplier 6× — esgota ~10% do budget mensal em 6h.

**Fator 4×:** lookahead ≤ 4× baseline para extrapolação confiável (skill rule). 1h ≤ 4× 15m e 6h ≤ 4× 90m são ambos respeitados; defaults operacionais são page (1h baseline) + ticket (6h baseline) — a janela `lookahead` propriamente dita está embutida nos `alert_thresholds.{page,ticket}.lookahead` do YAML do SLO.

**Phase 99 + 102 wiring:** este comando consome dados persistidos automaticamente pelo handler MCP `metrics-snapshot` (Phase 102 OBS-20-01 — auto-persist via `persistSnapshot()` em cada call com throttle 1s). Sem snapshots na janela, o comando emite "no_data" para o SLO em vez de inventar números.

**Cross-reference:** este comando é a implementação do pattern "dashboard de burn rate" canônico documentado em [`kit/skills/burn-rate-alerting/SKILL.md`](../skills/burn-rate-alerting/SKILL.md). A skill é a SSOT da fórmula e dos thresholds; este comando é o renderer.
</context>

<process>

## 1. Parsear argumentos

Bash:
```bash
SLO_NAME=$(echo "$ARGUMENTS" | awk '{for(i=1;i<=NF;i++) if($i !~ /^--/) {print $i; exit}}')
FAST_BASELINE=$(echo "$ARGUMENTS" | grep -oE -- '--fast-baseline [^ ]+' | awk '{print $2}')
SLOW_BASELINE=$(echo "$ARGUMENTS" | grep -oE -- '--slow-baseline [^ ]+' | awk '{print $2}')
FORMAT=$(echo "$ARGUMENTS" | grep -oE -- '--format [^ ]+' | awk '{print $2}')

[ -z "$FAST_BASELINE" ] && FAST_BASELINE="1h"
[ -z "$SLOW_BASELINE" ] && SLOW_BASELINE="6h"
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
FAST_BASELINE_MS=$(to_ms "$FAST_BASELINE")
SLOW_BASELINE_MS=$(to_ms "$SLOW_BASELINE")
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

## 3. Para cada SLO, carregar metadata + calcular SLI dual-window

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

### 3.2 Extrair `alert_thresholds.page` (fast) + `.ticket` (slow) do YAML

Phase 103 (OBS-20-02) — leitura dos dois blocos via awk com state machine. Cada bloco tem `lookahead`, `baseline`, `burn_rate_multiplier`. Defaults canônicos aplicados se ausentes (defensive default — ver fallback abaixo).

```bash
# alert_thresholds.page (fast / page-tier)
FAST_LOOKAHEAD=$(awk '/^\s*alert_thresholds:/,/^[a-zA-Z]/{if(/^\s*page:/){p=1;next}else if(p && /^\s+lookahead:/){print $2;exit}else if(p && /^\s*ticket:/){exit}}' "$SLO_FILE")
FAST_BASELINE_YAML=$(awk '/^\s*alert_thresholds:/,/^[a-zA-Z]/{if(/^\s*page:/){p=1;next}else if(p && /^\s+baseline:/){print $2;exit}else if(p && /^\s*ticket:/){exit}}' "$SLO_FILE")
FAST_MULTIPLIER=$(awk '/^\s*alert_thresholds:/,/^[a-zA-Z]/{if(/^\s*page:/){p=1;next}else if(p && /^\s+burn_rate_multiplier:/){print $2;exit}else if(p && /^\s*ticket:/){exit}}' "$SLO_FILE")

# alert_thresholds.ticket (slow / ticket-tier)
SLOW_LOOKAHEAD=$(awk '/^\s*alert_thresholds:/,/^[a-zA-Z]/{if(/^\s*ticket:/){t=1;next}else if(t && /^\s+lookahead:/){print $2;exit}}' "$SLO_FILE")
SLOW_BASELINE_YAML=$(awk '/^\s*alert_thresholds:/,/^[a-zA-Z]/{if(/^\s*ticket:/){t=1;next}else if(t && /^\s+baseline:/){print $2;exit}}' "$SLO_FILE")
SLOW_MULTIPLIER=$(awk '/^\s*alert_thresholds:/,/^[a-zA-Z]/{if(/^\s*ticket:/){t=1;next}else if(t && /^\s+burn_rate_multiplier:/){print $2;exit}}' "$SLO_FILE")

# Defensive defaults — fator 4× canonical Google SRE values.
# Se um SLO YAML antigo / parcial não declarar alert_thresholds, aplicamos
# os defaults da skill burn-rate-alerting verbatim:
#   page: 14.4× / lookahead 1h / baseline 5m
#   ticket: 6× / lookahead 6h / baseline 30m
[ -z "$FAST_MULTIPLIER" ] && FAST_MULTIPLIER="14.4"
[ -z "$SLOW_MULTIPLIER" ] && SLOW_MULTIPLIER="6"
[ -z "$FAST_LOOKAHEAD" ] && FAST_LOOKAHEAD="1h"
[ -z "$SLOW_LOOKAHEAD" ] && SLOW_LOOKAHEAD="6h"
```

### 3.3 Carregar snapshots para AMBAS as janelas

Use a API `loadSnapshots()` (Phase 99) com duas chamadas — uma para fast (1h), uma para slow (6h). Inline node script:

```bash
DUAL_SNAPS=$(node --input-type=module -e "
import { loadSnapshots } from './src/core/metrics.js';
const fast = await loadSnapshots(process.cwd(), $FAST_BASELINE_MS);
const slow = await loadSnapshots(process.cwd(), $SLOW_BASELINE_MS);
console.log(JSON.stringify({fast, slow, fastCount: fast.length, slowCount: slow.length}));
")
FAST_COUNT=$(echo "$DUAL_SNAPS" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).fastCount)")
SLOW_COUNT=$(echo "$DUAL_SNAPS" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).slowCount)")
```

**no_data conservative semantics:** se EITHER janela tem < 2 snapshots (availability) ou < 1 (latency), o `combined_status` final é `no_data` — preferimos não inventar números a falsamente reportar OK. Isso preserva o contrato "graceful no_data" da Phase 99.

```bash
# A regra exata é aplicada dentro do node script de combinação (3.5),
# mas o early-out aqui evita trabalho desnecessário no caso comum.
if [ "$FAST_COUNT" -lt 2 ] && [ "$SLOW_COUNT" -lt 2 ]; then
  echo "SLO $SLO_NAME: insufficient snapshots in BOTH windows (fast=$FAST_COUNT, slow=$SLOW_COUNT)"
  echo "Generate data: invocações ao MCP tool 'metrics-snapshot' agora auto-persistem (Phase 102 OBS-20-01)."
  COMBINED_STATUS="no_data"
  continue
fi
```

### 3.4 Calcular SLI por tipo de SLO (fast E slow independentes)

**Availability (`type: event-based`):**

Inline node — primeiro vs último snapshot **dentro de cada janela**. Delta de counters dá good/bad events:

```bash
DUAL_SLI=$(node --input-type=module -e "
import { loadSnapshots } from './src/core/metrics.js';
const fastSnaps = await loadSnapshots(process.cwd(), $FAST_BASELINE_MS);
const slowSnaps = await loadSnapshots(process.cwd(), $SLOW_BASELINE_MS);

function sliFromSnaps(snaps) {
  if (snaps.length < 2) return {sli: null, errorRate: 0, good: 0, total: 0, error: 'no_data'};
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
  return {sli, errorRate, good, total};
}

const fastSli = sliFromSnaps(fastSnaps);
const slowSli = sliFromSnaps(slowSnaps);
console.log(JSON.stringify({fast: fastSli, slow: slowSli}));
")
```

**Latency (`type: percentile`):**

Para latency, p95 do último snapshot em CADA janela. SLI = fração de samples NOT acima de target_ms.

```bash
DUAL_SLI=$(node --input-type=module -e "
import { loadSnapshots } from './src/core/metrics.js';
const target = $TARGET_MS;
const fastSnaps = await loadSnapshots(process.cwd(), $FAST_BASELINE_MS);
const slowSnaps = await loadSnapshots(process.cwd(), $SLOW_BASELINE_MS);

function latencySli(snaps) {
  if (snaps.length < 1) return {sli: null, errorRate: 0, totalSamples: 0, slowSamples: 0, error: 'no_data'};
  const last = snaps[snaps.length - 1];
  let totalSamples = 0, slowSamples = 0;
  for (const lat of Object.values(last.latency)) {
    totalSamples += lat.count;
    if (lat.p95 > target) slowSamples += Math.round(lat.count * 0.05);
  }
  const sli = totalSamples > 0 ? 1 - (slowSamples / totalSamples) : null;
  const errorRate = totalSamples > 0 ? slowSamples / totalSamples : 0;
  return {sli, errorRate, totalSamples, slowSamples};
}

console.log(JSON.stringify({fast: latencySli(fastSnaps), slow: latencySli(slowSnaps)}));
")
```

### 3.5 Calcular burn rate + status COMBINADO (dual-window)

Aplicar fórmula canônica + status enum dual-window (skill `burn-rate-alerting` — fator 4× canonical):

```bash
DUAL_STATUS=$(node --input-type=module -e "
const dual = $DUAL_SLI;
const target = $TARGET_RATIO || (1 - 0.05); // latency: 1 - ratio_above_target (5%)
const fastMult = $FAST_MULTIPLIER;
const slowMult = $SLOW_MULTIPLIER;

function burnFromSli(sli, target) {
  if (sli.error) return {burnRate: null, error: sli.error};
  const slack = 1 - target;
  const burnRate = slack > 0 ? sli.errorRate / slack : 0;
  return {burnRate, errorRate: sli.errorRate};
}

// Combined status — canonical dual-window logic per skill burn-rate-alerting (fator 4×):
//   PAGE   = ambos críticos (fast ≥ 14.4 E slow ≥ 6) → page on-call AGORA
//   TICKET = slow erosion sustained (slow ≥ 6, fast OK) → ticket de investigação
//   WARN   = fast spike isolado (fast ≥ 14.4 sozinho) — monitor, NÃO page (alarm flap risk)
//   WARN   = mild burn em qualquer janela (≥ 1.0×) — sustained drains budget no horizonte
//   OK     = ambos < 1.0× — saudável
//   no_data = qualquer janela com snapshots insuficientes (conservative)
function combinedStatus(fastBurn, fastMult, slowBurn, slowMult) {
  if (fastBurn === null || slowBurn === null) return 'no_data';
  const fastTriggered = fastBurn >= fastMult;
  const slowTriggered = slowBurn >= slowMult;
  if (fastTriggered && slowTriggered) return 'PAGE';
  if (slowTriggered) return 'TICKET';
  if (fastTriggered) return 'WARN';
  if (fastBurn >= 1.0 || slowBurn >= 1.0) return 'WARN';
  return 'OK';
}

const fastBurn = burnFromSli(dual.fast, target);
const slowBurn = burnFromSli(dual.slow, target);
const combined = combinedStatus(fastBurn.burnRate, fastMult, slowBurn.burnRate, slowMult);

let action;
switch (combined) {
  case 'PAGE':
    action = 'Page on-call NOW — invoke /investigar-producao';
    break;
  case 'TICKET':
    action = 'Open ticket — slow erosion sustained, investigate before budget exhausted';
    break;
  case 'WARN':
    action = 'Monitor — burn rate ≥1× either window, sustained drains budget';
    break;
  case 'no_data':
    action = '— (await more snapshots; auto-persist via metrics-snapshot tool — Phase 102)';
    break;
  default:
    action = '—';
}

// ETA exhaustion (predictive). Use slow window (more stable signal for budget extrapolation).
// For burn=0 (no errors), ETA is ∞.
const slowBurnRate = slowBurn.burnRate;
const baselineHours = $SLOW_BASELINE_MS / 3600000;
const eta = (slowBurnRate !== null && slowBurnRate > 0)
  ? (1 / slowBurnRate) * 30 * 24 / baselineHours
  : null;
const etaStr = eta === null ? '—' : (eta < 24 ? eta.toFixed(1) + 'h' : (eta/24).toFixed(1) + 'd');

const fastBurnFmt = fastBurn.burnRate === null ? '—' : fastBurn.burnRate.toFixed(2) + '×';
const slowBurnFmt = slowBurn.burnRate === null ? '—' : slowBurn.burnRate.toFixed(2) + '×';

// fast_status / slow_status são derivados em isolation (informativo na tabela);
// combined_status é o veredito operacional.
function singleStatus(burn, mult) {
  if (burn === null) return 'no_data';
  if (burn >= mult) return mult === parseFloat('$FAST_MULTIPLIER') ? 'PAGE-FAST' : 'TICKET-SLOW';
  if (burn >= 1.0) return 'WARN';
  return 'OK';
}
const fastStatus = singleStatus(fastBurn.burnRate, fastMult);
const slowStatus = singleStatus(slowBurn.burnRate, slowMult);

console.log(JSON.stringify({
  fast_burn: fastBurnFmt,
  slow_burn: slowBurnFmt,
  fast_status: fastStatus,
  slow_status: slowStatus,
  combined_status: combined,
  action: action,
  eta: etaStr,
}));
")
```

### 3.6 Acumular linha da tabela (colunas dual-window)

```bash
SLO_ROWS+=("| $SLO_NAME | ${TARGET_RATIO:-${TARGET_MS}ms p$PERCENTILE} | ${FAST_BURN} | ${SLOW_BURN} | **${COMBINED_STATUS}** | $ETA | $ACTION |")
```

## 4. Renderizar tabela mestra (Phase 103 dual-window)

```text
═══════════════════════════════════════════════════════════
 framework ▸ BURN-RATE-STATUS (dual-window) ▸ {timestamp}
 fast_baseline=$FAST_BASELINE  slow_baseline=$SLOW_BASELINE
 fast_multiplier=$FAST_MULTIPLIER (page)  slow_multiplier=$SLOW_MULTIPLIER (ticket)
 snapshots fast=$FAST_COUNT  slow=$SLOW_COUNT
═══════════════════════════════════════════════════════════

| SLO | Target | Fast (1h) | Slow (6h) | Combined | ETA exhaustão | Ação |
|---|---|---|---|---|---|---|
{$SLO_ROWS}
```

**Exemplo concreto:**

```markdown
| SLO | Target | Fast (1h) | Slow (6h) | Combined | ETA exhaustão | Ação |
|---|---|---|---|---|---|---|
| mcp-tool-availability | 99.5% | 0.42× OK | 0.18× OK | **OK** | — | — |
| mcp-tool-latency | 200ms p95 | 16.0× PAGE-FAST | 8.5× TICKET-SLOW | **PAGE** | 4.2h | Page on-call NOW — invoke /investigar-producao |
```

## 5. Sugerir próximas ações

```bash
# Contar status counts
PAGE_COUNT=$(echo "$SLO_ROWS" | grep -c "\*\*PAGE\*\*" || echo 0)
TICKET_COUNT=$(echo "$SLO_ROWS" | grep -c "\*\*TICKET\*\*" || echo 0)
WARN_COUNT=$(echo "$SLO_ROWS" | grep -c "\*\*WARN\*\*" || echo 0)
NO_DATA_COUNT=$(echo "$SLO_ROWS" | grep -c "\*\*no_data\*\*" || echo 0)
```

Output:
```text
## Próximas ações

{Se PAGE_COUNT > 0:}
⚠ {PAGE_COUNT} SLO(s) em PAGE (ambas janelas críticas) — invocar /investigar-producao "<slo_name> dual-window burn"

{Se TICKET_COUNT > 0:}
☐ {TICKET_COUNT} SLO(s) em TICKET (slow erosion sustained) — abrir issue, investigar antes do budget esgotar

{Se WARN_COUNT > 0:}
ⓘ {WARN_COUNT} SLO(s) em WARN — fast spike isolado ou mild burn ≥ 1× (não page; monitor)

{Se NO_DATA_COUNT > 0:}
⊘ {NO_DATA_COUNT} SLO(s) sem dados em pelo menos uma janela — Phase 102 auto-persist deve popular .planning/metrics/snapshots/ automaticamente em chamadas ao MCP tool 'metrics-snapshot'
```

## 6. Modo `/loop` (idempotência)

Se chamado dentro de `/loop`, comportamento idempotente:
- Snapshot fresh em cada invocação (não acumular state).
- Output curto se `combined_status` não mudou (apenas linha-resumo; sem repetir tabela completa).
- Acionar AskUserQuestion APENAS quando algum SLO transiciona OK → WARN/TICKET/PAGE no `combined_status`.

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (SLO opcional + flags --fast-baseline/--slow-baseline/--format)
- [ ] SLOs descobertos via glob `.planning/slos/*.yml` (FIX Phase 99: extension `.yml`, não `.md`)
- [ ] alert_thresholds.page (fast) + alert_thresholds.ticket (slow) extraídos via awk com state machine
- [ ] Defensive defaults aplicados (14.4 / 6 / 1h / 6h) se YAML omitir blocos
- [ ] Snapshots carregados via `loadSnapshots()` em DUAS chamadas (fast + slow)
- [ ] SLI calculado por tipo (event-based ratio para availability, percentile para latency) em CADA janela
- [ ] Burn rate calculado pela fórmula `error_rate / (1 - target)` (skill [`burn-rate-alerting`](../skills/burn-rate-alerting/SKILL.md)) para fast E slow independentemente
- [ ] Status combinado dual-window: **PAGE** (ambos críticos) / **TICKET** (slow only) / **WARN** (fast only OR mild ≥ 1×) / **OK** (ambos < 1×) / **no_data** (qualquer janela com snapshots insuficientes)
- [ ] Tabela markdown agregada com colunas Fast (1h) / Slow (6h) / Combined explícitas
- [ ] ETA exhaustão computada (predictive forecast — usa slow window por estabilidade)
- [ ] Sugestões de próximas ações contextualizadas pelo combined_status
- [ ] Idempotente em /loop (sem acúmulo de state; transição combined_status dispara AskUserQuestion)
- [ ] no_data graceful — Phase 102 auto-persist mencionado como solução
- [ ] Skill burn-rate-alerting cross-referenced no objective + inline no node script + inline na tabela de fallback (3 hits ≥ 2 mínimo)
- [ ] Fator 4× explícito no contexto (canonical Google SRE)
</success_criteria>
