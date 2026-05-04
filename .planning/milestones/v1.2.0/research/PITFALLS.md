# Pesquisa de Armadilhas — kit-mcp v1.2 GUI sidecar

**Domínio:** Servidor HTTP + SSE local embutido em CLI / MCP server stdio existente (Node ≥20, ESM, cross-platform)
**Pesquisado:** 2026-05-04
**Confiança:** HIGH (web research + experiência ecossistema Node + análise da codebase atual em `D:\projetos\opensource\mcp\src\mcp-server\index.js` e `src\cli\index.js`)

> Escopo: pitfalls SPECIFIC pra adicionar HTTP+SSE a um stdio MCP server. Cada armadilha mapeia pra fase do roadmap v1.2 e vira requisito explícito, smoke test, ou nota no plan da fase.

---

## Armadilhas Críticas

### Armadilha 1: stdout/stderr do server HTTP polui canal stdio do MCP (BREAK protocol)

**O que dá errado:**
O MCP transport stdio usa **process.stdout** como canal binário JSON-RPC. Qualquer `console.log()` ou log defaultzão do `http.createServer` vazado no stdout corrompe o frame seguinte e o cliente (Claude Code, Cursor) desconecta com "invalid JSON-RPC message" sem dizer onde foi.

**Por que acontece:**
- Defaults do Node (e quase todo wrapper HTTP) escrevem em stdout/stderr — devs assumem que dá pra deixar ligado.
- Bibliotecas terceiras (`debug`, `pino`, etc) escolhem stdout silenciosamente.
- Boot do sidecar (`Listening on http://127.0.0.1:7100`) é o tipo de log que dev nunca pensa que vai matar o protocolo.

**Como evitar:**
- **Regra absoluta**: no contexto MCP server, **stdout é reservado**. Todo log do sidecar vai pra **stderr** ou pra arquivo (`~/.kit-mcp/ui.log`).
- Wrap do http server: redirecionar qualquer log interno para stderr explicitamente, nunca confiar em default.
- Audit grep pre-merge: `console.log` ou `process.stdout.write` no caminho do sidecar deve ser zero.
- Smoke test específico: após `kit ui start` rodando dentro de um MCP session, validar que o stdout do MCP server continua sendo JSON-RPC válido.

**Sinais de alerta:**
- Claude Code/Cursor desconecta logo após primeira chamada de tool quando `--auto-spawn` está ligado.
- "Invalid JSON-RPC message" em logs do cliente IDE.
- Output da tool aparece como texto bruto na UI da IDE (cliente interpretou parcialmente).

**Fase para abordar:**
**Fase 2 (sidecar boot)** — desde a primeira linha que sobe o http.Server, redirecionar logs pra stderr/arquivo e adicionar smoke test "MCP stdio uncorrupted with sidecar running".

---

### Armadilha 2: SSE buffering em proxies / antivirus / corporate firewalls

**O que dá errado:**
Eventos SSE chegam em **batches** — o cliente fica 30s sem ver nada e de repente recebe 50 eventos juntos. UI parece travada ou em "connecting...".

**Por que acontece:**
- Proxies HTTP (Squid, corporate proxies) **bufferizam respostas** até ter chunk grande ou request fechar.
- Antivírus em Windows (Avast, Norton) injetam proxy local e bufferizam streams.
- nginx default tem `proxy_buffering on` (não aplicável a 127.0.0.1 direto, mas dev pode rodar atrás de algum túnel).
- Browsers sem `Cache-Control: no-cache` cacheiam resposta.

**Como evitar:**
- Headers obrigatórios na resposta SSE:
  ```
  Content-Type: text/event-stream
  Cache-Control: no-cache, no-transform
  Connection: keep-alive
  X-Accel-Buffering: no    (nginx hint)
  ```
- `res.flushHeaders()` imediatamente após `writeHead` — força envio dos headers antes do primeiro evento (necessário pra Edge/Firefox em alguns casos).
- Enviar comentário keep-alive (`: ping\n\n`) a cada 15-20s — força flush e detecta conexões mortas.
- Padding inicial de ~2KB de comentários (`: ` x 2048) **se** detectarmos buffering — mas só pra localhost geralmente é desnecessário.

**Sinais de alerta:**
- UI fica em "connecting..." e de repente catch-up de muitos eventos.
- Eventos param por minutos e voltam em rajada.
- Funciona em curl mas não em browser (ou vice-versa).

**Fase para abordar:**
**Fase 3 (SSE endpoint)** — headers + flushHeaders + heartbeat fazem parte do contrato do `/events` endpoint desde dia 1.

---

### Armadilha 3: Connection leak — SSE clients acumulados sem cleanup

**O que dá errado:**
Cada reload do browser abre nova `EventSource`. Se o servidor não escuta `req.on('close')` e remove a conexão da lista de subscribers, o array cresce sem limite. Após 50 reloads, cada evento gera 50 writes em sockets fechados → exceção `ECONNRESET` em loop, memória sobe, eventually CPU spike.

**Por que acontece:**
- Tutoriais SSE básicos mostram `res.write(...)` mas raramente cobrem cleanup.
- `EventSource` do browser **reconecta automaticamente** após disconnect — dev pensa que conexão antiga foi reusada, mas é uma nova.
- Errors em `res.write` em socket fechado são silenciados em alguns runtimes.

**Como evitar:**
- Padrão obrigatório: cada conexão SSE registra handler:
  ```js
  req.on('close', () => subscribers.delete(client));
  req.on('error', () => subscribers.delete(client));
  ```
- Wrappar `res.write()` em try/catch — silenciosamente remover subscriber se write lança.
- Guard máximo de conexões simultâneas (ex: 32) — rejeitar com 503 acima disso.
- Test de regressão: abrir/fechar 100 EventSources em loop, validar que `subscribers.size` volta a 0.

**Sinais de alerta:**
- Memória do processo kit-mcp cresce monotonicamente em sessões longas.
- "ECONNRESET" ou "socket hang up" repetindo nos logs.
- CPU spike sem motivo aparente após várias horas de IDE aberta.

**Fase para abordar:**
**Fase 3 (SSE endpoint)** — cleanup é parte do contrato. Test memory-leak na fase de hardening (Fase 6).

---

### Armadilha 4: `req.on('close')` não dispara confiavelmente em todos os runtimes

**O que dá errado:**
Em Node ≥18 mainstream `req.on('close')` é confiável, mas em alguns cenários (HTTP/2, undici, proxies à frente) o evento pode demorar minutos ou não disparar. Também difere se o client fecha ABA (TCP RST) vs. navega (FIN limpo) — alguns navegadores não fecham TCP imediatamente.

**Por que acontece:**
- Diferentes paths: `request` event do http.Server emite `IncomingMessage` cujo `close` é diferente do `socket.close`.
- Browsers às vezes mantêm conexão keep-alive aberta por X segundos após fechar aba.
- TCP_KEEPALIVE OS-default (Linux 7200s) é absurdamente alto.

