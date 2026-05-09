---
phase: 80-hooks-race-pattern-token-economy-quick-wins
plan: 04
subsystem: packaging
tags: [token-economy, npm-tarball, perf-13-03, package-json, files, distribution]

requires:
  - phase: 79-critical-security-fixes
    provides: clean baseline (4 vulns closed, 120 unit + 67 integration green)
provides:
  - npm tarball ~79KB lighter on every install (CHANGELOG.md no longer published)
  - integration test asserting tarball shape via npm pack --dry-run --json
  - anti-regression contract: any future re-add of CHANGELOG.md to files[] fails CI
affects: [npm-publish, package.json, tarball-shape, integration-suite]

tech-stack:
  added: []
  patterns:
    - "machine-readable tarball assertions via `npm pack --dry-run --json` (not text grep)"
    - "cross-platform spawn for native binaries — explicit shell:true with hardcoded command STRING on Windows (npm.cmd shim) avoids DEP0190 while POSIX uses non-shell array form"

key-files:
  created:
    - test/integration/npm-pack-shape.test.js
  modified:
    - package.json

key-decisions:
  - "Use npm pack --dry-run --json (machine-readable) over grep on text output — survives npm CLI cosmetic changes"
  - "4 test cases (not 1) — defense in depth: tarball-level + source-of-truth + presence/absence assertions independently"
  - "Keep CHANGELOG.md in repo (only drop from tarball) — git/GitHub releases stay as historical record for consumers who need it"
  - "Cross-platform spawn: hardcoded command string on Windows is safe (no user data interpolated) and avoids DEP0190 deprecation"

patterns-established:
  - "Tarball shape contracts: when files[] in package.json is meaningful, encode the contract as an integration test that runs the real packager — not just a JSON shape assertion"
  - "Banned-file regression tests: explicit allow/deny assertions over the published artifact catch accidental re-additions during future refactors"

requirements-completed: [PERF-13-03]

metrics:
  duration: ~3 minutes (parallel wave with plans 80.01/02/03)
  tasks: 2
  commits: 2
  completed: 2026-05-09
---

# Phase 80 Plan 04: drop-changelog-from-tarball Summary

PERF-13-03 quick win: removed CHANGELOG.md from `package.json` files[] so it stops being shipped in every `npm install` of `@luanpdd/kit-mcp` (saving ~79KB unpacked × every install) and added a 4-case integration test invoking `npm pack --dry-run --json` to anti-regress any future re-add.

## What Changed

### package.json files[]

Single-line removal:

```diff
   "files": [
     "bin/",
     "src/",
     "kit/",
     "gates/",
     "README.md",
-    "CHANGELOG.md",
     "LICENSE"
   ],
```

Array shrunk from 7 to 6 entries. Version was NOT bumped — that is the release workflow's responsibility, not this plan's.

### test/integration/npm-pack-shape.test.js (new, 103 lines)

Four `node:test` cases, each invoking real `npm pack --dry-run --json` (PERF-13-03 anti-regression):

1. **Tarball does NOT include CHANGELOG.md** — primary assertion, fails immediately if anyone re-adds the entry.
2. **Tarball still includes core surfaces (bin/, src/, kit/, gates/)** — defense against accidental over-trimming of files[].
3. **Tarball includes README.md, LICENSE, package.json** — top-level files preserved.
4. **package.json files[] does not contain CHANGELOG entry** — source-of-truth defense; even if `npm pack` semantics change one day, the static config must be clean.

## Tarball Size Reduction

Captured directly from `npm pack --dry-run --json` before vs after:

| Metric         | Before        | After         | Δ                |
| -------------- | ------------- | ------------- | ---------------- |
| Total files    | 380           | 379           | −1               |
| Packed size    | 1,127,033 B   | 1,097,421 B   | −29,612 B (~30KB compressed) |
| Unpacked size  | 3,582,649 B   | 3,503,701 B   | −78,948 B (~79KB) |
| CHANGELOG entries in tarball | 1 (79,443 B) | 0 | full removal |

The unpacked delta (−79KB) matches the audit estimate exactly, since CHANGELOG.md is the only file removed and it was 79,443 bytes.

## Test Output

