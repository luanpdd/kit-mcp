# Fase 104: PRR Emergency 4/5 → 5/5 - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Elevar PRR Emergency axe de 4/5 → 5/5 via expansão do `.planning/RUNBOOK.md` com 3+ scenarios novos derivados de v1.20 mudanças (coverage gate, stryker, auto-snapshot, multi-IDE sidecar) + drill log template (`.planning/audits/v1.20/EMERGENCY-DRILL-LOG.md`) com 1 entry inicial. PRR re-projection registra delta inline.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude

**Scenarios atuais (5):** MCP boot, sidecar hang, manifest mismatch, npm publish fail, sync corruption.

**Novos a adicionar (escolha 4 dos 6+ candidatos):**
1. **CI coverage gate regression** — ci.yml THRESHOLD=86 falha pós-merge; symptom: PR red com "line coverage X% < 86%"; fix: identificar arquivo regredido, restaurar testes ou rebase
2. **Auto-snapshot persist failure** (Phase 102) — disk full / permission denied / `.planning/metrics/snapshots/` não writable; symptom: stderr `[kit-mcp] auto-snapshot persist failed: ...`, mas handler ainda retorna payload
3. **Multi-IDE sidecar port collision** — usuário roda kit-mcp em 2 IDEs simultaneamente (Claude Code + Cursor), porta 7100 colide; symptom: sidecar #2 escala para 7101, mas hooks vão pra 7100; fix: KIT_MCP_UI_PORT_BASE override ou kill stale
4. **Critical CVE blocks publish** — npm audit gate falha com CVE em transitiva; symptom: GH Actions release red; fix: pin/upgrade dep, comprar tempo via `--audit-level high` se ataque é apenas DoS theoretical
5. **Stryker mutation run hangs** (Phase 101) — `npm run test:mutation` trava em arquivo grande; symptom: timeout; fix: reduzir scope via env STRYKER_MUTATE_TEST_FILES, kill processo, document no MUTATION-BASELINE
6. **SLO burn rate PAGE alert** (Phase 103) — `/burn-rate-status` retorna PAGE para mcp-tool-availability; symptom: fast_burn ≥14.4 + slow_burn ≥6 simultâneos; fix: invocar `/investigar-producao "<slo> burn rate"`, aplicar core-analysis-loop

**Decisão:** vou adicionar 4 scenarios (6, 7, 8, 9 numbered consecutively).

**EMERGENCY-DRILL-LOG.md template:**
```markdown
# Emergency Drill Log — kit-mcp v1.20+

> Trimestral game-day exercises. Template canônico — populate after each drill.

## Drill 2026-Q2 (initial — 2026-05-10)

**Drill type:** simulation (no live incident)
**Scenario tested:** RUNBOOK.md scenarios 1-9 walkthrough (table-top)
**Operator:** kit-mcp-maintainers (single-human)
**Duration:** ~30 min
**Outcome:** All scenarios have actionable Symptom→Diagnosis→Fix→Verification flow. SLO check section validated. Drill log template established.

**Action items derived:**
- (none — table-top exercise; live drills planned for v1.21+ Wheel of Misfortune)

---

## Drill <YYYY-Qn> — TEMPLATE

**Drill type:** [simulation | live | tabletop]
**Scenario tested:** [scenario number from RUNBOOK]
**Operator:** [name or "single-human"]
**Duration:** [actual time spent]
**Outcome:** [pass | fail | partial]

**Action items derived:**
- [...]
```

**PRR re-projection:** atualizar `.planning/audits/v1.20/PRR-RECHECK.md` (criar se não existir) com tabela mostrando Emergency 4/5 → 5/5 e justificativa.

</decisions>

<code_context>
## Insights do Código Existente

`.planning/RUNBOOK.md` tem 5 scenarios + SLO check + escalation paths + cross-references. Format consistente: Symptom/Diagnosis/Fix table/Verification. Phase 104 estende mantendo pattern.

`.planning/FAILURE-MODES.md` (existente, Phase 96 v1.18) — tabela top-down 12-row impact×likelihood. Não conflita com RUNBOOK additions; cross-ref atualizada.

`.planning/audits/v1.20/` já tem MUTATION-BASELINE.md + STRYKER-RUN-LOG.txt. EMERGENCY-DRILL-LOG.md vai junto.

</code_context>

<specifics>
## Ideias Específicas

REQ SRE-20-01. Critérios de sucesso explícitos no ROADMAP.md:
- RUNBOOK.md ≥ 3 novos scenarios (target: 4) com Symptom→Diagnosis→Fix→Verification consistente
- EMERGENCY-DRILL-LOG.md criado com 1 entry inicial + template
- PRR re-projection registra Emergency 4/5 → 5/5
- Schema regression tests do RUNBOOK (v1.18) continuam green
- Drill template estabelece padrão para futuros trimestrais

</specifics>

<deferred>
## Ideias Adiadas

- Wheel of Misfortune live drill (cap 15 SRE) — v1.21+ requer 2+ humans
- Auto-trigger drill via cron (mensal) — overkill v1.20
- Postmortem template populated com drill outcomes — opt-in v1.21+

</deferred>
