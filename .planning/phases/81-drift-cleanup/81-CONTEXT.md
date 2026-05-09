# Phase 81: Drift Cleanup - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)
**Depends on:** Phase 79 ✅

<domain>
## Limite da Fase

Eliminar 3 fontes de drift que vão piorando ao longo do tempo, identificadas pela meta-auditoria (TOIL-AUDIT.md + concerns.md):

**M1 — CHANGELOG drift**: CHANGELOG.md tem entries até v1.10.0 mas v1.11.0, v1.12.0, v1.12.1 estão **ausentes**. O `publish.yml:73-76` extrai release notes via `awk` e cai no fallback "Release vX.Y.Z" silenciosamente. Backfill obrigatório + transformar warning em `exit 1`.

**M2 — README counts drift**: README.md tem contadores hardcoded em 7 lugares ("19 agents / 60 commands / 1 skill") mas a realidade atual é **47 agents / 87 commands / 49 skills** (drift +147% / +45% / +4800%). Ou substituir por valores reais OR auto-gerar via script.

**M4 — MCP version drift**: `src/mcp-server/index.js:265` hardcoda `version: '0.1.0'` enquanto `package.json` é v1.12.1+. Ler de package.json (mesmo padrão de bin/cli.js:43-51).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas são de discrição do Claude — discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — nenhuma mudança em contratos.
- Zero regressão em testes (204 baseline pós-Phase 80).
- Budget 6/6 deps mantido.

### Diretrizes de implementação

**M1 (CHANGELOG):**
- Backfill entries para v1.11.0, v1.12.0, v1.12.1 baseando em:
  - git log entre tags `v1.10.0..v1.11.0`, `v1.11.0..v1.12.0`, `v1.12.0..v1.12.1`
  - .planning/milestones/v1.11-ROADMAP.md, .planning/milestones/v1.12-ROADMAP.md (já têm bullets bem estruturados — pode adaptar)
  - Estilo das entries existentes em CHANGELOG.md (seguir conventions já estabelecidas)
- Transformar warning em hard fail no publish.yml: se `awk` retorna vazio para a tag, `exit 1` com mensagem clara.

**M2 (README counts):**
- 2 abordagens viáveis:
  1. **Substituição estática**: trocar "19 agents / 60 commands / 1 skill" por valores reais (47 agents, 87 commands, 49 skills) em todas as 7 ocorrências.
  2. **Auto-gen**: adicionar bloco `<!-- AUTOGEN-COUNTS-START --> ... <!-- AUTOGEN-COUNTS-END -->` no README + script `scripts/update-readme-counts.js` chamado em prepublishOnly.
- Decisão: **abordagem 1 (substituição estática)** — abordagem 2 requer mais infra. Substituição estática + adicionar entry no TOIL-AUDIT.md como "drift recorrente — automatizar em v1.14".

**M4 (MCP version):**
- Mudança de 1 linha: substituir `version: '0.1.0'` em src/mcp-server/index.js:265 por leitura síncrona de package.json (pattern de bin/cli.js:43-51 que já faz isso).
- Adicionar regression test que assert `serverInfo.version` = `package.json.version` ao invocar `initialize` em MCP server.

</decisions>

<code_context>
## Insights do Código Existente

- CHANGELOG.md último: `## [1.10.0]`. Próxima entry deve seguir mesmo formato (date, sections, links).
- `bin/cli.js:43-51` lê package.json via `JSON.parse(readFileSync(...))` — pattern reutilizável.
- README.md tem 33KB com contadores em vários lugares (use grep para encontrar).
- `.github/workflows/publish.yml:73-76` tem awk-extract com fallback para "Release vX.Y.Z" string.

</code_context>

<specifics>
## Ideias Específicas

- CHANGELOG entries devem ser concisas (mirror v1.10.0 length) — bullets para deliverables principais, link para milestone roadmap externalized.
- Test pattern para M4: spawn `node bin/mcp.js`, write JSON-RPC `initialize` request, parse response, assert `serverInfo.version` matches package.json.

</specifics>

<deferred>
## Ideias Adiadas

- Auto-gen do README counts via script — v1.14.
- Backfill de release notes do GitHub para tags antigas — v1.14.
- Outros drifts identificados na auditoria (file-manifest.json verification, etc) — v1.14.

</deferred>
