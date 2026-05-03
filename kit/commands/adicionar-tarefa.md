---
name: adicionar-tarefa
description: Captura ideia ou tarefa como todo a partir do contexto da conversa atual
argument-hint: [descrição opcional]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Captura uma ideia, tarefa ou problema que surge durante uma sessão framework como um todo estruturado para trabalho posterior.

Encaminha para o workflow add-todo que cuida de:
- Criação da estrutura de diretórios
- Extração de conteúdo dos argumentos ou da conversa
- Inferência de área a partir dos caminhos de arquivo
- Detecção e resolução de duplicatas
- Criação do arquivo de todo com frontmatter
- Atualizações do STATE.md
- Commits Git
</objective>

<execution_context>
@./.claude/framework/workflows/add-todo.md
</execution_context>

<context>
Argumentos: $ARGUMENTS (descrição opcional do todo)

Estado é resolvido no workflow via `init todos` e leituras específicas.
</context>

<process>
**Seguir o workflow add-todo** de `@./.claude/framework/workflows/add-todo.md`.

O workflow cuida de toda a lógica, incluindo:
1. Garantia de diretórios
2. Verificação de áreas existentes
3. Extração de conteúdo (argumentos ou conversa)
4. Inferência de área
5. Verificação de duplicatas
6. Criação de arquivo com geração de slug
7. Atualizações do STATE.md
8. Commits Git
</process>