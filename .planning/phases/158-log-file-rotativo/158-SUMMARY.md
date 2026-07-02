# 158-SUMMARY.md — Log file rotativo + `kit logs` (concluída)

**Entregue:** 2026-05-12

## O que mudou

- **Novo módulo:** `src/core/logger.js` (JSONL append-only, date-rotated)
  - `logEvent({tool, action, args_size, result_size, duration_ms, status, error_type})` — sync append, fire-and-forget caller-side
  - `listLogs()`, `tailLogs({lines, follow, onLine})`, `currentLogPath()`, `logDir()`
  - Retention configurável via `KIT_MCP_LOG_RETENTION_DAYS` (default 7, `0` = forever)
  - Log dir override via `KIT_MCP_LOG_DIR` (default `~/.kit-mcp/logs`)
- **MCP handler hookup:** `src/mcp-server/index.js` `CallToolRequestSchema` agora chama `logEvent` em ambos paths (ok + error), com `args_size`, `result_size`, `duration_ms`, `status`, `error_type`. Try/catch silenciado — logging nunca quebra handler.
- **CLI:** novo subcomando `kit logs [--tail N] [--follow] [--path]`
  - Render padrão: `<ts> ✓ <tool> [<action>] <duration>ms`
  - `--json` (flag global) preserva linha JSONL crua
  - `--follow` faz polling 250ms da current-day file

## REQs validados

- REQ-158-01 ✓ — JSONL em `~/.kit-mcp/logs/kit-mcp-YYYY-MM-DD.log`
- REQ-158-02 ✓ — rotação diária + retention 7d configurável
- REQ-158-03 ✓ — `kit logs --tail N --follow`
- REQ-158-04 ✓ — campos canônicos (ts, pid, tool, action, args_size, result_size, duration_ms, status, error_type)

## Smoke test

```
$ node -e "import('./src/core/logger.js').then(m=>m.logEvent({tool:'test',action:'smoke',status:'ok',duration_ms:1}))"
$ kit logs --tail 5
2026-05-12 11:30:21.929  ✓ test [smoke] 1ms
```

## Próxima fase

159 — `kit doctor` — **NOTA:** comando `kit doctor` JÁ EXISTE em `src/cli/index.js:508`. Fase 159 será de **enhancement** (acrescentar checks para v1.28 features: log dir writable, sidecar auto-spawn working) e não rewrite from scratch.
