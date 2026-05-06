---
name: fazer
description: Entrypoint canônico — roteia texto livre para o comando do framework correto. Use este quando estiver na dúvida.
argument-hint: "<descrição do que você quer fazer>"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
**Entrypoint canônico do framework.** Quando você sabe o que quer mas não sabe qual `/*` executar, use `/fazer "descrição"`.

`/fazer` é um despachante inteligente — nunca faz o trabalho diretamente; combina a intenção com o melhor comando e transfere com confirmação.

## Árvore de decisão

| Sua intenção | Comando recomendado | Quando usar |
|---|---|---|
| Tarefa **trivial** (rename, ajuste pontual) | **`/rapido`** | Sem necessidade de plano formal; commit atômico, sem subagentes |
| Tarefa **rápida com garantias** (commit limpo, rastreamento de estado) | **`/expresso`** | Algo concreto mas pequeno; pula agentes opcionais mas mantém disciplina |
| Trabalho **estruturado** (multi-arquivo, requer planejamento) | **`/discutir-fase` → `/planejar-fase` → `/executar-fase`** | Fase real de milestone; usa agentes completos |
| **Próximo passo** ambíguo no fluxo atual | **`/proximo`** | Avança no roadmap automaticamente |
| **Capturar ideia** sem agir agora | **`/nota`** ou **`/adicionar-tarefa`** | Salva pra depois sem interromper o foco |
| **Investigar bug** com método científico | **`/depurar`** | Hipótese → teste → fix com checkpoints |

## Aliases (continuam funcionando)

`/rapido`, `/expresso`, `/proximo`, `/depurar`, `/discutir-fase`, `/planejar-fase`, `/executar-fase` — todos continuam executando direto, sem passar pelo `/fazer`. Use `/fazer` quando estiver em dúvida sobre qual escolher.
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