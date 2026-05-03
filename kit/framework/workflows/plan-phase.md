<purpose>
Criar prompts de fase executáveis (arquivos PLAN.md) para uma fase do roadmap com pesquisa e verificação integradas. Fluxo padrão: Pesquisa (se necessário) -> Planejar -> Verificar -> Concluído. Orquestra agentes phase-researcher, planner e plan-checker com loop de revisão (máx 3 iterações).
</purpose>

<required_reading>
Ler todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.

@./.claude/framework/references/ui-brand.md
</required_reading>

<available_agent_types>
Tipos de subagentes framework válidos (use nomes exatos — não use 'general-purpose' como fallback):
- phase-researcher — Pesquisa abordagens técnicas para uma fase
- planner — Cria planos detalhados a partir do escopo da fase
- plan-checker — Revisa qualidade do plano antes da execução
</available_agent_types>

<process>

## 1. Inicializar

Carregar todo o contexto em uma chamada (apenas caminhos para minimizar contexto do orquestrador):

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_RESEARCHER=$(node "./.claude/framework/bin/tools.cjs" agent-skills researcher 2>/dev/null)
AGENT_SKILLS_PLANNER=$(node "./.claude/framework/bin/tools.cjs" agent-skills planner 2>/dev/null)
AGENT_SKILLS_CHECKER=$(node "./.claude/framework/bin/tools.cjs" agent-skills checker 2>/dev/null)
```

Analisar JSON para: `researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `nyquist_validation_enabled`, `commit_docs`, `text_mode`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_reviews`, `has_plans`, `plan_count`, `planning_exists`, `roadmap_exists`, `phase_req_ids`.

**Caminhos de arquivo (para blocos `<files_to_read>`):** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path`, `reviews_path`. Estes são null se os arquivos não existirem.

**Se `planning_exists` for false:** Erro — executar `/novo-projeto` primeiro.

## 2. Analisar e Normalizar Argumentos

Extrair de $ARGUMENTS: número da fase (inteiro ou decimal como `2.1`), flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--prd <filepath>`, `--reviews`, `--text`).

Definir `TEXT_MODE=true` se `--text` estiver presente em $ARGUMENTS OU `text_mode` do JSON do init for `true`. Quando `TEXT_MODE` estiver ativo, substituir cada chamada `AskUserQuestion` por uma lista numerada de texto simples e pedir ao usuário que digite o número da sua escolha. Isso é necessário para sessões remotas do Claude Code (modo `/rc`) onde menus TUI não funcionam através do App Claude.

Extrair `--prd <filepath>` de $ARGUMENTS. Se presente, definir PRD_FILE para o filepath.

**Se sem número de fase:** Detectar próxima fase não planejada do roadmap.

**Se `phase_found` for false:** Validar que a fase existe no ROADMAP.md. Se válida, criar o diretório usando `phase_slug` e `padded_phase` do init:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**Artefatos existentes do init:** `has_research`, `has_plans`, `plan_count`.

## 2.5. Validar Pré-requisito `--reviews`

**Pular se:** Sem flag `--reviews`.

**Se `--reviews` E `--gaps`:** Erro — não é possível combinar `--reviews` com `--gaps`. Estes são modos conflitantes.

**Se `--reviews` E `has_reviews` for false (sem REVIEWS.md no diretório da fase):**

Erro:
```
Nenhum REVIEWS.md encontrado para a Fase {N}. Execute reviews primeiro:

/revisar --phase {N}

Então re-execute /planejar-fase {N} --reviews
```
Sair do workflow.

## 3. Validar Fase

```bash
PHASE_INFO=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${PHASE}")
```

**Se `found` for false:** Erro com fases disponíveis. **Se `found` for true:** Extrair `phase_number`, `phase_name`, `goal` do JSON.

## 3.5. Tratar Caminho Expresso PRD

**Pular se:** Sem flag `--prd` nos argumentos.

**Se `--prd <filepath>` fornecido:**

1. Ler o arquivo PRD:
```bash
PRD_CONTENT=$(cat "$PRD_FILE" 2>/dev/null)
if [ -z "$PRD_CONTENT" ]; then
  echo "Erro: Arquivo PRD não encontrado: $PRD_FILE"
  exit 1
