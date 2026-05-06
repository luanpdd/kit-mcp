# Fase 35: Gates OMM no fluxo + QA + docs - Contexto

**Coletado:** 2026-05-06
**Modo:** Auto-gerado (discuss pulado)

<domain>
6 artefatos:
1. `gates/obs-skills-frontmatter.md` (QA-01)
2. `gates/obs-agents-mcp-supabase.md` (QA-02)
3. `gates/omm-no-regression.md` (QA-03)
4. Patch em `/auditar-marco` (INT-FW-04)
5. Patch em `/concluir-marco` (INT-FW-05)
6. Patch README.md "Observability suite" (QA-04)

REQs: INT-FW-04, INT-FW-05, QA-01, QA-02, QA-03, QA-04 (6 REQs).
</domain>

<decisions>
Gates reusam padrão bash 3.2+ portable (precedente skill-must-include de v1.8).
omm-no-regression é blocking=false por default, opt-in via workflow.omm_no_regression=true.
README ganha seção dedicada à suite, não modifica seções existentes.
</decisions>

<code_context>
- gates/ tem 10 arquivos pré-existentes; padrão YAML frontmatter + bash check
- /auditar-marco e /concluir-marco delegam para workflows; patches são editoriais
</code_context>

<specifics>
3 gates novos cobrem QA-01, QA-02, QA-03. Patches em commands mais README cobrem INT-FW-04, INT-FW-05, QA-04.
</specifics>

<deferred>
(nenhum — todos os REQs do milestone v1.9 cobertos com Phase 35)
</deferred>
