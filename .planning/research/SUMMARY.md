# Resumo da Pesquisa do Projeto

**Projeto:** kit-mcp v1.2 — GUI sidecar de acompanhamento (web localhost + SSE)
**Domínio:** Live process viewer embutido em CLI/MCP server stdio existente
**Pesquisado:** 2026-05-04
**Confiança:** HIGH

## Resumo Executivo

kit-mcp v1.2 adiciona uma janela web local que mostra ao vivo a execução das tools do MCP server e dos comandos da CLI (sync, reverse-sync, gates), via Server-Sent Events sobre HTTP localhost. A pesquisa convergiu em uma solução de **um processo separado, single-instance, controlado por lockfile**, com publishers efêmeros (CLI e MCP server) emitindo eventos por **HTTP POST loopback** — não EventEmitter compartilhado, não IPC, não pipe nomeado. O servidor é Node `http` puro (zero overhead de framework), a UI é HTML+CSS+JS inline em arquivo único (sem build step), e a única dependência nova é **`open@11`** para abertura cross-platform de browser (incluindo WSL/headless detection).

A integração com o core (`syncTo`, `applyReverse`) é feita por **wrapper de `onProgress` no callsite** — o core nunca importa nada de `src/ui/`, preservando literalmente a Stable API v1.0+. O acompanhamento é estritamente live (ring buffer de 200 eventos para late-join; sem persistência em disco; sem replay forense — `kit forensics` cobre esse caso). O sidecar é opt-in: `kit ui start` manual ou flag `--auto-spawn` nas tools MCP pesadas.

Os riscos centrais são bem conhecidos e mitigáveis: poluição do canal stdio do MCP por `console.log` do sidecar (REQ duro: stderr/arquivo only), bind acidental em `0.0.0.0` (REQ duro: `127.0.0.1` literal), connection leak de SSE sem `req.on('close')` cleanup, lockfile stale após crash (probe via `process.kill(pid, 0)` + healthz), e DNS rebinding em servers localhost (validação de Host/Origin headers). Nenhum desses requer pesquisa adicional — todos viram requisitos explícitos ou smoke tests no roadmap.

## Principais Descobertas

### Stack Recomendado

Stack minimalista alinhada ao princípio "pacote pequeno, deps mínimas" do PROJECT.md. **1 dependência nova somente:** `open@11.0.0`. Tudo o restante é Node `node:*` builtins ou implementação inline (<50 LOC cada).

**Tecnologias core:**
- **Node `node:http`** (nativo, Node ≥20) — servidor HTTP localhost; SSE é apenas `Content-Type: text/event-stream` + `res.write()` em chunks com keep-alive. Express/Fastify seriam overkill para 4 rotas.
- **SSE (Server-Sent Events)** — stream uni-direcional servidor→cliente; `EventSource` browser-nativo já reconecta automaticamente; atravessa proxies como HTTP normal; sem handshake WebSocket.
- **HTML/JS estático sem build** — single-file `src/ui/static/index.html` com `<style>` e `<script>` inline; vanilla DOM + `EventSource`; sem Vite/Webpack/React.
- **`open@11.0.0`** (NOVA dep) — abertura cross-platform de browser, com detecção de WSL/SSH/headless built-in. Reimplementar = 60-80 LOC + edge cases platform-específicos (Windows quoting hell, WSL `wslview`, macOS sandboxing).

**Implementar inline (em vez de adicionar dep):**
- `findFreePort()` (~15 LOC, `net.createServer`) — em vez de `get-port@7`
- Lockfile com `fs.openSync('wx')` (~30 LOC) — em vez de `proper-lockfile` (abandonado em 2022)
- MIME map estático de 6 entradas (~10 LOC) — em vez de `mime-types`/`mime-db`

**Conflito resolvido (deps):** STACK e PITFALLS convergem em **+1 dep máxima** (`open@11`). Nenhuma adição além disso. PR gate: `npm ls` não pode crescer >+1 vs v1.1.

### Funcionalidades Esperadas

13 funcionalidades P1 (essenciais), 4 P2 (v1.3), 6 anti-features documentadas para prevenir scope creep.

**Deve ter (essencial — P1, v1.2):**
- Servidor HTTP localhost + endpoint SSE `/events`, bind `127.0.0.1`
- Lockfile per-projectRoot + detect-porta-livre (range 7100-7199; PROJECT.md sugeria 7873 mas pesquisa indica 7100-7199 como faixa não-conflitante)
- Página HTML estática single-file, dark mode auto via `prefers-color-scheme`
- Lista cronológica de eventos com auto-scroll, badges coloridos por tipo, estado vazio
- Indicador de status de conexão (CONNECTING/OPEN/CLOSED)
- Reconnect automático nativo + keep-alive `: ping\n\n` cada 15s
- Hook nos `onProgress` existentes em `syncTo()` e `applyReverse()` via wrapper (sem mudar assinatura)
- Tipos de evento essenciais: `tool_invocation`, `progress`, `error`, `milestone`, `run.start`, `run.end`
- CLI `kit ui start | stop | status | open` + alias `kit ui` = start
- Cross-platform browser open via `open@11`
- Encerramento gracioso (SIGINT/SIGTERM → drena SSE, libera lockfile)
- Flag `--auto-spawn` opt-in nas tools MCP de sync/reverse-sync com reentrance via lockfile
- Filter por tool/nível + pause/resume + detail expand (`<details>` HTML nativo)

