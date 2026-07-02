---
phase: 82-web-surface-hardening
plan: 02
type: execute
wave: 2
depends_on:
  - 82-01-ui-server-hardening-PLAN.md
files_modified:
  - src/ui/auto-spawn.js
  - src/ui/browser.js
  - src/ui/client.js
  - kit/hooks/sidecar-tool-publisher.js
  - test/integration/ui-auto-spawn.test.js
  - test/integration/ui-hardening.test.js
autonomous: true
requirements:
  - SEC-14-02

must_haves:
  truths:
    - "auto-spawn.ensureSidecar lê lock.token pós-spawn e passa URL ?t=<token> para openBrowser"
    - "browser recebe URL com ?t=<token> e o usuário não interage com token manualmente"
    - "src/ui/client.js publish() lê lock.token do lockfile e anexa Authorization: Bearer no POST /publish"
    - "kit/hooks/sidecar-tool-publisher.js anexa Authorization: Bearer ao publicar eventos"
    - "OPS-04 (2 concurrent publishers) volta a passar (test.skip removido)"
    - "Hooks de outros projetos via scanAnyRunningSidecar continuam funcionando ou degradam silentemente sem auth"
  artifacts:
    - path: "src/ui/auto-spawn.js"
      provides: "Handshake auto-spawn → browser propagando token via ?t= no URL"
      contains: "lock.token"
    - path: "src/ui/client.js"
      provides: "publish() autenticado lendo lock.token do lockfile"
      contains: "authorization"
    - path: "kit/hooks/sidecar-tool-publisher.js"
      provides: "Hook que anexa Bearer token ao POST /publish após ler lockfile"
      contains: "Bearer"
    - path: "test/integration/ui-hardening.test.js"
      provides: "OPS-04 unskipped + 2-3 testes novos para token propagation E2E"
      contains: "Bearer"
  key_links:
    - from: "src/ui/auto-spawn.js (ensureSidecar)"
      to: "src/ui/browser.js (openBrowser)"
      via: "URL `http://127.0.0.1:${lock.port}/?t=${lock.token}` propagada via parametro"
      pattern: "\\?t="
    - from: "src/ui/client.js (publish)"
      to: "src/ui/lockfile.js (readLock)"
      via: "le lock.token a cada publish (cached por TTL) e injeta como Authorization"
      pattern: "Bearer"
    - from: "kit/hooks/sidecar-tool-publisher.js"
      to: "POST /publish via http.request"
      via: "lê lockfile via readSidecarPort + lockToken, anexa Authorization header"
      pattern: "lock.token"
---

<objective>
Completar SEC-14-02 propagando o token automaticamente do sidecar até os consumidores: browser via URL `?t=`, e publishers (in-process `client.js` + hook out-of-process `sidecar-tool-publisher.js`) via header `Authorization: Bearer`.

Purpose: Plan 01 trancou os endpoints com requireAuth — sem este plano os consumidores legítimos batem em 401 (tudo quebra). Este plano completa o handshake transparente: usuário NÃO digita nem vê o token, mas todo consumidor in-org passa por auth.

Output:
- `src/ui/auto-spawn.js` propaga `?t=<token>` para o browser.
- `src/ui/client.js publish()` ler `lock.token` e anexa Authorization.
- `kit/hooks/sidecar-tool-publisher.js` mesma propagação no caminho out-of-process.
- OPS-04 volta a passar; 2-3 tests novos provam E2E.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/82-web-surface-hardening/82-CONTEXT.md
@.planning/phases/82-web-surface-hardening/82-01-ui-server-hardening-PLAN.md

# Source files que serão modificados
@src/ui/auto-spawn.js
@src/ui/browser.js
@src/ui/client.js
@kit/hooks/sidecar-tool-publisher.js
@test/integration/ui-auto-spawn.test.js
@test/integration/ui-hardening.test.js

<interfaces>
**Lockfile schema (PÓS Plan 01)**: contém campo `token` (64 hex chars). Acessível via `readLock(projectRoot).token`.

**Endpoints protegidos PÓS Plan 01:**
- `POST /publish` → exige Authorization Bearer ou ?t=
- `POST /shutdown` → exige Authorization Bearer ou ?t=
- `GET /events` → exige ?t= (EventSource não permite headers)
- `GET /state` → exige Authorization Bearer ou ?t=
- `GET /healthz` → continua **aberto** (boot handshake)

