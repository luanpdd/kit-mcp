# PROJECT.md — kit-mcp

> Bootstrap inicial em 2026-05-03 a partir do histórico de releases. Contexto consolidado da sessão de restauração + fix-up + 0.5.0.
> Última atualização: 2026-05-08 — v1.12 Legacy Code Mastery & AI-Era Refactoring em planejamento.

## Estado Atual

**v1.10.0 — SRE Engagement** publicado em npm + GitHub release 2026-05-07. Stack acumulado v1.8 (Supabase) + v1.9 (Observabilidade) + v1.10 (SRE Engagement) forma suíte coesa de production engineering. Stable API v1.0+ preservada (zero alterações em `src/core/`).

**v1.11 — SRE Resilience & Release Engineering** em planejamento (Phases 42-47). Cobre os 2 caps deferidos da v1.10 — Cap 22 (*Addressing Cascading Failures*) + Cap 8 (*Release Engineering*) — completando a série SRE iniciada na v1.10.

**v1.12 — Legacy Code Mastery & AI-Era Refactoring** em planejamento (Phases 48-78). 5ª suíte do kit (Legacy) derivada do livro **Working Effectively with Legacy Code — Michael Feathers (2004)** + modernizações para era 2026 (IA generativa, LLMs como dependência, Supabase Edge Functions como API-only applications, embeddings para detecção semântica). Endereça o problema clássico que toda equipe enfrenta: refatorar código crítico sem testes prévios.

## Milestone Atual: v1.12 Legacy Code Mastery & AI-Era Refactoring

**Objetivo:** Adicionar 5ª suíte ao kit (Legacy) derivada do livro Feathers (2004) — *characterization tests*, *seams*, *sprout/wrap*, *effect analysis*, *monster methods*, *extract class*, *programming by difference*, *API-only applications*, *shotgun surgery*, *storytelling/naked CRC* — todos modernizados para o contexto atual onde Supabase Edge Functions são as principais "API-only applications", LLMs são dependências legítimas que precisam ser fakeadas/instrumentadas, prompts são código legado que precisa de characterization, e embeddings + IA podem substituir trabalho mecânico de detecção.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (12+1 glossário)** — expertise consultável que viaja com o kit:
  - `_shared-legacy/glossary.md` — vocabulário canônico bilíngue (PT-BR↔EN) sobre legacy code, seams, characterization
  - `legacy-characterization-tests` — golden snapshots, 7 grupos de equivalência, sanitização (cap 13+23)
  - `legacy-seams-and-test-harness` — 3 tipos de seam, ~24 técnicas de break-deps (cap 3-4, 9-10, 25)
  - `legacy-sprout-wrap-techniques` — sprout method/class + wrap method/class (cap 6)
  - `legacy-effect-analysis` — effect sketches, inflection points, narrowing (cap 11-12, 16)
  - `legacy-monster-methods` — bulleted vs snarled, scratch refactoring, single-goal editing (cap 22)
  - `legacy-extract-class` — too-big classes, responsibility hot spots, single-responsibility refactoring (cap 20)
  - `legacy-programming-by-difference` — TDD em legacy, herança/composição como atalho temporário (cap 8)
  - `legacy-api-only-applications` — adapter/anti-corruption layer; aplicado a Supabase Edge Functions wrappando Stripe/OpenAI/etc (cap 15 + modernização)
  - `legacy-shotgun-surgery` — duplicate detection + extract; modernizado com semantic search via embeddings (cap 21 + modernização)
  - `legacy-storytelling-naked-crc` — gerar mental model de codebase desconhecido; modernizado com IA produzindo storytelling (cap 16-17 + modernização)
  - `ai-prompt-characterization` — prompts e tools são legacy code também; characterization de generations LLM com sampling deterministic (modernização sem precedente em 2004)
  - `llm-as-dependency` — fakear OpenAI/Anthropic clients; deterministic test mode com fixtures (modernização)
  - `pre-refactor-characterization` — auto-trigger gate ANTES de refactor de risco

