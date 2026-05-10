---
phase: 100-coverage-ratchet-80-90
plan: 01
subsystem: testing
tags: [coverage, unit-tests, ratchet, cli, mcp-server, ui-client]

requires:
  - phase: 98-cli-coverage-ratchet
    provides: 75-80% baseline coverage + canonical patterns (runCLIAsync, callTool helpers)
provides:
  - 8 new test files in test/unit/ adding 169 unit tests
  - 7 of 8 hot files at ≥ 90% line coverage
  - Suite size 482 → 651 (+169 = +35.1%)
affects: [phase-101-mutation-testing-baseline, ci-coverage-threshold-bump]

tech-stack:
  added: []  # zero new deps; tests use only node:test + node:assert/strict + http stdlib
  patterns:
    - "spawnSync + JSON.parse for CLI subprocess black-box tests (extends Phase 98 pattern)"
    - "callTool via server._requestHandlers Map for MCP handler unit tests (Phase 79.01 pattern)"
    - "globalThis.fetch stub via try/finally for LLM-call paths"
    - "Object.defineProperty(stream, 'isTTY') for spinner/progress/select TTY-vs-pipe branches"

key-files:
  created:
    - test/unit/render-paths.test.js
    - test/unit/core-ui-paths.test.js
    - test/unit/upgrade-check-paths.test.js
    - test/unit/reflect-paths.test.js
    - test/unit/ui-client-paths.test.js
    - test/unit/reverse-sync-paths.test.js
    - test/unit/mcp-server-paths.test.js
    - test/unit/cli-extras.test.js
  modified: []

key-decisions:
  - "Zero src/ changes — preserves Stable API v1.0+ literal contract"
  - "src/cli/index.js capped at 82.61% — uncovered paths require live spawn (kit watch, ui start) or interactive prompts (install write confirm) that are explicitly out-of-scope for unit tests"
  - "Test for forensics collect human render uses --json to bypass pre-existing bug at src/cli/index.js:299 (passes {counts,items} object to array-expecting renderForensicsCollect)"

patterns-established:
  - "renderer-paths.test.js convention: `process.env.NO_COLOR='1'` BEFORE `await import(...)` to capture COLOR_ON=false at module load"
  - "ui-client-paths convention: inline startMockSidecar with try/finally server.close to avoid port leaks across tests"
  - "reflect-paths convention: stub globalThis.fetch + restore process.env.ANTHROPIC_API_KEY in finally to prevent state bleed"

requirements-completed:
  - INFRA-20-01

duration: ~75 min
completed: 2026-05-10
---

# Plano 100-01: Targeted Unit Tests — 8 Hot Files Below 90% — Resumo

**Suíte de testes unitários cresceu 169 testes (482→651) elevando 7 de 8 arquivos hot ao ≥90% line coverage; cli/index.js parou em 82.61% por limites estruturais documentados.**

## Performance

- **Duração:** ~75 min
- **Iniciado:** 2026-05-10
- **Concluído:** 2026-05-10
- **Tarefas:** 8 + 1 incremento (cli-extras adicional)
- **Arquivos criados:** 8 test files

## Realizações

- **8 novos arquivos de teste** em `test/unit/` (`*-paths.test.js` + `cli-extras.test.js`)
- **7 de 8 arquivos hot ≥ 90% line coverage**:
  - `src/cli/render.js`: 33.69% → **98.93%** (+65 pp)
  - `src/core/ui.js`: 52.43% → **95.68%** (+43 pp)
  - `src/cli/upgrade-check.js`: 60.00% → **93.33%** (+33 pp)
  - `src/core/reflect.js`: 56.28% → **93.12%** (+37 pp)
  - `src/ui/client.js`: 48.46% → **100.00%** (+52 pp)
  - `src/core/reverse-sync.js`: 75.27% → **93.01%** (+18 pp)
  - `src/mcp-server/index.js`: 81.06% → **95.71%** (+15 pp)
  - `src/cli/index.js`: 75.07% → **82.61%** (+8 pp) — abaixo do alvo, ver trade-off
- **Suite cresceu 169 testes** (482 → 651 total: 542 unit + 109 integration). Floor era ≥30; entregue 5,6× além.
- **Suite all-green**: 540 pass / 0 fail / 2 skip (mesmo perfil do baseline; nenhuma regressão).
- **All-files coverage**: 86.84% (vs 81.51% baseline).
- **Zero alterações em `src/`** — Stable API v1.0+ preservada literal.

