---
name: burn-rate-status
description: Tabela de burn rate por SLO — % budget gasto, ETA exhaustão, ação (page/ticket/warn/ok). Rodável manualmente ou em /loop. Aplica skill burn-rate-alerting.
argument-hint: "[<slo_name>] [--lookahead 4h] [--baseline 1h]"
allowed-tools:
  - Read
  - Bash
  - Task
  - Glob
---

<objective>
Snapshot de burn rate para 1 SLO (se especificado) ou TODOS os SLOs definidos. Aplica skill [`burn-rate-alerting`](../skills/burn-rate-alerting/SKILL.md) — fórmula `burn_rate = error_rate / (1 - target)`, lookahead ≤ 4× baseline.

**Cria/Atualiza:** nada — comando read-only.

**Após:** o user vê tabela com status (PAGE / TICKET / WARN / OK) e pode escolher invocar `/investigar-producao` se há burn ativo.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — opcional `<slo_name>` para 1 SLO; sem args = todos.

**Flags:**
- `--lookahead <duration>` — janela predictive (default: `4h` para short-term)
- `--baseline <duration>` — janela base (default: `1h`)
- `--format <table|json>` — output format (default: `table`)

**Combinações canônicas:**
- short-term: lookahead 4h, baseline 1h (page-tier)
- long-term: lookahead 3d, baseline 18h (ticket-tier)

**Loop pattern:** rodar este comando via skill `loop` com intervalo 5min para monitoramento contínuo.

```text
/loop 5m /burn-rate-status
```
</context>

<process>

## 1. Parsear argumentos

```bash
SLO_NAME=$(echo "$ARGUMENTS" | awk '{print $1}' | grep -v '^--' || true)
LOOKAHEAD=$(echo "$ARGUMENTS" | grep -oE -- '--lookahead [^ ]+' | awk '{print $2}')
BASELINE=$(echo "$ARGUMENTS" | grep -oE -- '--baseline [^ ]+' | awk '{print $2}')
FORMAT=$(echo "$ARGUMENTS" | grep -oE -- '--format [^ ]+' | awk '{print $2}')

[ -z "$LOOKAHEAD" ] && LOOKAHEAD="4h"
[ -z "$BASELINE" ] && BASELINE="1h"
[ -z "$FORMAT" ] && FORMAT="table"
```

## 2. Listar SLOs

```bash
if [ -n "$SLO_NAME" ]; then
  SLO_FILES=(".planning/slos/${SLO_NAME}.md")
else
  SLO_FILES=(.planning/slos/*.md)
fi

if [ ${#SLO_FILES[@]} -eq 0 ] || [ ! -f "${SLO_FILES[0]}" ]; then
  echo "Nenhum SLO definido. Rode /definir-slo <feature> primeiro."
  exit 0
fi
```

## 3. Para cada SLO, dispatch para `burn-rate-forecaster`

Para cada `SLO_FILE`:

```bash
SLO_NAME=$(basename "$SLO_FILE" .md)
TARGET=$(grep -oE 'Target.*[0-9.]+' "$SLO_FILE" | head -1 | grep -oE '[0-9.]+')
```

```text
Task(
  subagent_type="burn-rate-forecaster",
  prompt="
slo_name: ${SLO_NAME}
target: ${TARGET}
lookahead: ${LOOKAHEAD}
baseline: ${BASELINE}

Calcular burn rate atual + ETA + status (PAGE/TICKET/WARN/OK).
Output formato compatível com tabela mestra.
"
)
```

## 4. Agregar resultados em tabela

```
═══════════════════════════════════════════════════════════
 framework ► BURN-RATE-STATUS ▸ {timestamp}
═══════════════════════════════════════════════════════════

| SLO | Target | Window | Budget gasto | Burn rate | ETA exhaustão | Status | Ação |
|---|---|---|---|---|---|---|---|
| checkout_success | 99.9% | 30d | 23% | 1.4× | 12d | OK | informativo |
| login_success | 99.95% | 30d | 78% | 8.0× | 4h | **PAGE** | invocar /investigar-producao |
| search_latency | 99% | 30d | 15% | 0.7× | — | OK | — |
```

## 5. Sugerir próximas ações

Se algum SLO em status PAGE ou TICKET:

```
## ⚠ SLOs em alerta:
1. login_success — burn rate 8.0×, ETA 4h
   → /investigar-producao "login_success burn rate = 8.0× às {timestamp}"

## SLOs em WARN (>= 80% gasto):
- (nenhum)

## SLOs OK:
- 2 SLOs em compliance saudável
```

## 6. Modo `/loop`

Se chamado dentro de `/loop`, comportamento idempotente:
- Não acumular state entre invocações (snapshot fresh)
- Output curto se nada mudou (apenas status; sem repetir tabela completa em todo loop)
- Acionar AskUserQuestion APENAS quando status muda de OK → WARN/TICKET/PAGE (transição)

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (SLO opcional + flags)
- [ ] SLOs descobertos via glob `.planning/slos/*.md`
- [ ] `burn-rate-forecaster` invocado para cada SLO
- [ ] Tabela agregada em formato consistente
- [ ] Status enum: PAGE / TICKET / WARN / OK
- [ ] Sugestões de próximas ações para SLOs em alerta
- [ ] Idempotente (rodável em /loop sem acúmulo)
</success_criteria>
