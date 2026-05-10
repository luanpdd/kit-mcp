# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.20 — Tech Debt Closure & Quality Hardening (Fases 100-105)

**Milestone:** v1.20 — Tech Debt Closure & Quality Hardening (fecha 6 itens parqueados pós-v1.19)
**Numeração de fases:** continua de v1.19 (último concluído: Fase 99) → v1.20 começa em **Fase 100**
**Total de fases:** 6 (Fases 100-105)
**Status:** 📋 PLANEJADO — 0/6 fases concluídas. Pronto para `/discutir-fase 100` ou `/planejar-fase 100`.
**Criado:** 2026-05-10
**Origem:** tech debt em [.planning/milestones/v1.19-MILESTONE-AUDIT.md](.planning/milestones/v1.19-MILESTONE-AUDIT.md). Continuação direta da v1.19 — eleva PRR 28→30/30 e estabelece mutation testing canônico.

### Phase 100: Coverage Ratchet 80% → 90% 📋

**Status:** PLANEJADA

**Goal:** Elevar CI line coverage threshold de 80% → 90%, identificando os arquivos abaixo do alvo e escrevendo testes targeted. Continuação direta da Phase 98 (v1.19, 75→80%).

**REQ:** INFRA-20-01

**Critérios de sucesso:**
- `.github/workflows/ci.yml` THRESHOLD atualizado 80 → 90.
- Top arquivos abaixo de 90% identificados via `node --experimental-test-coverage` parsing; cada um recebe testes targeted até alcançar ≥ 90%.
- Suite agregada cresce ≥ 30 testes vs baseline v1.19 (482 → ≥ 512).
- CI all-green pós-merge — coverage real ≥ 90% confirmado pelo gate.
- Stable API v1.0+ preservada (zero alterações em superfície de exports).

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

### Phase 102: Auto-snapshot em metrics-snapshot Tool 📋

**Status:** PLANEJADA

**Goal:** Tool MCP `metrics-snapshot` automaticamente persiste snapshot via `metrics.persistSnapshot()` em vez de exigir trigger manual externo. Comportamento idempotente — chamadas repetidas dentro de 1s não duplicam.

**REQ:** OBS-20-01

**Critérios de sucesso:**
- Handler MCP de `metrics-snapshot` invoca `persistSnapshot()` antes de retornar payload, dentro do mesmo handler.
- Idempotência garantida — segunda chamada dentro de 1s reusa o snapshot anterior (in-memory ts guard) sem escrever novo arquivo no disco.
- Regression tests cobrem: (a) primeira chamada persiste, (b) chamada < 1s reusa, (c) chamada > 1s persiste novo, (d) erro de fs não crasha o handler (graceful).
- `.planning/metrics/snapshots/` populado automaticamente em produção sem trigger manual.
- Stable API v1.0+ preservada — payload de retorno do tool mantém shape.

### Phase 103: Multi-window Burn-rate (1h fast + 6h slow) 📋

**Status:** PLANEJADA

**Goal:** Substituir single-window burn-rate (atual) por dual-window aplicando precisamente o skill `burn-rate-alerting` (lookahead/baseline fator 4×). SLOs YAML ganham campo `windows: { fast: <duration>, slow: <duration> }` com defaults `1h`/`6h`. `/burn-rate-status` calcula e exibe burn rate para ambas as janelas; status enum considera dual-window (fast em PAGE, slow em TICKET).

**REQ:** OBS-20-02

**Critérios de sucesso:**
- Schema YAML SLO aceita `windows: { fast, slow }` opcional com defaults `1h`/`6h` aplicados quando ausente.
- `kit/commands/burn-rate-status.md` calcula burn rate independente para janela fast e slow; tabela de output ganha colunas `fast_burn`, `slow_burn`, `fast_status`, `slow_status`.
- Status enum dual-window: PAGE quando `fast_burn ≥ 14.4` E `slow_burn ≥ 6` simultaneamente; TICKET quando `slow_burn ≥ 1` mas fast OK; WARN quando apenas fast ≥ 14.4 transitório.
- Regression tests cobrem ≥ 6 cenários (PAGE both, TICKET slow-only, WARN fast-only-transient, OK ambos baixos, no_data, defaults aplicados).
- `kit/skills/burn-rate-alerting/SKILL.md` cross-referenced ativamente; documentação inline aponta para fator 4× lookahead/baseline.

### Phase 104: PRR Emergency Axe 4/5 → 5/5 📋

**Status:** PLANEJADA

**Goal:** Elevar PRR Emergency axe de 4/5 → 5/5 via expansão do RUNBOOK.md com 3+ scenarios novos (boot failure, sidecar port collision, npm CVE rotation), cada um com Symptom→Diagnosis→Fix→Verification. Drill log template criado e populado com primeira entry.

**REQ:** SRE-20-01

**Critérios de sucesso:**
- `RUNBOOK.md` ganha ≥ 3 scenarios novos (boot failure, sidecar port collision, npm CVE rotation), cada um seguindo formato canônico Symptom→Diagnosis→Fix→Verification consistente com scenarios v1.18.
- `.planning/audits/v1.20/EMERGENCY-DRILL-LOG.md` criado a partir de template canônico, populado com 1 entry inicial (drill 2026-05 com timestamp + outcome).
- PRR re-projection registra Emergency axe 4/5 → 5/5 em `.planning/audits/v1.20/PRR-RECHECK.md` (ou nota inline equivalente).
- Schema regression tests do RUNBOOK (v1.18) continuam green com novos scenarios.
- Drill log template estabelece padrão pra futuros drills trimestrais.

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
