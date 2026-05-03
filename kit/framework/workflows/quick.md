<purpose>
Executa tarefas pequenas e ad-hoc com as garantias do framework (commits atômicos, rastreamento no STATE.md). O modo rápido spawna planner (modo rápido) + executor(s), rastreia tarefas em `.planning/quick/` e atualiza a tabela "Tarefas Rápidas Concluídas" do STATE.md.

Com a flag `--discuss`: fase de discussão leve antes do planejamento. Apresenta suposições, esclarece áreas cinzentas, captura decisões em CONTEXT.md para que o planejador as trate como bloqueadas.

Com a flag `--full`: habilita verificação de plano (máx. 2 iterações) e verificação pós-execução para garantias de qualidade sem a cerimônia completa do marco.

Com a flag `--research`: spawna um agente de pesquisa focado antes do planejamento. Investiga abordagens de implementação, opções de bibliotecas e armadilhas. Use quando não tiver certeza de como abordar uma tarefa.

As flags são combináveis: `--discuss --research --full` fornece discussão + pesquisa + verificação de plano + verificação de resultados.
</purpose>

<required_reading>
Leia todos os arquivos referenciados pelo execution_context do prompt invocador antes de começar.
</required_reading>

<available_agent_types>
Tipos de subagente framework válidos (use os nomes exatos — não use 'general-purpose' como fallback):
- phase-researcher — Pesquisa abordagens técnicas para uma fase
- planner — Cria planos detalhados a partir do escopo da fase
- plan-checker — Revisa a qualidade do plano antes da execução
- executor — Executa tarefas do plano, commits, cria SUMMARY.md
- verifier — Verifica a conclusão da fase, verifica gates de qualidade
</available_agent_types>

<process>
**Passo 1: Analisar argumentos e obter descrição da tarefa**

Analise `$ARGUMENTS` para:
- Flag `--full` → armazene como `$FULL_MODE` (true/false)
- Flag `--discuss` → armazene como `$DISCUSS_MODE` (true/false)
- Flag `--research` → armazene como `$RESEARCH_MODE` (true/false)
- Texto restante → use como `$DESCRIPTION` se não vazio

Se `$DESCRIPTION` estiver vazio após a análise, pergunte ao usuário interativamente:

```
AskUserQuestion(
  header: "Tarefa Rápida",
  question: "O que você quer fazer?",
  followUp: null
)
```

Armazene a resposta como `$DESCRIPTION`.

Se ainda vazio, pergunte novamente: "Por favor, forneça uma descrição da tarefa."

Exiba o banner com base nas flags ativas:

