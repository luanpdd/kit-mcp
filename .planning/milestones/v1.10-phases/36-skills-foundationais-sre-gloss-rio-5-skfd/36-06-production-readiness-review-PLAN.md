---
phase: 36
plan: 06
title: Skill production-readiness-review — checklist 6 axes + 3 engagement models (cap 32)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/skills/production-readiness-review/SKILL.md
requirements: [SKFD-SRE-05]
status: ready
---

# Plan 06 — Skill `production-readiness-review/SKILL.md`

## Goal

Criar `kit/skills/production-readiness-review/SKILL.md` documentando o capítulo 32 do livro Google SRE — *Evolving SRE Engagement Model*. Checklist canônico de PRR com **6 axes** (System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance), **3 modelos de engagement** (Simple PRR, Early Engagement, Frameworks/SRE Platform), e processo de handoff dev→SRE. Skill é base para Phase 37 agente `prr-conductor` (gera `PRR-REPORT.md`), Phase 38 comando `/prr`, Phase 40 INT-FW-V2-02 (gate PRR em `/concluir-marco`), Phase 41 gate `prr-checklist-coverage`.

## Files to create

- `D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: production-readiness-review` + `description ≤ 200 chars` (anti-pitfall A2)
- **NÃO criar pasta `references/`** (anti-pitfall A8)
- 5 seções canônicas: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Verificação`, `## Ver também`
- 6 axes do PRR documentados in-line (não apenas em glossário) — auto-contida

## Tasks

<task id="36-06-T1" name="Frontmatter + Quando usar">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/observability-driven-development/SKILL.md (linhas 1-20 — shape de frontmatter + Quando usar)
  </read_first>
  <action>
    Escrever frontmatter + `## Quando usar`:

    ```markdown
    ---
    name: production-readiness-review
    description: Use antes de aceitar serviço em produção — PRR checklist 6 axes (System/Instrumentation/Emergency/Capacity/Change/Performance), 3 engagement models, handoff dev→SRE.
    ---

    # SRE — Production Readiness Review (PRR)

    ## Quando usar

    LLM carrega esta skill ao avaliar serviço/feature antes de produção, conduzir handoff dev→SRE, ou definir engagement model. Trigger phrases:

    - "PRR", "production readiness review"
    - "production-bound", "ready for prod"
    - "handoff dev to SRE"
    - "engagement model", "early engagement"
    - "SRE platform", "frameworks readiness"
    - "Google SRE cap 32"
    - "system architecture / instrumentation / emergency response / capacity / change / performance"
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Diretório `kit/skills/production-readiness-review/` criado
    - Arquivo `kit/skills/production-readiness-review/SKILL.md` existe
    - Frontmatter válido com `name: production-readiness-review` e `description` ≤ 200 chars
    - Seção `## Quando usar` contém pelo menos 5 trigger phrases incluindo "PRR", "engagement model", "handoff dev to SRE"
  </acceptance_criteria>
</task>

<task id="36-06-T2" name="Regras absolutas — 8 princípios canônicos cap 32">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção PRR — após Plan 01 T2)
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 19-28 — shape Regras absolutas)
  </read_first>
  <action>
    Adicionar seção `## Regras absolutas` com 8 bullets:

    ```markdown
    ## Regras absolutas

    - **PRR é GATE, não recomendação** — feature/serviço sem PRR aprovado NÃO entra em produção real (apenas dogfooding/staging). Sem gate, "production-ready" vira slogan; com gate, vira invariante.
    - **6 axes obrigatórios** — System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance. Pular um axe = aprovação inválida (lacuna oculta vira incident em 6 meses).
    - **3 engagement models — escolher conforme custo do serviço** — Simple PRR (serviços pequenos/internal), Early Engagement (serviços críticos), Frameworks/SRE Platform (serviços built on top of platform). Modelo errado = ou over-investment (Simple para tier-1) ou under-investment (Early para internal tool).
    - **PRR é ANTES, não DEPOIS** — não "deploy primeiro, fazer PRR depois". PRR conclusão é pré-requisito de aceitar tráfego real (≥ 1% de usuários).
    - **PRR é EVIDENCE-BASED, não opinião** — cada item do checklist tem critério verificável (load test report, runbook URL, dashboard link). "Acreditamos que está pronto" ≠ PRR aprovado.
    - **Action items P0 = blocker; P1 = scheduled** — gaps P0 (sem instrumentação básica, sem rollback, sem on-call) bloqueiam aprovação. Gaps P1 (otimização capacidade, runbook adicional) viram tasks com due date — não bloqueiam, mas são tracked.
    - **Reviewer ≠ time dev** — PRR conduzido por SRE ou par externo ao time dev (eyes-on-code novos, viés reduzido). Auto-PRR pelo time dev = oversight.
    - **PRR é vivo, não one-shot** — após mudança maior (rewrite, novo dependency, RPS 10×), re-run PRR. Statement "passou PRR uma vez em 2024" não é evidence em 2026.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Regras absolutas` contém 8 bullets
    - Contém literalmente: `PRR é GATE`, `6 axes obrigatórios`, `3 engagement models`, `PRR é ANTES`, `EVIDENCE-BASED`, `Action items P0 = blocker; P1 = scheduled`, `Reviewer ≠ time dev`, `PRR é vivo`
    - Os 6 axes nominados literalmente: System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance
  </acceptance_criteria>
