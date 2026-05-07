---
phase: 38
plan: 01
title: Comando /golden-signals — wrapper que dispatch para golden-signals-instrumenter
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/golden-signals.md
requirements: [CMD-SRE-01]
status: ready
---

# Plan 01 — Comando `kit/commands/golden-signals.md`

## Goal

Criar `kit/commands/golden-signals.md` — comando wrapper que invoca `golden-signals-instrumenter` (Phase 37 Plan 01) via `Task(subagent_type=...)` para um serviço/Edge Function/fase. Gera `GOLDEN-SIGNALS.md` por target com instrumentação OTel pronta (Latency histogram + Traffic counter + Errors counter + Saturation gauge). Modelo de wrapper segue precedente direto `kit/commands/instrumentar-fase.md` (v1.9). Cobre **CMD-SRE-01**.

## Files to create

- `D:/projetos/opensource/mcp/kit/commands/golden-signals.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: golden-signals` + `description ≤ 200 chars` (anti-pitfall A2)
- **`allowed-tools` inclui `Task`** — wrapper invoca agent via Task dispatch
- **Cross-ref Markdown** ativo para `golden-signals-instrumenter` + skill `four-golden-signals`
- **Wrapper puro** — comando NÃO duplica lógica do agent; apenas parseia args + dispatch + output forwarding
- **Argumentos parseados** com fallback explícito — `<target>` obrigatório (path/serviço); flags `--service`, `--saturation`, `--runtime` opcionais

## Tasks

