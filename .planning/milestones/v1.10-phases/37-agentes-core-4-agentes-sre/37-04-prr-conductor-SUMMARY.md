---
phase: 37-agentes-core-4-agentes-sre
plan: 04
subsystem: agentes-sre
tags: [sre, prr, agente, production-readiness-review, supabase-mcp, google-sre-cap-32, content-only]

# Grafo de dependências
requires:
  - phase: 36
    provides: skill production-readiness-review (Phase 36-06) com 6 axes detalhados in-line, 3 engagement models, template PRR-REPORT.md canônico, sequência handoff dev→SRE
provides:
  - kit/agents/prr-conductor.md — agente que conduz PRR para serviço/feature antes de produção
  - 6 axes auditados in-line com 5 items cada + tabela Evidence Full mode (4 MCP tools) + Evidence Offline fallback (filesystem)
  - Modo offline com fallback gracioso explícito (declaração [MODO OFFLINE] + marker EVIDENCE_PENDING_MCP)
  - Template PRR-REPORT.md replicado (consistente com skill production-readiness-review)
  - 3 engagement models escolhidos por custo de outage (< $1k/min Simple; $1k-100k/min Early; > $100k/min Platform)
affects: [Phase 38 /prr comando que dispatch para este agente, Phase 39 INT-SB-V2-02 supabase-architect cross-ref, Phase 40 INT-FW-V2-02 gate /concluir-marco, Phase 41 QA-SRE-03 gate prr-checklist-coverage]

# Rastreamento de tecnologia
tech-stack:
  added: []
  patterns:
    - "Agente SRE PT-BR — frontmatter com 4 MCP tools (mcp__supabase__list_tables, execute_sql, get_advisors, list_edge_functions) + 6 standard tools (Read/Write/Bash/Grep/Glob/AskUserQuestion)"
    - "Compatibilidade IDE com mix Full/Partial/Offline-only (5 IDEs explícitos)"
    - "Modo offline fallback gracioso — declaração [MODO OFFLINE — sem Supabase MCP] + marker EVIDENCE_PENDING_MCP em items MCP-dependentes"
    - "6 axes auditados como tabelas (1 por axe, 5 items cada, coluna Evidence Full / Evidence Offline)"
    - "Cross-ref Markdown para skill production-readiness-review (knowledge base) + 7 outras skills/agents"
    - "Scoring 0-5 por axe + decisão Approved/Approved with conditions/Blocked + lista de P0 blockers canônicos"
    - "Step 3 (Write PRR-REPORT.md) replica template inline da skill — caller produz arquivo com mesmas seções"

key-files:
  created:
    - kit/agents/prr-conductor.md
  modified: []

key-decisions:
  - "4 MCP Supabase tools no frontmatter (list_tables, execute_sql, get_advisors, list_edge_functions) — agente mais MCP-heavy da Phase 37"
  - "Tabela Compatibilidade explicita 5 IDEs (Claude Code+Cursor com MCP = Full; Codex+Gemini sem MCP = Partial; Windsurf+Antigravity+Copilot+Trae = Offline-only)"
  - "Modo offline fallback NÃO é 'erro' — agente declara [MODO OFFLINE] e prossegue com filesystem como evidence; items MCP-dependentes ficam EVIDENCE_PENDING_MCP para preenchimento manual"
  - "Step 0 valida engagement model via AskUserQuestion (3 opções por custo de outage) E reviewer ≠ team dev (anti-pattern auto-PRR)"
  - "Step 1 mantém os 6 axes literalmente nominados (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance) — gate prr-checklist-coverage da Phase 41 valida presença dos 6"
  - "Step 2 lista P0 items canônicos por axe (zero redundância, zero golden signals, zero runbook, etc.) — base para decisão Blocked"
  - "Step 3 usa template inline igual ao da skill — formato compartilhado consumido pelo gate /concluir-marco da Phase 40"
  - "Description 148/200 chars — ampla margem para futuros refinamentos"

