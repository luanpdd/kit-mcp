---
phase: 102-auto-snapshot-metrics-tool
plan: 01
subsystem: observability
tags: [metrics, snapshot, mcp, persist, throttle, golden-signals, OBS-20-01]

requires:
  - phase: 99-metrics-retention-burn-rate
    provides: persistSnapshot/loadSnapshots/cleanup wired (manual trigger only)
  - phase: 94-golden-signals-mcp-server
    provides: handleMetricsSnapshot + in-memory counters/histograms
provides:
  - Auto-persist snapshot side effect in handleMetricsSnapshot (parameterless)
  - 1-second in-memory throttle (_lastAutoPersistTs guard)
  - Graceful fs error handling (stderr log, handler does not crash)
affects: [phase-103-multi-window-burn-rate, /burn-rate-status, .planning/metrics/snapshots/]

tech-stack:
  added: []
  patterns:
    - "Module-level throttle state (no shared mutable Map; primitive number)"
    - "Graceful side-effect: try/catch around persistSnapshot, log to stderr"
    - "Test isolation via mkdtemp + process.chdir + cache-bust import"
    - "Cross-platform fs error trigger via blocker file (ENOTDIR on Windows + Linux + macOS)"

key-files:
  created:
    - test/unit/mcp-metrics-snapshot-auto-persist.test.js
  modified:
    - src/mcp-server/index.js (handleMetricsSnapshot + import + throttle state)

key-decisions:
  - "Throttle window 1s — generous vs typical 30s+ polling cadence; protege contra polling agressivo sem afetar uso normal"
  - "State em-memory (no persistent ts file) — reset on server restart é aceitável; trade-off vs disk dependency"
  - "Graceful fs error: stderr log + handler returns payload — preserva contrato MCP em ambientes read-only/quota-exceeded"
  - "Stable API v1.0+ literal: signature parameterless inalterada, return shape {counters, latency} inalterada"
  - "Test access via SDK internals (server._requestHandlers.get('tools/call')) — pattern de mcp-error-envelope.test.js — evita exportar handler ou __test helper"
  - "Cache-bust query string em dynamic import para reset throttle entre testes — zero export adicional, ESM idiomatic"
  - "Test 4 (fs error) usa blocker file (.planning como regular file) → fs.mkdir throws ENOTDIR — cross-platform vs monkey-patch ESM bindings"

patterns-established:
  - "Throttled side effect pattern: in-memory ts guard + try/catch wrap + return original payload regardless of side effect outcome"
  - "fs error in MCP handler: stderr log (operator visibility) + handler graceful (client contract preserved)"

requirements-completed:
  - OBS-20-01

duration: ~12 min (Task 1: 3min impl + verify, Task 2: 6min test design + run, Task 3: 3min summary + state)
completed: 2026-05-10
---

# Phase 102 Plan 01: Auto-snapshot in metrics-snapshot MCP Tool — Resumo

**handleMetricsSnapshot agora invoca persistSnapshot() automaticamente antes de retornar o payload, com throttle 1s in-memory e graceful fs error — fechando o gap operacional onde .planning/metrics/snapshots/ ficava vazio até trigger manual.**

## Performance

- **Duração:** ~12 min (impl: 3min, test: 6min, summary: 3min)
- **Iniciado:** 2026-05-10
- **Concluído:** 2026-05-10
- **Tarefas:** 3 (Task 1 modify handler + Task 2 4 regression tests + Task 3 summary)
- **Arquivos modificados:** 2 (1 modify + 1 create)

## Realizações

- **handleMetricsSnapshot agora persiste automaticamente** antes de retornar o payload in-memory
- **Throttle 1s in-memory** (`_lastAutoPersistTs` guard) — clientes que fazem polling rápido não criam N arquivos por segundo
- **Graceful fs error**: handler captura exception de persistSnapshot, escreve em stderr, retorna payload normal (contrato MCP preservado em ambientes read-only/quota-exceeded)
- **4 regression tests canônicos** cobrindo cada cenário do critério de aceite:
  1. First call → persist (1 arquivo criado)
  2. Second call < 1s → reuse (file count unchanged)
  3. Third call > 1s → persist (file count grows to 2)
  4. fs error during persist → handler returns payload, no crash
