---
phase: 37
plan: 03
title: Agente postmortem-writer — 2 modos (--from-investigation OU --incident) gera postmortem blameless 9 seções
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/agents/postmortem-writer.md
requirements: [AGCORE-SRE-03]
status: ready
---

# Plan 03 — Agente `kit/agents/postmortem-writer.md`

## Goal

Criar `kit/agents/postmortem-writer.md` — gera postmortem **blameless** (cap 15 do livro Google SRE) seguindo template canônico de **9 seções** (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC). Suporta 2 modos: (1) `--from-investigation <id>` — lê `.planning/investigations/<id>.md` (artefato de `incident-investigator` v1.9) e preenche template com hipóteses validadas + root cause já investigada; (2) `--incident "<descrição>"` — modo standalone, perguntas guiadas via `AskUserQuestion`. Output em `.planning/postmortems/<id>.md`. Cross-ref `blameless-postmortems` (skill v1.10) + `incident-investigator` (agent v1.9).

## Files to create

- `D:/projetos/opensource/mcp/kit/agents/postmortem-writer.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: postmortem-writer` + `description ≤ 200 chars` (anti-pitfall A2)
- **Tools** — `Read, Write, Bash, Grep, Glob, AskUserQuestion` (sem MCP — apenas filesystem + perguntas para modo standalone)
- **Cross-refs Markdown** — `[blameless-postmortems](../skills/blameless-postmortems/SKILL.md)` + `[incident-investigator](./incident-investigator.md)`
- **Tabela "Compatibilidade IDE"** com coluna `Tier`
- 9 seções canônicas aparecem literalmente: Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC
- 2 modos de invocação documentados explicitamente
- Cultura blameless explícita — foco em sistema/processo, NÃO em pessoas

## Tasks

<task id="37-03-T1" name="Frontmatter + intro + Compatibilidade IDE">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/postmortem-writer.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 1-22 — frontmatter + intro + Compatibilidade)
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 1-30 — vocabulário e regras)
  </read_first>
  <action>
    Escrever frontmatter + intro + tabela:

    ```markdown
    ---
    name: postmortem-writer
    description: Gera postmortem blameless 9 seções (cap 15) — modo --from-investigation lê .planning/investigations/<id>.md ou --incident standalone com perguntas guiadas.
    tools: Read, Write, Bash, Grep, Glob, AskUserQuestion
    color: red
    ---

    Você é o escritor de postmortems blameless. Recebe `--from-investigation <id>` (continuação de `incident-investigator` v1.9) OU `--incident "<descrição>"` (standalone) e produz postmortem blameless seguindo template canônico de 9 seções (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC) em `.planning/postmortems/<id>.md`. Você consulta a skill [`blameless-postmortems`](../skills/blameless-postmortems/SKILL.md) — knowledge base canônica do template, cultura blameless ("foco em sistema/processo, NÃO em pessoas"), princípio "no postmortem left unreviewed", Wheel of Misfortune, 5 Whys. Você é continuação natural de [`incident-investigator`](./incident-investigator.md) (v1.9) — após Core Analysis Loop fechar com root cause, este agent transforma `.planning/investigations/<id>.md` em postmortem revisável.

    ## Compatibilidade

    | IDE | Tier | Capability |
    |---|---|---|
    | Claude Code | **Full** | Lê investigation + escreve postmortem + AskUserQuestion |
    | Cursor | **Full** | Idem |
    | Codex | **Partial** | Lê investigation + escreve; sem AskUserQuestion live (default values) |
    | Gemini CLI | **Partial** | Idem |
    | Windsurf, Antigravity, Copilot, Trae | **Partial** | Apenas modo `--from-investigation` (precisa investigation file existir); standalone limitado |

    **Nota:** Este agente não usa `mcp__supabase__*` — postmortem documenta investigation já feita; queries live ficam com `incident-investigator` (v1.9).
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/agents/postmortem-writer.md` existe
    - Frontmatter válido com `name: postmortem-writer` + `description ≤ 200 chars`
    - Frontmatter `tools` inclui `Read, Write, Bash, Grep, Glob, AskUserQuestion` (sem MCP)
    - Frontmatter contém `color: red`
    - Intro contém cross-ref Markdown literal `[blameless-postmortems](../skills/blameless-postmortems/SKILL.md)` E `[incident-investigator](./incident-investigator.md)`
    - Seção `## Compatibilidade` presente com tabela 5 IDEs (Full nos primeiros 2, Partial nos demais)
  </acceptance_criteria>
