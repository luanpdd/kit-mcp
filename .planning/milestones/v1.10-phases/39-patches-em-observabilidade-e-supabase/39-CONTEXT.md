# Fase 39: Patches em Observabilidade e Supabase - Contexto

**Coletado:** 2026-05-07
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Patches editoriais — adicionar blocos `<sre_integration>` em 6 artefatos pré-existentes (v1.8 + v1.9). Sem alterar frontmatter (`description`, `tools` inalterados — anti-pitfall A2 preservado).

**Patches:**
1. `kit/skills/event-based-slos/SKILL.md` (v1.9) — bloco "Risk continuum" + cross-ref `sre-risk-management` (INT-OBS-01)
2. `kit/agents/omm-auditor.md` (v1.9) — Capacidade 3 (Complexidade/Tech Debt) consulta `toil-auditor`; score considera % toil pelo time (INT-OBS-02)
3. `kit/agents/supabase-edge-fn-writer.md` (v1.8) — seção "Four Golden Signals" no template Edge Function (INT-SB-V2-01)
4. `kit/agents/supabase-architect.md` (v1.8) — menção a PRR + cross-ref `production-readiness-review` (INT-SB-V2-02)
5. `kit/agents/supabase-migration-writer.md` (v1.8) — alerta sobre toil + cross-ref `eliminating-toil` (INT-SB-V2-03)
6. `kit/agents/supabase-storage-implementer.md` (v1.8) — saturation signal (gauge bucket size + counter quota) + cross-ref `four-golden-signals` (INT-SB-V2-04)

**REQs cobertos (6):** INT-OBS-01, INT-OBS-02, INT-SB-V2-01, INT-SB-V2-02, INT-SB-V2-03, INT-SB-V2-04

**Dependência:** Phases 36-38 concluídas (skills + agents existem para cross-reference) — ✅ atendida.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada. Use o objetivo da fase no ROADMAP, critérios de sucesso (7) e convenções dos artefatos pré-existentes para guiar decisões.

</decisions>

<code_context>
## Insights do Código Existente

Arquivos a patchear:
- `kit/skills/event-based-slos/SKILL.md` — skill v1.9 existente
- `kit/agents/omm-auditor.md` — agent v1.9 existente
- `kit/agents/supabase-edge-fn-writer.md` — agent v1.8 existente
- `kit/agents/supabase-architect.md` — agent v1.8 existente
- `kit/agents/supabase-migration-writer.md` — agent v1.8 existente
- `kit/agents/supabase-storage-implementer.md` — agent v1.8 existente

Skills/agents v1.10 referenciados (Phase 36-37):
- `kit/skills/sre-risk-management/SKILL.md`
- `kit/agents/toil-auditor.md`
- `kit/skills/four-golden-signals/SKILL.md`
- `kit/skills/production-readiness-review/SKILL.md`
- `kit/skills/eliminating-toil/SKILL.md`

</code_context>

<specifics>
## Ideias Específicas

Sem requisitos específicos adicionais. Frontmatter inalterado em todos os 6 patches (apenas conteúdo de body adicionado/modificado).

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
