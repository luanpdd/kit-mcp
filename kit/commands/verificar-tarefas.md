---
name: verificar-tarefas
description: Lista todos os todos pendentes e seleciona um para trabalhar
argument-hint: [filtro de área]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Lista todos os todos pendentes, permite seleção, carrega o contexto completo do todo selecionado e encaminha para a ação adequada.

Encaminha para o workflow check-todos que cuida de:
- Contagem e listagem de todos com filtro por área
- Seleção interativa com carregamento completo de contexto
- Checagem de correlação com roadmap
- Roteamento de ação (trabalhar agora, adicionar à fase, brainstorm, criar fase)
- Atualizações do STATE.md e commits git
</objective>

<execution_context>
@./.claude/framework/workflows/check-todos.md
</execution_context>

<context>
Argumentos: $ARGUMENTS (filtro de área opcional)

Estado dos todos e correlação com roadmap são carregados no workflow usando `init todos` e leituras específicas.
</context>

<process>
**Seguir o workflow check-todos** de `@./.claude/framework/workflows/check-todos.md`.

O workflow cuida de toda a lógica, incluindo:
1. Verificação de existência de todos
2. Filtro por área
3. Listagem e seleção interativa
4. Carregamento completo de contexto com resumos de arquivo
5. Checagem de correlação com roadmap
6. Oferta e execução de ação
7. Atualizações do STATE.md
8. Commits git
</process>