fi
```

2. Exibir banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► CAMINHO EXPRESSO PRD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usando PRD: {PRD_FILE}
Gerando CONTEXT.md a partir dos requisitos...
```

3. Analisar o conteúdo do PRD e gerar CONTEXT.md. O orquestrador deve:
   - Extrair todos os requisitos, histórias de usuário, critérios de aceitação e restrições do PRD
   - Mapear cada um para uma decisão bloqueada (tudo no PRD é tratado como decisão bloqueada)
   - Identificar quaisquer áreas que o PRD não cobre e marcar como "Discrição do Claude"
   - **Extrair refs canônicas** do ROADMAP.md para esta fase, mais quaisquer specs/ADRs referenciados no PRD — expandir para caminhos de arquivo completos (OBRIGATÓRIO)
   - Criar CONTEXT.md no diretório da fase

4. Escrever CONTEXT.md:
```markdown
# Fase [X]: [Nome] - Contexto

**Coletado:** [data]
**Status:** Pronto para planejamento
**Fonte:** Caminho Expresso PRD ({PRD_FILE})

<domain>
## Limite da Fase

[Extraído do PRD — o que esta fase entrega]

</domain>

<decisions>
## Decisões de Implementação

{Para cada requisito/história/critério no PRD:}
### [Categoria derivada do conteúdo]
- [Requisito como decisão bloqueada]

### Discrição do Claude
[Áreas não cobertas pelo PRD — detalhes de implementação, escolhas técnicas]

</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes downstream DEVEM ler estas antes de planejar ou implementar.**

[OBRIGATÓRIO. Extrair do ROADMAP.md e quaisquer docs referenciados no PRD.
Usar caminhos relativos completos. Agrupar por área de tópico.]

### [Área de tópico]
- `caminho/para/spec-ou-adr.md` — [O que decide/define]

[Se sem specs externas: "Sem specs externas — requisitos totalmente capturados nas decisões acima"]

</canonical_refs>

<specifics>
## Ideias Específicas

[Quaisquer referências específicas, exemplos ou requisitos concretos do PRD]

</specifics>

<deferred>
## Ideias Adiadas

[Itens no PRD explicitamente marcados como futuro/v2/fora do escopo]
[Se nenhum: "Nenhum — PRD cobre o escopo da fase"]

</deferred>

---

*Fase: XX-nome*
*Contexto coletado: [data] via Caminho Expresso PRD*
```

5. Commitar:
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(${padded_phase}): generate context from PRD" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

6. Definir `context_content` para o conteúdo do CONTEXT.md gerado e continuar para o passo 5 (Tratar Pesquisa).

**Efeito:** Isso ignora completamente o passo 4 (Carregar CONTEXT.md) já que acabamos de criá-lo. O restante do workflow (pesquisa, planejamento, verificação) prossegue normalmente com o contexto derivado do PRD.

## 4. Carregar CONTEXT.md

**Pular se:** O caminho expresso PRD foi usado (CONTEXT.md já criado no passo 3.5).

Verificar `context_path` do JSON do init.

Se `context_path` não for null, exibir: `Usando contexto da fase de: ${context_path}`

**Se `context_path` for null (sem CONTEXT.md existe):**

Ler modo de discussão para rótulo do gate de contexto:
```bash
DISCUSS_MODE=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

Se `TEXT_MODE` for true, apresentar como lista numerada de texto simples:
```
Nenhum CONTEXT.md encontrado para a Fase {X}. Planos usarão pesquisa e requisitos apenas — suas preferências de design não serão incluídas.

