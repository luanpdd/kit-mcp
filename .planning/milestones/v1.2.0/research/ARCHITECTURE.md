# Pesquisa de Arquitetura — kit-mcp v1.2 (GUI sidecar)

**Domínio:** Live process viewer (web localhost + SSE) acoplado a um MCP server (stdio) e um CLI Node, ambos já existentes em v1.1.
**Pesquisado:** 2026-05-04
**Confiança:** HIGH (codebase inteiramente lida; integração mapeada para módulos reais; nenhuma incógnita de stack — `http`, `EventEmitter`, `fs`, `os` são todos `node:*` builtins).

---

## Resumo executivo da decisão arquitetural

Três decisões guiam todo o desenho abaixo. Elas resolvem a tensão central do milestone (um CLI eventual, um MCP server stdio sempre vivo, e um navegador que precisa de um endpoint TCP estável):

1. **Servidor HTTP é um processo separado, single-instance, controlado por lockfile em `os.tmpdir()`** — não vive dentro do MCP server stdio nem dentro de uma invocação efêmera de `kit sync`. Isso desacopla lifecycle do GUI do lifecycle do MCP/CLI e permite que **múltiplos publishers** (o MCP server respondendo a uma tool call, e um `kit sync install` rodando no terminal) publiquem para o mesmo browser.
2. **Publicação dos eventos é via HTTP POST `/publish`** (não EventEmitter in-process, não pipe nomeado, não socket Unix). O bus in-process só existe **dentro** do ui-server; publishers externos (MCP server, CLI) descobrem `port` via lockfile e fazem `fetch` para `http://127.0.0.1:<port>/publish`. Isso é trivialmente cross-platform e não exige IPC.
3. **`onProgress` permanece intacto.** A integração é um **wrapper opt-in** (`wrapProgressForUi`) que o **caller** monta — `syncTo`, `applyReverse` etc. **não conhecem o ui-server**. Isso preserva a Stable API v1.0+ literalmente: assinaturas, retornos e ausência de globals.

```
publishers (efêmeros, múltiplos)        ui-server (singleton)         consumer (1+ browsers)
─────────────────────────────────       ─────────────────────         ─────────────────────
CLI    `kit sync install ...`  ──┐
MCP    server tool call        ──┼──►  HTTP POST /publish  ──►  EventEmitter  ──►  SSE /events
CLI    `kit reverse-sync apply`──┘     (port descoberta via                          ↓
                                        lockfile em tmpdir)                       index.html
```

---

## Visão Geral do Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Camada de Apresentação                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Browser (Chrome/Firefox/Edge)                                         │   │
│  │   GET  /          → static index.html  (lista de runs ao vivo)        │   │
│  │   GET  /events    → EventSource SSE stream                            │   │
│  └────────────────────────────────┬─────────────────────────────────────┘   │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │ HTTP/1.1 keep-alive
┌───────────────────────────────────┴─────────────────────────────────────────┐
│                     Camada Sidecar (processo separado, detached)             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ src/ui/server.js — http.Server                                        │   │
│  │   Routes:                                                             │   │
│  │     GET  /            → src/ui/static/index.html (+ inline JS/CSS)   │   │
│  │     GET  /events      → SSE (text/event-stream, retry: 3000)         │   │
│  │     POST /publish     → JSON event → bus.emit('event', evt)          │   │
│  │     GET  /healthz     → 200 OK (lockfile validation)                  │   │
│  │     POST /shutdown    → graceful close (only from 127.0.0.1)         │   │
│  │                                                                       │   │
│  │   In-process: EventEmitter (~10 listeners max — 1 per browser tab)   │   │
│  │   Ring buffer: last N=200 eventos (replay quando browser conecta)    │   │
│  │   Lockfile: { port, pid, version, startedAt } em tmpdir              │   │
│  │   Idle shutdown: timer 5min sem eventos E sem clientes SSE           │   │
│  └────────────────────────────────┬─────────────────────────────────────┘   │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │ HTTP POST /publish (loopback only)
┌───────────────────────────────────┴─────────────────────────────────────────┐
│                       Camada de Publishers (efêmeros)                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ src/cli/index.js │  │ src/mcp-server/  │  │ qualquer chamador        │   │
│  │  withProgress()  │  │   index.js       │  │  futuro de syncTo/       │   │
│  │  → wraps onProg. │  │  handleSync()    │  │  applyReverse            │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘   │
│           │                     │                          │                 │
│           └─────────┬───────────┴──────────────┬───────────┘                 │
│                     ▼                          ▼                             │
│            src/ui/client.js — publish(evt) → discoverPort() → fetch         │
│                                  (silent fail se ui-server offline)         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ chama
┌───────────────────────────────────┴─────────────────────────────────────────┐
│                         Camada Core (intocada)                               │
│  src/core/sync.js          — syncTo(targetId, { onProgress })               │
│  src/core/reverse-sync.js  — applyReverse(targetId, { onProgress })         │
│  src/core/kit.js           — listKit, resolveKitRoot                        │
│  Assinaturas: ZERO mudanças. Stable API v1.0+ preservada.                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Responsabilidades dos Componentes