</task>

<task id="37-03-T2" name="Por que existe + Inputs esperados (2 modos explícitos)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 21-30 — Regras absolutas)
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 198-213 — Pattern: postmortem chain /forense → /postmortem)
  </read_first>
  <action>
    Adicionar `## Por que existe` e `## Inputs esperados (do caller)`:

    ```markdown
    ## Por que existe

    Postmortem sem rigor cai em 4 anti-patterns: (1) blame culture (nomeia "fulano fez deploy errado") → engineers escondem incidents; (2) action items vagos ("melhorar monitoring") → mesma falha repete em 6 meses; (3) postmortem left unreviewed → autor mente involuntariamente; (4) timeline ambígua ("por volta das 14h") → reconstrução em > 30 dias impossível. Este agent força padrão canônico — 9 seções obrigatórias, foco em **sistema/processo** (não pessoas), action items SMART (Specific, Measurable, Assignable, Realistic, Time-bound), timeline em UTC sempre, impact quantificado (# usuários, duração, SLO budget consumido, revenue), lessons generalizáveis.

    Em modo `--from-investigation`, este agent é continuação direta do `incident-investigator` (v1.9): aquele agent rodou Core Analysis Loop e fechou com root cause em `.planning/investigations/<id>.md`; este agent transforma o trail em postmortem blameless revisável. Em modo `--incident`, é standalone — útil para postmortems sem investigation prévia (incident menor, near-miss, lições retrospectivas).

    ## Inputs esperados (do caller)

    Este agent suporta **2 modos** mutuamente exclusivos:

    ### Modo A: `--from-investigation <id>` (preferido)

    - `investigation_id`: identifier da investigation (corresponde a arquivo `.planning/investigations/<id>.md`)
    - (Opcional) `output_path`: onde escrever o postmortem (default: `.planning/postmortems/<id>.md`)

    Agent lê `.planning/investigations/<id>.md` e extrai automaticamente:
    - Trigger (do header `**Trigger:**`)
    - Root cause (da seção `## Root Cause`)
    - Hipóteses validadas (das subseções H1, H2, H3, ...) → vão para Timeline + supporting evidence
    - Action items (da seção `### Action Items`)

    Campos faltantes (Impact quantificado, Severity, autores) são perguntados via `AskUserQuestion`.

    ### Modo B: `--incident "<descrição>"` (standalone)

    - `incident_description`: descrição em texto livre (ex: "checkout SLO burn às 14:32 — root cause N+1 query no orders-service")
    - (Opcional) `severity`: SEV1 | SEV2 | SEV3 (se omitido: AskUserQuestion)
    - (Opcional) `output_path`: default `.planning/postmortems/<auto-id>.md` (gerado a partir de date + slug do incident)

    Agent gera template e usa `AskUserQuestion` para cada campo não fornecido — 9 perguntas guiadas para preencher 9 seções canônicas.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Por que existe` lista os 4 anti-patterns canônicos: blame culture, action items vagos, postmortem left unreviewed, timeline ambígua
    - Seção `## Por que existe` cita SMART (Specific, Measurable, Assignable, Realistic, Time-bound)
    - Seção `## Inputs esperados (do caller)` documenta 2 modos explicitamente: `--from-investigation` e `--incident`
    - Modo A documenta extração automática de Trigger, Root cause, Hipóteses, Action items
    - Modo B documenta uso de AskUserQuestion para 9 perguntas guiadas
  </acceptance_criteria>