Se `$DISCUSS_MODE` e `$RESEARCH_MODE` e `$FULL_MODE`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► TAREFA RÁPIDA (DISCUTIR + PESQUISAR + COMPLETO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussão + pesquisa + verificação de plano + verificação de resultados habilitadas
```

Se `$DISCUSS_MODE` e `$FULL_MODE` (sem pesquisa):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► TAREFA RÁPIDA (DISCUTIR + COMPLETO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussão + verificação de plano + verificação de resultados habilitadas
```

Se `$DISCUSS_MODE` e `$RESEARCH_MODE` (sem completo):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► TAREFA RÁPIDA (DISCUTIR + PESQUISAR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussão + pesquisa habilitadas
```

Se `$RESEARCH_MODE` e `$FULL_MODE` (sem discutir):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► TAREFA RÁPIDA (PESQUISAR + COMPLETO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Pesquisa + verificação de plano + verificação de resultados habilitadas
```

Se somente `$DISCUSS_MODE`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► TAREFA RÁPIDA (DISCUTIR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Fase de discussão habilitada — apresentando áreas cinzentas antes do planejamento
```

Se somente `$RESEARCH_MODE`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► TAREFA RÁPIDA (PESQUISAR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Fase de pesquisa habilitada — investigando abordagens antes do planejamento
```

Se somente `$FULL_MODE`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► TAREFA RÁPIDA (MODO COMPLETO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Verificação de plano + verificação de resultados habilitadas
```

---

**Passo 2: Inicializar**

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init quick "$DESCRIPTION")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_PLANNER=$(node "./.claude/framework/bin/tools.cjs" agent-skills planner 2>/dev/null)
AGENT_SKILLS_EXECUTOR=$(node "./.claude/framework/bin/tools.cjs" agent-skills executor 2>/dev/null)
AGENT_SKILLS_CHECKER=$(node "./.claude/framework/bin/tools.cjs" agent-skills checker 2>/dev/null)
AGENT_SKILLS_VERIFIER=$(node "./.claude/framework/bin/tools.cjs" agent-skills verifier 2>/dev/null)
```

Analise o JSON para: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `branch_name`, `quick_id`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`.

**Se `roadmap_exists` for false:** Erro — O modo rápido requer um projeto ativo com ROADMAP.md. Execute `/novo-projeto` primeiro.

Tarefas rápidas podem ser executadas no meio de uma fase — a validação verifica apenas se ROADMAP.md existe, não o status da fase.

---

**Passo 2.5: Tratar ramificação de tarefa rápida**

**Se `branch_name` estiver vazio/null:** Pule e continue na branch atual.

**Se `branch_name` estiver definido:** Faça checkout da branch de tarefa rápida antes de qualquer commit de planejamento:

```bash
git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
```

Todos os commits de tarefa rápida desta execução ficam nessa branch. O usuário trata o merge/rebase posteriormente.

---

**Passo 3: Criar diretório de tarefas**

```bash
mkdir -p "${task_dir}"
```

---

**Passo 4: Criar diretório de tarefa rápida**

Crie o diretório para esta tarefa rápida:

```bash
QUICK_DIR=".planning/quick/${quick_id}-${slug}"
mkdir -p "$QUICK_DIR"
```

Reporte ao usuário:
```
Criando tarefa rápida ${quick_id}: ${DESCRIPTION}
Diretório: ${QUICK_DIR}
```

Armazene `$QUICK_DIR` para uso na orquestração.

---

**Passo 4.5: Fase de discussão (apenas quando `$DISCUSS_MODE`)**

Pule este passo completamente se NÃO for `$DISCUSS_MODE`.

Exiba o banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► DISCUTINDO TAREFA RÁPIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Apresentando áreas cinzentas para: ${DESCRIPTION}
```

**4.5a. Identificar áreas cinzentas**

Analise `$DESCRIPTION` para identificar 2-4 áreas cinzentas — decisões de implementação que mudariam o resultado e sobre as quais o usuário deveria opinar.

Use a heurística orientada ao domínio para gerar áreas cinzentas específicas da fase (não genéricas):
- Algo que usuários **VEEM** → layout, densidade, interações, estados
- Algo que usuários **CHAMAM** → respostas, erros, auth, versionamento
- Algo que usuários **EXECUTAM** → formato de saída, flags, modos, tratamento de erros
- Algo que usuários **LEEM** → estrutura, tom, profundidade, fluxo
- Algo sendo **ORGANIZADO** → critérios, agrupamento, nomenclatura, exceções

Cada área cinzenta deve ser um ponto de decisão concreto, não uma categoria vaga. Exemplo: "Comportamento de carregamento" e não "UX".

**4.5b. Apresentar áreas cinzentas**

```
AskUserQuestion(
  header: "Áreas Cinzentas",
  question: "Quais áreas precisam de esclarecimento antes do planejamento?",
  options: [
    { label: "${area_1}", description: "${por_que_importa_1}" },
    { label: "${area_2}", description: "${por_que_importa_2}" },
    { label: "${area_3}", description: "${por_que_importa_3}" },
    { label: "Tudo certo", description: "Pular discussão — sei o que quero" }
  ],
  multiSelect: true
)
```

Se o usuário selecionar "Tudo certo" → pule para o Passo 5 (sem CONTEXT.md escrito).

**4.5c. Discutir áreas selecionadas**

Para cada área selecionada, faça 1-2 perguntas focadas via AskUserQuestion:

```
AskUserQuestion(
  header: "${nome_da_area}",
  question: "${pergunta_específica_sobre_esta_area}",
  options: [
    { label: "${escolha_concreta_1}", description: "${o_que_isso_significa}" },
    { label: "${escolha_concreta_2}", description: "${o_que_isso_significa}" },
    { label: "${escolha_concreta_3}", description: "${o_que_isso_significa}" },
    { label: "Você decide", description: "A critério do Claude" }
  ],
  multiSelect: false
)
```

Regras:
- As opções devem ser escolhas concretas, não categorias abstratas
- Destaque a escolha recomendada quando tiver uma opinião clara
- Se o usuário selecionar "Outro" com texto livre, mude para acompanhamento em texto simples (conforme regra de texto livre de questioning.md)
- Se o usuário selecionar "Você decide", capture como Decisão do Claude no CONTEXT.md
- Máx. 2 perguntas por área — é leve, não um aprofundamento

Colete todas as decisões em `$DECISIONS`.

**4.5d. Escrever CONTEXT.md**

Escreva `${QUICK_DIR}/${quick_id}-CONTEXT.md` usando a estrutura padrão do template de contexto:

```markdown
# Tarefa Rápida ${quick_id}: ${DESCRIPTION} - Contexto

**Coletado:** ${date}
**Status:** Pronto para planejamento

<domain>
## Escopo da Tarefa

${DESCRIPTION}

</domain>

<decisions>
## Decisões de Implementação

### ${nome_da_area_1}
- ${decisão_da_discussão}

### ${nome_da_area_2}
- ${decisão_da_discussão}

### Decisão do Claude
${áreas_onde_o_usuário_disse_você_decide_ou_áreas_não_discutidas}

</decisions>

<specifics>
## Ideias Específicas

${quaisquer_referências_ou_exemplos_específicos_da_discussão}

[Se nenhum: "Sem requisitos específicos — aberto a abordagens padrão"]

</specifics>

<canonical_refs>
## Referências Canônicas

${quaisquer_specs_adrs_ou_docs_referenciados_durante_a_discussão}

[Se nenhum: "Sem especificações externas — requisitos totalmente capturados nas decisões acima"]

</canonical_refs>
```

Nota: O CONTEXT.md de tarefa rápida omite as seções `<code_context>` e `<deferred>` (sem exploração de codebase, sem escopo de fase para adiar). Mantenha-o enxuto. A seção `<canonical_refs>` é incluída quando docs externos foram referenciados — omita-a apenas se nenhum doc externo se aplicar.

Reporte: `Contexto capturado: ${QUICK_DIR}/${quick_id}-CONTEXT.md`

---

**Passo 4.75: Fase de pesquisa (apenas quando `$RESEARCH_MODE`)**

Pule este passo completamente se NÃO for `$RESEARCH_MODE`.

Exiba o banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► PESQUISANDO TAREFA RÁPIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Investigando abordagens para: ${DESCRIPTION}
```

Spawne um pesquisador único e focado (não 4 pesquisadores paralelos como fases completas — tarefas rápidas precisam de pesquisa direcionada, não de levantamentos de domínio amplos):

```
Task(
  prompt="
<research_context>

**Mode:** quick-task
**Task:** ${DESCRIPTION}
**Output:** ${QUICK_DIR}/${quick_id}-RESEARCH.md

<files_to_read>
- .planning/STATE.md (Project state — what's already built)
- .planning/PROJECT.md (Project context)
- ./CLAUDE.md (if exists — project-specific guidelines)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (User decisions — research should align with these)' : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

</research_context>

<focus>
This is a quick task, not a full phase. Research should be concise and targeted:
1. Best libraries/patterns for this specific task
2. Common pitfalls and how to avoid them
3. Integration points with existing codebase
4. Any constraints or gotchas worth knowing before planning

Do NOT produce a full domain survey. Target 1-2 pages of actionable findings.
</focus>

<output>
Write research to: ${QUICK_DIR}/${quick_id}-RESEARCH.md
Use standard research format but keep it lean — skip sections that don't apply.
Return: ## RESEARCH COMPLETE with file path
</output>
",
  subagent_type="phase-researcher",
  model="{planner_model}",
  description="Research: ${DESCRIPTION}"
)
```

Após o retorno do pesquisador:
1. Verifique se a pesquisa existe em `${QUICK_DIR}/${quick_id}-RESEARCH.md`
2. Reporte: "Pesquisa concluída: ${QUICK_DIR}/${quick_id}-RESEARCH.md"

Se o arquivo de pesquisa não for encontrado, avise mas continue: "O agente de pesquisa não produziu saída — prosseguindo para o planejamento sem pesquisa."

---

**Passo 5: Spawnar planejador (modo rápido)**

**Se `$FULL_MODE`:** Use o modo `quick-full` com restrições mais rígidas.

**Se NÃO `$FULL_MODE`:** Use o modo `quick` padrão.

```
Task(
  prompt="
<planning_context>

**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md (Project State)
- ./CLAUDE.md (if exists — follow project-specific guidelines)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (User decisions — locked, do not revisit)' : ''}
${RESEARCH_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md (Research findings — use to inform implementation choices)' : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, plans should account for project skill rules

</planning_context>

<constraints>
- Create a SINGLE plan with 1-3 focused tasks
- Quick tasks should be atomic and self-contained
${RESEARCH_MODE ? '- Research findings are available — use them to inform library/pattern choices' : '- No research phase'}
${FULL_MODE ? '- Target ~40% context usage (structured for verification)' : '- Target ~30% context usage (simple, focused)'}
${FULL_MODE ? '- MUST generate `must_haves` in plan frontmatter (truths, artifacts, key_links)' : ''}
${FULL_MODE ? '- Each task MUST have `files`, `action`, `verify`, `done` fields' : ''}
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${quick_id}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

Após o retorno do planejador:
1. Verifique se o plano existe em `${QUICK_DIR}/${quick_id}-PLAN.md`
2. Extraia a contagem de planos (tipicamente 1 para tarefas rápidas)
3. Reporte: "Plano criado: ${QUICK_DIR}/${quick_id}-PLAN.md"

Se o plano não for encontrado, erro: "Planejador falhou ao criar ${quick_id}-PLAN.md"

---

**Passo 5.5: Loop de verificação de plano (apenas quando `$FULL_MODE`)**

Pule este passo completamente se NÃO for `$FULL_MODE`.

Exiba o banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► VERIFICANDO PLANO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Prompt do verificador:

```markdown
<verification_context>
**Mode:** quick-full
**Task Description:** ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan to verify)
</files_to_read>

${AGENT_SKILLS_CHECKER}

**Scope:** This is a quick task, not a full phase. Skip checks that require a ROADMAP phase goal.
</verification_context>

<check_dimensions>
- Requirement coverage: Does the plan address the task description?
- Task completeness: Do tasks have files, action, verify, done fields?
- Key links: Are referenced files real?
- Scope sanity: Is this appropriately sized for a quick task (1-3 tasks)?
- must_haves derivation: Are must_haves traceable to the task description?

Skip: cross-plan deps (single plan), ROADMAP alignment
${DISCUSS_MODE ? '- Context compliance: Does the plan honor locked decisions from CONTEXT.md?' : '- Skip: context compliance (no CONTEXT.md)'}
</check_dimensions>

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
  description="Check quick plan: ${DESCRIPTION}"
)
```

**Trate o retorno do verificador:**

- **`## VERIFICATION PASSED`:** Exiba confirmação, prossiga para o passo 6.
- **`## ISSUES FOUND`:** Exiba os problemas, verifique a contagem de iterações, entre no loop de revisão.

**Loop de revisão (máx. 2 iterações):**

Rastreie `iteration_count` (começa em 1 após o plano inicial + verificação).

**Se iteration_count < 2:**

Exiba: `Enviando de volta ao planejador para revisão... (iteração ${N}/2)`

Prompt de revisão:

```markdown
<revision_context>
**Mode:** quick-full (revision)

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Existing plan)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Checker issues:** ${structured_issues_from_checker}

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
  description="Revise quick plan: ${DESCRIPTION}"
)
```

Após o retorno do planejador → spawne o verificador novamente, incremente iteration_count.

**Se iteration_count >= 2:**

Exiba: `Máximo de iterações atingido. ${N} problemas permanecem:` + lista de problemas

Ofereça: 1) Forçar prosseguimento, 2) Abortar

---

**Passo 6: Spawnar executor**

Spawne executor com referência ao plano:

```
Task(
  prompt="
Execute quick task ${quick_id}.

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan)
- .planning/STATE.md (Project state)
- ./CLAUDE.md (Project instructions, if exists)
- .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
</files_to_read>

${AGENT_SKILLS_EXECUTOR}

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary at: ${QUICK_DIR}/${quick_id}-SUMMARY.md
- Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
</constraints>
",
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  description="Execute: ${DESCRIPTION}"
)
```

Após o retorno do executor:
1. Verifique se o resumo existe em `${QUICK_DIR}/${quick_id}-SUMMARY.md`
2. Extraia o hash do commit da saída do executor
3. Reporte o status de conclusão

**Bug conhecido do Claude Code (classifyHandoffIfNeeded):** Se o executor reportar "failed" com erro `classifyHandoffIfNeeded is not defined`, este é um bug de runtime do Claude Code — não é uma falha real. Verifique se o arquivo de resumo existe e se o git log mostra commits. Se sim, trate como bem-sucedido.

Se o resumo não for encontrado, erro: "Executor falhou ao criar ${quick_id}-SUMMARY.md"

Nota: Para tarefas rápidas que produzem múltiplos planos (raro), spawne executores em ondas paralelas conforme os padrões de execute-phase.

---

**Passo 6.5: Verificação (apenas quando `$FULL_MODE`)**

Pule este passo completamente se NÃO for `$FULL_MODE`.

Exiba o banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 framework ► VERIFICANDO RESULTADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning verifier...
```

```
Task(
  prompt="Verify quick task goal achievement.
Task directory: ${QUICK_DIR}
Task goal: ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan)
</files_to_read>

${AGENT_SKILLS_VERIFIER}

Check must_haves against actual codebase. Create VERIFICATION.md at ${QUICK_DIR}/${quick_id}-VERIFICATION.md.",
  subagent_type="verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

Leia o status de verificação:
```bash
grep "^status:" "${QUICK_DIR}/${quick_id}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '
```

Armazene como `$VERIFICATION_STATUS`.

| Status | Ação |
|--------|------|
| `passed` | Armazene `$VERIFICATION_STATUS = "Verificado"`, continue para o passo 7 |
| `human_needed` | Exiba itens que precisam de verificação manual, armazene `$VERIFICATION_STATUS = "Precisa Revisão"`, continue |
| `gaps_found` | Exiba resumo de lacunas, ofereça: 1) Re-executar executor para corrigir lacunas, 2) Aceitar como está. Armazene `$VERIFICATION_STATUS = "Lacunas"` |

---

**Passo 7: Atualizar STATE.md**

Atualize o STATE.md com o registro de conclusão da tarefa rápida.

**7a. Verificar se a seção "Tarefas Rápidas Concluídas" existe:**

Leia o STATE.md e verifique a seção `### Tarefas Rápidas Concluídas`.

**7b. Se a seção não existir, crie-a:**

Insira após a seção `### Bloqueadores/Preocupações`:

**Se `$FULL_MODE`:**
```markdown
### Tarefas Rápidas Concluídas

| # | Descrição | Data | Commit | Status | Diretório |
|---|-----------|------|--------|--------|-----------|
```

**Se NÃO `$FULL_MODE`:**
```markdown
### Tarefas Rápidas Concluídas

| # | Descrição | Data | Commit | Diretório |
|---|-----------|------|--------|-----------|
```

**Nota:** Se a tabela já existir, combine com o formato de colunas existente. Se estiver adicionando `--full` a um projeto que já tem tarefas rápidas sem coluna de Status, adicione a coluna Status às linhas de cabeçalho e separador, e deixe o Status vazio para os predecessores da nova linha.

**7c. Adicionar nova linha à tabela:**

Use `date` do init:

**Se `$FULL_MODE` (ou a tabela tem coluna de Status):**
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | ${VERIFICATION_STATUS} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**Se NÃO `$FULL_MODE` (e a tabela não tem coluna de Status):**
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**7d. Atualizar linha "Última atividade":**

Use `date` do init:
```
Última atividade: ${date} - Tarefa rápida ${quick_id} concluída: ${DESCRIPTION}
```

Use a ferramenta Edit para fazer essas mudanças atomicamente

---

**Passo 8: Commit final e conclusão**

Stage e commit dos artefatos da tarefa rápida:

Construa a lista de arquivos:
- `${QUICK_DIR}/${quick_id}-PLAN.md`
- `${QUICK_DIR}/${quick_id}-SUMMARY.md`
- `.planning/STATE.md`
- Se `$DISCUSS_MODE` e o arquivo de contexto existir: `${QUICK_DIR}/${quick_id}-CONTEXT.md`
- Se `$RESEARCH_MODE` e o arquivo de pesquisa existir: `${QUICK_DIR}/${quick_id}-RESEARCH.md`
- Se `$FULL_MODE` e o arquivo de verificação existir: `${QUICK_DIR}/${quick_id}-VERIFICATION.md`

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(quick-${quick_id}): ${DESCRIPTION}" --files ${file_list}
```

Obtenha o hash final do commit:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

Exiba o resultado de conclusão:

**Se `$FULL_MODE`:**
```
---

framework > TAREFA RÁPIDA CONCLUÍDA (MODO COMPLETO)

Tarefa Rápida ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Pesquisa: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Resumo: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Verificação: ${QUICK_DIR}/${quick_id}-VERIFICATION.md (${VERIFICATION_STATUS})
Commit: ${commit_hash}

---

Pronto para próxima tarefa: /rapido ${WS}
```

**Se NÃO `$FULL_MODE`:**
```
---

framework > TAREFA RÁPIDA CONCLUÍDA

Tarefa Rápida ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Pesquisa: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Resumo: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Commit: ${commit_hash}

---

Pronto para próxima tarefa: /rapido ${WS}
```

</process>

<success_criteria>
- [ ] Validação do ROADMAP.md passa
- [ ] Usuário fornece descrição da tarefa
- [ ] Flags `--full`, `--discuss` e `--research` analisadas dos argumentos quando presentes
- [ ] Slug gerado (minúsculas, hífens, máx. 40 chars)
- [ ] ID rápido gerado (formato YYMMDD-xxx, precisão Base36 de 2s)
- [ ] Diretório criado em `.planning/quick/YYMMDD-xxx-slug/`
- [ ] (--discuss) Áreas cinzentas identificadas e apresentadas, decisões capturadas em `${quick_id}-CONTEXT.md`
- [ ] (--research) Agente de pesquisa spawado, `${quick_id}-RESEARCH.md` criado
- [ ] `${quick_id}-PLAN.md` criado pelo planejador (respeita decisões do CONTEXT.md quando --discuss, usa descobertas do RESEARCH.md quando --research)
- [ ] (--full) Verificador de plano valida o plano, loop de revisão limitado a 2
- [ ] `${quick_id}-SUMMARY.md` criado pelo executor
- [ ] (--full) `${quick_id}-VERIFICATION.md` criado pelo verificador
- [ ] STATE.md atualizado com linha de tarefa rápida (coluna de Status quando --full)
- [ ] Artefatos commitados
</success_criteria>
