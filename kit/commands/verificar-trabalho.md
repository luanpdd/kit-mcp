---
name: verificar-trabalho
description: Valida funcionalidades construídas através de UAT conversacional
argument-hint: "[número da fase, ex: '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
---
<objective>
Valida funcionalidades construídas através de testes conversacionais com estado persistente.

Propósito: Confirmar que o que o Claude construiu realmente funciona da perspectiva do usuário. Um teste por vez, respostas em texto simples, sem interrogatório. Quando problemas são encontrados, automaticamente diagnostica, planeja correções e prepara para execução.

Saída: {phase_num}-UAT.md rastreando todos os resultados de teste. Se problemas encontrados: lacunas diagnosticadas, planos de correção verificados prontos para /executar-fase
</objective>

<execution_context>
@./.claude/framework/workflows/verify-work.md
@./.claude/framework/templates/UAT.md
</execution_context>

<context>
Fase: $ARGUMENTS (opcional)
- Se fornecido: Testar fase específica (ex: "4")
- Se não fornecido: Verificar sessões ativas ou solicitar fase

Arquivos de contexto são resolvidos dentro do workflow (`init verify-work`) e delegados via blocos `<files_to_read>`.
</context>

<process>
Execute o workflow verify-work de @./.claude/framework/workflows/verify-work.md do início ao fim.
Preserve todos os gates do workflow (gerenciamento de sessão, apresentação de testes, diagnóstico, planejamento de correções, roteamento).
</process>
