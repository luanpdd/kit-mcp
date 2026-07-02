# Phase 89: Lazy Imports & Optional Deps - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)
**Depends on:** Phase 88 ✅

<domain>
## Limite da Fase

Fechar P2+P5+P6 da meta-auditoria — reduzir cold start do CLI e lighten tarball:

**PERF-16-04 (P2 — CLI cold start eager imports):**
- `src/cli/index.js` linha 32-37 importa eagerly `createServer` (UI HTTP), `wrapProgressForUi`, `openBrowser`, `http`, `fs`, `os`.
- Mesmo `kit kit list-agents` paga o custo (~100-200ms cold start).
- Solução: dynamic `await import()` dentro dos subcommands que usam UI/sidecar.

**PERF-16-05 (P5 — @inquirer/prompts optional):**
- `@inquirer/prompts` runtime dep com 18 sub-pkgs.
- Usado APENAS em `src/core/ui.js` para `select`/`confirm` interactive.
- Em modo MCP server (stdio) ou CI runs, NUNCA é invocado.
- Solução: mover para `optionalDependencies` + dynamic import + graceful fallback.

**PERF-16-06 (P6 — chokidar optional):**
- `chokidar` runtime dep, single import em `src/core/watch.js`.
- Usado APENAS em `kit sync watch` subcommand.
- Solução: mover para `optionalDependencies` + dynamic import (mesmo pattern de open@11 já existente em `src/ui/browser.js`).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — clientes que rodam `npm install` default continuam tendo todas as features funcionais (optionalDependencies são instaladas por default).
- Zero regressão (309 baseline pós-Phase 88).
- `npm install --omit=optional` deve resultar em CLI core funcional. `kit sync watch` e `kit ui` falham com mensagem descritiva.
- Budget total ainda 6/6 deps (4 dependencies + 2 optionalDependencies).

### Diretrizes de implementação

**PERF-16-04 (CLI lazy imports):**
- Identificar TODOS os top-level imports em `src/cli/index.js` que vêm de UI/sidecar.
- Substituir cada um por dynamic `await import()` dentro do subcommand handler que precisa.
- Pattern de referência: `src/ui/browser.js` já faz `await import('open')`.
- Não quebrar imports core que TODOS subcommands usam (commander, picocolors, fs, path).
- Test: medir cold start de `kit kit list-agents --terse` antes/depois (3x runs, take median).

**PERF-16-05 (@inquirer/prompts optional):**
- Em `package.json`: mover `@inquirer/prompts` de `dependencies` para `optionalDependencies`.
- `src/core/ui.js`: dynamic import com try/catch; se falhar, lançar erro descritivo "kit interactive prompts require @inquirer/prompts; rode `npm i @inquirer/prompts` ou use --no-interactive".
- Verificar todos call sites — atualmente são `select`/`confirm` em alguns commands.
- Test: simular ausência da dep e assert mensagem de erro.

**PERF-16-06 (chokidar optional):**
- Em `package.json`: mover `chokidar` de `dependencies` para `optionalDependencies`.
- `src/core/watch.js`: dynamic import com try/catch; se falhar, lançar erro descritivo "kit sync watch requires chokidar; rode `npm i chokidar`".
- Test: similar — assert mensagem se ausente.

### Cuidados especiais
- Phase 88 mexeu em sync.js, watch.js, reverse-sync.js — NÃO regredir aqueles fixes.
- watch.js já é importado dynamically em `kit sync watch` subcommand? Verificar — pode ser que cli já importe lazy. Se sim, P6 é só package.json move.
- `npm install --omit=optional` em CI test — verificar se CI já roda esse modo.

</decisions>

<code_context>
## Insights do Código Existente

- `src/cli/index.js` é grande (697 LOC v1.13 audit; pode ter crescido).
- `src/ui/browser.js` tem `await import('open')` — pattern canônico para esta fase.
- `src/core/ui.js` é tocado em runtime CLI interactivo (commander + picocolors).
- `src/core/watch.js` tocado em Phase 88.02 (debounce); preserve esse fix.

</code_context>

<specifics>
## Ideias Específicas

- **CLI cold start benchmark:** `time node bin/cli.js kit list-agents --terse` 3× consecutive runs (clear node cache entre).
- **Tarball reduction:** `npm pack --dry-run --json | jq` para before/after comparison.
- **Test pattern para optional dep ausente:** `node --import test/helpers/fake-missing.mjs ...` ou similar — depende de patterns existentes.

</specifics>

<deferred>
## Ideias Adiadas

- Lazy load de @modelcontextprotocol/sdk — escopo grande, é dep core; só faria sentido se `bin/mcp.js` rodar inline (não é o caso, MCP server é dedicated bin).
- Tree-shaking via bundler — overengineering, kit-mcp é distribuído via npm, sem bundler.

</deferred>