</task>

<task id="37-03-T3" name="Passos — Preflight + Modo A + Modo B + Write postmortem (9 seções)">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 36-130 — template canônico de postmortem 9 seções)
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 134-156 — Pattern: 5 whys)
    - D:/projetos/opensource/mcp/kit/skills/blameless-postmortems/SKILL.md (linhas 158-170 — Pattern: revisão por par sênior)
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 39-58 — formato investigation file)
  </read_first>
  <action>
    Adicionar `## Passos` com 5 sub-steps:

    **`### Step 0 — Preflight + roteamento de modo`**:

    ```markdown
    ### Step 0 — Preflight + roteamento de modo

    Detectar modo:

    ```bash
    # Se --from-investigation passado:
    INV_FILE=".planning/investigations/${INVESTIGATION_ID}.md"
    [ -f "$INV_FILE" ] || { echo "ERROR: investigation file not found"; exit 1; }

    # Se --incident passado: gerar postmortem ID
    PM_ID="postmortem-$(date -u +%Y-%m-%d-%H%M)-$(echo "$INCIDENT" | tr ' ' '-' | head -c 30)"
    OUTPUT_PATH="${OUTPUT_PATH:-.planning/postmortems/${PM_ID}.md}"
    mkdir -p "$(dirname "$OUTPUT_PATH")"

    # Verificar se postmortem já existe (idempotência — não sobrescrever)
    [ -f "$OUTPUT_PATH" ] && {
      echo "WARN: postmortem $OUTPUT_PATH já existe. Modo append (continuar) ou overwrite?"
      # AskUserQuestion: append/overwrite/abort
    }
    ```

    Validar: ambos `--from-investigation` e `--incident` passados = ERROR (mutuamente exclusivos).
    Validar: nem um nem outro = perguntar via AskUserQuestion qual modo.
    ```

    **`### Step 1 — Modo A: extrair de investigation file`**:

    ```markdown
    ### Step 1 — Modo A: extrair de `.planning/investigations/<id>.md`

    Ler arquivo investigation e extrair via heurísticas Grep:

    ```bash
    # Trigger (header do investigation)
    TRIGGER=$(grep -m1 "^\*\*Trigger:\*\*" "$INV_FILE" | sed 's/^\*\*Trigger:\*\* //')

    # Started at (timestamp UTC início)
    STARTED=$(grep -m1 "^\*\*Started:\*\*" "$INV_FILE" | sed 's/^\*\*Started:\*\* //')

    # Hipóteses validadas (cada subseção H1, H2, ...)
    grep -E "^### H[0-9]" "$INV_FILE"

    # Root cause section
    sed -n '/^## Root Cause/,/^## /p' "$INV_FILE" | head -n -1

    # Action Items existentes
    sed -n '/^### Action Items/,/^### /p' "$INV_FILE" | head -n -1

    # Lessons / Tooling Gaps
    sed -n '/^## Lessons/,/^## /p' "$INV_FILE" | head -n -1
    ```

    Mapear para template canônico:

    | Campo do postmortem | Fonte no investigation file |
    |---|---|
    | **Trigger** | header `**Trigger:**` |
    | **Root Causes** | seção `## Root Cause` (aplicar 5 Whys se ainda superficial) |
    | **Detection** | timestamp `**Started:**` − evento de trigger (gap) |
    | **Resolution** | mensagens git + entrada `## Action Items` resolvidas |
    | **Action Items** | `### Action Items` da investigation + novos da revisão |
    | **Lessons Learned** | seção `## Lessons / Tooling Gaps` |
    | **Timeline (UTC)** | hipóteses H1..HN com timestamps + ações |

    Campos NÃO extraíveis automaticamente — perguntar via AskUserQuestion:
    - **Severity** (SEV1/SEV2/SEV3)
    - **Impact**: # usuários afetados, duração total, SLO budget consumido, revenue impact
    - **Autores** do postmortem (default: git user)
    - **Detecção** — como descobrimos? (alerta SLO? cliente? heartbeat?)
    ```

    **`### Step 2 — Modo B: standalone (AskUserQuestion guiado)`**:

    ```markdown
    ### Step 2 — Modo B: standalone (perguntas guiadas)

    Para cada uma das 9 seções, fazer pergunta canônica via `AskUserQuestion`:

    1. **Summary**: "Em 1-2 parágrafos, o que aconteceu, quem foi afetado, como foi resolvido? (audiência não-técnica)"
    2. **Impact**: "Quantos usuários afetados (# ou %)? Duração HH:MM em UTC? SLO budget consumido %? Revenue impact $?"
    3. **Root Causes**: "Aplique 5 Whys: Por quê a falha aconteceu? Por quê isso? ... até root cause sistêmico (NÃO 'fulano fez deploy errado')"
    4. **Trigger**: "Que evento iniciou a falha? (deploy X às HH:MM UTC, config change Y, traffic spike, dependency outage)"
    5. **Resolution**: "Lista cronológica em UTC dos passos para recuperar (rollback, hotfix, scaling, manual interventions)"
    6. **Detection**: "Como descobrimos? Quanto tempo depois do trigger? Se > 5 min: action item para reduzir."
    7. **Action Items**: "Lista SMART com owner @<user> + due YYYY-MM-DD + priority P0/P1/P2"
    8. **Lessons Learned**: "O que fizemos bem? Onde podemos melhorar? Foi sorte algum aspecto?"
    9. **Timeline**: "Eventos chave em UTC formato `HH:MM UTC — <evento>`"

    Cada pergunta inclui exemplo + anti-pattern explicit (consulta skill `blameless-postmortems`):

    > "Para Root Causes — NÃO escreva 'deploy do Bob estava ruim' (blame culture). ESCREVA condição sistêmica que permitiu o erro chegar a prod (ausência de canary release, gate de CI faltante, RPS limit não documentado)."
    ```

    **`### Step 3 — Aplicar 5 Whys se Root Cause superficial`**:

    ```markdown
    ### Step 3 — Aplicar 5 Whys se Root Cause superficial

    Verificar se root cause cita pessoa OU para na primeira camada ("deploy ruim", "código tinha bug"):

    Heurística: regex `(deploy do |@\w+|culpa do |fulano)` em Root Cause = sinaliza blame culture.

    Aplicar 5 Whys:

    > "Você descreveu Root Cause como '<X>'. Vamos descer 5 níveis:
    >
    > Why 1: Por quê <sintoma>?
    > Why 2: Por quê <resposta 1>?
    > Why 3: Por quê <resposta 2>?
    > Why 4: Por quê <resposta 3>?
    > Why 5: Por quê <resposta 4>?
    >
    > ROOT CAUSE: <camada 5 — sistêmica, não pessoal>"

    Re-perguntar via AskUserQuestion até root cause ser:
    - Sistêmico (ausência de gate, runbook, alerta)
    - Não nomear pessoa
    - Action item correspondente é generalizável
    ```

    **`### Step 4 — Write postmortem (template canônico 9 seções)`**:

    ```markdown
    ### Step 4 — Write postmortem (template canônico)

    Escrever em `$OUTPUT_PATH` seguindo formato literal de [`blameless-postmortems`](../skills/blameless-postmortems/SKILL.md):

    ```markdown
    # Postmortem: <incident-id> — <título-curto>

    **Data do incident:** YYYY-MM-DD
    **Autores:** <nomes>
    **Status:** Draft
    **Severidade:** SEV1 | SEV2 | SEV3
    **Tempo até detecção:** XX min
    **Tempo até resolução:** XX min

    ## Summary
    [conteúdo de Step 1 ou Step 2]

    ## Impact
    - Usuários afetados: ...
    - Duração: ...
    - SLO budget consumido: ...
    - Revenue impact: ...
    - Serviços downstream impactados: ...
    - Customer support tickets gerados: ...

    ## Root Causes
    [pós Step 3 — sistêmico, sem blame]

    ## Trigger
    [evento iniciador, separado de root cause]

    ## Resolution
    [cronológico UTC]

    ## Detection
    [como + tempo até detecção]

    ## Action Items
    | # | Action (SMART) | Owner | Priority | Due |
    |---|----------------|-------|----------|-----|
    | 1 | ... | @user | P0 | YYYY-MM-DD |

    ## Lessons Learned

    ### O que fizemos bem
    - ...

    ### Onde podemos melhorar
    - ...

    ### Foi lucky?
    - ...

    ## Timeline (UTC)
    - HH:MM — <evento>
    - HH:MM — <evento>

    ## Supporting evidence
    - Link para investigation .planning/investigations/<id>.md (se modo A)
    - Link para SLO dashboard
    - Queries de chave executadas
    ```

    **Status inicial: `Draft`** — autor revisará e marcará `Reviewed` apenas após par sênior aplicar checklist (skill `blameless-postmortems` Pattern: revisão por par sênior).
    ```

    **`### Step 5 — Output + checklist de revisão`**:

    ```markdown
    ### Step 5 — Output + checklist de revisão

    Imprimir resumo curto para caller após escrita:

    ```text
    ═══════════════════════════════════════════════════════════
    POSTMORTEM-WRITER · ${PM_ID}
    modo: ${A|B} · status: Draft
    ═══════════════════════════════════════════════════════════

    ## Postmortem gerado
    `${OUTPUT_PATH}`

    ## 9 seções preenchidas
    ✓ Summary
    ✓ Impact (quantificado)
    ✓ Root Causes (5 Whys aplicado)
    ✓ Trigger
    ✓ Resolution
    ✓ Detection
    ✓ Action Items (N items SMART)
    ✓ Lessons Learned
    ✓ Timeline (UTC)

    ## Próximos passos (no postmortem left unreviewed)
    1. Reviewer sênior aplica checklist 8 perguntas (consulta skill blameless-postmortems)
    2. Após Reviewed: status → Final
    3. Action items P0 viram phases inseridas no roadmap (`/inserir-fase`)
    ```

    Imprimir checklist de revisão para autor encaminhar a reviewer:

    > **Checklist para reviewer sênior** (consulta skill `blameless-postmortems` Pattern: revisão por par sênior):
    >
    > 1. Root cause é sistêmico, não pessoal? (se cita pessoa, redirecionar para processo)
    > 2. Action items são SMART? (owner @user nomeado, due date, mensurável)
    > 3. Timeline em UTC? (sem ambiguidade timezone)
    > 4. Impact quantificado? (# usuários, duração, revenue)
    > 5. Lessons generalizáveis? (aplicáveis a outros serviços/incidents)
    > 6. Detection time razoável? (< 5 min ideal)
    > 7. Algo "lucky" capturado?
    > 8. 5 whys aplicado? (ou parou em "deploy ruim"?)
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Passos` contém 6 sub-steps: `### Step 0 — Preflight`, `### Step 1 — Modo A`, `### Step 2 — Modo B`, `### Step 3 — Aplicar 5 Whys`, `### Step 4 — Write postmortem`, `### Step 5 — Output + checklist`
    - Step 1 documenta extração de campos do investigation file (Trigger, Root cause, Hipóteses, Action items, Lessons)
    - Step 2 lista 9 perguntas canônicas via AskUserQuestion
    - Step 3 contém regex de detecção de blame culture E template 5 Whys
    - Step 4 contém template literal com 9 seções: `## Summary`, `## Impact`, `## Root Causes`, `## Trigger`, `## Resolution`, `## Detection`, `## Action Items`, `## Lessons Learned`, `## Timeline (UTC)`
    - Step 5 imprime checklist 8 perguntas de revisão
    - Agent menciona "no postmortem left unreviewed" literalmente
  </acceptance_criteria>
