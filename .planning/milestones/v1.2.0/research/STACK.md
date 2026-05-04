# Pesquisa de Stack — kit-mcp v1.2 (GUI sidecar)

**Domínio:** CLI/MCP server adicionando sidecar HTTP localhost + SSE para visualização ao vivo de progresso.
**Pesquisado:** 2026-05-04
**Confiança:** HIGH (versões verificadas via `npm view` em 2026-05-04; transitivos de `open@11` instalados localmente para medir peso real).

## TL;DR — Recomendação Operacional

**Adicione 1 (uma) dep nova: `open@11.0.0`.** Tudo o resto é implementação pura Node em <50 LOC cada. Peso total da adição: 12 transitivos / ~313 KB instalados (aceitável; é a única peça que toca código nativo de SO de forma realmente não-trivial).

| Item | Veredito | Custo |
|------|----------|-------|
| Browser open | **`open@11.0.0`** (adicionar) | +12 deps, ~313 KB |
| Port detection | **Implementar** (~15 LOC, `net.createServer`) | 0 deps |
| Lockfile / single-instance | **Implementar** (~30 LOC, `fs.openSync` com flag `wx`) | 0 deps |
| MIME types | **Mapa estático manual** (~10 entradas) | 0 deps |
| Frontend framework | **Vanilla DOM + EventSource nativo** | 0 deps, 0 KB CDN |

Resultado: 1 dep nova, alinhada ao princípio "máx 1 se inevitável".

## Stack Recomendado

### Tecnologias Core (já decididas — re-confirmadas)

| Tecnologia | Versão | Propósito | Por Que Recomendada |
|------------|--------|-----------|---------------------|
| Node `http` | nativo (Node ≥20) | Servidor HTTP localhost | Já no runtime; SSE é apenas `Content-Type: text/event-stream` + `res.write()` em chunks com keep-alive. Express/Fastify seriam overkill para 2-3 rotas. |
| SSE (Server-Sent Events) | nativo (browser EventSource + Node `res.write`) | Stream uni-direcional servidor→cliente | Match exato com o caso de uso (progress events); reconexão automática built-in no `EventSource`; sem handshake WebSocket; atravessa proxies como HTTP normal. |
| HTML/JS estático | sem build | UI mínima de event log | Sem Vite/Webpack/React = sem cadeia de build; o sidecar é descartável e não precisa de bundle. |

### Bibliotecas de Suporte (a NOVA dep)

| Biblioteca | Versão | Propósito | Quando Usar |
|------------|--------|-----------|-------------|
| **`open`** | **^11.0.0** | Abrir URL `http://localhost:<porta>` no browser default cross-platform | Sempre que `kit ui --open` ou `--auto-spawn` decidir abrir o browser. |

**Justificativa de adicionar `open`:**
- Cross-platform realmente funciona (Windows `start`, macOS `open`, Linux `xdg-open` + variantes WSL/SSH/container detection).
- A v11.0.0 (publicada 2025-11-15, MIT, ESM-only, `engines.node >=20`) inclui detecção de WSL, SSH e ambientes em container — casos onde `child_process.spawn('start', ...)` falha silenciosamente.
- Implementação pura Node "5 LOC" parece simples mas tem armadilhas: aspas em URL no Windows (`cmd /c start "" "url"`), encoding do PowerShell, fallback `xdg-open` vs `wslview` em WSL2. Reimplementar = 60-80 LOC + bugs platform-específicos descobertos por usuários.
- Peso: 12 deps transitivas, ~313 KB instalados. Aceitável para um opt-in que só roda quando o usuário pede `kit ui`.
- **Alternativa (zero-dep)**: documentar URL no terminal, exigir `kit ui --no-open` ser o default, e o usuário cola no browser. Aceitável como fallback se a dep for vetoada, mas degrada UX do "experimente".

### O Que Implementar Em Vez De Adicionar

#### 1. Port detection — implementar, ~15 LOC

```js
// src/sidecar/port.js
import net from 'node:net';
export function findFreePort(preferred = 7531) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(preferred, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
// Loop com try/catch sobe pra 7532, 7533... até encontrar livre.
```

**Por que NÃO `get-port@7.2.0`:** o pacote faz exatamente o acima (publicado 2026-03-22, ESM, `node >=16`, ~14 KB, zero deps). É honesto e bom — mas é literalmente 15 linhas. Adicionar dep para 15 LOC viola o princípio de mínimas deps. Se a equipe quisesse evitar reinventar a roda, `get-port@7.2.0` seria a escolha; mas re-implementar aqui é a chamada certa para este projeto.

#### 2. Lockfile / single-instance — implementar, ~30 LOC

```js
// src/sidecar/lock.js
// Estratégia: arquivo em os.tmpdir() com pid+port; abre com 'wx' (exclusive),
// se falhar lê o arquivo e checa se pid ainda está vivo (process.kill(pid, 0)).
// Stale lock => unlink e tenta de novo.
```

