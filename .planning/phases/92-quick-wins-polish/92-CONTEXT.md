# Phase 92: Quick Wins Polish - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)
**Depends on:** Phase 90 ✅

<domain>
## Limite da Fase

4 polish items quick win do meta-audit:

**POL-17-01 — `open` para optionalDependencies:** −36ms cold, −68KB tarball.
**POL-17-02 — `regen-manifest.js` paralelizar hashing:** −100ms prepublishOnly.
**POL-17-03 — Remover import morto `getLocalVersion` em src/cli/index.js:33** (Plan 89.01 deviation).
**POL-17-04 — JSDoc em `path-safety.js` + `manifest-verify.js`** (path-safety só; manifest-verify já ganhou em Phase 90).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude

### Restrições absolutas
- Stable API v1.0+ preservada.
- Budget 6/6 deps mantido (3 dependencies + 3 optionalDependencies pós-Phase 92).
- Phase 89 lazy `await import('open')` em browser.js já existe — só precisa fallback graceful.
- Phase 90 cache + Phase 91 diff preservados.
- Zero regressão (326 baseline pós-Phase 91).

### Diretrizes

**POL-17-01 (`open` optional):**
- `package.json`: `dependencies` (3) + `optionalDependencies` (3) = 6 total.
- `src/ui/browser.js`: já faz `await import('open')`. Wrap em try/catch para fallback graceful (return `null` ou error message com hint).
- Tests: simular ausência (mesmo pattern de Phase 89.02 optional-deps.test.js).

**POL-17-02 (regen-manifest parallel):**
- `scripts/regen-manifest.js` linhas 60-65 — substituir for-loop sequencial por Promise.all batches=16. Mesmo pattern das Phases 88.01 e 90.01.
- Test: benchmark before/after.

**POL-17-03 (remove dead import):**
- `src/cli/index.js:33` — encontrar `getLocalVersion` import e remover.
- Verificar que nada usa essa função.

**POL-17-04 (JSDoc):**
- `src/core/path-safety.js` — adicionar `@param/@returns` em validateProjectRoot.
- (manifest-verify.js já recebeu em Phase 90.)

</decisions>

<code_context>
## Insights do Código Existente

- `src/ui/browser.js` já tem `await import('open')` lazy (Phase 89 pattern canônico).
- `scripts/regen-manifest.js` linhas 60-65 são for-loop com `await sha256()` sequencial.
- `src/cli/index.js:33` tem import morto identificado por Plan 89.01.

</code_context>

<specifics>
## Ideias Específicas

- `open` lazy + optional → quando ausente, browser.js retorna fallback string (mensagem instrutiva ou null).
- regen-manifest.js parallel benchmark via `time` ou `process.hrtime.bigint()`.

</specifics>

<deferred>
## Ideias Adiadas

- Mutation testing (já adiada para v1.18+).
- Extract runDoctorChecks em sub-helpers (v1.18+).

</deferred>
