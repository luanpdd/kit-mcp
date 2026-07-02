# Fase 32: Skills SLO + agentes SLO + comandos `/definir-slo` e `/burn-rate-status` - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado)

<domain>
## Limite da Fase

6 artefatos:
1. `kit/skills/event-based-slos/SKILL.md` — SLI event-based, sliding window, decouple what/why
2. `kit/skills/burn-rate-alerting/SKILL.md` — lookahead/baseline windows fator 4×, predictive vs short-term
3. `kit/agents/slo-engineer.md` — gera SLO.md + SQL para materializar SLI events
4. `kit/agents/burn-rate-forecaster.md` — calcula burn rate, ETA, alert config
5. `kit/commands/definir-slo.md` — invoca slo-engineer
6. `kit/commands/burn-rate-status.md` — tabela formato `[SLO | % gasto | ETA | ação]`

REQs: SKPR-02, SKPR-03, AGCORE-03, AGCORE-04, CMD-02, CMD-04 (6 REQs).

Depende: Phase 29 (skills SKFD), Phase 30 (skill ODD).
</domain>

<decisions>
## Decisões de Implementação

### Material-fonte
Cap 12 (SLOs) + Cap 13 (Acting on SLO Alerts) do livro. Recomendação para 30d sliding window. Lookahead window ≤ 4× baseline window sem ajuste de seasonality.

### Burn rate fórmula
```
burn_rate = error_rate / (1 - SLO_target)
```
Burn rate = 1 → budget durará exatamente a janela.
Burn rate = 10 → budget acaba 10× mais rápido.

### Patterns canônicos
SLI tables/views via `mcp__supabase__execute_sql` ou `mcp__supabase__apply_migration`.
Comando `/burn-rate-status` rodável também em `/loop` (skill).
</decisions>

<code_context>
- Padrão de skills v1.8: 5 seções (Quando usar, Regras absolutas, Patterns canônicos, Anti-patterns, Verificação)
- Padrão de agentes Supabase: Compatibilidade IDE + preflight MCP + Steps numerados
- Comandos: frontmatter + objective + process + success_criteria
</code_context>

<specifics>
## Ideias Específicas

### Janelas canônicas (dos exemplos do livro)
- **30d sliding window** — escolha pragmática para SLO (Cap 13)
- **Lookahead 4h** com baseline 1h — para alertas curtos (page on-call em horas)
- **Lookahead 3d** com baseline 18h — para alertas long-term (ticket, não page)

### Fórmula extrapolação predictive (Cap 13 p145)
```
projected_remaining = current_remaining - (burn_rate_now × lookahead_window)
if projected_remaining < 0 → ALERT
```

### Output canônico de `/burn-rate-status`
| SLO | Target | Janela | Budget gasto | Burn rate atual | ETA exhaustão | Ação |
|---|---|---|---|---|---|---|
| checkout_success | 99.9% | 30d sliding | 23% | 1.4× | 12d | informativo |
| login_success | 99.95% | 30d sliding | 78% | 8.0× | 4h | PAGE on-call |

</specifics>

<deferred>
## Ideias Adiadas

- Implementação real de SLOs em projeto user (out-of-scope; agentes sugerem padrão)
- Skills `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model` — Phase 34
- Patches em fluxo framework (`/discutir-fase`, `/planejar-fase`, etc.) — Phase 33
</deferred>