**Deveria ter (diferencial — P2, v1.3):**
- Tipos de evento expandidos (`file_write`, `gate_result`, `log`)
- Keyboard shortcuts (`/` filter, `p` pause, `c` clear, `?` help)
- Copy-to-clipboard por evento
- Milestone divisores visuais

**Adiar (v2+):**
- Aggregation multi-projeto numa janela
- Replay de execução salva (kit forensics cobre)
- localStorage de preferências
- Toasts / desktop notifications

**Anti-features (NÃO fazer — documentado para evitar scope creep):**
- Autenticação / acesso remoto / share
- Persistência em disco
- Métricas/charts (CPU, mem, latency)
- WebSocket bidirecional (UI read-only)
- Build step / framework UI (React/Vue/Svelte)
- Multi-server aggregation

### Abordagem de Arquitetura

Três decisões resolvem a tensão central (CLI eventual, MCP server stdio sempre vivo, browser precisa de TCP estável): **(1) HTTP server é processo separado single-instance** com lockfile em `os.tmpdir()`, desacoplado do lifecycle de CLI/MCP; **(2) publicação via HTTP POST `/publish` loopback**, não IPC nem EventEmitter compartilhado entre processos; **(3) wrapper de `onProgress` no callsite**, core intocado.

```
publishers (efêmeros)              ui-server (singleton)         consumer
─────────────────────              ─────────────────────         ─────────
CLI    `kit sync install`  ──┐
MCP    server tool call    ──┼──►  HTTP POST /publish  ──►  EventEmitter  ──►  SSE /events  ──►  Browser
CLI    `kit reverse-sync`  ──┘     (porta via lockfile)        + ring buffer N=200      index.html
                                   bind 127.0.0.1
```

**Componentes principais:**
1. **`src/ui/server.js`** — http.Server singleton; rotas `/`, `/events`, `/publish`, `/healthz`, `/shutdown`; bus interno (EventEmitter); ring buffer; idle shutdown
2. **`src/ui/lockfile.js`** — `acquireLock` com `fs.openSync('wx')` atômico; lockfile per-projectRoot em `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)>.lock`; metadata `{port, pid, version, startedAt}`; stale detection via `process.kill(pid, 0)` + healthz probe
3. **`src/ui/client.js`** — `publish(event)` fire-and-forget; resolve port via lockfile; cache port; falha silenciosa se ECONNREFUSED
4. **`src/ui/wrapper.js`** — `wrapProgressForUi(onProgress, ctx)` retorna callback que multiplexa terminal + publish; usado por callers (CLI, MCP handler), NUNCA pelo core
5. **`src/ui/static/index.html`** — single-file UI (HTML+CSS+JS inline) consumindo `/events`; ~300 LOC
6. **`src/ui/browser.js`** — wrapper sobre `open@11` com detection de headless/WSL e fallback "imprime URL"
7. **`bin/ui.js`** — entry detached para spawn quando `--auto-spawn` precisa subir o server

**Conflitos resolvidos:** lockfile combina `O_EXCL` + `os.tmpdir()` keyed por sha1(projectRoot) + probe signal-0; bus = HTTP POST entre processos + EventEmitter intra-server; multi-instance = singleton-by-projectRoot, primeira IDE wins.

### Armadilhas Críticas

Top 7 das 25 armadilhas catalogadas — cada uma vira REQ explícito ou smoke test no roadmap.

1. **stdout do sidecar polui canal stdio do MCP** (BREAK protocol) — `console.log` do servidor HTTP corrompe JSON-RPC frames. Mitigação: REQ duro "todo log do sidecar vai pra stderr ou `~/.kit-mcp/ui.log`"; audit grep pre-merge.
2. **Bind acidental em `0.0.0.0`** — vaza paths/projetos em wifi público. Mitigação: REQ duro "sempre `listen(port, '127.0.0.1')` literal"; nunca `'localhost'`; test post-boot.
3. **SSE connection leak sem `req.on('close')` cleanup** — array de subscribers cresce sem limite. Mitigação: padrão obrigatório de cleanup em req+res close+error; cap 32 conexões; test de regressão.
4. **Lockfile stale após crash** — `kill -9` deixa arquivo. Mitigação: probe `process.kill(pid, 0)` antes de honrar; ESRCH/EPERM → unlink + retry; healthz HTTP fallback.
5. **DNS rebinding attack** — site malicioso rebinds para `127.0.0.1`. Mitigação: validar `Host` ∈ {`127.0.0.1:port`, `localhost:port`} → 403; CSP estrito no HTML.
6. **Path leak em payloads** — eventos de `onProgress` carregam absPath. Mitigação: helper central `redactPath(p, projectRoot)` aplicado a TODO payload; substitui `$HOME→~` e `projectRoot→<project>`.
7. **Browser-open quebrado em headless/CI/WSL/macOS sandbox** — Mitigação: `open@11` cobre detection nativamente; detectar `CI=true` antes de chamar; sempre imprimir URL no stderr; flag `--no-open`.

