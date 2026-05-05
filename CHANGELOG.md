# Changelog

All notable changes to `@luanpdd/kit-mcp`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [1.3.0] - 2026-05-05

UI redesign completo entregue por handoff do Claude Design (claude.ai/design). Layout repensado, paleta OKLCH, painel de tweaks (acento/densidade/movimento) acessível, timeline com rail + nó por evento, hero card de active runs com borda cônica animada e barra com gradient + shimmer, empty state com heartbeat bars, e cenários de demo (`Sync` / `Multi` / `Erro` / `Idle`) mockáveis pelo painel de tweaks.

### Adicionado — design

- **Tokens OKLCH** com hue do acento configurável (padrão `130` — lima/verde). Trocas em runtime via tweaks panel: 6 swatches (lima, azul, roxo, laranja, magenta, ciano).
- **Tema dark é puro `#000` no fundo**, com surfaces escalonados (`#0b0d10`, `#11141a`, `#171b22`). Light mode preservado via `prefers-color-scheme` (não é o default).
- **Layout shell** centralizado em 980px. Header (logo + brand + conn pill), toolbar (search com atalho `/`, filter popover, pause, tweaks), main (active region + timeline + empty), footer (counts + last-seen).
- **Hero card de active run**: ícone do tool family (sync/reverse/gates), título humanizado, tool id em mono cinza, elapsed badge à direita (vira `--warn` após 30s), barra com gradient OKLCH + shimmer linear infinito, caption do passo atual em pill com glyph spinning, run id chip em mono. Borda cônica animada (`@property --ang`) anuncia "rodando".
- **Multi-run stacking**: quando há 2+ runs simultâneos, `active-region[data-count]` reduz padding/font-size dos cards pra caber sem rolagem.
- **Timeline com rail**: coluna de tempo relativo (`agora`, `há 5s`, `há 2m`), rail vertical pontilhado conectando os nós, nó colorido por tipo (verde pra `run.start`, vermelho pra `error`, etc). Eventos do mesmo `runId` consecutivos viram `data-grouped="true"` (visualmente sub-eventos).
- **Empty state com `empty-viz`**: 13 barras animadas em onda heartbeat enquanto aguarda o primeiro evento.
- **Tweaks panel** flutuante (canto inferior direito, dialog acessível): paleta de acento, densidade (compacta / normal / confortável), movimento (sutil / médio / rico), e cenário mock (sync/multi/error/idle) pra demos.

### Adicionado — produção

- **Conexão real via `EventSource('/events')`** com retry nativo + `visibilitychange` que força `hydrate + reconnect` quando o tab volta a ser visível.
- **Hydrate inicial via `GET /state`** ANTES do connect, replayando o ring buffer pelo mesmo `ingest()` (dedup por `ts|type|runId`).
- **Shutdown banner** acima do main quando o servidor envia evento `shutdown`. Conn pill vai pra estado `off` com label `encerrado`.
- **Estados de conexão** humanizados no pill: `conectado` (verde, pulsa), `conectando`, `desconectado`, `pausado`, `encerrado`.
- **Mock scenarios preservados** via tweaks (mas não rodam mais em loop ao boot — `EventSource` é a fonte real). Útil pra demo offline e pra testar visualmente cada estado sem precisar disparar workflow real.

### Corrigido

- **Filter pop incluía só 5 tipos por default** — agora `tool_invocation` e `shutdown` aparecem na lista de eventos por default (sem chip de filtro, mas visíveis); evita esconder eventos importantes do servidor.

### Removido

- Helpers `pausedBuffer`/`flushPaused` da v1.2.x — o design optou por **descartar eventos durante pause** em vez de bufferizar (evita explosão de memória se user esquece pausado). Trade-off documentado.
- Botão "rolagem auto" — timeline rola naturalmente conforme novos eventos entram; sem toggle.
- Botão "limpar tela" — `clearAll()` continua disponível pelos tweaks (botão `limpar` no painel).

### Stable API ainda preservada

Todas as mudanças são apenas em `src/ui/static/index.html`. Nada em `src/core/`, `src/cli/`, `src/mcp-server/`, ou em qualquer schema MCP/CLI. Servidor (`src/ui/server.js`) intocado — endpoints `/`, `/events`, `/state`, `/healthz`, `/publish`, `/shutdown` mesmos.

Bump pra **minor** (não patch) porque a UI é experiência radicalmente diferente — usuários verão a mudança visual imediatamente.

## [1.2.3] - 2026-05-04

UI inteira agora fala português e usa termos que fazem sentido pra quem não conhece o código por dentro. Os tipos de evento técnicos viraram nomes legíveis, os caminhos absolutos viraram descrições do tipo "agente planner" / "comando novo-marco" / "skill limpeza", e o status badge da conexão agora lê "CONECTADO/CONECTANDO/DESCONECTADO".

### Adicionado — humanização de labels

