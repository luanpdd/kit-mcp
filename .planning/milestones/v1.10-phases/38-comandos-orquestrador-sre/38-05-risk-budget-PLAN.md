---
phase: 38
plan: 05
title: Comando /risk-budget — exibe error budget vs risk continuum aplicando skill sre-risk-management
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/commands/risk-budget.md
requirements: [CMD-SRE-05]
status: ready
---

# Plan 05 — Comando `kit/commands/risk-budget.md`

## Goal

Criar `kit/commands/risk-budget.md` — comando que exibe **error budget atual vs risk continuum** para SLOs definidos em v1.9 (`.planning/slos/`). Lê SLO files, computa budget consumido, posiciona no risk continuum, aplica skill `sre-risk-management` (cap 3 — risk continuum + 99.99% wisdom + "as reliable as needs to be"). **Não invoca agent direto** — é comando de leitura/análise puro que aplica skill diretamente. Modelo segue precedente direto `kit/commands/burn-rate-status.md` (v1.9 — read-only que processa SLOs). Cobre **CMD-SRE-05**.

## Files to create

- `D:/projetos/opensource/mcp/kit/commands/risk-budget.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: risk-budget` + `description ≤ 200 chars` (anti-pitfall A2)
- **`allowed-tools` SEM `Task`** — comando NÃO invoca agent (leitura/análise direta de SLOs); usa `Read`/`Bash`/`Grep`/`Glob`
- **Cross-ref Markdown** ativo para skill `sre-risk-management` + skill `event-based-slos` (v1.9 — onde SLOs são definidos) + comando `/burn-rate-status` (v1.9 — complementar)
- **Read-only** — comando não modifica arquivos; só exibe estado
- **Skill `sre-risk-management` aplicada inline** — comando interpreta budget no continuum (1× → 100×+ cost) e exibe sabedoria 99.99%
- **Idempotente** — pode rodar em `/loop` para monitoramento contínuo

## Tasks

