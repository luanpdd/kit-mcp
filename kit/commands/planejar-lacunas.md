---
name: planejar-lacunas
description: Cria fases para fechar todas as lacunas identificadas pela auditoria de milestone
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<objective>
Criar todas as fases necessárias para fechar lacunas identificadas pelo `/auditar-marco`.

Lê MILESTONE-AUDIT.md, agrupa lacunas em fases lógicas, cria entradas de fase no ROADMAP.md e oferece planejar cada fase.

Um comando cria todas as fases de correção — sem `/adicionar-fase` manual por lacuna.
</objective>

<execution_context>
@./.claude/framework/workflows/plan-milestone-gaps.md
</execution_context>

<context>
**Resultados da auditoria:**
Glob: .planning/v*-MILESTONE-AUDIT.md (usar o mais recente)

Intenção original e estado atual de planejamento são carregados sob demanda dentro do workflow.
</context>

<process>
Execute o workflow plan-milestone-gaps de @./.claude/framework/workflows/plan-milestone-gaps.md do início ao fim.
Preserve todos os checkpoints do workflow (carregamento de auditoria, priorização, agrupamento de fases, confirmação do usuário, atualizações de roadmap).
</process>