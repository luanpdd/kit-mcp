---
status: passed
phase: 17
verified: 2026-05-04
---

# Phase 17 — Verification

## Critérios de sucesso

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | 148/148 tests pass | ✅ | npm run test:all — 0 fail |
| 2 | MCP server boots clean | ✅ | `node bin/mcp.js < /dev/null` → exit 0 (clean stdin EOF) |
| 3 | Audit gate stdout passing | ✅ | grep retorna vazio em src/ui/ |
| 4 | Audit gate dep budget | ✅ | 6/6 |
| 5 | Stable API: tools sem autoSpawn comportam idênticas | ✅ | autoSpawn é optional; default false; sem mudança quando omitido |
| 6 | gates.run nova action MCP funciona | ✅ | smoke local: sem autoSpawn delega pra runGate normal |

## REQs cobertos

| REQ | Implementação |
|---|---|
| MCP-01 | `sync` inputSchema ganha `autoSpawn: boolean` (action=install); handleSync delega a `withAutoSpawn('sync.install', ...)` |
| MCP-02 | `reverse-sync` inputSchema ganha `autoSpawn: boolean` (action=apply); handleReverseSync delega a `withAutoSpawn('reverse-sync.apply', ...)` |
| MCP-03 | `gates` inputSchema ganha `autoSpawn: boolean` + nova action `run`; handleGates delega a `withAutoSpawn('gates.run', () => runGate(...))` |
| MCP-04 | Tools triviais (kit, forensics, install) **NÃO** ganham autoSpawn no schema — explicit-out |

## Tests adicionados

```
test/integration/ui-auto-spawn.test.js — 3 tests:
  no_project_root quando missing
  returns existing port quando sidecar already running
  spawns new process; lockfile aparece; openBrowser respeita KIT_MCP_NO_OPEN
```

Total: 145 antes → 148 com Phase 17.

## Stable API verificação

```
$ git diff HEAD~1 -- src/core/
(empty)
```

Core continua intocado. Apenas `src/mcp-server/index.js` (orquestrador) e `src/ui/` (novo) foram editados. Todos os campos novos no inputSchema são opcionais — clientes que não os passam mantêm comportamento idêntico.

## Smoke local

- `node bin/mcp.js < /dev/null` → boot clean, exit 0
- ensureSidecar com sidecar rodando → reusa porta
- ensureSidecar sem sidecar → spawna detached + retorna port + opened (com KIT_MCP_NO_OPEN respeita)

## stdout discipline

`auto-spawn.js` spawna o subprocess com `stdio: ['ignore', 'ignore', 'inherit']`:
- stdin: ignorado
- stdout: completamente fechado — não pode poluir parent (especialmente importante quando parent é MCP server)
- stderr: inherit — logs do sidecar aparecem no terminal pra debugging

## Riscos remanescentes

- Test "spawns new process" deixa subprocess detached por <1s antes de SIGTERM; em CI lento pode flakar. Cleanup é best-effort.
- Pause adicional na inicialização do MCP server agora que importa `ensureSidecar` (lazy import poderia melhorar). Mensurável em smoke pero <50ms aceitável.

## Conclusão

Phase 17 completa. Pronto pra Phase 18 (hardening + cross-platform smoke + cut da v1.2.0).
