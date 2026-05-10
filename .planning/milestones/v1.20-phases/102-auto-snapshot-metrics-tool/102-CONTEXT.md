# Fase 102: Auto-snapshot em metrics-snapshot Tool - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Modificar `handleMetricsSnapshot()` em `src/mcp-server/index.js` para invocar `persistSnapshot()` automaticamente antes de retornar o snapshot in-memory. Idempotência via guard temporal (in-memory `lastPersistTs`) — chamadas dentro de 1s reusam snapshot anterior sem escrever novo arquivo. Comportamento gracioso em erro de fs (handler retorna payload normal mesmo se persist falhar).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude

**Pattern:** wrap existing handler com try/catch volta de persistSnapshot:
```js
let lastPersistTs = 0;
const PERSIST_THROTTLE_MS = 1000;

async function handleMetricsSnapshot() {
  const snap = metricsSnapshot();
  const now = Date.now();
  if (now - lastPersistTs >= PERSIST_THROTTLE_MS) {
    try {
      await persistSnapshot();
      lastPersistTs = now;
    } catch (err) {
      // graceful — log para stderr, não falha o handler
      process.stderr.write(`[kit-mcp] auto-snapshot persist failed: ${err.message}\n`);
    }
  }
  return snap;
}
```

**Why throttle 1s:** evitar que clientes que fazem polling rápido criem N arquivos por segundo. 1s é generoso (real polling typicamente 30s+). Estado em-memory do server lifetime — reset on restart.

**Stable API:** signature inalterada, return shape inalterado. Adição interna pura.

**Tests:** 4 cenários canônicos:
1. Primeira chamada → persist (file count +1)
2. Segunda chamada < 1s → reuse (file count unchanged)
3. Terceira chamada > 1s → persist (file count +1)
4. fs error mock → handler ainda retorna payload normal

</decisions>

<code_context>
## Insights do Código Existente

`metricsSnapshot()` exportada de `src/core/metrics.js`. `persistSnapshot()` já existe e é usado por `kit/commands/burn-rate-status.md` consumindo via Skill. Phase 99 (v1.19) implementou persistSnapshot/loadSnapshots/cleanup com retention 30d. Neste fase, o trigger automático fecha o gap operacional.

Existing handler at `src/mcp-server/index.js:308-313` é parameterless e síncrono internamente (wrapped em async).

</code_context>

<specifics>
## Ideias Específicas

REQ OBS-20-01. Critérios de sucesso explícitos no ROADMAP.md:
- Handler MCP invoca `persistSnapshot()` antes de retornar payload, mesmo handler
- Idempotência garantida — segunda chamada < 1s reusa snapshot anterior (in-memory `lastPersistTs` guard)
- Regression tests cobrem 4 cenários: (a) primeira persiste, (b) <1s reusa, (c) >1s persiste novo, (d) fs error não crasha handler
- `.planning/metrics/snapshots/` populado automaticamente sem trigger manual
- Stable API v1.0+ preservada — payload de retorno mantém shape

</specifics>

<deferred>
## Ideias Adiadas

- Auto-snapshot em outros tool calls (e.g. cada `kit` chamada) — fora do escopo, só metrics-snapshot
- Métricas persistentes cross-restart (sql/redis backend) — substancial v1.21+
- Compressão de snapshots antigos (gzip de >7d) — minor opt v1.21+

</deferred>
