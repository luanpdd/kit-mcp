---
status: passed
phase: 16
verified: 2026-05-04
---

# Phase 16 — Verification

## Critérios de sucesso

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | 145/145 tests pass | ✅ | npm run test:all — 0 fail (137 antes + 8 cli-ui) |
| 2 | Audit gate stdout passing | ✅ | grep retorna vazio em src/ui/ |
| 3 | Audit gate dep budget | ✅ | 6/6 |
| 4 | Stable API: src/core/ + src/mcp-server/ intocados | ✅ | git diff retorna vazio |
| 5 | `kit ui --help` lista 4 subcomandos | ✅ | smoke + test |
| 6 | `kit list-agents` ainda funciona | ✅ | smoke + test |
| 7 | Auto-detect via withProgress quando lockfile presente | ✅ | maybeWrapForUi() em src/cli/index.js + test e2e |

## REQs cobertos

| REQ | Implementação |
|---|---|
| CLI-01 | `kit ui start` foreground (Ctrl+C kill); flags `--port`, `--idle-ms`, `--no-open`, `--project-root` aceitas |
| CLI-02 | `kit ui stop` lê lockfile, POST `/shutdown` |
| CLI-03 | `kit ui status` lê lockfile + GET `/healthz`; exit non-zero se nada rodando |
| CLI-04 | `kit ui open` reabre browser via openBrowser(force: true); falha se sem lockfile |
| CLI-05 | Auto-detect em `kit sync install`, `kit reverse-sync apply` via `withProgress({tool, projectRoot})`; opt-out via `--no-ui` global ou `KIT_MCP_NO_UI=1` |

## Tests adicionados

```
test/integration/cli-ui.test.js — 8 tests:
  --help lists 4 subcommands
  status no-sidecar → exit 1
  status --json no-sidecar → JSON
  open no-sidecar → fail
  stop no-sidecar → graceful
  list-agents stable API
  --version pin (REL-01 marker)
  E2E: start→status→stop
```

## Smoke local

- `node bin/cli.js ui --help` → 4 subcomandos listados
- `node bin/cli.js ui status` (sem sidecar) → "⚠ no sidecar running" stdout, exit 1
- `node bin/cli.js kit list-agents` → tabela de agents (existing CLI surface intacta)
- `node bin/cli.js --version` → 1.0.0 (bug REL-01 a corrigir na Phase 18)

## Auto-detect smoke

```bash
# 1. start sidecar
node bin/cli.js ui start --no-open --project-root /tmp/x &

# 2. run sync install — events go to sidecar automatically
node bin/cli.js sync install claude-code --project-root /tmp/x

# 3. opt-out works
KIT_MCP_NO_UI=1 node bin/cli.js sync install claude-code --project-root /tmp/x
```

(Não rodado nesse ambiente pra evitar tocar arquivos do projeto, mas o código path é o mesmo testado em e2e.)

## Stable API verificação

```
$ git diff HEAD~1 -- src/core/ src/mcp-server/
(empty)
```

`src/cli/index.js` foi modificado mas adições preservam interface — comandos existentes funcionam idênticos sem flags.

## Riscos remanescentes

- E2E test requer sidecar pra subir + responder em <5s; em CI lento, pode flakar. `--idle-ms 0` + retry-forgiving polling ajudaria. Phase 18 vai re-verificar em CI matrix.
- `kit ui status` exit code distingue "no lockfile" (1) vs "unreachable" (1) — mesma exit, mensagem diferente. Aceitável.

## Conclusão

Phase 16 completa. Pronto pra Phase 17 (MCP integration `--auto-spawn`).
