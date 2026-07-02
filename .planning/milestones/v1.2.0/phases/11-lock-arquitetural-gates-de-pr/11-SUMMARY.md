# Phase 11: Lock arquitetural & gates de PR — Summary

**Concluída:** 2026-05-04
**Tipo:** Infraestrutura pura (decisão + CI gates, sem código de runtime)
**REQs entregues:** 2/2 (SEC-04, DOC-03 rascunho)

## Entregue

| Arquivo | Tipo | Conteúdo |
|---|---|---|
| `.planning/decisions.md` | ADR consolidado | 6 entries (ADR-01 a ADR-06) cobrindo porta, lockfile, idle, lifecycle, auto-spawn scope, sem-auth |
| `docs/sidecar-security.md` | Threat model (rascunho) | Trust boundary, 5 ataques mitigados, fora-de-escopo, trade-offs, melhorias futuras |
| `.github/workflows/ci.yml` | Workflow CI | Job `audit` novo com 2 steps: stdout discipline, dep budget |

## Como verificar

```bash
# ADR
cat .planning/decisions.md | head -30

# Threat model
cat docs/sidecar-security.md | head -30

# Gate stdout (negative test)
mkdir -p src/ui && echo 'console.log("x")' > src/ui/_t.js
grep -rn 'console\.log' src/ui/  # <-- pega
rm -rf src/ui

# Gate dep budget
node -e "console.log(Object.keys(require('./package.json').dependencies||{}).length)"
# atual: 5; budget v1.2: 6
```

## Decisões registradas

1. **Porta:** 7100-7199 com auto-fallback (não 7873 hardcoded)
2. **Lockfile:** `os.tmpdir()/kit-mcp-ui-<sha1(projectRoot)>.lock` com `O_EXCL` + probe signal-0
3. **Idle:** 30min default, flag `--idle-ms` (`0` = nunca)
4. **`kit ui start`:** foreground default (`--detach` parqueado pra v1.3)
5. **`--auto-spawn` MCP:** sync, reverse-sync, gates run; explicit-out em list/search/get/forensics/install
6. **Sem auth no v1.2:** mitigação compensatória (bind 127.0.0.1 + Host/Origin + CSP + path scrub + audit gate stdout)

## Próxima fase

Phase 12 — Fundações sem I/O (events + port + lockfile).

Components a criar:
- `src/ui/events.js` (schema, runId, makeEvent helper)
- `src/ui/port.js` (findFreePort range 7100-7199)
- `src/ui/lockfile.js` (acquireLock com O_EXCL, probeStale, releaseLock)

Tudo testável em isolamento, sem rede e sem fs cross-process. Audit gates da Phase 11 já vão estar armados pra falhar ao primeiro `console.log`.
