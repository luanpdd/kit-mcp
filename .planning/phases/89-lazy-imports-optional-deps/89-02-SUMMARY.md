---
phase: 89-lazy-imports-optional-deps
plan: 02
subsystem: infra
tags: [optional-deps, lazy-import, package-json, performance, dynamic-import]

requires:
  - phase: 88-concurrent-io
    provides: watch.js debounce 500ms + clearKitCache invalidation (PERF-16-02)
  - phase: 79-security-hardening
    provides: SEC-14-02 sidecar token + audit gates
provides:
  - "@inquirer/prompts moved to optionalDependencies (PERF-16-05)"
  - "chokidar moved to optionalDependencies (PERF-16-06)"
  - "loadInquirer() lazy-load helper in src/core/ui.js with descriptive error fallback"
  - "loadChokidar() lazy-load helper in src/core/watch.js with descriptive error fallback"
  - "5 new regression tests pinning the dep budget + graceful fallback messages"
affects: [v1.16-publish, npm-pack-tarball, downstream-consumers, mcp-stdio-mode]

tech-stack:
  added: []
  patterns:
    - "Optional runtime deps via dynamic await import() with closure-cached module + descriptive throw on absence (consistent with src/ui/browser.js loadOpen)"
    - "Filesystem-rename strategy for testing missing optional deps (rename node_modules/<dep> in try/finally, spawn child to escape ESM module cache)"

key-files:
  created:
    - test/unit/optional-deps.test.js
  modified:
    - package.json
    - src/core/ui.js
    - src/core/watch.js
    - test/integration/npm-pack-shape.test.js

key-decisions:
  - "Filesystem rename instead of Module._resolveFilename patch for missing-dep simulation — _resolveFilename only intercepts CJS require(), not ESM await import() in Node 20+"
  - "Retain stable async signature for select/confirm/watchKit — closure cache prevents repeated import() cost; first call pays one-shot ESM resolution (~5-15ms)"
  - "Throw descriptive Error instead of returning null (vs. browser.js loadOpen pattern) — interactive prompts and watch are user-invoked, hard fail is preferable to silent degradation"

patterns-established:
  - "loadX() helper: closure-cached lazy import, throws descriptive Error with literal `npm i <pkg>` text on absence, returns module on success"
  - "Test pattern for optional dep absence: rename node_modules/<dep> → .bak inside try/finally, spawn child process with `node -e` to trigger lazy-load (escape parent module cache)"

requirements-completed:
  - PERF-16-05
  - PERF-16-06

duration: 6m 32s
completed: 2026-05-09
---

# Phase 89 Plan 02: Optional Dependencies Summary

**`@inquirer/prompts` and `chokidar` moved to optionalDependencies + lazy-loaded via closure-cached `await import()` with descriptive fallback errors instructing `npm i <package>` — consumers running `npm install --omit=optional` now get functional core CLI while interactive/watch commands fail with actionable messages.**

## Performance

- **Duração:** 6m 32s
- **Iniciado:** 2026-05-09T14:00:34Z
- **Concluído:** 2026-05-09T14:07:07Z
- **Tarefas:** 2 (Task 1 implementation + Task 2 regression tests)
- **Arquivos modificados:** 4 (package.json, src/core/ui.js, src/core/watch.js, test/integration/npm-pack-shape.test.js) + 1 created (test/unit/optional-deps.test.js)

## Realizações

- `package.json` `dependencies` reduzido de 6 → 4 entries (`@modelcontextprotocol/sdk`, `commander`, `open`, `picocolors`); nova seção `optionalDependencies` com 2 entries (`@inquirer/prompts`, `chokidar`). Total budget 6/6 preservado.
- `src/core/ui.js`: top-level inquirer import removido; `loadInquirer()` helper closure-caches o dynamic import; `select()`/`confirm()` lançam `Error` com literal `npm i @inquirer/prompts` se ausente.
- `src/core/watch.js`: top-level chokidar import removido; `loadChokidar()` helper closure-caches; `watchKit()` lança `Error` com literal `npm i chokidar` se ausente. **Phase 88.02 PERF-16-02 fixes (debounce 500ms + clearKitCache invalidation) PRESERVADOS** — apenas a forma do import mudou.
- 5 regression tests adicionados (4 unit + 1 integration) pinning estrutura do package.json, dep budget invariant, e mensagens de erro graciosas.
- Suite: **232 unit + 85 integration = 317 testes passing** (zero regressão; tests Phase 88.02 watch-debounce continuam green).
- Consumer impact medido: `--omit=optional` skipará 16+ `@inquirer/*` sub-packages + `chokidar` + `readdirp` (≥18 transitive deps) no node_modules do downstream.

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Task 1: Move 2 deps to optionalDependencies + lazy-import in core/ui.js and core/watch.js** — `71b9a3e` (perf)
2. **Task 2: Regression tests (4 unit + 1 integration extension)** — `41f57d4` (test)

