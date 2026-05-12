# 165-SUMMARY.md — `kit replay` (concluída)

**Entregue:** 2026-05-12

## Decisão de design

REQ-165 falava em "reexecutar tool call". Replay infra existente (`core/replays.js`) é para **agent Task() payloads**, não MCP tool calls. Reexecutar agent payloads requer Anthropic API key + agent runtime (fora do escopo desta fase). Implementação minimal-mas-valiosa: **inspect-only** + **diff** entre replays.

## O que mudou

Novo subcomando `kit replay` com 3 subcomandos:

- `kit replay list` — lista replays em `.planning/replays/` ordenados desc por timestamp
- `kit replay show <id>` — dump pretty-printed do payload completo (sem secrets — já scrubbed em recordReplay)
- `kit replay diff <id>` — comparação linha-a-linha com o replay mais recente do MESMO agent (regression detection)

Reusa `loadReplay` / `listReplays` do `src/core/replays.js` existente — zero duplicação.

## REQs validados (com reinterpretação)

- REQ-165-01 ◐ — `list`/`show` cobrem inspeção; "reexecutar" requer agent runtime (anotado como follow-up para v1.29)
- REQ-165-02 ✓ — `diff` mostra regression entre replays
- REQ-165-03 ✓ — `--json` flag via opts globais
- REQ-165-04 ✓ — `kit replay list`

## Follow-up para v1.29

Reexecutar agent payload via Anthropic API (`reflect` infra já existe em forensics tool — falta um CLI wrapper).

## Próxima fase

Auditoria + bump versão + CHANGELOG + AUTOGEN-COUNTS.