- **Stable API v1.0+ literal preservada** — `handleMetricsSnapshot` continua parameterless, return shape `{counters, latency}` inalterado
- **Suite green pre/post**: 542 → 546 unit (+4), 0 fail, 2 skip unchanged
- **Integration tests verificam fluxo end-to-end** — 109/109 green, snapshots reais aparecem em `.planning/metrics/snapshots/` após `metrics-snapshot` calls (proof live do feature)

## Commits das Tarefas

Cada tarefa foi commitada atomicamente:

1. **Task 1: Modify handleMetricsSnapshot in src/mcp-server/index.js** — `cf0c492` (feat)
2. **Task 2: Create 4 regression tests** — `af4a2a7` (test)
3. **Task 3: SUMMARY + STATE/ROADMAP closure** — (este commit, docs)

## Arquivos Criados/Modificados

- `src/mcp-server/index.js` — adicionado import `persistSnapshot`, módulo-level `_lastAutoPersistTs` + `AUTO_PERSIST_THROTTLE_MS`, handler reescrito com try/catch + throttle guard
- `test/unit/mcp-metrics-snapshot-auto-persist.test.js` — 4 testes canônicos com mkdtemp+chdir isolation, cache-bust import para reset throttle, blocker file para forçar ENOTDIR

## Decisões Tomadas

1. **Throttle 1s in-memory (não persistido)** — janela conservadora vs polling típico ≥30s; reset on server restart aceitável vs adicionar arquivo de state (e o overhead de fs read on every call). Documentado em comentário inline.
2. **Graceful fs error path** — `try/catch` ao redor de `persistSnapshot()`, `process.stderr.write` para visibilidade do operator, handler retorna payload normalmente. Preserva contrato MCP em fs read-only / disk-full / permission errors.
3. **Stable API v1.0+ literal preservada** — zero alterações de signature, zero exports novos, zero flags de comportamento opt-in. Mudança é side effect interno puro, transparente para clientes existentes.
4. **Test access via SDK internals** (`server._requestHandlers.get('tools/call')`) — pattern de `mcp-error-envelope.test.js` (Phase 84.01) e `mcp-server-paths.test.js` (Phase 100.01). Evita expor handler diretamente ou adicionar `__TEST_*` exports.
5. **Cache-bust query string em dynamic import** (`import('...?t=...')`) para reset do `_lastAutoPersistTs` entre testes — ESM idiomatic, zero modificação em src/, transitivamente reset os Maps de metrics.js também.
6. **Test 4 (fs error) via blocker file** — pre-criar `.planning` como arquivo regular (não dir) força `fs.mkdir(.../snapshots, {recursive:true})` a lançar `ENOTDIR`. Cross-platform (Windows + Linux + macOS), zero monkey-patch de ESM bindings (que são read-only).

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

Total de desvios: 0. Impacto: nenhum.

## Problemas Encontrados

Nenhum — Tasks 1-2 passaram em primeira execução. Acceptance criteria de Task 1 verificadas via grep (4 patterns hit corretamente), Task 2 dynamic import via Node.js v24.11.1 sem syntax errors. Suite all-green pre/post (542 → 546 unit, 0 fail).

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária.

## Prontidão para Próxima Fase

- **Phase 102 entregou OBS-20-01** completamente. ROADMAP/REQUIREMENTS atualizados.
- **Side effect verificável live**: integration tests do `mcp-metrics-snapshot.test.js` agora produzem 4 arquivos em `.planning/metrics/snapshots/` (gitignored, ephemeral) — prova end-to-end de que o feature funciona com o real `bin/mcp.js`.
- **Phase 103 (Multi-window burn-rate)** está pronto para começar — depende de snapshots auto-populados (já funcionando) + skill `burn-rate-alerting` (já existente). Sem bloqueios técnicos.

## Self-Check: PASSED

- `src/mcp-server/index.js` exists on disk ✅
- `test/unit/mcp-metrics-snapshot-auto-persist.test.js` exists on disk ✅
- `git log --oneline --all --grep="102-01"` returns ≥ 2 commits (cf0c492 feat + af4a2a7 test) ✅
- Suite all-green: 546 unit (542→546, +4), 544 pass, 0 fail, 2 skipped ✅
- Stable API v1.0+ literal preservada ✅

---
*Fase: 102-auto-snapshot-metrics-tool*
*Concluída: 2026-05-10*
