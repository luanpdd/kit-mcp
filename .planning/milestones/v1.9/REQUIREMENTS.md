# Requisitos: kit-mcp v1.9 Observabilidade

**Definidos:** 2026-05-06
**Valor Central:** Equipar usuários do kit-mcp com expertise canônica em observabilidade derivada do livro *Observability Engineering* (Charity Majors, Liz Fong-Jones, George Miranda — O'Reilly, 2022), aproveitada de forma profunda pela Suíte Supabase para potencializar `mcp__supabase__get_logs`/`execute_sql`/`get_advisors`.

**Material-fonte:** *Observability Engineering* (978-1-492-07644-5). Mapa cap → artefato em `.planning/PROJECT.md`.

## Requisitos v1

Cada requisito mapeia para exatamente uma fase do roadmap. Convenção REQ-ID: `[CATEGORIA]-[NN]`.

### Glossário (GLOS)

- [ ] **GLOS-01**: Skill `_shared-observability/glossary.md` define vocabulário canônico bilíngue (PT-BR↔EN) para event, span, trace, SLI, SLO, error budget, burn rate, OMM, cardinalidade, dimensionalidade
- [ ] **GLOS-02**: Glossário lista comandos canônicos (OTel CLI, otelcol, queries Logflare equivalentes) consultáveis pelos agentes downstream
- [ ] **GLOS-03**: Glossário declara anti-patterns explícitos (ex.: dashboard-flipping, cause-based alerts, fixed-window error budgets)

### Skills Foundationais (SKFD)

- [ ] **SKFD-01**: Skill `structured-events` documenta wide events (1/request, alta cardinalidade, propriedades úteis em debug) com exemplos PT-BR de campos canônicos (`user.id`, `tenant_id`, `request.id`, `result.success`, `error.type`, `duration_ms`, `build_id`)
- [ ] **SKFD-02**: Skill `distributed-tracing` documenta trace_id/span_id/parent_id, W3C TraceContext header, propagação cross-service, stitching de spans, casos não-RPC (batch, lambda, S3 upload)
- [ ] **SKFD-03**: Skill `opentelemetry-standard` documenta API/SDK/Tracer/Meter/Context propagation/Exporter/Collector + OTLP, com exemplo Deno (Edge Function) e Node
- [ ] **SKFD-04**: Skill `core-analysis-loop` documenta as 4 fases iterativas (algo está errado → hipótese → validação com dados → próxima iteração), debug from first principles, contraste com debug-by-intuition

### Skills Práticas (SKPR)

- [ ] **SKPR-01**: Skill `observability-driven-development` documenta as 4 perguntas pré-PR (faz o que esperei? compara à versão anterior? usuários usam? anomalias?), padrão "auto-page autor 30-60min após merge"
- [ ] **SKPR-02**: Skill `event-based-slos` documenta SLI event-based vs time-based, sliding window vs fixed window, decouple "what" do "why"
- [ ] **SKPR-03**: Skill `burn-rate-alerting` documenta lookahead/baseline windows (fator 4×), context-aware vs short-term burn alerts, fórmulas de extrapolação
- [ ] **SKPR-04**: Skill `telemetry-sampling` documenta head/tail sampling, by-key, dynamic, trade-offs (constant probability falha em low volume; sample errors > success)
- [ ] **SKPR-05**: Skill `telemetry-pipelines` documenta routing, buffering, filtering, security/compliance, build-vs-buy
- [ ] **SKPR-06**: Skill `observability-maturity-model` documenta as 5 capacidades (resiliência, qualidade de código, complexidade/dívida técnica, cadência de release, comportamento de usuário) com sintomas "doing well/poorly" por capacidade

### Agentes Core (AGCORE)

- [ ] **AGCORE-01**: Agente `observability-instrumenter` — recebe caminho de código e endpoints, retorna patches com OTel spans + atributos canônicos (consulta `structured-events`, `opentelemetry-standard`, `distributed-tracing`)
- [ ] **AGCORE-02**: Agente `incident-investigator` — aplica Core Analysis Loop usando `mcp__supabase__get_logs`/`execute_sql`/`get_advisors`, mantém estado iterativo de hipóteses validadas/refutadas
- [ ] **AGCORE-03**: Agente `slo-engineer` — gera `SLO.md` + SQL para materializar contagem good/bad events em view/MV no Postgres (consulta `event-based-slos`)
- [ ] **AGCORE-04**: Agente `burn-rate-forecaster` — calcula burn rate atual, ETA exhaustão, alert config (page vs ticket) usando lookahead/baseline windows
- [ ] **AGCORE-05**: Agente `omm-auditor` — pontua projeto contra OMM 5 capacidades (1-5) com gaps acionáveis e plano de melhoria

### Comandos (CMD)

- [ ] **CMD-01**: Comando `/instrumentar-fase` — após `/planejar-fase`, gera `INSTRUMENTATION.md` por plano (spans, atributos, eventos, logs estruturados); plan-checker bloqueia se ODD ausente
- [ ] **CMD-02**: Comando `/definir-slo` — invoca `slo-engineer`, gera `SLO.md` com SLI/target/sliding window/owner + SQL para Postgres
- [ ] **CMD-03**: Comando `/investigar-producao` — Core Analysis Loop guiado com estado persistente entre resets de contexto (similar a `/depurar`)
- [ ] **CMD-04**: Comando `/burn-rate-status` — tabela formato `[SLO | % gasto | ETA exhaustão | ação]`, rodável manualmente ou em `/loop`
- [ ] **CMD-05**: Comando `/auditar-observabilidade` — invoca `omm-auditor`, gera `OMM-REPORT.md` scored
- [ ] **CMD-06**: Comando orquestrador `/observabilidade [subcomando]` — análogo a `/supabase`, dispatch via `Task(subagent_type=...)` com sinônimos PT/EN

### Integração Suíte Supabase (INT-SB)

- [ ] **INT-SB-01**: `supabase-architect` consulta `event-based-slos` + `observability-driven-development` + `observability-maturity-model` — plano de schema nasce com SLI tables e audit hooks
- [ ] **INT-SB-02**: `supabase-migration-writer` consulta `structured-events` + `observability-driven-development` — toda migration emite migration_event; triggers de audit por default em tabelas sensíveis
- [ ] **INT-SB-03**: `supabase-rls-writer` consulta `structured-events` + `core-analysis-loop` — RLS deny → log estruturado com policy_name/attempted_op/user.id/tenant.id
- [ ] **INT-SB-04**: `supabase-edge-fn-writer` consulta `opentelemetry-standard` + `distributed-tracing` + `telemetry-sampling` + `structured-events` — funções com OTel SDK, spans por handler, sampling head-based
- [ ] **INT-SB-05**: `supabase-realtime-implementer` consulta `distributed-tracing` + `structured-events` — broadcast/postgres_changes carregam trace context para stitching
- [ ] **INT-SB-06**: `supabase-auth-bootstrapper` consulta `structured-events` + `event-based-slos` — auth events estruturados + SLO de "successful login %"
- [ ] **INT-SB-07**: `supabase-storage-implementer` consulta `structured-events` + `telemetry-sampling` — upload events com bucket/size_bytes/mime/duration_ms/result

### Integração Fluxo Framework (INT-FW)

- [ ] **INT-FW-01**: `/discutir-fase` ganha pergunta sobre instrumentação ("Quais SLIs essa fase impacta? O que precisa ser instrumentado?") usando skill `observability-driven-development`
- [ ] **INT-FW-02**: `/planejar-fase` chama `plan-checker` que bloqueia se a fase não responder às 4 perguntas do ODD
- [ ] **INT-FW-03**: `/verificar-trabalho` roda Core Analysis Loop sobre logs reais via `incident-investigator` para validar UAT (não só código existe)
- [ ] **INT-FW-04**: `/auditar-marco` inclui passo OMM scored (5 capacidades) antes de assinar
- [ ] **INT-FW-05**: `/concluir-marco` bloqueia se OMM regrediu numa capacidade; gera `OMM-REPORT.md` no archive
- [ ] **INT-FW-06**: `/forense` usa skill `core-analysis-loop` em vez de inspeção ad-hoc de git

### Qualidade e Audit (QA)

- [ ] **QA-01**: Audit gate `obs-skills-frontmatter` verifica que toda skill `kit/skills/*observability*/SKILL.md` segue template canônico (5 seções, frontmatter completo)
- [ ] **QA-02**: Audit gate `obs-agents-mcp-supabase` verifica que `incident-investigator` + `slo-engineer` + `burn-rate-forecaster` declaram `mcp__supabase__*` em frontmatter `tools`
- [ ] **QA-03**: Audit gate `omm-no-regression` (rodável em `/concluir-marco`) verifica que nenhuma das 5 capacidades OMM regrediu vs marco anterior
- [ ] **QA-04**: README do kit ganha seção "Observabilidade" listando skills/agentes/comandos novos com exemplo de uso

## Requisitos v2

Diferidos para milestone futuro.

### Telemetry Avançado

- **TA-01**: Agente `telemetry-sampler` — config de sampling por endpoint (head/tail/dynamic) com export em código + JSON
- **TA-02**: Agente `telemetry-pipeline-architect` — config de OTel Collector com routing por tenant/severity
- **TA-03**: Skill `business-observability` — usar dados de observabilidade para sales/product/customer success (cap 20)

### Tooling

- **TL-01**: Comando `/observabilidade dashboard` — gera dashboard SQL views consumível por Logflare/Grafana
- **TL-02**: Hook PostToolUse que materializa SLI events em tempo real durante `/executar-fase`

## Fora do Escopo

| Funcionalidade | Motivo |
|----------------|--------|
| Backend de telemetria próprio (Honeycomb/Datadog/etc.) | Vendor-neutral; usar OTel + Logflare/qualquer destino |
| AIOps / ML para alertas | Livro explicitamente alerta contra (cap 8 — "The Misleading Promise of AIOps") |
| Profilers / line-level debugging | Livro distingue: observability ≠ debugger (cap 11 — "Determining Where to Debug") |
| Replicar SRE workbook completo | Foco é o livro Observability Engineering; SRE workbook é referência cruzada apenas |
| Integração com APMs proprietários | Stable API v1.0+ — só adições; APMs ficam como exemplos no glossário |

## Rastreabilidade

Preenchida pelo roadmapper em 2026-05-06. 41 REQs mapeados para 7 fases (29-35) em 3 ondas.

| Requisito | Fase | Status |
|-----------|------|--------|
| GLOS-01 | Phase 29 | Pending |
| GLOS-02 | Phase 29 | Pending |
| GLOS-03 | Phase 29 | Pending |
| SKFD-01 | Phase 29 | Pending |
| SKFD-02 | Phase 29 | Pending |
| SKFD-03 | Phase 29 | Pending |
| SKFD-04 | Phase 29 | Pending |
| SKPR-01 | Phase 30 | Pending |
| SKPR-02 | Phase 32 | Pending |
| SKPR-03 | Phase 32 | Pending |
| SKPR-04 | Phase 34 | Pending |
| SKPR-05 | Phase 34 | Pending |
| SKPR-06 | Phase 34 | Pending |
| AGCORE-01 | Phase 30 | Pending |
| AGCORE-02 | Phase 30 | Pending |
| AGCORE-03 | Phase 32 | Pending |
| AGCORE-04 | Phase 32 | Pending |
| AGCORE-05 | Phase 34 | Pending |
| CMD-01 | Phase 30 | Pending |
| CMD-02 | Phase 32 | Pending |
| CMD-03 | Phase 30 | Pending |
| CMD-04 | Phase 32 | Pending |
| CMD-05 | Phase 34 | Pending |
| CMD-06 | Phase 34 | Pending |
| INT-SB-01 | Phase 31 | Pending |
| INT-SB-02 | Phase 31 | Pending |
| INT-SB-03 | Phase 31 | Pending |
| INT-SB-04 | Phase 31 | Pending |
| INT-SB-05 | Phase 31 | Pending |
| INT-SB-06 | Phase 31 | Pending |
| INT-SB-07 | Phase 31 | Pending |
| INT-FW-01 | Phase 33 | Pending |
| INT-FW-02 | Phase 33 | Pending |
| INT-FW-03 | Phase 33 | Pending |
| INT-FW-04 | Phase 35 | Pending |
| INT-FW-05 | Phase 35 | Pending |
| INT-FW-06 | Phase 33 | Pending |
| QA-01 | Phase 35 | Pending |
| QA-02 | Phase 35 | Pending |
| QA-03 | Phase 35 | Pending |
| QA-04 | Phase 35 | Pending |

**Cobertura:**
- Requisitos v1: 41 total
- Mapeados para fases: 41 (100%)
- Não mapeados: 0
- Distribuição por fase: Phase 29 (7), Phase 30 (5), Phase 31 (7), Phase 32 (6), Phase 33 (4), Phase 34 (6), Phase 35 (6) = 41

**Distribuição por onda:**
- Onda 1 — Núcleo (Phases 29-31): 19 REQs
- Onda 2 — SLO/Reliability (Phases 32-33): 10 REQs
- Onda 3 — Escala e cultura (Phases 34-35): 12 REQs

---
*Requisitos definidos: 2026-05-06*
*Última atualização: 2026-05-06 — rastreabilidade preenchida pelo roadmapper (41/41 mapeados para Phases 29-35)*
