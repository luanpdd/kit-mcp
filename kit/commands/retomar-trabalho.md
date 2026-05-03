---
name: retomar-trabalho
description: Retoma o trabalho da sessão anterior com restauração completa de contexto
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
  - SlashCommand
---

<objective>
Restaura o contexto completo do projeto e retoma o trabalho de forma contínua a partir da sessão anterior.

Roteia para o workflow resume-project que trata:

- Carregamento do STATE.md (ou reconstrução se ausente)
- Detecção de checkpoints (arquivos .continue-here)
- Detecção de trabalho incompleto (PLAN sem SUMMARY)
- Apresentação de status
- Roteamento de próxima ação com consciência de contexto
  </objective>

<execution_context>
@./.claude/framework/workflows/resume-project.md
</execution_context>

<process>
**Seguir o workflow resume-project** de `@./.claude/framework/workflows/resume-project.md`.

O workflow trata toda a lógica de retomada incluindo:

1. Verificação de existência do projeto
2. Carregamento ou reconstrução do STATE.md
3. Detecção de checkpoints e trabalho incompleto
4. Apresentação visual de status
5. Oferta de opções com consciência de contexto (verifica CONTEXT.md antes de sugerir planejar vs discutir)
6. Roteamento para próximo comando apropriado
7. Atualizações de continuidade da sessão
   </process>
