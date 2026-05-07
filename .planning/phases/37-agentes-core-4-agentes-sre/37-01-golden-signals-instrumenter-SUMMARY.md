---
phase: 37-agentes-core-4-agentes-sre
plan: 01
subsystem: sre-agents
tags: [sre, four-golden-signals, otel, observability, instrumenter, latency, traffic, errors, saturation]

requires:
  - phase: 36-skills-foundationais-sre
    provides: kit/skills/four-golden-signals/SKILL.md (knowledge base canônica dos 4 signals — consumida via cross-ref)
  - phase: 30-agentes-core-observabilidade
    provides: kit/agents/observability-instrumenter.md (precedente — golden-signals-instrumenter é especialização)
provides:
  - kit/agents/golden-signals-instrumenter.md (agente especializado nos 4 golden signals, content-only)
  - Cross-ref Markdown válido para four-golden-signals + observability-instrumenter + slo-engineer + production-readiness-review
  - Pattern OTel SDK canônico (histogram bucketed exponencial + counter + ObservableGauge) reutilizável em fases futuras
affects: [37-02-toil-auditor, 37-03-postmortem-writer, 37-04-prr-conductor, 38-comandos-sre, 39-patches-supabase, 41-gates-docs]

tech-stack:
  added: []
  patterns:
    - "Especialização sem duplicação — agent foca em métricas; spans/atributos canônicos ficam com observability-instrumenter (cross-ref)"
    - "Heurística de detecção saturation_resource por tipo de serviço (6 variantes — db_pool/cache/queue/concurrency/cpu/egress)"
    - "Snippet OTel canônico com 4 signals (Setup meter + Latency histogram + Traffic counter + Errors counter por error.type + Saturation ObservableGauge)"
    - "Tabela Compatibilidade IDE Tier Full em todos os 5 IDEs (instrumentação local, sem MCP)"

key-files:
  created:
    - kit/agents/golden-signals-instrumenter.md (11880 bytes — frontmatter + 6 seções canônicas)
  modified: []

key-decisions:
  - "Frontmatter zero MCP (Read/Write/Edit/Bash/Grep/Glob apenas) — instrumentação acontece em arquivos do app (Deno Edge Function/Node service/Python worker), não em DB"
  - "Especialização ≠ duplicação — escopo restrito a métricas dos 4 signals; spans/wide events/atributos canônicos ficam com observability-instrumenter (cross-ref recíproca)"
  - "explicitBucketBoundaries com array exponencial canônico [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] ms reproduzido literalmente da skill four-golden-signals"
  - "error_type enum 8 valores (timeout/validation/auth/authz/rate_limit/db/provider_down/unknown) com classifier helper inline"
  - "Heurística saturation_resource por tipo de serviço com 6 variantes (db_connection_pool/cache_memory/queue_depth/concurrency_limit/cpu_load/egress_bandwidth) + fallback default explícito"

patterns-established:
  - "Compatibilidade tier Full sempre que agente é puramente content-editor sem MCP — convenção herdada de v1.8/v1.9"
  - "Cross-ref Markdown ativo (link funcional) em vez de placeholder textual quando target já existe — four-golden-signals + observability-instrumenter referenciados como links Markdown reais"
  - "Latency dimension result: 'success' vs 'error' SEMPRE separadas — anti-pattern crítico do livro Google SRE cap 6 explicitado no Step 2 e validado no Step 3"

requirements-completed: [AGCORE-SRE-01]

duration: 18min
completed: 2026-05-07
---

# Fase 37 Plan 01: Agente golden-signals-instrumenter — Resumo

**Especialização do observability-instrumenter (v1.9) com 4 golden signals OTel canônicos — Latency (histogram bucketed exponencial), Traffic (counter), Errors (counter por error.type enum), Saturation (gauge resource-specific)**

## Performance

- **Duração:** ~18 min
- **Iniciado:** 2026-05-07T06:13:00Z
- **Concluído:** 2026-05-07T06:31:00Z
- **Tarefas:** 5 (T1–T5)
- **Arquivos modificados:** 1 (criado)

## Realizações

- Agente `kit/agents/golden-signals-instrumenter.md` criado (11.88 KB — dentro da estimativa 12-14 KB do PLAN)
- 6 seções canônicas presentes (Compatibilidade, Por que existe, Inputs esperados, Passos com 5 sub-steps, Quando NÃO invocar, Ver também)
- 4 golden signals documentados com snippets OTel SDK executáveis (TypeScript/Deno) cobrindo todos os Must-haves goal-backward
- Cross-refs Markdown ativos para `four-golden-signals` (skill v1.10), `observability-instrumenter` (agent v1.9), `slo-engineer` (agent v1.9), `production-readiness-review` (skill v1.10)
- Tabela Compatibilidade 5 IDEs Tier Full (instrumentação local sem MCP)
- Smoke T5 ALL_PASS — descrição 157 chars (≤ 200), 6 anchors count=1, palavras-chave técnicas (histogram=7, counter=9, gauge=5, saturation=14, error_type/error.type=10), sync 2× idempotente timestamp-stripped (precedente Phase 36 preservado)