| Componente | Responsabilidade | Implementação |
|------------|------------------|---------------|
| `src/ui/server.js` | http.Server singleton; rotas /events, /publish, /; ring buffer; idle shutdown | `node:http` + `EventEmitter` puros; sem deps novas |
| `src/ui/lockfile.js` | Adquire/lê/libera lockfile atômico em `os.tmpdir()/kit-mcp-ui.lock` | `fs.writeFile` com flag `wx` (exclusive create); fallback validação por `/healthz` |
| `src/ui/client.js` | Stateless helper: `publish(event)` resolve port via lockfile e faz POST; falha silenciosa | `node:http` request, no-op se ECONNREFUSED |
| `src/ui/wrapper.js` | `wrapProgressForUi(onProgress, runId)` — devolve novo callback que multiplexa terminal + publish | Closure simples, 20 LOC |
| `src/ui/static/index.html` | Página única (HTML + CSS inline + JS inline) consumindo `/events` | Sem build, sem framework, ~300 LOC |
| `src/ui/browser.js` | Cross-platform `openBrowser(url)` (`open`/`xdg-open`/`start`) | `child_process.spawn` detached |
| `src/cli/index.js` | Adiciona subcomando `kit ui {start|stop|status|open}` | Commander, ~80 LOC adicionais |
| `src/mcp-server/index.js` | Adiciona param `--auto-spawn` opcional nas tools `sync` e `reverse-sync`; wrapeia onProgress quando true | ~30 LOC adicionais |
| `bin/ui.js` (opcional) | Entry-point quando `kit ui start` precisa fork-detach um processo do server | `child_process.spawn(node, [bin/ui.js], { detached: true, stdio: 'ignore' })` |

---

## Estrutura de Projeto Recomendada

```
src/
├── core/                       # INTOCADO (Stable API)
│   ├── sync.js                 # exporta syncTo, statusOf, removeFrom
│   ├── reverse-sync.js         # exporta detectReverse, applyReverse
│   └── ...                     # ui.js, kit.js, gates.js, etc.
│
├── ui/                         # NOVO — toda a sidecar
│   ├── server.js               # http.Server + bus + ring buffer + idle timer
│   ├── lockfile.js             # acquire/read/release/validate
│   ├── client.js               # publish() helper (usado por publishers)
│   ├── wrapper.js              # wrapProgressForUi(cb, runId)
│   ├── browser.js              # openBrowser(url) cross-platform
│   ├── port.js                 # findFreePort(prefer=4179) — getaddrinfo + listen-then-close
│   ├── events.js               # newRunId(), eventSchema, validateEvent
│   └── static/
│       └── index.html          # tudo inline (HTML+CSS+JS) — single file
│
├── cli/
│   ├── index.js                # + subcomando `ui` (start/stop/status/open)
│   └── render.js               # + render para `kit ui status`
│
└── mcp-server/
    └── index.js                # + flag autoSpawn nas tools sync/reverse-sync

bin/
├── cli.js                      # entry CLI (intocado)
├── mcp.js                      # entry MCP stdio (intocado)
└── ui.js                       # NOVO — entry detached do ui-server
                                #   (necessário pra `start` poder spawn-detach)

package.json
└── files: [ "bin/", "src/", "kit/", "gates/", ... ]
                                # `src/` já cobre src/ui/ inclusive o static/.
                                # Verificar: arquivos não-.js dentro de src/
                                # (index.html) precisam estar listados ou
                                # cobertos pelo glob — `src/` cobre TUDO.
```

