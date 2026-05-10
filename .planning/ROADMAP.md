# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.20 — Tech Debt Closure & Quality Hardening (Fases 100-105)

**Milestone:** v1.20 — Tech Debt Closure & Quality Hardening (fecha 6 itens parqueados pós-v1.19)
**Numeração de fases:** continua de v1.19 (último concluído: Fase 99) → v1.20 começa em **Fase 100**
**Total de fases:** 6 (Fases 100-105)
**Status:** 🚧 EM ANDAMENTO — 5/6 fases concluídas (Phase 100, 101, 102, 103, 104 completas).
**Criado:** 2026-05-10
**Origem:** tech debt em [.planning/milestones/v1.19-MILESTONE-AUDIT.md](.planning/milestones/v1.19-MILESTONE-AUDIT.md). Continuação direta da v1.19 — eleva PRR 28→30/30 e estabelece mutation testing canônico.

### Phase 100: Coverage Ratchet 80% → 86% (90 deferred v1.21+) ✅

**Status:** CONCLUÍDA — 2/2 planos concluídos (2026-05-10)

**Goal:** Elevar CI line coverage threshold de 80% → 90%, identificando os arquivos abaixo do alvo e escrevendo testes targeted. Continuação direta da Phase 98 (v1.19, 75→80%).

**Resultado:** ratchet honesto 80→86 (não 80→90 como originalmente planejado) — Wave 1 mediu 86.84% com cli/index.js capped at 82.61% por limites estruturais (live spawn / interactive TTY); raising para 90 exigiria `__test` exports que violam Stable API v1.0+. Raw 90% target diferido para v1.21+ com 3 avenues canônicas documentadas inline em ci.yml: (a) stryker mutation gate via Phase 101, (b) cli/index.js helper extraction via Phase 105, (c) branch coverage como 2º gate.

**REQ:** INFRA-20-01 ✅ (completo — ratchet executado + tests added + suite grew 35.1% + threshold subiu)

**Critérios de sucesso:**
- `.github/workflows/ci.yml` THRESHOLD atualizado 80 → 86 ✅ (não 90 — deviation documentada em 100-02-SUMMARY).
- Top arquivos abaixo de 90% identificados via `node --experimental-test-coverage` parsing; cada um recebe testes targeted até alcançar ≥ 90%. ✅ (7/8 atingiram ≥ 90%; cli/index.js capped em 82.61% com rationale inline).
- Suite agregada cresce ≥ 30 testes vs baseline v1.19 (482 → ≥ 512). ✅ **Atingido: +169 (482→651, +35.1%)**
- CI all-green pós-merge — coverage real ≥ 86 confirmado pelo gate. ✅ (86.84% local; gate logic verificado)
- Stable API v1.0+ preservada (zero alterações em superfície de exports). ✅

**Progresso por plano:**
- ✅ **Plan 100-01** (concluído 2026-05-10) — 8 test files, 169 testes, 7/8 hot files ≥90% (cli/index.js parou em 82.61%, trade-off documentado em SUMMARY)
- ✅ **Plan 100-02** (concluído 2026-05-10) — bump CI threshold 80→86 com history block estendido + REQ tag INFRA-20-01 + future ratchet block para v1.21+ (commit ae8e807)

### Phase 101: Mutation Testing Baseline (stryker) 📋

**Status:** PLANEJADA

**Goal:** Adicionar `stryker-mutator` como dev dep, configurar `stryker.config.json` para `src/core/`, criar npm script `test:mutation`, documentar baseline mutation score em `.planning/audits/v1.20/MUTATION-BASELINE.md`. Não bloqueia CI nesta versão (gate v1.21+).

**REQ:** INFRA-20-02

**Critérios de sucesso:**
- `stryker-mutator` adicionado em `devDependencies` com versão pinada; budget de runtime deps inalterado.
- `stryker.config.json` configurado para `src/core/` (mutator scope), `node:test` runner, reporter local.
- `npm run test:mutation` executa Stryker e produz HTML report + JSON summary local-only.
- `.planning/audits/v1.20/MUTATION-BASELINE.md` documenta baseline mutation score com breakdown por arquivo top 5 + ToDo list pra v1.21+ gate.
- Não modifica CI workflow — execução opt-in local apenas.

### Phase 102: Auto-snapshot em metrics-snapshot Tool ✅

**Status:** CONCLUÍDA — 1/1 plano concluído (2026-05-10)

**Goal:** Tool MCP `metrics-snapshot` automaticamente persiste snapshot via `metrics.persistSnapshot()` em vez de exigir trigger manual externo. Comportamento idempotente — chamadas repetidas dentro de 1s não duplicam.

**Resultado:** handleMetricsSnapshot agora invoca persistSnapshot() automaticamente antes de retornar o payload in-memory, com throttle 1s in-memory (`_lastAutoPersistTs` guard) e graceful fs error handling (stderr log + handler returns payload). Stable API v1.0+ literal preservada — signature parameterless e return shape `{counters, latency}` inalterados. Side effect verificado live em integration tests (4 arquivos auto-criados em `.planning/metrics/snapshots/` durante test run).

