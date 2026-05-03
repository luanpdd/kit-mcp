---
name: nota
description: Captura de ideias sem fricção. Adicionar, listar ou promover notas para todos.
argument-hint: "<text> | list | promote <N> [--global]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
---
<objective>
Captura de ideia sem fricção — uma chamada Write, uma linha de confirmação.

Três subcomandos:
- **append** (padrão): Salva um arquivo de nota com timestamp. Sem perguntas, sem formatação.
- **list**: Mostra todas as notas dos escopos do projeto e global.
- **promote**: Converte uma nota em um todo estruturado.

Roda inline — sem Task, sem AskUserQuestion, sem Bash.
</objective>

<execution_context>
@./.claude/framework/workflows/note.md
@./.claude/framework/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute o workflow note de @./.claude/framework/workflows/note.md do início ao fim.
Capturar a nota, listar notas ou promover para todo — dependendo dos argumentos.
</process>