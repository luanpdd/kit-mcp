# Fase 33: Integração com fluxo framework - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

4 patches em comandos do framework existentes:
1. `/discutir-fase` — pergunta canônica ODD na sessão (INT-FW-01)
2. `/planejar-fase` — plan-checker bloqueia se ODD ausente (INT-FW-02)
3. `/verificar-trabalho` — Core Analysis Loop em logs reais (INT-FW-03)
4. `/forense` — Core Analysis Loop em vez de inspeção ad hoc (INT-FW-06)

REQs: INT-FW-01, INT-FW-02, INT-FW-03, INT-FW-06 (4 REQs).
</domain>

<decisions>
## Decisões de Implementação

### Patches são editoriais (documentação)
Adicionar bloco `<observability_integration>` em cada um dos 4 comandos. Os workflows .claude/framework/workflows/*.md continuam funcionais — patches descrevem hooks que workflows futuros podem usar.

### Configuração via flags workflow
- `workflow.observability_phase_questions` (default: true)
- `workflow.observability_plan_gate` (default: true)
- `workflow.observability_uat_validation` (default: true)
</decisions>

<code_context>
- 4 commands em kit/commands/ — frontmatter + objective + execution_context + process + success_criteria
- Padrão: comando delega para workflow em .claude/framework/workflows/
- Patches adicionam bloco `<observability_integration>` no final
</code_context>

<specifics>
## Ideias Específicas

### Hooks documentados (não implementados — workflows continuam intactos)
Patches sinalizam onde a integração observabilidade entra; implementação detalhada nos workflows seria escopo separado. Documentação é suficiente para v1.9 — usuário/IA vê o hook e aciona via skill quando aplicável.
</specifics>

<deferred>
## Ideias Adiadas

- Modificações estruturais nos workflows (.claude/framework/workflows/*.md) — patches são editoriais nesta fase
- Skills `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model` — Phase 34
- Gates OMM no fluxo (`/auditar-marco`, `/concluir-marco`) — Phase 35
</deferred>
