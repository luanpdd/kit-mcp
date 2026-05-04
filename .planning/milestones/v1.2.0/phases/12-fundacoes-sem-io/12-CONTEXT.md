# Phase 12: Fundações sem I/O — Contexto

**Coletado:** 2026-05-04
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (contexto fechado em REQUIREMENTS + ADR + research)

<domain>
## Limite da Fase

Três módulos puros, sem rede, sem fs cross-process, todos testáveis em isolamento:

1. `src/ui/events.js` — schema de evento + helpers (`makeEvent`, `newRunId`, `validateEvent`)
2. `src/ui/port.js` — `findFreePort(start=7100, end=7199)` via `net.createServer` retry
3. `src/ui/lockfile.js` — `acquireLock/readLock/releaseLock/probeStale` keyed por sha1(projectRoot) em `os.tmpdir()`

REQs cobertos: SRV-08 (lockfile atômico), SRV-09 (stale detection).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude (registradas no ADR Phase 11)
- Lockfile path: `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)>.lock`
- Lockfile content JSON: `{pid, port, version, startedAt}`
- Atomic create: `fs.openSync(path, 'wx')` (O_EXCL semantics)
- Stale detection: 1) `process.kill(pid, 0)` signal-0 probe, 2) HTTP probe injetado por DI (mantém pureza)
- Port range: 7100-7199 com retry-loop em `net.createServer().listen(0)`

### Schema do evento
Schema mínimo: `{type, ts, runId?, payload?}`. Tipos válidos enumerados em const exportada. Validator é JS puro (sem zod) — kit-mcp evita deps.

### `runId`
Cada execução de tool/comando ganha um runId via `crypto.randomBytes(8).toString('hex')`. Eventos do mesmo run compartilham.

</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `crypto.createHash` (Node builtin) — pra sha1(projectRoot)
- `os.tmpdir()` — cross-platform tmp dir
- `fs.openSync` com flag 'wx' — atomic exclusive
- `net.createServer` — port detection

### Padrões Estabelecidos
- ESM puro (todos os imports são `node:*` ou local com extensão `.js`)
- Sem build step, código roda direto
- Tests usam `node:test` (já adotado em v1.0)
- Sem deps adicionais — princípio "máx 1 dep nova" do PROJECT.md

### Pontos de Integração
- `src/ui/server.js` (Phase 13) vai consumir os 3 módulos
- `src/ui/client.js` (Phase 15) vai consumir lockfile.readLock e events.makeEvent

</code_context>

<specifics>
## Ideias Específicas

- Lockfile read deve falhar gracefully em ENOENT (nada rodando), retornar null
- Port range exhaustion deve dar erro claro listando o range tentado
- Stale probe deve aceitar healthz como callback opcional (DI) — testável sem rede

</specifics>

<deferred>
## Ideias Adiadas

- Lockfile com expiry timestamp (auto-stale após N minutos sem update) — overkill no MVP, idle shutdown da Phase 13 já cobre.

</deferred>
