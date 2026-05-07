---
phase: 38
plan: 03
title: Comando /postmortem — wrapper que dispatch para postmortem-writer (2 modos)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/postmortem.md
requirements: [CMD-SRE-03]
status: ready
---

# Plan 03 — Comando `kit/commands/postmortem.md`

## Goal

Criar `kit/commands/postmortem.md` — comando wrapper que invoca `postmortem-writer` (Phase 37 Plan 03) via `Task(subagent_type=...)`. Suporta **2 modos mutuamente exclusivos**: `--from-investigation <id>` (continuação de `incident-investigator` v1.9) ou `--incident "<descrição>"` (standalone). Gera postmortem blameless 9 seções em `.planning/postmortems/<id>.md`. Modelo de wrapper segue precedente direto `kit/commands/investigar-producao.md` (v1.9) que também tem flag `--id`. Cobre **CMD-SRE-03**.

## Files to create

- `D:/projetos/opensource/mcp/kit/commands/postmortem.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: postmortem` + `description ≤ 200 chars` (anti-pitfall A2)
- **`allowed-tools` inclui `Task` + `AskUserQuestion`** — wrapper invoca agent + pergunta modo se ambíguo
- **Cross-ref Markdown** ativo para `postmortem-writer` + skill `blameless-postmortems` + agent `incident-investigator` (v1.9)
- **2 modos mutuamente exclusivos** — `--from-investigation` E `--incident` ambos passados = ERROR; nenhum dos 2 = AskUserQuestion
- **Output canônico** em `.planning/postmortems/<id>.md` — caminho padrão (override via `--output`)

## Tasks

<task id="38-03-T1" name="Frontmatter + objective + context com 2 modos">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/postmortem.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/commands/investigar-producao.md (linhas 1-40 — frontmatter + objective + context, precedente direto com flag --id)
    - D:/projetos/opensource/mcp/kit/agents/postmortem-writer.md (linhas 28-52 — Modos A/B, conhecer interface)
  </read_first>
  <action>
    Escrever frontmatter + `<objective>` + `<context>` com **2 modos** documentados:

    ```markdown
    ---
    name: postmortem
    description: Invoca postmortem-writer — modo --from-investigation <id> (lê v1.9 trail) ou --incident "<descrição>" standalone; produz postmortem blameless 9 seções.
    argument-hint: "(--from-investigation <id> | --incident \"<descrição>\") [--severity SEV1|SEV2|SEV3]"
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
    Gerar **postmortem blameless** de 9 seções (cap 15 do livro Google SRE) — Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC. Invoca o agente [`postmortem-writer`](../agents/postmortem-writer.md) que aplica a skill [`blameless-postmortems`](../skills/blameless-postmortems/SKILL.md) — cultura blameless ("foco em sistema/processo, NÃO em pessoas"), action items SMART, "no postmortem left unreviewed".

    **Cria/Atualiza:**
    - `.planning/postmortems/<id>.md` — postmortem blameless completo

    **Após:** o user tem postmortem revisável + action items concretos. Phase 40 INT-FW-V2-01 chained do `/forense` automaticamente após Core Analysis Loop fechar.
    </objective>

    <context>
    **Argumentos:** `$ARGUMENTS` — comando suporta **2 modos mutuamente exclusivos**.

    **Modo A: `--from-investigation <id>` (preferido — continuação de v1.9)**

    Lê `.planning/investigations/<id>.md` produzido pelo `incident-investigator` (v1.9 — Core Analysis Loop). Extrai automaticamente: trigger, root cause, hipóteses validadas, action items. Campos faltantes (impact quantificado, severity, autores) são perguntados via `AskUserQuestion`.

    **Modo B: `--incident "<descrição>"` (standalone)**

    Para postmortem sem investigation prévia (incident menor, near-miss, lições retrospectivas). Agent gera template e usa `AskUserQuestion` para 9 perguntas guiadas — uma por seção canônica.

    **Flags adicionais:**
    - `--severity <SEV1|SEV2|SEV3>` — severity do incident (default: AskUserQuestion)
    - `--output <path>` — caminho do postmortem (default: `.planning/postmortems/<id>.md` — id auto-gerado)

    **Exemplos:**
    ```
    /postmortem --from-investigation incident-2026-05-06-1432-checkout-burn   # Modo A
    /postmortem --incident "checkout SLO burn às 14:32 — RCA N+1 query orders" --severity SEV2  # Modo B
    /postmortem --incident "near-miss: deploy bloqueou 2min antes do PR-1234"                    # near-miss
    ```

    **Pré-requisito (Modo A):** arquivo `.planning/investigations/<id>.md` existe (criado por `/investigar-producao` ou `/forense`).
    </context>
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/commands/postmortem.md` existe
    - Frontmatter válido com `name: postmortem` + `description ≤ 200 chars` + `allowed-tools` inclui `Task` + `AskUserQuestion`
    - `<objective>` contém cross-ref Markdown literal `[postmortem-writer](../agents/postmortem-writer.md)` E `[blameless-postmortems](../skills/blameless-postmortems/SKILL.md)`
    - `<objective>` menciona explicitamente "9 seções" + "blameless"
    - `<context>` documenta **2 modos** com headers claros (`Modo A: --from-investigation` E `Modo B: --incident`)
    - Modo A menciona `incident-investigator` (v1.9) E auto-extração de trigger/root cause
    - Modo B menciona `AskUserQuestion` para 9 perguntas guiadas
    - 3 exemplos de uso (1 Modo A + 2 Modo B incluindo near-miss)
  </acceptance_criteria>
