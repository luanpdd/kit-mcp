# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.16 — Performance Runtime Wave (Fases 88-89)

**Milestone:** v1.16 — Performance Runtime Wave (fecha P1-P6 da meta-auditoria — last batch de tech debt da v1.12.1)
**Numeração de fases:** continua de v1.15 (último concluído: Fase 87) → v1.16 começa em **Fase 88**
**Total de fases:** 2 (Fases 88-89)
**Status:** Em andamento
**Criado:** 2026-05-09
**Origem:** P1-P6 listados no audit performance da meta-auditoria de v1.12.1 (não tocados nas waves de segurança/tokens/drift v1.13-v1.15).
[Detalhes](./milestones/v1.16-ROADMAP.md)

### Phase 88: Concurrent I/O

**Goal:** Eliminar 3 bottlenecks de I/O sequencial — sync.js writes sequenciais, watch.js cache invalidation sem debounce, reverse-sync walks duplos sequenciais.

**Escopo:**
- `src/core/sync.js` — `syncTo()` paraleliza file writes via `Promise.all` em batches de 16 (preservando `onProgress` callback semantics) (P1).
- `src/core/watch.js` — debounce de 500ms na invalidação de cache via chokidar (P3).
- `src/core/reverse-sync.js` — paralelizar walks (kit/ + target/) via `Promise.all` em vez de sequential (P4).

**Critérios de sucesso:**
- Benchmark `kit sync install claude-code` antes/depois mostra ≥30% redução wall time em workspace típico.
- `kit sync watch` em modo edit-burst (10 saves rápidos) chama `clearKitCache` no máximo 1× por 500ms.
- reverse-sync detect time reduzido em ≥10% (medido).
- Suite continua passing + 6+ regression tests novos.
- Nenhuma race condition introduzida (test simulando edits concorrentes).

**Plans:** 3 plans (paralelos — Wave 1)

Plans:
- [x] 88-01-sync-promise-all-PLAN.md — syncTo() Promise.all em batches (PERF-16-01)
- [x] 88-02-watch-debounce-PLAN.md — watch debounce 500ms + clearKitCache invalidation (PERF-16-02)
- [x] 88-03-reverse-sync-parallel-PLAN.md — detectReverse() scans paralelos (PERF-16-03)

### Phase 89: Lazy Imports & Optional Deps

**Goal:** Reduzir cold start do CLI e lighten tarball ao deferrir imports só-quando-necessários — `@inquirer/prompts` e `chokidar` viram `optionalDependencies`, UI stack é dynamic-imported.

**Depends on:** Phase 88

**Escopo:**
- `src/cli/index.js` — substituir top-level imports de `src/ui/*`, `chokidar`, `@inquirer/prompts` por dynamic `await import()` dentro dos subcommands que usam (P2).
- `package.json` — mover `@inquirer/prompts` e `chokidar` de `dependencies` para `optionalDependencies` (P5+P6); ainda instalados por default mas falha graceful se ausentes.
- Graceful fallback messages se optional dep ausente (ex: "kit ui requer chokidar; rode `npm i chokidar`").

**Critérios de sucesso:**
- `kit kit list-agents --terse` cold start ≥30% mais rápido (medido benchmark).
- `npm install --omit=optional` resulta em CLI core funcional (apenas commands que precisam de ui/inquirer/chokidar falham com mensagem descritiva).
- `package.json` move 2 deps para `optionalDependencies`.
- Tarball npm reduz ≥5% (medido `npm pack --dry-run`).
- Suite continua passing + 4+ regression tests.

**Plans:** 2 plans (paralelos — Wave 1)

Plans:
- [x] 89-01-cli-lazy-imports-PLAN.md — CLI lazy imports de UI sidecar (PERF-16-04)
- [ ] 89-02-optional-dependencies-PLAN.md — @inquirer/prompts + chokidar como optionalDependencies (PERF-16-05 + PERF-16-06)

<details>
<summary>✅ Concluídos</summary>

- v1.0.0 — Estabilização (5 fases) — `.planning/milestones/v1.0.0/`
- v1.1.0 — Feedback visual no terminal (5 fases) — `.planning/milestones/v1.1.0/`
- v1.2.0 — GUI sidecar (8 fases) — `.planning/milestones/v1.2.0/`
- v1.3.0 → v1.5.3 — patches ad-hoc (CHANGELOG canônico)
- v1.6.0 — Perf+lean (Phases 19-21) + observability hook
- v1.6.1 — DX patch (kit doctor + upgrade-check + gates cache)
- v1.7.0 — Perf+lean part 2 (Phases 22-24) + UX naming canonical
- v1.8.0 — Suíte Supabase (Phases 25-28)
- v1.9.0 — Observabilidade (Phases 29-35)
- v1.10.0 — SRE Engagement (Phases 36-41)
- v1.11.0 — SRE Resilience & Release Engineering (Phases 42-47)
- v1.12 — Legacy Code Mastery & AI-Era Refactoring (Phases 48-78) — entregue out-of-band
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — entregue 2026-05-09 09:24Z. 11 REQs, 33 testes, 210 baseline. [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)
- **v1.14.0 — Web/Core Security Hardening (Phases 82-84)** — entregue 2026-05-09 11:46Z. 6 REQs HIGH, 63 testes, 273 baseline. [Audit](./milestones/v1.14-MILESTONE-AUDIT.md)
- **v1.15.0 — DX & Token Economy Wave 2 (Phases 85-87)** — entregue 2026-05-09 13:11Z. 5 REQs (PERF-15-01..02, DX-15-01..03), 26 testes, 299 baseline. [Audit](./milestones/v1.15-MILESTONE-AUDIT.md)

</details>