**Metadata commit (a ser criado pelo orquestrador):** `<hash>` (docs: plano completo)

## Arquivos Criados/Modificados

- **`package.json`** — `dependencies` shrunk to 4 (sdk, commander, open, picocolors); novo `optionalDependencies` block com `@inquirer/prompts ^8.4.2` + `chokidar ^5.0.0`. Versão `1.15.0` preservada (bump no /publicar).
- **`src/core/ui.js`** — top-level `import { select, confirm } from '@inquirer/prompts'` removido; `loadInquirer()` helper adicionado com closure cache `_inquirerModule`; `select(opts)` agora chama `const { select: inqSelect } = await loadInquirer()` antes de delegar; `confirm(opts)` mesma estrutura para `inqConfirm`. TTY guard preservado. `c`/`icons`/`spinner`/`progress`/`summary`/`_internal` exports inalterados.
- **`src/core/watch.js`** — top-level `import chokidar from 'chokidar'` removido; `loadChokidar()` helper adicionado com closure cache `_chokidarModule` (usa `mod.default || mod` para handle de export ESM/CJS interop, mesmo pattern de `loadOpen` em `src/ui/browser.js`); `watchKit()` chama `const chokidar = await loadChokidar()` ANTES de `chokidar.watch(kitRoot, ...)`. Linha 25 `debounceMs = 500ms` PRESERVADA (PERF-16-02). Linha 56 `clearKitCache()` PRESERVADA (PERF-16-02). `detectExistingTargets()` inalterada.
- **`test/unit/optional-deps.test.js` (novo, 217 linhas)** — 4 testes: package.json structure (4+2 split), dep budget invariant (=6), select missing-inquirer error, watchKit missing-chokidar error. Helper `withMissingModule(modName, triggerScript)` faz rename node_modules/<dep> → .bak em try/finally + spawn child com `node -e` para escapar parent module cache. Skip gracefully se dep não estiver instalada localmente.
- **`test/integration/npm-pack-shape.test.js` (extended)** — 1 novo teste no FINAL (linha ~104+): `PERF-16-05/06: tarball package.json declares optionalDependencies` validando structure no tarball + sanity de que entries não estão duplicadas em `dependencies`. 4 testes existentes do PERF-13-03 inalterados.

## Decisões Tomadas

1. **Filesystem rename para test missing-dep, não Module._resolveFilename patch.** A abordagem original do plano (`Module._resolveFilename = function(req,...) { if (req === '@inquirer/prompts') throw...; }`) foi validada empiricamente e **NÃO funciona** em Node 24 com ESM `await import()`. `_resolveFilename` é o resolver CJS; ESM dynamic import vai pelo loader hooks (`esm/resolve.js`), bypassando o monkey-patch. Validei com snippet executável antes de escrever o teste — o `select()` carregou inquirer normalmente e abriu o prompt UI real. Substituí pela estratégia rename `node_modules/<dep>` → `.bak` dentro de try/finally + spawn child process. Esta estratégia é mais REALISTA (matches o que `npm install --omit=optional` produz no consumer) e é resilient à evolução do Node loader.

2. **Throw vs return null para módulo ausente.** O `loadOpen` em `src/ui/browser.js` retorna `null` quando `open` falha de carregar, e o caller degrada graciosamente (printa URL no stderr). Para `loadInquirer` e `loadChokidar` escolhi **throw com mensagem descritiva** porque: (a) interactive prompts e watch são comandos invoked-by-user-explicitly — silent degradation seria confusing; (b) há fallback acionável (`--yes`, `--no-interactive`, `kit sync install` one-shot); (c) mensagem com literal `npm i <pkg>` text dá user immediate next step.

