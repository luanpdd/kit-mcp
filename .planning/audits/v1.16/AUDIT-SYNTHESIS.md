# Meta-auditoria v1.16.0 — Síntese

**Data:** 2026-05-09T14:30Z
**Origem:** 5 agents paralelos sobre v1.16.0 HEAD (security, performance, code quality, test coverage, PRR re-conduct)
**Comparação:** v1.12.1 (auditoria original) → v1.16.0 (atual)

---

## Veredito agregado

| Auditoria | Resultado | Note |
|---|---|---|
| Security | **clean** | 17 hardenings sólidos; 1 minor B1 (CI deps budget) |
| Performance | **wins-confirmed** | 50.5%/52.4% reais; 2 novos P0 hotspots |
| Code Quality | **clean** | LOC controlado, zero TODO/console.log, 1 import morto trivial |
| Test Coverage | **comprehensive** | 26/26 REQs cobertos; 2 gaps menores |
| PRR | **22/30 (+2 vs v1.12.1)** | Instrumentation 2/5 ainda fail axe |

**4 releases (v1.13-v1.16) cumpriram o objetivo:** zero regressão, 23 items fechados, +203 testes, score PRR sobe.

---

## Backlog de tech debt para v1.17+

### P0 — High impact, low effort

1. **Paralelizar `verifyManifest`** (XS, ~1h) — Phase 88 paralelizou writes downstream mas verifyManifest upstream ficou serial. **47% do syncTo é gasto antes do batched loop começar**. Fix com Promise.all batches=16: −50ms/sync, −100ms/watch trigger.
2. **Diff-based sync** (M, ~1d) — `kit sync watch` re-syncs todos 323 files mesmo sem mudanças (163ms). Stat-based diff: ~150ms saved/re-sync (zero-edit case).

### P1 — Carry-over do PRR v1.12.1 (Instrumentation fail axe)

**Ironia:** kit-mcp ENSINA `four-golden-signals`, `event-based-slos`, `blameless-postmortems` mas não APLICA em si.

3. **Counter `tool_invocations_total`** — golden signal do próprio MCP server.
4. **`.planning/slos/` + SLO definitions** — applying skill `event-based-slos` ao próprio kit-mcp.
5. **`RUNBOOK.md`** — emergency response steps documentados.
6. **`FAILURE-MODES.md`** — top-down list de failure scenarios.

### P1 — Audit findings novos

7. **CI deps budget gate** (XS) — atualmente conta só `dependencies` (4); ignora `optionalDependencies` (2). Gate permitiria adicionar 2 deps em `dependencies` sem alarme.
8. **MCP server initialize→tool roundtrip integration test** (S) — gap de cobertura em `bin/mcp.js` happy path.
9. **Coverage tooling** (S) — `c8` ou `--experimental-test-coverage`; threshold gate em CI.
10. **JSDoc nos novos cores** (S) — `path-safety.js` e `manifest-verify.js` ganham doc equivalente a `error-redaction.js`.

### P2 — Polish

11. **`open` → `optionalDependencies`** (XS) — −36ms cold start, −68KB tarball.
12. **Cache `verifyManifest` result em-memória** (XS, TTL 30s) — −123ms/watch trigger 2º+.
13. **Paralelizar `regen-manifest.js`** (XS) — −100ms prepublishOnly.
14. **Remover import morto `getLocalVersion`** em `src/cli/index.js:33` (trivial).
15. **Extrair `runDoctorChecks`** em sub-helpers (Baixo) — testabilidade unitária.
16. **Mutation testing** (M) — `stryker-mutator` prova characterization quality.

---

## 3 caminhos sugeridos para v1.17

### Opção A — Performance Wave 2 + Quick Wins (3-4 fases, ~7-8h)

Foco em wins mensuráveis que users notam (sync, watch, cold start).

- Phase 90: verifyManifest paralelo + cache (P0)
- Phase 91: Diff-based sync (P0)
- Phase 92: Quick wins polish (open optional, getLocalVersion, regen-manifest parallel, JSDoc)
- Phase 93: CI deps gate fix + coverage tooling (P1)

**Win esperado:** +1 ponto PRR Performance (4→5), watch latency cai ~250ms cumulativo.

### Opção B — Eat Your Own Dog Food (4 fases, ~10-12h)

Auto-aplicar o que o kit ensina. Aborda o "fail axe" de Instrumentation do PRR.

- Phase 90: golden signals do MCP server (counter tool_invocations_total + Latency histogram)
- Phase 91: `.planning/slos/` com SLO definitions (event-based)
- Phase 92: `RUNBOOK.md` + `FAILURE-MODES.md` + `BENCHMARK.md`
- Phase 93: PRR re-conduct (target Instrumentation 2→4 ou 5)

**Win esperado:** +2-3 pontos PRR (Instrumentation 2→4-5). Story narrativa forte: "framework that practices what it preaches".

### Opção C — Mix (4 fases, ~9-10h)

- Phase 90: verifyManifest paralelo + diff-based sync (P0 perf)
- Phase 91: golden signals MCP server
- Phase 92: `.planning/slos/` + RUNBOOK
- Phase 93: Quick wins polish

**Win esperado:** +1 PRR Perf, +1 PRR Instrumentation, perf wins reais cumulativos.

---

## Recomendação

**Opção C (Mix)** equilibra wins pragmáticos (perf que user nota) com integridade conceitual (kit auto-aplica seu próprio ensino). Phase 90 entrega os 2 P0 perf imediatos; Phases 91-92 endereçam o fail axe Instrumentation que tá aberto desde v1.12.1; Phase 93 limpa polish items.

Score PRR projetado pós-v1.17: **24-25/30** (vs 22/30 atual).