<task id="38-05-T1" name="Frontmatter + objective + context">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/risk-budget.md (arquivo target — começa vazio)
    - D:/projetos/opensource/mcp/kit/commands/burn-rate-status.md (linhas 1-37 — frontmatter + objective + context, precedente direto read-only)
    - D:/projetos/opensource/mcp/kit/skills/sre-risk-management/SKILL.md (linhas 22-44 — Regras absolutas + tabela risk continuum)
  </read_first>
  <action>
    Escrever frontmatter + `<objective>` + `<context>`:

    ```markdown
    ---
    name: risk-budget
    description: Exibe error budget atual vs risk continuum (cap 3 SRE) — lê .planning/slos/, posiciona no continuum 99% → 99.999%, aplica sabedoria 99.99% e "as reliable as needs to be".
    argument-hint: "[<slo_name>] [--format table|json]"
    allowed-tools:
      - Read
      - Bash
      - Grep
      - Glob
    ---

    <objective>
    Snapshot read-only de **error budget vs risk continuum** (cap 3 do livro Google SRE) para 1 SLO ou todos. Aplica skill [`sre-risk-management`](../skills/sre-risk-management/SKILL.md) — risk continuum como decisão explícita, error budget como balanço risk × innovation, sabedoria 99.99% (user em smartphone 99% NÃO distingue 99.99% vs 99.999%), "as reliable as needs to be, no more".

    Lê SLOs definidos em [`event-based-slos`](../skills/event-based-slos/SKILL.md) (v1.9) — `.planning/slos/*.md`. Complementa [`burn-rate-status`](./burn-rate-status.md) (v1.9 — burn rate forecast) com **decisão estratégica** sobre target apropriado.

    **Cria/Atualiza:** nada — comando read-only.

    **Após:** o user vê posição de cada SLO no continuum, % budget gasto, custo relativo (1× → 100×+), e recomendação de tier (free/paid/enterprise) consistente com user-perception.
    </objective>

    <context>
    **Argumentos:** `$ARGUMENTS` — opcional `<slo_name>` para 1 SLO; sem args = todos os SLOs.

    **Flags:**
    - `--format <table|json>` — output format (default: `table`)
    - `--explain` — incluir bloco "sabedoria 99.99%" + anti-patterns inline (verbose)

    **Pré-requisito:** SLOs definidos em `.planning/slos/*.md` (v1.9 — comando `/observabilidade slo` ou `/definir-slo`).

    **Risk continuum canônico** (cap 3, aplicado inline pela skill):

    | Target | Tolerância 30d | User-perceptible? | Recomendação | Custo relativo |
    |---|---|---|---|---|
    | 99% | 7.2 h | Sim | Tier free, beta, internal | 1× |
    | 99.5% | 3.6 h | Notável | Tier free de produção | 2× |
    | 99.9% | 43.2 min | Aceitável para UX | Tier paid default | 5× |
    | 99.95% | 21.6 min | Quase imperceptível | Tier enterprise / mission-critical | 10× |
    | 99.99% | 4.3 min | Imperceptível em smartphone | Apenas se justificado (raro) | 50×+ |
    | 99.999% | 26 s | NÃO perceptível | NUNCA para user-facing | 100×+ |

    **Loop pattern:** rodar via skill `loop` para monitoramento contínuo.

    ```text
    /loop 1h /risk-budget
    ```

    **Exemplos:**
    ```
    /risk-budget                              # todos SLOs, formato table
    /risk-budget checkout_success             # 1 SLO específico
    /risk-budget --format json                # output estruturado
    /risk-budget login_success --explain      # com sabedoria 99.99% + anti-patterns inline
    ```
    </context>
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Arquivo `kit/commands/risk-budget.md` existe
    - Frontmatter válido com `name: risk-budget` + `description ≤ 200 chars`
    - Frontmatter `allowed-tools` **NÃO** lista `Task` (comando direto, não invoca agent)
    - Frontmatter lista `Read`, `Bash`, `Grep`, `Glob` (4 ferramentas mínimas)
    - `<objective>` contém cross-ref Markdown literal `[sre-risk-management](../skills/sre-risk-management/SKILL.md)` + `[event-based-slos](../skills/event-based-slos/SKILL.md)` + `[burn-rate-status](./burn-rate-status.md)` (3 cross-refs)
    - `<objective>` menciona literalmente "sabedoria 99.99%" + "as reliable as needs to be" (citações canônicas do livro)
    - `<context>` contém **tabela risk continuum** com 6 linhas (99% até 99.999%) + 4 colunas (Target, Tolerância, User-perceptible, Recomendação, Custo relativo)
    - `<context>` documenta padrão `/loop 1h /risk-budget`
    - 4 exemplos de uso (default, slo específico, json, --explain)
  </acceptance_criteria>
</task>

<task id="38-05-T2" name="Process — listar SLOs, parsear, computar budget, posicionar no continuum">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/burn-rate-status.md (linhas 39-130 — Steps 1-6 padrão de iteração read-only sobre SLOs)
    - D:/projetos/opensource/mcp/kit/skills/sre-risk-management/SKILL.md (linhas 45-95 — patterns canônicos: risk continuum, budget policy, target diferenciado por tier)
  </read_first>
  <action>
    Adicionar `<process>` com 6 steps:

    ```markdown
    <process>

    ## 1. Parsear argumentos

    ```bash
    SLO_NAME=$(echo "$ARGUMENTS" | awk '{print $1}' | grep -v '^--' || true)
    FORMAT=$(echo "$ARGUMENTS" | grep -oE -- '--format [^ ]+' | awk '{print $2}')
    EXPLAIN=$(echo "$ARGUMENTS" | grep -c -- '--explain' || echo 0)

    [ -z "$FORMAT" ] && FORMAT="table"
    ```

    ## 2. Listar SLOs

    ```bash
    if [ -n "$SLO_NAME" ]; then
      SLO_FILES=(".planning/slos/${SLO_NAME}.md")
    else
      SLO_FILES=(.planning/slos/*.md)
    fi

    if [ ${#SLO_FILES[@]} -eq 0 ] || [ ! -f "${SLO_FILES[0]}" ]; then
      echo "Nenhum SLO definido em .planning/slos/."
      echo "Defina um com: /observabilidade slo <feature>  (v1.9)"
      exit 0
    fi
    ```

    ## 3. Para cada SLO, extrair metadados + computar posição no continuum

    Para cada `SLO_FILE`:

    ```bash
    SLO_NAME=$(basename "$SLO_FILE" .md)
    TARGET=$(grep -m1 -oE 'target.*[0-9.]+' "$SLO_FILE" | grep -oE '[0-9.]+')
    WINDOW=$(grep -m1 -oE 'window.*[0-9]+[dh]' "$SLO_FILE" | grep -oE '[0-9]+[dh]' || echo "30d")
    TIER_LABEL=$(grep -m1 'tier:' "$SLO_FILE" | sed 's/.*tier: //' || echo "(unset)")
    OWNER=$(grep -m1 'owner:' "$SLO_FILE" | sed 's/.*owner: //' || echo "(unset)")
    ```

    **Mapear target → posição no continuum (skill `sre-risk-management` Pattern 1):**

    | Target faixa | Posição | Custo relativo | Tier típico | User-perceptible |
    |---|---|---|---|---|
    | < 0.99 | abaixo do continuum (under-spec) | <1× | beta/dev | sim |
    | 0.99 ≤ t < 0.995 | 99% | 1× | free, beta, internal | sim (notável) |
    | 0.995 ≤ t < 0.999 | 99.5% | 2× | free de produção | notável em paths críticos |
    | 0.999 ≤ t < 0.9995 | 99.9% | 5× | paid default | aceitável para UX |
    | 0.9995 ≤ t < 0.9999 | 99.95% | 10× | enterprise/mission-critical | quase imperceptível |
    | 0.9999 ≤ t < 0.99999 | 99.99% | 50×+ | só com checklist 4-perguntas | imperceptível em smartphone |
    | t ≥ 0.99999 | 99.999% | 100×+ | NUNCA para user-facing | NÃO perceptível |

    **Computar budget gasto** (heurística — leitura grosseira do SLO file):

    ```bash
    # PT-BR: SLO file pode ter linha "**Budget consumido (snapshot):** XX%" atualizada por job
    BUDGET_USED_PCT=$(grep -m1 -oE 'Budget consumido.*[0-9]+%' "$SLO_FILE" | grep -oE '[0-9]+%' || echo "?")

    # PT-BR: se não, sugerir invocar /burn-rate-status (que tem queries live)
    if [ "$BUDGET_USED_PCT" = "?" ]; then
      BUDGET_USED_PCT="(invoque /burn-rate-status para snapshot live)"
    fi
    ```

    **Status no continuum** (4 níveis):

    - `OPTIMAL` — target apropriado para tier; budget < 50% gasto → "as reliable as needs to be"
    - `OVER-SPEC` — target acima do necessário (ex: tier free com 99.99%) → desperdício; baixar target
    - `UNDER-SPEC` — target abaixo do esperado (ex: enterprise com 99% só) → SLA risk; subir target
    - `BUDGET-EXHAUSTED` — budget < 10% restante → freeze releases; revisitar postmortems

    ## 4. Agregar resultados em tabela

    ```
    ═══════════════════════════════════════════════════════════
     framework ► RISK-BUDGET ▸ {timestamp}
    ═══════════════════════════════════════════════════════════

    | SLO | Target | Posição | Tier | Custo relativo | Budget gasto | Status | Decisão |
    |---|---|---|---|---|---|---|---|
    | checkout_success | 99.9% | 99.9% (5×) | paid | 5× | 23% | OPTIMAL | manter |
    | login_success | 99.99% | 99.99% (50×+) | enterprise | 50×+ | 78% | BUDGET-EXHAUSTED | freeze releases; checklist 4-perguntas? |
    | search_latency | 99% | 99% (1×) | free | 1× | 15% | OPTIMAL | manter (tier free OK) |
    | admin_panel | 99.95% | 99.95% (10×) | (?internal) | 10× | 5% | OVER-SPEC | baixar para 99% (internal tool, custo desperdício) |
    ```

    ## 5. Modo `--explain` — sabedoria 99.99% + anti-patterns inline

    Se `--explain` setado, anexar após tabela:

    ```markdown
    ## Sabedoria 99.99% (cap 3)

    > Smartphone tem ~99% de disponibilidade (sinal cai, bateria acaba, app trava).
    > Usuário em 99% smartphone NÃO distingue serviço 99.99% vs 99.999% — ambos
    > parecem "sempre funcionando" no contexto dele. Cada nove adicional **multiplica
    > custo** mas **divide benefício marginal**. Cliente final (humano em smartphone
    > com ISP residencial ~99%) tem disponibilidade no canal de comunicação inferior
    > à do seu serviço 99.99%. Essa é a sabedoria 99.99%.

    ## Anti-patterns detectados

    {Para cada SLO em status OVER-SPEC, BUDGET-EXHAUSTED:}
    - **{slo_name}** ({status}): {explicação curta}
      - {ação recomendada}

    Exemplos:
    - **admin_panel** (OVER-SPEC): tier internal com 99.95% (10× custo). Internal tool não exige tier paid.
      - Ação: editar `.planning/slos/admin_panel.md` → target: 0.99 (1×); ou remover SLO formal (apenas métrica informativa).
    - **login_success** (BUDGET-EXHAUSTED 78%): 99.99% sem checklist 4-perguntas justificada?
      - Ação: revisar Pattern "justificar 99.99%+ excepcional" (skill sre-risk-management); se NÃO atende 4 critérios, baixar para 99.95%.
    ```

    ## 6. Sugerir próximas ações

    Se algum SLO em status `BUDGET-EXHAUSTED` ou `OVER-SPEC`:

    ```
    ## ⚠ Decisões pendentes

    {Para cada SLO em alerta:}
    - {slo_name} ({status}): {recomendação curta}
      → /investigar-producao "{slo_name} budget exhausted às {timestamp}"   # se BUDGET-EXHAUSTED
      → editar `.planning/slos/{slo_name}.md` target: {sugestão}            # se OVER-SPEC

    ## Cross-refs
    - `/burn-rate-status {slo_name}` — burn rate live (forecast ETA)
    - `/postmortem --incident "..."` — se budget exhausted virou incident
    - `/observabilidade omm` — Capacidade 1 (Embracing Risk) consome este snapshot
    ```

    </process>
    ```
  </action>
  <acceptance_criteria>
    - Bloco `<process>` contém exatamente 6 steps numerados
    - Step 3 contém tabela "target → posição no continuum" com 7 linhas (faixas <0.99 a ≥0.99999)
    - Step 3 define **4 status** (OPTIMAL, OVER-SPEC, UNDER-SPEC, BUDGET-EXHAUSTED) com critério explícito
    - Step 4 agrega tabela com 8 colunas (SLO, Target, Posição, Tier, Custo relativo, Budget gasto, Status, Decisão)
    - Step 5 (`--explain`) anexa **bloco "Sabedoria 99.99%"** literalmente citado da skill (≥ 4 linhas) + anti-patterns detectados
    - Step 6 sugere cross-refs para `/burn-rate-status`, `/postmortem`, `/observabilidade omm`
    - Step 6 menciona OMM Capacidade 1 (Embracing Risk) explicitamente
  </acceptance_criteria>
</task>

<task id="38-05-T3" name="Success criteria + smoke">
  <read_first>
    - D:/projetos/opensource/mcp/kit/commands/burn-rate-status.md (linhas 132-141 — bloco success_criteria padrão)
  </read_first>
  <action>
    Adicionar `<success_criteria>` final + smoke validation inline:

    ```markdown
    <success_criteria>
    - [ ] `<slo_name>` opcional + flags `--format` e `--explain` parseadas
    - [ ] SLOs listados via glob `.planning/slos/*.md`
    - [ ] Cada SLO mapeado para posição no risk continuum (1× a 100×+)
    - [ ] 4 status enum: OPTIMAL / OVER-SPEC / UNDER-SPEC / BUDGET-EXHAUSTED
    - [ ] Tabela agregada com 8 colunas (SLO, Target, Posição, Tier, Custo relativo, Budget gasto, Status, Decisão)
    - [ ] Modo `--explain` anexa sabedoria 99.99% + anti-patterns detectados inline
    - [ ] Cross-refs para `/burn-rate-status`, `/postmortem`, `/observabilidade omm` (Capacidade 1 Embracing Risk)
    - [ ] Idempotente — rodável em `/loop` sem state acumulado
    - [ ] Read-only — comando NÃO modifica arquivos
    </success_criteria>
    ```

    Validar via shell:

    ```bash
    # Verificar tamanho da description
    grep -m1 "^description:" kit/commands/risk-budget.md | sed 's/^description: //' | wc -c

    # Verificar âncoras canônicas
    grep -c "^<objective>$" kit/commands/risk-budget.md           # esperado: 1
    grep -c "^<context>$" kit/commands/risk-budget.md             # esperado: 1
    grep -c "^<process>$" kit/commands/risk-budget.md             # esperado: 1
    grep -c "^<success_criteria>$" kit/commands/risk-budget.md    # esperado: 1

    # Verificar NÃO usa Task (comando direto)
    grep -c "subagent_type=" kit/commands/risk-budget.md          # esperado: 0
    grep -c "^  - Task" kit/commands/risk-budget.md               # esperado: 0

    # Verificar palavras-chave canônicas do continuum
    grep -c "risk continuum\|risk-continuum" kit/commands/risk-budget.md  # esperado: ≥3
    grep -c "99.99\|sabedoria 99" kit/commands/risk-budget.md             # esperado: ≥3
    grep -c "as reliable as needs to be" kit/commands/risk-budget.md      # esperado: ≥1
    grep -c "OPTIMAL\|OVER-SPEC\|UNDER-SPEC\|BUDGET-EXHAUSTED" kit/commands/risk-budget.md  # esperado: ≥4

    # Verificar cross-refs ativos
    grep -c "sre-risk-management" kit/commands/risk-budget.md     # esperado: ≥2
    grep -c "event-based-slos\|burn-rate-status" kit/commands/risk-budget.md  # esperado: ≥2

    # Verificar tabela continuum (6 níveis)
    grep -c "99%\|99.5%\|99.9%\|99.95%\|99.99%\|99.999%" kit/commands/risk-budget.md  # esperado: ≥6 (cada um pelo menos 1×)

    # Smoke sync
    TMP=$(mktemp -d)
    npx kit-mcp sync claude-code --project-root "$TMP" >/dev/null 2>&1
    [ -f "$TMP/.claude/commands/risk-budget.md" ] && echo "SYNC_OK" || echo "SYNC_FAIL"
    rm -rf "$TMP"
    ```
  </action>
  <acceptance_criteria>
    - `<success_criteria>` contém 9 bullets
    - `description` ≤ 200 chars
    - 4 âncoras canônicas (`<objective>`, `<context>`, `<process>`, `<success_criteria>`) cada count == 1
    - **Sem `Task` em allowed-tools** (`grep -c "Task"` deve ser 0 — comando read-only direto)
    - `risk continuum` aparece ≥ 3×
    - `99.99` (sabedoria 99.99%) aparece ≥ 3×
    - `as reliable as needs to be` aparece ≥ 1× (citação canônica)
    - 4 status enum (OPTIMAL/OVER-SPEC/UNDER-SPEC/BUDGET-EXHAUSTED) presentes ≥ 4× combinado
    - Cross-ref `sre-risk-management` ≥ 2×, `event-based-slos|burn-rate-status` ≥ 2×
    - 6 níveis do continuum (99% até 99.999%) cada um aparece pelo menos 1×
    - Após `kit sync claude-code`, arquivo `.claude/commands/risk-budget.md` existe
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/commands/risk-budget.md` existe
- [ ] Frontmatter válido (`name: risk-budget`, `description ≤ 200 chars`)
- [ ] Frontmatter `allowed-tools` **NÃO** lista `Task` (comando direto, não wrapper)
- [ ] 4 âncoras canônicas: `<objective>`, `<context>`, `<process>`, `<success_criteria>`
- [ ] Cross-refs Markdown ativos para `sre-risk-management` + `event-based-slos` + `burn-rate-status` (3 cross-refs)
- [ ] `<context>` tem tabela risk continuum (6 níveis: 99% → 99.999%, 4 colunas)
- [ ] Process tem 6 steps (parse, listar, computar continuum + status, agregar, --explain, sugerir)
- [ ] Step 3 mapeia target em 7 faixas (< 0.99 a ≥ 0.99999) e 4 status
- [ ] Step 4 agrega tabela com 8 colunas
- [ ] Step 5 `--explain` cita sabedoria 99.99% (≥ 4 linhas) + anti-patterns
- [ ] Step 6 sugere cross-refs para `/burn-rate-status`, `/postmortem`, `/observabilidade omm`
- [ ] Smoke `kit sync claude-code` instala em `.claude/commands/risk-budget.md`
- [ ] Cobre CMD-SRE-05 integralmente

## Must-haves (goal-backward)

1. Comando file existe com frontmatter válido SEM `Task` (comando direto, não wrapper de agent)
2. `description ≤ 200 chars` (anti-pitfall A2)
3. **Risk continuum** literalmente documentado em `<context>` (tabela 6 níveis com custo relativo)
4. Aplicação direta da skill `sre-risk-management` — não via Task dispatch
5. **4 status enum** (OPTIMAL/OVER-SPEC/UNDER-SPEC/BUDGET-EXHAUSTED) com critério claro
6. Modo `--explain` com sabedoria 99.99% + anti-patterns detectados inline
7. Read-only — não modifica arquivos (`/loop`-friendly, idempotente)
8. Cross-refs ativos para v1.9 (`event-based-slos` + `burn-rate-status`) E Phase 41 (`/observabilidade omm` Capacidade 1 Embracing Risk)
9. Recomendação de tier consistente com user-perception (free=99% OK; enterprise=99.95%; nunca user-facing 99.999%)

## Notes

- **Comando direto** — NÃO usa `Task` porque a análise é simples (parse SLO files + map para tabela continuum). Diferentemente dos outros 4 comandos (que são wrappers para agents complexos).
- Tamanho esperado: ~9-11 KB (denso pela tabela continuum + Step 3 mapping + Step 5 sabedoria 99.99%)
- Phase 39 INT-OBS-01 vai integrar este comando ao skill `event-based-slos` (v1.9) via bloco "Risk continuum" cross-referenciando `sre-risk-management` — comando precisa estar pronto antes
- Skill `sre-risk-management` foi criada em Phase 36 (Plan 02 SKFD-SRE-01) — comando lê filesystem desta skill para citar sabedoria 99.99%
- Anti-pattern explícito: SLO 99.99% sem checklist de 4 perguntas (skill Pattern 3) — comando flagga em status BUDGET-EXHAUSTED + `--explain`
