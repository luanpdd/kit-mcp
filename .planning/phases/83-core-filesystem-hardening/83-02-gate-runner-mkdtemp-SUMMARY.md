---
phase: 83-core-filesystem-hardening
plan: 02
subsystem: security
tags: [gate-runner, mkdtemp, symlink-toctou, tmpdir, sec-14-04]

requires:
  - phase: 79
    provides: gate-runner MCP guard (handleGates 251 — preserved here)
  - phase: 82
    provides: web/auth hardening baseline (222 tests)
provides:
  - "execScript: per-run mkdtemp dir + recursive cleanup (SEC-14-04 closed)"
  - "regression test: 4 SEC-14-04 specs (lifecycle + source-grep + concurrency)"
affects: [phase-84, gate-runner, security-audit]

tech-stack:
  added: []
  patterns:
    - "OS-level mkdtemp(3) for crypto-safe temp dir naming"
    - "Per-test TMPDIR/TMP/TEMP env-var isolation in node:test"

key-files:
  created:
    - test/unit/gate-runner-tmpdir.test.js
  modified:
    - src/core/gate-runner.js

key-decisions:
  - "Use fs.mkdtemp(path.join(os.tmpdir(), 'kit-gate-')) — kernel-atomic, name unpredictable; reject Date.now/Math.random suffix because predictable"
  - "Script path: dir/gate.sh (inside mkdtemp dir) — not /tmp pelado — so symlink TOCTOU window is closed even between mkdtemp and writeFile"
  - "Cleanup: fs.rm(dir, {recursive:true, force:true}) in finally — survives spawn errors, ENOENT, and any temp files the gate body might create inside dir"
  - "Test isolation: redirect os.tmpdir() per-test via TMPDIR/TMP/TEMP env vars — node --test runs each file in a child process, so env mutation doesn't leak"

patterns-established:
  - "Pattern: when creating per-run tmp resources, use mkdtemp + dir/file.ext + recursive rm finally — never path.join(tmpdir, predictable-name)"
  - "Pattern: source-grep regression tests are valid defense in depth when manifest doesn't cover src/"

requirements-completed: [SEC-14-04]

duration: ~12 min
completed: 2026-05-09
---

# Phase 83 Plan 02: gate-runner mkdtemp + cleanup Summary

**SEC-14-04 closed: gate-runner.execScript replaces predictable Date.now+Math.random tmp filename with fs.mkdtemp + per-run unique dir, eliminating symlink TOCTOU vector in shared multi-user /tmp.**

## Performance

- **Duração:** ~12 min
- **Iniciado:** 2026-05-09T~10:48Z
- **Concluído:** 2026-05-09T~11:00Z
- **Tarefas:** 2
- **Arquivos modificados:** 2 (1 source, 1 new test)

## Realizações

- **execScript hardened:** kernel-atomic mkdtemp (POSIX `mkdtemp(3)` / Windows equivalent using `CryptGenRandom`) generates a 6-char random suffix that an attacker cannot predict, blocking the pre-create-symlink-then-race attack on shared /tmp.
- **Recursive cleanup guaranteed:** `fs.rm({recursive,force})` in finally block — runs even if `spawn(bash, ...)` errors, even if the gate script self-deletes, even if the gate body creates extra files inside `dir`. force:true silences ENOENT.
- **Phase 79.01 MCP guard preserved:** `src/mcp-server/index.js handleGates` line 251 is untouched — `MCP gates.run` continues to refuse with "requires interactive TTY confirmation" message. CLI path (`bin/cli.js → kit gates run <id>`) gets the new mkdtemp behavior transparently.
- **4 regression tests added:** lifecycle on pass, lifecycle on fail (exit 42), source-grep guard against future regression, concurrent-runs-don't-collide assertion.

## Commits das Tarefas

1. **Task 1: Substituir execScript por mkdtemp + cleanup recursive** — `6a6a276` (fix)
2. **Task 2: Regression tests SEC-14-04 — directory lifecycle + cleanup** — `99d4d6b` (test)

## Arquivos Criados/Modificados

- `src/core/gate-runner.js` — `execScript` rewritten to use mkdtemp + recursive cleanup; comment block in execScript scrubbed of `Date.now()`/`Math.random()` substrings so source-grep regression test passes and so a future grep audit for "Math.random" returns nothing relevant in this file
- `test/unit/gate-runner-tmpdir.test.js` — 4 SEC-14-04 specs with TMPDIR/TMP/TEMP env isolation pattern

## Decisões Tomadas