</task>

<task id="36-06-T3" name="Patterns canônicos — checklist 6 axes detalhado + 3 engagement models + PRR-REPORT.md template">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção b — checklist canônico de PRR)
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 30-170 — shape Patterns canônicos)
  </read_first>
  <action>
    Adicionar seção `## Patterns canônicos` com 5 sub-patterns:

    **`### Pattern: checklist canônico PRR — 6 axes detalhados`** — bloco markdown com 6 subgrupos, cada um com 3-5 itens verificáveis:

    ````markdown
    ```markdown
    # PRR Checklist — <serviço/feature> — <data>

    Reviewer: @<sre-or-external>
    Status: Draft | In Review | Approved | Blocked

    ---

    ## Axe 1: System Architecture

    - [ ] **Redundância**: serviço tolera falha de N instâncias (N=1 mínimo, N=2 ideal). Evidence: deployment manifest (replicas: 2+).
    - [ ] **Single point of failure mapeado**: SPOFs documentados; mitigation plan claro. Evidence: arch diagram + SPOF list.
    - [ ] **Failure modes mapeados**: top 5 modos de falha conhecidos com impact + mitigation. Evidence: failure mode analysis doc.
    - [ ] **Load balancing strategy**: round-robin / least-conn / consistent-hash documentado. Evidence: LB config.
    - [ ] **Graceful degradation**: serviço degrada (não crasha) sob carga ou dependency failure. Evidence: chaos test report ou load test config.

    ## Axe 2: Instrumentation, Metrics, Monitoring

    - [ ] **4 golden signals presentes**: Latency (histogram), Traffic (counter), Errors (counter por error.type), Saturation (gauge). Evidence: dashboard URL + queries.
    - [ ] **SLI/SLO definidos**: ao menos 1 SLO por jornada crítica do user (ver [event-based-slos](../event-based-slos/SKILL.md)). Evidence: SLO.md em `.planning/slos/`.
    - [ ] **Alertas SLO burn-rate**: NÃO threshold em CPU/mem/etc. Evidence: alert rules em código + correlação com SLO definido.
    - [ ] **Logs estruturados**: wide events com campos canônicos (`user.id`, `request.id`, `error.type`, `result.success`, `duration_ms`, `build_id`). Evidence: log query exemplo.
    - [ ] **Traces propagados**: W3C TraceContext header em hops cross-service. Evidence: trace exemplo cross-service.

    ## Axe 3: Emergency Response

    - [ ] **Runbook existe e foi testado**: passos para incident comuns (5+ scenarios). Evidence: URL do runbook + log do último teste.
    - [ ] **On-call rotation definida**: schedule visível, ≥ 2 pessoas, escalation policy. Evidence: PagerDuty/Opsgenie schedule.
    - [ ] **Page routing**: alertas SLO → on-call específico (não generic). Evidence: alert routing rules.
    - [ ] **Escalation policy**: timeline clara (page → 5 min ack → 15 min escalate to L2 → 30 min L3). Evidence: doc.
    - [ ] **Wheel of Misfortune realizado nos últimos 90d**: time praticou response em incident histórico. Evidence: data + participantes.

    ## Axe 4: Capacity Planning

    - [ ] **Load test executado**: pico esperado × 2 testado; report com latency degradation curve. Evidence: load test report.
    - [ ] **RPS limit documentado**: serviço sabe seu max sustainable RPS por instance. Evidence: number + source.
    - [ ] **Auto-scaling testado**: scale-up + scale-down funcionam sem intervenção manual. Evidence: scaling test log.
    - [ ] **Quota/rate-limit por tenant**: tenant abusivo não derruba serviço para outros. Evidence: rate-limit config.
    - [ ] **Headroom ≥ 30%**: capacidade atual / pico esperado ≥ 1.3. Evidence: cálculo + dashboard.

    ## Axe 5: Change Management

    - [ ] **Canary release**: deploys vão para 1% → 10% → 100% com hold em cada estágio. Evidence: CI pipeline config.
    - [ ] **Feature flags**: features novas atrás de flag (deploy ≠ release). Evidence: feature flag service.
    - [ ] **Rollback automatizado**: SLO burn rate > N nos primeiros M min após deploy → rollback automático. Evidence: rollback automation config.
    - [ ] **CI/CD gates obrigatórios**: testes + lint + security scan + load test (em paths críticos). Evidence: CI config.
    - [ ] **Deploy frequency mensurado**: time conhece sua deploy cadence (commits/dia ou /semana). Evidence: metric URL.

    ## Axe 6: Performance

    - [ ] **Latency baseline (p50/p95/p99/p99.9)**: número conhecido para cada percentil principal. Evidence: dashboard query.
    - [ ] **Error budget definido**: SLO target × window definidos; budget calculado. Evidence: SLO.md.
    - [ ] **Saturation tracked**: CPU / memory / connection pool / queue depth — recurso mais escasso identificado. Evidence: gauge query.
    - [ ] **Long tail (p99.9) monitored**: não só p50; alerta se p99.9 > N×p50 (regression detection). Evidence: query.
    - [ ] **Risk continuum justificado**: target SLO escolhido com base em risk × innovation, não default 99.99%. Evidence: justificativa em SLO.md (ver [sre-risk-management](../sre-risk-management/SKILL.md)).

    ---

    ## Action Items

    | # | Axe | Item | Severity | Owner | Due |
    |---|-----|------|----------|-------|-----|
    | 1 | 2 | Adicionar saturation gauge em /api/v1/orders | P0 | @bob | 2026-05-15 |
    | 2 | 4 | Documentar RPS limit em runbook | P1 | @alice | 2026-05-22 |

    ## Decisão

    - [x] **Approved** — service production-ready
    - [ ] **Approved with conditions** — P1s tracked, P0s blockers em release próximo
    - [ ] **Blocked** — P0 gaps; service NÃO aceita tráfego real até resolução

    ## Reviewer signature

    Reviewer: @<sre>
    Date: YYYY-MM-DD
    ```
    ````

    **`### Pattern: 3 engagement models — quando usar cada`** — tabela:

    | Modelo | Quando usar | SRE involvement | Custo SRE |
    |---|---|---|---|
    | **Simple PRR** | Serviços pequenos, internal tools, dogfood-only | Reviewer 1 sessão; checklist preenchido por dev | Baixo (4-8h) |
    | **Early Engagement** | Serviços críticos (tier-1), customer-facing, expected RPS > 1k/s | SRE participa do design; junior review em milestones; full PRR pré-launch | Médio (semanas) |
    | **Frameworks / SRE Platform** | Serviços built on top of plataforma SRE-blessed (lib + templates + gates já PRR-ready) | SRE manteve plataforma; dev usa scaffolds; PRR é confirmação que dev seguiu plataforma | Baixo recorrente, alto setup inicial |

    Prosa: "Modelo escolhido pelo **custo de outage** do serviço:
    - Outage < $1k/min → Simple PRR (1 sessão, checklist)
    - Outage $1k-100k/min → Early Engagement (SRE no design)
    - Outage > $100k/min OR > 10 microserviços similares → Platform (libs/scaffolds eliminam toil de PRR)
    "

    **`### Pattern: handoff dev → SRE — sequência canônica`**:

    ```text
    1. Dev declara intenção: "Esse serviço vai produção em 2026-MM-DD."
    2. Reviewer SRE aceita engagement model (Simple/Early/Platform).
    3. Dev preenche PRR checklist (6 axes) com evidence em cada item.
    4. Reviewer abre PRR-REPORT.md em .planning/prr/<service>.md, score cada axe (Pass/Fail/N-A).
    5. Reviewer + dev discutem gaps:
       - P0 (blocker): dev resolve antes de production ship
       - P1 (scheduled): owner + due date; tracked em roadmap
       - P2 (optional): documentado mas não obrigatório
    6. Após P0s resolvidos, reviewer marca Approved e assina.
    7. Dev ship (canary 1% → 100%).
    8. Pós-launch: SRE review SLO compliance em 7d, 30d, 90d.
    9. Re-PRR triggered em mudanças maiores (rewrite, RPS 10×, novo dependency tier-1).
    ```

    **`### Pattern: SRE Platform como amplificador`**:

    ```text
    Plataforma SRE consiste em:

    1. Library/SDK que codifica boas práticas (otel-by-default, structured-logging-by-default,
       4-golden-signals-by-default, rate-limit-by-default, circuit-breaker-by-default)
    2. Scaffolds/templates de novo serviço (kit-mcp 's `/sre`, e.g., `/sre new-service <name>`)
    3. CI gates que verificam adequação à plataforma (gates de Phase 41:
       golden-signals-coverage, postmortem-template-required, prr-checklist-coverage)
    4. Runbook templates por categoria de serviço (HTTP API, async worker, batch job)

    Resultado: novo serviço nasce com 80% do PRR já passado por design.
    PRR vira confirmação ("você usou a plataforma?"), não auditoria de zero.

    Trade-off: setup inicial alto (semanas-meses para escrever plataforma).
    Recomendado para org com 10+ microserviços similares.
    ```

    **`### Pattern: PRR-REPORT.md template canônico`** (formato que `prr-conductor` Phase 37 vai gerar):

    ````markdown
    ```markdown
    # PRR-REPORT — <serviço/feature> — <data>

    **Reviewer:** @<sre-or-external>
    **Engagement model:** Simple PRR | Early Engagement | Frameworks/Platform
    **Status:** Approved | Approved with conditions | Blocked

    ## Sumário executivo

    Resultado por axe (1-2 linhas cada):

    | Axe | Score | Status |
    |-----|-------|--------|
    | 1. System Architecture | 5/5 | Pass |
    | 2. Instrumentation, Metrics, Monitoring | 4/5 | Pass with gaps |
    | 3. Emergency Response | 3/5 | Fail (P0) |
    | 4. Capacity Planning | 4/5 | Pass with gaps |
    | 5. Change Management | 5/5 | Pass |
    | 6. Performance | 4/5 | Pass with gaps |

    ## Detalhamento por axe

    [seção por axe com itens checked + evidence + gaps]

    ## Action Items

    [tabela com P0/P1/P2 + owner + due]

    ## Aprovação

    [Approved / Approved with conditions / Blocked]
    [Assinatura + data]
    ```
    ````
  </action>
  <acceptance_criteria>
    - Seção `## Patterns canônicos` contém 5 sub-patterns: `### Pattern: checklist canônico PRR — 6 axes detalhados`, `### Pattern: 3 engagement models`, `### Pattern: handoff dev → SRE`, `### Pattern: SRE Platform como amplificador`, `### Pattern: PRR-REPORT.md template`
    - Checklist enumera os 6 axes literalmente: `## Axe 1: System Architecture`, `## Axe 2: Instrumentation`, `## Axe 3: Emergency Response`, `## Axe 4: Capacity Planning`, `## Axe 5: Change Management`, `## Axe 6: Performance`
    - Cada axe tem 5 itens em checkbox `- [ ]` formato com `Evidence:` mencionado
    - Tabela 3 engagement models lista: Simple PRR, Early Engagement, Frameworks/SRE Platform
    - Sequência handoff documenta 9 passos
    - Template PRR-REPORT.md tem seção "Sumário executivo" com tabela 6 axes
  </acceptance_criteria>
