<purpose>
Executar todos os planos de uma fase usando execução paralela em ondas. O orquestrador permanece enxuto — delega execução de planos para subagentes.
</purpose>

<core_principle>
O orquestrador coordena, não executa. Cada subagente carrega o contexto completo do execute-plan. Orquestrador: descobrir planos → analisar deps → agrupar em ondas → criar agentes → lidar com checkpoints → coletar resultados.
</core_principle>

<runtime_compatibility>
**Criação de subagentes é específica do runtime:**
- **Claude Code:** Usa `Task(subagent_type="executor", ...)` — bloqueia até concluir, retorna resultado
- **Copilot:** Criação de subagentes não retorna sinais de conclusão de forma confiável. **Padrão é execução sequencial inline**: ler e seguir execute-plan.md diretamente para cada plano em vez de criar agentes paralelos. Só tente paralelismo se o usuário solicitar explicitamente — e nesse caso, use o fallback de spot-check no passo 3 para detectar conclusão.
- **Outros runtimes:** Se a ferramenta `Task`/`task` não estiver disponível, use execução sequencial inline como fallback. Verifique disponibilidade da ferramenta em runtime em vez de assumir pelo nome do runtime.

**Regra de fallback:** Se um agente criado conclui seu trabalho (commits visíveis, SUMMARY.md existe) mas o orquestrador nunca recebe o sinal de conclusão, tratar como bem-sucedido com base em spot-checks e continuar para próxima onda/plano. Nunca bloquear indefinidamente aguardando sinal — sempre verificar via filesystem e estado do git.
</runtime_compatibility>

<required_reading>
Ler STATE.md antes de qualquer operação para carregar contexto do projeto.
</required_reading>

<available_agent_types>
Tipos de subagentes framework válidos registrados em .claude/agents/ (ou equivalente para seu runtime).
Sempre use o nome exato desta lista — não use 'general-purpose' ou outros tipos embutidos como fallback:

- executor — Executa tarefas do plano, commits, cria SUMMARY.md
- verifier — Verifica conclusão de fase, verifica quality gates
- planner — Cria planos detalhados a partir do escopo da fase
- phase-researcher — Pesquisa abordagens técnicas para uma fase
- plan-checker — Revisa qualidade do plano antes da execução
- debugger — Diagnostica e corrige problemas
- codebase-mapper — Mapeia estrutura do projeto e dependências
- integration-checker — Verifica integração entre fases
- nyquist-auditor — Valida cobertura de verificação
- ui-researcher — Pesquisa abordagens de UI/UX
- ui-checker — Revisa qualidade de implementação de UI
- ui-auditor — Audita UI em relação aos requisitos de design
</available_agent_types>

<process>

<step name="parse_args" priority="first">
Analisar `$ARGUMENTS` antes de carregar qualquer contexto:

- Primeiro token posicional → `PHASE_ARG`
- `--wave N` opcional → `WAVE_FILTER`
- `--gaps-only` opcional mantém seu significado atual

Se `--wave` estiver ausente, preservar o comportamento atual de executar todas as ondas incompletas na fase.
</step>

<step name="initialize" priority="first">
Carregar todo o contexto em uma chamada:

```bash
INIT=$(node "./.claude/framework/bin/tools.cjs" init execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(node "./.claude/framework/bin/tools.cjs" agent-skills executor 2>/dev/null)
```

Analisar JSON para: `executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`.

**Se `phase_found` for false:** Erro — diretório de fase não encontrado.
**Se `plan_count` for 0:** Erro — nenhum plano encontrado na fase.
**Se `state_exists` for false mas `.planning/` existir:** Oferecer reconstruir ou continuar.

Quando `parallelization` for false, planos dentro de uma onda executam sequencialmente.

**Detecção de runtime para Copilot:**
Verificar se o runtime atual é Copilot testando o padrão de agente `@executor`
ou ausência da API de subagente `Task()`. Se rodando no Copilot, forçar execução sequencial inline
independente da configuração `parallelization` — os sinais de conclusão de subagentes do Copilot
são não confiáveis (ver `<runtime_compatibility>`). Definir `COPILOT_SEQUENTIAL=true`
internamente e pular o passo `execute_waves` em favor do caminho inline do `check_interactive_mode`
para cada plano.

