---
name: observabilidade
description: Orquestrador da Suíte Observabilidade — dispatch para agents (instrumenter, investigator, slo-engineer, burn-rate-forecaster, omm-auditor) com sinônimos PT/EN.
argument-hint: "<subcomando> [args...]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Orquestrador único da Suíte Observabilidade (v1.9). Recebe subcomando e args, faz dispatch via `Task(subagent_type=...)` para o agent especializado correto. **Único ponto de chain de agents observability** (precedente: `/supabase` em v1.8 — anti-pitfall A10 mantido).

**Cria/Atualiza:** o que cada agent invocado cria.

**Após:** o usuário tem o output do agent (patches, SLO.md, snapshot OMM, investigation trail, etc.).
</objective>

<execution_context>
Skills consultadas pelos agents: `kit/skills/_shared-observability/glossary.md` (Phase 29) + `kit/skills/observability-*/SKILL.md` + `kit/skills/structured-events/SKILL.md` + `kit/skills/distributed-tracing/SKILL.md` + `kit/skills/opentelemetry-standard/SKILL.md` + `kit/skills/core-analysis-loop/SKILL.md` + `kit/skills/event-based-slos/SKILL.md` + `kit/skills/burn-rate-alerting/SKILL.md` + `kit/skills/telemetry-sampling/SKILL.md` + `kit/skills/telemetry-pipelines/SKILL.md`.

Agents disponíveis: `kit/agents/observability-instrumenter.md` (Phase 30), `kit/agents/incident-investigator.md` (Phase 30), `kit/agents/slo-engineer.md` (Phase 32), `kit/agents/burn-rate-forecaster.md` (Phase 32), `kit/agents/omm-auditor.md` (Phase 34).
</execution_context>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Agent dispatched |
|---|---|---|
| `instrumentar` | `instrument`, `inst` | `observability-instrumenter` |
| `investigar` | `investigate`, `incident` | `incident-investigator` |
| `slo` | `definir-slo`, `slo-engineer` | `slo-engineer` |
| `burn-rate` | `burn`, `burn-rate-forecaster`, `forecast` | `burn-rate-forecaster` |
| `omm` | `auditar`, `audit`, `maturity` | `omm-auditor` |
| `audit-coverage` | `cobertura`, `coverage` | `observability-coverage-auditor` (v1.12 cross-suite) |
| `help` | `ajuda`, `?` | exibe esta tabela inline |
</context>

<process>

## 1. Parsear subcomando

```bash
SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
```

**Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo. Sair.

## 2. Resolver sinônimos

```text
instrumentar, instrument, inst                      → observability-instrumenter
investigar, investigate, incident                   → incident-investigator
slo, definir-slo, slo-engineer                      → slo-engineer
burn-rate, burn, burn-rate-forecaster, forecast     → burn-rate-forecaster
omm, auditar, audit, maturity                       → omm-auditor
audit-coverage, cobertura, coverage                 → observability-coverage-auditor (v1.12 — cross-suite com Legacy)
```

**Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair.

```
✗ Subcomando desconhecido: '<SUBCMD>'

Subcomandos válidos:
  instrumentar / instrument        → instrumentar código com OTel + atributos canônicos
  investigar / investigate         → Core Analysis Loop em incident
  slo / definir-slo                → criar SLO.md + SQL materializar SLI
  burn-rate / forecast             → calcular burn rate atual + ETA exhaustão
  omm / auditar                    → OMM scored 5 capacidades

Uso: /observabilidade <subcomando> <args...>
Exemplo: /observabilidade investigar "checkout SLO burn rate = 8 às 14:32"
```

## 3. Detectar `supabase/config.toml` (para agents que usam MCP Supabase)

```bash
PROJECT_ID=""
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
fi
```

## 4. Dispatch

Invocar `Task(subagent_type=<agent_name>, prompt=<built_prompt>)`.

**Prompt construído:**

```
{ARGS}

{Se project_id detectado:}
project_id: {PROJECT_ID}
```

## 5. Output

Output do agent é o output do command. Sem post-processing — agent já formata estruturado.

</process>

<success_criteria>
- [ ] Subcomando resolvido para agent canônico (5 subcomandos × seus sinônimos)
- [ ] `project_id` extraído de `supabase/config.toml` se presente
- [ ] Dispatch via `Task(subagent_type=...)` — único ponto de chain
- [ ] Subcomando inválido → mensagem clara com lista
- [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline
- [ ] Args após subcomando passam transparentemente para o agent
</success_criteria>