<task id="38-01-T1" name="Frontmatter + objective + context">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/golden-signals.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/commands/instrumentar-fase.md (linhas 1-30 — frontmatter + objective + context — precedente direto v1.9)
    - D:/projetos/opensource/mcp/kit/agents/golden-signals-instrumenter.md (linhas 1-35 — frontmatter + Inputs esperados, para conhecer interface do agent)
  </read_first>
  <action>
    Escrever frontmatter + `<objective>` + `<context>`:

    ```markdown
    ---
    name: golden-signals
    description: Invoca golden-signals-instrumenter para serviço/Edge Function/fase — instrumenta 4 golden signals OTel (Latency histogram, Traffic counter, Errors counter, Saturation gauge).
    argument-hint: "<target> [--service <name>] [--saturation <resource>] [--runtime <node|deno|python>]"
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
    Instrumentar um serviço/Edge Function/fase com os **4 golden signals** do cap 6 do livro Google SRE — Latency (histogram bucketed), Traffic (counter), Errors (counter por `error.type`), Saturation (gauge resource-specific). Invoca o agente [`golden-signals-instrumenter`](../agents/golden-signals-instrumenter.md) que aplica a skill [`four-golden-signals`](../skills/four-golden-signals/SKILL.md).

    **Cria/Atualiza:**
    - Patches OTel nos arquivos do `<target>` (Latency + Traffic + Errors + Saturation)
    - `GOLDEN-SIGNALS.md` por target com tabela de instrumentação aplicada (output do agent)

    **Após:** os 4 signals estão instrumentados e o user pode rodar smoke local para verificar histogram/counter/gauge no backend OTel.
    </objective>

    <context>
    **Argumentos:** `$ARGUMENTS` — primeiro token é o `<target>` (path de arquivo, diretório de service, ou número de fase como `38`); restante são flags.

    **Flags:**
    - `--service <name>` — nome canônico do serviço (default: deriva de `package.json#name` ou diretório)
    - `--saturation <resource>` — recurso de saturation (`db_connection_pool` | `cache_memory` | `queue_depth` | `concurrency_limit` | `cpu_load` | `egress_bandwidth`); se omitido, agent infere via heurística
    - `--runtime <node|deno|python>` — runtime; se omitido, detecta via `package.json`/`deno.json`/`pyproject.toml`

    **Exemplos:**
    ```
    /golden-signals src/orders/handler.ts                              # 1 arquivo
    /golden-signals supabase/functions/process-emails                  # 1 Edge Function
    /golden-signals 38                                                 # todos os arquivos modificados pela Phase 38
    /golden-signals src/api --service orders-api --saturation db_connection_pool
    ```

    **Pré-requisito:** OTel SDK pode estar ausente — agent flagga deps necessárias no output. Caller decide instalar.
    </context>
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/commands/golden-signals.md` existe
    - Frontmatter válido com `name: golden-signals` + `description ≤ 200 chars`
    - Frontmatter `allowed-tools` lista `Task` (essencial para dispatch)
    - `<objective>` contém cross-ref Markdown literal `[golden-signals-instrumenter](../agents/golden-signals-instrumenter.md)` E `[four-golden-signals](../skills/four-golden-signals/SKILL.md)`
    - `<context>` lista pelo menos 3 flags (`--service`, `--saturation`, `--runtime`) com defaults
    - `<context>` contém pelo menos 4 exemplos de uso
  </acceptance_criteria>
</task>

<task id="38-01-T2" name="Process — parsear, resolver target, dispatch">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/instrumentar-fase.md (linhas 31-90 — Steps 1-3 padrão de parse + dispatch)
    - D:/projetos/opensource/mcp/kit/commands/burn-rate-status.md (linhas 39-91 — pattern de iteração + dispatch agent)
  </read_first>
  <action>
    Adicionar bloco `<process>` com 4 steps:

    ```markdown
    <process>

    ## 1. Parsear argumentos

    ```bash
    TARGET=$(echo "$ARGUMENTS" | awk '{print $1}')
    SERVICE=$(echo "$ARGUMENTS" | grep -oE -- '--service [^ ]+' | awk '{print $2}')
    SATURATION=$(echo "$ARGUMENTS" | grep -oE -- '--saturation [^ ]+' | awk '{print $2}')
    RUNTIME=$(echo "$ARGUMENTS" | grep -oE -- '--runtime [^ ]+' | awk '{print $2}')

    if [ -z "$TARGET" ]; then
      echo "Uso: /golden-signals <target> [--service N] [--saturation R] [--runtime RT]"
      echo "Exemplos:"
      echo "  /golden-signals src/orders/handler.ts"
      echo "  /golden-signals supabase/functions/process-emails"
      echo "  /golden-signals 38                  # todos arquivos da Phase 38"
      exit 1
    fi
    ```

    ## 2. Resolver target → lista de target_files

    ```bash
    # PT-BR: 3 modos de resolução
    if [[ "$TARGET" =~ ^[0-9]+$ ]]; then
      # Modo fase — extrai files_modified de PLAN.md(s) da Phase $TARGET
      PHASE_STATE=$(node "./.claude/framework/bin/tools.cjs" init phase-op "$TARGET")
      PHASE_DIR=$(echo "$PHASE_STATE" | jq -r .phase_dir)
      if [ "$PHASE_DIR" = "null" ] || [ ! -d "$PHASE_DIR" ]; then
        echo "Fase $TARGET ainda não foi planejada."
        exit 1
      fi
      TARGET_FILES=$(grep -rh "^  - " "$PHASE_DIR"/*-PLAN-*.md | grep -oE '[a-zA-Z0-9_/.-]+\.(ts|js|py|deno|sql)' | sort -u | tr '\n' ' ')
    elif [ -d "$TARGET" ]; then
      # Modo diretório — todos arquivos relevantes (.ts, .js, .py)
      TARGET_FILES=$(find "$TARGET" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" \) | tr '\n' ' ')
    elif [ -f "$TARGET" ]; then
      # Modo arquivo único
      TARGET_FILES="$TARGET"
    else
      echo "Erro: target '$TARGET' não é arquivo, diretório ou número de fase válido."
      exit 1
    fi

    if [ -z "$TARGET_FILES" ]; then
      echo "Nenhum arquivo encontrado para target '$TARGET'."
      exit 0
    fi
    ```

    ## 3. Dispatch para `golden-signals-instrumenter`

    ```text
    Task(
      subagent_type="golden-signals-instrumenter",
      prompt="
    target_files: ${TARGET_FILES}
    ${SERVICE:+service_name: ${SERVICE}}
    ${RUNTIME:+runtime: ${RUNTIME}}
    ${SATURATION:+saturation_resource: ${SATURATION}}

    Aplicar skill four-golden-signals. Gerar patches OTel para os 4 signals em cada arquivo:
    1. Latency: histogram com explicitBucketBoundaries exponencial, dimension result=success|error
    2. Traffic: counter incrementado antes de processar request
    3. Errors: counter por error_type enum (5-15 valores; NÃO error.message)
    4. Saturation: ObservableGauge do recurso mais escasso (callback lê estado real)

    Validar 6 checks no Step 3 do agent (latency separado success/error, error_type enum, etc.).
    Output: tabela de patches gerados + GOLDEN-SIGNALS.md por target.
    "
    )
    ```

    ## 4. Pós-output

    ```
    ═══════════════════════════════════════════════════════════
     framework ► GOLDEN-SIGNALS ▸ ${TARGET}
    ═══════════════════════════════════════════════════════════

    [output do golden-signals-instrumenter — ver Step 4 do agent]

    ## Próximos passos
    1. Smoke local — enviar request e verificar histogram/counter/gauge no backend OTel
    2. Cross-ref: rodar `/instrumentar-fase ${TARGET}` se spans/wide events ainda ausentes (complementar)
    3. Após validar baseline, definir SLO event-based: `/observabilidade slo <feature>`
    4. PRR antes de production: `/prr --service ${SERVICE:-<name>}`
    ```

    </process>
    ```
  </action>
  <acceptance_criteria>
    - Bloco `<process>` contém exatamente 4 numeradas: `## 1. Parsear argumentos`, `## 2. Resolver target → lista de target_files`, `## 3. Dispatch para golden-signals-instrumenter`, `## 4. Pós-output`
    - Step 2 contém **3 modos de resolução**: número de fase (regex `[0-9]+`), diretório, arquivo único
    - Step 3 contém literal `Task(` + `subagent_type="golden-signals-instrumenter"`
    - Step 3 enumera os 4 signals (Latency, Traffic, Errors, Saturation) no prompt
    - Step 4 sugere próximos passos cross-ref para `/instrumentar-fase`, `/observabilidade slo`, `/prr`
  </acceptance_criteria>
