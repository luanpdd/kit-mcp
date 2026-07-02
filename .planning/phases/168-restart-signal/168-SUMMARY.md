# 168-SUMMARY.md — Restart signal formalizado (concluída)

**Entregue:** 2026-05-12

## O que mudou

- `handleAutoInstall` (Fase 167) agora escreve **dois marker files** após sync:
  - `.claude/.kit-mcp-version` — versão instalada (idempotência)
  - `.claude/.kit-mcp-restart-required` — JSON com `{version, previousVersion, writtenAt, reason}` indicando restart pendente
- **Novo tool `ack-restart`** com handler `handleAckRestart`:
  - Remove `.kit-mcp-restart-required` se presente
  - Resolve `projectRoot` via Fase 166 (MCP roots) ou explicit override
  - Retorna `{ok, projectRoot, acked, reason}` — `acked=false` se ENOENT (nada a fazer)
- O `_kit_action: 'session_restart_recommended'` + `_kit_reason` continuam no result do `auto-install` para sinal imediato; o marker é o sinal **persistido** entre sessões/reconexões.

## REQs validados

- REQ-168-01 ✓ — `_kit_action` no tool result quando há mudanças
- REQ-168-02 ✓ — marker `.kit-mcp-restart-required` criado/atualizado
- REQ-168-03 ✓ — `ack-restart` tool remove o marker
- REQ-168-04 ✓ — comportamento documentado (será refletido em README na release)

## Próxima fase

169 — MCP resources + `notifications/resources/updated` para hot-reload.
