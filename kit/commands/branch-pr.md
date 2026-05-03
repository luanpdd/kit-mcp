---
name: branch-pr
description: Cria um branch limpo para PR filtrando commits de .planning/ — pronto para revisão de código
argument-hint: "[branch destino, padrão: main]"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
Criar um branch limpo adequado para pull requests filtrando commits de .planning/
do branch atual. Revisores veem apenas mudanças de código, não artefatos de planejamento framework.

Isso resolve o problema de diffs de PR poluídos com mudanças de PLAN.md, SUMMARY.md, STATE.md
que são irrelevantes para revisão de código.
</objective>

<execution_context>
@./.claude/framework/workflows/pr-branch.md
</execution_context>

<process>
Execute o workflow pr-branch de @./.claude/framework/workflows/pr-branch.md do início ao fim.
</process>