---
phase: 41
plan: 02
title: Gate gates/postmortem-template-required.md — bloqueia /concluir-marco se incident sem postmortem
wave: 1
depends_on: []
autonomous: true
files_modified:
  - gates/postmortem-template-required.md
requirements: [QA-SRE-02]
status: ready
---

# Plan 02 — Criar `gates/postmortem-template-required.md`

## Goal

Criar **gate bash 3.2-portable blocking pre-conclude** que, em `/concluir-marco`, **bloqueia** se há investigação registrada em `.planning/investigations/` sem postmortem correspondente em `.planning/postmortems/`. O gate força a regra canônica do livro Google SRE (cap 15 — *Postmortem Culture: Learning from Failure*) — **"no postmortem left unreviewed"**: cada incident significativo (registrado como investigation via `/forense` + `incident-investigator`) deve ter postmortem blameless gerado via `/postmortem --from-investigation <id>` antes de arquivar o milestone. Cobre **QA-SRE-02**.

## Files to modify

- `D:/projetos/opensource/mcp/gates/postmortem-template-required.md` (NEW)

## Constraints (anti-pitfall reminders)

- **Bash 3.2-portable** — sem `mapfile`/`readarray`/`[[ =~ ]]`/`declare -A`
- **Frontmatter canônico** — `id`, `stage: pre-conclude`, `blocking: true`, `description ≤ 200 chars`
- **Exit codes** — `0 = PASS` (todas investigations têm postmortem OR diretório investigations/ não existe), `1 = FAIL` (≥ 1 investigation sem postmortem)
- **Pular gracefully** — se `.planning/investigations/` não existe (projeto sem incidents registrados), gate **passa com INFO**
- **Match de pares** — investigation `<id>.md` em `.planning/investigations/` exige postmortem `<id>.md` em `.planning/postmortems/`. Match por **basename igual** (não por path completo)
- **Caso edge: investigation INCONCLUSIVE** — se investigation tem header `Status: INCONCLUSIVE` (sem root cause), gate **NÃO exige postmortem** (não há aprendizado a documentar) — alinhado com Plan 40-01 que documenta "Quando NÃO sugerir chain `/postmortem`"
- **Output formato** — primeira linha `PASS:`/`FAIL:`/`INFO:` para gate-runner

## Tasks

<task id="41-02-T1" name="Confirmar precedente pre-conclude e estrutura .planning/investigations/">
  <read_first>
    - D:/projetos/opensource/mcp/gates/omm-no-regression.md (linhas 1-84 — único gate pre-conclude existente; pattern de precedência find + comparação)
    - D:/projetos/opensource/mcp/gates/obs-skills-frontmatter.md (linhas 1-66 — structure padrão `## Check` + bash 3.2)
    - D:/projetos/opensource/mcp/kit/agents/postmortem-writer.md (linhas 30-50 — confirmar formato de input `--from-investigation <id>` lê `.planning/investigations/<id>.md`)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar pattern frontmatter `gates/omm-no-regression.md`:
       ```yaml
       id: omm-no-regression
       stage: pre-conclude
       blocking: false
       description: ...
       ```
       Para QA-SRE-02 será `blocking: true` (anti-pattern bloqueia archive).
    2. Confirmar diretórios canônicos:
       - `.planning/investigations/` — outputs do `incident-investigator` (v1.9). Cada investigation é `.planning/investigations/<id>.md` (single file) OR `.planning/investigations/<id>/STATE.md` (subdir com state)
       - `.planning/postmortems/` — outputs do `postmortem-writer` (v1.10 / Phase 37). Cada postmortem é `.planning/postmortems/<id>.md`
    3. Confirmar handoff: `--from-investigation <id>` no `postmortem-writer` lê `.planning/investigations/<id>.md` — então o `<id>` é o identifier compartilhado entre os dois diretórios
    4. Confirmar que ainda não existe `gates/postmortem-template-required.md` (NEW file)
  </action>
  <acceptance_criteria>
    - Pattern pre-conclude confirmado (precedente: `omm-no-regression.md`)
    - Diretórios `.planning/investigations/` e `.planning/postmortems/` confirmados como canônicos
    - Match key = basename `<id>` (sem extensão `.md`)
    - Status `INCONCLUSIVE` reconhecido como exceção (sem root cause = sem postmortem)
    - Arquivo `gates/postmortem-template-required.md` ainda não existe
  </acceptance_criteria>
