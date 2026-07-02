---
name: caracterizar-prompt
description: Characterization de prompts/tools LLM em produção — temperature=0 + seed fixo + sanitização específica. Trata prompts como código legacy. Modernização 2026 sem precedente em 2004.
argument-hint: "<prompt_file> [--inputs-dir PATH] [--provider openai|anthropic] [--seed N] [--max-tokens N] [--num-intents N]"
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
Caracterizar **prompt LLM ou tool definition** capturando outputs determinísticos como golden snapshots. Aplica skill [`ai-prompt-characterization`](../skills/ai-prompt-characterization/SKILL.md) — `temperature=0`, `seed` fixo, sanitização de timestamps/UUIDs/datas relativas, 5+ intents distintas. Trata prompt como **código legacy também** — versionado, testado, code-reviewed.

**Cria/Atualiza:**
- `tests/characterization/prompts/<prompt-stem>.test.ts` (ou `.py`/`.go` conforme runtime)
- `tests/characterization/prompts/__snapshots__/<prompt-stem>.test.ts.snap`
- `tests/characterization/prompts/<prompt-stem>/inputs/<intent>.json` — inputs canônicos por intent

**Após:** mudança em prompt deve manter snapshot diff = 0 (ou mudança documentada). Detecta drift de model upstream automaticamente.
</objective>

<context>
**Argumentos:**
- `<prompt_file>` — arquivo do prompt (e.g., `prompts/generate-summary.md`) — OBRIGATÓRIO
- `--inputs-dir <path>` — diretório com inputs canônicos por intent (default: agent gera 5 sintéticos cobrindo concise/detailed/code/edge/adversarial)
- `--provider openai|anthropic` — provider de LLM (default: detecta via deps)
- `--seed N` — seed para determinismo (default: 42)
- `--max-tokens N` — limite output (default: 500)
- `--num-intents N` — número de intents a cobrir (default: 5; mínimo: 5)
- `--system-prompt <text>` — system prompt se aplicável

**Exemplos:**
```
/caracterizar-prompt prompts/generate-summary.md
/caracterizar-prompt prompts/code-reviewer.md --num-intents 7 --max-tokens 1000
/caracterizar-prompt prompts/intent-classifier.md --inputs-dir test-data/classifier-intents
/caracterizar-prompt prompts/customer-support.md --provider anthropic --seed 123
```

**Pré-requisitos:**
- ANTHROPIC_API_KEY ou OPENAI_API_KEY em env
- Test framework (Vitest, Jest, pytest, ...)
- Provider escolhido suporta `temperature=0` + `seed`

**Quando este comando é o caminho:**
- Prompt em produção > 50 linhas
- Mudanças em prompt quebraram silenciosamente no passado
- Equipe quer baseline antes de refactor de prompt
- CI deve detectar drift de model upstream (Claude 4.7 → 4.8)
</context>

<process>

## 1. Parsear argumentos

```bash
PROMPT_FILE=$(echo "$ARGUMENTS" | awk '{print $1}')
INPUTS_DIR=$(echo "$ARGUMENTS" | grep -oE -- '--inputs-dir [^ ]+' | awk '{print $2}')
PROVIDER=$(echo "$ARGUMENTS" | grep -oE -- '--provider [^ ]+' | awk '{print $2}')
SEED=$(echo "$ARGUMENTS" | grep -oE -- '--seed [0-9]+' | awk '{print $2}')
MAX_TOKENS=$(echo "$ARGUMENTS" | grep -oE -- '--max-tokens [0-9]+' | awk '{print $2}')
NUM_INTENTS=$(echo "$ARGUMENTS" | grep -oE -- '--num-intents [0-9]+' | awk '{print $2}')

[ -z "$SEED" ]         && SEED=42
[ -z "$MAX_TOKENS" ]   && MAX_TOKENS=500
[ -z "$NUM_INTENTS" ]  && NUM_INTENTS=5

if [ -z "$PROMPT_FILE" ]; then
  echo "ERROR: prompt_file obrigatório"
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: arquivo não encontrado: $PROMPT_FILE"
  exit 1
fi
```

## 2. Detectar provider + framework

