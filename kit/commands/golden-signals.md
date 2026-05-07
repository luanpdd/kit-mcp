---
name: golden-signals
description: Invoca golden-signals-instrumenter para serviço/Edge Function/fase — instrumenta 4 golden signals OTel (Latency histogram, Traffic counter, Errors counter, Saturation gauge).
argument-hint: "<target> [--service <name>] [--saturation <resource>] [--runtime <node|deno|python>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Instrumentar um serviço/Edge Function/fase com os **4 golden signals** do cap 6 do livro Google SRE — Latency (histogram bucketed), Traffic (counter), Errors (counter por `error.type`), Saturation (gauge resource-specific). Invoca o agente [`golden-signals-instrumenter`](../agents/golden-signals-instrumenter.md) que aplica a skill [`four-golden-signals`](../skills/four-golden-signals/SKILL.md).

**Cria/Atualiza:**
- Patches OTel nos arquivos do `<target>` (Latency + Traffic + Errors + Saturation)
- `GOLDEN-SIGNALS.md` por target com tabela de instrumentação aplicada (output do agent)

**Após:** os 4 signals estão instrumentados e o user pode rodar smoke local para verificar histogram/counter/gauge no backend OTel.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o `<target>` (path de arquivo, diretório de service, ou número de fase como `38`); restante são flags.

**Flags:**
- `--service <name>` — nome canônico do serviço (default: deriva de `package.json#name` ou diretório)
- `--saturation <resource>` — recurso de saturation (`db_connection_pool` | `cache_memory` | `queue_depth` | `concurrency_limit` | `cpu_load` | `egress_bandwidth`); se omitido, agent infere via heurística
- `--runtime <node|deno|python>` — runtime; se omitido, detecta via `package.json`/`deno.json`/`pyproject.toml`

**Exemplos:**
```
/golden-signals src/orders/handler.ts                              # 1 arquivo
/golden-signals supabase/functions/process-emails                  # 1 Edge Function
/golden-signals 38                                                 # todos os arquivos modificados pela Phase 38
/golden-signals src/api --service orders-api --saturation db_connection_pool
```

**Pré-requisito:** OTel SDK pode estar ausente — agent flagga deps necessárias no output. Caller decide instalar.
</context>

<process>

## 1. Parsear argumentos

```bash
TARGET=$(echo "$ARGUMENTS" | awk '{print $1}')
SERVICE=$(echo "$ARGUMENTS" | grep -oE -- '--service [^ ]+' | awk '{print $2}')
SATURATION=$(echo "$ARGUMENTS" | grep -oE -- '--saturation [^ ]+' | awk '{print $2}')
RUNTIME=$(echo "$ARGUMENTS" | grep -oE -- '--runtime [^ ]+' | awk '{print $2}')

if [ -z "$TARGET" ]; then
  echo "Uso: /golden-signals <target> [--service N] [--saturation R] [--runtime RT]"
  echo "Exemplos:"
  echo "  /golden-signals src/orders/handler.ts"
  echo "  /golden-signals supabase/functions/process-emails"
  echo "  /golden-signals 38                  # todos arquivos da Phase 38"
  exit 1
fi
```

## 2. Resolver target → lista de target_files

```bash
# PT-BR: 3 modos de resolução
if [[ "$TARGET" =~ ^[0-9]+$ ]]; then
  # Modo fase — extrai files_modified de PLAN.md(s) da Phase $TARGET
  PHASE_STATE=$(node "./.claude/framework/bin/tools.cjs" init phase-op "$TARGET")
  PHASE_DIR=$(echo "$PHASE_STATE" | jq -r .phase_dir)
  if [ "$PHASE_DIR" = "null" ] || [ ! -d "$PHASE_DIR" ]; then
    echo "Fase $TARGET ainda não foi planejada."
    exit 1
  fi
  TARGET_FILES=$(grep -rh "^  - " "$PHASE_DIR"/*-PLAN-*.md | grep -oE '[a-zA-Z0-9_/.-]+\.(ts|js|py|deno|sql)' | sort -u | tr '\n' ' ')
elif [ -d "$TARGET" ]; then
  # Modo diretório — todos arquivos relevantes (.ts, .js, .py)
  TARGET_FILES=$(find "$TARGET" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" \) | tr '\n' ' ')
elif [ -f "$TARGET" ]; then
  # Modo arquivo único
  TARGET_FILES="$TARGET"
else
  echo "Erro: target '$TARGET' não é arquivo, diretório ou número de fase válido."
  exit 1
fi

if [ -z "$TARGET_FILES" ]; then
  echo "Nenhum arquivo encontrado para target '$TARGET'."
  exit 0
fi
```

## 3. Dispatch para `golden-signals-instrumenter`

```text
Task(
  subagent_type="golden-signals-instrumenter",
  prompt="
target_files: ${TARGET_FILES}
${SERVICE:+service_name: ${SERVICE}}
${RUNTIME:+runtime: ${RUNTIME}}
${SATURATION:+saturation_resource: ${SATURATION}}

Aplicar skill four-golden-signals. Gerar patches OTel para os 4 signals em cada arquivo:
1. Latency: histogram com explicitBucketBoundaries exponencial, dimension result=success|error
2. Traffic: counter incrementado antes de processar request
3. Errors: counter por error_type enum (5-15 valores; NÃO error.message)
4. Saturation: ObservableGauge do recurso mais escasso (callback lê estado real)

Validar 6 checks no Step 3 do agent (latency separado success/error, error_type enum, etc.).
Output: tabela de patches gerados + GOLDEN-SIGNALS.md por target.
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► GOLDEN-SIGNALS ▸ ${TARGET}
═══════════════════════════════════════════════════════════

[output do golden-signals-instrumenter — ver Step 4 do agent]

## Próximos passos
1. Smoke local — enviar request e verificar histogram/counter/gauge no backend OTel
2. Cross-ref: rodar `/instrumentar-fase ${TARGET}` se spans/wide events ainda ausentes (complementar)
3. Após validar baseline, definir SLO event-based: `/observabilidade slo <feature>`
4. PRR antes de production: `/prr --service ${SERVICE:-<name>}`
```

</process>