- **Agentes (8)** — workers especializados:
  - `legacy-characterizer` — gera characterization tests cobrindo 7 grupos canônicos
  - `seam-finder` — analisa seams + recomenda técnica do cap 25 com menor custo
  - `refactor-safety-auditor` — gate canônico runtime; veredito GO/BLOCK/WARN/GO-OVERRIDE
  - `payload-capture-instrumenter` — instrumenta Edge Function para captura de payloads via mcp__supabase__get_logs (modernização)
  - `storytelling-analyst` — IA gera mental model + telling-the-story de codebase desconhecido (modernização)
  - `shotgun-surgery-detector` — detecta duplicação semântica via embeddings (pgvector se disponível) (modernização)
  - `ai-mutation-tester` — LLM gera mutants comportamentais (mais ricos que sintáticos) (modernização)
  - `observability-coverage-auditor` — audit de cobertura de 4 golden signals/SLO/burn-alert por Edge Function (modernização)

- **Comandos (10):**
  - `/caracterizar` — invoca legacy-characterizer
  - `/encontrar-seams` — invoca seam-finder
  - `/auditar-refactor` — invoca refactor-safety-auditor
  - `/refactor-seguro` — chain canônico (seams → caracterizar → audit → executar)
  - `/legacy [subcomando]` — orquestrador da Suíte Legacy (5ª da família após /supabase, /observabilidade, /sre)
  - `/capturar-payloads` — instrumenta Edge Function pra captura via Supabase logs (modernização)
  - `/caracterizar-prompt` — characterization de prompts/tools LLM (modernização)
  - `/storytelling` — IA gera mental model de codebase (modernização)
  - `/detectar-duplicacao` — shotgun surgery via embeddings (modernização)
  - `/auditar-observabilidade-cobertura` — audit X/N Edge Functions com 4 golden signals + SLO + burn alert (modernização)

- **Audit gates (3):**
  - `legacy-refactor-safety` — bloqueia plano com refactor sem characterization
  - `ai-prompt-stability` — prompts em prod precisam de characterization (modernização)
  - `observability-coverage` — % Edge Functions com golden signals + SLO + burn alert ≥ threshold (modernização)

- **Integração com Suítes existentes (4 patches):**
  - `four-golden-signals` (v1.10): patch para sugerir characterization de payloads ao instrumentar
  - `prr-conductor` (v1.10): Axe 5 (Change Management) consume REFACTOR-SAFETY.md
  - `omm-auditor` (v1.9): Capacidade 1 (Resilience) consulta % refactors com safety net
  - `supabase-edge-fn-writer` (v1.8): aplica adapter pattern + payload capture pattern built-in

- **Integração com fluxo framework (3 patches):**
  - `planner` + `executor` + `verifier` — gate runtime + verificação reversa pós-refactor
  - `/discutir-fase` — pergunta canônica + injeção de seção `<refactor_safety>` em CONTEXT.md
  - `/auditar-marco` + `/forense` — opt-in audit retroativo + lessons learned canônicas

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: *Working Effectively with Legacy Code* — Michael Feathers (Prentice Hall / Robert C. Martin Series, 2004). ISBN 978-0-13-117705-5.
- Modernizações documentadas explicitamente — cada skill nova marca o que é "Feathers original" vs "extensão IA/Supabase 2026".
- Conteúdo PT-BR (alinhado v1.8/v1.9/v1.10/v1.11). Code blocks EN com comentários PT-BR.
- Roadmap começa em **Phase 48** (continua v1.11 que termina em Phase 47).
- Integra naturalmente com as outras 4 suítes — Supabase, Observabilidade, SRE, e a futura SRE Resilience.

**Beneficiários principais:**
- Suíte Supabase v1.8 — `supabase-edge-fn-writer` ganha `legacy-api-only-applications` pattern + payload capture
- Suíte Observabilidade v1.9 — `omm-auditor` Capacidade 1 (Resilience) consulta legacy-refactor coverage; `/auditar-observabilidade-cobertura` complementa OMM
- Suíte SRE v1.10 — `prr-conductor` Axe 5 consume REFACTOR-SAFETY; `/postmortem` consulta REFACTOR-SAFETY em regression incidents
- Fluxo framework — todos os comandos principais ganham awareness de legacy code

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde.

## ~~Milestone Anterior: v1.11 SRE Resilience & Release Engineering~~