</task>

<task id="38-03-T2" name="Process — parsear modo, validar, dispatch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/investigar-producao.md (linhas 41-118 — Steps 1-5 padrão de parse + dispatch com flag --id)
    - D:/projetos/opensource/mcp/kit/agents/postmortem-writer.md (linhas 54-78 — Step 0 Preflight + roteamento de modo, conhecer pré-validação)
  </read_first>
  <action>
    Adicionar `<process>` com 5 steps:

    ```markdown
    <process>

    ## 1. Parsear argumentos (2 modos)

    ```bash
    INV_ID=$(echo "$ARGUMENTS" | grep -oE -- '--from-investigation [^ ]+' | awk '{print $2}')
    INCIDENT=$(echo "$ARGUMENTS" | grep -oE -- '--incident "[^"]+"' | sed 's/--incident //; s/^"//; s/"$//')
    SEVERITY=$(echo "$ARGUMENTS" | grep -oE -- '--severity [^ ]+' | awk '{print $2}')
    OUTPUT_PATH=$(echo "$ARGUMENTS" | grep -oE -- '--output [^ ]+' | awk '{print $2}')

    # PT-BR: validar mutuamente exclusivos
    if [ -n "$INV_ID" ] && [ -n "$INCIDENT" ]; then
      echo "✗ Erro: --from-investigation e --incident são mutuamente exclusivos. Escolha um."
      exit 1
    fi

    # PT-BR: se nenhum dos 2 → AskUserQuestion (Modo C — interativo)
    if [ -z "$INV_ID" ] && [ -z "$INCIDENT" ]; then
      # Listar investigations recentes para sugestão
      RECENT_INVS=$(ls -t .planning/investigations/*.md 2>/dev/null | head -5 | while read f; do basename "$f" .md; done | tr '\n' ',')
      # AskUserQuestion: "Modo? Continuar de investigation existente OU postmortem standalone?"
      # Opções: Continuar de <ID> (uma por investigation recente) | Standalone (texto livre)
      echo "ℹ Sem flag explícita. Use --from-investigation <id> ou --incident \"<descrição>\"."
      [ -n "$RECENT_INVS" ] && echo "  Investigations recentes: $RECENT_INVS"
      exit 1
    fi
    ```

    ## 2. Validar pré-requisitos por modo

    ```bash
    mkdir -p .planning/postmortems

    # PT-BR: Modo A — investigation file precisa existir
    if [ -n "$INV_ID" ]; then
      INV_FILE=".planning/investigations/${INV_ID}.md"
      if [ ! -f "$INV_FILE" ]; then
        echo "✗ Investigation $INV_ID não existe. Liste com: ls .planning/investigations/"
        echo "  Para postmortem standalone: /postmortem --incident \"<descrição>\""
        exit 1
      fi
      # PT-BR: derivar postmortem id do investigation_id
      POSTMORTEM_ID="$INV_ID"
    fi

    # PT-BR: Modo B — gerar postmortem id automaticamente
    if [ -n "$INCIDENT" ]; then
      DATE=$(date -u +%Y-%m-%d-%H%M)
      SLUG=$(echo "$INCIDENT" | tr ' ' '-' | tr -cd 'a-zA-Z0-9-' | head -c 30 | sed 's/-$//')
      POSTMORTEM_ID="postmortem-${DATE}-${SLUG}"
    fi

    # PT-BR: default output_path (override via --output)
    [ -z "$OUTPUT_PATH" ] && OUTPUT_PATH=".planning/postmortems/${POSTMORTEM_ID}.md"

    # PT-BR: idempotência — não sobrescrever postmortem existente sem confirmar
    if [ -f "$OUTPUT_PATH" ]; then
      echo "⚠ Postmortem $OUTPUT_PATH já existe."
      echo "  Use --output <novo-path> ou rm $OUTPUT_PATH antes de re-rodar."
      exit 1
    fi
    ```

    ## 3. Listar postmortems recentes (UX)

    ```bash
    # PT-BR: contexto — postmortems anteriores para correlacionar lessons learned
    ls -t .planning/postmortems/*.md 2>/dev/null | head -3 | while read f; do
      ID=$(basename "$f" .md)
      DATE=$(grep -m1 '**Date:**' "$f" 2>/dev/null | sed 's/.*Date:\*\* //' || echo "?")
      printf "  %s — %s\n" "$ID" "$DATE"
    done
    ```

    ## 4. Dispatch para `postmortem-writer`

    ```text
    Task(
      subagent_type="postmortem-writer",
      prompt="
    ${INV_ID:+investigation_id: ${INV_ID}}
    ${INCIDENT:+incident_description: ${INCIDENT}}
    ${SEVERITY:+severity: ${SEVERITY}}
    output_path: ${OUTPUT_PATH}
    postmortem_id: ${POSTMORTEM_ID}

    Aplicar skill blameless-postmortems. Modo:
    ${INV_ID:+- Modo A: ler .planning/investigations/${INV_ID}.md, extrair trigger/root_cause/hipóteses/action_items automaticamente; perguntar via AskUserQuestion apenas campos faltantes (impact quantificado, severity, autores).}
    ${INCIDENT:+- Modo B: gerar template; perguntar via AskUserQuestion 9 questões guiadas — uma por seção canônica (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline).}

    Padrões obrigatórios:
    - Foco em sistema/processo (NUNCA em pessoas) — anti-pattern blame culture
    - Action items SMART (Specific, Measurable, Assignable, Realistic, Time-bound)
    - Timeline em UTC sempre
    - Impact quantificado (# usuários, duração, SLO budget consumido, revenue se aplicável)
    - 9 seções canônicas obrigatórias (skip = inválido)
    "
    )
    ```

    ## 5. Pós-output

    ```
    ═══════════════════════════════════════════════════════════
     framework ► POSTMORTEM ▸ ${POSTMORTEM_ID}
    ═══════════════════════════════════════════════════════════

    [output do postmortem-writer — ver Step 6 do agent]

    ## Estado salvo
    .planning/postmortems/${POSTMORTEM_ID}.md

    ## Próximos passos
    1. Revisar o postmortem com o time — "no postmortem left unreviewed"
    2. Distribuir para reviewer SRE OU par externo (anti-pattern: auto-review)
    3. Action items entram no roadmap (`/adicionar-tarefa` ou `/adicionar-fase`)
    4. Se PRR for próximo passo de production-readiness: `/prr --service <name>`
    5. Cross-ref OMM: postmortems alimentam Capacidade 5 (Incident Response) — `/observabilidade omm`
    ```

    </process>
    ```
  </action>
  <acceptance_criteria>
    - Bloco `<process>` contém exatamente 5 steps numerados
    - Step 1 valida **mutuamente exclusivos** (`--from-investigation` E `--incident` simultâneos = ERROR; nenhum = AskUserQuestion sugerido)
    - Step 2 valida investigation file existe (Modo A) E gera postmortem id automaticamente (Modo B)
    - Step 2 tem **idempotência** — não sobrescreve postmortem existente sem `--output` explícito
    - Step 4 contém literal `Task(` + `subagent_type="postmortem-writer"` + 9 seções literalmente nominadas no prompt
    - Step 4 prompt menciona "blame culture" como anti-pattern E "SMART" como padrão de action items
    - Step 5 sugere cross-refs para `/prr`, `/observabilidade omm`, `/adicionar-tarefa`
  </acceptance_criteria>
</task>

<task id="38-03-T3" name="Success criteria + smoke">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/investigar-producao.md (linhas 154-162 — bloco success_criteria padrão)
  </read_first>
  <action>
    Adicionar `<success_criteria>` final + smoke validation inline:

    ```markdown
    <success_criteria>
    - [ ] `--from-investigation <id>` E `--incident "<text>"` parseados (mutuamente exclusivos)
    - [ ] Modo A: arquivo `.planning/investigations/<id>.md` validado existe antes de dispatch
    - [ ] Modo B: postmortem_id auto-gerado a partir de date + slug
    - [ ] Idempotência: não sobrescreve postmortem existente sem `--output` explícito
    - [ ] `postmortem-writer` invocado via `Task(subagent_type=...)` com prompt completo (modo + 9 seções + padrões)
    - [ ] `.planning/postmortems/<id>.md` criado pelo agent
    - [ ] Próximos passos sugerem cross-ref para `/prr`, `/observabilidade omm`, `/adicionar-tarefa`
    </success_criteria>
    ```

    Validar via shell:

    ```bash
    # Verificar tamanho da description
    grep -m1 "^description:" kit/commands/postmortem.md | sed 's/^description: //' | wc -c

    # Verificar âncoras canônicas
    grep -c "^<objective>$" kit/commands/postmortem.md           # esperado: 1
    grep -c "^<context>$" kit/commands/postmortem.md             # esperado: 1
    grep -c "^<process>$" kit/commands/postmortem.md             # esperado: 1
    grep -c "^<success_criteria>$" kit/commands/postmortem.md    # esperado: 1

    # Verificar literal Task dispatch + 2 modos
    grep -c 'subagent_type="postmortem-writer"' kit/commands/postmortem.md  # esperado: ≥1
    grep -c -- "--from-investigation" kit/commands/postmortem.md            # esperado: ≥3
    grep -c -- "--incident" kit/commands/postmortem.md                      # esperado: ≥3

    # Verificar palavras-chave canônicas blameless culture
    grep -ic "blameless" kit/commands/postmortem.md       # esperado: ≥3
    grep -c "9 seções\|9 perguntas\|9 questões" kit/commands/postmortem.md  # esperado: ≥2
    grep -c "SMART\|UTC" kit/commands/postmortem.md       # esperado: ≥2

    # Verificar cross-ref incident-investigator (v1.9 ancestor)
    grep -c "incident-investigator" kit/commands/postmortem.md  # esperado: ≥1
    grep -c "v1.9" kit/commands/postmortem.md                   # esperado: ≥1

    # Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/commands/postmortem.md" ] && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `<success_criteria>` contém 7 bullets (1 por critério crítico)
    - `description` ≤ 200 chars
    - 4 âncoras canônicas (`<objective>`, `<context>`, `<process>`, `<success_criteria>`) cada count == 1
    - `subagent_type="postmortem-writer"` aparece pelo menos 1×
    - `--from-investigation` aparece ≥ 3× E `--incident` aparece ≥ 3× (2 modos documentados claramente)
    - `blameless` (case-insensitive) ≥ 3, "9 seções|9 perguntas|9 questões" ≥ 2, `SMART|UTC` ≥ 2
    - Cross-ref `incident-investigator` ≥ 1× E `v1.9` ≥ 1× (continuação histórica)
    - Após `kit sync claude-code`, arquivo `.claude/commands/postmortem.md` existe
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/commands/postmortem.md` existe
- [ ] Frontmatter válido (`name: postmortem`, `description ≤ 200 chars`, `allowed-tools` inclui `Task` + `AskUserQuestion`)
- [ ] 4 âncoras canônicas: `<objective>`, `<context>`, `<process>`, `<success_criteria>`
- [ ] Cross-refs Markdown ativos para `postmortem-writer` + skill `blameless-postmortems` + agent `incident-investigator` (v1.9)
- [ ] **2 modos** (`--from-investigation` + `--incident`) documentados como mutuamente exclusivos
- [ ] Process tem 5 steps (parse modos, validar, listar, dispatch, output)
- [ ] Step 1 trata 3 casos: ambos passados (ERROR), nenhum passado (AskUserQuestion sugerido), exatamente 1 (continua)
- [ ] Step 2 valida investigation file existe (Modo A) E gera postmortem_id auto (Modo B)
- [ ] Step 2 idempotência — não sobrescreve postmortem existente
- [ ] Step 4 prompt enumera 9 seções canônicas + padrões (SMART, UTC, blameless)
- [ ] Step 5 sugere cross-refs para `/prr`, `/observabilidade omm`, `/adicionar-tarefa`
- [ ] Smoke `kit sync claude-code` instala em `.claude/commands/postmortem.md`
- [ ] Cobre CMD-SRE-03 integralmente

## Must-haves (goal-backward)

1. Comando file existe com frontmatter válido + Task + AskUserQuestion habilitados
2. `description ≤ 200 chars` (anti-pitfall A2)
3. **2 modos mutuamente exclusivos** documentados claramente — anti-pattern: passar ambos
4. Modo A continua de `incident-investigator` (v1.9) sem retrabalho — auto-extrai trigger/root_cause
5. Modo B suporta postmortem standalone (incident menor, near-miss, retrospectiva)
6. Idempotência: não sobrescreve postmortem existente sem opt-in via `--output`
7. Prompt do agent enumera 9 seções canônicas + padrões blameless (SMART/UTC/sistema-não-pessoas)
8. Cross-refs ativos para v1.9 (`incident-investigator`) e v1.10 família SRE (`/prr`, `/observabilidade omm`)
9. Phase 40 INT-FW-V2-01 vai chained do `/forense` → `/postmortem` automaticamente — comando deve estar pronto antes

## Notes

- **Wrapper puro** — comando NÃO duplica template/extração do agent; minimiza superfície de manutenção
- Tamanho esperado: ~7-9 KB (denso pelos 2 modos + idempotência + cross-refs múltiplos)
- Phase 40 INT-FW-V2-01 vai modificar `/forense` para sugerir chain `/postmortem` automaticamente após Core Analysis Loop fechar com root cause
- "No postmortem left unreviewed" é princípio do livro — comando lembra isso em Próximos Passos
- Modo A é preferido: Core Analysis Loop em `incident-investigator` produz trail estruturado que postmortem-writer transforma em postmortem revisável sem retrabalho
