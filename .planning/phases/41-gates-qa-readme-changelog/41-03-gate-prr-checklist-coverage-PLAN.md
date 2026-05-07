---
phase: 41
plan: 03
title: Gate gates/prr-checklist-coverage.md — verifica PRR-REPORT.md cobre 6 axes
wave: 1
depends_on: []
autonomous: true
files_modified:
  - gates/prr-checklist-coverage.md
requirements: [QA-SRE-03]
status: ready
---

# Plan 03 — Criar `gates/prr-checklist-coverage.md`

## Goal

Criar **gate bash 3.2-portable blocking pre-verify** que verifica todo `PRR-REPORT.md` em `.planning/prr/**/*.md` cobre os **6 axes canônicos** do Production Readiness Review (cap 32 livro Google SRE — *Evolving SRE Engagement Model*): **System Architecture / Instrumentation / Emergency Response / Capacity Planning / Change Management / Performance**. Pular um axe = aprovação inválida (skill `production-readiness-review` regra absoluta). Cobre **QA-SRE-03**.

## Files to modify

- `D:/projetos/opensource/mcp/gates/prr-checklist-coverage.md` (NEW)

## Constraints (anti-pitfall reminders)

- **Bash 3.2-portable** — sem `mapfile`/`readarray`/`[[ =~ ]]`/`declare -A`
- **Frontmatter canônico** — `id`, `stage: pre-verify`, `blocking: true`, `description ≤ 200 chars`
- **Exit codes** — `0 = PASS` (cada PRR-REPORT.md tem os 6 axes OR não há PRR reports), `1 = FAIL` (≥ 1 axe faltando em ≥ 1 PRR-REPORT)
- **Pular gracefully** — se `.planning/prr/` não existe OR vazio, gate **passa com INFO**
- **Match flexível** — axe é detectado por heading H2 contendo nome canônico (case-insensitive). Aceitar variantes:
  - "System Architecture" / "Architecture"
  - "Instrumentation" / "Metrics" / "Monitoring" (qualquer das 3 satisfaz axe 2)
  - "Emergency Response" / "Emergency"
  - "Capacity Planning" / "Capacity"
  - "Change Management" / "Change"
  - "Performance"
- **Output formato** — primeira linha `PASS:`/`FAIL:`/`INFO:` para gate-runner
- **Por arquivo** — gate inspeciona cada `*.md` em `.planning/prr/**` independentemente; FAIL se qualquer um faltar axe

## Tasks

<task id="41-03-T1" name="Confirmar template canônico do PRR-REPORT.md (6 axes)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 35-91 — confirmar template canônico com 6 axes em headings H2 `## Axe N: <nome>`)
    - D:/projetos/opensource/mcp/kit/agents/prr-conductor.md (linhas 1-50 — confirmar que agent gera output em `.planning/prr/<service>.md`)
    - D:/projetos/opensource/mcp/gates/obs-skills-frontmatter.md (linhas 1-66 — pattern bash 3.2 com loop de validação por arquivo)
  </read_first>
  <action>
    Validação preparatória:
    1. Confirmar 6 axes canônicos do template `production-readiness-review` skill:
       - Axe 1: System Architecture
       - Axe 2: Instrumentation, Metrics, Monitoring
       - Axe 3: Emergency Response
       - Axe 4: Capacity Planning
       - Axe 5: Change Management
       - Axe 6: Performance
    2. Confirmar que `prr-conductor` agent grava em `.planning/prr/<service>.md` (Modo A) OR `.planning/prr/feature-<slug>.md` (Modo B)
    3. Confirmar que template usa headings H2 `## Axe N: <nome>` — gate procura por palavras-chave em headings, não exato match `## Axe 1: System Architecture` (PRR-REPORT pode usar `## System Architecture` direto sem o prefixo "Axe N:")
    4. Confirmar arquivo `gates/prr-checklist-coverage.md` ainda não existe
  </action>
  <acceptance_criteria>
    - 6 axes canônicos confirmados com nomes oficiais
    - Path canônico de PRR reports: `.planning/prr/**/*.md`
    - Template usa headings H2 com palavras-chave (não exato match obrigatório)
    - Arquivo `gates/prr-checklist-coverage.md` ainda não existe
  </acceptance_criteria>