## Implicações para o Roadmap

Estrutura sugerida de 8 fases, ordenada por dependências topológicas.

### Fase 1: Lock arquitetural & decisões pendentes
Antes de escrever código, fechar trade-offs (auth NACK no MVP, Last-Event-ID NACK, multi-instance singleton-by-projectRoot, +1 dep máx). Cria gates de PR. Aborda: Pitfalls 17, 23, 14.

### Fase 2: Fundações sem I/O (events + port + lockfile)
`src/ui/events.js` (schema, validador, runId), `src/ui/port.js` (findFreePort 7100-7199), `src/ui/lockfile.js` (O_EXCL + probe pid). Aborda: Pitfalls 8, 9, 11, 12, 18.

### Fase 3: Servidor HTTP standalone + SSE endpoint
`src/ui/server.js` (rotas, bus, ring buffer, idle shutdown); `bin/ui.js` (entry detached); testes integration. Aborda: Pitfalls 1, 2, 3, 4, 5, 7, 20.

### Fase 4: UI estática (HTML/CSS/JS single-file)
`src/ui/static/index.html` com lista, badges, status, dark mode auto, filter, pause/resume, detail expand, shutdown banner; `/state` para hydrate-on-load. Aborda: Pitfalls 13, 25, 19.

### Fase 5: Cliente publisher + wrapper + browser-open
`src/ui/client.js`, `src/ui/wrapper.js` (com `redactPath`), `src/ui/browser.js`. Adiciona dep `open@11`. Aborda: Pitfalls 10, 15, 16, 19, 24.

### Fase 6: Integração CLI (`kit ui` subcomando + auto-detect)
Subcomando `kit ui start | stop | status | open`; auto-detect lockfile e wrap onProgress em comandos longos. Aborda: Pitfall 21, 6.

### Fase 7: Integração MCP server (`--auto-spawn` flag)
Param opcional `autoSpawn: boolean` em tools MCP de sync/reverse-sync; handler que spawna `bin/ui.js` detached e abre browser. Aborda: Pitfall 1 (regressão).

### Fase 8: Hardening + smoke cross-platform + release
Memory-leak tests, kill -9 recovery, multi-publisher race, `npm pack --dry-run`, README + threat model, CHANGELOG, version bump 1.2.0. Aborda: Pitfalls 22, 4.

### Justificativa do Ordenamento
- Topológica pura: events ⊂ port ⊂ lockfile ⊂ server ⊂ UI ⊂ {client, wrapper, browser} ⊂ CLI ⊂ MCP.
- Pureza primeiro, I/O depois.
- Server antes de publishers (testável via curl).
- Decisões antes de código (Fase 1).

## Avaliação de Confiança

| Área | Confiança | Notas |
|------|-----------|-------|
| Stack | HIGH | Versões `npm view` 2026-05-04 verificadas. |
| Funcionalidades | HIGH | 8 cases analisados; codebase upstream lida. |
| Arquitetura | HIGH | Codebase inteira lida; build order topológico sem ciclos; Stable API preservada. |
| Armadilhas | HIGH | 25 armadilhas com sintomas, prevenção, fase de abordagem. |

**Confiança geral:** HIGH

### Open Questions / Trade-offs para o user

- **Porta default:** PROJECT.md sugeria 7873; pesquisa recomenda **range 7100-7199** com auto-fallback.
- **Lockfile location:** `os.tmpdir()` (recomendado) vs `<projectRoot>/.kit-mcp/`.
- **Idle shutdown timeout:** sugestão **30min default + flag `--idle-ms`**.
- **`kit ui start` default:** sugestão **foreground default, `--detach` opt-in v1.3**.
- **`--auto-spawn` em quais tools MCP?** sugestão sync sim, list-* não.

## Fontes

### Primárias (HIGH)
- `STACK.md` — versões `npm view` 2026-05-04
- `FEATURES.md` — codebase upstream lida (sync.js:95, reverse-sync.js:188, cli/index.js:70)
- `ARCHITECTURE.md` — codebase inteira lida
- `PITFALLS.md` — Node.js docs, WHATWG HTML spec, MDN SSE
- PROJECT.md v1.2

### Secundárias (MEDIUM)
- Cases: Vite HMR overlay, Vercel CLI, MCP Inspector, mcp-dashboard, k9s, Docker Desktop, Claude Code task viewer
- OWASP / Mozilla Observatory — DNS rebinding mitigations

---
*Pesquisa concluída: 2026-05-04*
*Pronto para roadmap: sim*
