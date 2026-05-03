---
name: progresso
description: Verifica o progresso do projeto, mostra contexto e roteia para próxima ação (executar ou planejar)
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---
<objective>
Verificar o progresso do projeto, resumir trabalho recente e o que está à frente, então rotear inteligentemente para a próxima ação — seja executar um plano existente ou criar o próximo.

Fornece consciência situacional antes de continuar o trabalho.
</objective>

<execution_context>
@./.claude/framework/workflows/progress.md
</execution_context>

<process>
Execute o workflow progress de @./.claude/framework/workflows/progress.md do início ao fim.
Preserve toda a lógica de roteamento (Rotas A a F) e tratamento de casos extremos.
</process>
