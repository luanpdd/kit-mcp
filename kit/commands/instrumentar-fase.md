---
name: instrumentar-fase
description: Após /planejar-fase, gera INSTRUMENTATION.md por plano (spans, atributos canônicos, eventos, validação ODD). Aplica skill observability-driven-development.
argument-hint: "[fase] [plano]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Após `/planejar-fase` produzir PLAN.md, este comando gera `INSTRUMENTATION.md` para cada plano da fase. Aplica a skill [observability-driven-development](../skills/observability-driven-development/SKILL.md) — bundle telemetria com a feature, valide as 4 perguntas pré-PR.

**Cria/Atualiza:**
- `.planning/phases/<N>/<padded>-PLAN-<NN>-INSTRUMENTATION.md` por plano

**Após:** o user tem o contrato de instrumentação que o `executor` (e o `observability-instrumenter`) devem cumprir durante `/executar-fase`.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é número da fase (ex.: `30`); segundo opcional é número do plano (ex.: `01`); se omitido, processa todos os planos da fase.

**Pré-requisito:** `/planejar-fase <N>` já rodou. Existem `<padded>-PLAN-<NN>-*.md` em `.planning/phases/<N>/`.

**Skill consultada:** [`observability-driven-development`](../skills/observability-driven-development/SKILL.md) — 4 perguntas pré-PR canônicas.
</context>

<process>

## 1. Parsear argumentos

```bash
PHASE_NUM=$(echo "$ARGUMENTS" | awk '{print $1}')
PLAN_NUM=$(echo "$ARGUMENTS" | awk '{print $2}')

if [ -z "$PHASE_NUM" ]; then
  echo "Uso: /instrumentar-fase <N> [<NN>]"
  echo "Ex.: /instrumentar-fase 30        # todos os planos da Phase 30"
  echo "Ex.: /instrumentar-fase 30 01     # só Plano 01 da Phase 30"
  exit 1
fi
```

## 2. Detectar phase_dir + planos

```bash
PHASE_STATE=$(node "./.claude/framework/bin/tools.cjs" init phase-op "$PHASE_NUM")
PHASE_DIR=$(echo "$PHASE_STATE" | jq -r .phase_dir)

if [ "$PHASE_DIR" = "null" ] || [ ! -d "$PHASE_DIR" ]; then
  echo "Fase $PHASE_NUM ainda não foi planejada. Rode /planejar-fase $PHASE_NUM primeiro."
  exit 1
fi

# PT-BR: descobrir PLAN.md(s) — exclui já-instrumentados
if [ -n "$PLAN_NUM" ]; then
  PLANS=("$PHASE_DIR"/*-PLAN-${PLAN_NUM}-*.md)
else
  PLANS=("$PHASE_DIR"/*-PLAN-*.md)
fi
```

## 3. Para cada plano, gerar INSTRUMENTATION.md

Para cada `PLAN_FILE`:

```bash
PADDED=$(basename "$PLAN_FILE" | grep -oE '^[0-9]+')
NN=$(basename "$PLAN_FILE" | grep -oE 'PLAN-[0-9]+' | grep -oE '[0-9]+')
OUT_FILE="$PHASE_DIR/${PADDED}-PLAN-${NN}-INSTRUMENTATION.md"

# PT-BR: não sobrescrever se já existe
if [ -f "$OUT_FILE" ]; then
  echo "Já existe: $OUT_FILE — pulando"
  continue
fi
```

Ler `PLAN_FILE` para extrair:
- Goal/objetivo
- Tarefas (especialmente as que adicionam novos handlers/funções/endpoints)
- Componentes/serviços tocados

Gerar `INSTRUMENTATION.md` com seções canônicas (consultar [`observability-driven-development`](../skills/observability-driven-development/SKILL.md)):

