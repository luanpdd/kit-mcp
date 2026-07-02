# Fase 40: Patches em fluxo framework - Contexto

**Coletado:** 2026-05-07
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Patches editoriais — adicionar blocos `<sre_integration>` em 3 comandos framework para viabilizar uso real dos artefatos das ondas anteriores. Frontmatter NÃO alterado.

**Patches:**
1. `kit/commands/forense.md` — bloco `<sre_integration>` sugerindo chain `/postmortem` automaticamente após Core Analysis Loop fechar com root cause (INT-FW-V2-01)
2. `kit/commands/concluir-marco.md` — gate PRR opcional via `workflow.complete_milestone_prr_gate=true`; exige PRR-REPORT.md com status passed para features production-bound (INT-FW-V2-02)
3. `kit/commands/auditar-marco.md` — invoca `/auditar-toil` automaticamente quando `workflow.audit_milestone_toil=true`; resultado alimenta scoring OMM Capacidade 3 (INT-FW-V2-03)

**REQs cobertos (3):** INT-FW-V2-01, INT-FW-V2-02, INT-FW-V2-03

**Dependência:** Phases 36-39 concluídas — ✅ atendida.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas são de discrição do Claude. Patches editoriais — workflows em `.claude/framework/workflows/*.md` continuam funcionais como antes (não alterar). Apenas comandos em `kit/commands/` recebem blocos sugestivos.

</decisions>

<code_context>
## Insights do Código Existente

Arquivos a patchear:
- `kit/commands/forense.md` — comando v1.9 existente
- `kit/commands/concluir-marco.md` — comando framework existente
- `kit/commands/auditar-marco.md` — comando framework existente

Comandos v1.10 referenciados (Phase 38):
- `/postmortem` (kit/commands/postmortem.md) — invoca postmortem-writer
- `/prr` (kit/commands/prr.md) — invoca prr-conductor
- `/auditar-toil` (kit/commands/auditar-toil.md) — invoca toil-auditor

</code_context>

<specifics>
## Ideias Específicas

Frontmatter (`description`, `allowed-tools`) INALTERADO nos 3 commands. Patches são editoriais (sugestões + flags de config opcionais).

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
