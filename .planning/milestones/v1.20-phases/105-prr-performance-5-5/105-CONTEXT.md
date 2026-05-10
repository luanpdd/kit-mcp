# Fase 105: PRR Performance 4/5 → 5/5 - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Elevar PRR Performance axe de 4/5 → 5/5 via warm-up estratégico do kit cache no boot do MCP server (move work cold-path do primeiro dispatch para boot). Re-medir M4 com N=30 dispatches. Update BENCHMARK.md com novo p95. Atualizar PRR-RECHECK.md com Performance 5/5.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude

**Diagnóstico atual (BENCHMARK.md M4):**
- p50: 0ms (cache warm)
- p95: 144.55ms (primeiros 1-2 cold dispatches)
- p99: 146.42ms

**Origem do cold latency:** primeiro dispatch ao tool `kit` chama `listKit(BUNDLED_KIT_ROOT)` que lê 3 dirs (agents/commands/skills) + parsea frontmatter de ~180 arquivos.

**Solução: pre-warm cache no boot.** Após `server.connect(transport)`, fire-and-forget invoke `listKit(BUNDLED_KIT_ROOT)` → cache warm BEFORE primeira request. Custo zero pra boot path (ainda async, não bloqueia connect).

**Pattern:**
```js
// Após server.connect:
await server.connect(transport);
// PRR Phase 105: pre-warm kit cache to keep MCP dispatch p95 < 100ms.
// Fire-and-forget — failure here is non-fatal (next dispatch will lazily populate).
listKit(BUNDLED_KIT_ROOT).catch(() => {});
```

**Risco:** se o MCP client envia tool/call ANTES do warm-up completar, dispatch ainda paga cold latency. Mas isso é race interpretation — first dispatch latency é ainda comparável ao caso atual. p95 com N=30 será dominado por warm dispatches (28+) → drop substancial.

**Re-measure:** M4 com N=30 deve ver p95 < 100ms (target 5/5). Se não atingir, fallback decisions:
1. Add explicit await — bloqueia connect até cache warm. Custo: ~150ms boot delay (one-time, not per-dispatch).
2. Mover listKit para top-level await (módulo ESM). Mesmo efeito.

**Update BENCHMARK.md:** acrescentar new run table (não deletar existing — versionar inline `# v1.20.0`).

</decisions>

<code_context>
## Insights do Código Existente

`src/mcp-server/index.js:20`: `import { listKit, ... } from '../core/kit.js';`
`src/core/kit.js`: tem `kitCache` TTL 30s. Primeira chamada faz disk read; subsequent retorna cache.
`BUNDLED_KIT_ROOT`: probably exported from kit.js.
`src/mcp-server/index.js`: server boot pattern — server.connect + tools registered.

Pre-warm pattern já existente em outros services. Phase 16 (v1.16.1) adicionou cache TTL pattern. Phase 88 (v1.16) paralelizou writes. Esta é a peça final.

</code_context>

<specifics>
## Ideias Específicas

REQ SRE-20-02. Critérios de sucesso explícitos no ROADMAP.md:
- Chokidar config (e demais deps opcionais) auditadas e tuned para lazy-load — JÁ FEITO Phase 16/89 (chokidar lazy via watch.js, @inquirer/prompts lazy)
- MCP roundtrip p95 sub-100ms verificado em BENCHMARK.md (vs 144ms baseline = ≥30% redução)
- BENCHMARK.md atualizado com M4 v1.20.0 row
- PRR-RECHECK.md updated: Performance 4/5 → 5/5
- Total PRR: 30/30

</specifics>

<deferred>
## Ideias Adiadas

- Cold-start CLI sub-200ms (M1) — current 232ms; require lazy-load do commander, mais agressivo
- M3 RSS reduction (53MB → ≤30MB) — diminishing returns, V8 floor
- Tarball size optimization (M5) — 1.1MB já saudável

</deferred>