**Como evitar:**
- Escutar **AMBOS** `req.on('close')` E `res.on('close')` — qualquer um dispara cleanup (idempotente via `Set.delete`).
- Heartbeat `: ping\n\n` a cada 15s — se `res.write` falha, marca client como morto.
- Setar `socket.setTimeout(0)` para SSE (sem timeout) MAS implementar app-level timeout via heartbeat-miss counter.
- Setar `socket.setKeepAlive(true, 30_000)` no socket SSE pra TCP detectar peer morto em 30s não em 2h.

**Sinais de alerta:**
- `subscribers.size` não volta a 0 mesmo depois de fechar todas as abas.
- Conexões "fantasma" persistindo por minutos no `lsof -i :7100`.

**Fase para abordar:**
**Fase 3 (SSE endpoint)** + cobertura no smoke da **Fase 6 (hardening)**.

---

### Armadilha 5: UTF-8 multi-byte split em payloads SSE

**O que dá errado:**
SSE protocol delimita eventos por `\n\n`. Se o `data:` contém uma string com caractere multi-byte (emoji, acentos PT-BR — `ção`, `ã`, `é`) e o write é fragmentado pelo TCP, o cliente vê bytes inválidos. **Pior**: se você concatenar JSON manualmente com `\n` no meio de string com `\n`, quebra o frame.

**Por que acontece:**
- Devs fazem `res.write('data: ' + payload + '\n\n')` sem escapar `\n` interno do payload.
- `JSON.stringify` resolve quebras de linha internas mas devs às vezes constroem string manual.
- Buffer split em multi-byte raramente acontece em localhost (chunk único), mas pode em testes.

**Como evitar:**
- Sempre `JSON.stringify` payload e enviar como linha única `data: <json>\n\n`.
- Helper único `sendEvent(client, eventName, payload)` que centraliza serialização — proibir `res.write` direto fora desse helper.
- Test snapshot: payload com emoji + acentos + newline interno, validar parse no client.
- Setar `res.setDefaultEncoding('utf8')` ou usar Buffer explícito.

**Sinais de alerta:**
- "Unexpected token" em JSON.parse no client.
- Emojis aparecem como `?` ou `�` (replacement char).
- Eventos "engolidos" — client recebe 9 de 10 events.

**Fase para abordar:**
**Fase 3 (SSE endpoint)** — helper sendEvent + test com payload PT-BR + emoji.

---

### Armadilha 6: Last-Event-ID não respeitado no reconnect — eventos perdidos ou duplicados

**O que dá errado:**
`EventSource` do browser **reconecta automaticamente** e envia header `Last-Event-ID` com o último ID que recebeu. Se o servidor ignora esse header e simplesmente começa a stream do "agora", o usuário perde eventos durante o gap. Pior cenário: server reenvia tudo desde o início → duplicates.

**Por que acontece:**
- SSE-101 tutorials não mencionam `Last-Event-ID`.
- Devs implementam SSE sem persistir histórico → impossível reenviar.

**Como evitar:**
**Decisão pragmática** (documentar trade-off): **kit-mcp v1.2 NÃO faz event replay**. Ratio:
- Sidecar é "live tail" — eventos perdidos não destroem usabilidade (UI mostra estado atual via `/state` poll opcional).
- Persistir histórico complica memória/disco.
- Documentar: "Reconnect mostra eventos a partir do reconnect; estado anterior reconstruído via fetch de `/state`."
- Sempre emitir `id:` nos eventos mesmo sem replay — mantém compatibilidade futura.
- Server **deve** ler `Last-Event-ID` (mesmo que ignore) e logar — facilita debug futuro.

**Sinais de alerta:**
- Após rede flap (laptop dorme), UI fica desincronizada do estado real.
- Usuário reporta "evento sumiu" em rede instável.

**Fase para abordar:**
**Fase 3 (SSE endpoint)** — decisão arquitetural documentada em RESEARCH ou no plan; endpoint `/state` pra reconciliação **Fase 4 (UI)**.

---

### Armadilha 7: Bind em 0.0.0.0 expõe sidecar pra rede local (dev coffee shop)

**O que dá errado:**
Default do `http.Server.listen(port)` em Node bind em **todas as interfaces** se você passa só a porta. Resultado: laptop em wifi público expõe `http://192.168.x.x:7100` sem auth — qualquer um na rede vê os processos do dev (potencialmente paths absolutos com `$HOME`, nomes de fases internas, projetos privados).

**Por que acontece:**
- Devs testam local, esquecem que `listen(port)` ≠ `listen(port, '127.0.0.1')`.
- Documentação Node não destaca o default.
- Teste local não pega — só vaza em rede.

**Como evitar:**
- **Sempre** `listen(port, '127.0.0.1')` — explícito.
- Considerar `'::1'` também pra IPv6 (ver pitfall 9).
- Validação no boot: log explícito "Bound to 127.0.0.1:7100 (loopback only)".
- Test de boot: depois do start, validar via `netstat`/`ss` que socket não está em `0.0.0.0`.

**Sinais de alerta:**
- `netstat -an | grep 7100` mostra `0.0.0.0:7100` em vez de `127.0.0.1:7100`.
- Firewall popup do OS pedindo permissão de "rede pública" (firewall sabe que bindou em 0.0.0.0).

**Fase para abordar:**
**Fase 2 (sidecar boot)** — bind explícito em loopback é REQ duro.

---

### Armadilha 8: EADDRINUSE — porta tomada quebra start em vez de fallback

**O que dá errado:**
Dev tem outro projeto rodando em 7100 (Vite, Next, ou outra instância do kit-mcp). `kit ui start` falha com `EADDRINUSE` e mensagem genérica. Usuário copia/cola comando de novo, mesmo erro. Frustração.

**Por que acontece:**
- Devs hardcodam porta única.
- Erro `EADDRINUSE` não é tratado — propaga como uncaught exception ou stack trace.
- Reload de IDE cria segunda instância MCP server → conflito (ver pitfall 14).

**Como evitar:**
- Range de portas configurável: padrão `7100-7199` (100 slots).
- Algoritmo: tentar 7100; se EADDRINUSE, incrementar até achar livre ou exaurir.
- Lockfile (ver pitfall 11) com porta atual permite `kit ui status` retornar URL exata.
- Mensagem de erro humana se range exaurido: "Range 7100-7199 cheio; passe `--port 8200` ou pare instâncias com `kit ui status`."
- Não usar porta 0 (Node escolhe arbitrária) — porta estável facilita bookmark do browser.

**Sinais de alerta:**
- "EADDRINUSE :::7100" em stderr.
- Múltiplos `kit ui start` retornam URLs diferentes (esperado: range), MAS a `start` do mesmo projeto duas vezes deveria ser idempotente (ver pitfall 11).

**Fase para abordar:**
**Fase 2 (sidecar boot)** — range scan + lockfile + mensagens humanas.

---

### Armadilha 9: IPv6 / IPv4 dual stack — listen('localhost') vs '127.0.0.1' vs '::1'

