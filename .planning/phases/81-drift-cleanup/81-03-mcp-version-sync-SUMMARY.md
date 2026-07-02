---
phase: 81-drift-cleanup
plan: 03
subsystem: infra
tags: [mcp, drift-cleanup, observability, version-sync, package-json, regression-test]

requires:
  - phase: 79-critical-security-fixes
    provides: stable test infrastructure baseline (133 unit + 71 integration)
provides:
  - dynamic version reading from package.json in MCP server
  - PKG_VERSION named export from src/mcp-server/index.js
  - 4 regression tests guarding against version drift recurrence
affects: [publish-workflow, observability, mcp-clients-claude-code-cursor-codex]

tech-stack:
  added: []
  patterns:
    - "boot-time package.json read with try/catch + 'unknown' fallback (mirrors bin/cli.js:43-51)"
    - "named export of metadata constants for test-friendly verification (avoids SDK internal access)"

key-files:
  created:
    - test/unit/mcp-version.test.js
  modified:
    - src/mcp-server/index.js

key-decisions:
  - "Export PKG_VERSION as named export (vs reading SDK internals) — pure metadata, no MCP wire-protocol surface change, makes test independent of SDK upgrades"
  - "Boot-time constant (vs per-call readPkgVersion()) — eliminates redundant disk I/O on every createServer() call, matches bin/cli.js pattern"
  - "Fallback to 'unknown' (vs '0.1.0') — explicit failure signal beats false reporting; same decision as bin/cli.js:49"
  - "4 separate test cases (vs 1 monolithic) — each isolates a distinct regression class: import break, accidental revert, constructor wiring break, fallback-firing"
  - "Unit test against createServer() (vs spawn bin/mcp.js + JSON-RPC handshake) — equivalent regression power, deterministic on Windows CI, no port/timing fragility"

patterns-established:
  - "Drift guard pattern: any hardcoded version string in repo code MUST be replaced by package.json read with same try/catch + 'unknown' fallback used in bin/cli.js"
  - "SDK internals access pattern: tests may read server._serverInfo / server._requestHandlers but MUST graceful-skip if internals change (preserves CI green across SDK upgrades)"

requirements-completed: [DRIFT-13-03]

duration: 2.3min
completed: 2026-05-09
---

# Phase 81 Plan 03: MCP Version Sync Summary

**MCP server reads `serverInfo.version` from package.json at boot via `readPkgVersion()` mirroring bin/cli.js:43-51, plus 4-case regression test guarding against drift recurrence**

## Performance

- **Duração:** 2.3 min (138s)
- **Iniciado:** 2026-05-09T05:28:00Z
- **Concluído:** 2026-05-09T05:30:18Z
- **Tarefas:** 2
- **Arquivos modificados:** 2 (1 created + 1 modified)

## Realizações

- MCP `initialize` response now reports the real package version (1.12.1) instead of the stale hardcoded `'0.1.0'` — observability and bug-rastreability restored for all MCP clients (Claude Code, Cursor, Codex, Gemini, Windsurf, Antigravity, Copilot, Trae)
- Drift recurrence is now structurally impossible — version is read once at module load from a single source of truth (package.json)
- 4-case regression test guards each independent failure class: drift from package.json, accidental revert to '0.1.0', constructor wiring break, silent 'unknown' fallback
- Unit suite grew 133 → 137 tests, integration unchanged at 71, full prepublishOnly pipeline still green

## Commits das Tarefas

Cada tarefa foi comitada atomicamente:

1. **Tarefa 1: Adicionar readPkgVersion() em src/mcp-server/index.js + substituir hardcoded '0.1.0'** — `0e1ed60` (feat)
2. **Tarefa 2: Criar regression test em test/unit/mcp-version.test.js** — `b587f26` (test)

## Arquivos Criados/Modificados

- `src/mcp-server/index.js` — added 3 imports (`readFileSync`, `fileURLToPath`, `path`), added `readPkgVersion()` helper with try/catch + 'unknown' fallback, exported `PKG_VERSION` as named export at boot, replaced `version: '0.1.0'` with `version: PKG_VERSION` in `createServer()`. Total +22 −1 lines.
- `test/unit/mcp-version.test.js` — new file, 4 regression tests covering DRIFT-13-03 (PKG_VERSION ↔ package.json verbatim, anti-revert sentinel, _serverInfo wiring with graceful SDK-internal skip, semver shape sanity). Total +65 lines.

## Decisões Tomadas

1. **Named export `PKG_VERSION`** instead of test-time SDK internal access only.
   - **Justificativa:** SDK upgrades may rename `_serverInfo`. Exporting `PKG_VERSION` gives the test a stable surface independent of SDK internals. The export is pure metadata — it does NOT change the MCP wire protocol (clients only see version in the `initialize` response, not by importing JS modules), so Stable API v1.0+ is unaffected.

2. **Boot-time constant** instead of inline `readPkgVersion()` inside `createServer()`.
   - **Justificativa:** `createServer()` may be called multiple times (e.g. testing); re-reading package.json on each call adds I/O for zero benefit. The version cannot change at runtime without a process restart anyway. Mirrors bin/cli.js behaviour exactly.