**Por que NÃO `proper-lockfile@4.1.2`:** o pacote NÃO É MANTIDO há quase 4 anos (último publish 2022-06-24). `engines` não declarado, deps `graceful-fs`, `retry`, `signal-exit` (3 transitivos para resolver um problema fs trivial). Risco real de incompatibilidade futura com Node 24+. A semântica exclusive-lock que precisamos é coberta por `fs.openSync(path, 'wx')` nativo — atomicidade é garantia do SO em todas as 3 plataformas.

**Por que NÃO `lockfile`:** mesmo problema (sem manutenção ativa) e API mais legada (callbacks).

#### 3. MIME types — mapa estático, ~10 LOC

```js
// src/sidecar/mime.js
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};
export const mimeFor = (ext) => MIME[ext] ?? 'application/octet-stream';
```

**Por que NÃO `mime-types@3.0.2`:** o pacote pesa ~22 KB + transitivo `mime-db` (~150 KB com 1500+ tipos). O sidecar serve 4-5 extensões fixas que controlamos. Mapa manual é mais rápido, zero deps, e elimina superfície de ataque (mime-db já teve CVEs históricos por supply-chain). Se um dia precisarmos de PDF/audio/vídeo no sidecar (não é o caso), reavaliar.

#### 4. Frontend framework — vanilla DOM + `EventSource`

```html
<!-- ui/index.html  (servido como static asset) -->
<ul id="log"></ul>
<script>
  const es = new EventSource('/events');
  es.onmessage = (e) => {
    const li = document.createElement('li');
    li.textContent = JSON.parse(e.data).msg;
    document.getElementById('log').prepend(li);
  };
</script>
```

**Por que NÃO Alpine.js / htmx:**
- Alpine 3.15.12 (~564 KB unpacked, ~14 KB gzipped via CDN): ótimo para reatividade declarativa, mas o nosso UI é "append child em event arriving". Não precisa de reactividade declarativa.
- htmx 2.0.10 (~884 KB unpacked, ~14 KB gzipped via CDN): tem extensão SSE oficial, e seria a escolha se quiséssemos UI declarativa server-driven. Mas requer extensão separada (`htmx-ext-sse`) e mind-model adicional para o mantenedor solo. Vanilla `EventSource` é 5 linhas e zero conceitos novos.
- Princípio: sidecar é descartável. UI minimalista (event log + status badge + botão "limpar") não justifica framework. Se a UI crescer (filtros, gráficos, multi-painel) em v1.3+, **Alpine.js via CDN** seria a escolha (mais leve mentalmente que React, sem build).

### Ferramentas de Desenvolvimento

| Ferramenta | Propósito | Notas |
|------------|-----------|-------|
| Node `--watch` | Iter rápido durante dev do servidor SSE | `node --watch bin/cli.js ui` para hot-reload do servidor; arquivos estáticos não precisam (browser refresh). |
| `curl -N` | Testar `/events` SSE no terminal | `curl -N http://localhost:7531/events` mostra o stream sem precisar de browser; útil para smoke tests de CI. |

## Instalação

```bash
# Única adição:
npm install open@^11.0.0
```

Sem dependências de desenvolvimento novas. Sem peer deps. Sem build step.

## Alternativas Consideradas

| Recomendado | Alternativa | Quando Usar a Alternativa |
|-------------|-------------|---------------------------|
| `open@11` | child_process puro com platform-detect | Se 12 transitivos forem vetados por política de supply-chain. ~70 LOC + manutenção de edge cases (WSL, SSH, headless CI). |
| Vanilla DOM + EventSource | Alpine.js via CDN (3.15.12) | Quando UI crescer pra ter filtros/agrupamento/persistência local — Alpine fornece reatividade sem build step. |
| Implementar findFreePort | `get-port@7.2.0` | Se a equipe quiser evitar a manutenção de mais 15 LOC e aceitar mais um dep tree. |
| Implementar lockfile manual | `proper-lockfile@4.1.2` | **Não recomendado em nenhum cenário** — abandonado desde 2022. Se evitar `fs.openSync('wx')` for desejado, escrever wrapper próprio é melhor que ressuscitar dep stale. |
| Mapa MIME manual | `mime-types@3.0.2` | Apenas se sidecar passar a servir uploads/downloads arbitrários do usuário (fora de escopo v1.2). |
| HTTP `node:http` | Express 4/5 | **Nunca para este projeto** — Express adiciona ~50 deps transitivos para 2 rotas. |

## O Que NÃO Usar

