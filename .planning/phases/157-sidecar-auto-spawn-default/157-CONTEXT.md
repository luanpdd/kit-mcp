# 157-CONTEXT.md — Sidecar UI auto-spawn ON por padrão

**Fase:** 157
**Milestone:** v1.28 UX & Onboarding
**Effort:** S
**Wave:** 1

## Dor

`autoSpawn: true` é opt-in por tool call. Usuário típico nunca o passa, então nunca vê o sidecar — que é o ÚNICO feedback visual do servidor MCP stdio.

## Decisão

Inverter o default: sidecar inicia no startup do `startStdio()`. Escape hatch `KIT_MCP_NO_UI=1` para CI/headless. Mantém `autoSpawn` por-tool-call funcionando (compatibilidade) mas torna desnecessário.

## Anti-pattern evitado

NÃO abrir o browser automaticamente (`openBrowserOnSpawn: false`) — abrir browser em IDE startup é intrusivo demais; sidecar fica disponível em `http://localhost:7878` mas usuário acessa quando quiser.

## REQs

- REQ-157-01 — auto-spawn no startup
- REQ-157-02 — `KIT_MCP_NO_UI=1` escape
- REQ-157-03 — exibe lista live de tools (já existe na implementação do sidecar)
- REQ-157-04 — lockfile-based discovery preservado (sem mudanças)