**O que dá errado:**
Dev escreve `listen(port, 'localhost')`. Em alguns OS (Windows 11 default), `localhost` resolve **primeiro** pra `::1` (IPv6) e depois `127.0.0.1`. Mas o browser, dependendo do navegador/versão, pode tentar `127.0.0.1` primeiro → connection refused, mesmo com server "rodando".

**Por que acontece:**
- DNS resolution order (`/etc/hosts` no Windows: `C:\Windows\System32\drivers\etc\hosts`) varia.
- Node `listen('localhost')` chama getaddrinfo que pode retornar v4 ou v6.
- WSL2 vs Windows host complica ainda mais (ver pitfall 10).

**Como evitar:**
- **Bind explícito em '127.0.0.1'** (IPv4 literal). Não usar 'localhost'.
- URL no browser: `http://127.0.0.1:7100/` literal.
- Se quiser IPv6: bindar 2 servers separados ou aceitar trade-off (v4 only é suficiente pra dev local).
- Test em Windows + macOS + Linux + WSL como gates de CI.

**Sinais de alerta:**
- "ERR_CONNECTION_REFUSED" em browser mas `lsof -i :7100` mostra socket aberto.
- Funciona em curl `http://127.0.0.1:7100` mas não `http://localhost:7100`.

**Fase para abordar:**
**Fase 2 (sidecar boot)** — REQ: bind em IPv4 literal `127.0.0.1`.

---

### Armadilha 10: WSL — abrir browser no Windows host vs WSL falha

**O que dá errado:**
Dev em WSL2 roda `kit ui start`. Sidecar tenta `xdg-open http://127.0.0.1:7100`. Não tem display. Falha silente, ou abre em browser CLI (lynx). Usuário não vê UI.

**Por que acontece:**
- WSL2 não tem display X por default.
- `xdg-open` em WSL existe mas chama X server inexistente.
- O server HTTP roda **no WSL**, então 127.0.0.1 do **Windows host** não vê (WSL2 tem rede separada). Precisa `localhost` (que faz port forwarding via WSL2 magic) ou IP do WSL.

**Como evitar:**
- Detectar WSL: `process.env.WSL_DISTRO_NAME` ou `/proc/version` contém "microsoft".
- Em WSL: usar `wslview` (vem do `wslu` package) ou `cmd.exe /c start` pra abrir no Windows host.
- Usar `http://localhost:7100` (não 127.0.0.1) — WSL2 faz forwarding automático apenas com "localhost".
- Conflito com pitfall 9: em WSL bindar em `0.0.0.0` ou `::` pra Windows host alcançar é tentador, MAS isso fura a regra de loopback. Solução: documentar "WSL2 user: passe `--host 0.0.0.0` consciente do trade-off, OU use Windows host nativo, OU use `wsl --localhost` config."
- Headless detection: se `DISPLAY` vazio e não WSL e não macOS, **não tentar abrir browser** — só imprimir URL com instrução "Abra: http://...".

**Sinais de alerta:**
- "xdg-open: no display" em logs.
- Browser não abre, sem erro visível.
- WSL user vê server rodando mas Windows browser ER_CONNECTION_REFUSED.

**Fase para abordar:**
**Fase 5 (browser-open + cross-platform)** — detection matrix WSL/macOS/Linux/Windows + fallback "imprime URL".

---

### Armadilha 11: Lockfile stale após crash — start fica preso

**O que dá errado:**
kit-mcp grava `~/.kit-mcp/ui.lock` com `{ pid: 12345, port: 7100 }` no start. Crash do processo (kill -9, OOM). Lockfile permanece. Próximo `kit ui start` lê lockfile, vê pid 12345, assume que outra instância roda, recusa a subir. Loop infinito de "já rodando" sem nada rodando.

**Por que acontece:**
- Cleanup de lockfile depende de SIGTERM/exit handler — não dispara em SIGKILL nem em panic do Node.
- `process.kill(pid, 0)` (probe) é a maneira correta mas devs esquecem ou erram em Windows.

**Como evitar:**
- Lockfile contém `{ pid, port, startedAt, version }`.
- Antes de honrar lockfile: probe `process.kill(pid, 0)` (signal 0 = só checa, não mata).
  - Throw `ESRCH` → processo morto → lockfile stale → remover e prosseguir.
  - Throw `EPERM` → processo existe mas outro user → tratar como ativo.
  - No throw → vivo.
- Em Windows: `process.kill(pid, 0)` funciona em Node ≥14.
- Refinement: validar que o processo **é** o kit-mcp (pid reuse atack) — checar `startedAt` muito antigo (>30d) ou validar via probe HTTP `/health` na porta gravada.
- Comando manual `kit ui stop --force` que ignora lockfile.

**Sinais de alerta:**
- "Already running on port 7100" mas `curl http://127.0.0.1:7100` falha.
- Lockfile com mtime de horas/dias atrás após boot do laptop.

**Fase para abordar:**
**Fase 2 (sidecar boot — lockfile single-instance)**.

---

### Armadilha 12: Race em concurrent start (2 IDEs abrem o mesmo projeto simultaneamente)

**O que dá errado:**
Cursor e Claude Code abrem o projeto no mesmo segundo. Cada um spawna MCP server stdio. Cada um tenta `kit ui start` (via `--auto-spawn`). Ambos veem lockfile inexistente, ambos tentam bind 7100, um perde com EADDRINUSE, mas pode ter escrito lockfile primeiro → estado inconsistente.

**Por que acontece:**
- Lockfile sem mecanismo atômico (write-then-check em vez de exclusive-create).
- Async file ops criam janelas TOCTOU.

**Como evitar:**
- Usar `fs.openSync(lockPath, 'wx')` — exclusive-create. Se arquivo existe, falha atomicamente.
- Após open exclusivo: bind à porta, escrever metadata, close.
- Se falha ao abrir exclusivo: ler lockfile, fazer probe HTTP `/health`, se vivo → conectar/skip; se morto → tentar `unlink + retry` com backoff.
- Mutex via filesystem: o filesystem do OS garante atomicidade do `O_CREAT | O_EXCL`.

**Sinais de alerta:**
- 2 instâncias rodando em portas adjacentes (7100 e 7101) sem usuário ter pedido.
- Lockfile aponta pra pid X mas porta gravada é de pid Y.

**Fase para abordar:**
**Fase 2 (sidecar boot)** — exclusive-create + retry-with-probe.

---

### Armadilha 13: SIGINT mata kit ui mas browser tab fica em "connecting..."

**O que dá errado:**
Usuário Ctrl-C no terminal onde rodou `kit ui start` (foreground mode). Server morre. Browser EventSource entra em loop de reconnect (default 3s) pra sempre. UI fica em "connecting..." sem dizer "server desligado".

**Por que acontece:**
- EventSource reconecta automaticamente — não tem evento "server disse adeus".
- Server fechou socket abruptamente sem enviar evento `close` pro client.

**Como evitar:**
- Antes de `process.exit`, server envia evento especial: `event: shutdown\ndata: {}\n\n` e fecha sockets gracefully.
- Browser UI escuta `eventSource.addEventListener('shutdown', ...)` → mostra banner "Server stopped. Run `kit ui start` again to resume."
- Handler SIGINT/SIGTERM: 200ms grace pra emitir shutdown event a todos subscribers, depois close().
- Lockfile cleanup no exit handler (best-effort, pitfall 11 cobre o resto).

