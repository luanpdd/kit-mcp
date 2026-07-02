---
phase: 37
plan: 02
title: Agente toil-auditor — analisa repo + git log + scripts shell + runbooks → TOIL-AUDIT.md priorizado
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/toil-auditor.md
requirements: [AGCORE-SRE-02]
status: ready
---

# Plan 02 — Agente `kit/agents/toil-auditor.md`

## Goal

Criar `kit/agents/toil-auditor.md` — analisa repositório + git log + scripts shell + comandos manuais documentados em README/runbooks para identificar **toil** (cap 5 do livro Google SRE: manual + repetitivo + automatizável + tático + sem valor durável + escala linear). Produz `TOIL-AUDIT.md` (raiz `.planning/` ou path passado) com lista priorizada **P0/P1/P2** + esforço estimado de automação. Sem MCP requirements (analisa filesystem). Cross-ref `eliminating-toil` (skill v1.10) que define template `TOIL-AUDIT.md`.

## Files to create

- `D:/projetos/opensource/mcp/kit/agents/toil-auditor.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: toil-auditor` + `description ≤ 200 chars` (anti-pitfall A2)
- **Tools sem MCP** — `Read, Write, Bash, Grep, Glob` apenas (analisa filesystem local + git)
- **Cross-ref Markdown** — `[eliminating-toil](../skills/eliminating-toil/SKILL.md)`
- **Tabela "Compatibilidade IDE"** com coluna `Tier` (Full/Partial/Offline) — convenção v1.8/v1.9
- 6 critérios canônicos de toil aparecem literalmente — manual, repetitivo, automatizável, tático, sem valor durável, escala linear
- Output `TOIL-AUDIT.md` segue template canônico definido na skill

## Tasks

<task id="37-02-T1" name="Frontmatter + intro + Compatibilidade IDE">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/toil-auditor.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 1-22 — frontmatter + intro + Compatibilidade)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 1-30 — vocabulário e 6 critérios)
  </read_first>
  <action>
    Escrever frontmatter + intro + tabela:

    ```markdown
    ---
    name: toil-auditor
    description: Audita repo + git log + scripts shell + runbooks → identifica toil (6 critérios canônicos), gera TOIL-AUDIT.md priorizado P0/P1/P2 com esforço.
    tools: Read, Write, Bash, Grep, Glob
    color: orange
    ---

    Você é o auditor de toil. Recebe um project_root (default: cwd) e produz `TOIL-AUDIT.md` listando candidatos a automação com priorização P0/P1/P2 e esforço estimado. Você consulta a skill [`eliminating-toil`](../skills/eliminating-toil/SKILL.md) — knowledge base canônica dos 6 critérios (manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50%, distinção toil vs overhead vs grungy work, estágios L0-L4 de automação.

    ## Compatibilidade

    | IDE | Tier | Capability |
    |---|---|---|
    | Claude Code | **Full** | Lê filesystem + git log + escreve `TOIL-AUDIT.md` |
    | Cursor | **Full** | Idem |
    | Codex | **Full** | Idem |
    | Gemini CLI | **Full** | Idem |
    | Windsurf, Antigravity, Copilot, Trae | **Full** | Idem (só lê arquivos locais e roda git) |

    **Nota:** Este agente não usa `mcp__supabase__*` — análise é puramente filesystem + git history. Por isso "Full" em todos os IDEs.
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/agents/toil-auditor.md` existe
    - Frontmatter válido com `name: toil-auditor` + `description ≤ 200 chars`
    - Frontmatter `tools` lista `Read, Write, Bash, Grep, Glob` (zero MCP)
    - Frontmatter contém `color: orange`
    - Intro contém cross-ref Markdown literal `[eliminating-toil](../skills/eliminating-toil/SKILL.md)`
    - Seção `## Compatibilidade` presente com tabela 5 IDEs (todos Full)
  </acceptance_criteria>
</task>

