# Phase 13: Servidor HTTP standalone + SSE endpoint — Summary

**Concluída:** 2026-05-04
**Tipo:** Server module + entry detached
**REQs entregues:** 14/14 (SRV-01..07, 10..14, SEC-01, SEC-02)

## Entregue

| Arquivo | Tipo | LOC |
|---|---|---|
| `src/ui/server.js` | Factory + lifecycle | ~370 |
| `bin/ui.js` | Entry point detached | ~70 |
| `test/integration/ui-server.test.js` | Integration tests | 16 tests |
| `test/run.mjs` | Enhanced com `--test-force-exit` | +5 LOC |

## Tests

| Antes | Depois | Δ |
|---|---|---|
| 76 unit + 9 integ = 85 | 76 unit + 25 integ = **101** | +16 integ |

## Decisões de implementação relevantes

1. **Bus EventEmitter intra-server** — não cross-process. Publishers (CLI/MCP) atravessam HTTP via `/publish`; o EventEmitter só relaya internamente pra subscribers SSE. Decisão alinha com SUMMARY (síntese da pesquisa).
2. **`activeSockets` Set + destroy em shutdown** — http.Server.close() respeita keep-alive; sem destruir sockets, server.close() pode esperar 5s ou mais. Trackamos sockets em `connection` event e destruímos no shutdown.
3. **Cleanup quádruplo (não triplo)** — pesquisa mencionou `req.on('close')`, `req.on('error')`, `res.on('close')`. Adicionei `res.on('error')` também — em alguns runtimes (Windows http2-fallback) só este dispara em socket-level error.
4. **`--test-force-exit` no test runner** — ajuda CI a finalizar limpo mesmo com handles residuais. Sem isso, integration tests do servidor poderiam hangs após "all tests passed".
5. **`readBody` não destrói o request em overflow** — apenas reject. Handler ainda consegue enviar 413. Sem isso o cliente recebe ECONNRESET.

## Validações de segurança implementadas

- Bind 127.0.0.1 literal — testado
- Host check em todas rotas — testado
- Origin check em POST /publish — testado
- CSP estrito no HTML — testado
- Cap 64KB no body — testado (413)
- Cap 32 SSE conn — testado (503)
- Heartbeat 15s — comentado (não testado pq leva 15s real)
- Idle 30min — comentado, default 30min, flag `--idle-ms 0` desabilita

## Próxima fase

Phase 14 — UI estática (HTML/CSS/JS single-file).

Vai escrever `src/ui/static/index.html` (~300 LOC) com:
- Lista cronológica de eventos com auto-scroll
- Badges coloridos por tipo
- Status conexão (CONNECTING/OPEN/CLOSED)
- Filter (multi-select tipo + substring)
- Pause/resume + contador
- Detail expand via `<details>` nativo
- Dark mode automático via `prefers-color-scheme`
- Banner shutdown
- Hydrate via /state on load

Server já serve em /, falta o conteúdo real (atualmente fallback placeholder).