1. Continuar sem contexto — Planejar usando pesquisa + requisitos apenas
[Se DISCUSS_MODE for "assumptions":]
2. Coletar contexto (modo assumptions) — Analisar codebase e exibir hipóteses antes do planejamento
[Se DISCUSS_MODE for "discuss" ou não definido:]
2. Executar discuss-phase primeiro — Capturar decisões de design antes do planejamento

Digite o número:
```

Caso contrário usar AskUserQuestion:
- header: "Sem contexto"
- question: "Nenhum CONTEXT.md encontrado para a Fase {X}. Planos usarão pesquisa e requisitos apenas — suas preferências de design não serão incluídas. Continuar ou capturar contexto primeiro?"
- options:
  - "Continuar sem contexto" — Planejar usando pesquisa + requisitos apenas
  Se `DISCUSS_MODE` for `"assumptions"`:
  - "Coletar contexto (modo assumptions)" — Analisar codebase e exibir hipóteses antes do planejamento
  Se `DISCUSS_MODE` for `"discuss"` (ou não definido):
  - "Executar discuss-phase primeiro" — Capturar decisões de design antes do planejamento

Se "Continuar sem contexto": Prosseguir para o passo 5.
Se "Executar discuss-phase primeiro":
  **IMPORTANTE:** NÃO invocar discuss-phase como uma chamada Skill/Task aninhada — AskUserQuestion
  não funciona corretamente em subcontextos aninhados (#1009). Em vez disso, exibir o comando
  e sair para que o usuário o execute como um comando de nível superior:
  ```
  Execute este comando primeiro, então re-execute /planejar-fase {X} ${WS}:

  /discutir-fase {X} ${WS}
  ```
  **Sair do workflow plan-phase. Não continuar.**

## 5. Tratar Pesquisa

**Pular se:** flag `--gaps` ou flag `--skip-research` ou flag `--reviews`.

**Se `has_research` for true (do init) E sem flag `--research`:** Usar existente, pular para o passo 6.

**Se RESEARCH.md ausente OU flag `--research`:**

**Se sem flag explícita (`--research` ou `--skip-research`) e não `--auto`:**
Perguntar ao usuário se deseja pesquisar, com uma recomendação contextual baseada na fase:

Se `TEXT_MODE` for true, apresentar como lista numerada de texto simples:
```
Pesquisar antes de planejar a Fase {X}: {phase_name}?

1. Pesquisar primeiro (Recomendado) — Investigar domínio, padrões e dependências antes do planejamento. Melhor para novas funcionalidades, integrações desconhecidas ou mudanças arquiteturais.
2. Pular pesquisa — Planejar diretamente a partir do contexto e requisitos. Melhor para correções de bugs, refatorações simples ou tarefas bem compreendidas.

Digite o número:
```

Caso contrário usar AskUserQuestion:
```
AskUserQuestion([
  {
    question: "Pesquisar antes de planejar a Fase {X}: {phase_name}?",
    header: "Pesquisa",
    multiSelect: false,
    options: [
      { label: "Pesquisar primeiro (Recomendado)", description: "Investigar domínio, padrões e dependências antes do planejamento. Melhor para novas funcionalidades, integrações desconhecidas ou mudanças arquiteturais." },
      { label: "Pular pesquisa", description: "Planejar diretamente a partir do contexto e requisitos. Melhor para correções de bugs, refatorações simples ou tarefas bem compreendidas." }
    ]
  }
])
```

Se o usuário selecionar "Pular pesquisa": pular para o passo 6.

**Se `--auto` e `research_enabled` for false:** Pular pesquisa silenciosamente (preserva comportamento automatizado).

Exibir banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► PESQUISANDO FASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Criando pesquisador...
```

### Criar phase-researcher

```bash
PHASE_DESC=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${PHASE}" --pick section)
```

Prompt de pesquisa:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}
Answer: "What do I need to know to PLAN this phase well?"
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<additional_context>
**Phase description:** {phase_description}
**Phase requirement IDs (MUST address):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, research should account for project skill patterns
</additional_context>