</task>

<task id="41-02-T2" name="Escrever gates/postmortem-template-required.md">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 1-30 — confirmar skill canônica + frase "no postmortem left unreviewed")
  </read_first>
  <action>
    Usar Write para criar `D:/projetos/opensource/mcp/gates/postmortem-template-required.md` com conteúdo:

    ```markdown
    ---
    id: postmortem-template-required
    stage: pre-conclude
    blocking: true
    description: Bloqueia /concluir-marco se há investigação em .planning/investigations/ sem postmortem correspondente em .planning/postmortems/. "No postmortem left unreviewed" (cap 15).
    ---

    # Postmortem template required gate

    **When to run:** pre-conclude (blocking — milestone NÃO arquiva até cada incident ter postmortem blameless).

    ## Check

    ```bash
    #!/usr/bin/env bash
    # PT-BR: validar que cada investigação em .planning/investigations/ tem postmortem em .planning/postmortems/.
    # Match por basename (sem extensão .md). Investigations com Status: INCONCLUSIVE são exceção.
    # Bash 3.2-portable (macOS default).
    set -e

    INV_DIR=".planning/investigations"
    PM_DIR=".planning/postmortems"

    # PT-BR: se não há investigations, gate passa com INFO
    if [ ! -d "$INV_DIR" ]; then
      echo "INFO: $INV_DIR não existe — projeto sem incidents registrados. Gate skipped."
      exit 0
    fi

    # PT-BR: listar investigations (single-file *.md OR subdir com STATE.md)
    INVESTIGATIONS=""

    # PT-BR: pattern A — .planning/investigations/<id>.md (single file)
    SINGLE_FILES=$(find "$INV_DIR" -maxdepth 1 -type f -name "*.md" 2>/dev/null || true)
    if [ -n "$SINGLE_FILES" ]; then
      INVESTIGATIONS="$INVESTIGATIONS
$SINGLE_FILES"
    fi

    # PT-BR: pattern B — .planning/investigations/<id>/STATE.md (subdir state)
    SUBDIR_STATES=$(find "$INV_DIR" -mindepth 2 -maxdepth 2 -type f -name "STATE.md" 2>/dev/null || true)
    if [ -n "$SUBDIR_STATES" ]; then
      INVESTIGATIONS="$INVESTIGATIONS
$SUBDIR_STATES"
    fi

    # PT-BR: filtrar linhas vazias
    INVESTIGATIONS=$(echo "$INVESTIGATIONS" | grep -v "^$" || true)

    if [ -z "$INVESTIGATIONS" ]; then
      echo "INFO: $INV_DIR vazio — sem incidents registrados. Gate skipped."
      exit 0
    fi

    # PT-BR: para cada investigation, extrair <id> e checar postmortem correspondente
    MISSING=0
    MISSING_LIST=""
    OLDIFS="$IFS"
    IFS='