**Sinais de alerta:**
- Browser fica em loop infinito de fetch /events depois de Ctrl-C.
- DevTools mostra reconnect a cada 3s sem feedback ao usuário.

**Fase para abordar:**
**Fase 4 (UI)** + **Fase 6 (lifecycle hardening)**.

---

### Armadilha 14: Multi-instance — 2 IDEs spawnando 2 MCP servers, qual fica com a UI?

**O que dá errado:**
Cursor abre projeto → spawna MCP A. Claude Code abre o mesmo projeto → spawna MCP B. Ambos têm `--auto-spawn` ativado. UI de qual processo o usuário vê? Eventos do MCP A não aparecem na UI ligada ao MCP B.

**Por que acontece:**
- Cada IDE spawna seu próprio MCP server (design intencional do MCP — não compartilham).
- Sidecar é shared-by-design (1 UI no browser) mas event source é per-process.

**Como evitar:**
**Decisão arquitetural**: o sidecar é **singleton por projectRoot**, não por MCP server.
- Lockfile keyed por projectRoot: `~/.kit-mcp/ui-<sha1(projectRoot)>.lock`.
- Primeiro MCP server (Cursor) sobe HTTP server.
- Segundo MCP server (Claude Code) detecta lockfile, NÃO sobe HTTP, mas se conecta via IPC ao server existente para emitir eventos.
- IPC simples: HTTP POST `/ingest` interno (auth via lockfile-shared-token) ou Unix socket (Linux/macOS) / Named pipe (Windows).
- Trade-off complexidade: para v1.2 MVP, alternativa simples é **first-wins**: segundo MCP server detecta lockfile, loga "UI já rodando para esta projectRoot, eventos deste processo não aparecerão", segue sem HTTP. Documentar limitação.

**Sinais de alerta:**
- Usuário roda tool em Cursor, UI não atualiza.
- Logs: "Port 7100 in use, sidecar disabled" sem explicação.

**Fase para abordar:**
**Fase 2 (sidecar boot — single-instance)** + decisão arquitetural documentada na **Fase 1 (research consolidation)**.

---

### Armadilha 15: Windows `start ""` quoting hell em paths com espaços

**O que dá errado:**
Dev em `C:\Users\Pedro Silva\projetos\foo`. Sidecar tenta abrir browser:
```js
spawn('start', ['http://127.0.0.1:7100'], { shell: true });
```
Espaço no path (`Pedro Silva`) faz `start` interpretar `Pedro` como título da janela e `Silva` como comando. Falha com "Silva is not recognized".

**Por que acontece:**
- `start` em CMD usa primeiro argumento aspeado como título da janela (legacy).
- `shell: true` invoca cmd.exe que reinterpreta aspas.
- URLs sem espaço escapam, mas é frágil pra qualquer arg.

**Como evitar:**
- Padrão correto Windows: `start "" "URL"` — primeiro `""` é título dummy.
- Em Node:
  ```js
  spawn('cmd', ['/c', 'start', '""', url], { shell: false });
  ```
  ou usar lib battle-tested (`open` package — 1 dep, ver pitfall 17 sobre orçamento de deps).
- Test cross-platform com path contendo espaços, acentos (`Usuário`), unicode.

**Sinais de alerta:**
- "X is not recognized as an internal command" no Windows.
- Browser não abre em paths com espaço, abre em paths sem.

**Fase para abordar:**
**Fase 5 (browser-open cross-platform)** — pode justificar 1 dep (`open` package) se complexidade justifica vs zero-dep manual.

---

### Armadilha 16: Headless / CI / Docker — open chama X que não existe → erro fatal

**O que dá errado:**
CI (GitHub Actions Ubuntu) ou Docker container roda smoke test que invoca `kit ui start --auto-open`. Não tem display. `xdg-open` falha. Smoke test passa "false positive" (server subiu) ou falha confuso (open lança).

**Por que acontece:**
- Detection de headless é hard: `DISPLAY` vazio (Linux), mas macOS sempre tem GUI, Windows servers podem não ter.
- Docker images Ubuntu têm `xdg-open` mas sem X.

**Como evitar:**
- Detect headless cedo:
  - Linux/WSL: `!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY`
  - CI: `process.env.CI === 'true'`
  - Container: `/proc/1/cgroup` contém "docker" (heuristic)
- Em headless: NÃO chamar open; imprimir banner com URL pro usuário copiar.
- Flag explícita `--no-open` pra suprimir abertura mesmo em GUI environment.
- CI smoke: rodar com `--no-open` sempre.

**Sinais de alerta:**
- CI logs "open: command not found" ou "no display".
- `kit ui start` em ssh remoto trava 30s e falha.

**Fase para abordar:**
**Fase 5 (browser-open cross-platform)**.

---

### Armadilha 17: Adicionar Express/Fastify "porque é mais fácil" — viola princípio min-deps

**O que dá errado:**
Dev sob pressão escolhe Express. Adiciona +30 transitive deps. Bundle size sobe ~3MB. Princípio "Pacote pequeno, dependências mínimas" do PROJECT.md violado. Audit-trail futura: alguém pergunta "por que esse fundo de cauda de deps?", ninguém lembra.

**Por que acontece:**
- Express é "default" mental pra Node HTTP.
- Tutoriais SSE em Express são abundantes, em http puro são raros.
- Pressure pra entregar v1.2 rápido.

**Como evitar:**
- **REQ duro** (zerodep ou max+1): nenhum framework HTTP.
- Boilerplate Node `http` puro pra SSE é ~50 linhas — código de referência neste research.
- Roteamento manual: `if (url === '/events') return sse(req, res); if (url === '/state') return state(req, res); if (url === '/' || url.startsWith('/static/')) return static(req, res);`.
- Lint/CI gate: `npm ls` no CI deve mostrar mesma deps de v1.1 + no máximo +1.
- Se `open` (browser launcher) for a única dep nova, OK. Express ou similar = NACK.

**Sinais de alerta:**
- PR adiciona `express`, `fastify`, `koa`, `polka`, `tinyhttp`, `restify` em package.json.
- `package-lock.json` cresce >100 linhas.

**Fase para abordar:**
**Fase 1 (architecture lock)** + gate de revisão em **toda PR**.

---

### Armadilha 18: Hardcode de porta 3000 / 8080 / 4000 — colide com tudo

**O que dá errado:**
Dev escolhe 3000. Conflita com Next, Vite, CRA. Dev escolhe 8080. Conflita com Tomcat, Jenkins, proxy local. Dev escolhe 4000. Conflita com Phoenix, Strapi.

**Por que acontece:**
- "Pegar uma porta qualquer" é decisão tomada em 5s.
- Ranges populares são ocupados por ferramentas comuns.

