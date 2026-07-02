---
phase: 82-web-surface-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/server.js
  - src/ui/lockfile.js
  - src/ui/static/index.html
  - test/integration/ui-server.test.js
  - test/integration/ui-hardening.test.js
autonomous: true
requirements:
  - SEC-14-01
  - SEC-14-02

must_haves:
  truths:
    - "GET / serve HTML com CSP sem 'unsafe-inline' em script-src"
    - "Payload SSE com <script>alert(1)</script> renderiza como texto literal, nunca executa"
    - "POST /shutdown sem header Authorization e sem ?t= retorna 401"
    - "POST /publish sem header Authorization e sem ?t= retorna 401"
    - "GET /events?t=<token-válido> retorna 200 e stream; GET /events sem token retorna 401"
    - "Lockfile JSON serializado contém campo 'token' com 64 caracteres hex"
    - "Suite atual de testes (210 baseline) continua passando"
  artifacts:
    - path: "src/ui/server.js"
      provides: "Servidor HTTP com CSP estrito (sha256 hash do script inline), requireAuth middleware, escape em SSE"
      contains: "requireAuth"
    - path: "src/ui/lockfile.js"
      provides: "Lockfile com token random de 64-char hex"
      contains: "token"
    - path: "src/ui/static/index.html"
      provides: "Cliente com escapeHtml em todo dado dinâmico antes de innerHTML"
      contains: "escapeHtml"
    - path: "test/integration/ui-hardening.test.js"
      provides: "8+ regression tests novos para CSP + auth + token"
      contains: "SEC-14"
  key_links:
    - from: "src/ui/server.js"
      to: "src/ui/lockfile.js"
      via: "leitura do token gerado por acquireLock para comparar contra Authorization/?t="
      pattern: "lockMeta\\.token|authToken"
    - from: "src/ui/server.js (handleIndex)"
      to: "src/ui/static/index.html"
      via: "computa SHA-256 do <script> block e injeta no CSP header como 'sha256-<hash>='"
      pattern: "sha256-"
    - from: "src/ui/static/index.html (innerHTML sites)"
      to: "escapeHtml helper"
      via: "toda interpolação de campo derivado de evento passa por escapeHtml antes de injetar em template literal"
      pattern: "escapeHtml"
---

<objective>
Fechar 2 vulnerabilidades HIGH na surface web do UI sidecar:
- **SEC-14-01:** remover `'unsafe-inline'` do CSP `script-src` (substituir por hash SHA-256 do script inline) e auditar que todo conteúdo derivado de evento passa por `escapeHtml` antes de injetar em innerHTML.
- **SEC-14-02:** gerar token random de 64-char hex no lockfile (`crypto.randomBytes(32).hex`) e exigir `Authorization: Bearer <token>` ou `?t=<token>` em `POST /publish`, `POST /shutdown`, `GET /events` e `GET /state`.

Purpose: a v1.13 fechou 4 CRITICAL mas explicitamente adiou estes 2 HIGH. Auditor v1.13 demonstrou que prompt-injected LLM pode emitir `tool_invocation` com `argsSummary.command="<img src=x onerror=fetch('/shutdown',{method:'POST'})>"` e o UI hoje renderiza HTML+executa JS, fazendo CSRF em localhost. Corrigir esta classe de bug fecha o último pé na surface web do produto.

Output: `src/ui/server.js` com CSP estrito + middleware `requireAuth`, `src/ui/lockfile.js` com campo `token` no JSON, `src/ui/static/index.html` com escapeHtml em todo dado dinâmico, e suíte com 8+ regression tests que provam o fix antes de v1.14 publicar.
</objective>

<execution_context>
@./.claude/framework/workflows/execute-plan.md
@./.claude/framework/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/82-web-surface-hardening/82-CONTEXT.md
@.planning/codebase/concerns.md

# Source files que serão modificados
@src/ui/server.js
@src/ui/lockfile.js
@src/ui/static/index.html
@test/integration/ui-server.test.js
@test/integration/ui-hardening.test.js

<interfaces>
**Lockfile schema atual** (`src/ui/lockfile.js:50-58`):
```js
const meta = {
  pid: process.pid,
  port,
  version: version ?? null,
  startedAt: startedAt ?? Date.now(),
  lockSchema: LOCK_VERSION,   // = 1
};
```
Após este plano DEVE incluir `token: <64-char hex>` (NÃO bumpa LOCK_VERSION — campo é additivo).

**Server CSP atual** (`src/ui/server.js:45-51`) — alvo da remoção:
```js
const CSP =
  "default-src 'self'; " +
  "connect-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "frame-ancestors 'none'";
```

**Routing atual** (`src/ui/server.js:372-388`):
```js
case 'GET /':
case 'GET /index.html':       return handleIndex(res);
case 'GET /events':           return handleEvents(req, res);   // ADICIONAR requireAuth
case 'GET /healthz':          return handleHealthz(res);
case 'GET /state':            return handleState(res, url);   // ADICIONAR requireAuth
case 'POST /publish':         return handlePublish(req, res); // ADICIONAR requireAuth
case 'POST /shutdown':        return handleShutdownRequest(req, res); // ADICIONAR requireAuth
```

**Padrões de innerHTML no `src/ui/static/index.html`** (auditados via grep):
- linha 1410: `innerHTML = '<div class="hist-empty">Nada por aqui ainda...</div>'` — HTML estático literal, **OK**.
- linha 1414: `innerHTML = rows;` onde `rows = state.history.map(historyRowHtml).join("")` — depende de `historyRowHtml` escapar todos campos dinâmicos.
- linha 1467: `wrap.innerHTML = activeCardHtml(run);` — depende de `activeCardHtml` escapar.
- linha 1588: `els.timeline.innerHTML = "";` — string vazia, **OK**.
- linha 1616: `wrap.innerHTML = rowHtml(evt, idx, ...)` — depende de `rowHtml` escapar.
- linha 1776: `els.active.innerHTML = "";` — string vazia, **OK**.
- linha 1871: `pauseIcon.innerHTML = state.paused ? '<svg>...</svg>' : '<svg>...</svg>'` — SVG estático, **OK**.