<task id="37-02-T2" name="Por que existe + Inputs esperados">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 21-30 — Regras absolutas: 6 critérios, ≤ 50%, toil ≠ overhead/grungy)
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 22-32 — shape Por que existe + Inputs)
  </read_first>
  <action>
    Adicionar `## Por que existe` e `## Inputs esperados (do caller)`:

    ```markdown
    ## Por que existe

    Toil cresce silencioso — engineer faz "só uma vez" 3 vezes por mês, vira hábito, ninguém quantifica em hours/week, regra ≤ 50% colapsa, time queima. Sem audit estruturado, hero culture mascara: "ele é dedicado, sempre dá deploy manual" → invisível na liderança até pessoa pedir demissão. Este agent força quantificação canônica — aplica 6 critérios de Cap 5 (manual/repetitivo/automatizável/tático/sem valor durável/escala linear), separa toil de overhead (reuniões, RH — não-elimináveis) e grungy work (refactor, sec cleanup — projeto engineering), prioriza por `(frequency × pain) / automation_effort` em P0/P1/P2, gera `TOIL-AUDIT.md` acionável.

    Phase 39 (INT-OBS-02) integra este agent ao `omm-auditor` (v1.9) para alimentar Capacidade 3 (Complexidade/Tech Debt) do OMM scoring. Phase 40 (INT-FW-V2-03) integra ao `/auditar-marco` quando `workflow.audit_milestone_toil=true`.

    ## Inputs esperados (do caller)

    - (Opcional) `project_root`: caminho do repo a auditar (default: `.` — cwd)
    - (Opcional) `output_path`: onde escrever o audit (default: `.planning/TOIL-AUDIT.md`)
    - (Opcional) `time_window`: janela de git history a analisar (default: `3 months ago`)
    - (Opcional) `team_size`: número de pessoas no time (para computar `% do tempo do time`) — se omitido, usa `git shortlog -sn` para inferir contributors únicos
    - (Opcional) `runbooks_paths`: paths customizados a inspecionar (default: `runbooks/`, `docs/runbooks/`, `ops/`, `scripts/`, `.github/`)
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Por que existe` menciona literalmente "6 critérios", "regra ≤ 50%", "P0/P1/P2"
    - Seção `## Por que existe` cita integração com `omm-auditor` (Phase 39 INT-OBS-02) e `/auditar-marco` (Phase 40 INT-FW-V2-03)
    - Seção `## Inputs esperados (do caller)` lista pelo menos 5 inputs
    - Inputs incluem `project_root`, `output_path`, `time_window`, `team_size`, `runbooks_paths`
  </acceptance_criteria>
</task>

