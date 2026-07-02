# Phase 88: Concurrent I/O - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

Fechar 3 bottlenecks de I/O sequencial identificados pela meta-auditoria:

**PERF-16-01 (P1 — sync writes sequenciais):**
- `src/core/sync.js` `syncTo()` faz `for (const op of ops) await fs.writeFile(...)` — ~150 ops sequenciais.
- Wall time: 50-70% do total é I/O blocking. Disk pode lidar com paralelismo.
- Solução: `Promise.all` em batches de 16 (limite para evitar EMFILE em workspace grande).

**PERF-16-02 (P3 — watch.js cache invalidation):**
- `chokidar.watch(kitRoot, { awaitWriteFinish: 100ms })` + `clearKitCache` no event handler.
- Em edit-burst (10 saves rápidos durante save de IDE), cache é invalidado 10× consecutivamente.
- Solução: debounce 500ms — coalescer múltiplos events em 1 invalidação.

**PERF-16-03 (P4 — reverse-sync walks):**
- `src/core/reverse-sync.js` faz walks de kit/ e target/ sequencialmente.
- ~20% wall time recuperável paralelizando.
- Solução: `Promise.all` em vez de await sequencial nos 2 walks.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — sync semantics inalterada (ordering de ops dentro do batch não importa para consumers).
- Zero regressão (299 baseline pós-v1.15).
- Phase 79.01 gates.run guard preservado.
- Phase 82-84 hardening preservado (CSP, requireAuth, manifest verify, error sanitization).
- Budget 6/6 deps mantido.

### Diretrizes de implementação

**PERF-16-01 (sync Promise.all):**
- `syncTo()`: `const BATCH_SIZE = 16; for (let i = 0; i < ops.length; i += BATCH_SIZE) { await Promise.all(ops.slice(i, i+BATCH_SIZE).map(applyOp)); }`
- Preserve onProgress callback — chamar uma vez por batch (ou por op se desejado fine-grained).
- Se um op no batch falha, falha o batch inteiro (Promise.all rejeita no primeiro reject) — comportamento aceitável; sync.js já não tem retry logic.
- BATCH_SIZE=16 é palpite — o disk geralmente lida bem com 16 paralelos sem trash. Configurable via env `KIT_MCP_SYNC_BATCH_SIZE`?

**PERF-16-02 (watch debounce):**
- Add `let invalidationTimer = null;` no scope do watch.
- No event handler: `clearTimeout(invalidationTimer); invalidationTimer = setTimeout(() => clearKitCache(), 500);`
- Verifica que awaitWriteFinish pre-existing não conflita.

**PERF-16-03 (reverse-sync paralelo):**
- Identificar pontos de await sequencial nos 2 walks. Substituir por `Promise.all([walkKit(), walkTarget()])`.
- Cuidar com error handling — se um walk falha, qual erro propaga? Documentar.

### Cuidados especiais

**Race conditions:**
- sync.js Promise.all dentro de batch: write writes podem reordenar. Se 2 ops escrevem mesmo arquivo (não deveria, mas...), last-write-wins. Validar via test.
- watch.js debounce: pode mascarar erros — se 10 events vêm de saves diferentes, um falhou, debounce coalescing pode atrasar visibility. Aceitável (cache invalidation é eventual consistency).

**Phase 83 verifyManifest preservation:**
- sync.js chamou `verifyManifest()` em v1.14 Phase 83. Concurrent ops abaixo NÃO devem tocar essa chamada — ela continua antes de qualquer write.

**Performance benchmarks:**
- Test pattern: medir wall time de `kit sync install claude-code` em workspace fixture com ≥30 files. Comparar antes/depois.
- Pode usar `process.hrtime.bigint()` para measurement preciso.

</decisions>

<code_context>
## Insights do Código Existente

- `src/core/sync.js` foi tocado em v1.13 (slim cap), v1.14 (verifyManifest), v1.15 (refactor para summarize export).
- `src/core/watch.js` é arquivo focado em chokidar — pequeno (~50 LOC esperado).
- `src/core/reverse-sync.js` é o maior file core (~355 LOC).
- chokidar tem own debouncing via `awaitWriteFinish` mas não cobre cache invalidation downstream.

</code_context>

<specifics>
## Ideias Específicas

- **BATCH_SIZE=16** é palpite — mas razoável. Linux ulimit default 1024 file descriptors; 16 é safe margin. macOS/Windows similares.
- **Configurable via env var:** `KIT_MCP_SYNC_BATCH_SIZE` — feature aditiva, doc no SUMMARY mas não obrigatório.
- **Test pattern para race condition:** spawn 2 syncTo concurrent (mesmo target dir), assert no torn writes.

</specifics>

<deferred>
## Ideias Adiadas

- Streaming sync (chunk-based) — overengineering para workspace típico <500 files.
- Worker threads para hash computation no manifest verify — Phase 83 já é fast enough.
- Diff-based sync (only changed files) — separate problem, v1.17+.

</deferred>