**REQ:** OBS-20-01 ✅ (completo — handler modificado + 4 regression tests + suite cresceu 542→546 unit + Stable API preservada)

**Critérios de sucesso:**
- Handler MCP de `metrics-snapshot` invoca `persistSnapshot()` antes de retornar payload, dentro do mesmo handler. ✅
- Idempotência garantida — segunda chamada dentro de 1s reusa o snapshot anterior (in-memory ts guard) sem escrever novo arquivo no disco. ✅
- Regression tests cobrem: (a) primeira chamada persiste, (b) chamada < 1s reusa, (c) chamada > 1s persiste novo, (d) erro de fs não crasha o handler (graceful). ✅ (4/4 tests passing)
- `.planning/metrics/snapshots/` populado automaticamente em produção sem trigger manual. ✅ (verificado em integration tests)
- Stable API v1.0+ preservada — payload de retorno do tool mantém shape. ✅

**Progresso por plano:**
- ✅ **Plan 102-01** (concluído 2026-05-10) — handler modificado em src/mcp-server/index.js com throttle + graceful fs + 4 regression tests novos em test/unit/mcp-metrics-snapshot-auto-persist.test.js (commits cf0c492 + af4a2a7)

### Phase 103: Multi-window Burn-rate (1h fast + 6h slow) ✅

**Status:** CONCLUÍDA — 1/1 plano concluído (2026-05-10)

**Goal:** Substituir single-window burn-rate (atual) por dual-window aplicando precisamente o skill `burn-rate-alerting` (lookahead/baseline fator 4×). SLOs YAML já tinham `alert_thresholds.page` (1h/5m/14.4×) + `alert_thresholds.ticket` (6h/30m/6×); Phase 103 conecta o command a esses thresholds, calcula burn rate independente fast/slow, e introduz status enum combinado.

**Resultado:** `/burn-rate-status` agora chama `loadSnapshots()` 2× (fast 1h + slow 6h baselines) e renderiza tabela com colunas Fast (1h) / Slow (6h) / Combined explícitas. `combinedStatus()` inline JS implementa canonical Google SRE logic: PAGE (ambos críticos) / TICKET (slow only) / WARN (fast spike OR mild ≥1× either) / OK / no_data (conservative — qualquer janela null wins). Skill burn-rate-alerting cross-referenced 9× no command; fator 4× canonical 5× hits. Defensive defaults (14.4/6/1h/6h) aplicados se YAML omitir blocos. Stable API v1.0+ literal preservada — zero src/+bin/ changes; mudança exclusivamente kit/ + test/.

**REQ:** OBS-20-02 ✅ (completo — dual-window calc + 13 regression tests + skill cross-ref + defensive defaults)

**Critérios de sucesso:**
- Schema YAML SLO valida `alert_thresholds.page` + `.ticket` blocks (ordering invariants, canonical multipliers). ✅ (5 tests novos em slo-schema.test.js)
- `kit/commands/burn-rate-status.md` calcula burn rate independente para janela fast e slow; tabela de output ganha colunas `Fast (1h)`, `Slow (6h)`, `Combined`. ✅ (14 hits para fast_burn|slow_burn|fast_status|slow_status|combined_status)
- Status enum dual-window: PAGE (ambos críticos) / TICKET (slow only) / WARN (fast spike OR mild ≥1× either) / OK / no_data (conservative). ✅
- Regression tests cobrem ≥ 6 cenários canônicos (PAGE both, TICKET slow-only, WARN fast-only, WARN mild, OK steady, OK zero, no_data partial, custom multipliers). ✅ **Atingido: 8 tests** em burn-rate-calc.test.js (excede ≥6 mínimo)
- `kit/skills/burn-rate-alerting/SKILL.md` cross-referenced ativamente; documentação inline aponta para fator 4× lookahead/baseline. ✅ (9 hits skill, 5 hits fator 4×)
- Stable API v1.0+ preservada (zero alterações em src/+bin/). ✅

**Progresso por plano:**
- ✅ **Plan 103-01** (concluído 2026-05-10) — kit/commands/burn-rate-status.md rewrite + 5 schema tests + 8 combinedStatus tests + manifest regen (commits 029321a + 38e3de1 + 8282057). Suite 546→559 unit (+13).

### Phase 104: PRR Emergency Axe 4/5 → 5/5 ✅

**Status:** CONCLUÍDA — 1/1 plano concluído (2026-05-10)

**Goal:** Elevar PRR Emergency axe de 4/5 → 5/5 via expansão do RUNBOOK.md com 3+ scenarios novos (boot failure, sidecar port collision, npm CVE rotation), cada um com Symptom→Diagnosis→Fix→Verification. Drill log template criado e populado com primeira entry.