**Como evitar:**
- Range pouco popular: **7100-7199** (não tem heavy hitter conhecido nessa faixa).
- Documentar escolha no README + PROJECT.md ("Por que 7100? Range não-conflitante após pesquisa de portas comuns dev em 2026.").
- Configurável via flag `--port`, env `KIT_MCP_UI_PORT`, ou config file.
- Range scan automático (pitfall 8) cobre overlap raro.

**Sinais de alerta:**
- Bug reports de "porta em uso" na primeira semana de uso.

**Fase para abordar:**
**Fase 2 (sidecar boot)** — REQ: range default 7100-7199 + override via flag/env.

---

### Armadilha 19: Event payloads com paths absolutos vazando $HOME do dev em screenshot/share

**O que dá errado:**
Dev tira screenshot da UI pra demo no Discord ou bug report. Eventos mostram `/Users/sergio.almeida/secret-client-project/kit/...` ou `C:\Users\Pedro\OneDrive - AcmeCorp\projetos\...`. Vaza nome real do dev, empregador, projeto.

**Por que acontece:**
- onProgress callbacks atuais (sync, reverse-sync) emitem absPath (visto em `src/cli/index.js` linha 92, função `slim`).
- Devs raramente pensam em PII em logs internos.

**Como evitar:**
- Path scrubber centralizado: substitui `$HOME` por `~`, `projectRoot` por `<project>`, paths absolutos por relativos quando possível.
- Helper `redactPath(p, projectRoot)` aplicado em **TODO** payload de evento antes de send.
- Test: payload mock contendo `/Users/foo/bar`, validar saída `~/bar`.
- Documentar em README seção "Privacidade do sidecar".
- Bonus: flag `--scrub-aggressive` que também redact nomes de fases (substitui por hash) pra screenshots públicos.

**Sinais de alerta:**
- Code review: payload de evento com `${absPath}` sem redact.
- Bug report screenshot com nome de empresa/cliente visível.

**Fase para abordar:**
**Fase 3 (SSE endpoint — payload spec)**.

---

### Armadilha 20: DNS rebinding attack — site malicioso fala com sidecar via DNS truque

**O que dá errado:**
Usuário visita `evil.com`. Site faz JS: `fetch('http://victim-domain.com:7100/state')` onde DNS de `victim-domain.com` resolve primeiro pra IP público (passa CORS check via Origin), depois rebinds pra `127.0.0.1`. Browser, em alguns navegadores antigos ou config errada, deixa o segundo fetch passar. Site rouba dados do sidecar.

**Por que acontece:**
- Servers de localhost geralmente assumem que estão "seguros" e pulam validação.
- Browsers modernos têm proteção mas não 100%.

**Como evitar:**
- Validar `Host` header na request: deve ser `127.0.0.1:<port>` ou `localhost:<port>`. Rejeitar 403 se diferente.
- Validar `Origin` header em SSE/POST endpoints: aceitar apenas vazio (same-origin) ou `http://127.0.0.1:<port>` / `http://localhost:<port>`.
- CSP no HTML estático: `default-src 'self'; connect-src 'self'; script-src 'self'`.
- Documentar trade-off: "Sem auth porque é localhost, mas validamos Origin/Host pra mitigar DNS rebinding."

**Sinais de alerta:**
- Audit log mostra requests com `Host: foo.com` em vez de `localhost`.

**Fase para abordar:**
**Fase 6 (security hardening)** — Origin/Host check + CSP.

---

### Armadilha 21: Detached process orphans em Windows

**O que dá errado:**
`kit ui start` em modo background spawna `node sidecar.js` como detached. Em Windows, ChildProcess detached **ainda fica linkado ao console pai por default**. Fechar terminal do usuário mata o sidecar.

**Por que acontece:**
- Windows process tree e job objects são diferentes de Unix.
- `detached: true` no spawn options no Node tem semântica sutil em Windows.

**Como evitar:**
- Em Windows: usar `detached: true` + `windowsHide: true` + `stdio: 'ignore'` + `child.unref()`.
- Em macOS/Linux: `detached: true` + `stdio: ['ignore', logFile, logFile]` + `child.unref()`.
- Test: `kit ui start --detach`, fechar terminal, validar que sidecar continua via `curl /health`.
- Alternativa: rodar foreground sempre por simplicidade no v1.2 MVP, deixar daemon-mode pra v1.3+.

**Sinais de alerta:**
- Sidecar morre quando terminal fecha mesmo com `--detach`.
- Process tree mostra sidecar como child do shell.

**Fase para abordar:**
**Fase 2 (sidecar boot — daemon mode)** ou **diferir pra v1.3** (decisão de escopo).

---

### Armadilha 22: Firewall popups no primeiro start surpreendem usuário

**O que dá errado:**
Windows Defender, macOS Application Firewall, Linux ufw popam diálogo "Allow node.exe to accept incoming connections?" no primeiro start. Usuário não esperava, clica deny por pânico, sidecar não recebe conexões browser depois.

**Por que acontece:**
- OS firewalls hookam todo bind, mesmo loopback (em algumas configs).
- Bind explícito em `127.0.0.1` reduz mas não elimina.

**Como evitar:**
- README seção "Primeiro uso": screenshot do popup esperado, instrução "permita".
- Sidecar inicia com mensagem clara: "Servidor local rodando em http://127.0.0.1:7100 (loopback only — sem exposição de rede)."
- Bindar **exclusivamente** em 127.0.0.1 (pitfall 7) reduz incidência (loopback geralmente não dispara firewall).
- Test no CI Windows valida que primeira execução funciona sem intervenção manual (CI runners têm firewall config simples).

**Sinais de alerta:**
- "Connection refused" intermitente após reinstalar / após Windows update.
- Usuário relata popup do Defender e medo de permitir.

**Fase para abordar:**
**Fase 7 (docs & first-run UX)** — README + mensagem de boot.

---

### Armadilha 23: Sem auth — está OK pra localhost?

**O que dá errado:**
Qualquer processo local (extension de browser malicioso, npm package supply-chain compromise, app aleatório) pode bater em `http://127.0.0.1:7100/events` e ler todos os eventos do sidecar. Eventos podem conter paths (pitfall 19), nomes de fase, conteúdo de planos.

**Por que acontece:**
- Devs assumem que localhost = trusted boundary.
- Realidade: localhost = compartilhado entre todos processos do user.

**Como evitar:**
**Trade-off documentado** (decisão arquitetural):
- v1.2 MVP: **sem auth** — aceitar que outros processos locais do mesmo usuário podem ler.
- Mitigations parciais: CSP + Origin check (pitfall 20) + path scrubbing (pitfall 19).
- v1.3+ opt-in: token compartilhado via lockfile (token random), client manda em query string ou cookie.
- Documentar em README seção "Modelo de ameaça": "Se você roda processos não-confiáveis no mesmo user account do dev, não habilite o sidecar."

**Sinais de alerta:**
- Audit revisor pergunta sobre auth — resposta deve estar pronta no PROJECT.md.

**Fase para abordar:**
**Fase 1 (architecture lock)** — registrar trade-off explícito + **Fase 7 (docs)**.

---

### Armadilha 24: macOS Sandboxed Terminal sem entitlement abre browser silently fails

