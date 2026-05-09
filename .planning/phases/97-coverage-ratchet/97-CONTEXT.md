# Phase 97: Coverage Ratchet - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Depends on:** Phase 96 ✅

<domain>
**INFRA-18-01:** Subir coverage threshold de 65% → 75% em ci.yml endereçando 4 hot files de baixa cobertura identificados em Phase 93:
- src/cli/index.js — 37%
- src/mcp-server/install.js — 19%
- src/ui/auto-spawn.js — 31%
- src/core/failures.js — 17%

Adicionar testes para hot paths não-cobertos em cada um.

</domain>

<decisions>
### Restrições
- Stable API v1.0+ preservada — só testes novos, sem mudança em código fonte (a menos que coverage revele bug).
- Zero deps novas.
- Phase 79.01 / 84.01 / 89 invariants preservados.

### Diretrizes

**Approach por file:**

1. **`src/cli/index.js` (37% → 70%):** Subcommands raros não-exercitados. Identificar via coverage report quais. Possíveis: `kit doctor` partial paths, `kit reverse-sync apply`, `kit ui open` sem sidecar, `kit gates run` raros, error paths.

2. **`src/mcp-server/install.js` (19% → 70%):** Instalador IDE-specific (cursor, codex, gemini-cli, etc). Testar instalação para cada target.

3. **`src/ui/auto-spawn.js` (31% → 70%):** Lockfile + spawn behavior. Testar lockfile detection, spawn fallback, error paths.

4. **`src/core/failures.js` (17% → 70%):** Failure recording. Testar record + load + filter.

**Test files novos:**
- test/unit/cli-index-coverage.test.js
- test/unit/install-coverage.test.js
- test/unit/auto-spawn-coverage.test.js
- test/unit/failures-coverage.test.js

**Threshold update:**
- `.github/workflows/ci.yml` — bump 65 → 75 (após verificar baseline real).

**Cuidados:**
- Coverage report Node 20+ format pode mudar. Use mesmo parser do Phase 93 step.
- Se 75% threshold for inalcançável dentro do tempo razoável, ajustar para 70% e documentar ratchet plan para 80% v1.19+.

</decisions>

<deferred>
- Branch coverage (mais strict que line) — v1.19+.
- Mutation testing — v1.19+.
</deferred>
