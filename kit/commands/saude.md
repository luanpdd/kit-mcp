---
name: saude
description: Diagnostica a integridade do diretório de planejamento e opcionalmente repara problemas
argument-hint: [--repair]
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---
<objective>
Validar a integridade do diretório `.planning/` e reportar problemas acionáveis. Verifica arquivos ausentes, configurações inválidas, estado inconsistente e planos órfãos.
</objective>

<execution_context>
@./.claude/framework/workflows/health.md
</execution_context>

<process>
Execute o workflow health de @./.claude/framework/workflows/health.md do início ao fim.
Analisar a flag --repair dos argumentos e passar para o workflow.
</process>