<output>
Write to: {phase_dir}/{phase_num}-RESEARCH.md
</output>
```

```
Task(
  prompt=research_prompt,
  subagent_type="phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

### Lidar com Retorno do Pesquisador

- **`## RESEARCH COMPLETE`:** Exibir confirmação, continuar para o passo 6
- **`## RESEARCH BLOCKED`:** Exibir bloqueador, oferecer: 1) Fornecer contexto, 2) Pular pesquisa, 3) Abortar

## 5.5. Criar Estratégia de Validação

Pular se `nyquist_validation_enabled` for false OU `research_enabled` for false.

Se `research_enabled` for false e `nyquist_validation_enabled` for true: avisar "Validação Nyquist habilitada mas pesquisa desabilitada — VALIDATION.md não pode ser criado sem RESEARCH.md. Planos não terão requisitos de validação (Dimensão 8)." Continuar para o passo 6.

**Mas Nyquist não é aplicável para esta execução** quando todos os seguintes forem verdadeiros:
- `research_enabled` for false
- `has_research` for false
- nenhuma flag `--research` foi fornecida

Nesse caso: **pular completamente a criação da estratégia de validação**. **Não** esperar `RESEARCH.md` ou `VALIDATION.md` para esta execução, e continuar para o Passo 6.

```bash
grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null || true
```

**Se encontrado:**
1. Ler template: `./.claude/framework/templates/VALIDATION.md`
2. Escrever em `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md` (usar ferramenta Write)
3. Preencher frontmatter: `{N}` → número da fase, `{phase-slug}` → slug, `{date}` → data atual
4. Verificar:
```bash
test -f "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md" && echo "VALIDATION_CREATED=true" || echo "VALIDATION_CREATED=false"
```
5. Se `VALIDATION_CREATED=false`: PARAR — não prosseguir para o Passo 6
6. Se `commit_docs`: `commit "docs(phase-${PHASE}): add validation strategy"`

**Se não encontrado:** Avisar e continuar — planos podem falhar na Dimensão 8.

## 5.6. Gate de Contrato de Design de UI

> Pular se `workflow.ui_phase` for explicitamente `false` E `workflow.ui_safety_gate` for explicitamente `false` em `.planning/config.json`. Se as chaves estiverem ausentes, tratar como habilitado.

```bash
UI_PHASE_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.ui_phase 2>/dev/null || echo "true")
UI_GATE_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.ui_safety_gate 2>/dev/null || echo "true")
```

**Se ambos forem `false`:** Pular para o passo 6.

Verificar se a fase tem indicadores de frontend:

```bash
PHASE_SECTION=$(node "./.claude/framework/bin/tools.cjs" roadmap get-phase "${PHASE}" 2>/dev/null)
echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
HAS_UI=$?
```

**Se `HAS_UI` for 0 (indicadores de frontend encontrados):**

Verificar UI-SPEC existente:
```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**Se UI-SPEC.md encontrado:** Definir `UI_SPEC_PATH=$UI_SPEC_FILE`. Exibir: `Usando contrato de design de UI: ${UI_SPEC_PATH}`

**Se UI-SPEC.md ausente E `UI_GATE_CFG` for `true`:**

Se `TEXT_MODE` for true, apresentar como lista numerada de texto simples:
```
A Fase {N} tem indicadores de frontend mas sem UI-SPEC.md. Gerar um contrato de design antes do planejamento?

1. Gerar UI-SPEC primeiro — Execute /fase-ui {N} então re-execute /planejar-fase {N}
2. Continuar sem UI-SPEC
3. Não é uma fase de frontend

