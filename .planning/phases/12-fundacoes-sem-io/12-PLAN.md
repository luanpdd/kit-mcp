# Phase 12: Fundações sem I/O — PLAN

**Tipo:** Pure utilities (sem rede, sem fs cross-process)
**REQs cobertos:** SRV-08, SRV-09
**Dependências:** Phase 11 (CI gates ativos)

## Componentes

### `src/ui/events.js`
- `EVENT_TYPES` const congelada com 7 tipos: run.start, run.end, tool_invocation, progress, milestone, error, shutdown
- `newRunId()` — 16-char hex via crypto.randomBytes(8)
- `makeEvent({type, runId, payload, ts})` — stamps ts default e valida type
- `validateEvent(value)` — JS puro (sem zod). Retorna null em sucesso, Error em falha. Cap de 64KB no payload serializado.

### `src/ui/port.js`
- `DEFAULT_PORT_RANGE = {start: 7100, end: 7199}` (ADR-01)
- `findFreePort({start, end, host})` — bind+close probe sequential
- `findFreePortOrThrow(opts)` — variante eager com mensagem helpful

### `src/ui/lockfile.js`
- `lockPathFor(projectRoot)` — `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot[:16])>.lock` (ADR-02)
- `acquireLock({projectRoot, port, version, startedAt})` — `fs.openSync(file, 'wx')` atômico; ELOCKED em colisão
- `readLock(projectRoot)` — never throws; null em ENOENT/parse-fail
- `releaseLock(projectRoot)` — true se removeu, false se ENOENT
- `probeStale(lock, {healthzProbe})` — process.kill signal-0 + DI healthz
- `acquireLockOrReclaim(opts)` — tenta acquire, em ELOCKED probeStale + reclaim ou ELIVE

## Tests

- `test/unit/ui-events.test.js` — 11 tests (types frozen, newRunId unique, makeEvent stamps, validators)
- `test/unit/ui-port.test.js` — 6 tests (default range, finds free, skips taken, exhaustion, throws variant)
- `test/unit/ui-lockfile.test.js` — 16 tests (path determinism, acquire/release roundtrip, ELOCKED, readLock null/parse, probeStale 6 paths, acquireLockOrReclaim 3 paths)

## Critérios de sucesso (observáveis)

1. `npm test` passa com +33 tests novos (total 76+ unit)
2. CI audit gate stdout discipline continua passando (sem console.log em src/ui/)
3. `node -e "import('./src/ui/events.js').then(m => console.error(m.EVENT_TYPES))"` lista 7 tipos (em stderr — gate continua passando)
4. `node -e "import('./src/ui/lockfile.js').then(m => console.error(m.lockPathFor('/tmp/x')))"` exibe path em os.tmpdir
5. Pure: nenhum dos 3 módulos importa de `src/core/` ou `src/cli/`
