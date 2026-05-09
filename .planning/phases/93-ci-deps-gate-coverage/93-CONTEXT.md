# Phase 93: CI Deps Gate + Coverage Tooling - Contexto

**Coletado:** 2026-05-09
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)
**Depends on:** Phase 92 ✅

<domain>
## Limite da Fase

2 gaps de CI infrastructure identificados pela meta-auditoria pós-v1.16:

**INFRA-17-01 — CI deps budget gate ignora optionalDependencies:**
- `.github/workflows/ci.yml` deps gate só conta `dependencies`. Pós-Phase 92, total é 3 deps + 3 opt = 6.
- Gate atual permitiria adicionar 3 deps em `dependencies` sem alarme (orçamento efetivo 6+optional = 9).
- Fix: somar dynamics — `dependencies + optionalDependencies` total deve ser ≤6.

**INFRA-17-02 — Ausência de coverage tooling:**
- Suite tem 333+ tests mas zero visibilidade de branches não-testadas.
- `node --experimental-test-coverage` é flag built-in (Node 20+).
- Adicionar step CI que gera report + threshold gate ≥75% line coverage.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Discuss pulado.

### Restrições absolutas
- Stable API v1.0+ preservada — workflow change apenas; nenhuma mudança em src/.
- Zero regressão (333+ baseline pós-Phase 92).
- Coverage threshold 75% linha — escolha conservadora (kit-mcp tem boa cobertura mas não 100%; 75% catches ifs sem else, error paths não exercitados, etc).
- Budget 6/6 deps mantido (não muda nesta fase).

### Diretrizes

**INFRA-17-01 (deps gate):**
- `.github/workflows/ci.yml` step "Audit — deps budget" — rewrite para somar:
```bash
DEPS=$(node -p "Object.keys(require('./package.json').dependencies||{}).length")
OPT=$(node -p "Object.keys(require('./package.json').optionalDependencies||{}).length")
TOTAL=$((DEPS + OPT))
if [ "$TOTAL" -gt 6 ]; then echo "::error::deps budget exceeded: $TOTAL > 6"; exit 1; fi
```

**INFRA-17-02 (coverage):**
- Novo step em CI smoke job (apenas Linux Node 22, gated `if: matrix.target == 'claude-code'` para não duplicar em 8 IDEs):
```bash
node --experimental-test-coverage --test test/unit/*.test.js | tee coverage.txt
LINE_COV=$(grep "all files" coverage.txt | awk '{print $5}' | tr -d '%')
if [ "${LINE_COV%.*}" -lt 75 ]; then echo "::error::line coverage $LINE_COV% < 75%"; exit 1; fi
```

OR usar c8 (mais featureful mas adiciona dep). Decisão: usar `--experimental-test-coverage` (zero novas deps, suficiente para threshold).

### Cuidados especiais
- `--experimental-test-coverage` output format pode mudar entre Node versions; testar parse em CI runner.
- Coverage threshold 75% pode ser inicialmente fail — se fail, ajustar para baseline atual (e.g., 70%) com TODO para subir.

</decisions>

<code_context>
## Insights do Código Existente

- `.github/workflows/ci.yml` smoke job tem matrix axis target=[8 IDEs] (Phase 87) com step gating.
- `.github/workflows/ci.yml` audit job tem deps budget gate (linhas 47ish).
- Phase 86 prepublishOnly hook gera coverage indiretamente via tests, mas não threshold.

</code_context>

<specifics>
## Ideias Específicas

- Coverage step gated `if: matrix.target == 'claude-code'` (mesmo pattern de outros target-agnostic steps).
- Coverage report uploaded como artifact se framework permite.

</specifics>

<deferred>
## Ideias Adiadas

- c8 ou nyc tooling (deps externas) — overengineering pra Node 20 native.
- Branch coverage threshold (mais strict que line) — v1.18+.
- Mutation testing via stryker — v1.18+.

</deferred>
