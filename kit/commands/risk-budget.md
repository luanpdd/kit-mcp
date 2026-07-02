---
name: risk-budget
description: Exibe error budget atual vs risk continuum (cap 3 SRE) — lê .planning/slos/, posiciona no continuum 99% → 99.999%, aplica sabedoria 99.99% e "as reliable as needs to be".
argument-hint: "[<slo_name>] [--format table|json]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
Snapshot read-only de **error budget vs risk continuum** (cap 3 do livro Google SRE) para 1 SLO ou todos. Aplica skill [`sre-risk-management`](../skills/sre-risk-management/SKILL.md) — risk continuum como decisão explícita, error budget como balanço risk × innovation, sabedoria 99.99% (user em smartphone 99% NÃO distingue 99.99% vs 99.999%), "as reliable as needs to be, no more".

Lê SLOs definidos em [`event-based-slos`](../skills/event-based-slos/SKILL.md) (v1.9) — `.planning/slos/*.md`. Complementa [`burn-rate-status`](./burn-rate-status.md) (v1.9 — burn rate forecast) com **decisão estratégica** sobre target apropriado.

**Cria/Atualiza:** nada — comando read-only.

**Após:** o user vê posição de cada SLO no continuum, % budget gasto, custo relativo (1× → 100×+), e recomendação de tier (free/paid/enterprise) consistente com user-perception.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — opcional `<slo_name>` para 1 SLO; sem args = todos os SLOs.

**Flags:**
- `--format <table|json>` — output format (default: `table`)
- `--explain` — incluir bloco "sabedoria 99.99%" + anti-patterns inline (verbose)

**Pré-requisito:** SLOs definidos em `.planning/slos/*.md` (v1.9 — comando `/observabilidade slo` ou `/definir-slo`).

**Risk continuum canônico** (cap 3, aplicado inline pela skill):

| Target | Tolerância 30d | User-perceptible? | Recomendação | Custo relativo |
|---|---|---|---|---|
| 99% | 7.2 h | Sim | Tier free, beta, internal | 1× |
| 99.5% | 3.6 h | Notável | Tier free de produção | 2× |
| 99.9% | 43.2 min | Aceitável para UX | Tier paid default | 5× |
| 99.95% | 21.6 min | Quase imperceptível | Tier enterprise / mission-critical | 10× |
| 99.99% | 4.3 min | Imperceptível em smartphone | Apenas se justificado (raro) | 50×+ |
| 99.999% | 26 s | NÃO perceptível | NUNCA para user-facing | 100×+ |

**Loop pattern:** rodar via skill `loop` para monitoramento contínuo.

```text
/loop 1h /risk-budget
```

**Exemplos:**
```
/risk-budget                              # todos SLOs, formato table
/risk-budget checkout_success             # 1 SLO específico
/risk-budget --format json                # output estruturado
/risk-budget login_success --explain      # com sabedoria 99.99% + anti-patterns inline
```
</context>

<process>

## 1. Parsear argumentos

```bash
SLO_NAME=$(echo "$ARGUMENTS" | awk '{print $1}' | grep -v '^--' || true)
FORMAT=$(echo "$ARGUMENTS" | grep -oE -- '--format [^ ]+' | awk '{print $2}')
EXPLAIN=$(echo "$ARGUMENTS" | grep -c -- '--explain' || echo 0)

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
  echo "Nenhum SLO definido em .planning/slos/."
  echo "Defina um com: /observabilidade slo <feature>  (v1.9)"
  exit 0
fi
```

## 3. Para cada SLO, extrair metadados + computar posição no continuum

Para cada `SLO_FILE`:

```bash
SLO_NAME=$(basename "$SLO_FILE" .md)
TARGET=$(grep -m1 -oE 'target.*[0-9.]+' "$SLO_FILE" | grep -oE '[0-9.]+')
WINDOW=$(grep -m1 -oE 'window.*[0-9]+[dh]' "$SLO_FILE" | grep -oE '[0-9]+[dh]' || echo "30d")
TIER_LABEL=$(grep -m1 'tier:' "$SLO_FILE" | sed 's/.*tier: //' || echo "(unset)")
OWNER=$(grep -m1 'owner:' "$SLO_FILE" | sed 's/.*owner: //' || echo "(unset)")
```

**Mapear target → posição no risk continuum** (skill `sre-risk-management` Pattern 1):

| Target faixa | Posição | Custo relativo | Tier típico | User-perceptible |
|---|---|---|---|---|
| < 0.99 | abaixo do continuum (under-spec) | <1× | beta/dev | sim |
| 0.99 ≤ t < 0.995 | 99% | 1× | free, beta, internal | sim (notável) |
| 0.995 ≤ t < 0.999 | 99.5% | 2× | free de produção | notável em paths críticos |
| 0.999 ≤ t < 0.9995 | 99.9% | 5× | paid default | aceitável para UX |
| 0.9995 ≤ t < 0.9999 | 99.95% | 10× | enterprise/mission-critical | quase imperceptível |
| 0.9999 ≤ t < 0.99999 | 99.99% | 50×+ | só com checklist 4-perguntas | imperceptível em smartphone |
| t ≥ 0.99999 | 99.999% | 100×+ | NUNCA para user-facing | NÃO perceptível |

**Computar budget gasto** (heurística — leitura grosseira do SLO file):