</task>

<task id="38-01-T3" name="Success criteria + smoke">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/instrumentar-fase.md (linhas 192-201 — bloco success_criteria padrão)
  </read_first>
  <action>
    Adicionar `<success_criteria>` final + smoke validation inline:

    ```markdown
    <success_criteria>
    - [ ] `<target>` parseado de $ARGUMENTS (arquivo, diretório, ou número de fase)
    - [ ] `target_files` resolvido para lista não-vazia (3 modos suportados)
    - [ ] `golden-signals-instrumenter` invocado via `Task(subagent_type=...)`
    - [ ] Patches aplicados em todos os arquivos do target (4 signals cada)
    - [ ] Output forwarded transparentemente do agent (sem post-processing)
    - [ ] Próximos passos sugerem cross-ref para `/instrumentar-fase`, `/observabilidade slo`, `/prr`
    </success_criteria>
    ```

    Validar via shell:

    ```bash
    # Verificar tamanho da description
    grep -m1 "^description:" kit/commands/golden-signals.md | sed 's/^description: //' | wc -c

    # Verificar âncoras canônicas
    grep -c "^<objective>$" kit/commands/golden-signals.md           # esperado: 1
    grep -c "^<context>$" kit/commands/golden-signals.md             # esperado: 1
    grep -c "^<process>$" kit/commands/golden-signals.md             # esperado: 1
    grep -c "^<success_criteria>$" kit/commands/golden-signals.md    # esperado: 1

    # Verificar literal Task dispatch
    grep -c 'subagent_type="golden-signals-instrumenter"' kit/commands/golden-signals.md  # esperado: ≥1

    # Verificar 4 signals literalmente nominados
    grep -ic "Latency" kit/commands/golden-signals.md     # esperado: ≥3
    grep -ic "Traffic" kit/commands/golden-signals.md     # esperado: ≥3
    grep -ic "Errors" kit/commands/golden-signals.md      # esperado: ≥3
    grep -ic "Saturation" kit/commands/golden-signals.md  # esperado: ≥3

    # Smoke sync — descoberto em .claude/commands/ após sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/commands/golden-signals.md" ] && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `<success_criteria>` contém 6 bullets (1 por critério)
    - `description` ≤ 200 chars
    - 4 âncoras canônicas (`<objective>`, `<context>`, `<process>`, `<success_criteria>`) cada count == 1
    - `subagent_type="golden-signals-instrumenter"` aparece pelo menos 1×
    - Cada um dos 4 signals (Latency/Traffic/Errors/Saturation) aparece ≥ 3× no documento
    - Após `kit sync claude-code`, arquivo `.claude/commands/golden-signals.md` existe
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/commands/golden-signals.md` existe
- [ ] Frontmatter válido (`name: golden-signals`, `description ≤ 200 chars`, `allowed-tools` inclui `Task`)
- [ ] 4 âncoras canônicas: `<objective>`, `<context>`, `<process>`, `<success_criteria>`
- [ ] Cross-refs Markdown ativos para `golden-signals-instrumenter` + skill `four-golden-signals`
- [ ] Process tem 4 steps (parse, resolve target, dispatch, output)
- [ ] Step 2 suporta 3 modos: número de fase, diretório, arquivo único
- [ ] Step 3 invoca `golden-signals-instrumenter` via `Task(subagent_type=...)` com prompt completo (target_files + 4 signals enumerados)
- [ ] Step 4 sugere cross-refs para `/instrumentar-fase`, `/observabilidade slo`, `/prr`
- [ ] Smoke `kit sync claude-code` instala em `.claude/commands/golden-signals.md`
- [ ] Cobre CMD-SRE-01 integralmente

## Must-haves (goal-backward)

1. Comando file existe com frontmatter válido + Task tool habilitado
2. `description ≤ 200 chars` (anti-pitfall A2)
3. 3 modos de target resolution (arquivo, diretório, número de fase) — flexibilidade essencial
4. Dispatch via `Task(subagent_type=golden-signals-instrumenter)` — único acoplamento ao agent
5. 4 signals (Latency/Traffic/Errors/Saturation) literalmente nominados no prompt e doc
6. Output forwarding transparente (sem post-processing — agent já formata)
7. Próximos passos com cross-refs ativos para comandos relacionados (família observability + sre)
8. Smoke pós-sync verifica arquivo presente em `.claude/commands/`

## Notes

- **Wrapper puro** — comando NÃO duplica lógica do agent; minimiza superfície de manutenção
- Tamanho esperado: ~5-7 KB (denso pelos 4 exemplos + 3 modos de resolution)
- Phase 41 vai criar gate `golden-signals-coverage` que verifica regex sobre `histogram\|counter\|gauge\|saturation` em código tocado por fase — este comando popula esse atributo
- Cross-ref direto com `/instrumentar-fase` (v1.9) — comandos podem ser chained: primeiro spans, depois 4 signals