**`ensureSidecar` API atual (`src/ui/auto-spawn.js:64-106`)**:
```js
export async function ensureSidecar({ projectRoot, openBrowserOnSpawn = true } = {}) {
  // ... existing logic
  if (openBrowserOnSpawn) {
    const url = `http://127.0.0.1:${lock.port}/`;   // ← mudar para incluir ?t=token
    const r = await openBrowser(url);
    opened = r.opened === true;
  }
}
```

**`publish` API atual (`src/ui/client.js:44-103`)**: faz `http.request` SEM Authorization header. Caller fornece `projectRoot`. Precisa ler `lock.token` ao mesmo tempo que `lock.port`.

**Hook publisher atual (`kit/hooks/sidecar-tool-publisher.js:84-117`)**: 
- `readSidecarPort(projectRoot)` lê só `lock.port` — precisa ler `lock.token` também.
- `scanAnyRunningSidecar()` faz fallback cross-project — situação delicada: o lockfile encontrado é de OUTRO project; seu token NÃO é conhecido pelo nosso project. **Decisão:** ler também o token do lock encontrado (eles estão no mesmo arquivo) e usar; se a config falhar, falha silenciosa (já é o pattern do hook).

**Token-aware fluxo end-to-end:**
1. `kit ui start` → `bin/ui.js` → `createServer.start()` → `acquireLock` gera `token` → grava no lockfile.
2. MCP tool handler chama `ensureSidecar({autoSpawn: true})` → spawn `bin/ui.js` (1) → `waitForHealth` → lê lockfile → `lock.token` capturado → `openBrowser(`http://...:${port}/?t=${token}`)`.
3. Browser carrega `index.html` com `?t=<token>` na URL → JS no boot extrai `?t=` → guarda em variável → toda fetch (`/state`, `/events`) inclui token.
4. Hook `PostToolUse` em IDE → spawna `sidecar-tool-publisher.js` → lê lockfile → extrai `port + token` → POST /publish com Authorization Bearer.
5. In-process `src/ui/client.js publish()` é usado por `kit sync`/`gates`/`reverse-sync` etc — lê lockfile da mesma forma, anexa header.

**`browser.js openBrowser(url)`** simplesmente passa URL adiante para o lib `open` — NÃO PRECISA MUDAR (URL com `?t=` é tratado como opaco). Confirmado lendo arquivo: `await open(url)` é a única chamada.

**Por que index.html já está pronto** (Plan 01 não mudou client-side fetch):
- Plan 01 NÃO instrumentou index.html para adicionar Authorization em fetch existentes.
- Mas `hydrateFromState()` faz `await fetch("/state", { credentials: "omit" })` → vai retornar 401 com token-protection.
- **Esta task DEVE incluir** mini-edit em index.html para extrair `?t=` da URL e injetar em fetch + EventSource.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Propagar token no fluxo auto-spawn → browser e instrumentar fetches do client-side</name>
  <files>src/ui/auto-spawn.js,src/ui/static/index.html</files>
  <action>
**Parte A — `src/ui/auto-spawn.js`:**

Editar a função `ensureSidecar` (linha 64-106). Localizar o bloco de openBrowser:

```js
let opened = false;
if (openBrowserOnSpawn) {
  const url = `http://127.0.0.1:${lock.port}/`;
  const r = await openBrowser(url);
  opened = r.opened === true;
}
```

Substituir POR:

```js
let opened = false;
if (openBrowserOnSpawn) {
  // SEC-14-02: propagate auth token via query param so browser can self-authenticate
  // without user interaction. EventSource cannot send custom headers; ?t= is the
  // canonical pattern (also used by Grafana SSE, Sentry replay, etc).
  const tokenSuffix = lock.token ? `?t=${encodeURIComponent(lock.token)}` : '';
  const url = `http://127.0.0.1:${lock.port}/${tokenSuffix}`;
  const r = await openBrowser(url);
  opened = r.opened === true;
}
```

POR QUÊ `encodeURIComponent` mesmo que o token seja só `[0-9a-f]`:
- Defesa em profundidade: se no futuro mudarmos de hex para base64-url, encode já está pronto. Custo ~negligível (token é ASCII safe).
- Caracteres `[0-9a-f]` ficam intactos no encode (RFC 3986 unreserved).

POR QUÊ NÃO incluir `#` fragment em vez de `?` query:
- `?t=` é registrado em logs do browser (history) e enviado ao server na primeira request — server precisa do token IMEDIATAMENTE para servir GET / com auth (atualmente não exigimos auth em GET /; mas se um dia quisermos, query param já está lá).
- `#fragment` NÃO é enviado ao server, então o server não pode validar request inicial.
- Trade-off de log local: token vai pro history do browser. Aceitável para localhost-only sidecar com TTL = process lifetime.

**Parte B — `src/ui/static/index.html`:**

Editar o `<script>` block para extrair `?t=` da URL e usar em fetch/EventSource. Adicionar logo no início do script (após o comentário do header SEC-14-01 que Plan 01 inseriu):

Localizar (linha ~1183 após edits do Plan 01):
```js
/* ──────────────────────────────────────────────────────────
   kit-mcp sidecar — production client
   SEC-14-01 (Phase 82): All event-derived content rendered via escapeHtml()
   ...
   ────────────────────────────────────────────────────────── */
```

