# Fase 38: Comandos + orquestrador /sre - Contexto

**Coletado:** 2026-05-07
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Conteúdo editorial — comandos com dispatch via Task() + orquestrador. 6 comandos novos em `kit/commands/`:

1. `kit/commands/golden-signals.md` — invoca golden-signals-instrumenter; gera GOLDEN-SIGNALS.md por target
2. `kit/commands/auditar-toil.md` — invoca toil-auditor; gera TOIL-AUDIT.md em .planning/
3. `kit/commands/postmortem.md` — flags --from-investigation <id> ou --incident "<descrição>"; dispatch para postmortem-writer
4. `kit/commands/prr.md` — flags --service <name> ou --feature <description>; dispatch para prr-conductor
5. `kit/commands/risk-budget.md` — exibe error budget vs risk continuum; lê .planning/slos/ (v1.9 artifact); aplica sre-risk-management skill
6. `kit/commands/sre.md` — orquestrador análogo a /supabase (v1.8) e /observabilidade (v1.9); dispatch via Task(subagent_type=...); subcomandos: golden-signals, auditar-toil/audit-toil, postmortem, prr, risk-budget/budget, help/ajuda/?

**REQs cobertos (6):** CMD-SRE-01, CMD-SRE-02, CMD-SRE-03, CMD-SRE-04, CMD-SRE-05, CMD-SRE-06

**Dependência:** Phase 37 concluída (agentes existem para dispatch via Task()) — ✅ atendida.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração do usuário (workflow.skip_discuss=true). Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código (precedente: `kit/commands/supabase.md` v1.8 e `kit/commands/observabilidade.md` v1.9) para guiar decisões.

</decisions>

<code_context>
## Insights do Código Existente

Precedentes a consultar:
- `kit/commands/supabase.md` — orquestrador v1.8 (terceiro orquestrador da família; padrão exato a replicar)
- `kit/commands/observabilidade.md` — orquestrador v1.9 (padrão direto para /sre)
- Outros comandos v1.9 (`kit/commands/instrumentar-fase.md`, `kit/commands/burn-rate-status.md`, `kit/commands/forense.md`) — pattern de wrapper que invoca agente via Task()
- `kit/agents/golden-signals-instrumenter.md` — Phase 37 (Plan 01)
- `kit/agents/toil-auditor.md` — Phase 37 (Plan 02)
- `kit/agents/postmortem-writer.md` — Phase 37 (Plan 03)
- `kit/agents/prr-conductor.md` — Phase 37 (Plan 04)
- `kit/skills/sre-risk-management/SKILL.md` — aplicado por /risk-budget

</code_context>

<specifics>
## Ideias Específicas

Sem requisitos específicos adicionais. Critérios de sucesso (8 da ROADMAP) cobrem: cada comando invoca agente correspondente, orquestrador /sre tem subcomandos com sinônimos PT/EN, descrições ≤ 200 chars, smoke `kit sync install claude-code` lista 6 commands em .claude/commands/.

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
