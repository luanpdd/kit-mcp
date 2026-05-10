# PRR Re-check — v1.20 Tech Debt Closure & Quality Hardening

**Date:** 2026-05-10
**Reviewer:** kit-mcp-maintainers (auto-PRR — flagged as anti-pattern per
[`production-readiness-review`](../../../kit/skills/production-readiness-review/SKILL.md);
external reviewer assignment deferred until contributor base grows past one
human; Phase 104 [`104-CONTEXT.md`](../../phases/104-prr-emergency-5-5/104-CONTEXT.md)
deferred block tracks the gap)
**Engagement model:** Simple PRR (dev-tool, single-user dev workstation;
outage cost ≈ $0/min direct revenue; consistent with v1.16 and v1.19
re-projections)
**Baseline:** v1.19 PRR projection — **28/30** (per
[`v1.19-MILESTONE-AUDIT.md`](../../milestones/v1.19-MILESTONE-AUDIT.md)
PRR Re-projection table; jumped from v1.18 27/30 via Capacity axe +1 from
burn-rate live wiring)
**Target:** **30/30** by end of v1.20 (Phase 104 closes Emergency axe;
Phase 105 closes Performance axe)

**REQs:**
- [SRE-20-01](../../milestones/v1.19-MILESTONE-AUDIT.md) (Emergency — this
  doc)
- SRE-20-02 (Performance — Phase 105 follow-up)

---

## Axis-by-axis movement

