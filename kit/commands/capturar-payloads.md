---
name: capturar-payloads
description: Invoca payload-capture-instrumenter — instrumenta Edge Function Supabase para captura via mcp__supabase__get_logs por N dias, sanitiza PII, gera fixtures para legacy-characterizer.
argument-hint: "<edge_function_path> [--days N] [--max-payloads N] [--mode instrument|drain|full] [--sanitize-keys k1,k2,...]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
  - mcp__supabase__execute_sql
  - mcp__supabase__get_logs
---

<objective>
Instrumentar Edge Function Supabase para capturar **payloads reais** de produção, drenar logs após janela de captura via `mcp__supabase__get_logs`, sanitizar PII deterministicamente, e gerar fixtures prontos para alimentar `/caracterizar`. Invoca o agente [`payload-capture-instrumenter`](../agents/payload-capture-instrumenter.md) que aplica a skill [`legacy-characterization-tests`](../skills/legacy-characterization-tests/SKILL.md) Pattern 7.

**Cria/Atualiza:**
- Patch na Edge Function adicionando log dedicado controlado por env `CAPTURE_PAYLOADS=true`
- `supabase/functions/_shared/payload-capture.ts` — sanitização canônica
- `tests/characterization/<edge-fn>/fixtures/payload-NN.json` — fixtures sanitizados após drenagem

**Após:** o user tem fixtures BASEADOS EM DISTRIBUIÇÃO REAL de produção, não em sintéticos. Cobertura comportamental cresce significativamente.
</objective>

<context>
**Argumentos:**
- `<edge_function_path>` — path da Edge Function (e.g., `supabase/functions/process-orders/index.ts`) — OBRIGATÓRIO
- `--days N` — janela de captura em dias (default: 7)
- `--max-payloads N` — máximo de fixtures a salvar (default: 100)
- `--mode instrument|drain|full` — fase do workflow:
  - `instrument` — só aplica patch (você faz deploy + aguarda)
  - `drain` — só drena logs (após capture já rodou em prod)
  - `full` — patch + aguarda + drena (default — orquestra tudo)
- `--sanitize-keys k1,k2,k3` — keys adicionais a redact

**Workflow esperado:**

```
Dia 0:  /capturar-payloads <fn> --mode=instrument
Dia 0:  Você faz deploy + setar CAPTURE_PAYLOADS=true em env
Dia 1-7: produção captura naturalmente
Dia 7:  /capturar-payloads <fn> --mode=drain
Dia 7:  Fixtures criados em tests/characterization/<fn>/fixtures/
Dia 7:  /caracterizar <fn> --fixtures-dir tests/characterization/<fn>/fixtures
```

**Exemplos:**
```
/capturar-payloads supabase/functions/webhook-stripe/index.ts                  # full mode 7 dias
/capturar-payloads supabase/functions/process-orders/index.ts --days 14        # janela maior
/capturar-payloads supabase/functions/process-orders/index.ts --mode=instrument  # só patch
/capturar-payloads supabase/functions/process-orders/index.ts --mode=drain      # só drenagem
```

**Pré-requisitos:**
- Edge Function deployada em Supabase (modo drain depende de logs em prod)
- MCP Supabase conectado para drenagem automatizada (alternativa: `supabase functions logs` CLI)
- Tier full em IDEs com MCP; tier partial degrada para instrumentação only

**Quando preferir este comando vs `/caracterizar` direto:**
- Edge Function tem alto traffic (≥ 100 req/dia) — distribuição real cobre edge cases que sintético não pega
- Edge Function tem contrato externo crítico (webhook de Stripe/GitHub) — fidelidade absoluta requer payloads reais
- Equipe quer baseline empírico antes de refactor — payloads reais > inputs sintéticos
</context>

<process>

## 1. Parsear argumentos

```bash
EDGE_FN_PATH=$(echo "$ARGUMENTS" | awk '{print $1}')
CAPTURE_DAYS=$(echo "$ARGUMENTS" | grep -oE -- '--days [0-9]+' | awk '{print $2}')
MAX_PAYLOADS=$(echo "$ARGUMENTS" | grep -oE -- '--max-payloads [0-9]+' | awk '{print $2}')
MODE=$(echo "$ARGUMENTS" | grep -oE -- '--mode[= ][^ ]+' | sed 's/--mode[= ]//')
SANITIZE_KEYS=$(echo "$ARGUMENTS" | grep -oE -- '--sanitize-keys [^ ]+' | awk '{print $2}')

[ -z "$CAPTURE_DAYS" ]  && CAPTURE_DAYS=7
[ -z "$MAX_PAYLOADS" ]  && MAX_PAYLOADS=100
[ -z "$MODE" ]          && MODE="full"

if [ -z "$EDGE_FN_PATH" ]; then
  echo "ERROR: edge_function_path obrigatório"
  echo "Uso: /capturar-payloads <path> [opções]"
  exit 1
fi

if [ ! -f "$EDGE_FN_PATH" ]; then
  echo "ERROR: arquivo não encontrado: $EDGE_FN_PATH"
  exit 1
fi
```

