# 161-SUMMARY.md — `kit init` onboarding (concluída)

**Entregue:** 2026-05-12

## O que mudou

Novo subcomando `kit init` em `src/cli/index.js` que orquestra 3 passos:

1. **installMcp** — registra kit-mcp em `.mcp.json` / config do IDE
2. **syncTo** — projeta `kit/` no layout do IDE (com tally written/skipped)
3. **runDoctorChecks** — health check completo, resumo `pass/warn/fail`

Final: "✓ <ide> now sees N skills, M agents, K commands"

## Flags

- `--ide <id>` — pular picker
- `--non-interactive` — falha se sem `--ide` (CI-safe)
- `--mode reference|copy`
- `--project-root <path>`

## REQs validados

- REQ-161-01 ✓ — comando interativo, detecta IDE via picker se omitido
- REQ-161-02 ✓ — output final com counts reais via `listKit()`
- REQ-161-03 ✓ — `--non-interactive --ide=<id>` para CI
- REQ-161-04 ✓ — idempotente (installMcp e syncTo já são idempotentes)

## Smoke test

```
$ kit init --non-interactive
✗ --non-interactive requires --ide=<claude-code|cursor|codex|gemini-cli|windsurf>

$ kit init --help                              # picker mostra opções
```

## Próxima fase

162 — `kit status` — metrics-snapshot CLI.
