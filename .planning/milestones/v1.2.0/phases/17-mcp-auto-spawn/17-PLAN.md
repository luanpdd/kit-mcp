# Phase 17: Integração MCP server (`--auto-spawn`) — PLAN

**Tipo:** MCP tool inputSchema additions + handler integration
**REQs cobertos:** MCP-01..04 (4 REQs)
**Dependências:** Phase 13 (server), Phase 15 (wrapper), Phase 16 (CLI command exists)
**Stable API impact:** ADDITIVE only — campos opcionais novos no inputSchema

## Componentes

### `src/ui/auto-spawn.js` (~80 LOC) — novo módulo

`ensureSidecar({projectRoot, openBrowserOnSpawn}) → {ready, port?, spawned, opened, reason?}`

- Verifica lockfile existente + healthz probe; se OK → retorna sem spawn
- Se ausente: spawna `bin/ui.js --project-root <root>` em **detached** com `windowsHide: true`, `unref()`
- Polls lockfile + healthz a cada 100ms até 5s deadline
- Spawn falhou → `{ready: false, reason: 'spawn_failed'}`
- Healthz timeout → `{ready: false, reason: 'healthz_timeout'}`
- On ready: optionally `openBrowser(url)` (respeitando headless detection)

**Discipline:** stdout completamente fechado no spawn (`stdio: ['ignore', 'ignore', 'inherit']`). Garante que o subprocess não pode poluir o canal MCP do parent.

### `src/mcp-server/index.js` modifications

1. Imports adicionados: `runGate`, `ensureSidecar`, `wrapProgressForUi`
2. `sync` inputSchema ganha `autoSpawn: boolean` (action=install)
3. `reverse-sync` inputSchema ganha `autoSpawn: boolean` (action=apply)
4. `gates` inputSchema ganha:
   - `autoSpawn: boolean` (action=run)
   - **NOVO:** `run` action no enum, `id`/`projectRoot` fields
5. Helper `withAutoSpawn(args, tool, run)` — single source of truth pra spawn + wrap
6. Handlers atualizados:
   - `handleSync('install')` → `withAutoSpawn(args, 'sync.install', onProgress => syncTo(...))`
   - `handleReverseSync('apply')` → `withAutoSpawn(args, 'reverse-sync.apply', ...)`
   - `handleGates('run')` → `withAutoSpawn(args, 'gates.run', () => runGate(id, ...))`
7. Tools triviais (kit, forensics, install) **NÃO** ganham autoSpawn (MCP-04)

### `test/integration/ui-auto-spawn.test.js` (3 tests)

- ensureSidecar: no_project_root quando missing
- ensureSidecar: returns existing port quando sidecar already running
- ensureSidecar: spawns new process; lockfile aparece; KIT_MCP_NO_OPEN respeitado

## Critérios de sucesso (observáveis)

1. `npm run test:all` → 148/148 (145 antes + 3 auto-spawn)
2. `node bin/mcp.js < /dev/null` continua bootando clean (smoke já no CI)
3. Audit gate stdout: src/ui/ vazio
4. Audit gate dep budget: 6/6
5. Stable API: tools existentes (sync.install sem autoSpawn) comportam idênticas
6. `gates.run` é nova action MCP — adição (caller pode usar; não mantém compat com forma antiga porque não havia)

## Riscos mitigados

- **stdout poisoning do subprocess matando MCP parent:** spawn com `stdio: ['ignore', 'ignore', 'inherit']` — child stdout nunca toca parent
- **Race spawn → healthz:** poll loop com timeout 5s; falha graceful retorna ao caller `_sidecar: {ready: false, reason}`
- **Stable API drift:** apenas adições, todos os campos novos opcionais, novos action enum values

## Riscos remanescentes

- ensureSidecar test "spawns new process" deixa um processo node detached rodando temporariamente (cleanup manual via SIGTERM no finally). Em CI lento pode flakar. Phase 18 vai validar no CI matrix.
- Em Windows, processos detached que perdem stdio podem ficar fantasmas se SIGTERM não chega. `windowsHide: true` ajuda mas não 100% garante. Documentar no threat model final (Phase 18).
