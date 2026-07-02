# REQUIREMENTS.md — v1.29 MCP-Native Discovery via Auto-Sync

> Milestone: v1.29 — MCP-Native Discovery via Auto-Sync
> Generated: 2026-05-12

## Objetivo

Resolver o gap entre "modo MCP puro" e "modo sync manual" — kit-mcp auto-configura `.claude/agents/`, `.claude/skills/`, `.claude/commands/` no primeiro contato com o host. Resultado: na próxima sessão o usuário tem `subagent_type` real, skills com auto-trigger nativo e slash-commands sem rodar `kit sync` na CLI.

## Princípios

- **P1 — Spec MCP intocável.** Apenas usar capabilities oficiais do protocolo (`roots`, `notifications`). Nada de extensões custom além do payload do retorno do tool.
- **P2 — Idempotência.** Reconnect não reescreve se `.claude/` já está em sync com a versão do kit em uso.
- **P3 — Permission gate honesto.** Primeira escrita em `.claude/` gera prompt do host. Não contornar.
- **P4 — Fallback gracioso.** Se host não declara `roots` ou `.claude/` não é gravável → fallback para modo MCP puro com aviso claro via tool result.
- **P5 — Stable API v1.0+ preservada.** Schema dos 7 tools existentes inalterado. Apenas adições opcionais em retornos.
- **P6 — Sem side effects no boot do MCP.** Auto-sync acontece em resposta à primeira tool call relevante (ou via tool dedicado), não no `startStdio()`.

## Requisitos por fase

### Fase 166 — MCP `roots` capability (S)

- **REQ-166-01** Servidor declara `roots` capability no handshake.
- **REQ-166-02** Servidor envia `roots/list` request para o cliente após `initialized` notification.
- **REQ-166-03** Servidor cacheia roots recebidos em memória; expõe via helper `getProjectRoots()` em `src/mcp-server/index.js`.
- **REQ-166-04** Tratar ausência de roots (host não suporta) silenciosamente — fallback para `process.cwd()`.
- **REQ-166-05** Listener para `notifications/roots/list_changed` (cliente sinaliza mudança de workspace) — atualiza cache.

### Fase 167 — Auto-sync no boot (M)

- **REQ-167-01** Novo tool `kit:auto-install` que dispara sync para `.claude/agents/`, `.claude/skills/`, `.claude/commands/` no projectRoot detectado.
- **REQ-167-02** Idempotente: lê `.claude/.kit-mcp-version` (marker file) e compara com `package.json` version. Skip se igual.
- **REQ-167-03** Permission gate: primeira chamada para criar diretório/escrever arquivo gera permission prompt no host. Se negado, retorna `{ ok: false, reason: 'permission_denied' }`.
- **REQ-167-04** Sync writes `.claude/.kit-mcp-version` com a versão atual após sucesso.
- **REQ-167-05** Output do tool inclui: `{ written, skipped, version, projectRoot, restart_recommended: true }`.
- **REQ-167-06** Sub-action `kit:auto-install action=check` — sem efeitos colaterais, só reporta drift. Útil para `kit doctor`.

### Fase 168 — Restart signal (S)

- **REQ-168-01** Todo tool result do MCP que escreveu em `.claude/` inclui campo `_kit_action: "session_restart_recommended"` com `reason` legível.
- **REQ-168-02** Marker file `.claude/.kit-mcp-restart-required` é criado/atualizado após auto-sync. Permite que `kit doctor` detecte "instalado mas não recarregado".
- **REQ-168-03** Marker é removido por outro tool `kit:ack-restart` que o host (ou usuário via CLI) chama após restart.
- **REQ-168-04** README ganha section "Após primeira instalação" explicando o flow esperado.

### Fase 169 — MCP `notifications/resources/updated` (M)

- **REQ-169-01** Quando `.claude/` é atualizado pelo auto-sync, servidor emite `notifications/resources/updated` para cada arquivo afetado.
- **REQ-169-02** Cada agent/skill/command vira um `resource` no servidor (`kit://agent/<name>`, `kit://skill/<name>`, `kit://command/<name>`).
- **REQ-169-03** `resources/list` retorna o índice; `resources/read` retorna o markdown completo.
- **REQ-169-04** Hosts que respeitam `resources/updated` recebem hot-reload (Claude Code atual não respeita ainda, mas spec está pronta).

### Fase 170 — Tool descriptions com keywords (XS)

- **REQ-170-01** Descrição do tool `kit` é enriquecida com lista de keywords de trigger: "Supabase, RLS, multi-tenant, agent, skill, characterization tests, observability, SLO, refactor, legacy code, …".
- **REQ-170-02** Garantir que descrição cabe em < 1024 chars (limite de alguns hosts).
- **REQ-170-03** Mesma melhoria aplicada nos outros 6 tools onde fizer sentido (`gates`, `forensics`, `metrics-snapshot`).
- **REQ-170-04** Modo MCP puro (sem `.claude/`) fica mais usável — Claude reconhece quando rotear via `kit get`.

### Fase 171 — `kit doctor` sync drift check (S)

- **REQ-171-01** Novo check em `runDoctorChecks`: compara `.claude/.kit-mcp-version` com `package.json` version.
- **REQ-171-02** Se drift detectado: `warn` com fix "rerun `kit auto-install` ou `kit sync claude-code`".
- **REQ-171-03** Se `.kit-mcp-restart-required` presente: `warn` "restart Claude Code para integração nativa".
- **REQ-171-04** Check funcional via `kit doctor --json` (integração CI/script).

## Cross-cutting

- **REQ-XC-01** Atualizar CHANGELOG entry v1.29 listando todas as fases.
- **REQ-XC-02** Atualizar README — section "O que a comunidade precisa saber" deve refletir o novo flow (auto-sync no first contact).
- **REQ-XC-03** Stable API v1.0+ preservada (16 → 17 releases).
- **REQ-XC-04** package.json bump 1.28.0 → 1.29.0.
- **REQ-XC-05** Smoke tests: cobertura ≥ 86% mantida.

## Total: 25 REQs (6 fases × ~4 REQs cada + 5 cross-cutting)