**O que dá errado:**
Terminal.app em macOS recente com config sandbox restrita não consegue spawnar Safari/Chrome via `open(1)`. Falha silente — exit code 0 mas browser não abre.

**Por que acontece:**
- macOS Catalina+ tem sandboxing mais agressivo.
- Algumas configs corp restringem child processes.

**Como evitar:**
- Validar exit code do `open` command.
- Após chamar open, esperar 2s e verificar via heuristic (não tem como saber direto se browser abriu).
- Fallback: imprimir URL com mensagem "Se browser não abriu, copie: http://...".
- Test em macOS CI verifica exit code 0 do open.

**Sinais de alerta:**
- macOS user reporta: "comando rodou mas nada abriu".

**Fase para abordar:**
**Fase 5 (browser-open)** — sempre imprimir URL como fallback visível.

---

### Armadilha 25: HTML estático servido sem MIME corretos — browser baixa em vez de renderizar

**O que dá errado:**
Server estático manual responde com `Content-Type: application/octet-stream` (default Node). Browser oferece "Save As" em vez de renderizar HTML/JS/CSS.

**Por que acontece:**
- `http.createServer` não infere MIME — dev tem que setar explicitamente.
- Lista de extensões → MIME é boilerplate que dev esquece.

**Como evitar:**
- Map mínimo: `.html → text/html; charset=utf-8`, `.js → text/javascript`, `.css → text/css`, `.svg → image/svg+xml`, `.json → application/json`, `.woff2 → font/woff2`.
- 1 helper `mimeFor(filename)` cobre 99%.
- Test: GET `/index.html` retorna `Content-Type: text/html`.

**Sinais de alerta:**
- Browser baixa arquivo em vez de renderizar.
- Console: "Refused to apply style — wrong MIME type".

**Fase para abordar:**
**Fase 4 (UI static serving)**.

---

## Padrões de Dívida Técnica

Atalhos que parecem razoáveis mas criam problemas a longo prazo.

| Atalho | Benefício Imediato | Custo a Longo Prazo | Quando É Aceitável |
|--------|--------------------|---------------------|--------------------|
| Adicionar Express/Fastify | Boilerplate menor (-30 LOC) | +30 deps, viola princípio min-deps, bundle size, audit anual | **Nunca** pra kit-mcp |
| Hardcode porta 3000/8080 | "Funciona aqui" | Conflito com 80% das stacks dev modernas | Nunca |
| Bind em 0.0.0.0 "porque tava trabalhando dois minutos atrás" | Funciona via WSL/VM imediatamente | Vaza pra rede, security incident | Apenas com flag opt-in explícita + warning |
| Sem cleanup `req.on('close')` | -5 LOC | Memory leak progressive, CPU spike sessões longas | Nunca |
| `console.log` no path do sidecar pra debug | Visibility rápida | Quebra MCP stdio em prod | Apenas atrás de `if (process.env.KIT_MCP_DEBUG)` apontando pra stderr |
| Sem heartbeat SSE | -10 LOC | Conexões fantasma, UI travada após sleep do laptop | Nunca |
| Sem path scrubbing nos eventos | Eventos "completos" | PII vaza em screenshots, GDPR-ish exposure | Nunca em payload da UI; OK em logs locais |
| Lockfile sem probe `process.kill(pid, 0)` | -15 LOC | Stale lock após crash impede start até `rm` manual | Nunca |
| Detached em Windows sem `windowsHide` + `unref` | "Funcionou em Linux" | Sidecar morre ao fechar terminal Windows | Diferir daemon mode pra v1.3 (foreground only no MVP) |
| `listen('localhost')` em vez de `'127.0.0.1'` | Mais "natural" | Bug v4/v6 dual stack em Windows + WSL | Nunca |
| Sem CSP no HTML | -3 LOC | XSS-ish via injection futura em event payload renderizado | Nunca |

---

## Armadilhas de Integração

Erros comuns ao conectar a serviços externos.

| Integração | Erro Comum | Abordagem Correta |
|------------|------------|-------------------|
| MCP stdio transport | Logar HTTP boot em stdout | Logs do sidecar em stderr ou arquivo `~/.kit-mcp/ui.log` |
| Browser EventSource | Servidor não envia heartbeat | `: ping\n\n` a cada 15-20s |
| Browser EventSource | Servidor não escuta `Last-Event-ID` | Ler header (mesmo sem replay no MVP) e logar |
| Open (browser launcher) | Spawn sem detection de headless | Detect `DISPLAY` + `CI` env, fallback para print URL |
| Open em Windows | `start ` com path com espaço | `cmd /c start "" "URL"` ou usar package `open` |
| Open em WSL | `xdg-open` em ambiente sem X | Detect WSL via `/proc/version`, usar `wslview` ou cmd.exe |
| onProgress callbacks existentes (sync, reverse-sync) | Emitir paths absolutos | Wrap todos os emits via `redactPath()` |
| chokidar (já dep) | Reusar pra hot-reload do HTML estático em dev mode | OK; mas não rodar em prod (consumo de inotify) |
| commander (já dep) | Adicionar comandos `ui start/stop/status` | Idiomático; reutilizar padrões existentes em `src/cli/index.js` |

---

## Armadilhas de Performance

Padrões que funcionam em pequena escala mas falham com o crescimento do uso.

| Armadilha | Sintomas | Prevenção | Quando Quebra |
|-----------|----------|-----------|---------------|
| Subscribers SSE sem cap | Memória crescente, CPU spike | Cap em 32 conexões, reject 503 acima | >50 reloads de browser sem cleanup |
| Broadcast loop O(n) síncrono em event hot path | Latência de tool call sobe | `setImmediate(() => broadcast())` desacopla | >10 subscribers ativos |
| Servir HTML estático lendo do disk a cada GET | I/O latency desnecessária | Cache em memória no boot (kit-mcp já faz boot rápido, OK pré-cachear ~50KB de assets) | Sempre — assets nunca mudam em runtime |
| Heartbeat per-client com setInterval separado | Drift entre intervals, leak se cleanup falha | 1 setInterval global → broadcast `: ping\n\n` a todos | >10 clients |
| JSON.stringify de eventos grandes (planos completos) sob hot path | Latência de tool, GC pressure | Diff-based events (só campos mudados); cap payload em 16KB | Eventos com plano inteiro >100KB |
| Pre-cache assets em memória sem ETag/304 | Reload sempre re-baixa | ETag derivado de hash de boot ou `mtime`, responder 304 | Múltiplos reloads de página |

> Nota: a escala esperada é **dezenas de eventos/segundo no peak**, **1-3 subscribers** (1 aba aberta normalmente). Não over-engineer pra 10k req/s.

---

## Erros de Segurança

Problemas de segurança específicos do domínio além da segurança web geral.