```bash
# auto-detect provider
if [ -z "$PROVIDER" ]; then
  if [ -n "$ANTHROPIC_API_KEY" ]; then
    PROVIDER="anthropic"
  elif [ -n "$OPENAI_API_KEY" ]; then
    PROVIDER="openai"
  else
    echo "ERROR: nenhum provider detectado. Setar ANTHROPIC_API_KEY ou OPENAI_API_KEY"
    exit 1
  fi
fi

# detectar test framework
FRAMEWORK=""
if [ -f "package.json" ]; then
  if jq -re '.devDependencies.vitest' package.json >/dev/null 2>&1; then FRAMEWORK="vitest"
  elif jq -re '.devDependencies.jest' package.json >/dev/null 2>&1; then FRAMEWORK="jest"
  fi
elif [ -f "pyproject.toml" ]; then
  FRAMEWORK="pytest"
fi

[ -z "$FRAMEWORK" ] && FRAMEWORK="vitest"  # default sane
```

## 3. Dispatch para `legacy-characterizer` (modo prompt)

```text
Task(
  subagent_type="legacy-characterizer",
  prompt="
target_file: ${PROMPT_FILE}
target_kind: prompt
provider: ${PROVIDER}
seed: ${SEED}
max_tokens: ${MAX_TOKENS}
num_intents: ${NUM_INTENTS}
${INPUTS_DIR:+inputs_dir: ${INPUTS_DIR}}
framework: ${FRAMEWORK}

Aplicar skill ai-prompt-characterization. Etapas:
1. Ler prompt + identificar inputs esperados (system prompt? user message format? tools?)
2. Gerar (ou ler de inputs-dir) ${NUM_INTENTS}+ inputs cobrindo intents distintas:
   - concise: pedido curto, output esperado curto
   - detailed: pedido elaborado, output esperado longo
   - code-heavy: input/output com código
   - edge case: input ambíguo
   - adversarial: prompt injection attempt
3. Para cada intent: rodar LLM com temperature=0 + seed=${SEED}
4. Capturar text + finishReason + toolCalls (se function calling) + inputTokens + outputTokens + modelVersion
5. Sanitizar: timestamps, UUIDs, datas relativas, valores monetários, versões
6. Salvar como snapshot tests usando ${FRAMEWORK}
7. Cobertura behavioral = % intents cobertas (não % linhas)
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► CARACTERIZAR-PROMPT ▸ tests/characterization/prompts/...
═══════════════════════════════════════════════════════════

[output do legacy-characterizer em modo prompt]

## ⚠ REVISÃO MANUAL OBRIGATÓRIA

Snapshots gerados — leia cada um antes de commit:
1. Verificar nenhum PII/secret persiste pós-sanitização
2. Verificar nenhum timestamp/UUID/data relativa unredacted
3. Confirmar finishReason esperado (stop vs length vs tool_use)
4. Para tool_uses: confirmar tool name + input shape

## Próximos passos

1. **Revisar snapshots** manualmente
2. **Rodar suite local:**
   - JS/TS: `npm test -- tests/characterization/prompts`
   - Python: `pytest tests/characterization/prompts`
3. **Commit** como `chore: characterize <prompt-name>`
4. **Configurar CI:**
   - `tests/characterization/prompts/**` rodam em PR que toca `prompts/**`
   - Diff vermelho = mudança comportamental detectada → review humano
5. **Configurar nightly** para detectar drift de model upstream:
   - Anthropic publica Claude 4.8 → re-run characterization → snapshot diff
6. **Custo:** ~${NUM_INTENTS} × ($0.015/1k input tokens × 2k = $0.03 + output) ≈ $0.10-0.50/run

## Cross-suite

- **/caracterizar** (v1.12) — characterization de código (não prompt) — análogo
- **`llm-as-dependency`** skill — fakear LLM em business logic tests (não esses tests)
- **`legacy-api-only-applications`** skill — LLM provider é caso especial de API external
- **/instrumentar-fase** (v1.9) — instrumenta consumer de prompt (latency, tokens)
```

</process>

<success_criteria>
- [ ] $ARGUMENTS parseados
- [ ] Provider detectado automaticamente OU especificado
- [ ] Framework de teste detectado
- [ ] `legacy-characterizer` invocado em modo prompt
- [ ] ≥ 5 intents cobrindo grupos canônicos (concise/detailed/code/edge/adversarial)
- [ ] temperature=0 + seed=fixo aplicado
- [ ] Sanitização específica para outputs LLM aplicada
- [ ] Tests rodam contra LLM real apenas em characterization (não em business logic tests)
- [ ] Próximos passos: review, commit, CI config, nightly drift detection
- [ ] Cross-suite com llm-as-dependency e legacy-api-only-applications
</success_criteria>
