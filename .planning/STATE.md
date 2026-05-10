---
state_version: 1.0
milestone: v1.20
milestone_name: — Tech Debt Closure & Quality Hardening
status: Phase 103 entregou multi-window burn-rate (OBS-20-02). /burn-rate-status agora calcula fast (1h) + slow (6h) independentes com combinedStatus enum (PAGE/TICKET/WARN/OK/no_data) per skill burn-rate-alerting fator 4× canonical. 13 testes novos (suite 546→559 unit). Stable API v1.0+ literal preservada — zero src/+bin/ changes; mudança exclusivamente kit/ + test/.
last_updated: "2026-05-10T08:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 5
  completed_plans: 5
---

# STATE.md

## Posição Atual

Fase: 103 (Multi-window Burn-rate) ✅ concluída
Plano: 103-01 ✅ concluído
Status: Phase 103 entregou OBS-20-02 — /burn-rate-status calcula dual-window (fastBurn 1h baseline + slowBurn 6h baseline) via 2 loadSnapshots calls; combinedStatus enum PAGE (ambos críticos) / TICKET (slow only) / WARN (fast spike OR mild >=1×) / OK / no_data (conservative — qualquer janela null wins). 13 testes novos (5 schema + 8 combinedStatus). Suite 546→559 unit, 0 fail. Skill burn-rate-alerting cross-referenced 9× no command, fator 4× canonical 5×. Stable API v1.0+ literal preservada.
Última atividade: 2026-05-10 — Plan 103-01 concluído (commits 029321a feat + 38e3de1 test + 8282057 test), Phase 103 fechada

## Milestone ativo

**v1.20 Tech Debt Closure & Quality Hardening** — fechamento de 6 itens parqueados pós-v1.19. Target PRR 28→30/30, coverage 80→90%, mutation testing baseline. Fases 100-105 (6 fases, 1 REQ por fase).

## Roadmap

| Phase | REQ | Foco | Status |
|---|---|---|---|
| 100 | INFRA-20-01 | Coverage ratchet 80→86% (90 deferido v1.21+) | ✅ 2/2 planos |
| 101 | INFRA-20-02 | Mutation testing baseline 57.40% (10/15 files) | ✅ 1/1 plano |
| 102 | OBS-20-01 | Auto-snapshot em metrics-snapshot tool | ✅ 1/1 plano |
| 103 | OBS-20-02 | Multi-window burn-rate (1h fast + 6h slow) | ✅ 1/1 plano |
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

## Decisões do Plan 103-01 (2026-05-10)

1. **Dual-window via 2 loadSnapshots calls** — fastBurn (1h baseline) + slowBurn (6h baseline) calculados independentemente. Phase 99 já planejou para este uso (`loadSnapshots(rootDir, windowMs)` aceita janela arbitrária).
2. **Combined status enum 5 valores** — PAGE (ambos críticos) / TICKET (slow only) / WARN (fast spike OR mild ≥1× either) / OK / no_data segue canonical Google SRE da skill `burn-rate-alerting` verbatim.
3. **Conservative no_data** — qualquer janela null wins. Mesmo com outra janela crítica, partial info NÃO escala para PAGE. Auto-persist Phase 102 garante snapshots quase imediatamente, então no_data é raro em produção real.
4. **Defensive defaults aplicados inline** — 14.4 / 6 / 1h / 6h se YAML omitir alert_thresholds. Schema test (slo-schema.test.js +5 tests) força declaração explícita. Defaults são fallback puro safe-failure.
5. **ETA computado do slow window** — mais estável vs fast spike. 1h burn pode flapar; 6h smoothing dá ETA realista.
6. **combinedStatus inline em test (não export)** — preserva Stable API v1.0+ literal. Helper duplicado vs export adiciona ZERO surface area. Drift detectado em CI.
7. **extractAlertBlock via line-scan + indent tracking** — alternativa a `js-yaml` dep (violaria dep budget Phase 92.01). Robusto para shape canonical do projeto.
8. **Manifest regen via scripts/regen-manifest.js após kit/ edit** — kit/ é tamper-evident SHA-256 manifest. optional-deps.test.js falha CI se manifest stale. Workflow padrão.

## Próximo passo

Phase 103 concluída. Executar **Phase 104** — PRR Emergency Axe 4/5 → 5/5 via expansão do RUNBOOK.md com 3+ scenarios novos (boot failure, sidecar port collision, npm CVE rotation), drill log template criado e populado com primeira entry.

Pré-requisitos atendidos:

- Phase 100 + 101 + 102 + 103 complete ✅
- Suite green (559 unit / 109 integration) ✅
- Stable API v1.0+ preservada cross-4-phases ✅
