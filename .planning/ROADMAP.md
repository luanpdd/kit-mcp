# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Em andamento

## v1.17 — Performance Wave 2 + Quick Wins (Fases 90-93)

**Milestone:** v1.17 — Performance Wave 2 + Quick Wins (P0 hotspots novos da meta-auditoria v1.16 + polish items)
**Numeração de fases:** continua de v1.16 (último concluído: Fase 89) → v1.17 começa em **Fase 90**
**Total de fases:** 4 (Fases 90-93)
**Status:** Em andamento
**Criado:** 2026-05-09
**Origem:** meta-auditoria pós-v1.16.0 ([.planning/audits/v1.16/AUDIT-SYNTHESIS.md](.planning/audits/v1.16/AUDIT-SYNTHESIS.md), [.planning/audits/v1.16/PRR-REPORT.md](.planning/audits/v1.16/PRR-REPORT.md)). 2 P0 perf hotspots novos + polish de items P1/P2.
[Detalhes](./milestones/v1.17-ROADMAP.md)

### Phase 90: verifyManifest Parallel + Cache

**Goal:** Paralelizar SHA256 hashing em `manifest-verify.js` (47% do syncTo era serial) + cache em-memória com TTL 30s. Resolve maior bottleneck identificado pós-v1.16 (~50ms/sync, ~100-123ms/watch trigger).

**Escopo:**
- `src/core/manifest-verify.js` — substituir for-loop sequencial por `Promise.all` em batches de 16 (mesmo pattern de Phase 88.01 sync.js).
- Cache em-memória `verifyManifestCache` com chave=`kitRoot`, TTL 30s.
- Preservar CRLF→LF normalize fix (commit 0130c5b).

**Critérios de sucesso:**
- Benchmark `verifyManifest('kit')` em workspace 327 files: ≥40% redução wall time vs v1.16 baseline (123ms → ≤74ms target).
- Watch trigger consecutivo (2º+) usa cache → <5ms.
- Cache invalidation funcional em mismatch path (test).
- Suite continua passing + 4+ regression tests novos.

### Phase 91: Diff-Based Sync

**Goal:** Eliminar writes desnecessárias quando `kit sync` é re-rodado com kit já-sincronizado. Stat-based diff (mtime/size + opcional hash) skip files cujo destination já bate.

**Depends on:** Phase 90

**Escopo:**
- `src/core/sync.js` — em `syncTo()`, antes do batch loop, comparar source vs target via fs.stat (mtime + size). Skip ops onde já idênticos.
- Opt-out via env `KIT_MCP_FORCE_FULL_SYNC=1` (caso de cleanup/recovery).
- Preservar onProgress callback (chamar para skipped files também, com flag).

**Critérios de sucesso:**
- `kit sync install claude-code` 2× consecutive em workspace estável: 2ª vez ≤30% do tempo da 1ª (target ~49ms vs 163ms baseline).
- `KIT_MCP_FORCE_FULL_SYNC=1` força full sync (regression test).
- Edit em 1 file → next sync escreve apenas o file mudado (regression test).
- Suite passing + 4+ regression tests novos.

### Phase 92: Quick Wins Polish

**Goal:** Capturar 4 polish items identificados pela meta-auditoria — `open` para optionalDependencies, paralelizar regen-manifest.js, remover import morto, adicionar JSDoc.

**Depends on:** Phase 90

**Escopo:**
- `package.json` — mover `open` de `dependencies` para `optionalDependencies` (3 deps + 3 opt = 6 total).
- `src/ui/browser.js` — `await import('open')` já lazy. Adicionar fallback graceful se ausente.
- `scripts/regen-manifest.js` — paralelizar SHA256 hashing (mesmo Promise.all batches=16). −100ms prepublishOnly.
- `src/cli/index.js:33` — remover import morto `getLocalVersion` (Plan 89.01 deviation).
- `src/core/path-safety.js` + `src/core/manifest-verify.js` — adicionar JSDoc no padrão de `error-redaction.js`.

**Critérios de sucesso:**
- `open` em `package.json optionalDependencies` (não `dependencies`).
- Tarball npm reduz ≥30KB.
- `npm install --omit=optional` resulta em CLI core funcional sem `open`.
- regen-manifest.js benchmark mostra ≥40% speedup.
- `grep "getLocalVersion" src/cli/index.js` retorna 0 matches.
- JSDoc presente nos 2 helpers.
- Suite continua passing + 4+ regression tests.

### Phase 93: CI Deps Gate + Coverage Tooling

**Goal:** Fechar 2 gaps da meta-auditoria — CI deps budget gate ignora `optionalDependencies`, e ausência de coverage tooling impede surfacing de branches não-testadas.

**Depends on:** Phase 92

**Escopo:**
- `.github/workflows/ci.yml` — atualizar deps budget gate para somar `dependencies + optionalDependencies` (substituir literal 6 por cálculo dinâmico).
- `.github/workflows/ci.yml` — novo step usando `node --experimental-test-coverage` em test/unit; gerar coverage report; fail se line coverage < 75%.

**Critérios de sucesso:**
- CI gate aceita até `dependencies + optionalDependencies = 6` total; falha em 7+.
- Coverage report gerado em CI (Linux Node 22 single run).
- Coverage line% ≥75% (medido baseline + threshold).
- Workflow file passa YAML lint (runtime CI).
- Suite continua passing + 2+ regression tests sobre o gate.

<details>
<summary>✅ Concluídos</summary>

- v1.0.0 → v1.5.3 — early stabilization + patches
- v1.6.0 → v1.7.0 — Perf+lean
- v1.8.0 — Suíte Supabase
- v1.9.0 — Observabilidade
- v1.10.0 — SRE Engagement
- v1.11.0 — SRE Resilience & Release Engineering
- v1.12 — Legacy Code Mastery & AI-Era Refactoring
- **v1.13.0 — Security & Performance Hardening (Phases 79-81)** — 2026-05-09 09:24Z. 11 REQs, 33 tests. [Audit](./milestones/v1.13-MILESTONE-AUDIT.md)
- **v1.14.0 — Web/Core Security Hardening (Phases 82-84)** — 2026-05-09 11:46Z. 6 REQs HIGH, 63 tests. [Audit](./milestones/v1.14-MILESTONE-AUDIT.md)
- **v1.15.0 — DX & Token Economy Wave 2 (Phases 85-87)** — 2026-05-09 13:11Z. 5 REQs, 26 tests. [Audit](./milestones/v1.15-MILESTONE-AUDIT.md)
- **v1.16.0 — Performance Runtime Wave (Phases 88-89)** — 2026-05-09 14:17Z. 6 REQs, 18 tests. **Backlog meta-auditoria v1.12.1: 100% ZERADO**. [Audit](./milestones/v1.16-MILESTONE-AUDIT.md)

</details>