### Justificativa da Estrutura

- **`src/ui/` separado de `src/core/`:** core é puro/funcional/testado em isolamento; ui é I/O-pesado (sockets, processos, browsers). Manter separados protege a fronteira de pureza do core.
- **`src/ui/static/` dentro do código (não em `kit/ui/`):** a UI é parte da implementação do kit-mcp, não conteúdo do usuário. `kit/` é fonte canônica do **conteúdo distribuído** (agents, commands). Misturar quebra o modelo mental.
- **`bin/ui.js` separado de `bin/cli.js`:** quando `kit ui start` faz spawn-detached, ele precisa de um entry sem o overhead do commander parsing — apenas `import { startUiServer } from '../src/ui/server.js'; startUiServer().catch(...)`.
- **`files: ["src/", ...]` no package.json (já está):** cobre `src/ui/static/index.html` automaticamente. Verificar com `npm pack --dry-run` na fase de prep.

---

## Padrões Arquiteturais

### Padrão 1: Single-instance via lockfile + healthz validation

**O que é:** primeiro `kit ui start` cria `os.tmpdir()/kit-mcp-ui.lock` com `{port, pid, version, startedAt}`. Subsequentes `start` leem o lock, fazem `GET /healthz` na port — se 200, abrem o browser na port existente; se ECONNREFUSED, lock é stale (processo morreu sem cleanup), removem e seguem.

**Quando usar:** sempre. É o único jeito honesto de garantir 1 servidor por máquina sem coordenação externa.

**Trade-offs:**
- ✓ Cross-platform (tmpdir existe em todo OS)
- ✓ Sobrevive a crash do publisher (lock é só metadata; healthz é a verdade)
- ✗ Race teórica entre dois `start` simultâneos — mitigar com `fs.writeFile(path, data, { flag: 'wx' })` (exclusive); se EEXIST, ler+validar.

**Exemplo:**
```javascript
// src/ui/lockfile.js
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const LOCK_PATH = path.join(os.tmpdir(), 'kit-mcp-ui.lock');

export async function acquireLock(meta) {
  try {
    await fs.writeFile(LOCK_PATH, JSON.stringify(meta), { flag: 'wx' });
    return { acquired: true, meta };
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const existing = await readLock();
    const alive = await pingHealthz(existing.port).catch(() => false);
    if (alive) return { acquired: false, meta: existing };
    await fs.rm(LOCK_PATH, { force: true });
    return acquireLock(meta);  // retry once
  }
}

export async function readLock() {
  return JSON.parse(await fs.readFile(LOCK_PATH, 'utf8'));
}
```

### Padrão 2: Loopback-only HTTP publisher (em vez de IPC)

**O que é:** publishers (CLI, MCP server) **não compartilham processo** com o ui-server. Para emitir eventos, fazem `http.request({ host: '127.0.0.1', port, path: '/publish', method: 'POST' })`.

**Quando usar:** quando você precisa de N publishers efêmeros conversando com 1 servidor estável. Alternativas (named pipes, Unix domain sockets) introduzem assimetria Windows/Unix; HTTP loopback é simétrico.

**Trade-offs:**
- ✓ Zero IPC primitives, zero diferenças de OS
- ✓ Mesma abstração que o browser usa (debug com `curl`)
- ✓ Timeout natural (1s) — se ui-server tá lento, publisher não trava
- ✗ ~1ms overhead por evento vs. EventEmitter direto (irrelevante: eventos são ~10/s no pior caso, syncTo emite 1 por arquivo escrito)
- ✗ Loopback ainda é uma porta TCP — bind a `127.0.0.1` (não `0.0.0.0`!) por segurança

