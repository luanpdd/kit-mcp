# Pesquisa de Funcionalidades

**Domínio:** GUI sidecar (live process viewer) para CLI/MCP server local — janela web localhost via SSE acompanhando execução do kit-mcp dentro de IDEs (Claude Code, Cursor, etc).
**Pesquisado:** 2026-05-04
**Confiança:** HIGH (cases de referência observáveis e código upstream já foi lido — `sync.js`, `reverse-sync.js`, `cli/index.js`, `PROJECT.md` v1.2)

## Cases de referência analisados

Resumo curto de cada um, com o que faz sentido herdar e o que descartar.

| Case | O que mostra ao vivo | Lições aplicáveis ao kit-mcp | O que NÃO copiar |
|---|---|---|---|
| **Vite dev server overlay** (HMR) | Erros de compile com stack + clique-pra-abrir-arquivo, injeta sobre o app | Linkar `file://` para abrir editor; mostrar contexto de código no detail expand | É overlay sobre um app web do usuário — kit-mcp é janela separada, não overlay |
| **Webpack dev server / webpack-dashboard** | Tabela de progresso de build, módulos compilados, errors/warnings | Layout single-pane com seções (progresso atual + log); chrome mínimo | Charts/sparklines (overkill para nosso volume de eventos) |
| **Vercel CLI (`vercel logs --follow` + `vercel open`)** | Stream de logs de deploy linear cronológico; CLI abre dashboard remoto no browser | Padrão `vercel open` = `kit ui` (CLI dispara browser apontando p/ URL local) | Dashboard remoto autenticado — nosso é localhost-only, sem auth |
| **MCP Inspector (Anthropic oficial)** | Tool discovery, invocações com params, respostas, color-coded por tipo de mensagem; transports stdio/SSE | Color-coding por tipo de evento; **filter por tool**; mostrar args resumidos da invocação | UI complexa com painéis (resources/prompts/tools tabs) — kit-mcp não precisa de tabs separadas |
| **mcp-dashboard (triepod-ai / bryankthompson)** | Multi-server management, real-time SSE updates, server cards, tool execution, resource explorer | Confirma que SSE é o transporte certo pro caso; padrão "server card" pode virar header simples | Multi-server: kit-mcp é single-instance por dir |
| **k9s (Kubernetes TUI)** | Lista contínua com filtros `/` e teclas hotkey; auto-refresh; detail view com `<enter>` | Filter por digitação (single hotkey); sticky header; detail expand inline | Tema TUI — nosso é browser, mas a ergonomia keyboard-first vale |
| **Docker Desktop activity log** | Timeline cronológica direta (mais novo embaixo) com auto-scroll, badges de status | Auto-scroll com toggle pause; badges coloridos por status | Painéis de stats (CPU/mem) — fora de escopo |
| **Claude Code task viewer / Cursor agent panel** | Lista de subagents executando, com expand/collapse de cada step, status pill | Hierarquia de eventos com expand; status pill (running/done/failed) | Embutido na IDE — nosso é janela separada, fora do contexto da IDE |
| **Reconnecting-EventSource pattern** (web) | Native `EventSource` auto-reconciliando + libs como `reconnecting-eventsource` para backoff exponencial | Native EventSource já reconecta sozinho; expor `readyState` (CONNECTING/OPEN/CLOSED) na UI | Polling fallback (SSE basta para localhost) |

## Panorama de Funcionalidades

### Requisitos Básicos (Usuários Esperam Estes)

Funcionalidades que um "live process viewer de localhost" precisa ter para parecer completo. Faltar = parece protótipo.

