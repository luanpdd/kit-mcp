---
phase: 36-skills-foundationais-sre-gloss-rio-5-skfd
plan: 03
subsystem: sre
tags: [sre, golden-signals, latency, traffic, errors, saturation, monitoring, observability, opentelemetry, percentiles, histograms, black-box, white-box]

requires:
  - phase: 35-suite-observabilidade
    provides: opentelemetry-standard, structured-events, event-based-slos, burn-rate-alerting (skills v1.9 referenciadas em "Ver também")
provides:
  - kit/skills/four-golden-signals/SKILL.md (skill foundationais SRE — cap 6 livro Google SRE)
  - definição canônica dos 4 golden signals (Latency/Traffic/Errors/Saturation)
  - patterns OTel SDK TypeScript/Deno + queries SQL + black-box probe + tabela saturation por tipo de serviço
affects: [phase 37 (golden-signals-instrumenter agent), phase 38 (/golden-signals command), phase 39 (supabase-edge-fn-writer patch), phase 41 (golden-signals-coverage gate)]

tech-stack:
  added: []
  patterns:
    - "Skill SKFD-SRE auto-contida — frontmatter triggerável + 6 seções canônicas + cross-refs apenas em Ver também"
    - "OTel SDK pattern: 4 instruments (Histogram + Counter + Counter + ObservableGauge) com bucketing exponencial e dimensions {result, error_type}"
    - "SQL query 4 signals em 1 dashboard com percentile_cont filter result_success"
    - "Anti-pattern shape canônico: ANTI: / PROBLEMA: / CERTO:"

key-files:
  created:
    - kit/skills/four-golden-signals/SKILL.md
  modified: []

key-decisions:
  - "Bucketing exponencial fixo em 14 buckets [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000] ms (cobre 1ms-30s sem cardinality explosion)"
  - "error.type enum 5-15 valores (timeout, validation, auth, rate_limit, db, provider_down, unknown) — explícito sobre cardinality"
  - "Latency success vs error em séries DISTINTAS (dimension result) — invariante explícita em Regras + Anti-patterns"
  - "Reportar p50/p95/p99/p99.9 (não só p99) — cada percentil conta história diferente"
  - "Cross-ref para _shared-sre/glossary.md (Plan 01) e production-readiness-review (Plan 06) sem versão (intra-v1.10)"

patterns-established:
  - "4 golden signals shape canônico: Latency (Histogram bucketed) + Traffic (Counter) + Errors (Counter por error.type) + Saturation (ObservableGauge resource-specific)"
  - "Black-box probe complementar: synthetic check valida response body + duration < threshold (não só status code)"
  - "Saturation por tipo de serviço: 7 contextos canônicos (HTTP API → connection pool, cache → memory, worker → queue depth, Edge Fn → concurrency, DB → tablespace/WAL, CPU-bound → load avg, network → bandwidth)"

requirements-completed: [SKFD-SRE-02]

duration: ~9min
completed: 2026-05-07
---

# Plan 36-03: Skill `four-golden-signals` — Resumo

**Skill canônica SRE cap 6 documentando os 4 sinais dourados universais (Latency/Traffic/Errors/Saturation), black-box vs white-box monitoring, latência success vs error separadas, percentis vs mean, e histograms com bucketing exponencial — auto-contida com OTel SDK em TypeScript/Deno e queries SQL prontas.**

## Performance

- **Duração:** ~9 min
- **Iniciado:** 2026-05-07 (parallel wave 1 executor)
- **Concluído:** 2026-05-07
- **Tarefas:** 5
- **Arquivos criados:** 1 (`kit/skills/four-golden-signals/SKILL.md` — 13.69 KB, 298 linhas)

## Realizações

- Skill `four-golden-signals/SKILL.md` criada com 6 seções canônicas (Quando usar / Regras absolutas / Patterns canônicos / Anti-patterns / Verificação / Ver também)
- Frontmatter válido — `name: four-golden-signals` + `description` 164/200 chars com triggers "golden signals", "p99 latency", "black-box vs white-box", "Google SRE cap 6"
- 8 regras absolutas cobrindo invariantes core (4 signals universais, success vs error separadas, NUNCA mean, bucketing exponencial, error.type enum, saturation resource-specific, black-box vs white-box, p50/p95/p99/p99.9)
- 5 patterns canônicos: tabela definição 4 signals + OTel SDK runnable copy-paste em TypeScript/Deno + queries SQL para dashboard + black-box probe + tabela saturation por tipo de serviço (7 contextos)
- 6 anti-patterns no shape `ANTI:/PROBLEMA:/CERTO:` (mean latency, success+error misturadas, error.message como dimension, monitoring causes não symptoms, saturation genérica, black-box only)
- Verificação checklist 7 itens + Ver também com 6 cross-refs Markdown relativos + footer com material-fonte cap 6

