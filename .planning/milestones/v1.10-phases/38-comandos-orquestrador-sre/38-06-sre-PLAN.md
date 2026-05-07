---
phase: 38
plan: 06
title: Comando orquestrador /sre — terceiro orquestrador da família após /supabase (v1.8) e /observabilidade (v1.9)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/sre.md
requirements: [CMD-SRE-06]
status: ready
---

# Plan 06 — Comando orquestrador `kit/commands/sre.md`

## Goal

Criar `kit/commands/sre.md` — orquestrador único da Suíte SRE (v1.10), análogo a `/supabase` (v1.8) e `/observabilidade` (v1.9). Recebe subcomando + args, faz dispatch via `Task(subagent_type=...)` para o agent SRE correto. **Subcomandos suportados (sinônimos PT/EN):** `golden-signals`, `auditar-toil`/`audit-toil`, `postmortem`, `prr`, `risk-budget`/`budget`, `help`/`ajuda`/`?`. Mantém anti-pitfall A10 do v1.8: orquestrador é único ponto de chain de agents SRE — agents permanecem função pura. Modelo direto: `kit/commands/observabilidade.md` (v1.9). Cobre **CMD-SRE-06**.

## Files to create

- `D:/projetos/opensource/mcp/kit/commands/sre.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: sre` + `description ≤ 200 chars` (anti-pitfall A2)
- **`allowed-tools` inclui `Task` + `AskUserQuestion`** — orquestrador dispatch agents + pergunta quando subcomando ambíguo
- **Cross-ref Markdown** ativo para os 4 agents SRE (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) + skill `sre-risk-management`
- **Único ponto de chain** (anti-pitfall A10) — orquestrador é o único comando que invoca agents SRE via Task; agents permanecem função pura sem chain interno
- **`risk-budget` é caso especial** — não invoca agent (Plan 05 é comando direto); orquestrador delega via shell call ao comando `/risk-budget` ou aplica skill direto
- **Sinônimos PT/EN** — espelha convenção v1.9 (`auditar`/`audit`, `ajuda`/`help`/`?`)

## Tasks

<task id="38-06-T1" name="Frontmatter + objective + execution_context">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/sre.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/commands/observabilidade.md (linhas 1-27 — frontmatter + objective + execution_context, precedente direto v1.9)
    - D:/projetos/opensource/mcp/kit/commands/supabase.md (linhas 1-26 — outro precedente família orquestradores v1.8)
  </read_first>
  <action>
    Escrever frontmatter + `<objective>` + `<execution_context>`:

    ```markdown
    ---
    name: sre
    description: Orquestrador da Suíte SRE (v1.10) — dispatch para agents (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) com sinônimos PT/EN.
    argument-hint: "<subcomando> [args...]"
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
    Orquestrador único da Suíte SRE (v1.10) — terceiro orquestrador da família após [`/supabase`](./supabase.md) (v1.8) e [`/observabilidade`](./observabilidade.md) (v1.9). Recebe subcomando + args, faz dispatch via `Task(subagent_type=...)` para o agent SRE correto. **Único ponto de chain de agents SRE** (anti-pitfall A10 mantido — agents permanecem função pura).

    **Subcomandos cobrem cap 3, 5, 6, 15, 32 do livro Google SRE:**
    - `golden-signals` — 4 signals universais (cap 6)
    - `auditar-toil`/`audit-toil` — eliminating toil (cap 5)
    - `postmortem` — blameless postmortem (cap 15)
    - `prr` — Production Readiness Review (cap 32)
    - `risk-budget`/`budget` — risk continuum (cap 3)

    **Cria/Atualiza:** o que cada agent invocado cria (patches OTel, TOIL-AUDIT.md, postmortem, PRR-REPORT.md, snapshot risk-budget).

    **Após:** o usuário tem o output do agent (instrumentação aplicada, audit, postmortem revisável, PRR scored, ou snapshot de budget).
    </objective>

    <execution_context>
    Skills consultadas pelos agents (Phase 36): `kit/skills/sre-risk-management/SKILL.md`, `kit/skills/four-golden-signals/SKILL.md`, `kit/skills/eliminating-toil/SKILL.md`, `kit/skills/blameless-postmortems/SKILL.md`, `kit/skills/production-readiness-review/SKILL.md` + glossário em `kit/skills/_shared-sre/glossary.md`.

    Agents disponíveis (Phase 37):
    - [`golden-signals-instrumenter`](../agents/golden-signals-instrumenter.md) — AGCORE-SRE-01
    - [`toil-auditor`](../agents/toil-auditor.md) — AGCORE-SRE-02
    - [`postmortem-writer`](../agents/postmortem-writer.md) — AGCORE-SRE-03
    - [`prr-conductor`](../agents/prr-conductor.md) — AGCORE-SRE-04

    **Subcomando `risk-budget`** é caso especial — comando direto (Plan 05 não usa agent); orquestrador delega aplicando skill [`sre-risk-management`](../skills/sre-risk-management/SKILL.md) inline ou re-encaminhando para `/risk-budget`.
    </execution_context>
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/commands/sre.md` existe
    - Frontmatter válido com `name: sre` + `description ≤ 200 chars` + `allowed-tools` inclui `Task` + `AskUserQuestion`
    - `<objective>` cita explicitamente "**terceiro orquestrador da família**" + cross-refs Markdown literais para `/supabase` E `/observabilidade`
    - `<objective>` cita "**anti-pitfall A10**" explicitamente (único ponto de chain)
    - `<objective>` lista os 5 subcomandos com mapeamento para capítulos do livro (cap 3, 5, 6, 15, 32)
    - `<execution_context>` lista as **5 skills** SRE (Phase 36) + glossário
    - `<execution_context>` lista os **4 agents** SRE (Phase 37) com cross-ref Markdown ativo
    - `<execution_context>` documenta caso especial `risk-budget` (não usa agent)
  </acceptance_criteria>
