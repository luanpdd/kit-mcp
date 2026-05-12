# 159-SUMMARY.md — `kit doctor` enhancement (concluída)

**Entregue:** 2026-05-12

## Estado pré-fase

`kit doctor` JÁ EXISTIA com 7 checks: version, sidecar healthz, settings.json, observability hook, bundled kit dirs, .planning/, orphan lockfiles.

Por isso esta fase é **enhancement** (não rewrite). Adiciona 2 checks v1.28-specific:

## O que mudou

`src/cli/index.js::runDoctorChecks` ganha checks 8 e 9:
- **#8 log dir** — verifica `logDir()` writable via mkdir/probe/unlink, conta arquivos de log existentes
- **#9 sidecar auto-spawn** — informativo: `pass` se default, `warn` se `KIT_MCP_NO_UI=1` setado

## REQs validados

- REQ-159-01 ✓ — exit 0/1 mantido (já existia)
- REQ-159-02 ✓ — verifica servidor (sidecar healthz check existente), `.claude/` projetado (bundled kit + settings.json), versão IDE (settings.json valid), sidecar (existente), log dir (novo), auto-spawn config (novo)
- REQ-159-03 ✓ — output ✓/✗/⚠ + remediation hint mantido
- REQ-159-04 ✓ — `--json` flag mantida (era existente)

## Smoke test

```
$ kit doctor
✓ version v1.27.0 (latest)
✗ sidecar (esperado: não tem sidecar rodando agora)
✓ settings.json
✓ observability hook
✓ bundled kit
✓ .planning/
⚠ orphan lockfiles (35 stale — fix tem command list)
✓ log dir  C:\Users\in100\.kit-mcp\logs writable (1 log file)  ← NOVO v1.28
✓ sidecar auto-spawn  enabled (default)                       ← NOVO v1.28
```

## Próxima fase

160 — `kit sync` progress bar + diff sumário.
