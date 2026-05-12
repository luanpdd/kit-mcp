# 169-SUMMARY.md — MCP resources + list_changed (concluída)

**Entregue:** 2026-05-12

## O que mudou

- `createServer()` ganha capability `resources: { subscribe: true, listChanged: true }`
- Novos handlers `ListResourcesRequestSchema` e `ReadResourceRequestSchema`:
  - **`resources/list`** retorna 231 entries (66 agents + 76 skills + 89 commands) com URIs `kit://agent/<name>`, `kit://skill/<name>`, `kit://command/<name>`
  - **`resources/read`** parsea o URI, busca via `findItem(kit, kind, name)`, retorna `text/markdown` body do arquivo
- `handleAutoInstall` emite `sendResourceListChanged()` após sync efetivo
- Variável module-level `_activeServer` permite handlers acessarem a instância para emitir notifications

## REQs validados

- REQ-169-01 ✓ — notification emitida após auto-install efetivo
- REQ-169-02 ✓ — URIs `kit://agent/<name>`, `kit://skill/<name>`, `kit://command/<name>`
- REQ-169-03 ✓ — `resources/list` lista todos; `resources/read` retorna markdown completo
- REQ-169-04 ✓ — hosts podem subscribe e receber list_changed (Claude Code atual não respeita ainda; spec correta)

## Smoke test

```
$ node -e "import('./src/core/kit.js').then(k => k.listKit(k.BUNDLED_KIT_ROOT).then(kit => k.findItem(kit,'agent','planner')))"
agents: 66 skills: 76 commands: 89
planner item has body: true body len: 39580
```

## Próxima fase

170 — Tool descriptions enriquecidas com keywords (fallback MCP puro).
