---
name: remover-fase
description: Remove uma fase futura do roadmap e renumera as fases subsequentes
argument-hint: <phase-number>
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---
<objective>
Remover uma fase futura não iniciada do roadmap e renumerar todas as fases subsequentes para manter uma sequência limpa e linear.

Propósito: Remoção limpa de trabalho que você decidiu não fazer, sem poluir o contexto com marcadores cancelados/adiados.
Saída: Fase deletada, todas as fases subsequentes renumeradas, commit git como registro histórico.
</objective>

<execution_context>
@./.claude/framework/workflows/remove-phase.md
</execution_context>

<context>
Fase: $ARGUMENTS

Roadmap e estado são resolvidos no workflow via `init phase-op` e leituras específicas.
</context>

<process>
Execute o workflow remove-phase de @./.claude/framework/workflows/remove-phase.md do início ao fim.
Preserve todos os checkpoints de validação (verificação de fase futura, verificação de trabalho), lógica de renumeração e commit.
</process>
