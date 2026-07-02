---
name: rapido
description: Executa uma tarefa trivial inline — sem subagentes, sem overhead de planejamento
argument-hint: "[descrição da tarefa]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

<objective>
Executa uma tarefa trivial diretamente no contexto atual sem invocar subagentes
ou gerar arquivos PLAN.md. Para tarefas pequenas demais para justificar overhead de planejamento:
correções de typo, mudanças de configuração, pequenas refatorações, commits esquecidos, adições simples.

Este NÃO é um substituto para /expresso — use /expresso para qualquer coisa que
precise de pesquisa, planejamento multi-etapas ou verificação. /rapido é para tarefas
que você poderia descrever em uma frase e executar em menos de 2 minutos.

## Quando usar

- ✅ "renomear variável X pra Y", "ajustar copy do botão", "adicionar log", "fix de typo"
- ❌ Multi-arquivo, multi-passo, requer pesquisa — use `/expresso` ou `/planejar-fase`
- 🤔 Em dúvida sobre qual comando? → **`/fazer "descrição"`** roteia automaticamente
</objective>

<execution_context>
@./.claude/framework/workflows/fast.md
</execution_context>

<process>
Execute o workflow fast de @./.claude/framework/workflows/fast.md do início ao fim.
</process>