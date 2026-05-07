---
phase: 36
plan: 04
title: Skill eliminating-toil — definição canônica + ≤ 50% rule (cap 5)
wave: 1
depends_on: []
autonomous: true
files_modified:
  - kit/skills/eliminating-toil/SKILL.md
requirements: [SKFD-SRE-03]
status: ready
---

# Plan 04 — Skill `eliminating-toil/SKILL.md`

## Goal

Criar `kit/skills/eliminating-toil/SKILL.md` documentando o capítulo 5 do livro Google SRE — *Eliminating Toil*. Definição canônica de toil (6 critérios: manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50%, distinção toil vs overhead vs grungy work, padrões de automação, "toil tax". Skill é base para Phase 37 agente `toil-auditor` e Phase 38 comando `/auditar-toil`.

## Files to create

- `D:/projetos/opensource/mcp/kit/skills/eliminating-toil/SKILL.md`

## Constraints (anti-pitfall reminders)

- **Frontmatter obrigatório** — `name: eliminating-toil` + `description ≤ 200 chars` (anti-pitfall A2)
- **NÃO criar pasta `references/`** (anti-pitfall A8)
- 5 seções canônicas: `## Quando usar`, `## Regras absolutas`, `## Patterns canônicos`, `## Anti-patterns`, `## Verificação`, `## Ver também`
- Skill auto-contida — definição canônica completa em uma única skill

## Tasks

<task id="36-04-T1" name="Frontmatter + Quando usar">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/observability-driven-development/SKILL.md (linhas 1-20 — shape de frontmatter + Quando usar)
  </read_first>
  <action>
    Escrever frontmatter + `## Quando usar`:

    ```markdown
    ---
    name: eliminating-toil
    description: Use ao identificar/eliminar toil — 6 critérios canônicos (manual, repetitivo, automatizável, tático, sem valor durável, escala linear), regra ≤ 50%, automação como invariante.
    ---

    # SRE — Eliminating Toil

    ## Quando usar

    LLM carrega esta skill ao auditar tarefas operacionais, classificar trabalho como toil/non-toil, ou propor automação. Trigger phrases:

    - "toil", "trabalho operacional"
    - "eliminar toil", "reduzir toil"
    - "≤ 50% toil", "regra 50%"
    - "automation", "automatizar tarefa repetitiva"
    - "isso é toil ou overhead?"
    - "Google SRE cap 5"
    - "TOIL-AUDIT"
    ```

    Verificar `description` length ≤ 200.
  </action>
  <acceptance_criteria>
    - Diretório `kit/skills/eliminating-toil/` criado
    - Arquivo `kit/skills/eliminating-toil/SKILL.md` existe
    - Frontmatter válido com `name: eliminating-toil` e `description` ≤ 200 chars
    - Seção `## Quando usar` contém pelo menos 5 trigger phrases incluindo "toil", "≤ 50%", "automation", "isso é toil ou overhead?"
  </acceptance_criteria>
</task>

<task id="36-04-T2" name="Regras absolutas — definição canônica + 6 critérios + ≤ 50% rule">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção Toil — após Plan 01 T2)
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 19-28 — shape de "Regras absolutas")
  </read_first>
  <action>
    Adicionar seção `## Regras absolutas` com 8 bullets (definição operacionalizável):

    ```markdown
    ## Regras absolutas

    - **Toil tem 6 critérios canônicos** — uma tarefa É toil se TODOS os 6 valem: (1) **Manual** — humano executa cada vez; (2) **Repetitivo** — você já fez isso 3+ vezes; (3) **Automatizável** — script/cron resolve sem julgamento humano; (4) **Tático** — reage a evento, não planeja; (5) **Sem valor durável** — não cria asset permanente; (6) **Escala linear** — mais users = mais trabalho. Se QUALQUER um dos 6 = não, NÃO é toil (é overhead ou grungy work).
    - **Regra ≤ 50%** — SRE não pode gastar mais que 50% do tempo em toil; restante é engineering (automação, capacity planning, instrumentation, postmortems). Se medindo > 50% por 1+ trimestre, é red flag — peça ajuda à liderança.
    - **Toil ≠ overhead** — reuniões, RH, planejamento de quarter, performance review são **overhead** — necessários, não-elimináveis, NÃO contam para a regra ≤ 50%. Confundir overhead com toil = sub-medir.
    - **Toil ≠ grungy work** — refactor de código legado, security cleanup, DB rebuild para reduzir bloat são **grungy work** — necessários, têm valor durável, são engineering trabalho. NÃO contam como toil.
    - **Automação é o objetivo, não o meio** — automatizar parcialmente (humano clica botão A, depois B, depois C) ainda é toil. Automação completa (cron + script + alert se falhar) elimina toil. Meias-medidas perpetuam.
    - **Toil tax cresce com produto** — cada feature nova adiciona toil potencial: deploy manual, migration manual, feature flag rotation, customer-specific config. Prevenir > remediar — design feature considerando "como auto-operar isso?".
    - **Quantificar toil em horas-pessoa** — "TOIL-AUDIT.md" deve ter coluna `hours_per_week_per_person` para cada item. Sem quantificação, "muito toil" é subjetivo e não-acionável.
    - **Priorizar por (frequency × pain) / automation_effort** — P0 = alto frequency + alto pain + baixo effort. P2 = baixa frequency OU alto effort. Não automatizar tudo de uma vez — começar pelo P0.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Regras absolutas` contém 8 bullets
    - Primeiro bullet enumera os 6 critérios literalmente: `Manual`, `Repetitivo`, `Automatizável`, `Tático`, `Sem valor durável`, `Escala linear`
    - Contém literalmente: `Regra ≤ 50%`, `overhead`, `grungy work`, `Automação é o objetivo`, `toil tax`, `hours_per_week_per_person`, `frequency × pain`
  </acceptance_criteria>