Adicionar IMEDIATAMENTE APÓS:

```js
/* ──────────────────────────────────────────────────────────
   SEC-14-02 (Phase 82 / Plan 02): auth token from URL query param.
   Server (Plan 01) requires Bearer token on /publish, /shutdown, /state
   and ?t= on /events. This block extracts ?t= once at boot, scrubs it
   from the address bar (so it doesn't leak via screen-share / browser
   history copy-paste), and exposes helpers for fetch + EventSource.
   ────────────────────────────────────────────────────────── */
const __sidecarToken = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (t && /^[0-9a-f]{64}$/.test(t)) {
      // Scrub from URL so re-share / screenshot doesn't leak it.
      params.delete("t");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
      window.history.replaceState(null, "", newUrl);
      return t;
    }
  } catch (_) { /* fall through */ }
  return null;
})();

function authedFetch(input, init = {}) {
  const opts = { ...init, headers: { ...(init.headers || {}) } };
  if (__sidecarToken) {
    opts.headers["Authorization"] = "Bearer " + __sidecarToken;
  }
  return fetch(input, opts);
}

function authedEventSourceUrl(path) {
  if (!__sidecarToken) return path;
  const sep = path.includes("?") ? "&" : "?";
  return path + sep + "t=" + encodeURIComponent(__sidecarToken);
}
```

Em seguida, **substituir** todas as chamadas `fetch(...)` que tocam endpoints protegidos por `authedFetch(...)`:

Localizar (linha ~1920):
```js
const res = await fetch("/state", { credentials: "omit" });
```

Substituir por:
```js
const res = await authedFetch("/state", { credentials: "omit" });
```

E (linha ~1941):
```js
evtSource = new EventSource("/events");
```

Substituir por:
```js
evtSource = new EventSource(authedEventSourceUrl("/events"));
```

**Buscar outras chamadas a /state, /publish, /shutdown** no index.html via grep:
```bash
grep -nE "fetch\(.*\"\\/(state|publish|shutdown|events)" src/ui/static/index.html
```

Atualizar todas para usar `authedFetch`.

**Buscar chamadas a `/healthz`** — manter `fetch` direto (endpoint aberto):
```bash
grep -n "/healthz" src/ui/static/index.html
```

Decisão por endpoint:
- `/healthz` → `fetch` (sem auth — endpoint aberto, usado por health-poll que precisa funcionar antes de o token estar disponível em casos edge).
- `/state`, `/events`, `/publish`, `/shutdown` → `authedFetch` ou `authedEventSourceUrl`.

POR QUÊ scrub `?t=` da URL bar via `history.replaceState`:
- Token em URL bar é exposto em screen-share, screenshot, copy/paste de URL ("Reabra com ...").
- `history.replaceState(null, "", newUrl)` reescreve a entry sem reload e sem disparar nav events.
- Pós-scrub, qualquer reload manual perde o token e dispara o handshake de novo (auto-spawn re-injeta) — fluxo correto.

POR QUÊ NÃO usar `sessionStorage`:
- sessionStorage persiste entre reloads NA MESMA TAB. Token é per-process do sidecar; se sidecar reiniciar, sessionStorage ainda tem token velho. JS ler token velho → 401 → reload → URL não tem `?t=` mais → 401 forever. Quebra UX.
- Variável JS em closure (`__sidecarToken`) é per-page-load; reload força re-handshake.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node -c src/ui/auto-spawn.js && node -e "const html = require('node:fs').readFileSync('src/ui/static/index.html', 'utf8'); if (!html.includes('__sidecarToken')) { console.error('FAIL: __sidecarToken not added to index.html'); process.exit(1); } if (!html.includes('authedFetch')) { console.error('FAIL: authedFetch not added'); process.exit(1); } if (!html.includes('authedEventSourceUrl')) { console.error('FAIL: authedEventSourceUrl not added'); process.exit(1); } /* Verify /state and /events use authed wrappers */ if (/fetch\(\\\"\\/state/.test(html)) { console.error('FAIL: raw fetch(\"/state\") still in code; should use authedFetch'); process.exit(1); } if (/new EventSource\(\\\"\\/events\\\"\\)/.test(html)) { console.error('FAIL: raw new EventSource(\"/events\") still in code'); process.exit(1); } console.log('OK token wiring in client');"</automated>
  </verify>
  <done>
- `src/ui/auto-spawn.js`: bloco openBrowser monta URL com `?t=${lock.token}` (ou só `/` se token absent — degrada gracefully).
- `src/ui/static/index.html`: bloco `__sidecarToken` extrai e scrub URL; helpers `authedFetch` e `authedEventSourceUrl` definidos; `/state` e `/events` usam wrappers.
- `node -c src/ui/auto-spawn.js` parseia.
- Sanity grep confirma sem chamadas raw a endpoints protegidos.
  </done>
