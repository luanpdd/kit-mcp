---
phase: 32
status: complete
completed: 2026-05-06
covers_reqs: [SKPR-02, SKPR-03, AGCORE-03, AGCORE-04, CMD-02, CMD-04]
---

# Phase 32 — Summary: Skills SLO + agentes + comandos

## Entregue

6 artefatos:

| # | Artefato | REQ |
|---|----------|-----|
| 1 | `kit/skills/event-based-slos/SKILL.md` | SKPR-02 |
| 2 | `kit/skills/burn-rate-alerting/SKILL.md` | SKPR-03 |
| 3 | `kit/agents/slo-engineer.md` | AGCORE-03 |
| 4 | `kit/agents/burn-rate-forecaster.md` | AGCORE-04 |
| 5 | `kit/commands/definir-slo.md` | CMD-02 |
| 6 | `kit/commands/burn-rate-status.md` | CMD-04 |

## Cobertura técnica

### `event-based-slos`
- SLI event-based vs time-based (anti-pattern)
- Sliding window 30d (vs fixed/calendar — anti-pattern)
- Decouple "what" do "why"
- SLO definition canônico (YAML format)
- SLI materialized view (Postgres)
- Target ≤ 99.95% (regra absoluta)

### `burn-rate-alerting`
- Fórmula `burn_rate = error_rate / (1 - target)`
- Lookahead ≤ 4× baseline (regra empírica do livro)
- 2 alertas canônicos: short-term (page, lookahead 4h) + long-term (ticket, lookahead 3d)
- Threshold burn rates: page ≥ 14.4×, ticket ≥ 1.0×
- Predictive forecast — ETA exhaustão

### `slo-engineer`
- Inputs: feature/journey + target opcional + owner
- Output: `.planning/slos/<slo_name>.md` + `supabase/migrations/<ts>_create_sli_<slo_name>.sql`
- Tools MCP: `list_tables`, `execute_sql`, `apply_migration`
- Force enforce: target ≤ 99.95%, owner nomeado, sliding 30d

### `burn-rate-forecaster`
- Inputs: SLO name + lookahead/baseline windows
- Output: tabela com burn rate, ETA, status (PAGE/TICKET/WARN/OK)
- Tools MCP: `list_tables`, `execute_sql`
- Validação automática: lookahead ≤ 4× baseline

### `/definir-slo`
- Dispatch para `slo-engineer` via Task
- Pré-requisito: schema `observability` (Phase 31 supabase-architect)
- Estado inicial: `draft` → após validação `test_channel` → `primary`

### `/burn-rate-status`
- Dispatch para `burn-rate-forecaster` para cada SLO
- Compatible com `/loop 5m /burn-rate-status`
- Output table format `[SLO | Target | Window | Budget gasto | Burn rate | ETA | Status | Ação]`

## Validação

- ✅ 6/6 artefatos criados
- ✅ Description budgets: 149-164 chars (todos < 200)
- ✅ Cross-refs internos coerentes (skill → agent → command)
- ✅ Forward refs para Phase 31 (`supabase-architect` projeta schema observability) resolvidos
- ✅ MCP tools declarados nos agentes que usam Supabase

## Próximo: Phase 33 — Integração com fluxo framework
