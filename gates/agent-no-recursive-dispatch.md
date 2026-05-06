---
id: agent-no-recursive-dispatch
stage: pre-verify
blocking: true
description: Valida que agents Supabase NÃO contêm Task(subagent_type=supabase-...). Orquestração só via /supabase command (anti-pitfall A10 — recursive dispatch).
---

# Agent no recursive dispatch gate

**When to run:** pre-verify.

## Check

```bash
#!/usr/bin/env bash
# PT-BR: agents Supabase não devem invocar outros agents Supabase via Task()
# Orquestração centralizada no command /supabase (anti-pitfall A10)
set -e

VIOLATIONS=0

for f in kit/agents/supabase-*.md; do
  [ -f "$f" ] || continue
  # PT-BR: busca por Task(...subagent_type=...supabase-... ou Task(... 'supabase-...
  if grep -nE 'Task\([^)]*subagent_type[^)]*supabase-' "$f"; then
    echo "FAIL: $f — agent Supabase invocando outro agent Supabase via Task()"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Total violations: $VIOLATIONS"
  echo "Agents Supabase devem ser função pura. Orquestração apenas via /supabase command."
  exit 1
fi

echo "✓ Zero recursive dispatch entre agents Supabase"
exit 0
```

## Verdict

- **passed** — zero `Task(subagent_type=supabase-...)` em `kit/agents/supabase-*.md`
- **block** — recursive dispatch detectado

## Notes

Anti-pitfall A10 da v1.8: tentação de `supabase-architect` invocar `supabase-migration-writer` que re-invoca architect → stack overflow lógico + custo LLM multiplicado. Solução: agents permanecem função pura; chain via `/supabase` command (Phase 27 — único orquestrador autorizado).