**OBRIGATÓRIO — Sincronizar flag de cadeia com intenção.** Se o usuário invocou manualmente (sem `--auto`), limpar a flag de cadeia efêmera de qualquer cadeia `--auto` anterior interrompida. Isso impede que `_auto_chain_active: true` obsoleto cause avanço automático indesejado. Isso NÃO toca em `workflow.auto_advance` (preferência persistente do usuário). Você DEVE executar este bloco bash antes de qualquer leitura de config:
```bash
# OBRIGATÓRIO: impede auto-cadeia obsoleta de execuções --auto anteriores
if [[ ! "$ARGUMENTS" =~ --auto ]]; then
  node "./.claude/framework/bin/tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
fi
```
</step>

<step name="check_interactive_mode">
**Analisar flag `--interactive` de $ARGUMENTS.**

**Se flag `--interactive` presente:** Alternar para modo de execução interativo.

Modo interativo executa planos sequencialmente **inline** (sem criação de subagentes) com
checkpoints do usuário entre tarefas. O usuário pode revisar, modificar ou redirecionar o trabalho a qualquer momento.

**Fluxo de execução interativo:**

1. Carregar inventário de planos normalmente (discover_and_group_plans)
2. Para cada plano (sequencialmente, ignorando agrupamento de ondas):

   a. **Apresentar o plano ao usuário:**
      ```
      ## Plano {plan_id}: {plan_name}

      Objetivo: {do arquivo do plano}
      Tarefas: {task_count}

      Opções:
      - Executar (prosseguir com todas as tarefas)
      - Revisar primeiro (mostrar detalhamento de tarefas antes de começar)
      - Pular (ir para próximo plano)
      - Parar (encerrar execução, salvar progresso)
      ```

   b. **Se "Revisar primeiro":** Ler e exibir o arquivo do plano completo. Perguntar novamente: Executar, Modificar, Pular.

   c. **Se "Executar":** Ler e seguir `./.claude/framework/workflows/execute-plan.md` **inline**
      (NÃO criar subagente). Executar tarefas uma por vez.

   d. **Após cada tarefa:** Pausar brevemente. Se o usuário intervir (digitar qualquer coisa), parar e resolver
      o feedback antes de continuar. Caso contrário, prosseguir para próxima tarefa.

   e. **Após plano concluído:** Mostrar resultados, commitar, criar SUMMARY.md, então apresentar próximo plano.

3. Após todos os planos: prosseguir para verificação (mesmo que modo normal).

**Benefícios do modo interativo:**
- Sem overhead de subagente — uso de tokens dramaticamente menor
- Usuário detecta erros cedo — economiza ciclos de verificação custosos
- Mantém estrutura de planejamento/rastreamento do framework
- Melhor para: fases pequenas, correções de bugs, lacunas de verificação, aprendendo framework

**Pular para passo handle_branching** (planos interativos executam inline após agrupamento).
</step>

<step name="handle_branching">
Verificar `branching_strategy` do init:

**"none":** Pular, continuar no branch atual.