**Exemplo:**
```javascript
// src/ui/client.js
import http from 'node:http';
import { readLock } from './lockfile.js';

let cachedPort = null;

export async function publish(event) {
  if (cachedPort === null) {
    try { cachedPort = (await readLock()).port; }
    catch { cachedPort = 0; return; }  // no server, no-op
  }
  if (cachedPort === 0) return;

  const body = JSON.stringify(event);
  const req = http.request({
    host: '127.0.0.1', port: cachedPort, path: '/publish',
    method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    timeout: 1000,
  });
  req.on('error', () => { cachedPort = null; });  // server died → re-resolve next time
  req.on('timeout', () => req.destroy());
  req.write(body);
  req.end();
  // fire-and-forget: NÃO await
}
```

### Padrão 3: Wrapper de onProgress (não invasão do core)

**O que é:** o **caller** (CLI, MCP handler) sabe se o ui-server está ativo e decide se quer multiplexar. Quem chama `syncTo` passa um `onProgress` que já é wrapado.

**Quando usar:** sempre. Alternativas (env var, singleton module) violam o princípio "Sem state global; tudo passa por argumentos".

**Trade-offs:**
- ✓ Stable API v1.0 literalmente preservada — `syncTo` ignora a existência do ui-server
- ✓ Testável: passar mock onProgress, verificar que recebe os eventos terminal+ui
- ✗ Boilerplate em cada caller (3 linhas) — aceitável dado que só há ~5 call sites

**Exemplo:**
```javascript
// src/ui/wrapper.js
import { publish } from './client.js';
import { newRunId } from './events.js';

export function wrapProgressForUi(originalOnProgress, ctx) {
  const runId = newRunId();
  publish({ type: 'run.start', runId, op: ctx.op, target: ctx.target, ts: Date.now() });

  return (progressEvt) => {
    originalOnProgress(progressEvt);  // terminal continua igual
    publish({
      type: 'progress', runId,
      phase: progressEvt.phase, current: progressEvt.current,
      total: progressEvt.total, label: progressEvt.label, ts: Date.now(),
    });
  };
}

// Use site (src/cli/index.js):
//   const onProgress = wrapProgressForUi(rawOnProgress, { op: 'sync', target });
//   await syncTo(target, { onProgress, ... });
//   publish({ type: 'run.end', runId, ts: Date.now() });
```

### Padrão 4: SSE com ring buffer + retry

**O que é:** quando um browser conecta em `/events`, primeiro **replay** dos últimos N eventos do ring buffer (para que abrir a página no meio de um sync mostre algo), depois stream live.

**Quando usar:** sempre que SSE serve estado mutável que o cliente pode ter perdido.

**Trade-offs:**
- ✓ UX: usuário abre browser depois do sync começar e vê histórico
- ✓ Reconexão automática: o EventSource do browser re-conecta com `Last-Event-ID` (suportar opcionalmente — ring buffer já cobre 99%)
- ✗ Ring buffer cresce em memória se nunca shrinkado — fixar em 200 eventos (~50KB)

**Exemplo:**
```javascript
// src/ui/server.js (trecho /events handler)
function handleEvents(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  // replay
  for (const evt of ringBuffer) res.write(`data: ${JSON.stringify(evt)}\n\n`);

  const listener = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);
  bus.on('event', listener);
  clientCount++;

  req.on('close', () => {
    bus.off('event', listener);
    clientCount--;
    bumpIdleTimer();
  });
}
```

---

## Fluxo de Dados

### Fluxo 1: Usuário roda `kit sync install claude-code` no terminal, com ui-server já ativo

```
[user]
  └─► `kit sync install claude-code`
        │
        ├─► CLI: lockfile.readLock() → { port: 4179, pid: 8421, ... }
        ├─► CLI: ping /healthz → 200 OK → ui-server vivo
        ├─► CLI: rawOnProgress = progress({ total: 300 })   // terminal bar
        ├─► CLI: onProgress = wrapProgressForUi(rawOnProgress, { op: 'sync', target: 'claude-code' })
        │         └─► publish({ type: 'run.start', runId: 'r-abc', ... })
        │               └─► POST 127.0.0.1:4179/publish
        │                     └─► ui-server: bus.emit('event', evt) → SSE → browser renderiza nova run
        ├─► CLI: syncTo('claude-code', { onProgress })       // src/core/sync.js INTOCADO
        │         └─► (300 vezes) onProgress({ phase, current, total, label })
        │                          ├─► rawOnProgress → terminal bar tick
        │                          └─► publish({ type: 'progress', ... })
        │                                └─► ui-server → bus → SSE → browser atualiza %
        └─► CLI: publish({ type: 'run.end', runId: 'r-abc', ts: ... })
              └─► ui-server → bus → SSE → browser marca run concluída
```

