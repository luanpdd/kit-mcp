---
name: plantar-ideia
description: Captura uma ideia prospectiva com condições de gatilho — surge automaticamente no milestone certo
argument-hint: "[resumo da ideia]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<objective>
Capturar uma ideia grande demais para agora, mas que deve surgir automaticamente quando o milestone certo chegar. Seeds resolvem a deterioração de contexto: em vez de uma linha em Deferred que ninguém lê, uma seed preserva o WHY completo, QUANDO surgir e trilhas de pão para os detalhes.

Cria: .planning/seeds/SEED-NNN-slug.md
Consumido por: /novo-marco (escaneia seeds e apresenta correspondências)
</objective>

<execution_context>
@./.claude/framework/workflows/plant-seed.md
</execution_context>

<process>
Execute o workflow plant-seed de @./.claude/framework/workflows/plant-seed.md do início ao fim.
</process>