# ROADMAP — kit-mcp v1.2

**Milestone:** v1.2 — GUI sidecar de acompanhamento (web localhost + SSE)
**Numeração de fases:** continua de v1.1 (que terminou em fase 10) → v1.2 começa em **Fase 11**
**Total de REQs cobertos:** 56 (SRV 14 + UI 11 + PUB 4 + CLI 5 + MCP 4 + SEC 5 + OPS 6 + DOC 4 + REL 3)
**Total de fases:** 8 (Fases 11–18)
**Criado:** 2026-05-04

---

## Visão geral do milestone

Adicionar uma janela web localhost (`http://127.0.0.1:7100-7199`) que mostra ao vivo, via Server-Sent Events, a execução das tools MCP e dos comandos CLI longos (sync, reverse-sync, gates). Sidecar é processo separado, single-instance per-projectRoot via lockfile, com publishers efêmeros (CLI/MCP) emitindo eventos por HTTP POST loopback. Stable API v1.0+ preservada — apenas adições, opt-in.

**Princípios de ordenamento:** topológica pura (events ⊂ port ⊂ lockfile ⊂ server ⊂ UI ⊂ {client, wrapper, browser} ⊂ CLI ⊂ MCP), pureza antes de I/O, server testável via curl antes de publishers, decisões antes de código.

**Pitfalls early-coverage:** Pitfalls 1 (stdio polution), 2 (bind 0.0.0.0) e 3 (SSE leak) são abordados nas Fases 11–13, **NÃO** delegados ao hardening final.

---

## Phase 11: Lock arquitetural & gates de PR

**Tipo:** Decisão pura (sem código de runtime)
**Por que primeiro:** decisões trade-off ainda abertas (porta, idle timeout, default foreground/detach, lockfile location, escopo de `--auto-spawn`) precisam estar fixas antes de qualquer fase escrever código. Audit gates precisam estar ativos no CI antes que `src/ui/` exista para falhar imediatamente em violações.

**Escopo:**
- ADR (`docs/adrs/` ou `.planning/decisions.md`) registrando: porta 7100-7199, lockfile em `os.tmpdir()`, idle 30min default, foreground default, `--auto-spawn` em sync/reverse-sync/gates só
- Threat model inicial (`docs/sidecar-security.md` rascunho com bind 127.0.0.1, sem auth, Host/Origin check, CSP, path scrubbing)
- CI gate: grep job em `.github/workflows/` que falha se `console.log` ou `process.stdout.write` aparecer em `src/ui/` (mesmo que o diretório ainda não exista — gate fica ativo desde já)
- CI gate: `npm ls` size delta — falha PR se árvore de deps cresce >+1 vs v1.1.0

**REQs cobertos:** SEC-04, DOC-03 (rascunho)

**Critérios de sucesso (observáveis):**
1. Existe `docs/sidecar-security.md` (mesmo rascunho) e está committado.
2. PR de teste contendo `console.log("x")` em `src/ui/dummy.js` é **rejeitado** pelo CI antes de qualquer review humano.
3. PR de teste adicionando dep "left-pad" sem remover outra é rejeitado pelo gate de tamanho de árvore.
4. ADR enumera todas as decisões pendentes do SUMMARY ("Open Questions") com escolha + 1 frase de justificativa cada.

---

## Phase 12: Fundações sem I/O (events + port + lockfile)

**Tipo:** Pure utilities, testáveis sem rede e sem fs cross-process
**Por que aqui:** componentes puros, sem dependências externas; servem todas as outras fases. Pitfalls 4 (stale lockfile) e 8/11/12 (port/lockfile correctness) abordados aqui.

**Escopo:**
- `src/ui/events.js` — schema Zod-livre (validação manual), tipos: `tool_invocation`, `progress`, `error`, `milestone`, `run.start`, `run.end`, `shutdown`; helper `makeEvent({type, payload})` carimba `ts` + `runId`
- `src/ui/port.js` — `findFreePort(start=7100, end=7199)` via `net.createServer` retry-loop
- `src/ui/lockfile.js` — `acquireLock(projectRoot, meta)` com `fs.openSync('wx')` atômico em `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)>.lock`; `readLock`, `releaseLock`, `probeStale(lock)` via `process.kill(pid, 0)` + healthz HTTP probe (passado por DI pra manter pureza testável)
- Unit tests: collision range, sha1 keying determinístico, ESRCH/EPERM detection, recreate after stale unlink

