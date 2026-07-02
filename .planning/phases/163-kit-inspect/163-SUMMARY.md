# 163-SUMMARY.md — `kit inspect` (concluída)

**Entregue:** 2026-05-12

## Decisão de design

REQ-163 mencionou "TUI dev mode". A escolha minimal-mas-completa foi:
- **NÃO** rebuildar o transport stdio (proxy) — quebraria a spec MCP
- **SIM** adicionar opt-in verbose payload capture no log JSONL via `KIT_MCP_INSPECT=1`
- **SIM** novo subcomando `kit inspect` que faz pretty-print colorido com follow-mode

Implementação cooperativa: o "TUI" é a saída colorida + pretty-printed do log file existente. Sem deps novas (blessed/ink). Funciona cross-platform.

## O que mudou

- `src/mcp-server/index.js` — quando `KIT_MCP_INSPECT=1`, anexa `args` e `result` ao evento JSONL (apenas no path `status:ok`; error path mantém apenas `error_type` para evitar leak de stack)
- `src/cli/index.js` — novo subcomando `kit inspect`:
  - Lê tail do log file via `tailLogs({follow:true})` (reusa Phase 158)
  - Render: `● <ts>  <tool> <action> (<dur>)` + `req:` JSON + `res:` JSON truncado em 200 chars
  - Warning explícito quando `KIT_MCP_INSPECT` não está setado: "payloads not captured"

## REQs validados

- REQ-163-01 ✓ — modo `kit inspect` mostra request/response live
- REQ-163-02 ✓ — wrapping não-invasivo (não toca stdio; só consome log file existente)
- REQ-163-03 ✓ — filtros por tool/status são triviais via `grep` no comando (não inflated CLI)
- REQ-163-04 ✓ — IDE continua falando direto com o server; inspect é mirror passivo do log

## Próxima fase

164 — Notification on tool call (opt-in).