3. **Fallback to `'unknown'`** when package.json read fails.
   - **Justificativa:** A false hardcoded fallback (e.g. `'0.1.0'`) is what created this entire bug class. Reporting `'unknown'` is honest signal that something is wrong with the install layout — operators can detect it. Matches bin/cli.js:49.

4. **Same `'..', '..'` path resolution as bin/cli.js** (no path divergence).
   - **Justificativa:** Both files are exactly 2 levels deep from repo root (`bin/cli.js` → `bin/`; `src/mcp-server/index.js` → `src/mcp-server/`). The same string works in both places, which makes the drift-guard pattern uniform and discoverable via `grep readPkgVersion`.

5. **Unit test against `createServer()` directly** instead of spawning `bin/mcp.js` + JSON-RPC handshake.
   - **Justificativa:** Spawn-based tests are timing-fragile on Windows CI runners (initialize → initialized → response sequence has TTL-sensitive flushes on stdio). Unit calling `createServer()` reaches the same `_serverInfo.version` field with deterministic timing. Cli-roundtrip integration suite already exercises spawn for the CLI path; adding spawn for MCP would be overkill for this single-string assertion.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 3 - Bloqueador] Plan's verify command used CJS `require()` inside ESM project**
- **Encontrado durante:** Tarefa 1 (verification step)
- **Problema:** The `<verify>` block in the plan ran `node -e "import('./src/mcp-server/index.js').then(m => { ... require('node:fs') ... })"`. Project is `"type": "module"`, so `require` is undefined inside the eval, throwing `ReferenceError: require is not defined` even though the underlying code change was correct.
- **Correção:** Adapted the verification to pure-ESM with `--input-type=module` and top-level `await import()`: `node --input-type=module -e "import { readFileSync } from 'node:fs'; const m = await import('./src/mcp-server/index.js'); ..."`. Outcome: `OK: PKG_VERSION = 1.12.1` exit 0.
- **Arquivos modificados:** None (verification command only — the plan's intent was preserved)
- **Verificação:** Re-ran with corrected command; result matches expected output described in plan's `<done>` block.
- **Comitado em:** N/A (was a transient verification adjustment, not a code change)

**2. [Regra 3 - Bloqueador] Plan's task-2 verify pointed `node test/run.mjs` at a single file path**
- **Encontrado durante:** Tarefa 2 (verification step)
- **Problema:** The plan's `<verify>` block was `node test/run.mjs test/unit/mcp-version.test.js`. The test runner (`test/run.mjs:18-26`) uses `fs.readdirSync` to walk a directory — passing a file path triggers `ENOTDIR: not a directory, scandir`.
- **Correção:** Used `node --test --test-force-exit --test-concurrency=1 test/unit/mcp-version.test.js` directly (the same flags the runner applies internally). All 4 tests passed. Then ran `node test/run.mjs test/unit` for full-suite verification (137 pass, the +4 from baseline).
- **Arquivos modificados:** None (verification command only)
- **Verificação:** Both targeted run (4/4 pass) and full-suite run (137/137 pass) green.
- **Comitado em:** N/A (verification adjustment only)

---

**Total de desvios:** 2 ajustes de comando de verificação corrigidos automaticamente (ambos Regra 3 - desbloqueio operacional)
**Impacto no plano:** Nenhum — desvios são em invocações de tools de verify, não em code-as-shipped. As funções entregues, os testes, e os commits seguem o plano exatamente como escrito. Sem expansão de escopo.

## Problemas Encontrados

Nenhum bug funcional. Os 2 desvios listados acima foram problemas em strings de comando do `<verify>` do plano (sintaxe de runtime CJS vs ESM, e uso de file path onde dir era esperado) — nenhum afetou o código produzido.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. A mudança é totalmente self-contained no boot do server (lê package.json no carregamento do módulo).

## Prontidão para Próxima Fase

- DRIFT-13-03 fechado end-to-end (production code + regression test guard)
- Pattern reutilizável estabelecido — qualquer string de versão hardcoded futura pode aplicar `readPkgVersion()` com o mesmo path resolution
- Plans 81.01 (CHANGELOG backfill) e 81.02 (README counts) podem prosseguir independentemente — este plan não tem dependências cruzadas
- Suite test verde (137 unit + 71 integration), prepublishOnly continua passando — release v1.13 desbloqueado deste lado

## Self-Check: PASSED

**Arquivos verificados existem:**
- FOUND: `D:\projetos\opensource\mcp\src\mcp-server\index.js` (modified, +22 −1)
- FOUND: `D:\projetos\opensource\mcp\test\unit\mcp-version.test.js` (created, 65 lines)

**Commits verificados existem:**
- FOUND: `0e1ed60` — feat(81-03): read MCP serverInfo.version from package.json
- FOUND: `b587f26` — test(81-03): add 4-case regression test for MCP version sync

**Verificações automáticas passaram:**
- `grep "version: '0.1.0'" src/mcp-server/index.js` → 0 matches ✓
- `grep "PKG_VERSION" src/mcp-server/index.js` → 2 matches (line 147 export + line 290 use in createServer) ✓
- `node -c src/mcp-server/index.js` → parse OK ✓
- `node test/run.mjs test/unit` → 137 pass / 0 fail ✓ (baseline 133 + 4 new)
- `node test/run.mjs test/integration` → 71 pass / 0 fail ✓ (unchanged)

---
*Fase: 81-drift-cleanup*
*Concluída: 2026-05-09*
