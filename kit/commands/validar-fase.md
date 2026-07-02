---
name: validar-fase
description: Audita retroativamente e preenche lacunas de validação Nyquist para uma fase concluída
argument-hint: "[número da fase]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
Audita a cobertura de validação Nyquist para uma fase concluída. Três estados:
- (A) VALIDATION.md existe — auditar e preencher lacunas
- (B) Sem VALIDATION.md, SUMMARY.md existe — reconstruir a partir de artefatos
- (C) Fase não executada — sair com orientação

Saída: VALIDATION.md atualizado + arquivos de teste gerados.
</objective>

<execution_context>
@./.claude/framework/workflows/validate-phase.md
</execution_context>

<context>
Fase: $ARGUMENTS — opcional, padrão é a última fase concluída.
</context>

<process>
Execute @./.claude/framework/workflows/validate-phase.md.
Preserve todos os gates do workflow.
</process>
