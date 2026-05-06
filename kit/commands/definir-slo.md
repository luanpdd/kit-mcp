---
name: definir-slo
description: Invoca slo-engineer para gerar SLO.md + SQL materialização SLI events. Aplica skill event-based-slos. Default 30d sliding window, target ≤ 99.95%.
argument-hint: "<feature> [--target 99.9] [--owner email]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Definir um SLO event-based para uma feature/jornada do usuário. Invoca o agente [`slo-engineer`](../agents/slo-engineer.md) que aplica a skill [`event-based-slos`](../skills/event-based-slos/SKILL.md) — SLI event-based, sliding window 30d, target ≤ 99.95%, owner nomeado, materialização em Postgres.

**Cria/Atualiza:**
- `.planning/slos/<slo_name>.md` — definição canônica do SLO
- `supabase/migrations/<timestamp>_create_sli_<slo_name>.sql` — view materializada SLI

**Após:** SLO está em `draft` status. Próximo passo: `/burn-rate-status <slo_name>` para validar baseline; após 1+ semana, promover de `draft` → `test_channel` → `primary`.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é a feature/jornada (ex: `checkout`, `login`, `bulk-orders`); restante são flags.

**Flags:**
- `--target <percent>` — target % do SLO (default: agent sugere baseado em criticality, sempre ≤ 99.95%)
- `--owner <email>` — owner do SLO (default: AskUserQuestion)
- `--window <duration>` — sliding window (default: `30d`)

**Pré-requisito (Full mode):** projeto Supabase configurado, schema `observability` com tabela de events (Phase 31 supabase-architect projeta isso).
</context>

<process>

## 1. Parsear argumentos

```bash
FEATURE=$(echo "$ARGUMENTS" | awk '{print $1}')
TARGET=$(echo "$ARGUMENTS" | grep -oE -- '--target [0-9.]+' | awk '{print $2}')
OWNER=$(echo "$ARGUMENTS" | grep -oE -- '--owner [^ ]+' | awk '{print $2}')
WINDOW=$(echo "$ARGUMENTS" | grep -oE -- '--window [^ ]+' | awk '{print $2}')

[ -z "$FEATURE" ] && {
  echo "Uso: /definir-slo <feature> [--target N] [--owner email]"
  exit 1
}

[ -z "$WINDOW" ] && WINDOW="30d"
```

## 2. Detectar `supabase/config.toml`

```bash
PROJECT_ID=""
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

## 3. Dispatch para `slo-engineer`

```text
Task(
  subagent_type="slo-engineer",
  prompt="
feature: ${FEATURE}
${TARGET:+target: ${TARGET}}
${OWNER:+owner: ${OWNER}}
window: ${WINDOW}
${PROJECT_ID:+project_id: ${PROJECT_ID}}

Aplicar skill event-based-slos. Gerar:
1. .planning/slos/<slo_name>.md (SLO definition canônico)
2. supabase/migrations/<timestamp>_create_sli_<slo_name>.sql (materialized view + pg_cron refresh)

Se target > 99.95%, recusar e explicar — métrica informativa, não SLO.
Se Full mode (mcp__supabase disponível), apply_migration; senão, output text.
"
)
```

## 4. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► DEFINIR-SLO ▸ {slo_name}
═══════════════════════════════════════════════════════════

[output do slo-engineer — ver Step 8 do agent]

## Próximos passos
1. `/burn-rate-status {slo_name}` — checar baseline atual
2. Após 1+ semana validando que SLO detecta incidents reais:
   - Editar `.planning/slos/{slo_name}.md` → status: `test_channel` → `primary`
3. Configurar alerts (page + ticket) — invocar `burn-rate-forecaster` ou config manual
```

</process>

<success_criteria>
- [ ] FEATURE parseado de $ARGUMENTS
- [ ] `slo-engineer` invocado via Task
- [ ] `.planning/slos/<slo_name>.md` criado
- [ ] Migration SQL criada (Full mode applied; Offline mode escrita)
- [ ] Target ≤ 99.95% enforced
- [ ] Owner registrado (via flag ou AskUserQuestion)
</success_criteria>
