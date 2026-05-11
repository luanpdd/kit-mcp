# Fase 155: Cross-suite enrichment + Release artifacts v1.27 - Contexto

**Coletado:** 2026-05-11
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Fase consolidadora (XS + REL). Duas naturezas:

**Cross-suite enrichment (3 agents v1.x ganham awareness branching):**
- **XS-01**: `supabase-architect` (v1.8) ganha seção upfront sobre branching strategy decision + alerta custo Branching Compute
- **XS-02**: `supabase-migration-writer` (v1.23) ganha warnings sobre concurrent `db push` + timestamp order após rebase
- **XS-03**: `release-pipeline-auditor` (v1.10) ganha branching workflow validation

**Release artifacts:**
- **REL-01**: AUTOGEN-COUNTS regen no README.md (64→66 agents, 71→76 skills)
- **REL-02**: file-manifest regen (375→382 esperado)
- **REL-03**: CHANGELOG v1.27 entry
- **REL-04**: glossário compartilhado +10 termos
- **REL-05**: package.json bump 1.26.0→1.27.0

Entregar 8 REQs: XS-01..03 + REL-01..05.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
- XS edits são pequenos patches (1-2 seções novas em cada agent) — usar Edit tool, não Write
- Regen scripts: `node scripts/regen-manifest.js` + `node scripts/update-readme-counts.js`
- CHANGELOG segue pattern dos releases anteriores (Keep a Changelog format)
- Glossário em `kit/skills/_shared-supabase/` (se existir)

</decisions>

<code_context>
## Insights do Código Existente

Scripts:
- `scripts/regen-manifest.js` — regenera kit/file-manifest.json
- `scripts/update-readme-counts.js` — regenera bloco AUTOGEN-COUNTS no README.md

Glossário compartilhado: `kit/skills/_shared-supabase/`

</code_context>

<specifics>
## Ideias Específicas

10 termos novos para glossário:
1. Branching workflow (Supabase)
2. Preview branch
3. Persistent branch
4. Deploy DAG (7 steps)
5. [remotes] block
6. dotenvx encrypted fields
7. pgTAP testing
8. Migration repair
9. Schema drift
10. Branching Compute Hours

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma.

</deferred>