**Objetivo:** Adicionar a 2ª camada de expertise SRE ao kit, derivada dos caps 22 e 8 do livro Google SRE — resiliência operacional (cascading failures, retries com jitter, load shedding, graceful degradation) e disciplina de release (hermetic builds, deployment philosophy, policy enforcement). Completa a v1.10 e estabelece base para projetos production-bound com tier-1 maturity.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (5 + 1 glossary patch)** — expertise consultável que viaja com o kit:
  - `cascading-failures` — triggers, loops de feedback, prevenção (cap 22 main)
  - `load-shedding-graceful-degradation` — queue management, load shedding patterns (cap 22 sub)
  - `retry-strategies` — jitter + exponential backoff + deadlines + idempotency (cap 22 sub)
  - `hermetic-builds` — reproducibility + isolation + provenance (cap 8 sub)
  - `release-engineering` — deployment philosophy + self-service + policy enforcement (cap 8 main)
  - Patch em `_shared-sre/glossary.md` (v1.10) — adiciona vocabulário cap 22+8 (cascading failure, retry storm, load shedding, graceful degradation, hermetic build, release pipeline, deployment policy, kill switch, throttle)

- **Agentes (3)** — workers especializados:
  - `cascading-failures-auditor` — analisa código de serviço para triggers de cascading (sem timeout, retry sem jitter, sem circuit breaker, dependências sem health check) e produz `CASCADING-AUDIT.md` priorizado
  - `load-shedding-instrumenter` — aplica padrões de load shedding em código (queue depth gauge, drop policy, deadline propagation, server-side rate limit)
  - `release-pipeline-auditor` — audita CI/CD para hermeticidade, reprodutibilidade, policy enforcement; produz `RELEASE-AUDIT.md`

- **Comandos (3 + extensões /sre):**
  - `/auditar-cascading` — invoca `cascading-failures-auditor`
  - `/load-shedding` — invoca `load-shedding-instrumenter`
  - `/auditar-release` — invoca `release-pipeline-auditor`
  - Extensão do orquestrador `/sre` com 3 novos subcomandos (`cascading`, `load-shedding`, `release`)

- **Integração com Suítes existentes (5 patches):**
  - `four-golden-signals` (v1.10): Saturation signal documentada como early warning de cascading failure
  - `prr-conductor` (v1.10): Axe 4 (Capacity Planning) ganha checks de cascading; Axe 5 (Change Management) ganha hermeticidade
  - `supabase-edge-fn-writer` (v1.8): template ganha retry-with-jitter, deadline propagation, server-side load shedding
  - `omm-auditor` (v1.9): Capacidade 1 (Resilience) consulta `cascading-failures-auditor`
  - `/concluir-marco`: gate `release-pipeline-policy` opt-in (paralelo ao PRR gate v1.10)

- **Audit gates (2):** `cascading-failures-prevention`, `release-pipeline-policy`

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: mesmo livro v1.10 (*Site Reliability Engineering*, 978-1-491-92912-4). Caps 22 e 8 — sem expansão para Workbook por design (mantém narrativa SSOT).
- Conteúdo em PT-BR (alinhado com v1.8/v1.9/v1.10). Code blocks EN com comentários PT-BR.
- Roadmap começa em **Phase 42** (continuação de v1.10 que terminou em 41).
- Numeração de skills: extension natural da família SKFD (existing 5 SKFD-SRE + 5 novas SKFD-SRE-2).

**Beneficiários principais:**
- Suíte SRE v1.10 — `prr-conductor` ganha checks Axe 4+5; `four-golden-signals` ganha contexto cascading
- Suíte Observabilidade v1.9 — `omm-auditor` Capacidade 1 (Resilience) consulta cascading-auditor
- Suíte Supabase v1.8 — `supabase-edge-fn-writer` ganha resiliência built-in
- Fluxo framework — `/concluir-marco` ganha release-pipeline gate (opt-in)

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde.

## Histórico (arquivado abaixo)

<details>
<summary>v1.10 SRE Engagement — entregue 2026-05-07</summary>

## Milestone v1.10 SRE Engagement (entregue 2026-05-07)

## Histórico (arquivado abaixo)

<details>
<summary>v1.10 SRE Engagement — milestone original</summary>

