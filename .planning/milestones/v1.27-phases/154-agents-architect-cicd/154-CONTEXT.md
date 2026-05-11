# Fase 154: Agents novos `supabase-branching-architect` + `supabase-cicd-pipeline-implementer` - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Criar 2 agents novos em `kit/agents/`:

1. **`kit/agents/supabase-branching-architect.md`** — Projeta estratégia branching ANTES do setup. Coleta decisões via AskUserQuestion (GitHub vs Dashboard, persistent vs ephemeral, seed strategy, secret strategy). Produz `BRANCHING-DESIGN.md`. Cross-suite delega para `supabase-architect` (handoff cooperativo herdado v1.23).

2. **`kit/agents/supabase-cicd-pipeline-implementer.md`** — Recebe `BRANCHING-DESIGN.md` como input + materializa os 7-8 workflows GitHub Actions (.github/workflows/). Cross-suite handoff para `supabase-migration-writer` (v1.23) + `release-pipeline-auditor` (v1.10). Verdicts GO/STRENGTHEN/REWRITE-com-confirmação (pattern canônico v1.23).

Entregar 10 REQs: ARCH-01..05 + CICD-01..05.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Pattern canônico v1.26 (`supabase-roles-implementer.md` como referência estrutural — 355 linhas).

Princípio canônico herdado v1.23 (handoff cooperativo): agents Supabase materializam, não descartam upstream. Pattern v1.23 STRENGTHEN/REWRITE confirmando com user antes de descartar.

</decisions>

<code_context>
## Insights do Código Existente

Agents Supabase existentes que serão cross-suite targets:
- `supabase-architect` (v1.8) — para ARCH-05 handoff
- `supabase-migration-writer` (v1.23) — para CICD-03 handoff
- `release-pipeline-auditor` (v1.10) — para CICD-04 handoff

Agents Supabase como pattern de referência (v1.23-v1.26):
- `supabase-rls-hardener.md` (v1.23)
- `supabase-column-privileges-writer.md` (v1.24)
- `supabase-rbac-implementer.md` (v1.25)
- `supabase-roles-implementer.md` (v1.26) — REFERÊNCIA CANÔNICA mais recente

</code_context>

<specifics>
## Ideias Específicas

- ARCH agent: AskUserQuestion para 4 decisões + produzir BRANCHING-DESIGN.md
- CICD agent: lê BRANCHING-DESIGN.md + materializa 7-8 workflows (referência aos workflows do skill Phase 151)
- Ambos agents seguem verdicts GO/STRENGTHEN/REWRITE
- Cross-suite handoff explícito documentado no agent body

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma.

</deferred>
