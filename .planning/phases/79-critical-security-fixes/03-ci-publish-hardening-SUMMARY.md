---
phase: 79-critical-security-fixes
plan: 03
subsystem: infra
tags: [ci, github-actions, npm-audit, npm-ci, lockfile, publish-pipeline, security]

requires:
  - phase: meta-audit
    provides: concerns.md (C3 + C4 from 12-agent meta-audit on v1.12.1)
provides:
  - .github/workflows/publish.yml with strict npm ci + tests/integration/audit gates before publish
  - .github/workflows/ci.yml with strict npm ci in smoke job
affects: [80-hooks-race-token, 81-drift-cleanup, future-publishes]

tech-stack:
  added: []
  patterns:
    - "Strict reproducible install (npm ci) — no silent fallback to npm install"
    - "Test-before-publish gate (unit + integration + audit) — never publish without tests passing"
    - "Inline REQ comment per step (SEC-13-03 / SEC-13-04) for traceability in CI logs"

key-files:
  created: []
  modified:
    - .github/workflows/publish.yml
    - .github/workflows/ci.yml

key-decisions:
  - "C3 fix: add SEC-13-03 inline comment above npm ci to document why fallback was removed (lockfile drift must fail hard)"
  - "C4 fix: reuse exact npm audit pattern from ci.yml (set +e + status check + ::error::) for operational consistency between CI and publish"
  - "Audit gate is armed but currently failing baseline due to pre-existing CVEs in @modelcontextprotocol/sdk transitive deps (1 HIGH fast-uri + 3 moderate). Per plan acceptance criteria, this does NOT block this plan — closing the gate is escalated to v1.14 dep bump (concerns.md TOP-1)."

patterns-established:
  - "Pattern: Every workflow install step has SEC-13-03 inline comment justifying npm ci strict"
  - "Pattern: Publish workflow gate ordering = Smoke → Tests (unit) → Tests (integration) → Audit → Publish"

requirements-completed: [SEC-13-03, SEC-13-04]

duration: 2min
completed: 2026-05-09
---

# Phase 79 Plan 03: CI + Publish Workflow Hardening Summary

**Strict `npm ci` enforcement in publish + CI workflows, with mandatory unit/integration tests and high-CVE audit gate before any `npm publish` — closes the v1.12.1 race condition escape vector at the publish boundary.**

## Performance

- **Duration:** ~2min
- **Started:** 2026-05-09T04:31:29Z
- **Completed:** 2026-05-09T04:33:21Z
- **Tasks:** 3 (Task 1 + Task 2 = 2 commits; Task 3 = pure verification, no commit)
- **Files modified:** 2

## Accomplishments

- **C3 closed:** `npm ci || npm install` silent fallback removed from BOTH `.github/workflows/publish.yml:36` and `.github/workflows/ci.yml:117`. Lockfile drift now fails hard at install time.
- **C4 closed:** Three new gates inserted in publish.yml between Smoke test and Publish to npm — Tests (unit), Tests (integration), and Audit (npm audit --omit=dev --audit-level=high) — using the same error-handling pattern as ci.yml for consistency.
- **Traceability:** Each modified/inserted step carries an inline REQ comment (SEC-13-03 or SEC-13-04) so CI log readers can trace the gate to its requirement without leaving the YAML.
- **Zero regression:** 120/120 unit tests pass + 67/67 integration tests pass against the modified workflow contracts.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel execution mode — orchestrator validates hooks once after all agents complete):

1. **Task 1: Remove `|| npm install` fallback from publish.yml + ci.yml** — `b909e4c` (fix)
2. **Task 2: Insert tests + audit gates before npm publish in publish.yml** — `b91fb8d` (fix)
3. **Task 3: Local YAML lint + npm test + npm run test:integration + audit baseline** — verification only (no commit; results captured in this SUMMARY)

## Files Modified

### `.github/workflows/publish.yml`

**Diff resumido:**

- **Linha 35-37 (Task 1):** removido `|| npm install` do step Install; adicionado comentário SEC-13-03.
  ```yaml
  - name: Install
    # SEC-13-03: strict — fail hard on lockfile drift, no silent install fallback
    run: npm ci
  ```