### Fluxo 2: IDE (Claude Code) chama tool `sync` com `auto-spawn=true`, sem ui-server ativo

```
[Claude Code]
  └─► MCP request: sync { action: 'install', target: 'cursor', autoSpawn: true }
        │
        └─► src/mcp-server/index.js: handleSync()
              ├─► lockfile.readLock() → ENOENT → ui-server não existe
              ├─► autoSpawn === true →
              │     spawn(node, ['bin/ui.js'], { detached: true, stdio: 'ignore' }).unref()
              │     await waitForHealthz(timeout=2000)        // poll /healthz até 200
              │     openBrowser('http://127.0.0.1:<port>/')
              ├─► onProgress = wrapProgressForUi(noop, { op: 'sync', target: 'cursor' })
              ├─► await syncTo('cursor', { onProgress })       // INTOCADO
              └─► return { written, ... }                       // resposta MCP normal
```

### Fluxo 3: `kit ui start` quando já existe um processo

```
[user]
  └─► `kit ui start`
        │
        ├─► lockfile.acquireLock({ port: ?, pid: <my-pid>, ... })
        │     ├─► writeFile(.lock, ..., { flag: 'wx' }) → EEXIST
        │     ├─► readLock() → { port: 4179, pid: 8421 }
        │     ├─► pingHealthz(4179) → 200 OK
        │     └─► return { acquired: false, meta }
        │
        ├─► console: "kit-mcp UI already running at http://127.0.0.1:4179/ (pid 8421)"
        └─► openBrowser('http://127.0.0.1:4179/')              // reabre no browser existente
```

### Fluxo 4: Idle shutdown

```
[ui-server, sem clientes SSE há 5min, sem POST /publish há 5min]
  └─► idleTimer fires
        ├─► server.close()         // para de aceitar novas conexões
        ├─► fs.rm(LOCK_PATH)
        └─► process.exit(0)
```

### Fluxos de Dados Principais

1. **Run lifecycle:** `run.start` → N × `progress` → `run.end` (ou `run.error`). Cada run tem `runId` único; browser agrupa por `runId`.
2. **Discovery:** publisher → `readLock()` → `port` cacheada. Em ECONNREFUSED, invalida cache e tenta de novo.
3. **Replay:** browser conecta em `/events` → recebe ring buffer (até 200 eventos passados) → stream live.
4. **Shutdown:** `kit ui stop` → POST `/shutdown` → server.close + rm lockfile. Ou idle timer. Ou SIGTERM (handler libera lockfile antes de exit).

---

## Lifecycle do Servidor — decisões finais

| Pergunta | Decisão |
|----------|---------|
| Foreground ou detached? | **Detached por padrão** (`spawn(..., { detached: true, stdio: 'ignore' }).unref()`). Foreground via `kit ui start --foreground` para debug. |
| Encerramento idle? | **Sim, 5min** sem clientes SSE E sem POST /publish. Configurável via `--idle-ms`. |
| `kit ui stop` explícito? | **Sim.** Lê lockfile, POST /shutdown. Server faz cleanup e exit. |
| Cleanup em crash? | Lockfile fica órfão; próximo `kit ui start` detecta via healthz fail e remove. |
| Reentry? | `kit ui start` quando já vivo: **abre browser na port existente, exit 0**. Não falha. |
| Sinais? | SIGINT/SIGTERM no ui-server → graceful close (drena clientes SSE, libera lockfile, exit). |
| Logs? | stderr do ui-server vai pra `os.tmpdir()/kit-mcp-ui.log` (rotação simples por tamanho). Cruzar com `--foreground` que mantém em stderr direto. |

---

## Build Order (topológico — fase a fase, sem ciclos)

Esta é a ordem em que o roadmapper deve sequenciar as fases. Cada item depende **apenas** de itens acima.