</task>

<task id="41-03-T2" name="Escrever gates/prr-checklist-coverage.md">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/production-readiness-review/SKILL.md (linhas 1-30 — confirmar regras absolutas e cross-ref)
  </read_first>
  <action>
    Usar Write para criar `D:/projetos/opensource/mcp/gates/prr-checklist-coverage.md` com conteúdo:

    ```markdown
    ---
    id: prr-checklist-coverage
    stage: pre-verify
    blocking: true
    description: Valida que cada PRR-REPORT.md em .planning/prr/ cobre os 6 axes canônicos (System Architecture/Instrumentation/Emergency/Capacity/Change/Performance — cap 32 livro Google SRE).
    ---

    # PRR checklist coverage gate

    **When to run:** pre-verify (blocking — PRR sem 6 axes = aprovação inválida).

    ## Check

    ```bash
    #!/usr/bin/env bash
    # PT-BR: validar que cada PRR-REPORT.md em .planning/prr/**/*.md cobre os 6 axes do PRR.
    # Match por palavra-chave em heading H2 (case-insensitive). Pular um axe = aprovação inválida.
    # Bash 3.2-portable (macOS default).
    set -e

    PRR_DIR=".planning/prr"

    # PT-BR: se não há PRR reports, gate passa com INFO
    if [ ! -d "$PRR_DIR" ]; then
      echo "INFO: $PRR_DIR não existe — projeto sem PRR reports. Gate skipped."
      exit 0
    fi

    # PT-BR: listar todos os *.md em .planning/prr/ recursivamente
    PRR_FILES=$(find "$PRR_DIR" -type f -name "*.md" 2>/dev/null || true)
    PRR_FILES=$(echo "$PRR_FILES" | grep -v "^$" || true)

    if [ -z "$PRR_FILES" ]; then
      echo "INFO: $PRR_DIR vazio — sem PRR reports. Gate skipped."
      exit 0
    fi

    # PT-BR: para cada PRR report, validar que cobre os 6 axes
    VIOLATIONS=0
    OLDIFS="$IFS"
    IFS='
