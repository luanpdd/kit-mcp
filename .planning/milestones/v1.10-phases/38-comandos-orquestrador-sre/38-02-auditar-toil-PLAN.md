---
phase: 38
plan: 02
title: Comando /auditar-toil — wrapper que dispatch para toil-auditor
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/auditar-toil.md
requirements: [CMD-SRE-02]
status: ready
---

# Plan 02 — Comando `kit/commands/auditar-toil.md`

## Goal

Criar `kit/commands/auditar-toil.md` — comando wrapper que invoca `toil-auditor` (Phase 37 Plan 02) via `Task(subagent_type=...)`. Gera `TOIL-AUDIT.md` na raiz `.planning/` com lista priorizada P0/P1/P2 de candidatos a automação + esforço estimado. Modelo de wrapper segue precedente `kit/commands/instrumentar-fase.md` (v1.9). Cobre **CMD-SRE-02**.

## Files to create

- `D:/projetos/opensource/mcp/kit/commands/auditar-toil.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: auditar-toil` + `description ≤ 200 chars` (anti-pitfall A2)
- **`allowed-tools` inclui `Task`** — wrapper invoca agent via Task dispatch
- **Cross-ref Markdown** ativo para `toil-auditor` + skill `eliminating-toil`
- **Wrapper puro** — comando NÃO duplica análise do agent; apenas parseia args + dispatch + output forwarding
- **Output em `.planning/TOIL-AUDIT.md`** — caminho canônico (não dentro de fase específica)

## Tasks

<task id="38-02-T1" name="Frontmatter + objective + context">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/auditar-toil.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/commands/instrumentar-fase.md (linhas 1-30 — frontmatter + objective + context)
    - D:/projetos/opensource/mcp/kit/agents/toil-auditor.md (linhas 1-35 — frontmatter + Inputs esperados)
  </read_first>
  <action>
    Escrever frontmatter + `<objective>` + `<context>`:

    ```markdown
    ---
    name: auditar-toil
    description: Invoca toil-auditor — analisa repo + git log + scripts + runbooks; gera .planning/TOIL-AUDIT.md priorizado P0/P1/P2 com esforço de automação.
    argument-hint: "[--time-window 3m] [--team-size N] [--output PATH]"
    allowed-tools:
      - Read
      - Write
      - Bash
      - Grep
      - Glob
      - Task
    ---

    <objective>
    Auditar o repositório atual em busca de **toil** (cap 5 do livro Google SRE) — trabalho manual, repetitivo, automatizável, tático, sem valor durável que escala linear com tráfego/usuários. Invoca o agente [`toil-auditor`](../agents/toil-auditor.md) que aplica a skill [`eliminating-toil`](../skills/eliminating-toil/SKILL.md) — 6 critérios canônicos, regra ≤ 50%, distinção toil vs overhead vs grungy work.

    **Cria/Atualiza:**
    - `.planning/TOIL-AUDIT.md` — lista priorizada P0/P1/P2 com 6 critérios scored + esforço de automação estimado

    **Após:** o user tem audit acionável para reduzir toil pelo time. Phase 39 INT-OBS-02 integra ao `omm-auditor` (v1.9) — Capacidade 3 do OMM scoring usa este audit.
    </objective>

    <context>
    **Argumentos:** `$ARGUMENTS` — todas as flags são opcionais; comando funciona com defaults.

    **Flags:**
    - `--time-window <Nm|Nd>` — janela de git history a analisar (default: `3m` = 3 meses)
    - `--team-size <N>` — número de pessoas no time (default: inferido via `git shortlog -sn`)
    - `--output <path>` — caminho do output (default: `.planning/TOIL-AUDIT.md`)
    - `--runbooks-paths <p1,p2,...>` — paths customizados de runbooks (default: `runbooks/, docs/runbooks/, ops/, scripts/, .github/workflows/`)

    **Exemplos:**
    ```
    /auditar-toil                                            # defaults — 3m de git, team auto-detect
    /auditar-toil --time-window 6m --team-size 5             # janela maior + team explícito
    /auditar-toil --output .planning/audit/toil-2026-Q2.md   # path customizado
    ```

    **Pré-requisito:** repositório git inicializado (sem isso, agent skip git log analysis e usa apenas scripts/runbooks).
    </context>
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/commands/auditar-toil.md` existe
    - Frontmatter válido com `name: auditar-toil` + `description ≤ 200 chars`
    - Frontmatter `allowed-tools` lista `Task` (essencial para dispatch)
    - `<objective>` contém cross-ref Markdown literal `[toil-auditor](../agents/toil-auditor.md)` E `[eliminating-toil](../skills/eliminating-toil/SKILL.md)`
    - `<objective>` menciona explicitamente o output canônico `.planning/TOIL-AUDIT.md` E priorização P0/P1/P2
    - `<context>` lista as 4 flags com defaults documentados
    - `<context>` contém pelo menos 3 exemplos de uso
  </acceptance_criteria>
</task>