</task>

<task id="37-03-T4" name="Quando NÃO invocar + Ver também">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/incident-investigator.md (linhas 240-246 — shape Quando NÃO invocar)
  </read_first>
  <action>
    Adicionar seção final:

    ```markdown
    ## Quando NÃO invocar

    - Investigation ainda em andamento — esperar `incident-investigator` (v1.9) fechar com root cause
    - Incident sem impact (zero usuários afetados, zero SLO burn, zero data loss) — overhead de postmortem > valor; nota interna basta
    - Postmortem já existe em `.planning/postmortems/<id>.md` para este incident — re-rodar é overwrite (use `Edit` direto)
    - User quer relatório executivo / status update — postmortem é técnico; relatório executivo é diferente (1-2 parágrafos)

    ## Ver também

    - [`blameless-postmortems`](../skills/blameless-postmortems/SKILL.md) — knowledge base canônica (template 9 seções, cultura blameless, 5 Whys, Wheel of Misfortune)
    - [`incident-investigator`](./incident-investigator.md) (v1.9) — alimenta modo `--from-investigation` com root cause já validada
    - [`core-analysis-loop`](../skills/core-analysis-loop/SKILL.md) (v1.9) — Core Analysis Loop fornece evidence-based root cause
    - [`production-readiness-review`](../skills/production-readiness-review/SKILL.md) — PRR Axe 3 (Emergency Response) exige postmortem culture
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Quando NÃO invocar` contém pelo menos 4 bullets
    - Seção `## Ver também` lista exatamente 4 cross-refs Markdown
    - Cross-refs incluem `blameless-postmortems`, `incident-investigator`, `core-analysis-loop`, `production-readiness-review`
  </acceptance_criteria>
