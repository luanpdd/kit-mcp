# 160-SUMMARY.md — `kit sync` progress + diff sumário (concluída)

**Entregue:** 2026-05-12

## O que mudou

- `src/cli/index.js` — `sync install` command:
  - Adicionado `--quiet` para suprimir progress bar (mantém sumário final)
  - Hook `wrapOnProgress` conta `written` vs `skipped` por op
  - `result._tally` injetado para consumo do renderer
- `src/cli/render.js` — `renderSyncInstall`:
  - Adiciona duas rows: `new / updated` (W) + `unchanged` (Z) usando `result._tally`
  - Mantém Stable API: shape original do `result` intocado, tally é additive

## REQs validados

- REQ-160-01 ✓ — progress bar (existente via `withProgress` mantida; `--quiet` para suprimir)
- REQ-160-02 ✓ — diff sumário "new/updated" + "unchanged" no final
- REQ-160-03 ✓ — `--quiet` flag
- REQ-160-04 ✓ — zero deps novas (reusa `progress()` do `core/ui.js`)

## Smoke test

```
$ kit sync install claude-code --dry-run --project-root .
✓ Syncing kit → claude-code
  rules             1
  agents           66
  commands         89
  skills           76
  framework       134
  hooks             7
  new / updated     0    ← NOVO v1.28
  unchanged         0    ← NOVO v1.28
  Total: 373
```

## Próxima fase

161 — `kit init` onboarding interativo.