'
    for prr_file in $PRR_FILES; do
      [ -z "$prr_file" ] && continue
      [ ! -f "$prr_file" ] && continue

      # PT-BR: extrair headings H2 (case-insensitive)
      H2=$(grep -E "^## " "$prr_file" 2>/dev/null || true)

      # PT-BR: 6 axes — match em palavras-chave (qualquer variante aceitável)
      AXE_MISSING=""

      # Axe 1: System Architecture
      if ! echo "$H2" | grep -qiE "system.*architecture|architecture"; then
        AXE_MISSING="$AXE_MISSING Axe1(SystemArchitecture)"
      fi

      # Axe 2: Instrumentation / Metrics / Monitoring
      if ! echo "$H2" | grep -qiE "instrumentation|metrics|monitoring"; then
        AXE_MISSING="$AXE_MISSING Axe2(Instrumentation)"
      fi

      # Axe 3: Emergency Response
      if ! echo "$H2" | grep -qiE "emergency.*response|emergency"; then
        AXE_MISSING="$AXE_MISSING Axe3(EmergencyResponse)"
      fi

      # Axe 4: Capacity Planning
      if ! echo "$H2" | grep -qiE "capacity.*planning|capacity"; then
        AXE_MISSING="$AXE_MISSING Axe4(CapacityPlanning)"
      fi

      # Axe 5: Change Management
      if ! echo "$H2" | grep -qiE "change.*management|change"; then
        AXE_MISSING="$AXE_MISSING Axe5(ChangeManagement)"
      fi

      # Axe 6: Performance
      if ! echo "$H2" | grep -qiE "performance"; then
        AXE_MISSING="$AXE_MISSING Axe6(Performance)"
      fi

      if [ -n "$AXE_MISSING" ]; then
        echo "FAIL: $prr_file — axes ausentes:$AXE_MISSING"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    done
    IFS="$OLDIFS"

    if [ "$VIOLATIONS" -eq 0 ]; then
      total=$(echo "$PRR_FILES" | wc -l | tr -d ' ')
      echo "PASS: $total PRR-REPORT(s) cobrem os 6 axes canônicos"
      exit 0
    else
      echo "FAIL: $VIOLATIONS PRR-REPORT(s) com axes ausentes"
      echo "Sugestão: rodar /sre prr <service> ou /prr para regenerar com template canônico (6 axes obrigatórios)."
      echo "Cross-ref: kit/skills/production-readiness-review/SKILL.md + kit/agents/prr-conductor.md"
      echo "Princípio canônico: 'Pular um axe = aprovação inválida' (cap 32 livro Google SRE)."
      exit 1
    fi
    ```

    ## Verdict

    - **passed** — cada PRR-REPORT.md em `.planning/prr/**/*.md` tem H2 cobrindo os 6 axes (System Architecture / Instrumentation / Emergency Response / Capacity Planning / Change Management / Performance) OR diretório `.planning/prr/` ausente
    - **block** — pelo menos 1 PRR-REPORT.md com axe(s) ausente(s)

    ## Why

    O livro Google SRE (cap 32 — *Evolving SRE Engagement Model*) define **6 axes canônicos** do Production Readiness Review. A skill `production-readiness-review` (Phase 36 / SKFD-SRE-05) declara como regra absoluta: *"Pular um axe = aprovação inválida (lacuna oculta vira incident em 6 meses)"*.

    Sem este gate, PRRs apressados podem omitir axes "menos relevantes" (anti-pattern documentado na skill); gaps em Change Management ou Capacity Planning não detectados em PRR viram incidents em produção meses depois. Gate força padrão canônico — cada `PRR-REPORT.md` cobrindo os 6 axes integralmente, mesmo que items dentro de um axe sejam N/A para o serviço (justificativa explícita no item, não no axe).

    Cross-ref agent canônico: [`prr-conductor`](../kit/agents/prr-conductor.md) (Phase 37 / AGCORE-SRE-04). Skill: [`production-readiness-review`](../kit/skills/production-readiness-review/SKILL.md) (Phase 36 / SKFD-SRE-05). Comando: `/prr --service <name>` ou `/prr --feature <description>` (Phase 38 / CMD-SRE-04).

    ## REQ

    QA-SRE-03.

    ## Configuração

    Gate é **blocking** por default. Para tornar warn-only durante adoption inicial:

    ```bash
    node ./.claude/framework/bin/tools.cjs config-set workflow.prr_checklist_coverage_warn true
    ```

    (Nota: implementação do toggle warn-only é deferida — gate atual não consulta config.)
    ```

    Posicionamento do arquivo: novo arquivo em `D:/projetos/opensource/mcp/gates/prr-checklist-coverage.md`. Nenhuma modificação em arquivos existentes.
  </action>
  <acceptance_criteria>
    - Arquivo `gates/prr-checklist-coverage.md` criado
    - Frontmatter canônico (4 campos: `id: prr-checklist-coverage`, `stage: pre-verify`, `blocking: true`, `description ≤ 200 chars`)
    - Bloco `## Check` com bash 3.2-portable
    - Script começa com `#!/usr/bin/env bash` + `set -e`
    - Lista `find .planning/prr -type f -name "*.md"` recursivamente
    - 6 axes verificados via regex case-insensitive (`grep -qiE`)
    - Variantes aceitas: System Architecture/Architecture; Instrumentation/Metrics/Monitoring; Emergency Response/Emergency; Capacity Planning/Capacity; Change Management/Change; Performance
    - Skip gracefully se diretório `.planning/prr/` ausente OR vazio
    - Primeira linha output: `PASS:`, `FAIL:`, ou `INFO:`
    - Cross-refs `production-readiness-review` skill + `prr-conductor` agent no "Why"
    - Princípio "Pular um axe = aprovação inválida" citado
    - Rodapé `QA-SRE-03`
  </acceptance_criteria>
