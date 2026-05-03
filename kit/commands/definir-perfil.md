---
name: definir-perfil
description: Altera o perfil de modelo para os agentes framework (quality/balanced/budget/inherit)
argument-hint: <perfil (quality|balanced|budget|inherit)>
model: haiku
allowed-tools:
  - Bash
---

Mostrar a seguinte saída ao usuário verbatim, sem comentários adicionais:

!`node "./.claude/framework/bin/tools.cjs" config-set-model-profile $ARGUMENTS --raw`