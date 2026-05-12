---
name: load-shedding
description: Invoca load-shedding-instrumenter — aplica patches de load shedding em Edge Function/handler HTTP (concurrency limit, queue bound + drop policy, deadline-aware, server-side rate limit, slow start…
argument-hint: "<target_path> [--max-concurrent N] [--queue-max-size N] [--patterns ...]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Aplicar **patches de load shedding** em Edge Function ou handler HTTP, instrumentando defesas server-side: concurrency limit + queue bound + deadline-aware + rate limit + slow start. Invoca o agente [`load-shedding-instrumenter`](../agents/load-shedding-instrumenter.md) que aplica skill [`load-shedding-graceful-degradation`](../skills/load-shedding-graceful-degradation/SKILL.md).

**Cria/Atualiza:**
- Patches no `target_path`
- `supabase/functions/_shared/load-shedder.ts` (se não existe)
- `supabase/functions/_shared/token-bucket.ts` (se rate-limit aplicado)

**Após:** handler retorna 503 + Retry-After quando saturated, em vez de aceitar e cair. Defesa central contra cascade.
</objective>

<context>
**Argumentos:**
- `<target_path>` — arquivo a instrumentar (Edge Function ou handler HTTP) — OBRIGATÓRIO
- `--max-concurrent N` — concurrency limit (default: 1000)
- `--queue-max-size N` — queue bound (default: 10000)
- `--patterns <list>` — subset de `[concurrency-limit, queue-bound, deadline-aware, rate-limit, slow-start]` (default: aplicáveis)

**Exemplos:**
```
/load-shedding supabase/functions/process-orders/index.ts
/load-shedding src/handlers/webhook.ts --max-concurrent 500
/load-shedding supabase/functions/api/index.ts --patterns concurrency-limit,deadline-aware
```
</context>

<process>

## 1. Parsear argumentos

```bash
TARGET_PATH=$(echo "$ARGUMENTS" | awk '{print $1}')
MAX_CONCURRENT=$(echo "$ARGUMENTS" | grep -oE -- '--max-concurrent [0-9]+' | awk '{print $2}')
QUEUE_MAX_SIZE=$(echo "$ARGUMENTS" | grep -oE -- '--queue-max-size [0-9]+' | awk '{print $2}')
PATTERNS=$(echo "$ARGUMENTS" | grep -oE -- '--patterns [^ ]+' | awk '{print $2}')

[ -z "$MAX_CONCURRENT" ] && MAX_CONCURRENT=1000
[ -z "$QUEUE_MAX_SIZE" ] && QUEUE_MAX_SIZE=10000

if [ -z "$TARGET_PATH" ]; then
  echo "ERROR: target_path obrigatório"
  exit 1
fi
[ ! -f "$TARGET_PATH" ] && { echo "ERROR: arquivo não encontrado"; exit 1; }
```

## 2. Dispatch para `load-shedding-instrumenter`

```text
Task(
  subagent_type="load-shedding-instrumenter",
  prompt="
target_path: ${TARGET_PATH}
max_concurrent: ${MAX_CONCURRENT}
queue_max_size: ${QUEUE_MAX_SIZE}
${PATTERNS:+patterns: ${PATTERNS}}

Aplicar skill load-shedding-graceful-degradation. Patches:
1. Concurrency limit + 503 graceful (LoadShedder em _shared)
2. Deadline-aware handler (x-deadline-ms header parsing)
3. Queue bound + drop oldest (FIFO drop)
4. Server-side rate limit (token bucket per-client)
5. Slow start state machine (5 min ramp em recovery)

Verify compilação verde após patches. Output curto com lista de patches aplicados.
"
)
```

## 3. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► LOAD-SHEDDING ▸ ${TARGET_PATH}
═══════════════════════════════════════════════════════════

[output do agent]

## Próximos passos

1. **Smoke local:** `deno task serve` ou `npm run dev`, request 200 OK
2. **Stress test:** rampar tráfego acima de --max-concurrent, verificar 503 + Retry-After
3. **Game day:** simular dep down, verificar graceful degradation
4. **/golden-signals <fn>** (v1.10) — instrumentar saturation gauge para acionar load shed
5. **/caracterizar <fn>** (v1.12) — characterization tests pós-patches

## Cross-suite

- /auditar-cascading (v1.11) — caller-side defesas complementam
- /golden-signals (v1.10) — Saturation gauge é trigger
- /prr (v1.10) — Axe 4 consume
```

</process>

<success_criteria>
- [ ] target_path obrigatório
- [ ] `load-shedding-instrumenter` invocado via Task
- [ ] Patches aplicados com Edit
- [ ] Compilação verde verificada
- [ ] Output forwarded
- [ ] Cross-references com /auditar-cascading, /golden-signals, /caracterizar
</success_criteria>
