# Phase 16: Integração CLI (kit ui + auto-detect) — PLAN

**Tipo:** CLI surface additions
**REQs cobertos:** CLI-01..05 (5 REQs)
**Dependências:** Phase 15 (publisher, wrapper, browser)

## Mudanças em `src/cli/index.js`

### 1. Imports adicionais
```js
import { createServer } from '../ui/server.js';
import { readLock, lockPathFor } from '../ui/lockfile.js';
import { wrapProgressForUi } from '../ui/wrapper.js';
import { openBrowser } from '../ui/browser.js';
import http from 'node:http';
```

### 2. Flag global `--no-ui`
Suprime publishing de eventos pro sidecar para uma run específica. Default: auto-detect lockfile.

### 3. `withProgress` ganha auto-wrap
Antes: chamava só onProgress. Agora: depois de criar onProgress, chama `maybeWrapForUi(onProgress, {tool, projectRoot})`. Se sidecar está rodando E `--no-ui` não setado E `KIT_MCP_NO_UI` env não=1 → wrappa com `wrapProgressForUi`. Senão → passthrough wrapper que respeita signature e .done/.error.

`sync install` passa `tool: 'sync.install', projectRoot`.
`reverse-sync apply` passa `tool: 'reverse-sync.apply', projectRoot`.

### 4. Subgrupo `kit ui`

**`kit ui start`:**
- Cria server via `createServer({projectRoot, idleMs})`
- `await srv.start({port})` (auto-pick se omitido)
- Imprime URL no stderr
- Auto-abre browser via openBrowser (a menos que `--no-open`)
- Foreground: server fica rodando, SIGINT do server cuida do cleanup
- ELIVE → exit 2 com mensagem indicando outra instância

**`kit ui stop`:**
- Lê lockfile; sem lock → "no sidecar running"
- POST /shutdown → success/fail messaging

**`kit ui status`:**
- Lê lockfile; sem lock → exit 1 + "no sidecar running"
- GET /healthz → render structured info (port, uptime, events, subscribers)
- Lockfile órfão (server não responde) → exit 1 com erro

**`kit ui open`:**
- Lê lockfile; sem lock → fail
- Chama openBrowser com `force: true`

### 5. Helpers HTTP locais
`postShutdown(port)` e `getHealthz(port)` usam http nativo direto (não passa pelo client.js que é fire-and-forget — aqui queremos response status). Headers Origin + Host corretos pra passar SEC checks.

### 6. `renderUiStatusFallback`
Render ASCII multi-linha. (Render dedicado em render.js poderia vir em Phase 18 se quisermos polir.)

## Tests

`test/integration/cli-ui.test.js` (8 tests):
- `kit ui --help` lista 4 subcommands
- `kit ui status` no sidecar → exit 1 + msg
- `kit ui status --json` no sidecar → JSON estruturado
- `kit ui open` no sidecar → exit non-zero + msg
- `kit ui stop` no sidecar → graceful (no_sidecar)
- `kit list-agents` ainda funciona (sanity stable API)
- `kit --version` ainda exibe 1.0.0 hardcoded (REL-01 pra Phase 18 fixar)
- E2E: spawn `kit ui start` em child, `kit ui status` o vê, `kit ui stop` o encerra

## Critérios de sucesso (observáveis)

1. `npm run test:all` → 145/145 (137 antes + 8 novos)
2. Audit gates: stdout (vazio em src/ui/) + deps (6/6) — ambos OK
3. Stable API: nenhuma alteração em src/core/ ou src/mcp-server/
4. `node bin/cli.js ui --help` lista start/stop/status/open
5. `node bin/cli.js kit list-agents` continua funcionando
6. Auto-detect: `kit sync install` quando lockfile presente publica eventos automaticamente

## Riscos mitigados

- **CLI surface bloat:** kit ui é subgrupo separado, não polui kit/sync/reverse-sync namespaces
- **stable API leak:** withProgress ganha 4º param OPCIONAL; chamadores existentes não impactados
- **lockfile órfão dá UX ruim:** `kit ui status` distingue "no_lockfile" vs "unreachable" e indica path do lockfile

## Riscos remanescentes

- Em Windows, `Ctrl+C` em foreground server às vezes não flusha cleanup limpo. Aceitável (server lib trata SIGINT/SIGTERM corretamente).
- Auto-detect opt-out por flag `--no-ui` mas commander parseia como `--no-ui` → `opts.ui = false`. Pesquisar se essa convenção é o que a gente quer no help text.