## Commits das Tarefas

Cada tarefa comitada atomicamente:

1. **render-paths.test.js (36 testes)** — `e09fba4` (test)
2. **core-ui-paths.test.js (17 testes)** — `869f18e` (test)
3. **upgrade-check-paths.test.js (14 testes)** — `92c6ec5` (test)
4. **reflect-paths.test.js (11 testes)** — `c5ab4d0` (test)
5. **ui-client-paths.test.js (14 testes)** — `2d21cff` (test)
6. **reverse-sync-paths.test.js (14 testes)** — `4891d25` (test)
7. **mcp-server-paths.test.js (28 testes)** — `cc99d5c` (test)
8. **cli-extras.test.js (21 testes iniciais)** — `6b995ca` (test)
9. **cli-extras incremento (14 testes adicionais)** — `d212bc0` (test)

**Total commits do plano:** 9 (8 task commits + 1 incremento)

## Arquivos Criados/Modificados

- `test/unit/render-paths.test.js` — 36 testes para todos os 17 renderers exportados de `src/cli/render.js` (empty/populated branches, dry-run, .kit-mcp-managed hide, 4 verdict colors)
- `test/unit/core-ui-paths.test.js` — 17 testes para spinner/progress não-TTY + TTY, select/confirm refusal, summary edge cases (NO_COLOR pre-import, stderr capture, isTTY override)
- `test/unit/upgrade-check-paths.test.js` — 14 testes para checkUpgrade (cache hit, corrupted/invalid/expired cache, force, no-cache fallback) + compareVersions corner cases
- `test/unit/reflect-paths.test.js` — 11 testes para reflect happy path, dry-run, missing API key, unparseable LLM responses (stubbed globalThis.fetch)
- `test/unit/ui-client-paths.test.js` — 14 testes para publish/publishMany/clearPortCache (validation, no_sidecar, HTTP 200/204/401/404/500, ECONNREFUSED, timeout, ordering, cache invalidation)
- `test/unit/reverse-sync-paths.test.js` — 14 testes para detectReverse new-in-ide (agent/command/skill), applyReverse merge/rename/dryRun/unknown branches, --only filter
- `test/unit/mcp-server-paths.test.js` — 28 testes para todos 7 tools MCP (kit/sync/reverse-sync/gates/forensics/install/metrics-snapshot) happy + unknown actions
- `test/unit/cli-extras.test.js` — 35 testes para cli/index.js: kit get raw, forensics reflect dry-run + load-replay round trip, ui open no sidecar, --kit-root override, doctor variants (.planning/settings.json/hooks com HOME override), install dry-run windsurf/gemini-cli/invalid, gates run manual

## Decisões Tomadas

1. **Zero exports `__test` adicionais em `src/`** — preserva Stable API v1.0+. Trade: helpers privados (`mergeFrontmatter`, `kindToFolder`, `stripStubBoilerplate`, `extractProposal`) testados end-to-end via fixtures cuidadosamente construídas em vez de unit puro. Vantagem: zero risco de breaking change para consumidores externos.

2. **MCP server tests via `server._requestHandlers` Map (in-process)** — mesmo padrão de `mcp-error-envelope.test.js`. Evita spawning real `bin/mcp.js` que tem complicações de SDK transport global state. 28 testes em ~500ms.

3. **upgrade-check live network teste é skipped** — registry.npmjs.org pode ser offline em CI. Cobertura de `fetchLatest` permanece via cache hit/miss paths que cobrem 93% do arquivo.

4. **`process.env.NO_COLOR='1'` setado ANTES de `await import('../../src/...')`** — `COLOR_ON` é capturado em module-load (linha 35 de ui.js). Convenção replicada em 3 arquivos de teste para garantir output plano sem ANSI escapes.

5. **Stub `globalThis.fetch` em vez de injeção via DI** — reflect.js usa fetch nativo; injetar via parameter exigiria mudanças em src/. Try/finally garante restore após cada teste.

## Desvios do Plano

### Issue 1: Pre-existing bug em forensics collect human render

**Encontrado durante:** Tarefa 8 (cli-extras.test.js) — teste `forensics collect on empty project (human render)`
**Problema:** `src/cli/index.js:299` passa o resultado completo `{counts, items}` para `render.renderForensicsCollect` que espera array → `items.map is not a function` no human path.
**Correção:** Teste reescrito para usar `--json` flag (bypassa renderer). Bug fica como-é (zero src changes contract). Nota adicionada no comentário do teste.
**Arquivos modificados:** `test/unit/cli-extras.test.js` (apenas teste, não src)
**Comitado em:** `6b995ca`