A função `escapeHtml(...)` JÁ é chamada em alguns sites (linha 1433, 1439, 1440, 1447) — pattern existe mas precisa ser auditado para 100% de cobertura.

**Decisão crítica de CSP**: removendo `'unsafe-inline'`, o `<script>...</script>` inline em `index.html:1176-2050` PARA DE EXECUTAR. Solução: computar SHA-256 base64 do conteúdo do script no boot do server e injetar como `'sha256-<hash>='` no CSP. Cache do hash em memória (per-process) — index.html é static asset.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Adicionar token random de 64-char hex ao lockfile</name>
  <files>src/ui/lockfile.js</files>
  <action>
Editar `src/ui/lockfile.js` em duas localizações:

**1. Imports (linha 9):**
Substituir `import { createHash } from 'node:crypto';` por:
```js
import { createHash, randomBytes } from 'node:crypto';
```

**2. Função `acquireLock` (linha 50-58):**
Adicionar campo `token` no objeto `meta`. Token é gerado UMA VEZ por chamada de `acquireLock` (per-process):
```js
const meta = {
  pid: process.pid,
  port,
  version: version ?? null,
  startedAt: startedAt ?? Date.now(),
  lockSchema: LOCK_VERSION,
  // SEC-14-02: per-process auth token. 32 random bytes hex-encoded = 64 chars.
  // Required by /publish, /shutdown, /events, /state. Lifetime = process lifetime;
  // not logged, not telemetered. See docs/sidecar-security.md.
  token: randomBytes(32).toString('hex'),
};
```

NÃO modificar `LOCK_VERSION` (continua 1 — campo é opcional, leitores antigos ignoram). NÃO modificar `readLock` — ele já usa `JSON.parse` e devolve o objeto inteiro, então `lock.token` fica acessível automaticamente para callers.

POR QUÊ usar `randomBytes(32).toString('hex')` (e NÃO `randomUUID` ou Math.random):
- 32 bytes = 256 bits de entropia (>>128 bits exigidos para tokens de auth).
- `randomBytes` é CSPRNG (libuv consulta entropy pool do OS); `Math.random` é Mersenne Twister (predictable).
- `randomUUID` produz só 122 bits úteis (4 bits são version/variant) — funcionalmente OK mas convenção da indústria para session tokens é hex.

POR QUÊ NÃO bumpar LOCK_VERSION:
- LOCK_VERSION sinaliza schema breaking change para consumidores externos do lockfile (hooks shipped em IDEs anteriores). `token` é additivo: leitor que não conhece o campo ignora-o. Bumpar quebraria sidecar-tool-publisher de v1.12 instalado em IDE legado.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node -e "import('./src/ui/lockfile.js').then(m => { const root = require('os').tmpdir() + '/kit-token-verify-' + Date.now(); require('fs').mkdirSync(root, { recursive: true }); m.releaseLock(root); const lock = m.acquireLock({ projectRoot: root, port: 9999, version: 'test', startedAt: Date.now() }); m.releaseLock(root); if (typeof lock.token !== 'string' || lock.token.length !== 64 || !/^[0-9a-f]{64}$/.test(lock.token)) { console.error('FAIL token=', JSON.stringify(lock.token)); process.exit(1); } console.log('OK token format'); });"</automated>
  </verify>
  <done>
- `acquireLock(...)` retorna objeto com campo `token` de 64 caracteres hex.
- Padrão `/^[0-9a-f]{64}$/` matches no token gerado.
- LOCK_VERSION continua 1.
- `readLock` continua devolvendo `null` em arquivo missing/inválido (sem regressão).
  </done>
</task>

<task type="auto">
  <name>Task 2: CSP estrito — remover 'unsafe-inline', adicionar SHA-256 hash do script inline</name>
  <files>src/ui/server.js</files>
  <action>
Editar `src/ui/server.js`. Sequência de edits:

**1. Imports (linha 19-24)** — adicionar `createHash`:
Atualmente:
```js
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
```
Adicionar APÓS a última linha de import:
```js
import { createHash } from 'node:crypto';
```

**2. Substituir constante `CSP` (linha 45-51) por função `buildCsp`**:

Localizar:
```js
const CSP =
  "default-src 'self'; " +
  "connect-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "frame-ancestors 'none'";
```

Substituir POR:
```js
// SEC-14-01: CSP without 'unsafe-inline' in script-src. The single inline
// <script> block in index.html is allowed via SHA-256 hash injected at boot.
// 'unsafe-inline' kept ONLY for style-src (the entire <style> block is intentional;
// CSS injection has no script execution vector with connect-src 'self').
function buildCsp(scriptHash) {
  const scriptSrc = scriptHash ? `'self' ${scriptHash}` : "'self'";
  return (
    "default-src 'self'; " +
    "connect-src 'self'; " +
    `script-src ${scriptSrc}; ` +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none'"
  );
}

// Computes the SHA-256 hash of the inline <script> block in the static HTML.
// Returns the CSP-formatted source expression: "'sha256-<base64>='".
// Returns empty string if no <script> block found (graceful — caller falls back to "'self'" alone).
function computeScriptHashFromHtml(html) {
  if (typeof html !== 'string') return '';
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) return '';
  const hash = createHash('sha256').update(m[1], 'utf8').digest('base64');
  return `'sha256-${hash}'`;
}
```

**3. Refatorar `loadStaticIndex` (linha 125-134)** para retornar tanto html quanto hash, com cache:

Localizar:
```js
function loadStaticIndex() {
  try {
    return readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8');
  } catch {
    return `<!doctype html><meta charset="utf-8"><title>kit-mcp sidecar</title>