</task>

<task id="38-06-T2" name="Context com tabela de subcomandos + sinônimos">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/observabilidade.md (linhas 28-43 — `<context>` com tabela subcomandos + sinônimos)
    - D:/projetos/opensource/mcp/kit/commands/supabase.md (linhas 27-48 — outro precedente com 11 subcomandos)
  </read_first>
  <action>
    Adicionar `<context>` com **tabela canônica de subcomandos**:

    ```markdown
    <context>
    **Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

    **Subcomandos suportados (sinônimos PT-BR/EN):**

    | Subcomando | Sinônimos | Agent dispatched | Cap livro |
    |---|---|---|---|
    | `golden-signals` | `signals`, `4signals`, `golden` | `golden-signals-instrumenter` | 6 |
    | `auditar-toil` | `audit-toil`, `toil`, `auditar` | `toil-auditor` | 5 |
    | `postmortem` | `pm`, `post-mortem` | `postmortem-writer` | 15 |
    | `prr` | `production-readiness`, `readiness-review` | `prr-conductor` | 32 |
    | `risk-budget` | `budget`, `risk`, `continuum` | (comando direto — `/risk-budget`) | 3 |
    | `help` | `ajuda`, `?` | exibe esta tabela inline | — |

    **Roteamento de flags por subcomando:**

    - `golden-signals <target>` — args passados como `<target>` + flags `--service` `--saturation` `--runtime`
    - `auditar-toil` — flags `--time-window` `--team-size` `--output` `--runbooks-paths`
    - `postmortem` — flags **mutuamente exclusivas** `--from-investigation <id>` OU `--incident "<desc>"` + `--severity`
    - `prr` — flags **mutuamente exclusivas** `--service <name>` OU `--feature "<desc>"` + `--engagement` `--reviewer`
    - `risk-budget` — `[<slo_name>]` opcional + `--format` `--explain`

    **Exemplos:**
    ```
    /sre golden-signals supabase/functions/process-emails    # instrumentar Edge Function
    /sre auditar-toil --time-window 6m                       # audit toil últimos 6 meses
    /sre postmortem --from-investigation incident-2026-05-06-1432-checkout-burn  # continuação de v1.9
    /sre prr --service orders-api --reviewer @sre-lead       # PRR de serviço existente
    /sre risk-budget checkout_success --explain              # budget + sabedoria 99.99% inline
    /sre help                                                # exibe tabela de subcomandos
    ```
    </context>
    ```
  </action>
  <acceptance_criteria>
    - `<context>` contém tabela "Subcomandos suportados" com **6 linhas** (5 subcomandos canônicos + help)
    - Tabela tem **4 colunas** (Subcomando, Sinônimos, Agent dispatched, Cap livro)
    - Cada subcomando canônico tem ≥ 2 sinônimos (PT-BR + EN ou aliases)
    - Tabela cita capítulos do livro (3, 5, 6, 15, 32) literalmente
    - `risk-budget` marcado como "(comando direto — `/risk-budget`)" — não usa agent dispatch
    - Bloco "Roteamento de flags" enumera flags-chave por subcomando (mutuamente exclusivas marcadas)
    - 6 exemplos de uso (1 por subcomando)
  </acceptance_criteria>
