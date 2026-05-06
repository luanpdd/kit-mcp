---
id: skill-must-include
stage: pre-verify
blocking: true
description: Valida que skills supabase-* contêm strings obrigatórias verbatim — anti-pattern prevention (RLS (select), search_path, getAll/setAll, etc.).
---

# Skill must-include gate

**When to run:** pre-verify.

## Check

```bash
#!/usr/bin/env bash
# PT-BR: cada skill deve incluir strings obrigatórias verbatim para prevenir anti-patterns
set -e

VIOLATIONS=0

# PT-BR: mapeamento skill → must-include strings (delimitadas por |)
declare -A MUST_INCLUDE
MUST_INCLUDE["supabase-rls-policies"]="(select auth.uid())|user_metadata|TO authenticated"
MUST_INCLUDE["supabase-database-functions"]="set search_path = ''|SECURITY INVOKER"
MUST_INCLUDE["supabase-auth-ssr"]="getAll|setAll|auth-helpers-nextjs|@supabase/ssr"
MUST_INCLUDE["supabase-realtime"]="broadcast|private: true|realtime.broadcast_changes|removeChannel"
MUST_INCLUDE["supabase-edge-functions"]="npm:|jsr:|Deno.serve|EdgeRuntime.waitUntil|/tmp"
MUST_INCLUDE["supabase-declarative-schema"]="supabase/schemas/|supabase stop|supabase db diff -f"
MUST_INCLUDE["supabase-migrations"]="YYYYMMDDHHmmss|RLS|granular"
MUST_INCLUDE["supabase-postgres-style"]="snake_case|ISO 8601|lowercase"
MUST_INCLUDE["supabase-storage"]="signed URL|storage.objects|multi-tenant"
MUST_INCLUDE["supabase-pgvector-rag"]="HNSW|IVFFlat|<=>|RAG with permissions"
MUST_INCLUDE["supabase-cron-queues"]="pg_cron|pgmq|pg_net"

for skill in "${!MUST_INCLUDE[@]}"; do
  file="kit/skills/$skill/SKILL.md"
  if [ ! -f "$file" ]; then
    echo "FAIL: $file — skill ausente"
    VIOLATIONS=$((VIOLATIONS + 1))
    continue
  fi

  # PT-BR: testa cada string (separada por |)
  IFS='|' read -ra REQUIRED <<< "${MUST_INCLUDE[$skill]}"
  for str in "${REQUIRED[@]}"; do
    if ! grep -qF "$str" "$file"; then
      echo "FAIL: $file — must-include ausente: '$str'"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Total violations: $VIOLATIONS"
  exit 1
fi

echo "✓ Todas as skills supabase-* contêm must-include strings"
exit 0
```

## Verdict

- **passed** — todas as 11 skills têm strings obrigatórias
- **block** — pelo menos uma skill faltando string crítica (anti-pattern prevention quebrada)

## Notes

Anti-pitfall A7 da v1.8: skills devem prevenir ativamente os anti-patterns Supabase mais críticos. Sem este gate, refator de skill pode acidentalmente remover a regra principal (ex: `(select auth.uid())` wrapper que previne 1000× degradação). Strings como `WARNING user_metadata`, `set search_path = ''`, `NEVER use auth-helpers-nextjs` são as primeiras coisas que LLM lê — devem estar lá.
