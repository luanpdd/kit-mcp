---
phase: 38
plan: 04
title: Comando /prr — wrapper que dispatch para prr-conductor (2 modos --service|--feature)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/prr.md
requirements: [CMD-SRE-04]
status: ready
---

# Plan 04 — Comando `kit/commands/prr.md`

## Goal

Criar `kit/commands/prr.md` — comando wrapper que invoca `prr-conductor` (Phase 37 Plan 04) via `Task(subagent_type=...)`. Suporta **2 modos**: `--service <name>` (audit de serviço existente) ou `--feature <description>` (audit de feature pré-launch). Gera `PRR-REPORT.md` scored em 6 axes (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance) em `.planning/prr/<service>.md`. Modelo de wrapper segue precedente direto `kit/commands/definir-slo.md` (v1.9 — flag obrigatório + AskUserQuestion). Cobre **CMD-SRE-04**.

## Files to create

- `D:/projetos/opensource/mcp/kit/commands/prr.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: prr` + `description ≤ 200 chars` (anti-pitfall A2)
- **`allowed-tools` inclui `Task` + `AskUserQuestion`** — wrapper invoca agent + pergunta engagement model + reviewer
- **Cross-ref Markdown** ativo para `prr-conductor` + skill `production-readiness-review`
- **2 modos mutuamente exclusivos** — `--service <name>` E `--feature <description>` ambos passados = ERROR; nenhum dos 2 = AskUserQuestion
- **Output canônico** em `.planning/prr/<service>.md` ou `.planning/prr/feature-<slug>.md`
- **Detectar `supabase/config.toml`** para passar `project_id` ao agent (modo Full com MCP)
- **Anti auto-PRR** — caller deve perguntar reviewer ≠ team dev (anti-pattern do agent)

## Tasks

<task id="38-04-T1" name="Frontmatter + objective + context com 2 modos + 6 axes">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/prr.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/commands/definir-slo.md (linhas 1-33 — frontmatter + objective + context com flag obrigatório)
    - D:/projetos/opensource/mcp/kit/agents/prr-conductor.md (linhas 28-50 — Modos A/B + Inputs gerais)
  </read_first>
  <action>
    Escrever frontmatter + `<objective>` + `<context>` com **2 modos** + **6 axes** documentados:

    ```markdown
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
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/commands/prr.md` existe
    - Frontmatter válido com `name: prr` + `description ≤ 200 chars` + `allowed-tools` inclui `Task` + `AskUserQuestion`
    - `<objective>` contém cross-ref Markdown literal `[prr-conductor](../agents/prr-conductor.md)` E `[production-readiness-review](../skills/production-readiness-review/SKILL.md)`
    - `<objective>` lista os **6 axes** numerados (1-6) com nomes canônicos: System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance
    - `<context>` documenta **2 modos** (`Modo A: --service` E `Modo B: --feature`) com headers claros
    - `<context>` documenta **3 engagement models** (simple/early/platform) com critério de outage cost
    - `<context>` lista flag `--reviewer` com nota explícita "NUNCA pode ser team dev" (anti-pattern auto-PRR)
    - `<context>` menciona modo offline fallback E `EVIDENCE_PENDING_MCP`
    - 4 exemplos de uso (2 Modo A + 1 Modo B + 1 Edge Function)
  </acceptance_criteria>
</task>

<task id="38-04-T2" name="Process — parsear modos, detectar MCP, AskUserQuestion engagement+reviewer, dispatch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/definir-slo.md (linhas 33-97 — Steps 1-4 padrão de parse + supabase/config.toml + dispatch)
    - D:/projetos/opensource/mcp/kit/agents/prr-conductor.md (linhas 53-80 — Step 0 Preflight + roteamento, conhecer pré-validações)
  </read_first>
  <action>
    Adicionar `<process>` com 6 steps:

    ```markdown
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
    ```
  </action>
  <acceptance_criteria>
    - Bloco `<process>` contém exatamente 6 steps numerados
    - Step 1 valida **mutuamente exclusivos** (`--service` E `--feature` simultâneos = ERROR; nenhum = ERROR com sugestão)
    - Step 2 resolve output_path por modo (Modo A = `<service>.md`, Modo B = `feature-<slug>.md`) E permite re-PRR sem bloquear
    - Step 3 detecta `supabase/config.toml` para passar `project_id` (Full mode)
    - Step 4 contém 2 AskUserQuestion documentadas: engagement (3 opções com critério outage cost) + reviewer (com explícito "anti auto-PRR")
    - Step 5 contém literal `Task(` + `subagent_type="prr-conductor"` + 6 axes literalmente nominados (1-6) no prompt
    - Step 5 prompt menciona "evidence-based" + modo offline com `EVIDENCE_PENDING_MCP`
    - Step 6 sugere cross-refs para `/observabilidade omm`, `/concluir-marco`, P0/P1/P2 priorização
  </acceptance_criteria>
</task>

