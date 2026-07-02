---
name: inserir-fase
description: Insere trabalho urgente como fase decimal (p.ex. 72.1) entre fases existentes, renumerando as subsequentes.
argument-hint: "<after> <description>"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Inserir uma fase decimal para trabalho urgente descoberto no meio do milestone que deve ser concluído entre fases inteiras existentes.

Usa numeração decimal (72.1, 72.2, etc.) para preservar a sequência lógica das fases planejadas enquanto acomoda inserções urgentes.

Propósito: Lidar com trabalho urgente descoberto durante a execução sem renumerar todo o roadmap.
</objective>

<execution_context>
@./.claude/framework/workflows/insert-phase.md
</execution_context>

<context>
Argumentos: $ARGUMENTS (formato: <número-da-fase-após> <descrição>)

Roadmap e estado são resolvidos no workflow via `init phase-op` e chamadas de ferramentas específicas.
</context>

<process>
Execute o workflow insert-phase de @./.claude/framework/workflows/insert-phase.md do início ao fim.
Preserve todos os checkpoints de validação (análise de argumentos, verificação de fase, cálculo decimal, atualizações de roadmap).
</process>