**REQs cobertos:** SRV-08 (lockfile), SRV-09 (stale detection)

**Critérios de sucesso (observáveis):**
1. `node --test test/ui/events.test.js` cria evento, valida que `event.ts` é número e `event.runId` é hex 8-char.
2. `node --test test/ui/port.test.js` ocupa porta 7100, chama `findFreePort()` e recebe 7101 (próxima livre).
3. `node --test test/ui/lockfile.test.js` chama `acquireLock` duas vezes seguidas no mesmo projectRoot — segunda falha com EEXIST.
4. Test "stale recovery": lockfile com PID inexistente é detectado como stale e unlink + retry funciona.
5. Cobertura ≥85% em `src/ui/events.js`, `port.js`, `lockfile.js`.

---

## Phase 13: Servidor HTTP standalone + SSE endpoint

**Tipo:** Servidor + entry detached + smoke via curl
**Por que aqui:** depende de events/port/lockfile (Fase 12), mas precede UI (precisa de algo pra consumir). Aborda Pitfalls 1 (stdio→stderr), 2 (bind 127.0.0.1 literal), 3 (SSE leak cleanup), 5 (DNS rebinding) — **early, não no hardening**.

**Escopo:**
- `src/ui/server.js` — `http.Server` singleton; rotas `GET /`, `GET /events`, `POST /publish`, `GET /healthz`, `POST /shutdown`, `GET /state`; bus interno (`EventEmitter`); ring buffer N=200; idle shutdown timer; cap 32 conexões; cleanup triplo em `req.on('close'/'error')` + `res.on('close')`; SIGINT/SIGTERM graceful drain
- `bin/ui.js` — entry detached: lê env `KIT_MCP_PROJECT_ROOT`, `findFreePort`, `acquireLock`, `server.listen(port, '127.0.0.1')`, log apenas em `~/.kit-mcp/ui.log` ou stderr
- Validação Host header (127.0.0.1:port | localhost:port → pass; outro → 403) em todas rotas
- Validação Origin em rotas non-GET
- Heartbeat `: ping\n\n` cada 15s
- Headers SSE corretos: `text/event-stream`, `no-cache`, `keep-alive`, `X-Accel-Buffering: no`, `flushHeaders()` imediato
- Smoke integration test: spawn `bin/ui.js`, `curl /healthz`, `curl /events &` em background, `curl POST /publish {...}`, validar payload chega no stream, `curl POST /shutdown`, validar lockfile released

**REQs cobertos:** SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, SRV-06, SRV-07, SRV-10, SRV-11, SRV-12, SRV-13, SRV-14, SEC-01, SEC-02

**Critérios de sucesso (observáveis):**
1. `node bin/ui.js &` sobe servidor; `curl http://127.0.0.1:<port>/healthz` retorna `{version, uptime, port, subscribers:0}`.
2. `curl http://[::1]:<port>/healthz` (loopback IPv6 distinto) retorna **connection refused** (proves bind 127.0.0.1 literal, não `0.0.0.0`).
3. `curl -H "Host: evil.com" http://127.0.0.1:<port>/healthz` retorna **403** (DNS rebinding mitigation).
4. `curl POST /publish` com payload >64KB retorna **413**.
5. Conectar 100 SSE clients sequencialmente (connect/disconnect) e final `subscribers.size === 0` (memory leak test).
6. SIGINT no servidor: clients SSE recebem evento `shutdown` antes do socket fechar; lockfile é deletado.

---

## Phase 14: UI estática (HTML/CSS/JS single-file)

**Tipo:** Frontend puro, sem build
**Por que aqui:** servidor da Fase 13 já serve `/state` e `/events`; UI consome. Independente de publishers (Fase 15) — testável abrindo o file no browser e curl-injetando eventos.

