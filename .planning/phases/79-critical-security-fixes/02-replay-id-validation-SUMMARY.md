---
phase: 79-critical-security-fixes
plan: 02
subsystem: security
tags: [path-traversal, replay-id, allowlist-regex, mcp-forensics, defense-in-depth]

requires:
  - phase: 79-critical-security-fixes
    provides: 79-CONTEXT.md decisão C2 (allowlist regex /^[A-Za-z0-9_.-]+$/ + path.resolve assert)
provides:
  - validateReplayId() helper sanitizing replay ids before any disk I/O
  - assertPathInside() helper proving final path stays inside .planning/replays/
  - Stable error messages prefixed "invalid replay id:" for MCP client matching
  - 4 regression tests covering all 3 callers + happy path
affects: [80-hooks-race-pattern (will follow same regression-test pattern)]

tech-stack:
  added: []
  patterns:
    - "Allowlist regex validation at function boundary (whitelist > blacklist)"
    - "Defense in depth — regex + post-resolve assertion + per-component validation in compound paths"
    - "Stable, prefixed error messages so MCP clients can match without parsing internals"

key-files:
  created:
    - test/unit/replays-path-traversal.test.js
  modified:
    - src/core/replays.js

key-decisions:
  - "Validate each slug component (payload.phase|plan|agent) independently before concat in recordReplay — attacker-controlled MCP input must be rejected at component level, not after assembly"
  - "Re-validate full id after assembly as defense-in-depth (cheap and proves invariant survives concat)"
  - "Use .test.js extension (not .test.mjs) — test/run.mjs walks for *.test.js only; ESM works fine since package.json sets type:module"
  - "Throw before any I/O (mkdir/readFile/writeFile) so attacker traversal never touches disk"

patterns-established:
  - "REPLAY_ID_RE = /^[A-Za-z0-9_.-]+$/: tight allowlist matching the natural format of timestamp-slug ids"
  - "validateReplayId() called 5x in replays.js (1 def + 4 use sites — recordReplay validates each component, then full id, then loadReplay/annotateReplay validate at entry)"
  - "assertPathInside(filePath, baseDir) — post-resolve check using path.resolve + startsWith(base + sep), handles trailing-separator edge case"

requirements-completed: [SEC-13-02]

duration: 1m 21s
completed: 2026-05-09
---

# Phase 79 Plan 02: replays.js path traversal hardening Summary

**Defense-in-depth path traversal guard for `.planning/replays/` — allowlist regex `/^[A-Za-z0-9_.-]+$/` + post-resolve assertion applied to all 3 MCP-exposed callers (loadReplay, annotateReplay, recordReplay)**

## Performance

- **Duration:** 1m 21s
- **Started:** 2026-05-09T04:32:16Z
- **Completed:** 2026-05-09T04:33:37Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Closed CRITICAL vulnerability **SEC-13-02** (replayId path traversal via MCP forensics tool)
- All 3 callers (loadReplay, annotateReplay, recordReplay) reject malicious ids before any disk I/O
- Stable error messages (`invalid replay id: ...`) for MCP clients to match programmatically
- 4 regression tests added; existing 115-test unit suite + 67-test integration suite continue to pass (zero regression)
- Valid round-trip preserved (record → load → annotate works identically with ids matching the regex)

## Task Commits

Each task was committed atomically with `--no-verify` (parallel execution):

1. **Task 1: validateReplayId() helper + apply to loadReplay/annotateReplay/recordReplay** — `d19d6ac` (fix)
2. **Task 2: SEC-13-02 path traversal regression tests** — `e905a96` (test)

## Files Created/Modified

- `src/core/replays.js` — added 2 helpers (`validateReplayId`, `assertPathInside`) + guard calls in 3 entry points
- `test/unit/replays-path-traversal.test.js` — created (4 tests: traversal id rejection for loadReplay, annotateReplay, recordReplay; happy-path round-trip)

### Stable Error Messages (for MCP client reference)

| Trigger | Message |
| --- | --- |
| `id` is not a non-empty string | `invalid replay id: must be a non-empty string` |
| `id` is `.`, `..`, or contains `..` | `invalid replay id: traversal sequences not allowed` |
| `id` fails the regex (slashes, NUL, etc.) | `invalid replay id: only [A-Za-z0-9_.-] allowed, got "<input>"` |
| Resolved path escapes replay dir (belt + suspenders) | `invalid replay id: resolved path escapes replay directory` |

