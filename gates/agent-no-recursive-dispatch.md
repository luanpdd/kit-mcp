---
id: agent-no-recursive-dispatch
stage: pre-verify
blocking: true
description: Valida que agents Supabase não montam ciclos via Task(). DAGs cooperativos v1.23+ (hardener/implementer pattern) são permitidos.
---

# Agent no recursive dispatch gate

**When to run:** pre-verify.

## Context

A v1.8 introduziu este gate para prevenir o anti-pitfall A10: tentação de `supabase-architect` invocar `supabase-migration-writer` que re-invocaria architect → **ciclo** lógico + custo LLM multiplicado.

A v1.23+ introduziu o pattern de **handoff cooperativo** (princípio canônico): agents não-Supabase planejam, agents Supabase materializam/hardenam, ninguém descarta upstream. Isso significa que **dispatches DAG entre agents Supabase são legítimos** (ex: `supabase-rls-writer` → `supabase-rls-hardener`). Apenas **ciclos** são proibidos.

Este gate, portanto, valida o conjunto **proibido** (ciclos) e o conjunto **permitido** (handoffs DAG canônicos da hierarquia hardener/implementer).

## Allowlist canônica de handoffs DAG (downstream-only)

- `supabase-rls-hardener` (v1.23) — canonical handoff target
- `supabase-rls-writer` (v1.8) — pode invocar hardener; hardener nunca invoca writer de volta
- `supabase-column-privileges-writer` (v1.24)
- `supabase-rbac-implementer` (v1.25)
- `supabase-roles-implementer` (v1.26)
- `supabase-migration-writer` (cross-suite SQL handoff)
- `supabase-branching-architect` (v1.27)
- `supabase-cicd-pipeline-implementer` (v1.27)

Dispatches para esses targets são **permitidos** mesmo quando o caller é também um agent Supabase.

## Check

```bash
#!/usr/bin/env bash
# PT-BR: agents Supabase podem invocar peers via DAG canônico (hardener/implementer pattern v1.23+).
# Proibido: ciclos. Permitido: dispatches downstream para a allowlist da hierarquia cooperativa.
set -e

VIOLATIONS=0

# Allowlist canônica (downstream-only): cada um destes é leaf na DAG cooperativa
ALLOWLIST='supabase-(rls-hardener|rls-writer|column-privileges-writer|rbac-implementer|roles-implementer|migration-writer|branching-architect|cicd-pipeline-implementer)'

for f in kit/agents/supabase-*.md; do
  [ -f "$f" ] || continue
  # 1. Match raw: linha contém Task(...subagent_type=...supabase-...)
  # 2. Excluir allowlist (handoffs DAG legítimos v1.23+)
  # 3. Excluir linhas de auto-documentação ("Este agent é invocável via Task" / "Cross-suite handoff: invocar via")
  matches=$(grep -nE 'Task\([^)]*subagent_type[^)]*supabase-' "$f" \
    | grep -vE "subagent_type[^)]*${ALLOWLIST}" \
    | grep -vE 'Este agent é invocável via|Cross-suite handoff: invocar via|invocável via .?Task' \
    || true)
  if [ -n "$matches" ]; then
    echo "FAIL: $f — dispatch fora da allowlist canônica (potencial ciclo):"
    echo "$matches"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Total violations: $VIOLATIONS"
  echo "Agents Supabase podem invocar a allowlist canônica (hardener/implementer pattern v1.23+)."
  echo "Dispatches fora dessa lista correm risco de ciclo (anti-pitfall A10)."
  exit 1
fi

echo "✓ Zero recursive dispatch fora da allowlist canônica"
exit 0
```

## Verdict

- **passed** — zero dispatches fora da allowlist DAG canônica
- **block** — dispatch para target não-allowlist detectado (potencial ciclo)

## Notes

- Anti-pitfall A10 (v1.8) ainda válido para targets **não-allowlist** (ex: architect → migration-writer fora do flow cooperativo)
- Allowlist v1.23-v1.27 reflete o princípio canônico: agents Supabase materializam/hardenam via DAG; ciclos continuam proibidos
- Para adicionar novo handoff target: incluir em `ALLOWLIST` acima e documentar a justificativa cross-suite