## Milestone v1.10 SRE Engagement (entregue 2026-05-07)

**Objetivo:** Adicionar uma camada de expertise em SRE (Site Reliability Engineering) ao kit derivada do livro do Google, complementando v1.9 (Observabilidade) com práticas de engagement de SRE — Production Readiness Review (PRR), Four Golden Signals, Postmortem Culture blameless, Toil elimination, Risk management. Camada se beneficia profundamente da Suíte Observabilidade v1.9 (SLOs, burn-rate, OMM) e da Suíte Supabase v1.8 (instrumentação de Edge Functions com golden signals).

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (6)** — expertise consultável que viaja com o kit:
  - `_shared-sre/glossary.md` — vocabulário canônico bilíngue (PT-BR↔EN) sobre SRE
  - `sre-risk-management` — risk continuum, 99.99% wisdom, error budget como balanço explícito risk × innovation (cap 3)
  - `four-golden-signals` — Latency + Traffic + Errors + Saturation como sinais mínimos de monitoramento (cap 6)
  - `eliminating-toil` — definição de toil, regra ≤ 50%, padrões de automação (cap 5)
  - `blameless-postmortems` — template canônico, "no postmortem left unreviewed", Wheel of Misfortune (cap 15)
  - `production-readiness-review` — checklist PRR canônica + Engagement Model (Simple PRR / Early Engagement / Frameworks) (cap 32)

- **Agentes (4)** — workers especializados:
  - `golden-signals-instrumenter` — aplica os 4 golden signals em código (latency/traffic/errors/saturation com histograms/counters); especialização do `observability-instrumenter` v1.9
  - `toil-auditor` — analisa repo + commits + scripts para identificar toil (manual repetitivo automatizável sem valor durável); recomenda automação
  - `postmortem-writer` — após `incident-investigator` v1.9 fechar Core Analysis Loop, gera postmortem blameless seguindo template canônico
  - `prr-conductor` — conduz Production Readiness Review para serviço/feature; produz PRR-REPORT.md scored com gaps e action items

- **Comandos (5+1 orquestrador):**
  - `/golden-signals` — aplica 4 golden signals em fase ou serviço (invoca `golden-signals-instrumenter`)
  - `/auditar-toil` — identifica toil no projeto, sugere automação (invoca `toil-auditor`)
  - `/postmortem` — gera postmortem blameless após incident-investigator (invoca `postmortem-writer`)
  - `/prr` — conduz PRR para serviço/feature (invoca `prr-conductor`)
  - `/risk-budget` — exibe state do error budget vs risk continuum (consume SLOs v1.9)
  - `/sre [subcomando]` — orquestrador único (análogo a `/supabase`, `/observabilidade`)

- **Integração com Suíte Observabilidade v1.9** — patches em 2 artefatos: `event-based-slos` ganha menção a risk continuum; `omm-auditor` consume `toil-auditor` para Capacidade 3 (Complexidade).

- **Integração com Suíte Supabase v1.8** — patches em 4 agentes: `supabase-edge-fn-writer` aplica os 4 golden signals; `supabase-architect` referencia PRR antes de prod; `supabase-migration-writer` identifica toil em scripts SQL repetitivos; `supabase-storage-implementer` aplica saturation signal para uploads.

- **Integração com fluxo framework** — patches em 3 comandos: `/forense` → chain para `/postmortem`; `/concluir-marco` → gate `/prr` para features production-bound; `/auditar-marco` → invoca `/auditar-toil` para scoring OMM Capacidade 3.

- **Audit gates (3 novos):** `golden-signals-coverage`, `postmortem-template-required`, `prr-checklist-coverage`.

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: livro *Site Reliability Engineering* (978-1-491-92912-4), gratuito em sre.google/books.
- Conteúdo em PT-BR (alinhado com o resto do kit). Code blocks EN com comentários PT-BR (precedente v1.8/v1.9).
- Roadmap começa em **Phase 36** (continuação de v1.9 que terminou em 35).

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar. CI permanece verde.

</details>

## ~~Milestone Anterior: v1.9 Observabilidade (concluído 2026-05-06)~~