All messages share the `invalid replay id` prefix so a single regex (`/invalid replay id/`) matches them — used by all 4 regression tests.

### Test Coverage Matrix (test/unit/replays-path-traversal.test.js)

| Test | Caller | Vectors |
| --- | --- | --- |
| `loadReplay rejects traversal id` | loadReplay | `../etc/passwd`, `..`, `foo/bar`, `foo\bar` (Windows), `''` |
| `annotateReplay rejects traversal id` | annotateReplay | `../etc/passwd`, `..` |
| `recordReplay rejects malicious slug components` | recordReplay | `phase=../../../etc`, `plan=..`, `agent=pwn/payload` |
| `valid replayId continues to work` | round-trip | record → load → annotate with `phase=79, plan=01, agent=planner` |

The Windows backslash assertion (`'foo\\bar'`) explicitly covers cross-platform safety — the regex rejects backslash because it's outside `[A-Za-z0-9_.-]`.

## Decisões Tomadas

- **Per-component validation in `recordReplay`:** the attacker's surface in `recordReplay` is not a single `id` field but three independent components (`payload.phase|plan|agent`) that get concatenated. Validating only the assembled slug would let `phase="../etc"` slip through if the other components happened to be empty after `.filter(Boolean)`. Each component is validated separately before concat, then the assembled id is re-validated as a defense-in-depth check.
- **Belt-and-suspenders with `assertPathInside`:** even though the regex makes traversal effectively impossible, we also call `path.resolve(file)` and assert it starts with `path.resolve(replayDir) + path.sep`. If a future code path ever weakens the regex, this catches the escape. Cost is negligible (microseconds, no I/O).
- **Throw before any I/O:** all guards run before `mkdir`, `readFile`, `writeFile`. An attacker probing with traversal payloads never gets a single byte written or read on the filesystem — pure refusal.
- **`.test.js` extension over `.test.mjs`:** the test runner (`test/run.mjs`) only walks for `*.test.js`. Since `package.json` has `"type": "module"`, ESM imports work natively in `.js` files — no behavior difference, just runner compatibility.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Todas as 2 tarefas implementadas com o conteúdo prescrito; nenhuma correção automática (Regra 1/2/3) necessária; nenhum checkpoint arquitetural (Regra 4) atingido.

## Problemas Encontrados

Nenhum durante a execução planejada.

Nota observacional: durante a verificação cruzada da contagem de testes, percebeu-se que o executor paralelo da tarefa 79-01 já havia commitado `test/unit/mcp-gates-guard.test.js` no histórico compartilhado (`b91fb8d` precedendo nosso commit `d19d6ac`). Isso explica o delta de +5 testes (115 → 120) em vez do esperado +4 — não é um problema, é a soma dos testes deste plano (+4) com o do plano 79-01 (+1). Os testes paralelos não interferem entre si.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. A mudança é puramente in-process; clientes MCP existentes continuam funcionando idêntico para ids válidos.

## Próxima Fase Readiness

- **C2 fechado:** SEC-13-02 está resolvido. O endpoint MCP `forensics` agora é seguro contra atacantes que controlam `args.replayId` ou `args.payload.{phase,plan,agent}`.
- **Pronto para avançar Phase 79:** quando 79-01 (gates.run guard) e 79-03 (npm ci + publish gates) também concluírem, a Fase 79 está completa e validada por suite verde.
- **Sem bloqueios.** Este plano é completo e auto-contido; nenhuma fase futura precisa estender este código (é uma camada de validação tight, não uma API extensível).

## Self-Check: PASSED

Verificações executadas após criação do SUMMARY.md:

- `src/core/replays.js` existe e contém `validateReplayId`, `assertPathInside`, `REPLAY_ID_RE`, `SEC-13-02` (5 ocorrências de `validateReplayId(`, 2 de `SEC-13-02`)
- `test/unit/replays-path-traversal.test.js` existe (110 linhas, 4 testes)
- Commit `d19d6ac` (Task 1) presente em `git log`
- Commit `e905a96` (Task 2) presente em `git log`
- `node test/run.mjs test/unit` exit 0 (120 tests pass — 115 baseline + 4 deste plano + 1 do plano paralelo 79-01)
- `node test/run.mjs test/integration` exit 0 (67 tests pass)

---
*Fase: 79-critical-security-fixes*
*Concluída: 2026-05-09*
