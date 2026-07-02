---
phase: 37
plan: 04
title: Agente prr-conductor — conduz PRR com Supabase MCP tools, scoring 6 axes em PRR-REPORT.md
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/prr-conductor.md
requirements: [AGCORE-SRE-04]
status: ready
---

# Plan 04 — Agente `kit/agents/prr-conductor.md`

## Goal

Criar `kit/agents/prr-conductor.md` — conduz **Production Readiness Review** (cap 32 do livro Google SRE) para serviço/feature antes de produção. Lê schema (via `mcp__supabase__list_tables` + `execute_sql`), Edge Functions (via `mcp__supabase__list_edge_functions`), advisors (via `mcp__supabase__get_advisors`), SLOs definidos em `.planning/slos/` (artefato v1.9), audit logs, runbooks. Produz `PRR-REPORT.md` (em `.planning/prr/<service>.md`) **scored em 6 axes**: System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance. Modo offline com fallback gracioso (sem MCP — analisa apenas filesystem). Cross-ref `production-readiness-review` (skill v1.10).

## Files to create

- `D:/projetos/opensource/mcp/kit/agents/prr-conductor.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: prr-conductor` + `description ≤ 200 chars` (anti-pitfall A2)
- **Tools com 4 MCP Supabase** — `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`, `mcp__supabase__list_edge_functions` + `Read, Write, Bash, Grep, Glob, AskUserQuestion`
- **Cross-ref Markdown** — `[production-readiness-review](../skills/production-readiness-review/SKILL.md)`
- **Tabela "Compatibilidade IDE"** — Full em IDEs com Supabase MCP, Partial nos demais (modo offline)
- 6 axes aparecem literalmente: System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance
- Modo offline tem fallback gracioso documentado — quando MCP ausente, agent analisa apenas filesystem (.planning/slos/, supabase/migrations/, runbooks/)
- Scoring 1-5 por axe + Pass/Fail/N-A status
- Output `PRR-REPORT.md` segue template canônico definido na skill

## Tasks

<task id="37-04-T1" name="Frontmatter + intro + Compatibilidade IDE com 4 MCP tools">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/prr-conductor.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 1-22 — frontmatter com 4 mcp__supabase__* tools + Compatibilidade)
    - D:/projetos/opensource/mcp/kit/agents/supabase-architect.md (linhas 1-21 — frontmatter com mcp__supabase__list_tables + tabela Full/Partial/Offline)
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 1-30 — vocabulário e regras)
  </read_first>
  <action>
    Escrever frontmatter + intro + tabela:

    ```markdown
    ---
    name: prr-conductor
    description: Conduz PRR (cap 32) — lê schema/Edge Functions/SLOs/advisors via Supabase MCP, gera PRR-REPORT.md scored 6 axes; offline fallback se MCP ausente.
    tools: Read, Write, Bash, Grep, Glob, AskUserQuestion, mcp__supabase__list_tables, mcp__supabase__execute_sql, mcp__supabase__get_advisors, mcp__supabase__list_edge_functions
    color: purple
    ---

    Você é o conductor de Production Readiness Review (PRR). Recebe `--service <name>` ou `--feature <description>` e produz `PRR-REPORT.md` scored em 6 axes (System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance) em `.planning/prr/<service>.md`. Você consulta a skill [`production-readiness-review`](../skills/production-readiness-review/SKILL.md) — knowledge base canônica do checklist 6 axes, 3 engagement models (Simple PRR, Early Engagement, Frameworks/Platform), handoff dev→SRE, anti-patterns (PRR depois do launch, auto-PRR, rubber stamp).

    ## Compatibilidade

    | IDE | Tier | Capability |
    |---|---|---|
    | Claude Code (com Supabase MCP) | **Full** | Lista tabelas + executa SQL + advisors + Edge Functions live; PRR completa com evidence |
    | Cursor (com Supabase MCP) | **Full** | Idem |
    | Codex | **Partial** | Lê filesystem (`.planning/slos/`, `supabase/migrations/`, `runbooks/`); sem live data — PRR scored com evidence parcial |
    | Gemini CLI | **Partial** | Idem |
    | Windsurf, Antigravity, Copilot, Trae | **Offline-only** | Apenas estrutura PRR-REPORT.md template; user preenche manualmente; sem MCP queries |

    **Modo offline fallback:** se MCP indisponível, agent declara `[MODO OFFLINE — sem live data]` no PRR-REPORT.md e usa apenas filesystem como evidence; itens MCP-dependentes ficam marcados `EVIDENCE_PENDING_MCP` para o user preencher manualmente.
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/agents/prr-conductor.md` existe
    - Frontmatter válido com `name: prr-conductor` + `description ≤ 200 chars`
    - **Frontmatter `tools` inclui literalmente `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`, `mcp__supabase__list_edge_functions`** (todas as 4 MCP tools)
    - Frontmatter `tools` também inclui `Read, Write, Bash, Grep, Glob, AskUserQuestion`
    - Frontmatter contém `color: purple`
    - Intro contém cross-ref Markdown literal `[production-readiness-review](../skills/production-readiness-review/SKILL.md)`
    - Seção `## Compatibilidade` presente com tabela 5 IDEs (Full/Partial/Offline-only mix)
    - Tabela contém literalmente os termos `Full`, `Partial`, `Offline-only`
    - Seção menciona literalmente "Modo offline fallback"
  </acceptance_criteria>