- `EVENT_TYPE_LABEL` mapeia `run.start → Iniciado`, `run.end → Finalizado`, `progress → Em andamento`, `tool_invocation → Comando`, `milestone → Marco`, `error → Erro`, `shutdown → Desligado`. O `data-type` raw continua na markup (CSS de cor + filtros funcionam igual), apenas o texto exibido muda.
- `TOOL_LABEL` mapeia ids técnicos pra descrições amigáveis: `sync.install → Sincronizando kit`, `reverse-sync.apply → Importando edições do IDE`, `gates.run → Executando gate`, `sync.watch → Vigiando kit (watch)`, `sidecar → Servidor sidecar`.
- `STATUS_LABEL` traduz `running → em execução`, `done → concluído`, `error → erro`. Usado nos badges dos cards de active runs e no label de fade-out.
- `CONN_LABEL` traduz `CONNECTING → CONECTANDO`, `OPEN → CONECTADO`, `CLOSED → DESCONECTADO`.
- `humanizePath()` reconhece padrões comuns e devolve descrições amigáveis:
  - `.claude/agents/planner.md` → `agente planner`
  - `kit/commands/novo-marco.md` → `comando novo-marco`
  - `kit/skills/limpeza/SKILL.md` → `skill limpeza`
  - `.claude/framework/...` → `framework`
  - `CLAUDE.md` → `manifesto CLAUDE.md`
- `humanizeLabel()` reconhece o padrão "verbo + caminho" comum em payloads de progresso e traduz: `writing .claude/agents/planner.md` → `criando agente planner`, `merging kit/commands/foo.md` → `mesclando comando foo`. Verbos suportados: reading, writing, projecting, merging, copying, deleting, creating, updating, syncing, applying, fetching.

### Adicionado — copy PT-BR

Toda a interface está em português:
- Placeholder do search: `filtrar por nome ou conteúdo…`
- Botões: `⏸ pausar` / `▶ retomar`, `↧ rolagem auto`, `limpar tela`
- Header active runs: `Em execução agora`
- Footer: `eventos: N`, `pausado: N em fila`, `fonte: ao vivo`
- Header port: `porta NNNN`
- Estados de timing: `há 2m 15s` (substitui `started 2m 15s`)
- Status do card: `em execução` / `concluído` / `erro`
- Fim de run: `concluído com sucesso` / `falhou` (em vez de `done` / `failed`)
- Início de run: `iniciando…` (em vez de `starting…`)

### Por que

A v1.2.2 tinha layout bonito mas linguagem técnica — `RUN.START`, `writing .claude/agents/example-reviewer.md`, `RUNNING`. Pra quem usa o sidecar pra primeira vez ou não conhece a arquitetura interna do kit, esses labels eram opacos. Agora o painel diz "Sincronizando kit · em execução · criando agente example-reviewer · 34/100 · 12s" em vez de jogar paths absolutos e enums no usuário.

### Sem mudanças de API

Pure UI patch, ainda. Stable API v1.0+ preservada. Sem deps novas. `data-type` no DOM continua raw (filtros e CSS não quebram). Apenas `src/ui/static/index.html` mudou.

## [1.2.2] - 2026-05-04

UX upgrade da sidecar: o feed cronológico continua, mas agora a janela mostra TAMBÉM um painel "Active runs" no topo com cards visuais pra cada execução em andamento — barra de progresso animada, percentual grande, label do passo atual, runId truncado e tempo decorrido tickando ao vivo.

### Adicionado

- **Active runs panel** em `src/ui/static/index.html` — uma `<section id="active-runs">` antes do log de eventos. Para cada `runId` ativo, renderiza um card com:
  - Nome do tool (de `payload.tool` no `run.start`) com badge de status (running/done/error)
  - Percentual grande (22px tabular-nums) à direita
  - Barra de progresso 8px com transição suave + shimmer animado em estado `running`
  - Label do passo atual (último `payload.label` ou `current/total` derivado)
  - Footer com tempo decorrido (tick a cada 1s) + runId truncado + current/total
- Estado consolidado via `Map<runId, ActiveRun>`, atualizado por `run.start` (cria), `progress` (incrementa), `tool_invocation` (refina título), `run.end` (marca done, fade-out em 4s), `error` (marca erro, fade-out em 8s).
- Cards são **atualizados in-place** via `dataset.runid` matching — preserva a transição CSS da barra em vez de recriar o DOM a cada update.
- Painel some quando 0 runs ativos; aparece automaticamente quando o primeiro `run.start` chega.

### Por que

A v1.2.0 mostrava progresso, mas misturado no feed cronológico — pra saber "tô em quanto" você precisava scanar o último `progress`. O painel novo mostra o estado atual sem rolagem, com afordância visual: barra cresce, percentual sobe, shimmer anda. Quando termina, o card vira verde e some 4s depois (vermelho 8s pra erro). Pareceu "log do servidor", agora parece "process viewer".

### Sem mudanças de API

Pure UI patch. Stable API v1.0+ preservada. Sem deps novas. Apenas `src/ui/static/index.html` (~120 LOC adicionados — CSS dos cards + lógica do `upsertActiveRun` + tick interval).

## [1.2.1] - 2026-05-04

