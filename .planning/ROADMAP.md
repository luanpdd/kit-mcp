# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.19 — Maturidade Operacional (Fases 98-99)

**Milestone:** v1.19 — Maturidade Operacional (fecha tech debt remanescente do v1.18)
**Numeração de fases:** continua de v1.18 (último concluído: Fase 97) → v1.19 começa em **Fase 98**
**Total de fases:** 2 (Fases 98-99)
**Status:** Em andamento — 1/2 fases completas (Phase 98 ✅)
**Criado:** 2026-05-09
**Origem:** tech debt em [.planning/milestones/v1.18-MILESTONE-AUDIT.md](.planning/milestones/v1.18-MILESTONE-AUDIT.md). Continuação direta da v1.18 — opera com observability infra criada.

### Phase 98: Coverage Ratchet 75% → 80% ✅

**Status:** CONCLUÍDA 2026-05-09 ([SUMMARY](./phases/98-coverage-ratchet-80/98-01-SUMMARY.md))

**Goal:** Subir threshold 75% → 80%. Endereçar 2 hot files restantes: `src/ui/auto-spawn.js` (56.64%) e `src/cli/index.js` (55.26%).

**Resultado:**
- auto-spawn.js: 56.64% → **87.61%** (+31 pp) — 7 tests
- cli/index.js: 54.85% → **75.07%** (+20 pp) — 26 tests
- Overall: 77.89% → **81.51%** (+3.62 pp)
- Threshold ci.yml: 75 → **80** (REQ INFRA-19-01)
- Suite: +33 tests (target era ≥10), 340 unit + 109 integration green

**Escopo entregue:**
- `test/unit/auto-spawn-paths.test.js` (NOVO, 203 LOC) — race-style stale lockfile + healthzOk timeout/error edge.
- `test/unit/cli-subcommands.test.js` (NOVO, 501 LOC) — subcommands raros + runCLIAsync helper para mock HTTP + subprocess concurrency.
- `.github/workflows/ci.yml` — THRESHOLD=80, REQ tag estendido.

### Phase 99: Metrics Retention + Burn-rate Calculator

**Goal:** Wire skill `burn-rate-alerting` ao `/burn-rate-status` consumindo SLOs reais. Persistir metrics em `.planning/metrics/snapshots/` rolling.

**Depends on:** Phase 98

**Escopo:**
- `src/core/metrics.js` — adicionar `persistSnapshot(rootDir)` + `loadSnapshots(rootDir, windowMs)`.
- `.planning/metrics/snapshots/` — diretório JSON timestamped (gitignored, dev-only).
- `kit/commands/burn-rate-status.md` — consume snapshots + SLOs YAML; tabela ETA exhaustão.
- Cleanup snapshots > 30d.
- Test fixtures sintéticos.

**Critérios de sucesso:**
- `persistSnapshot()` cria JSON em `.planning/metrics/snapshots/<timestamp>.json`.
- `loadSnapshots(window)` filtra por timestamp.
- `/burn-rate-status` exibe SLI atual vs target.
- Cleanup automático.
- Suite passing + 4+ regression tests.

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

</details>