| Funcionalidade | Por Que É Esperada | Complexidade | Notas |
|---|---|---|---|
| Servidor HTTP localhost embutido (`/` HTML + `/events` SSE) | Sem isso não há sidecar | LOW | Node `http` puro, zero deps; `text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive` |
| Página HTML estática single-file (sem build) | Princípio de produto: zero build step | LOW | HTML+CSS+JS inline ou servido como assets estáticos do diretório `src/sidecar/static/` |
| Stream SSE de eventos com `EventSource` no cliente | Padrão para live data sem deps | LOW | Auto-reconnect é nativo do browser (já testado em todos os engines modernos) |
| Lista cronológica de eventos com auto-scroll | k9s/Docker Desktop fazem assim; vira "feed" mental | LOW | Cronológica direta (mais novo embaixo) com auto-scroll opcional toggle |
| Estado vazio "aguardando primeiro evento" | UX básica — UI sem dados parece quebrada | LOW | Texto centralizado + dot animado; some quando primeiro evento chega |
| Indicador de status de conexão (CONNECTING/OPEN/CLOSED) | Usuário precisa saber se feed parou | LOW | Badge no header que reflete `eventSource.readyState`; reusa nativo |
| Reconnect automático quando SSE cai | Native do `EventSource`; não ter parece bug | LOW | Sem código adicional — apenas garantir que o servidor envia comentário keep-alive `:\n\n` cada 15s |
| Badges/cores por tipo de evento | MCP Inspector estabeleceu o padrão; usuário scaneia visualmente | LOW | 5-6 cores: tool_invocation (azul), progress (cinza), file_write (verde), gate_pass (verde), gate_fail (vermelho), error (vermelho fundo) |
| Detect porta livre + lockfile em `.kit-mcp/sidecar.lock` | Múltiplos `kit ui` simultâneos não podem colidir | MEDIUM | Tenta `:7873`, incrementa até livre; lockfile guarda `{port, pid, startedAt}`; lockfile stale → reaproveita |
| Cross-platform browser open (`open`/`xdg-open`/`start`) | PROJECT.md já requer | LOW | Função `openInBrowser(url)` switch por `process.platform` |
| Encerramento gracioso (Ctrl+C, SIGTERM) | CLI tradicional precisa | LOW | Fecha respostas SSE ativas, remove lockfile, exit 0 |
| `kit ui start` / `kit ui stop` / `kit ui status` | Cobertura de comando completa, espelha `watch` | LOW | start = abre browser; stop = mata pelo lockfile; status = lê lockfile + ping HTTP |
| `kit ui` sem subcomando = atalho para `start` | Ergonomia | LOW | Default action quando só `kit ui` |

### Diferenciais (Vantagem Competitiva)

| Funcionalidade | Proposta de Valor | Complexidade | Notas |
|---|---|---|---|
| **Hook nos `onProgress` existentes** sem mudar assinatura | Zero refactor downstream; adoção transparente em `sync.js` e `reverse-sync.js` | LOW | Wrapper `tap(onProgress, emit)` — quem passa `onProgress` ganha sidecar de graça |
| **Filtro por tool e por nível** (search input) | Volume de eventos cresce em sync/reverse-sync; filtro = produtividade | MEDIUM | Input no header, regex simples client-side; presets clicáveis ("apenas erros", "apenas progresso") |
| **Pause/resume do feed** (toggle) | Usuário precisa congelar a tela pra ler | LOW | Botão pausa, mantém buffer in-memory, ao retomar drena; herdado de Docker Desktop |
| **Detail expand de cada evento** (clique abre payload completo) | Args resumidos no header + JSON completo no expand = melhor dos dois mundos | MEDIUM | Cards colapsados por padrão; `<details>` HTML nativo |
| **Flag `--auto-spawn` opt-in nas tools MCP pesadas** | Sidecar abre sozinha quando o usuário invoca sync via Claude Code, sem digitar `kit ui` | MEDIUM | Decisão por tool: sync sim, list-* não; respeitar env `KIT_MCP_NO_SIDECAR` |
| **Sticky / always-on-top hint** no header | Janela ao lado da IDE só funciona se ficar visível | LOW | Não é controle do app (browser não permite), mas mostrar instrução "Use [browser]'s 'Always on top' / 'Pin tab'" + emoji-livre nota |
| **Múltiplos projetos com porta diferente por dir** | Dev real abre 2-3 repos ao mesmo tempo | MEDIUM | Já implícito no detect-de-porta-livre; lockfile fica em `<projectRoot>/.kit-mcp/sidecar.lock`, não global |
| **Emit timeline de milestone events** (sync started → done) | Seções visuais separando "execuções" no log | LOW | Server emite evento `milestone` com label; UI insere divisor visual |
| **Dark mode / light mode automático** (`prefers-color-scheme`) | UX moderna esperada | LOW | CSS media query, sem toggle manual no v1.2 |
| **Copy-to-clipboard de cada evento** | Debug rápido — colar o evento em issue/chat | LOW | Botão por card; usa `navigator.clipboard.writeText` |
| **Keyboard shortcuts** (`/` foca filter, `p` pausa, `c` clear) | Power users de k9s esperam | LOW | Listener global; documenta no header com `?` |

