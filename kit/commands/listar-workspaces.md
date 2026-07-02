---
name: listar-workspaces
description: Lista os workspaces framework ativos e seu status
allowed-tools:
  - Bash
  - Read
---
<objective>
Escanear `~/workspaces/` por diretórios de workspace contendo manifestos `WORKSPACE.md`. Exibir uma tabela resumo com nome, caminho, contagem de repos, estratégia e status do projeto framework.
</objective>

<execution_context>
@./.claude/framework/workflows/list-workspaces.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<process>
Execute o workflow list-workspaces de @./.claude/framework/workflows/list-workspaces.md do início ao fim.
</process>