**Escopo:**
- `src/ui/static/index.html` — HTML+CSS+JS inline, ~300 LOC, zero deps client-side
- Conexão SSE via `EventSource('/events')` com reconnect nativo
- Hydrate inicial via `fetch('/state')` antes do primeiro SSE
- Lista cronológica com auto-scroll toggleable; itens com timestamp, badge tipo, label, payload em `<details>`
- Badges coloridos: `tool_invocation`, `progress`, `error`, `milestone`, `run.start`, `run.end`
- Status indicator CONNECTING/OPEN/CLOSED com cores
- Estado vazio com mensagem instrutiva
- Filter por tipo (multi-select) + filter substring
- Pause/resume com contador "N novos"
- Dark mode `@media (prefers-color-scheme: dark)`
- Banner de shutdown ao receber evento `shutdown` ou CLOSED >5s
- Resposta CSP estrita servida via header em `GET /` (extensão de Fase 13, mas ative aqui pra fechar UI loop)

**REQs cobertos:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, SEC-03

**Critérios de sucesso (observáveis):**
1. Abrir `http://127.0.0.1:<port>/` em Chrome mostra página, status `OPEN`, mensagem de estado vazio.
2. `curl POST /publish '{type:"progress",label:"sync 50%"}'` faz badge "progress" aparecer com timestamp e label visíveis em <500ms.
3. Toggle pause: durante pausa, novos eventos aumentam contador "N novos" sem renderizar; resume despeja em batch.
4. Header CSP no response de `/` contém exatamente `default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.
5. Recarregar a página com 50 eventos no buffer hidrata via `/state` antes do primeiro SSE chegar (verificável no Network tab).
6. Dark mode automático ao alternar OS theme; sem flash de tema errado.

---

## Phase 15: Cliente publisher + wrapper + browser-open

**Tipo:** Glue layer + nova dep
**Por que aqui:** servidor (Fase 13) e UI (Fase 14) prontos; agora os publishers podem emitir. Adiciona única dep nova `open@11`. Aborda Pitfalls 6 (path leak), 7 (browser-open headless).

**Escopo:**
- `src/ui/client.js` — `publish(event)` fire-and-forget; resolve port via `readLock(projectRoot)`; cache port em memória; POST `/publish`; falha silenciosamente em ECONNREFUSED/ENOENT (não throw, não log em stdout)
- `src/ui/wrapper.js` — `wrapProgressForUi(onProgress, ctx)` retorna função que (1) chama `onProgress` original (multiplexa terminal), (2) chama `publish(makeEvent({...}))` — usado APENAS por callsites; core (`syncTo`, `applyReverse`) intocado
- `src/ui/redact.js` (ou inline em wrapper) — `redactPath(p, projectRoot)`: substitui `$HOME → ~`, `projectRoot → <project>`, aplicado a TODOS os campos string do payload
- `src/ui/browser.js` — wrapper sobre `open@11`: detect headless (`!DISPLAY && !WAYLAND_DISPLAY`), `CI=true`, `TERM=dumb`, WSL, macOS sandbox; sempre `process.stderr.write('Open: <url>\n')`; respeita `--no-open`
- Adicionar `open@^11.0.0` em `dependencies` do `package.json`
- Snapshot test: payload de evento NUNCA contém `/home/`, `/Users/`, `C:\Users\` (PUB-03)

**REQs cobertos:** PUB-01, PUB-02, PUB-03, PUB-04, SEC-05

**Critérios de sucesso (observáveis):**
1. `npm ls --depth=0 open` retorna `open@11.x.x`; árvore total cresceu exatamente +1 dep direta vs v1.1.
2. Com sidecar **down** (sem lockfile), chamar `publish({...})` em script Node retorna sem erro e sem stdout output (silent fail).
3. Com sidecar **up**, chamar `publish({...})` faz evento aparecer em `curl /events` em <100ms.
4. Snapshot test: payload simulado contendo `C:\Users\luanpdd\proj\file.md` é redacted para `<project>\file.md` (ou similar) antes de POST.
5. Em ambiente com `CI=true`, `browser.open(url)` **NÃO** chama `open()`, mas imprime `Open: <url>` em stderr.

---

## Phase 16: Integração CLI (`kit ui` subcomando + auto-detect)

**Tipo:** CLI surface
**Por que aqui:** usa client (Fase 15) e server (Fase 13). Auto-detect em `kit sync install` etc fecha o loop "manual start funciona". Aborda Pitfall 21 (env var opt-out).

**Escopo:**
- `src/cli/ui.js` — sub-grupo `kit ui` no Commander
  - `start` (foreground default; `--port`, `--idle-ms`, `--no-open`, `--json`)
  - `stop` (lê lockfile, POST `/shutdown`)
  - `status` (lê lockfile, exibe pid/port/uptime/subscribers/eventsTotal; exit code !=0 se nada rodando)
  - `open` (reabre browser na porta atual; falha se sidecar down)
- Auto-detect em `kit sync install`, `kit sync watch`, `kit reverse-sync apply`: se `readLock(projectRoot)` retorna lock vivo, wrappa onProgress automaticamente; opt-out via `--no-ui` ou env `KIT_MCP_NO_UI=1`
- Atualizar README e ajuda CLI

**REQs cobertos:** CLI-01, CLI-02, CLI-03, CLI-04, CLI-05

**Critérios de sucesso (observáveis):**
1. `kit ui start` em terminal: sobe em foreground, abre browser em `http://127.0.0.1:<port>`, Ctrl+C encerra graciosamente.
2. Em outro terminal, `kit ui status` mostra `{pid, port, uptime, subscribers, eventsTotal}` correto; `kit ui status --json` retorna JSON parseável.
3. `kit ui start` rodando + `kit sync install` em outro shell → eventos `tool_invocation`, `progress`, `run.end` aparecem no browser sem flag adicional.
4. `KIT_MCP_NO_UI=1 kit sync install` com sidecar up → nenhum evento publicado (opt-out funciona).
5. `kit ui stop` sem sidecar rodando retorna mensagem amigável e exit code 1.

