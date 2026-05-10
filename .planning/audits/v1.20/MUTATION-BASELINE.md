# Mutation Testing Baseline — v1.20 / Phase 101

**Data:** 2026-05-10
**Scope:** `src/core/**/*.js` (15 arquivos no scope, 10 com baseline completo nesta run)
**Ferramenta:** Stryker Mutator v9.x (`@stryker-mutator/core`)
**Runner:** `node test/run.mjs test/unit` via `commandRunner`
**Estratégia:** Per-file independent runs via `scripts/run-mutation-baseline.mjs` (vs naive all-files × full-suite ~100min wall-clock)
**REQ:** INFRA-20-02

## Executive Summary

| Métrica | Valor |
|---|---|
| **Mutation Score (overall, 10 arquivos)** | **57.40%** |
| Total mutants | 1310 |
| Killed | 739 |
| Survived | 558 |
| Timeout | 13 |
| NoCoverage | 0 |
| Runtime cumulative | ~9 min (per-file) |

**Interpretação:** Linha de base de 57.40% indica que ~57% dos mutants comportamentais foram detectados pelos 651 testes existentes em src/core/. Os outros 43% representam comportamento subdetectado — testes podem estar verificando "código rodou" sem assertar "comportamento correto". Esta é a baseline canônica para v1.21+ ratchet.

## Per-File Breakdown (10 arquivos rodados)

| Arquivo | Score | Killed | Survived | Timeout | Total | Status |
|---|---|---|---|---|---|---|
| `src/core/error-redaction.js` | **90.63%** | 58 | 6 | 0 | 64 | ✅ Excelente |
| `src/core/metrics.js` | 78.29% | 101 | 28 | 0 | 129 | ✅ Bom |
| `src/core/failures.js` | 76.98% | 97 | 29 | 0 | 126 | ✅ Bom |
| `src/core/gates.js` | 66.67% | 62 | 31 | 0 | 93 | ⚠ Médio |
| `src/core/kit.js` | 65.18% | 145 | 78 | 1 | 224 | ⚠ Médio |
| `src/core/manifest-verify.js` | 59.48% | 90 | 62 | 1 | 153 | ⚠ Médio |
| `src/core/reflect.js` | 52.49% | 105 | 105 | 11 | 221 | ⚠ Baixo |
| `src/core/replays.js` | 45.36% | 44 | 53 | 0 | 97 | ❌ Baixo |
| `src/core/registry.js` | **18.62%** | 27 | 118 | 0 | 145 | ❌ Crítico |
| `src/core/path-safety.js` | **17.24%** | 10 | 48 | 0 | 58 | ❌ Crítico |

## Top 5 Arquivos para Melhorar (sorted by survived count)

| Rank | Arquivo | Survived | Score | Análise |
|---|---|---|---|---|
| 1 | `src/core/registry.js` | 118 | 18.62% | TARGETS table — testes provavelmente verificam shape mas não comportamento de iteração/lookup. Investigar grep "TARGETS\|registerTarget" |
| 2 | `src/core/reflect.js` | 105 | 52.49% | Anthropic API wrapper — survived = mutações em prompt building, JSON parsing. Adicionar fixtures + assertions sobre conteúdo gerado |
| 3 | `src/core/kit.js` | 78 | 65.18% | Coordenação central; muitos paths cobertos mas asserts fracos. Hot file — priority refactor target |
| 4 | `src/core/manifest-verify.js` | 62 | 59.48% | SHA256 compare paths — survived em string concat / encoding. Adicionar tampered-fixture suite |
| 5 | `src/core/replays.js` | 53 | 45.36% | Path traversal + secrets redaction — algum survived em string literal mutations. Reforçar com property-based tests |

## Não Rodados Nesta Baseline (5 arquivos)

| Arquivo | Razão |
|---|---|
| `src/core/gate-runner.js` | Initial test failure no Stryker bootstrap (test interativo / spawn dependente de PATH) — investigar fix em v1.21 |
| `src/core/sync.js` | Sessão interrompida antes de rodar — high priority pra completar baseline |
| `src/core/ui.js` | Sessão interrompida — UI primitives já têm 95.68% coverage line, esperado high mutation score também |
| `src/core/watch.js` | Sessão interrompida — pequeno arquivo, fast run quando rodado |
| `src/core/reverse-sync.js` | Em progresso quando interrompida — parcial não capturado |