| Erro | Risco | Prevenção |
|------|-------|-----------|
| Sem Origin/Host check | DNS rebinding rouba estado do sidecar | Validar `Host` ∈ {`127.0.0.1:port`, `localhost:port`}, validar `Origin` em endpoints non-GET |
| Bind 0.0.0.0 acidental | Coffee-shop wifi expõe processos do dev | REQ duro: `listen(port, '127.0.0.1')` literal |
| Path leak em payloads | PII / nome de empregador / projeto privado em screenshots | `redactPath()` central em todo emit |
| Sem CSP no HTML | XSS via event payload renderizado direto no DOM | `Content-Security-Policy: default-src 'self'; connect-src 'self'; script-src 'self'` |
| Sem auth (decisão consciente) | Outro processo local lê eventos | Documentar trade-off; v1.3+ token-via-lockfile |
| Token de lockfile via process listing | Outros usuários do laptop vêem cmdline | (Quando token implementado) gravar em lockfile com 0600, nunca em CLI args |
| Logs persistidos sem rotação | Disco cheio + path leak histórico | `~/.kit-mcp/ui.log` com max 5MB, rotação manual ou `--no-log` flag |
| Sidecar rodando após terminar uso | Surface de ataque persistente | Auto-shutdown após N minutos sem subscribers (configurável; padrão 30min) |

---

## Armadilhas de UX

Erros comuns de experiência do usuário neste domínio.

| Armadilha | Impacto no Usuário | Melhor Abordagem |
|-----------|-------------------|------------------|
| Browser fica em "connecting..." sem mensagem após server kill | Confusão, tentativas de F5, eventual reboot | Server emite `event: shutdown` antes de exit; UI mostra banner "Server stopped" |
| Sem indicador de conexão SSE na UI | "Está atualizando? Travou?" | Dot verde/amarelo/vermelho no canto: connected / reconnecting / disconnected |
| Mensagem de erro genérica "EADDRINUSE" | Usuário não sabe que pode passar `--port` | Mensagem humana: "Porta 7100 em uso. Tentando 7101... 7102 OK. Visit http://127.0.0.1:7102" |
| `kit ui status` sem URL clicável | Tem que digitar a URL | Imprimir `http://127.0.0.1:7100` em ANSI-link (terminais modernos linkificam) |
| Auto-spawn em background sem feedback no terminal | Dev não sabe que sidecar está rodando | Print 1-line "[ui] http://127.0.0.1:7100" no stderr no auto-spawn |
| Logs do sidecar misturados com output do CLI | Ruído visual | Isolar logs do sidecar em arquivo; CLI summary 1 linha |
| Browser abre em janela nova vs aba existente | Comportamento inconsistente | Documentar: behavior depende do OS/browser; usar URL estável (mesma porta sempre) → browser reusa aba |
| Reload do browser perde estado da UI | "Cadê meu histórico?" | Endpoint `/state` retorna snapshot atual; client hydrate-on-load |
| Dark mode não respeitado | Estresse visual em dev mode escuro | `prefers-color-scheme` CSS, HTML estático mínimo respeita |
| Sem keyboard shortcuts | Cliques pra tudo | Shortcuts simples (q quit-server-via-fetch, r reload, /search) — diferir pra v1.3 |

---

## Checklist "Parece Pronto Mas Não Está"

Coisas que parecem completas mas estão faltando peças críticas.

- [ ] **SSE endpoint:** Frequentemente falta `req.on('close')` cleanup — verificar com test "100 connect+disconnect, subscribers=0 ao final"
- [ ] **SSE endpoint:** Frequentemente falta heartbeat — verificar pinging cada 15-20s mesmo sem eventos da aplicação
- [ ] **SSE endpoint:** Frequentemente falta `flushHeaders()` — verificar primeiro evento chega <100ms em Edge/Firefox
- [ ] **SSE endpoint:** Frequentemente falta `X-Accel-Buffering: no` — verificar header presente em response
- [ ] **HTTP server:** Frequentemente falta bind explícito em 127.0.0.1 — verificar `netstat` mostra `127.0.0.1:7100` (não `0.0.0.0` nem `:::7100`)
- [ ] **HTTP server:** Frequentemente falta validação de `Host` header — verificar request com `Host: evil.com` retorna 403
- [ ] **HTTP server:** Frequentemente falta CSP no HTML — verificar header `Content-Security-Policy` presente
- [ ] **Browser-open:** Frequentemente falta detection de headless — verificar `CI=true kit ui start` não tenta abrir browser
- [ ] **Browser-open:** Frequentemente falta detection de WSL — verificar em WSL2 abre no Windows host
- [ ] **Browser-open:** Frequentemente falta fallback "imprime URL" — verificar que mesmo se open falha, URL aparece no stderr
- [ ] **Lockfile:** Frequentemente falta probe `process.kill(pid, 0)` — verificar start funciona após crash anterior
- [ ] **Lockfile:** Frequentemente falta `O_EXCL` atômico — verificar 2 starts simultâneos têm comportamento determinístico
- [ ] **Process lifecycle:** Frequentemente falta evento `shutdown` enviado antes de exit — verificar UI mostra banner em SIGINT
- [ ] **Process lifecycle:** Frequentemente falta cleanup de lockfile no exit — verificar lockfile sumiu após Ctrl-C limpo
- [ ] **Path scrubbing:** Frequentemente falta scrub em onProgress emits existentes — verificar payload mock com `/Users/foo/...` redactado
- [ ] **MCP stdio:** Frequentemente falta isolation de logs do sidecar — verificar JSON-RPC válido em stdout durante `kit ui start --auto-spawn`
- [ ] **Multi-instance:** Frequentemente falta keying do lockfile por projectRoot — verificar 2 projetos abertos ≠ conflito
- [ ] **MIME types:** Frequentemente falta `text/html; charset=utf-8` — verificar browser renderiza em vez de baixar
- [ ] **Reconnect:** Frequentemente falta loop de reconnect funcionar com server reiniciado — verificar matar+revive em <10s, EventSource resume
- [ ] **Tests cross-platform:** Frequentemente falta CI matrix Win/Mac/Linux — verificar GitHub Actions cobre os 3 com smoke do sidecar

---

## Estratégias de Recuperação

Quando armadilhas ocorrem apesar da prevenção, como se recuperar.

| Armadilha | Custo de Recuperação | Passos de Recuperação |
|-----------|----------------------|----------------------|
| Stale lockfile | LOW | `kit ui stop --force` ou `rm ~/.kit-mcp/ui*.lock`; reissue start |
| EADDRINUSE em range exausto | LOW | `kit ui status --all` lista; `kit ui stop --port 7100` ou `--port` flag pra range diferente |
| stdout poluído quebrou MCP | MEDIUM | Cliente IDE re-spawna automaticamente; identificar o log culpado via grep/audit; patch + republish; bump patch version |
| Memory leak SSE em prod | MEDIUM | User reinicia IDE (re-spawna MCP); patch fix no `req.on('close')` cleanup; CI test memory leak adicionado |
| Path leak em screenshot já compartilhada | HIGH | Não tem unrevoke. Comunicação ao user; patch redactor; release notes destacam fix |
| DNS rebinding exploit ativo | HIGH | Patch emergencial Origin/Host check; bump patch version; security advisory |
| Múltiplas instâncias conflitando (race lockfile) | MEDIUM | Documentar workaround `kit ui stop --force --all`; patch usar O_EXCL atomic |
| Bind em 0.0.0.0 vazado | HIGH | Hotfix bind explicit; security note; lembrar usuário de checar firewall |
| Browser-open quebrado em uma plataforma | LOW | User passa `--no-open` + copia URL; patch detection branch |
| Sidecar consome 100% CPU em loop de reconnect quebrado | MEDIUM | Kill processo manual; identificar trigger (heartbeat-miss bug); patch + adicionar circuit breaker |

