---
name: fase-ui
description: Gera contrato de design UI (UI-SPEC.md) para fases de frontend
argument-hint: "[fase]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - AskUserQuestion
  - mcp__context7__*
---
<objective>
Cria um contrato de design UI (UI-SPEC.md) para uma fase de frontend.
Orquestra os agentes ui-researcher e ui-checker.
Fluxo: Validar → Pesquisar UI → Verificar UI-SPEC → Concluído
</objective>

<execution_context>
@./.claude/framework/workflows/ui-phase.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
Número da fase: $ARGUMENTS — opcional, auto-detecta a próxima fase não planejada se omitido.
</context>

<process>
Execute @./.claude/framework/workflows/ui-phase.md do início ao fim.
Preserve todos os gates do workflow.
</process>
