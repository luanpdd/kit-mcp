---
name: discutir-fase
description: Reúne contexto da fase por questionamento adaptativo antes do planejamento. Use --auto para pular perguntas interativas (Claude escolhe os padrões recomendados).
argument-hint: "<phase> [--auto] [--batch] [--analyze] [--text]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

<objective>
Extrair decisões de implementação que os agentes subsequentes precisam — o pesquisador e o planejador usarão o CONTEXT.md para saber o que investigar e quais escolhas estão travadas.

**Como funciona:**
1. Carregar contexto anterior (PROJECT.md, REQUIREMENTS.md, STATE.md, arquivos CONTEXT.md anteriores)
2. Explorar base de código em busca de recursos e padrões reutilizáveis
3. Analisar a fase — pular áreas cinzentas já decididas em fases anteriores
4. Apresentar áreas cinzentas restantes — usuário seleciona quais discutir
5. Aprofundar cada área selecionada até satisfação
6. Criar CONTEXT.md com decisões que guiam pesquisa e planejamento

**Saída:** `{phase_num}-CONTEXT.md` — decisões claras o suficiente para que agentes subsequentes possam agir sem perguntar ao usuário novamente
</objective>

<execution_context>
@./.claude/framework/workflows/discuss-phase.md
@./.claude/framework/workflows/discuss-phase-assumptions.md
@./.claude/framework/templates/context.md
</execution_context>

<context>
Número da fase: $ARGUMENTS (obrigatório)

Arquivos de contexto são resolvidos no workflow usando `init phase-op` e chamadas de ferramentas de roadmap/estado.
</context>

<process>
**Roteamento de modo:**
```bash
DISCUSS_MODE=$(node "./.claude/framework/bin/tools.cjs" config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

Se `DISCUSS_MODE` for `"assumptions"`: Ler e executar @./.claude/framework/workflows/discuss-phase-assumptions.md do início ao fim.

Se `DISCUSS_MODE` for `"discuss"` (ou não definido, ou qualquer outro valor): Ler e executar @./.claude/framework/workflows/discuss-phase.md do início ao fim.

**OBRIGATÓRIO:** Os arquivos execution_context listados acima SÃO as instruções. Ler o arquivo de workflow ANTES de tomar qualquer ação. As seções de objective e success_criteria neste arquivo de comando são resumos — o arquivo de workflow contém o processo completo passo a passo com todos os comportamentos obrigatórios, verificações de configuração e padrões de interação. Não improvisar a partir do resumo.
</process>

<success_criteria>
- Contexto anterior carregado e aplicado (sem re-perguntar questões já decididas)
- Áreas cinzentas identificadas através de análise inteligente
- Usuário escolheu quais áreas discutir
- Cada área selecionada explorada até satisfação
- Expansão de escopo redirecionada para ideias adiadas
- CONTEXT.md captura decisões, não visão vaga
- Usuário conhece os próximos passos
</success_criteria>

<observability_integration>
**Integração com Observability-Driven Development (v1.9):**

Quando o workflow.observability_phase_questions = true (default), o workflow inclui pergunta canônica de ODD na sessão de discussão:

> "Quais SLIs essa fase impacta? O que precisa ser instrumentado para responder às 4 perguntas pré-PR?"

A pergunta é resolvida consultando a skill [`observability-driven-development`](../skills/observability-driven-development/SKILL.md) e o resultado é registrado na seção `<observability>` do CONTEXT.md gerado:

```markdown
<observability>
## SLIs impactados
- [SLI ou "nenhum — fase puramente interna"]

## Instrumentação necessária
- Spans novos: [lista]
- Atributos canônicos: [user.id, tenant_id, ...]
- error.type enum esperado: [validation, timeout, ...]
</observability>
```

O `plan-checker` invocado pelo `/planejar-fase` (Phase 33 — INT-FW-02) lê esta seção e bloqueia o plano se ODD ausente para fases voltadas ao usuário (skip silenciosamente para fases de infraestrutura — ver detecção em `discuss-phase.md`).

**REQ:** INT-FW-01.
</observability_integration>