3. **Closure cache pattern (`let _moduleX = null`)** — consistente com `loadOpen` em `browser.js`. Evita custo repetido de `await import()` em chamadas subsequentes; primeira chamada paga ~5-15ms de ESM resolution + module init, todas as seguintes retornam o mesmo objeto cached.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 3 - Bloqueante] Estratégia de teste para "missing optional dep" trocada de Module._resolveFilename patch para filesystem rename**

- **Encontrado durante:** Task 2 (escrevendo test/unit/optional-deps.test.js)
- **Problema:** O plano (Task 2.1, lines 374-393) instruía usar `Module._resolveFilename` monkey-patch para simular ausência de `@inquirer/prompts` e `chokidar`. Validei empiricamente em Node 24.11.1 — o patch é silently bypassed para ESM `await import()`. O test correu com inquirer carregando normalmente e abriu o prompt UI real ("? pick / ↑↓ navigate ⏎ select"), eventually saindo com "User force closed the prompt" — mensagem TOTALMENTE diferente da esperada. `Module._resolveFilename` intercepta apenas resolution CJS via `require()`; ESM `import()` em Node 20+ vai pelo loader hooks (`esm/resolve.js`).
- **Correção:** Substituí pela estratégia filesystem rename: `await rename(node_modules/<dep>, <dep>.bak)` em try/finally, então `spawnSync(node, ['-e', triggerScript])` para executar a chamada em child process (escape parent module cache). Após o test, finally garante restauração ou logga FATAL se rename de volta falhar. Esta estratégia é mais REALISTA (mirrors `npm install --omit=optional` no consumer) e robusta à evolução do Node loader.
- **Arquivos modificados:** `test/unit/optional-deps.test.js` (helper `withMissingModule` + 2 testes usando-o)
- **Verificação:** `node --test test/unit/optional-deps.test.js` → 4/4 pass; ambos os testes "missing-X" capturam a mensagem descritiva esperada (`npm i @inquirer/prompts` / `npm i chokidar`); rename é restaurado em todos os scenarios; suite full não tem side-effect (node_modules intacto após).
- **Comitado em:** `41f57d4` (parte do commit Task 2)

---

**Total de desvios:** 1 corrigido automaticamente ([Regra 3 - Bloqueante] × 1)
**Impacto no plano:** Mudança de estratégia de teste, NÃO de implementação. O comportamento testado (`select`/`watchKit` lançando Error com literal `npm i <pkg>`) é exatamente o do plano. A estratégia de simulação foi mais realista e mais robusta. Sem expansão de escopo. Sem mudança de critérios de sucesso.

## Problemas Encontrados

Nenhum.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- v1.16 fase 89 concluída (após Plan 89.01 + 89.02). Pronto para `/concluir-marco` ou `/publicar`.
- Stable API v1.0+ preservada — clientes que rodam `npm install` default continuam tendo todas features funcionais (optionalDependencies são instaladas por default). Apenas `npm install --omit=optional` triggers o new behavior.
- Tarball metadata reflete a separação dependencies/optionalDependencies. Consumer-side `node_modules` reduction medido: ≥18 transitive packages skipped quando `--omit=optional`.
- Phase 88.02 PERF-16-02 fixes (debounce + clearKitCache) seguem cobertos por watch-debounce.test.js (3 testes green).

## Self-Check: PASSED

- `[ -f package.json ]` → FOUND
- `[ -f src/core/ui.js ]` → FOUND
- `[ -f src/core/watch.js ]` → FOUND
- `[ -f test/unit/optional-deps.test.js ]` → FOUND
- `[ -f test/integration/npm-pack-shape.test.js ]` → FOUND
- `git log --oneline | grep 71b9a3e` → FOUND (Task 1 commit)
- `git log --oneline | grep 41f57d4` → FOUND (Task 2 commit)
- All success criteria met:
  - 2 deps moved to optionalDependencies in package.json (no version change)
  - 2 lazy-load helpers (loadInquirer, loadChokidar) consistent with loadOpen pattern
  - 5 regression tests pinning structure (4 unit + 1 integration)
  - Phase 88.02 debounce + clearKitCache PRESERVED (3 watch-debounce tests still green)
  - Error messages contain literal `npm i <package>` (validated by tests)
  - Suite: 317 tests passing (232 unit + 85 integration)

---
*Fase: 89-lazy-imports-optional-deps*
*Concluída: 2026-05-09*
