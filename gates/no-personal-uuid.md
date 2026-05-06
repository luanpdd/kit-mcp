---
id: no-personal-uuid
stage: pre-verify
blocking: true
description: Detecta UUIDs no formato [0-9a-f]{8}-[0-9a-f]{4}-... em frontmatter `tools:` ou body de skills/agents/commands. UUID pessoal quebra para outros instaladores (anti-pitfall A12).
---

# No personal UUID gate

**When to run:** pre-verify.

## Check

```bash
#!/usr/bin/env bash
# PT-BR: detecta UUID em formato [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
# em frontmatter tools: ou body de kit/{agents,commands,skills}/
set -e

# allowlist: glossário menciona patterns mas não usa UUID em tools
ALLOWLIST_FILES=(
  "kit/skills/_shared-supabase/glossary.md"
)

VIOLATIONS=0

is_allowlisted() {
  local file="$1"
  for af in "${ALLOWLIST_FILES[@]}"; do
    [ "$file" = "$af" ] && return 0
  done
  return 1
}

check_uuid() {
  local file="$1"
  is_allowlisted "$file" && return 0

  # PT-BR: extrair frontmatter (entre --- ... ---)
  local frontmatter
  frontmatter=$(awk '/^---$/{i++; next} i==1' "$file" 2>/dev/null || true)

  # PT-BR: buscar UUID em frontmatter (linhas com tools: ou abaixo)
  if echo "$frontmatter" | grep -qE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'; then
    echo "FAIL (frontmatter): $file"
    grep -nE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$file" | head -3
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

for f in kit/agents/*.md; do [ -f "$f" ] && check_uuid "$f"; done
for f in kit/commands/*.md; do [ -f "$f" ] && check_uuid "$f"; done
for f in kit/skills/*/SKILL.md; do [ -f "$f" ] && check_uuid "$f"; done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Total violations: $VIOLATIONS"
  echo "UUIDs pessoais quebram para outros instaladores. Use mcp__supabase__* canônico."
  exit 1
fi

echo "✓ Zero UUIDs pessoais em kit/{agents,commands,skills}/"
exit 0
```

## Verdict

- **passed** — zero UUIDs em frontmatter ou body
- **block** — pelo menos um UUID pessoal detectado (quebra para outros users)

## Notes

Anti-pitfall A12 da v1.8: `schema-checker.md` originalmente usava `mcp__0a712001-6cbb-44ef-a5f4-a24ea40894fa__execute_sql` (UUID do projeto pessoal do user). Distribuído via `@luanpdd/kit-mcp`, isso quebra para qualquer outro instalador. Phase 28 migra para `mcp__supabase__*` canônico. Este gate previne regressão.