</task>

<task id="41-03-T3" name="Smoke validation — gate roda em projeto kit-mcp e fixture sintético">
  <read_first>
    - D:/projetos/opensource/mcp/gates/prr-checklist-coverage.md (re-leitura pós-write)
  </read_first>
  <action>
    Validação shell:

    ```bash
    # 1. Frontmatter shape
    head -8 gates/prr-checklist-coverage.md
    # Esperado:
    # ---
    # id: prr-checklist-coverage
    # stage: pre-verify
    # blocking: true
    # description: ...
    # ---

    # 2. Description ≤ 200 chars
    desc=$(grep -E "^description:" gates/prr-checklist-coverage.md | head -1 | sed 's/description: //')
    echo "Description length: ${#desc}"  # esperado: ≤ 200

    # 3. Gate é discoverable via runner
    node bin/cli.js gates list 2>/dev/null | grep prr-checklist-coverage
    # Esperado: 1 linha mostrando o gate

    # 4. Gate roda na codebase atual — kit-mcp não tem .planning/prr/ próprio,
    #    portanto deve passar com INFO: skip.
    node bin/cli.js gates run prr-checklist-coverage --yes --json 2>&1 | tail -10
    # Esperado: verdict=passed, output começa com "INFO:"

    # 5. Smoke fixture: PRR-REPORT.md cobrindo 6 axes (PASS)
    SYNTH=$(mktemp -d -t kit-gate-prr-pass-XXXXXX)
    mkdir -p "$SYNTH/.planning/prr"
    cat > "$SYNTH/.planning/prr/orders-api.md" <<'PEOF'
    # PRR Checklist — orders-api — 2026-05-07

    Reviewer: @sre-team
    Status: Approved

    ## Axe 1: System Architecture
    - [x] Redundância

    ## Axe 2: Instrumentation, Metrics, Monitoring
    - [x] 4 golden signals

    ## Axe 3: Emergency Response
    - [x] Runbook

    ## Axe 4: Capacity Planning
    - [x] Load test

    ## Axe 5: Change Management
    - [x] Canary release

    ## Axe 6: Performance
    - [x] Latency baseline
    PEOF
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/prr-checklist-coverage.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -5
    # Esperado: "PASS: 1 PRR-REPORT(s) cobrem os 6 axes canônicos"

    # 6. Smoke fixture: PRR-REPORT.md com axes ausentes (FAIL esperado)
    cat > "$SYNTH/.planning/prr/orders-api.md" <<'PEOF2'
    # PRR Checklist — orders-api — 2026-05-07

    ## Axe 1: System Architecture
    - [x] Redundância

    ## Axe 2: Instrumentation
    - [x] golden signals

    ## Axe 6: Performance
    - [x] Latency baseline
    PEOF2
    # ausentes: Axe 3 (Emergency), Axe 4 (Capacity), Axe 5 (Change)
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/prr-checklist-coverage.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -5
    # Esperado: "FAIL: ... — axes ausentes: Axe3(EmergencyResponse) Axe4(CapacityPlanning) Axe5(ChangeManagement)"

    # 7. Smoke fixture: variante de naming (sem prefixo "Axe N:") — PASS esperado
    cat > "$SYNTH/.planning/prr/orders-api.md" <<'PEOF3'
    # PRR — orders-api

    ## System Architecture
    - [x] redundância

    ## Monitoring
    - [x] golden signals

    ## Emergency Response
    - [x] runbook

    ## Capacity
    - [x] load test

    ## Change Management
    - [x] canary

    ## Performance
    - [x] baseline
    PEOF3
    (cd "$SYNTH" && bash <(grep -A100 '^```bash$' D:/projetos/opensource/mcp/gates/prr-checklist-coverage.md | sed -n '/^```bash$/,/^```$/p' | sed '1d;$d')) 2>&1 | head -5
    # Esperado: "PASS: 1 PRR-REPORT(s) cobrem os 6 axes canônicos"
    # ("Architecture", "Monitoring", "Emergency Response", "Capacity", "Change Management", "Performance" — todos matchados via regex case-insensitive)

    rm -rf "$SYNTH"
    ```
  </action>
  <acceptance_criteria>
    - `head -8` mostra frontmatter shape correto
    - `description` length ≤ 200 chars
    - `gates list` discovers `prr-checklist-coverage`
    - Gate executado na codebase atual: `passed` via INFO skip
    - Fixture com 6 axes: `PASS` exit 0
    - Fixture com axes ausentes: `FAIL` exit 1 (lista de axes ausentes na mensagem)
    - Fixture com variantes de naming (`## Architecture`, `## Monitoring`, `## Capacity`): `PASS` (regex case-insensitive matcha)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] Arquivo `gates/prr-checklist-coverage.md` criado
