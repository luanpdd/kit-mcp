# Fase 41: Gates QA + README + CHANGELOG - Contexto

**Coletado:** 2026-05-07
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Última fase do milestone v1.10. Gates bash 3.2-portable + atualização editorial de docs externas:

1. `gates/golden-signals-coverage.md` (blocking, pre-verify) — verifica código de serviço/Edge Function tocado tem 4 golden signals (regex `histogram\|counter\|gauge\|saturation`) (QA-SRE-01)
2. `gates/postmortem-template-required.md` (blocking, pre-conclude) — em `/concluir-marco`, bloqueia se houve incident em `.planning/investigations/` sem `.planning/postmortems/` correspondente (QA-SRE-02)
3. `gates/prr-checklist-coverage.md` (blocking, pre-verify) — verifica `PRR-REPORT.md` cobre 6 axes (System architecture, Instrumentation, Emergency response, Capacity planning, Change management, Performance) (QA-SRE-03)
4. README ganha seção "SRE Engagement (v1.10)" listando 6 skills + 4 agents + 6 commands + 3 gates com exemplo end-to-end (QA-SRE-04)
5. CHANGELOG ganha entrada v1.10.0 documentando: Camada SRE Engagement, integração com Suítes Observabilidade v1.9 + Supabase v1.8, audit gates novos, lifecycle hooks (QA-SRE-05)

**REQs cobertos (5):** QA-SRE-01, QA-SRE-02, QA-SRE-03, QA-SRE-04, QA-SRE-05

**Dependência:** Phases 36-40 concluídas — ✅ atendida.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas são de discrição do Claude. Gates seguem padrão bash 3.2-portable de v1.8 (Suíte Supabase) e v1.9 (Observabilidade) em `kit/gates/` ou `gates/`. README/CHANGELOG são edições editoriais.

</decisions>

<code_context>
## Insights do Código Existente

Precedentes a consultar:
- Gates v1.9: `gates/omm-progress-required.md`, `gates/instrumentation-coverage.md`, `gates/slo-defined.md` — pattern de gate bash blocking
- Gates v1.8: pattern Supabase audit gates
- README.md atual — adicionar seção v1.10
- CHANGELOG.md atual — adicionar entrada v1.10.0

Artefatos referenciados pelos gates:
- `kit/agents/golden-signals-instrumenter.md` (Phase 37) — referência para patterns OTel
- `.planning/investigations/` (v1.9 investigations directory) — pattern do incident-investigator
- `.planning/postmortems/` (v1.10 postmortems directory) — output do postmortem-writer
- `PRR-REPORT.md` template (Phase 37 prr-conductor) — 6 axes a validar

</code_context>

<specifics>
## Ideias Específicas

Sem requisitos específicos adicionais. Critérios 6-7 reforçam: smoke gates (exit 0 em codebase atual; fail em fixture sintético com gaps); sync idempotente preservado.

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