Cosmetic + UX patches descobertos durante o smoke da v1.2.0. Sem mudanças de comportamento de API.

### Corrigido

- **`eventLabel()` agora lê `payload.name`.** Eventos `milestone` que usavam `payload.name` (sem `label`) renderizavam como texto cru "milestone" em vez do nome real. Adicionado fallback `name` na cadeia de helpers no `src/ui/static/index.html`.
- **SSE reconecta quando o tab volta a ficar visível.** Chrome (e outros browsers Chromium) throttla timers em background tabs, podendo suspender o retry interno do `EventSource` e deixar a conexão presa em `CLOSED` mesmo depois do `kit ui` voltar. Adicionado listener `visibilitychange` que faz `hydrateFromState() → connect()` quando o tab volta a `visible` e o status atual é `CLOSED`. Re-hidrata o ring buffer pra mostrar eventos que chegaram durante o gap.

### Sem mudanças de API

`v1.2.0 → v1.2.1` é puro patch:
- Stable API v1.0+ preservada
- Sem deps novas (deps em 6/6)
- Sem mudança em `src/core/`, `src/cli/`, `src/mcp-server/`, ou em qualquer schema MCP/CLI
- Apenas `src/ui/static/index.html` recebeu ~10 LOC

## [1.2.0] - 2026-05-04

**GUI sidecar de acompanhamento.** Janela web localhost paralela mostra ao vivo (via Server-Sent Events) o que kit-mcp está fazendo enquanto sua IDE chama tools — `sync install`, `reverse-sync apply`, `gates run`. Sidecar é totalmente opt-in: quem não invoca `kit ui` continua com a experiência v1.1 idêntica.

### Adicionado — Phase 11: Lock arquitetural
- ADR consolidado em `.planning/decisions.md` (porta 7100-7199, lockfile em `os.tmpdir()` keyed por sha1(projectRoot), idle 30min default, sem auth no v1.2 com mitigação compensatória)
- Threat model em `docs/sidecar-security.md`
- 2 audit gates novos no CI: stdout discipline em `src/ui/` (proíbe `console.log`/`process.stdout.write`) e dep budget (≤ baseline+1)

### Adicionado — Phase 12: Fundações
- `src/ui/events.js` — schema de evento, validador puro, `makeEvent`, `newRunId`
- `src/ui/port.js` — `findFreePort` na faixa 7100-7199 com retry-loop
- `src/ui/lockfile.js` — `acquireLock` atômico via `O_EXCL`, `probeStale` via `process.kill(pid, 0)` + healthz HTTP

### Adicionado — Phase 13: Servidor HTTP + SSE
- `src/ui/server.js` — http.Server nativo, bind 127.0.0.1 literal, 5 rotas (`/`, `/events` SSE, `/healthz`, `/state`, `/publish`, `/shutdown`)
- Heartbeat `: ping\n\n` cada 15s; reconnect auto via EventSource native + `retry: 3000`
- Ring buffer in-memory de 200 eventos (FIFO; sem persistência em disco)
- Cap de 32 conexões SSE; cleanup quádruplo (req+res × close+error)
- Idle shutdown 30min default (`--idle-ms 0` desabilita)
- Encerramento gracioso em SIGINT/SIGTERM com active sockets destruídos
- Validação de `Host` header (mitiga DNS rebinding) e `Origin` em endpoints non-GET
- `bin/ui.js` entry detached

### Adicionado — Phase 14: UI estática single-file
- `src/ui/static/index.html` (~470 LOC) — vanilla DOM + EventSource, sem build step
- Lista cronológica + auto-scroll + `<details>` expand
- Badges coloridos por tipo (`run.start`, `run.end`, `tool_invocation`, `progress`, `milestone`, `error`, `shutdown`)
- Status conexão (CONNECTING/OPEN/CLOSED) + reconexão automática
- Filter por tipo (chips) + substring search
- Pause/resume com buffer + autoscroll toggle
- Dark mode automático via `prefers-color-scheme`
- Banner de shutdown PT-BR em CLOSED >5s ou evento `shutdown`
- CSP estrito (`default-src 'self'; ...; frame-ancestors 'none'`)

### Adicionado — Phase 15: Publisher + wrapper + browser-open
- `src/ui/client.js` — `publish(event, {projectRoot})` fire-and-forget, cache TTL 5s, falha silenciosa em ECONNREFUSED
- `src/ui/wrapper.js` — `wrapProgressForUi(onProgress, ctx)` multiplexa terminal + sidecar; helpers `.done/.error/.emit`; `redactPath` central scrubando `$HOME → ~` e `projectRoot → <project>` em TODO payload
- `src/ui/browser.js` — wrapper sobre `open@11` com detection de headless (CI, DISPLAY, SSH, WSL, sandbox); fallback "imprime URL no stderr"
- Nova dep: `open@^11.0.0` (única adição; budget atingido em 6/6)

