# 162-SUMMARY.md — `kit status` (concluída)

**Entregue:** 2026-05-12

## O que mudou

Novo subcomando `kit status` em `src/cli/index.js` exibindo:
- sidecar status (running/not running + port)
- log file path atual + count de arquivos no log dir
- latência p50/p95/p99 por tool (última hora via persisted snapshots, fallback in-process)
- error rate agregado (ok/total)

Reusa `core/metrics.js::snapshot` e `loadSnapshots` sem duplicar lógica.

## REQs validados

- REQ-162-01 ✓ — p50/p95/p99/error_rate última hora
- REQ-162-02 ✓ — sidecar status, log file path, count de arquivos
- REQ-162-03 ✓ — `--json` flag (via `program.opts().json`)
- REQ-162-04 ✓ — reusa `src/core/metrics.js`

## Próxima fase

163 — `kit mcp --inspect` TUI dev mode.