### Fase A — Fundações (sem UI ainda)
1. **`src/ui/events.js`** — schema/validador de eventos, `newRunId()`. Nada depende de I/O.
2. **`src/ui/port.js`** — `findFreePort(preferred=4179)`. Usa `net.createServer().listen(0)` truque.
3. **`src/ui/lockfile.js`** — `acquireLock`, `readLock`, `releaseLock`, com retry se stale. Depende de `port.js` indiretamente (lockfile carrega port escolhida).
4. **Tests unit:** events validator, port finder, lockfile (com tmpdir mock).

### Fase B — Servidor HTTP standalone
5. **`src/ui/server.js`** — `startUiServer({ port, idleMs }) → { close }`. Implementa `/healthz`, `/publish`, `/events`, `/shutdown`. Bus interno (EventEmitter), ring buffer.
6. **`src/ui/static/index.html`** — single-file UI (HTML+CSS+JS inline) consumindo `/events`. Lista runs, mostra progresso, live-updating.
7. **`bin/ui.js`** — entry script para spawn-detached. Importa `startUiServer`, registra signal handlers.
8. **Tests integration:** server boot, /publish round-trip via /events, shutdown via /shutdown e SIGTERM.

### Fase C — Cliente publisher
9. **`src/ui/client.js`** — `publish(event)` fire-and-forget; resolve port via lockfile; cache; falha silenciosa.
10. **`src/ui/wrapper.js`** — `wrapProgressForUi(onProgress, ctx)`. Depende de `client.js` e `events.js`.
11. **`src/ui/browser.js`** — `openBrowser(url)` cross-platform (`open`/`xdg-open`/`start`).

### Fase D — Integração CLI
12. **`src/cli/index.js`** — subcomando `kit ui` com `start`, `stop`, `status`, `open`.
13. **`src/cli/render.js`** — renderer para `kit ui status` (port, pid, uptime, clients).
14. **`src/cli/index.js` — wrap onProgress** em `sync install`, `sync watch`, `reverse-sync apply` quando lockfile existe (auto-detectado, opt-in via `--ui` flag ou env `KIT_MCP_UI=1`).

### Fase E — Integração MCP server
15. **`src/mcp-server/index.js`** — adicionar param `autoSpawn` em tools `sync` e `reverse-sync`. Quando true e lockfile ausente, spawn `bin/ui.js` detached, espera healthz, abre browser, depois invoca core normalmente com onProgress wrapado.
16. **TOOLS schema** — atualizar `inputSchema` para incluir `autoSpawn: { type: 'boolean' }`.

### Fase F — Hardening
17. **Idle timer** afinado (já implementado em B, mas agora com telemetria via `kit ui status`).
18. **Crash recovery tests** — kill -9 do ui-server, verificar que `kit ui start` recupera.
19. **Multi-publisher race tests** — 2 CLIs paralelos publicando, validar que browser recebe interleaved sem perda.
20. **`npm pack` smoke** — verificar que `src/ui/static/index.html` é incluído.

### Fase G — Docs & Release
21. CHANGELOG, README seção GUI, screenshots, gif-demo, version bump 1.2.0.

---

## Considerações de Escala

| Escala | Ajustes |
|--------|---------|
| 1 dev / 1 IDE / runs ocasionais | Configuração default funciona. ~50 events/run, 200 events em memória. |
| 1 dev / múltiplas IDEs (Claude + Cursor abertos juntos) | 2 MCP servers stdio independentes, ambos publicando para o mesmo ui-server. Cada tool call gera novo runId — UI agrupa por ID corretamente. Sem mudanças. |
| Watch mode (`kit sync watch --all` rodando 8h) | Ring buffer descarta antigos automaticamente. Browser que abre depois vê só os últimos 200. Aceitável. |
| 100+ runs/min (estresse hipotético) | Rate-limit no /publish (drop se queue > 1000). Não é caso real do projeto. |

### Prioridades de Escala

1. **Primeiro a quebrar:** ring buffer crescendo se mudarmos pra "guardar tudo desde startup". **Fix:** manter cap em 200 (já é o design).
2. **Segundo:** SSE keep-alive pode ser fechada por proxies/firewalls de corporate VPNs. **Fix:** browser EventSource já reconecta automaticamente; ring buffer cobre o gap.

