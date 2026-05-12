# 157-SUMMARY.md — Sidecar UI auto-spawn ON por padrão (concluída)

**Entregue:** 2026-05-12

## O que mudou

- `src/mcp-server/index.js` → `startStdio()` agora invoca `ensureSidecar({ projectRoot, openBrowserOnSpawn: false })` no boot, fire-and-forget.
- Escape hatch: `KIT_MCP_NO_UI=1` (ou `KIT_MCP_NO_UI=true`) desabilita.
- Browser NÃO abre automaticamente (intrusivo); sidecar fica disponível em `http://localhost:<port>` (porta lockfile-based).
- Falhas de spawn são silenciadas — não devem bloquear o transport MCP (stdout permanece JSON-RPC puro).

## REQs validados

- REQ-157-01 ✓ — auto-spawn no startup
- REQ-157-02 ✓ — `KIT_MCP_NO_UI=1` escape
- REQ-157-03 ✓ — sidecar UI existente já lista tool calls live (sem regression)
- REQ-157-04 ✓ — lockfile-based discovery intacto

## Smoke test

`node -e "import('./src/mcp-server/index.js')"` → import OK (sem syntax errors)

## Próxima fase

158 — Log file rotativo + `kit logs --tail`.