patterns-established:
  - "Agentes Phase 37 com MCP Supabase usam Step 0 Preflight com tentativa leve mcp__supabase__list_tables + declaração explícita de MODO OFFLINE quando indisponível"
  - "Agentes consultam skills companion como knowledge base — cross-ref Markdown válido para evitar duplicação de regras canônicas"
  - "Fallback gracioso não bloqueia — agente sempre produz output útil; items MCP-dependentes ficam EVIDENCE_PENDING_MCP"
  - "AskUserQuestion para decisões críticas (engagement model, reviewer) — agente não chuta defaults arbitrários"

requirements-completed: [AGCORE-SRE-04]

# Métricas
duration: ~25min
completed: 2026-05-07
---

# Plano 37-04: Agente `kit/agents/prr-conductor.md` — Resumo

**Agente SRE que conduz Production Readiness Review (cap 32 do livro Google SRE) para serviço/feature antes de produção, lendo schema/Edge Functions/SLOs/advisors via 4 Supabase MCP tools (list_tables, execute_sql, get_advisors, list_edge_functions), produzindo PRR-REPORT.md scored em 6 axes com modo offline fallback gracioso quando MCP indisponível.**

## Performance

- **Duração:** ~25 min (4 tarefas de implementação + smoke validation)
- **Iniciado:** 2026-05-07T06:14:00Z
- **Concluído:** 2026-05-07T06:25:00Z
- **Tarefas:** 5 (T1 frontmatter+Compatibilidade, T2 Por que existe+Inputs, T3 Passos 4 sub-steps + 6 axes, T4 Quando NÃO invocar+Ver também, T5 smoke validation)
- **Arquivos criados:** 1 (`kit/agents/prr-conductor.md` — 14.5 KB / 288 linhas)
- **Smoke validation:** ALL_PASS (description 148/200 chars; 4 MCP tools no frontmatter; 6 axes literais cada >= 4 ocorrências; 3 engagement models cada >= 6 ocorrências; offline mentioned 6×; EVIDENCE_PENDING_MCP 2×; PRR-REPORT 8×; sync idempotente timestamp-stripped per design — Phase 36 precedent)

## Realizações

- Agente `kit/agents/prr-conductor.md` criado com frontmatter válido (`name: prr-conductor` + `description: 148 chars` + `color: purple`)
- **Frontmatter `tools` inclui literalmente as 4 MCP Supabase tools** — `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`, `mcp__supabase__list_edge_functions` (agente mais MCP-heavy da Phase 37) + 6 standard tools (Read, Write, Bash, Grep, Glob, AskUserQuestion)
- 6 seções canônicas presentes — Compatibilidade, Por que existe, Inputs esperados (do caller), Passos, Quando NÃO invocar, Ver também
- Tabela Compatibilidade com 5 IDEs (mix Full/Partial/Offline-only) + declaração explícita de "Modo offline fallback"
- Step 0 Preflight com detecção MCP via `mcp__supabase__list_tables` + AskUserQuestion para engagement model + validação reviewer ≠ team dev
- Step 1 com 6 axes literalmente nominados (System Architecture, Instrumentation, Emergency Response, Capacity Planning, Change Management, Performance) — cada axe com tabela 5 items + coluna Evidence Full mode (com MCP tools) + coluna Evidence Offline fallback (filesystem)
- Step 2 com scoring 0-5 + status Pass/Pass with gaps/Fail + decisão Approved/Approved with conditions/Blocked + lista canônica de P0 items por axe
- Step 3 com template literal `PRR-REPORT.md` (Sumário executivo + Detalhamento + Action Items + Decisão + Re-PRR triggers + Reviewer signature) + console summary para caller
- Seção "Quando NÃO invocar" com 4 cenários canônicos (serviço maduro, internal tool 5 users, mudança trivial, feature ainda em design)
- Seção "Ver também" com 8 cross-refs Markdown válidos (production-readiness-review, four-golden-signals, event-based-slos v1.9, burn-rate-alerting v1.9, sre-risk-management, blameless-postmortems, eliminating-toil, supabase-architect v1.8)