**Objetivo:** Adicionar uma camada de expertise em observabilidade ao kit (skills + agentes + comandos), inspirada em *Observability Engineering*, aproveitada pela Suíte Supabase existente para potencializar o uso dos MCP tools `mcp__supabase__get_logs/get_advisors/execute_sql` em diagnóstico, SLOs e instrumentação.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (11)** — expertise consultável que viaja com o kit:
  - `_shared-observability/glossary.md` — vocabulário canônico (event, span, trace, SLI, SLO, error budget, burn rate, OMM)
  - `structured-events` — wide events de alta cardinalidade (1/request)
  - `distributed-tracing` — trace_id/span_id, W3C TraceContext, stitching
  - `opentelemetry-standard` — SDK, Tracer, Meter, Exporter, Collector, OTLP
  - `core-analysis-loop` — debug iterativo from first principles (4 fases)
  - `observability-driven-development` — bundle telemetria com feature, 4 perguntas pré-PR
  - `event-based-slos` — SLI event-based, sliding window, decouple what/why
  - `burn-rate-alerting` — lookahead/baseline windows, fator 4×
  - `telemetry-sampling` — head/tail, by-key, dynamic
  - `telemetry-pipelines` — routing, buffering, filtering
  - `observability-maturity-model` — 5 capacidades (resiliência, qualidade, complexidade, cadência, comportamento)

- **Agentes (5+1 opcional)** — workers especializados:
  - `observability-instrumenter` — instrumenta código com OTel + structured events
  - `incident-investigator` — aplica Core Analysis Loop usando `mcp__supabase__get_logs/execute_sql/get_advisors`
  - `slo-engineer` — define SLI/SLO/error budget materializando contagem em SQL
  - `burn-rate-forecaster` — calcula burn rate predictive com janelas
  - `omm-auditor` — pontua projeto contra Observability Maturity Model
  - `telemetry-sampler` (opcional) — config de sampling por endpoint
  - `telemetry-pipeline-architect` (opcional) — config de OTel Collector

- **Comandos (5+1 orquestrador):**
  - `/instrumentar-fase` — após `/planejar-fase`, gera `INSTRUMENTATION.md` por plano
  - `/definir-slo` — gera `SLO.md` + SQL para materializar SLI events
  - `/investigar-producao` — Core Analysis Loop guiado, estado persistente
  - `/burn-rate-status` — tabela SLO/% gasto/ETA exhaustão
  - `/auditar-observabilidade` — OMM scored 5 capacidades
  - `/observabilidade [subcomando]` — orquestrador único (análogo a `/supabase`)

- **Integração com Suíte Supabase** — patches nos 7 agentes existentes (architect, migration-writer, rls-writer, edge-fn-writer, realtime-implementer, auth-bootstrapper, storage-implementer) para consultarem as skills novas.

- **Integração com fluxo framework** — `/discutir-fase` pergunta sobre instrumentação, `/planejar-fase` bloqueia se ODD ausente, `/concluir-marco` gate em OMM regression.

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Material-fonte: livro *Observability Engineering* (978-1-492-07644-5).
- Conteúdo em PT-BR (alinhado com o resto do kit).
- Roadmap começa em **Phase 29** (continuação de v1.8 que terminou em 28).

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos artefatos disponíveis ao sincronizar (`kit sync install <target>`). CI permanece verde.

## ~~Milestone Anterior: v1.8 Suíte Supabase (concluído 2026-05-06)~~

**Objetivo:** Adicionar uma camada completa de expertise Supabase ao kit (skills + agents + commands), permitindo que consumidores do `@luanpdd/kit-mcp` tenham apoio canônico ao construir e manter backends Supabase — Postgres/DB, Auth, Realtime, Edge Functions, RLS, Migrations — diretamente do fluxo de trabalho do kit.

**Funcionalidades alvo (todas aditivas, zero superfície de API quebrada):**

