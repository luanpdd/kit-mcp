---
id: obs-agents-mcp-supabase
stage: pre-verify
blocking: true
description: Valida que agents observability que precisam de MCP Supabase declaram tools mcp__supabase__* no frontmatter (incident-investigator, slo-engineer, burn-rate-forecaster, omm-auditor).
---

# Observability agents MCP Supabase declaration gate

**When to run:** pre-verify.

## Check

```bash
#!/usr/bin/env bash
# PT-BR: agents que usam MCP Supabase devem declarar tools mcp__supabase__* no frontmatter.
# Anti-pitfall: declaração ausente faz Claude Code não autorizar tool, agent falha em runtime.
set -e

VIOLATIONS=0

# PT-BR: agents que DEVEM declarar mcp__supabase__*
declare_required() {
  local agent="$1"
  local required_tools="$2"   # tools separados por |
  local file="kit/agents/$agent.md"

  if [ ! -f "$file" ]; then
    echo "FAIL: $file — agent ausente"
    VIOLATIONS=$((VIOLATIONS + 1))
    return
  fi

  # PT-BR: extrair frontmatter tools field (multi-line possível)
  local in_frontmatter=0
  local in_tools=0
  local tools_block=""
  while IFS= read -r line; do
    if [ "$line" = "---" ]; then
      if [ "$in_frontmatter" -eq 0 ]; then
        in_frontmatter=1
      else
        break
      fi
    elif [ "$in_frontmatter" -eq 1 ]; then
      tools_block="$tools_block $line"
    fi
  done < "$file"

  local IFS='|'
  for tool in $required_tools; do
    if ! echo "$tools_block" | grep -qF "$tool"; then
      echo "FAIL: $file — não declara '$tool' em frontmatter tools"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
}

# PT-BR: incident-investigator usa get_logs/execute_sql/get_advisors
declare_required "incident-investigator" "mcp__supabase__get_logs|mcp__supabase__execute_sql|mcp__supabase__get_advisors"

# PT-BR: slo-engineer usa execute_sql + apply_migration
declare_required "slo-engineer" "mcp__supabase__execute_sql|mcp__supabase__apply_migration"

# PT-BR: burn-rate-forecaster usa execute_sql
declare_required "burn-rate-forecaster" "mcp__supabase__execute_sql"

# PT-BR: omm-auditor usa execute_sql (queries SLI)
declare_required "omm-auditor" "mcp__supabase__execute_sql"

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: 4 agents observability declaram mcp__supabase__* corretamente"
  exit 0
else
  echo "FAIL: $VIOLATIONS violação(ões)"
  exit 1
fi
```

## Why

Agents observability que aplicam Core Analysis Loop ou queries SLI dependem de `mcp__supabase__*`. Sem declaração no frontmatter `tools`, Claude Code não autoriza o tool em runtime e o agent falha (precedente: anti-pitfall identificado em v1.8 com supabase-* agents).

## REQ

QA-02.
