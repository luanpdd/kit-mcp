---
state_version: 1.0
milestone: v1.20
milestone_name: — Tech Debt Closure & Quality Hardening
status: Phase 102 entregou auto-snapshot em metrics-snapshot MCP tool (OBS-20-01). handleMetricsSnapshot agora invoca persistSnapshot() com throttle 1s + graceful fs error. 4 regression tests novos (suite 542→546 unit). Stable API v1.0+ literal preservada — zero changes em signature/return shape. Side effect verificável live em integration tests.
last_updated: "2026-05-10T07:30:00.000Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 4
  completed_plans: 4
---

# STATE.md

## Posição Atual

Fase: 102 (Auto-snapshot em metrics-snapshot Tool) ✅ concluída
Plano: 102-01 ✅ concluído
Status: Phase 102 entregou OBS-20-01 — handleMetricsSnapshot auto-persiste via persistSnapshot() com throttle 1s in-memory + graceful fs error. 4 regression tests novos. Suite 542→546 unit, 0 fail. Stable API v1.0+ literal preservada (signature parameterless, return shape inalterado).
Última atividade: 2026-05-10 — Plan 102-01 concluído (commits cf0c492 + af4a2a7), Phase 102 fechada

## Milestone ativo

**v1.20 Tech Debt Closure & Quality Hardening** — fechamento de 6 itens parqueados pós-v1.19. Target PRR 28→30/30, coverage 80→90%, mutation testing baseline. Fases 100-105 (6 fases, 1 REQ por fase).

## Roadmap

| Phase | REQ | Foco | Status |
|---|---|---|---|
| 100 | INFRA-20-01 | Coverage ratchet 80→86% (90 deferido v1.21+) | ✅ 2/2 planos |
| 101 | INFRA-20-02 | Mutation testing baseline 57.40% (10/15 files) | ✅ 1/1 plano |
| 102 | OBS-20-01 | Auto-snapshot em metrics-snapshot tool | ✅ 1/1 plano |
| 103 | OBS-20-02 | Multi-window burn-rate (1h fast + 6h slow) | 📋 |
| 104 | SRE-20-01 | PRR Emergency 4/5 → 5/5 (RUNBOOK + drill log) | 📋 |
| 105 | SRE-20-02 | PRR Performance 4/5 → 5/5 (lazy-load + p95 sub-100ms) | 📋 |

## Decisões do Plan 100-01 (2026-05-10)

1. **Zero exports `__test` adicionais em src/** — preserva Stable API v1.0+ literal. Helpers privados testados end-to-end via fixtures.
2. **MCP server tests via SDK internals** (`server._requestHandlers` Map) em vez de spawn — pattern de mcp-error-envelope.test.js.
3. **`process.env.NO_COLOR='1'` setado ANTES de `await import(...)`** — `COLOR_ON` capturado em module-load.
4. **upgrade-check live network skipped em testes** — registry.npmjs.org pode ser flaky em CI; cache paths cobrem 93% do arquivo.
5. **src/cli/index.js capped at 82.61%** — paths remanescentes (kit watch, ui start, install write confirm, doctor version branches) requerem live spawn ou TTY interativo. Trade-off aceito; sugestão de extrair helpers para sibling module em fase futura para reabilitar in-process import.

## Decisões do Plan 100-02 (2026-05-10)

1. **THRESHOLD=86 em vez de THRESHOLD=90** (desvio estratégico documentado upstream) — Wave 1 mediu 86.84% com cli/index.js capped at 82.61%. Aplicar 90 quebraria main pós-merge; chegar a 90 exige `__test` exports que violam Stable API v1.0+.
2. **Raw 90% target diferido para v1.21+** — exit path documentado inline em ci.yml com 3 avenues: (a) Phase 101 stryker mutation gate como signal complementar, (b) Phase 105 extração de helpers cli/index.js, (c) branch coverage como 2º gate.
3. **Threshold history block estendido com tabela completa de uplift Wave 1** — futuros maintainers leem ci.yml diretamente; tabela inline economiza navegação back-and-forth para SUMMARY.
4. **REQ INFRA-20-01 marcado completo** — ratchet executado + 169 testes adicionados + suite cresceu 35.1% + threshold subiu. Raw "90% target" virou debt explícito v1.21+ com avenues canônicas, não fica invisível.

## Métricas pós-Phase 100 (Plan 100-01 + 100-02)

- **Suite total:** 482 → 651 testes (+169, +35.1%)
- **Unit:** 373 → 542 (+169)
- **Integration:** 109 (unchanged)
- **All-files coverage:** 81.51% → 86.84% (+5.33 pp)
- **CI line threshold:** 80% → 86% (ratchet honesto; 90 deferido v1.21+)
- **Files at ≥90%:** 7 dos 8 alvos (render 98.93, ui 95.68, upgrade-check 93.33, reflect 93.12, ui/client 100, reverse-sync 93.01, mcp-server 95.71)
- **Files abaixo:** cli/index.js 82.61% (uncovered são paths de spawn/TTY; capped por Stable API v1.0+ contract)
- **Pre-existing fail count:** unchanged (0); skip count unchanged (2)
- **Commits atomic em Phase 100:** 10 (9 em Plan 01 + 1 em Plan 02)

## Contexto Acumulado (v1.19 e anteriores)

- v1.19.0 publicada 2026-05-09 (Maturidade Operacional)
- 7 releases em 2026-05-09 (v1.13→v1.19) = 21 fases entregues
- Stable API v1.0+ preservada cross-7-releases + Phase 100-01

## Quirk persistente

`gh auth switch --user luanpdd` é necessário ANTES de cada `git push` — wincred cache reverte para `in100tiva` (que não tem acesso ao luanpdd/kit-mcp).

## Decisões do Plan 102-01 (2026-05-10)

1. **Throttle 1s in-memory (não persistido)** — janela conservadora vs polling típico ≥30s; reset on server restart aceitável vs adicionar fs read on every call. Documentado inline em src/mcp-server/index.js.
2. **Graceful fs error path** — try/catch ao redor de persistSnapshot(), stderr write para visibilidade do operator, handler retorna payload normalmente. Preserva contrato MCP em fs read-only / disk-full / permission errors.
3. **Stable API v1.0+ literal** — signature parameterless + return shape `{counters, latency}` inalterados. Mudança é side effect interno puro, transparente para clientes.
4. **Test access via SDK internals** (`server._requestHandlers.get('tools/call')`) — pattern de mcp-error-envelope.test.js (Phase 84.01) e mcp-server-paths.test.js (Phase 100.01). Zero exports novos.
5. **Cache-bust query string em dynamic import** para reset do `_lastAutoPersistTs` entre testes — ESM idiomatic; transitivamente reset os Maps de metrics.js também.
6. **Test 4 (fs error) via blocker file** — pre-criar `.planning` como arquivo regular força `fs.mkdir(.../snapshots)` a lançar ENOTDIR. Cross-platform (Windows + Linux + macOS), zero monkey-patch de ESM bindings.

## Próximo passo

Phase 102 concluída. Executar **Phase 103** — Multi-window Burn-rate (1h fast + 6h slow). SLOs YAML aceitam campo `windows: { fast, slow }` com defaults 1h/6h; `/burn-rate-status` calcula e exibe burn rate dual-window aplicando skill `burn-rate-alerting` (lookahead/baseline fator 4×). Phase 102 garante snapshots auto-populados — pré-requisito atendido.

Pré-requisitos atendidos:

- Phase 100 + 101 + 102 complete ✅
- Suite green (546 unit / 109 integration) ✅
- Stable API v1.0+ preservada cross-3-phases ✅