### Anti-Funcionalidades (Comumente Pedidas, Frequentemente Problemáticas)

| Funcionalidade | Por Que É Pedida | Por Que É Problemática | Alternativa |
|---|---|---|---|
| **Autenticação / login** | "Mas e se alguém acessar?" | Localhost-only + bind em `127.0.0.1` já protege; auth = sessão, cookies, complexidade enorme | Bind explícito em `127.0.0.1` (NUNCA `0.0.0.0`); rejeitar Host header diferente de `localhost`/`127.0.0.1` |
| **Acesso remoto / tunnel / share** | "Mostrar pra colega" | Vira honeypot; auth fica obrigatória; expõe filesystem do dev | "Tire screenshot e mande no Slack" (literalmente); ou CLI `--json` |
| **Persistência do log em disco** | "E se eu fechar a janela?" | Disk I/O em hot path do sync, retention policy, log rotation, GDPR de paths privados | Buffer in-memory de N=500 eventos; ao abrir UI tarde, drena buffer; quem precisa de histórico usa `forensics` |
| **Reabrir sessão anterior** (replay no UI) | "Quero ver o que rodou ontem" | Inverte o caso de uso (live → forense) | `kit forensics` já cobre isso; sidecar é estritamente live |
| **Métricas/charts (CPU, mem, latency)** | "Dashboard tem gráfico" | É devops sidecar, não dev sidecar; latency de sync não é interessante | Mostrar duração total em texto no evento `milestone end` |
| **WebSockets bidirecional** (cliente manda comandos pro servidor) | "Pausar sync da UI" | Vira backplane de RPC; conflita com modelo MCP | SSE one-way + UI read-only; comandos só via CLI/MCP |
| **Multi-server aggregation** (várias instâncias kit-mcp na mesma janela) | "Mostrar todos meus projetos" | É o caso do `mcp-dashboard` upstream — fora de escopo do kit-mcp | Cada projeto tem sua porta/janela; usuário abre N abas |
| **Build step (React/Vue/Svelte)** | "UI moderna precisa de framework" | Princípio de produto v1.0+ é zero build; aumenta install size, tempo de boot, surface de deps | HTML+JS vanilla; <300 linhas é factível pro escopo |
| **Persistir preferências do usuário** (filtros, posição) | "Lembrar que estava pausado" | localStorage funciona, mas adiciona estado e edge cases (clear, mismatch) | v1.2: stateless. v1.3+: localStorage opcional |
| **Notificações de desktop** (`Notification.requestPermission()`) | "Avisar quando sync termina" | Permission popup é hostil; usuário já tem a janela aberta ao lado | Toast inline na própria UI |
| **Editar/anotar eventos da UI** | "Marcar esse erro pra debugar" | Vira CRUD; estado mutável; complica reset | Read-only; copy-to-clipboard atende |

## Tipos de evento (esquema proposto)

Schema do evento SSE (`event: <type>\ndata: <json>\n\n`):

```js
{
  ts: 1714838400000,           // epoch ms
  type: 'tool_invocation' | 'progress' | 'file_write' | 'gate_result' | 'error' | 'milestone' | 'log',
  source: 'cli' | 'mcp' | 'sync' | 'reverse-sync',
  tool: 'sync.install' | 'reverse-sync.apply' | ...,  // optional
  payload: {                   // type-specific
    // tool_invocation:  { args: {target, mode, projectRoot}, summary: 'sync to claude-code' }
    // progress:         { current, total, label, percent }
    // file_write:       { path, bytes, kind: 'agent'|'command'|... }
    // gate_result:      { gateId, verdict: 'pass'|'fail'|'manual', reason }
    // error:            { message, stack, code }
    // milestone:        { event: 'sync_started'|'sync_done', durationMs, summary }
    // log:              { level: 'info'|'warn'|'error', message }
  },
  id: 'evt_<nanoid>',          // for client-side dedupe across reconnects
}
```

Mapeamento direto dos `onProgress` existentes:
- `sync.js:95` `onProgress({ phase, current, total, label })` → `type: 'progress'`, `tool: 'sync.install'`
- `reverse-sync.js:188` `onProgress({ phase, current, total, label })` → `type: 'progress'`, `tool: 'reverse-sync.apply'`
- `gate-runner.runGate()` → emit antes (`tool_invocation`), depois (`gate_result`)
- Cada `fs.writeFile`/`fs.copyFile` em `sync.js:91` → opcional `file_write` (se ligado o emitter, não obrigatório p/ v1.2)