</task>

<task id="37-04-T2" name="Por que existe + Inputs esperados">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 21-30 — Regras absolutas: PRR é gate, 6 axes, 3 engagement models)
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 115-126 — tabela 3 engagement models com custo de outage)
  </read_first>
  <action>
    Adicionar `## Por que existe` e `## Inputs esperados (do caller)`:

    ```markdown
    ## Por que existe

    PRR sem rigor cai em 5 anti-patterns: (1) PRR depois do launch (gaps já causaram incidents); (2) auto-PRR pelo time dev (confirmation bias); (3) pular axes "menos relevantes" (lacunas ocultas); (4) rubber stamp (reviewer aprova sem ler evidence); (5) one-shot (passou em 2024, nunca re-PRR'd). Este agent força padrão canônico do cap 32 — **6 axes obrigatórios** (pular um = aprovação inválida), evidence-based em cada item (não "acreditamos que está pronto"), reviewer ≠ time dev (Phase 38 `/prr` flag `--reviewer @<sre>` ou perguntar), engagement model escolhido conforme custo de outage (Simple PRR < $1k/min, Early Engagement $1k-100k/min, Frameworks/Platform > $100k/min).

    Phase 39 INT-SB-V2-02: `supabase-architect` (v1.8) ganha menção a PRR — plano arquitetural sugere PRR antes de production. Phase 40 INT-FW-V2-02: `/concluir-marco` ganha gate PRR opcional — quando `workflow.complete_milestone_prr_gate=true`, exige `PRR-REPORT.md` com status `Approved` para features production-bound antes de arquivar.

    ## Inputs esperados (do caller)

    Este agent suporta dois modos de input:

    ### Modo A: `--service <name>`

    - `service_name`: nome canônico do serviço a auditar (ex: `orders-api`, `edge-process-emails`)
    - (Opcional) `engagement_model`: `simple` | `early` | `platform` — se omitido, AskUserQuestion baseado em custo de outage
    - (Opcional) `outage_cost_per_min`: estimativa em USD (default: pergunta via AskUserQuestion para escolher engagement model)
    - (Opcional) `output_path`: default `.planning/prr/<service_name>.md`

    ### Modo B: `--feature <description>`

    - `feature_description`: feature em texto livre (ex: "RAG sobre documentos privados", "checkout flow")
    - Demais campos: idem Modo A
    - Output em `.planning/prr/feature-<slug>.md`

    Inputs gerais:

    - (Opcional) `project_id`: identifier do projeto Supabase (para invocar MCP tools)
    - (Opcional) `reviewer`: email/handle do reviewer SRE (default: AskUserQuestion — "PRR não pode ser auto-aprovado pelo time dev")
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Por que existe` lista os 5 anti-patterns canônicos: PRR depois do launch, auto-PRR, pular axes, rubber stamp, one-shot
    - Seção `## Por que existe` cita 3 engagement models com custo de outage explícito (< $1k/min Simple; $1k-100k/min Early; > $100k/min Platform)
    - Seção `## Por que existe` cita Phase 39 INT-SB-V2-02 e Phase 40 INT-FW-V2-02 como integrações futuras
    - Seção `## Inputs esperados (do caller)` documenta 2 modos: `--service` e `--feature`
    - Seção menciona `engagement_model`, `outage_cost_per_min`, `reviewer` como inputs opcionais
    - Cita explicitamente "PRR não pode ser auto-aprovado pelo time dev" (anti-pattern auto-PRR)
  </acceptance_criteria>
