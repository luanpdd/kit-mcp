---
name: auditar-cascading
description: Invoca cascading-failures-auditor — audita código de serviço para 5 triggers de cascade (sem timeout, retry sem jitter, sem circuit breaker, sem deadline propagation, queue unbounded); gera CASCA…
argument-hint: "[target_path] [--dimensions ...] [--severity P0|P1|P2|all]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Write
---

<objective>
Auditar código de serviço (Edge Function, handler HTTP, ou repo inteiro) para os 5 triggers canônicos de cascading failure (cap 22 livro Google SRE). Invoca o agente [`cascading-failures-auditor`](../agents/cascading-failures-auditor.md) que aplica a skill [`cascading-failures`](../skills/cascading-failures/SKILL.md) — defesa em camadas (timeout + retry com jitter + circuit breaker + deadline propagation + saturation gauge).

**Cria/Atualiza:**
- `.planning/CASCADING-AUDIT.md` — relatório priorizado P0/P1/P2 com diff sugerido por finding

**Após:** o user tem fila acionável de patches para prevenir cascade. Cap 22 — prevenção custa 1×, recuperação custa 100×.
</objective>

<context>
**Argumentos:**
- `[target_path]` — arquivo, diretório ou repo (default: `.`)
- `--dimensions <list>` — subset de `[timeouts, retry-jitter, circuit-breaker, deadline-prop, queue-bound, health-check, saturation-gauge]` (default: todas)
- `--severity P0|P1|P2|all` — filtro (default: all)
- `--output PATH` — caminho do output (default: `.planning/CASCADING-AUDIT.md`)

**Exemplos:**
```
/auditar-cascading                                      # repo inteiro
/auditar-cascading supabase/functions/                  # só Edge Functions
/auditar-cascading src/orders/handler.ts                # arquivo específico
/auditar-cascading --severity P0                        # só fix imediato
/auditar-cascading --dimensions timeouts,retry-jitter   # foco em duas dims
```
</context>

<process>

## 1. Parsear argumentos

```bash
TARGET_PATH=$(echo "$ARGUMENTS" | awk '{print $1}')
[ -z "$TARGET_PATH" ] || [ "${TARGET_PATH:0:2}" = "--" ] && TARGET_PATH="."
DIMENSIONS=$(echo "$ARGUMENTS" | grep -oE -- '--dimensions [^ ]+' | awk '{print $2}')
SEVERITY=$(echo "$ARGUMENTS" | grep -oE -- '--severity [^ ]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

[ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/CASCADING-AUDIT.md"
mkdir -p "$(dirname "$OUTPUT_PATH")"
```

## 2. Dispatch para `cascading-failures-auditor`

```text
Task(
  subagent_type="cascading-failures-auditor",
  prompt="
target_path: ${TARGET_PATH}
output_path: ${OUTPUT_PATH}
${DIMENSIONS:+dimensions: ${DIMENSIONS}}
${SEVERITY:+severity_filter: ${SEVERITY}}

Aplicar skill cascading-failures + retry-strategies + load-shedding-graceful-degradation. Detectar 5 triggers canônicos:
1. Sem timeout em chamadas externas (fetch/axios/http sem AbortSignal/timeout)
2. Retry sem jitter (setTimeout exponencial sem Math.random)
3. Sem circuit breaker em deps externas
4. Sem deadline propagation (handler sem header x-deadline)
5. Queue unbounded sem drop policy

Priorizar P0 (fix imediato) / P1 (próximo sprint) / P2 (best practice). Gerar diff sugerido para cada P0/P1.
"
)
```

## 3. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► AUDITAR-CASCADING ▸ ${OUTPUT_PATH}
═══════════════════════════════════════════════════════════

[output do agent]

## Próximos passos

1. **Aplicar P0 imediato** — patches são pequenos (5-15 min cada)
2. **/load-shedding <fn>** — adicionar defesas server-side complementares
3. **/golden-signals <fn>** (v1.10) — adicionar Saturation gauge (early warning de cascade)
4. **/prr <service>** (v1.10) — Axe 4 (Capacity Planning) consume este audit
5. **Game day exercise** mensal — validar resilience em staging

## Cross-suite

- v1.9 Observability — Saturation alert dispara load shed antes de cascade
- v1.10 SRE — PRR Axe 4 + Axe 5 consume
- v1.11 SRE Resilience — esse audit
- v1.12 Legacy — refactor pode introduzir/remover defesas; pre-refactor-characterization gate
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (target_path opcional, default cwd)
- [ ] `cascading-failures-auditor` invocado via Task
- [ ] CASCADING-AUDIT.md criado pelo agent
- [ ] Output forwarded transparentemente
- [ ] Cross-references com /load-shedding, /golden-signals, /prr
</success_criteria>
