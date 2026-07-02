---
phase: 41
plan: 05
title: CHANGELOG — adicionar entrada v1.10.0 SRE Engagement
wave: 2
depends_on: [41-01, 41-02, 41-03]
autonomous: true
files_modified:
  - CHANGELOG.md
requirements: [QA-SRE-05]
status: ready
---

# Plan 05 — Patch `CHANGELOG.md` — adicionar entrada `[1.10.0]` SRE Engagement

## Goal

Adicionar entrada **`## [1.10.0] - 2026-05-07`** ao `CHANGELOG.md` documentando o milestone v1.10 SRE Engagement: **6 skills + 4 agents + 6 commands + 3 audit gates + lifecycle hooks** (PRR gate em `/concluir-marco`, postmortem chain em `/forense`, toil audit em `/auditar-marco`), integração com Suíte Observabilidade v1.9 e Suíte Supabase v1.8, e referência canônica ao livro *Site Reliability Engineering* (Beyer/Jones/Petoff/Murphy, Google/O'Reilly, 2016). Cobre **QA-SRE-05**.

## Files to modify

- `D:/projetos/opensource/mcp/CHANGELOG.md`

## Constraints (anti-pitfall reminders)

- **Posicionamento canônico** — nova entrada `## [1.10.0] - 2026-05-07` adicionada **imediatamente após** `## [Unreleased]` (linha 7) e **antes** de `## [1.8.1] - 2026-05-06` (linha 9). NÃO promover entrada para `[Unreleased]` (ela continua placeholder vazio para próximo cycle)
- **Formato Keep a Changelog 1.1.0** — seções `### Adicionado` (Added), `### Mudado` (Changed), `### Sem mudanças de API runtime`, `### Tests`, `### Detalhes` — paridade com entrada v1.8.0 (linhas 35-108)
- **SemVer** — versão `1.10.0` é minor bump (content-only, zero alterações em `src/core/`, stable API v1.0+ preservada)
- **Data canônica** — `2026-05-07` (data de hoje conforme system-reminder atualizado neste branch). NOTE: a chamada original do user-context dizia 2026-05-06 mas system-reminder mid-conversation atualizou para 2026-05-07 — usar a data corrente do system
- **Linguagem PT-BR** — paridade com entradas v1.8.0/v1.7.0/v1.6.0 (PT-BR como linguagem padrão do CHANGELOG do projeto)
- **Gap conhecido v1.9.0** — CHANGELOG **não tem** entrada `[1.9.0]` (publicada 2026-05-06 mas entrada nunca foi adicionada — gap separado). Este plan **NÃO** corrige o gap v1.9.0 (escopo é apenas v1.10.0); apenas mencionar como nota de fundo na entrada v1.10.0 no contexto "complementa Suíte Observabilidade v1.9 (publicada 2026-05-06)"
- **Tom canônico** — manter dialogo PT-BR técnico, en-dashes, citação ao livro fonte como na v1.8.0 (que cita arquitetura Supabase) — paridade narrativa

## Tasks

<task id="41-05-T1" name="Validar âncora de patch e estrutura CHANGELOG">
  <read_first>
    - D:/projetos/opensource/mcp/CHANGELOG.md (linhas 1-15 — confirmar âncora "## [Unreleased]" linha 7 + "## [1.8.1]" linha 9)
    - D:/projetos/opensource/mcp/CHANGELOG.md (linhas 35-108 — re-leitura entrada v1.8.0 como template estrutural)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar linha 7 = `## [Unreleased]`
    2. Confirmar linha 9 = `## [1.8.1] - 2026-05-06`
    3. Confirmar que `## [1.9.0]` **NÃO** existe (gap conhecido; não corrigir neste plan)
    4. Confirmar estrutura de v1.8.0 como template:
       - Heading `## [1.8.0] - <data>`
       - Parágrafo introdutório (1-2 frases)
       - `### Adicionado — <subtítulo>` blocks (multiple)
       - `### Mudado — <subtítulo>` blocks (multiple)
       - `### Sem mudanças de API runtime`
       - `### Tests`
       - `### Decisões arquiteturais`
       - `### Detalhes`
  </action>
  <acceptance_criteria>
    - Linha 7 = "## [Unreleased]"
    - Linha 9 = "## [1.8.1] - 2026-05-06"
    - "## [1.9.0]" não existe no CHANGELOG (confirmação do gap)
    - Estrutura v1.8.0 confirmada como template
  </acceptance_criteria>
</task>

<task id="41-05-T2" name="Inserir entrada [1.10.0] entre [Unreleased] e [1.8.1]">
  <read_first>
    - D:/projetos/opensource/mcp/CHANGELOG.md (linhas 5-12 — re-leitura precisa do ponto de inserção)
  </read_first>
  <action>
    Usar Edit para adicionar, **imediatamente após** a linha 7 (`## [Unreleased]`) e **antes** da linha 9 (`## [1.8.1] - 2026-05-06`), uma linha em branco preservada e o seguinte bloco completo:

    ```markdown

    ## [1.10.0] - 2026-05-07

    Milestone v1.10 — Suíte SRE Engagement: incorpora técnicas do livro *Site Reliability Engineering: How Google Runs Production Systems* (Beyer, Jones, Petoff, Murphy — Google/O'Reilly, 2016) ao kit-mcp. 32 REQs em 6 fases (Phases 36-41), distribuídos em 3 ondas: Núcleo SRE (Phases 36-38), Integração com suítes existentes (Phases 39-40), Gates QA + docs (Phase 41). Complementa a Suíte Observabilidade v1.9.0 (publicada 2026-05-06) e a Suíte Supabase v1.8.0 — juntas formam o stack production engineering do kit.

    ### Adicionado — 6 skills SRE foundationais (Phase 36)

    Cada skill é auto-contida (sem `references/`), com frontmatter `description ≤ 200 chars`, template canônico de 5 seções (Quando usar / Regras absolutas / Patterns canônicos / Anti-patterns / Ver também), e cross-refs via Markdown link relativo.

    - `_shared-sre/glossary.md` — vocabulário canônico bilíngue (PT-BR↔EN): SLI, SLO, SLA, error budget, burn rate, toil, postmortem, blameless, PRR, golden signals (latency/traffic/errors/saturation), risk continuum, MTTR, MTBF. Lista anti-patterns explícitos (alert fatigue, hero culture, SLO 99.99%+, fixed-window error budget, blame culture, mean-only latency, monitoring causes não symptoms).
    - `sre-risk-management` — risk continuum (cap 3 livro Google SRE), 99.99% wisdom (user em 99% smartphone não distingue 99.99% vs 99.999%), error budget como balanço explícito risk × innovation, "as reliable as needs to be, no more".
    - `four-golden-signals` — Latency + Traffic + Errors + Saturation (cap 6), black-box vs white-box monitoring, distinção de latência success vs error, percentis vs mean (long tail), histograms com bucketing exponencial.
    - `eliminating-toil` — definição canônica de toil (manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50% (cap 5), padrões de automação, distinção toil vs overhead vs grungy work.
    - `blameless-postmortems` — template canônico 9 seções (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC), cultura blameless (cap 15), "no postmortem left unreviewed", Wheel of Misfortune para training.
    - `production-readiness-review` — checklist PRR (cap 32) — 6 axes: System architecture, Instrumentation/Metrics/Monitoring, Emergency response, Capacity planning, Change management, Performance — com 3 modelos de engagement: Simple PRR, Early Engagement, Frameworks/SRE Platform.

    ### Adicionado — 4 agents SRE core (Phase 37)

    Cada agent inclui tabela `## Compatibilidade` por IDE (Full / Partial / Offline-only), preflight detection MCP no Step 0 quando aplicável, e frontmatter `tools:` com nomes canônicos.

    - `golden-signals-instrumenter` — especialização de `observability-instrumenter` (v1.9). Recebe código de serviço/Edge Function e retorna patches OTel com Latency=histogram bucketed exponencial, Traffic=counter por endpoint × method, Errors=counter por `error.type` enum 5-15 valores fechado (NUNCA `error.message`), Saturation=gauge resource-specific identificado explicitamente.
    - `toil-auditor` — analisa repo + git log ≤ 90d + scripts shell + comandos manuais documentados em README/runbooks. Retorna `.planning/TOIL-AUDIT.md` listando candidatos a automação com priorização P0/P1/P2 e ROI = freq × tempo / esforço.
    - `postmortem-writer` — recebe `--from-investigation <id>` (continuação de `incident-investigator` v1.9 — lê `.planning/investigations/<id>.md`) ou `--incident "<descrição>"` (standalone). Gera postmortem blameless seguindo template canônico de 9 seções em `.planning/postmortems/<id>.md`.
    - `prr-conductor` — conduz Production Readiness Review para serviço/feature. Lê schema (Supabase MCP), Edge Functions code, SLOs definidos (`.planning/slos/`), audit logs. Produz `PRR-REPORT.md` scored em 6 axes com gaps e action items priorizados (P0 blocker / P1 scheduled).

    ### Adicionado — 6 commands SRE (Phase 38)

    - `/sre <subcommand>` — orquestrador único (análogo a `/supabase` v1.8 e `/observabilidade` v1.9); dispatch via `Task(subagent_type=...)` com sinônimos PT/EN para os 5 comandos abaixo.
    - `/golden-signals` — invoca `golden-signals-instrumenter` para serviço/Edge Function/fase; gera `GOLDEN-SIGNALS.md` por target com instrumentação OTel pronta.
    - `/auditar-toil` — invoca `toil-auditor`; gera `.planning/TOIL-AUDIT.md`.
    - `/postmortem` — invoca `postmortem-writer`; suporta flag `--from-investigation <id>` (continuar de investigation v1.9) ou `--incident "<descrição>"` (postmortem standalone).
    - `/prr` — invoca `prr-conductor` para serviço/feature; usa flag `--service <name>` ou `--feature <description>`; gera `PRR-REPORT.md`.
    - `/risk-budget` — exibe state atual de error budget vs risk continuum, citando SLOs definidos em v1.9 (lê `.planning/slos/`); aplica skill `sre-risk-management`.

    ### Adicionado — 3 audit gates novos (Phase 41)

    Markdown specs em `gates/` com `## Check` em bash 3.2-portable (macOS default):

    - `gates/golden-signals-coverage.md` (blocking, pre-verify) — verifica código de serviço/Edge Function tocado em fase tem os 4 golden signals presentes (regex sobre `histogram | counter | gauge | saturation`). Skip gracefully em projetos content-only (sem `supabase/functions/` / `src/` / `lib/`).
    - `gates/postmortem-template-required.md` (blocking, pre-conclude) — em `/concluir-marco`, bloqueia se houve incident em `.planning/investigations/` sem `.planning/postmortems/` correspondente. `Status: INCONCLUSIVE` reconhecido como exceção (sem root cause = sem aprendizado a documentar). Princípio canônico: "no postmortem left unreviewed" (cap 15).
    - `gates/prr-checklist-coverage.md` (blocking, pre-verify) — verifica que `PRR-REPORT.md` em `.planning/prr/**/*.md` cobre os 6 axes do PRR (System architecture, Instrumentation, Emergency response, Capacity planning, Change management, Performance) — pular um axe = aprovação inválida (regra absoluta da skill `production-readiness-review`).

    ### Adicionado — integração com Suíte Observabilidade v1.9 (Phase 39)

    - **Skill `event-based-slos` (v1.9)** ganha bloco "Risk continuum" cross-referenciando `sre-risk-management`; explica que target SLO é escolha explícita no continuum risk × innovation, não meta arbitrária.
    - **Agent `omm-auditor` (v1.9)** consulta `toil-auditor` para Capacidade 3 (Complexidade/Tech Debt). Score OMM-3 considera % de tempo em toil pelo time. Tabela 5-row Cap 3 (`< 15%` → 5 / `15-30%` → 4 / `30-50%` → 3 / `50-60%` → 2 / `> 60%` → 1) replicada como single source of truth distribuída.

    ### Adicionado — integração com Suíte Supabase v1.8 (Phase 39)

    - **`supabase-edge-fn-writer`** ganha seção "Four Golden Signals" — template canônico de Edge Function inclui histogram de latência, counter de tráfego, counter de erros por error.type enum, gauge de saturação (recurso identificado explicitamente: pg_pool / concurrency_limit / pgmq.queue_length / egress_bandwidth conforme tipo de função).
    - **`supabase-architect`** ganha menção a PRR — plano arquitetural sugere PRR antes de production; cross-ref para `production-readiness-review`. Tabela 6 axes adaptada ao contexto Supabase (single project = SPOF mitigado por branches Pro; Spend Cap; RLS git-versioned; declarative schema; load test com p99 baseline).
    - **`supabase-migration-writer`** ganha alerta sobre toil — scripts SQL repetitivos (rebuild de índices manuais, vacuums recorrentes) são candidatos a automação via pg_cron; cross-ref para `eliminating-toil`.
    - **`supabase-storage-implementer`** ganha saturation signal — uploads emitem gauge de bucket size + counter de quota near-exhaustion (thresholds 80% yellow / 95% red por plan: Free 1 GB / Pro 100 GB / Team 1 TB / Enterprise custom); cross-ref para `four-golden-signals`.

    ### Mudado — lifecycle hooks no fluxo framework (Phase 40)

    Patches editoriais puramente aditivos em 3 commands de fluxo framework — frontmatter (`description`, `allowed-tools`) preservado byte-a-byte (anti-pitfall A2), workflows em `.claude/framework/workflows/*.md` continuam funcionais como antes.

    - **`/forense`** ganha bloco `<sre_integration>` que sugere chain `/postmortem` automaticamente após Core Analysis Loop fechar com root cause `VALIDATED`. Distinção fundamental: forense diagnostica (read-only, evidence-based, científico — output em `.planning/forensics/`); postmortem documenta blameless para aprendizado organizacional (cap 15 — output em `.planning/postmortems/`). 3 condições de trigger sugerido + 3 exceções explícitas de não-trigger (INT-FW-V2-01).
    - **`/concluir-marco`** ganha gate PRR opcional — quando `workflow.complete_milestone_prr_gate=true` (default `false`, opt-in até maturidade SRE), exige `PRR-REPORT.md` com status `passed` para features production-bound antes de arquivar. Status table 3-row (`passed` 6/6 axes ≥ 3/5 = arquivável / `passed-with-warnings` P1 pendente = arquivável com warnings / `failed` P0 reprovado = BLOQUEIA). Coexiste ortogonalmente com gate OMM regression v1.9 — OMM mede observability maturity, PRR mede production readiness (INT-FW-V2-02).
    - **`/auditar-marco`** invoca `/auditar-toil` automaticamente quando `workflow.audit_milestone_toil=true` (default `true`); resultado `.planning/TOIL-AUDIT.md` alimenta scoring OMM Capacidade 3 via `omm-auditor`. Loop fechado canônico: `/auditar-marco` → `/auditar-toil` → `/auditar-observabilidade` → `omm-auditor` consulta `TOIL-AUDIT.md` → `OMM-REPORT.md` inclui Cap 3 → `MILESTONE-AUDIT.md` (INT-FW-V2-03).

    ### Mudado — README ganha seção "SRE Engagement suite (v1.10)"

    `README.md` adiciona nova seção entre "Observability suite (v1.9)" e o separador `---` listando 6 skills + 4 agents + 6 commands + 3 audit gates + lifecycle integration + quick start example end-to-end (PRR antes de produção → instrumentação golden signals → após incident, postmortem chain). Citação canônica ao livro Google SRE 2016 em paridade com a citação a *Observability Engineering* na seção v1.9 (QA-SRE-04).

    ### Sem mudanças de API runtime

    v1.10 é **content-only por design** — zero alterações em `src/core/`, `registry.js`, `sync.js`, ou no MCP server. Stable API v1.0+ totalmente preservada. CI passa sem mudança em `.github/workflows/`. Deps budget mantido em 6/6 (zero deps novas — todo o conteúdo é Markdown).

    ### Tests

    Tests existentes (115 unit + 67 integration acumulados de v1.7) continuam verde. Novos gates não têm tests dedicados (são bash em markdown, executados via `runGate` no framework de gates já testado em `test/unit/gates.test.js`). Smoke validation por gate: PASS na codebase atual (kit-mcp content-only) + FAIL em fixture sintético com gaps + PASS em fixture sintético com cobertura completa — todos os 3 gates novos validados.

    ### Decisões arquiteturais

    - **Conteúdo-only milestone** — zero alterações em `src/core/`. Toda integração com fluxo framework via patches editoriais nos commands `kit/commands/{forense,concluir-marco,auditar-marco}.md` (paridade com pattern v1.9 que adicionou bloco `<observability_integration>` aos mesmos commands).
    - **Specialização sobre overlap** — `golden-signals-instrumenter` é especialização de `observability-instrumenter` (v1.9), não substituto: aquele cuida de spans/atributos canônicos, este cuida de métricas dos 4 signals; ambos podem coexistir num mesmo PR (chain canônica: `observability-instrumenter` primeiro → `golden-signals-instrumenter` segundo).
    - **Chain v1.9 → v1.10** — `incident-investigator` (v1.9) fecha Core Analysis Loop com root cause `VALIDATED` em `.planning/investigations/<id>.md`; `postmortem-writer` (v1.10) consome via `--from-investigation <id>` para gerar `.planning/postmortems/<id>.md`. Handoff é state-based via filesystem (não API).
    - **Gates blocking pre-verify** — `golden-signals-coverage` e `prr-checklist-coverage` são blocking (cobertura mínima é regra absoluta). `postmortem-template-required` é blocking pre-conclude (regra cap 15 "no postmortem left unreviewed" não admite warn-only após adoption).
    - **PRR gate em `/concluir-marco` é opt-in** — diferente do gate OMM regression v1.9 (default `true`, estabelecido), o gate PRR v1.10 é default `false` até time amadurecer cultura SRE. Toggle via `workflow.complete_milestone_prr_gate=true`. Critério de "ligar gate": ≥ 2 dos 4 indicadores (paid feature, SLO definido, on-call rotation, postmortem culture).
    - **Vendor-neutral** — gate `golden-signals-coverage` aceita qualquer pattern com `histogram` / `counter` / `gauge` (OTel, Prometheus, StatsD, Borgmon-like). Livro Google SRE descreve Borgmon mas é proprietário; gate é genérico.

    ### Detalhes

    `.planning/milestones/v1.10.0/` (após `/concluir-marco`).

    ```

    Posicionamento exato: 1 linha em branco após `## [Unreleased]` (linha 7), depois bloco `## [1.10.0] - 2026-05-07` + parágrafos + sub-headings, então 1 linha em branco preservando o `## [1.8.1] - 2026-05-06` original.
  </action>
  <acceptance_criteria>
    - Linha `## [1.10.0] - 2026-05-07` adicionada exatamente 1× entre `## [Unreleased]` e `## [1.8.1] - 2026-05-06`
    - Citação ao livro *Site Reliability Engineering* (Beyer/Jones/Petoff/Murphy, Google/O'Reilly, 2016) presente
    - Seção `### Adicionado — 6 skills SRE foundationais (Phase 36)` presente com 6 bullets
    - Seção `### Adicionado — 4 agents SRE core (Phase 37)` presente com 4 bullets
    - Seção `### Adicionado — 6 commands SRE (Phase 38)` presente com 6 bullets
    - Seção `### Adicionado — 3 audit gates novos (Phase 41)` presente com 3 bullets
    - Seção `### Adicionado — integração com Suíte Observabilidade v1.9 (Phase 39)` presente
    - Seção `### Adicionado — integração com Suíte Supabase v1.8 (Phase 39)` presente
    - Seção `### Mudado — lifecycle hooks no fluxo framework (Phase 40)` presente com 3 patches (INT-FW-V2-01/02/03)
    - Seção `### Mudado — README ganha seção "SRE Engagement suite (v1.10)"` presente
    - Seção `### Sem mudanças de API runtime` presente
    - Seção `### Tests` presente
    - Seção `### Decisões arquiteturais` presente
    - Seção `### Detalhes` presente apontando `.planning/milestones/v1.10.0/`
    - `[Unreleased]` linha 7 preservada
    - `[1.8.1] - 2026-05-06` preservada (não removida)
    - INT-FW-V2-01, INT-FW-V2-02, INT-FW-V2-03 mencionados ≥ 1× cada
    - QA-SRE-04 mencionado em "Mudado — README"
  </acceptance_criteria>
</task>

<task id="41-05-T3" name="Smoke validation — CHANGELOG ordem e conteúdo">
  <read_first>
    - D:/projetos/opensource/mcp/CHANGELOG.md (linhas 1-50 — re-leitura pós-edit)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Nova entrada existe exatamente 1×
    grep -c "^## \[1.10.0\] - 2026-05-07$" CHANGELOG.md  # esperado: 1

    # 2. [Unreleased] preservado
    grep -c "^## \[Unreleased\]$" CHANGELOG.md  # esperado: 1

    # 3. [1.8.1] preservado
    grep -c "^## \[1.8.1\] - 2026-05-06$" CHANGELOG.md  # esperado: 1

    # 4. Ordem correta: [Unreleased] < [1.10.0] < [1.8.1] < [1.8.0]
    UNREL=$(grep -n "^## \[Unreleased\]$" CHANGELOG.md | cut -d: -f1)
    V110=$(grep -n "^## \[1.10.0\] - 2026-05-07$" CHANGELOG.md | cut -d: -f1)
    V181=$(grep -n "^## \[1.8.1\] - 2026-05-06$" CHANGELOG.md | cut -d: -f1)
    V180=$(grep -n "^## \[1.8.0\] - 2026-05-06$" CHANGELOG.md | cut -d: -f1)

    if [ "$UNREL" -lt "$V110" ] && [ "$V110" -lt "$V181" ] && [ "$V181" -lt "$V180" ]; then
      echo "PASS: ordem correta — Unreleased($UNREL) → 1.10.0($V110) → 1.8.1($V181) → 1.8.0($V180)"
    else
      echo "FAIL: ordem incorreta"
    fi

    # 5. Citação livro Google SRE
    grep -c "Site Reliability Engineering" CHANGELOG.md  # esperado: ≥1
    grep -c "Beyer.*Jones.*Petoff.*Murphy\|Google/O.Reilly.*2016" CHANGELOG.md  # esperado: ≥1

    # 6. Sub-seções obrigatórias
    grep -c "### Adicionado — 6 skills SRE foundationais (Phase 36)" CHANGELOG.md  # esperado: 1
    grep -c "### Adicionado — 4 agents SRE core (Phase 37)" CHANGELOG.md           # esperado: 1
    grep -c "### Adicionado — 6 commands SRE (Phase 38)" CHANGELOG.md              # esperado: 1
    grep -c "### Adicionado — 3 audit gates novos (Phase 41)" CHANGELOG.md         # esperado: 1
    grep -c "### Adicionado — integração com Suíte Observabilidade v1.9 (Phase 39)" CHANGELOG.md  # esperado: 1
    grep -c "### Adicionado — integração com Suíte Supabase v1.8 (Phase 39)" CHANGELOG.md  # esperado: 1
    grep -c "### Mudado — lifecycle hooks no fluxo framework (Phase 40)" CHANGELOG.md  # esperado: 1
    grep -c "### Mudado — README ganha seção" CHANGELOG.md  # esperado: 1
    grep -c "### Sem mudanças de API runtime" CHANGELOG.md  # esperado: ≥2 (presente em v1.8.0 e v1.10.0)
    grep -c "### Tests" CHANGELOG.md  # esperado: ≥2
    grep -c "### Decisões arquiteturais" CHANGELOG.md  # esperado: ≥2
    grep -c "### Detalhes" CHANGELOG.md  # esperado: ≥2

    # 7. Skills/agents/commands/gates listados
    grep -c "_shared-sre/glossary.md" CHANGELOG.md       # esperado: ≥1
    grep -c "sre-risk-management" CHANGELOG.md           # esperado: ≥1
    grep -c "four-golden-signals" CHANGELOG.md           # esperado: ≥1
    grep -c "eliminating-toil" CHANGELOG.md              # esperado: ≥1
    grep -c "blameless-postmortems" CHANGELOG.md         # esperado: ≥1
    grep -c "production-readiness-review" CHANGELOG.md   # esperado: ≥1

    grep -c "golden-signals-instrumenter" CHANGELOG.md  # esperado: ≥1
    grep -c "toil-auditor" CHANGELOG.md                 # esperado: ≥1
    grep -c "postmortem-writer" CHANGELOG.md            # esperado: ≥1
    grep -c "prr-conductor" CHANGELOG.md                # esperado: ≥1

    grep -c "/sre <subcommand>\|/sre " CHANGELOG.md     # esperado: ≥1
    grep -c "/golden-signals" CHANGELOG.md              # esperado: ≥1
    grep -c "/auditar-toil" CHANGELOG.md                # esperado: ≥1
    grep -c "/postmortem" CHANGELOG.md                  # esperado: ≥1
    grep -c "/prr" CHANGELOG.md                         # esperado: ≥1
    grep -c "/risk-budget" CHANGELOG.md                 # esperado: ≥1

    grep -c "golden-signals-coverage" CHANGELOG.md       # esperado: ≥1
    grep -c "postmortem-template-required" CHANGELOG.md  # esperado: ≥1
    grep -c "prr-checklist-coverage" CHANGELOG.md        # esperado: ≥1

    # 8. Lifecycle hooks (3 INT-FW-V2-*)
    grep -c "INT-FW-V2-01" CHANGELOG.md  # esperado: ≥1
    grep -c "INT-FW-V2-02" CHANGELOG.md  # esperado: ≥1
    grep -c "INT-FW-V2-03" CHANGELOG.md  # esperado: ≥1

    # 9. QA-SRE-04 mencionado em README section
    grep -c "QA-SRE-04" CHANGELOG.md  # esperado: ≥1

    # 10. Stable API preservada explicitamente
    grep -c "Stable API v1.0+" CHANGELOG.md  # esperado: ≥2 (v1.8.0 e v1.10.0)

    # 11. Diff numstat — pure addition
    git diff --numstat CHANGELOG.md
    # Esperado: insertions > 0; deletions == 0

    # 12. Header [Unreleased] continua placeholder vazio (sem promover conteúdo)
    sed -n '7,10p' CHANGELOG.md
    # Esperado primeira linha "## [Unreleased]", segunda em branco, terceira "## [1.10.0] - 2026-05-07"
    ```
  </action>
  <acceptance_criteria>
    - `## [1.10.0] - 2026-05-07` count = 1
    - `## [Unreleased]` count = 1 (preservado)
    - `## [1.8.1] - 2026-05-06` count = 1 (preservado)
    - Ordem correta: [Unreleased] → [1.10.0] → [1.8.1] → [1.8.0]
    - Site Reliability Engineering citado ≥ 1×
    - Beyer/Jones/Petoff/Murphy citado ≥ 1×
    - 6 sub-headings principais presentes (skills/agents/commands/gates/observability-int/supabase-int + lifecycle + readme)
    - 6 skills, 4 agents, 6 commands, 3 gates listados (cada por nome canônico)
    - 3 INT-FW-V2-* mencionados
    - QA-SRE-04 mencionado
    - "Stable API v1.0+" mencionado (paridade com v1.8.0)
    - `git diff --numstat` zero deletions
    - `[Unreleased]` continua placeholder (sem conteúdo promovido)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Entrada `## [1.10.0] - 2026-05-07` adicionada entre `## [Unreleased]` e `## [1.8.1] - 2026-05-06`
- [ ] Parágrafo introdutório cita livro fonte canônico
- [ ] 6 skills, 4 agents, 6 commands, 3 gates listados em sub-seções dedicadas com bullets
- [ ] Integração com v1.9 (Observability) e v1.8 (Supabase) documentada explicitamente
- [ ] Lifecycle hooks (3 patches Phase 40) listados com flags + REQ-IDs
- [ ] README section noted (QA-SRE-04 cross-ref)
- [ ] `### Sem mudanças de API runtime` presente
- [ ] `### Tests` presente
- [ ] `### Decisões arquiteturais` presente
- [ ] `### Detalhes` presente apontando milestone arquivado futuro
- [ ] `[Unreleased]` placeholder preservado (sem promover conteúdo)
- [ ] `[1.8.1]` preservado (não tocado)
- [ ] `git diff --numstat` zero deletions (puro additive)
- [ ] Cobre QA-SRE-05 integralmente

## Must-haves (goal-backward)

1. Posicionamento canônico — entre `[Unreleased]` e `[1.8.1]` (semver descending)
2. Format Keep a Changelog 1.1.0 (paridade com v1.8.0 entry)
3. Citação livro Google SRE 2016 explícita
4. Inventário completo: 6 skills + 4 agents + 6 commands + 3 gates por nome canônico
5. Integração com Suítes v1.8 + v1.9 documentada (Phase 39 patches)
6. Lifecycle hooks documentados (Phase 40 — 3 INT-FW-V2-*)
7. README section noted (Phase 41 — QA-SRE-04)
8. Decisões arquiteturais não-óbvias documentadas (specialização vs overlap, chain v1.9→v1.10, opt-in PRR gate, vendor-neutral gate)
9. `[Unreleased]` placeholder preservado (continua vazio para próximo cycle)
10. Pure additive — zero deletions no CHANGELOG

## Notes

- **Wave 2 ordering** — depende de Plans 41-01/02/03/04 terem sido executados primeiro porque a entrada lista os 3 gates (Phase 41) e a README section (Phase 41 / Plan 04) como entregáveis. Se executar antes, CHANGELOG documenta artefatos inexistentes
- **Gap v1.9.0 fora de escopo** — CHANGELOG não tem entrada `[1.9.0]` (publicada 2026-05-06 mas entrada nunca foi adicionada). Este plan **NÃO** corrige o gap; apenas menciona "Suíte Observabilidade v1.9.0 (publicada 2026-05-06)" no parágrafo introdutório. Gap separado — caso outro patch precise corrigir CHANGELOG retroativamente, será fase futura
- **Data 2026-05-07** — usar a data atual conforme system-reminder mid-conversation. NOTE: para alinhamento estrito com STATE.md atual (publicação real do milestone v1.10), `/concluir-marco v1.10.0` ajustará data se necessário; este plan registra a data planejada
- **Tom narrativo** — paridade com v1.8.0 entry (PT-BR técnico, en-dashes, citação ao livro fonte, decisões arquiteturais documentadas com justificativa). Não simplificar para bullets-only — entrada precisa ter contexto narrativo para futuros leitores entenderem o "porquê" do milestone
- **Decisões arquiteturais — 6 itens** — documentam escolhas não-óbvias do milestone que valem registro permanente (specialização sobre overlap, chain state-based via filesystem, opt-in PRR gate, vendor-neutral, content-only zero src/core changes, integração ortogonal com gate OMM v1.9)