**"phase" ou "milestone":** Usar `branch_name` pré-computado do init:
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```

Todos os commits subsequentes vão para este branch. Usuário gerencia o merge.
</step>

<step name="validate_phase">
Do JSON do init: `phase_dir`, `plan_count`, `incomplete_count`.

Reportar: "Encontrados {plan_count} planos em {phase_dir} ({incomplete_count} incompletos)"

**Atualizar STATE.md para início de fase:**
```bash
node "./.claude/framework/bin/tools.cjs" state begin-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```
Isso atualiza Status, Última Atividade, Foco Atual, Posição Atual e contagens de planos no STATE.md para que o frontmatter e o texto do corpo reflitam a fase ativa imediatamente.
</step>

<step name="discover_and_group_plans">
Carregar inventário de planos com agrupamento de ondas em uma chamada:

```bash
PLAN_INDEX=$(node "./.claude/framework/bin/tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

Analisar JSON para: `phase`, `plans[]` (cada um com `id`, `wave`, `autonomous`, `objective`, `files_modified`, `task_count`, `has_summary`), `waves` (mapa de número de onda → IDs de plano), `incomplete`, `has_checkpoints`.

**Filtragem:** Pular planos onde `has_summary: true`. Se `--gaps-only`: também pular planos não gap_closure. Se `WAVE_FILTER` definido: também pular planos cujo `wave` não seja igual a `WAVE_FILTER`.

**Verificação de segurança de onda:** Se `WAVE_FILTER` estiver definido e ainda houver planos incompletos em qualquer onda anterior que correspondam ao modo de execução atual, PARAR e dizer ao usuário para terminar as ondas anteriores primeiro. Não deixar Onda 2+ executar enquanto planos de ondas prerequisito anteriores permanecerem incompletos.

Se todos filtrados: "Nenhum plano incompleto correspondente" → sair.

Reportar:
```
## Plano de Execução

**Fase {X}: {Nome}** — {total_plans} planos correspondentes em {wave_count} onda(s)

{Se WAVE_FILTER definido: `Filtro de onda ativo: executando apenas Onda {WAVE_FILTER}`.}

| Onda | Planos | O que constrói |
|------|--------|----------------|
| 1 | 01-01, 01-02 | {dos objetivos dos planos, 3-8 palavras} |
| 2 | 01-03 | ... |
```
</step>

<step name="execute_waves">
Executar cada onda selecionada em sequência. Dentro de uma onda: paralelo se `PARALLELIZATION=true`, sequencial se `false`.

**Para cada onda:**

1. **Descrever o que está sendo construído (ANTES de criar agentes):**

   Ler o `<objective>` de cada plano. Extrair o que está sendo construído e por quê.

   ```
   ---
   ## Onda {N}

   **{ID do Plano}: {Nome do Plano}**
   {2-3 frases: o que constrói, abordagem técnica, por que importa}

   Criando {count} agente(s)...
   ---
   ```

   - Ruim: "Executando plano de geração de terreno"
   - Bom: "Gerador de terreno procedural usando ruído Perlin — cria mapas de altura, zonas de bioma e malhas de colisão. Necessário antes que a física de veículos possa interagir com o solo."

2. **Criar agentes executores:**

   Passar apenas caminhos — executores leem arquivos com seu contexto fresco.
   Para modelos 200k, isso mantém o contexto do orquestrador enxuto (~10-15%).
   Para modelos 1M+ (Opus 4.6, Sonnet 4.6), contexto mais rico pode ser passado diretamente.

   ```
   Task(
     subagent_type="executor",
     model="{executor_model}",
     isolation="worktree",
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
       </objective>

       <parallel_execution>
       You are running as a PARALLEL executor agent. Use --no-verify on all git
       commits to avoid pre-commit hook contention with other agents. The
       orchestrator validates hooks once after all agents complete.
       For tools commits: add --no-verify flag.
       For direct git commits: use git commit --no-verify -m "..."
       </parallel_execution>

       <execution_context>
       @./.claude/framework/workflows/execute-plan.md
       @./.claude/framework/templates/summary.md
       @./.claude/framework/references/checkpoints.md
       @./.claude/framework/references/tdd.md
       </execution_context>

       <files_to_read>
       Read these files at execution start using the Read tool:
       - {phase_dir}/{plan_file} (Plan)
       - .planning/PROJECT.md (Project context — core value, requirements, evolution rules)
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       - ./CLAUDE.md (Project instructions, if exists — follow project-specific guidelines and coding conventions)
       - .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
       </files_to_read>

       ${AGENT_SKILLS}

       <mcp_tools>
       If CLAUDE.md or project instructions reference MCP tools (e.g. jCodeMunch, context7,
       or other MCP servers), prefer those tools over Grep/Glob for code navigation when available.
       MCP tools often save significant tokens by providing structured code indexes.
       Check tool availability first — if MCP tools are not accessible, fall back to Grep/Glob.
       </mcp_tools>

       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] SUMMARY.md created in plan directory
       - [ ] STATE.md updated with position and decisions
       - [ ] ROADMAP.md updated with plan progress (via `roadmap update-plan-progress`)
       </success_criteria>
     "
   )
   ```

3. **Aguardar todos os agentes da onda concluírem.**

   **Fallback de sinal de conclusão (Copilot e runtimes onde Task() pode não retornar):**

   Se um agente criado não retornar sinal de conclusão mas parecer ter terminado
   seu trabalho, NÃO bloquear indefinidamente. Em vez disso, verificar conclusão via spot-checks:

   ```bash
   # Para cada plano nesta onda, verificar se o executor terminou:
   SUMMARY_EXISTS=$(test -f "{phase_dir}/{plan_number}-{plan_padded}-SUMMARY.md" && echo "true" || echo "false")
   COMMITS_FOUND=$(git log --oneline --all --grep="{phase_number}-{plan_padded}" --since="1 hour ago" | head -1)
   ```

   **Se SUMMARY.md existir E commits forem encontrados:** O agente concluiu com sucesso —
   tratar como concluído e prosseguir para passo 4. Logar: `"✓ {Plan ID} concluído (verificado via spot-check — sinal de conclusão não recebido)"`

   **Se SUMMARY.md NÃO existir após espera razoável:** O agente pode ainda estar
   rodando ou pode ter falhado silenciosamente. Verificar `git log --oneline -5` por
   atividade recente. Se commits ainda aparecerem, aguardar mais. Se sem atividade, reportar
   o plano como falhado e encaminhar para o manipulador de falhas no passo 5.

   **Este fallback se aplica automaticamente a todos os runtimes.** Task() do Claude Code normalmente
   retorna de forma síncrona, mas o fallback garante resiliência se não retornar.

4. **Validação de hook pós-onda (somente modo paralelo):**

   Quando agentes commitaram com `--no-verify`, executar hooks pre-commit uma vez após a onda:
   ```bash
   # Executar hooks pre-commit do projeto no estado atual
   git diff --cached --quiet || git stash  # fazer stash de mudanças não staged
   git hook run pre-commit 2>&1 || echo "⚠ Hooks pre-commit falharam — revisar antes de continuar"
   ```
   Se hooks falharem: reportar a falha e perguntar "Corrigir problemas de hook agora?" ou "Continuar para próxima onda?"

5. **Reportar conclusão — verificar claims via spot-check primeiro:**

   Para cada SUMMARY.md:
   - Verificar se os primeiros 2 arquivos de `key-files.created` existem no disco
   - Verificar se `git log --oneline --all --grep="{phase}-{plan}"` retorna ≥1 commit
   - Verificar marcador `## Self-Check: FAILED`

   Se QUALQUER spot-check falhar: reportar qual plano falhou, encaminhar para manipulador de falhas — perguntar "Tentar plano novamente?" ou "Continuar com ondas restantes?"

   Se passar:
   ```
   ---
   ## Onda {N} Concluída

   **{ID do Plano}: {Nome do Plano}**
   {O que foi construído — do SUMMARY.md}
   {Desvios notáveis, se houver}

   {Se mais ondas: o que isso habilita para a próxima onda}
   ---
   ```

   - Ruim: "Onda 2 concluída. Prosseguindo para Onda 3."
   - Bom: "Sistema de terreno concluído — 3 tipos de bioma, texturização baseada em altura, malhas de colisão de física. Física de veículos (Onda 3) agora pode referenciar superfícies do solo."

5. **Tratar falhas:**

   **Bug conhecido do Claude Code (classifyHandoffIfNeeded):** Se um agente reportar "falhado" com erro contendo `classifyHandoffIfNeeded is not defined`, este é um bug de runtime do Claude Code — não um problema do framework ou do agente. O erro dispara no manipulador de conclusão APÓS todas as chamadas de ferramenta terminarem. Neste caso: executar os mesmos spot-checks do passo 4 (SUMMARY.md existe, commits presentes, sem Self-Check: FAILED). Se spot-checks PASSAREM → tratar como **bem-sucedido**. Se spot-checks FALHAREM → tratar como falha real abaixo.

   Para falhas reais: reportar qual plano falhou → perguntar "Continuar?" ou "Parar?" → se continuar, planos dependentes podem também falhar. Se parar, relatório de conclusão parcial.

5b. **Verificação de dependência pré-onda (ondas 2+ apenas):**

    Antes de criar onda N+1, para cada plano na onda seguinte:
    ```bash
    node "./.claude/framework/bin/tools.cjs" verify key-links {phase_dir}/{plan}-PLAN.md
    ```

    Se qualquer key-link de artefato de onda ANTERIOR falhar na verificação:

    ## Lacuna de Conexão Entre Planos

    | Plano | Link | De | Padrão Esperado | Status |
    |-------|------|----|-----------------|--------|
    | {plan} | {via} | {from} | {pattern} | NÃO ENCONTRADO |

    Artefatos da Onda {N} podem não estar corretamente conectados. Opções:
    1. Investigar e corrigir antes de continuar
    2. Continuar (pode causar falhas em cascata na onda {N+1})

    Key-links referenciando arquivos na onda ATUAL (próxima) são ignorados.

6. **Executar planos de checkpoint entre ondas** — ver `<checkpoint_handling>`.

7. **Prosseguir para próxima onda.**
</step>

<step name="checkpoint_handling">
Planos com `autonomous: false` requerem interação do usuário.

**Tratamento de checkpoint em modo automático:**

Ler config de avanço automático (flag de cadeia + preferência do usuário):
```bash
AUTO_CHAIN=$(node "./.claude/framework/bin/tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
AUTO_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

Quando o executor retorna um checkpoint E (`AUTO_CHAIN` é `"true"` OU `AUTO_CFG` é `"true"`):
- **human-verify** → Criar agente de continuação automaticamente com `{user_response}` = `"approved"`. Logar `⚡ Checkpoint aprovado automaticamente`.
- **decision** → Criar agente de continuação automaticamente com `{user_response}` = primeira opção dos detalhes do checkpoint. Logar `⚡ Selecionado automaticamente: [opção]`.
- **human-action** → Apresentar ao usuário (comportamento existente abaixo). Gates de autenticação não podem ser automatizados.

**Fluxo padrão (não modo automático, ou tipo human-action):**

1. Criar agente para plano de checkpoint
2. Agente roda até tarefa de checkpoint ou gate de autenticação → retorna estado estruturado
3. Retorno do agente inclui: tabela de tarefas concluídas, tarefa atual + bloqueador, tipo/detalhes do checkpoint, o que está aguardando
4. **Apresentar ao usuário:**
   ```
   ## Checkpoint: [Tipo]

   **Plano:** 03-03 Layout do Dashboard
   **Progresso:** 2/3 tarefas concluídas

   [Detalhes do Checkpoint do retorno do agente]
   [Seção Aguardando do retorno do agente]
   ```
5. Usuário responde: "approved"/"done" | descrição de problema | seleção de decisão
6. **Criar agente de continuação (NÃO retomar)** usando template continuation-prompt.md:
   - `{completed_tasks_table}`: Do retorno do checkpoint
   - `{resume_task_number}` + `{resume_task_name}`: Tarefa atual
   - `{user_response}`: O que o usuário forneceu
   - `{resume_instructions}`: Baseado no tipo de checkpoint
7. Agente de continuação verifica commits anteriores, continua do ponto de retomada
8. Repetir até plano concluir ou usuário parar

**Por que agente fresco, não retomada:** Retomada depende de serialização interna que quebra com chamadas de ferramenta paralelas. Agentes frescos com estado explícito são mais confiáveis.

**Checkpoints em ondas paralelas:** Agente pausa e retorna enquanto outros agentes paralelos podem concluir. Apresentar checkpoint, criar continuação, aguardar todos antes da próxima onda.
</step>

<step name="aggregate_results">
Após todas as ondas:

```markdown
## Fase {X}: {Nome} — Execução Concluída

**Ondas:** {N} | **Planos:** {M}/{total} concluídos

| Onda | Planos | Status |
|------|--------|--------|
| 1 | plan-01, plan-02 | ✓ Concluído |
| CP | plan-03 | ✓ Verificado |
| 2 | plan-04 | ✓ Concluído |

### Detalhes dos Planos
1. **03-01**: [one-liner do SUMMARY.md]
2. **03-02**: [one-liner do SUMMARY.md]

### Problemas Encontrados
[Agregar dos SUMMARYs, ou "Nenhum"]
```
</step>

<step name="handle_partial_wave_execution">
Se `WAVE_FILTER` foi usado, re-executar descoberta de planos após execução:

```bash
POST_PLAN_INDEX=$(node "./.claude/framework/bin/tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

Aplicar as mesmas regras de filtragem "incompleto" de antes:
- ignorar planos com `has_summary: true`
- se `--gaps-only`, considerar apenas planos `gap_closure: true`

**Se planos incompletos ainda restarem em qualquer lugar da fase:**
- PARAR aqui
- NÃO executar verificação de fase
- NÃO marcar fase como completa no ROADMAP/STATE
- Apresentar:

```markdown
## Onda {WAVE_FILTER} Concluída

Onda selecionada terminou com sucesso. Esta fase ainda tem planos incompletos, portanto verificação em nível de fase e conclusão foram intencionalmente puladas.

/executar-fase {phase} ${WS}                # Continuar ondas restantes
/executar-fase {phase} --wave {next} ${WS}  # Executar a próxima onda explicitamente
```

**Se nenhum plano incompleto restar após a onda selecionada terminar:**
- continuar com o fluxo normal de verificação e conclusão em nível de fase abaixo
- isso significa que a onda selecionada foi o último trabalho restante na fase
</step>

<step name="close_parent_artifacts">
**Somente para fases decimais/polish (padrão X.Y):** Fechar o ciclo de feedback resolvendo artefatos UAT e debug do pai.

**Pular se** o número da fase não tiver decimal (ex: `3`, `04`) — aplica-se apenas a fases de gap-closure como `4.1`, `03.1`.

**1. Detectar fase decimal e derivar pai:**
```bash
# Verificar se phase_number contém um decimal
if [[ "$PHASE_NUMBER" == *.* ]]; then
  PARENT_PHASE="${PHASE_NUMBER%%.*}"
fi
```

**2. Encontrar arquivo UAT do pai:**
```bash
PARENT_INFO=$(node "./.claude/framework/bin/tools.cjs" find-phase "${PARENT_PHASE}" --raw)
# Extrair diretório do JSON PARENT_INFO, então encontrar arquivo UAT nesse diretório
```

**Se nenhum UAT pai encontrado:** Pular este passo (gap-closure pode ter sido acionado por VERIFICATION.md em vez disso).

**3. Atualizar status de lacunas do UAT:**

Ler seção `## Gaps` do arquivo UAT pai. Para cada entrada de lacuna com `status: failed`:
- Atualizar para `status: resolved`

**4. Atualizar frontmatter do UAT:**

Se todas as lacunas agora tiverem `status: resolved`:
- Atualizar frontmatter `status: diagnosed` → `status: resolved`
- Atualizar timestamp `updated:` do frontmatter

**5. Resolver sessões de debug referenciadas:**

Para cada lacuna que tiver campo `debug_session:`:
- Ler o arquivo de sessão de debug
- Atualizar frontmatter `status:` → `resolved`
- Atualizar timestamp `updated:` do frontmatter
- Mover para diretório resolvido:
```bash
mkdir -p .planning/debug/resolved
mv .planning/debug/{slug}.md .planning/debug/resolved/
```

**6. Commitar artefatos atualizados:**
```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" --files .planning/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
```
</step>

<step name="regression_gate">
Executar suítes de teste de fases anteriores para detectar regressões entre fases ANTES da verificação.

**Pular se:** Esta é a primeira fase (sem fases anteriores), ou nenhum arquivo VERIFICATION.md anterior existe.

**Passo 1: Descobrir arquivos de teste de fases anteriores**
```bash
# Encontrar todos os arquivos VERIFICATION.md de fases anteriores no milestone atual
PRIOR_VERIFICATIONS=$(find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*" 2>/dev/null)
```

**Passo 2: Extrair listas de arquivos de teste de verificações anteriores**

Para cada VERIFICATION.md encontrado, procurar referências de arquivos de teste:
- Linhas contendo caminhos `test`, `spec` ou `__tests__`
- Seção "Test Suite" ou "Automated Checks"
- Padrões de arquivos de `key-files.created` em arquivos SUMMARY.md correspondentes que correspondam a `*.test.*` ou `*.spec.*`

Coletar todos os caminhos únicos de arquivos de teste em `REGRESSION_FILES`.

**Passo 3: Executar testes de regressão (se encontrados)**

```bash
# Detectar runner de testes e executar testes de fase anterior
if [ -f "package.json" ]; then
  # Node.js — usar runner de testes do projeto
  npx jest ${REGRESSION_FILES} --passWithNoTests --no-coverage -q 2>&1 || npx vitest run ${REGRESSION_FILES} 2>&1
elif [ -f "Cargo.toml" ]; then
  cargo test 2>&1
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  python -m pytest ${REGRESSION_FILES} -q --tb=short 2>&1
fi
```

**Passo 4: Reportar resultados**

Se todos os testes passarem:
```
✓ Gate de regressão: {N} arquivos de teste de fase anterior passaram — nenhuma regressão detectada
```
→ Prosseguir para verify_phase_goal

Se algum teste falhar:
```
## ⚠ Regressão Entre Fases Detectada

A execução da Fase {X} pode ter quebrado funcionalidade de fases anteriores.

| Arquivo de Teste | Fase | Status | Detalhe |
|------------------|------|--------|---------|
| {file} | {origin_phase} | FALHOU | {first_failure_line} |

Opções:
1. Corrigir regressões antes da verificação (recomendado)
2. Continuar para verificação mesmo assim (regressões vão se acumular)
3. Abortar fase — reverter e replanejar
```

Usar AskUserQuestion para apresentar as opções.
</step>

<step name="verify_phase_goal">
Verificar se a fase atingiu seu OBJETIVO, não apenas se as tarefas foram concluídas.

```bash
VERIFIER_SKILLS=$(node "./.claude/framework/bin/tools.cjs" agent-skills verifier 2>/dev/null)
```

```
Task(
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.
Create VERIFICATION.md.
${VERIFIER_SKILLS}",
  subagent_type="verifier",
  model="{verifier_model}"
)
```

Ler status:
```bash
grep "^status:" "$PHASE_DIR"/*-VERIFICATION.md | cut -d: -f2 | tr -d ' '
```

| Status | Ação |
|--------|------|
| `passed` | → update_roadmap |
| `human_needed` | Apresentar itens para teste humano, obter aprovação ou feedback |
| `gaps_found` | Apresentar resumo de lacunas, oferecer `/planejar-fase {phase} --gaps ${WS}` |

**Se human_needed:**

**Passo A: Persistir itens de verificação humana como arquivo UAT.**

Criar `{phase_dir}/{phase_num}-HUMAN-UAT.md` usando formato de template UAT:

```markdown
---
status: partial
phase: {phase_num}-{phase_name}
source: [{phase_num}-VERIFICATION.md]
started: [agora ISO]
updated: [agora ISO]
---

## Teste Atual

[aguardando teste humano]

## Testes

{Para cada item human_verification do VERIFICATION.md:}

### {N}. {descrição do item}
expected: {comportamento esperado do VERIFICATION.md}
result: [pendente]

## Resumo

total: {count}
passed: 0
issues: 0
pending: {count}
skipped: 0
blocked: 0

## Lacunas
```

Commitar o arquivo:
```bash
node "./.claude/framework/bin/tools.cjs" commit "test({phase_num}): persist human verification items as UAT" --files "{phase_dir}/{phase_num}-HUMAN-UAT.md"
```

**Passo B: Apresentar ao usuário:**

```
## ✓ Fase {X}: {Nome} — Verificação Humana Necessária

Todas as verificações automatizadas passaram. {N} itens precisam de teste humano:

{Da seção human_verification do VERIFICATION.md}

Itens salvos em `{phase_num}-HUMAN-UAT.md` — aparecerão em `/progresso` e `/auditar-uat`.

"approved" → continuar | Reportar problemas → gap closure
```

**Se o usuário disser "approved":** Prosseguir para `update_roadmap`. O arquivo HUMAN-UAT.md persiste com `status: partial` e aparecerá em verificações futuras de progresso até o usuário executar `/verificar-trabalho` nele.

**Se o usuário reportar problemas:** Prosseguir para gap closure como implementado atualmente.

**Se gaps_found:**
```
## ⚠ Fase {X}: {Nome} — Lacunas Encontradas

**Pontuação:** {N}/{M} must-haves verificados
**Relatório:** {phase_dir}/{phase_num}-VERIFICATION.md

### O Que Está Faltando
{Resumos de lacunas do VERIFICATION.md}

---
## ▶ Próximo Passo

`/planejar-fase {X} --gaps ${WS}`

<sub>`/clear` primeiro → janela de contexto fresca</sub>

Também: `cat {phase_dir}/{phase_num}-VERIFICATION.md` — relatório completo
Também: `/verificar-trabalho {X} ${WS}` — teste manual primeiro
```

Ciclo de gap closure: `/planejar-fase {X} --gaps ${WS}` lê VERIFICATION.md → cria planos de lacuna com `gap_closure: true` → usuário executa `/executar-fase {X} --gaps-only ${WS}` → verificador re-executa.
</step>

<step name="update_roadmap">
**Marcar fase como completa e atualizar todos os arquivos de rastreamento:**

```bash
COMPLETION=$(node "./.claude/framework/bin/tools.cjs" phase complete "${PHASE_NUMBER}")
```

O CLI gerencia:
- Marcar checkbox de fase `[x]` com data de conclusão
- Atualizar tabela de Progresso (Status → Completo, data)
- Atualizar contagem de planos para final
- Avançar STATE.md para próxima fase
- Atualizar rastreabilidade do REQUIREMENTS.md
- Escanear por dívida de verificação (retorna array `warnings`)

Extrair do resultado: `next_phase`, `next_phase_name`, `is_last_phase`, `warnings`, `has_warnings`.

**Se has_warnings for true:**
```
## Fase {X} marcada como completa com {N} avisos:

{listar cada aviso}

Estes itens são rastreados e aparecerão em `/progresso` e `/auditar-uat`.
```

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="update_project_md">
**Evoluir PROJECT.md para refletir conclusão de fase (evita drift de documento de planejamento — #956):**

PROJECT.md rastreia requisitos validados, decisões e estado atual. Sem este passo,
PROJECT.md fica para trás silenciosamente ao longo de múltiplas fases.

1. Ler `.planning/PROJECT.md`
2. Se o arquivo existir e tiver seção `## Requisitos Validados` ou `## Requisitos`:
   - Mover requisitos validados por esta fase de Ativos → Validados
   - Adicionar nota breve: `Validado na Fase {X}: {Nome}`
3. Se o arquivo tiver seção `## Estado Atual` ou similar:
   - Atualizá-la para refletir conclusão desta fase (ex: "Fase {X} completa — {one-liner}")
4. Atualizar o rodapé `Última atualização:` para a data de hoje
5. Commitar a mudança:

```bash
node "./.claude/framework/bin/tools.cjs" commit "docs(phase-{X}): evolve PROJECT.md after phase completion" --files .planning/PROJECT.md
```

**Pular este passo se** `.planning/PROJECT.md` não existir.
</step>

<step name="offer_next">

**Exceção:** Se `gaps_found`, o passo `verify_phase_goal` já apresenta o caminho de gap-closure (`/planejar-fase {X} --gaps`). Nenhum roteamento adicional necessário — pular avanço automático.

**Verificação sem transição (criado por cadeia de avanço automático):**

Analisar flag `--no-transition` de $ARGUMENTS.

**Se flag `--no-transition` presente:**

Execute-phase foi criado por avanço automático do plan-phase. NÃO executar transition.md.
Após verificação passar e roadmap ser atualizado, retornar status de conclusão ao pai:

```
## FASE CONCLUÍDA

Fase: ${PHASE_NUMBER} - ${PHASE_NAME}
Planos: ${completed_count}/${total_count}
Verificação: {Passou | Lacunas Encontradas}

[Incluir saída de aggregate_results]
```

PARAR. Não prosseguir para avanço automático ou transição.

**Se flag `--no-transition` NÃO estiver presente:**

**Detecção de avanço automático:**

1. Analisar flag `--auto` de $ARGUMENTS
2. Ler tanto a flag de cadeia quanto a preferência do usuário (flag de cadeia já sincronizada no passo init):
   ```bash
   AUTO_CHAIN=$(node "./.claude/framework/bin/tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**Se flag `--auto` presente OU `AUTO_CHAIN` for true OU `AUTO_CFG` for true (E verificação passou sem lacunas):**

```
╔══════════════════════════════════════════╗
║  AVANÇANDO AUTOMATICAMENTE → TRANSIÇÃO   ║
║  Fase {X} verificada, continuando cadeia ║
╚══════════════════════════════════════════╝
```

Executar o workflow de transição inline (NÃO usar Task — contexto do orquestrador está ~10-15%, transição precisa de dados de conclusão de fase já no contexto):

Ler e seguir `./.claude/framework/workflows/transition.md`, propagando a flag `--auto` para que ela se propague para a invocação da próxima fase.

**Se nenhum de `--auto`, `AUTO_CHAIN` ou `AUTO_CFG` for true:**

**PARAR. Não avançar automaticamente. Não executar transição. Não planejar próxima fase. Apresentar opções ao usuário e aguardar.**

**IMPORTANTE: NÃO existe comando `/transition`. Nunca sugeri-lo. O workflow de transição é interno apenas.**

```
## ✓ Fase {X}: {Nome} Concluída

/progresso ${WS} — ver roadmap atualizado
/discutir-fase {next} ${WS} — discutir próxima fase antes de planejar
/planejar-fase {next} ${WS} — planejar próxima fase
/executar-fase {next} ${WS} — executar próxima fase
```

Sugira apenas os comandos listados acima. Não invente ou alucine nomes de comandos.
</step>

</process>

<context_efficiency>
Orquestrador: ~10-15% do contexto para janelas 200k, pode usar mais para janelas 1M+.
Subagentes: contexto fresco por agente (200k-1M dependendo do modelo). Sem polling (Task bloqueia). Sem vazamento de contexto.

Para modelos de contexto 1M+, considerar:
- Passar contexto mais rico (snippets de código, saídas de dependências) diretamente para executores em vez de apenas caminhos de arquivo
- Executar fases pequenas (≤3 planos, sem dependências) inline sem overhead de criação de subagente
- Relaxar recomendações de /clear — início de degradação de contexto é muito mais distante com janela 5x
</context_efficiency>

<failure_handling>
- **Falha falsa classifyHandoffIfNeeded:** Agente reporta "falhado" mas erro é `classifyHandoffIfNeeded is not defined` → Bug do Claude Code, não framework. Spot-check (SUMMARY existe, commits presentes) → se passou, tratar como sucesso
- **Agente falha no meio do plano:** SUMMARY.md ausente → reportar, perguntar ao usuário como prosseguir
- **Cadeia de dependências quebra:** Onda 1 falha → Dependentes da Onda 2 provavelmente falham → usuário escolhe tentar ou pular
- **Todos os agentes na onda falham:** Problema sistêmico → parar, reportar para investigação
- **Checkpoint não resolvível:** "Pular este plano?" ou "Abortar execução da fase?" → registrar progresso parcial no STATE.md
</failure_handling>

<resumption>
Re-executar `/executar-fase {phase}` → discover_plans encontra SUMMARYs concluídos → os pula → retoma do primeiro plano incompleto → continua execução de ondas.

STATE.md rastreia: último plano concluído, onda atual, checkpoints pendentes.
</resumption>
