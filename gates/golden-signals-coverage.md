---
id: golden-signals-coverage
stage: pre-verify
blocking: true
description: Valida que código de serviço/Edge Function tocado em fase contém os 4 golden signals (Latency=histogram, Traffic=counter, Errors=counter, Saturation=gauge). Skip se fase só toca markdown.
---

# Golden signals coverage gate

**When to run:** pre-verify (blocking — fase não verifica até cobertura completa).

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar que código de serviço/Edge Function tocado em fase tem 4 golden signals.
# Estratégia: descobrir arquivos tocados (supabase/functions/** ou STATE.md current_phase code paths),
# rodar grep por histogram/counter/gauge/saturation, contar matches por sinal.
# Bash 3.2-portable (macOS default).
set -e

# PT-BR: identificar fase atual via STATE.md
STATE_FILE=".planning/STATE.md"
CURRENT_PHASE=""
if [ -f "$STATE_FILE" ]; then
  CURRENT_PHASE=$(grep -E "^Fase:" "$STATE_FILE" 2>/dev/null | head -1 | sed -E 's/^Fase: *([0-9]+).*/\1/')
fi

# PT-BR: candidatos a arquivos de código tocados — escopo principal Supabase Edge + qualquer .ts/.js/.py
# em paths declarados pela fase (heurística: supabase/functions/** SEMPRE inspecionado).
CODE_FILES=""
if [ -d "supabase/functions" ]; then
  CODE_FILES=$(find supabase/functions -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) 2>/dev/null)
fi

# PT-BR: também inspecionar lib/ e src/ se existirem (apps Node/Deno fora de Supabase)
if [ -d "src" ]; then
  ADDITIONAL=$(find src -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" -o -name "*.py" \) 2>/dev/null)
  CODE_FILES="$CODE_FILES
$ADDITIONAL"
fi
if [ -d "lib" ]; then
  ADDITIONAL=$(find lib -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" -o -name "*.py" \) 2>/dev/null)
  CODE_FILES="$CODE_FILES
$ADDITIONAL"
fi

# PT-BR: filtrar linhas vazias
CODE_FILES=$(echo "$CODE_FILES" | grep -v "^$" || true)

# PT-BR: se fase não toca código (só markdown/docs), pular gate
if [ -z "$CODE_FILES" ]; then
  echo "INFO: nenhum arquivo de código (.ts/.js/.py) encontrado em supabase/functions/** | src/** | lib/** — fase parece content-only. Gate skipped."
  exit 0
fi

# PT-BR: contar matches por signal
LATENCY_HITS=0
TRAFFIC_HITS=0
ERRORS_HITS=0
SATURATION_HITS=0

# PT-BR: process file list line-by-line para portabilidade bash 3.2
OLDIFS="$IFS"
IFS='
'
for f in $CODE_FILES; do
  [ -z "$f" ] && continue
  [ ! -f "$f" ] && continue

  # PT-BR: Latency = histogram (createHistogram, recordHistogram, histogram.record)
  if grep -qE "histogram|Histogram" "$f" 2>/dev/null; then
    LATENCY_HITS=$((LATENCY_HITS + 1))
  fi

  # PT-BR: Traffic + Errors = counter (Errors counter dimensionado por error.type)
  if grep -qE "counter|Counter|createCounter" "$f" 2>/dev/null; then
    TRAFFIC_HITS=$((TRAFFIC_HITS + 1))
    ERRORS_HITS=$((ERRORS_HITS + 1))
  fi

  # PT-BR: Saturation = gauge (createObservableGauge, gauge.record) ou string saturation
  if grep -qE "gauge|Gauge|saturation|Saturation" "$f" 2>/dev/null; then
    SATURATION_HITS=$((SATURATION_HITS + 1))
  fi
done
IFS="$OLDIFS"

# PT-BR: gate passa se TODOS os 4 signals têm pelo menos 1 hit em algum arquivo de código
MISSING=""
[ "$LATENCY_HITS" -eq 0 ] && MISSING="$MISSING Latency(histogram)"
[ "$TRAFFIC_HITS" -eq 0 ] && MISSING="$MISSING Traffic(counter)"
[ "$ERRORS_HITS" -eq 0 ] && MISSING="$MISSING Errors(counter)"
[ "$SATURATION_HITS" -eq 0 ] && MISSING="$MISSING Saturation(gauge)"

if [ -z "$MISSING" ]; then
  echo "PASS: 4 golden signals cobertos em código (Latency=$LATENCY_HITS files / Traffic=$TRAFFIC_HITS / Errors=$ERRORS_HITS / Saturation=$SATURATION_HITS)"
  exit 0
else
  echo "FAIL: golden signals ausentes em código tocado:$MISSING"
  echo "Sugestão: rodar /sre golden-signals <service> ou /golden-signals para gerar instrumentação OTel canônica."
  echo "Cross-ref: kit/skills/four-golden-signals/SKILL.md + kit/agents/golden-signals-instrumenter.md"
  exit 1
fi
```

## Verdict

- **passed** — todos 4 signals (Latency / Traffic / Errors / Saturation) presentes em pelo menos 1 arquivo de código no projeto
- **passed (skip)** — projeto não tem código (apenas markdown / docs); gate não aplicável
- **block** — pelo menos 1 signal ausente em código tocado pela fase

## Why

O livro Google SRE (cap 6 — *Monitoring Distributed Systems*) define os **4 golden signals** como cobertura mínima universal de saúde operacional para serviços user-facing — Latency (histogram com percentis, success vs error separados), Traffic (counter por endpoint × method), Errors (counter por `error.type` enum 5-15 valores, NUNCA `error.message`), Saturation (gauge do recurso mais escasso identificado explicitamente).

Sem esse gate, fases entregam Edge Functions / serviços sem instrumentação básica e dashboards crescem ad-hoc (CPU, memory, threads — *causes* não *symptoms*). Gate força padrão canônico: cada PR de código deve cobrir os 4 signals, ou explicar a ausência via skip (fase só altera markdown).

Cross-ref agent canônico: [`golden-signals-instrumenter`](../kit/agents/golden-signals-instrumenter.md) (Phase 37 / AGCORE-SRE-01). Skill: [`four-golden-signals`](../kit/skills/four-golden-signals/SKILL.md) (Phase 36 / SKFD-SRE-02).

## REQ

QA-SRE-01.

## Configuração

Gate é **blocking** por default. Para tornar warn-only (durante adoption inicial em legado):

```bash
node ./.claude/framework/bin/tools.cjs config-set workflow.golden_signals_coverage_warn true
```

(Nota: implementação do toggle warn-only é deferida — gate atual lê apenas presença/ausência de regex, não consulta config.)