## Dependências de Funcionalidades

```
kit ui start (CLI)
    └──requer──> servidor HTTP embutido
                     └──requer──> detect-porta-livre + lockfile
    └──requer──> openInBrowser cross-platform

stream SSE de eventos
    └──requer──> servidor HTTP embutido
    └──requer──> emitter central (in-process EventEmitter)
                     └──requer──> hook nos onProgress callbacks

UI cronológica + estado vazio
    └──requer──> stream SSE de eventos
    └──requer──> EventSource client (nativo do browser)

filter por tool + pause/resume + detail expand
    └──requer──> UI cronológica básica
    └──requer──> evento com schema rico (type + payload + tool)

flag --auto-spawn nas tools MCP pesadas
    └──requer──> kit ui start como módulo importável (não só CLI)
    └──requer──> detect-porta-livre (pra não travar se porta ocupada)
    └──requer──> reaproveitamento de servidor existente (ler lockfile, ping, anexar)

múltiplos projetos simultâneos
    └──requer──> lockfile per-projectRoot (não global)
    └──requer──> detect-porta-livre

milestone events / divisores no log
    └──requer──> emitter central
    └──melhora──> filter (filtra "milestone" pra ver apenas)

keyboard shortcuts ──melhora──> filter, pause/resume

dark mode auto ──independente──> resto

persistência em disco ──CONFLITA──> "buffer in-memory de N=500"
auth ──CONFLITA──> "localhost-only sem auth" (escolha de produto)
WebSocket bidirecional ──CONFLITA──> "UI read-only" (escolha de arquitetura)
```

### Notas de Dependência

- **Emitter central é a peça-chave:** todo evento passa por um único `EventEmitter` in-process; tanto a CLI quanto o MCP server (mesmo runtime Node) emitem nele; servidor HTTP só observa e serializa pra SSE. Isso desacopla "produzir evento" de "ter sidecar ativa".
- **--auto-spawn precisa de reentrance:** se o usuário rodou `kit ui start` antes, e depois Claude Code dispara um sync com `--auto-spawn`, NÃO subir segundo servidor — anexar ao existente (lockfile diz qual porta).
- **Lockfile per-projectRoot habilita multi-projeto:** lockfile global travaria a segunda janela. Posicioná-lo em `<projectRoot>/.kit-mcp/sidecar.lock` resolve naturalmente.
- **Persistência em disco conflita com buffer in-memory:** escolher um. Recomendação: in-memory ring buffer N=500 (cap configurável via env). Quem quer histórico usa `kit forensics`.
- **Filter habilita milestone events:** sem filter, divisor de milestone é útil mas não indispensável; com filter, vira a feature de "ver só essa execução".

## Definição de MVP

### Lançar Com (v1.2)

Mínimo para o sidecar valer a pena instalar.

- [ ] **Servidor HTTP localhost embutido** (`/` HTML + `/events` SSE) com bind em `127.0.0.1`
- [ ] **Detect-porta-livre + lockfile** em `<projectRoot>/.kit-mcp/sidecar.lock`
- [ ] **Página HTML estática single-file** sem build, dark mode auto via `prefers-color-scheme`
- [ ] **Lista cronológica de eventos** com auto-scroll, badges coloridos por tipo
- [ ] **Estado vazio** "aguardando primeiro evento"
- [ ] **Indicador de status de conexão** (CONNECTING/OPEN/CLOSED) no header
- [ ] **Reconnect automático** (nativo + keep-alive `:` a cada 15s no servidor)
- [ ] **Emitter central** + hook nos `onProgress` existentes em `syncTo()` e `applyReverse()`
- [ ] **Tipos de evento essenciais:** `tool_invocation`, `progress`, `error`, `milestone`
- [ ] **CLI `kit ui start | stop | status`** + alias `kit ui` = start
- [ ] **Cross-platform browser open** (`open`/`xdg-open`/`start`)
- [ ] **Encerramento gracioso** (SIGINT/SIGTERM → fecha SSE, remove lockfile)
- [ ] **Flag `--auto-spawn` opt-in** nas tools MCP de sync/reverse-sync com reentrance via lockfile
- [ ] **Filter por tool/nível** (input simples no header)
- [ ] **Pause/resume** do feed
- [ ] **Detail expand** por clique no evento