---

## Phase 17: Integração MCP server (`--auto-spawn` flag)

**Tipo:** Param em tools MCP existentes
**Por que aqui:** depende de CLI (Fase 16) e bin/ui.js (Fase 13). Última peça de integração. Aborda Pitfall 1 (regressão potencial: spawning sidecar não pode poluir stdio do MCP).

**Escopo:**
- Tool `sync` (action install/watch): adicionar `autoSpawn?: boolean` ao inputSchema; quando true E lockfile ausente, spawnar `bin/ui.js` `detached: true, stdio: 'ignore'` via `child_process.spawn`, `unref()`, aguardar healthz com timeout 3s, abrir browser, wrappar onProgress
- Tool `reverse-sync apply`: idem
- Tool `gates run`: idem
- Tools triviais (`list-*`, `search`, `get`, `forensics`, `install`): **não** ganham `autoSpawn` — documentado no inputSchema
- Smoke test: rodar MCP server + sidecar simultaneamente, validar que JSON-RPC frames no stdio do MCP **nunca** contêm output do sidecar (Pitfall 1 regression check)

**REQs cobertos:** MCP-01, MCP-02, MCP-03, MCP-04

**Critérios de sucesso (observáveis):**
1. Invocar tool `sync` com `{action:"install", target:"claude", autoSpawn:true}` via MCP Inspector: sidecar sobe, browser abre, eventos chegam, JSON-RPC response intacta.
2. Segunda invocação com `autoSpawn:true` não spawna duplicado (lockfile presente → reusa).
3. Tool `list-agents` **não tem** `autoSpawn` no inputSchema (validável via MCP `tools/list`).
4. Smoke test "MCP stdio uncorrupted": 50 invocações concorrentes de `sync` com `autoSpawn:true`, parse de cada linha do stdout do MCP server como JSON-RPC válido — zero falhas.
5. `autoSpawn:true` em ambiente headless (CI=true): sidecar sobe, browser open é skipped (URL em stderr), eventos chegam normalmente.

---

## Phase 18: Hardening + smoke cross-platform + release

**Tipo:** Test surface + docs + cut
**Por que aqui:** tudo construído; agora valida em matriz CI completa, fecha docs, bumpa versão. Inclui REL-01 (correção do bug pré-existente `--version` hardcoded "1.0.0" em `src/cli/index.js`).

