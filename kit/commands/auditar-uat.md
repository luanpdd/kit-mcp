---
name: auditar-uat
description: Auditoria multi-fase de todos os itens de UAT e verificação pendentes
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---
<objective>
Verificar todas as fases em busca de itens de UAT pendentes, ignorados, bloqueados e que precisam de humano. Cruzar com a base de código para detectar documentação desatualizada. Produzir plano de testes humanos priorizado.
</objective>

<execution_context>
@./.claude/framework/workflows/audit-uat.md
</execution_context>

<context>
Arquivos principais de planejamento são carregados no workflow via CLI.

**Escopo:**
Glob: .planning/phases/*/*-UAT.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>