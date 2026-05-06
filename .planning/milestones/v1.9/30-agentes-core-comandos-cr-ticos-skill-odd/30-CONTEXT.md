# Fase 30: Agentes core + comandos críticos + skill ODD - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss=true)

<domain>
## Limite da Fase

5 artefatos:
1. `kit/skills/observability-driven-development/SKILL.md` — 4 perguntas pré-PR + auto-page autor (cap 11)
2. `kit/agents/observability-instrumenter.md` — gera patches OTel + structured events
3. `kit/agents/incident-investigator.md` — Core Analysis Loop + MCP Supabase
4. `kit/commands/instrumentar-fase.md` — gera `INSTRUMENTATION.md` por plano
5. `kit/commands/investigar-producao.md` — Core Analysis Loop guiado, estado persistente

REQs: SKPR-01, AGCORE-01, AGCORE-02, CMD-01, CMD-03 (5 REQs).

Depende: Phase 29 (skills SKFD existem para cross-reference).
</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude — fase de discuss pulada
Padrão: agentes seguem o template Compatibilidade IDE + preflight MCP + modo offline gracioso (precedente v1.8 supabase-*).

### Atributos canônicos no agent `observability-instrumenter`
Sempre gera spans com: `user.id`, `tenant_id`, `request.id`, `result.success`, `error.type`, `duration_ms`, `build_id`, `endpoint`. Conforme glossary.md (Phase 29).

### Estado persistente em `incident-investigator`
Padrão `/depurar`: `.planning/investigations/<id>.md` com checkpoints — cada hipótese, query, resultado, status.

### Comando `/instrumentar-fase` — formato output
`INSTRUMENTATION.md` por plano com seções: Spans (nome + kind + atributos), Métricas, Eventos críticos, Logs estruturados, Validação ODD (4 perguntas).

</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `kit/agents/supabase-edge-fn-writer.md`, `supabase-rls-writer.md` — precedentes para frontmatter `tools` + tabela compat
- `kit/agents/debugger.md` — precedente de agente com estado persistente
- `kit/commands/supabase.md` — precedente de comando com dispatch via `Task(subagent_type=...)`
- `kit/commands/depurar.md` — precedente de comando com sessões persistentes

### Padrões Estabelecidos
- Agentes têm seções: Compatibilidade, "Por que existe", Inputs, Steps numerados, Output, "Quando NÃO invocar"
- Comandos têm frontmatter `name`+`description`+`argument-hint`+`allowed-tools`, depois `<objective>`, `<context>`, `<process>`, `<success_criteria>`
- MCP tools `mcp__supabase__*` declarados em frontmatter `tools` quando agente usa

</code_context>

<specifics>
## Ideias Específicas

### Estrutura de `INSTRUMENTATION.md`
```markdown
# Instrumentation Plan — Phase {N}: {Name}

## Spans
| Name | Kind | Service | Attrs |
|---|---|---|---|

## Eventos críticos
| Event | Quando | result.success | error.type |
|---|---|---|---|

## Métricas (opcional)
| Name | Type | Unit | Labels |
|---|---|---|---|

## ODD — 4 perguntas
1. Faz o que esperei? → Como verificar?
2. Compara à versão anterior? → Como?
3. Usuários estão usando? → Como medir?
4. Anomalias emergem? → Quais alertas/queries?
```

</specifics>

<deferred>
## Ideias Adiadas

- Skills SLO (`event-based-slos`, `burn-rate-alerting`) — Phase 32
- Agente `slo-engineer`, `burn-rate-forecaster` — Phase 32
- Agente `omm-auditor` — Phase 34

</deferred>
