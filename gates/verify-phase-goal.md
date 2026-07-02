---
id: verify-phase-goal
stage: post-verify
blocking: true
description: Reverse-verify the phase goal against the codebase, not just task completion.
---

# Verify phase goal gate

**When to run:** after all plans in a phase have committed their SUMMARY.md.

## Check

Spawn the `verifier` agent with:
- phase goal (from `ROADMAP.md`)
- phase requirement IDs (from PLAN frontmatters)
- phase dir path

The verifier checks `must_haves` against the actual codebase and cross-references
every requirement ID against `REQUIREMENTS.md`. It writes `*-VERIFICATION.md`.

## Verdict

- **passed** — every must-have verified → proceed to `update_roadmap`
- **human_needed** — automated checks pass but some items need human eyes →
  persist as `*-HUMAN-UAT.md` and ask the user to test or approve
- **gaps_found** — at least one must-have unverified → propose
  `/planejar-fase {X} --gaps` and stop the auto-chain

## Notes

This gate is opinionated: phase completeness is measured against the **goal**,
not the task list. A phase whose every task is checked but whose goal is half-built
must not be marked complete.