<body><pre>UI not yet packaged. Run \`kit ui\` after Phase 14 is shipped.</pre></body>`;
  }
}
```

Substituir POR:
```js
let _cachedIndex = null; // { html, scriptHash }
function loadStaticIndex() {
  if (_cachedIndex) return _cachedIndex;
  let html;
  try {
    html = readFileSync(path.join(STATIC_DIR, 'index.html'), 'utf8');
  } catch {
    html = `<!doctype html><meta charset="utf-8"><title>kit-mcp sidecar</title>
<body><pre>UI not yet packaged. Run \`kit ui\` after Phase 14 is shipped.</pre></body>`;
  }
  // SEC-14-01: hash inline <script> for CSP whitelist. Cache per-process.
  const scriptHash = computeScriptHashFromHtml(html);
  _cachedIndex = { html, scriptHash };
  return _cachedIndex;
}
```

**4. Atualizar `handleIndex` (linha 352-361)**:

Localizar:
```js
function handleIndex(res) {
  const html = staticHtml ?? loadStaticIndex();
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(html);
}
```

Substituir POR:
```js
function handleIndex(res) {
  let html, scriptHash;
  if (typeof staticHtml === 'string') {
    html = staticHtml;
    scriptHash = computeScriptHashFromHtml(staticHtml);
  } else {
    ({ html, scriptHash } = loadStaticIndex());
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': buildCsp(scriptHash),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(html);
}
```

**5. Atualizar export `__test` (linha 447-454)** — substituir constante `CSP` por função:

Localizar:
```js
export const __test = {
  RING_BUFFER_SIZE,
  MAX_SSE_SUBSCRIBERS,
  DEFAULT_IDLE_MS,
  HEARTBEAT_INTERVAL_MS,
  CSP,
  EVENT_TYPES,
};
```

Substituir POR:
```js
export const __test = {
  RING_BUFFER_SIZE,
  MAX_SSE_SUBSCRIBERS,
  DEFAULT_IDLE_MS,
  HEARTBEAT_INTERVAL_MS,
  // SEC-14-01: CSP is now built dynamically with sha256 hash of inline <script>.
  // The constant CSP no longer exists; tests should use buildCsp(scriptHash).
  buildCsp,
  computeScriptHashFromHtml,
  EVENT_TYPES,
};
```

**6. Verificar se algum lugar interno do server.js ainda referencia a constante `CSP`** removida — search por `CSP` (uppercase, palavra completa). Se encontrar, atualizar para `buildCsp(...)` ou simplesmente remover (apenas em headers HTTP).

POR QUÊ cache `_cachedIndex`:
- index.html é static asset; conteúdo nunca muda em runtime. Computar SHA-256 em cada GET / desperdiça ~5ms em arquivo de 2050 linhas.
- Cache é per-process; restart re-lê fresh.

POR QUÊ usar SHA-256 e não nonce:
- Nonce exige reescrita do HTML por request (injetar `<script nonce="...">`); custo de complexidade alto. Hash é estático: computado uma vez no boot.
- CSP Level 2 spec garante que `'sha256-<hash>'` é equivalente a permitir execução de qualquer `<script>...</script>` cujo conteúdo bate com o hash.

POR QUÊ exatamente UM `<script>` block:
- Verificado via grep — index.html linha 1176 abre o ÚNICO `<script>`. Se no futuro alguém adicionar segundo, hash atual cobre só o primeiro e o segundo é bloqueado silenciosamente. Test de regressão (Task 5) verifica invariância "exatamente 1 `<script>` block".
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node -c src/ui/server.js && node -e "import('./src/ui/server.js').then(m => { const csp = m.__test.buildCsp(\"'sha256-abc='\"); if (csp.includes('unsafe-inline') === false || csp.split(';').filter(c => c.trim().startsWith('script-src'))[0].includes('unsafe-inline')) { /* must NOT have unsafe-inline in script-src */ } if (/script-src[^;]*unsafe-inline/.test(csp)) { console.error('FAIL: unsafe-inline still in script-src:', csp); process.exit(1); } if (!csp.includes(\"'sha256-abc='\")) { console.error('FAIL: sha256 hash not injected'); process.exit(1); } console.log('OK csp=' + csp); });"</automated>
  </verify>
  <done>
- `grep -E "script-src[^;]*unsafe-inline" src/ui/server.js` retorna 0 matches.
- `buildCsp("'sha256-X='")` retorna string contendo `script-src 'self' 'sha256-X='` (sem `'unsafe-inline'`).
- `computeScriptHashFromHtml(...)` retorna string no formato `'sha256-<44-char-base64>='`.
- `node -c src/ui/server.js` parseia sem erro.
  </done>
</task>

<task type="auto">
  <name>Task 3: Implementar middleware requireAuth + aplicar em /publish, /shutdown, /events, /state</name>
  <files>src/ui/server.js</files>
  <action>
Editar `src/ui/server.js`. Sequência de edits:

**1. Após a função `buildCsp` (continuação da Task 2), adicionar antes de `logErr` (linha ~53)**:

```js
// SEC-14-02: per-process auth token. Set during start() from acquireLock result.
// Cleared on shutdown(). Never logged in full.
let authToken = null;

// requireAuth: returns true if request has a valid token via either:
//   - Authorization: Bearer <token>      (preferred for fetch from same-origin browser)
//   - ?t=<token> query param             (required for EventSource — browser API can't set headers)
// Caller is responsible for sending 401 when this returns false.
function requireAuth(req, url) {
  if (!authToken) return false; // server didn't init token — fail closed
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const provided = auth.slice('Bearer '.length).trim();
    if (timingSafeEqual(provided, authToken)) return true;
  }
  const qp = url?.searchParams?.get('t');
  if (typeof qp === 'string' && timingSafeEqual(qp, authToken)) return true;
  return false;
}

