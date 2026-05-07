---
phase: 41
plan: 04
title: README — adicionar seção SRE Engagement (v1.10)
wave: 2
depends_on: [41-01, 41-02, 41-03]
autonomous: true
files_modified:
  - README.md
requirements: [QA-SRE-04]
status: ready
---

# Plan 04 — Patch `README.md` — adicionar seção "SRE Engagement (v1.10)"

## Goal

Adicionar nova seção "**SRE Engagement (v1.10)**" no `README.md` listando: **6 skills** (`_shared-sre/glossary` + `sre-risk-management` + `four-golden-signals` + `eliminating-toil` + `blameless-postmortems` + `production-readiness-review`), **4 agents** (`golden-signals-instrumenter` + `toil-auditor` + `postmortem-writer` + `prr-conductor`), **6 commands** (`/sre <subcomando>` orquestrador + `/golden-signals` + `/auditar-toil` + `/postmortem` + `/prr` + `/risk-budget`) e **3 audit gates** (`golden-signals-coverage` + `postmortem-template-required` + `prr-checklist-coverage`). Inclui exemplo de uso end-to-end (PRR antes de produção → instrumentação → após incident, postmortem). Cobre **QA-SRE-04**.

## Files to modify

- `D:/projetos/opensource/mcp/README.md`

## Constraints (anti-pitfall reminders)