```markdown
---
phase: {N}
plan: {NN}
title: Instrumentation Plan for Plan {NN}
status: pending
---

# Instrumentation Plan — Phase {N}, Plan {NN}: {plan_title}

## Spans

Spans a adicionar em arquivos modificados/criados pelo plano.

| Name | Kind | Service | Atributos canônicos | Notas |
|------|------|---------|---------------------|-------|
| `{handler_name}` | SERVER | `{service}` | `user.id`, `tenant_id`, `request.id`, `endpoint`, `http.method`, `result.success`, `error.type`, `build_id` | inbound HTTP |

## Eventos críticos

Eventos com semantic significance que merecem `result.success` discreto.

| Event | Quando emitir | result.success | error.type enum (catch) |
|-------|---------------|----------------|--------------------------|
| `{event_name}` | {momento} | true se {happy path} | `validation` \| `auth` \| `rate_limit` \| `timeout` \| `unknown` |

## Métricas (opcional, se há valores numéricos críticos)

| Name | Type | Unit | Labels |
|------|------|------|--------|
| `{metric_name}` | counter \| histogram | `ms` \| `bytes` \| `count` | `tenant_id`, `endpoint` |

## Validação ODD — 4 perguntas pré-PR

| # | Pergunta | Como verificar |
|---|----------|----------------|
| 1 | **Faz o que esperei?** | Span tem `result.success = true` no happy path. Smoke: enviar request, query `WHERE result_success = true` retorna |
| 2 | **Compara à versão anterior?** | `build_id` setado em todo span. Query: `SELECT build_id, ..., AVG(duration_ms) GROUP BY build_id` |
| 3 | **Usuários estão usando?** | `user.id` ou `tenant_id` ou `customer.tier` em todo span. Query: `SELECT customer.tier, COUNT(*) GROUP BY 1` |
| 4 | **Anomalias emergem?** | Cada `catch` emite `error.type` enum (não message livre). Cada if/else significativo emite `branch_taken`. Query: `SELECT error.type, COUNT(*) GROUP BY 1` |

## Sampling (head-based, default)

```ts
// PT-BR: errors sempre, success sample 10% — ajuste conforme volume
const shouldSample = (event: SpanLike): boolean => {
  if (event.attributes['result.success'] === false) return true   // 100% errors
  if (event.attributes['customer.tier'] === 'enterprise') return true  // 100% enterprise
  return Math.random() < 0.1   // 10% baseline
}
```

## Referências cruzadas

- Skill [`structured-events`](../skills/structured-events/SKILL.md) — campos canônicos
- Skill [`distributed-tracing`](../skills/distributed-tracing/SKILL.md) — propagação cross-service
- Skill [`opentelemetry-standard`](../skills/opentelemetry-standard/SKILL.md) — SDK setup
- Skill [`observability-driven-development`](../skills/observability-driven-development/SKILL.md) — 4 perguntas
- Agente [`observability-instrumenter`](../agents/observability-instrumenter.md) — gera os patches durante `/executar-fase`

## Aceitação

- [ ] Cada handler do plano tem span com 8 atributos canônicos mínimos
- [ ] Cada `catch` emite `error.type` enum
- [ ] Cada branch significativo emite `branch_taken`
- [ ] Outbound calls propagam contexto via `propagation.inject`
- [ ] Smoke: 100 requests sintéticos → spans queryables com filtragem por `tenant_id`/`user.id`
```

## 4. Plan-checker hook

Se `plan-checker` está ativo no fluxo, este comando atualiza checkpoint do plan-checker:

```bash
# PT-BR: registrar que plano agora tem ODD-spec acoplada
echo "instrumentation:$NN:ready" >> "$PHASE_DIR/.plan-checker-state"
```

## 5. Output

```
═══════════════════════════════════════════════════════════
 framework ► INSTRUMENTAR-FASE ▸ Phase {N}
═══════════════════════════════════════════════════════════

Planos processados: {count}
INSTRUMENTATION.md gerados:
  - {padded}-PLAN-01-INSTRUMENTATION.md
  - {padded}-PLAN-02-INSTRUMENTATION.md
  ...

Próximo passo:
  - `/executar-fase {N}` — executor invocará observability-instrumenter automaticamente para aplicar os spans descritos
  - `/auditar-uat` antes do PR — valida que as 4 perguntas ODD têm resposta executável
```

## 6. Commit

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${PHASE_NUM}): instrumentation plans" --files "${PHASE_DIR}"/*-INSTRUMENTATION.md
```

</process>

<success_criteria>
- [ ] Para cada `PLAN-NN-*.md` da fase, existe `PLAN-NN-INSTRUMENTATION.md`
- [ ] INSTRUMENTATION.md tem 4 seções: Spans, Eventos críticos, Métricas, Validação ODD
- [ ] Validação ODD com 4 perguntas explicitamente respondidas
- [ ] Cross-references para skills `structured-events`, `distributed-tracing`, `opentelemetry-standard`, `observability-driven-development`
- [ ] Não sobrescreve INSTRUMENTATION.md já existente (idempotente)
- [ ] Commit atômico após geração
</success_criteria>