- **Skills (8)** — expertise consultável que viaja com o kit:
  - `supabase-realtime` — broadcast vs postgres_changes, RLS para realtime, naming de canais, triggers `realtime.broadcast_changes`
  - `supabase-auth-ssr` — Next.js v16 + `@supabase/ssr` (getAll/setAll), browser/server clients, proxy
  - `supabase-edge-functions` — Deno runtime, `npm:`/`jsr:` imports, env vars, `EdgeRuntime.waitUntil`
  - `supabase-declarative-schema` — `supabase/schemas/`, `db diff`, ordering lexicográfica, caveats
  - `supabase-rls-policies` — `auth.uid()`, policies por operação, indexing, MFA, performance
  - `supabase-database-functions` — SECURITY INVOKER, `search_path`, immutable/stable, triggers
  - `supabase-migrations` — naming `YYYYMMDDHHmmss_*.sql`, RLS obrigatório, granular policies
  - `supabase-postgres-style` — Postgres SQL style guide (lowercase, snake_case, plurals)

- **Agents (6)** — workers ativos especializados:
  - `supabase-architect` — projeta schema + RLS + topologia realtime antes da implementação
  - `supabase-migration-writer` — escreve migrations seguindo declarative schema + RLS + style guide
  - `supabase-rls-writer` — gera RLS policies com indexing recomendado
  - `supabase-edge-fn-writer` — escreve Deno Edge Functions
  - `supabase-realtime-implementer` — configura canais (client + DB triggers + RLS)
  - `supabase-auth-bootstrapper` — bootstrap Next.js v16 com Supabase Auth (SSR)
  - (existente: `schema-checker` — pré-migration validator; será cross-referenced pelos novos agents)

- **Commands (1)** — entry point único:
  - `/supabase [subcomando]` — orquestrador que roteia para o agent certo (`arquiteto`, `migration`, `rls`, `edge`, `realtime`, `auth`)

**Decisões de stack:**
- Zero deps novas. Apenas conteúdo de kit (markdown). Stable API v1.0+ preservada — só adições.
- Agents usam tools `mcp__supabase__*` quando disponíveis (precedente: `schema-checker.md`).
- Conteúdo em PT-BR (alinhado com o resto do kit).
- Material-fonte: 7 guias oficiais Supabase (Realtime, Auth SSR, Edge Functions, Declarative Schema, RLS, DB Functions, Migrations, Postgres Style).
- Roadmap começa em **Phase 25** (continuação de v1.7 que terminou em 24).

**Contrato preservado:** Quem usa kit-mcp em produção não percebe nada além de novos agents/commands/skills disponíveis ao sincronizar (`kit sync install <target>`). CI permanece verde.

## ~~Milestone Anterior: v1.7 perf+lean part 2 + UX naming canonical (concluído 2026-05-06)~~

**Objetivo:** Continuar otimização interna de v1.6 com cuts mais profundos em workflows + dedup de boilerplate de agentes + sync stub-only mode. Adicionar `/fazer` como entrypoint canônico que rouba os outros como aliases.

**Funcionalidades alvo:**
- **P1 cont.** — compactar 3 workflows maiores (discuss-phase 49 KB, new-project 40 KB, plan-phase 36 KB) usando playbook de v1.6
- **P3** — stub-only mode em sync (lê só frontmatter, não content body) → 3-5× mais rápido em sync default
- **P4** — agent boilerplate dedup via `<shared>` references (kit/agents/_shared/) — reduz custo agregado do executor multiplicado
- **U3** — `/fazer` vira canonical com árvore de decisão clara; `/expresso`, `/rapido`, `/proximo` ficam como aliases documentados

## ~~Milestone Anterior: v1.6 perf+lean (interno — concluído 2026-05-05)~~

**Objetivo:** Endereçar 16 itens identificados pela auditoria de codebase (executada após v1.5.3) que ficaram fora do bundle quick-win. Foco: tornar o servidor mais barato de rodar, mais seguro, com release pipeline mais robusto e prompts mais enxutos.

**Funcionalidades alvo (todas internas, zero superfície de API nova):**
- **Performance** — listKit caching, compilação top-level de regex, reuso de kit em sync/reverse-sync, healthz probe com timeout local, paginação opcional em /state
- **Segurança** — TOCTOU em acquireLockOrReclaim, normalização de path em walkTree, redactPath case-insensitive (Windows), audit periódico de open@11
- **Infra** — `prepublishOnly` script, `.npmignore` explícito, Node 24 na matriz CI, mensagem do deps-budget gate sincronizada com count real
- **Tokens** — compactar `planner.md` (53 KB → ~30 KB), lazy-load CLAUDE.md gerado, consolidar headers recursivos em agents grandes

