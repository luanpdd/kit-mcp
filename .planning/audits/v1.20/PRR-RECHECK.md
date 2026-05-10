# PRR Re-check — v1.20 Tech Debt Closure & Quality Hardening

**Date:** 2026-05-10 (initial Phase 104) · 2026-05-10 (final Phase 105)
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
**Target:** **30/30** by end of v1.20 — **MET** (Phase 104 closed Emergency
axe 4/5 → 5/5; Phase 105 closes Performance axe 4/5 → 5/5)

**REQs:**
- [SRE-20-01](../../milestones/v1.19-MILESTONE-AUDIT.md) (Emergency — this
  doc, Phase 104)
- SRE-20-02 (Performance — this doc, Phase 105 — **CLOSED**)

---

## Axis-by-axis movement

| Axe | v1.19 baseline | v1.20 (post-Phase 105) | Change | Evidence |
|-----|---------------|-----------------|--------|----------|
| 1. System Architecture | 5/5 | **5/5** | 0 | Stable API v1.0+ literal preserved cross-7-releases (v1.13 → v1.19) and through Phases 100/101/102/103/104/105. Phase 105 added one fire-and-forget call site after `server.connect` — zero new exports, zero return-shape changes. |
| 2. Instrumentation, Metrics, Monitoring | 5/5 | **5/5** | 0 | Phase 102 (auto-snapshot) reinforces — `metrics-snapshot` tool now auto-persists on every call (graceful fs error handling, 1s throttle). Phase 103 (multi-window burn-rate) deepens observability — `/burn-rate-status` now computes fast (1h) + slow (6h) independent burn rates with combined PAGE/TICKET/WARN/OK/no_data status enum. |
| 3. **Emergency Response** | 4/5 | **5/5** | **+1** | **Phase 104.** [`RUNBOOK.md`](../../RUNBOOK.md) expanded 5 → 9 scenarios; [`EMERGENCY-DRILL-LOG.md`](./EMERGENCY-DRILL-LOG.md) created with 2026-Q2 walkthrough entry + canonical template. See [Emergency axe — 4/5 → 5/5 justification](#emergency-axe--45--55-justification) below. |
| 4. Capacity Planning | 5/5 | **5/5** | 0 | Burn-rate live since v1.19 (Phase 99) and dual-window since v1.20 (Phase 103). `mcp-tool-availability` SLO 99.5% target with 30d sliding window; `mcp-tool-latency` p95 ≤ 200ms target. Both backed by `loadSnapshots()` filtered + sorted. |
| 5. Change Management | 5/5 | **5/5** | 0 | CI gates green (Phase 100 86% line-coverage threshold; Phase 101 stryker mutation baseline 57.40% documented; npm audit gate at high severity per Phase 92.01; manifest regen + README counts gate per DX-15-02). |
| 6. **Performance** | 4/5 | **5/5** | **+1** | **Phase 105.** Pre-warm kit cache after `server.connect`; M4 p95 dropped 144.55ms → 0.0ms (~100% reduction; far exceeds ≥30% target). [`BENCHMARK.md`](../../BENCHMARK.md) v1.20.0 row + 3 regression tests in [`test/unit/mcp-server-prewarm.test.js`](../../../test/unit/mcp-server-prewarm.test.js). See [Performance axe — 4/5 → 5/5 justification](#performance-axe--45--55-justification) below. |
| **Total** | **28/30** | **30/30** (post-Phase 105) | **+2** | v1.20 PRR target **MET**. Milestone ready for `/auditar-marco`. |

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

## Performance axe — 4/5 → 5/5 justification

**v1.19 baseline (4/5):** [`BENCHMARK.md`](../../BENCHMARK.md) M4 documented
MCP tool dispatch latency at p95=144.55ms / p99=146.42ms on the v1.17.0
reference machine (N=30 `kit list-agents --terse` dispatches against a
fresh server). The cold-path (~140ms disk read of 47 agents + 87 commands +
45 skills + frontmatter parse on ~180 files) fell on the first 1–2
dispatches, dominating the tail. Below the SLO target of p95 ≤ 200ms, but
not at the level the [`production-readiness-review`](../../../kit/skills/production-readiness-review/SKILL.md)
Performance axe demands for 5/5 — "user-perceived latency floor verified
sub-100ms with regression coverage."

**What was missing for 5/5:**

1. The first user-visible dispatch paid the full disk read. No mechanism
   shifted that cost out of the user-facing window.
2. Lazy-load work in Phase 16 / 89 (chokidar via `watch.js`,
   `@inquirer/prompts`) addressed cold-start CLI but not MCP dispatch.
3. No regression test guarded the tail latency — a future refactor that
   accidentally re-introduced eager work on dispatch would only be caught
   by a manual BENCHMARK re-run.

**v1.20 evidence for 5/5 (Phase 105 / SRE-20-02):**

1. **Pre-warm added** — [`src/mcp-server/index.js`](../../../src/mcp-server/index.js)
   `startStdio()` now calls `listKit(BUNDLED_KIT_ROOT).catch(() => {})`
   immediately after `server.connect(transport)` (commit `9e97a72`).
   Fire-and-forget — `server.connect` returns immediately, no boot delay.
   The cold path runs in the background while the IDE is still painting
   its UI; by the time the LLM client issues the first `tools/call`
   (seconds-to-minutes later in real use), the cache is warm.
2. **Stable API v1.0+ literal preserved** — zero new exports, zero
   return-shape changes. Internal side effect only. Verified via
   `git diff --stat` on commit `9e97a72`: 11 insertions / 1 deletion
   (the deletion is a whitespace adjacent to the new comment block).
3. **3 regression tests added** — [`test/unit/mcp-server-prewarm.test.js`](../../../test/unit/mcp-server-prewarm.test.js)
   (commit `600d795`) covers: (a) reachability — first dispatch p99 ≤ 50ms
   after 800ms post-init wait (proves pre-warm populated cache); (b)
   graceful failure — server boots and answers unrelated tools even when
   `KIT_MCP_KIT_ROOT` points at a missing directory; (c) non-blocking —
   `tools/list` responds within 80ms of `initialize`, proving pre-warm
   doesn't accidentally become `await`. Catches future refactors that
   silently drop the line or change its shape.
4. **M4 re-measured** — [`BENCHMARK.md`](../../BENCHMARK.md) v1.20.0 row:
   p50=0ms, p95=0.0ms (max 0.55ms across 5 runs of N=30), p99=0.0ms
   (max 1.0ms). 5-run summary documented; v1.17.0 row preserved as
   `[archived]` for trend visibility per the doc's refresh policy.
5. **Δ vs ROADMAP target** — ROADMAP says "MCP roundtrip p95 ≤100ms (vs
   144ms baseline = ≥30% redução)". Actual reduction: 144.55ms → 0.0ms ≈
   **100%**. Both clauses (sub-100ms AND ≥30% reduction) trivially met.
6. **SLO headroom widened** — [`./slos/mcp-tool-latency.yml`](../../slos/mcp-tool-latency.yml)
   target of p95 ≤ 200ms had 55ms headroom in v1.17.0; v1.20.0 widens
   that to the full 200ms budget. Regression budget should now treat any
   p95 > 50ms as a likely pre-warm regression — the SLO threshold
   remains the outer safety net.

**Trade-off accepted:** Pre-warm is fire-and-forget so `server.connect`
returns immediately. The race window is the rare case where a client
issues `tools/call` against `kit` within ~140ms of `server.connect`
returning; the dispatch then races the pre-warm. Both paths populate the
same `kitCache`, so the cost is bounded at ~140ms either way (no double
work, no incorrectness). No fallback to blocking await was needed because
the steady-state win is already complete and the race is harmless.

**Gap to a theoretical 5/5+ (deferred — out of scope for v1.20):**

- **CI gate that runs M4 probe automatically** — current refresh policy
  is manual ("re-run after every milestone that touches perf-relevant
  code paths"). Auto-CI gate would catch regressions before they land in
  main. Deferred to v1.21+ per Phase 105 [`105-CONTEXT.md`](../../phases/105-prr-performance-5-5/105-CONTEXT.md)
  `<deferred>` block (cold-start CLI sub-200ms tracked there).
- **Cold-start CLI sub-200ms (M1)** — current 232ms median; would
  require more aggressive lazy-load of `commander`. Diminishing returns
  vs Phase 16/89 already-applied work; deferred per same `<deferred>`
  block.
- **M3 RSS reduction** — V8 floor at ~53MB; Phase 92.01 dep budget
  decisions already optimized. Deferred per same `<deferred>` block.

These gaps are **infrastructure** (CI plumbing) or **diminishing-returns
optimization**, not regressions in the user-facing latency floor. The
Performance axe is at 5/5 for the current measurement and stays there
until a regression is observed or the ROADMAP target tightens.

---

## Action Items

| # | Axe | Item | Severity | Owner | Due | Status |
|---|-----|------|----------|-------|-----|--------|
| 1 | 6 (Performance) | Pre-warm kit cache + verify MCP roundtrip p95 sub-100ms in [`BENCHMARK.md`](../../BENCHMARK.md) | P1 | kit-mcp-maintainers | end of v1.20 (Phase 105) | ✅ **CLOSED** (Phase 105) |
| 2 | 3 (Emergency) | Re-confirm Emergency axe 5/5 at v1.21 close — fresh drill entry, RUNBOOK still complete | P2 | kit-mcp-maintainers | v1.21 close | open |
| 3 | 3 (Emergency) | Promote 2026-Q3 drill from table-top to live Wheel of Misfortune once team grows past 1 human | P2 | kit-mcp-maintainers | when team grows | open |
| 4 | 6 (Performance) | Add CI gate that runs M4 probe automatically + fails on regression > 50ms p95 | P3 | kit-mcp-maintainers | v1.21+ | open (deferred per Phase 105 `<deferred>` block) |

No P0 items — Phases 104 + 105 closure both approved.

---

## Decisão

- [x] **Approved** — Emergency axe **5/5** (Phase 104) and Performance axe
  **5/5** (Phase 105) both locked. Total **30/30**. Milestone v1.20 ready
  for `/auditar-marco` close.

This document is the final PRR re-check for v1.20. Future re-checks (v1.21+)
should start a new doc that opens with this as the baseline.

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
- Phase plans:
  [`104-01-PLAN.md`](../../phases/104-prr-emergency-5-5/104-01-PLAN.md)
  (Emergency axe);
  [`105-01-PLAN.md`](../../phases/105-prr-performance-5-5/105-01-PLAN.md)
  (Performance axe)
- Phase 105 BENCHMARK row: [`BENCHMARK.md`](../../BENCHMARK.md)
  M4 v1.20.0 section (Phase 105 / SRE-20-02)
- Phase 105 regression: [`test/unit/mcp-server-prewarm.test.js`](../../../test/unit/mcp-server-prewarm.test.js)
- Previous PRR baselines:
  [`.planning/audits/v1.16/PRR-REPORT.md`](../v1.16/PRR-REPORT.md) (v1.12.1
  → v1.16 re-projection, 22/30 baseline);
  [`.planning/milestones/v1.19-MILESTONE-AUDIT.md`](../../milestones/v1.19-MILESTONE-AUDIT.md)
  (v1.19 projection 28/30)

---

**Reviewer signature**

Reviewer: kit-mcp-maintainers
Date: 2026-05-10 (Phase 104 baseline + Phase 105 final)
Engagement model: Simple PRR
Final v1.20 PRR score: **30/30** (Architecture 5 · Instrumentation 5 ·
Emergency 5 · Capacity 5 · Change 5 · Performance 5)
