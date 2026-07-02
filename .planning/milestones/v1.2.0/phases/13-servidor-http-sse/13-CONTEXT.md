# Phase 13: Servidor HTTP standalone + SSE endpoint - Contexto

**Coletado:** 2026-05-04
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (contexto fechado em REQUIREMENTS + ADR + research; sem áreas cinzas restantes)

<domain>
## Limite da Fase

Servidor HTTP standalone que aceita publishers via POST e relaya pra SSE subscribers. Single módulo `src/ui/server.js` + entry detached `bin/ui.js`.

REQs cobertos: SRV-01 (bind 127.0.0.1), SRV-02 (SSE headers + flushHeaders), SRV-03 (heartbeat 15s), SRV-04 (POST /publish + cap 64KB), SRV-05 (/healthz), SRV-06 (/shutdown), SRV-07 (/state), SRV-10 (idle 30min), SRV-11 (graceful SIGINT/SIGTERM), SRV-12 (ring buffer 200), SRV-13 (cap 32 conexões), SRV-14 (cleanup triplo), SEC-01 (Host check), SEC-02 (Origin check).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude (registradas no ADR Phase 11)
- Bind 127.0.0.1 literal (nunca 'localhost' nem '0.0.0.0')
- Headers SSE: `text/event-stream; charset=utf-8`, `no-cache, no-transform`, `keep-alive`, `X-Accel-Buffering: no`
- Heartbeat: `: ping <ts>\n\n` cada 15s
- `retry: 3000\n\n` enviado uma vez no início (hint do EventSource)
- Ring buffer: 200 eventos (FIFO), in-memory only
- Cap: 32 conexões SSE; 33+ recebe 503
- Idle shutdown: 30min default, `--idle-ms 0` desabilita
- CSP: estrito self-only no HTML, frame-ancestors 'none'
- Logging: stderr only (audit gate Phase 11 ativo)

### Cleanup triplo (REQ SRV-14)
Cada subscriber registra cleanup em `req.on('close')`, `req.on('error')`, `res.on('close')`, `res.on('error')`. Garante remoção do Set mesmo se o runtime reportar fechamento por canais diferentes.

### Bus interno via EventEmitter
Publishers (CLI/MCP) → POST /publish → server interno EventEmitter → SSE clients. Bus é intra-server (não cross-process). Cross-process é feita por HTTP, evitando IPC platform-específico.

</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `src/ui/events.js` — schema, makeEvent, validateEvent, EVENT_TYPES (Phase 12)
- `src/ui/port.js` — findFreePortOrThrow (Phase 12)
- `src/ui/lockfile.js` — acquireLockOrReclaim, releaseLock (Phase 12)
- `node:http` builtin — http.Server, retorna ServerResponse com flushHeaders
- `node:events` builtin — EventEmitter

### Padrões Estabelecidos
- ESM puro, imports de `node:*` ou paths locais com `.js`
- Tests em `test/integration/` para módulos com I/O de rede; unit tests para módulos puros
- Audit gate Phase 11: nada de console.log em src/ui/ (process.stderr.write OK)

### Pontos de Integração
- `bin/ui.js` (Phase 13) é o entry; `kit ui start` (Phase 16) chama via `child_process.spawn`
- `src/ui/client.js` (Phase 15) consome /publish endpoint
- `src/ui/static/index.html` (Phase 14) consome /events e /state

</code_context>

<specifics>
## Ideias Específicas

- Endpoint /shutdown deve responder 200 ANTES de fechar (caso contrário o cliente curl recebe ECONNRESET sem entender). Implementação: `setImmediate(shutdown)` após sendJson.
- POST /publish responde 202 Accepted (não 200), indicando "aceito assincronamente pelo bus" — semântica HTTP correta.
- Cleanup deve ser idempotente — usar `subscribers.has(sub)` antes de remover.

</specifics>

<deferred>
## Ideias Adiadas

- Last-Event-ID replay (RFC compliance) — descartado por SUMMARY decision; UI usa /state pra hydrate.
- Compression (gzip) no SSE — overhead pequeno, não vale a complexidade.
- Multi-port discovery (broadcast a porta livre) — single-instance lockfile cobre o caso.

</deferred>