## Commits das Tarefas

Cada tarefa foi comitada atomicamente com `--no-verify` (parallel executor — orchestrator valida hooks após todos agentes):

1. **Tarefa 1: Frontmatter + Quando usar** — `031b1af` (feat)
2. **Tarefa 2: Regras absolutas — 8 princípios canônicos cap 6** — `8c83839` (feat)
3. **Tarefa 3: Patterns canônicos — 5 sub-patterns** — `65df221` (feat)
4. **Tarefa 4: Anti-patterns — 6 sub-anti-patterns** — `28f8a35` (feat)
5. **Tarefa 5: Verificação + Ver também + footer** — `253586a` (feat)

## Arquivos Criados/Modificados

- `kit/skills/four-golden-signals/SKILL.md` — Skill canônica SRE cap 6 (13.69 KB, 298 linhas) cobrindo os 4 golden signals com frontmatter triggerável, 8 regras absolutas, 5 patterns canônicos (incluindo OTel SDK runnable + SQL queries + black-box probe), 6 anti-patterns, checklist de verificação 7 itens, 6 cross-refs e material-fonte

## Decisões Tomadas

- **Bucketing exponencial fixo `[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]` ms** — 14 buckets cobrindo 1ms-30s, alinhado com plan; captura long tail sem cardinality explosion
- **error.type enum com 5-15 valores fixos** — explicitar para evitar cardinality explosion (`timeout`, `validation`, `auth`, `rate_limit`, `db`, `provider_down`, `unknown`)
- **Cross-refs Markdown relativos** — links para `../_shared-sre/glossary.md` (Plan 01 — wave 1 paralelo) e `../production-readiness-review/SKILL.md` (Plan 06 — wave 1 paralelo) sem versão pois são intra-v1.10; v1.9 skills marcadas com `(v1.9)`
- **Saturation por tipo de serviço — tabela com 7 contextos** — HTTP API/cache/worker/Edge Fn/DB/CPU-bound/network — cobertura ampla para autor escolher recurso correto

## Desvios do Plano

Nenhum — plano executado exatamente como escrito.

Verificações automáticas durante execução confirmaram aderência integral:
- 36/36 acceptance criteria checks passaram (Read tool + node script)
- ANTI:/PROBLEMA:/CERTO: triplet appears 6/6/6 vezes (uma por anti-pattern)
- Ver também tem 6 cross-refs (exato)
- Verificação tem 7 itens numerados (exato)
- Quando usar tem 7 trigger phrases (≥ 5 spec, mais é OK)
- Regras absolutas tem 8 bullets (exato)
- File total 13.69 KB (≤ 14 KB target)

## Problemas Encontrados

Nenhum.

## Configuração Manual Necessária

Nenhuma — skill é content-only (Markdown puro). Sync via `kit sync install` projeta para `.claude/skills/` automaticamente.

## Prontidão para Próxima Fase

**Pronto para Phase 37** — agente `golden-signals-instrumenter` pode cross-referenciar `four-golden-signals` skill via Markdown link. Patterns canônicos (OTel SDK shape, SQL queries, black-box probe, saturation por tipo) servem como base de instrumentação que o agente vai aplicar a código de Edge Function.

**Pronto para Phase 38** — comando `/golden-signals` invoca o agente Phase 37 que consume esta skill.

**Pronto para Phase 39** — patch `supabase-edge-fn-writer` referencia `four-golden-signals` para aplicar 4 signals em Edge Functions.

**Pronto para Phase 41** — gate `golden-signals-coverage` valida que código novo tem instrumentação dos 4 signals via grep dos patterns canônicos.

**Bloqueios:** nenhum.

---
*Fase: 36-skills-foundationais-sre-gloss-rio-5-skfd*
*Concluída: 2026-05-07*
