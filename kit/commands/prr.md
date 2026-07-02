---
name: prr
description: Invoca prr-conductor — Production Readiness Review scored em 6 axes (cap 32); modos --service <name> ou --feature <desc>; offline fallback se MCP ausente.
argument-hint: "(--service <name> | --feature \"<desc>\") [--engagement simple|early|platform] [--reviewer @sre]"
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
Conduzir **Production Readiness Review** (PRR — cap 32 do livro Google SRE) para serviço/feature antes de production. Invoca o agente [`prr-conductor`](../agents/prr-conductor.md) que aplica a skill [`production-readiness-review`](../skills/production-readiness-review/SKILL.md) — checklist canônico **6 axes** + **3 engagement models** + handoff dev→SRE.

**6 axes obrigatórios** (pular um = aprovação inválida):
1. System Architecture — design, dependencies, blast radius, isolation
2. Instrumentation/Metrics/Monitoring — 4 golden signals, SLOs, alerting
3. Emergency Response — runbooks, on-call, rollback, communication
4. Capacity Planning — load testing, scaling, headroom
5. Change Management — canary, feature flags, rollback < 60s
6. Performance — latency budgets, throughput, optimization

**Cria/Atualiza:**
- `.planning/prr/<service>.md` (Modo A) OR `.planning/prr/feature-<slug>.md` (Modo B) — PRR-REPORT.md scored

**Após:** o user tem decisão `Approved` / `Approved with conditions` / `Blocked` + lista canônica de P0 items por axe + reviewer signature. Phase 40 INT-FW-V2-02 integra `/concluir-marco` com gate PRR opcional.
</objective>

<context>
**Argumentos:** `$ARGUMENTS` — comando suporta **2 modos mutuamente exclusivos**.

**Modo A: `--service <name>` (audit de serviço existente)**

Para serviços já em production OU prestes a entrar — agent lê schema (Supabase MCP), Edge Functions code, SLOs definidos (`.planning/slos/`), advisors. Output: `.planning/prr/<service>.md`.

**Modo B: `--feature <description>` (audit pré-launch)**

Para feature em design/dev — agent lê design docs, SLOs propostos, código WIP. Output: `.planning/prr/feature-<slug>.md`.

**Engagement models (cap 32):**
- `simple` — outage cost < $1k/min OR internal tool — 4-8h, 1 sessão
- `early` — outage cost $1k-100k/min OR customer-facing — semanas, SRE no design
- `platform` — outage cost > $100k/min OR built on Frameworks/SRE Platform — PRR é confirmação

**Flags:**
- `--engagement <simple|early|platform>` — engagement model (default: AskUserQuestion baseado em outage cost)
- `--reviewer <@handle>` — handle do reviewer SRE (default: AskUserQuestion — **NUNCA pode ser team dev**, anti-pattern auto-PRR)
- `--outage-cost <usd>` — custo de outage por minuto (default: AskUserQuestion para escolher engagement)
- `--output <path>` — caminho do output (override de default canônico)

**Exemplos:**
```
/prr --service orders-api                                          # Modo A — defaults
/prr --service orders-api --engagement early --reviewer @ops-lead  # Modo A com config
/prr --feature "RAG sobre documentos privados" --reviewer @sre     # Modo B
/prr --service edge-process-emails --engagement simple             # Edge Function simples
```

**Pré-requisito (Full mode):** projeto Supabase configurado, `mcp__supabase__*` disponível. Modo offline funciona com fallback graceful (filesystem only — itens MCP-dependentes ficam `EVIDENCE_PENDING_MCP`).
</context>

<process>

## 1. Parsear argumentos (2 modos)

```bash
SERVICE=$(echo "$ARGUMENTS" | grep -oE -- '--service [^ ]+' | awk '{print $2}')
FEATURE=$(echo "$ARGUMENTS" | grep -oE -- '--feature "[^"]+"' | sed 's/--feature //; s/^"//; s/"$//')
ENGAGEMENT=$(echo "$ARGUMENTS" | grep -oE -- '--engagement [^ ]+' | awk '{print $2}')
REVIEWER=$(echo "$ARGUMENTS" | grep -oE -- '--reviewer [^ ]+' | awk '{print $2}')
OUTAGE_COST=$(echo "$ARGUMENTS" | grep -oE -- '--outage-cost [^ ]+' | awk '{print $2}')
OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

# PT-BR: validar mutuamente exclusivos
if [ -n "$SERVICE" ] && [ -n "$FEATURE" ]; then
  echo "✗ Erro: --service e --feature são mutuamente exclusivos. Escolha um."
  exit 1
fi

# PT-BR: nenhum dos 2 → erro com sugestão
if [ -z "$SERVICE" ] && [ -z "$FEATURE" ]; then
  echo "✗ Forneça --service <name> OU --feature \"<descrição>\""
  echo "  Exemplos:"
  echo "    /prr --service orders-api"
  echo "    /prr --feature \"RAG sobre documentos privados\""
  exit 1
fi
```

## 2. Resolver output_path + idempotência