```
✔ PERF-13-03: tarball does NOT include CHANGELOG.md (3199.18ms)
✔ PERF-13-03: tarball still includes core surfaces (bin/, src/, kit/, gates/) (3699.17ms)
✔ PERF-13-03: tarball includes README.md, LICENSE, package.json (3454.91ms)
✔ PERF-13-03: package.json files[] does not contain CHANGELOG entry (7.56ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

The first 3 cases each take ~3-4 seconds because they spawn a real `npm pack` (npm walks the filesystem and produces JSON metadata). Acceptable cost for an integration test that invokes a real binary; this is exactly why these tests live in `test/integration/`, not `test/unit/`. The 4th case (static JSON parse) is < 10ms.

## Suite Status

| Suite              | Before plan | After plan |
| ------------------ | ----------- | ---------- |
| Unit (test/unit)   | 120/120     | 133/133    |
| Integration (test/integration) | 67/67 | 71/71     |
| **Total**          | **187**     | **204**    |

Note: the unit count grew beyond just my +4 because parallel plans 80.01/02/03 also added unit tests during the same wave. This plan added all 4 to the integration suite.

## Decisions Made

### Why machine-readable JSON over text grep

Original instinct was `npm pack --dry-run 2>&1 | grep CHANGELOG`. Rejected: `npm pack` text output format is not stable across npm versions (it has cosmetic line-prefix changes, color escapes when stdout is a TTY, etc.). `--json` produces a stable schema with `{ files: [{ path, size, mode }, ...] }` that has been stable since npm 7+ (we are on npm 10+ everywhere). Asserting on the structured field is robust to npm CLI rewrites.

### Why 4 cases, not 1

A single "tarball does not include CHANGELOG" test would be enough to fail the regression. But defense in depth is cheap here:

- Test 2 (required prefixes) catches the inverse mistake — if someone accidentally deletes `bin/` or `src/` from files[] thinking they are reorganizing, the test fails loud.
- Test 3 (top-level required files) catches a different inverse — README/LICENSE accidentally dropped.
- Test 4 (source-of-truth) is independent of `npm pack` behavior; even if npm one day decides to strip CHANGELOG by default, the static config still has to be clean.

The cost is 3 extra test cases sharing a helper function. The benefit is that someone reading the test file in 6 months understands the FULL contract of files[], not just one line of it.

### Why CHANGELOG.md stays in repo

Only the tarball loses it. The repo file is unchanged. GitHub releases ship full changelog text in their notes, and the file is on `main` for `git log`, blame, and direct viewing on github.com. Consumers who specifically want the 79KB historical record can read it where it lives — they do not need it copied into every `node_modules/@luanpdd/kit-mcp/` directory worldwide.

### Why DEP0190 mitigation (cross-platform spawn)

First version used `shell: process.platform === 'win32'` with array args. Worked, but Node 22+ emits DEP0190 (security smell: shell + args is the classic command-injection surface). Tried `npm.cmd` direct invocation — fails with ENOENT on Windows because the .cmd shim needs a shell context. Final approach: use a hardcoded command STRING on Windows with `shell: true` (no user input ever interpolated, so injection is genuinely impossible), and the safe array form on POSIX where `npm` is a real binary.

The pattern is: when you need shell:true, you must make the command literal. Mixing shell:true with array args is the documented red flag.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Mitigated DEP0190 deprecation in test runner**

- **Found during:** Task 2, after first run of the test
- **Issue:** Initial implementation used `shell: process.platform === 'win32'` with array args (matching the literal plan instructions). Node 22.20+ emits `DEP0190` deprecation warning: passing args with `shell: true` "can lead to security vulnerabilities, as the arguments are not escaped, only concatenated."
- **Why critical:** Tests should not emit deprecation warnings on normal runs. CI logs treat deprecations as actionable signal; if our own test suite generates them, we drown the signal.
- **Fix:** Branch on platform — Windows uses single-string command (no args array, no injection surface since the command is hardcoded), POSIX uses the safe array form without shell.
- **Files modified:** test/integration/npm-pack-shape.test.js (the file under construction; no separate commit)
- **Verification:** Test passes 4/4 with no DEP0190 warning emitted.

## Deferred Issues

### Pre-existing intermittent flake in test/unit/hooks-flush-race.test.js

During one run of `npm run test:all` an assertion in `hooks-flush-race.test.js:88` reported `actual: 1, expected: 0`. Subsequent runs passed cleanly. This is a race-condition test ABOUT race conditions (it spawns a process and asserts timing), so intermittent failures under load are expected before plan 80.01 finishes.

- **Out of scope** for this plan (we did not touch hooks).
- **In scope** for plan 80.01 (`hooks-flush-before-exit-PLAN.md`), which is running in the same wave as us. Plan 80.01 is exactly addressing the flush-race pattern, so the flake will resolve when 80.01 finishes — or surface as a real bug there to fix.
- No action needed from this plan.

## Self-Check: PASSED

Files verified:

- FOUND: package.json (modified — files[] entry removed)
- FOUND: test/integration/npm-pack-shape.test.js (created)

Commits verified (in `git log`):

- FOUND: 6dc1af1 — fix(80-04): drop CHANGELOG.md from npm tarball files[]
- FOUND: d240aeb — test(80-04): add npm-pack-shape integration test for PERF-13-03

Verification block from PLAN.md run end-to-end:

1. `package.json` files[] does not include CHANGELOG.md — VERIFIED (Node check exits 0).
2. `npm pack --dry-run --json` reports 0 CHANGELOG entries — VERIFIED.
3. `node --test test/integration/npm-pack-shape.test.js` exits 0 with 4/4 cases — VERIFIED.
4. `npm run test:all` exits 0 with 204 tests passing — VERIFIED (steady-state run).
5. CHANGELOG.md still exists in repo — VERIFIED.

All success criteria met.
