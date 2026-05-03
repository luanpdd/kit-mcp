---
name: fazer
description: Roteia texto livre para o comando do framework correto automaticamente
argument-hint: "<descrição do que você quer fazer>"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
Analisar entrada em linguagem natural e despachar para o comando do framework mais adequado.

Age como um despachante inteligente — nunca faz o trabalho diretamente. Combina a intenção com o melhor comando do framework usando regras de roteamento, confirma a correspondência e então transfere.

Use quando você sabe o que quer mas não sabe qual comando `/*` executar.
</objective>

<execution_context>
@./.claude/framework/workflows/do.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute o workflow do de @./.claude/framework/workflows/do.md do início ao fim.
Rotear a intenção do usuário para o melhor comando do framework e invocá-lo.
</process>