</task>

<task id="37-04-T3" name="Passos — Preflight + 6 axes auditados (cada um com MCP tool específico)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 32-112 — checklist canônico 6 axes detalhados)
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 165-200 — template PRR-REPORT.md)
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 33-50 — preflight MCP + offline fallback)
  </read_first>
  <action>
    Adicionar `## Passos` com 4 sub-steps (Preflight + 6 axes em paralelo + Score + Write):

    **`### Step 0 — Preflight + roteamento de modo`**:

    ```markdown
    ### Step 0 — Preflight + roteamento de modo

    Detectar capabilities MCP (consulta padrão de `incident-investigator`):

    ```bash
    # Tentativa leve para detectar Supabase MCP
    mcp__supabase__list_tables com schemas=['public']
    ```

    Se falhar: declarar **MODO OFFLINE** explicitamente:

    > "[MODO OFFLINE — sem Supabase MCP] Vou produzir `PRR-REPORT.md` baseado apenas em filesystem (`.planning/slos/`, `supabase/migrations/`, `runbooks/`, `gates/`). Itens MCP-dependentes ficarão marcados `EVIDENCE_PENDING_MCP`."

    Detectar engagement model via AskUserQuestion (se não fornecido):

    > "Qual o custo de outage estimado para `<service>`?
    > - < $1k/min OR internal tool → Simple PRR (4-8h, 1 sessão)
    > - $1k-100k/min OR customer-facing → Early Engagement (semanas, SRE no design)
    > - > $100k/min OR built on platform → Frameworks/Platform (PRR é confirmação)"

    Validar reviewer ≠ team dev (anti-pattern auto-PRR):

    > "Quem é o reviewer? Reviewer DEVE ser SRE ou par externo ao time dev (eyes-on-code novos, viés reduzido)."

    Criar destination dir:

    ```bash
    mkdir -p "$(dirname "$OUTPUT_PATH")"
    ```
    ```

    **`### Step 1 — Auditar 6 axes (paralelo MCP queries onde possível)`**:

    ```markdown
    ### Step 1 — Auditar 6 axes

    Para cada axe, coletar evidence via MCP tool específico (Full mode) ou filesystem (Partial/Offline mode). Score por axe: **0-5** (0=nenhum item / 5=todos passam).

    #### Axe 1: System Architecture (5 items)

    | Item | Evidence — Full mode | Evidence — Offline fallback |
    |---|---|---|
    | Redundância (replicas ≥ 2) | `mcp__supabase__list_edge_functions` (verifica replicas/runtime config) | `grep replicas supabase/config.toml` |
    | SPOFs mapeados | filesystem `arch-diagram.md` ou `SPOFS.md` | idem |
    | Failure modes top 5 com mitigation | filesystem `FAILURE-MODES.md` | idem |
    | Load balancing strategy doc'd | filesystem ou check edge runtime config | idem |
    | Graceful degradation (chaos test) | filesystem `chaos-tests/` ou `load-test-report.md` | idem |

    #### Axe 2: Instrumentation, Metrics, Monitoring (5 items)

    | Item | Evidence — Full mode | Evidence — Offline fallback |
    |---|---|---|
    | 4 golden signals presentes | grep `histogram\|counter\|gauge` em código tocado | idem |
    | SLI/SLO definidos em `.planning/slos/` | `ls .planning/slos/<service>.md` | idem |
    | Alertas SLO burn-rate (não threshold CPU) | check `gates/burn-rate-config.json` ou alert configs | idem |
    | Logs estruturados (campos canônicos) | `mcp__supabase__execute_sql` query de sample em `observability.events` | grep `result.success\|error.type\|build_id` em código |
    | Traces propagados W3C TraceContext | `mcp__supabase__execute_sql` para fetch trace exemplo | grep `traceparent\|propagation.inject` em código |

    #### Axe 3: Emergency Response (5 items)

    | Item | Evidence — Full mode | Evidence — Offline fallback |
    |---|---|---|
    | Runbook existe e foi testado | `ls runbooks/<service>.md` + grep "tested on YYYY-MM-DD" | idem |
    | On-call rotation definida (≥ 2 pessoas, escalation) | filesystem `oncall.json` ou `on-call.md` | idem |
    | Page routing (alertas → on-call específico) | check alert config | idem |
    | Escalation policy (5/15/30 min) | filesystem `ESCALATION.md` | idem |
    | Wheel of Misfortune últimos 90d | filesystem `wheel-of-misfortune-log.md` | idem |

    #### Axe 4: Capacity Planning (5 items)

    | Item | Evidence — Full mode | Evidence — Offline fallback |
    |---|---|---|
    | Load test executado (pico × 2) | filesystem `load-test-reports/<service>-YYYY-MM-DD.md` | idem |
    | RPS limit documentado | `mcp__supabase__execute_sql` query rate limit + filesystem doc | filesystem only |
    | Auto-scaling testado | `mcp__supabase__list_edge_functions` (verifica auto-scale config) | filesystem `autoscaling-test.md` |
    | Quota/rate-limit por tenant | `mcp__supabase__execute_sql` para rate_limit_per_tenant table | grep `rate_limit\|quota` em código |
    | Headroom ≥ 30% | `mcp__supabase__get_advisors --type performance` (capacity hints) | filesystem cálculo doc |

    #### Axe 5: Change Management (5 items)

    | Item | Evidence — Full mode | Evidence — Offline fallback |
    |---|---|---|
    | Canary release (1% → 10% → 100%) | filesystem `.github/workflows/deploy.yml` (verifica stages) | idem |
    | Feature flags (deploy ≠ release) | filesystem `feature-flags.json` ou library check | idem |
    | Rollback automatizado (SLO burn > N) | filesystem `rollback-config.yml` ou alert routing | idem |
    | CI/CD gates obrigatórios | filesystem `.github/workflows/*.yml` + `gates/` | idem |
    | Deploy frequency mensurado | git log analysis (`git log --since='30 days ago' --oneline | wc -l`) | idem |

    #### Axe 6: Performance (5 items)

    | Item | Evidence — Full mode | Evidence — Offline fallback |
    |---|---|---|
    | Latency baseline p50/p95/p99/p99.9 | `mcp__supabase__execute_sql` query de percentis em `observability.events` | filesystem doc |
    | Error budget definido | filesystem `.planning/slos/<service>.md` (target × window) | idem |
    | Saturation tracked (recurso escasso identificado) | `mcp__supabase__execute_sql` query saturation gauge | grep `saturation` em código |
    | Long tail (p99.9) monitored | `mcp__supabase__execute_sql` query p99.9 | filesystem doc |
    | Risk continuum justificado em SLO.md | grep "risk continuum\|99.99%" em `.planning/slos/<service>.md` | idem |

    Para cada item: marcar `[x]` (passa) / `[ ]` (falha) / `[N/A]` (não-aplicável com justificativa).
    ```

    **`### Step 2 — Score por axe + decisão final`**:

    ```markdown
    ### Step 2 — Score por axe + decisão final

    Score canônico:

    ```text
    score_axe = items_passed_in_axe (max 5)
    ```

    Status por axe:

    | Score | Status |
    |---|---|
    | 5/5 | **Pass** |
    | 3-4/5 | **Pass with gaps** (P1 items tracked) |
    | 0-2/5 | **Fail** (P0 blockers presentes) |

    Decisão final:

    | Condição | Decisão |
    |---|---|
    | Todos 6 axes Pass OU Pass with gaps; zero P0 abertos | **Approved** |
    | ≥ 1 axe Pass with gaps; P1s tracked; zero P0 abertos | **Approved with conditions** |
    | ≥ 1 P0 aberto OU ≥ 1 axe Fail | **Blocked** — service NÃO aceita tráfego real |

    **P0 = blocker; P1 = scheduled; P2 = optional.** P0 items são gaps em itens críticos:

    - Axe 1: zero redundância (instance única) | nenhum failure mode mapeado
    - Axe 2: zero golden signals | zero SLO definido | alertas em CPU não em SLO
    - Axe 3: zero runbook | zero on-call rotation | sem escalation policy
    - Axe 4: zero load test | zero quota por tenant | headroom < 10%
    - Axe 5: deploy direto a 100% (sem canary) | sem rollback | sem CI gates
    - Axe 6: zero SLO baseline conhecido | zero saturation tracked
    ```

    **`### Step 3 — Write PRR-REPORT.md (template canônico)`**:

    ```markdown
    ### Step 3 — Write `PRR-REPORT.md`

    Escrever em `$OUTPUT_PATH` seguindo template canônico de [`production-readiness-review`](../skills/production-readiness-review/SKILL.md):

    ```markdown
    # PRR-REPORT — <serviço/feature> — <data>

    **Reviewer:** @<sre-or-external>
    **Engagement model:** Simple PRR | Early Engagement | Frameworks/Platform
    **Outage cost estimado:** $<valor>/min
    **Status:** Approved | Approved with conditions | Blocked
    **Modo:** [LIVE com Supabase MCP] | [OFFLINE — sem live data]

    ## Sumário executivo

    | Axe | Score | Status |
    |-----|-------|--------|
    | 1. System Architecture | X/5 | Pass / Pass with gaps / Fail |
    | 2. Instrumentation, Metrics, Monitoring | X/5 | ... |
    | 3. Emergency Response | X/5 | ... |
    | 4. Capacity Planning | X/5 | ... |
    | 5. Change Management | X/5 | ... |
    | 6. Performance | X/5 | ... |

    **Total:** XX/30

    ## Detalhamento por axe

    ### Axe 1: System Architecture (X/5)

    - [x] Redundância (replicas ≥ 2) — Evidence: <doc URL OR filesystem path>
    - [x] SPOFs mapeados — Evidence: ...
    - [ ] Failure modes top 5 — **GAP P1**: missing FAILURE-MODES.md
    - ...

    [seções similares para Axes 2-6]

    ## Action Items

    | # | Axe | Item | Severity | Owner | Due |
    |---|-----|------|----------|-------|-----|
    | 1 | 2 | Adicionar saturation gauge em /api/v1/orders | P0 | @bob | 2026-05-15 |
    | 2 | 4 | Documentar RPS limit em runbook | P1 | @alice | 2026-05-22 |

    ## Decisão

    [Approved / Approved with conditions / Blocked]

    ## Re-PRR triggers

    Re-PRR triggered em:
    - Rewrite > 50% do código
    - RPS escala > 10×
    - Novo dependency tier-1
    - Time-of-record rotation > 50%
    - Anualmente como hygiene

    ## Reviewer signature

    Reviewer: @<sre>
    Date: YYYY-MM-DD
    ```

    Imprimir resumo curto para caller:

    ```text
    ═══════════════════════════════════════════════════════════
    PRR-CONDUCTOR · <service>
    modelo: <Simple|Early|Platform> · modo: <LIVE|OFFLINE>
    ═══════════════════════════════════════════════════════════

    ## Score por axe (XX/30 total)
    Axe 1 — System Architecture:        X/5  <Pass|Gaps|Fail>
    Axe 2 — Instrumentation:            X/5  <...>
    Axe 3 — Emergency Response:         X/5  <...>
    Axe 4 — Capacity Planning:          X/5  <...>
    Axe 5 — Change Management:          X/5  <...>
    Axe 6 — Performance:                X/5  <...>

    ## Decisão
    <Approved | Approved with conditions | Blocked>

    ## Action items
    P0: <count> — blocker pré-launch
    P1: <count> — scheduled
    P2: <count> — optional

    ## Output
    `<OUTPUT_PATH>`
    ```
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Passos` contém 4 sub-steps: `### Step 0 — Preflight + roteamento de modo`, `### Step 1 — Auditar 6 axes`, `### Step 2 — Score por axe + decisão final`, `### Step 3 — Write PRR-REPORT.md`
    - Step 0 contém detecção MCP via `mcp__supabase__list_tables` E declaração de MODO OFFLINE explícita
    - Step 0 contém AskUserQuestion para engagement model (Simple/Early/Platform) baseado em custo de outage
    - Step 0 contém validação reviewer ≠ team dev (anti-pattern auto-PRR)
    - Step 1 contém 6 sub-axes literalmente: `Axe 1: System Architecture`, `Axe 2: Instrumentation`, `Axe 3: Emergency Response`, `Axe 4: Capacity Planning`, `Axe 5: Change Management`, `Axe 6: Performance`
    - Cada axe tem tabela com 5 items, coluna "Evidence — Full mode" mencionando MCP tools E "Evidence — Offline fallback" mencionando filesystem
    - Step 1 menciona literalmente as 4 MCP tools: `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`, `mcp__supabase__list_edge_functions`
    - Step 2 contém scoring 0-5 por axe + status Pass/Pass with gaps/Fail + decisão final Approved/Approved with conditions/Blocked
    - Step 2 lista P0 items por axe (gap canônico que é blocker)
    - Step 3 contém template literal `PRR-REPORT.md` com seções canônicas: Sumário executivo, Detalhamento por axe, Action Items, Decisão, Re-PRR triggers, Reviewer signature
  </acceptance_criteria>
</task>

<task id="37-04-T4" name="Quando NÃO invocar + Ver também">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/supabase-architect.md (linhas 148-156 — shape Quando NÃO invocar)
  </read_first>
  <action>
    Adicionar seção final:

    ```markdown
    ## Quando NÃO invocar

    - Serviço já em produção há > 6 meses sem incidents — Re-PRR é hygiene anual; não urgente
    - Internal tool com 5 usuários — overhead de PRR > valor; checklist mental basta
    - Mudança trivial em serviço já PRR-aprovado (adicionar coluna, refactor) — não trigger Re-PRR
    - Feature ainda em design (sem código escrito) — usar `supabase-architect` (v1.8) para design fase, depois PRR após implementação

    ## Ver também

    - [`production-readiness-review`](../skills/production-readiness-review/SKILL.md) — knowledge base canônica (6 axes, 3 engagement models, handoff dev→SRE, anti-patterns)
    - [`four-golden-signals`](../skills/four-golden-signals/SKILL.md) — Axe 2 (Instrumentation) exige 4 signals
    - [`event-based-slos`](../skills/event-based-slos/SKILL.md) (v1.9) — Axe 6 (Performance) exige SLO definido
    - [`burn-rate-alerting`](../skills/burn-rate-alerting/SKILL.md) (v1.9) — Axe 2 exige SLO burn-rate alerts (não threshold CPU)
    - [`sre-risk-management`](../skills/sre-risk-management/SKILL.md) — Axe 6 exige risk continuum justificativa
    - [`blameless-postmortems`](../skills/blameless-postmortems/SKILL.md) — Axe 3 (Emergency Response) exige postmortem culture
    - [`eliminating-toil`](../skills/eliminating-toil/SKILL.md) — Axe 5 (Change Management) verifica deploy não é toil
    - [`supabase-architect`](./supabase-architect.md) (v1.8) — design feature ANTES do PRR; PRR pós-implementação
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Quando NÃO invocar` contém pelo menos 4 bullets
    - Seção `## Ver também` lista pelo menos 7 cross-refs Markdown
    - Cross-refs incluem `production-readiness-review`, `four-golden-signals`, `event-based-slos`, `burn-rate-alerting`, `sre-risk-management`, `blameless-postmortems`, `eliminating-toil`, `supabase-architect`
  </acceptance_criteria>
</task>

<task id="37-04-T5" name="Smoke fixture + idempotência sync + 4 MCP tools no frontmatter">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/prr-conductor.md (arquivo já criado pelas tasks T1-T4)
  </read_first>
  <action>
    Validar via shell:

    ```bash
    # description ≤ 200 chars
    grep -m1 "^description:" kit/agents/prr-conductor.md | sed 's/^description: //' | wc -c

    # Frontmatter contém as 4 MCP tools literalmente
    head -10 kit/agents/prr-conductor.md | grep -q "mcp__supabase__list_tables" && echo "OK list_tables" || echo "FAIL list_tables"
    head -10 kit/agents/prr-conductor.md | grep -q "mcp__supabase__execute_sql" && echo "OK execute_sql" || echo "FAIL execute_sql"
    head -10 kit/agents/prr-conductor.md | grep -q "mcp__supabase__get_advisors" && echo "OK get_advisors" || echo "FAIL get_advisors"
    head -10 kit/agents/prr-conductor.md | grep -q "mcp__supabase__list_edge_functions" && echo "OK list_edge_functions" || echo "FAIL list_edge_functions"

    # 6 âncoras canônicas
    for h in "## Compatibilidade" "## Por que existe" "## Inputs esperados" "## Passos" "## Quando NÃO invocar" "## Ver também"; do
      n=$(grep -c "^$h" kit/agents/prr-conductor.md)
      [ "$n" -eq 1 ] || echo "FAIL: header $h count=$n"
    done

    # 6 axes canônicos mencionados literalmente
    for axe in "System Architecture" "Instrumentation" "Emergency Response" "Capacity Planning" "Change Management" "Performance"; do
      grep -c "$axe" kit/agents/prr-conductor.md || echo "FAIL: missing axe $axe"
    done
    # Esperado: cada axe ≥ 2 ocorrências

    # 3 engagement models documentados
    grep -c "Simple PRR\|Simple\|simple" kit/agents/prr-conductor.md      # esperado: ≥ 2
    grep -c "Early Engagement\|Early\|early" kit/agents/prr-conductor.md  # esperado: ≥ 2
    grep -c "Frameworks\|Platform\|platform" kit/agents/prr-conductor.md  # esperado: ≥ 2

    # Vocabulário canônico — modo offline
    grep -c "MODO OFFLINE\|OFFLINE\|offline" kit/agents/prr-conductor.md  # esperado: ≥ 3
    grep -c "EVIDENCE_PENDING_MCP\|EVIDENCE_PENDING" kit/agents/prr-conductor.md  # esperado: ≥ 1

    # PRR-REPORT.md mencionado
    grep -c "PRR-REPORT" kit/agents/prr-conductor.md  # esperado: ≥ 3

    # Idempotência sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH1=$(sha256sum "$TMP/.claude/agents/prr-conductor.md" | cut -d' ' -f1)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH2=$(sha256sum "$TMP/.claude/agents/prr-conductor.md" | cut -d' ' -f1)
    [ "$HASH1" = "$HASH2" ] && echo "IDEMPOTENT_OK" || echo "IDEMPOTENT_FAIL"
    rm -rf "$TMP"
    ```

    Esperado: descrição ≤ 200, **frontmatter contém as 4 MCP tools literais**, 6 âncoras canônicas, **6 axes canônicos mencionados literalmente** (cada um pelo menos 2× — header + tabela), 3 engagement models presentes, modo offline documentado, sync idempotente.
  </action>
  <acceptance_criteria>
    - Comando `wc -c` sobre `description` retorna ≤ 200
    - **Frontmatter `tools` contém literalmente todas as 4 MCP tools**: `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`, `mcp__supabase__list_edge_functions`
    - 6 âncoras canônicas cada uma com count == 1
    - **Os 6 axes canônicos mencionados literalmente** (cada um ≥ 2 ocorrências): `System Architecture`, `Instrumentation`, `Emergency Response`, `Capacity Planning`, `Change Management`, `Performance`
    - 3 engagement models documentados: Simple PRR, Early Engagement, Frameworks/Platform
    - Modo offline mencionado pelo menos 3× (`MODO OFFLINE`, `OFFLINE`, ou `offline`)
    - `PRR-REPORT` ocorre ≥ 3 vezes
    - `EVIDENCE_PENDING_MCP` ou `EVIDENCE_PENDING` ocorre pelo menos 1× (modo offline marker)
    - Sync idempotente — 2× consecutivo produz arquivo byte-idêntico
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/agents/prr-conductor.md` existe
- [ ] Frontmatter válido (`name: prr-conductor`, `description ≤ 200 chars`, `tools` lista 6 padrão + 4 MCP Supabase)
- [ ] 6 seções canônicas presentes (`## Compatibilidade`, `## Por que existe`, `## Inputs esperados (do caller)`, `## Passos`, `## Quando NÃO invocar`, `## Ver também`)
- [ ] Tabela "Compatibilidade" contém 5 linhas IDE com mix Full/Partial/Offline-only (porque MCP-dependent)
- [ ] Tabela menciona "Modo offline fallback" explícito
- [ ] **6 axes auditados literalmente** (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance), cada um com tabela de 5 items + coluna Evidence Full + Evidence Offline
- [ ] **4 MCP Supabase tools no frontmatter `tools`** — list_tables, execute_sql, get_advisors, list_edge_functions
- [ ] 3 engagement models documentados (Simple PRR / Early Engagement / Frameworks-Platform) com custo de outage
- [ ] Modo offline com fallback gracioso explícito (declaração `[MODO OFFLINE]` + marker `EVIDENCE_PENDING_MCP`)
- [ ] Step 3 contém template literal `PRR-REPORT.md` com seções canônicas
- [ ] Cross-refs Markdown válidos para `production-readiness-review` + 7 outras skills/agents
- [ ] Sync idempotente
- [ ] Cobre AGCORE-SRE-04 integralmente

## Must-haves (goal-backward)

1. Agent file existe com frontmatter válido
2. **Frontmatter `tools` inclui literalmente as 4 MCP Supabase tools**: `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`, `mcp__supabase__list_edge_functions`
3. `description ≤ 200 chars`
4. Tabela "Compatibilidade" com 5 IDEs (Full em Claude Code+Cursor com MCP, Partial em Codex+Gemini, Offline-only em Windsurf+Antigravity+Copilot+Trae)
5. **6 axes canônicos auditados literalmente**: System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance
6. Cada axe tem 5 items + coluna Evidence (Full mode com MCP) + coluna Evidence (Offline fallback com filesystem)
7. **Modo offline com fallback gracioso explícito** — declaração `[MODO OFFLINE — sem Supabase MCP]` + marker `EVIDENCE_PENDING_MCP` para items MCP-dependentes
8. 3 engagement models (Simple PRR / Early Engagement / Frameworks-Platform) escolhidos por custo de outage (< $1k/min, $1k-100k/min, > $100k/min)
9. Reviewer ≠ time dev (anti-pattern auto-PRR explícito)
10. Step 2 contém scoring 0-5 por axe + decisão Approved/Approved with conditions/Blocked
11. Step 3 contém template literal `PRR-REPORT.md` com seções canônicas (Sumário executivo, Detalhamento por axe, Action Items, Decisão, Re-PRR triggers, Reviewer signature)
12. Cross-ref Markdown válido para skill `production-readiness-review`

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Agent mais complexo da Phase 37 — 4 MCP tools no frontmatter + 6 axes auditados + modo offline com fallback
- Tamanho esperado: ~16-20 KB (denso pelas 6 tabelas de axes + template `PRR-REPORT.md` + 3 engagement models)
- Phase 38 cria `/prr` que dispatch para este agent com flags `--service` ou `--feature`
- Phase 39 INT-SB-V2-02: `supabase-architect` (v1.8) ganha menção a PRR — plano arquitetural sugere PRR antes de production
- Phase 40 INT-FW-V2-02: `/concluir-marco` ganha gate PRR opcional — exige `PRR-REPORT.md` com status `Approved` para features production-bound
- Phase 41 QA-SRE-03: gate `prr-checklist-coverage` verifica que `PRR-REPORT.md` cobre os 6 axes (não pula nenhum)
