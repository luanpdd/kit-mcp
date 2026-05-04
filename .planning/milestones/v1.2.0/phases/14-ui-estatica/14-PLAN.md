# Phase 14: UI estática single-file — PLAN

**Tipo:** Frontend (HTML+CSS+JS inline, sem build step)
**REQs cobertos:** UI-01..11, SEC-03 (12 REQs)
**Dependências:** Phase 13 (servidor já serve em GET /)

## Componente

### `src/ui/static/index.html` (~470 LOC)

Single-file HTML com CSS+JS inline. Vanilla DOM + EventSource. Zero deps.

Layout (3 zonas):
1. **Header** sticky — título, port info, status conexão (CONNECTING/OPEN/CLOSED com dot animado)
2. **Toolbar** — search input, filter chips (7 tipos), pause/resume btn, autoscroll btn, clear-view btn
3. **Main** — empty state OU lista de eventos (grid 92px/110px/1fr: time/badge/body com `<details>` colapsável)
4. **Banner** shutdown (escondido até receber evento `shutdown` ou conexão CLOSED >5s)
5. **Footer** sticky — counts (events, paused buffered, source)

Design tokens em CSS custom props com dark mode automático via `prefers-color-scheme: dark`.

Lógica:
- `state.events` — buffer rendered (cap RING_DISPLAY_MAX=500)
- `state.pausedBuffer` — eventos capturados durante pause
- `state.typeFilter` Set, `state.search` string — combinado em `shouldShow(evt)`
- `connect()` cria EventSource e registra handler para cada um dos 7 tipos + onmessage fallback
- `hydrateFromState()` busca `/state` ANTES de conectar SSE — mostra ring buffer histórico
- `scheduleClosedBanner()` — banner aparece se conexão fica CLOSED por >5s

Renderização:
- `renderEventRow(evt)` — cria `<li>` com `<div class=ev-time>`, `<span class=ev-badge data-type=...>`, `<details><summary>...<pre>JSON</pre></details>`
- Helpers: `fmtTime`, `eventLabel` (smart fallback do payload), `eventMeta` (current/total ou runId truncado)
- `applyFilter()` esconde `style.display = 'none'` em vez de remover do DOM (preserva ordem)

### `test/integration/ui-static.test.js` (9 tests)

- HTML é o real (não fallback placeholder)
- DOCTYPE + lang
- Required IDs presentes (conn, events, empty, banner, search, filters, buttons)
- All 7 event types declarados em const EVENT_TYPES JS
- Dark mode CSS presente
- new EventSource('/events') + fetch('/state')
- CSP header strict (frame-ancestors none)
- pausedBuffer/flushPaused/aria-pressed lógica presente
- Copy PT-BR ("Sidecar encerrou", "Recarregue")

## Critérios de sucesso (observáveis)

1. `npm run test:integration` → 34/34 tests pass (9 cli + 16 server + 9 static)
2. `node bin/ui.js` em uma janela; abrir browser em http://127.0.0.1:<porta>/ → vê UI completa (não placeholder)
3. UI alterna dark/light automaticamente conforme tema do OS
4. UI conecta automaticamente; `kit ui` em outra IDE publica eventos → aparecem na lista
5. Shutdown banner aparece quando conexão cai >5s ou recebe evento shutdown
6. Audit gate stdout continua passando (HTML está em src/ui/static/, mas não tem console.log JS)

## Riscos mitigados

- `<details>`/`<summary>` é HTML nativo — sem polyfill
- `EventSource` reconnect é nativo do browser
- Pausa não perde eventos: pausedBuffer cumula, flush ao resume
- Filter não destrói eventos do estado — só esconde via display:none

## Riscos remanescentes

- Em browsers muito antigos (IE 11) sem `EventSource` — não é alvo de suporte (Stable API doc diz Node 20+, browsers modernos)
- `color-mix` CSS é Chromium 111+/Firefox 113+ — fallback gracioso (cor base sem mix)