**Recomendação:** completar baseline desses 5 arquivos em sessão dedicada de v1.20 phase 101.X (não bloqueante para milestone).

## Reprodutibilidade

```bash
npm run test:mutation           # Roda Stryker via wrapper (per-file)
node scripts/run-mutation-baseline.mjs   # Mesmo, explicit
```

**Reports:**
- `reports/mutation/<file-stem>/mutation-report.json` — per-file (gitignored)
- `reports/mutation/<file-stem>/mutation-report.html` — per-file HTML (gitignored)
- `.planning/audits/v1.20/STRYKER-RUN-LOG.txt` — run log committed (audit trail)
- `.planning/audits/v1.20/MUTATION-BASELINE.md` — este documento

## ToDo v1.21+ (Mutation Gate Roadmap)

### Avenue A: Completar baseline (alta prioridade)
- Rodar mutation em `src/core/sync.js`, `src/core/ui.js`, `src/core/watch.js`, `src/core/reverse-sync.js`
- Investigar e fixar bootstrap de gate-runner.js
- Atualizar este documento com 15 files complete

### Avenue B: Push critical files
- `src/core/registry.js` (18.62% → ≥60%): adicionar tests de behavioral lookup, target registration, TARGETS shape mutation
- `src/core/path-safety.js` (17.24% → ≥80%): tests devem assertar exact rejection messages, not "throws"
- `src/core/replays.js` (45.36% → ≥70%): property-based testing com fast-check?
- `src/core/reflect.js` (52.49% → ≥75%): fixtures de Anthropic responses + JSON parsing assertions

### Avenue C: Mutation Gate Threshold (v1.21+)
**Proposta:** adicionar gate em CI que falha se overall mutation score (após baseline 100% complete) cair abaixo de **55%** (margem de segurança vs 57.40% baseline). Strawman:

```yaml
# Em .github/workflows/ci.yml (adicionar pós-Phase 101 v1.21)
- name: Audit — mutation score (REQ INFRA-21-XX)
  if: matrix.os == 'ubuntu-latest' && matrix.node == 22
  run: |
    npm run test:mutation
    SCORE=$(jq -r '.overallScore' reports/mutation/baseline-summary.json)
    THRESHOLD=55
    awk -v s="$SCORE" -v t="$THRESHOLD" 'BEGIN { exit (s < t) ? 1 : 0 }' \
      && echo "OK: $SCORE% ≥ $THRESHOLD%" \
      || { echo "::error::mutation score $SCORE < $THRESHOLD"; exit 1; }
```

**Observação:** stryker run leva ~10-30min em CI. Considerar:
- Rodar em job paralelo (não bloqueia merge no happy path)
- Cache `.stryker-tmp/` entre runs (45% speedup conservador)
- Rodar apenas em PRs que tocam `src/core/**`

## Notas de Decisão

**Escolha de scope:** apenas `src/core/` para esta baseline porque é o coração do MCP server (registry, kit, sync, gates, watch, metrics) — código mais crítico e mais estável. `src/cli/`, `src/ui/`, `src/mcp-server/` ficam para futuras phases conforme baseline matura.

**Estratégia per-file vs all-files:** rodar Stryker uma vez com `mutate: ["src/core/**/*.js"]` levaria ~100min wall-clock. O wrapper `scripts/run-mutation-baseline.mjs` roda 1 arquivo por vez com test files focused (mapping em CORE_FILE_TESTS), reduzindo cada invocação para ~10-100s — muito mais viável para dev laptop e CI futuro.

**Test runner:** `command` runner com `node test/run.mjs test/unit` (não `node:test` direto) porque queremos exact parity com `npm test`. node:test runner do Stryker exige perTest hooks que node-test não fornece.

## Cross-references

- ROADMAP.md Phase 101: `.planning/ROADMAP.md`
- Plan: `.planning/phases/101-mutation-testing-baseline/101-01-PLAN.md`
- Wrapper script: `scripts/run-mutation-baseline.mjs`
- Stryker config: `stryker.config.json`
- Run log: `.planning/audits/v1.20/STRYKER-RUN-LOG.txt`