- **Posicionamento canônico** — nova seção `### SRE Engagement (v1.10)` adicionada **imediatamente após** a seção `### Observability suite (v1.9)` (linhas 66-103) e **antes** do separador `---` na linha 104. Mantém ordem cronológica das suítes (v1.8 → v1.9 → v1.10)
- **Tom canônico** — registro EN como o resto do README; comentários inline curtos; bullet pointers consistentes (`- name — descrição`)
- **Cross-ref ao livro** — citar fonte canônica *Site Reliability Engineering: How Google Runs Production Systems* (Beyer/Jones/Petoff/Murphy, Google/O'Reilly, 2016) — paridade com seção v1.9 que cita *Observability Engineering*
- **Mencionar integração com v1.8 + v1.9** — destacar que v1.10 SRE compõe a stack (Supabase v1.8 + Observability v1.9 + SRE v1.10 = production engineering suite)
- **Frontmatter README.md NÃO existe** — não há frontmatter a preservar; arquivo é README puro
- **Badges (linhas 3-6) inalteradas** — npm version / downloads / CI / License preservadas
- **Inventário de capacidades existentes** — nova seção pode citar números no resto do README (e.g., "19 agents", "60 slash-commands") apenas se houver sub-bullet específico; o resto do README já lista totais — não atualizar contadores fora da nova seção (escopo é apenas adicionar seção; updates de contadores fora do escopo)

## Tasks

<task id="41-04-T1" name="Validar âncoras de patch e estrutura existente">
  <read_first>
    - D:/projetos/opensource/mcp/README.md (linhas 60-105 — confirmar âncora "### Observability suite (v1.9)" + separador "---" linha 104)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar que linha 66 começa com `### Observability suite (v1.9)`
    2. Confirmar que linha 104 é `---` (separador entre seção observability e prerequisites)
    3. Confirmar que entre linhas 66-103 há 4 sub-blocos:
       - Parágrafo introdutório (linhas 67-68)
       - "**11 skills** in `kit/skills/`:" + bullets (linhas 70-75)
       - "**5 agents** in `kit/agents/`:" + bullets (linhas 77-82)
       - "**6 commands**:" + bullets (linhas 84-90)
       - "**Quick start example:**" + bash code-fence (linhas 92-102)
    4. Confirmar que paths Markdown relativos do README usam estilo compatível com GitHub viewer (não absolute paths)
  </action>
  <acceptance_criteria>
    - Linha 66 = "### Observability suite (v1.9)"
    - Linha 104 = "---"
    - 4 sub-blocos confirmados
    - Path style relativo confirmado
  </acceptance_criteria>
</task>

<task id="41-04-T2" name="Inserir seção SRE Engagement (v1.10) após Observability suite (v1.9)">
  <read_first>
    - D:/projetos/opensource/mcp/README.md (linhas 100-110 — re-leitura precisa do ponto de inserção)
  </read_first>
  <action>
    Usar Edit para inserir, **imediatamente após** a linha 102 (o code-fence final ` ``` ` da seção v1.9 quick start) e **antes** do separador `---` na linha 104, o novo bloco:

    ```markdown

    ### SRE Engagement suite (v1.10)

    A production engineering layer derived from *Site Reliability Engineering: How Google Runs Production Systems* (Beyer, Jones, Petoff, Murphy — Google/O'Reilly, 2016) ships in the kit. It composes with the Supabase suite (v1.8) and the Observability suite (v1.9) into a coherent production engineering stack — Supabase agents now suggest PRR before launch, every Edge Function template includes the **4 golden signals**, and `incident-investigator` outputs feed directly into blameless postmortems via `/postmortem --from-investigation <id>`.

    **6 skills** in `kit/skills/`:
    - `_shared-sre/glossary.md` — canonical bilingual vocabulary (PT-BR↔EN) — SLI/SLO/SLA, error budget, burn rate, toil, postmortem, blameless, PRR, golden signals, risk continuum, MTTR/MTBF
    - `sre-risk-management` — risk continuum (cap 3), 99.99% wisdom ("as reliable as needs to be, no more"), error budget as explicit risk × innovation balance
    - `four-golden-signals` — Latency + Traffic + Errors + Saturation (cap 6), histograms with exponential bucketing, success vs error latency separated, percentiles vs mean (long tail)
    - `eliminating-toil` — canonical toil definition (manual + repetitive + automatable + tactical + no enduring value + scales linearly), ≤ 50% rule (cap 5), automation patterns
    - `blameless-postmortems` — canonical 9-section template (cap 15), "no postmortem left unreviewed", blame culture as anti-pattern, Wheel of Misfortune
    - `production-readiness-review` — PRR checklist (cap 32) — 6 axes (System architecture, Instrumentation, Emergency response, Capacity planning, Change management, Performance), 3 engagement models

    **4 agents** in `kit/agents/`:
    - `golden-signals-instrumenter` — specialization of `observability-instrumenter` (v1.9); generates OTel patches with the 4 golden signals (Latency=histogram, Traffic=counter, Errors=counter by `error.type`, Saturation=gauge)
    - `toil-auditor` — analyzes git log + shell scripts + manual commands in README/runbooks; produces `TOIL-AUDIT.md` with P0/P1/P2 priority + estimated effort
    - `postmortem-writer` — natural continuation of `incident-investigator` (v1.9); reads `.planning/investigations/<id>.md` and produces blameless postmortem (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC)
    - `prr-conductor` — conducts Production Readiness Review for service/feature; reads schema (Supabase MCP), Edge Functions, `.planning/slos/`, audit logs; produces `PRR-REPORT.md` scored across the 6 axes

    **6 commands**:
    - `/sre <subcommand>` — single orchestrator (analog to `/supabase` v1.8 and `/observabilidade` v1.9) — dispatches to the 4 agents with PT/EN synonyms
    - `/golden-signals` — invokes `golden-signals-instrumenter` for service/Edge Function/phase; generates `GOLDEN-SIGNALS.md` with OTel-ready instrumentation
    - `/auditar-toil` — invokes `toil-auditor`; generates `.planning/TOIL-AUDIT.md`
    - `/postmortem` — invokes `postmortem-writer`; supports `--from-investigation <id>` (continue from v1.9 investigation) or `--incident "<description>"` (standalone)
    - `/prr` — invokes `prr-conductor`; supports `--service <name>` or `--feature <description>`; generates `PRR-REPORT.md`
    - `/risk-budget` — displays current error budget vs risk continuum, citing SLOs from v1.9 (`.planning/slos/`); applies `sre-risk-management` skill

    **3 audit gates** in `gates/`:
    - `golden-signals-coverage` (blocking, pre-verify) — verifies code in `supabase/functions/**`, `src/**`, `lib/**` covers the 4 golden signals (skips gracefully on content-only phases)
    - `postmortem-template-required` (blocking, pre-conclude) — blocks `/concluir-marco` if any `.planning/investigations/<id>.md` lacks a corresponding `.planning/postmortems/<id>.md` (`Status: INCONCLUSIVE` is the only exception)
    - `prr-checklist-coverage` (blocking, pre-verify) — verifies every `PRR-REPORT.md` in `.planning/prr/**/*.md` covers the 6 canonical axes; "skipping an axe = invalid approval"

    **Lifecycle integration:**
    - `/forense` — after Core Analysis Loop closes with VALIDATED root cause, suggests chain `/postmortem --from-investigation <id>` (Phase 40 / INT-FW-V2-01)
    - `/concluir-marco` — opt-in gate `workflow.complete_milestone_prr_gate=true` requires `PRR-REPORT.md` with status `passed` for production-bound features before archive (Phase 40 / INT-FW-V2-02)
    - `/auditar-marco` — auto-invokes `/auditar-toil` when `workflow.audit_milestone_toil=true` (default); result feeds OMM Capacidade 3 scoring via `omm-auditor` (Phase 40 / INT-FW-V2-03)

    **Quick start example — end-to-end SRE workflow:**
    ```bash
    # Before launching a new feature in production — PRR
    /sre prr --feature "checkout v2"

    # While instrumenting service — apply 4 golden signals
    /sre golden-signals supabase/functions/orders/index.ts

    # Audit team toil quarterly
    /sre toil

    # When SLO burn alert fires — investigate (v1.9), then postmortem (v1.10)
    /forense "checkout SLO burn rate = 8 às 14:32"
    /sre postmortem --from-investigation checkout-2026-05-07

    # Risk dashboard against SLO budgets
    /sre risk-budget
    ```

    ```

    Padrão de inserção: 1 linha em branco antes de `### SRE Engagement suite (v1.10)`, 1 linha em branco depois do code-fence final, depois mantém o `---` original (linha pré-patch 104).
  </action>
  <acceptance_criteria>
    - Nova seção `### SRE Engagement suite (v1.10)` inserida entre `### Observability suite (v1.9)` (existente) e `---` separador
    - Citação ao livro *Site Reliability Engineering* (Beyer/Jones/Petoff/Murphy, Google/O'Reilly, 2016) presente no parágrafo introdutório
    - "**6 skills** in `kit/skills/`:" presente com 6 bullets (`_shared-sre/glossary.md` + 5 skills foundationais)
    - "**4 agents** in `kit/agents/`:" presente com 4 bullets (`golden-signals-instrumenter`, `toil-auditor`, `postmortem-writer`, `prr-conductor`)
    - "**6 commands**:" presente com 6 bullets (`/sre`, `/golden-signals`, `/auditar-toil`, `/postmortem`, `/prr`, `/risk-budget`)
    - "**3 audit gates** in `gates/`:" presente com 3 bullets (`golden-signals-coverage`, `postmortem-template-required`, `prr-checklist-coverage`)
    - "**Lifecycle integration:**" presente com 3 bullets (`/forense`, `/concluir-marco`, `/auditar-marco`)
    - "**Quick start example — end-to-end SRE workflow:**" presente com bash code-fence
    - Exemplo end-to-end inclui pelo menos: `/sre prr`, `/sre golden-signals`, `/forense`, `/sre postmortem --from-investigation`
    - Menção a integração com v1.8 + v1.9 explícita (Supabase + Observability formam stack com SRE)
    - Separador `---` original preservado pós-inserção
    - Badges (linhas 3-6) inalteradas
  </acceptance_criteria>
</task>

<task id="41-04-T3" name="Smoke validation — README parsing e conteúdo">
  <read_first>
    - D:/projetos/opensource/mcp/README.md (linhas 60-180 — re-leitura ampla pós-edit para confirmar inserção)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Nova seção existe exatamente 1×
    grep -c "^### SRE Engagement suite (v1.10)$" README.md  # esperado: 1

    # 2. Seção v1.9 ainda existe (não removida nem duplicada)
    grep -c "^### Observability suite (v1.9)$" README.md  # esperado: 1

    # 3. Posicionamento — v1.9 vem antes de v1.10
    OBS_LINE=$(grep -n "^### Observability suite (v1.9)$" README.md | cut -d: -f1)
    SRE_LINE=$(grep -n "^### SRE Engagement suite (v1.10)$" README.md | cut -d: -f1)
    if [ "$SRE_LINE" -gt "$OBS_LINE" ]; then
      echo "PASS: ordem correta v1.9 ($OBS_LINE) → v1.10 ($SRE_LINE)"
    else
      echo "FAIL: v1.10 ($SRE_LINE) antes de v1.9 ($OBS_LINE)"
    fi

    # 4. Citação livro Google SRE
    grep -c "Site Reliability Engineering" README.md  # esperado: ≥1
    grep -c "Beyer.*Jones.*Petoff.*Murphy\|Google/O.Reilly.*2016" README.md  # esperado: ≥1

    # 5. Inventário canônico — 6 skills, 4 agents, 6 commands, 3 gates
    grep -c "\*\*6 skills\*\* in \`kit/skills/\`:" README.md  # esperado: ≥1
    grep -c "\*\*4 agents\*\* in \`kit/agents/\`:" README.md  # esperado: ≥1
    grep -c "\*\*6 commands\*\*:" README.md  # esperado: ≥2 (v1.9 também usa esta string — esperado: 2 cada)
    grep -c "\*\*3 audit gates\*\* in \`gates/\`:" README.md  # esperado: 1 (string única v1.10)

    # 6. Skills v1.10 listadas
    grep -c "_shared-sre/glossary.md" README.md            # esperado: 1
    grep -c "sre-risk-management" README.md                # esperado: ≥1
    grep -c "four-golden-signals" README.md                # esperado: ≥1
    grep -c "eliminating-toil" README.md                   # esperado: ≥1
    grep -c "blameless-postmortems" README.md              # esperado: ≥1
    grep -c "production-readiness-review" README.md        # esperado: ≥1

    # 7. Agents v1.10 listados
    grep -c "golden-signals-instrumenter" README.md  # esperado: ≥1
    grep -c "toil-auditor" README.md                  # esperado: ≥1
    grep -c "postmortem-writer" README.md             # esperado: ≥1
    grep -c "prr-conductor" README.md                 # esperado: ≥1

    # 8. Commands v1.10 listados
    grep -c "^- \`/sre " README.md  # esperado: ≥1 (orquestrador)
    grep -c "/golden-signals" README.md      # esperado: ≥1
    grep -c "/auditar-toil" README.md        # esperado: ≥1
    grep -c "/postmortem" README.md          # esperado: ≥1
    grep -c "^- \`/prr\`" README.md          # esperado: ≥1 (no exemplo /sre prr também aparece — mas bullet de comando é único)
    grep -c "/risk-budget" README.md         # esperado: ≥1

    # 9. Gates v1.10 listados
    grep -c "golden-signals-coverage" README.md             # esperado: ≥1
    grep -c "postmortem-template-required" README.md         # esperado: ≥1
    grep -c "prr-checklist-coverage" README.md               # esperado: ≥1

    # 10. Lifecycle integration listada
    grep -c "INT-FW-V2-01" README.md  # esperado: 1
    grep -c "INT-FW-V2-02" README.md  # esperado: 1
    grep -c "INT-FW-V2-03" README.md  # esperado: 1

    # 11. Quick start example end-to-end
    grep -c "Quick start example.*end-to-end SRE workflow\|end-to-end SRE workflow" README.md  # esperado: ≥1
    grep -c "/sre prr" README.md                              # esperado: ≥1
    grep -c "/sre golden-signals" README.md                  # esperado: ≥1
    grep -c "/sre postmortem --from-investigation" README.md  # esperado: ≥1

    # 12. Badges preservadas (linhas 3-6 byte-idênticas)
    head -6 README.md
    # Esperado preservado byte-a-byte:
    # # kit-mcp
    # 
    # [![npm version](https://img.shields.io/npm/v/@luanpdd/kit-mcp.svg)](...)
    # [![npm downloads](https://img.shields.io/npm/dm/@luanpdd/kit-mcp.svg)](...)
    # [![CI](https://github.com/luanpdd/kit-mcp/actions/workflows/ci.yml/badge.svg)](...)
    # [![License: MIT](...)](...)

    # 13. Diff numstat — pure addition (zero deletions)
    git diff --numstat README.md
    # Esperado: insertions > 0; deletions == 0
    ```
  </action>
  <acceptance_criteria>
    - `^### SRE Engagement suite (v1.10)$` count = 1
    - `^### Observability suite (v1.9)$` count = 1 (preservado)
    - Ordem v1.9 → v1.10 correta (linha v1.10 > linha v1.9)
    - "Site Reliability Engineering" citado ≥ 1×
    - "Beyer.*Jones.*Petoff.*Murphy" OR "Google/O'Reilly.*2016" citado ≥ 1×
    - 6 skills listadas (sre-* + 4 outras + glossário) — cada string presente ≥ 1×
    - 4 agents listados (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor)
    - 6 commands listados
    - 3 gates listados
    - 3 INT-FW-V2-* refs
    - Exemplo end-to-end com `/sre prr`, `/sre golden-signals`, `/sre postmortem --from-investigation`
    - Badges (linhas 3-6) byte-idênticas
    - `git diff --numstat` mostra deletions == 0 (pure additive)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Nova seção `### SRE Engagement suite (v1.10)` adicionada após `### Observability suite (v1.9)` e antes do separador `---`
- [ ] Citação ao livro Google SRE (Beyer/Jones/Petoff/Murphy, Google/O'Reilly, 2016) presente
- [ ] 6 skills listadas com descrições curtas
- [ ] 4 agents listados com descrições curtas
- [ ] 6 commands listados (`/sre` + 5)
- [ ] 3 audit gates listados
- [ ] Lifecycle integration listada (3 bullets cross-ref Phase 40 INT-FW-V2-*)
- [ ] Quick start example end-to-end com pipeline canônico (PRR → golden-signals → forense → postmortem)
- [ ] Menção explícita a v1.8 (Supabase) + v1.9 (Observability) formando stack com v1.10
- [ ] Badges (linhas 3-6) inalteradas
- [ ] `git diff --numstat` mostra zero deletions
- [ ] Cobre QA-SRE-04 integralmente

## Must-haves (goal-backward)

1. Posicionamento canônico — entre seção v1.9 e separador `---` (ordem cronológica)
2. Inventário completo: 6 skills + 4 agents + 6 commands + 3 gates listados
3. Citação ao livro fonte explícita (paridade com seção v1.9 que cita Charity Majors et al.)
4. Exemplo end-to-end mostrando pipeline canônico SRE (PRR antes → instrumentation → after incident postmortem)
5. Lifecycle integration explícita — 3 patches em fluxo framework cross-referenciados
6. Tom canônico EN; bullets consistentes; comentários inline curtos
7. Menção explícita a stack production engineering = v1.8 (Supabase) + v1.9 (Observability) + v1.10 (SRE)
8. Pure additive — zero deletions em README

## Notes

- **Wave 2 ordering** — depende de Plans 41-01/02/03 (gates) terem sido executados primeiro porque a seção lista os 3 gates novos por nome canônico. Se gates não existirem, README documenta artefatos inexistentes (incoerência)
- **Não atualiza contadores fora da seção** — README também menciona "19 agents", "60 slash-commands" em outros locais; estes contadores são responsabilidade de outros patches (e.g., bump em release process). Escopo desta task é apenas adicionar nova seção
- **Comando `/sre`** vs comando individual — README lista `/sre <subcommand>` como orquestrador (paridade com `/supabase` e `/observabilidade`); subcomandos `/golden-signals`, `/auditar-toil`, `/postmortem`, `/prr`, `/risk-budget` continuam acessíveis individualmente
- **Cross-refs Phase 40** — os 3 INT-FW-V2-* mencionados são lifecycle hooks já entregues nas Phases 40-01/02/03; este README só documenta visibilidade pública desses hooks
