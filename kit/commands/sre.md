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

<context>
**Argumentos:** `$ARGUMENTS` — primeiro token é o subcomando; restante é passado para o agent como prompt.

**Subcomandos suportados (sinônimos PT-BR/EN):**

| Subcomando | Sinônimos | Agent dispatched | Cap livro |
|---|---|---|---|
| `golden-signals` | `signals`, `4signals`, `golden` | `golden-signals-instrumenter` | 6 |
| `auditar-toil` | `audit-toil`, `toil`, `auditar` | `toil-auditor` | 5 |
| `postmortem` | `pm`, `post-mortem` | `postmortem-writer` | 15 |
| `prr` | `production-readiness`, `readiness-review` | `prr-conductor` | 32 |
| `risk-budget` | `budget`, `risk`, `continuum` | (comando direto — `/risk-budget`) | 3 |
| `help` | `ajuda`, `?` | exibe esta tabela inline | — |

**Roteamento de flags por subcomando:**

- `golden-signals <target>` — args passados como `<target>` + flags `--service` `--saturation` `--runtime`
- `auditar-toil` — flags `--time-window` `--team-size` `--output` `--runbooks-paths`
- `postmortem` — flags **mutuamente exclusivas** `--from-investigation <id>` OU `--incident "<desc>"` + `--severity`
- `prr` — flags **mutuamente exclusivas** `--service <name>` OU `--feature "<desc>"` + `--engagement` `--reviewer`
- `risk-budget` — `[<slo_name>]` opcional + `--format` `--explain`

**Exemplos:**

```
/sre golden-signals supabase/functions/process-emails    # instrumentar Edge Function
/sre auditar-toil --time-window 6m                       # audit toil últimos 6 meses
/sre postmortem --from-investigation incident-2026-05-06-1432-checkout-burn  # continuação de v1.9
/sre prr --service orders-api --reviewer @sre-lead       # PRR de serviço existente
/sre risk-budget checkout_success --explain              # budget + sabedoria 99.99% inline
/sre help                                                # exibe tabela de subcomandos
```
</context>
