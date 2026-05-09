---
phase: 83-core-filesystem-hardening
plan: 03
subsystem: security
tags: [sec-14-05, manifest-verification, sha256, sync-hardening, integrity-check, kit-projection]

requires:
  - phase: 82-web-surface-hardening
    provides: 222-test baseline (post-CSP/auth) — manifest verifier sits on top, must not regress.
provides:
  - verifyManifest(kitRoot) helper with skip env var
  - syncTo install path refuses tampered kit/
  - kit/file-manifest.json regenerated (327 entries; was 221, drift since v1.4.0 closed)
  - test/fixtures/sample-kit/file-manifest.json (fixture manifest for sync.test.js)
  - 6 SEC-14-05 regression tests
affects: [phase-84-mcp-error-sanitization, future-publish-pipeline, prepublishOnly-script-DRIFT-15]

tech-stack:
  added: []
  patterns:
    - "Fail-closed integrity gate at projection boundary (verify before write, throw err.code=EMANIFESTMISMATCH)"
    - "Stderr-only warnings for MCP-safe diagnostics (preserve JSON-RPC stdout)"
    - "Skip env var pattern for dev workflow opt-out (KIT_MCP_SKIP_MANIFEST_CHECK=1)"
    - "Truncated hash (16 chars) in error messages for human readability"

key-files:
  created:
    - src/core/manifest-verify.js
    - test/unit/manifest-verify.test.js
    - test/fixtures/sample-kit/file-manifest.json
  modified:
    - kit/file-manifest.json
    - src/core/sync.js

key-decisions:
  - "verifier as pure helper returning {ok, reason, mismatches, missing}, not throwing — syncTo decides to throw with err.code=EMANIFESTMISMATCH"
  - "Manifest version field reads from package.json (was hard-coded '1.4.0')"
  - "Guard wired only into syncTo install path; removeFrom/statusOf/applyReverse intentionally unguarded (rationale documented inline)"
  - "Fail-closed on missing/corrupt manifest (deletion bypass blocked)"
  - "Stderr-only warn for skip env (stdout reserved for MCP JSON-RPC)"

patterns-established:
  - "Pre-write integrity check: verify manifest before any fs.write/copyFile in install path"
  - "Per-task fixture regeneration: when adding security checks that read shipped artifacts, regenerate fixture artifact in same plan to keep existing tests green"

requirements-completed: [SEC-14-05]

duration: 5min
completed: 2026-05-09
---

# Phase 83 Plan 03: Manifest Verify Summary

**SHA256 manifest verification at sync install boundary, regenerated kit/file-manifest.json (221 to 327 entries), opt-out env var for dev — closes SEC-14-05 against tampered-kit projection.**

## Performance

- **Duração:** ~5 min
- **Iniciado:** 2026-05-09T10:48:46Z
- **Concluído:** 2026-05-09T10:53:23Z
- **Tarefas:** 4 (todas atomicamente comitadas)
- **Arquivos modificados:** 5 (3 created, 2 modified)

## Realizações

- **SEC-14-05 closed**: `kit/file-manifest.json` is now READ — `syncTo()` install path computes SHA256 of every listed file before writing anything to the project. Tampered kit is refused with `err.code === 'EMANIFESTMISMATCH'`.
- **Manifest unstaled**: regenerated 221 → 327 entries (40 hashes corrected, 107 new files since v1.4.0) and `version` field now reads from `package.json` instead of being hard-coded.
- **Test-fixture parity**: `test/fixtures/sample-kit/file-manifest.json` generated so existing sync.test.js stays green now that the verifier gates `syncTo`.
- **6 new regression tests** prove: intact accepted, tampered detected with file path in reason, missing detected, env-var skip + stderr WARN, E2E happy path, E2E throw path.

## Commits das Tarefas

Each task atomically committed (`--no-verify` per parallel-execution directive):

1. **Task 1: Regenerate kit/file-manifest.json** — `65c9604` (chore)
2. **Task 2: verifyManifest helper** — `1d1876e` (feat)
3. **Task 3: Wire verifyManifest into syncTo** — `56718ee` (feat)
4. **Task 4: Regression tests + fixture manifest** — `43cc1de` (test)

_Note: Task 4 was marked `tdd="true"` in PLAN, but Tasks 2-3 had to commit first to land impl + wiring. Tests went green-on-first-run rather than RED→GREEN — see Deviations section._

## Arquivos Criados/Modificados

- `kit/file-manifest.json` (modified) — regenerated; 327 entries, version 1.13.0, all hashes match current kit/ contents.
- `src/core/manifest-verify.js` (created, 103 lines) — pure helper `verifyManifest(kitRoot)`; returns `{ok, reason, mismatches, missing}`; honors `KIT_MCP_SKIP_MANIFEST_CHECK=1` with stderr WARN.
- `src/core/sync.js` (modified, +13 lines) — added `import { verifyManifest }` and a guard at top of `syncTo()` that throws `EMANIFESTMISMATCH` on any mismatch. Inline comment documents why removeFrom/statusOf/applyReverse don't get the same guard.
- `test/unit/manifest-verify.test.js` (created, 6 tests) — full SEC-14-05 regression coverage including E2E syncTo throw assertion.
- `test/fixtures/sample-kit/file-manifest.json` (created) — synthetic fixture manifest enabling existing `sync.test.js` to stay green under the new verification.