```bash
if [ -n "$SERVICE" ]; then
  [ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/prr/${SERVICE}.md"
else
  SLUG=$(echo "$FEATURE" | tr ' ' '-' | tr -cd 'a-zA-Z0-9-' | head -c 30 | sed 's/-$//')
  [ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/prr/feature-${SLUG}.md"
fi
mkdir -p "$(dirname "$OUTPUT_PATH")"

# PT-BR: PRR pode ser re-PRR (após mudança grande) — informar mas permitir
if [ -f "$OUTPUT_PATH" ]; then
  LAST_DATE=$(grep -m1 '**Date:**' "$OUTPUT_PATH" 2>/dev/null | sed 's/.*Date:\*\* //' || echo "?")
  echo "ℹ PRR-REPORT.md anterior detectado ($LAST_DATE) em $OUTPUT_PATH."
  echo "  Re-PRR válido (após mudança grande, incident, ou anual). Continuando — vai sobrescrever."
fi
```

## 3. Detectar `supabase/config.toml` (Full mode)

```bash
PROJECT_ID=""
if [ -f supabase/config.toml ]; then
  PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
  echo "✓ project_id detectado: $PROJECT_ID (Full mode com MCP Supabase)"
else
  echo "ℹ Sem supabase/config.toml — agent pode rodar em modo offline (fallback graceful)"
fi
```

## 4. AskUserQuestion — engagement model + reviewer

Se `--engagement` não fornecido E `--outage-cost` ausente:

> **AskUserQuestion**
> header: "PRR Engagement Model"
> question: "Qual custo estimado de outage para este target?"
> options:
> - "< $1k/min OR internal tool → Simple PRR (4-8h, 1 sessão)"
> - "$1k-100k/min OR customer-facing → Early Engagement (semanas, SRE no design)"
> - "> $100k/min OR built on platform → Frameworks/Platform (PRR é confirmação)"

Se `--reviewer` não fornecido (anti-pattern auto-PRR):

> **AskUserQuestion**
> header: "PRR Reviewer (anti auto-PRR)"
> question: "Quem é o reviewer? Reviewer DEVE ser SRE OU par externo ao time dev (anti-pattern: time dev faz auto-PRR — confirmation bias)."
> options: (texto livre — handle/email)

## 5. Dispatch para `prr-conductor`

```text
Task(
  subagent_type="prr-conductor",
  prompt="
${SERVICE:+service_name: ${SERVICE}}
${FEATURE:+feature_description: ${FEATURE}}
output_path: ${OUTPUT_PATH}
${ENGAGEMENT:+engagement_model: ${ENGAGEMENT}}
${REVIEWER:+reviewer: ${REVIEWER}}
${OUTAGE_COST:+outage_cost_per_min: ${OUTAGE_COST}}
${PROJECT_ID:+project_id: ${PROJECT_ID}}

Aplicar skill production-readiness-review. Audit em 6 axes (todos obrigatórios — pular = inválido):
1. System Architecture — design, dependencies, blast radius, isolation, single points of failure
2. Instrumentation/Metrics/Monitoring — 4 golden signals, SLOs definidos, alerting com burn rates
3. Emergency Response — runbooks atualizados, on-call rotation, rollback < 60s, communication plan
4. Capacity Planning — load testing recente, scaling docs, headroom % atual vs peak
5. Change Management — canary deployment, feature flags, rollback drills
6. Performance — latency p50/p95/p99 vs budget, throughput vs target, optimization headroom

Padrão obrigatório: cada item evidence-based (NÃO 'acreditamos que está pronto' — exigir query/log/runbook/test).
Modo offline: se MCP ausente, declarar [MODO OFFLINE] e marcar items MCP-dependentes EVIDENCE_PENDING_MCP.
Output: PRR-REPORT.md com scoring 0-5 por axe + status Pass/Pass with gaps/Fail + decisão Approved/Approved with conditions/Blocked + reviewer signature + Re-PRR triggers.
"
)
```

## 6. Pós-output

```
═══════════════════════════════════════════════════════════
 framework ► PRR ▸ ${SERVICE:-feature-${SLUG}}
═══════════════════════════════════════════════════════════

[output do prr-conductor — ver Step 3 do agent]

## Estado salvo
${OUTPUT_PATH}

## Próximos passos
1. Reviewer (`${REVIEWER}`) precisa assinar — anti-pattern: rubber stamp sem ler evidence
2. P0 items são bloqueadores; P1 items são conditions; P2 items são monitoramento
3. Re-PRR triggers (anual, mudança arquitetural grande, incident SEV1+) — agendar
4. Se status `Approved` → liberar para production; se `Blocked` → fechar P0s antes de re-submit
5. Cross-ref OMM: PRR alimenta Capacidade 4 (Production Readiness) — `/observabilidade omm`
6. Phase 40 INT-FW-V2-02: `/concluir-marco` pode exigir PRR `Approved` se `workflow.complete_milestone_prr_gate=true`
```

</process>

<success_criteria>
- [ ] `--service <name>` E `--feature "<desc>"` parseados (mutuamente exclusivos)
- [ ] Modo A: output canônico `.planning/prr/<service>.md` (override via `--output`)
- [ ] Modo B: output canônico `.planning/prr/feature-<slug>.md` (slug auto-gerado)
- [ ] Re-PRR não-bloqueante (informa mas permite — re-PRR é válido após mudança grande)
- [ ] `supabase/config.toml` detectado para passar `project_id` (Full mode)
- [ ] AskUserQuestion para engagement model (se ausente) E reviewer (se ausente — anti auto-PRR)
- [ ] `prr-conductor` invocado via `Task(subagent_type=...)` com prompt completo (6 axes literalmente + modo offline)
- [ ] Output forwarded transparentemente do agent
- [ ] Próximos passos sugerem cross-ref para `/observabilidade omm`, `/concluir-marco`, P0/P1/P2 priorização
</success_criteria>