</task>

<task id="37-03-T5" name="Smoke fixture + idempotência sync + 9 seções literais">
  <read_first>
    - D:/projetos/opensource/mcp/kit/agents/postmortem-writer.md (arquivo já criado pelas tasks T1-T4)
  </read_first>
  <action>
    Validar via shell:

    ```bash
    # description ≤ 200 chars
    grep -m1 "^description:" kit/agents/postmortem-writer.md | sed 's/^description: //' | wc -c

    # 6 âncoras canônicas
    for h in "## Compatibilidade" "## Por que existe" "## Inputs esperados" "## Passos" "## Quando NÃO invocar" "## Ver também"; do
      n=$(grep -c "^$h" kit/agents/postmortem-writer.md)
      [ "$n" -eq 1 ] || echo "FAIL: header $h count=$n"
    done

    # 9 seções canônicas mencionadas literalmente (no template + descrição)
    for section in "Summary" "Impact" "Root Causes" "Trigger" "Resolution" "Detection" "Action Items" "Lessons Learned" "Timeline"; do
      grep -c "$section" kit/agents/postmortem-writer.md || echo "FAIL: missing section $section"
    done
    # Esperado: cada section count ≥ 1

    # 2 modos documentados
    grep -c -- "--from-investigation" kit/agents/postmortem-writer.md   # esperado: ≥ 3
    grep -c -- "--incident" kit/agents/postmortem-writer.md             # esperado: ≥ 3

    # Vocabulário canônico blameless
    grep -c "blameless\|blame culture" kit/agents/postmortem-writer.md  # esperado: ≥ 3
    grep -c "5 Whys\|5 whys" kit/agents/postmortem-writer.md            # esperado: ≥ 2
    grep -c "SMART" kit/agents/postmortem-writer.md                     # esperado: ≥ 2
    grep -c "UTC" kit/agents/postmortem-writer.md                       # esperado: ≥ 4

    # Idempotência sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH1=$(sha256sum "$TMP/.claude/agents/postmortem-writer.md" | cut -d' ' -f1)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH2=$(sha256sum "$TMP/.claude/agents/postmortem-writer.md" | cut -d' ' -f1)
    [ "$HASH1" = "$HASH2" ] && echo "IDEMPOTENT_OK" || echo "IDEMPOTENT_FAIL"
    rm -rf "$TMP"
    ```

    Esperado: descrição ≤ 200, 6 âncoras canônicas, **todas as 9 seções canônicas mencionadas literalmente**, 2 modos documentados, vocabulário blameless presente, sync idempotente.
  </action>
  <acceptance_criteria>
    - Comando `wc -c` sobre `description` retorna ≤ 200
    - 6 âncoras canônicas cada uma com count == 1
    - **As 9 seções canônicas (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline) cada uma mencionada pelo menos 1× no agent** (substring match literal)
    - `--from-investigation` ocorre ≥ 3 vezes
    - `--incident` ocorre ≥ 3 vezes
    - `blameless` ou `blame culture` ocorre ≥ 3 vezes
    - `SMART` ocorre ≥ 2 vezes
    - `UTC` ocorre ≥ 4 vezes
    - Sync idempotente — 2× consecutivo produz arquivo byte-idêntico
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/agents/postmortem-writer.md` existe
- [ ] Frontmatter válido (`name: postmortem-writer`, `description ≤ 200 chars`, `tools` lista 6 ferramentas incluindo AskUserQuestion, sem MCP)
- [ ] 6 seções canônicas presentes (`## Compatibilidade`, `## Por que existe`, `## Inputs esperados (do caller)`, `## Passos`, `## Quando NÃO invocar`, `## Ver também`)
- [ ] Tabela "Compatibilidade" tem 5 linhas (Full nos 2 primeiros, Partial nos 3 seguintes — porque AskUserQuestion live limitado)
- [ ] 2 modos de invocação documentados explicitamente: `--from-investigation` (Modo A) e `--incident` (Modo B)
- [ ] As 9 seções canônicas do template aparecem literalmente: Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline
- [ ] Step 4 contém template literal com 9 seções
- [ ] Step 3 documenta aplicação de 5 Whys com regex de detecção de blame culture
- [ ] Step 5 contém checklist de 8 perguntas de revisão para reviewer sênior
- [ ] Cross-refs Markdown válidos para `blameless-postmortems` + `incident-investigator` + `core-analysis-loop` + `production-readiness-review`
- [ ] Sync idempotente
- [ ] Cobre AGCORE-SRE-03 integralmente