**Decisões de stack:**
- Continua zero deps novas. Otimização interna sem ampliar superfície.
- Sem mudanças de API runtime (`Stable API v1.0+` preservada). Reduções em outputs de tool MCP são "remoções de campo opcional" — clientes ainda funcionam.
- Roadmap começa em **Phase 19** (continuando de v1.2 que terminou em Phase 18; v1.3-v1.5.x foram patches ad-hoc fora do framework).

**Contrato preservado:** Quem usa kit-mcp em produção (sync/reverse-sync/MCP via npx ou global) não percebe nada além de menor latência e menor consumo de tokens. CI permanece 6/6 verde, smoke tests inalterados.

## Visão de uma frase

kit-mcp é um MCP server que distribui o fluxo de trabalho pessoal do mantenedor (agents, slash-commands, framework de planejamento brownfield em PT-BR, hooks) e sincroniza esse kit no layout nativo de qualquer IDE compatível (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity, Copilot, Trae).

## Por que existe

- O conteúdo de `.claude/agents/`, `.claude/commands/` e `.claude/skills/` é poderoso mas amarrado ao Claude Code.
- O mesmo conteúdo precisa também viver como `AGENTS.md` para Codex, `GEMINI.md` para Gemini, `.cursor/rules/` para Cursor, etc.
- Manter cópias paralelas drift imediatamente.
- kit-mcp guarda a fonte canônica em um único lugar (`kit/`) e projeta para cada IDE através de um registry table único (`src/core/registry.js`).

## Stack

- **Runtime**: Node.js ≥ 20, ESM puro, sem build step.
- **Deps de runtime**: `@modelcontextprotocol/sdk`, `commander`, `chokidar`.
- **Distribuição**: npm (`@luanpdd/kit-mcp`, scoped, public).
- **CI**: GitHub Actions, smoke tests em Ubuntu/macOS/Windows × Node 20/22.

## Arquitetura

```
CLI ↔ src/core/  (pure runtime: registry, kit, sync, gates, forensics, watch, reverse-sync)
       ↑       
MCP server (stdio) — exposes 6 action-dispatch tools (kit, sync, reverse-sync, gates, forensics, install)
       ↑
.mcp.json registration → IDE invoca o server quando abre o projeto
```

Sync grava stubs markdown-reference por padrão (`.claude/agents/foo.md` aponta de volta para `kit/agents/foo.md`). Mirror-tree para framework + hooks (cópia direta da subtree).

## Princípios de produto

1. **Single canonical source.** `kit/` é a verdade. Tudo em `.claude/` (e equivalentes) é regenerável.
2. **Add-an-IDE = uma entrada na tabela.** O TARGETS dict em `registry.js` é o único lugar onde IDEs são descritas.
3. **Pre-1.0 SemVer permissivo.** Mudanças comportamentais são minor bumps; correções são patch.
4. **Pacote pequeno, dependências mínimas.** Nada de build steps, frameworks de teste pesados, ou polifills.

## Restrições

- **Sem 2FA bypass nas chaves npm além do necessário pra publicação automática.**
- **Não embarcar conteúdo de terceiros** (Anthropic Cowork skills, Notion IDs privados, URLs de repos privados).
- **Cross-platform sempre.** Windows, macOS e Linux têm que funcionar igual.

## Evolução

Este documento evolui nas transições de fase e limites de milestone.

**Após cada transição de fase** (via `/transicao`):
1. Requisitos invalidados? → Mover para Fora do Escopo com motivo
2. Requisitos validados? → Mover para Validados com referência de fase
3. Novos requisitos surgiram? → Adicionar em Ativos
4. Decisões a registrar? → Adicionar em Decisões-chave
5. "O Que É" ainda está preciso? → Atualizar se driftar

**Após cada milestone** (via `/concluir-marco`):
1. Revisão completa de todas as seções
2. Verificação do Valor Central — ainda é a prioridade certa?
3. Auditar Fora do Escopo — motivos ainda são válidos?
4. Atualizar Contexto com estado atual
