---
phase: 85-token-economy-wave-2
plan: 01
subsystem: api
tags: [mcp, cli, json-schema, token-economy, performance, regression-tests]

requires:
  - phase: 81-token-economy
    provides: slim() helper + summarize() + SUMMARY_MAX_CHARS=80 cap (PERF-13-01)
provides:
  - terse:boolean param in MCP kit list-* handlers (additive, default false)
  - --terse CLI flag in kit list-agents/list-commands/list-skills
  - slimTerse(x) helper returning {kind, name} (paridade cross-surface)
  - 4 regression tests covering shape + ≥40% reduction + CLI parity + backward-compat
affects: [phase-86, future-clients, token-budget]

tech-stack:
  added: []
  patterns:
    - "additive flag pattern (terse aditivo vs tool variant) — schema invariante, surface mínima"
    - "cross-surface helper parity (slimTerse local em mcp-server e cli — mesmo shape, fonte distinta)"
    - "corpus-real measurement em regression test (Buffer.byteLength + JSON.stringify)"

key-files:
  created:
    - test/unit/terse-mode.test.js
  modified:
    - src/mcp-server/index.js
    - src/cli/index.js

key-decisions:
  - "Param `terse:true` (não tool variant `list-agents-terse`) — schema enum estável, composável com flags futuros"
  - "slimTerse local em ambos arquivos (mesmo pattern do slim original) — não exportar helper interno"
  - "renderKitList intocado — fallback `?? ''` em description já tolera ausência"
  - "CLI args ordenados como `--json` antes de `kit ...` — paridade com canonical pattern em test/integration/cli-roundtrip.test.js"

patterns-established:
  - "Additive boolean params em MCP schema: type:'boolean' + default false documentado, action enum inalterado"
  - "Regression test de payload reduction: assert ≥X% via Buffer.byteLength(JSON.stringify(corpus_terse)) vs corpus_default"
  - "CLI `.option('--flag', 'desc (REQ-ID)')` + `(opts)=>{}` action — additive sem breaking existing arg-less callers"

requirements-completed: [PERF-15-01]

duration: 6min
completed: 2026-05-09
---

# Phase 85 Plan 01: Terse Mode Summary

**`terse:true` param + `--terse` CLI flag em list-agents/list-commands/list-skills retornam apenas `{kind, name}` — payload medido em corpus real reduz 68.8% (well above ≥40% threshold)**

## Performance

- **Duração:** ~6 min
- **Iniciado:** 2026-05-09T12:02Z
- **Concluído:** 2026-05-09T12:08Z
- **Tarefas:** 2/2
- **Arquivos modificados:** 3 (2 modified + 1 created)

## Accomplishments

- MCP `kit` tool inputSchema ganha `terse:boolean` aditivo (action enum inalterado em 5 valores).
- `handleKit` seleciona `slimTerse` quando `args.terse===true`; default preserva `slim()+summarize()` cap-80 (zero breaking).
- CLI `kit list-agents/list-commands/list-skills` ganham `--terse` flag com paridade comportamental exata.
- 4 regression tests novos em `test/unit/terse-mode.test.js`:
  1. **shape** — `{kind, name}` exato (2 keys, sem description em qualquer item).
  2. **payload reduction** — corpus real (179 items: 47 agents + 56 commands + 76 skills+extras) mostra **68.8% redução** (25486 → 7942 bytes), well above ≥40% acceptance.
  3. **CLI parity** — `kit --json kit list-agents --terse` produz mesmo shape de MCP terse=true.
  4. **backward-compat** — CLI sem `--terse` mantém description (preserved slim+summarize behavior).

## Task Commits

Cada tarefa committed atomicamente com `--no-verify`:

1. **Task 1: MCP terse mode (handleKit + schema + slimTerse)** — `efd0709` (feat)
2. **Task 2: CLI --terse flag + 4 regression tests** — `2471063` (feat)

## Arquivos Criados/Modificados

- `src/mcp-server/index.js` (modified) — adicionado `terse:boolean` ao TOOLS[0].kit inputSchema; adicionado `slimTerse(x)` helper retornando `{kind, name}`; `handleKit` seleciona variant via `args.terse===true`.
- `src/cli/index.js` (modified) — adicionado `slimTerse(x)` helper paridade com mcp-server; 3 commands ganham `.option('--terse', ...)` e selecionam variant.
- `test/unit/terse-mode.test.js` (created) — 4 regression tests (PERF-15-01).