## Commits das Tarefas

Cada tarefa foi comitada atomicamente (--no-verify por execução paralela):

1. **T1: Frontmatter + intro + Compatibilidade IDE** — `0e50a26` (feat)
2. **T2: Por que existe + Inputs esperados** — `2c68ebe` (feat)
3. **T3: Passos com 4 sub-steps + 6 axes auditados** — `89f2417` (feat)
4. **T4: Quando NÃO invocar + Ver também** — `1358ae5` (feat)
5. **T5: Smoke validation** — sem commit de código (validação read-only via shell + sed timestamp stripping)

## Arquivos Criados/Modificados

- `kit/agents/prr-conductor.md` — agente novo (~14.5 KB, 288 linhas) cobrindo AGCORE-SRE-04 integralmente

## Decisões Tomadas

- **CLI path correto** — sync via `node bin/cli.js sync install claude-code --project-root <tmp>` (precedente Phase 36; plano original usava `npx kit-mcp sync` que não é o entrypoint correto do CLI)
- **Timestamp stripping na comparação de sync** — stubs gerados pelo kit incluem `> Generated by kit-mcp at <ISO>.` que regenera por design. Smoke test compara conteúdo após `sed -E 's/Generated by kit-mcp at [0-9TZ:.-]+\./Generated by kit-mcp at <TS>./'` (consistente com ROADMAP crit-4 e Phase 36 precedent)
- **Cross-refs explícitos** — 8 cross-refs Markdown na seção "Ver também" cobrem skills companions (4 v1.10 SRE + 2 v1.9 observabilidade + 1 v1.8 supabase) — gate de Phase 41 prr-checklist-coverage pode validar presença dos cross-refs
- **Modo offline NÃO é falha** — agente declara `[MODO OFFLINE]` e prossegue produzindo output útil; items MCP-dependentes ficam `EVIDENCE_PENDING_MCP` para user preencher manualmente. Mantém valor mesmo nos 4 IDEs sem MCP (Windsurf, Antigravity, Copilot, Trae)

## Desvios do Plano

Nenhum desvio estrutural. Smoke validation T5 ajustou comando de sync (Phase 36 precedent — `node bin/cli.js sync install` em vez de `npx kit-mcp sync`) e usou timestamp-stripping para idempotência (design-by-intent — stubs regeneram timestamp).

## Problemas Encontrados

- **Idempotência aparente falsa em primeiro smoke** — primeira tentativa de comparação direta detectou diff por causa do timestamp regenerado em cada sync. Confirmado design-by-intent (Phase 36 precedent — linha `> Generated by kit-mcp at <ISO>` regenera) e ajustado script com timestamp stripping; após ajuste, IDEMPOTENT_OK.

## Configuração Manual Necessária

Nenhuma — agente é content-only (apenas markdown) sem dependências externas.

## Prontidão para Próxima Fase

- **Phase 38 (Comandos):** `/prr` pode dispatchar para este agente com flags `--service <name>` ou `--feature <description>` + `--reviewer @<sre>` + `--output-path`
- **Phase 39 (INT-SB-V2-02):** `supabase-architect` (v1.8) pode ganhar menção a este agente — plano arquitetural sugere PRR antes de production via `prr-conductor`
- **Phase 40 (INT-FW-V2-02):** `/concluir-marco` pode adicionar gate PRR opcional usando este agente — quando `workflow.complete_milestone_prr_gate=true`, exige `PRR-REPORT.md` com status `Approved` para features production-bound
- **Phase 41 (QA-SRE-03):** gate `prr-checklist-coverage` pode validar que `PRR-REPORT.md` (gerado por este agente) cobre os 6 axes literalmente (não pula nenhum)

**Smoke validation T5 ALL_PASS — agente prr-conductor pronto para Phase 38 (`/prr` comando) consumir.**

---
*Fase: 37-agentes-core-4-agentes-sre*
*Plano: 04 — prr-conductor*
*Concluído: 2026-05-07*
