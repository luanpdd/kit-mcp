# Phase 90: verifyManifest Parallel + Cache - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

**PERF-17-01 — verifyManifest sequencial é gargalo de syncTo:**
- Meta-auditoria pós-v1.16.0 mediu: 47% do tempo de syncTo é gasto ANTES do batched write loop, em verifyManifest sequencial.
- 327 SHA256 hashes sequenciais consomem ~123ms.
- Phase 88.01 paralelizou writes (downstream); verifyManifest (upstream) ficou serial.
- Fix com Promise.all batches=16 (mesmo pattern): 82-50ms target.

Combinado com cache em-memória (TTL 30s, mesmo pattern de listKit em Phase 80), watch trigger consecutivo (2º+) usa cache → <5ms.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — `verifyManifest()` continua retornando `{ok, mismatches?, missing?}`.
- Zero regressão (317 baseline pós-v1.16).
- Phase 83 contract preservado.
- Phase 79.01 gates guard preservado.
- CRLF→LF normalize do v1.15 commit 0130c5b PRESERVADO (cross-platform stable).
- Budget 6/6 deps mantido.

### Diretrizes de implementação

**Promise.all batching:**
- Pattern de Phase 88.01: `for (let i=0; i<entries.length; i+=BATCH_SIZE) { await Promise.all(entries.slice(i, i+BATCH_SIZE).map(check)); }`
- BATCH_SIZE=16 hardcoded (Phase 88 já validou). Sem env var nesta fase (overengineering).

**Cache em-memória:**
- Module-level: `let cache = null;`
- Estrutura: `{ kitRoot, timestamp, result }`.
- TTL 30s: se `Date.now() - timestamp > 30000`, recompute.
- Invalidação:
  - Em error path (mismatches > 0): NÃO cachear (sempre recompute).
  - Em ok path: cachear.
- Bypass para tests: env `KIT_MCP_VERIFY_NO_CACHE=1` força recompute.

**CRLF→LF preserved:**
- Linha existente normaliza buffer antes de hash. Manter idêntica.

</decisions>

<code_context>
## Insights do Código Existente

- `src/core/manifest-verify.js` (107 LOC pós-v1.15 fix). For-loop em linhas 53-66 é o ponto crítico.
- `src/core/sync.js:47` chama `verifyManifest(kitRoot)` antes do batched write. Não modifica nada lá.
- `src/core/kit.js` tem pattern de cache TTL para listKit.

</code_context>

<specifics>
## Ideias Específicas

- **Test pattern para parallel:** verificar wall time de verifyManifest em 327-file fixture antes/depois.
- **Test pattern para cache:** chamada 1× → mede; chamada 2× consecutiva → mede e assert <5ms.
- **Test pattern para invalidation:** modifica file, chama, assert no-cache hit.

</specifics>

<deferred>
## Ideias Adiadas

- Worker threads para hash — tested benefit é negativo (files pequenos, I/O bound).
- LRU cache multi-kitRoot — overengineering (single root é caso comum).

</deferred>