## 2. Validar pré-requisitos

```bash
# verificar Edge Function (Deno + Deno.serve)
if ! grep -q "Deno.serve" "$EDGE_FN_PATH"; then
  echo "ERROR: $EDGE_FN_PATH não parece Edge Function (sem Deno.serve)"
  exit 1
fi

# detectar projeto Supabase
PROJECT_ID=""
if [ -f "supabase/config.toml" ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi

if [ -z "$PROJECT_ID" ] && [ "$MODE" != "instrument" ]; then
  echo "WARN: PROJECT_ID não detectado em supabase/config.toml — drenagem pode falhar"
fi
```

## 3. Dispatch para `payload-capture-instrumenter`

```text
Task(
  subagent_type="payload-capture-instrumenter",
  prompt="
edge_function_path: ${EDGE_FN_PATH}
capture_days: ${CAPTURE_DAYS}
max_payloads: ${MAX_PAYLOADS}
mode: ${MODE}
${SANITIZE_KEYS:+sanitize_keys: ${SANITIZE_KEYS}}
${PROJECT_ID:+project_id: ${PROJECT_ID}}

Aplicar skill legacy-characterization-tests Pattern 7. Etapas:
1. Preflight: validar Edge Function, detectar project_id
2. (mode=instrument|full) Patch Edge Function adicionando log dedicado
3. (mode=instrument) Output mensagem para fazer deploy + setar CAPTURE_PAYLOADS=true
4. (mode=drain|full após delay) Drenar logs via mcp__supabase__get_logs
5. Para cada log entry com kind=payload-capture:
   - Parse payload sanitized
   - Salvar em tests/characterization/<fn>/fixtures/payload-NN.json
6. Pós-processamento: validar nenhum unredacted, sanitização adicional
7. Output curto + recomendações (review fixtures, /caracterizar, remove flag)
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► CAPTURAR-PAYLOADS ▸ ${EDGE_FN_PATH}
═══════════════════════════════════════════════════════════

[output do payload-capture-instrumenter]

## Próximos passos por mode

### Após mode=instrument
1. Deploy: `supabase functions deploy <name>`
2. Setar env var: `supabase secrets set CAPTURE_PAYLOADS=true`
3. Aguardar ${CAPTURE_DAYS} dias
4. Rodar: `/capturar-payloads ${EDGE_FN_PATH} --mode=drain`

### Após mode=drain ou full
1. **REVISAR fixtures** manualmente — sample 5-10 arquivos
2. **VALIDAR no PII vaza:**
   ```bash
   grep -E "([0-9]{3}\.[0-9]{3}\.[0-9]{3}-?[0-9]{2}|@.*\..*\.com)" tests/characterization/*/fixtures/*.json
   ```
3. **Alimentar legacy-characterizer:**
   ```bash
   /caracterizar ${EDGE_FN_PATH} --fixtures-dir tests/characterization/$(basename $(dirname ${EDGE_FN_PATH}))/fixtures
   ```
4. **Após characterization gerada:** REMOVE flag CAPTURE_PAYLOADS:
   ```bash
   supabase secrets unset CAPTURE_PAYLOADS
   git revert <commit-instrument>
   ```

## Cross-suite

- **/caracterizar** (v1.12) — consome fixtures gerados aqui
- **/instrumentar-fase** (v1.9) — captura é instrumentação shift-left aplicada
- **/golden-signals** (v1.10) — captura E golden signals podem coexistir mesma Edge Function
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados (edge_function_path obrigatório, 4 flags opcionais)
- [ ] Pré-requisitos validados (Deno.serve presente; supabase/config.toml para project_id)
- [ ] `payload-capture-instrumenter` invocado via Task com mode resolvido
- [ ] Tier degradation correto (Full = MCP drain; Partial = instrument-only)
- [ ] Output forwarded transparentemente
- [ ] Próximos passos específicos por mode (instrument vs drain vs full)
- [ ] Cross-references com /caracterizar, /instrumentar-fase, /golden-signals
</success_criteria>
