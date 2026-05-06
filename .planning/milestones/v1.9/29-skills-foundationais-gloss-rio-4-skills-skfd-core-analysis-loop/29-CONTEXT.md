# Fase 29: Skills foundationais — glossário + 4 skills SKFD + core-analysis-loop - Contexto

**Coletado:** 2026-05-06
**Status:** Pronto para planejamento
**Modo:** Auto-gerado (discuss pulado via workflow.skip_discuss=true)

<domain>
## Limite da Fase

Escrever 5 artefatos de skills canônicas em `kit/skills/`:
1. `kit/skills/_shared-observability/glossary.md` — glossário bilíngue PT-BR↔EN com vocabulário, comandos canônicos e anti-patterns
2. `kit/skills/structured-events/SKILL.md` — wide events de alta cardinalidade
3. `kit/skills/distributed-tracing/SKILL.md` — trace_id/span_id, W3C TraceContext, stitching
4. `kit/skills/opentelemetry-standard/SKILL.md` — OTel SDK/Tracer/Meter/Exporter/OTLP
5. `kit/skills/core-analysis-loop/SKILL.md` — debug iterativo from first principles

REQs: GLOS-01, GLOS-02, GLOS-03, SKFD-01, SKFD-02, SKFD-03, SKFD-04 (7 REQs).

</domain>

<decisions>
## Decisões de Implementação

### Discrição do Claude
Todas as escolhas de implementação são de discrição do Claude — fase de discuss pulada por configuração do usuário. Use o objetivo da fase no ROADMAP, critérios de sucesso e convenções da base de código (ver `kit/skills/supabase-*/SKILL.md` como precedente para template das 5 seções) para guiar decisões.

### Padrões herdados (precedente v1.8)
- **Template de skill:** 5 seções fixas — `## What it is`, `## When to use`, `## Step-by-step`, `## Anti-patterns`, `## Verification`
- **Frontmatter:** `name`, `description ≤ 200 chars`
- **Code blocks:** EN com comentários PT-BR
- **Glossário compartilhado:** padrão `_shared-{topic}/glossary.md` (não listado em listKit)
- **Cross-refs:** apenas em "Ver também" no final, skill auto-contida no resto
- **Anti-pitfall A2:** `description` ≤ 200 chars enforçado por gate `budget-description`

### Material-fonte
Livro *Observability Engineering* (Charity Majors, Liz Fong-Jones, George Miranda — O'Reilly, 2022, 978-1-492-07644-5):
- Cap 1: definição de observabilidade (cardinalidade + dimensionalidade)
- Cap 5: structured events (1 evento/request, wide, alta cardinalidade)
- Cap 6: distributed tracing (trace/span/parent, stitching, casos não-RPC)
- Cap 7: OpenTelemetry (API/SDK/Tracer/Meter/Exporter/Collector/OTLP)
- Cap 8: Core Analysis Loop (4 fases iterativas, debug from first principles)

</decisions>

<code_context>
## Insights do Código Existente

### Ativos Reutilizáveis
- `kit/skills/_shared-supabase/glossary.md` — precedente para padrão de glossário compartilhado (não listado em listKit)
- `kit/skills/supabase-realtime/SKILL.md`, `supabase-edge-functions/SKILL.md`, `supabase-rls-policies/SKILL.md`, etc. — precedentes de skills v1.8 com template fixo
- `gates/budget-description` — audit gate enforça `description ≤ 200 chars`
- `gates/skill-must-include` — enforça que skills têm seções obrigatórias

### Padrões Estabelecidos
- Skills em `kit/skills/<name>/SKILL.md` com frontmatter YAML
- Glossários em `kit/skills/_shared-<topic>/glossary.md` (não viram skills do listKit)
- Idempotência sync: rodar `kit sync claude-code` 2× produz output byte-idêntico
- PT-BR no texto narrativo, EN nos code blocks com comentários PT-BR

### Pontos de Integração
- Próxima fase (30) consultará estas skills via cross-reference Markdown
- Suíte Supabase (Phase 31) será patcheada para consultar essas skills

</code_context>

<specifics>
## Ideias Específicas

### Campos canônicos para `structured-events`
Padrão para nomes de atributos que aparece em todos os exemplos PT-BR do kit:
- `user.id` (não `userId` ou `user_id` — usar dot notation OTel)
- `tenant_id` (snake_case quando representa coluna de DB)
- `request.id` (UUID v4 propagado via header `x-request-id`)
- `result.success` (boolean — divergente de `result.error_type` que é string)
- `error.type` (categoria de erro: `timeout`, `validation`, `auth`, `rate_limit`)
- `duration_ms` (integer — milissegundos sempre)
- `build_id` (commit SHA short ou tag de release)

### W3C TraceContext header (para `distributed-tracing`)
Header padrão: `traceparent: 00-{trace_id}-{span_id}-{flags}`
- `trace_id`: 32 hex chars (16 bytes)
- `span_id`: 16 hex chars (8 bytes)
- `flags`: 2 hex chars (sampled flag em bit 0)

Suporte secundário: header `tracestate` para metadata vendor-specific.

### OTLP wire format (para `opentelemetry-standard`)
- Default port: 4318 (HTTP) ou 4317 (gRPC)
- Protocol Buffer schema definido pelo OTel
- Collector como sidecar/proxy padrão

### Core Analysis Loop — 4 fases (Cap 8)
1. Algo está errado (alerta, sintoma, complaint)
2. Formar hipótese a partir de dados (não de intuição)
3. Validar/refutar com query nos dados de telemetria
4. Próxima iteração — refinar hipótese ou confirmar root cause

</specifics>

<deferred>
## Ideias Adiadas

- Skills `observability-driven-development`, `event-based-slos`, `burn-rate-alerting`, `telemetry-sampling`, `telemetry-pipelines`, `observability-maturity-model` — Phase 30+ (não nesta fase)
- Agentes `observability-instrumenter`, `incident-investigator`, `slo-engineer`, `burn-rate-forecaster`, `omm-auditor` — Phase 30+ (não nesta fase)
- Comandos `/instrumentar-fase`, `/investigar-producao`, `/definir-slo`, `/burn-rate-status`, `/auditar-observabilidade`, `/observabilidade` — Phase 30+ (não nesta fase)

</deferred>