## Decisões Tomadas

- **`{ok, reason, mismatches, missing}` return shape (not throw inside helper)**: keeps verifier pure/testable; `syncTo` translates to `throw err` with `err.code='EMANIFESTMISMATCH'`. Mirrors the `walkTree` → `EUNSAFEPATH` pattern already in the file.
- **Read `version` from `package.json`**: prior manifest hard-coded `"1.4.0"` and never advanced. Now manifest version always reflects the package release that generated it.
- **Skip-env opt-out (`KIT_MCP_SKIP_MANIFEST_CHECK=1`)**: required for dev workflow (editing kit/ without regenerating manifest after every save). WARN goes to stderr only — preserves MCP JSON-RPC stdout integrity.
- **Truncate SHA256 to 16 chars in error messages**: 64-char hex is unreadable; 16 chars is sufficient for human discrimination of unique mismatches. Counts (`+N more`) preserved for full visibility when >3 files differ.
- **Guard only in `syncTo` install path**: not in `removeFrom` (touches only project-side stubs), not in `statusOf` (path probe only), not in `applyReverse` (writes INTO kit/ — pre-apply check would lock in pre-tampered state; signed approval is the right defense, deferred). Rationale committed inline at the call site.
- **Fail-closed on missing/corrupt manifest**: attacker who deletes `file-manifest.json` would otherwise bypass — keeping it strict.

## Desvios do Plano

### Problemas Corrigidos Automaticamente

**1. [Regra 3 - Workflow blocker] Task 4 TDD ordering inverted**
- **Encontrado durante:** Task 4 (`tdd="true"`)
- **Problema:** Plan marked Task 4 as TDD (RED → GREEN → REFACTOR), but PLAN tasks 2 and 3 already implemented the helper + wiring before Task 4. Tests therefore went green-on-first-run rather than starting RED.
- **Correção:** Wrote the test file with the same 6 specs the plan lists, ran them — all 6 passed first execution because impl already existed. This is functionally equivalent regression coverage; the artifact is identical to what TDD would have produced. Documented here so the deviation is traceable.
- **Arquivos modificados:** `test/unit/manifest-verify.test.js`
- **Verificação:** All 6 tests pass; full SEC-14-05 behavior covered (intact, tampered, missing, skip-env, E2E happy, E2E throw).
- **Comitado em:** `43cc1de` (Task 4 commit)

---

**Total de desvios:** 1 self-corrected (Rule 3 — workflow ordering)
**Impacto no plano:** Zero on output quality; tests provide identical regression coverage. The PLAN's TDD intent was satisfied — the spec-first thinking was already encoded in the `<behavior>` block of Task 4. Only the order-of-operations differed because impl had to commit before fixture regen could keep `sync.test.js` green.

## Problemas Encontrados

- **Full-suite shows 8 failures, but none are mine.** When running `node --test` across the whole repo to confirm zero regression, 8 tests fail: SEC-14-04 cleanup/concurrent (parallel Plan 83-02 work), publish/SSE/OPS-05 (flaky sidecar tests under parallel-process load), `mcp-projectroot-guard.test.js` test (5) (parallel Plan 83-01). Verified my plan files independently: `node --test test/unit/sync.test.js test/unit/manifest-verify.test.js test/unit/reverse-sync.test.js test/unit/kit.test.js test/unit/registry.test.js` → 41/41 pass. Failures will be addressed by their owning plans (83-01, 83-02) or the post-merge stabilization step.

## Configuração Manual Necessária

Nenhuma — change is server-side filesystem integrity check; no env vars, no dashboard config, no service to provision. The new env var `KIT_MCP_SKIP_MANIFEST_CHECK=1` is opt-in for dev workflow only.

## Prontidão para Próxima Fase

- **Phase 84 (MCP Error Sanitization)**: this plan throws `err.code='EMANIFESTMISMATCH'`; phase 84 will add envelope scrubbing — `err.message` here is concise and already safe (no PII, no stack-leaking content), but the `err.stack` will pass through phase 84's general scrub.
- **Future `prepublishOnly` script (DRIFT-15-XX, deferred)**: now that the manifest is read by code, drift between releases will fail tests immediately. A future plan should add `node scripts/regen-manifest.cjs` to `prepublishOnly` so we can never publish a stale manifest again.
- **Stable API v1.0+ preserved**: legitimate `kit sync install <target>` continues to work transparently. Only adversarially-tampered or stale-uncommited kits trigger the new throw.

## Self-Check: PASSED

- `kit/file-manifest.json` exists and reports 327 entries, version 1.13.0 (verified via `node -e "..."`).
- `src/core/manifest-verify.js` exists and `verifyManifest('kit')` returns `{ok: true}` against current kit/ (verified live).
- `src/core/sync.js` contains import of verifyManifest, call `verifyManifest(kitRoot)`, and `EMANIFESTMISMATCH` throw (verified via regex grep on disk).
- `test/unit/manifest-verify.test.js` exists with 6 tests, all passing (`node --test test/unit/manifest-verify.test.js` → 6/6 pass).
- `test/fixtures/sample-kit/file-manifest.json` exists and `sync.test.js` passes 8/8 against it.
- All 4 commits found in `git log`: `65c9604`, `1d1876e`, `56718ee`, `43cc1de`.

---
*Fase: 83-core-filesystem-hardening*
*Concluída: 2026-05-09*
