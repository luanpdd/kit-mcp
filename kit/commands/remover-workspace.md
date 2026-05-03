---
name: remover-workspace
description: Remove um workspace framework e limpa as worktrees
argument-hint: "<nome-do-workspace>"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<context>
**Argumentos:**
- `<nome-do-workspace>` (obrigatório) — Nome do workspace a remover
</context>

<objective>
Remove um diretório de workspace após confirmação. Para estratégia de worktree, executa `git worktree remove` para cada repositório membro primeiro. Recusa se algum repositório tiver alterações não commitadas.
</objective>

<execution_context>
@./.claude/framework/workflows/remove-workspace.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<process>
Execute o workflow remove-workspace de @./.claude/framework/workflows/remove-workspace.md do início ao fim.
</process>