```bash
# PT-BR: SLO file pode ter linha "**Budget consumido (snapshot):** XX%" atualizada por job
BUDGET_USED_PCT=$(grep -m1 -oE 'Budget consumido.*[0-9]+%' "$SLO_FILE" | grep -oE '[0-9]+%' || echo "?")

# PT-BR: se não, sugerir invocar /burn-rate-status (que tem queries live)
if [ "$BUDGET_USED_PCT" = "?" ]; then
  BUDGET_USED_PCT="(invoque /burn-rate-status para snapshot live)"
fi
```

**Status no continuum** (4 níveis enum — interpretação canônica):

- `OPTIMAL` — target apropriado para tier; budget < 50% gasto → "as reliable as needs to be"
- `OVER-SPEC` — target acima do necessário (ex: tier free com 99.99%) → desperdício; baixar target
- `UNDER-SPEC` — target abaixo do esperado (ex: enterprise com 99% só) → SLA risk; subir target
- `BUDGET-EXHAUSTED` — budget < 10% restante → freeze releases; revisitar postmortems

## 4. Agregar resultados em tabela

```
═══════════════════════════════════════════════════════════
 framework ► RISK-BUDGET ▸ {timestamp}
═══════════════════════════════════════════════════════════

| SLO | Target | Posição | Tier | Custo relativo | Budget gasto | Status | Decisão |
|---|---|---|---|---|---|---|---|
| checkout_success | 99.9% | 99.9% (5×) | paid | 5× | 23% | OPTIMAL | manter |
| login_success | 99.99% | 99.99% (50×+) | enterprise | 50×+ | 78% | BUDGET-EXHAUSTED | freeze releases; checklist 4-perguntas? |
| search_latency | 99% | 99% (1×) | free | 1× | 15% | OPTIMAL | manter (tier free OK) |
| admin_panel | 99.95% | 99.95% (10×) | (?internal) | 10× | 5% | OVER-SPEC | baixar para 99% (internal tool, custo desperdício) |
```

Output JSON (`--format json`) — mesmo conteúdo serializado:

```json
{
  "timestamp": "2026-05-07T...",
  "slos": [
    {
      "name": "checkout_success",
      "target": 0.999,
      "position": "99.9%",
      "cost_multiplier": "5×",
      "tier": "paid",
      "budget_used_pct": 23,
      "status": "OPTIMAL",
      "decision": "manter"
    }
  ]
}
```

## 5. Modo `--explain` — sabedoria 99.99% + anti-patterns inline

Se `--explain` setado, anexar após tabela:

```markdown
## Sabedoria 99.99% (cap 3)

> Smartphone tem ~99% de disponibilidade (sinal cai, bateria acaba, app trava).
> Usuário em 99% smartphone NÃO distingue serviço 99.99% vs 99.999% — ambos
> parecem "sempre funcionando" no contexto dele. Cada nove adicional **multiplica
> custo** mas **divide benefício marginal**. Cliente final (humano em smartphone
> com ISP residencial ~99%) tem disponibilidade no canal de comunicação inferior
> à do seu serviço 99.99%. Essa é a sabedoria 99.99%.

## Anti-patterns detectados

{Para cada SLO em status OVER-SPEC, BUDGET-EXHAUSTED:}
- **{slo_name}** ({status}): {explicação curta}
  - {ação recomendada}

Exemplos:
- **admin_panel** (OVER-SPEC): tier internal com 99.95% (10× custo). Internal tool não exige tier paid.
  - Ação: editar `.planning/slos/admin_panel.md` → target: 0.99 (1×); ou remover SLO formal (apenas métrica informativa).
- **login_success** (BUDGET-EXHAUSTED 78%): 99.99% sem checklist 4-perguntas justificada?
  - Ação: revisar Pattern "justificar 99.99%+ excepcional" (skill sre-risk-management); se NÃO atende 4 critérios, baixar para 99.95%.
```

## 6. Sugerir próximas ações

Se algum SLO em status `BUDGET-EXHAUSTED` ou `OVER-SPEC`:

```
## ⚠ Decisões pendentes

{Para cada SLO em alerta:}
- {slo_name} ({status}): {recomendação curta}
  → /investigar-producao "{slo_name} budget exhausted às {timestamp}"   # se BUDGET-EXHAUSTED
  → editar `.planning/slos/{slo_name}.md` target: {sugestão}            # se OVER-SPEC

## Cross-refs
- `/burn-rate-status {slo_name}` — burn rate live (forecast ETA)
- `/postmortem --incident "..."` — se budget exhausted virou incident
- `/observabilidade omm` — Capacidade 1 (Embracing Risk) consome este snapshot
```

</process>

<success_criteria>
- [ ] `<slo_name>` opcional + flags `--format` e `--explain` parseadas
- [ ] SLOs listados via glob `.planning/slos/*.md`
- [ ] Cada SLO mapeado para posição no risk continuum (1× a 100×+)
- [ ] 4 status enum: OPTIMAL / OVER-SPEC / UNDER-SPEC / BUDGET-EXHAUSTED
- [ ] Tabela agregada com 8 colunas (SLO, Target, Posição, Tier, Custo relativo, Budget gasto, Status, Decisão)
- [ ] Modo `--explain` anexa sabedoria 99.99% + anti-patterns detectados inline
- [ ] Cross-refs para `/burn-rate-status`, `/postmortem`, `/observabilidade omm` (Capacidade 1 Embracing Risk)
- [ ] Idempotente — rodável em `/loop` sem state acumulado
- [ ] Read-only — comando NÃO modifica arquivos
</success_criteria>