---

## Mapeamento de Armadilhas por Fase

Como as fases do roadmap devem abordar estas armadilhas. (Numeração proposta para v1.2 — roadmapper finaliza.)

| Armadilha | Fase de Prevenção | Verificação |
|-----------|-------------------|-------------|
| 1. stdout poluindo MCP | Fase 2 (sidecar boot) | Smoke test "MCP JSON-RPC uncorrupted with sidecar" |
| 2. SSE buffering | Fase 3 (SSE endpoint) | Headers + flushHeaders presentes; heartbeat <20s |
| 3. Connection leak | Fase 3 (SSE endpoint) | Test: 100 connect/disconnect → subscribers=0 |
| 4. req.on('close') unreliable | Fase 3 (SSE) + 6 (hardening) | Test: kill -9 client, server cleans up <30s |
| 5. UTF-8 multi-byte split | Fase 3 (SSE) | Test snapshot com emoji + acentos PT-BR |
| 6. Last-Event-ID ignorado | Fase 1 (decisão arq.) + 3 (impl.) | Decisão documentada; endpoint `/state` na Fase 4 |
| 7. Bind 0.0.0.0 | Fase 2 (boot) | `netstat` mostra 127.0.0.1 only |
| 8. EADDRINUSE | Fase 2 (boot) | Test: porta ocupada → range scan funciona |
| 9. IPv6/IPv4 dual stack | Fase 2 (boot) | Test cross-platform Windows/macOS/Linux |
| 10. WSL browser-open | Fase 5 (browser-open) | Manual smoke em WSL2 |
| 11. Stale lockfile | Fase 2 (boot — lockfile) | Test: kill -9 + new start succeeds |
| 12. Race concurrent start | Fase 2 (boot — lockfile) | Test: 5 starts paralelos → 1 wins, 4 conectam ou falham clean |
| 13. SIGINT broken UI feedback | Fase 4 (UI) + 6 (hardening) | Manual: Ctrl-C terminal, browser mostra banner shutdown |
| 14. Multi-instance shared sidecar | Fase 1 (arq.) + 2 (boot) | Decisão documentada; test 2 IDEs paralelas |
| 15. Windows quoting hell | Fase 5 (browser-open) | Test path com espaço em CI Windows |
| 16. Headless / CI | Fase 5 (browser-open) | CI passa com `--no-open` implícito quando `CI=true` |
| 17. Express creep | Fase 1 (architecture lock) | PR gate: `npm ls` não cresce >+1 dep |
| 18. Hardcode 3000/8080 | Fase 2 (boot) | Range default 7100-7199 documentado |
| 19. Path leak | Fase 3 (SSE — payload spec) | Test: payload com /Users/foo redactado para ~/foo |
| 20. DNS rebinding | Fase 6 (security) | Test: GET com Host: evil.com → 403 |
| 21. Detached orphans Windows | Fase 2 (boot) ou v1.3 deferir | Test: terminal close, sidecar continua via /health |
| 22. Firewall popups | Fase 7 (docs) | README first-run section |
| 23. Sem auth | Fase 1 (decisão arq.) + 7 (docs) | Trade-off documentado em PROJECT.md |
| 24. macOS sandbox open fail | Fase 5 (browser-open) | Always print URL fallback |
| 25. MIME types | Fase 4 (UI static) | Test: GET /index.html → text/html |

### Fases sugeridas (esqueleto pra roadmapper)

1. **Fase 1 — Arquitetura lock & decisões pendentes**: lockar zero-deps (max+1), Last-Event-ID NACK, multi-instance singleton-by-projectRoot, sem auth no MVP.
2. **Fase 2 — Sidecar boot (HTTP server + lockfile + porta)**: range 7100-7199, bind 127.0.0.1, lockfile O_EXCL+probe, logs em stderr/arquivo.
3. **Fase 3 — SSE endpoint**: headers obrigatórios, heartbeat, cleanup, helper sendEvent, payload spec com redactPath.
4. **Fase 4 — UI estática (HTML/CSS/JS)**: MIME map, CSP, indicador de conexão, /state endpoint, shutdown banner.
5. **Fase 5 — Browser-open cross-platform**: detection matrix, fallback print URL, opt `--no-open`, CI matrix.
6. **Fase 6 — Hardening (security + lifecycle)**: Origin/Host check, shutdown event, memory-leak tests, kill -9 recovery.
7. **Fase 7 — CLI commands & docs (`kit ui` + `--auto-spawn` + README)**: `kit ui start/stop/status`, integração com tools existentes via onProgress, README "first run" + "modelo de ameaça".
8. **Fase 8 — Smoke & release**: CI cross-platform (Win/Mac/Linux × Node 20/22), changelog, version bump 1.2.0, publicar.

---

## Fontes

- **Web**: especificações HTML/SSE (whatwg.org) — comportamento de EventSource e Last-Event-ID
- **Web**: post-mortems Express/Fastify SSE bugs — buffering, cleanup
- **Web**: nginx docs — `X-Accel-Buffering` header behavior; relevante mesmo em loopback se proxies locais
- **Web**: Mozilla Observatory / OWASP — DNS rebinding mitigations para localhost servers
- **Node.js docs**: `http.Server.listen`, `child_process.spawn` (detached behavior Windows vs Unix), `process.kill(pid, 0)` cross-platform
- **Codebase atual**: `D:\projetos\opensource\mcp\src\mcp-server\index.js` (transport stdio MCP), `D:\projetos\opensource\mcp\src\cli\index.js` (commander pattern + onProgress callbacks já existentes em sync/reverse-sync)
- **PROJECT.md**: `D:\projetos\opensource\mcp\.planning\PROJECT.md` — decisões de stack (zero-deps, cross-platform, opt-in)
- **Memory handoff**: `next_session_v12.md` — contexto pausado pós-1.1.0, GUI sidecar como objetivo
- **Experiência ecossistema**: padrões de sidecar similares (Vite dev server, Storybook, Astro Studio) — escolhas de port range, single-instance behavior, browser-open libs
- **Anti-padrão observado**: muitos projetos pequenos quebram MCP stdio adicionando logs sem isolar canal — bug class conhecido em ferramentas MCP early stage

---

*Pesquisa de armadilhas para: kit-mcp v1.2 — sidecar HTTP+SSE local em MCP server stdio existente*
*Pesquisado: 2026-05-04*
*Output destino: `.planning/research/PITFALLS.md` — consumido pelo roadmapper para gerar fases + critérios de sucesso + smoke tests específicos.*
