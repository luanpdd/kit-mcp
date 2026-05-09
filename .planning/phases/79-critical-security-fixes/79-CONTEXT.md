# Phase 79: Critical Security Fixes - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Fechar 4 vulnerabilidades CRITICAL/HIGH identificadas pela meta-auditoria de 12 agentes paralelos sobre kit-mcp v1.12.1:

1. **C1 — `gates.run` via MCP exec arbitrário (CRITICAL):** `src/mcp-server/index.js:202-208` chama `runGate(id, { yes: true })` que skipa o "y/N before exec" prometido. Combinado com reverse-sync que pode reescrever `gates/*.md`, qualquer MCP client pode executar shell arbitrário.

2. **C2 — `replayId` path traversal (CRITICAL):** `src/core/replays.js:51-65` (`loadReplay`/`annotateReplay`) concatena `id` em `path.join(.planning/replays/, ${id}.json)` sem sanitização. MCP client passa `id="../../../etc/passwd"` → lê/escreve qualquer JSON.

3. **C3 — `npm ci || npm install` fallback no publish (CRITICAL):** `.github/workflows/publish.yml:36` defeats lockfile reproducibility. Race-condition class de bugs (como v1.12.1) escapa via lockfile drift silencioso.

4. **C4 — publish workflow skipa tests + audit (CRITICAL):** `.github/workflows/publish.yml:47-53` faz `npm publish` direto, sem `npm test` nem `npm audit`. v1.12.1 race condition escapou exatamente por aqui.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração (`workflow.skip_discuss=true`). Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código para guiar decisões.

### Restrições absolutas (não-negociáveis derivadas do milestone)
- Stable API v1.0+ preservada — `kit gates run` CLI continua funcionando idêntico (apenas a surface MCP de exec muda).
- Zero regressão em testes existentes (`test/unit/` + `test/integration/`).
- Suite de testes existente serve de regression — novos testes unitários para os 4 fixes são bem-vindos mas não obrigatórios nesta fase (regression tests específicos vão para Fase 80 junto com o pattern dos hooks).
- Budget 6/6 deps mantido — nenhuma nova dependência runtime.

### Diretrizes de implementação
- **C1:** preferir guard inline em `handleGates` que requer flag explícita (e.g., `confirmedByHumanInteractiveTty:true`) injetada apenas pelo CLI runner, não disponível via MCP message.
- **C2:** validação por allowlist regex `/^[A-Za-z0-9_.-]+$/` + `path.resolve` + assert prefix. Aplicar a TODOS os 3 callers de `id` em `replays.js` (loadReplay, annotateReplay, e recordReplay onde `payload.phase|plan|agent` viram slug).
- **C3:** mudança de 1 linha em publish.yml. Ver se ci.yml também tem o mesmo fallback (audit-anterior diz que sim) — se sim, fixar lá também (mesmo file, padrão repetido).
- **C4:** inserir steps `npm test`, `npm run test:integration`, `npm audit --omit=dev --audit-level=high` antes de `npm publish` no publish.yml.

</decisions>

<code_context>
## Insights do Código Existente

Contexto da base de código será coletado durante a pesquisa do plan-phase. Pontos relevantes já mapeados em `.planning/codebase/concerns.md` e `.planning/codebase/architecture.md`:

- `src/mcp-server/index.js` é 295 LOC, handler de tools como `gates`, `forensics`, `sync`, `reverse-sync`. Linha 202-208 é o handleGates.
- `src/core/gate-runner.js` linha 47-75 é runShellGate; linha 134-156 escreve script tmp e spawna bash. `yes:true` skipa interactive prompt.
- `src/core/replays.js` 51-65 tem loadReplay/annotateReplay. Linha 27 também concatena slug com `payload.phase|plan|agent`.
- `.github/workflows/publish.yml` 89 linhas. Linha 36 = npm install fallback. Linhas 47-53 = setup tag → publish steps.

</code_context>

<specifics>
## Ideias Específicas

- Tudo em um único PR (revisão coesa, mas commits atômicos por fix — 4 commits).
- Mensagens de erro descritivas e estáveis para que MCP clients possam codificá-las (ex.: "MCP gates.run requires interactive TTY confirmation; use `kit gates run` from CLI instead.").
- Para C2, manter compat: `replayId` válido (que matches regex) continua funcionando idêntico — só o caminho rejeitado é o malicioso.

</specifics>

<deferred>
## Ideias Adiadas

- Geração de testes de regressão para os 4 fixes — adiado para Phase 80 (junto com hooks race regression test, formando suite de "race condition + security regression").
- Auditoria mais profunda de outros endpoints MCP (sync, reverse-sync, forensics) — fica para milestone futuro v1.14.
- Bump do SDK MCP para versão sem express+hono+fast-uri — fica para v1.14 (envolve testar boot + smoke completo).

</deferred>