- [ ] Frontmatter canônico (4 campos: `id`, `stage: pre-verify`, `blocking: true`, `description ≤ 200 chars`)
- [ ] Bash 3.2-portable
- [ ] `find .planning/prr -type f -name "*.md"` recursivo
- [ ] 6 axes via `grep -qiE` case-insensitive
- [ ] Variantes aceitas em cada axe (Architecture, Monitoring, Capacity, etc.)
- [ ] Skip gracefully se `.planning/prr/` ausente OR vazio
- [ ] Primeira linha output: `PASS:`/`FAIL:`/`INFO:`
- [ ] Cross-refs `production-readiness-review` + `prr-conductor` no "Why"
- [ ] "Pular um axe = aprovação inválida" citado
- [ ] Rodapé `QA-SRE-03`
- [ ] Smoke kit-mcp atual: PASS via skip
- [ ] Smoke fixture com 6 axes: PASS
- [ ] Smoke fixture com axes ausentes: FAIL com lista de ausentes
- [ ] Smoke fixture com variantes naming: PASS

## Must-haves (goal-backward)

1. Gate é blocking pre-verify — fase não passa se PRR-REPORT.md incompleto
2. Bash 3.2-portable
3. Skip gracefully se projeto sem PRR
4. 6 axes verificados via regex case-insensitive — aceitar variantes naming (Architecture/System Architecture, Monitoring/Instrumentation, etc.) sem deixar de detectar omissão
5. Por arquivo — cada `.planning/prr/**/*.md` validado independentemente
6. Mensagem FAIL lista axes ausentes por arquivo
7. Cross-refs ATIVOS para skill + agent + command (`/prr`)

## Notes

- **Regex inclusivo** — gate aceita "Architecture" sem "System" (Axe 1) e "Monitoring" sem "Instrumentation" (Axe 2). Isso evita false-positives quando autor usa naming abreviado mas cobertura é real
- **Risco de false-negative** — palavra "performance" pode aparecer em outras seções (e.g., "## Notes\n...performance issues..."). Filtro `grep -E "^## "` antes do match limita a headings H2 — minimiza false-positive
- **Não verifica conteúdo** — gate só verifica presença de heading, não qualidade dos itens dentro. Itens vazios em axe ainda passam o gate. Skill `production-readiness-review` documenta itens canônicos mas gate força apenas estrutura
- **Phase 37 / AGCORE-SRE-04** entrega `prr-conductor` que gera output canônico cobrindo os 6 axes
- **Phase 40 / INT-FW-V2-02** documenta gate PRR opcional em `/concluir-marco` para features production-bound; este gate (QA-SRE-03) valida estrutura do PRR-REPORT.md durante verify, antes do gate de conclusão consultar status