### Adicionado — Phase 16: CLI integration
- `kit ui start` — sobe sidecar foreground (Ctrl+C mata); flags `--port`, `--idle-ms`, `--no-open`
- `kit ui stop` — POST /shutdown
- `kit ui status` — exibe pid, port, uptime, eventos, subscribers
- `kit ui open` — reabre browser na sidecar atual
- Auto-detect: `kit sync install` e `kit reverse-sync apply` checam lockfile e wrappam `onProgress` automaticamente quando sidecar está rodando
- Opt-out global via `--no-ui` flag ou `KIT_MCP_NO_UI=1` env var

### Adicionado — Phase 17: MCP --auto-spawn
- `src/ui/auto-spawn.js` — `ensureSidecar({projectRoot})` checa lockfile + healthz; se ausente, spawna `bin/ui.js` em **detached** com `windowsHide: true` e `stdio: ['ignore', 'ignore', 'inherit']` (fecha stdout completamente — não pode poluir canal MCP do parent)
- 3 tools MCP ganham campo opcional `autoSpawn: boolean` no inputSchema:
  - `sync` (action=install)
  - `reverse-sync` (action=apply)
  - `gates` (nova action `run`, com autoSpawn)
- Tools triviais (`kit`, `forensics`, `install`) **não** ganham autoSpawn — explicit-out por design

### Adicionado — Phase 18: Hardening + release
- 3 hardening tests novos: kill -9 recovery, multi-publisher race, MCP stdio uncorrupted (validação rigorosa do REQ SEC-04 em produção)
- README seção "Live UI" com primeiros passos
- `npm pack --dry-run` valida que `src/ui/static/index.html` é incluído no tarball

### Corrigido
- **REL-01 (bug pré-existente):** `kit --version` agora lê de `package.json` em vez de retornar string hardcoded `1.0.0`. Em v1.0/v1.1 o comando exibia versão errada — corrigido nesta release.

### Stable API additions (1.x compatible)

A v1.0 commitment continua válida. Estas adições são parte do contrato:

- **MCP tool `sync` inputSchema:** campo opcional `autoSpawn: boolean` em action=install. Tools que não passam mantêm comportamento idêntico.
- **MCP tool `reverse-sync` inputSchema:** campo opcional `autoSpawn: boolean` em action=apply.
- **MCP tool `gates` inputSchema:** campo opcional `autoSpawn: boolean` E nova action `run` com `id`/`projectRoot`/`autoSpawn` campos.
- **CLI subgroup `kit ui`:** novo grupo com `start | stop | status | open` subcommands.
- **CLI flag `--no-ui` global** + env var `KIT_MCP_NO_UI=1` — opt-out do auto-detect de sidecar.
- **Stable runtime guarantee:** core (`syncTo`, `applyReverse`, `runGate`) é literalmente intocado. Wrapper de `onProgress` é montado APENAS no callsite (CLI handler ou MCP tool handler).

### Migration

**Usuários v1.1 não precisam fazer nada.** Sidecar é estritamente opt-in.

Para experimentar a UI:
```bash
# 1. Em um terminal:
kit ui start

# 2. Em outro (ou via Claude Code/Cursor):
kit sync install claude-code

# A janela mostra o progresso em tempo real.
```

Para tools MCP, passe `autoSpawn: true` quando quiser auto-abrir:
```jsonc
{ "tool": "sync", "arguments": { "action": "install", "target": "claude-code", "autoSpawn": true } }
```

### Threat model resumido

Sidecar é **localhost only**, single-user, dev workstation. Sem auth (mitigado por bind 127.0.0.1 + Host/Origin check + CSP estrito + path scrubbing). Sem persistência. Sem TLS (loopback). Detalhes em [`docs/sidecar-security.md`](docs/sidecar-security.md).

## [1.1.0] - 2026-05-03

**Visual feedback in the terminal.** Running `kit ...` now prints colored tables, progress bars, summary panels and interactive selectors instead of the raw JSON-to-stdout default of v1.0. Programmatic consumers add `--json` to restore the previous behavior.

### Added — Phase 6: UI primitives
- `src/core/ui.js` — single module exposing `c` (color helpers), `icons`, `spinner`, `progress`, `select`, `confirm`, `summary`. Respects `NO_COLOR`, `FORCE_COLOR`, `process.stdout.isTTY`. Animations write to stderr so stdout stays clean for `--json` piping.
- Deps: `picocolors` (~3KB, zero subdeps) and `@inquirer/prompts` (modular — only `select`+`confirm` imported).

### Added — Phase 7: `--json` flag, default human
- `--json` global flag preserves v1.0's JSON-to-stdout behavior for programmatic consumers.
- Without `--json`: every subcommand renders a human-readable table or summary panel via `src/cli/render.js`.
- `kit get` is unchanged (still raw, cat-like).

### Added — Phase 8: Progress + spinner
- `syncTo` and `applyReverse` accept an `opts.onProgress({ phase, current, total, label })` callback. Default no-op preserves backward compat.
- CLI wraps long ops in `withProgress(label, total, fn)` and short ops in `withSpinner(text, fn)`. TTY animates; pipes/CI emit linear status text (`10%, 20%, ...`).

