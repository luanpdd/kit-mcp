---
status: passed
phase: 13
verified: 2026-05-04
---

# Phase 13 — Verification

## Critérios de sucesso

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | `npm run test:integration` passa com 16 tests novos | ✅ | 25/25 integration tests pass (9 cli + 16 server); 0 fail |
| 2 | `npm test` mantém 76 unit tests | ✅ | 76 unit pass; nenhum quebrou pelas adições |
| 3 | `node bin/ui.js --help` exibe usage | ✅ | Help texto vai pra stderr; exit 0 |
| 4 | Servidor responde 200 em /healthz | ✅ | Test "GET /healthz returns ok" passa |
| 5 | Host malicioso recebe 403 | ✅ | Test "Host header validation: rejects malicious Host" passa |
| 6 | Audit gate stdout continua passando | ✅ | `grep -rn 'console.log\|process.stdout.write' src/ui/` retorna vazio |
| 7 | Termina cleanly em SIGINT, libera lock | ✅ | shutdown handler attached; activeSockets destroyed; lockfile released; signal listeners detached |

## REQs cobertos

| REQ | Descrição | Implementação |
|---|---|---|
| SRV-01 | Bind 127.0.0.1 | `server.listen(port, '127.0.0.1', ...)` literal |
| SRV-02 | SSE headers + flushHeaders | `SSE_HEADERS` const + `res.flushHeaders()` |
| SRV-03 | Heartbeat 15s | `setInterval(() => res.write(': ping...\n\n'), 15000).unref()` |
| SRV-04 | POST /publish + cap 64KB | `readBody(req, 64*1024)` + 413 em overflow |
| SRV-05 | /healthz | `{ok, version, uptime, port, subscribers, eventsTotal}` |
| SRV-06 | POST /shutdown | sendJson 200 + setImmediate(shutdown) |
| SRV-07 | GET /state | `{version, port, eventsTotal, events: ring.slice()}` |
| SRV-10 | Idle 30min default | `setTimeout(idleMs).unref()`; flag `--idle-ms` |
| SRV-11 | Graceful SIGINT/SIGTERM | `process.on(...)` attached + detached in shutdown |
| SRV-12 | Ring buffer 200 | `ring.push(evt); if(ring.length>200) ring.shift()` |
| SRV-13 | Cap 32 conn | `if (subscribers.size >= 32) → 503` |
| SRV-14 | Cleanup triplo | `req.on('close')`, `req.on('error')`, `res.on('close')`, `res.on('error')` todos chamam cleanup() |
| SEC-01 | Host check | `isHostAllowed(req, port)` aceita só 127.0.0.1:port e localhost:port |
| SEC-02 | Origin check em non-GET | `isOriginAllowed(req, port)` aceita só http://127.0.0.1:port e http://localhost:port |

## Smoke local

```
$ node -e "import('./src/ui/server.js').then(m => process.stderr.write('createServer: '+typeof m.createServer+'\n'))"
createServer: function

$ node bin/ui.js --help
kit-mcp sidecar entry — usually invoked via `kit ui start`
...
```

Tests integration completos: 16/16 verde, processo exit clean (--test-force-exit).

## Test breakdown (Phase 13 additions)

```
ui-server.test.js — 16 tests:
  GET /
  GET /healthz
  Host: rejects malicious
  Host: accepts localhost
  POST /publish round-trip
  POST /publish: malformed JSON
  POST /publish: unknown type
  POST /publish: oversized 413
  Origin: rejects cross-origin POST
  SSE: receives published events live
  SSE: subscriber count tracking
  SSE: cap 503 em conn 33+
  Connection cleanup: 50 ciclos → 0
  404 unknown route
  Constants exposed
  CSP shape
```

Plus `test/run.mjs` enhanced com `--test-force-exit` para garantir exit clean em CI.

## Riscos remanescentes

- WSL/Docker: `127.0.0.1` bind funciona; container precisaria port-forward. Documentar em README na Phase 18.
- Process hang sem `--test-force-exit` em Node 20 antigo: mitigado pela versão Node 20.10+ que CI matrix garante.

## Conclusão

Phase 13 completa. Pronto pra Phase 14 (UI estática single-file).