'
    for inv_path in $INVESTIGATIONS; do
      [ -z "$inv_path" ] && continue
      [ ! -f "$inv_path" ] && continue

      # PT-BR: extrair <id> — basename sem .md OU dirname se for STATE.md em subdir
      base=$(basename "$inv_path")
      if [ "$base" = "STATE.md" ]; then
        # pattern B — id é o nome do subdir parent
        id=$(basename "$(dirname "$inv_path")")
      else
        # pattern A — id é basename sem .md
        id="${base%.md}"
      fi

      # PT-BR: se investigation tem Status: INCONCLUSIVE (sem root cause), pular
      if grep -qiE "^Status:.*INCONCLUSIVE|^.*Status.*INCONCLUSIVE" "$inv_path" 2>/dev/null; then
        echo "INFO: investigation '$id' marcada INCONCLUSIVE — sem root cause, postmortem não exigido."
        continue
      fi

      # PT-BR: postmortem esperado em .planning/postmortems/<id>.md
      pm_path="$PM_DIR/$id.md"
      if [ ! -f "$pm_path" ]; then
        MISSING=$((MISSING + 1))
        MISSING_LIST="$MISSING_LIST $id"
      fi
    done
    IFS="$OLDIFS"

    if [ "$MISSING" -eq 0 ]; then
      echo "PASS: todas as investigações têm postmortem correspondente em $PM_DIR/"
      exit 0
    else
      echo "FAIL: $MISSING investigação(ões) sem postmortem em $PM_DIR/:$MISSING_LIST"
      echo "Sugestão: rodar /postmortem --from-investigation <id> para cada item ausente."
      echo "Cross-ref: kit/skills/blameless-postmortems/SKILL.md + kit/agents/postmortem-writer.md"
      echo "Princípio canônico: 'No postmortem left unreviewed' (cap 15 livro Google SRE)."
      exit 1
    fi
    ```

    ## Verdict

    - **passed** — todas investigations têm postmortem correspondente OR investigations marcadas INCONCLUSIVE OR diretório `.planning/investigations/` ausente
    - **block** — pelo menos 1 investigation sem postmortem em `.planning/postmortems/`

    ## Why

    O livro Google SRE (cap 15 — *Postmortem Culture: Learning from Failure*) define como princípio canônico **"no postmortem left unreviewed"**: cada incident significativo (registrado como investigação via `/forense` + `incident-investigator` v1.9) deve gerar postmortem blameless documentando *o que aprendemos* e *o que mudaremos*.

    Sem este gate, milestones arquivam com investigations órfãs — root cause foi diagnosticado mas aprendizado organizacional perdeu-se (anti-pattern hero culture: "fixei o bug, vamos seguir"). Gate força a chain canônica entre v1.9 (Core Analysis Loop diagnostica) e v1.10 (postmortem documenta).

    Cross-ref agent canônico: [`postmortem-writer`](../kit/agents/postmortem-writer.md) (Phase 37 / AGCORE-SRE-03). Skill: [`blameless-postmortems`](../kit/skills/blameless-postmortems/SKILL.md) (Phase 36 / SKFD-SRE-04). Comando: `/postmortem --from-investigation <id>` (Phase 38 / CMD-SRE-03). Chain documentado em `kit/commands/forense.md` bloco `<sre_integration>` (Plan 40-01 / INT-FW-V2-01).

    ## REQ

    QA-SRE-02.

    ## Configuração

    Gate é **blocking** por default (cultura SRE blameless é não-negociável uma vez instituída). Para tornar warn-only durante adoption inicial:

    ```bash
    node ./.claude/framework/bin/tools.cjs config-set workflow.postmortem_required_warn true
    ```

    (Nota: implementação do toggle warn-only é deferida — gate atual lê apenas presença/ausência de pares investigation↔postmortem, não consulta config.)
    ```

    Posicionamento do arquivo: novo arquivo em `D:/projetos/opensource/mcp/gates/postmortem-template-required.md`. Nenhuma modificação em arquivos existentes.
  </action>
  <acceptance_criteria>
    - Arquivo `gates/postmortem-template-required.md` criado
    - Frontmatter canônico (4 campos: `id: postmortem-template-required`, `stage: pre-conclude`, `blocking: true`, `description ≤ 200 chars`)
    - Bloco `## Check` com bash 3.2-portable
    - Script começa com `#!/usr/bin/env bash` + `set -e`
    - Detecta 2 patterns de investigation: single-file (`<id>.md`) + subdir (`<id>/STATE.md`)
    - Detecta `Status: INCONCLUSIVE` como exceção (não exige postmortem)
    - Match por basename `<id>` entre `.planning/investigations/` e `.planning/postmortems/`
    - Skip gracefully se `.planning/investigations/` ausente OU vazio
    - Primeira linha de output é `PASS:`, `FAIL:`, ou `INFO:`
    - Cross-refs `blameless-postmortems` + `postmortem-writer` em "Why"
    - Princípio "No postmortem left unreviewed" citado literalmente
    - Rodapé `QA-SRE-02` presente
  </acceptance_criteria>
