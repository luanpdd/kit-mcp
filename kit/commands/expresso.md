---
name: expresso
description: Executa uma tarefa rápida com garantias framework (commits atômicos, rastreamento de estado) mas pula agentes opcionais
argument-hint: "[--full] [--discuss] [--research]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Executar tarefas pequenas e ad-hoc com garantias framework (commits atômicos, rastreamento no STATE.md).

Modo expresso é o mesmo sistema com um caminho mais curto:
- Invoca planner (modo rápido) + executor(s)
- Tarefas expressas ficam em `.planning/quick/` separado das fases planejadas
- Atualiza tabela "Quick Tasks Completed" do STATE.md (NÃO ROADMAP.md)

**Padrão:** Pula pesquisa, discussão, plan-checker, verificador. Use quando você sabe exatamente o que fazer.

**Flag `--discuss`:** Fase de discussão leve antes do planejamento. Apresenta hipóteses, esclarece áreas cinzentas, captura decisões em CONTEXT.md. Use quando a tarefa tem ambiguidade que vale a pena resolver antecipadamente.

**Flag `--full`:** Habilita verificação de plano (máximo 2 iterações) e verificação pós-execução. Use quando você quer garantias de qualidade sem a cerimônia completa de milestone.

**Flag `--research`:** Invoca um agente de pesquisa focado antes do planejamento. Investiga abordagens de implementação, opções de biblioteca e armadilhas para a tarefa. Use quando não tem certeza da melhor abordagem.

Flags são combináveis: `--discuss --research --full` dá discussão + pesquisa + verificação de plano + verificação.
</objective>

<execution_context>
@./.claude/framework/workflows/quick.md
</execution_context>

<context>
$ARGUMENTS

Arquivos de contexto são resolvidos dentro do workflow (`init quick`) e delegados via blocos `<files_to_read>`.
</context>

<process>
Execute o workflow quick de @./.claude/framework/workflows/quick.md do início ao fim.
Preserve todos os checkpoints do workflow (validação, descrição de tarefa, planejamento, execução, atualizações de estado, commits).
</process>