</task>

<task id="36-06-T4" name="Anti-patterns — 6 anti-patterns canônicos de PRR">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção d — anti-patterns)
  </read_first>
  <action>
    Adicionar seção `## Anti-patterns` com 6 sub-anti-patterns no shape `ANTI / PROBLEMA / CERTO`:

    **`### ANTI: PRR depois do launch`** — fazer PRR após serviço já em produção → gaps P0 já causaram incidents (sem instrumentação significa SEV1 cego); valor de gate perdido; PRR vira post-mortem disfarçado. CERTO: PRR ANTES de aceitar tráfego real (≥ 1%); blocker se P0 pendente.

    **`### ANTI: auto-PRR pelo time dev`** — time dev preenche checklist + auto-aprova → confirmation bias (dev acredita que serviço é maduro); itens vagos passam ("Sim, temos monitoring"); gaps invisíveis até incident. CERTO: reviewer EXTERNO ao time (SRE ou outro time dev sênior); evidence-based em cada item.

    **`### ANTI: pular axes "menos relevantes"`** — "Esse serviço é simples, não precisa de capacity planning" → axe pulado vira lacuna; "simples" é subjetivo; decisão baseada em assumption. CERTO: TODOS os 6 axes preenchidos. Item N/A é resposta válida (com justificativa) — pular silenciosamente NÃO é. Para serviços pequenos, model "Simple PRR" cobre os 6 em 4-8h.

    **`### ANTI: PRR como rubber stamp`** — reviewer aprova sem ler evidence; meeting 15 min; checklist marcado "looks good" → first-incident (em 3-6 meses) revela 5+ gaps; reviewer responsabilidade compartilhada por incident. CERTO: reviewer aplica time-budget (4-8h Simple, dias Early); evidence verificada em cada item; não-OK = blocker, não "todos têm gaps".

    **`### ANTI: engagement model errado para custo`** — Simple PRR para tier-1 (outage > $100k/min) → SRE não engajou no design; problemas estruturais inviáveis de fix pós-launch; tier-1 com instabilidade. OU Early Engagement para internal tool com 5 usuários → over-investment SRE; deslocamento de trabalho importante. CERTO: escolher model conforme custo de outage (regra do glossário: < $1k/min = Simple, > $100k/min = Platform).

    **`### ANTI: PRR one-shot`** — passou PRR em 2024, foi para prod, nunca re-PRR'd → 2 anos depois: dependency new, RPS 10×, código rewrote, time rotated; PRR original irrelevante. CERTO: re-PRR triggered em (a) rewrite > 50%, (b) RPS escala > 10×, (c) novo dependency tier-1, (d) time-of-record rotation > 50%, (e) anualmente como hygiene.

    Cada bloco usa shape:

    ```markdown
    ### ANTI: <nome>

    \`\`\`text
    ANTI: <comportamento concreto>

    PROBLEMA: <consequência sistêmica>

    CERTO: <ação substituta>
    \`\`\`
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Anti-patterns` contém 6 sub-anti-patterns: `### ANTI: PRR depois do launch`, `### ANTI: auto-PRR pelo time dev`, `### ANTI: pular axes "menos relevantes"`, `### ANTI: PRR como rubber stamp`, `### ANTI: engagement model errado para custo`, `### ANTI: PRR one-shot`
    - Cada um contém literalmente as 3 palavras-âncora `ANTI:`, `PROBLEMA:`, `CERTO:`
  </acceptance_criteria>
