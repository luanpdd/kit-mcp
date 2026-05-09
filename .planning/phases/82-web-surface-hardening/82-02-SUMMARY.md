---
phase: 82-web-surface-hardening
plan: 02
subsystem: security
tags: [auth, token, csrf, sse, http, sidecar, browser-handshake, hooks]

requires:
  - phase: 82-01-ui-server-hardening
    provides: lockfile token field + requireAuth middleware on /publish/shutdown/events/state

provides:
  - "Transparent token handshake auto-spawn → openBrowser via ?t=<token>"
  - "Browser-side address-bar scrub via history.replaceState (no leak via screenshare)"
  - "authedFetch + authedEventSourceUrl helpers in index.html for protected endpoints"
  - "src/ui/client.js publish() reads lock.token + Authorization Bearer (with cache invalidation on 401)"
  - "kit/hooks/sidecar-tool-publisher.js Authorization Bearer (hook-version 1.14.0)"
  - "3 reactivated tests + 3 new SEC-14-02 prop regression tests (E2E token propagation)"

affects: [v1.14 milestone, IDE hooks ship, /publicar release pipeline]

tech-stack:
  added: []
  patterns:
    - "URL ?t=<token> handshake auto-spawn → browser, scrubbed via history.replaceState before any UI render"
    - "authedFetch wrapper centralizes Authorization injection (defense-in-depth — only one site to audit)"
    - "Token-aware cache: { port, token } cached together; 401 invalidates both"
    - "Hook backward-compat: token=null → no header → server 401 → silent-fail (preserves shipped-hook stability)"

key-files:
  created: []
  modified:
    - src/ui/auto-spawn.js (ensureSidecar appends ?t=lock.token to openBrowser URL)
    - src/ui/static/index.html (__sidecarToken extract+scrub + authedFetch + authedEventSourceUrl + use at /state and /events sites)
    - src/ui/client.js (resolvePort → resolveSidecar; portCache → sidecarCache; publish() Authorization Bearer; 401 cache eviction)
    - kit/hooks/sidecar-tool-publisher.js (readSidecarPort → readSidecarLock; publish takes (port, token, event); hook-version 1.14.0)
    - test/integration/ui-static.test.js (assertions track authed wiring)
    - test/integration/ui-hardening.test.js (OPS-04 unskipped + 3 new SEC-14-02 prop tests)
    - test/integration/ui-client.test.js (2 publish tests unskipped)

key-decisions:
  - "Token via ?t= query param (not #fragment) — server sees it on first request, future-proof for GET / auth"
  - "encodeURIComponent on token even though [0-9a-f] is RFC-3986-safe — defense-in-depth against future encoding changes"
  - "history.replaceState scrub instead of sessionStorage — closure variable lost on reload forces re-handshake (correct UX)"
  - "Cache invalidate on 401 (not just 403/404) — sidecar restart token rotation recovers in 1 publish, not after 5s TTL"
  - "Hook backward-compat: missing token → no Authorization header → silent 401 fail — preserves discipline of shipped IDE hooks"
  - "hook-version bumped 1.6.1 → 1.14.0 — tracks milestone semantics, signals contract change to user installations"

patterns-established:
  - "All client-side fetch to protected endpoints goes through authedFetch (single audit point)"
  - "All EventSource construction goes through authedEventSourceUrl (single ?t= injection point)"
  - "publish/sidecar discovery returns { port, token } as a single record (no double lockfile read)"

requirements-completed: [SEC-14-02]

duration: 6min
completed: 2026-05-09
---

# Phase 82 Plan 02: Token Propagation Summary

**Transparent auth-token handshake from sidecar to browser via `?t=<token>` URL handshake (then scrubbed via history.replaceState), plus Authorization Bearer in both in-process publisher (`src/ui/client.js`) and out-of-process hook (`kit/hooks/sidecar-tool-publisher.js` v1.14.0), closing SEC-14-02 end-to-end with zero user-visible token interaction.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-09T10:20:10Z
- **Completed:** 2026-05-09T10:25:43Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- **SEC-14-02 closed end-to-end.** Plan 01 trancou os endpoints; este Plan completa o handshake transparente:
  - **Auto-spawn → browser:** `ensureSidecar` lê `lock.token` pós-spawn e passa `http://127.0.0.1:<port>/?t=<token>` para `openBrowser`.
  - **Browser-side:** `<script>` em `index.html` extrai `?t=` no boot, valida formato (64 hex), captura em closure (`__sidecarToken`), e remove o param da URL via `history.replaceState` ANTES de qualquer render. Helpers `authedFetch` (Bearer header) e `authedEventSourceUrl` (`?t=` para EventSource que não permite headers) cobrem todos os endpoints protegidos.
  - **In-process publisher:** `src/ui/client.js publish()` agora lê `lock.token` e anexa `Authorization: Bearer`; cache evolved from port-only to `{ port, token }`; cache evicta em 401 (sidecar restart → token rotation → recovery em 1 chamada, não em 5s TTL).
  - **Out-of-process hook:** `kit/hooks/sidecar-tool-publisher.js` (shipped para IDEs) anexa Authorization mesmo padrão; hook-version bumpado 1.6.1 → 1.14.0.
