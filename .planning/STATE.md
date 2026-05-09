---
state_version: 1.0
milestone: v1.18
milestone_name: — Eat Your Own Dog Food
status: in_progress
last_updated: "2026-05-09T16:16:47Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 4
  completed_plans: 1
---

# STATE.md — sessão atual

## Posição Atual

Fase: 94 — Golden Signals MCP Server (OBS-18-01/02) — **CONCLUÍDA**
Status: Phase 94 completa (1/1 plan); v1.18 milestone 1/4 fases
Última atividade: 2026-05-09T16:16Z — Phase 94.01 executado (plan+execute combinado); 359 tests pass (259 unit + 98 integration + 2 skip); +15 novos tests; metrics module + metrics-snapshot tool aplicado four-golden-signals skill ao próprio MCP server; zero deps novas

## Milestone ativo

**v1.18 Eat Your Own Dog Food** — primeira release pós v1.17 que dogfooda as próprias skills SRE/Observabilidade no kit-mcp.

**4 fases (94-97):**

- Phase 94 ✅ — Golden Signals MCP Server (OBS-18-01/02)
- Phase 95 ⏭ — TBD
- Phase 96 ⏭ — TBD
- Phase 97 ⏭ — TBD

## Próximo passo

1. Avançar para Phase 95 (próxima do milestone v1.18)

## Bloqueadores

(nenhum)

## Histórico

- v1.13.0 → v1.16.0 — 4 releases publicadas em 2026-05-09 fechando backlog meta-auditoria de v1.12.1
- **v1.17 — em andamento**

## Contexto Acumulado

v1.17 é a **primeira release pós-zerada-meta-auditoria-original**. Origem é nova meta-auditoria (5 agents) sobre v1.16.0. Score PRR projetado: 22 → 24/30.

Stable API v1.0+ preservada. Budget total 6 deps mantido (Phase 92 reorganiza: 3 deps + 3 optional).

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Tests Added |
|-------|------|----------|-------|-------|-------------|
| 90 | 01 | ~3.5min | 3 | 2 | 5 |
| 91 | 01 | ~6min | 3 | 2 | 4 |
| 92 | 01 | ~7min | 4 | 8 | 7 (new) |
| 93 | 01 | ~7.5min | 3 | 3 | 9 (new) |
| 94 | 01 | ~6.8min | 3 | 5 | 15 (new) |

## Decisions

- **Phase 90.01:** BATCH_SIZE=16 hardcoded em verifyManifest — env override é overengineering para hot path interno (matches Phase 88.01 sweet spot).
- **Phase 90.01:** Cache só ok=true em verifyManifest — mismatch/missing recompute sempre (devs corrigindo files veem recovery imediato).
- **Phase 90.01:** Cache check após SKIP_ENV — preserva prioridade absoluta de KIT_MCP_SKIP_MANIFEST_CHECK=1.
- **Phase 91.01:** Diff filter aplica APENAS a treeCopy ops — content ops embedam ISO timestamp em renderReference (sync.js:277) e não podem ser diffed em size compare. treeCopy domina wall time em large kits.
- **Phase 91.01:** written[] return semantics preservada (lista todos op.path, não apenas actually-written) — stable API v1.0+. Granularidade write-vs-skip via onProgress events.
- **Phase 91.01:** mtime+size heuristic over hash compare — CONTEXT.md decision. Edge case touch-without-write resolve via target.mtimeMs >= src.mtimeMs (defensive write se src newer).
- **Phase 92.01:** `open` fica como optionalDependency, não foi removido — fallback graceful em browser.js (Phase 89) já retorna `{opened:false, reason:'no_module'}` útil; remover o pacote inteiro perderia auto-launch UX para usuários que tem `open` instalado.
- **Phase 92.01:** BATCH_SIZE=16 hardcoded em regen-manifest.js (mesma rationale Phase 90.01) — prepublish hot path, single-shot, fora de qualquer budget de latência de usuário.
- **Phase 92.01:** `getLocalVersion` removido só do import em src/cli/index.js — função permanece exportada (used por checkUpgrade + upgrade-check.test.js); apenas o import era dead code.
- **Phase 92.01:** Static text-regex tests over eslint plugin — kit-mcp zero-build/zero-config policy preservado; CI catches regressions equivalentemente (dead-imports.test.js + jsdoc-coverage.test.js).
- **Phase 93.01:** Coverage threshold = 65 (não 75) — baseline medido foi 69.00%, set 4 pontos abaixo para absorver noise (CONTEXT.md linha 60 explicitamente autorizou). Ratchet plan: 70 → 75 → 80 conforme low-coverage files (cli/index.js 37%, mcp-server/install.js 19%, ui/auto-spawn.js 31%, core/failures.js 17%) ganharem testes em v1.18+.
- **Phase 93.01:** Coverage step gated a 1 célula da matrix (Linux+Node22+claude-code) — coverage % é target-agnostic; rodar 72× seria desperdício.
- **Phase 93.01:** Tests de CI gate via text-regex sobre ci.yml — adicionar `yaml` package quebraria o budget de 6 deps que o próprio gate enforce; mesmo pattern de gates/budget-description.md.
- **Phase 94.01:** FIFO cap N=1000 em latency histogram — bound memory em sessões MCP de longa duração com percentiles meaningful (matches Prometheus client semantics: "what is latency *now*", não unbounded history).
- **Phase 94.01:** Linear-interpolation percentile (matches Prometheus/Datadog) — sort-on-snapshot acceptable porque snapshots são on-demand (lidos pelo metrics-snapshot tool), não em todo dispatch.
- **Phase 94.01:** Latency observada em ambos sucesso E erro paths — metade do valor de um latency histogram é capturar tail-latency-then-fail patterns; observar só sucesso esconderia esse signal.
- **Phase 94.01:** Unknown-tool path conta como `error` contra o nome digitado — quando cliente erra typo de tool name, operador quer ver `unknown-tool-name:error` no snapshot para triagem; bucket genérico perderia o signal.
- **Phase 94.01:** `metrics-snapshot` skip path-safety guard — sem disk reads, sem shell, sem projectRoot dep; retorno read-only síncrono de in-memory state não tem attack surface que o guard mitiga.
- **Phase 94.01:** `KIT_MCP_METRICS_RESET=1` boot-time reset hook — operadores ganham clean window para A/B comparisons sem reiniciar o IDE/MCP host.