---

## Anti-Padrões

### Anti-Padrão 1: Embutir o HTTP server dentro do MCP server stdio

**O que as pessoas fazem:** "stdio MCP server já tá rodando, deixa o http.Server lá dentro também".
**Por que está errado:** MCP server muda de processo a cada `claude code` aberta/fechada (vida atrelada ao IDE). Browser perderia conexão constantemente. Pior: 2 IDEs abertos = 2 MCP servers tentando bind na mesma port = erro.
**Faça em vez disso:** processo separado, single-instance via lockfile. MCP server e CLI são publishers, não hosts.

### Anti-Padrão 2: EventEmitter global compartilhado entre processos

**O que as pessoas fazem:** "vou expor um module-level EventEmitter em src/ui/bus.js, todo mundo importa e emite".
**Por que está errado:** EventEmitter só funciona **dentro** de um processo. Publishers (CLI, MCP server) são processos diferentes do ui-server — `import bus` em cada um cria buses isolados que nunca se comunicam.
**Faça em vez disso:** EventEmitter dentro do ui-server (1 processo, 1 bus); publishers usam HTTP POST.

### Anti-Padrão 3: Mutar `syncTo` / `applyReverse` para conhecer o ui-server

**O que as pessoas fazem:** "vou aceitar opcionalmente um `uiServerPort` em `syncTo({ uiServerPort })` ou checar `process.env.KIT_MCP_UI_PORT` lá dentro".
**Por que está errado:** quebra a fronteira entre core (puro) e UI (I/O). Stable API v1.0+ promete que `syncTo` é função pura sobre `{ projectRoot, kitRoot, mode, dryRun, onProgress }` — adicionar UI é breaking conceitual. Testes do core passariam a precisar mockar HTTP.
**Faça em vez disso:** wrapper no callsite (CLI/MCP). Core nunca importa nada de `src/ui/`.

### Anti-Padrão 4: Bind em `0.0.0.0` "para facilitar acesso remoto"

**O que as pessoas fazem:** `server.listen(port)` sem especificar host.
**Por que está errado:** expõe localhost a qualquer cliente da rede local. Em rede corporate ou wifi público, é vetor de leak de operações de filesystem do dev.
**Faça em vez disso:** **sempre** `server.listen(port, '127.0.0.1')`. Documentar que é loopback-only.

### Anti-Padrão 5: Single-file HTML "porque é simples" mas com `<script src="app.js">`

**O que as pessoas fazem:** index.html que carrega app.js separado.
**Por que está errado:** mais um endpoint a gerenciar (`/app.js`), mais MIME type a configurar, mais arquivo a incluir no `npm pack`. Para uma UI de ~300 LOC isso é overhead puro.
**Faça em vez disso:** **single index.html** com `<style>` e `<script>` inline. Servir bytes literais. Zero rota adicional.

---

## Pontos de Integração

### Serviços Externos (browsers)

| Serviço | Padrão | Notas |
|---------|--------|-------|
| Browser default OS | `child_process.spawn` de `open`/`xdg-open`/`start` detached | Em headless CI, nunca chamado (nenhum `kit ui start` em CI smoke). |
| EventSource API | Browser nativo, sem polyfill | Suportado em todos os browsers ≥2017. SSE com `retry: 3000`. |

### Limites Internos

| Limite | Comunicação | Considerações |
|--------|-------------|---------------|
| `src/core/*` ↔ `src/ui/*` | **Nenhuma direta.** Sempre via callsite (CLI/MCP) que injeta wrapped onProgress | Preserva pureza do core. Imports unidirecionais: ui pode `import` de core, core nunca `import` de ui. |
| `src/cli/index.js` ↔ `src/ui/client.js` | Direct ESM import + função call | CLI é o orquestrador — sabe se ui-server existe, decide wrappar ou não. |
| `src/mcp-server/index.js` ↔ `src/ui/server.js` | **Spawn de processo** (`child_process.spawn(node, ['bin/ui.js'], { detached: true })` + healthz poll) | Único caminho que cruza fronteira de processo via fork. Justificável só para `autoSpawn=true`. |
| Publishers ↔ ui-server | HTTP POST loopback | Bind `127.0.0.1` obrigatório. Timeout 1s no client. |
| Browser ↔ ui-server | HTTP GET + SSE | `retry: 3000` no SSE, ring buffer cobre desconexões breves. |
| Lockfile ↔ todos | `os.tmpdir()/kit-mcp-ui.lock` | Format JSON. Validação por healthz, não confiar só na existência. |

