# 167-SUMMARY.md — Auto-sync tool (concluída)

**Entregue:** 2026-05-12

## O que mudou

Novo tool MCP `auto-install` em `src/mcp-server/index.js`:

- **action=install** (default): sync para `.claude/agents/`, `.claude/skills/`, `.claude/commands/` (via `syncTo`), escreve marker `.claude/.kit-mcp-version`
- **action=check**: read-only drift report (installedVersion vs currentVersion vs inSync)
- **force=true**: re-escreve mesmo se já em sync
- **target**: claude-code (default), cursor, codex, etc.
- **projectRoot**: explícito > MCP roots (via Fase 166) > cwd fallback
- **`rootsSource`** no retorno: indica de onde veio o projectRoot (mcp-roots/cwd/explicit)

## Idempotência

Compara marker `.kit-mcp-version` com `PKG_VERSION` constante. Skip se igual e `force=false`. Permite re-conexão sem re-escrita.

## Restart signal (preview da Fase 168)

Retorno inclui `_kit_action: 'session_restart_recommended'` + `_kit_reason` legível quando install efetua mudanças. Próxima fase polished isso.

## REQs validados

- REQ-167-01 ✓ — tool `kit:auto-install`
- REQ-167-02 ✓ — idempotente via marker
- REQ-167-03 ✓ — fallback gracioso se cwd/projectRoot inválido (returns ok:false)
- REQ-167-04 ✓ — marker file escrito após sucesso
- REQ-167-05 ✓ — output completo com written, projectRoot, rootsSource, restartRecommended
- REQ-167-06 ✓ — action=check sem side effects

## Próxima fase

168 — Restart signal formalizado (marker file `.kit-mcp-restart-required`, `kit:ack-restart` tool).