</task>

<task id="41-02-T3" name="Smoke validation — gate roda em projeto kit-mcp e fixture sintético">
  <read_first>
    - D:/projetos/opensource/mcp/gates/postmortem-template-required.md (re-leitura pós-write)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter shape
    head -8 gates/postmortem-template-required.md
    # Esperado:
    # ---
    # id: postmortem-template-required
    # stage: pre-conclude
    # blocking: true
    # description: ...
    # ---

    # 2. Description ≤ 200 chars
    desc=$(grep -E "^description:" gates/postmortem-template-required.md | head -1 | sed 's/description: //')
    echo "Description length: ${#desc}"  # esperado: ≤ 200

    # 3. Gate é discoverable via runner
    node bin/cli.js gates list 2>/dev/null | grep postmortem-template-required
    # Esperado: 1 linha mostrando o gate

    # 4. Gate roda na codebase atual — kit-mcp não tem .planning/investigations/ próprio,
    #    portanto deve passar com INFO: skip.
    node bin/cli.js gates run postmortem-template-required --yes --json 2>&1 | tail -10
    # Esperado: verdict=passed, output começa com "INFO:"

    # 5. Smoke fixture: investigation sem postmortem (FAIL esperado)
    SYNTH=$(mktemp -d -t kit-gate-pm-fail-XXXXXX)
    mkdir -p "$SYNTH/.planning/investigations"
    cat > "$SYNTH/.planning/investigations/incident-2026-05-07-001.md" <<'IEOF'
    # Investigation 2026-05-07-001

    Status: VALIDATED
    Trigger: SLO burn rate = 8 às 14:32

    ## Root Cause
    Connection pool exhaustion na Edge Function /api/orders.
    IEOF
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/postmortem-template-required.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -10
    # Esperado: "FAIL: 1 investigação(ões) sem postmortem em .planning/postmortems/: incident-2026-05-07-001"

    # 6. Smoke fixture: investigation + postmortem correspondente (PASS esperado)
    mkdir -p "$SYNTH/.planning/postmortems"
    cat > "$SYNTH/.planning/postmortems/incident-2026-05-07-001.md" <<'PEOF'
    # Postmortem incident-2026-05-07-001

    ## Summary
    Connection pool exhaustion em /api/orders.

    ## Lessons Learned
    Saturation gauge ausente — adicionar.
    PEOF
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/postmortem-template-required.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -5
    # Esperado: "PASS: todas as investigações têm postmortem correspondente em .planning/postmortems/"

    # 7. Smoke fixture: investigation INCONCLUSIVE (PASS esperado mesmo sem postmortem)
    rm "$SYNTH/.planning/postmortems/incident-2026-05-07-001.md"
    cat > "$SYNTH/.planning/investigations/incident-2026-05-07-002.md" <<'IEOF2'
    # Investigation 2026-05-07-002

    Status: INCONCLUSIVE
    Trigger: spike intermitente de p99 sem reprodução

    ## Root Cause
    Não identificada após 5 hipóteses.
    IEOF2
    # remover postmortem para forçar lookup do INCONCLUSIVE
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/postmortem-template-required.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -10
    # Esperado: incident-001 falha (sem postmortem), incident-002 skip por INCONCLUSIVE
    # Como incident-001 ainda falha, exit=1 → reescrever fixture: deletar incident-001
    rm "$SYNTH/.planning/investigations/incident-2026-05-07-001.md"
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/postmortem-template-required.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -5
    # Esperado: "INFO: investigation 'incident-2026-05-07-002' marcada INCONCLUSIVE — sem root cause, postmortem não exigido."
    # E exit code 0 (PASS)

    rm -rf "$SYNTH"
    ```
  </action>
  <acceptance_criteria>
    - `head -8` mostra frontmatter shape correto
    - `description` length ≤ 200 chars
    - `gates list` discovers `postmortem-template-required`
    - Gate executado na codebase atual: `passed` via INFO skip
    - Fixture investigation sem postmortem: `FAIL` exit 1
    - Fixture investigation + postmortem: `PASS` exit 0
    - Fixture investigation INCONCLUSIVE: `PASS` (mensagem INFO, sem exigir postmortem)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Arquivo `gates/postmortem-template-required.md` criado
- [ ] Frontmatter canônico (4 campos: `id`, `stage: pre-conclude`, `blocking: true`, `description ≤ 200 chars`)
- [ ] Bash 3.2-portable
- [ ] Detecta 2 patterns: single-file `<id>.md` + subdir `<id>/STATE.md`
- [ ] Detecta `Status: INCONCLUSIVE` como exceção (sem root cause = sem postmortem exigido)
- [ ] Match por basename `<id>`
- [ ] Skip se `.planning/investigations/` ausente OU vazio
- [ ] Primeira linha output: `PASS:` / `FAIL:` / `INFO:`
- [ ] Cross-refs `blameless-postmortems` + `postmortem-writer` no "Why"
- [ ] "No postmortem left unreviewed" citado literalmente (cap 15)
- [ ] Rodapé `QA-SRE-02`
- [ ] Smoke kit-mcp atual: PASS via skip
- [ ] Smoke fixture sem postmortem: FAIL
- [ ] Smoke fixture com postmortem: PASS
- [ ] Smoke fixture INCONCLUSIVE: PASS

## Must-haves (goal-backward)

1. Gate é blocking pre-conclude — milestone não arquiva até cada incident ter postmortem
2. Bash 3.2-portable
3. Skip gracefully se projeto sem incidents
4. Reconhece `Status: INCONCLUSIVE` como exceção (alinha com Plan 40-01 que exclui INCONCLUSIVE da chain `/postmortem`)
5. Match por basename — handoff `--from-investigation <id>` produz `.planning/postmortems/<id>.md` exato
6. Mensagem FAIL aponta solução: `/postmortem --from-investigation <id>`
7. Cita princípio canônico cap 15 — "No postmortem left unreviewed"

## Notes

- **Filosofia blocking** — diferente do `omm-no-regression` (warn-only por design — score evolutivo), este gate é blocking porque "no postmortem left unreviewed" é regra absoluta cap 15. Rebaixar para warn = aceitar blame culture (anti-pattern explícito documentado)
- **2 patterns de investigation** — Phase 37 ou usuários podem armazenar investigations como single-file OU subdir com state. Gate suporta ambos
- **INCONCLUSIVE exception** — alinhado com Plan 40-01 ("Quando NÃO sugerir chain `/postmortem`": INCONCLUSIVE em todas as hipóteses, falha trivial sem impacto a usuário, investigação cancelada). Gate aplica subset (apenas INCONCLUSIVE detectável via grep) — falhas triviais e canceladas não são auto-detectáveis
- **Phase 37 / AGCORE-SRE-03** entrega `postmortem-writer` que satisfaz este gate via `/postmortem --from-investigation <id>`
- **Phase 40 / INT-FW-V2-01** documenta a chain forense → postmortem em `kit/commands/forense.md` — este gate força que a sugestão da chain seja seguida antes de archive