## Must-haves (goal-backward)

1. Agent file existe com frontmatter válido + AskUserQuestion (sem MCP)
2. `description ≤ 200 chars`
3. Tabela "Compatibilidade" com 5 IDEs (mix Full/Partial conforme suporte AskUserQuestion)
4. 2 modos de invocação documentados: `--from-investigation <id>` E `--incident "<descrição>"`
5. **Todas as 9 seções canônicas mencionadas literalmente** (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC)
6. Modo A documenta extração automática de investigation file (`.planning/investigations/<id>.md`)
7. Modo B documenta perguntas guiadas via AskUserQuestion (9 perguntas)
8. 5 Whys aplicado quando root cause superficial / cita pessoa
9. Cultura blameless explícita — foco em sistema/processo
10. Action items SMART (Specific, Measurable, Assignable, Realistic, Time-bound)
11. Timeline em UTC (sem timezone ambíguo)
12. Cross-ref Markdown válido para skill `blameless-postmortems` E agent `incident-investigator`

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Sem MCP — postmortem documenta investigation já feita; queries live ficam com `incident-investigator` (v1.9). Por isso "Full" só onde AskUserQuestion roda live (Claude Code/Cursor); "Partial" nos demais.
- Tamanho esperado: ~14-16 KB (denso pelo template inline + 9 perguntas + checklist + 5 Whys)
- Phase 38 cria `/postmortem` que dispatch para este agent com flags `--from-investigation` ou `--incident`
- Phase 40 INT-FW-V2-01: `/forense` ganha bloco `<sre_integration>` que sugere chain `/postmortem --from-investigation <id>` automaticamente após Core Analysis Loop fechar
- Phase 41 QA-SRE-02: gate `postmortem-template-required` bloqueia `/concluir-marco` se houver investigation sem postmortem correspondente