- **3 testes reativados** (Plan 01 deixou skip-marcados aguardando este Plan): OPS-04 (concurrent publishers), `publish: succeeds`, `publish: events arrive in /state`.
- **3 testes novos SEC-14-02 prop** provam token propagation E2E: happy path Bearer attach, graceful degradation com lockfile sem token, recovery via cache invalidation em 401.
- **Backward compat preservado:** lockfile sem token (sidecar v1.13 ainda em execução) → publish degrada graciosamente para `http_401` em vez de crashar; hook silent-fails como sempre.
- **Race condition fix v1.12.1 preservado:** await em `'end'` E `'close'` no hook mantido verbatim na nova assinatura `publish(port, token, event)`.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Task 1: auto-spawn.js + index.html token wiring** — `368cf3d` (feat)
2. **Task 2: client.js publish() Bearer** — `d476631` (feat)
3. **Task 3: hook sidecar-tool-publisher Bearer + v1.14.0** — `11a9b9a` (feat)
4. **Task 4: unskip 3 tests + add 3 prop regression tests** — `ad4b8fb` (test)

## Arquivos Criados/Modificados

- `src/ui/auto-spawn.js` — `ensureSidecar` constrói `tokenSuffix = lock.token ? `?t=${encodeURIComponent(lock.token)}` : ''` antes de chamar `openBrowser`. Falls back para URL bare se token absent.
- `src/ui/static/index.html` — bloco SEC-14-02 no início do `<script>`: IIFE para `__sidecarToken` extract+validate+scrub, helpers `authedFetch` e `authedEventSourceUrl`. Sites `/state` e `/events` migrados para wrappers (`/healthz` continua raw — endpoint aberto). Single-script invariant (CSP hash) preservado.
- `src/ui/client.js` — `portCache` → `sidecarCache` (cache value `{ port, token }`); `resolvePort` → `resolveSidecar`; `publish()` ataca Authorization Bearer condicionalmente. 401 invalida o cache junto com 403/404. `clearPortCache` continua exportada (alias para limpar `sidecarCache` — backward compat).
- `kit/hooks/sidecar-tool-publisher.js` — `readSidecarPort` → `readSidecarLock` (retorna `{ port, token }`); `scanAnyRunningSidecar` retorna `{ port, token }`; `publish(port, token, event)` ataca Bearer. `hook-version: 1.6.1 → 1.14.0`.
- `test/integration/ui-static.test.js` — assertion atualizada: `new EventSource("/events")` → `new EventSource(authedEventSourceUrl("/events"))`; `fetch("/state"` → `authedFetch("/state"`. (Regra 3 — bloqueador, ver Desvios.)
- `test/integration/ui-hardening.test.js` — OPS-04 unskipped + 3 testes novos `SEC-14-02 prop:`. Imports já presentes (`fs`, `lockPathFor`, `releaseLock`, `readLock`, `publish`, `clearPortCache`).
- `test/integration/ui-client.test.js` — 2 testes `publish:` unskipped.

## Decisões Tomadas

- **`?t=` query param em vez de `#fragment`:** server sees the token on the very first request, future-proof for GET / auth. Hash is client-only and would break server-side auth introduction down the road. Trade-off: token vai pro history do browser local — aceitável para localhost-only sidecar com TTL = process lifetime, e mitigado pelo scrub imediato via `history.replaceState`.
- **`encodeURIComponent` no token mesmo com `[0-9a-f]`:** RFC 3986 unreserved chars passam intactos, então custo é zero. Defesa em profundidade se um dia mudarmos para base64-url ou outro encoding.
- **Closure variable `__sidecarToken` em vez de `sessionStorage`:** sessionStorage persistiria entre reloads NA MESMA TAB; se sidecar reiniciar (token rotation), browser teria token velho → 401 forever. Closure perde no reload → URL fresh sem `?t=` → próxima visita do auto-spawn re-injetra. Comportamento correto.
- **401 invalidates cache (não só 403/404):** sidecar restart gera novo token; sem invalidação, publish ficaria em loop de 401 até o TTL de 5s expirar. Adicionar 401 na lista cobre o caso comum sem ampliar surface de ataque (não é uma janela de bypass — só uma optimização de recovery).
- **Hook backward-compat: token=null → silent 401 fail:** hook é shipped para IDEs e instala em `$HOME` do usuário. Pode rodar contra sidecar v1.13 ainda em execução (usuário com 2 projetos em versões diferentes). Crashar seria pior que perder eventos silenciosamente — preserva o pattern original de fire-and-forget.
- **`hook-version: 1.6.1 → 1.14.0`:** track milestone semantics (não package version per se). v1.14 adiciona auth contract; bump signal claro para usuários que reinstalarem o hook.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 3 - Bloqueador] Asserções em `ui-static.test.js` checavam literais antigos**
- **Encontrado durante:** Task 1 (após editar index.html)
- **Problema:** Após substituir `fetch("/state")` por `authedFetch("/state")` e `new EventSource("/events")` por `new EventSource(authedEventSourceUrl("/events"))`, dois testes em `test/integration/ui-static.test.js` passariam a falhar:
  - linha 236: `assert.match(r.body, /new EventSource\("\/events"\)/)` (não bate com o wrapper)
  - linha 249: `assert.match(r.body, /fetch\("\/state"/)` (não bate com `authedFetch`)
