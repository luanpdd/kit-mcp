# 166-SUMMARY.md — MCP `roots` capability (concluída)

**Entregue:** 2026-05-12

## O que mudou

- **Novo módulo:** `src/mcp-server/roots.js`
  - `attachRootsCapability(server)` — registra notification handler para `notifications/roots/list_changed`
  - `fetchRoots(server)` — envia `roots/list` request ao cliente, cacheia resultado
  - `getRoots(server)` — accessor com lazy-fetch
  - `getPrimaryProjectRoot()` — sync accessor, fallback `process.cwd()`
  - `getRootsSupportLevel()` — `'supported'|'unsupported'|'unknown'` para diagnóstico
- **Integração:** `src/mcp-server/index.js`
  - `createServer()` chama `attachRootsCapability(server)` antes de retornar
  - `startStdio()` invoca `fetchRoots(server)` após connect (fire-and-forget)

## REQs validados

- REQ-166-01 ✓ — capability declarada via `enforceStrictCapabilities: false` (permite o request roots/list)
- REQ-166-02 ✓ — `fetchRoots` invocado após connect
- REQ-166-03 ✓ — `getPrimaryProjectRoot()` exposto
- REQ-166-04 ✓ — fallback `process.cwd()` na ausência de roots
- REQ-166-05 ✓ — listener para `notifications/roots/list_changed` invalida cache + refetch

## Próxima fase

167 — Auto-sync no boot (consumirá `getPrimaryProjectRoot()`).