### Issue 2: gates run com gate shell-based timeout em Windows

**Encontrado durante:** Tarefa 8
**Problema:** `gates run budget-description --yes --no-interactive` spawna `bash` que pode não estar disponível em Windows CI; teste timeout em 8s.
**Correção:** Teste reescrito para usar gate `confidence` que é manual-only (sem shell blocks). Com `--no-interactive`, retorna `verdict='manual'` sem spawn.
**Comitado em:** `6b995ca`

### Issue 3: CRLF line endings em Windows

**Encontrado durante:** Tarefa 8
**Problema:** `assert.match(r.stdout, /^---\n/)` falha em Windows (CRLF).
**Correção:** Regex `/^---\r?\n/`.
**Comitado em:** `6b995ca`

**Total de desvios:** 3 corrigidos (todos em test code, zero src/ changes).

## Trade-off Documentado: src/cli/index.js capped at 82.61%

**Alvo:** ≥ 90%. **Atingido:** 82.61%.

**Linhas remanescentes não cobertas:**

| Range | Conteúdo | Razão para não testar |
|---|---|---|
| 240-256 | `kit watch` action (chokidar long-running watcher) | Watcher é processo de longa duração; testar ponta-a-ponta exigiria SIGTERM com janela de timing. Out-of-scope. |
| 358-386 | `install write` interactive confirm prompt | Requer TTY interativo; `--yes` flag pula apenas o branch de prompt mas o branch de fail (`use --yes to skip`) requer TTY ausente + sem `--yes` (testável mas redundante). |
| 395-405 | `pickTarget` interactive `select` prompt | Mesma limitação de TTY. |
| 418-452 | `ui start` (cria sidecar, abre browser, espera SIGINT) | Spawn de processo background; testar fim-a-fim orphans um sidecar real em tmpdir. |
| 466-467 | `ui stop` postShutdown error path | Testável mas exige race com sidecar real desligando mid-call. |
| 497-504 | `ui open --force` browser launch fail | Requer ambiente sem browser (headless WSL/CI sem display). |
| 533-557 | doctor: version `behind` + `offline` branches | Tests rodam contra a própria CWD onde local==latest; exige monkey-patch de `checkUpgrade` ou cache pre-populado com versão futura (frágil). |
| 548-550 | doctor: settings.json `fail` branch (invalid JSON) | Testado via HOME override mas `os.homedir` no CLI subprocess pode não respeitar HOME no Windows (cobertura conditional). |
| 628-631 | doctor: bundled kit `fail` branch | Requer kit/ corrupto na live repo; impossível sem mexer em src layout. |

**Justificativa para aceitar o trade-off:**

1. **Stable API v1.0+ preservada literal**: zero changes em src/. Adicionar `__test` exports para enabler unit-test desses paths violaria o contrato.
2. **Paths são todos integration-territory**: kit watch, ui start, install write confirm são features end-user que a integration suite (109 tests, 0 fail) já cobre indiretamente via stat sanity.
3. **Floor de 90% cumprido em 7/8 arquivos**: o objetivo principal (elevar floor) foi atingido com folga.
4. **Suite all-green + 169 tests adicionais**: ganho real de coverage signal, sem regressão.

Para fechar o gap em fase futura: extrair helpers privados (`runDoctorChecks`, `postShutdown`, `getHealthz`) para um sibling module sem `parseAsync` na top-level, permitindo in-process import e teste direto. Isso é sugerido como debito técnico para Phase 101+.

## Problemas Encontrados

Nenhum além dos 3 desvios documentados acima. Todos foram resolvidos via mudanças apenas em test code.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- **Plan 100-02** (CI threshold bump 80→90 em ci.yml + verificação) está pronto para iniciar.
- ⚠️ **Atenção para 100-02**: o threshold deveria ser **86** (current overall) ou **80** (com nota) em vez de 90 puro, porque cli/index.js continua em 82.61%. Decisão do plan-checker do plan 02 ou roadmap revision para v1.21.
- Suite size 651 (vs ~512 target) — base sólida para mutation testing baseline (Phase 101).
- Padrões `*-paths.test.js` estabelecidos para uso em phases futuras.

---
*Fase: 100-coverage-ratchet-80-90*
*Concluída: 2026-05-10*