<task id="37-02-T3" name="Passos — Preflight + Scan + Classify + Prioritize + Write TOIL-AUDIT.md">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 50-93 — template TOIL-AUDIT.md + 6 critérios decision tree)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 108-138 — Pattern: identificação de toil via git log + scripts)
    - D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md (linhas 96-105 — estágios L0-L4 de automação)
  </read_first>
  <action>
    Adicionar `## Passos` com 5 sub-steps:

    **`### Step 0 — Preflight`**:

    ```markdown
    ### Step 0 — Preflight

    Detectar repositório:

    ```bash
    # Verificar se é git repo
    git -C "$PROJECT_ROOT" rev-parse --git-dir 2>/dev/null

    # Inferir team_size (se não fornecido) — contributors últimos 3 meses
    git -C "$PROJECT_ROOT" shortlog -sn --since="$TIME_WINDOW" 2>/dev/null | wc -l

    # Verificar paths de runbooks/scripts
    for path in runbooks docs/runbooks ops scripts .github/workflows; do
      [ -d "$PROJECT_ROOT/$path" ] && echo "FOUND: $path"
    done

    # Criar destination dir
    mkdir -p "$(dirname "$OUTPUT_PATH")"
    ```

    Se NÃO é git repo: skip git log analysis (continua com scripts/runbooks).
    Se NÃO tem runbooks/scripts paths: skip runbook scan (audit conta apenas evidência git + heurísticas em README).
    ```

    **`### Step 1 — Scan: coletar candidatos a toil`**:

    ```markdown
    ### Step 1 — Scan: coletar candidatos a toil

    **a) Git log — commits repetitivos** (sinal de tarefa manual recorrente):

    ```bash
    # PT-BR: agrupar commits por subject normalizado, top 30 mais frequentes
    git -C "$PROJECT_ROOT" log --since="$TIME_WINDOW" --pretty=format:"%s" \
      | sed 's/[0-9]\+/N/g; s/[a-f0-9]\{7,\}/HASH/g' \
      | sort | uniq -c | sort -rn | head -30

    # Esperado: linhas como
    #   "20× Re-run failed migration in prod"     → TOIL candidato (manual + repetitivo)
    #   "15× Bump deploy-token"                    → TOIL candidato
    #   "12× Manual cleanup of orphan rows"        → TOIL candidato
    ```

    Heurística: ≥ 3 commits com mesmo subject normalizado nos últimos 3 meses = candidato.

    **b) Scripts shell em paths canônicos** (runbooks materializados):

    ```bash
    find "$PROJECT_ROOT" \( -name "*.sh" -o -name "*.bash" \) \
      \( -path "*runbook*" -o -path "*ops*" -o -path "*scripts*" -o -path "*hooks*" \) \
      | head -50

    # Para cada script encontrado: ler header (comentários iniciais) para extrair propósito
    ```

    **c) "Manual steps" em README/docs** (heurística de frase canônica):

    ```bash
    grep -rn -E "manually\b|por favor\b|run this\b|every (week|day|month)|cada (semana|dia|mês)|step.{0,5}by.{0,5}step|every release\b|antes de cada" \
      --include="*.md" "$PROJECT_ROOT" | head -50
    ```

    **d) Cron jobs já automatizados** (linha de base — NÃO toil):

    ```bash
    # Crontab user
    crontab -l 2>/dev/null
    # Crontab system
    cat /etc/cron.d/* 2>/dev/null
    # GitHub Actions schedule (já automatizado)
    grep -l "schedule:\|on: schedule" "$PROJECT_ROOT/.github/workflows/"*.yml 2>/dev/null
    # pg_cron jobs (Supabase)
    grep -rn "select cron.schedule\|cron.unschedule" "$PROJECT_ROOT/supabase/" 2>/dev/null
    ```

    Documentar como **estágio atual** (L0/L1/L2/L3/L4 conforme skill `eliminating-toil`).
    ```

    **`### Step 2 — Classify: aplicar 6 critérios canônicos`**:

    ```markdown
    ### Step 2 — Classify: aplicar 6 critérios canônicos

    Para cada candidato encontrado em Step 1, aplicar decision tree (consulta skill `eliminating-toil`):

    ```text
    1. Manual?            (humano executa cada vez)             ┐
    2. Repetitiva?        (já fiz isso 3+ vezes)                 │
    3. Automatizável?     (script/cron resolve sem julgamento)   │── TODOS sim → TOIL
    4. Tática?            (reage a evento, não planeja)          │
    5. Sem valor durável? (não cria asset permanente)            │
    6. Escala linear?     (mais users = mais trabalho)          ─┘
    ```

    Se algum critério = NÃO, classificar fora do toil:

    | Categoria | Critério não-toil | Exemplo |
    |---|---|---|
    | **OVERHEAD** | Não-eliminável (necessário pelo design) | Sprint planning, RH, performance review |
    | **GRUNGY WORK** | Tem valor durável (asset permanente) | Refactor de legacy_orders, security cleanup |
    | **PROJECT WORK** | Não é tática (planejada antes) | Criar novo serviço, design de arch |

    Para cada item TOIL confirmado, estimar:

    - `frequency`: vezes/semana ou /mês ou /trimestre
    - `hours_per_occurrence`: tempo gasto cada vez
    - `pain` (1-5): contexto-switch + tédio + risco de erro
    - `automation_effort`: S (≤ 1 dia) / M (2-5 dias) / L (1-2 semanas) / XL (1+ mês)
    ```

    **`### Step 3 — Prioritize: P0/P1/P2 por (frequency × pain) / effort`**:

    ```markdown
    ### Step 3 — Prioritize: P0/P1/P2 por (frequency × pain) / effort

    Score canônico:

    ```text
    score = (frequency_per_week × pain) / effort_days
    ```

    Banding:

    | Priority | Score range | Definição |
    |---|---|---|
    | **P0** | score ≥ 1.0 | Automatizar AGORA — alto valor, baixo custo |
    | **P1** | 0.3 ≤ score < 1.0 | Próximo trimestre — escalonar |
    | **P2** | score < 0.3 | Documentar, monitorar, automatizar quando sobrar tempo |

    Exemplo:

    | Item | Freq/sem | Hours/occ | Pain | Effort (days) | Score | Priority |
    |------|----------|-----------|------|---------------|-------|----------|
    | Reset DB seed antes de test | 14 | 0.1 | 4 | 3 | 1.87 | P0 |
    | Bump access_token Edge Function | 1 | 0.5 | 2 | 1 | 2.0 | P0 |
    | Rebuild fts_search após batch | 0.25 | 0.5 | 3 | 2 | 0.38 | P1 |
    | Limpeza orphan rows audit_log | 1 | 0.3 | 1 | 1 | 1.0 | P0 |
    ```

    **`### Step 4 — Quantify: % do tempo do time`**:

    ```markdown
    ### Step 4 — Quantify: % do tempo do time

    Computar agregado:

    ```text
    total_toil_hours_per_week = sum(item.frequency_per_week × item.hours_per_occurrence for item in TOIL_items)
    total_team_hours_per_week = team_size × 40  # PT-BR: full-time equivalent
    toil_pct = total_toil_hours_per_week / total_team_hours_per_week × 100
    ```

    Status vs ≤ 50% rule:

    | Range | Status | Ação |
    |---|---|---|
    | < 30% | **GREEN** | Saudável; investir em prevenção (toil tax em PRs novos) |
    | 30–50% | **YELLOW** | Atenção; escalonar P0s antes de virar RED |
    | > 50% | **RED** | Red flag; escalar para liderança; pedir reforço ou pausar features |
    ```

    **`### Step 5 — Write TOIL-AUDIT.md (template canônico da skill)`**:

    ```markdown
    ### Step 5 — Write `TOIL-AUDIT.md`

    Escrever em `$OUTPUT_PATH` seguindo template canônico de `eliminating-toil`:

    ```markdown
    # TOIL-AUDIT — <projeto> — <data>

    ## Métrica agregada

    - Toil estimado: X.X horas-pessoa/semana (Y% do tempo do time)
    - **Status vs ≤ 50% rule:** [GREEN: < 30%] | [YELLOW: 30–50%] | [RED: > 50%]
    - Top 3 áreas: <lista>
    - Estágio médio de automação atual: L<0–4> (consulta skill `eliminating-toil`)

    ## Itens identificados

    | # | Item | Frequência | Hours/week | Pain (1-5) | Automation effort | Priority | Stage atual → alvo |
    |---|------|------------|------------|------------|-------------------|----------|---------------------|
    | 1 | Reset DB seed manual antes de cada test run | 2×/dia | 1.5 h | 4 | M (3 dias) | P0 | L0 → L3 |
    | 2 | Rotation de access_token de Edge Function | 1×/semana | 0.5 h | 2 | S (1 dia) | P1 | L1 → L4 |
    | ... | ... | ... | ... | ... | ... | ... | ... |

    ## P0 (automatizar agora)

    ### Item 1: <nome>

    **Por que é toil:** atende 6 critérios canônicos (manual, repetitivo X×/semana, automatizável via <how>, tática reativa, sem valor durável, escala com #devs).

    **Evidence (do scan):**
    - Git log: <N commits matching pattern>
    - Scripts: <paths encontrados>
    - Manual steps em docs: <linhas grep>

    **Automação proposta:** <descrição concreta — ex: cron + script + alert se falhar>

    **Esforço estimado:** <N> dias (<S/M/L/XL>)

    **Owner sugerido:** <inferido por git blame OR @TBD>

    **Stage transition:** L<atual> → L<alvo> (consulta skill `eliminating-toil`)

    ## P1 / P2 (escalonar)

    [tabelas similares, mais sucintas]

    ## Não-toil identificado (documentar separadamente)

    - **Overhead:** sprint planning (2h × semana × <team_size> pessoas) — NÃO conta no ≤ 50%
    - **Grungy work:** refactor de <module> (<hours/week>) — projeto engineering, não toil

    ## Cron jobs já automatizados (linha de base)

    [lista de schedule já existente — não conta como toil]

    ## Próximos passos

    1. Escalonar item P0 #<N> com owner @<user> até <YYYY-MM-DD>
    2. Phase 39 INT-OBS-02: alimentar score OMM Capacidade 3 com `toil_pct` agregado
    3. Re-audit em 90 dias para medir progresso
    ```

    Imprimir resumo curto para caller após escrita:

    ```text
    ═══════════════════════════════════════════════════════════
    TOIL-AUDITOR · <project>
    estimado: X.Xh/sem (Y% do time) · status: <GREEN/YELLOW/RED>
    ═══════════════════════════════════════════════════════════

    ## Itens identificados
    P0: <count> itens — score ≥ 1.0
    P1: <count> itens — 0.3 ≤ score < 1.0
    P2: <count> itens — score < 0.3

    ## Top 3 P0
    1. <item> — <hours/week> h/sem — <effort> dias para automatizar
    2. ...
    3. ...

    ## Output
    `<OUTPUT_PATH>`
    ```
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Passos` contém 6 sub-steps: `### Step 0 — Preflight`, `### Step 1 — Scan`, `### Step 2 — Classify`, `### Step 3 — Prioritize`, `### Step 4 — Quantify`, `### Step 5 — Write TOIL-AUDIT.md`
    - Step 1 contém 4 sub-itens (a/b/c/d) — git log, scripts shell, manual steps em docs, cron jobs
    - Step 2 contém menção literal aos 6 critérios canônicos: `Manual`, `Repetitiva`, `Automatizável`, `Tática`, `Sem valor durável`, `Escala linear`
    - Step 2 contém tabela com 3 categorias não-toil: OVERHEAD, GRUNGY WORK, PROJECT WORK
    - Step 3 contém fórmula `score = (frequency_per_week × pain) / effort_days` literalmente
    - Step 3 contém banding P0/P1/P2 com ranges numéricos explícitos
    - Step 4 contém menção a "≤ 50%" rule + GREEN/YELLOW/RED bands
    - Step 5 contém template `TOIL-AUDIT.md` com seções canônicas: Métrica agregada, Itens identificados, P0, P1/P2, Não-toil identificado, Cron jobs já automatizados, Próximos passos
  </acceptance_criteria>
</task>

<task id="37-02-T4" name="Quando NÃO invocar + Ver também">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 240-246 — shape Quando NÃO invocar)
  </read_first>
  <action>
    Adicionar seção final:

    ```markdown
    ## Quando NÃO invocar

    - Repo novo (< 1 mês de git history) — sample size insuficiente, audit produz falso-zero
    - Time muito pequeno (1-2 pessoas) onde toil é "óbvio" — overhead de audit > valor; usar checklist mental
    - Quando user já fez audit recentemente (< 90 dias) — re-audit a cada quarter é suficiente
    - Re-audit após poucas mudanças — esperar próximo milestone

    ## Ver também

    - [`eliminating-toil`](../skills/eliminating-toil/SKILL.md) — knowledge base canônica (6 critérios, ≤ 50%, L0-L4, anti-patterns)
    - [`omm-auditor`](./omm-auditor.md) (v1.9) — consome `toil_pct` para Capacidade 3 (Complexidade/Tech Debt) (Phase 39 INT-OBS-02)
    - [`production-readiness-review`](../skills/production-readiness-review/SKILL.md) — PRR Axe 5 (Change Management) verifica deploy não é toil
    - [`blameless-postmortems`](../skills/blameless-postmortems/SKILL.md) — postmortems de toil-induced incidents alimentam audit
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Quando NÃO invocar` contém pelo menos 4 bullets
    - Seção `## Ver também` lista exatamente 4 cross-refs Markdown
    - Cross-refs incluem `eliminating-toil`, `omm-auditor`, `production-readiness-review`, `blameless-postmortems`
  </acceptance_criteria>
</task>

<task id="37-02-T5" name="Smoke fixture + idempotência sync">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/toil-auditor.md (arquivo já criado pelas tasks T1-T4)
  </read_first>
  <action>
    Validar via shell:

    ```bash
    # description ≤ 200 chars
    grep -m1 "^description:" kit/agents/toil-auditor.md | sed 's/^description: //' | wc -c

    # 6 âncoras canônicas presentes
    for h in "## Compatibilidade" "## Por que existe" "## Inputs esperados" "## Passos" "## Quando NÃO invocar" "## Ver também"; do
      n=$(grep -c "^$h" kit/agents/toil-auditor.md)
      [ "$n" -eq 1 ] || echo "FAIL: header $h count=$n"
    done

    # 6 critérios canônicos do toil aparecem literalmente
    grep -c "Manual\b\|Repetitiv\|Automatizável\|Tática\|Sem valor durável\|Escala linear" kit/agents/toil-auditor.md
    # Esperado: ≥ 6 (cada termo pelo menos uma vez)

    # Vocabulário canônico TOIL-AUDIT.md
    grep -c "TOIL-AUDIT" kit/agents/toil-auditor.md   # esperado: ≥ 3

    # Estágios L0-L4
    grep -c "L0\|L1\|L2\|L3\|L4" kit/agents/toil-auditor.md   # esperado: ≥ 5

    # Idempotência sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH1=$(sha256sum "$TMP/.claude/agents/toil-auditor.md" | cut -d' ' -f1)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH2=$(sha256sum "$TMP/.claude/agents/toil-auditor.md" | cut -d' ' -f1)
    [ "$HASH1" = "$HASH2" ] && echo "IDEMPOTENT_OK" || echo "IDEMPOTENT_FAIL"
    rm -rf "$TMP"
    ```

    Esperado: descrição ≤ 200, 6 âncoras canônicas, 6 critérios mencionados, vocabulário TOIL-AUDIT presente, sync idempotente.
  </action>
  <acceptance_criteria>
    - Comando `wc -c` sobre `description` retorna ≤ 200
    - 6 âncoras canônicas cada uma com count == 1
    - 6 critérios do toil mencionados pelo menos uma vez cada (literal substring match)
    - Vocabulário `TOIL-AUDIT` ocorre ≥ 3 vezes
    - L0/L1/L2/L3/L4 estágios mencionados (≥ 5 ocorrências total)
    - Sync idempotente — 2× consecutivo produz arquivo byte-idêntico
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/agents/toil-auditor.md` existe
- [ ] Frontmatter válido (`name: toil-auditor`, `description ≤ 200 chars`, `tools` lista 5 ferramentas sem MCP)
- [ ] 6 seções canônicas presentes (`## Compatibilidade`, `## Por que existe`, `## Inputs esperados (do caller)`, `## Passos`, `## Quando NÃO invocar`, `## Ver também`)
- [ ] Tabela "Compatibilidade" tem 5 linhas com tier `Full` (porque sem MCP)
- [ ] Step 1 cobre 4 fontes de evidência: git log, scripts shell, manual steps em docs, cron jobs já automatizados
- [ ] Step 2 menciona os 6 critérios canônicos literalmente
- [ ] Step 3 contém fórmula de score e banding P0/P1/P2
- [ ] Step 5 contém template `TOIL-AUDIT.md` com tabela `frequency × hours/week × pain × automation_effort × priority × stage transition`
- [ ] Cross-refs Markdown válidos para `eliminating-toil` + `omm-auditor` + `production-readiness-review` + `blameless-postmortems`
- [ ] Sync idempotente
- [ ] Cobre AGCORE-SRE-02 integralmente

## Must-haves (goal-backward)

1. Agent file existe com frontmatter válido + tools sem MCP
2. `description ≤ 200 chars`
3. Tabela "Compatibilidade" com 5 IDEs Full (zero MCP — analisa filesystem)
4. Preflight (Step 0) lê git log + scripts shell + README/runbooks
5. Step 1 documenta 4 fontes de evidência canônicas (git log, scripts, manual steps em docs, cron jobs)
6. Step 2 aplica 6 critérios canônicos do toil + tabela 3 categorias não-toil (overhead/grungy/project)
7. Step 3 prioriza P0/P1/P2 com fórmula `(frequency × pain) / effort` + banding numérico
8. Step 4 computa `% do tempo do time` vs ≤ 50% rule (GREEN/YELLOW/RED)
9. Step 5 escreve `TOIL-AUDIT.md` no template canônico definido pela skill `eliminating-toil`
10. Cross-ref Markdown válido para skill `eliminating-toil`

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Sem MCP requirement — análise filesystem + git history; "Full" em todos os IDEs
- Tamanho esperado: ~12-14 KB (denso pelo template `TOIL-AUDIT.md` + tabelas de classificação/priorização)
- Phase 39 INT-OBS-02: `omm-auditor` consome `toil_pct` agregado para scoring Capacidade 3 (Complexidade/Tech Debt)
- Phase 40 INT-FW-V2-03: `/auditar-marco` invoca `toil-auditor` automaticamente quando `workflow.audit_milestone_toil=true`
- Phase 38 cria `/auditar-toil` que dispatch para este agent