Digite o número:
```

Caso contrário usar AskUserQuestion:
- header: "Contrato de Design de UI"
- question: "A Fase {N} tem indicadores de frontend mas sem UI-SPEC.md. Gerar um contrato de design antes do planejamento?"
- options:
  - "Gerar UI-SPEC primeiro" → Exibir: "Execute `/fase-ui {N} ${WS}` então re-execute `/planejar-fase {N} ${WS}`". Sair do workflow.
  - "Continuar sem UI-SPEC" → Continuar para o passo 6.
  - "Não é uma fase de frontend" → Continuar para o passo 6.

**Se `HAS_UI` for 1 (sem indicadores de frontend):** Pular silenciosamente para o passo 6.

## 6. Verificar Planos Existentes

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null || true
```

**Se existir E flag `--reviews`:** Pular prompt — ir diretamente para replanejamento (o propósito de `--reviews` é replanejar com feedback de revisão).

**Se existir E sem flag `--reviews`:** Oferecer: 1) Adicionar mais planos, 2) Visualizar existentes, 3) Replanejar do zero.

## 7. Usar Caminhos de Contexto do INIT

Extrair do JSON do INIT:

```bash
_field() { node -e "const o=JSON.parse(process.argv[1]); const v=o[process.argv[2]]; process.stdout.write(v==null?'':String(v))" "$1" "$2"; }
STATE_PATH=$(_field "$INIT" state_path)
ROADMAP_PATH=$(_field "$INIT" roadmap_path)
REQUIREMENTS_PATH=$(_field "$INIT" requirements_path)
RESEARCH_PATH=$(_field "$INIT" research_path)
VERIFICATION_PATH=$(_field "$INIT" verification_path)
UAT_PATH=$(_field "$INIT" uat_path)
CONTEXT_PATH=$(_field "$INIT" context_path)
REVIEWS_PATH=$(_field "$INIT" reviews_path)
```

## 7.5. Verificar Artefatos Nyquist

Pular se `nyquist_validation_enabled` for false OU `research_enabled` for false.

Também pular se todos os seguintes forem verdadeiros:
- `research_enabled` for false
- `has_research` for false
- nenhuma flag `--research` foi fornecida

No caminho sem-pesquisa, artefatos Nyquist **não são necessários** para esta execução.

```bash
VALIDATION_EXISTS=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
```

Se ausente e Nyquist ainda estiver habilitado/aplicável — perguntar ao usuário:
1. Re-executar: `/planejar-fase {PHASE} --research ${WS}`
2. Desabilitar Nyquist com o comando exato:
   `node "./.claude/framework/bin/tools.cjs" config-set workflow.nyquist_validation false`
3. Continuar mesmo assim (planos falham na Dimensão 8)

Prosseguir para o Passo 8 apenas se o usuário selecionar 2 ou 3.

## 8. Criar Agente planner

Exibir banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► PLANEJANDO FASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Criando planejador...
```

Prompt do planejador:

```markdown
<planning_context>
**Phase:** {phase_number}
**Mode:** {standard | gap_closure | reviews}

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /discuss-phase)
- {research_path} (Technical Research)
- {verification_path} (Verification Gaps - if --gaps)
- {uat_path} (UAT Gaps - if --gaps)
- {reviews_path} (Cross-AI Review Feedback - if --reviews)
- {UI_SPEC_PATH} (UI Design Contract — visual/interaction specs, if exists)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, plans should account for project skill rules
</planning_context>

<downstream_consumer>
Output consumed by /execute-phase. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format with read_first and acceptance_criteria fields (MANDATORY on every task)
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<deep_work_rules>
## Anti-Shallow Execution Rules (MANDATORY)

Every task MUST include these fields — they are NOT optional:

1. **`<read_first>`** — Files the executor MUST read before touching anything. Always include:
   - The file being modified (so executor sees current state, not assumptions)
   - Any "source of truth" file referenced in CONTEXT.md (reference implementations, existing patterns, config files, schemas)
   - Any file whose patterns, signatures, types, or conventions must be replicated or respected

