---
id: budget-description
stage: pre-verify
blocking: true
description: Valida que cada agent/command/skill tem `description:` ≤ 200 chars no frontmatter (anti-pitfall A2 — CLAUDE.md inflation).
---

# Budget description gate

**When to run:** pre-verify, antes de commit final do milestone.

## Check

```bash
#!/usr/bin/env bash
# PT-BR: itera por todos os agent/command/skill, valida frontmatter description ≤ 200 chars
set -e

VIOLATIONS=0

# function que extrai description do YAML frontmatter
check_description() {
  local file="$1"
  local desc
  desc=$(awk '/^description:/{sub(/^description: ?/, ""); print; exit}' "$file" 2>/dev/null || true)
  if [ -z "$desc" ]; then
    echo "WARN: $file — sem description: no frontmatter"
    return 0
  fi
  local len=${#desc}
  if [ "$len" -gt 200 ]; then
    echo "FAIL: $file — description tem $len chars (max 200)"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# itera agents
for f in kit/agents/*.md; do
  [ -f "$f" ] && check_description "$f"
done

# itera commands
for f in kit/commands/*.md; do
  [ -f "$f" ] && check_description "$f"
done

# itera skills (SKILL.md em subdirs)
for f in kit/skills/*/SKILL.md; do
  [ -f "$f" ] && check_description "$f"
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Total violations: $VIOLATIONS (max description length 200 chars)"
  exit 1
fi

echo "✓ Todos os agents/commands/skills têm description ≤ 200 chars"
exit 0
```

## Verdict

- **passed** — todas as descriptions ≤ 200 chars
- **block** — pelo menos uma description > 200 chars (CLAUDE.md inflation)

## Notes

Anti-pitfall A2 da v1.8: cluster `supabase-*` adiciona 19+ entradas em CLAUDE.md. Sem este budget, descriptions verbosas inflam CLAUDE.md em ~3-4 KB+ — desfaz otimização de v1.6/v1.7.
