---
state_version: 1.0
milestone: v1.18
milestone_name: — Eat Your Own Dog Food
status: Phase 97 completa (1/1 plan); v1.18 milestone 4/4 fases — pronto para /concluir-marco
last_updated: "2026-05-09T17:00:07.379Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 1
  completed_plans: 4
---

# STATE.md — sessão atual

## Posição Atual

Fase: 97 — Coverage Ratchet 65→75% (INFRA-18-01) — **CONCLUÍDA**
Status: Phase 97 completa (1/1 plan); v1.18 milestone 4/4 fases — pronto para /concluir-marco
Última atividade: 2026-05-09T17:07Z — Phase 97.01 executado (plan+execute combinado); 418 tests pass (307 unit + 109 integration + 2 skip); +38 novos tests unit em 4 test files (failures-coverage / install-coverage / auto-spawn-coverage / cli-index-coverage); coverage 69.95% → 77.89% (+7.94 pp); ci.yml threshold 65 → 75 (REQ INFRA-18-01); zero deps novas

## Milestone ativo

**v1.18 Eat Your Own Dog Food** — primeira release pós v1.17 que dogfooda as próprias skills SRE/Observabilidade no kit-mcp. **MILESTONE COMPLETO 4/4 fases.**

**4 fases (94-97):**

- Phase 94 ✅ — Golden Signals MCP Server (OBS-18-01/02)
- Phase 95 ✅ — SLO Definitions (OBS-18-03/04)
- Phase 96 ✅ — RUNBOOK + FAILURE-MODES + BENCHMARK (OPS-18-01/02/03)
- Phase 97 ✅ — Coverage Ratchet 65→75% (INFRA-18-01)

## Próximo passo

1. Rodar `/concluir-marco` para audit do v1.18 (4 fases) e arquivar milestone roadmap → preparar release v1.18.0.
2. Após audit, `/publicar` para publish na npm + GitHub release (pipeline simples: push tag → GitHub Action publica).

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
| 95 | 01 | ~3.8min | 2 | 4 | 10 (new) |
| 96 | 01 | ~9.4min | 4 | 4 | 11 (new) |
| 97 | 01 | ~22min | 5 | 5 | 38 (new) |

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
- **Phase 95.01:** p95 (não p99) na latency SLO — com FIFO cap N=1000 da Phase 94.01, p99 tem só 10 samples de resolução por tool; p95 tem 50 (menos dominado por outliers). Move-se para p99 em v1.19+ com log-to-disk.
- **Phase 95.01:** Target 99.5% availability (não 99.9%) — kit-mcp se posiciona em "free-tier production" no risk continuum (skill sre-risk-management); 99.5% deixa 3.6h de budget mensal pra absorver typos counted como `unknown-tool-name:error` sem paginar maintainer.
- **Phase 95.01:** Burn-rate multipliers 14.4×/6× verbatim do Google SRE — sem volume medido pra tunar; adopta canonical até `metrics-snapshot` em produção mostrar uso real.
- **Phase 95.01:** Schema test via regex-on-text (não js-yaml AST) — adicionar js-yaml queimaria o 3-deps budget que Phase 92.01 lutou pra preservar; regex captura os keys que tooling depende, mesmo trade-off de dead-imports + jsdoc-coverage gates.
- **Phase 95.01:** SLO único cobrindo todas as tools (não per-tool) — toolkit pequeno (6 tools); per-tool budgets seriam thin demais pra ter valor; split quando uma única tool dominar volume.
- **Phase 95.01:** Owner = `kit-mcp-maintainers@github.com` — skill mandata explícito; single-repo single-human hoje, mas contrato visível e substituível.
- **Phase 96.01:** Single-point benchmark, não aggregated cross-runner — millis no developer-laptop scale são noisy demais pra average; signal é o trend na mesma máquina; refresh per milestone com versioning inline.
- **Phase 96.01:** 12 failure modes (não 8-10 do CONTEXT) — cataloging fewer would have left obvious-but-mitigated cases implicit (Phase 79 RCE guard, antivirus quarantine, disk-full); risk-tier rollup compresses to 4 visible bands.
- **Phase 96.01:** Regression budget em todo metric BENCHMARK (não só SLO-backed) — M2/M3/M5 sem SLO ainda, mas cada um carrega "2× current" tripwire; sem isso, regression não tem trigger quantitativo antes de reclamação user.
- **Phase 96.01:** Quick-triage table topo do RUNBOOK — maintainers under stress não leem top-to-bottom; symptom→scenario# mapping shaves a step. Mesmo shape Google SRE cap 13.
- **Phase 96.01:** FAILURE-MODES tem seção "deliberately not on this list" — sem isso, catalog implies completeness; carve-out makes scope explícito (out-of-scope hosted-service modes, SLO-budgeted single-error modes).
- **Phase 96.01:** Test integration via regex-on-text (não markdown AST) — mesmo trade-off Phase 95.01 slo-schema; adicionar `remark`/`marked` queimaria 3-deps + 3-optional budget Phase 92.01.
- **Phase 96.01:** Cross-doc invariant test asserts cada ops doc cross-refs ≥1 sibling — sem isso, future edits could silently strip navigation entre RUNBOOK ↔ FAILURE-MODES ↔ BENCHMARK; assertion makes contract enforceable.
- **Phase 97.01:** Threshold 75 (3 abaixo do baseline 77.89%) — matches Phase 93.01 noise-margin pattern; round-number ratchet step (65→70→75→80) makes schedule legible. Setting at-baseline flakearia em minor reporter changes Node 22.x → 22.y.
- **Phase 97.01:** cli/index.js testado via spawnSync (não in-process import) — file ends with `program.parseAsync(process.argv)` at top-level que consumiria argv do test runner. Preserving rule "no source changes" (CONTEXT.md `<decisions>`) ruled out exporting helpers; spawnSync gives behavioral coverage and Node's v8 coverage merger lifts the metric anyway (37 → 55%).
- **Phase 97.01:** healthz_timeout path (5s polling) skipped — adicionar push unit suite past 12s for one edge case; integration coverage suficiente; regression surfaceria em PRR check antes de v1.19.
- **Phase 97.01:** Mock HTTP server pattern para sidecar tests — vs launching real bin/ui.js (would orphan detached child em os.tmpdir() se test crashasse). Loopback HTTP server responds 200 a /healthz, hand-crafted lockfile points at it, exercises existing-running-sidecar branch sem process-tree teardown.
- **Phase 97.01:** Codex toml userPath testado via HOME override — codex tem no project-level mcpConfig path; função fall-through to `~/.codex/config.toml`. Test sets process.env.HOME (e USERPROFILE on Windows) to tmp dir, restored em finally block.