</task>

<task type="auto">
  <name>Task 2: Atualizar src/ui/client.js publish() para anexar Authorization Bearer</name>
  <files>src/ui/client.js</files>
  <action>
Editar `src/ui/client.js` para ler o token do lockfile e anexar Authorization. Mudanças cirúrgicas no `resolvePort` e `publish`.

**1. Renomear `resolvePort` → `resolveSidecar`** (port + token), atualizar cache shape.

Localizar:
```js
const portCache = new Map(); // projectRoot -> port (or 0 = no sidecar)
const PORT_CACHE_TTL_MS = 5_000;
const cacheTimestamps = new Map();

function readCachedPort(projectRoot) {
  const ts = cacheTimestamps.get(projectRoot);
  if (!ts || Date.now() - ts > PORT_CACHE_TTL_MS) return undefined;
  return portCache.get(projectRoot);
}

function writeCachedPort(projectRoot, port) {
  portCache.set(projectRoot, port);
  cacheTimestamps.set(projectRoot, Date.now());
}

export function clearPortCache() {
  portCache.clear();
  cacheTimestamps.clear();
}

function resolvePort(projectRoot) {
  const cached = readCachedPort(projectRoot);
  if (cached !== undefined) return cached;
  const lock = readLock(projectRoot);
  const port = lock?.port ?? 0;
  writeCachedPort(projectRoot, port);
  return port;
}
```

Substituir POR (mantém `clearPortCache` como alias backward-compat):

```js
const sidecarCache = new Map(); // projectRoot -> { port, token } | { port: 0, token: null }
const SIDECAR_CACHE_TTL_MS = 5_000;
const cacheTimestamps = new Map();

function readCachedSidecar(projectRoot) {
  const ts = cacheTimestamps.get(projectRoot);
  if (!ts || Date.now() - ts > SIDECAR_CACHE_TTL_MS) return undefined;
  return sidecarCache.get(projectRoot);
}

function writeCachedSidecar(projectRoot, sidecar) {
  sidecarCache.set(projectRoot, sidecar);
  cacheTimestamps.set(projectRoot, Date.now());
}

// Backward-compat name; clears port + token cache.
export function clearPortCache() {
  sidecarCache.clear();
  cacheTimestamps.clear();
}

function resolveSidecar(projectRoot) {
  const cached = readCachedSidecar(projectRoot);
  if (cached !== undefined) return cached;
  const lock = readLock(projectRoot);
  const sidecar = {
    port: lock?.port ?? 0,
    token: lock?.token ?? null, // SEC-14-02: null if missing (e.g. lockfile from older sidecar version)
  };
  writeCachedSidecar(projectRoot, sidecar);
  return sidecar;
}
```

**2. Atualizar `publish()` (linha 44-103)** para usar `resolveSidecar` e anexar Authorization:

Localizar:
```js
export async function publish(event, { projectRoot, timeoutMs = 1500 } = {}) {
  if (!projectRoot) return { sent: false, reason: 'no_project_root' };

  const validationErr = validateEvent(event);
  if (validationErr) return { sent: false, reason: `invalid_event: ${validationErr.message}` };

  const port = resolvePort(projectRoot);
  if (!port) return { sent: false, reason: 'no_sidecar' };

  const body = JSON.stringify(event);

  return new Promise((resolve) => {
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/publish',
      agent: false,
      headers: {
        'host': `127.0.0.1:${port}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body, 'utf8'),
        'origin': `http://127.0.0.1:${port}`,
        'connection': 'close',
      },
    }, (res) => {
      ...
```

Substituir o bloco do request por:

```js
export async function publish(event, { projectRoot, timeoutMs = 1500 } = {}) {
  if (!projectRoot) return { sent: false, reason: 'no_project_root' };

  const validationErr = validateEvent(event);
  if (validationErr) return { sent: false, reason: `invalid_event: ${validationErr.message}` };

  const { port, token } = resolveSidecar(projectRoot);
  if (!port) return { sent: false, reason: 'no_sidecar' };

  const body = JSON.stringify(event);

  return new Promise((resolve) => {
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/publish',
      agent: false,
      headers: {
        'host': `127.0.0.1:${port}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body, 'utf8'),
        'origin': `http://127.0.0.1:${port}`,
        'connection': 'close',
        // SEC-14-02: attach Bearer token if lockfile has one. If not (older sidecar),
        // server returns 401; soft-fail flow surfaces as { sent: false, reason: 'http_401' }.
        ...(token ? { 'authorization': `Bearer ${token}` } : {}),
      },
    }, (res) => {
      // ... rest unchanged (drain + status check)
```

(Resto da função permanece igual — `res.resume()`, error handler, timeout — não tocar.)

**3. Atualizar tratamento de 401 no response handler:**

No bloco que trata `res.statusCode`:
```js
if (res.statusCode === 403 || res.statusCode === 404) {
  portCache.delete(projectRoot);
  cacheTimestamps.delete(projectRoot);
}
```

Substituir por:
```js
if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 404) {
  // SEC-14-02: invalidate cache on 401 too — token may have rotated (sidecar restart).
  sidecarCache.delete(projectRoot);
  cacheTimestamps.delete(projectRoot);
}
```

**4. Garantir que `publishMany`** continue funcionando — não toca o objeto, só serializa chamadas. **Sem mudanças.**

POR QUÊ degrade gracefully se token absent:
- Lockfiles de sidecars de versões anteriores (v1.13 e antes) NÃO têm `token`. Se um hook v1.14 publicar contra um sidecar v1.13 ainda rodando, queremos retornar 401 (esperado) em vez de crash.
- `lock.token ?? null` + `...(token ? {...} : {})` = sem header Authorization se token missing → server retorna 401 → `publish` retorna `{ sent: false, reason: 'http_401' }`. Soft fail preservado.

POR QUÊ invalidar cache em 401:
- Sidecar restart gera novo token. Cache antigo retorna 401 indefinidamente até TTL (5s). Invalidar em 401 acelera recovery.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node -c src/ui/client.js && node --test test/integration/ui-client.test.js 2>&1 | tail -10</automated>
  </verify>
  <done>
- `node -c src/ui/client.js` parseia.
- `publish()` usa `resolveSidecar` (renamed) e anexa `Authorization: Bearer <token>` quando token presente.
- Cache invalida em 401 + 403 + 404.
- `clearPortCache` continua exportada (backward-compat) — testes existentes que importam não quebram.
- `node --test test/integration/ui-client.test.js` passa.
  </done>
</task>

<task type="auto">
  <name>Task 3: Atualizar kit/hooks/sidecar-tool-publisher.js para anexar Authorization Bearer</name>
  <files>kit/hooks/sidecar-tool-publisher.js</files>
  <action>
Editar `kit/hooks/sidecar-tool-publisher.js`. Hook é shipped para usuários, então mudanças tem que ser conservadoras + retrocompatíveis com sidecar v1.13 (sem token).

**1. Atualizar `readSidecarPort` para retornar `{ port, token }` em vez de só `port`:**

Localizar:
```js
function readSidecarPort(projectRoot) {
  // Mirror src/ui/lockfile.js#lockPathFor (sha1(projectRoot).slice(0,16))
  try {
    const hash = crypto.createHash('sha1').update(projectRoot).digest('hex').slice(0, 16);
    const lockPath = path.join(os.tmpdir(), `kit-mcp-ui-${hash}.lock`);
    const raw = fs.readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(raw);
    return typeof lock.port === 'number' ? lock.port : null;
  } catch {
    return null;
  }
}
```

Substituir POR:
```js
function readSidecarLock(projectRoot) {
  // Mirror src/ui/lockfile.js#lockPathFor (sha1(projectRoot).slice(0,16))
  try {
    const hash = crypto.createHash('sha1').update(projectRoot).digest('hex').slice(0, 16);
    const lockPath = path.join(os.tmpdir(), `kit-mcp-ui-${hash}.lock`);
    const raw = fs.readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(raw);
    if (typeof lock.port !== 'number') return null;
    return {
      port: lock.port,
      // SEC-14-02 (kit-mcp v1.14+). null for sidecars from v1.13 and earlier.
      token: typeof lock.token === 'string' && /^[0-9a-f]{64}$/.test(lock.token) ? lock.token : null,
    };
  } catch {
    return null;
  }
}
```

**2. Atualizar `scanAnyRunningSidecar` para retornar `{ port, token }`:**

Localizar:
```js
function scanAnyRunningSidecar() {
  try {
    const dir = os.tmpdir();
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (!/^kit-mcp-ui-[0-9a-f]{16}\.lock$/.test(name)) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, name), 'utf8');
        const lock = JSON.parse(raw);
        if (typeof lock.port === 'number' && typeof lock.pid === 'number') {
          // Best-effort liveness check.
          try { process.kill(lock.pid, 0); return lock.port; } catch { /* dead */ }
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* tmpdir unreadable */ }
  return null;
}
```

Substituir por:
```js
function scanAnyRunningSidecar() {
  try {
    const dir = os.tmpdir();
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (!/^kit-mcp-ui-[0-9a-f]{16}\.lock$/.test(name)) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, name), 'utf8');
        const lock = JSON.parse(raw);
        if (typeof lock.port === 'number' && typeof lock.pid === 'number') {
          try {
            process.kill(lock.pid, 0);
            // SEC-14-02: return token from same lockfile so cross-project
            // publishing can authenticate. If token missing (older sidecar),
            // returns null → publish degrades to 401 silent-fail.
            return {
              port: lock.port,
              token: typeof lock.token === 'string' && /^[0-9a-f]{64}$/.test(lock.token) ? lock.token : null,
            };
          } catch { /* dead */ }
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* tmpdir unreadable */ }
  return null;
}
```

**3. Atualizar caller (~linha 55-60)** para receber objeto em vez de número:

Localizar:
```js
let port = readSidecarPort(projectRoot);
if (!port) port = scanAnyRunningSidecar();
if (!port) {
  debugLog({ phase: 'no_sidecar', projectRoot });
  process.exit(0);
}
```

Substituir por:
```js
let sidecar = readSidecarLock(projectRoot);
if (!sidecar) sidecar = scanAnyRunningSidecar();
if (!sidecar) {
  debugLog({ phase: 'no_sidecar', projectRoot });
  process.exit(0);
}
const { port, token } = sidecar;
```

**4. Atualizar chamada `publish(port, event)` (linha 77)** — passar token:

Localizar:
```js
publish(port, event).then(() => process.exit(0));
```

Substituir por:
```js
publish(port, token, event).then(() => process.exit(0));
```

**5. Atualizar função `publish` (linha 161-188)** — aceitar token, anexar Authorization:

Localizar:
```js
function publish(port, event) {
  return new Promise((resolve) => {
    const body = JSON.stringify(event);
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/publish',
      agent: false,
      headers: {
        host: `127.0.0.1:${port}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body, 'utf8'),
        origin: `http://127.0.0.1:${port}`,
        connection: 'close',
      },
    }, (res) => {
      ...
```

Substituir por:
```js
function publish(port, token, event) {
  return new Promise((resolve) => {
    const body = JSON.stringify(event);
    const req = http.request({
      method: 'POST',
      host: '127.0.0.1',
      port,
      path: '/publish',
      agent: false,
      headers: {
        host: `127.0.0.1:${port}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body, 'utf8'),
        origin: `http://127.0.0.1:${port}`,
        connection: 'close',
        // SEC-14-02: token is null for sidecars from v1.13 and earlier (graceful);
        // server returns 401 in that case, hook silent-fails as designed.
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      // ... resto inalterado
```

**6. Bumpar `hook-version`** no comentário do topo do arquivo:

Localizar:
```js
// hook-version: 1.6.1
```

Substituir por:
```js
// hook-version: 1.14.0
```

POR QUÊ bumpar de 1.6.1 → 1.14.0:
- Versão do hook track milestone (não package version per se, mas convenção do repo). v1.13 mexeu race condition (1.12.1→1.13.0 implícito). v1.14 adiciona auth.
- Não há sistema de feature-flags em hooks; bump indica mudança de contrato.

POR QUÊ degradar gracefully (token=null → sem header):
- Hook é shipped pra IDEs e instala em $HOME do usuário. Pode rodar contra sidecar v1.13 ainda em execução (usuário com 2 projetos em versões diferentes do kit-mcp).
- Sem token: server v1.14 retorna 401 → publish silenciosamente perde evento. Server v1.13 retorna 202 (sem auth). Behavioral mismatch = aceitável trade-off para retrocompat.

POR QUÊ scanAnyRunningSidecar é especialmente delicado:
- Hook do projeto-A pode encontrar lockfile do projeto-B. Token de B funciona contra sidecar de B (mesmo arquivo, mesmo token). NÃO há leak de B para A — a auth é "qualquer publisher local pode publicar para qualquer sidecar local que tem mesmo token". Token é per-process, não per-project; lockfile é per-project mas está em mesmo tmpdir.
- A vulnerabilidade SEC-14-02 que estamos fechando é "coworker em máquina compartilhada" — coworker NÃO tem acesso ao token (é file readable só pelo user atual em sistemas multi-user normais). Aceitável.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node -c kit/hooks/sidecar-tool-publisher.js && grep -c "Bearer" kit/hooks/sidecar-tool-publisher.js</automated>
  </verify>
  <done>
- `node -c kit/hooks/sidecar-tool-publisher.js` parseia.
- `grep "Bearer" kit/hooks/sidecar-tool-publisher.js` retorna >= 1 (preferencialmente 1 — só na função publish).
- `readSidecarLock` retorna `{port, token}`.
- `scanAnyRunningSidecar` retorna `{port, token}` ou null.
- `publish(port, token, event)` anexa Authorization condicionalmente.
- `hook-version` bumpado para 1.14.0.
  </done>
</task>

<task type="auto">
  <name>Task 4: Unskip OPS-04 + adicionar 3 tests novos para token propagation E2E</name>
  <files>test/integration/ui-hardening.test.js,test/integration/ui-auto-spawn.test.js</files>
  <action>
**Parte A — Unskip OPS-04** em `test/integration/ui-hardening.test.js`:

Localizar (foi marcado em Plan 01 Task 4):
```js
test.skip('OPS-04 [SKIPPED until Plan 02]: 2 concurrent publishers both succeed; events arrive in order', async () => {
```

Substituir por:
```js
test('OPS-04: 2 concurrent publishers both succeed; events arrive in order', async () => {
```

Remover o comentário `// SEC-14-02: src/ui/client.js publish() does NOT yet read lock.token...` (também adicionado em Plan 01 Task 4).

Verificar que o teste passa rodando isoladamente:
```bash
node --test --test-name-pattern "OPS-04" test/integration/ui-hardening.test.js
```

**Parte B — Adicionar 3 tests novos** em `test/integration/ui-hardening.test.js`:

```js
// ────────────────────────────────────────────────────────────────────
// SEC-14-02 / Plan 02: token propagation E2E
// ────────────────────────────────────────────────────────────────────

test('SEC-14-02 prop: client.js publish() attaches Bearer token from lockfile', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  clearPortCache();
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    // publish() should auto-read lock.token and authenticate
    const r = await publish(
      { type: 'progress', ts: Date.now(), runId: null, payload: { percent: 50 } },
      { projectRoot: root },
    );
    assert.equal(r.sent, true, `publish should succeed: ${r.reason}`);
    assert.equal(r.status, 202);
  } finally {
    await srv.shutdown();
    releaseLock(root);
  }
});

test('SEC-14-02 prop: client.js publish() returns http_401 when lockfile has no token', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  clearPortCache();
  // Plant a lockfile WITHOUT token field (simulates v1.13 sidecar still running)
  // Need a real sidecar listening on the port for the connection to succeed at TCP level,
  // so we start a fresh srv and then strip the token from disk.
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    // Rewrite lockfile to remove token (simulate older sidecar)
    const lockPath = lockPathFor(root);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    delete lock.token;
    fs.writeFileSync(lockPath, JSON.stringify(lock));
    clearPortCache(); // force re-read from disk

    const r = await publish(
      { type: 'progress', ts: Date.now(), runId: null, payload: {} },
      { projectRoot: root },
    );
    assert.equal(r.sent, false);
    assert.match(r.reason, /http_401/, `expected http_401, got: ${r.reason}`);
  } finally {
    await srv.shutdown();
    releaseLock(root);
  }
});

test('SEC-14-02 prop: 401 invalidates port cache (recovery after sidecar restart)', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  clearPortCache();
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    // 1st publish: succeed → cache populated
    const r1 = await publish({ type: 'progress', ts: Date.now(), runId: null, payload: {} }, { projectRoot: root });
    assert.equal(r1.sent, true);

    // Tamper lockfile to have BAD token → 401
    const lockPath = lockPathFor(root);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const goodToken = lock.token;
    lock.token = 'x'.repeat(64); // invalid token
    fs.writeFileSync(lockPath, JSON.stringify(lock));
    clearPortCache(); // force re-read of fake token

    const r2 = await publish({ type: 'progress', ts: Date.now(), runId: null, payload: {} }, { projectRoot: root });
    assert.equal(r2.sent, false);
    assert.match(r2.reason, /http_401/);

    // Restore good token → cache should have been invalidated by 401
    lock.token = goodToken;
    fs.writeFileSync(lockPath, JSON.stringify(lock));
    // No clearPortCache call needed if 401 invalidation works; but be defensive in test
    // by NOT calling it — we want to prove the 401 itself triggered eviction.
    const r3 = await publish({ type: 'progress', ts: Date.now(), runId: null, payload: {} }, { projectRoot: root });
    assert.equal(r3.sent, true, `cache should have been invalidated by 401, allowing fresh read: ${r3.reason}`);
  } finally {
    await srv.shutdown();
    releaseLock(root);
  }
});
```

Garantir que `lockPathFor` e `fs` estão importados no topo:
```js
import fs from 'node:fs';                                               // já existe
import { releaseLock, lockPathFor, readLock } from '../../src/ui/lockfile.js';  // ADD lockPathFor + readLock se ausentes
import { publish, clearPortCache } from '../../src/ui/client.js';       // já existe
```

**Parte C — Atualizar `test/integration/ui-auto-spawn.test.js`** se ele bate em `/healthz` ou `/state` automatically:

Verificar grep:
```bash
grep -n "fetch\|http\.request\|/healthz\|/state" test/integration/ui-auto-spawn.test.js
```

Se existirem chamadas a `/state` ou `/events` em testes de auto-spawn, atualizar para passar token. `/healthz` continua aberto, sem mudança.

Se nenhum teste de auto-spawn bate em endpoint protegido, **nenhuma mudança neste arquivo**. Apenas verificar via:
```bash
node --test test/integration/ui-auto-spawn.test.js 2>&1 | tail -5
```

POR QUÊ NÃO testar a propagação `auto-spawn → openBrowser` com URL `?t=`:
- `openBrowser` não retorna o URL final (só `{ opened, via }`). Capturar URL exigiria mockar `open` lib ou interceptar via test harness.
- O contrato é simples: `auto-spawn.js` constrói o URL e passa para `openBrowser`. Verificação: code review + linter custom + smoke test manual.
- Se quisermos test E2E, precisaria browser headless (Puppeteer) — out-of-scope para v1.14.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node --test test/integration/ui-hardening.test.js test/integration/ui-auto-spawn.test.js test/integration/ui-client.test.js 2>&1 | tail -15</automated>
  </verify>
  <done>
- OPS-04 está unskipped e passa.
- 3 tests novos `SEC-14-02 prop:` passam.
- Suite `ui-hardening.test.js` mostra `# pass: 12+` (3 OPS originais + 9 SEC-14 do Plan 01 + 3 novos), `# fail: 0`, `# skip: 0`.
- `ui-auto-spawn.test.js` continua passando.
  </done>
</task>

</tasks>

<verification>
Após Tasks 1-4 todas concluídas, rodar suite completa:

```bash
cd D:/projetos/opensource/mcp
node --test test/integration/ 2>&1 | tail -30
```

Esperado:
- `# pass: ~221` (210 baseline + 9 do Plan 01 + 3 do Plan 02 - 1 OPS-04 que era contável mas reativada)
- `# fail: 0`
- `# skip: 0`

Smoke E2E manual (opcional):
```bash
# 1. Iniciar sidecar
node bin/ui.js --project-root /tmp/smoke --idle-ms 0 &
PID=$!
sleep 1

# 2. Capturar token + port
LOCK="/tmp/kit-mcp-ui-$(node -e "console.log(require('crypto').createHash('sha1').update('/tmp/smoke').digest('hex').slice(0,16))").lock"
TOKEN=$(node -p "JSON.parse(require('fs').readFileSync('$LOCK','utf8')).token")
PORT=$(node -p "JSON.parse(require('fs').readFileSync('$LOCK','utf8')).port")

# 3. Verificar publish via client (in-process)
node -e "import('./src/ui/client.js').then(async m => { const r = await m.publish({type:'progress',ts:Date.now(),runId:null,payload:{}},{projectRoot:'/tmp/smoke'}); console.log('publish:', r); process.exit(r.sent ? 0 : 1); });"

# 4. Verificar publish via hook (out-of-process)
echo '{"tool_name":"Bash","project_root":"/tmp/smoke","tool_input":{"command":"echo test"}}' | node kit/hooks/sidecar-tool-publisher.js
echo "Hook exit: $?"

# 5. Cleanup
curl -s -X POST -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/shutdown"
wait $PID
```

Esperado: `publish: { sent: true, status: 202 }` e `Hook exit: 0`.
</verification>

<success_criteria>
**Token propagation:**
- [x] `auto-spawn.ensureSidecar` constrói URL com `?t=${lock.token}` antes de chamar `openBrowser`.
- [x] `index.html` extrai `?t=` da URL no boot, scrub do address bar via `replaceState`, expõe `authedFetch` e `authedEventSourceUrl`.
- [x] `client.js publish()` lê `lock.token` e anexa `Authorization: Bearer <token>`.
- [x] `kit/hooks/sidecar-tool-publisher.js` lê `lock.token` (de `readSidecarLock` ou `scanAnyRunningSidecar`) e anexa Authorization.

**Backward compat:**
- [x] Lockfile sem `token` (sidecar v1.13 ou anterior) → publish retorna `http_401` em vez de crashar; hook silent-fails.
- [x] `clearPortCache` continua exportada.

**Regressão zero:**
- [x] OPS-04 unskipped e passa.
- [x] Suite full passa (`# fail: 0`).
- [x] Total ~221 tests passando (210 baseline + 9 Plan 01 + 3 Plan 02; ajustes finos OK).
</success_criteria>

<output>
After completion, create `.planning/phases/82-web-surface-hardening/82-02-SUMMARY.md` listing:
- Files modified with line ranges
- Verification commands run + outputs
- Tests added (3 SEC-14-02 prop tests)
- OPS-04 reativado
- hook-version bumped 1.6.1 → 1.14.0 (note: shipped to user IDEs on next /publicar)
- Backward-compat decision: token=null degrades to silent http_401 instead of crash
- Followups for v1.15: smoke E2E test with Puppeteer; CI gate `agent-no-raw-fetch` for index.html
</output>
</content>
</invoke>