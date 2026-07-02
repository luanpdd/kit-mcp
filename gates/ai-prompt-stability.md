---
id: ai-prompt-stability
stage: pre-execute
blocking: false
description: Valida que prompts/tools LLM em produção (qualquer arquivo em `prompts/` ou referenciado por código de produção como prompt) têm characterization tests linkados. Skip se projeto não usa LLM. Opt-in via workflow.ai_prompt_gate.
---

# AI prompt stability gate

**When to run:** pre-execute (consultive default; blocking se `workflow.ai_prompt_gate=true`).

**Skill canônica:** [`ai-prompt-characterization`](../kit/skills/ai-prompt-characterization/SKILL.md)

**Agent invocado:** [`legacy-characterizer`](../kit/agents/legacy-characterizer.md) (modo prompt)

## Check

```bash
#!/usr/bin/env bash
# PT-BR: validar que prompts em prod têm characterization tests
set -e

# detectar prompts em prod (heurística — paths canônicos)
PROMPT_FILES=""
for d in prompts src/prompts supabase/functions/*/prompts; do
  [ -d "$d" ] && PROMPT_FILES="$PROMPT_FILES $(find "$d" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.prompt" \) 2>/dev/null)"
done

if [ -z "$PROMPT_FILES" ]; then
  echo "INFO: nenhum prompt em prod detectado — gate skip."
  exit 0
fi

# detectar gate mode
GATE_BLOCKING=false
if [ -f ".planning/config.json" ] && command -v jq >/dev/null; then
  CFG=$(jq -r '.workflow.ai_prompt_gate // empty' .planning/config.json 2>/dev/null)
  [ "$CFG" = "true" ] && GATE_BLOCKING=true
fi

# para cada prompt, verificar characterization tests
PROMPTS_OK=()
PROMPTS_MISSING=()

for prompt in $PROMPT_FILES; do
  STEM=$(basename "$prompt" | sed 's/\.[^.]*$//')
  HAS_CHAR=false
  for chardir in tests/characterization/prompts test/characterization/prompts __tests__/characterization/prompts; do
    if find "$chardir" -path "*${STEM}*" 2>/dev/null | head -1 | grep -q . ; then
      HAS_CHAR=true
      break
    fi
  done

  if [ "$HAS_CHAR" = "true" ]; then
    PROMPTS_OK+=("$prompt")
  else
    LINES=$(wc -l < "$prompt" 2>/dev/null | tr -d ' ')
    if [ "${LINES:-0}" -gt 50 ]; then  # threshold: prompts > 50 linhas requerem char
      PROMPTS_MISSING+=("$prompt (lines=$LINES)")
    fi
  fi
done

if [ ${#PROMPTS_MISSING[@]} -eq 0 ]; then
  echo "✓ ai-prompt-stability — todos os prompts > 50 linhas têm characterization tests."
  exit 0
fi

echo ""
echo "⚠ ai-prompt-stability — prompts sem characterization detectados:"
echo ""
for p in "${PROMPTS_MISSING[@]}"; do
  echo "  - $p"
done
echo ""
echo "Skill canônica: kit/skills/ai-prompt-characterization/SKILL.md"
echo ""
echo "Caminhos para resolver:"
echo "  /caracterizar-prompt <prompt-file>            (gera characterization tests)"
echo "  /caracterizar-prompt <prompt> --num-intents 5 (5 intents canônicas)"
echo ""

if [ "$GATE_BLOCKING" = "true" ]; then
  echo "MODE: blocking (workflow.ai_prompt_gate=true)"
  echo "Resolve antes de prosseguir."
  exit 1
else
  echo "MODE: consultive (warning apenas)"
  echo "Para tornar blocking: setar workflow.ai_prompt_gate=true em .planning/config.json"
  exit 0
fi
```

## Configuração

```json
{
  "workflow": {
    "ai_prompt_gate": false,
    "ai_prompt_min_lines": 50,
    "ai_prompt_paths": ["prompts/**", "src/prompts/**", "supabase/functions/*/prompts/**"]
  }
}
```

**Default:** `ai_prompt_gate` = false (consultive). Promove para blocking se projeto tem ≥ 5 prompts em prod.

## Quando NÃO rodar

- Projeto não usa LLM em produção
- Prompts são apenas para dev tooling (não prod)
- Prompts < 50 linhas (threshold default)

## Ver também

- [`ai-prompt-characterization`](../kit/skills/ai-prompt-characterization/SKILL.md) — knowledge base
- [`legacy-characterization-tests`](../kit/skills/legacy-characterization-tests/SKILL.md) — characterization clássico
- [`legacy-refactor-safety`](./legacy-refactor-safety.md) — gate análogo para refactor de código
- [`llm-as-dependency`](../kit/skills/llm-as-dependency/SKILL.md) — fakear LLM em business logic tests
