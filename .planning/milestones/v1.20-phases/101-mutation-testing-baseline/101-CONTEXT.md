# Fase 101: Mutation Testing Baseline (stryker) - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Adicionar `stryker-mutator` como dev dep, configurar `stryker.config.json` para `src/core/`, criar npm script `test:mutation`, documentar baseline mutation score em `.planning/audits/v1.20/MUTATION-BASELINE.md`. Não bloqueia CI — execução opt-in local apenas. Gate v1.21+ depende deste baseline.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Stryker é o mutation tester canônico para Node.js/JS. Use `@stryker-mutator/core` + `@stryker-mutator/api` em devDependencies; runner = `command` (executa `node test/run.mjs test/unit`). Mutator scope: `src/core/**/*.js` inicialmente (10 arquivos críticos do core). Reporters: `html`, `json`, `clear-text`. Coverage analysis: `off` (test runner não suporta perTest). Output em `reports/mutation/` (gitignored).

Baseline measurement strategy: rodar localmente em src/core/ apenas, capturar mutation score (matemática: `(killed + timeout) / (killed + survived + timeout + noCoverage) * 100`), documentar breakdown por arquivo top 5 + ToDo list pra v1.21+ gate.

</decisions>

<code_context>
## Insights do Código Existente

src/core/ tem ~10 arquivos: registry.js, kit.js, sync.js, reverse-sync.js, gates/, forensics.js, watch.js, metrics.js, error-redaction.js, manifest-verify.js, path-safety.js, ui.js, reflect.js. Suite atual: 651 testes (542 unit + 109 integration), coverage 86.84%.

Phase 100 just elevated coverage substantially. Stryker run em src/core/ deve ter mutation score elevado se testes são comportamentais (não trivial).

</code_context>

<specifics>
## Ideias Específicas

REQ INFRA-20-02. Critérios de sucesso explícitos no ROADMAP.md:
- `stryker-mutator` em devDependencies com versão pinada; budget de runtime deps **inalterado** (deve ir em devDependencies)
- `stryker.config.json` configurado para src/core/, runner node:test, reporter html+json+clear-text
- `npm run test:mutation` executa Stryker e produz reports
- `.planning/audits/v1.20/MUTATION-BASELINE.md` com baseline score + breakdown top 5 + ToDo v1.21+
- Não modifica CI — execução opt-in local only
- `.gitignore` adiciona `reports/mutation/` e `.stryker-tmp/`

</specifics>

<deferred>
## Ideias Adiadas

- Stryker como gate de CI (mutation score ≥ X%) — depende deste baseline maturar
- Expansão para src/cli/, src/ui/, src/mcp-server/ — v1.21+ baseado em ROI
- AI-mutation-tester (agente do kit) usado pra gerar mutants comportamentais — meta-loop, fora do escopo desta fase

</deferred>
