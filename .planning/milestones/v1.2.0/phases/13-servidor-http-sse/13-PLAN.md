# Phase 13: Servidor HTTP standalone + SSE endpoint — PLAN

**Tipo:** Server module + entry detached
**REQs cobertos:** SRV-01..07, SRV-10..14, SEC-01, SEC-02 (14 REQs)
**Dependências:** Phase 12 (events, port, lockfile)

## Componentes

### `src/ui/server.js` (~350 LOC)

Factory `createServer({projectRoot, version, idleMs, maxSubscribers, ringSize, staticHtml})` retorna `{start, shutdown, pushEvent, url, port, subscriberCount, eventsTotal}`.

Rotas:
- `GET /` — serve HTML (default loadStaticIndex de src/ui/static/index.html, ou fallback)
- `GET /events` — SSE endpoint (cap 32 subscribers; cleanup triplo; heartbeat 15s; retry 3000)
- `GET /healthz` — `{ok, version, uptime, port, subscribers, eventsTotal}`
- `GET /state` — ring buffer (last 200 events)
- `POST /publish` — valida JSON + schema, emite no bus, retorna 202
- `POST /shutdown` — drena, libera lock, exit

Hardening:
- Bind 127.0.0.1 literal (REQ SRV-01)
- Host header check em todas rotas (REQ SEC-01) — aceita 127.0.0.1:port e localhost:port
- Origin check em non-GET (REQ SEC-02)
- CSP estrito no HTML
- Body cap 64KB em /publish; 413 em overflow
- Connection cleanup triplo (req.on close+error, res.on close+error)
- Idle timer 30min default com unref
- Active sockets tracked + destroyed em shutdown
- Signal handlers (SIGINT, SIGTERM) attached + detached em shutdown
- Logging em process.stderr.write (audit gate Phase 11)

### `bin/ui.js` (~50 LOC)

Entry detached. Args: --project-root, --port, --idle-ms, --version, --help. Chama createServer + start. Exit 2 em ELIVE, exit 1 em outros erros.

### `test/integration/ui-server.test.js` (16 tests)

- HTTP basics: GET /, /healthz
- Host validation: aceita 127.0.0.1+localhost; rejeita evil.example.com
- Publish round-trip: POST /publish → /state contém evento
- Schema rejection: malformed JSON, unknown type, oversized
- Origin validation: rejeita cross-origin POST
- SSE: receives published events live (com publish dentro do test)
- SSE: subscriber count (open → 1, close → 0)
- SSE: cap 503 em conn 33+ (com maxSubscribers=2 pra economizar)
- Connection cleanup: 50 ciclos → subscribers.size === 0
- Misc: 404, constants exposed, CSP shape

### `test/run.mjs` enhancement
Adicionar `--test-force-exit` ao spawn de `--test` pra evitar hang em handles residuais.

## Critérios de sucesso (observáveis)

1. `npm run test:integration` passa com 16 tests novos (total 25 integration)
2. `npm test` mantém 76 unit tests passando
3. `node bin/ui.js --help` exibe usage no stderr, exit 0
4. `node bin/ui.js` sobe servidor; `curl http://127.0.0.1:<porta>/healthz` retorna 200 OK
5. `curl -H "Host: evil.example.com" http://127.0.0.1:<porta>/healthz` retorna 403
6. Audit gate stdout discipline continua passando
7. Process termina cleanly em SIGINT (Ctrl+C); lockfile removido

## Riscos mitigados

- HTTP keep-alive entre tests: `agent: false` + `connection: close` no helper de tests
- Sockets dangling em shutdown: `activeSockets.destroy()` antes de server.close()
- Signal handlers leak entre tests: `removeListener` em shutdown
- Body overflow não pode destruir conn antes de 413 ser enviado: readBody apenas reject, handler envia status

## Riscos remanescentes

- Idle shutdown unref vs production daemon — se user roda `kit ui start --idle-ms 0`, o servidor fica vivo indefinidamente até SIGINT manual. Comportamento esperado.
- Single-instance é per-projectRoot. Multi-projeto = múltiplas portas + múltiplos lockfiles. Sem garbage collection cross-projeto. Aceitável.