## Commits das Tarefas

Cada tarefa comitada atomicamente com `--no-verify` (parallel executor protocol):

1. **T1: Frontmatter + intro + Compatibilidade IDE** — `0026930` (feat)
2. **T2: Por que existe + Inputs esperados** — `f59af2a` (feat)
3. **T3: Passos com 5 sub-steps** — `48bb526` (feat)
4. **T4: Quando NÃO invocar + Ver também** — `6eb55a2` (feat)
5. **T5: Smoke validation** — `76472d8` (test)

## Arquivos Criados/Modificados

- `kit/agents/golden-signals-instrumenter.md` — agente especializado nos 4 golden signals; recebe `target_files` + `service_name` + `runtime` + `saturation_resource` (opcionais com heurísticas) e produz patches OTel SDK (histogram + counter + ObservableGauge); cross-ref recíproca com `observability-instrumenter` (spans complementares)

## Decisões Tomadas

- **Tools sem MCP confirmado** — `Read, Write, Edit, Bash, Grep, Glob` (zero MCP). Instrumentação edita arquivos do app (Deno/Node/Python), não toca DB. Por isso Tier Full em todos os IDEs.
- **explicitBucketBoundaries reproduzido literalmente** da skill `four-golden-signals` para evitar drift — array `[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]` ms canônico do livro Google SRE cap 6.
- **error_type enum com 8 valores fixos** (timeout/validation/auth/authz/rate_limit/db/provider_down/unknown) — dentro da faixa 5-15 prescrita pela skill, com classifier helper TypeScript inline para reuso direto.
- **saturation_resource enumerado em 6 valores** (db_connection_pool/cache_memory/queue_depth/concurrency_limit/cpu_load/egress_bandwidth) reflete a tabela "saturation por tipo de serviço" da skill, com heurística automática (grep) por tipo de serviço quando não fornecido pelo caller.

## Desvios do Plano

Nenhum — plano executado exatamente como escrito. Todos os 5 acceptance_criteria de cada task batidos no smoke T5.

## Problemas Encontrados

**1. Sintaxe sync command** — comando inicial `node bin/cli.js sync claude-code` retornou `error: unknown command 'claude-code'`. Corrigido para `node bin/cli.js sync install claude-code --project-root <tmpdir>` conforme `--help` da subcomand `sync`. Não bloqueou — apenas adaptação da invocação documentada no plan T5 (que usava notação `npx kit-mcp sync` genérica).

**2. Hash bruto não-idempotente** — sync 2× produz hashes diferentes. Diff revelou apenas linha `> Generated by kit-mcp at <timestamp>` regenerada por design (precedente Phase 36 STATE.md: "byte-idêntico excluindo timestamp regenerado por design"). Validação correta: comparar com timestamp stripped — `IDEMPOTENT_OK_TIMESTAMP_STRIPPED`. Comportamento esperado, não é bug.

## Configuração Manual Necessária

Nenhuma — sem configuração de serviço externo necessária. Agente é content-only (Markdown puro).

## Prontidão para Próxima Fase

- Phase 37 Plan 01 (AGCORE-SRE-01) entregue. Restam 3 plans paralelos da Phase 37: Plan 02 (`toil-auditor` — AGCORE-SRE-02), Plan 03 (`postmortem-writer` — AGCORE-SRE-03), Plan 04 (`prr-conductor` — AGCORE-SRE-04).
- Cross-refs preparadas para Phase 38 — comando `/golden-signals` da Phase 38 vai dispatch para este agente via `Task(subagent_type=golden-signals-instrumenter)`.
- Cross-refs preparadas para Phase 39 — patch em `supabase-edge-fn-writer.md` (v1.8) vai cross-ref para este agent (INT-SB-V2-01) e pattern OTel canônico (histogram + counter + gauge) será usado nos templates de Edge Function.
- Cross-refs preparadas para Phase 41 — gate `golden-signals-coverage.md` (QA-SRE-01) vai usar regex `histogram\|counter\|gauge\|saturation` em código tocado por fase, alinhado com as palavras-chave já presentes neste agent.

---
*Fase: 37-agentes-core-4-agentes-sre*
*Concluída: 2026-05-07*
