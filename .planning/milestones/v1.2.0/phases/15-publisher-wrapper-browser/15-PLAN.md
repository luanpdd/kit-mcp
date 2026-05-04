# Phase 15: Cliente publisher + wrapper + browser-open — PLAN

**Tipo:** Glue modules + nova dep
**REQs cobertos:** PUB-01..04, SEC-05 (5 REQs)
**Dependências:** Phase 12 (events, lockfile), Phase 13 (server endpoints)
**Nova dep:** `open@11.0.0` (única dep nova do milestone)

## Componentes

### `src/ui/client.js` — fire-and-forget publisher

`publish(event, {projectRoot, timeoutMs}) → {sent, reason?, status?}`

- Resolve port via `readLock(projectRoot)`, com cache TTL 5s pra evitar disk reads em loops
- POST `/publish` com headers Origin + Host corretos (passa SEC-01/02)
- Falha silenciosamente em ECONNREFUSED, ECONNRESET, timeout — invalida cache na falha
- Validação local via `validateEvent` antes de enviar (economia de roundtrip)
- `publishMany` helper sequencial pra preservar ordem

### `src/ui/wrapper.js` — wrapper de progress + redactPath

`redactPath(value, projectRoot) → value scrubada`
- Substitui `$HOME → ~` e `projectRoot → <project>` em strings
- Walks objects e arrays recursivamente
- Não-strings (number, bool, null, undefined) pass-through
- Escape de regex special chars em projectRoot

`wrapProgressForUi(originalCb, ctx) → wrappedCb`
- ctx: `{projectRoot, runId?, tool?}`
- Retorna função compatível com onProgress signature original
- Multiplexa: chama originalCb (terminal) + emite progress event no sidecar
- Helpers attached: `.runId`, `.emit(type, payload)`, `.done(payload)`, `.error(err)`
- Emite `run.start` automaticamente na criação
- Nunca throws — falhas no originalCb ou no publish são swallowed

### `src/ui/browser.js` — open wrapper

`detectHeadless(env, plat) → string|null`
- CI=true → 'CI=true'
- KIT_MCP_NO_OPEN=1 → 'KIT_MCP_NO_OPEN'
- TERM=dumb → 'TERM=dumb'
- linux sem DISPLAY/WAYLAND_DISPLAY → 'no_display'
- WSL — let `open` try (wslview cobre)
- SSH sem display em non-Windows → 'ssh_no_display'

`openBrowser(url, {force}) → {opened, reason?, via?}`
- Sempre print URL no stderr
- Headless detect → não tenta abrir, retorna `headless:<why>`
- Lazy import de `open` package — se ausente, retorna 'no_module'
- Erro de spawn → 'launch_failed:<msg>', URL ainda foi printada

### Tests novos

`test/unit/ui-wrapper.test.js` (11 tests):
- redactPath: HOME, projectRoot, walks objects, non-strings, regex special chars
- wrapProgressForUi: requires projectRoot, returns function with helpers, calls original, never throws, null/undefined original

`test/unit/ui-browser.test.js` (10 tests):
- detectHeadless: CI, KIT_MCP_NO_OPEN, TERM=dumb, linux no display, linux+DISPLAY, linux+WAYLAND, WSL, SSH, macOS, Windows

`test/integration/ui-client.test.js` (6 tests):
- publish succeeds when sidecar up
- no_sidecar when no lockfile
- no_project_root when missing
- invalid event rejected without sending
- ECONNREFUSED handled (stale lockfile pointing nowhere)
- events arrive in /state

## Critérios de sucesso (observáveis)

1. `npm run test:all` → 137/137 tests pass (76 unit + 27 new = 103 unit; 34+6 = 40 integ; total 137 considerando alguns sobreposições)
2. Audit gate stdout continua passando
3. Audit gate dep budget: 6/6 (open@11 adicionado, dentro do budget)
4. Stable API: nenhuma alteração em src/core/, src/cli/, src/mcp-server/
5. `node -e "import('./src/ui/wrapper.js').then(m => process.stderr.write(typeof m.wrapProgressForUi+'\n'))"` → "function"
6. publishe quando sidecar não está rodando NÃO trava o caller (timeout default 1.5s; no_sidecar imediato em cache miss)

## Riscos mitigados

- **Path leak (Pitfall 6):** redactPath aplicado uniformemente em wrapper.js — todo payload passa por aqui
- **Stale lockfile crash:** publish detecta ECONNREFUSED, invalida cache, retorna {sent: false} sem propagar
- **Headless CI launching browser:** detectHeadless cobre 5 sinais distintos (CI, KIT_MCP_NO_OPEN, TERM=dumb, no DISPLAY, SSH)
- **Stable API drift:** wrapper só importado por callsites (CLI/MCP), nunca por core. Phase 16/17 vão consumir.
