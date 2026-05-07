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