### Added — Phase 9: Interactive selectors + diff confirm
- `install write [target]` and `sync install [target]` — when target argument is omitted in TTY mode, opens a select prompt listing all 8 IDEs with labels.
- `install write` always previews the JSON/TOML to be written and asks `Apply these changes? (y/N)` before applying. `--yes` or `--json` bypasses the prompt for CI/programmatic use.
- In non-TTY mode without target: exits with a helpful message ("pass the value as a flag instead").

### Stable API additions (1.x compatible)

The 1.0 commitment is unchanged. These additions become part of the contract:

- **`--json` global flag.** Behavior locked: JSON-to-stdout, no ANSI codes, no progress on stderr, prompts replaced by descriptive errors.
- **`onProgress` callback signature** on `syncTo` and `applyReverse`: `({ phase, current, total, label }) => void`. Adding optional fields is non-breaking.
- **Interactive selectors fall back to errors in non-TTY**, not to defaults — programs MUST pass the target as argument or use `--json`.

### Migration

Programs and scripts that piped `kit ... | jq` need to add `--json` explicitly:
```bash
# Before (v1.0):
kit list-agents | jq '.[].name'

# After (v1.1):
kit list-agents --json | jq '.[].name'
```

Interactive shell users get the new visual output automatically — no flags needed.

### Tests
- `test/unit/ui.test.js` — 6 new tests covering `summary` rendering, `NO_COLOR` honored, icons set.
- `test/integration/cli-roundtrip.test.js` — 4 new tests covering `--json` opt-in, default human output, selector fallback in non-TTY for `install write` / `sync install`.
- Total: 49 unit + 9 integration = **58 tests** in ~4s. CI verde 6/6 (Ubuntu/macOS/Windows × Node 20/22).

## [1.0.0] - 2026-05-03

**First stable release.** kit-mcp now commits to backwards compatibility on the surfaces listed under "Stable API" below; breaking changes there require a 2.0.0 bump.

### Added — Phase 1: Tooling debt
- `.github/dependabot.yml` — weekly grouped npm + github-actions updates.
- GitHub Release object created for v0.5.0 (was stuck on v0.2.0 "cleanup" as Latest).
- `.github/workflows/publish.yml` now creates a GitHub Release object automatically on every `v*` tag push, with notes extracted from this CHANGELOG. Closes the gap permanently.

