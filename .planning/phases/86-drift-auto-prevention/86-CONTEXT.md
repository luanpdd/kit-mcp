# Phase 86: Drift Auto-Prevention - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)
**Depends on:** Phase 85 ✅

<domain>
## Limite da Fase

Eliminar 2 fontes de drift recorrente que v1.13/v1.14 mitigaram estaticamente — automatizando regeneração via `prepublishOnly` hook:

**DX-15-01 — README counters auto-gen:**
- v1.13 Phase 81.02 substituiu hardcoded counters (47/87/49/20) estaticamente.
- Cada nova fase que adiciona/remove agents/commands → drift de novo.
- Solução: bloco `<!-- AUTOGEN-COUNTS-START -->...<!-- AUTOGEN-COUNTS-END -->` no README + script `scripts/update-readme-counts.js` rodado no prepublishOnly.

**DX-15-02 — Manifest auto-regen:**
- v1.13 Phase 81 + v1.14 Phase 83 regeneraram manifest manualmente. v1.15 Phase 85 regenerou de novo.
- Cada mudança em kit/ → manifest stale → Phase 83 verifyManifest bloqueia sync.
- Solução: `scripts/regen-manifest.js` standalone + chamada no prepublishOnly.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — scripts são internal tooling, não exposed.
- Zero regressão (282 baseline pós-Phase 85).
- Budget 6/6 deps mantido — scripts usam só Node stdlib (fs, path, crypto, glob via fs.readdir recursive).

### Diretrizes de implementação

**`scripts/update-readme-counts.js`:**
- Lê: `kit/agents/*.md`, `kit/commands/*.md`, `kit/skills/**/SKILL.md`, `gates/*.md`.
- Conta cada categoria.
- Lê README.md, encontra bloco `<!-- AUTOGEN-COUNTS-START -->...<!-- AUTOGEN-COUNTS-END -->`, substitui conteúdo.
- Idempotente: se counts já corretos, no-op (zero diff).

**`scripts/regen-manifest.js`:**
- Lê todos arquivos em `kit/` matching glob distribuído (mesmo dos `package.json files[]`).
- Computa SHA256 de cada.
- Escreve `kit/file-manifest.json` com schema atual ({version, generated_at, files: {path: hash}}).
- Idempotente.

**`package.json prepublishOnly`:**
- Atual: `node test/run.mjs test/unit && node test/run.mjs test/integration`.
- Novo: `node scripts/regen-manifest.js && node scripts/update-readme-counts.js && node test/run.mjs test/unit && node test/run.mjs test/integration`.
- Ordem importa: regen ANTES dos tests (Phase 83 verifyManifest gate vai validar).

**README.md:**
- Adicionar bloco `<!-- AUTOGEN-COUNTS-START -->\n47 agents · 87 commands · 49 skills · 20 gates\n<!-- AUTOGEN-COUNTS-END -->` (ou similar) substituindo TODOS os contadores estáticos.
- Múltiplos lugares no README — pode usar 1 bloco único + reference, ou múltiplos blocos com IDs.

**CI gate:**
- Adicionar step em ci.yml smoke job: `node scripts/update-readme-counts.js && node scripts/regen-manifest.js && git diff --exit-code` — falha se prepublishOnly geraria mudança não-commitada (forçando dev a rodar localmente antes).

</decisions>

<code_context>
## Insights do Código Existente

- `src/core/manifest-verify.js` (Phase 83) tem helper de hash — pode reusar logic.
- README.md atual (~33KB pré v1.13, agora ~atualizado pós-Phase 81.02).
- `package.json files[]` define o que vai no tarball — usar mesmo glob para manifest gen.

</code_context>

<specifics>
## Ideias Específicas

- **Pattern dos blocos AUTOGEN:** seguir convenção comum (`<!-- AUTOGEN-X-START -->...<!-- AUTOGEN-X-END -->`) compatível com markdown lint.
- **Fail mode:** scripts retornam exit 1 se erro (file not found, parse fail). prepublishOnly aborta release.
- **Test pattern:** unit test que cria temp kit/, roda script, valida output. Integration test em CI que git diff retorna empty pós-script.

</specifics>

<deferred>
## Ideias Adiadas

- README hot reload em watch mode — overengineering.
- Manifest signing (não só hash) — overkill, escopo cripto separado.
- Counts em multiple languages (pt-BR vs en) — only EN agora; v1.16+.

</deferred>
