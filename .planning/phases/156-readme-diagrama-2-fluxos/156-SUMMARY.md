# 156-SUMMARY.md — README diagrama 2 fluxos (concluída)

**Entregue:** 2026-05-12

## O que mudou

- README.md ganhou nova section "## How kit-mcp works (mental model)" entre "Why this exists" e AUTOGEN-COUNTS
- 2 diagramas ASCII (Flow A projetor offline + Flow B servidor MCP stdio)
- Tabela "When do I use what?" com 5 colunas e 5 linhas cobrindo install/sync/IDE-runtime/diagnose/debug
- Subsection "Why no terminal output when I run `kit-mcp`?" explicando spec MCP + 4 ponteiros para tools v1.28+
- Comando teste raw incluído (`echo ... | npx kit-mcp`) para verificação imediata

## REQs validados

- REQ-156-01 ✓
- REQ-156-02 ✓
- REQ-156-03 ✓

## Próxima fase

157 — Sidecar UI auto-spawn ON por padrão.