### Fixed — Phase 2: Slash-command parser
- `src/core/sync.js` — `renderReference` reorders the stub body so the first non-blank line is the H1 + description blockquote, not the `<!-- kit-mcp:reference -->` marker. Strict downstream parsers (notably Claude Desktop's skill listing) now surface the real description.
- `src/core/kit.js` — `firstNonEmptyLine` skips lines starting with `<!--` as a defensive fallback when the canonical has no frontmatter description.
- `kit/commands/*` — 8 commands (`adicionar-backlog`, `adicionar-fase`, `adicionar-tarefa`, `concluir-marco`, `definir-perfil`, `depurar`, `fio`, `inserir-fase`) had unquoted angle-bracket `argument-hint` values that strict YAML parsers misinterpreted as flow-style flags. Now consistently quoted.

### Added — Phase 3: Reverse-sync for mirror-tree caps
- `detectReverse` now walks `.claude/framework/` and `.claude/hooks/` and reports any byte-for-byte difference vs `kit/<source>/<rel>`. The `.kit-mcp-managed` marker is automatically excluded from candidates.
- `applyReverse` adds `applyMirrorTreeOne` for `framework`/`hooks` candidates: `skip`, `overwrite`, `merge` (degenerates to overwrite — no frontmatter to preserve), `rename` (writes to `kit/<source>/<rel>.from-<tag>.<ext>` preserving the original).
- `--only framework/<rel>` / `--only hooks/<file>` filters narrow apply to one file.
- README "kit reverse-sync" section updated with the new examples.

### Added — Phase 4: Test infrastructure
- `node:test`-based runner — zero dependencies. `test/run.mjs` walks for `*.test.js` files (works on Node 20+ where `--test` glob support is partial).
- 37 unit tests across `kit`, `sync`, `reverse-sync`, `gates`, `gate-runner`, `registry`.
- 5 integration tests spawning `bin/cli.js` end-to-end (incl. MCP server boot smoke).
- `test/fixtures/sample-kit/` minimal fixture (1 of each kind + framework template + hook + frontmatter-less command for fallback test).
- CI runs `npm test` + `npm run test:integration` before existing smoke + MCP boot, on Ubuntu / macOS / Windows × Node 20 / 22 (6/6 combinations).
- `package.json` scripts: `test`, `test:integration`, `test:all`.

### Stable API (commitments locked at 1.0.0)

The following surfaces are covered by SemVer — breaking changes require a 2.0.0 release:

- **`src/core/registry.js` TARGETS table format.** Adding capabilities, IDEs, or new modes is non-breaking. Renaming or removing existing capability keys (`rules`, `agents`, `commands`, `skills`, `framework`, `hooks`, `mcpConfig`) is breaking.
- **MCP tool action signatures.** Tool names (`kit`, `sync`, `reverse-sync`, `gates`, `forensics`, `install`) and their action-dispatch contracts are stable. New actions are non-breaking; renaming or removing existing actions is breaking.
- **CLI subcommand surface.** Top-level commands (`kit`, `sync`, `reverse-sync`, `gates`, `forensics`, `install`) and their action sub-commands are stable. New flags are non-breaking; renaming or removing existing ones is breaking.
- **`src/core/*.js` named exports.** Functions consumed programmatically (`listKit`, `searchKit`, `findItem`, `resolveKitRoot`, `BUNDLED_KIT_ROOT`, `syncTo`, `statusOf`, `removeFrom`, `detectReverse`, `applyReverse`, `listGates`, `getGate`, `gatesForStage`, `runGate`, `listTargets`, `getTarget`, `TARGETS`) keep their signatures. Adding new exports is non-breaking; signature changes are breaking.
- **Stub format.** Files written by sync `--mode reference` keep the `<!-- kit-mcp:reference -->` marker somewhere in the body so `sync remove` and `reverse-sync detect` continue to identify them. Position within the body may change; presence is the contract.
- **`.kit-mcp-managed` marker semantics.** Mirror-tree directories (`framework/`, `hooks/`) are managed only when the marker is present at the root. Without it, `sync remove` never deletes the tree.

### Migration

No code changes required for users on 0.5.0 — `npm install @luanpdd/kit-mcp@latest` brings in 1.0.0 with the same behavior plus the parser fixes, reverse-sync expansions, and test coverage.

If you were on 0.4.0 (deprecated) or earlier, upgrade to skip the import-time crash and missing-framework regression entirely.

## [0.5.0] - 2026-05-03

### Added
- **Mirror-tree sync for `framework` and `hooks`.** `kit/framework/` (124 files: workflows, templates, references, libs) and `kit/hooks/` (5 files) are now projected into `.claude/framework/` and `.claude/hooks/` on every `sync install claude-code`. Without this, the bundled slash-commands like `/novo-marco` were broken-by-design — they referenced `@./.claude/framework/workflows/new-milestone.md` and similar paths that never existed in the destination project. Now they resolve correctly end-to-end.
- New `mode: 'mirror-tree'` capability spec in `src/core/registry.js`. Each mirror-tree entry has a `source` (relative path inside `kit/`) and a `path` (destination path in the target project).
- A `.kit-mcp-managed` marker file is written at the root of each managed tree so `kit sync remove` can recursively clean up the directory **only** when the marker is present. Trees you authored yourself (without the marker) are never touched.
- CI smoke test asserts `.claude/framework/workflows/new-milestone.md`, `.claude/framework/templates/project.md`, and `.claude/hooks/workflow-guard.js` are projected, and that `sync remove` cleans them up.
- New CI safety test: `sync remove` against a `.claude/framework/` directory with no marker preserves user content.

### Changed
- `statusOf` now reports `framework` and `hooks` capability paths.
- README capability matrix gained two columns (`framework`, `hooks`) and a paragraph explaining the mirror-tree semantics.

### Migration
No action needed — `npx -y @luanpdd/kit-mcp@latest sync install claude-code --project-root .` projects the new directories automatically. If you had a manually-created `.claude/framework/` or `.claude/hooks/`, kit-mcp will overwrite individual files but won't delete user files; `sync remove` continues to leave them alone.

## [0.4.1] - 2026-05-03

### Fixed
- `src/mcp-server/index.js` was importing `DEFAULT_KIT_ROOT` from `core/kit.js`, but that export was renamed to `BUNDLED_KIT_ROOT` / `resolveKitRoot` during the v0.2.0 refactor. The unused import wasn't caught by CI (which only smoke-tests CLI commands, not MCP server boot) and made the server crash on `npx -y @luanpdd/kit-mcp` for any sync/install command. Removed the dead import — server now boots cleanly.

### Tests (suggestion)
- CI should boot `node bin/mcp.js` and validate exit. Tracked in roadmap.

## [0.4.0] - 2026-05-03

### Changed
- README rewritten: bundled workflow framed as the default install path; `--kit-root` framed as the escape hatch for users who want to replace it entirely.
- "What ships in the box" lists actual bundled folders (19 agents, 60 commands, framework, hooks) instead of "example kit".
- Quick start reordered: use bundled as-is first, replace with own kit second.
- CLI examples updated with real counts.

This release is content-equivalent to 0.3.0 plus the documentation overhaul. No code changes versus 0.3.0.

## [0.3.0] - 2026-05-03

**Reverts the v0.2.0 cleanup.** kit-mcp goes back to shipping an opinionated, embedded workflow — installing `@luanpdd/kit-mcp` once again gives you the maintainer's brownfield planning workflow (PT-BR) ready to use. The "generic infrastructure, bring your own kit" framing of v0.2.0 was based on the wrong premise: the bundled content **is** the maintainer's workflow, intentionally distributed for anyone to inherit. The `--kit-root` / `KIT_MCP_KIT_ROOT` escape hatch from v0.2.0 stays — point it at your own folder if you want to replace the bundled workflow entirely.

### Restored
- 19 agents — planner, executor, verifier, debugger, codebase-mapper, ui-auditor, ui-checker, ui-researcher, advisor-researcher, assumptions-analyzer, integration-checker, nyquist-auditor, phase-researcher, plan-checker, project-researcher, research-synthesizer, roadmapper, user-profiler (plus the example-reviewer kept from 0.2.0).
- 60 slash-commands in PT-BR — milestone lifecycle (`/novo-marco`, `/concluir-marco`, `/auditar-marco`, `/planejar-lacunas`, `/resumo-marco`), phase lifecycle (`/discutir-fase`, `/planejar-fase`, `/executar-fase`, `/validar-fase`, `/verificar-trabalho`, `/adicionar-fase`, `/inserir-fase`, `/remover-fase`), task & idea capture (`/adicionar-tarefa`, `/nota`, `/plantar-ideia`, `/adicionar-backlog`, `/revisar-backlog`), workflows (`/autonomo`, `/expresso`, `/rapido`, `/fazer`, `/proximo`, `/fluxos-trabalho`), debugging (`/depurar`, `/forense`), publishing (`/publicar`, `/setup-notion`, `/branch-pr`), and more.
- `kit/framework/` — workflows + templates + bin libs the agents and commands delegate into.
- `kit/hooks/` — workflow guards, prompt guards, statusline.
- `kit/COMANDOS.md`, `kit/file-manifest.json`, `kit/settings.json`.

### Not restored (intentionally)
- The 13 skills from the Anthropic Cowork ecosystem (paperclip, design-guide, company-creator, paperclip-create-agent, paperclip-create-plugin, release, release-changelog, prcheckloop, pr-report, doc-maintenance, deal-with-security-advisory, create-agent-adapter, para-memory-files). These belong to Anthropic, not to this package — install them separately if you want them.

### Changed
- `kit/commands/setup-notion.md` — hardcoded Notion page ID and "Trynux" workspace name replaced with placeholder `{NOTION_PARENT_PAGE_ID}` configurable via env var `KIT_NOTION_PARENT_PAGE_ID`.
- `kit/commands/publicar.md` — hardcoded GitHub repo URL `IEP-Advocacia/obsidian-chat-trynux` replaced with placeholder `${OBSIDIAN_VAULT_REPO}` configurable via env var `OBSIDIAN_VAULT_REPO`. If the env var isn't set, the Obsidian publishing step is skipped cleanly.
- README rewritten: bundled workflow framed as the default install path; `--kit-root` framed as the escape hatch for users who want to replace it entirely.

### Migration

If you installed v0.2.0 expecting the empty/example kit and don't want the bundled workflow, set `KIT_MCP_KIT_ROOT` to your own kit folder before any sync command — nothing else changes:

```bash
export KIT_MCP_KIT_ROOT=~/my-kit
npx -y @luanpdd/kit-mcp sync install claude-code --project-root .
```

If you were on v0.1.x and want the original bundled workflow back, just upgrade — `npm install @luanpdd/kit-mcp@latest` ships it again. (Note: the Anthropic Cowork skills bundled in 0.1.x are still excluded.)

## [0.2.0] - 2026-05-03

**BREAKING.** kit-mcp is now generic infrastructure. The bundled "personal kit" content was removed — bring your own via `--kit-root` or `KIT_MCP_KIT_ROOT`.

### Removed
- All third-party content from the bundled `kit/`:
  - 13 skills (paperclip, design-guide, company-creator, paperclip-create-agent, paperclip-create-plugin, release, release-changelog, prcheckloop, pr-report, doc-maintenance, deal-with-security-advisory, create-agent-adapter, para-memory-files) — these were Anthropic Cowork ecosystem skills, not authored by the package owner.
  - 18 agents and 59 commands previously bundled — these depended on a third-party Portuguese framework that's not redistributed here.
  - `kit/framework/`, `kit/hooks/`, `kit/COMANDOS.md`, `kit/file-manifest.json`, `kit/settings.json` — same reason.
- Internal references (Trynux Notion page IDs, private repo URLs) that leaked from the user's personal projects.

### Added
- `LICENSE` — MIT, Copyright © 2026 luanpdd.
- Bundled **example kit** with 1 agent, 1 command, 1 skill demonstrating the file format. Replace with your own.
- `kit/README.md` documenting the kit file format (frontmatter + body) and structure.
- `--kit-root <path>` global CLI flag to point at any kit folder.
- `KIT_MCP_KIT_ROOT` env var for sticky session-wide override.
- `resolveKitRoot(kitRoot)` exported from `core/kit.js` — lazy resolution so env var changes after import are honored.

### Migration

If you were using 0.1.x with the bundled kit, **the kit content was never yours and is no longer included**. Author your own kit/ folder following the format in [`kit/README.md`](kit/README.md), and point kit-mcp at it:

```bash
npx -y @luanpdd/kit-mcp --kit-root ~/my-kit sync install claude-code --project-root .
# or
export KIT_MCP_KIT_ROOT=~/my-kit
npx -y @luanpdd/kit-mcp sync install claude-code --project-root .
```

## [0.1.6] - 2026-05-03

### Added
- GitHub Actions workflow that publishes to npm on tag push (`v*`) with provenance attestation.
- CI workflow that runs CLI smoke tests on Ubuntu / macOS / Windows × Node 20 / 22.
- `CHANGELOG.md` (this file).
- README badges: npm version, downloads, license, CI status.
- README "Releasing" section documenting `npm version` → `git push --follow-tags` flow.
- The project's own `.mcp.json` re-issued with `--via npx` so collaborators cloning the repo get a portable MCP server registration.

## [0.1.5] - 2026-05-03

### Added
- `forensics reflect` — LLM-driven prompt evolution. Reads `.planning/learnings/{agent}.md` plus current agent prompt, calls Anthropic API, proposes minimal surgical edits, asks for confirmation before applying.
- CLI: `kit forensics reflect --agent <name> [--dry-run | --apply]`.
- MCP: `forensics.reflect` action (returns proposal, never auto-applies).
- Env config: `KIT_REFLECT_MODEL`, `KIT_REFLECT_MAX_TOKENS`. Requires `ANTHROPIC_API_KEY`.

### Notes
- Zero new dependencies — uses native `fetch`.
- Without `ANTHROPIC_API_KEY`, falls back to saving the assembled prompt for manual paste.

## [0.1.4] - 2026-05-03

### Added
- `kit gates run <id>` — gate runner with explicit user confirmation.
- Auto-detects shell gates (` ```bash ` blocks under `## Check`) vs manual gates.
- Verdict mapping: exit 0 → `passed`; exit≠0 → `block` (if blocking) or `warn`.
- `--yes` for non-interactive (CI) mode; `--no-interactive` makes manual gates return `verdict=manual`.

### Fixed
- Gate body section parser now handles gates without trailing `## Verdict` heading.

## [0.1.3] - 2026-05-03

### Added
- `kit sync watch <targets...> [--all]` — watches `kit/` and re-syncs to one or more IDEs on every change.
- Debounce window (default 300ms), per-event log, clean shutdown on Ctrl+C.
- Auto-detect via `--all` of every IDE target that already has files in the project.
- New dep: `chokidar ^5.0.0`.

## [0.1.2] - 2026-05-03

### Added
- `kit reverse-sync detect|apply <target>` — bring edits made directly in an IDE's layout back into the canonical `kit/`.
- Strategies: `skip` (default), `merge` (preserve canonical frontmatter, take edited body), `overwrite`, `rename` (write to `-from-{ide}.md`).
- `--only kind/name` filter, `--dry-run` preview.
- MCP: `reverse-sync` tool.

### Fixed
- Stubs for canonical files without frontmatter now get a synthesized `---name/description---` block (was making downstream parsers read the `<!-- kit-mcp:reference -->` marker as the description).
- Blank line inserted between frontmatter and the stub marker so YAML parsers don't choke.

## [0.1.1] - 2026-05-03

### Added
- `--via {npx | local | global}` flag on `install` command.
- `--via npx` writes `npx -y @luanpdd/kit-mcp` into the IDE's MCP config — portable, no clone needed.
- README rewritten with three quick-start paths (npx, global install, clone).

### Fixed
- `bin` paths in `package.json` no longer prefixed with `./` (npm 11 stripped them as invalid script names, removing the bin entries from published tarball).

## [0.1.0] - 2026-05-03

### Added
- Initial release. MVP with 5 MCP tools (`kit`, `sync`, `gates`, `forensics`, `install`).
- 18 agents, 59 commands, 13 skills (3 + 10 extras) bundled from the user's personal kit.
- 5 reusable workflow gates extracted from inline workflow steps.
- Single `registry.js` adapter table for 8 IDE targets (Claude Code, Cursor, Codex, Gemini CLI, Copilot, Windsurf, Antigravity, Trae).
- Markdown-reference projection mode (default) so the canonical kit stays the single source of truth.
- CLI mirror of all MCP tools.
- `install` command that registers kit-mcp into an IDE's MCP config (JSON for Claude/Cursor/Gemini/Windsurf, TOML for Codex).

[Unreleased]: https://github.com/luanpdd/kit-mcp/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/luanpdd/kit-mcp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/luanpdd/kit-mcp/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/luanpdd/kit-mcp/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/luanpdd/kit-mcp/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/luanpdd/kit-mcp/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/luanpdd/kit-mcp/compare/v0.2.1...v0.3.0
[0.2.0]: https://github.com/luanpdd/kit-mcp/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/luanpdd/kit-mcp/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/luanpdd/kit-mcp/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/luanpdd/kit-mcp/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/luanpdd/kit-mcp/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/luanpdd/kit-mcp/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/luanpdd/kit-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/luanpdd/kit-mcp/releases/tag/v0.1.0