- **Linhas 55-75 (Task 2):** inseridos 3 novos steps entre Smoke test e Publish to npm.
  ```yaml
  - name: Tests (unit)
    # SEC-13-04: never publish without unit tests passing — v1.12.1 race condition escaped exactly here
    run: npm test

  - name: Tests (integration)
    # SEC-13-04: never publish without integration tests passing
    run: npm run test:integration

  - name: Audit — npm audit (high/critical CVEs in runtime deps)
    # SEC-13-04: never publish if runtime deps have HIGH or CRITICAL CVEs
    shell: bash
    run: |
      set +e
      npm audit --omit=dev --audit-level=high
      STATUS=$?
      set -e
      if [ "$STATUS" -ne 0 ]; then
        echo "::error::npm audit found high/critical CVEs in runtime deps. Bump dep or wait for fix advisory before publishing."
        exit 1
      fi
      echo "OK: no high/critical CVEs in runtime deps"
  ```

- **Step ordering (verified):** Sanity → Smoke test → Tests (unit) [55] → Tests (integration) [59] → Audit [63] → Publish to npm [77] → Extract notes → Create Release.

### `.github/workflows/ci.yml`

**Diff resumido:**

- **Linha 116-118 (Task 1):** removido `|| npm install` do smoke job's step Install; adicionado comentário SEC-13-03.
  ```yaml
  - name: Install
    # SEC-13-03: strict — fail hard on lockfile drift, no silent install fallback
    run: npm ci
  ```

- **Linha 73 intacta:** `npm install --no-audit --no-fund --silent` no audit job NÃO foi modificado (é setup pré-`npm pack`, não install primário). Plan explicitamente preservou.

## Verification Results

### YAML structural sanity
```
OK: .github/workflows/publish.yml (no tabs, has jobs+steps)
OK: .github/workflows/ci.yml (no tabs, has jobs+steps)
```

`js-yaml` is not in the project's `node_modules` (dep budget = 6, no YAML lib). Used Node fallback validating no-tabs + presence of `jobs:` and `steps:` blocks — both files pass. Full YAML parse will run when GitHub Actions evaluates the workflow on next push of any tag/PR.

### Tests

**Unit tests:** `node test/run.mjs test/unit` → `120/120 pass, 0 fail` (duration 3.6s)
**Integration tests:** `node test/run.mjs test/integration` → `67/67 pass, 0 fail` (duration 9.9s)

### Audit baseline (what the gate will see on next tag push)

```
# npm audit report

fast-uri  <=3.1.1
Severity: high
fast-uri vulnerable to path traversal via percent-encoded dot segments
fast-uri vulnerable to host confusion via percent-encoded authority delimiters
node_modules/fast-uri

hono  <=4.12.17
Severity: moderate
Hono CSS Declaration Injection / JWT NumericDate / Cache Vary leakage
node_modules/hono

ip-address  <=10.1.0
Severity: moderate
ip-address XSS in Address6 HTML-emitting methods
node_modules/ip-address
  express-rate-limit  8.0.1 - 8.5.0
  Depends on vulnerable versions of ip-address
  node_modules/express-rate-limit

4 vulnerabilities (3 moderate, 1 high)
exit=1
```

**Interpretation:** The audit gate is now armed. Next `git push --follow-tags` for a `v*` tag will trigger publish.yml; the new Audit step will fail because of the 1 HIGH `fast-uri` CVE (transitive via `@modelcontextprotocol/sdk@1.29.0`).

**This is intentional and tracked:**
- Plan acceptance criteria §3.4 explicitly states: "ESTE PLAN NÃO BLOQUEIA — o objetivo é que o GATE CI exista; se ele já está vermelho ANTES do nosso fix, esse é um problema separado a ser endereçado em fase futura (concerns.md TOP 1 — bumper SDK)."
- The HIGH CVE will be closed in v1.14 via `@modelcontextprotocol/sdk` dep bump (which will pull in newer non-vulnerable transitive deps).
- Until v1.14 ships, any tag push will fail at the new Audit step, which is a desirable outcome — it forces explicit dep bump rather than silent publish of vulnerable code (the precise failure mode v1.12.1 demonstrated).