**Resultado:** RUNBOOK.md expandido 5 → 9 scenarios cobrindo CI coverage gate regression (Scenario 6, Phase 100), auto-snapshot persist failure (7, Phase 102), multi-IDE sidecar port collision (8, Phases 13/14+21), critical CVE blocks publish (9, Phase 92.01+89). Cada um segue canonical Symptom→Diagnosis→Fix→Verification (sub-section grep count exato 36 = 9 × 4). EMERGENCY-DRILL-LOG.md criado com canonical template + 2026-Q2 walkthrough (table-top, todos 9 scenarios PASS). PRR-RECHECK.md documenta v1.19 28/30 → v1.20 post-104 29/30 com Emergency +1 backed by 6 evidence points. Phase 105 (Performance) lifará Performance para 5/5 → final 30/30. Stable API v1.0+ literal preservada — zero src/+bin/+kit/agents+kit/commands diff.

**REQ:** SRE-20-01 ✅ (completo — RUNBOOK +4 scenarios + drill log + PRR re-projection + suite green)

**Critérios de sucesso:**
- `RUNBOOK.md` ganha ≥ 3 scenarios novos seguindo formato canônico Symptom→Diagnosis→Fix→Verification consistente com scenarios v1.18. ✅ **Atingido: 4 scenarios novos (excede ≥3 mínimo)**
- `.planning/audits/v1.20/EMERGENCY-DRILL-LOG.md` criado a partir de template canônico, populado com 1 entry inicial. ✅ **Atingido: 2026-Q2 entry table-top + canonical template**
- PRR re-projection registra Emergency axe 4/5 → 5/5 em `.planning/audits/v1.20/PRR-RECHECK.md`. ✅ **Atingido: 6-axis movement table com 6 evidence points para Emergency 4/5→5/5**
- Schema regression tests do RUNBOOK (v1.18) continuam green com novos scenarios. ✅ (suite all-green idêntica baseline; nenhum schema test específico do RUNBOOK detectado, mas full unit suite 559 sem regressão)
- Drill log template estabelece padrão pra futuros drills trimestrais. ✅ (canonical template inline + cadência trimestral declarada)

**Progresso por plano:**
- ✅ **Plan 104-01** (concluído 2026-05-10) — RUNBOOK +4 scenarios + EMERGENCY-DRILL-LOG.md + PRR-RECHECK.md (commits cf3bddb docs RUNBOOK + 1c11fd4 audit drill-log + 462a677 audit PRR-RECHECK). Doc-only phase — zero src/ + kit/agents + kit/commands + bin/ diff.

### Phase 105: PRR Performance Axe 4/5 → 5/5 📋

**Status:** PLANEJADA

**Goal:** Elevar PRR Performance axe de 4/5 → 5/5 via wins marginais finais — lazy-load completo das deps opcionais remanescentes (chokidar config tuning), MCP roundtrip p95 sub-100ms verificado em BENCHMARK.md.

**REQ:** SRE-20-02

**Critérios de sucesso:**
- Chokidar config (e demais deps opcionais identificadas) auditadas e tuned para lazy-load — eager imports residuais movidos para `await import()` dentro de handlers.
- MCP roundtrip p95 medido em ≤ 100ms via metrics module (latency histogram); registrado em `BENCHMARK.md` com timestamp e ambiente.
- `BENCHMARK.md` ganha entrada nova post-v1.20 com baselines verificados; comparação contra v1.18 baseline (144ms MCP p95) → ≥ 30% redução.
- PRR re-projection registra Performance axe 4/5 → 5/5; total PRR atinge **30/30**.
- Regression tests cold-start (v1.16) continuam green sob threshold ajustado se necessário.

<details>
<summary>✅ Concluídos</summary>

- v1.0.0 → v1.5.3 — early stabilization + patches
- v1.6.0 → v1.7.0 — Perf+lean
- v1.8.0 — Suíte Supabase
- v1.9.0 — Observabilidade
- v1.10.0 — SRE Engagement
- v1.11.0 — SRE Resilience & Release Engineering
- v1.12 — Legacy Code Mastery & AI-Era Refactoring
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — 11 REQs, 33 tests. [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)
- **v1.14.0 — Web/Core Security Hardening (Phases 82-84)** — 6 REQs HIGH, 63 tests. [Audit](./milestones/v1.14-MILESTONE-AUDIT.md)
- **v1.15.0 — DX & Token Economy Wave 2 (Phases 85-87)** — 5 REQs, 26 tests. [Audit](./milestones/v1.15-MILESTONE-AUDIT.md)
- **v1.16.0 — Performance Runtime Wave (Phases 88-89)** — 6 REQs, 18 tests. [Audit](./milestones/v1.16-MILESTONE-AUDIT.md)
- **v1.17.0 — Performance Wave 2 + Quick Wins (Phases 90-93)** — 9 REQs, 27 tests, PRR 22→24/30. [Audit](./milestones/v1.17-MILESTONE-AUDIT.md)
- **v1.18.0 — Eat Your Own Dog Food (Phases 94-97)** — 7 REQs, 74 tests, 418 baseline. PRR **27/30**. Fail axe Instrumentation fechado. [Audit](./milestones/v1.18-MILESTONE-AUDIT.md)
- **v1.19.0 — Maturidade Operacional (Phases 98-99)** — 5 REQs, 64 tests, 482 baseline. PRR **28/30**. Coverage 77.89→81.51%. Burn-rate live. [Audit](./milestones/v1.19-MILESTONE-AUDIT.md)

</details>