2. **`<acceptance_criteria>`** — Verifiable conditions that prove the task was done correctly. Rules:
   - Every criterion must be checkable with grep, file read, test command, or CLI output
   - NEVER use subjective language ("looks correct", "properly configured", "consistent with")
   - ALWAYS include exact strings, patterns, values, or command outputs that must be present
   - Examples:
     - Code: `auth.py contains def verify_token(` / `test_auth.py exits 0`
     - Config: `.env.example contains DATABASE_URL=` / `Dockerfile contains HEALTHCHECK`
     - Docs: `README.md contains '## Installation'` / `API.md lists all endpoints`
     - Infra: `deploy.yml has rollback step` / `docker-compose.yml has healthcheck for db`

3. **`<action>`** — Must include CONCRETE values, not references. Rules:
   - NEVER say "align X with Y", "match X to Y", "update to be consistent" without specifying the exact target state
   - ALWAYS include the actual values: config keys, function signatures, SQL statements, class names, import paths, env vars, etc.
   - If CONTEXT.md has a comparison table or expected values, copy them into the action verbatim
   - The executor should be able to complete the task from the action text alone, without needing to read CONTEXT.md or reference files (read_first is for verification, not discovery)

**Why this matters:** Executor agents work from the plan text. Vague instructions like "update the config to match production" produce shallow one-line changes. Concrete instructions like "add DATABASE_URL=postgresql://... , set POOL_SIZE=20, add REDIS_URL=redis://..." produce complete work. The cost of verbose plans is far less than the cost of re-doing shallow execution.
</deep_work_rules>

<quality_gate>
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Every task has `<read_first>` with at least the file being modified
- [ ] Every task has `<acceptance_criteria>` with grep-verifiable conditions
- [ ] Every `<action>` contains concrete values (no "align X with Y" without specifying what)
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="planner",
  model="{planner_model}",
  description="Plan Phase {phase}"
)
```

## 9. Lidar com Retorno do Planejador

- **`## PLANNING COMPLETE`:** Exibir contagem de planos. Se `--skip-verify` ou `plan_checker_enabled` for false (do init): pular para o passo 13. Caso contrário: passo 10.
- **`## CHECKPOINT REACHED`:** Apresentar ao usuário, obter resposta, criar continuação (passo 12)
- **`## PLANNING INCONCLUSIVE`:** Mostrar tentativas, oferecer: Adicionar contexto / Tentar novamente / Manual

## 10. Criar Agente plan-checker

Exibir banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► VERIFICANDO PLANOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Criando verificador de planos...
```

Prompt do verificador:

```markdown
<verification_context>
**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Plans to verify)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /discuss-phase)
- {research_path} (Technical Research — includes Validation Architecture)
</files_to_read>

${AGENT_SKILLS_CHECKER}

**Phase requirement IDs (MUST ALL be covered):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — verify plans honor project guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — verify plans account for project skill rules
</verification_context>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} plans"
)
```

## 11. Lidar com Retorno do Verificador

- **`## VERIFICATION PASSED`:** Exibir confirmação, prosseguir para o passo 13.
- **`## ISSUES FOUND`:** Exibir problemas, verificar contagem de iteração, prosseguir para o passo 12.

## 12. Loop de Revisão (Máx 3 Iterações)

Rastrear `iteration_count` (começa em 1 após plano inicial + verificação).

**Se iteration_count < 3:**

Exibir: `Enviando de volta ao planejador para revisão... (iteração {N}/3)`

Prompt de revisão:

```markdown
<revision_context>
**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Existing plans)
- {context_path} (USER DECISIONS from /discuss-phase)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Checker issues:** {structured_issues_from_checker}
</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>
```

