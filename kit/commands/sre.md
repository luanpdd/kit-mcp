---
name: sre
description: Orquestrador da Suíte SRE (v1.10) — dispatch para agents (golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor) com sinônimos PT/EN.
argument-hint: "<subcomando> [args...]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Orquestrador único da Suíte SRE (v1.10) — terceiro orquestrador da família após [`/supabase`](./supabase.md) (v1.8) e [`/observabilidade`](./observabilidade.md) (v1.9). Recebe subcomando + args, faz dispatch via `Task(subagent_type=...)` para o agent SRE correto. **Único ponto de chain de agents SRE** (anti-pitfall A10 mantido — agents permanecem função pura).

**Subcomandos cobrem cap 3, 5, 6, 15, 32 do livro Google SRE:**
- `golden-signals` — 4 signals universais (cap 6)
- `auditar-toil`/`audit-toil` — eliminating toil (cap 5)
- `postmortem` — blameless postmortem (cap 15)
- `prr` — Production Readiness Review (cap 32)
- `risk-budget`/`budget` — risk continuum (cap 3)

**Cria/Atualiza:** o que cada agent invocado cria (patches OTel, TOIL-AUDIT.md, postmortem, PRR-REPORT.md, snapshot risk-budget).

**Após:** o usuário tem o output do agent (instrumentação aplicada, audit, postmortem revisável, PRR scored, ou snapshot de budget).
</objective>

<execution_context>
Skills consultadas pelos agents (Phase 36): [`kit/skills/sre-risk-management/SKILL.md`](../skills/sre-risk-management/SKILL.md), [`kit/skills/four-golden-signals/SKILL.md`](../skills/four-golden-signals/SKILL.md), [`kit/skills/eliminating-toil/SKILL.md`](../skills/eliminating-toil/SKILL.md), [`kit/skills/blameless-postmortems/SKILL.md`](../skills/blameless-postmortems/SKILL.md), [`kit/skills/production-readiness-review/SKILL.md`](../skills/production-readiness-review/SKILL.md) + glossário em [`kit/skills/_shared-sre/glossary.md`](../skills/_shared-sre/glossary.md).

Agents disponíveis (Phase 37):
- [`golden-signals-instrumenter`](../agents/golden-signals-instrumenter.md) — AGCORE-SRE-01
- [`toil-auditor`](../agents/toil-auditor.md) — AGCORE-SRE-02
- [`postmortem-writer`](../agents/postmortem-writer.md) — AGCORE-SRE-03
- [`prr-conductor`](../agents/prr-conductor.md) — AGCORE-SRE-04

**Subcomando `risk-budget`** é caso especial — comando direto (Plan 05 não usa agent); orquestrador delega aplicando skill [`sre-risk-management`](../skills/sre-risk-management/SKILL.md) inline ou re-encaminhando para `/risk-budget`.
</execution_context>
