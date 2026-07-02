# Phase 87: CI Matrix Expansion (8 IDEs) - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)
**Depends on:** Phase 85 ✅

<domain>
## Limite da Fase

Eliminar gap em `.github/workflows/ci.yml` onde só `claude-code` é exercitado em CI matrix — outros 7 IDEs (cursor, codex, gemini, windsurf, antigravity, copilot, trae) regridem em silêncio se sync workflow quebra para algum deles.

**DX-15-03 — CI matrix expansion:**
- Atual: smoke job tem matrix `os × node` (3×3 = 9 runs); sync round-trip exercita só `claude-code` hardcoded.
- Auditoria v1.13 (TOIL-AUDIT.md + CI/CD audit) explicitamente identificou: race condition v1.12.1 escapou exatamente porque os outros 7 IDEs NÃO são testados em CI.
- Solução: adicionar matrix axis `target: [claude-code, cursor, codex, gemini, windsurf, antigravity, copilot, trae]` no smoke job.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — workflow change apenas; nenhuma mudança em `src/`.
- Zero regressão (289 baseline pós-Phase 86).
- Budget 6/6 deps mantido.

### Diretrizes de implementação

**Matrix expansion strategy:**
- Adicionar `target: [claude-code, cursor, codex, gemini, windsurf, antigravity, copilot, trae]` em `.github/workflows/ci.yml` smoke job matrix.
- Substituir hardcoded `claude-code` por `${{ matrix.target }}` nos steps de sync round-trip.
- 8 IDEs × 3 OS × 3 Node = 72 runs total. Usar `fail-fast: false` para todos targets serem testados independente de falhas.

**Possíveis bugs revelados:**
- Plan deve incluir task de "investigar e fix bugs revelados pela expansion" como buffer.
- Cada target tem path resolution em `src/core/registry.js` — verificar se funciona em todos os 3 OS.
- Antigravity, Codex, Trae — são targets relativamente novos; podem ter path bugs específicos por OS.

**Otimização de CI cost:**
- 72 runs é alto. Considerar reduzir matrix em PRs (só Linux × 1 Node × 8 IDEs = 8 runs) e full matrix só em main push / tags.
- Decisão: full matrix sempre por enquanto. Otimização de cost é v1.16+.

**Sobre fixtures:**
- Cada target precisa de fixture local válida em test/fixtures/ (workspace dummy). Verificar se existe ou criar.

</decisions>

<code_context>
## Insights do Código Existente

- `src/core/registry.js` mapeia targets para paths. Verificar IDs supported: deveria ter as 8 IDEs.
- `.github/workflows/ci.yml` linha 130 e 159-180 (audit prévia identificou) hardcoded `claude-code`.
- `kit sync install <target> --target <ws>` é o comando exercitado.
- `kit sync remove <target> <ws>` é round-trip.

</code_context>

<specifics>
## Ideias Específicas

- **Test pattern:** ci.yml YAML lint via `js-yaml` ou Python yaml.safe_load.
- **Cada target acceptance:** comando install + remove exits 0; arquivos esperados criados/removidos.
- **Compute matrix expansion expected:** se runner é `${{ matrix.os }}` e cada matrix run pegou só `claude-code`, agora pega `${{ matrix.target }}` — comprovar em diff do YAML.

</specifics>

<deferred>
## Ideias Adiadas

- CI cost optimization (matrix subset em PR, full em main tag) — v1.16+.
- Cobertura cumulativa em test reports — separate observability scope.
- Per-target fixtures sintéticas mais ricas — esperar bugs reais aparecerem primeiro.

</deferred>