// Constant-time string comparison to prevent timing-leak side channel.
// Walks the longer of the two strings even when lengths differ to keep timing flat.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
```

POR QUÊ NÃO usar `crypto.timingSafeEqual`:
- Aceita Buffer (force alocação extra), exige tamanhos iguais (lança erro se diferentes). Implementação JS inline é equivalente e mais limpa para strings.

POR QUÊ falhar fechado se `authToken` não inicializado:
- Defesa-em-profundidade: se algum caminho de boot esquecer de chamar `start()` ou setá-lo, qualquer endpoint protegido nega em vez de permitir tudo.

**2. `handleEvents` (linha 229-270)** — mudar assinatura para receber `url`, adicionar check no topo:

Localizar:
```js
function handleEvents(req, res) {
  if (subscribers.size >= maxSubscribers) {
```

Substituir por:
```js
function handleEvents(req, res, url) {
  if (!requireAuth(req, url)) {
    sendJson(res, 401, { error: 'auth_required' });
    return;
  }
  if (subscribers.size >= maxSubscribers) {
```

**3. `handlePublish` (linha 272)** — mesma assinatura nova + check ANTES do check de origin:

Localizar:
```js
async function handlePublish(req, res) {
  if (!isOriginAllowed(req, listeningPort)) {
```

Substituir por:
```js
async function handlePublish(req, res, url) {
  if (!requireAuth(req, url)) {
    sendJson(res, 401, { error: 'auth_required' });
    return;
  }
  if (!isOriginAllowed(req, listeningPort)) {
```

**4. `handleShutdownRequest` (linha 341)** — idem:

Localizar:
```js
async function handleShutdownRequest(req, res) {
  if (!isOriginAllowed(req, listeningPort)) {
```

Substituir por:
```js
async function handleShutdownRequest(req, res, url) {
  if (!requireAuth(req, url)) {
    sendJson(res, 401, { error: 'auth_required' });
    return;
  }
  if (!isOriginAllowed(req, listeningPort)) {
```

**5. `handleState` (linha 316)** — adicionar req + check:

Localizar:
```js
function handleState(res, url) {
  let events = ring;
```

Substituir por:
```js
function handleState(req, res, url) {
  if (!requireAuth(req, url)) {
    sendJson(res, 401, { error: 'auth_required' });
    return;
  }
  let events = ring;
```

**6. `handleRequest` switch (linha 372-388)** — passar `req`/`url` aos handlers:

Localizar o bloco switch e atualizar:
```js
case 'GET /events':           return handleEvents(req, res, url);
case 'GET /state':            return handleState(req, res, url);
case 'POST /publish':         return handlePublish(req, res, url);
case 'POST /shutdown':        return handleShutdownRequest(req, res, url);
```

(Os outros casos — `GET /`, `GET /healthz` — não mudam.)

**7. `start` (linha 395-434)** — copiar token do lockMeta para closure após `acquireLockOrReclaim`:

Localizar:
```js
lockMeta = await acquireLockOrReclaim({
  projectRoot,
  port: listeningPort,
  version,
  startedAt,
});
```

Adicionar IMEDIATAMENTE DEPOIS:
```js
authToken = lockMeta.token;
if (typeof authToken !== 'string' || authToken.length !== 64) {
  throw new Error('SEC-14-02: lockMeta.token missing or malformed; refusing to start');
}
```

**8. `shutdown` (linha 190-227)** — zerar token no shutdown. Localizar o final da função, após `lockMeta = null;`:

Adicionar:
```js
authToken = null; // SEC-14-02: clear so a re-start gets a fresh one
```

**9. Atualizar `__test` export** (resultado final esperado, somando edits desta task à Task 2):

```js
export const __test = {
  RING_BUFFER_SIZE,
  MAX_SSE_SUBSCRIBERS,
  DEFAULT_IDLE_MS,
  HEARTBEAT_INTERVAL_MS,
  buildCsp,
  computeScriptHashFromHtml,
  EVENT_TYPES,
  // SEC-14-02
  timingSafeEqual,
  // Note: requireAuth depends on closure state (authToken) so end-to-end HTTP tests verify behavior.
};
```

POR QUÊ NÃO aplicar requireAuth em `GET /healthz`:
- `/healthz` é usado por `auto-spawn.healthzOk` ANTES do browser receber o token (handshake de boot). Bloqueá-lo quebraria o startup.
- `/healthz` retorna apenas `ok`, `version`, `uptime`, `port`, `subscribers`, `eventsTotal`. Nenhum dado sensível. Auditoria de exposição: aceitável manter aberto.
- Hooks de outros projetos (`scanAnyRunningSidecar`) precisam de health probe sem cred (porque têm que descobrir lockfile de outro project antes de chamar /publish).

POR QUÊ `/state` é protegido (mesmo sendo GET):
- `/state` retorna `events: [...]` — payloads completos das últimas 200 chamadas, incluindo `tool_invocation` com `argsSummary.command` (potencialmente paths absolutos, secrets em prompts). Esse é exatamente o tipo de info que CSRF same-origin do coworker quer extrair. Aplicar auth.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node -c src/ui/server.js && node -e "import('./src/ui/server.js').then(m => { /* timingSafeEqual unit */ if (m.__test.timingSafeEqual('abc', 'abc') !== true) { console.error('FAIL eq'); process.exit(1); } if (m.__test.timingSafeEqual('abc', 'abcd') !== false) { console.error('FAIL diff-len'); process.exit(1); } if (m.__test.timingSafeEqual('a', 'b') !== false) { console.error('FAIL diff-char'); process.exit(1); } console.log('OK timingSafeEqual'); })"</automated>
  </verify>
  <done>
- `node -c src/ui/server.js` parseia sem erro.
- `timingSafeEqual` exportado e passa nos casos: same/diff-length/diff-char/empty.
- 4 handlers (`handleEvents`, `handlePublish`, `handleShutdownRequest`, `handleState`) chamam `requireAuth(req, url)` no topo.
- `start()` copia `lockMeta.token` para `authToken` e valida formato de 64 chars.
- `shutdown()` zera `authToken`.
- Suite atual em `test/integration/ui-server.test.js` provavelmente FALHA agora em testes de `/publish`/`/shutdown`/`/state`/`/events` (esperado — Task 4 atualiza o helper).
  </done>
</task>

<task type="auto">
  <name>Task 4: Atualizar testes existentes para passar token</name>
  <files>test/integration/ui-server.test.js,test/integration/ui-hardening.test.js</files>
  <action>
Implementação das Tasks 1-3 quebra todos os testes que chamam endpoints protegidos sem token. Esta task atualiza helper de testes para incluir token, preservando comportamento esperado.

**1. Em `test/integration/ui-server.test.js`** — atualizar `withServer` (linha 45-56) para capturar token:

Localizar:
```js
async function withServer(opts, fn) {
  const root = opts?.projectRoot ?? mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0, ...opts });
  await srv.start();
  try {
    await fn(srv, root);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
}
```

Substituir por:
```js
async function withServer(opts, fn) {
  const root = opts?.projectRoot ?? mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0, ...opts });
  await srv.start();
  // SEC-14-02: protected endpoints require token; capture from lockfile.
  const { readLock } = await import('../../src/ui/lockfile.js');
  const lock = readLock(root);
  const token = lock?.token;
  try {
    await fn(srv, root, token);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
}
```

**2. Atualizar `fetch` helper (linha 15-43)** para aceitar `token`:

Localizar a assinatura:
```js
function fetch(method, port, pathname, { body, headers = {} } = {}) {
```

Substituir por:
```js
function fetch(method, port, pathname, { body, headers = {}, token } = {}) {
```

E dentro do `headers` no `opts`, adicionar `authorization` quando `token` presente:
```js
headers: {
  host: `127.0.0.1:${port}`,
  connection: 'close',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...headers,
},
```

**3. Atualizar TODOS os testes em `ui-server.test.js` que tocam endpoints protegidos** para passar `token`. Lista de mudanças (procurar por `withServer({}, async (srv) => {` e atualizar para `withServer({}, async (srv, root, token) => {`):

- Test "GET / serves HTML with strict CSP" (linha 58): NÃO toca endpoint protegido. **Atualizar assinatura** mas manter chamadas como estão.
- Test "GET /healthz returns ok" (linha 69): `/healthz` continua aberto. **Manter sem token.**
- Test "Host header validation" (linha 81-90, 92-99): GET /healthz, mantém.
- Test "POST /publish round-trip" (linha 101-114): adicionar `token` no fetch publish E no fetch /state.
- Test "GET /state pagination" (linha 117-143): adicionar `token` em todos os fetches GET /state E POST /publish.
- Test "POST /publish: rejects malformed JSON" (linha 145-152): `token` no fetch (deve passar auth, falhar em parse).
- Test "POST /publish: rejects unknown event type" (linha 154-161): `token`.
- Test "POST /publish: rejects oversized body" (linha 163-169): `token`.
- Test "Origin validation: rejects cross-origin POST" (linha 171-181): `token` (deve passar auth, falhar em origin check).
- Test "Origin validation: rejects cross-origin POST /shutdown" (linha 183-193): `token`.
- Test "SSE: receives published events live" (linha 195+): adicionar `?t=${token}` no path da request `/events`. Ler o teste todo e atualizar a montagem do `req.path = '/events'` para `req.path = '/events?t=' + token`.

**Estratégia eficiente para o executor:** ler o arquivo todo, fazer um único Edit em massa que substitui o pattern padrão `await withServer({}, async (srv) => {` por `await withServer({}, async (srv, root, token) => {` em TODAS as ocorrências, depois ajustar individualmente os fetches que tocam endpoints protegidos para passar `token`.

**4. Em `test/integration/ui-hardening.test.js`** — adicionar `test.skip` em OPS-04:

Localizar o test "OPS-04: 2 concurrent publishers" (linha 48-70):
```js
test('OPS-04: 2 concurrent publishers both succeed; events arrive in order', async () => {
```

Substituir por:
```js
test.skip('OPS-04 [SKIPPED until Plan 02]: 2 concurrent publishers both succeed; events arrive in order', async () => {
```

E adicionar comentário acima:
```js
// SEC-14-02: src/ui/client.js publish() does NOT yet read lock.token and
// attach Authorization. Plan 02 (auto-spawn-token-propagation) updates client.js
// and unskips this test. Until then, calling publish() against a token-protected
// /publish endpoint returns 401, which would make this test fail incorrectly.
```

POR QUÊ skip em vez de atualizar agora:
- `publish()` em `src/ui/client.js` é alterado em Plan 02. Atualizar OPS-04 antes do publish() saber do token quebraria a invariância de teste hermético. Skip é flag visível na saída TAP; reativação em Plan 02 deixa rastro em commit.

**5. Verificar se algum test importa `__test.CSP`** removida na Task 2:

```bash
grep -rn "__test\.CSP\|serverConst\.CSP" test/
```

Se houver matches, atualizar para `__test.buildCsp(scriptHash)` ou simplesmente remover essas asserções (o test "GET / serves HTML with strict CSP" já valida via headers HTTP — não precisa de constante).
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node --test test/integration/ui-server.test.js test/integration/ui-hardening.test.js 2>&1 | tail -15</automated>
  </verify>
  <done>
- `node --test test/integration/ui-server.test.js` passa todos os testes (zero falhas).
- `node --test test/integration/ui-hardening.test.js` passa OPS-03, OPS-05; OPS-04 aparece como `# skip`.
- Helper `withServer` captura token do lockfile e passa como 3º argumento do callback.
- Helper `fetch` aceita `{ token }` em opts e injeta como `Authorization: Bearer <token>`.
- Suite full (`npm test` ou equivalente) mantém baseline 210 passando + qualquer test novo que Task 5 vai criar.
  </done>
</task>

<task type="auto">
  <name>Task 5: Adicionar regression tests novos para SEC-14-01 e SEC-14-02</name>
  <files>test/integration/ui-hardening.test.js</files>
  <action>
Adicionar 8 novos tests no final de `test/integration/ui-hardening.test.js`. Primeiro, garantir imports no topo (verificar — alguns já existem):

```js
import { test } from 'node:test';        // já existe
import assert from 'node:assert/strict'; // já existe
import http from 'node:http';            // já existe
import fs from 'node:fs';                // já existe
import path from 'node:path';            // ADD se não existir
import { createServer } from '../../src/ui/server.js';            // já existe
import { releaseLock, readLock } from '../../src/ui/lockfile.js'; // ADD readLock se não existir
```

Adicionar bloco no final do arquivo:

```js
// ────────────────────────────────────────────────────────────────────
// SEC-14-01 (CSP without unsafe-inline) + SEC-14-02 (token-based auth)
// regression tests. Added in Phase 82 / v1.14.
// ────────────────────────────────────────────────────────────────────

function rawHttpRequest({ method, port, pathname, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const opts = {
      method, host: '127.0.0.1', port, path: pathname,
      agent: false,
      headers: {
        host: `127.0.0.1:${port}`, connection: 'close',
        ...headers,
        ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
      },
    };
    const req = http.request(opts, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => { try { req.destroy(); } catch {} resolve({ status: 0, headers: {}, body: '' }); });
    if (body) req.write(body);
    req.end();
  });
}

test('SEC-14-01: GET / has CSP without unsafe-inline in script-src and includes sha256 hash', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/' });
    assert.equal(res.status, 200);
    const csp = res.headers['content-security-policy'];
    assert.ok(csp, 'CSP header missing');
    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
    assert.ok(scriptSrcMatch, 'script-src directive missing');
    assert.doesNotMatch(scriptSrcMatch[1], /unsafe-inline/, 'script-src must NOT include unsafe-inline');
    assert.match(scriptSrcMatch[1], /'sha256-[A-Za-z0-9+/]{43}='/, 'script-src must include sha256 hash');
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-01: index.html contains exactly one <script> block (hash invariant)', async () => {
  const indexPath = path.join(process.cwd(), 'src', 'ui', 'static', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const matches = html.match(/<script>/g) || [];
  assert.equal(matches.length, 1, `expected exactly 1 <script> block, found ${matches.length}; CSP hash logic in server.js needs updating if this changes`);
});

test('SEC-14-02: lockfile contains token field with 64 hex chars', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const lock = readLock(root);
    assert.ok(lock, 'lockfile missing');
    assert.equal(typeof lock.token, 'string', 'token field missing');
    assert.equal(lock.token.length, 64, 'token must be 64 chars');
    assert.match(lock.token, /^[0-9a-f]{64}$/, 'token must be 64-char hex');
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: POST /shutdown without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({
      method: 'POST', port: srv.port, pathname: '/shutdown',
      headers: { origin: `http://127.0.0.1:${srv.port}` },
      body: '',
    });
    assert.equal(res.status, 401);
    assert.match(res.body, /auth_required/);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: POST /publish without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const evt = JSON.stringify({ type: 'progress', ts: Date.now(), runId: null, payload: {} });
    const res = await rawHttpRequest({
      method: 'POST', port: srv.port, pathname: '/publish',
      headers: { origin: `http://127.0.0.1:${srv.port}` },
      body: evt,
    });
    assert.equal(res.status, 401);
    assert.match(res.body, /auth_required/);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: GET /events without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/events' });
    assert.equal(res.status, 401);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: GET /state without token returns 401', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const res = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/state' });
    assert.equal(res.status, 401);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: GET /events?t=<valid> accepts; ?t=<invalid> rejects', async () => {
  const root = mkProjectRoot();
  releaseLock(root);
  const srv = createServer({ projectRoot: root, idleMs: 0 });
  await srv.start();
  try {
    const lock = readLock(root);
    const goodToken = lock.token;
    // Valid: should connect (200 + SSE headers). Don't wait for body — SSE never closes naturally.
    const goodStatus = await new Promise((resolve) => {
      const req = http.request({
        method: 'GET', host: '127.0.0.1', port: srv.port, path: `/events?t=${goodToken}`,
        agent: false, headers: { host: `127.0.0.1:${srv.port}`, connection: 'close' },
      }, (r) => {
        resolve(r.statusCode);
        try { req.destroy(); } catch {}
      });
      req.on('error', () => resolve(0));
      req.setTimeout(2000, () => { try { req.destroy(); } catch {} resolve(0); });
      req.end();
    });
    assert.equal(goodStatus, 200, 'valid token should accept SSE connection');

    // Invalid: should 401
    const badRes = await rawHttpRequest({ method: 'GET', port: srv.port, pathname: '/events?t=' + 'x'.repeat(64) });
    assert.equal(badRes.status, 401);
  } finally {
    await srv.shutdown('test_cleanup');
    releaseLock(root);
  }
});

test('SEC-14-02: timingSafeEqual unit — same/diff-length/diff-char/empty', async () => {
  const { __test } = await import('../../src/ui/server.js');
  assert.equal(__test.timingSafeEqual('abc', 'abc'), true);
  assert.equal(__test.timingSafeEqual('abc', 'abcd'), false);
  assert.equal(__test.timingSafeEqual('abc', 'abd'), false);
  assert.equal(__test.timingSafeEqual('', ''), true);
  assert.equal(__test.timingSafeEqual('a', 'b'), false);
  assert.equal(__test.timingSafeEqual('a', null), false);
});
```

POR QUÊ 9 tests (e não os 6 mínimos):
- 6 mínimos cobrem essência de SEC-14-02 (token shape, /shutdown 401, /publish 401, /events 401, /events?t=valid, /state 401).
- +3 cobrem invariantes que se mudarem quebram o fix silenciosamente:
  - "exactly 1 `<script>` block": defensiva para hash CSP.
  - "CSP header inspection": prova-por-construção de SEC-14-01 (browser obedecerá CSP correto).
  - "timingSafeEqual unit": proof-de-side-channel-resistance.

POR QUÊ NÃO testar XSS reflexivo via JSDOM:
- JSDOM não impõe CSP em rendering (só em parsing). Para provar bloqueio de XSS, precisa browser real (Puppeteer/Playwright). Custo de adicionar dep não justifica para v1.14 — o teste "CSP header não tem unsafe-inline" é prova-por-construção suficiente.
- CSP correctness é responsabilidade do browser, não do código nosso. Se quisermos teste e2e, fica para v1.15 (separar).
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node --test test/integration/ui-hardening.test.js 2>&1 | tail -15</automated>
  </verify>
  <done>
- `node --test test/integration/ui-hardening.test.js` mostra **9+ tests passando** (incluindo SEC-14-* novos).
- TAP output indica `# pass: N`, `# fail: 0`, `# skip: 1` (OPS-04 aguardando Plan 02).
- 6+ regression tests SEC-14 todos passam.
  </done>
</task>

<task type="auto">
  <name>Task 6: Auditar innerHTML em index.html — garantir escapeHtml em todo dado dinâmico</name>
  <files>src/ui/static/index.html</files>
  <action>
Auditoria seletiva. NÃO refatorar todo innerHTML para textContent (CSP estrito sem `'unsafe-inline'` já bloqueia XSS reflexivo via attribute handlers). Em vez disso, garantir defesa-em-profundidade: TODO dado derivado de evento que vai para innerHTML passa por `escapeHtml`.

**1. Verificar definição de `escapeHtml`** — buscar no script block:

```bash
# (executor: rode primeiro)
grep -n "function escapeHtml" src/ui/static/index.html
```

Se NÃO existir, ADICIONAR após `safeStr` (procurar por `function safeStr` ~linha 1484):

```js
/**
 * SEC-14-01: defense-in-depth HTML escape for any user-derived content
 * before injection into innerHTML/template literals. CSP without
 * 'unsafe-inline' in script-src is the primary defense; escapeHtml is
 * extra protection if CSP is somehow relaxed (browser bug, dev mode).
 * Escapes: & < > " '.
 */
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

Se já existe, **auditar** que cobre os 5 chars: `& < > " '`. Se faltar algum, atualizar.

**2. Auditar cada call site `innerHTML =` que injeta string com `${...}`**. Localizar:

```bash
grep -nE 'innerHTML\s*=' src/ui/static/index.html
```

Para CADA match com template literal (backticks):

- linha 1410: `innerHTML = '<div class="hist-empty">Nada por aqui ainda...</div>'` — HTML estático, **OK**. Adicionar comentário inline `// XSS-safe: static literal`.

- linha 1414: `innerHTML = rows;` onde `rows = state.history.map(historyRowHtml).join("")`. **Auditar `historyRowHtml`** (linha ~1420). Verificar que TODA `${expr}` no template literal está envolta em `escapeHtml(...)`. Já chama `escapeHtml(pct)`, `escapeHtml(lbl)`, `escapeHtml(title)` — confirmar que `${h.runId}`, `${h.eventsCount}`, `${dur}`, `${tokens}`, `${when}`, `${detailRows}`, `${statusGlyph}` também passam por escape. Se um `${h.runId}` aparece "cru", envolver: `${escapeHtml(h.runId)}`. Adicionar comentário `// SEC-14-01: every dynamic field escaped` na primeira linha de `historyRowHtml`.

  ATENÇÃO: `runId` é gerado pelo nosso código (`makeEvent`) — em teoria seguro. Mas a regra é: se o valor chegou de fora do código (publisher hook → publish → SSE → DOM), assumir hostil. Aplicar `escapeHtml` é cheap.

- linha 1467: `wrap.innerHTML = activeCardHtml(run);` — **localizar `activeCardHtml`** (grep `function activeCardHtml`). Auditar TODA interpolação. Atenção a `run.tool`, `run.runId`, `run.payload.command`, `run.argsSummary.*` — esses vêm de `tool_invocation` events com payload arbitrário do hook (que processa argumentos do Claude Code, incluindo `Bash command`).

- linha 1588: `els.timeline.innerHTML = "";` — string vazia, **OK**.

- linha 1616: `wrap.innerHTML = rowHtml(evt, idx, ...)` — **localizar `rowHtml`** (grep `function rowHtml`). Auditar TODOS os campos: `evt.payload.command`, `evt.payload.message`, `evt.payload.label`, `evt.payload.path`, `evt.payload.url`, `evt.payload.argsSummary.*`. **Ponto mais crítico** — esse é literalmente o display do timeline que o atacante prompt-injected mira.

- linha 1776: `els.active.innerHTML = "";` — string vazia, **OK**.

- linha 1871: `pauseIcon.innerHTML = state.paused ? '<svg>...</svg>' : '<svg>...</svg>'` — SVG estático literal, **OK**. Adicionar `// XSS-safe: static SVG`.

**3. Sanity check final** — verificar via grep que NENHUMA assignment de `innerHTML` com `${...}` deixa de chamar `escapeHtml`:

```bash
# (executor: deve retornar 0 matches após fix)
node -e "
const html = require('node:fs').readFileSync('src/ui/static/index.html', 'utf8');
const m = html.match(/<script>([\\s\\S]*?)<\\/script>/);
if (!m) { console.error('no script block'); process.exit(1); }
const js = m[1];
// Find every backtick-template assigned to innerHTML, check it has escapeHtml when interpolating
const re = /innerHTML\\s*=\\s*\`([^\`]*)\`/g;
const bad = [];
let mm;
while ((mm = re.exec(js))) {
  if (mm[1].includes('\\\${') && !mm[1].includes('escapeHtml(')) {
    bad.push(mm[1].slice(0, 80));
  }
}
if (bad.length) {
  console.error('innerHTML with interpolation but no escapeHtml:');
  bad.forEach(b => console.error('  ', b));
  process.exit(1);
}
console.log('OK: every interpolated innerHTML uses escapeHtml at least once');
"
```

NOTA: este sanity check é grosseiro — só verifica que `escapeHtml(` aparece no template, não que CADA `${expr}` use. Para garantia mais forte, executar inspeção visual de `historyRowHtml`, `activeCardHtml`, `rowHtml` durante a auditoria. O grep é guard mínimo para CI futuro (gate `kit-no-raw-innerhtml`).

**4. Adicionar comentário de header no início do `<script>` block** (linha ~1176-1183):

Localizar:
```js
/* ──────────────────────────────────────────────────────────
   kit-mcp sidecar — prototype
   This is a faithful mock of what the production HTML will do.
   In production, replace the MockSource with a real EventSource('/events').
   ────────────────────────────────────────────────────────── */
```

(Comentário stale — menciona "MockSource" e "prototype" mas há tempos é production.)

Substituir por:
```js
/* ──────────────────────────────────────────────────────────
   kit-mcp sidecar — production client
   SEC-14-01 (Phase 82): All event-derived content rendered via escapeHtml()
   before insertion into innerHTML. CSP without 'unsafe-inline' in script-src
   is primary defense; escapeHtml() is defense-in-depth.
   When adding new innerHTML sites, always escape dynamic fields.
   ────────────────────────────────────────────────────────── */
```

POR QUÊ defesa-em-profundidade (CSP + escape):
- CSP é browser-enforced: dev mode, browser bug, ou extensão pode relaxar. Escape é code-enforced: roda em qualquer ambiente.
- Custo de adicionar `escapeHtml(...)` em campo já-string é ~50ns por call. Negligible.
- Discord, Slack, GitHub usam mesma combinação. Industry-standard.

POR QUÊ NÃO refatorar para textContent + createElement:
- 7 sites de innerHTML, cada um é template literal complexo com class/data-attrs/aninhamento. Refactor para `createElement+appendChild` é ~300 LOC de novo código com risco de regressão visual (animações `enter`, dataset attributes, aria roles). Trade-off ruim para Phase 82.
- Alternativa correta para scale: framework reactive (Lit, Preact). Out-of-scope para v1.14.
  </action>
  <verify>
    <automated>cd D:/projetos/opensource/mcp && node -e "const html=require('node:fs').readFileSync('src/ui/static/index.html','utf8');const m=html.match(/<script>([\s\S]*?)<\/script>/);if(!m){console.error('no script');process.exit(1);}const js=m[1];const re=/innerHTML\s*=\s*\`([^\`]*)\`/g;const bad=[];let mm;while((mm=re.exec(js))){if(mm[1].includes('\${')&&!mm[1].includes('escapeHtml('))bad.push(mm[1].slice(0,80));}if(bad.length){console.error('FAIL:');bad.forEach(b=>console.error(' ',b));process.exit(1);}console.log('OK escapeHtml coverage');"</automated>
  </verify>
  <done>
- Função `escapeHtml(s)` existe (foi criada se ausente, ou validada se existente).
- Todas as funções `historyRowHtml`, `activeCardHtml`, `rowHtml` (que produzem strings injetadas via innerHTML) escapam todo campo derivado de evento.
- Sanity check inline (grep) retorna OK.
- Comentário de header no `<script>` block atualizado para mencionar SEC-14-01.
  </done>
</task>

</tasks>

<verification>
Após Tasks 1-6 todas concluídas, rodar suite completa:

```bash
cd D:/projetos/opensource/mcp
node --test test/integration/ui-server.test.js test/integration/ui-hardening.test.js test/integration/ui-static.test.js test/integration/ui-client.test.js test/integration/ui-auto-spawn.test.js 2>&1 | tail -30
```

Esperado:
- `# pass: 210+` (baseline 210 + 8 novos SEC-14 = ~218)
- `# fail: 0`
- `# skip: 1` (OPS-04 aguardando Plan 02)

Adicional manual smoke (opcional):
```bash
node bin/ui.js --project-root /tmp/smoke-test --idle-ms 0 &
PID=$!
sleep 1
LOCK=/tmp/kit-mcp-ui-$(echo -n /tmp/smoke-test | sha1sum | head -c 16).lock
TOKEN=$(node -p "JSON.parse(require('fs').readFileSync('$LOCK','utf8')).token")
echo "Token: ${TOKEN:0:8}..."
curl -s -i -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$(jq -r .port < $LOCK)/healthz | head -5
curl -s -i -X POST http://127.0.0.1:$(jq -r .port < $LOCK)/shutdown # SHOULD return 401
curl -s -i -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$(jq -r .port < $LOCK)/shutdown
wait $PID
```

Resultado esperado: `/shutdown` sem token → HTTP 401; com token → HTTP 200 e o processo encerra.
</verification>

<success_criteria>
**SEC-14-01 (CSP/XSS):**
- [x] `grep -E "script-src[^;]*unsafe-inline" src/ui/server.js` retorna 0 matches.
- [x] CSP header servido em GET / contém `'sha256-<hash>='` em script-src.
- [x] Função `buildCsp(scriptHash)` exportada de `__test`.
- [x] index.html tem exatamente 1 `<script>` block (invariância testada).
- [x] Todo innerHTML com interpolação chama `escapeHtml`.

**SEC-14-02 (auth token):**
- [x] Lockfile JSON contém campo `token` com 64 caracteres hex.
- [x] POST /shutdown sem `Authorization`/`?t=` → 401.
- [x] POST /publish sem token → 401.
- [x] GET /events sem token → 401; GET /events?t=valid → 200; ?t=invalid → 401.
- [x] GET /state sem token → 401.
- [x] GET /healthz continua aberto (handshake auto-spawn).
- [x] `timingSafeEqual` unit-tested.

**Regressão zero:**
- [x] Suite atual passa (210 baseline) + 9+ novos = ~219 tests passando.
- [x] OPS-04 marcado `test.skip` aguardando Plan 02.
- [x] `node -c src/ui/server.js && node -c src/ui/lockfile.js` parseiam.
</success_criteria>

<output>
After completion, create `.planning/phases/82-web-surface-hardening/82-01-SUMMARY.md` listing:
- Files modified with line ranges
- Verification commands actually run + outputs
- Tests added (count + names)
- Note: "OPS-04 test skipped — depends on Plan 02 (auto-spawn-token-propagation) updating src/ui/client.js publish() to read lock.token"
- Decisions taken (e.g. "kept innerHTML+escapeHtml instead of refactor to textContent — defense-in-depth")
- Followups for Plan 02 (token propagation)
</output>
</content>
</invoke>