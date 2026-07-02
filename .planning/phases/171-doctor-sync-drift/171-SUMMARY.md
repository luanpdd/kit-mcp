# 171-SUMMARY.md — `kit doctor` sync drift check (concluída)

**Entregue:** 2026-05-12

## O que mudou

`runDoctorChecks` em `src/cli/index.js` ganha **2 novos checks**:

- **auto-install** — compara `.claude/.kit-mcp-version` com `package.json` version:
  - `pass` se em sync
  - `warn` "kit não auto-instalado" se marker ausente, fix=`call kit:auto-install MCP tool`
  - `warn` "v1.28 installed, v1.29 running" se drift, fix=`call kit:auto-install (idempotente)`
- **restart pending** — verifica `.claude/.kit-mcp-restart-required`:
  - Não aparece se marker ausente (nada a reportar)
  - `warn` com `reason` + `writtenAt` do JSON marker se presente
  - fix=`restart IDE then call kit:ack-restart`

## REQs validados

- REQ-171-01 ✓ — comparação marker vs PKG_VERSION
- REQ-171-02 ✓ — `warn` com fix actionable
- REQ-171-03 ✓ — restart marker detectado
- REQ-171-04 ✓ — funciona via `kit doctor --json` (já existente)

## Smoke test

```
$ kit doctor
... (9 checks anteriores)
⚠ auto-install
   .claude/.kit-mcp-version not found — kit not auto-installed in this project
   fix: call kit:auto-install MCP tool, or run: kit init
```

Comportamento esperado: depois de chamar `kit:auto-install` via MCP em outro projeto, este check vira `pass` e `restart pending` warn aparece até `kit:ack-restart` ser chamado.

## Próxima ação

Release v1.29.0 — bump version, CHANGELOG, tag.