## Measurement Result (PERF-15-01 Acceptance)

```
[PERF-15-01] reduction: 68.8% (25486 -> 7942 bytes across 179 items)
```

Em corpus kit-mcp v1.14 atual:
- **Default payload:** 25,486 bytes (47 agents + 56 commands + 76 skills+extras com description capped a 80 chars)
- **Terse payload:** 7,942 bytes (mesmo corpus sem description)
- **Reduction:** 17,544 bytes economizados = **68.8%**
- **Threshold required:** ≥40% — supera com larga margem.

A redução é maior que estimativa do CONTEXT.md (~40-50%) porque cada item já tem `kind` + `name` representando bytes não-trivial; remover description em corpus de 179 items elimina ~17.5KB de payload-puro-descricional.

## Suite de Testes

- **Antes:** 191 unit (189 pass + 2 skipped) + 84 integration = 275 tests
- **Depois:** 195 unit (193 pass + 2 skipped) + 84 integration = **279 tests, 0 fails, 2 skipped pre-existing**
- **Delta:** +4 testes novos (todos PERF-15-01), zero regressão.

## Decisões Tomadas

1. **Param aditivo `terse:true` vs tool variant `list-agents-terse`** — Conforme CONTEXT.md decision: tool variant adiciona 3 enum values ao schema (cliente vê 8 actions vs 5). Param aditivo é menos surface, schema muda menos, e composável com flags futuros (ex: `verbose:true` opcional). Action enum permanece estável.
2. **`slimTerse` local em ambos arquivos (não export)** — `slim()` original também não é exportado; ambos são internos ao módulo. Reuso entre MCP/CLI feito por copy-of-helper (mesmo pattern do `slim` em cli/index.js linha 150).
3. **`renderKitList` intocado** — Inspeção mostrou `(x.description ?? '').slice(0, 80)` linha 40 — já tolerante a description undefined. Zero mudança em renderer.
4. **`--json` antes de `kit list-agents`** — Commander trata `--json` como global option do root program; precisa preceder subcommand args. Conformidade com canonical pattern em `test/integration/cli-roundtrip.test.js:40` (`runCli(['--json', 'kit', 'list-agents'])`).

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Zero edge case bloqueador.

**Edge case observado (não-bloqueador):** O verify pós-tarefas `node -e "import('./src/cli/index.js').catch(...)"` exit 1 normalmente (commander auto-help dispatch quando sem args). Isso é o `program.parseAsync(process.argv)` side-effect, não syntax error — mcp module loaded clean (`mcp ok`), conforme nota do plan no NOTA — POR QUÊ spawnSync.

## Problemas Encontrados

Nenhum. Toda implementação inline, todos os tests passaram first-try, suite verde.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. Pure code change.

## Self-Check

- `src/mcp-server/index.js`: FOUND ✓ (efd0709 commit)
- `src/cli/index.js`: FOUND ✓ (2471063 commit)
- `test/unit/terse-mode.test.js`: FOUND ✓ (2471063 commit)
- Commit `efd0709`: FOUND ✓
- Commit `2471063`: FOUND ✓
- Suite green 279 tests: VERIFIED ✓

## Self-Check: PASSED

## Prontidão para Próxima Fase

Plan 85.02 (compatibility dedup nos 27 agents) executado em paralelo via outro executor — não é dependência. Plan 01 está autocontido e produciona-ready.

**Stable API v1.0+ preservada:** flag aditiva, default false → comportamento idêntico para clientes existentes. MCP schema action enum inalterado. CLI sem `--terse` retorna shape antigo.

**Budget 6/6 deps mantido:** zero novas dependencies.

**Token economy delivered:** clientes que só precisam descobrir nomes (UI list population, slug validation) podem opt-in via `terse:true`/`--terse` e economizar 68.8% do payload. Para casos onde description é necessário, default behavior (cap-80) preservado.

---
*Fase: 85-token-economy-wave-2*
*Concluída: 2026-05-09*
