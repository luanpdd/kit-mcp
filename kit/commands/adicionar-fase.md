---
name: adicionar-fase
description: Adiciona fase ao final do milestone atual no roadmap
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Adiciona uma nova fase inteira ao final do milestone atual no roadmap.

Encaminha para o workflow add-phase que cuida de:
- Cálculo do número da fase (próximo inteiro sequencial)
- Criação de diretório com geração de slug
- Atualizações da estrutura do roadmap
- Rastreamento de evolução do roadmap no STATE.md
</objective>

<execution_context>
@./.claude/framework/workflows/add-phase.md
</execution_context>

<context>
Argumentos: $ARGUMENTS (descrição da fase)

Roadmap e estado são resolvidos no workflow via `init phase-op` e chamadas de ferramentas específicas.
</context>

<process>
**Seguir o workflow add-phase** de `@./.claude/framework/workflows/add-phase.md`.

O workflow cuida de toda a lógica, incluindo:
1. Análise e validação dos argumentos
2. Verificação de existência do roadmap
3. Identificação do milestone atual
4. Cálculo do próximo número de fase (ignorando decimais)
5. Geração de slug a partir da descrição
6. Criação do diretório da fase
7. Inserção da entrada no roadmap
8. Atualizações do STATE.md
</process>
