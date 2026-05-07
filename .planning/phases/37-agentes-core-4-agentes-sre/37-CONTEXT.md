# Fase 37: Agentes core — 4 agentes SRE - Contexto

**Coletado:** 2026-05-07
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss)

<domain>
## Limite da Fase

Conteúdo editorial — agentes (Markdown com frontmatter complexo + tabela compatibilidade IDE). 4 agentes SRE em `kit/agents/{golden-signals-instrumenter, toil-auditor, postmortem-writer, prr-conductor}.md`.

**Entrega:**
- `kit/agents/golden-signals-instrumenter.md` — recebe código de serviço/Edge Function e retorna patches OTel com 4 golden signals (Latency: histogram bucketed; Traffic: counter; Errors: counter por error.type; Saturation: gauge resource-specific). Cross-ref para `four-golden-signals` + `observability-instrumenter` (v1.9)
- `kit/agents/toil-auditor.md` — analisa repo + git log + scripts shell + comandos manuais documentados; retorna `TOIL-AUDIT.md` listando candidatos com priorização P0/P1/P2 + esforço estimado
- `kit/agents/postmortem-writer.md` — recebe `--from-investigation <id>` (continuar de v1.9 incident-investigator) ou `--incident "<descrição>"` (standalone); gera postmortem blameless seguindo template canônico (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline) em `.planning/postmortems/<id>.md`
- `kit/agents/prr-conductor.md` — conduz PRR para serviço/feature; lê schema (Supabase MCP), Edge Functions, SLOs (`.planning/slos/`), audit logs; produz `PRR-REPORT.md` scored em 6 axes

**REQs cobertos (4):** AGCORE-SRE-01, AGCORE-SRE-02, AGCORE-SRE-03, AGCORE-SRE-04

**Dependência:** Phase 36 concluída (skills SKFD-SRE existem para cross-reference) — ✅ atendida.

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração do usuário (workflow.skip_discuss=true). Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código (precedente: agentes v1.8/v1.9 em `kit/agents/`) para guiar decisões.

</decisions>

<code_context>
## Insights do Código Existente

Precedentes a consultar:
- `kit/agents/observability-instrumenter.md` — base canônica do v1.9; `golden-signals-instrumenter` é especialização desta
- `kit/agents/incident-investigator.md` — produz `.planning/investigations/<id>.md`; `postmortem-writer` consome via `--from-investigation`
- `kit/agents/supabase-architect.md` — pattern com Supabase MCP tools
- `kit/skills/four-golden-signals/SKILL.md` — cross-ref de `golden-signals-instrumenter`
- `kit/skills/eliminating-toil/SKILL.md` — cross-ref de `toil-auditor`; define template `TOIL-AUDIT.md`
- `kit/skills/blameless-postmortems/SKILL.md` — cross-ref de `postmortem-writer`; define 9 seções canônicas
- `kit/skills/production-readiness-review/SKILL.md` — cross-ref de `prr-conductor`; define 6 axes + template PRR-REPORT.md

</code_context>

<specifics>
## Ideias Específicas

Sem requisitos específicos adicionais. Critérios de sucesso (6 da ROADMAP) cobrem: tabela "Compatibilidade IDE", cross-refs corretos, modos de invocação, MCP tools requeridos, smoke fixture para cada agente, `description ≤ 200 chars`.

</specifics>

<deferred>
## Ideias Adiadas

Nenhuma — fase de discuss pulada.

</deferred>
