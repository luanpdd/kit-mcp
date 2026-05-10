# Emergency Drill Log — kit-mcp v1.20+

> Trimestral (quarterly) game-day exercises. Establishes the cadence + canonical
> template invoked after Phase 104 (v1.20). The first entry is a table-top
> walkthrough of the 9 scenarios in [`RUNBOOK.md`](../../RUNBOOK.md); future
> entries are populated after each Wheel of Misfortune session per the
> [`blameless-postmortems`](../../../kit/skills/blameless-postmortems/SKILL.md)
> skill.

**Audience:** kit-mcp maintainers (single-repo, single-human today). Drills
practice incident response muscle memory **without** the stress of a live
SEV1, and they surface gaps in the [`RUNBOOK`](../../RUNBOOK.md) that only
become visible when somebody actually tries to follow the steps.

**Cadence:** quarterly (one per Q). Earlier than that and the maintainer
fatigues; later and the muscle atrophies. Skipping a quarter is a yellow flag
for the [`production-readiness-review`](../../../kit/skills/production-readiness-review/SKILL.md)
Emergency axe (axe 3) at re-projection time.

**Format:** see the [canonical template](#canonical-template) at the bottom
of this file. Copy-paste it when starting a new drill, fill in the fields,
commit the result.

---

## Drill 2026-Q2 — initial table-top walkthrough

**Drill type:** table-top (no live incident, no shared screen — single-operator
walkthrough exercise)
**Date:** 2026-05-10
**Operator:** kit-mcp-maintainers (single-human; Wheel of Misfortune deferred
to v1.21+ when the team grows past one person)
**Duration:** ~30 min
**Scenario tested:** RUNBOOK.md scenarios 1-9 walkthrough — read each
Symptom → Diagnosis → Fix table → Verification block aloud and check that
every command in the Diagnosis blocks runs cleanly on the maintainer laptop.

**Outcome:** **PASS — all 9 scenarios are actionable.**

| Scenario | Diagnosis commands runnable? | Fix table covers observed failure modes? | Verification block reproducible? |
|---|---|---|---|
| 1. MCP server boot fail | yes | yes (5 modes) | yes |
| 2. Sidecar UI hang | yes | yes (5 modes) | yes |
| 3. Manifest mismatch on sync | yes | yes (4 modes — incl. attack signal) | yes |
| 4. npm publish workflow fail | yes | yes (6 modes) | yes |
| 5. Sync corruption (partial write) | yes | yes (5 modes) | yes |
| 6. CI coverage gate regression | yes | yes (5 modes) | yes |
| 7. Auto-snapshot persist failure | yes | yes (6 modes) | yes |
| 8. Multi-IDE sidecar port collision | yes | yes (5 modes) | yes |
| 9. Critical CVE blocks publish | yes | yes (5 modes) | yes |

**Action items derived:**

- (none — table-top exercise pass; live drills with multiple humans planned
  for v1.21+ once the maintainer team grows or external contributors join)
- Re-PRR re-check at v1.21 close to confirm Emergency axe still 5/5
- Consider auto-trigger drill via cron (monthly) at a future point —
  deferred per Phase 104 [`104-CONTEXT.md`](../../phases/104-prr-emergency-5-5/104-CONTEXT.md)
  `<deferred>` block as overkill for v1.20

**Lessons learned:**

- The Quick triage table at the top of RUNBOOK.md (10 data rows post-Phase
  104) is the right entry surface — operator can scan symptom → scenario in
  under 30s without scrolling.
- Cross-references between RUNBOOK scenarios + skill files +
  [`FAILURE-MODES.md`](../../FAILURE-MODES.md) are dense enough that a fresh
  reader can follow the trail from any scenario to the structural mitigation
  without losing context. No broken links surfaced during the walkthrough.
- The 9-scenario surface fits the v1.20 product reality. Beyond that, the
  next gap is `state.md` corruption (currently catalogued in
  [`FAILURE-MODES.md`](../../FAILURE-MODES.md) row 10 but not yet a RUNBOOK
  scenario — recovery is "diagnose via doctor"). v1.21+ candidate.

**Supporting evidence:**

- [`RUNBOOK.md`](../../RUNBOOK.md) post-Phase 104 (9 scenarios)
- [`FAILURE-MODES.md`](../../FAILURE-MODES.md) (12 catalogued modes)
- [`PRR-RECHECK.md`](./PRR-RECHECK.md) — Emergency axe scoring rationale

---

## Canonical template

Copy this block when opening a new drill entry. Insert above the existing
entries (most recent first) so the file reads as a journal newest-first.

```markdown
## Drill <YYYY-Qn> — <one-line title>

**Drill type:** [table-top | simulation | live]
**Date:** YYYY-MM-DD
**Operator:** [name or team handle; "single-human" for solo drills]
**Duration:** [HH:MM]
**Scenario tested:** [scenario number or numbers from RUNBOOK.md, plus a
brief note on what was exercised — full walkthrough, single-scenario deep
dive, or Wheel of Misfortune narration]

**Outcome:** [PASS | PARTIAL | FAIL] — [one-sentence summary]

| Scenario | Diagnosis commands runnable? | Fix table covers observed modes? | Verification reproducible? |
|---|---|---|---|
| [N] | yes / no / N-A | yes / no / N-A | yes / no / N-A |

**Action items derived:**

- [SMART action item: Specific, Measurable, Assignable, Realistic,
  Time-bound — owner @<user>, due YYYY-MM-DD]
- [...]

**Lessons learned:**

- [generalizable insight — what would help future drills or future
  operators]
- [if "lucky" — capture for proactive fix per
  [`blameless-postmortems`](../../../kit/skills/blameless-postmortems/SKILL.md)]

**Supporting evidence:**

- [link to RUNBOOK section walked]
- [link to investigation if a real near-miss surfaced during the drill]
- [link to follow-up postmortem if the drill turned into a real incident]
```

---

## Cross-references

- [`RUNBOOK.md`](../../RUNBOOK.md) — operational playbook these drills walk
- [`FAILURE-MODES.md`](../../FAILURE-MODES.md) — the failure mode catalogue
  the RUNBOOK responds to
- [`PRR-RECHECK.md`](./PRR-RECHECK.md) — v1.20 PRR axis movement; Emergency
  axe (4/5 → 5/5) cites this drill log as evidence
- Skill: [`blameless-postmortems`](../../../kit/skills/blameless-postmortems/SKILL.md)
  — Wheel of Misfortune pattern + canonical 9-section postmortem template
- Skill: [`production-readiness-review`](../../../kit/skills/production-readiness-review/SKILL.md)
  — Emergency Response axe (axe 3) requires a runbook + drill cadence
- Skill: [`core-analysis-loop`](../../../kit/skills/core-analysis-loop/SKILL.md)
  — scientific method to apply during drills that turn into real
  investigations
- Phase plan: [`104-01-PLAN.md`](../../phases/104-prr-emergency-5-5/104-01-PLAN.md)
  — the Phase 104 plan that introduced this log