<task id="38-02-T2" name="Process — parsear, validar, dispatch, link com OMM">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/instrumentar-fase.md (linhas 31-90 — Steps 1-4 padrão de parse + dispatch)
    - D:/projetos/opensource/mcp/kit/agents/toil-auditor.md (linhas 28-60 — Inputs esperados + Step 0 Preflight, conhecer interface)
  </read_first>
  <action>
    Adicionar `<process>` com 4 steps:

    ```markdown
    <process>

    ## 1. Parsear argumentos

    ```bash
    TIME_WINDOW=$(echo "$ARGUMENTS" | grep -oE -- '--time-window [^ ]+' | awk '{print $2}')
    TEAM_SIZE=$(echo "$ARGUMENTS" | grep -oE -- '--team-size [^ ]+' | awk '{print $2}')
    OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')
    RUNBOOKS=$(echo "$ARGUMENTS" | grep -oE -- '--runbooks-paths [^ ]+' | awk '{print $2}')

    [ -z "$TIME_WINDOW" ] && TIME_WINDOW="3m"
    [ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/TOIL-AUDIT.md"

    # PT-BR: criar destination dir
    mkdir -p "$(dirname "$OUTPUT_PATH")"
    ```

    ## 2. Validar pré-requisitos

    ```bash
    # PT-BR: detectar git repo (não-bloqueante — agent funciona sem git, só com scripts/runbooks)
    GIT_OK=true
    git rev-parse --git-dir >/dev/null 2>&1 || GIT_OK=false

    if [ "$GIT_OK" = false ]; then
      echo "⚠ Nenhum repositório git detectado — agent vai pular git log analysis."
      echo "  (toil-auditor continuará com scripts/runbooks apenas)"
    fi

    # PT-BR: verificar se TOIL-AUDIT.md anterior existe (idempotência)
    if [ -f "$OUTPUT_PATH" ]; then
      LAST_DATE=$(grep -m1 '**Audit date:**' "$OUTPUT_PATH" 2>/dev/null | sed 's/.*Audit date:\*\* //' || echo "?")
      echo "ℹ TOIL-AUDIT.md anterior detectado (Audit date: $LAST_DATE)."
      echo "  Novo audit vai sobrescrever — agent compara com anterior se preservou histórico."
    fi
    ```

    ## 3. Dispatch para `toil-auditor`

    ```text
    Task(
      subagent_type="toil-auditor",
      prompt="
    project_root: .
    output_path: ${OUTPUT_PATH}
    time_window: ${TIME_WINDOW}
    ${TEAM_SIZE:+team_size: ${TEAM_SIZE}}
    ${RUNBOOKS:+runbooks_paths: ${RUNBOOKS}}

    Aplicar skill eliminating-toil. Etapas:
    1. Scan: git log normalizado (commits repetitivos), scripts shell em paths canônicos, runbooks (manual ops descritas), README/CONTRIBUTING (manual setup).
    2. Aplicar 6 critérios canônicos (manual, repetitivo, automatizável, tático, sem valor durável, escala linear) em cada candidato.
    3. Distinguir toil vs overhead (reuniões/RH — não-elimináveis) vs grungy work (refactor — projeto engineering).
    4. Priorizar P0/P1/P2 por (frequency × pain) / automation_effort.
    5. Estimar esforço de automação por candidato (hours/days) + estágio L0-L4 do automation continuum.
    6. Computar % do tempo do time gasto em toil (regra ≤ 50%).

    Output: ${OUTPUT_PATH} com tabela priorizada + sumário executivo + recomendações.
    "
    )
    ```

    ## 4. Pós-output + integração OMM

    ```
    ═══════════════════════════════════════════════════════════
     framework ► AUDITAR-TOIL ▸ ${OUTPUT_PATH}
    ═══════════════════════════════════════════════════════════

    [output do toil-auditor — ver Step 5 do agent]

    ## Próximos passos
    1. Revisar P0 (alto impacto, baixo esforço) — alvos imediatos para automação
    2. Se `workflow.audit_milestone_toil=true`, este audit alimenta `/auditar-marco` (Phase 40 INT-FW-V2-03)
    3. Cross-ref OMM (v1.9 — Capacidade 3 Tech Debt): `/observabilidade omm` consome este audit
    4. Re-audit recomendado a cada milestone (toil cresce silencioso)
    ```

    </process>
    ```
  </action>
  <acceptance_criteria>
    - Bloco `<process>` contém exatamente 4 steps numerados
    - Step 1 parseia 4 flags (time-window, team-size, output, runbooks-paths) com defaults
    - Step 2 valida git repo de forma **não-bloqueante** (continua sem git)
    - Step 3 contém literal `Task(` + `subagent_type="toil-auditor"` + 6 etapas no prompt enumeradas
    - Step 3 menciona literalmente "6 critérios canônicos" + "P0/P1/P2"
    - Step 4 menciona integração com OMM (Capacidade 3) + `/auditar-marco`
  </acceptance_criteria>
</task>

<task id="38-02-T3" name="Success criteria + smoke">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/instrumentar-fase.md (linhas 192-201 — bloco success_criteria padrão)
  </read_first>
  <action>
    Adicionar `<success_criteria>` final + smoke validation inline:

    ```markdown
    <success_criteria>
    - [ ] $ARGUMENTS parseados (4 flags opcionais com defaults sensatos)
    - [ ] Pré-requisitos validados de forma não-bloqueante (git ausente OK; falta runbooks OK)
    - [ ] `toil-auditor` invocado via `Task(subagent_type=...)` com prompt completo (6 etapas)
    - [ ] `.planning/TOIL-AUDIT.md` (ou `--output` custom) criado pelo agent
    - [ ] Output forwarded transparentemente do agent (sem post-processing)
    - [ ] Próximos passos sugerem cross-ref para `/auditar-marco`, `/observabilidade omm`
    </success_criteria>
    ```

    Validar via shell:

    ```bash
    # Verificar tamanho da description
    grep -m1 "^description:" kit/commands/auditar-toil.md | sed 's/^description: //' | wc -c

    # Verificar âncoras canônicas
    grep -c "^<objective>$" kit/commands/auditar-toil.md           # esperado: 1
    grep -c "^<context>$" kit/commands/auditar-toil.md             # esperado: 1
    grep -c "^<process>$" kit/commands/auditar-toil.md             # esperado: 1
    grep -c "^<success_criteria>$" kit/commands/auditar-toil.md    # esperado: 1

    # Verificar literal Task dispatch
    grep -c 'subagent_type="toil-auditor"' kit/commands/auditar-toil.md  # esperado: ≥1

    # Verificar palavras-chave canônicas
    grep -c "TOIL-AUDIT.md" kit/commands/auditar-toil.md       # esperado: ≥3
    grep -c "P0/P1/P2\|P0\|P1\|P2" kit/commands/auditar-toil.md  # esperado: ≥3
    grep -ic "toil" kit/commands/auditar-toil.md               # esperado: ≥10
    grep -c "eliminating-toil" kit/commands/auditar-toil.md    # esperado: ≥1

    # Smoke sync — descoberto em .claude/commands/ após sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/commands/auditar-toil.md" ] && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `<success_criteria>` contém 6 bullets (1 por critério)
    - `description` ≤ 200 chars
    - 4 âncoras canônicas (`<objective>`, `<context>`, `<process>`, `<success_criteria>`) cada count == 1
    - `subagent_type="toil-auditor"` aparece pelo menos 1×
    - Palavras canônicas: `TOIL-AUDIT.md` ≥ 3, palavras P0/P1/P2 ≥ 3, "toil" (case-insensitive) ≥ 10, `eliminating-toil` ≥ 1
    - Após `kit sync claude-code`, arquivo `.claude/commands/auditar-toil.md` existe
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/commands/auditar-toil.md` existe
- [ ] Frontmatter válido (`name: auditar-toil`, `description ≤ 200 chars`, `allowed-tools` inclui `Task`)
- [ ] 4 âncoras canônicas: `<objective>`, `<context>`, `<process>`, `<success_criteria>`
- [ ] Cross-refs Markdown ativos para `toil-auditor` + skill `eliminating-toil`
- [ ] Process tem 4 steps (parse, validar, dispatch, output)
- [ ] Step 2 não bloqueia ausência de git (graceful degradation)
- [ ] Step 3 invoca `toil-auditor` via `Task(subagent_type=...)` com prompt completo (6 etapas + 6 critérios)
- [ ] Step 4 sugere cross-refs para `/auditar-marco` (INT-FW-V2-03) + `/observabilidade omm` (INT-OBS-02)
- [ ] Smoke `kit sync claude-code` instala em `.claude/commands/auditar-toil.md`
- [ ] Cobre CMD-SRE-02 integralmente

## Must-haves (goal-backward)

1. Comando file existe com frontmatter válido + Task tool habilitado
2. `description ≤ 200 chars` (anti-pitfall A2)
3. Output canônico em `.planning/TOIL-AUDIT.md` (não dentro de fase)
4. Dispatch via `Task(subagent_type=toil-auditor)` — único acoplamento ao agent
5. Prompt enumera 6 etapas + 6 critérios canônicos do livro
6. Output forwarding transparente (sem post-processing — agent já formata)
7. Pré-requisito git é não-bloqueante (works without git history)
8. Cross-refs ativos para integração v1.10 — Phase 39 (INT-OBS-02 OMM) + Phase 40 (INT-FW-V2-03 auditar-marco)

## Notes

- **Wrapper puro** — comando NÃO duplica scan/análise do agent; minimiza superfície de manutenção
- Tamanho esperado: ~5-7 KB (denso pelos exemplos + 4 flags)
- Phase 39 INT-OBS-02 vai integrar este comando ao `omm-auditor` (v1.9) para alimentar Capacidade 3 (Complexidade/Tech Debt) do OMM scoring
- Phase 40 INT-FW-V2-03 vai integrar este comando ao `/auditar-marco` quando `workflow.audit_milestone_toil=true`
- TOIL-AUDIT.md é re-audit periódico — toil cresce silencioso, recomendar a cada milestone
