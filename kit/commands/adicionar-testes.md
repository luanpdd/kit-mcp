---
name: adicionar-testes
description: Gera testes para uma fase concluída com base nos critérios de UAT e implementação
argument-hint: "<phase> [instruções adicionais]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
argument-instructions: |
  Analise o argumento como um número de fase (inteiro, decimal ou sufixo de letra), mais instruções opcionais em texto livre.
  Exemplo: /adicionar-testes 12
  Exemplo: /adicionar-testes 12 focar nos casos extremos no módulo de precificação
---
<objective>
Gera testes unitários e E2E para uma fase concluída, usando seu SUMMARY.md, CONTEXT.md e VERIFICATION.md como especificações.

Analisa os arquivos de implementação, classifica-os em categorias TDD (unitário), E2E (browser) ou Ignorar, apresenta um plano de testes para aprovação do usuário e gera os testes seguindo as convenções RED-GREEN.

Saída: Arquivos de teste com commit da mensagem `test(phase-{N}): add unit and E2E tests from add-tests command`
</objective>

<execution_context>
@./.claude/framework/workflows/add-tests.md
</execution_context>

<context>
Fase: $ARGUMENTS

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>
Execute o workflow add-tests de @./.claude/framework/workflows/add-tests.md do início ao fim.
Preserve todos os checkpoints do workflow (aprovação de classificação, aprovação do plano de testes, verificação RED-GREEN, relatório de lacunas).
</process>
