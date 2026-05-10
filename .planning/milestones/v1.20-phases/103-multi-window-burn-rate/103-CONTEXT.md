# Fase 103: Multi-window Burn-rate (1h fast + 6h slow) - Contexto

**Coletado:** 2026-05-10
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Substituir cálculo single-window do `/burn-rate-status` por dual-window. SLOs YAML já têm `alert_thresholds.page` (1h/5m) e `alert_thresholds.ticket` (6h/30m) — Phase 103 conecta o command a esses thresholds, calcula burn rate para AMBAS as janelas, e introduz status enum dual-window seguindo skill `burn-rate-alerting` (lookahead/baseline fator 4×).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude

**Schema YAML SLO atual já tem dual-window:**
- `alert_thresholds.page.lookahead: 1h, baseline: 5m, multiplier: 14.4`
- `alert_thresholds.ticket.lookahead: 6h, baseline: 30m, multiplier: 6`

**Mudança necessária no command:** ler ambos os thresholds, calcular burn rate independente para fast e slow, status enum combinado:
- `PAGE`: fast_burn ≥ 14.4 E slow_burn ≥ 6
- `TICKET`: slow_burn ≥ 6 mas fast OK (sustained slow erosion)
- `WARN`: apenas fast ≥ 14.4 transitório (alarme não-paging)
- `OK`: ambos < 1.0
- `no_data`: insufficient snapshots em ambas janelas

**Test schema regression:** atualizar `test/unit/slo-schema.test.js` para validar presença de `alert_thresholds.page` E `alert_thresholds.ticket` blocks com `lookahead`/`baseline`/`burn_rate_multiplier` cada.

**Tests `/burn-rate-status`:** ≥6 cenários conforme ROADMAP (PAGE both, TICKET slow-only, WARN fast-only-transient, OK ambos, no_data, defaults aplicados).

</decisions>

<code_context>
## Insights do Código Existente

`kit/commands/burn-rate-status.md` lê SLOs via regex bash, calcula SLI inline com node script, status enum atual é single-window (PAGE/TICKET/WARN/OK/no_data baseado em 1 burn_rate calculado). Phase 99 (v1.19) implementou `loadSnapshots(rootDir, windowMs)` que aceita janela arbitrária — então fast (1h) e slow (6h) são apenas 2 invocações diferentes do mesmo helper.

`test/unit/slo-schema.test.js` (existente) valida shape via regex — fácil estender.

</code_context>

<specifics>
## Ideias Específicas

REQ OBS-20-02. Critérios de sucesso explícitos no ROADMAP.md:
- Schema YAML SLO aceita `alert_thresholds.page` + `alert_thresholds.ticket` (já tem; reforçar via test)
- `kit/commands/burn-rate-status.md` calcula burn rate independente fast/slow; tabela ganha colunas `fast_burn`, `slow_burn`, `fast_status`, `slow_status`, `combined_status`
- Status enum dual-window: PAGE (fast≥14.4 E slow≥6), TICKET (slow≥6 fast OK), WARN (fast≥14.4 sozinho), OK (ambos <1)
- Regression tests cobrem ≥6 cenários
- `kit/skills/burn-rate-alerting/SKILL.md` cross-referenced ativamente

</specifics>

<deferred>
## Ideias Adiadas

- Auto-page integration (Slack/Discord webhook em PAGE) — fora do escopo, command read-only
- Triple-window (fast + slow + monthly) — overkill para v1.20
- Tunable multipliers via SLO YAML — mantemos canonical 14.4/6 hardcoded por enquanto

</deferred>