### Adicionar Após Validação (v1.3)

- [ ] **Tipos de evento expandidos:** `file_write` (por arquivo escrito em sync), `gate_result` (saída de gates), `log` arbitrário
- [ ] **Keyboard shortcuts** (`/` filter, `p` pause, `c` clear, `?` help) — gatilho: usuário pediu
- [ ] **Copy-to-clipboard por evento** — gatilho: feedback de "quero compartilhar isso"
- [ ] **localStorage de preferências** (filtros, pause state) — gatilho: usuários reclamaram de perder estado
- [ ] **Toasts inline** (sync done, error) — gatilho: usuários querem alerta sem olhar a janela

### Consideração Futura (v2+)

- [ ] **Aggregation multi-projeto numa janela** — adiar até confirmar que multi-projeto é caso comum
- [ ] **Replay de execução salva** — adiar até `kit forensics` ficar bom o suficiente para se misturar
- [ ] **Editor de filtros salvos** — adiar até filter virar usado o suficiente pra justificar persistir
- [ ] **Exportar log da sessão** (download .json) — adiar; copy-to-clipboard cobre 90%

## Matriz de Priorização de Funcionalidades

| Funcionalidade | Valor para o Usuário | Custo de Implementação | Prioridade |
|---|---|---|---|
| Servidor HTTP localhost + SSE endpoint | HIGH | LOW | P1 |
| Página HTML estática single-file | HIGH | LOW | P1 |
| Detect-porta + lockfile | HIGH | MEDIUM | P1 |
| Lista cronológica + auto-scroll | HIGH | LOW | P1 |
| Badges coloridos por tipo | HIGH | LOW | P1 |
| Estado vazio | MEDIUM | LOW | P1 |
| Status de conexão (badge readyState) | MEDIUM | LOW | P1 |
| Hook nos `onProgress` existentes | HIGH | LOW | P1 |
| Tipos de evento essenciais (4) | HIGH | LOW | P1 |
| `kit ui start/stop/status` CLI | HIGH | LOW | P1 |
| Cross-platform browser open | HIGH | LOW | P1 |
| Encerramento gracioso | MEDIUM | LOW | P1 |
| `--auto-spawn` flag MCP | HIGH | MEDIUM | P1 |
| Filter por tool/nível | HIGH | MEDIUM | P1 |
| Pause/resume feed | MEDIUM | LOW | P1 |
| Detail expand evento | MEDIUM | MEDIUM | P1 |
| Dark mode auto (CSS media query) | MEDIUM | LOW | P1 |
| Sticky/always-on-top hint texto | LOW | LOW | P2 |
| Tipos de evento expandidos (file_write, gate_result, log) | MEDIUM | LOW | P2 |
| Keyboard shortcuts | MEDIUM | LOW | P2 |
| Copy-to-clipboard por evento | LOW | LOW | P2 |
| Milestone divisores visuais | MEDIUM | LOW | P2 |
| localStorage de preferências | LOW | MEDIUM | P3 |
| Toasts inline | LOW | LOW | P3 |
| Auth / acesso remoto | NEGATIVE | HIGH | ANTI |
| Persistência em disco | LOW | HIGH | ANTI |
| Charts/métricas | LOW | HIGH | ANTI |
| WebSocket bidirecional | LOW | HIGH | ANTI |
| Multi-server aggregation | LOW | HIGH | ANTI |
| Build step / framework UI | NEGATIVE | HIGH | ANTI |

**Chave de prioridade:**
- P1: Obrigatório para v1.2
- P2: Deve ter, adicionar em v1.3
- P3: Seria bom ter, v2+
- ANTI: NÃO fazer (documentado para prevenir scope creep)

## Decisões de lifecycle e ergonomia

