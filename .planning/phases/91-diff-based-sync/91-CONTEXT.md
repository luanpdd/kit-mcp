# Phase 91: Diff-Based Sync - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)
**Depends on:** Phase 90 ✅

<domain>
## Limite da Fase

**PERF-17-02 — Sync sem diff é O(N) sempre:**
- `kit sync install` 2× consecutive em workspace estável: 2ª vez escreve TODOS os 323 files (163ms).
- `kit sync watch` dispara isso a cada 500ms se houver edits.
- Stat-based diff (mtime + size) skip files cujo destination já bate.
- Win esperado: 2ª chamada ≤30% do tempo da 1ª (~49ms vs 163ms baseline).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — `syncTo()` continua retornando `{ ok, ops }` (mesma shape).
- Phase 88.01 Promise.all batches preservado.
- Phase 83 verifyManifest preservado (chamado ANTES do diff check).
- Phase 90 cache em verifyManifest preservado.
- Zero regressão (322 baseline pós-Phase 90).
- Budget 6/6 deps mantido.

### Diretrizes de implementação

**Diff strategy:**
- Para cada op: `fs.stat(target)` se existe.
- Se target não existe → não skip (write normal).
- Se target existe: comparar `mtimeMs` + `size` com source. Se ambos batem, skip.
- Edge case: source touched sem write modifica mtime mas size bate. Aceitável (forçado opt-out via env).

**Opt-out:**
- `KIT_MCP_FORCE_FULL_SYNC=1` → skip diff, write all (cleanup/recovery).

**onProgress callback:**
- Manter granularidade. Para skipped files, chamar onProgress com `{ skipped: true }`.

**Test pattern:**
- 2× consecutive sync benchmark (1ª vs 2ª)
- Edit em 1 file → next sync escreve apenas o 1
- env opt-out força full sync
- onProgress recebe `skipped: true`

</decisions>

<code_context>
## Insights do Código Existente

- `src/core/sync.js` syncTo() pós-v1.16 usa Promise.all batches=16. Diff check ANTES do batch loop.
- Pattern fs.stat já presente em outros lugares de sync.js.
- onProgress já tem hook estabelecido (Phase 88).

</code_context>

<specifics>
## Ideias Específicas

- Se source mtime > target mtime → write (source is newer)
- Se source mtime ≤ target mtime AND source size === target size → skip
- Se source size !== target size → write (content changed even with same mtime)

</specifics>

<deferred>
## Ideias Adiadas

- Hash-based diff (slower mas accurate em casos raros) — overengineering. mtime+size suficiente.
- Diff por inode (hardlinks) — não relevante para kit-mcp use case.

</deferred>