- **mkdtemp over O_CREAT|O_EXCL on a predictable name:** `mkdtemp(3)` is the canonical POSIX primitive for "atomically create a directory with a unique random name"; rejecting an `O_EXCL` retry-loop avoids reinventing libc.
- **Cleanup with `rm({recursive,force})` instead of `unlink`+`rmdir`:** the gate body could (in theory) write files inside `dir`; `rmdir` would fail with ENOTEMPTY. Recursive cleanup also covers cleanup-on-error paths uniformly.
- **Test isolation via env vars rather than mocking `os.tmpdir`:** `os` is imported as ESM in gate-runner.js — vi-style module mocks aren't trivial in node:test. Empirically verified `os.tmpdir()` reads `TMPDIR/TMP/TEMP` at call time, so per-test env mutation cleanly isolates.
- **Source-grep test (Test 3) instead of live symlink-attack test:** Windows runners often lack symlink privileges (test would skip on primary CI matrix), and Linux/macOS race timing makes attack tests flaky. Source-grep + concurrency-test prove the same property (non-predictable name + robust cleanup) without flake.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 1 - Bug] Comentário em execScript continha substrings `Date.now()` e `Math.random()` que falhavam o gate de verify**
- **Encontrado durante:** Task 1 (verify automatizado do plan)
- **Problema:** O comentário inicial em `execScript` mencionava as funções antigas pelo nome literal (`"Date.now()+Math.random() filenames are predictable..."`), o que fazia o regex `/Date\.now\(\)|Math\.random\(\)/` do verify (que checa o source inteiro) retornar match — bloqueando o `done` criterion "Strings `Date.now()` e `Math.random()` REMOVIDAS de gate-runner.js".
- **Correção:** Reescrito o comentário para "Predictable timestamp+rand-suffix filenames are unsafe in multi-user /tmp" — mesma intenção, sem substring-match.
- **Arquivos modificados:** `src/core/gate-runner.js` (comment-only)
- **Verificação:** Verify do Task 1 passou após o ajuste (`mkdtemp:true no Date/Random:true recursive cleanup:true`).
- **Comitado em:** `6a6a276` (parte do commit do Task 1).

**2. [Regra 1 - Bug] Teste flake sob execução paralela de arquivos de teste — count-based assertion colidia com gates.test.js rodando em paralelo**
- **Encontrado durante:** Task 2 (suite paralela `gates.test.js + gate-runner-tmpdir.test.js`)
- **Problema:** A primeira versão dos testes 1, 2, 4 usava `countKitGateDirs()` retornando o length de `kit-gate-*` em `os.tmpdir()`. Como `gates.test.js` (rodando em paralelo via `node --test` em outro child process) também invoca `runGate` 4 vezes, o count delta no nosso test não era zero mesmo quando o cleanup do nosso runGate funcionava perfeitamente. Falha intermitente: `expected no leftover kit-gate dirs; before=0, after=1`.
- **Correção:** Trocado para abordagem de **isolamento de tmpdir**: cada test redireciona `os.tmpdir()` via env vars `TMPDIR`, `TMP`, `TEMP` para um dir dedicado per-test (`ISOLATED_TMP`); a contagem agora lê APENAS `ISOLATED_TMP`. Como `node --test` spawna cada arquivo em child process separado, env mutation não vaza para `gates.test.js`. Restaurado env no `afterEach` antes do rm para evitar surpresas.
- **Arquivos modificados:** `test/unit/gate-runner-tmpdir.test.js`
- **Verificação:** Suite paralela `node --test test/unit/gates.test.js test/unit/gate-runner-tmpdir.test.js` agora retorna 13/13 pass, 0 fail.
- **Comitado em:** `99d4d6b` (parte do commit do Task 2 — descoberto durante TDD-RED → fix antes do commit).

---

**Total de desvios:** 2 corrigidos automaticamente (Regra 1 — bug × 2)
**Impacto no plano:** Zero scope creep. Ambas as correções foram para passar os critérios do próprio plano (verify gate + estabilidade de teste). A intenção do plan executada como especificado.

## Problemas Encontrados

- **Execução paralela de 3 executores (Plans 01, 02, 03):** O git log mostra commits intercalados (`56718ee`, `5ebc150`, `1d1876e`, `6a6a276`, `1f9a09d`). Nenhum conflito de arquivo — cada plan toca arquivos disjuntos (Plan 02 = gate-runner.js + gate-runner-tmpdir.test.js; Plan 01 = mcp-server/index.js + projectroot guard test; Plan 03 = sync.js + manifest-verify.js + manifest-verify.test.js + cli-roundtrip.test.js). Suite full passou: 157 unit + 83 integration = 240 testes verde.

## Configuração Manual Necessária

Nenhuma — mudança puramente interna. Stable API v1.0+ preservada (`runGate()` signature inalterada, return shape inalterada). Behavior visível para o usuário inalterado: gates com exit 0 → passed, exit non-zero blocking → block, exit non-zero non-blocking → warn.

## Self-Check: PASSED

**Files exist:**
- FOUND: `src/core/gate-runner.js` (modified — execScript rewritten)
- FOUND: `test/unit/gate-runner-tmpdir.test.js` (created — 4 tests)

**Commits exist:**
- FOUND: `6a6a276` (fix(83-02): SEC-14-04 — gate-runner uses fs.mkdtemp + recursive cleanup)
- FOUND: `99d4d6b` (test(83-02): SEC-14-04 regression — 4 tests for tmpdir lifecycle)

**Verify commands all green:**
- `grep "mkdtemp" src/core/gate-runner.js` → 3 occurrences (1 code, 2 comments) ✓
- `grep "Date.now\|Math.random" src/core/gate-runner.js` → 0 occurrences ✓
- `node --test test/unit/gate-runner-tmpdir.test.js` → 4 pass, 0 fail ✓
- `node --test test/unit/gates.test.js` → 9 pass, 0 fail (zero regression) ✓
- `npm run test` (full unit) → 157 pass, 0 fail ✓
- `npm run test:integration` → 83 pass, 0 fail ✓

## Prontidão para Próxima Fase

Plan 02 entregue e verde. Phase 83 segue com Plan 03 (manifest-verify) já em paralelo — Plan 02 não bloqueia. Phase 84 (MCP error sanitization) segue ortogonal.

---
*Fase: 83-core-filesystem-hardening*
*Concluída: 2026-05-09*
