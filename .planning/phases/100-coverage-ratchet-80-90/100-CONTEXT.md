# Fase 100: Coverage Ratchet 80% → 90% - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Elevar CI line coverage threshold de 80% → 90%. Identificar arquivos abaixo do alvo via `node --experimental-test-coverage` parsing, escrever testes targeted até atingir ≥ 90% real, atualizar `.github/workflows/ci.yml` THRESHOLD. Continuação direta da Phase 98 (v1.19, 75→80%). Suite cresce ≥ 30 testes (482 → ≥ 512). Stable API v1.0+ preservada (zero exports novos).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração do usuário. Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código para guiar decisões.

Padrão estabelecido pela Phase 98 (v1.19): identificar top arquivos abaixo do alvo, criar `test/unit/<file>-paths.test.js` ou `test/unit/<file>-subcommands.test.js` com edge cases targeted; usar runCLIAsync helper para subcommands; mock HTTP via fetch interceptors; manter zero deps novas.

</decisions>

<code_context>
## Insights do Código Existente

Contexto da base de código será coletado durante a pesquisa do plan-phase. Hint: arquivos prováveis abaixo de 90% após Phase 98 — `src/core/sync.js`, `src/core/reverse-sync.js`, `src/mcp-server/index.js`, `src/ui/server.js`, `src/ui/wrapper.js`, `src/core/forensics.js`. Veredict via baseline real do `--experimental-test-coverage` durante o planejamento.

</code_context>

<specifics>
## Ideias Específicas

REQ INFRA-20-01. Critérios de sucesso explícitos no ROADMAP.md:
- ci.yml THRESHOLD atualizado 80 → 90
- Top arquivos abaixo de 90% identificados via parsing de coverage report
- Cada arquivo recebe testes targeted até ≥ 90%
- Suite cresce ≥ 30 testes (482 → ≥ 512)
- CI all-green pós-merge
- Stable API v1.0+ preservada

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
