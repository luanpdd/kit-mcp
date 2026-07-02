# Fase 34: Skills escala + OMM + agente OMM + 2 comandos - Contexto

**Coletado:** 2026-05-06
**Modo:** Auto-gerado (discuss pulado)

<domain>
6 artefatos: 3 skills + 1 agente + 2 comandos.
REQs: SKPR-04, SKPR-05, SKPR-06, AGCORE-05, CMD-05, CMD-06 (6 REQs).
</domain>

<decisions>
Padrão v1.8 — template fixo de skills + frontmatter agentes.
Orquestrador `/observabilidade` é análogo a `/supabase` — único ponto de chain.
</decisions>

<code_context>
- Padrão de orquestrador: `/supabase` em v1.8 com 10 subcomandos
- OMM scoring: 1-5 com sintomas qualitativos
- Telemetry sampling: head/tail/by-key/dynamic
</code_context>

<specifics>
Sub-comandos do `/observabilidade`: instrumentar, investigar, slo, burn-rate, omm.
</specifics>

<deferred>
Audit gates OMM no `/concluir-marco` — Phase 35.
</deferred>
