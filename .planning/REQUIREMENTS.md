# REQUIREMENTS — kit-mcp v1.2

**Milestone:** v1.2 — GUI sidecar de acompanhamento (web localhost + SSE)
**Aberto em:** 2026-05-04
**Status:** Definindo

> Stack já decidida: HTTP + SSE puro Node, +1 dep (`open@11`), HTML/JS estático sem build, sidecar opt-in, Stable API v1.0+ preservada.

---

## Requisitos do Milestone v1.2

### SRV — Servidor HTTP localhost & SSE

- [ ] **SRV-01**: Servidor HTTP escuta em `127.0.0.1` literal (nunca `'localhost'`, nunca `'0.0.0.0'`), porta auto-detectada na faixa **7100-7199** com fallback até a primeira livre.
- [ ] **SRV-02**: Endpoint `GET /events` emite stream Server-Sent Events com headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`, e dispara `flushHeaders()` imediatamente.
- [ ] **SRV-03**: Heartbeat `: ping\n\n` enviado a cada 15s pra manter conexão viva atrás de proxies/AV.
- [ ] **SRV-04**: Endpoint `POST /publish` aceita JSON de evento e o emite no bus interno; valida payload contra schema mínimo `{type, ts, ...}`; rejeita >64KB com 413.
- [ ] **SRV-05**: Endpoint `GET /healthz` retorna `200 OK` com `{version, uptime, port, subscribers}` pra probe.
- [ ] **SRV-06**: Endpoint `POST /shutdown` (auth via Host header check) drena conexões SSE, libera lockfile, encerra processo.
- [ ] **SRV-07**: Endpoint `GET /state` retorna ring buffer atual (últimos 200 eventos) pra hydrate-on-load do client.
- [ ] **SRV-08**: Lockfile single-instance em `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)>.lock`, criado com `fs.openSync('wx')` (atômico), conteúdo `{pid, port, version, startedAt}`.
- [ ] **SRV-09**: Stale lockfile detectado via `process.kill(pid, 0)` + healthz HTTP probe; ESRCH/EPERM ou healthz fail → unlink + retry start.
- [ ] **SRV-10**: Idle shutdown automático após **30min** sem eventos novos E sem clientes SSE conectados; flag `--idle-ms` permite customização (`0` = nunca).
- [ ] **SRV-11**: Encerramento gracioso em SIGINT/SIGTERM: envia evento final `shutdown` aos clients, fecha conexões SSE, libera lockfile.
- [ ] **SRV-12**: Ring buffer in-memory de **200 eventos** (FIFO); sem persistência em disco.
- [ ] **SRV-13**: Cap de **32 conexões SSE simultâneas**; conexão 33+ recebe 503.
- [ ] **SRV-14**: Cleanup de subscriber ouve `req.on('close')` E `req.on('error')` E `res.on('close')` (todos os três pra confiabilidade cross-runtime).

### UI — Página HTML estática single-file

- [ ] **UI-01**: Arquivo único `src/ui/static/index.html` com HTML+CSS+JS inline, ~300 LOC, sem build step, sem deps externas no client.
- [ ] **UI-02**: Lista cronológica de eventos com auto-scroll (desativável via toggle); item exibe timestamp, badge tipo, label legível, payload colapsável (`<details>` HTML nativo).
- [ ] **UI-03**: Badges coloridos por tipo de evento: `tool_invocation`, `progress`, `error`, `milestone`, `run.start`, `run.end`.
- [ ] **UI-04**: Status de conexão SSE visível: `CONNECTING` (cinza), `OPEN` (verde), `CLOSED` (vermelho com retry visível).
- [ ] **UI-05**: Reconnect automático nativo via `EventSource`; retry timing exponencial padrão do browser.
- [ ] **UI-06**: Estado vazio ("Aguardando primeiro evento... rode `kit sync install` ou abra outra IDE") quando 0 eventos.
- [ ] **UI-07**: Filter por tipo (multi-select dropdown) + filter por substring no label/payload (input).
- [ ] **UI-08**: Pause/resume do feed (botão); enquanto pausado, contador "N novos" cresce.
- [ ] **UI-09**: Dark mode automático via `@media (prefers-color-scheme: dark)`.
- [ ] **UI-10**: Banner de shutdown ("Sidecar foi encerrado. Recarregue a página depois de `kit ui start`.") quando recebe evento `shutdown` ou conexão CLOSED por >5s.
- [ ] **UI-11**: Hidrata via `GET /state` no load pra mostrar últimos 200 eventos antes do primeiro SSE chegar.

### PUB — Cliente publisher, wrapper de progress, browser-open

- [ ] **PUB-01**: `src/ui/client.js` exporta `publish(event)` fire-and-forget; resolve port via lockfile, faz POST `/publish`, falha silenciosamente em ECONNREFUSED ou ENOENT.
- [ ] **PUB-02**: `src/ui/wrapper.js` exporta `wrapProgressForUi(onProgress, ctx)` que retorna callback multiplexando terminal (chamada original) + publish; usado APENAS por callsites (CLI, MCP handler), nunca pelo core (`syncTo`, `applyReverse`).
- [ ] **PUB-03**: Helper central `redactPath(p, projectRoot)` substitui `$HOME → ~` e `projectRoot → <project>` em TODO payload antes de publish; aplicado uniformemente em `wrapper.js`.
- [ ] **PUB-04**: `src/ui/browser.js` envolve `open@11` com detection de headless (`!DISPLAY && !WAYLAND_DISPLAY`, `CI=true`, `TERM=dumb`), WSL e macOS sandbox; sempre imprime URL no stderr como fallback visível; respeita flag `--no-open`.

### CLI — Subcomando `kit ui` + auto-detect

- [ ] **CLI-01**: Subcomando `kit ui start` sobe servidor em **foreground** (Ctrl+C mata); aceita `--port <n>`, `--idle-ms <ms>`, `--no-open`, `--json`.
- [ ] **CLI-02**: Subcomando `kit ui stop` lê lockfile, faz `POST /shutdown`, aguarda fechamento, retorna status.
- [ ] **CLI-03**: Subcomando `kit ui status` lê lockfile e exibe `{pid, port, uptime, subscribers, eventsTotal}`; retorna exit code não-zero se nada rodando.
- [ ] **CLI-04**: Subcomando `kit ui open` reabre browser na porta atual sem reiniciar servidor; falha se sidecar não estiver up.
- [ ] **CLI-05**: Auto-detect lockfile em `kit sync install`, `kit sync watch`, `kit reverse-sync apply`; se presente, wrappa onProgress automaticamente. Comportamento opt-out via `--no-ui` ou env `KIT_MCP_NO_UI=1`.

### MCP — Flag `autoSpawn` em tools selecionadas

- [ ] **MCP-01**: Tool `sync` (install/watch) ganha param opcional `autoSpawn: boolean` no inputSchema; quando true e lockfile ausente, spawna `bin/ui.js` detached, aguarda healthz, abre browser, e wrappa onProgress.
- [ ] **MCP-02**: Tool `reverse-sync apply` recebe mesmo tratamento `autoSpawn`.
- [ ] **MCP-03**: Tool `gates run` recebe mesmo tratamento `autoSpawn`.
- [ ] **MCP-04**: Tools triviais (`list-*`, `search`, `get`, `forensics`, `install`) **NÃO** ganham `autoSpawn` — overhead injustificável.

### SEC — Hardening de segurança

- [ ] **SEC-01**: Validação de `Host` header em todas as rotas HTTP: aceita `127.0.0.1:port` e `localhost:port` literal; qualquer outro → 403 (mitiga DNS rebinding).
- [ ] **SEC-02**: Validação de `Origin` em endpoints non-GET: aceita `http://127.0.0.1:port` e `http://localhost:port`; reject 403 caso contrário.
- [ ] **SEC-03**: HTML estático envia CSP `default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.
- [ ] **SEC-04**: Audit gate de PR: grep proíbe `console.log` e `process.stdout.write` em todo `src/ui/`; logs vão pra stderr ou arquivo. Falha CI se violado.
- [ ] **SEC-05**: Path scrubbing (PUB-03) aplicado uniformemente; smoke test snapshot valida ausência de `/home/` `/Users/` `C:\Users\` em payloads.

### OPS — Operação, testes e cross-platform

- [ ] **OPS-01**: CI matrix Ubuntu/macOS/Windows × Node 20/22 cobrindo smoke do sidecar (start, /publish round-trip via /events, stop, status).
- [ ] **OPS-02**: Test "memory leak SSE" — 100 connect/disconnect ciclos, validar `subscribers.size === 0` no fim.
- [ ] **OPS-03**: Test "kill -9 recovery" — mata processo, próximo `kit ui start` detecta lockfile stale via probe, unlink, sobe normal.
- [ ] **OPS-04**: Test "multi-publisher race" — 2 processos POST `/publish` simultâneos, validar ambos chegam ao client.
- [ ] **OPS-05**: Test "MCP stdio uncorrupted" — sobe MCP server + sidecar simultaneamente, valida JSON-RPC frames intactos.
- [ ] **OPS-06**: `npm pack --dry-run` valida `src/ui/static/index.html` incluído no tarball.

### DOC — Documentação

- [ ] **DOC-01**: README seção "Live UI" com screenshot, exemplo `kit ui start`, exemplo `--auto-spawn` em MCP, fluxo "primeira execução" (firewall popup esperado).
- [ ] **DOC-02**: CHANGELOG entry em `[1.2.0]` enumera todas as fases entregues.
- [ ] **DOC-03**: Threat model curto (`docs/sidecar-security.md`) documentando: bind 127.0.0.1, sem auth, Host/Origin check, CSP, path scrubbing, trade-offs conscientes.
- [ ] **DOC-04**: Migration note: usuários v1.1 ficam idênticos sem ação (sidecar é opt-in); flag `--auto-spawn` documentada por MCP tool.

### REL — Release

- [ ] **REL-01**: Version bump 1.2.0 em `package.json`, `package-lock.json`, e `src/cli/index.js` (corrigir bug `--version` que ainda imprime `1.0.0` hardcoded).
- [ ] **REL-02**: Tag `v1.2.0` + GitHub Release auto-criada via workflow existente.
- [ ] **REL-03**: Publicação npm `@luanpdd/kit-mcp@1.2.0` Latest.

---

## Requisitos Futuros (parqueados pra v1.3+)

- **P2** Tipos de evento expandidos: `file_write`, `gate_result`, `log`
- **P2** Keyboard shortcuts: `/` filter, `p` pause, `c` clear, `?` help
- **P2** Copy-to-clipboard por evento
- **P2** Milestone divisores visuais na lista
- **P3** Aggregation multi-projeto numa única janela
- **P3** Replay de execução salva (kit forensics integration)
- **P3** localStorage de preferências (filter persistente, dark mode override)
- **P3** Toasts / desktop notifications
- **P3** Flag `--detach` em `kit ui start` para spawn detached por default

## Fora do Escopo (exclusões explícitas)

- **Autenticação / acesso remoto / share** — sidecar é estritamente localhost; remote = vetor de ataque + complexidade de TLS/proxy não-justificável
- **Persistência em disco** — kit forensics já cobre replay forense; ring buffer in-memory basta pra "live"
- **Métricas/charts (CPU, mem, latency)** — fora do propósito de "process viewer"; bloated
- **WebSocket bidirecional** — UI é read-only; SSE basta e é mais simples
- **Build step / framework UI (React/Vue/Svelte)** — viola princípio "sem build step" do PROJECT.md
- **Multi-server aggregation** — V2+ se fizer sentido; v1.2 é per-projectRoot

## Rastreabilidade

(preenchido pelo roadmapper na próxima fase — mapa REQ-ID → Fase)