</task>

<task id="36-06-T5" name="Verificação + Ver também + footer">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 251-275 — shape Verificação + Ver também + footer)
  </read_first>
  <action>
    Adicionar seções finais.

    **`## Verificação`**:

    ```markdown
    ## Verificação

    Antes de marcar PRR como `Approved`:

    1. **6 axes preenchidos** — System Architecture, Instrumentation/Metrics/Monitoring, Emergency Response, Capacity Planning, Change Management, Performance
    2. **Cada item tem evidence** — não checkbox vago; evidence concreta (URL/query/doc) em cada
    3. **Engagement model escolhido apropriadamente** — Simple PRR/Early Engagement/Frameworks-Platform conforme custo de outage
    4. **Reviewer ≠ time dev** — reviewer externo ou SRE
    5. **P0s todos resolvidos** — gaps P0 são blockers; nenhum aberto pré-launch
    6. **P1s tracked com owner + due** — escalonados em roadmap próximo
    7. **PRR-REPORT.md em `.planning/prr/<service>.md`** — formato canônico
    8. **Re-PRR trigger documentado** — quando re-PRR é triggered (rewrite, RPS 10×, etc.)
    ```

    **`## Ver também`**:

    ```markdown
    ## Ver também

    - [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — termos canônicos PRR, 6 axes, 3 engagement models
    - [`four-golden-signals`](../four-golden-signals/SKILL.md) — Axe 2 (Instrumentation) exige os 4 signals
    - [`event-based-slos`](../event-based-slos/SKILL.md) (v1.9) — Axe 6 (Performance) exige SLO definido
    - [`burn-rate-alerting`](../burn-rate-alerting/SKILL.md) (v1.9) — Axe 2 (Instrumentation) exige SLO burn-rate alerts
    - [`sre-risk-management`](../sre-risk-management/SKILL.md) — Axe 6 (Performance) requer risk continuum justificativa
    - [`blameless-postmortems`](../blameless-postmortems/SKILL.md) — Axe 3 (Emergency Response) exige postmortem culture
    - [`eliminating-toil`](../eliminating-toil/SKILL.md) — Axe 5 (Change Management) verifica deploy não é toil
    ```

    **Footer:**

    ```markdown
    ---

    *Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016) — Cap 32: "The Evolving SRE Engagement Model".*
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Verificação` contém checklist de 8 itens
    - Seção `## Ver também` lista exatamente 7 cross-refs Markdown relativos
    - Footer cita literalmente `Cap 32: "The Evolving SRE Engagement Model"`
    - Arquivo total ≤ 18 KB (denso pelo checklist 6 axes detalhado)
  </acceptance_criteria>