| Axe | v1.19 baseline | v1.20 (post-Phase 104) | Change | Evidence |
|-----|---------------|-----------------|--------|----------|
| 1. System Architecture | 5/5 | **5/5** | 0 | Stable API v1.0+ literal preserved cross-7-releases (v1.13 → v1.19) and through Phases 100/101/102/103/104. No new src/ surface added in v1.20. |
| 2. Instrumentation, Metrics, Monitoring | 5/5 | **5/5** | 0 | Phase 102 (auto-snapshot) reinforces — `metrics-snapshot` tool now auto-persists on every call (graceful fs error handling, 1s throttle). Phase 103 (multi-window burn-rate) deepens observability — `/burn-rate-status` now computes fast (1h) + slow (6h) independent burn rates with combined PAGE/TICKET/WARN/OK/no_data status enum. |
| 3. **Emergency Response** | 4/5 | **5/5** | **+1** | **This Phase (104).** [`RUNBOOK.md`](../../RUNBOOK.md) expanded 5 → 9 scenarios; [`EMERGENCY-DRILL-LOG.md`](./EMERGENCY-DRILL-LOG.md) created with 2026-Q2 walkthrough entry + canonical template. See [Emergency axe — 4/5 → 5/5 justification](#emergency-axe--45--55-justification) below. |
| 4. Capacity Planning | 5/5 | **5/5** | 0 | Burn-rate live since v1.19 (Phase 99) and dual-window since v1.20 (Phase 103). `mcp-tool-availability` SLO 99.5% target with 30d sliding window; `mcp-tool-latency` p95 ≤ 200ms target. Both backed by `loadSnapshots()` filtered + sorted. |
| 5. Change Management | 5/5 | **5/5** | 0 | CI gates green (Phase 100 86% line-coverage threshold; Phase 101 stryker mutation baseline 57.40% documented; npm audit gate at high severity per Phase 92.01; manifest regen + README counts gate per DX-15-02). |
| 6. **Performance** | 4/5 | TBD | (Phase 105) | Pending Phase 105 (lazy-load chokidar + MCP roundtrip p95 sub-100ms verification). Phase 104 does not move this axe. |
| **Total** | **28/30** | **29/30** (post-Phase 104) | **+1** | Phase 105 will lift Performance axe to 5/5 → final v1.20 PRR target **30/30**. |

---

## Emergency axe — 4/5 → 5/5 justification

**v1.19 baseline (4/5):** [`RUNBOOK.md`](../../RUNBOOK.md) existed (Phase 96,
v1.18) with 5 canonical scenarios (boot, sidecar hang, manifest mismatch,
publish fail, sync corruption). [`FAILURE-MODES.md`](../../FAILURE-MODES.md)
existed with 12 modes. SLO check section + escalation paths +
cross-references all present. **What was missing for 5/5:**

1. No drill log — the [`production-readiness-review`](../../../kit/skills/production-readiness-review/SKILL.md)
   skill axe 3 explicitly requires "Wheel of Misfortune realized in last
   90d" as evidence; v1.19 had none.
2. v1.20 introduced new operational surface (Phase 100 coverage threshold,
   Phase 102 auto-snapshot, Phase 103 multi-window burn-rate) — none of
   which were yet covered in scenarios.
3. Multi-IDE concurrency surface (real-world failure mode as Cursor + Claude
   Code coexistence becomes common) had no scenario.
4. Critical CVE blocking publish workflow — implicit in the
   [`hermetic-builds`](../../../kit/skills/hermetic-builds/SKILL.md)
   discipline but not surfaced as an actionable RUNBOOK entry.

**v1.20 evidence for 5/5:**

1. **[`RUNBOOK.md`](../../RUNBOOK.md) expanded 5 → 9 scenarios** —
   commit `cf3bddb`. New scenarios cover (6) CI coverage gate regression
   tied to Phase 100 ratchet, (7) auto-snapshot persist failure tied to
   Phase 102 stderr message + graceful contract, (8) multi-IDE sidecar
   port collision tied to Phases 13/14 sidecar architecture + Phase 21
   hook publisher, (9) critical CVE blocks publish tied to Phase 92.01
   audit gate + Phase 89 manifest regen.
2. **[`EMERGENCY-DRILL-LOG.md`](./EMERGENCY-DRILL-LOG.md) created** —
   commit `1c11fd4`. Establishes trimestral cadence with canonical
   template + first walkthrough entry (2026-Q2) covering all 9 scenarios
   with PASS verdict.
3. **Each new scenario follows the canonical
   Symptom → Diagnosis → Fix table → Verification format** — verified by
   `grep` count of 36 (= 9 scenarios × 4 subsections) on the
   post-commit RUNBOOK. Fix tables average 5 modes per scenario
   (range 4-6).
4. **Cross-references active across the 3 docs + 4 skills** —
   [`RUNBOOK.md`](../../RUNBOOK.md) references
   [`production-readiness-review`](../../../kit/skills/production-readiness-review/SKILL.md),
   [`blameless-postmortems`](../../../kit/skills/blameless-postmortems/SKILL.md),
   [`core-analysis-loop`](../../../kit/skills/core-analysis-loop/SKILL.md),
   and [`hermetic-builds`](../../../kit/skills/hermetic-builds/SKILL.md);
   the drill log references RUNBOOK + this PRR-RECHECK + 3 of those skills;
   this PRR-RECHECK references the drill log + RUNBOOK + the same skills.
   No broken links — verified during the 2026-Q2 walkthrough.
5. **Quick triage table covers all 9 scenarios** — 10 data rows total
   (5 original + 4 new + 1 SLO-degradation row). The operator can scan
   symptom → scenario in under 30s without scrolling.
6. **All 9 scenarios are actionable** — verified end-to-end during the
   2026-Q2 table-top walkthrough (see
   [`EMERGENCY-DRILL-LOG.md`](./EMERGENCY-DRILL-LOG.md) Outcome table).

**Gap to a theoretical 5/5+ (deferred per Phase 104 `<deferred>` block):**

- **Live Wheel of Misfortune drill** vs table-top — requires 2+ humans for
  the canonical role-play format described in
  [`blameless-postmortems`](../../../kit/skills/blameless-postmortems/SKILL.md).
  Single-human kit-mcp maintainership today; deferred to v1.21+ when
  contributor base grows.
- **Auto-trigger drill via cron (monthly)** — overkill for v1.20 given the
  single-human cadence; marked deferred per Phase 104
  [`104-CONTEXT.md`](../../phases/104-prr-emergency-5-5/104-CONTEXT.md)
  `<deferred>` block.
- **Postmortem template populated with drill outcomes** — opt-in for v1.21+
  per the same deferred block.

These gaps are explicitly **structural** (require multiple humans or future
tooling), not **content** gaps. The Emergency axe is at 5/5 for the current
single-maintainer engagement model and stays there until headcount or
operational shape shifts.

---

## Action Items

| # | Axe | Item | Severity | Owner | Due |
|---|-----|------|----------|-------|-----|
| 1 | 6 (Performance) | Lazy-load chokidar + verify MCP roundtrip p95 sub-100ms in [`BENCHMARK.md`](../../BENCHMARK.md) | P1 | kit-mcp-maintainers | end of v1.20 (Phase 105) |
| 2 | 3 (Emergency) | Re-confirm Emergency axe 5/5 at v1.21 close — fresh drill entry, RUNBOOK still complete | P2 | kit-mcp-maintainers | v1.21 close |
| 3 | 3 (Emergency) | Promote 2026-Q3 drill from table-top to live Wheel of Misfortune once team grows past 1 human | P2 | kit-mcp-maintainers | when team grows |

No P0 items — Phase 104 closure is approved for the Emergency axe.

---

## Decisão

- [x] **Approved with conditions** — Emergency axe **5/5** locked; Performance axe TBD (Phase 105 P1 tracked above)

Once Phase 105 lifts Performance to 5/5, this document gains a final row
("v1.20 close — 30/30") and v1.20 ships.

---

## Cross-references

- Live RUNBOOK: [`.planning/RUNBOOK.md`](../../RUNBOOK.md) (9 scenarios
  post-Phase 104)
- Drill log: [`EMERGENCY-DRILL-LOG.md`](./EMERGENCY-DRILL-LOG.md) (2026-Q2
  initial entry)
- Failure mode catalogue: [`.planning/FAILURE-MODES.md`](../../FAILURE-MODES.md)
- Mutation baseline: [`MUTATION-BASELINE.md`](./MUTATION-BASELINE.md)
  (Phase 101 — 57.40% overall, 10 of 15 src/core files)
- Skill: [`production-readiness-review`](../../../kit/skills/production-readiness-review/SKILL.md)
  — 6-axis canonical scorecard
- Skill: [`blameless-postmortems`](../../../kit/skills/blameless-postmortems/SKILL.md)
  — Wheel of Misfortune + 9-section postmortem template
- Skill: [`core-analysis-loop`](../../../kit/skills/core-analysis-loop/SKILL.md)
  — scientific method during active incidents
- Skill: [`hermetic-builds`](../../../kit/skills/hermetic-builds/SKILL.md)
  — audit gate rationale (Scenario 9 in RUNBOOK)
- Phase plan: [`104-01-PLAN.md`](../../phases/104-prr-emergency-5-5/104-01-PLAN.md)
- Previous PRR baselines:
  [`.planning/audits/v1.16/PRR-REPORT.md`](../v1.16/PRR-REPORT.md) (v1.12.1
  → v1.16 re-projection, 22/30 baseline);
  [`.planning/milestones/v1.19-MILESTONE-AUDIT.md`](../../milestones/v1.19-MILESTONE-AUDIT.md)
  (v1.19 projection 28/30)

---

**Reviewer signature**

Reviewer: kit-mcp-maintainers
Date: 2026-05-10
Engagement model: Simple PRR