**Escopo:**
- CI matrix: smoke do sidecar em Ubuntu/macOS/Windows × Node 20/22 (start, /publish round-trip, stop, status)
- Test "memory leak SSE": 100 connect/disconnect ciclos, validar `subscribers.size === 0` no fim
- Test "kill -9 recovery": mata processo ungraceful, próximo `kit ui start` detecta stale, unlink, sobe normal
- Test "multi-publisher race": 2 processos POST `/publish` concorrentes, ambos chegam ao client
- Test "MCP stdio uncorrupted" reforçado (já tocado em Fase 17)
- `npm pack --dry-run` valida `src/ui/static/index.html` no tarball
- Threat model finalizado em `docs/sidecar-security.md` (passa do rascunho da Fase 11 para versão completa)
- README seção "Live UI" com screenshot, exemplos `kit ui start`, exemplo `--auto-spawn`, fluxo "primeira execução" (firewall popup)
- Migration note: usuários v1.1 não precisam fazer nada (sidecar opt-in)
- CHANGELOG entry `[1.2.0]`
- Version bump 1.2.0: `package.json`, `package-lock.json`, **e fix do `--version` hardcoded "1.0.0" em `src/cli/index.js`**
- Tag `v1.2.0` + GitHub Release via workflow
- `npm publish @luanpdd/kit-mcp@1.2.0`

**REQs cobertos:** OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, DOC-01, DOC-02, DOC-03 (final), DOC-04, REL-01, REL-02, REL-03

**Critérios de sucesso (observáveis):**
1. CI matrix Ubuntu/macOS/Windows × Node 20/22 verde em PR de release (6/6 jobs passam).
2. `kit --version` imprime `1.2.0` (corrige bug v1.0/v1.1 que imprimia `1.0.0` hardcoded).
3. `npm pack --dry-run` lista `src/ui/static/index.html` no manifesto do tarball.
4. README renderizado no GitHub mostra screenshot da UI e seção "Live UI" navegável.
5. `npm view @luanpdd/kit-mcp@1.2.0` retorna metadata; `npx @luanpdd/kit-mcp@1.2.0 ui start` em pasta limpa funciona.
6. GitHub Releases page mostra `v1.2.0` como Latest com notes auto-geradas.

---

## Mapa de cobertura por categoria

| Categoria | Total | Fase 11 | Fase 12 | Fase 13 | Fase 14 | Fase 15 | Fase 16 | Fase 17 | Fase 18 |
|-----------|-------|---------|---------|---------|---------|---------|---------|---------|---------|
| SRV (14)  | 14    |         | 2       | 12      |         |         |         |         |         |
| UI (11)   | 11    |         |         |         | 11      |         |         |         |         |
| PUB (4)   | 4     |         |         |         |         | 4       |         |         |         |
| CLI (5)   | 5     |         |         |         |         |         | 5       |         |         |
| MCP (4)   | 4     |         |         |         |         |         |         | 4       |         |
| SEC (5)   | 5     | 1       |         | 2       | 1       | 1       |         |         |         |
| OPS (6)   | 6     |         |         |         |         |         |         |         | 6       |
| DOC (4)   | 4     | 1*      |         |         |         |         |         |         | 3 + 1*  |
| REL (3)   | 3     |         |         |         |         |         |         |         | 3       |
| **Total** | **56**| **2**   | **2**   | **14**  | **12**  | **5**   | **5**   | **4**   | **12**  |

*DOC-03 começa rascunho na Fase 11, finaliza na Fase 18.

Soma 2+2+14+12+5+5+4+12 = **56 ✓**

---

## Riscos e mitigações no roadmap

- **Stdio pollution do MCP (Pitfall 1):** abordado já na Fase 13 (gate de CI ativo desde Fase 11). Reforçado em Fase 17 com smoke explícito.
- **Bind 0.0.0.0 (Pitfall 2):** abordado na Fase 13 com test que faz `curl http://[::1]:port` esperando connection refused.
- **SSE leak (Pitfall 3):** abordado na Fase 13 com test de 100 ciclos. Reforçado na Fase 18.
- **Lockfile stale (Pitfall 4):** abordado na Fase 12 (test) + Fase 18 (kill -9 recovery cross-platform).
- **Stable API v1.0+:** nenhuma fase modifica `TARGETS`, MCP actions existentes (apenas adiciona param opcional), CLI surface existente (apenas adiciona sub-grupo `kit ui`), core exports, stub format, marker semantics. Auditável via grep no diff de cada PR.
- **+1 dep máxima:** gate CI ativo desde Fase 11. Apenas `open@11` adicionada (Fase 15).

---

## Próximo passo

Iniciar Fase 11 com `/discutir-fase`.