<task id="38-04-T3" name="Success criteria + smoke">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/definir-slo.md (linhas 101-108 — bloco success_criteria padrão)
  </read_first>
  <action>
    Adicionar `<success_criteria>` final + smoke validation inline:

    ```markdown
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
    ```

    Validar via shell:

    ```bash
    # Verificar tamanho da description
    grep -m1 "^description:" kit/commands/prr.md | sed 's/^description: //' | wc -c

    # Verificar âncoras canônicas
    grep -c "^<objective>$" kit/commands/prr.md           # esperado: 1
    grep -c "^<context>$" kit/commands/prr.md             # esperado: 1
    grep -c "^<process>$" kit/commands/prr.md             # esperado: 1
    grep -c "^<success_criteria>$" kit/commands/prr.md    # esperado: 1

    # Verificar literal Task dispatch + 2 modos
    grep -c 'subagent_type="prr-conductor"' kit/commands/prr.md  # esperado: ≥1
    grep -c -- "--service " kit/commands/prr.md                  # esperado: ≥3
    grep -c -- "--feature " kit/commands/prr.md                  # esperado: ≥3

    # Verificar 6 axes literalmente nominados
    grep -c "System Architecture" kit/commands/prr.md             # esperado: ≥2
    grep -c "Instrumentation" kit/commands/prr.md                 # esperado: ≥2
    grep -c "Emergency Response" kit/commands/prr.md              # esperado: ≥2
    grep -c "Capacity Planning" kit/commands/prr.md               # esperado: ≥2
    grep -c "Change Management" kit/commands/prr.md               # esperado: ≥2
    grep -c "Performance" kit/commands/prr.md                     # esperado: ≥2

    # Verificar 3 engagement models
    grep -ic "simple\|early\|platform" kit/commands/prr.md        # esperado: ≥6

    # Verificar anti-pattern auto-PRR mencionado explicitamente
    grep -ic "auto-PRR\|auto-prr\|reviewer.*team dev\|anti-pattern" kit/commands/prr.md  # esperado: ≥2

    # Verificar modo offline + EVIDENCE_PENDING_MCP
    grep -c "MODO OFFLINE\|offline\|EVIDENCE_PENDING_MCP" kit/commands/prr.md  # esperado: ≥3

    # Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/commands/prr.md" ] && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `<success_criteria>` contém 9 bullets (1 por critério crítico)
    - `description` ≤ 200 chars
    - 4 âncoras canônicas (`<objective>`, `<context>`, `<process>`, `<success_criteria>`) cada count == 1
    - `subagent_type="prr-conductor"` aparece pelo menos 1×
    - `--service` aparece ≥ 3× E `--feature` aparece ≥ 3×
    - Cada um dos 6 axes nominados aparece ≥ 2× no documento (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance)
    - 3 engagement models (`simple|early|platform`) aparecem ≥ 6× combinado (cada um pelo menos 2×)
    - Anti-pattern auto-PRR mencionado ≥ 2× (literal "auto-PRR" ou "reviewer team dev")
    - Modo offline + EVIDENCE_PENDING_MCP mencionados ≥ 3× combinado
    - Após `kit sync claude-code`, arquivo `.claude/commands/prr.md` existe
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/commands/prr.md` existe
- [ ] Frontmatter válido (`name: prr`, `description ≤ 200 chars`, `allowed-tools` inclui `Task` + `AskUserQuestion`)
- [ ] 4 âncoras canônicas: `<objective>`, `<context>`, `<process>`, `<success_criteria>`
- [ ] Cross-refs Markdown ativos para `prr-conductor` + skill `production-readiness-review`
- [ ] **2 modos** (`--service` + `--feature`) documentados como mutuamente exclusivos
- [ ] **6 axes** literalmente nominados em `<objective>` + Step 5 prompt
- [ ] **3 engagement models** (simple/early/platform) com critério de outage cost
- [ ] Process tem 6 steps (parse, resolve output, detectar config, AskUserQuestion, dispatch, output)
- [ ] Step 4 documenta 2 AskUserQuestion explícitos: engagement + reviewer (anti auto-PRR)
- [ ] Step 5 prompt enumera 6 axes literalmente + evidence-based + offline fallback
- [ ] Step 6 sugere cross-refs para `/observabilidade omm`, `/concluir-marco` (Phase 40)
- [ ] Smoke `kit sync claude-code` instala em `.claude/commands/prr.md`
- [ ] Cobre CMD-SRE-04 integralmente

## Must-haves (goal-backward)

1. Comando file existe com frontmatter válido + Task + AskUserQuestion habilitados
2. `description ≤ 200 chars` (anti-pitfall A2)
3. **2 modos** (`--service` + `--feature`) mutuamente exclusivos com validação clara
4. **6 axes obrigatórios** literalmente nominados (cap 32) — pular um = aprovação inválida
5. **3 engagement models** (simple/early/platform) com critério de outage cost documentado
6. Anti-pattern auto-PRR explícito — AskUserQuestion para reviewer com nota "NUNCA team dev"
7. Detectar `supabase/config.toml` para Full mode com MCP; offline fallback graceful
8. Re-PRR não-bloqueante (válido após mudança arquitetural grande, incident, anual)
9. Cross-refs ativos para Phase 40 (`/concluir-marco` gate PRR opcional via INT-FW-V2-02)

## Notes

- **Wrapper puro** — comando NÃO duplica scoring/checklist do agent; minimiza superfície de manutenção
- Tamanho esperado: ~9-11 KB (denso pelos 2 modos + 6 axes + 3 engagement models + 2 AskUserQuestion + offline mode)
- Phase 40 INT-FW-V2-02 vai integrar este comando ao `/concluir-marco` quando `workflow.complete_milestone_prr_gate=true` — exige PRR `Approved` para features production-bound antes de arquivar milestone
- Anti-pattern explícito: caller previne auto-PRR via AskUserQuestion. Time dev fazendo PRR do próprio service é confirmation bias documentado no livro.
- PRR é **forward-looking** — não substitui postmortem (retrospective). PRR pré-launch + postmortem post-incident são complementares.