| Evitar | Por Que | Usar Em Vez Disso |
|--------|---------|-------------------|
| `proper-lockfile` | Sem release há 4 anos (2022-06); deps legacy (`graceful-fs`, `retry`, `signal-exit` antigo); risco de incompatibilidade Node 24+. | `fs.openSync(path, 'wx')` nativo — atomicidade exclusive-create garantida pelo SO. |
| `lockfile` (npm) | Mesmo problema de manutenção, API callback-only legada. | Mesmo: `fs.openSync('wx')`. |
| `mime` (v4) / `mime-db` | 1500+ tipos para servir 5 extensões fixas; supply-chain attack surface. | Mapa estático de 6 entradas. |
| Express / Fastify / Koa | Cadeia de deps absurda para 2-3 rotas + SSE; documentação assume bundler/middleware mindset que kit-mcp evita. | `http.createServer` nativo + roteamento `if (req.url === '/events')`. |
| Socket.IO / `ws` | WebSocket é overkill para fluxo uni-direcional. SSE atravessa proxies como HTTP, reconecta sozinho, e existe nativo no browser. | `EventSource` (browser) + `res.write('data: ...\n\n')` (servidor). |
| Vite / Rollup / esbuild | Sidecar é HTML/JS estático servido por http.Server. Build step quebraria o princípio "sem build step" do projeto. | `<script>` inline ou arquivo `.js` solto, servido via static handler. |
| React / Vue / Svelte | Reatividade declarativa não é necessária para event-log append-only. | DOM API + `EventSource`. |

## Variantes de Stack por Condição

**Se a equipe vetar `open@11` por política de transitive deps:**
- Implementar `openBrowser(url)` puro Node (~70 LOC) com:
  - `process.platform === 'win32'` → `spawn('cmd', ['/c', 'start', '""', url], { detached: true })`
  - `=== 'darwin'` → `spawn('open', [url])`
  - default → tentar `xdg-open`, fallback `sensible-browser`, fallback log do URL.
- Aceitar que WSL/SSH/headless detection vira issue futuro.

**Se a UI crescer significativamente em v1.3+ (filtros, agrupamento, dashboards):**
- Alpine.js via `<script src="https://unpkg.com/alpinejs@3">` (CDN, sem npm, sem build).
- Manter `EventSource` puro para o transporte; Alpine só pra binding declarativo.

**Se o sidecar precisar autenticar conexões (multi-user num servidor compartilhado):**
- Fora de escopo v1.2 (sidecar é localhost-only, single-user dev machine).
- Caso surja: token aleatório no querystring + comparação constant-time. Não introduzir framework de auth.

## Compatibilidade de Versões

| Pacote A | Compatível Com | Notas |
|----------|----------------|-------|
| `open@^11.0.0` | Node ≥20 | Match exato com `engines.node` do projeto. ESM-only — alinha com `"type": "module"`. |
| `EventSource` (browser nativo) | Todos os browsers modernos (Chrome 6+, Firefox 6+, Safari 5+, Edge 79+) | Não precisa polyfill — alvo são devs em IDEs modernas. |
| `node:http` SSE | Node ≥20 | `res.flushHeaders()` necessário para evitar buffering; `keep-alive` ping a cada 15s para evitar timeout de proxies/intermediários. |
| `fs.openSync(path, 'wx')` | Node ≥20, Win/macOS/Linux | Flag POSIX `O_EXCL` em Linux/macOS; emulação equivalente em Windows via `CREATE_NEW`. |

## Integração com http.Server existente — Esboço

```js
// src/sidecar/server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { mimeFor } from './mime.js';

export function startSidecar({ port, staticRoot, eventBus }) {
  const server = http.createServer((req, res) => {
    if (req.url === '/events') return handleSSE(req, res, eventBus);
    return serveStatic(req, res, staticRoot);
  });
  server.listen(port, '127.0.0.1');
  return server; // chamador faz server.close() no shutdown
}

function handleSSE(req, res, bus) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();
  const onEvent = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on('progress', onEvent);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(ping); bus.off('progress', onEvent); });
}
```

`eventBus` é um simples `EventEmitter` que os `onProgress` callbacks existentes em `syncTo()` e `applyReverse()` chamam — zero refator de superfície pública, apenas hook de fan-out.

## Fontes

- `npm view open` → 11.0.0, MIT, `node >=20`, 12 transitive deps, 313 KB unpacked, last publish 2025-11-15.
- `npm view get-port` → 7.2.0, MIT, `node >=16`, 0 deps, 14 KB, last publish 2026-03-22.
- `npm view proper-lockfile` → 4.1.2, MIT, sem `engines`, 3 deps, 30 KB, last publish 2022-06-24 (**stale 4 anos**).
- `npm view mime-types` → 3.0.2, MIT, `node >=18`, dep `mime-db`, 23 KB + ~150 KB transitivo, last publish 2025-11-20.
- `npm view alpinejs` → 3.15.12, MIT, 564 KB unpacked (~14 KB gzipped CDN), last publish 2026-04-30.
- `npm view htmx.org` → 2.0.10, 0BSD, 884 KB unpacked (~14 KB gzipped CDN), last publish 2026-04-21.
- Probe local: `npm install open@11` num scratch dir = 12 packages em `node_modules`, 313 KB total.
- Node docs (Node 20 LTS): `http.createServer`, `res.flushHeaders`, `fs.open` flag `wx`, `net.createServer` random-port pattern — conhecidos estáveis, sem surpresas.
- MDN: `EventSource` interface — suporte universal em browsers modernos, reconexão automática.

---
*Pesquisa de stack para: kit-mcp v1.2 GUI sidecar (web localhost + SSE)*
*Pesquisado: 2026-05-04*
