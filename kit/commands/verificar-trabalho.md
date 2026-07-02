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

<observability_integration>
**Integração com Core Analysis Loop em logs reais (v1.9):**

Quando `workflow.observability_uat_validation = true` (default) e o projeto tem MCP Supabase disponível, o workflow inclui passo de validação observacional após UAT conversacional:

1. Para cada test passing no UAT, invocar o agente [`incident-investigator`](../agents/incident-investigator.md) em modo "validation":
   ```
   Task(subagent_type="incident-investigator", prompt="
     mode: validation
     symptom: validar que feature de Phase {N} efetivamente emitiu spans/eventos esperados
     time_window: última 1h
     expected_attributes: {result.success: true, build_id: {current_build}}
   ")
   ```
2. O agente queryará via `mcp__supabase__get_logs` ou `mcp__supabase__execute_sql` para confirmar:
   - Spans com nome esperado existem
   - Atributos canônicos foram emitidos (não só código existe — comportamento real)
   - `result.success` baseline está dentro do esperado
3. Se confirmado: UAT.md inclui evidência observacional (não só "funciona em UI"). Status `passed` ✓.
4. Se ausente: UAT.md flag `human_needed` com sugestão "verificar instrumentação não está pegando".

**Skill consultada:** [`core-analysis-loop`](../skills/core-analysis-loop/SKILL.md) — para o caso de UAT falhar e precisar investigar.

**REQ:** INT-FW-03.
</observability_integration>