- **Correção:** atualizei as duas asserções para refletir a nova wiring auth-aware:
  - `new EventSource\(authedEventSourceUrl\("\/events"\)\)`
  - `authedFetch\("\/state"`
  - Adicionados comentários `// SEC-14-02:` documentando o motivo da mudança.
  Os testes continuam validando o mesmo intent (production boot conecta a /events; hidrata de /state).
- **Arquivos modificados:** `test/integration/ui-static.test.js`
- **Verificação:** `node --test test/integration/ui-static.test.js` → 14/14 verde.
- **Comitado em:** `368cf3d` (junto com o commit de Task 1)

---

**Total de desvios:** 1 corrigido automaticamente (1 × Regra 3 — bloqueador técnico)

**Impacto no plano:** o desvio foi puramente de propagação de teste — assertions checavam literais que mudaram nesta task. Sem expansão de escopo, sem mudança arquitetural. Regra 4 não acionada.

**Nota sobre o plano original:** o Plan listou "Parte C — Atualizar `test/integration/ui-auto-spawn.test.js`" condicional ao grep. Após inspeção, o arquivo só usa `readLock` e o handler de spawn — não bate em `/state` ou `/events` direto. Nenhuma mudança neste arquivo (como o plano antecipou).

## Problemas Encontrados

- **Index.html grande/binário:** o arquivo tem ~74KB com algum byte binário. `Edit` tool e `Read` funcionaram normalmente; `Grep` continua adequado para searches por padrão simples; usei `node -e fs.readFileSync` para inspecionar offsets específicos de `<script>` e referências a fetch/EventSource.

## Configuração Manual Necessária

Nenhuma — token gerado automaticamente pelo `acquireLock` (Plan 01); este Plan apenas propaga a infra existente. Hook bumpado para 1.14.0 propagará para usuários no próximo `/publicar` (eles reinstalarão o hook ao executar `kit sync claude-code`).

## Prontidão para Próxima Fase

**Phase 82 (Web Surface Hardening) está completa.** Ambos os planos (01 + 02) entregam SEC-14-01 e SEC-14-02 fechadas com proof tests passando.

**Próxima:**
- Phase 83 — Core Filesystem Hardening (reverse-sync projectRoot validation + gate-runner tmpdir mkdtemp + file-manifest verification).
- Phase 84 — MCP Error Sanitization (error envelope scrubbing + reflect.js leak prevention).

**Sem bloqueios.** Suite verde: 139 unit + 83 integration = 222 tests, 0 fail, 2 baseline skipped (DRIFT-13-01 awk on Windows).

**Followups potenciais para v1.15** (não bloqueadores):
- Smoke E2E test com Puppeteer cobrindo o fluxo completo `kit ui start` → browser carrega → fetch hidrata → EventSource live (validation que `?t=` realmente faz round-trip).
- CI gate `agent-no-raw-fetch` que falha se `index.html` voltar a ter `fetch("/state"|"/publish"|"/shutdown"|"/events")` direto sem o wrapper.

## Self-Check: PASSED

- Files modified verified to exist via filesystem listing.
- Commits exist in `git log`:
  - `368cf3d` (Task 1)
  - `d476631` (Task 2)
  - `11a9b9a` (Task 3)
  - `ad4b8fb` (Task 4)
- Test suite green: **139 unit + 83 integration = 222 tests passing**, 0 fail, 2 baseline skipped (was 80 integration with 3 skipped before; now 83 with 0 skipped — net +6 active integration tests).
- Verification grep on index.html: `__sidecarToken` ✓, `authedFetch` ✓, `authedEventSourceUrl` ✓, no raw `fetch("/state")`, no raw `new EventSource("/events")`. Single `<script>` block invariant preserved.
- Hook: `Bearer` count = 1 (single attachment site), `hook-version: 1.14.0`.
- Race condition fix v1.12.1 preserved in `kit/hooks/sidecar-tool-publisher.js` (await both `'end'` and `'close'`).

---
*Phase: 82-web-surface-hardening*
*Concluída: 2026-05-09*
