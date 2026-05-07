# ROADMAP — kit-mcp

> Roadmap consolidado por milestone. Cada milestone arquivado em `.planning/milestones/v<X.Y>-ROADMAP.md`.

## Concluídos

- v1.0.0 — Estabilização (5 fases) — `.planning/milestones/v1.0.0/`
- v1.1.0 — Feedback visual no terminal (5 fases) — `.planning/milestones/v1.1.0/`
- v1.2.0 — GUI sidecar (8 fases) — `.planning/milestones/v1.2.0/`
- v1.3.0 → v1.5.3 — patches ad-hoc (CHANGELOG canônico)
- v1.6.0 — Perf+lean (Phases 19-21) + observability hook
- v1.6.1 — DX patch (kit doctor + upgrade-check + gates cache)
- v1.7.0 — Perf+lean part 2 (Phases 22-24) + UX naming canonical
- **v1.8.0 — Suíte Supabase (Phases 25-28)** — 11 skills + 7 agents + command `/supabase` + 5 audit gates + UUID cleanup. [Detalhes](./milestones/v1.8.0/ROADMAP.md)
- **v1.9.0 — Observabilidade (Phases 29-35)** — 11 skills + 5 agents + 6 commands + 3 audit gates + 11 patches em commands/agents existentes. Material-fonte: *Observability Engineering* (O'Reilly, 2022). [Detalhes](./milestones/v1.9/ROADMAP.md)

## Em andamento

### v1.10 — SRE Engagement (Phases 36-41)

**Milestone:** v1.10 — SRE Engagement
**Numeração de fases:** continua de v1.9 (terminou em fase 35) → v1.10 começa em **Fase 36**
**Total de REQs cobertos:** 32 (GLOS-01..03, SKFD-SRE-01..05, AGCORE-SRE-01..04, CMD-SRE-01..06, INT-OBS-01..02, INT-SB-V2-01..04, INT-FW-V2-01..03, QA-SRE-01..05)
**Total de fases:** 6 (Fases 36-41)
**Estrutura:** 3 ondas conforme PROJECT.md
**Criado:** 2026-05-06

---

## Visão geral do milestone v1.10

Adicionar camada SRE (Site Reliability Engineering) ao kit derivada do livro do Google (*Site Reliability Engineering: How Google Runs Production Systems* — Beyer, Jones, Petoff, Murphy — O'Reilly, 2016, ISBN 978-1-491-92912-4), complementando v1.9 (Observabilidade) com práticas de engagement: PRR (Production Readiness Review), Four Golden Signals, Postmortem blameless, Toil elimination, Risk management. v1.10 é **content-only por design** — zero alterações em `src/core/`. Stable API v1.0+ preservada. Conteúdo PT-BR alinhado.

**Beneficiários principais:**
- Suíte Observabilidade v1.9 (`event-based-slos` ganha contexto risk; `omm-auditor` consume `toil-auditor` para Cap 3)
- Suíte Supabase v1.8 (`supabase-edge-fn-writer` ganha 4 golden signals; `supabase-architect` referencia PRR; `supabase-migration-writer` alerta toil; `supabase-storage-implementer` ganha saturation)
- Fluxo framework (`/forense` → `/postmortem` chain; `/concluir-marco` PRR gate; `/auditar-marco` toil scoring)

**Material-fonte:** Caps 3 (Embracing Risk), 4 (SLOs), 5 (Eliminating Toil), 6 (Four Golden Signals), 15 (Postmortem Culture), 32 (PRR / Engagement Model). Cap 22 (Cascading Failures) e Cap 8 (Release Engineering) ficam para v2.0+.

---

## Onda 1 — Núcleo SRE (Phases 36-38)

> Glossário + 5 skills foundationais + 4 agentes + 5 comandos + orquestrador. Sem essa onda, INT/QA não compila.

### Phase 36: Skills foundationais SRE — glossário + 5 SKFD

**Tipo:** Conteúdo editorial — escrita de skills canônicas (Markdown puro)
**Por que primeiro:** Glossário SRE e 5 skills foundationais são consultáveis standalone e referenciadas por todos agentes/comandos das fases seguintes. Sem vocabulário canônico em `_shared-sre/glossary.md` e definições de risk/golden-signals/toil/postmortem/PRR, links morrem em `kit/agents/sre-*.md` e `kit/commands/sre-*.md`. Sem dependências exceto contexto v1.9.

**Status execução (2026-05-07):**
- Plan 01 (`_shared-sre/glossary.md`) — ✅ concluído (32.6 KB, GLOS-01/02/03; 5 seções cobrindo 6 caps prioritários do livro Google SRE; precedente _shared-supabase/_shared-observability preservado; smoke T7 IDEMPOTENT_OK + NOT_LISTED_OK + NOT_MATERIALIZED_OK; CLAUDE.md NÃO cresce — glossary não é skill triggerável)
- Plan 02 (`sre-risk-management/SKILL.md`) — ✅ concluído (11.2 KB, SKFD-SRE-01)
- Plan 03 (`four-golden-signals/SKILL.md`) — ✅ concluído (13.69 KB, SKFD-SRE-02)
- Plan 04 (`eliminating-toil/SKILL.md`) — ✅ concluído (12.2 KB, SKFD-SRE-03; cap 5 Eliminating Toil — 6 critérios + ≤ 50% + L0-L4 + 5 anti-patterns)
- Plan 05 (`blameless-postmortems/SKILL.md`) — ✅ concluído (SKFD-SRE-04, cap 15)
- Plan 06 (`production-readiness-review/SKILL.md`) — ✅ concluído (15.3 KB, SKFD-SRE-05; cap 32 Evolving SRE Engagement Model — 6 axes detalhados + 3 engagement models + template PRR-REPORT.md + handoff dev→SRE 9 passos)
- Smoke agregado Phase 36 (Plan 06 T6) — ALL_PASS (5 skills frontmatter ≤ 200 chars; sync 2× idempotente timestamp-stripped; _shared-sre NÃO listed em `kit list-skills`)

**REQs cobertos (8):** GLOS-01, GLOS-02, GLOS-03, SKFD-SRE-01, SKFD-SRE-02, SKFD-SRE-03, SKFD-SRE-04, SKFD-SRE-05

**Critérios de sucesso:**
1. Glossário `kit/skills/_shared-sre/glossary.md` existe com vocabulário bilíngue (SLI, SLO, SLA, error budget, burn rate, toil, postmortem, blameless, PRR, golden signals — Latency/Traffic/Errors/Saturation, risk continuum, MTTR, MTBF), comandos canônicos (templates de postmortem, checklist PRR, queries SLI standardized) e seção de anti-patterns (alert fatigue, hero culture, SLO 99.99%+, fixed-window error budget, blame culture, mean-only latency); NÃO listado em `listKit` (precedente: `_shared-supabase/glossary.md`, `_shared-observability/glossary.md`)
2. As 5 skills SKFD-SRE existem em `kit/skills/{sre-risk-management,four-golden-signals,eliminating-toil,blameless-postmortems,production-readiness-review}/SKILL.md` com frontmatter válido (`name`, `description ≤ 200 chars`); cada uma é auto-contida — LLM gera workflow completo sem ler outra skill (cross-refs apenas em "Ver também" no fim)
3. Conteúdo conforme caps específicos: `sre-risk-management` ↔ cap 3 (continuum + 99.99% wisdom); `four-golden-signals` ↔ cap 6 (Latency/Traffic/Errors/Saturation, black-box vs white-box, percentis); `eliminating-toil` ↔ cap 5 (definição + ≤ 50% rule); `blameless-postmortems` ↔ cap 15 (template + cultura + Wheel of Misfortune); `production-readiness-review` ↔ cap 32 (checklist + 3 modelos engagement)
4. Sync idempotente — `kit sync install claude-code --project-root <tmpdir>` rodado 2× produz `.claude/skills/{...}` byte-idêntico (excluindo timestamp regenerado por design)
5. CLAUDE.md gerado cresce ≤ +1.0 KB após Phase 36 (description budget enforcement — anti-pitfall A2)

**Estimativa:** ~12-15h. Cada skill ~2-3h em média; glossário ~3h.

---

### Phase 37: Agentes core — 4 agentes SRE

**Tipo:** Conteúdo editorial — agentes (Markdown com frontmatter complexo + tabela compatibilidade IDE)
**Por que segundo:** Com skills SKFD-SRE da Phase 36 no lugar, agentes podem cross-referenciar via Markdown link. `golden-signals-instrumenter` consome `four-golden-signals` + skills v1.9 (`structured-events`, `opentelemetry-standard`); `postmortem-writer` consome `blameless-postmortems` + estado de `incident-investigator` v1.9; `prr-conductor` consome `production-readiness-review` + Supabase MCP tools; `toil-auditor` consome `eliminating-toil`.

**Dependência:** Phase 36 concluída (skills SKFD-SRE existem para cross-reference).

**REQs cobertos (4):** AGCORE-SRE-01, AGCORE-SRE-02, AGCORE-SRE-03, AGCORE-SRE-04

**Critérios de sucesso:**
1. Agente `kit/agents/golden-signals-instrumenter.md` existe com tabela "Compatibilidade IDE", recebe código e retorna patches OTel com 4 golden signals (Latency: histogram bucketed exponencial, Traffic: counter, Errors: counter por error.type, Saturation: gauge resource-specific); cross-ref para `four-golden-signals` + `observability-instrumenter` (v1.9)
2. Agente `kit/agents/toil-auditor.md` existe com preflight (lê git log, scripts shell, README/runbooks), produz `TOIL-AUDIT.md` com lista priorizada P0/P1/P2 + esforço estimado de automação; sem MCP requirements (analisa filesystem)
3. Agente `kit/agents/postmortem-writer.md` existe com 2 modos (`--from-investigation <id>` lê `.planning/investigations/<id>.md` v1.9; `--incident "<descrição>"` standalone); produz postmortem blameless em `.planning/postmortems/<id>.md` seguindo template canônico (Summary, Impact, Root Causes, Trigger, Resolution, Detection, Action Items, Lessons Learned, Timeline)
4. Agente `kit/agents/prr-conductor.md` existe com tools `mcp__supabase__list_tables`/`execute_sql`/`get_advisors`/`list_edge_functions`; produz `PRR-REPORT.md` scored em 6 axes (System architecture, Instrumentation, Emergency response, Capacity planning, Change management, Performance); modo offline fallback gracioso
5. Smoke: invocar cada agente em fixture sintético — `golden-signals-instrumenter` produz código instrumentado; `toil-auditor` lista candidatos; `postmortem-writer` gera template preenchido; `prr-conductor` produz scoring 6-axes
6. `description ≤ 200 chars` em todos os 4 agents (anti-pitfall A2)

**Estimativa:** ~8-10h. `prr-conductor` é o mais complexo (cross-references com Supabase MCP + 6 axes).

---

### Phase 38: Comandos + orquestrador `/sre`

**Tipo:** Conteúdo editorial — comandos com dispatch via Task() + orquestrador
**Por que terceiro:** Com agentes da Phase 37, comandos são apenas wrappers que invocam `Task(subagent_type=...)`. Orquestrador `/sre` é análogo a `/supabase` (v1.8) e `/observabilidade` (v1.9) — terceiro orquestrador da família.

**Dependência:** Phase 37 concluída.

**REQs cobertos (6):** CMD-SRE-01, CMD-SRE-02, CMD-SRE-03, CMD-SRE-04, CMD-SRE-05, CMD-SRE-06

**Critérios de sucesso:**
1. Comando `kit/commands/golden-signals.md` existe — invoca `golden-signals-instrumenter` para serviço/Edge Function/fase; gera `GOLDEN-SIGNALS.md` por target
2. Comando `kit/commands/auditar-toil.md` existe — invoca `toil-auditor`; gera `TOIL-AUDIT.md` na raiz `.planning/`
3. Comando `kit/commands/postmortem.md` existe — flags `--from-investigation <id>` ou `--incident "<descrição>"`; dispatch para `postmortem-writer`
4. Comando `kit/commands/prr.md` existe — flags `--service <name>` ou `--feature <description>`; dispatch para `prr-conductor`
5. Comando `kit/commands/risk-budget.md` existe — exibe error budget vs risk continuum; lê `.planning/slos/` (v1.9 artifact); aplica `sre-risk-management`
6. Comando orquestrador `kit/commands/sre.md` existe — análogo a `/supabase` e `/observabilidade`; dispatch via `Task(subagent_type=...)`; subcomandos: `golden-signals`, `auditar-toil`/`audit-toil`, `postmortem`, `prr`, `risk-budget`/`budget`, `help`/`ajuda`/`?`
7. `description ≤ 200 chars` em todos
8. Smoke: `kit sync install claude-code` lista 6 commands novos em `.claude/commands/`

**Estimativa:** ~6-8h. Padrão maduro v1.8/v1.9.

---

## Onda 2 — Integração (Phases 39-40)

> Patches em camadas existentes (Observabilidade v1.9 + Supabase v1.8 + fluxo framework).

### Phase 39: Patches em Observabilidade v1.9 + Supabase v1.8

**Tipo:** Patches editoriais — adicionar blocos `<sre_integration>` nos artefatos das suítes anteriores
**Por que quarto:** Onda 1 (núcleo SRE) precisa estar consolidada para que cross-refs nas suítes existentes apontem para artefatos reais.

**Dependência:** Phases 36-38 concluídas.

**REQs cobertos (6):** INT-OBS-01, INT-OBS-02, INT-SB-V2-01, INT-SB-V2-02, INT-SB-V2-03, INT-SB-V2-04

**Critérios de sucesso:**
1. Skill `kit/skills/event-based-slos/SKILL.md` (v1.9) ganha bloco "Risk continuum" cross-referenciando `sre-risk-management` — explica que SLO target é escolha explícita no continuum risk × innovation, não meta arbitrária
2. Agente `kit/agents/omm-auditor.md` (v1.9) consulta `toil-auditor` para Capacidade 3 (Complexidade/Tech Debt) — score OMM-3 considera % toil pelo time
3. `kit/agents/supabase-edge-fn-writer.md` (v1.8) ganha seção "Four Golden Signals" — template Edge Function inclui histogram latência, counter tráfego, counter erros por error.type, gauge saturação (memory/CPU/connection pool)
4. `kit/agents/supabase-architect.md` (v1.8) ganha menção a PRR — plano arquitetural sugere PRR antes de production; cross-ref para `production-readiness-review`
5. `kit/agents/supabase-migration-writer.md` (v1.8) ganha alerta sobre toil — scripts SQL repetitivos (rebuild índices manuais, vacuums recorrentes) são candidatos a automação via pg_cron; cross-ref para `eliminating-toil`
6. `kit/agents/supabase-storage-implementer.md` (v1.8) ganha saturation signal — uploads emitem gauge bucket size + counter de quota near-exhaustion; cross-ref para `four-golden-signals`
7. Frontmatter (`description`, `tools`) inalterado em todos os 6 artefatos (anti-pitfall A2 preservado)

**Estimativa:** ~5-7h.

---

### Phase 40: Patches em fluxo framework

**Tipo:** Patches editoriais — adicionar blocos `<sre_integration>` em comandos do framework
**Por que quinto:** Patches no fluxo viabilizam o uso real dos artefatos das ondas anteriores em `/forense`, `/concluir-marco`, `/auditar-marco`.

**Dependência:** Phases 36-39 concluídas.

**REQs cobertos (3):** INT-FW-V2-01, INT-FW-V2-02, INT-FW-V2-03

**Critérios de sucesso:**
1. Comando `kit/commands/forense.md` ganha bloco `<sre_integration>` que sugere chain `/postmortem` automaticamente após Core Analysis Loop fechar com root cause; documenta o fluxo
2. Comando `kit/commands/concluir-marco.md` ganha gate PRR opcional — quando `workflow.complete_milestone_prr_gate=true`, exige `PRR-REPORT.md` com status passed para features production-bound antes de arquivar
3. Comando `kit/commands/auditar-marco.md` invoca `/auditar-toil` automaticamente quando `workflow.audit_milestone_toil=true`; resultado alimenta scoring OMM Capacidade 3
4. Frontmatter (`description`, `allowed-tools`) inalterado nos 3 commands (anti-pitfall A2 preservado)
5. Patches são editoriais — workflows em `.claude/framework/workflows/*.md` continuam funcionais como antes

**Estimativa:** ~3-4h.

---

## Onda 3 — Gates e docs (Phase 41)

> Gates QA novos + README + CHANGELOG. Última fase do milestone.

### Phase 41: Gates QA + README + CHANGELOG

**Tipo:** Gates bash 3.2-portable + atualização editorial de docs externas
**Por que último:** Gates dependem de todos os artefatos das ondas anteriores existirem para validarem corretamente. README/CHANGELOG documentam o entregável final.

**Dependência:** Phases 36-40 concluídas.

**REQs cobertos (5):** QA-SRE-01, QA-SRE-02, QA-SRE-03, QA-SRE-04, QA-SRE-05

**Critérios de sucesso:**
1. Gate `gates/golden-signals-coverage.md` (blocking, pre-verify) — verifica código de serviço/Edge Function tocado em fase tem os 4 golden signals presentes (regex sobre `histogram\|counter\|gauge\|saturation` em frontmatter `tools` ou em código)
2. Gate `gates/postmortem-template-required.md` (blocking, pre-conclude) — em `/concluir-marco`, bloqueia se houve incident em `.planning/investigations/` sem `.planning/postmortems/` correspondente
3. Gate `gates/prr-checklist-coverage.md` (blocking, pre-verify) — verifica que `PRR-REPORT.md` cobre os 6 axes do PRR (System architecture, Instrumentation, Emergency response, Capacity planning, Change management, Performance)
4. README ganha seção "SRE Engagement (v1.10)" listando 6 skills + 4 agents + 6 commands + 3 gates com exemplo de uso end-to-end (e.g., "/sre prr <feature>" → "/sre golden-signals <service>" → após incident "/forense" → "/sre postmortem --from-investigation <id>")
5. CHANGELOG ganha entrada v1.10.0 documentando: Camada SRE Engagement, integração com Suítes Observabilidade v1.9 + Supabase v1.8, audit gates novos, lifecycle hooks (PRR gate em concluir-marco, postmortem chain em forense, toil audit em auditar-marco)
6. Smoke: rodar 3 gates novos em CI sintético — todos retornam exit 0 (pass) na codebase atual; falham corretamente em projetos sintéticos com gaps
7. Sync idempotente preservado em todas as 6 fases (rodar 2× = byte-idêntico excluindo timestamps)

**Estimativa:** ~5-6h.

---

## Total v1.10

- **6 fases** (36-41)
- **32 REQs** mapeados (100% cobertura)
- **3 ondas:** Núcleo SRE (3 fases) + Integração (2 fases) + Gates/Docs (1 fase)
- **Estimativa:** ~39-50h efetivas (média ~45h)
- **Cadeia linear:** Phase 36 → 37 → 38 → 39 → 40 → 41
- **Stable API v1.0+ preservada** — content-only milestone, zero alterações em `src/core/`

## Próximo passo

User vai limpar contexto. Após retomada:

```
/discutir-fase 36   # primeira fase — skills foundationais
# ou
/autonomo           # executar todas as 6 fases sequencialmente
```

## ~~v1.9 — Observabilidade (Phases 29-35) — concluído 2026-05-06~~

**Milestone:** v1.9 — Observabilidade
**Numeração de fases:** continua de v1.8.1 (terminou em fase 28) → v1.9 começa em **Fase 29**
**Total de REQs cobertos:** 41 (GLOS-01..03, SKFD-01..04, SKPR-01..06, AGCORE-01..05, CMD-01..06, INT-SB-01..07, INT-FW-01..06, QA-01..04)
**Total de fases:** 7 (Fases 29-35)
**Estrutura:** 3 ondas conforme PROJECT.md
**Criado:** 2026-05-06

---

## Visão geral do milestone

Adicionar uma camada de expertise em observabilidade ao kit (11 skills + 5 agentes + 6 comandos) inspirada no livro *Observability Engineering* (Charity Majors, Liz Fong-Jones, George Miranda — O'Reilly, 2022, ISBN 978-1-492-07644-5), aproveitada de forma profunda pela Suíte Supabase existente (v1.8) para potencializar o uso dos MCP tools `mcp__supabase__get_logs`/`execute_sql`/`get_advisors` em diagnóstico, SLOs e instrumentação. v1.9 é **content-only por design** — zero alterações em `src/core/`, registry, sync ou MCP server runtime. Stable API v1.0+ preservada. Conteúdo PT-BR alinhado com o resto do kit.

**Beneficiários principais:**
- Suíte Supabase (v1.8): 7 agentes existentes recebem patches para consultar skills novas
- Fluxo framework: `/discutir-fase`, `/planejar-fase`, `/verificar-trabalho`, `/auditar-marco`, `/concluir-marco`, `/forense` ganham gates ODD/OMM
- Consumidores do kit: novo orquestrador `/observabilidade` análogo a `/supabase`

---

## Onda 1 — Núcleo (Phases 29-31)

> Skills foundationais + agentes core + integração imediata na Suíte Supabase. Sem essa onda, nada do resto compila.

### Phase 29: Skills foundationais — glossário + 4 skills SKFD + core-analysis-loop

**Tipo:** Conteúdo editorial — escrita de skills canônicas (Markdown puro)
**Por que primeiro:** Glossário e skills foundationais são consultáveis standalone e referenciadas por todos agentes/comandos das fases seguintes. Sem vocabulário canônico em `glossary.md` e definições de wide events / OTel / trace context / Core Analysis Loop, links morrem em `kit/agents/*.md` e `kit/commands/*.md`. Sem dependências.

**REQs cobertos (7):** GLOS-01, GLOS-02, GLOS-03, SKFD-01, SKFD-02, SKFD-03, SKFD-04

**Critérios de sucesso:**
1. Glossário `kit/skills/_shared-observability/glossary.md` existe com vocabulário canônico bilíngue PT-BR↔EN (event, span, trace, SLI, SLO, error budget, burn rate, OMM, cardinalidade, dimensionalidade), comandos canônicos (OTel CLI, otelcol, queries Logflare equivalentes) e seção explícita de anti-patterns (dashboard-flipping, cause-based alerts, fixed-window error budgets); NÃO listado como skill em `listKit` (precedente: `_shared-supabase/glossary.md`)
2. As 4 skills SKFD existem em `kit/skills/{structured-events,distributed-tracing,opentelemetry-standard,core-analysis-loop}/SKILL.md` com frontmatter válido (`name`, `description ≤ 200 chars`); cada uma é auto-contida — LLM gera workflow completo sem ler outra skill (cross-refs apenas em "Ver também" no fim)
3. `structured-events` documenta wide events (1/request, alta cardinalidade, propriedades úteis em debug) com exemplos de campos canônicos PT-BR (`user.id`, `tenant_id`, `request.id`, `result.success`, `error.type`, `duration_ms`, `build_id`); `distributed-tracing` documenta trace_id/span_id/parent_id, W3C TraceContext header, propagação cross-service, stitching de spans, casos não-RPC (batch, lambda, S3 upload); `opentelemetry-standard` documenta API/SDK/Tracer/Meter/Context propagation/Exporter/Collector + OTLP, com exemplo Deno (Edge Function) e Node; `core-analysis-loop` documenta as 4 fases iterativas (algo está errado → hipótese → validação com dados → próxima iteração), debug from first principles, contraste com debug-by-intuition
4. `kit sync claude-code --project-root <tmpdir>` rodado 2× produz `.claude/skills/{structured-events,distributed-tracing,opentelemetry-standard,core-analysis-loop}` byte-idêntico (idempotência)
5. CLAUDE.md gerado cresce ≤ +0.8 KB após Phase 29 (description budget enforcement — anti-pitfall A2 herdado)

**Estimativa:** ~10-14h. Cada skill ~2h em média; glossário ~2h; core-analysis-loop pode requerer pesquisa adicional do livro durante /planejar-fase.

---

### Phase 30: Agentes core + comandos críticos + skill ODD

**Tipo:** Conteúdo editorial — agentes (Markdown com frontmatter complexo) + comandos com dispatch + skill prática
**Por que segundo:** Com skills foundationais da Phase 29 no lugar, agentes podem cross-referenciar via Markdown link. `observability-instrumenter` consome `structured-events` + `opentelemetry-standard` + `distributed-tracing`; `incident-investigator` consome `core-analysis-loop` + `mcp__supabase__get_logs`/`execute_sql`/`get_advisors`. Skill `observability-driven-development` é dependência do CMD-01 (`/instrumentar-fase`).

**Dependência:** Phase 29 concluída (skills SKFD existem para cross-reference).

**REQs cobertos (5):** SKPR-01, AGCORE-01, AGCORE-02, CMD-01, CMD-03

**Critérios de sucesso:**
1. Skill `kit/skills/observability-driven-development/SKILL.md` existe com as 4 perguntas pré-PR canônicas ("Faz o que esperei? Compara à versão anterior? Usuários usam? Anomalias?"), padrão "auto-page autor 30-60min após merge", frontmatter válido (`description ≤ 200 chars`)
2. Agente `kit/agents/observability-instrumenter.md` existe com tabela "Compatibilidade IDE", recebe caminho de código + endpoints, retorna patches com OTel spans + atributos canônicos consultando `structured-events`+`opentelemetry-standard`+`distributed-tracing`; frontmatter `tools` lista nomes canônicos (zero UUIDs)
3. Agente `kit/agents/incident-investigator.md` existe com preflight MCP no Step 0 (declara MODO OFFLINE explicitamente se `mcp__supabase__*` indisponível), aplica Core Analysis Loop usando `mcp__supabase__get_logs`/`execute_sql`/`get_advisors`, mantém estado iterativo de hipóteses validadas/refutadas em arquivo `.planning/investigations/<id>.md` (precedente: `/depurar`)
4. Comando `kit/commands/instrumentar-fase.md` existe — após `/planejar-fase`, gera `INSTRUMENTATION.md` por plano (spans, atributos, eventos, logs estruturados); chama `plan-checker` que bloqueia se as 4 perguntas do ODD ausentes (gate efetivo na Phase 33 — INT-FW-02 — mas hook de plan-checker já preparado aqui)
5. Comando `kit/commands/investigar-producao.md` existe — Core Analysis Loop guiado com estado persistente entre resets de contexto (precedente: `/depurar`); dispatch via `Task(subagent_type=incident-investigator)`
6. Smoke test: invocar cada agente em fixture sintético (Claude Code + Supabase MCP live) — produz output coerente com Core Analysis Loop estruturado; offline mode nos demais IDEs sem MCP

**Estimativa:** ~10-12h. `incident-investigator` é o mais complexo (lógica iterativa de hipóteses + integração MCP + persistência); restante segue padrão maduro.

---

### Phase 31: Integração Suíte Supabase — patches nos 7 agentes existentes

**Tipo:** Edição cirúrgica em conteúdo existente — 7 agentes Supabase recebem cross-refs para skills novas
**Por que terceiro:** Esta é a entrega-chave da Onda 1: a Suíte Supabase v1.8 é o maior beneficiário de v1.9. Cada agente Supabase passa a "saber" sobre observabilidade canônica. Patches são pequenos (cross-refs em "Ver também" + 1 parágrafo "instrumentação default") mas efeito é multiplicativo — todos workflows Supabase ganham observabilidade by default.

**Dependência:** Phases 29 e 30 concluídas (skills foundationais + ODD + agentes core existem para cross-reference).

**REQs cobertos (7):** INT-SB-01, INT-SB-02, INT-SB-03, INT-SB-04, INT-SB-05, INT-SB-06, INT-SB-07

**Critérios de sucesso:**
1. `kit/agents/supabase-architect.md` ganha cross-ref para `event-based-slos` + `observability-driven-development` + `observability-maturity-model` no fluxo de design — plano de schema nasce com SLI tables e audit hooks (placeholder até `event-based-slos` aterrissar na Phase 32; documentação cita skill por nome canônico, link Markdown ativa quando skill existe)
2. `kit/agents/supabase-migration-writer.md` consulta `structured-events` + `observability-driven-development` — toda migration emite `migration_event` (sequencial, idempotência, autor, timestamp); triggers de audit por default em tabelas sensíveis declaradas pelo arquiteto
3. `kit/agents/supabase-rls-writer.md` consulta `structured-events` + `core-analysis-loop` — RLS deny gera log estruturado com `policy_name`/`attempted_op`/`user.id`/`tenant.id` para investigação posterior via `incident-investigator`
4. `kit/agents/supabase-edge-fn-writer.md` consulta `opentelemetry-standard` + `distributed-tracing` + `telemetry-sampling` (placeholder Onda 3) + `structured-events` — funções com OTel SDK Deno, spans por handler, sampling head-based
5. `kit/agents/supabase-realtime-implementer.md` consulta `distributed-tracing` + `structured-events` — broadcast/postgres_changes carregam trace context para stitching cross-service
6. `kit/agents/supabase-auth-bootstrapper.md` consulta `structured-events` + `event-based-slos` (placeholder Onda 2) — auth events estruturados (`auth.attempt`, `auth.success`, `auth.failure`) + SLO de "successful login %"
7. `kit/agents/supabase-storage-implementer.md` consulta `structured-events` + `telemetry-sampling` — upload events com `bucket`/`size_bytes`/`mime`/`duration_ms`/`result`
8. Smoke test pós-patch: `kit sync claude-code` produz cada agente atualizado byte-idêntico em 2× consecutivos (idempotência); cross-refs com `[link](../skills/...)` Markdown válidos (lints passam) — placeholders documentados em comentários HTML para skills ainda não criadas (Onda 2/3)

**Estimativa:** ~6-8h. 7 patches × ~45-60min cada (cross-ref + 1 parágrafo "instrumentação default" + smoke test). Trabalho mecânico mas exige cuidado com placeholders para skills Onda 2/3.

---

## Onda 2 — SLO/Reliability (Phases 32-33)

> Skills SLO + agentes SLO + integração com fluxo framework. Habilita observabilidade ativa (alertas burn rate, error budget) e fecha gates do framework com ODD.

### Phase 32: Skills SLO + agentes SLO + comandos `/definir-slo` e `/burn-rate-status`

**Tipo:** Conteúdo editorial — skills SKPR + agentes AGCORE + comandos CMD
**Por que primeiro na onda 2:** Skills `event-based-slos` e `burn-rate-alerting` são consultadas pelos agentes `slo-engineer` e `burn-rate-forecaster`. Comandos `/definir-slo` e `/burn-rate-status` dispatch para esses agentes.

**Dependência:** Phase 29 (skills foundationais — `structured-events` é base de SLI event-based) e Phase 30 (precedente de agente que produz Markdown + SQL).

**REQs cobertos (6):** SKPR-02, SKPR-03, AGCORE-03, AGCORE-04, CMD-02, CMD-04

**Critérios de sucesso:**
1. Skill `kit/skills/event-based-slos/SKILL.md` documenta SLI event-based vs time-based, sliding window vs fixed window, decouple "what" do "why"; frontmatter válido; auto-contida
2. Skill `kit/skills/burn-rate-alerting/SKILL.md` documenta lookahead/baseline windows (fator 4×), context-aware vs short-term burn alerts, fórmulas de extrapolação; auto-contida
3. Agente `kit/agents/slo-engineer.md` existe com preflight MCP, gera `SLO.md` + SQL para materializar contagem good/bad events em view/MV no Postgres (consulta `event-based-slos`); frontmatter `tools` lista `mcp__supabase__execute_sql` / `mcp__supabase__list_tables`
4. Agente `kit/agents/burn-rate-forecaster.md` existe com preflight MCP, calcula burn rate atual / ETA exhaustão / alert config (page vs ticket) usando lookahead/baseline windows; frontmatter `tools` lista `mcp__supabase__execute_sql`
5. Comando `kit/commands/definir-slo.md` existe — invoca `slo-engineer` via `Task`, gera `SLO.md` (SLI/target/sliding window/owner) + SQL para Postgres; aceita arg `--service <nome>`
6. Comando `kit/commands/burn-rate-status.md` existe — tabela formato `[SLO | % gasto | ETA exhaustão | ação]`, rodável manualmente ou em `/loop`; dispatch via `Task(subagent_type=burn-rate-forecaster)`
7. Smoke test: `/definir-slo --service auth` em fixture com Supabase MCP live produz `SLO.md` + SQL idempotente; `/burn-rate-status` em fixture com SLI tables existentes retorna tabela coerente

**Estimativa:** ~10-12h. Agentes SQL-heavy (geração de view/MV) requerem cuidado; restante segue padrão maduro.

---

### Phase 33: Integração com fluxo framework — discutir-fase, planejar-fase, verificar-trabalho, forense

**Tipo:** Edição cirúrgica em comandos framework existentes
**Por que segundo na onda 2:** Com skill `observability-driven-development` (Phase 30) e skills SLO (Phase 32) no lugar, gates do framework podem ser ativados sem dead-end. `/discutir-fase` ganha pergunta sobre instrumentação; `/planejar-fase` bloqueia se ODD ausente; `/verificar-trabalho` roda Core Analysis Loop sobre logs reais; `/forense` usa `core-analysis-loop` em vez de inspeção ad-hoc de git.

**Dependência:** Phases 29, 30 e 32 concluídas (skills + agente `incident-investigator` existem).

**REQs cobertos (4):** INT-FW-01, INT-FW-02, INT-FW-03, INT-FW-06

**Critérios de sucesso:**
1. `kit/commands/discutir-fase.md` ganha pergunta canônica sobre instrumentação ("Quais SLIs essa fase impacta? O que precisa ser instrumentado? Quais wide events de alta cardinalidade?") usando skill `observability-driven-development` — pergunta não-bloqueante (informativa); gravada em saída do `/discutir-fase`
2. `kit/commands/planejar-fase.md` chama `plan-checker` que bloqueia se a fase não responder às 4 perguntas do ODD (faz o que esperei? compara à versão anterior? usuários usam? anomalias?); bloqueio é gate FAIL → user precisa rodar `/instrumentar-fase` ou justificar exceção via flag `--skip-odd <motivo>` (precedente: gates Supabase v1.8)
3. `kit/commands/verificar-trabalho.md` invoca `incident-investigator` via `Task` para rodar Core Analysis Loop sobre logs reais (consulta `mcp__supabase__get_logs`) e validar UAT — UAT não passa se logs não confirmam comportamento esperado (não basta "código existe")
4. `kit/commands/forense.md` usa skill `core-analysis-loop` em vez de inspeção ad-hoc de git — substitui prompts manuais por referência canônica à skill (DRY); mantém compatibilidade com fluxo existente
5. Smoke test E2E: rodar `/discutir-fase` em fase fictícia → ver pergunta de instrumentação; rodar `/planejar-fase` sem responder às 4 perguntas ODD → ver gate BLOCK; rodar `/verificar-trabalho` em fase com logs reais → ver Core Analysis Loop estruturado; rodar `/forense` em incidente fixture → ver fases canônicas do loop

**Estimativa:** ~6-8h. Edições cirúrgicas, mas precisam coordenação entre 4 comandos framework + plan-checker.

---

## Onda 3 — Escala e cultura (Phases 34-35)

> Skills de escala (sampling, pipelines, OMM) + agente OMM + comando orquestrador único + gates auditorias OMM no fluxo + QA + docs.

### Phase 34: Skills escala + Maturity Model + agente OMM + comandos `/auditar-observabilidade` e `/observabilidade`

**Tipo:** Conteúdo editorial — 3 skills SKPR + agente AGCORE + 2 comandos CMD (1 orquestrador)
**Por que primeiro na onda 3:** Skills `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model` são as últimas SKPR. Agente `omm-auditor` consome `observability-maturity-model`. Comando orquestrador `/observabilidade` faz dispatch para todos agentes/subcomandos das ondas anteriores (análogo a `/supabase`).

**Dependência:** Phases 29-33 concluídas (todas skills + agentes + comandos individuais existem para o orquestrador despachar).

**REQs cobertos (6):** SKPR-04, SKPR-05, SKPR-06, AGCORE-05, CMD-05, CMD-06

**Critérios de sucesso:**
1. Skill `kit/skills/telemetry-sampling/SKILL.md` documenta head/tail sampling, by-key, dynamic, trade-offs (constant probability falha em low volume; sample errors > success); auto-contida
2. Skill `kit/skills/telemetry-pipelines/SKILL.md` documenta routing, buffering, filtering, security/compliance, build-vs-buy; auto-contida
3. Skill `kit/skills/observability-maturity-model/SKILL.md` documenta as 5 capacidades (resiliência, qualidade de código, complexidade/dívida técnica, cadência de release, comportamento de usuário) com sintomas "doing well/poorly" por capacidade; rubrica de pontuação 1-5 por capacidade
4. Agente `kit/agents/omm-auditor.md` existe — pontua projeto contra OMM 5 capacidades (1-5) com gaps acionáveis e plano de melhoria; gera `OMM-REPORT.md` (output canônico salvo em `.planning/milestones/v<X.Y>/OMM-REPORT.md`)
5. Comando `kit/commands/auditar-observabilidade.md` existe — invoca `omm-auditor` via `Task`, gera `OMM-REPORT.md` scored com tabela 5×5 (capacidade × evidência) + ações recomendadas
6. Comando orquestrador `kit/commands/observabilidade.md` existe — análogo a `/supabase`, frontmatter `allowed-tools` inclui `Task` + `AskUserQuestion`, dispatch via `Task(subagent_type=...)` para subcomandos com sinônimos PT-BR/EN: `instrumentar|instrument`, `slo|definir-slo|define-slo`, `investigar|investigate`, `burn-rate|status`, `auditar|audit`, `omm`
7. Smoke test: `/observabilidade auditar` em fixture produz dispatch correto para `omm-auditor`; smoke do orquestrador em ≥4 IDEs (Claude Code + Cursor + Codex + Gemini) — live mode em Claude Code/Cursor com Supabase MCP, offline mode nos demais

**Estimativa:** ~10-12h. Skill OMM (rubrica 5 capacidades) é a mais densa; orquestrador segue padrão `/supabase` com precedente direto.

---

### Phase 35: Gates OMM no fluxo framework + QA cross-IDE + docs

**Tipo:** Edição cirúrgica em comandos framework + 3 audit gates JS + README cross-IDE
**Por que último:** Gates auditam todo conteúdo de v1.9 + integração final com `/auditar-marco` e `/concluir-marco`. README é a entrega de docs. Roda contra produto montado nas Phases 29-34.

**Dependência:** Phases 29-34 concluídas (todos skills + agentes + comandos existem; gates auditam o conjunto completo).

**REQs cobertos (6):** INT-FW-04, INT-FW-05, QA-01, QA-02, QA-03, QA-04

**Critérios de sucesso:**
1. `kit/commands/auditar-marco.md` ganha passo "OMM scored" antes de assinar — invoca `omm-auditor` via `Task`, exige report ≥3 médio em todas 5 capacidades (ou justificativa explícita de exceção); INT-FW-04
2. `kit/commands/concluir-marco.md` bloqueia se OMM regrediu numa capacidade vs marco anterior — compara `OMM-REPORT.md` atual contra `.planning/milestones/v<X.Y-1>/OMM-REPORT.md`; gera `OMM-REPORT.md` no archive do milestone atual; INT-FW-05
3. **3 audit gates** existem em `gates/` e rodam verde no CI (zero deps novas; JS puro; ~50-100 LOC cada):
   - `obs-skills-frontmatter.mjs` — verifica que toda skill `kit/skills/*observability*/SKILL.md` segue template canônico (5 seções, frontmatter completo: `name`, `description ≤ 200 chars`, seção `## Quando usar`, `## Como aplicar`, `## Exemplos`, `## Anti-patterns`, `## Ver também`); QA-01
   - `obs-agents-mcp-supabase.mjs` — verifica que `incident-investigator` + `slo-engineer` + `burn-rate-forecaster` declaram `mcp__supabase__*` em frontmatter `tools` (zero UUIDs); QA-02
   - `omm-no-regression.mjs` — rodável em `/concluir-marco` (e CI quando `.planning/milestones/v<X.Y-1>/OMM-REPORT.md` existe); verifica que nenhuma das 5 capacidades OMM regrediu vs marco anterior; QA-03
4. README do kit ganha seção "Observabilidade" listando skills/agentes/comandos novos com exemplo de uso (`/observabilidade instrumentar <fase>`, `/observabilidade slo --service auth`, `/observabilidade investigar`, `/auditar-observabilidade`); QA-04
5. Smoke test E2E cross-IDE: sync para 8 IDE targets (claude-code, cursor, codex, gemini, windsurf, antigravity, copilot, trae) — cada um produz arquivos esperados em layout nativo sem erros; smoke real em ≥4 IDEs invocando `/observabilidade` (live mode em Claude Code/Cursor com MCP; offline mode nos demais)
6. CHANGELOG.md tem seção `## [1.9.0]` documentando: Camada de Observabilidade (11 skills, 5 agentes, 6 comandos), 3 audit gates novos, integração com Suíte Supabase v1.8 (7 agentes patcheados), gates ODD/OMM no fluxo framework
7. STATE.md, MILESTONES.md, ROADMAP.md atualizados; `wc -c CLAUDE.md` ≤ 13.5 KB total após v1.9 (anti-pitfall A2 herdado — CLAUDE.md inflation budget); `gates/deps-budget.mjs` continua verde (6/6 — zero deps novas em v1.9 — anti-pitfall A9 herdado)

**Estimativa:** ~6-8h. Gates são curtos mas precisam de testes; smoke cross-IDE é tempo de setup × 4 IDEs; README ~1h.

---

## Resumo da cobertura de REQs

| Onda | Phase | REQs cobertos | Total |
|------|-------|---------------|-------|
| 1 — Núcleo | 29 | GLOS-01, GLOS-02, GLOS-03, SKFD-01, SKFD-02, SKFD-03, SKFD-04 | 7 |
| 1 — Núcleo | 30 | SKPR-01, AGCORE-01, AGCORE-02, CMD-01, CMD-03 | 5 |
| 1 — Núcleo | 31 | INT-SB-01, INT-SB-02, INT-SB-03, INT-SB-04, INT-SB-05, INT-SB-06, INT-SB-07 | 7 |
| 2 — SLO/Reliability | 32 | SKPR-02, SKPR-03, AGCORE-03, AGCORE-04, CMD-02, CMD-04 | 6 |
| 2 — SLO/Reliability | 33 | INT-FW-01, INT-FW-02, INT-FW-03, INT-FW-06 | 4 |
| 3 — Escala e cultura | 34 | SKPR-04, SKPR-05, SKPR-06, AGCORE-05, CMD-05, CMD-06 | 6 |
| 3 — Escala e cultura | 35 | INT-FW-04, INT-FW-05, QA-01, QA-02, QA-03, QA-04 | 6 |
| **Total** | **7 fases** | **41 REQs** | **41** |

**Cobertura:** 41/41 REQs (100%) — cada REQ mapeado para exatamente uma fase.

---

## Dependências entre fases

```
Phase 29 (skills foundationais)
  ↓
Phase 30 (agentes core + ODD)
  ↓
Phase 31 (patches Suíte Supabase)
  ↓
Phase 32 (skills SLO + agentes SLO)
  ↓
Phase 33 (integração fluxo framework)
  ↓
Phase 34 (skills escala + OMM + orquestrador)
  ↓
Phase 35 (gates OMM no fluxo + QA + docs)
```

**Cadeia linear** — cada fase depende da anterior. Paralelização possível dentro de uma fase (ex.: Phase 29 escreve 4 skills + glossário em paralelo), mas fases não se sobrepõem.

---

## Estimativa total

~58-74h de trabalho efetivo (média ~66h) distribuídos em 7 fases. Comparável a v1.8 (~50-60h em 4 fases mas com 31 REQs vs 41 aqui).