```
Task(
  prompt=revision_prompt,
  subagent_type="planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

Após planejador retornar -> criar verificador novamente (passo 10), incrementar iteration_count.

**Se iteration_count >= 3:**

Exibir: `Máximo de iterações atingido. {N} problemas restam:` + lista de problemas

Oferecer: 1) Forçar prosseguimento, 2) Fornecer orientação e tentar novamente, 3) Abandonar

## 13. Gate de Cobertura de Requisitos

Após os planos passarem pelo verificador (ou verificador ser pulado), verificar se todos os requisitos de fase são cobertos por pelo menos um plano.

**Pular se:** `phase_req_ids` for null ou TBD (sem requisitos mapeados para esta fase).

**Passo 1: Extrair IDs de requisito reivindicados pelos planos**
```bash
# Coletar todos os IDs de requisito do frontmatter dos planos
PLAN_REQS=$(grep -h "requirements_addressed\|requirements:" ${PHASE_DIR}/*-PLAN.md 2>/dev/null | tr -d '[]' | tr ',' '\n' | sed 's/^[[:space:]]*//' | sort -u)
```

**Passo 2: Comparar com requisitos de fase do ROADMAP**

Para cada REQ-ID em `phase_req_ids`:
- Se REQ-ID aparecer em `PLAN_REQS` → coberto ✓
- Se REQ-ID NÃO aparecer em nenhum plano → não coberto ✗

**Passo 3: Verificar funcionalidades do CONTEXT.md contra objetivos do plano**

Ler seção `<decisions>` do CONTEXT.md. Extrair nomes de funcionalidade/capacidade. Verificar cada um contra blocos `<objective>` do plano. Funcionalidades não mencionadas em nenhum objetivo de plano → potencialmente descartadas.

**Passo 4: Reportar**

Se todos os requisitos cobertos e sem funcionalidades descartadas:
```
✓ Cobertura de requisitos: {N}/{N} REQ-IDs cobertos pelos planos
```
→ Prosseguir para o passo 14.

Se lacunas encontradas:
```
## ⚠ Lacuna de Cobertura de Requisitos

{M} de {N} requisitos de fase não estão atribuídos a nenhum plano:

| REQ-ID | Descrição | Planos |
|--------|-----------|--------|
| {id} | {do REQUIREMENTS.md} | Nenhum |

{K} funcionalidades do CONTEXT.md não encontradas nos objetivos dos planos:
- {feature_name} — descrito no CONTEXT.md mas nenhum plano cobre

Opções:
1. Replanejar para incluir requisitos faltantes (recomendado)
2. Mover requisitos não cobertos para a próxima fase
3. Prosseguir mesmo assim — aceitar lacunas de cobertura
```

Se `TEXT_MODE` for true, apresentar como lista numerada de texto simples (opções já mostradas no bloco acima). Caso contrário usar AskUserQuestion para apresentar as opções.

## 14. Apresentar Status Final

Rotear para `<offer_next>` OU `auto_advance` dependendo de flags/config.

## 15. Verificação de Avanço Automático

Verificar gatilho de avanço automático:

1. Analisar flag `--auto` de $ARGUMENTS
2. **Sincronizar flag de cadeia com intenção** — se o usuário invocou manualmente (sem `--auto`), limpar a flag de cadeia efêmera de qualquer cadeia `--auto` anterior interrompida. Isso NÃO toca em `workflow.auto_advance` (preferência persistente do usuário):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Ler tanto a flag de cadeia quanto a preferência do usuário:
   ```bash
   AUTO_CHAIN=$(node "./.claude/framework/bin/tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**Se flag `--auto` presente OU `AUTO_CHAIN` for true OU `AUTO_CFG` for true:**

Exibir banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► AVANÇANDO AUTOMATICAMENTE PARA EXECUÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Planos prontos. Iniciando execute-phase...
```

Iniciar execute-phase usando a ferramenta Skill para evitar sessões Task aninhadas (que causam freezes de runtime devido ao aninhamento profundo de agentes):
```
Skill(skill="framework:executar-fase", args="${PHASE} --auto --no-transition ${WS}")
```

A flag `--no-transition` diz ao execute-phase para retornar status após verificação em vez de encadear mais. Isso mantém a cadeia de avanço automático plana — cada fase roda no mesmo nível de aninhamento em vez de criar agentes Task mais profundos.

**Lidar com retorno do execute-phase:**
- **FASE CONCLUÍDA** → Exibir resumo final:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   framework ► FASE ${PHASE} CONCLUÍDA ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Pipeline de avanço automático finalizado.

  Próximo: /discutir-fase ${NEXT_PHASE} --auto ${WS}
  ```
- **LACUNAS ENCONTRADAS / VERIFICAÇÃO FALHOU** → Exibir resultado, parar cadeia:
  ```
  Avanço automático parado: Execução precisa de revisão.

  Revisar a saída acima e continuar manualmente:
  /executar-fase ${PHASE} ${WS}
  ```

**Se nem `--auto` nem config habilitado:**
Rotear para `<offer_next>` (comportamento existente).

</process>

<offer_next>
Produzir este markdown diretamente (não como bloco de código):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► FASE {X} PLANEJADA ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Fase {X}: {Nome}** — {N} plano(s) em {M} onda(s)

| Onda | Planos | O que constrói |
|------|--------|----------------|
| 1    | 01, 02 | [objetivos] |
| 2    | 03     | [objetivo]  |

Pesquisa: {Concluída | Existente usada | Pulada}
Verificação: {Passou | Passou com override | Pulada}

───────────────────────────────────────────────────────────────

## ▶ Próximo Passo

**Executar Fase {X}** — executar todos os {N} planos

/executar-fase {X} ${WS}

<sub>/clear primeiro → janela de contexto fresca</sub>

───────────────────────────────────────────────────────────────

**Também disponível:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — revisar planos
- /planejar-fase {X} --research — pesquisar primeiro
- /revisar --phase {X} --all — revisão por pares com IAs externas
- /planejar-fase {X} --reviews — replanejar incorporando feedback de revisão

───────────────────────────────────────────────────────────────
</offer_next>

<windows_troubleshooting>
**Usuários Windows:** Se plan-phase travar durante a criação de agentes (comum no Windows devido a
deadlocks de stdio com servidores MCP — ver issue do Claude Code anthropics/claude-code#28126):

1. **Forçar encerramento:** Fechar o terminal (Ctrl+C pode não funcionar)
2. **Limpar processos órfãos:**
   ```powershell
   # Encerrar processos node órfãos de servidores MCP obsoletos
   Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.StartTime -lt (Get-Date).AddHours(-1)} | Stop-Process -Force
   ```
3. **Limpar diretórios de tarefa obsoletos:**
   ```powershell
   # Remover diretórios de tarefa de subagente obsoletos (Claude Code nunca limpa no crash)
   Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\tasks\*" -ErrorAction SilentlyContinue
   ```
4. **Reduzir contagem de servidores MCP:** Desabilitar temporariamente servidores MCP não essenciais em settings.json
5. **Tentar novamente:** Reiniciar Claude Code e executar `/planejar-fase` novamente

Se travamentos persistirem, tente `--skip-research` para reduzir a cadeia de agentes de 3 para 2:
```
/planejar-fase N --skip-research
```
</windows_troubleshooting>

<success_criteria>
- [ ] Diretório .planning/ validado
- [ ] Fase validada contra o roadmap
- [ ] Diretório da fase criado se necessário
- [ ] CONTEXT.md carregado cedo (passo 4) e passado para TODOS os agentes
- [ ] Pesquisa concluída (a menos que --skip-research ou --gaps ou existente)
- [ ] phase-researcher criado com CONTEXT.md
- [ ] Planos existentes verificados
- [ ] planner criado com CONTEXT.md + RESEARCH.md
- [ ] Planos criados (PLANNING COMPLETE ou CHECKPOINT tratado)
- [ ] plan-checker criado com CONTEXT.md
- [ ] Verificação passou OU override do usuário OU máximo de iterações com decisão do usuário
- [ ] Usuário vê status entre criações de agente
- [ ] Usuário sabe os próximos passos
</success_criteria>
