# Phase 82: Web Surface Hardening - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Fechar 2 vulnerabilidades HIGH na surface web do UI sidecar identificadas pela auditoria de segurança da v1.13 (e adiadas explicitamente em `v1.13-MILESTONE-AUDIT.md`):

**SEC-14-01 — CSP `'unsafe-inline'` + XSS via SSE:**
- `src/ui/server.js:45-51` define CSP com `script-src 'self' 'unsafe-inline'`.
- `formatSseMessage` (linha 90) re-serializa `validateEvent`-passed payloads sem escape no index.html.
- Hooks publishers (ex: `sidecar-tool-publisher.js:130`) podem incluir `argsSummary.command` com HTML/JS arbitrário.
- Combo: prompt-injected LLM faz Bash com `<img src=x onerror=fetch('/shutdown',{method:'POST'})>` → UI renderiza HTML, executa JS, hits localhost endpoints.

**SEC-14-02 — `/shutdown` + `/publish` sem auth (CSRF same-origin):**
- `src/ui/server.js:341-350` POST `/shutdown` só checa Origin header.
- POST `/publish` mesmo gap.
- Coworker em máquina compartilhada faz `curl -X POST -H 'Origin: http://127.0.0.1:7100' http://127.0.0.1:7100/shutdown` → derruba sidecar do victim mid-task.
- Mesmo cenário para forging events em `/publish`.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado por configuração (`workflow.skip_discuss=true`).

### Restrições absolutas
- Stable API v1.0+ preservada — endpoints e contratos do sidecar continuam funcionando para clientes legítimos.
- Auth token DEVE ser gerado automaticamente e injetado transparentemente no fluxo `auto-spawn → openBrowser` (ver `src/ui/auto-spawn.js`, `src/ui/browser.js`) — usuário NÃO interage com token manualmente.
- Browser-side: token vai via query param `?t=<token>` na URL inicial, store em memory, anexar como `Authorization: Bearer` em todo fetch para `/publish` e `/shutdown`. (Note: GET `/events` SSE pode usar query param já que EventSource não permite custom headers em browsers.)
- Zero regressão em testes existentes (210 baseline pós-v1.13).
- Budget 6/6 deps mantido.

### Diretrizes de implementação

**SEC-14-01 (CSP/XSS):**
- Remover `'unsafe-inline'` do `script-src` no CSP header.
- Extrair JS embutido no index.html (provavelmente uma função `connectSSE()` e handlers DOM) para arquivo estático novo `src/ui/static/client.js` (servido pelo próprio sidecar como GET endpoint adicional, ou inline NO BUILD via fs.readFileSync no boot).
- Em todo lugar que renderiza payload SSE no DOM: usar `textContent` em vez de `innerHTML`. Se já usa template literal com interpolação, trocar por DOM API explícita.
- Adicionar regression test: payload com `<script>alert(1)</script>` é renderizado como texto literal (verificar via puppeteer NOT REQUIRED — basta unit test do escape function + integration test que faz GET /events e parse manualmente).

**SEC-14-02 (auth token):**
- Em `src/ui/lockfile.js`: ao escrever lockfile, gerar `token: crypto.randomBytes(32).toString('hex')` (64 char hex).
- Em `src/ui/server.js`: `requireAuth` middleware que checa `Authorization: Bearer <token>` ou `?t=<token>` query param contra token do lockfile do próprio processo.
- Aplicar middleware em POST `/publish` E POST `/shutdown`. NÃO aplicar em GET `/events` (precisa funcionar com EventSource standard) — em vez disso, EventSource recebe `?t=<token>` na URL e validar via query param.
- Browser handshake: `auto-spawn.js` lê o lockfile pós-spawn, anexa token como `?t=...` no URL passado para `openBrowser` (`src/ui/browser.js`). Browser stores em sessionStorage ou variável global ao parsear `window.location.search`.
- Backward compat: se `Authorization` header missing E `?t=` query param missing E origin é `http://127.0.0.1:<own-port>` → ainda recusar (sem fallback de "trust origin"). O HIGH bug é confiar só em Origin.

</decisions>

<code_context>
## Insights do Código Existente

Da auditoria de architecture.md:
- `src/ui/server.js` (455 LOC) é SPOF do UI surface; expõe SSE em /events, POST em /publish e /shutdown.
- `src/ui/lockfile.js` cria lockfile em `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)[:16]>.lock`. Atualmente tem port + pid + startedAt.
- `src/ui/auto-spawn.js` spawn de bin/ui.js + lê lockfile + abre browser.
- `src/ui/browser.js` chama `open()` (lazy import) com URL incluindo lockfile.port.
- Auditoria H1 menciona que `auto-spawn.js:81` passa raw projectRoot — possível attack surface paralelo a esta fase, mas escopo da Phase 83.

</code_context>

<specifics>
## Ideias Específicas

- Token deve sobreviver entre restarts do sidecar mas ser único por instância. Re-gerar em cada `kit ui start`.
- Considerar TTL? Não — token é per-process, expira quando processo morre.
- Logging: NÃO logar token completo. Se logar para debug, logar primeiros 6 chars + `...`.
- Documentar em comentário inline em `lockfile.js` que `token` é segredo de processo (não escrever em logs, screenshots, telemetria).

</specifics>

<deferred>
## Ideias Adiadas

- Rate limiting em /publish (separado do auth — relevante para DoS, mas não scope desta fase).
- Replay protection (nonce) em /shutdown — overkill para localhost-only; auth token suficiente.
- Audit logging de tentativas falhas — pode ir para v1.15 com SLO/observability.

</deferred>