## Decisions Made

- **Inline REQ comments over separate ADR:** Each step carries `# SEC-13-03` or `# SEC-13-04` directly in the YAML so an SRE reading a failing CI log can trace the gate to its requirement in 1 keystroke (Ctrl-F SEC-13). Avoids the indirection of a separate doc reference.
- **Mirror ci.yml audit pattern verbatim:** Used `set +e` + status check + `::error::` annotation + descriptive message, identical to ci.yml lines 55-68. One pattern to learn, one mental model across both workflows. Slight wording difference in the error message ("Bump dep or wait for fix advisory before publishing" vs "Run `npm audit` locally and address before merging") because the actor is different — publish workflow is auto-run on tag push, CI is a PR/push gate.
- **Did NOT modify line 73 of ci.yml:** Per plan, `npm install --no-audit --no-fund --silent` in the audit job is setup for `npm pack`, not the primary install. Removing fallback there would break the pack audit. Preserved as-is.

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks completed in order with verification matching acceptance criteria.

## Issues Encountered

- **`js-yaml` not available locally:** Plan anticipated this and provided fallback (no-tabs check). Fallback executed cleanly — both YAML files pass structural sanity. Real YAML parse happens at GitHub Actions runtime on next tag push.
- **Audit baseline returns exit=1:** Expected and documented — 1 HIGH `fast-uri` CVE is pre-existing via `@modelcontextprotocol/sdk` transitive deps. Gate is armed; bump deferred to v1.14 (concerns.md TOP-1). This is a feature, not a bug — gate will block any v1.13.x release until deps are bumped.

## Manual Setup Required

None — no external service configuration. The two workflow YAML files are self-contained; GitHub Actions reads them automatically on next push.

## Next Phase Readiness

- **C3 + C4 closed:** publish.yml + ci.yml install steps are strict; publish.yml has full test + audit gauntlet before `npm publish`.
- **Race condition escape vector closed at publish boundary:** the v1.12.1 race condition (`process.exit` before TCP flush in `sidecar-tool-publisher.js`) escaped because the publish workflow skipped `npm test` entirely. With this plan, `npm test` is now mandatory; the same class of bug cannot escape via the publish path again.
- **For Phase 80:** Hooks race pattern fix in 6 hooks + token economy quick wins. The new `npm test` gate in publish.yml will catch any regression introduced by Phase 80's hook changes — extra confidence margin for the next phase.
- **For v1.14 (future milestone):** Bump `@modelcontextprotocol/sdk` to a version without `fast-uri@<=3.1.1` (TOP-1 concern). Until that bump lands, no v1.13.x patches can be published — the audit gate will fail. This is the intended pressure mechanism.

## Self-Check: PASSED

- [x] `.github/workflows/publish.yml` exists and was modified (verified via Edit success)
- [x] `.github/workflows/ci.yml` exists and was modified (verified via Edit success)
- [x] Commit `b909e4c` exists (verified via `git rev-parse --short HEAD` after Task 1 commit)
- [x] Commit `b91fb8d` exists (verified via Task 2 commit output `[main b91fb8d]`)
- [x] `grep -c "npm ci || npm install"` in both workflow files returns 0 (verified)
- [x] `grep -c "SEC-13-03"` in workflows directory returns 2 lines (one per file, verified)
- [x] `grep -c "SEC-13-04"` in publish.yml returns 3 (verified)
- [x] Step ordering Tests (unit) [55] < Tests (integration) [59] < Audit [63] < Publish [77] (verified by line numbers)
- [x] `node test/run.mjs test/unit` exit 0, 120/120 pass (verified)
- [x] `node test/run.mjs test/integration` exit 0, 67/67 pass (verified)
- [x] YAML structural sanity (no tabs, has jobs+steps) — both files pass (verified)

---
*Phase: 79-critical-security-fixes*
*Plan: 03 (CI + Publish Workflow Hardening)*
*Concluída: 2026-05-09*
