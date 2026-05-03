---
name: limpeza
description: Arquiva diretórios de fase acumulados de milestones concluídos
---
<objective>
Arquiva diretórios de fase de milestones concluídos em `.planning/milestones/v{X.Y}-phases/`.

Use quando `.planning/phases/` acumulou diretórios de milestones passados.
</objective>

<execution_context>
@./.claude/framework/workflows/cleanup.md
</execution_context>

<process>
Seguir o workflow cleanup em @./.claude/framework/workflows/cleanup.md.
Identificar milestones concluídos, mostrar um resumo de simulação e arquivar após confirmação.
</process>