### Fronteiras de Stable API (preservadas)

| API | Antes (v1.1) | Depois (v1.2) | Status |
|-----|--------------|---------------|--------|
| `syncTo(targetId, opts)` | `opts: { projectRoot, kitRoot, mode, dryRun, onProgress }` | **idêntica** | ✓ Preservada |
| `applyReverse(targetId, opts)` | `opts: { projectRoot, strategy, only, dryRun, onProgress }` | **idêntica** | ✓ Preservada |
| `onProgress({ phase, current, total, label })` | callback signature | **idêntica** | ✓ Preservada |
| MCP tool `sync` inputSchema | `{ action, target, projectRoot, mode, dryRun }` | + `autoSpawn?: boolean` | ✓ Aditiva (campo opcional) |
| MCP tool `reverse-sync` inputSchema | `{ action, target, projectRoot, strategy, only, dryRun }` | + `autoSpawn?: boolean` | ✓ Aditiva |
| CLI surface | `kit kit/sync/reverse-sync/gates/forensics/install` | + `kit ui` (start/stop/status/open) | ✓ Aditiva |

---

## Resumo de novos vs modificados (para plan-checker)

**Arquivos NOVOS:**
- `src/ui/events.js`
- `src/ui/port.js`
- `src/ui/lockfile.js`
- `src/ui/server.js`
- `src/ui/client.js`
- `src/ui/wrapper.js`
- `src/ui/browser.js`
- `src/ui/static/index.html`
- `bin/ui.js`
- `test/integration/ui-*.test.mjs` (vários)

**Arquivos MODIFICADOS (apenas adições, sem mudança de assinaturas existentes):**
- `src/cli/index.js` — adiciona subcomando `ui` (~80 LOC), wrap onProgress em comandos existentes (~10 LOC)
- `src/cli/render.js` — adiciona renderer `renderUiStatus` (~30 LOC)
- `src/mcp-server/index.js` — adiciona `autoSpawn` flag em 2 tool schemas + handlers (~40 LOC)
- `package.json` — version bump 1.1.0 → 1.2.0; **sem novas dependências** (objetivo: zero)
- `README.md` — seção "Live UI"
- `CHANGELOG.md` — entry 1.2.0

**Arquivos INTOCADOS (Stable API):**
- `src/core/sync.js`
- `src/core/reverse-sync.js`
- `src/core/kit.js`, `gates.js`, `forensics.js`, `install.js`, `registry.js`, `watch.js`, `gate-runner.js`, `failures.js`, `reflect.js`, `replays.js`
- `src/core/ui.js` (CLI primitives — não confundir com `src/ui/`!)
- `bin/cli.js`, `bin/mcp.js`

---

## Fontes

- Codebase atual lida em 2026-05-04: `src/core/sync.js`, `src/core/reverse-sync.js`, `src/core/ui.js`, `src/cli/index.js`, `src/mcp-server/index.js`, `bin/mcp.js`, `package.json`, `.planning/PROJECT.md`.
- MCP spec: tools com `inputSchema` aditivo (campos opcionais não quebram clients).
- SSE spec (WHATWG HTML — EventSource): `retry:` directive, automatic reconnection, `Last-Event-ID`.
- Node.js docs: `http.Server`, `child_process.spawn` `detached/unref`, `fs.writeFile` flag `wx`, `EventEmitter`.
- Lockfile pattern: convenção comum em CLIs Node (lockfile-lock, proper-lockfile) — aqui implementado inline para zero deps.

---

*Pesquisa de arquitetura para: kit-mcp v1.2 GUI sidecar*
*Pesquisado: 2026-05-04*
*Quality gate: ✓ http.Server explicado · ✓ build order topológico · ✓ pontos de integração (onProgress, MCP, CLI) · ✓ single-instance + lifecycle · ✓ ASCII diagrama*