| Pergunta | Decisão recomendada | Razão |
|---|---|---|
| Auto-close depois de N segundos sem eventos? | **NÃO** — janela permanece até usuário fechar | Surpresa ruim; sticky pra IDE-side requer permanência |
| Auto-open browser ao `kit ui start`? | **SIM por padrão**, com `--no-open` para suprimir | Espelha `vercel open`; CI/headless usa `--no-open` |
| Servidor termina junto com `Ctrl+C` no `kit ui start`? | **SIM** — modo foreground por padrão | CLI tradicional Unix; usuário pode `kit ui start --detach` em v1.3 |
| `--auto-spawn` deixa o servidor vivo após sync terminar? | **SIM, fica vivo** até usuário rodar `kit ui stop` ou fechar processo MCP | Senão sidecar some no momento de inspecionar resultado |
| Sticky / always-on-top? | **NÃO controlado pelo app** — adicionar instrução textual no header | Browser não permite; documentar como o usuário consegue |
| Múltiplos projetos = portas diferentes? | **SIM, automático** via detect-porta + lockfile per-projectRoot | Devs reais abrem N repos |
| Bind em `0.0.0.0`? | **NUNCA** — sempre `127.0.0.1` | Anti-feature de acesso remoto |
| Validar Host header? | **SIM** — só aceitar `localhost`, `127.0.0.1` | DNS rebinding mitigation |
| Buffer ring N=500 eventos? | **SIM** — drena pro cliente quando ele conecta tarde | Evita "abri tarde, perdi tudo" sem cair em persistência |
| Eventos antigos quando UI conecta? | **SIM, drenar buffer** com flag `replayed: true` no payload | UI pode renderizar diferente (cinza) os replayed |

## Análise de Funcionalidades dos Concorrentes

| Funcionalidade | Vite overlay | Vercel CLI | MCP Inspector | Docker Desktop | k9s | **Nossa Abordagem** |
|---|---|---|---|---|---|---|
| Transport | injected JS | logs CLI | SSE/stdio proxy | IPC interno | TUI direto | **SSE puro** |
| Persistência | nenhuma | servidor remoto | nenhuma (toda sessão) | rolling local | nenhuma | **Ring buffer in-memory N=500** |
| Auth | n/a | OAuth Vercel | n/a (localhost) | desktop user | n/a | **Nenhuma — bind 127.0.0.1 + Host header check** |
| Filtros | n/a | grep CLI | por tool | por container | regex `/` | **Input simples + presets** |
| Detail expand | stack expandido | linha por linha | json full | JSON | YAML | **`<details>` HTML nativo** |
| Reconnect | reload página | reconectar comando | sim (SSE nativo) | sim | n/a | **Native EventSource + keep-alive `:`** |
| Multi-instância | n/a | uma sessão | uma sessão | um daemon | n/a | **Sim, port-per-projectRoot** |
| Build step | sim (Vite) | sim (Next) | sim (React) | sim (Electron) | não (Go) | **Não — HTML/JS vanilla** |

## Quality gate — checagem

- [x] **Categorias claras (essencial / diferencial / anti):** 13 P1, 4 P2, 2 P3, 6 ANTI
- [x] **Complexidade estimada por feature:** LOW/MEDIUM/HIGH na coluna Complexidade
- [x] **Dependências entre features identificadas:** seção "Dependências de Funcionalidades" + notas
- [x] **Lifecycle decisions tomadas:** seção dedicada com 10 decisões registradas

## Fontes

- [HMR Overlay: Full-color error messages — vitejs/vite#8327](https://github.com/vitejs/vite/discussions/8327)
- [Server Options — Vite docs](https://vite.dev/config/server-options)
- [vercel open — Vercel changelog](https://vercel.com/changelog/open-your-vercel-dashboard-from-the-vercel-cli)
- [vercel logs — Vercel CLI docs](https://vercel.com/docs/cli/logs)
- [MCP Inspector — Model Context Protocol](https://modelcontextprotocol.io/docs/tools/inspector)
- [mcp-dashboard — bryankthompson/triepod-ai](https://github.com/triepod-ai/mcp-dashboard)
- [Using server-sent events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [reconnecting-eventsource — fanout](https://github.com/fanout/reconnecting-eventsource)
- [9.2 Server-sent events — WHATWG HTML spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [SSE in Node.js 22: Building Live Dashboards — Markaicode](https://markaicode.com/server-sent-events-nodejs-22-live-dashboards/)
- Codebase upstream lido: `D:\projetos\opensource\mcp\src\core\sync.js` (callback `onProgress` na linha 95), `D:\projetos\opensource\mcp\src\core\reverse-sync.js` (callback `onProgress` na linha 188), `D:\projetos\opensource\mcp\src\cli\index.js` (helpers `withProgress` linha 70), `D:\projetos\opensource\mcp\.planning\PROJECT.md` (decisões de stack v1.2 já fechadas)

---
*Pesquisa de funcionalidades para: GUI sidecar live process viewer (kit-mcp v1.2)*
*Pesquisado: 2026-05-04*
