---
id: dependency-check
stage: pre-execute
blocking: true
description: Verify that key-link references between plans of prior waves resolve before launching the next wave.
---

# Dependency check gate

**When to run:** before launching wave N+1 in `execute-phase`, for each plan in wave N+1
that declares `key_links` referencing artifacts of wave N.

## Check

```bash
node "./.claude/framework/bin/tools.cjs" verify key-links {phase_dir}/{plan}-PLAN.md
```

For each link:

- if pattern resolves to an existing file → ok
- if not found → fail with `{plan, via, from, pattern}`

## Verdict

- **passed** — proceed to wave N+1
- **block**  — present cross-plan connection gap table; ask `investigate | continue (risky) | abort`

## Notes

Key-links are the explicit contract between waves. A missing key-link means wave N
shipped something with a different shape than wave N+1 expected. Catching this
*before* spawning N+1 executors saves a full wave of failed work.
