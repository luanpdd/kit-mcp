---
id: regression
stage: pre-verify
blocking: true
description: Run prior-phase test suites to detect cross-phase regressions before verifying the current phase.
---

# Regression gate

**When to run:** before `verify_phase_goal` of any phase that is not the first.

## Inputs

- `PHASE_NUMBER` — current phase
- All `*-VERIFICATION.md` files of prior phases in the current milestone

## Check

1. Discover prior verification files: `find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*"`
2. Extract test file paths from each (paths under `test/`, `spec/`, `__tests__/`, or files matching `*.test.*` / `*.spec.*` referenced in `key-files.created`)
3. Detect runner from project root (`package.json` → jest/vitest, `Cargo.toml` → cargo, `pyproject.toml` → pytest)
4. Run only the prior-phase test files

## Verdict

- **passed** — every test green → proceed to verify
- **block**  — any failure → present diff and ask `fix | continue | abort`

## Notes

This is a **cross-phase** regression check. It is intentionally narrower than a full
test run — it answers "did this phase break what previous phases shipped?".