</task>

<task id="36-06-T6" name="Smoke test agregado — sync 2× idempotente das 5 SKFD-SRE skills + glossário (crit-4 + crit-5 ROADMAP)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (Plan 01)
    - D:/projetos/opensource/mcp/kit/skills/sre-risk-management/SKILL.md (Plan 02)
    - D:/projetos/opensource/mcp/kit/skills/four-golden-signals/SKILL.md (Plan 03)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (Plan 04)
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (Plan 05)
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (Plan 06 — este)
  </read_first>
  <action>
    Após Plans 01-06 concluídos, rodar smoke test agregado em PowerShell. Esta task é o smoke test final da Phase 36.

    ```powershell
    # PT-BR: snapshot CLAUDE.md ANTES da Phase 36 (se já concluída, fazer git stash workaround)
    $beforeBytes = (Get-Content D:\projetos\opensource\mcp\CLAUDE.md -Raw -ErrorAction SilentlyContinue | Measure-Object -Character).Characters

    # PT-BR: validar frontmatter description ≤ 200 chars em cada skill (anti-pitfall A2)
    $skills = @(
      'sre-risk-management',
      'four-golden-signals',
      'eliminating-toil',
      'blameless-postmortems',
      'production-readiness-review'
    )
    foreach ($s in $skills) {
      $path = "D:\projetos\opensource\mcp\kit\skills\$s\SKILL.md"
      $content = Get-Content $path -Raw -ErrorAction Stop
      # PT-BR: extrair description do frontmatter
      if ($content -match "^---\s*\r?\nname:\s*[^\r\n]+\r?\ndescription:\s*([^\r\n]+)\r?\n---") {
        $desc = $matches[1].Trim()
        $len = $desc.Length
        if ($len -gt 200) {
          Write-Host "FAIL: $s description = $len chars (>200)"
          exit 1
        } else {
          Write-Host "OK: $s description = $len chars"
        }
      } else {
        Write-Host "FAIL: $s has no valid frontmatter"
        exit 1
      }
    }

    # PT-BR: smoke sync idempotente — rodar 2× em tmpdir
    $tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "kit-sync-phase36-$(Get-Random)")
    node D:\projetos\opensource\mcp\bin\kit.js sync install claude-code --project-root $tmp.FullName
    $first = @{}
    foreach ($s in $skills) {
      $first[$s] = Get-Content "$($tmp.FullName)\.claude\skills\$s\SKILL.md" -Raw -ErrorAction SilentlyContinue
    }
    $first['glossary'] = Get-Content "$($tmp.FullName)\.claude\skills\_shared-sre\glossary.md" -Raw -ErrorAction SilentlyContinue

    node D:\projetos\opensource\mcp\bin\kit.js sync install claude-code --project-root $tmp.FullName
    $second = @{}
    foreach ($s in $skills) {
      $second[$s] = Get-Content "$($tmp.FullName)\.claude\skills\$s\SKILL.md" -Raw -ErrorAction SilentlyContinue
    }
    $second['glossary'] = Get-Content "$($tmp.FullName)\.claude\skills\_shared-sre\glossary.md" -Raw -ErrorAction SilentlyContinue

    foreach ($k in $first.Keys) {
      if ($first[$k] -eq $second[$k]) { Write-Host "IDEMPOTENT_OK: $k" }
      else { Write-Host "IDEMPOTENT_FAIL: $k"; exit 1 }
    }

    # PT-BR: CLAUDE.md inflation budget — gerado pelo kit em tmpdir, comparar com baseline
    $generatedClaudeMd = Get-Content "$($tmp.FullName)\CLAUDE.md" -Raw -ErrorAction SilentlyContinue
    if ($generatedClaudeMd) {
      $afterBytes = ($generatedClaudeMd | Measure-Object -Character).Characters
      $delta = $afterBytes - $beforeBytes
      Write-Host "CLAUDE.md delta após Phase 36: $delta chars (~$([math]::Round($delta/1024, 2)) KB)"
      # PT-BR: budget 1.0 KB conforme ROADMAP crit-5
      if ($delta -gt 1024) {
        Write-Host "BUDGET_FAIL: CLAUDE.md cresceu mais que 1.0 KB"
        exit 1
      }
    }

    # PT-BR: glossary NÃO está em listKit
    $catalog = node D:\projetos\opensource\mcp\bin\kit.js list 2>&1 | Out-String
    if ($catalog -match '_shared-sre') { Write-Host "FAIL: _shared-sre listed"; exit 1 }
    Write-Host "ALL_PASS"
    ```
  </action>
  <acceptance_criteria>
    - As 5 SKFD-SRE skills têm `description ≤ 200 chars` no frontmatter (PowerShell loop verifica)
    - `kit sync install claude-code --project-root <tmpdir>` rodado 2× produz output byte-idêntico para todas as 5 skills + glossary (crit-4 ROADMAP)
    - CLAUDE.md gerado cresce ≤ +1024 chars (~1.0 KB) após Phase 36 (crit-5 ROADMAP — anti-pitfall A2 description budget)
    - `_shared-sre/glossary.md` NÃO aparece em `kit list` (não é skill triggerável; precedente das suítes anteriores)
    - PowerShell script termina com `ALL_PASS`
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/skills/production-readiness-review/SKILL.md` existe
- [ ] Frontmatter válido (`name: production-readiness-review`, `description ≤ 200 chars`)
- [ ] 6 seções presentes
- [ ] Cobre cap 32: 6 axes detalhados + 3 engagement models + handoff dev→SRE + SRE Platform + PRR-REPORT.md template
- [ ] Auto-contida — checklist completo dos 6 axes inline (não apenas em glossário)
- [ ] Cobre SKFD-SRE-05 integralmente
- [ ] **Smoke agregado da Phase 36 passou** (T6) — todas 5 skills + glossário idempotentes em sync 2×; description budget OK; glossary NÃO listado

## Must-haves (goal-backward)

1. Skill `production-readiness-review/SKILL.md` existe com frontmatter triggerável
2. 6 axes documentados in-line com 3-5 itens cada (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance)
3. 3 engagement models documentados com critério de escolha por custo de outage
4. Template PRR-REPORT.md inline — `prr-conductor` Phase 37 usa esse formato
5. Smoke agregado da Phase 36 passa — sync idempotente 2×, description budget ≤ 1 KB inflation, glossary não listado

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Skill é base para Phase 37 agente `prr-conductor` (gera PRR-REPORT.md em formato definido aqui), Phase 38 comando `/prr`, Phase 39 INT-SB-V2-02 (`supabase-architect` ganha menção a PRR), Phase 40 INT-FW-V2-02 (`/concluir-marco` gate PRR), Phase 41 gate `prr-checklist-coverage`
- Tamanho esperado ~16-18 KB (denso pelo checklist 6 axes completo + 2 templates inline)
