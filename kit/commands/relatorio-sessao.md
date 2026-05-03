---
name: relatorio-sessao
description: Gera relatório da sessão com estimativas de uso de tokens, resumo de trabalho e resultados
allowed-tools:
  - Read
  - Bash
  - Write
---
<objective>
Gera um documento SESSION_REPORT.md estruturado capturando resultados da sessão, trabalho realizado e uso estimado de recursos. Fornece um artefato compartilhável para revisão pós-sessão.
</objective>

<execution_context>
@./.claude/framework/workflows/session-report.md
</execution_context>

<process>
Execute o workflow session-report de @./.claude/framework/workflows/session-report.md do início ao fim.
</process>