</task>

<task id="38-06-T3" name="Process — parse, resolve sinônimos, dispatch ou delegate">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/observabilidade.md (linhas 45-107 — Steps 1-5 padrão de orquestrador v1.9)
    - D:/projetos/opensource/mcp/kit/commands/supabase.md (linhas 50-137 — outro precedente com config.toml detect + AskUserQuestion para architect)
  </read_first>
  <action>
    Adicionar `<process>` com 6 steps:

    ```markdown
    <process>

    ## 1. Parsear subcomando

    ```bash
    SUBCMD=$(echo "$ARGUMENTS" | awk '{print $1}')
    ARGS=$(echo "$ARGUMENTS" | cut -d' ' -f2-)
    ```

    **Se `$ARGUMENTS` for vazio ou `SUBCMD` for `help`/`ajuda`/`?`:** exibir tabela de subcomandos inline + exemplo de uso. Sair.

    ## 2. Resolver sinônimos para agent canônico

    ```text
    golden-signals, signals, 4signals, golden          → golden-signals-instrumenter
    auditar-toil, audit-toil, toil, auditar            → toil-auditor
    postmortem, pm, post-mortem                        → postmortem-writer
    prr, production-readiness, readiness-review        → prr-conductor
    risk-budget, budget, risk, continuum               → (comando direto — /risk-budget)
    ```

    **Se subcomando não resolve:** exibir erro inline com lista de subcomandos válidos. Sair.

    ```
    ✗ Subcomando desconhecido: '<SUBCMD>'

    Subcomandos válidos:
      golden-signals    → instrumentar 4 signals OTel (Latency/Traffic/Errors/Saturation)
      auditar-toil      → audit toil priorizado P0/P1/P2 + esforço de automação
      postmortem        → postmortem blameless 9 seções (--from-investigation OU --incident)
      prr               → Production Readiness Review 6 axes (--service OU --feature)
      risk-budget       → error budget vs risk continuum + sabedoria 99.99%

    Uso: /sre <subcomando> <args...>
    Exemplo: /sre prr --service orders-api
    ```

    ## 3. Detectar `supabase/config.toml` (passar `project_id` para agents que usam MCP)

    ```bash
    PROJECT_ID=""
    if [ -f supabase/config.toml ]; then
      PROJECT_ID=$(grep -E '^project_id\s*=' supabase/config.toml | sed 's/.*= *"\(.*\)".*/\1/' | head -1)
    fi
    ```

    Apenas `prr-conductor` usa `mcp__supabase__*` — outros 3 agents não precisam de project_id (instrumentação/audit/postmortem são filesystem only).

    ## 4. Dispatch — caminhos por subcomando

    ### 4a. `golden-signals` → `golden-signals-instrumenter`

    ```text
    Task(
      subagent_type="golden-signals-instrumenter",
      prompt="
    ${ARGS}

    Aplicar skill four-golden-signals. Gerar patches OTel para os 4 signals (Latency: histogram bucketed; Traffic: counter; Errors: counter por error.type; Saturation: gauge resource-specific).
    "
    )
    ```

    ### 4b. `auditar-toil` → `toil-auditor`

    ```text
    Task(
      subagent_type="toil-auditor",
      prompt="
    project_root: .
    output_path: .planning/TOIL-AUDIT.md
    ${ARGS}

    Aplicar skill eliminating-toil. Scan git log + scripts + runbooks; aplicar 6 critérios canônicos; priorizar P0/P1/P2; estimar esforço de automação L0-L4.
    "
    )
    ```

    ### 4c. `postmortem` → `postmortem-writer`

    Validar mutuamente exclusivos (`--from-investigation` E `--incident` ambos = ERROR; nenhum = AskUserQuestion sugerido).

    ```text
    Task(
      subagent_type="postmortem-writer",
      prompt="
    ${ARGS}

    Aplicar skill blameless-postmortems. Modo conforme flag (--from-investigation lê investigation v1.9; --incident standalone com 9 perguntas guiadas). 9 seções obrigatórias: Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline UTC. Foco em sistema/processo (NUNCA pessoas).
    "
    )
    ```

    ### 4d. `prr` → `prr-conductor`

    Validar mutuamente exclusivos (`--service` E `--feature` ambos = ERROR; nenhum = ERROR com sugestão). Se `--reviewer` ausente: AskUserQuestion (anti-pattern auto-PRR).

    ```text
    Task(
      subagent_type="prr-conductor",
      prompt="
    ${ARGS}
    ${PROJECT_ID:+project_id: ${PROJECT_ID}}

    Aplicar skill production-readiness-review. Audit em 6 axes (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance) — todos obrigatórios. Engagement model conforme outage cost. Modo offline fallback graceful.
    "
    )
    ```

    ### 4e. `risk-budget` → comando direto `/risk-budget`

    Caso especial — não há agent. Re-encaminhar via shell ou aplicar skill `sre-risk-management` direto.

    ```bash
    # PT-BR: invocar comando /risk-budget passando args
    # Em Claude Code, isso é equivalente a executar o comando file diretamente
    # (orquestrador apenas valida sinônimo e delega)
    /risk-budget ${ARGS}
    ```

    Alternativa inline (se não há shell call): orquestrador lê `.planning/slos/*.md`, mapeia para tabela continuum (skill `sre-risk-management` Pattern 1), exibe tabela com status (OPTIMAL/OVER-SPEC/UNDER-SPEC/BUDGET-EXHAUSTED).

    ## 5. Output

    Output do agent (ou do comando direto risk-budget) é o output do orquestrador. Sem post-processing — agent já formata estruturado.

    ## 6. Sugestões de chains comuns (pós-output)

    Após dispatch, orquestrador pode sugerir chains comuns:

    | Subcomando rodado | Chain natural |
    |---|---|
    | `golden-signals` | `/sre prr --service <same>` (validar production-readiness) |
    | `auditar-toil` | `/observabilidade omm` (alimentar OMM Capacidade 3) |
    | `postmortem` | `/sre prr --service <affected>` OR `/observabilidade omm` (Capacidade 5 Incident Response) |
    | `prr` | (se Approved) deploy; (se Blocked) fechar P0s e re-PRR |
    | `risk-budget` | `/burn-rate-status` (live forecast) OR `/sre postmortem --incident "..."` se BUDGET-EXHAUSTED |

    </process>
    ```
  </action>
  <acceptance_criteria>
    - Bloco `<process>` contém exatamente 6 steps numerados
    - Step 2 mapeia 5 subcomandos para targets (4 agents + 1 comando direto)
    - Step 2 erro inline lista os 5 subcomandos com descrição curta
    - Step 3 detecta `supabase/config.toml` (apenas relevante para `prr-conductor`)
    - Step 4 tem **5 sub-paths** (4a, 4b, 4c, 4d, 4e) — um por subcomando
    - Step 4c (postmortem) e 4d (prr) validam mutuamente exclusivos antes de dispatch
    - Step 4d (prr) menciona AskUserQuestion para reviewer (anti auto-PRR)
    - Step 4e (risk-budget) documenta caso especial: comando direto, não agent
    - Step 6 contém tabela de **chains comuns** (5 linhas — 1 por subcomando)
    - Tabela de chains menciona `/observabilidade omm` (Capacidade 3 toil + Capacidade 5 incidents) E `/burn-rate-status` (cross-ref v1.9)
  </acceptance_criteria>
</task>

<task id="38-06-T4" name="Success criteria + smoke + idempotência sync">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/observabilidade.md (linhas 109-117 — bloco success_criteria padrão)
    - D:/projetos/opensource/mcp/kit/commands/supabase.md (linhas 139-148 — outro precedente success_criteria mais denso)
  </read_first>
  <action>
    Adicionar `<success_criteria>` final + smoke validation inline:

    ```markdown
    <success_criteria>
    - [ ] Subcomando resolvido para agent canônico (5 subcomandos × seus sinônimos)
    - [ ] `project_id` extraído de `supabase/config.toml` se presente (apenas relevante para `prr`)
    - [ ] Dispatch via `Task(subagent_type=...)` — único ponto de chain (anti-pitfall A10)
    - [ ] Subcomando `risk-budget` delega para comando direto `/risk-budget` (não usa Task)
    - [ ] Subcomando `postmortem` valida `--from-investigation` E `--incident` mutuamente exclusivos antes de dispatch
    - [ ] Subcomando `prr` valida `--service` E `--feature` mutuamente exclusivos + AskUserQuestion para reviewer (anti auto-PRR)
    - [ ] Subcomando inválido → mensagem clara com lista de 5 subcomandos válidos
    - [ ] Subcomando `help`/`ajuda`/`?` → exibe tabela inline com 6 linhas (5 + help)
    - [ ] Args após subcomando passam transparentemente para o agent
    - [ ] Sugestões de chains comuns na tabela final (5 chains documentadas)
    </success_criteria>
    ```

    Validar via shell:

    ```bash
    # Verificar tamanho da description
    grep -m1 "^description:" kit/commands/sre.md | sed 's/^description: //' | wc -c

    # Verificar âncoras canônicas
    grep -c "^<objective>$" kit/commands/sre.md           # esperado: 1
    grep -c "^<execution_context>$" kit/commands/sre.md   # esperado: 1
    grep -c "^<context>$" kit/commands/sre.md             # esperado: 1
    grep -c "^<process>$" kit/commands/sre.md             # esperado: 1
    grep -c "^<success_criteria>$" kit/commands/sre.md    # esperado: 1

    # Verificar dispatch para os 4 agents canônicos
    grep -c 'subagent_type="golden-signals-instrumenter"' kit/commands/sre.md  # esperado: ≥1
    grep -c 'subagent_type="toil-auditor"' kit/commands/sre.md                  # esperado: ≥1
    grep -c 'subagent_type="postmortem-writer"' kit/commands/sre.md             # esperado: ≥1
    grep -c 'subagent_type="prr-conductor"' kit/commands/sre.md                 # esperado: ≥1

    # Verificar 5 subcomandos canônicos
    grep -c "golden-signals" kit/commands/sre.md     # esperado: ≥4
    grep -c "auditar-toil\|audit-toil" kit/commands/sre.md  # esperado: ≥3
    grep -c "postmortem" kit/commands/sre.md         # esperado: ≥4
    grep -c "^| .prr." kit/commands/sre.md           # 1 ocorrência de prr na tabela
    grep -c "risk-budget" kit/commands/sre.md        # esperado: ≥3

    # Verificar família orquestradores cross-ref (v1.8 + v1.9)
    grep -c "/supabase\|supabase.md" kit/commands/sre.md          # esperado: ≥1
    grep -c "/observabilidade\|observabilidade.md" kit/commands/sre.md  # esperado: ≥2

    # Verificar anti-pitfall A10 explícito
    grep -c "anti-pitfall A10\|único ponto de chain\|função pura" kit/commands/sre.md  # esperado: ≥2

    # Verificar capítulos livro mencionados
    grep -c "cap 3\|cap 5\|cap 6\|cap 15\|cap 32" kit/commands/sre.md  # esperado: ≥5

    # Smoke sync — descoberto em .claude/commands/ após sync (incluindo idempotência 2×)
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/commands/sre.md" ] && echo "SYNC_OK_1" || echo "SYNC_FAIL_1"
    HASH1=$(sha256sum "$TMP/.claude/commands/sre.md" | cut -d' ' -f1)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    HASH2=$(sha256sum "$TMP/.claude/commands/sre.md" | cut -d' ' -f1)
    [ "$HASH1" = "$HASH2" ] && echo "IDEMPOTENT_OK" || echo "IDEMPOTENT_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `<success_criteria>` contém 10 bullets (1 por critério crítico)
    - `description` ≤ 200 chars
    - 5 âncoras canônicas (`<objective>`, `<execution_context>`, `<context>`, `<process>`, `<success_criteria>`) cada count == 1
    - 4 dispatches Task literalmente nominados (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) cada um ≥ 1×
    - Subcomandos canônicos: `golden-signals` ≥ 4×, `postmortem` ≥ 4×, `auditar-toil|audit-toil` ≥ 3×, `risk-budget` ≥ 3×, `prr` presente em tabela
    - Cross-refs família: `/supabase` ≥ 1×, `/observabilidade` ≥ 2×
    - Anti-pitfall A10 mencionado ≥ 2× (literal "anti-pitfall A10" ou "único ponto de chain" ou "função pura")
    - Capítulos do livro (3, 5, 6, 15, 32) mencionados ≥ 5× combinado
    - Após `kit sync claude-code`, arquivo `.claude/commands/sre.md` existe E sync 2× é idempotente (byte-idêntico)
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/commands/sre.md` existe
- [ ] Frontmatter válido (`name: sre`, `description ≤ 200 chars`, `allowed-tools` inclui `Task` + `AskUserQuestion`)
- [ ] **5 âncoras canônicas** (orquestrador tem `<execution_context>` adicional vs comandos simples): `<objective>`, `<execution_context>`, `<context>`, `<process>`, `<success_criteria>`
- [ ] Cross-refs Markdown ativos para 4 agents SRE (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) + skill `sre-risk-management`
- [ ] `<objective>` cita "terceiro orquestrador da família" + cross-refs `/supabase` + `/observabilidade` + anti-pitfall A10
- [ ] `<context>` tem tabela 6 linhas (5 subcomandos + help) com 4 colunas (Subcomando, Sinônimos, Agent dispatched, Cap livro)
- [ ] Process tem 6 steps (parse, resolve sinônimos, detectar config, dispatch 5 paths, output, sugestões de chains)
- [ ] Step 4 tem 5 sub-paths (4a-4e) — um por subcomando, incluindo caso especial `risk-budget` (comando direto)
- [ ] Step 4c valida `--from-investigation` E `--incident` mutuamente exclusivos
- [ ] Step 4d valida `--service` E `--feature` mutuamente exclusivos + AskUserQuestion para reviewer
- [ ] Step 6 sugere 5 chains comuns (1 por subcomando)
- [ ] Smoke `kit sync claude-code` instala em `.claude/commands/sre.md`
- [ ] Sync idempotente — 2× consecutivo produz arquivo byte-idêntico
- [ ] Cobre CMD-SRE-06 integralmente

## Must-haves (goal-backward)

1. Comando file existe com frontmatter válido + Task + AskUserQuestion habilitados
2. `description ≤ 200 chars` (anti-pitfall A2)
3. **Anti-pitfall A10 explicitamente preservado** — orquestrador é único ponto de chain de agents SRE; agents permanecem função pura
4. **Tabela de subcomandos canônica** com 5 subcomandos + help, sinônimos PT/EN, mapeamento agent + capítulo livro
5. Dispatch para 4 agents SRE via `Task(subagent_type=...)` — sintaxe consistente com v1.8/v1.9
6. **Caso especial `risk-budget`** documentado como comando direto (não usa agent dispatch)
7. Validação de flags mutuamente exclusivas em `postmortem` e `prr` antes de dispatch (evita propagar erro ao agent)
8. AskUserQuestion para `prr --reviewer` ausente (anti-pattern auto-PRR enforced no orquestrador)
9. Cross-refs ativos para v1.8 (`/supabase`) e v1.9 (`/observabilidade`) — terceira família documentada
10. Tabela de chains comuns no Step 6 — UX hint para encadeamento natural entre comandos da família SRE + cross-família

## Notes

- **Terceiro orquestrador da família** — convenção v1.8 (`/supabase`) + v1.9 (`/observabilidade`) + v1.10 (`/sre`)
- Tamanho esperado: ~10-12 KB (denso pelos 5 paths de dispatch + tabela subcomandos + tabela chains)
- Anti-pitfall A10 é fundamental: agents NÃO chamam outros agents (chain interno = explosão de complexidade); orquestrador é o único ponto onde dispatches podem ser sequenciados — neste plan, sequenciamento é discretamente sugerido em Step 6 mas não enforced (chain explícito é responsabilidade do user)
- Subcomando `risk-budget` é o único que NÃO usa agent — preserva simplicidade (comando direto Plan 05) e ainda assim é descobrível via orquestrador (sinônimos `risk`, `budget`, `continuum`)
- Phase 39 + Phase 40 + Phase 41 vão referenciar este orquestrador. Especificamente: README v1.10 (Phase 41 QA-SRE-04) terá exemplo end-to-end usando `/sre <subcomando>` para descobrir features
- Sync idempotente é critério de success — Phase 36 ROADMAP crit-4 estabelece esse padrão (timestamp-stripped per design)