</task>

<task id="36-04-T3" name="Patterns canônicos — decision tree + TOIL-AUDIT.md + automação stages">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção c — pattern classificação de toil)
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 30-170 — shape Patterns)
  </read_first>
  <action>
    Adicionar seção `## Patterns canônicos` com 5 sub-patterns:

    **`### Pattern: decision tree para classificar trabalho`**:

    ```text
    Tarefa repetitiva detectada → aplicar 6 critérios canônicos:

    1. Manual?           (humano executa cada vez)             ┐
    2. Repetitiva?       (já fiz isso 3+ vezes)                 │
    3. Automatizável?    (script/cron resolve sem julgamento)   │── Se TODOS sim → TOIL
    4. Tática?           (reage a evento, não planeja)          │   → automatizar / eliminar
    5. Sem valor durável? (não cria asset permanente)           │   → contar em ≤ 50% rule
    6. Escala linear?    (mais users = mais trabalho)          ─┘

    Se NÃO for toil mas repetitivo, classificar:
    - OVERHEAD       (reuniões, RH, planning) → não-eliminável; NÃO conta em ≤ 50%
    - GRUNGY WORK    (refactor, sec cleanup) → necessário, valor durável → projeto engineering
    - PROJECT WORK   (criar novo serviço) → engineering trabalho ≠ toil
    ```

    **`### Pattern: template `TOIL-AUDIT.md`** (formato canônico que `toil-auditor` Phase 37 vai gerar):

    ```markdown
    # TOIL-AUDIT — <projeto> — <data>

    ## Métrica agregada

    - Toil estimado: X.X horas-pessoa/semana (Y% do tempo do time)
    - **Status vs ≤ 50% rule:** [GREEN: < 30%] | [YELLOW: 30-50%] | [RED: > 50%]
    - Top 3 áreas: <lista>

    ## Itens identificados

    | # | Item | Frequência | Hours/week | Pain (1-5) | Automation effort | Priority |
    |---|------|------------|------------|------------|-------------------|----------|
    | 1 | Reset DB seed manual antes de cada test run | 2×/dia | 1.5 h | 4 | M (3 dias) | P0 |
    | 2 | Rotation de access_token de Edge Function | 1×/semana | 0.5 h | 2 | S (1 dia) | P1 |
    | 3 | Rebuild de índice fts_search após batch import | 1×/mês | 0.5 h | 3 | M (2 dias) | P1 |
    | 4 | Limpeza manual de orphan rows em audit_log | 1×/semana | 0.3 h | 1 | S (1 dia) | P2 |

    ## P0 (automatizar agora)

    ### Item 1: Reset DB seed manual

    **Por que é toil:** atende 6 critérios canônicos (manual, repetitivo 2×/dia, automatizável via script + pg_cron, tática reativa, sem valor durável, escala com #devs).

    **Automação proposta:** `make db-reset` que invoca `supabase db reset && pnpm run seed`. Adicionar pre-test hook em CI.

    **Esforço estimado:** 3 dias (Med — script existe parcialmente, falta seed deterministic).

    **Owner sugerido:** @dev-tools-team

    ## P1 / P2 (escalonar)

    ...

    ## Não-toil identificado

    - **Overhead:** sprint planning (2h × semana × 5 pessoas = 10h/semana) — NÃO conta no ≤ 50%
    - **Grungy work:** refactor de `legacy_orders_service` (8h × semana × 1 pessoa = 8h/semana) — projeto, não toil
    ```

    **`### Pattern: estágios de automação (níveis Google)`** — tabela:

    | Estágio | Descrição | Exemplo |
    |---|---|---|
    | **L0: Manual** | 100% humano | "Cada deploy: SSH no host, copy binary, kill+restart" |
    | **L1: Documented** | Runbook escrito; humano segue passos | "Doc passo-a-passo de deploy em wiki" |
    | **L2: Tooled** | Script executa passos; humano invoca | "`./deploy.sh prod`" |
    | **L3: Self-service** | UI/CLI trigger; humano clica | "GitHub Actions deploy on PR merge" |
    | **L4: Autonomous** | Sem humano; só fail-state intervenção | "Auto-rollback se SLO burn rate > 4 nos primeiros 5 min após deploy" |

    Prosa: "Meta SRE é mover toda toil de L0/L1 para L3/L4. L2 é meio-passo aceitável quando L3+ requer investimento maior. **L1 (apenas runbook) é toil disfarçado** — runbook é manual com passo extra de "ler doc"."

    **`### Pattern: identificação de toil via git log + scripts`** — comandos para descobrir toil:

    ```bash
    # PT-BR: scripts shell em runbooks/ ou docs/runbooks/
    find . -name "*.sh" -path "*runbook*" -o -path "*ops*" | head -20

    # PT-BR: "manual steps" em README/docs (heurística — frase canônica)
    grep -rn "manually\|por favor\|run this\|every week\|cada semana" --include="*.md" .

    # PT-BR: tarefas repetitivas via git log — commits de mesmo tipo
    git log --since="3 months ago" --pretty=format:"%s" | sort | uniq -c | sort -rn | head -20
    # Ex: "20× Re-run failed migration in prod"  → TOIL candidato
    # Ex: "15× Bump deploy-token"                → TOIL candidato

    # PT-BR: cron jobs já automatizados (saída esperada)
    crontab -l 2>/dev/null
    cat /etc/cron.d/* 2>/dev/null
    ```

    **`### Pattern: "toil tax" — prevenir feature nascer com toil`**:

    ```text
    Antes de mergear PR de nova feature, perguntar:

    1. "Como auto-operar isso em prod?"          → instrumentação ODD
    2. "Como auto-monitorar?"                     → 4 golden signals
    3. "Como auto-recuperar de fail comum?"       → retry, circuit breaker
    4. "Como auto-rotacionar credenciais?"        → vault + cron rotation
    5. "Como auto-limpar dados históricos?"       → retention policy + scheduled cleanup
    6. "Como onboarding de novo cliente?"         → self-service signup, não Slack ping

    Se QUALQUER resposta = "humano fará isso" → toil tax. Bloqueie ou descontar do release budget.
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Patterns canônicos` contém 5 sub-patterns
    - Decision tree enumera os 6 critérios de toil + 3 categorias não-toil (overhead, grungy work, project work)
    - Template TOIL-AUDIT.md tem tabela com colunas `Frequência`, `Hours/week`, `Pain (1-5)`, `Automation effort`, `Priority`
    - Tabela de estágios de automação enumera 5 níveis (L0-L4)
    - Comandos de identificação incluem `find`, `grep`, `git log`, `crontab`
    - Pattern "toil tax" lista 6 perguntas pre-merge
  </acceptance_criteria>
</task>

<task id="36-04-T4" name="Anti-patterns — 5 anti-patterns canônicos de toil">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/_shared-sre/glossary.md (subseção d — anti-patterns)
  </read_first>
  <action>
    Adicionar seção `## Anti-patterns` com 5 sub-anti-patterns no shape `ANTI / PROBLEMA / CERTO`:

    **`### ANTI: confundir overhead com toil`** — contar reuniões/RH/planning como toil → métrica inflada (60% toil falso); ações erradas (cortar reunião não diminui toil real). CERTO: overhead é separado; ≤ 50% rule conta APENAS toil estrito (6 critérios canônicos).

    **`### ANTI: hero culture (toil mascara via heroísmo)`** — engineer fica 2h por dia executando deploys manuais e é "celebrado por dedicação" → toil invisível para liderança; investimento em automação adiado; engineer pede demissão; sucessor herda toil sem context. CERTO: TOIL-AUDIT trimestral; quantificar em hours/week; tornar visível em dashboards de produtividade.

    **`### ANTI: documentar runbook em vez de automatizar`** — "Vamos só escrever um doc detalhado de como fazer isso" → L1 ainda é toil (humano lê doc, segue passos, falha em algum); doc fica desatualizado em 3 meses; primeira pessoa que segue após doc desatualizado quebra prod. CERTO: doc como passo intermediário; meta é L3/L4 (autonomous); marcar runbook com TODO de automação + owner + due date.

    **`### ANTI: automatizar parcialmente`** — script faz 3 dos 5 passos; humano completa os outros 2 → ainda é toil (humano envolvido); contexto-switch entre script e humano dobra tempo total; script raramente atualizado; degrada para "execute primeiro `./step1.sh`, depois manualmente faça X, depois `./step3.sh`". CERTO: automação completa OU não automatizar — meias-medidas perpetuam.

    **`### ANTI: ignorar toil de baixa frequência`** — "Só faço isso 1× por trimestre, não vale automatizar" → cumulative impact alto (10 tarefas trimestrais × 4 trimestres × 30 min = 20h/ano); cada vez que retorna, pessoa esquece passos; documentação envelhece. CERTO: priorizar por `(frequency × pain) / effort`; baixa frequência + alto pain (e.g., DR exercise) = ainda P1.

    Cada bloco usa shape:

    ```markdown
    ### ANTI: <nome>

    \`\`\`text
    ANTI: <comportamento concreto>

    PROBLEMA: <consequência sistêmica>

    CERTO: <ação substituta>
    \`\`\`
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Anti-patterns` contém 5 sub-anti-patterns: `### ANTI: confundir overhead com toil`, `### ANTI: hero culture`, `### ANTI: documentar runbook em vez de automatizar`, `### ANTI: automatizar parcialmente`, `### ANTI: ignorar toil de baixa frequência`
    - Cada um contém literalmente as 3 palavras-âncora `ANTI:`, `PROBLEMA:`, `CERTO:`
  </acceptance_criteria>
</task>

<task id="36-04-T5" name="Verificação + Ver também + footer">
  <read_first>
    - D:/projetos/opensource/mcp/kit/skills/event-based-slos/SKILL.md (linhas 251-275 — shape Verificação + Ver também + footer)
  </read_first>
  <action>
    Adicionar seções finais.

    **`## Verificação`**:

    ```markdown
    ## Verificação

    Antes de marcar audit de toil como completo:

    1. **Aplicado os 6 critérios canônicos** — cada item passou pelo decision tree (manual, repetitivo, automatizável, tático, sem valor durável, escala linear)
    2. **Quantificado em hours/week** — não "muito toil" mas "3.5h/week por pessoa"
    3. **% do tempo do time** computado — comparado contra ≤ 50% rule
    4. **Priorização por (frequency × pain) / effort** — P0/P1/P2 atribuído
    5. **Owner nomeado** para cada item P0
    6. **Overhead identificado separadamente** — não conta para ≤ 50%
    7. **Grungy work identificado separadamente** — projeto engineering, não toil
    8. **Pelo menos 1 item P0 escalonado** com automação proposta + esforço estimado
    ```

    **`## Ver também`**:

    ```markdown
    ## Ver também

    - [`_shared-sre/glossary.md`](../_shared-sre/glossary.md) — termos canônicos toil, overhead, grungy work, automation
    - [`observability-maturity-model`](../observability-maturity-model/SKILL.md) (v1.9) — Capacidade 3 (Complexidade/Tech Debt) consome toil score
    - [`production-readiness-review`](../production-readiness-review/SKILL.md) — PRR axis "Change Management" verifica deploy não é toil
    - [`blameless-postmortems`](../blameless-postmortems/SKILL.md) — postmortems de toil-induced incidents alimentam audit
    - [`sre-risk-management`](../sre-risk-management/SKILL.md) — toil reduz tempo para reduzir risk
    ```

    **Footer:**

    ```markdown
    ---

    *Material-fonte: Site Reliability Engineering — Beyer, Jones, Petoff, Murphy (Google/O'Reilly, 2016) — Cap 5: "Eliminating Toil".*
    ```
  </action>
  <acceptance_criteria>
    - Seção `## Verificação` contém checklist de 8 itens
    - Seção `## Ver também` lista exatamente 5 cross-refs Markdown relativos
    - Footer cita literalmente `Cap 5: "Eliminating Toil"`
    - Arquivo total ≤ 12 KB
  </acceptance_criteria>
</task>

## Verification

Antes de marcar plan completo:

- [ ] `kit/skills/eliminating-toil/SKILL.md` existe
- [ ] Frontmatter válido (`name: eliminating-toil`, `description ≤ 200 chars`)
- [ ] 6 seções presentes
- [ ] Cobre cap 5: definição canônica (6 critérios) + ≤ 50% rule + automation stages + toil tax + distinção overhead/grungy work
- [ ] Auto-contida — TOIL-AUDIT template inteiro presente, decision tree completo
- [ ] Cobre SKFD-SRE-03 integralmente

## Must-haves (goal-backward)

1. Skill `eliminating-toil/SKILL.md` existe com frontmatter triggerável
2. 6 critérios canônicos enumerados explicitamente (manual/repetitivo/automatizável/tático/sem valor durável/escala linear)
3. Regra ≤ 50% explícita
4. Decision tree para classificar overhead/grungy work distintos de toil
5. Template TOIL-AUDIT.md presente — `toil-auditor` Phase 37 usa esse formato

## Notes

- **Zero alterações em `src/core/`** — content-only (anti-pitfall A1 preservado)
- Skill é base para Phase 37 agente `toil-auditor` (gera TOIL-AUDIT.md no formato definido aqui)
- Phase 39 INT-OBS-02 conecta `omm-auditor` (v1.9) a esta skill — toil score alimenta Capacidade 3 do OMM
- Tamanho esperado ~10-12 KB
