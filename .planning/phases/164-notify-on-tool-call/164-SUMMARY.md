# 164-SUMMARY.md — Notification on tool call (concluída)

**Entregue:** 2026-05-12

## O que mudou

- **Novo módulo:** `src/core/notify.js`
  - `isNotifyEnabled()` — checa `KIT_MCP_NOTIFY=1|true`
  - `notify({title, body})` — throttle 5s (configurável via `KIT_MCP_NOTIFY_THROTTLE_MS`), spawn detached, never throws
  - Cross-platform: `osascript` (macOS), `notify-send` (Linux), PowerShell `NotifyIcon.ShowBalloonTip` (Windows)
  - Zero deps externas
- **Hook no MCP handler:** ambos paths (ok + error) chamam `notify()` quando enabled.
  - OK: `kit-mcp <tool>` / `<action> ok (<duration>ms)`
  - Error: `kit-mcp <tool> (error)` / `<error_type>`

## REQs validados

- REQ-164-01 ✓ — opt-in via `KIT_MCP_NOTIFY=1`
- REQ-164-02 ✓ — OS-level notification (sem node-notifier dep)
- REQ-164-03 ✓ — throttle 5s
- REQ-164-04 ✓ — graceful degradation (try/catch + spawn detached)

## Próxima fase

165 — `kit replay <id>`.
