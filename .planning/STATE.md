---
state_version: 1.0
milestone: v1.20
milestone_name: — Tech Debt Closure & Quality Hardening
status: Phase 100 em andamento — Plan 100-01 concluído, 100-02 pendente
last_updated: "2026-05-10T18:30:00.000Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 12
  completed_plans: 1
---

# STATE.md

## Posição Atual

Fase: 100 (Coverage Ratchet 80% → 90%)
Plano: 100-01 ✅ concluído / 100-02 📋 pendente
Status: Plan 100-01 entregou 169 testes, 7/8 hot files ≥90% coverage; cli/index.js parou em 82.61% (trade-off documentado em SUMMARY)
Última atividade: 2026-05-10 — Plan 100-01 concluído, 9 commits atômicos

## Milestone ativo

**v1.20 Tech Debt Closure & Quality Hardening** — fechamento de 6 itens parqueados pós-v1.19. Target PRR 28→30/30, coverage 80→90%, mutation testing baseline. Fases 100-105 (6 fases, 1 REQ por fase).

## Roadmap

| Phase | REQ | Foco | Status |
|---|---|---|---|
| 100 | INFRA-20-01 | Coverage ratchet 80→90% | 🚧 1/2 planos |
| 101 | INFRA-20-02 | Mutation testing baseline (stryker) | 📋 |
| 102 | OBS-20-01 | Auto-snapshot em metrics-snapshot tool | 📋 |
| 103 | OBS-20-02 | Multi-window burn-rate (1h fast + 6h slow) | 📋 |
| 104 | SRE-20-01 | PRR Emergency 4/5 → 5/5 (RUNBOOK + drill log) | 📋 |
| 105 | SRE-20-02 | PRR Performance 4/5 → 5/5 (lazy-load + p95 sub-100ms) | 📋 |

## Decisões do Plan 100-01 (2026-05-10)

1. **Zero exports `__test` adicionais em src/** — preserva Stable API v1.0+ literal. Helpers privados testados end-to-end via fixtures.
2. **MCP server tests via SDK internals** (`server._requestHandlers` Map) em vez de spawn — pattern de mcp-error-envelope.test.js.
3. **`process.env.NO_COLOR='1'` setado ANTES de `await import(...)`** — `COLOR_ON` capturado em module-load.
4. **upgrade-check live network skipped em testes** — registry.npmjs.org pode ser flaky em CI; cache paths cobrem 93% do arquivo.
5. **src/cli/index.js capped at 82.61%** — paths remanescentes (kit watch, ui start, install write confirm, doctor version branches) requerem live spawn ou TTY interativo. Trade-off aceito; sugestão de extrair helpers para sibling module em fase futura para reabilitar in-process import.

## Métricas pós-Plan 100-01

- **Suite total:** 482 → 651 testes (+169, +35.1%)
- **Unit:** 373 → 542 (+169)
- **Integration:** 109 (unchanged)
- **All-files coverage:** 81.51% → 86.84% (+5.33 pp)
- **Files at ≥90%:** 7 dos 8 alvos (render 98.93, ui 95.68, upgrade-check 93.33, reflect 93.12, ui/client 100, reverse-sync 93.01, mcp-server 95.71)
- **Files abaixo:** cli/index.js 82.61% (uncovered são paths de spawn/TTY)
- **Pre-existing fail count:** unchanged (0); skip count unchanged (2)

## Contexto Acumulado (v1.19 e anteriores)

- v1.19.0 publicada 2026-05-09 (Maturidade Operacional)
- 7 releases em 2026-05-09 (v1.13→v1.19) = 21 fases entregues
- Stable API v1.0+ preservada cross-7-releases + Phase 100-01

## Quirk persistente

`gh auth switch --user luanpdd` é necessário ANTES de cada `git push` — wincred cache reverte para `in100tiva` (que não tem acesso ao luanpdd/kit-mcp).

## Próximo passo

Executar **Plan 100-02** — bump CI threshold em `.github/workflows/ci.yml` (atual 80 → 86 ou 80+nota dado que cli/index.js não atingiu 90%; decisão fica no plan-checker do 02).
