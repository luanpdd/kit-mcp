---
name: proximo
description: Avança automaticamente para o próximo passo lógico no workflow framework
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---
<objective>
Detectar o estado atual do projeto e automaticamente invocar o próximo passo lógico do workflow framework.
Sem argumentos necessários — lê STATE.md, ROADMAP.md e diretórios de fase para determinar o que vem a seguir.

Projetado para workflows multi-projeto rápidos onde lembrar em qual fase/passo você está é overhead.

## Quando usar

- ✅ "Não lembro onde parei" — `/proximo` lê estado e avança
- ✅ Pulando entre vários projetos durante o dia
- ❌ Sabe exatamente o que fazer — invoque o comando direto
- 🤔 Tem uma intenção mas não sabe qual comando usar? → **`/fazer "descrição"`**
</objective>

<execution_context>
@./.claude/framework/workflows/next.md
</execution_context>

<process>
Execute o workflow next de @./.claude/framework/workflows/next.md do início ao fim.
</process>